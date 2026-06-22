import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Chip from "@mui/material/Chip";
import Checkbox from "@mui/material/Checkbox";
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
import AgreementProvPdfPreviewDialog from "components/AgreementProvPdfPreviewDialog";
import ReceiptForm from "./ReceiptForm";
import {
  computeGrandTotal,
  flattenReceiptForGrid,
  formatAmount,
  getReceiptInvoiceKeys,
  isReceiptFinalizedByAhq,
  RECEIPT_AHQ_TAB,
} from "./receiptUtils";
import { generateReceiptPdf } from "./receiptPdf";
import receiptsApi from "services/api.receipts.service";
import { isSuperuserOrAhqSupervisorUser } from "services/api.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridAmount,
  renderCollectionsGridSno,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";

function readReceiptRouteFilters() {
  if (typeof window === "undefined") return { contractNo: "", tab: "" };
  const readFromSearch = (searchText) => {
    const params = new URLSearchParams(String(searchText || ""));
    return {
      contractNo: String(params.get("contractNo") || "").trim(),
      tab: String(params.get("tab") || "")
        .trim()
        .toLowerCase(),
    };
  };
  const fromSearch = readFromSearch(window.location.search);
  if (fromSearch.contractNo || fromSearch.tab) return fromSearch;
  const hash = String(window.location.hash || "");
  const queryIndex = hash.indexOf("?");
  return queryIndex >= 0 ? readFromSearch(hash.slice(queryIndex)) : { contractNo: "", tab: "" };
}

function receiptLineMatchesContract(line, contractNo) {
  const target = String(contractNo || "")
    .trim()
    .toLowerCase();
  if (!target) return true;

  const directContract = String(line?.contractNo ?? line?.ContractNo ?? "")
    .trim()
    .toLowerCase();
  if (directContract === target) return true;

  const invoiceKey = String(line?.invoiceKey ?? line?.InvoiceKey ?? "").trim();
  if (!invoiceKey.includes("|")) return false;
  const [keyContractNo] = invoiceKey.split("|");
  return (
    String(keyContractNo || "")
      .trim()
      .toLowerCase() === target
  );
}

function receiptMatchesContract(receipt, contractNo) {
  if (!contractNo) return true;
  return (receipt?.lines || []).some((line) => receiptLineMatchesContract(line, contractNo));
}

function formatDateDisplay(value) {
  if (!value) return "-";
  return formatDateDDMMMYYYY(value) || "-";
}

