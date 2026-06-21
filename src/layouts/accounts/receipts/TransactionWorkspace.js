import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Chip from "@mui/material/Chip";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import IncomeAgreementsModuleTabs from "layouts/income-agreements/components/IncomeAgreementsModuleTabs";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import ReceiptForm from "./ReceiptForm";
import {
  computeGrandTotal,
  flattenReceiptForGrid,
  formatAmount,
  isReceiptFinalizedByAhq,
  RECEIPT_AHQ_TAB,
} from "./receiptUtils";
import receiptsApi from "services/api.receipts.service";
import { isSuperuserOrAhqSupervisorUser } from "services/api.service";

function formatDateDisplay(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  const [year, month, day] = raw.split("-");
  if (year && month && day) return `${day}-${month}-${year}`;
  return raw;
}

function TransactionWorkspace({ labels, incomeAgreementsModule, useReceiptApi = false }) {
  const [records, setRecords] = useState([]);
  const [paginationHost, setPaginationHost] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsRecord, setAttachmentsRecord] = useState(null);
  const [ahqTab, setAhqTab] = useState(RECEIPT_AHQ_TAB.PENDING);

  const showAhqTabs = useReceiptApi;
  const showMonthField = Boolean(labels.gridMonth);

  const pendingRecords = useMemo(
    () => records.filter((record) => !isReceiptFinalizedByAhq(record)),
    [records]
  );
  const finalizedRecords = useMemo(
    () => records.filter((record) => isReceiptFinalizedByAhq(record)),
    [records]
  );
  const visibleRecords = useMemo(() => {
    if (!showAhqTabs) return records;
    return ahqTab === RECEIPT_AHQ_TAB.FINALIZED ? finalizedRecords : pendingRecords;
  }, [ahqTab, finalizedRecords, pendingRecords, records, showAhqTabs]);

  useEffect(() => {
    if (!useReceiptApi) return undefined;

    let mounted = true;
    const loadReceipts = async () => {
      try {
        const response = await receiptsApi.listReceipts();
        if (!mounted) return;
        const rows = receiptsApi.unwrapList(response).map(receiptsApi.normalizeReceiptRow);
        setRecords(rows);
      } catch (error) {
        console.error("Failed to load receipts:", error);
        if (mounted) window.alert("Failed to load receipts.");
      }
    };

    loadReceipts();
    return () => {
      mounted = false;
    };
  }, [useReceiptApi]);

  const txt = (v) => (v != null && String(v).trim() !== "" ? String(v) : "-");

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
  };

  const handleEditRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    setCurrentRecord(record);
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    if (useReceiptApi) {
      try {
        await receiptsApi.removeReceipt(recordToDelete);
      } catch (error) {
        console.error("Failed to delete receipt:", error);
        window.alert("Failed to delete receipt.");
        return;
      }
    }
    setRecords((prev) => prev.filter((row) => Number(row.id) !== Number(recordToDelete)));
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleOpenAttachments = (record) => {
    setAttachmentsRecord(record);
    setAttachmentsDialogOpen(true);
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsRecord(null);
  };

  const handleSubmit = async (payload) => {
    const existingId = currentRecord?.id;
    const grandTotal = computeGrandTotal(payload.lines);

    if (useReceiptApi) {
      const canFinalizeByAhq = Boolean(existingId) && isSuperuserOrAhqSupervisorUser();
      const apiPayload = receiptsApi.buildReceiptApiPayload(payload, grandTotal, {
        includeFinalizedByAhq: canFinalizeByAhq,
      });
      try {
        if (existingId) {
          await receiptsApi.updateReceipt(existingId, apiPayload);
          const normalized = receiptsApi.normalizeReceiptRow({
            ...apiPayload,
            ...(canFinalizeByAhq ? {} : { FinalizedByAhq: currentRecord?.finalizedByAhq }),
            Id: existingId,
          });
          setRecords((prev) =>
            prev.map((row) => (Number(row.id) === Number(existingId) ? normalized : row))
          );
          return { id: existingId };
        }

        const created = await receiptsApi.createReceipt(apiPayload);
        const createdId = created?.id ?? created?.Id;
        const normalized = receiptsApi.normalizeReceiptRow({
          ...apiPayload,
          ...(created || {}),
          Id: createdId,
        });
        setRecords((prev) => [normalized, ...prev]);
        return { id: createdId };
      } catch (error) {
        console.error("Failed to save receipt:", error);
        window.alert("Failed to save receipt.");
        throw error;
      }
    }

    if (existingId) {
      setRecords((prev) =>
        prev.map((row) =>
          Number(row.id) === Number(existingId) ? { ...payload, id: existingId } : row
        )
      );
      return { id: existingId };
    }
    const nextId = records.length ? Math.max(...records.map((r) => Number(r.id) || 0)) + 1 : 1;
    setRecords((prev) => [{ ...payload, id: nextId }, ...prev]);
    return { id: nextId };
  };

  const columns = useMemo(
    () => [
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "attachments",
        Header: "Attach",
        accessor: "attachments",
        align: "center",
        Cell: ({ row }) => row?.original?.attachments,
      },
      {
        id: "sno",
        Header: "S.No",
        accessor: "sno",
        align: "center",
        Cell: ({ value }) => (value != null && value !== "" ? value : "-"),
      },
      {
        id: "item",
        Header: "Item",
        accessor: "item",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "account",
        Header: "Account",
        accessor: "account",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "tinTrn",
        Header: "TIN-TRN",
        accessor: "tinTrn",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "amount",
        Header: "Amount",
        accessor: "amount",
        align: "right",
        Cell: ({ value }) => formatAmount(value),
      },
      {
        id: "total",
        Header: "Total",
        accessor: "total",
        align: "right",
        Cell: ({ value }) => formatAmount(value),
      },
      {
        id: "date",
        Header: "Date",
        accessor: "date",
        align: "left",
        Cell: ({ value }) => formatDateDisplay(value),
      },
      ...(labels.gridMonth
        ? [
            {
              id: "month",
              Header: labels.gridMonth,
              accessor: "month",
              align: "left",
              Cell: ({ value }) => txt(value),
            },
          ]
        : []),
      {
        id: "reference",
        Header: "Reference",
        accessor: "reference",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "paidFrom",
        Header: labels.gridPaidFrom,
        accessor: "paidFrom",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "payee",
        Header: labels.gridPayee,
        accessor: "payee",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
    ],
    [labels.gridPaidFrom, labels.gridPayee, labels.gridMonth]
  );

  const computedRows = useMemo(
    () =>
      visibleRecords.map((record, index) => {
        const flat = flattenReceiptForGrid(record, index);
        const hasAttachments = flat.attachmentCount > 0;
        return {
          ...flat,
          actions: (
            <MDBox
              display="flex"
              alignItems="center"
              justifyContent="center"
              sx={{
                backgroundColor: "#f8f9fa",
                gap: "2px",
                padding: "2px",
                borderRadius: "2px",
              }}
            >
              {canEditCurrentMenu() && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(record.id)}
                  title="Edit"
                  sx={{ padding: "1px" }}
                >
                  <Icon>edit</Icon>
                </IconButton>
              )}
              {canDeleteCurrentMenu() && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(record.id)}
                  title="Delete"
                  sx={{ padding: "1px" }}
                >
                  <Icon>delete</Icon>
                </IconButton>
              )}
            </MDBox>
          ),
          attachments: (
            <IconButton
              size="small"
              color={hasAttachments ? "success" : "error"}
              onClick={() => handleOpenAttachments(record)}
              title="View Attachments"
              sx={{ padding: "1px" }}
            >
              <Icon>visibility</Icon>
            </IconButton>
          ),
        };
      }),
    [visibleRecords]
  );

  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: visibleRecords.length }),
    [visibleRecords.length]
  );

  const exportFileName = useMemo(() => {
    if (!showAhqTabs) return labels.exportFileName;
    return ahqTab === RECEIPT_AHQ_TAB.FINALIZED
      ? `${labels.exportFileName}-Finalized`
      : `${labels.exportFileName}-Pending`;
  }, [ahqTab, labels.exportFileName, showAhqTabs]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title={labels.pageTitle}
        subtitle={labels.pageSubtitle}
        metadata={workspaceMetadata}
        tabs={
          showAhqTabs ? (
            <MDBox px={3} sx={{ flexShrink: 0, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
              <Tabs
                value={ahqTab}
                onChange={(_, value) => setAhqTab(value)}
                aria-label="Receipt AHQ approval tabs"
                sx={{
                  minHeight: 40,
                  "& .MuiTab-root": {
                    minHeight: 40,
                    textTransform: "none",
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                  },
                }}
              >
                <Tab
                  value={RECEIPT_AHQ_TAB.PENDING}
                  label={`${labels.tabPendingAhq || "Pending AHQ approval"} (${
                    pendingRecords.length
                  })`}
                />
                <Tab
                  value={RECEIPT_AHQ_TAB.FINALIZED}
                  label={`${labels.tabFinalizedAhq || "Finalized by AHQ"} (${
                    finalizedRecords.length
                  })`}
                />
              </Tabs>
            </MDBox>
          ) : incomeAgreementsModule ? (
            <IncomeAgreementsModuleTabs />
          ) : null
        }
        filters={
          incomeAgreementsModule ? (
            <MDBox px={3} sx={{ flexShrink: 0 }}>
              <MDBox display="flex" justifyContent="flex-end" alignItems="center" minHeight={28}>
                <MDBox
                  ref={setPaginationHost}
                  className="income-agreements-filter-pagination"
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    minHeight: 22,
                    "& .MuiPaginationItem-root": {
                      fontSize: "0.6rem",
                      minWidth: "1.2rem",
                      height: "1.2rem",
                      padding: "0 2px",
                    },
                    "& .MuiPaginationItem-icon": {
                      fontSize: "0.8rem",
                    },
                    "& .compact-grid-pagination": {
                      gap: 0,
                    },
                  }}
                />
              </MDBox>
            </MDBox>
          ) : null
        }
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "auto",
          },
          "& .MuiTable-root": {
            tableLayout: "auto",
            width: "max-content",
            borderCollapse: "collapse",
          },
          "& .MuiTable-root th": {
            fontSize: "0.875rem !important",
            fontWeight: "700 !important",
            padding: "1px 4px !important",
            borderBottom: "1px solid #d0d0d0",
            whiteSpace: "nowrap",
          },
          "& .MuiTable-root td": {
            padding: "1px 4px !important",
            borderBottom: "1px solid #e0e0e0",
            whiteSpace: "nowrap",
          },
        }}
      >
        <DataTable
          table={{ columns, rows: computedRows }}
          isSorted={false}
          stickyToolbarAndHeader
          entriesPerPage={
            incomeAgreementsModule
              ? false
              : {
                  defaultValue: 20,
                  entries: [10, 25, 50, 100],
                }
          }
          showTotalEntries={!incomeAgreementsModule}
          noEndBorder
          canSearch
          exportFileName={exportFileName}
          contentFitTable
          disableHeaderMetrics
          pagination={true}
          paginationHost={incomeAgreementsModule ? paginationHost : null}
        />
      </EnterpriseWorkspace>

      <ReceiptForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        labels={labels}
        showMonthField={showMonthField}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>{labels.deleteConfirm}</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={attachmentsDialogOpen} onClose={handleCloseAttachments} fullWidth maxWidth="sm">
        <DialogTitle>
          Attachments
          {attachmentsRecord?.id ? ` (#${attachmentsRecord.id})` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {Array.isArray(attachmentsRecord?.attachments) &&
          attachmentsRecord.attachments.length > 0 ? (
            <MDBox display="flex" flexDirection="column" gap={1}>
              {attachmentsRecord.attachments.map((file) => (
                <Chip
                  key={file.id}
                  label={file.name}
                  variant="outlined"
                  size="small"
                  sx={{ justifyContent: "flex-start" }}
                />
              ))}
            </MDBox>
          ) : (
            <MDTypography variant="body2" color="text">
              {labels.noAttachments}
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseAttachments}>Close</MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

TransactionWorkspace.propTypes = {
  labels: PropTypes.shape({
    paidFrom: PropTypes.string.isRequired,
    paidFromRequired: PropTypes.string.isRequired,
    payeeSection: PropTypes.string.isRequired,
    payeeRequired: PropTypes.string.isRequired,
    payeePlaceholder: PropTypes.string.isRequired,
    gridPaidFrom: PropTypes.string.isRequired,
    gridPayee: PropTypes.string.isRequired,
    gridMonth: PropTypes.string,
    month: PropTypes.string,
    monthRequired: PropTypes.string,
    pageTitle: PropTypes.string.isRequired,
    pageSubtitle: PropTypes.string.isRequired,
    exportFileName: PropTypes.string.isRequired,
    addFormTitle: PropTypes.string.isRequired,
    editFormTitle: PropTypes.string.isRequired,
    deleteConfirm: PropTypes.string.isRequired,
    noAttachments: PropTypes.string.isRequired,
    tabPendingAhq: PropTypes.string,
    tabFinalizedAhq: PropTypes.string,
  }).isRequired,
  incomeAgreementsModule: PropTypes.bool,
  useReceiptApi: PropTypes.bool,
};

TransactionWorkspace.defaultProps = {
  incomeAgreementsModule: false,
  useReceiptApi: false,
};

export default TransactionWorkspace;