function formatLegacyDateDisplay(value) {
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
  const [readOnlyForm, setReadOnlyForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsRecord, setAttachmentsRecord] = useState(null);
  const [ahqTab, setAhqTab] = useState(RECEIPT_AHQ_TAB.PENDING);
  const [receiptFinalizedDraft, setReceiptFinalizedDraft] = useState({});
  const [savingReceiptAhq, setSavingReceiptAhq] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewRecord, setPdfPreviewRecord] = useState(null);
  const routeFilters = useMemo(() => readReceiptRouteFilters(), []);
  const routeContractNoFilter = useReceiptApi ? routeFilters.contractNo : "";

  const showAhqTabs = useReceiptApi;
  const showMonthField = Boolean(labels.gridMonth);
  const canManageReceiptAhq = useReceiptApi && isSuperuserOrAhqSupervisorUser();

  const pendingRecords = useMemo(
    () => records.filter((record) => !isReceiptFinalizedByAhq(record)),
    [records]
  );
  const finalizedRecords = useMemo(
    () => records.filter((record) => isReceiptFinalizedByAhq(record)),
    [records]
  );
  const routeFilteredPendingRecords = useMemo(
    () =>
      routeContractNoFilter
        ? pendingRecords.filter((record) => receiptMatchesContract(record, routeContractNoFilter))
        : pendingRecords,
    [pendingRecords, routeContractNoFilter]
  );
  const routeFilteredFinalizedRecords = useMemo(
    () =>
      routeContractNoFilter
        ? finalizedRecords.filter((record) => receiptMatchesContract(record, routeContractNoFilter))
        : finalizedRecords,
    [finalizedRecords, routeContractNoFilter]
  );
  const visibleRecords = useMemo(() => {
    if (!showAhqTabs) return records;
    return ahqTab === RECEIPT_AHQ_TAB.FINALIZED
      ? routeFilteredFinalizedRecords
      : routeFilteredPendingRecords;
  }, [ahqTab, records, routeFilteredFinalizedRecords, routeFilteredPendingRecords, showAhqTabs]);
  const unavailableInvoiceKeys = useMemo(() => {
    if (!useReceiptApi) return [];
    const currentId = currentRecord?.id;
    const keys = new Set();
    records
      .filter((record) => Number(record.id) !== Number(currentId))
      .forEach((record) => {
        getReceiptInvoiceKeys(record).forEach((key) => keys.add(key));
      });
    return Array.from(keys);
  }, [currentRecord?.id, records, useReceiptApi]);
  const recordPendingDelete = useMemo(
    () => records.find((row) => Number(row.id) === Number(recordToDelete)) || null,
    [recordToDelete, records]
  );
  const receiptAhqChangedRecords = useMemo(
    () =>
      records.filter((record) => {
        const id = String(record?.id ?? "");
        if (!id || !(id in receiptFinalizedDraft)) return false;
        return Boolean(receiptFinalizedDraft[id]) !== isReceiptFinalizedByAhq(record);
      }),
    [receiptFinalizedDraft, records]
  );

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

  useEffect(() => {
    if (!useReceiptApi) return;
    if (routeFilters.tab === RECEIPT_AHQ_TAB.FINALIZED || routeContractNoFilter) {
      setAhqTab(RECEIPT_AHQ_TAB.FINALIZED);
    }
  }, [routeContractNoFilter, routeFilters.tab, useReceiptApi]);

  const txt = (v) => renderCollectionsGridText(v);
  const canDeleteReceiptRecord = (record) =>
    canDeleteCurrentMenu() &&
    (!useReceiptApi || !isReceiptFinalizedByAhq(record) || isSuperuserOrAhqSupervisorUser());

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setReadOnlyForm(false);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
    setReadOnlyForm(false);
  };

  const handleEditRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    setCurrentRecord(record);
    setReadOnlyForm(false);
    setOpenForm(true);
  };

  const handleViewRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    setCurrentRecord(record);
    setReadOnlyForm(true);
    setOpenForm(true);
  };

  const handleOpenReceiptPdfPreview = (record) => {
    if (!record) return;
    setPdfPreviewRecord(record);
    setPdfPreviewOpen(true);
  };

  const handleCloseReceiptPdfPreview = () => {
    setPdfPreviewOpen(false);
    setPdfPreviewRecord(null);
  };

  const generateReceiptPdfBlob = useCallback(
    (record, marginsIn) => generateReceiptPdf(record, marginsIn, { openNewTab: false }),
    []
  );

  const handleDeleteRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!canDeleteReceiptRecord(record)) return;
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    if (!canDeleteReceiptRecord(recordPendingDelete)) {
      window.alert("Only superuser or AHQ supervisor users can delete finalized receipts.");
      return;
    }
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

  const getReceiptFinalizedDraftValue = (record) => {
    const id = String(record?.id ?? "");
    if (id && id in receiptFinalizedDraft) return Boolean(receiptFinalizedDraft[id]);
    return isReceiptFinalizedByAhq(record);
  };

  const handleReceiptFinalizedDraftChange = (record, checked) => {
    if (!record?.id || !canManageReceiptAhq) return;
    const id = String(record.id);
    const originalValue = isReceiptFinalizedByAhq(record);
    setReceiptFinalizedDraft((prev) => {
      const next = { ...prev };
      if (checked === originalValue) {
        delete next[id];
      } else {
        next[id] = checked;
      }
      return next;
    });
  };

  const handleSaveReceiptAhqChanges = async () => {
    if (!canManageReceiptAhq || !receiptAhqChangedRecords.length) return;
    setSavingReceiptAhq(true);
    try {
      const updates = await Promise.all(
        receiptAhqChangedRecords.map(async (record) => {
          const finalizedByAhq = Boolean(receiptFinalizedDraft[String(record.id)]);
          const payload = receiptsApi.buildReceiptFinalizePayload(record, finalizedByAhq);
          await receiptsApi.updateReceipt(record.id, payload);
          return receiptsApi.normalizeReceiptRow({
            ...payload,
            Id: record.id,
          });
        })
      );
      const byId = new Map(updates.map((row) => [Number(row.id), row]));
      setRecords((prev) => prev.map((row) => byId.get(Number(row.id)) || row));
      setReceiptFinalizedDraft({});
    } catch (error) {
      console.error("Failed to save receipt AHQ finalization:", error);
      window.alert("Failed to save receipt AHQ finalization.");
    } finally {
      setSavingReceiptAhq(false);
    }
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
      ...(useReceiptApi
        ? [
            {
              id: "pdfView",
              Header: "View",
              accessor: "pdfView",
              align: "center",
              width: "32px",
              Cell: ({ row }) => row?.original?.pdfView,
            },
          ]
        : []),
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        width: "68px",
        Cell: ({ row }) => row?.original?.actions,
      },
      ...(!useReceiptApi
        ? [
            {
              id: "sno",
              Header: "S.No",
              accessor: "sno",
              align: "center",
              width: "36px",
              Cell: ({ value }) => renderCollectionsGridSno(value),
            },
          ]
        : []),
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
        Cell: ({ value }) => renderCollectionsGridAmount(formatAmount(value)),
      },
      {
        id: "total",
        Header: "Total",
        accessor: "total",
        align: "right",
        Cell: ({ value }) => renderCollectionsGridAmount(formatAmount(value)),
      },
      {
        id: "date",
        Header: "Date",
        accessor: "date",
        align: "left",
        Cell: ({ value }) =>
          renderCollectionsGridText(
            useReceiptApi ? formatDateDisplay(value) : formatLegacyDateDisplay(value)
          ),
      },
      {
        id: "reference",
        Header: "Reference",
        accessor: "reference",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      ...(useReceiptApi
        ? [
            {
              id: "payee",
              Header: labels.gridPayee,
              accessor: "payee",
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
          ]
        : [
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
          ]),
      {
        id: "attachments",
        Header: "Attach",
        accessor: "attachments",
        align: "center",
        width: "32px",
        Cell: ({ row }) => row?.original?.attachments,
      },
      ...(useReceiptApi
        ? [
            {
              id: "finalizedByAhq",
              Header: "Fin.",
              accessor: "finalizedByAhq",
              align: "center",
              width: "36px",
              Cell: ({ row }) => row?.original?.finalizedByAhqControl,
            },
          ]
        : []),
    ],
    [labels.gridPaidFrom, labels.gridPayee, useReceiptApi]
  );

  const computedRows = useMemo(
    () =>
      visibleRecords.map((record, index) => {
        const flat = flattenReceiptForGrid(record, index);
        const hasAttachments = flat.attachmentCount > 0;
        const canDeleteRecord = canDeleteReceiptRecord(record);
        return {
          ...flat,
          finalizedByAhqControl: useReceiptApi ? (
            <Checkbox
              size="small"
              checked={getReceiptFinalizedDraftValue(record)}
              onChange={(event) => handleReceiptFinalizedDraftChange(record, event.target.checked)}
              disabled={!canManageReceiptAhq || savingReceiptAhq}
              title={
                canManageReceiptAhq
                  ? "Select and save to update AHQ finalization"
                  : "Only superuser or AHQ supervisor can update finalization"
              }
              sx={{ p: 0, m: 0, "& .MuiSvgIcon-root": { fontSize: "0.95rem" } }}
            />
          ) : null,
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              <IconButton
                size="small"
                color="secondary"
                onClick={() => handleViewRecord(record.id)}
                title="View"
                sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
              >
                <Icon fontSize="small">visibility</Icon>
              </IconButton>
              {canEditCurrentMenu() && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(record.id)}
                  title="Edit"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">edit</Icon>
                </IconButton>
              )}
              {canDeleteRecord && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(record.id)}
                  title="Delete"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">delete</Icon>
                </IconButton>
              )}
            </MDBox>
          ),
          pdfView: useReceiptApi ? (
            <Tooltip title="View as PDF">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleOpenReceiptPdfPreview(record)}
                  title="View as PDF"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">picture_as_pdf</Icon>
                </IconButton>
              </span>
            </Tooltip>
          ) : null,
          attachments: (
            <IconButton
              size="small"
              color={hasAttachments ? "success" : "error"}
              onClick={() => handleOpenAttachments(record)}
              title="View Attachments"
              sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
            >
              <Icon fontSize="small">visibility</Icon>
            </IconButton>
          ),
        };
      }),
    [canManageReceiptAhq, receiptFinalizedDraft, savingReceiptAhq, useReceiptApi, visibleRecords]
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

  const gridBodySx = useMemo(
    () =>
      buildCollectionsGridTableBodySx({
        leadingCompactColumnCount: 2,
        trailingCompactColumnCount: useReceiptApi ? 2 : 1,
        zeroGapBetweenFirstTwoLeadingColumns: useReceiptApi,
      }),
    [useReceiptApi]
  );

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
                    routeFilteredPendingRecords.length
                  })`}
                />
                <Tab
                  value={RECEIPT_AHQ_TAB.FINALIZED}
                  label={`${labels.tabFinalizedAhq || "Finalized by AHQ"} (${
                    routeFilteredFinalizedRecords.length
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
          <MDBox display="flex" gap={1} alignItems="center">
            {useReceiptApi && canManageReceiptAhq ? (
              <MDButton
                variant="gradient"
                color="info"
                onClick={handleSaveReceiptAhqChanges}
                disabled={!receiptAhqChangedRecords.length || savingReceiptAhq}
              >
                <Icon>save</Icon>&nbsp;
                {savingReceiptAhq
                  ? "Saving..."
                  : `Save Finalized (${receiptAhqChangedRecords.length})`}
              </MDButton>
            ) : null}
            {canCreateCurrentMenu() ? (
              <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
                <Icon>add</Icon>&nbsp;Add New
              </MDButton>
            ) : null}
          </MDBox>
        }
        bodySx={gridBodySx}
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
        receiptLayout={useReceiptApi}
        readOnly={readOnlyForm}
        unavailableInvoiceKeys={unavailableInvoiceKeys}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>{labels.deleteConfirm}</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton
            onClick={handleConfirmDelete}
            color="error"
            disabled={!canDeleteReceiptRecord(recordPendingDelete)}
          >
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <AgreementProvPdfPreviewDialog
        open={pdfPreviewOpen}
        onClose={handleCloseReceiptPdfPreview}
        data={pdfPreviewRecord}
        generatePdfBlob={generateReceiptPdfBlob}
        title="PDF Preview"
        previewTitle="Receipt PDF"
      />

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
