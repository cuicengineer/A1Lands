import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { ServerGridPagination } from "components/CompactGridPagination";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import interAccTransferApi from "services/api.interAccTransfer.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  isSuperuserOrAhqSupervisorUser,
} from "services/api.service";
import lockDateApi from "services/api.lockdate.service";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridSno,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";
import CashFundFlowModuleTabs from "layouts/cash-fund-flow/components/CashFundFlowModuleTabs";
import AgreementProvPdfPreviewDialog from "components/AgreementProvPdfPreviewDialog";
import {
  loadReceiptPdfMargins,
  RECEIPT_PDF_DEFAULT_MARGINS,
  saveReceiptPdfMargins,
} from "utils/agreementProvPdfMargins";
import InterAccTransferForm from "./InterAccTransferForm";
import { generateInterAccTransferPdf } from "./interAccTransferPdf";
import {
  buildInterAccTransferPayload,
  flattenInterAccTransferForGrid,
  formatInterAccTransferDisplayDate,
  isTransferLocked,
  normalizeInterAccTransferRecord,
} from "./interAccTransferUtils";
import {
  formatTransactionLockDateValidationMessage,
  isDateLockedByLockDate,
  pickActiveLockDateYyyyMmDd,
  unwrapLockDateConfigList,
} from "layouts/income-agreements/collections/collectionsUtils";

function formatPlainAmount(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "-";
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function LockStatusCell({ locked, canManage, busy, onLock, onUnlock }) {
  return (
    <MDBox
      display="flex"
      justifyContent="center"
      alignItems="center"
      gap={0.25}
      onDoubleClick={(e) => {
        if (canManage && !busy) {
          e.preventDefault();
          e.stopPropagation();
          void (locked ? onUnlock() : onLock());
        }
      }}
    >
      <Tooltip
        title={
          locked
            ? canManage
              ? "Locked — double-click this cell to unlock"
              : "Locked — only superuser or AHQ supervisor can unlock"
            : canManage
            ? "Double-click this cell to lock"
            : "Only superuser or AHQ supervisor can lock"
        }
      >
        <span>
          <IconButton
            size="small"
            disabled={busy || locked || !canManage}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!canManage || locked) return;
              void onLock();
            }}
            sx={{
              p: 0.25,
              color: locked ? "#856404" : "info.main",
              bgcolor: locked ? "#fff3cd" : "rgba(25,118,210,0.08)",
              border: "1px solid",
              borderColor: locked ? "#ffe69c" : "rgba(25,118,210,0.24)",
              "&:hover": {
                bgcolor: locked ? "#fff3cd" : "rgba(25,118,210,0.16)",
              },
              "&.Mui-disabled": {
                color: locked ? "#856404" : "rgba(0,0,0,0.26)",
                borderColor: locked ? "#ffe69c" : "rgba(0,0,0,0.12)",
              },
            }}
          >
            <Icon fontSize="small">{locked ? "lock" : "lock_open"}</Icon>
          </IconButton>
        </span>
      </Tooltip>
    </MDBox>
  );
}

LockStatusCell.propTypes = {
  locked: PropTypes.bool.isRequired,
  canManage: PropTypes.bool.isRequired,
  busy: PropTypes.bool.isRequired,
  onLock: PropTypes.func.isRequired,
  onUnlock: PropTypes.func.isRequired,
};

export default function InterAccTransfer() {
  const [tableRows, setTableRows] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [formReadOnly, setFormReadOnly] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [paginationHost, setPaginationHost] = useState(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewRecord, setPdfPreviewRecord] = useState(null);
  const [activeLockDate, setActiveLockDate] = useState("");
  const [lockSavingId, setLockSavingId] = useState(null);

  const txt = (v) => renderCollectionsGridText(v);
  const canManageTransferLock = isSuperuserOrAhqSupervisorUser();

  const isTransferDateLocked = useCallback(
    (record) =>
      isDateLockedByLockDate(record?.transferDate ?? record?.TransferDate, activeLockDate),
    [activeLockDate]
  );

  const fetchRecords = useCallback(
    async (page = pageNumber, size = pageSize) => {
      setLoading(true);
      try {
        const response = await interAccTransferApi.getAll(page, size);
        const data = Array.isArray(response) ? response : response?.data ?? [];
        const pagination = response?.pagination;
        setTableRows(Array.isArray(data) ? data : []);
        setTotalCount(Number(pagination?.totalCount ?? (Array.isArray(data) ? data.length : 0)));
      } catch (error) {
        console.error("Error fetching inter account transfers:", error);
        setTableRows([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [pageNumber, pageSize]
  );

  useEffect(() => {
    let cancelled = false;
    lockDateApi
      .getAll()
      .then((response) => {
        if (!cancelled) {
          setActiveLockDate(pickActiveLockDateYyyyMmDd(unwrapLockDateConfigList(response)));
        }
      })
      .catch((error) => {
        console.error("Error fetching inter account transfer lock date:", error);
        if (!cancelled) setActiveLockDate("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    fetchRecords(pageNumber, pageSize);
  }, [pageNumber, pageSize, fetchRecords]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setFormReadOnly(false);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
    setFormReadOnly(false);
  };

  const handleEditRecord = (id) => {
    const record = tableRows.find((row) => Number(row.id ?? row.Id) === Number(id));
    if (!record) return;
    if (isTransferLocked(record) || isTransferDateLocked(record)) {
      setCurrentRecord({ ...normalizeInterAccTransferRecord(record), id: record.id ?? record.Id });
      setFormReadOnly(true);
      setOpenForm(true);
      return;
    }
    setCurrentRecord({
      ...normalizeInterAccTransferRecord(record),
      id: record.id ?? record.Id,
    });
    setFormReadOnly(false);
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    const record = tableRows.find((row) => Number(row.id ?? row.Id) === Number(id));
    if (record && isTransferLocked(record)) {
      window.alert("Locked transfers cannot be deleted.");
      return;
    }
    if (record && isTransferDateLocked(record)) {
      window.alert(formatTransactionLockDateValidationMessage(activeLockDate));
      return;
    }
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    try {
      await interAccTransferApi.remove(recordToDelete);
      await fetchRecords(pageNumber, pageSize);
    } catch (error) {
      console.error("Error deleting transfer:", error);
      window.alert("Failed to delete transfer.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleSubmit = async (form) => {
    if (isDateLockedByLockDate(form?.transferDate, activeLockDate)) {
      window.alert(formatTransactionLockDateValidationMessage(activeLockDate));
      return;
    }
    const payload = buildInterAccTransferPayload(form);
    const existingId = currentRecord?.id ?? currentRecord?.Id;
    if (existingId) {
      await interAccTransferApi.update(existingId, payload);
    } else {
      await interAccTransferApi.create(payload);
    }
    await fetchRecords(pageNumber, pageSize);
    handleCloseForm();
  };

  const handleTransferLockChange = useCallback(
    async (record, nextLocked) => {
      if (!record) return;
      if (!canManageTransferLock) {
        window.alert("Only superuser or AHQ supervisor can lock or unlock transfers.");
        return;
      }
      if (isTransferDateLocked(record)) {
        window.alert(formatTransactionLockDateValidationMessage(activeLockDate));
        return;
      }
      const recordId = Number(record?.id ?? record?.Id);
      if (!recordId) return;
      setLockSavingId(recordId);
      try {
        const payload = buildInterAccTransferPayload({
          ...normalizeInterAccTransferRecord(record),
          status: nextLocked ? "Lock" : "Unlock",
        });
        await interAccTransferApi.update(recordId, payload);
        await fetchRecords(pageNumber, pageSize);
      } catch (error) {
        console.error("Error updating transfer lock status:", error);
        window.alert(error?.message || "Failed to update transfer lock status.");
      } finally {
        setLockSavingId(null);
      }
    },
    [
      activeLockDate,
      canManageTransferLock,
      fetchRecords,
      isTransferDateLocked,
      pageNumber,
      pageSize,
    ]
  );

  const handleOpenTransferPdfPreview = (record) => {
    if (!record) return;
    setPdfPreviewRecord(record);
    setPdfPreviewOpen(true);
  };

  const handleCloseTransferPdfPreview = () => {
    setPdfPreviewOpen(false);
    setPdfPreviewRecord(null);
  };

  const generateTransferPdfBlob = useCallback(
    (record, marginsIn) => generateInterAccTransferPdf(record, marginsIn, { openNewTab: false }),
    []
  );

  const columns = useMemo(
    () => [
      {
        id: "pdfView",
        Header: "View",
        accessor: "pdfView",
        align: "center",
        width: "32px",
        Cell: ({ row }) => row?.original?.pdfView,
      },
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        width: "68px",
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "sno",
        Header: "S.No",
        accessor: "sno",
        align: "center",
        Cell: ({ value }) => renderCollectionsGridSno(value),
      },
      {
        id: "transferDate",
        Header: "Date",
        accessor: "transferDate",
        align: "left",
        Cell: ({ value }) => txt(formatInterAccTransferDisplayDate(value)),
      },
      {
        id: "vrNo",
        Header: "Vr No",
        accessor: "vrNo",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "description",
        Header: "Description",
        accessor: "description",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "particulars",
        Header: "Particulars",
        accessor: "particulars",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "paidFromAccount",
        Header: "Paid From",
        accessor: "paidFromAccount",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "settlementVrNo",
        Header: "Settlement Vr#",
        accessor: "settlementVrNo",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "paidFromAmountDisplay",
        Header: "Value in Amount",
        accessor: "paidFromAmountDisplay",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "receivedInAccount",
        Header: "Received in",
        accessor: "receivedInAccount",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "tinFtn",
        Header: "TIN-FTN",
        accessor: "tinFtn",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "status",
        Header: "Status",
        accessor: "status",
        align: "left",
        Cell: ({ row }) => row?.original?.statusControl,
      },
    ],
    []
  );

  const computedRows = useMemo(
    () =>
      tableRows.map((row, index) => {
        const flat = flattenInterAccTransferForGrid(row, (pageNumber - 1) * pageSize + index);
        const recordId = flat.id;
        const locked = isTransferLocked(row);
        const dateLocked = isTransferDateLocked(row);
        return {
          ...flat,
          __rowStyle: locked
            ? {
                backgroundColor: "rgba(0, 0, 0, 0.035)",
              }
            : undefined,
          transferDate: flat.transferDate,
          paidFromAmountDisplay: formatPlainAmount(flat.paidFromAmount),
          statusControl: (
            <LockStatusCell
              locked={locked}
              canManage={canManageTransferLock}
              busy={Number(lockSavingId) === Number(recordId)}
              onLock={() => handleTransferLockChange(row, true)}
              onUnlock={() => handleTransferLockChange(row, false)}
            />
          ),
          pdfView: (
            <Tooltip title="View as PDF">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleOpenTransferPdfPreview(row)}
                  title="View as PDF"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">picture_as_pdf</Icon>
                </IconButton>
              </span>
            </Tooltip>
          ),
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              {canEditCurrentMenu() && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(recordId)}
                  title={locked || dateLocked ? "View (Locked)" : "Edit"}
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">{locked || dateLocked ? "visibility" : "edit"}</Icon>
                </IconButton>
              )}
              {canDeleteCurrentMenu() && !locked && !dateLocked && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(recordId)}
                  title="Delete"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">delete</Icon>
                </IconButton>
              )}
            </MDBox>
          ),
        };
      }),
    [
      tableRows,
      pageNumber,
      pageSize,
      canManageTransferLock,
      handleTransferLockChange,
      isTransferDateLocked,
      lockSavingId,
    ]
  );

  const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: displayTotal,
        page: pageNumber,
        pageSize,
      }),
    [displayTotal, pageNumber, pageSize]
  );

  const serverPaginationFooter = useMemo(
    () => (
      <ServerGridPagination
        page={pageNumber}
        totalCount={displayTotal}
        pageSize={pageSize}
        onPageChange={setPageNumber}
      />
    ),
    [displayTotal, pageNumber, pageSize]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Transfer Entry"
        subtitle="Manage inter-account cash and bank transfers"
        metadata={workspaceMetadata}
        tabs={<CashFundFlowModuleTabs />}
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={buildCollectionsGridTableBodySx({
          leadingCompactColumnCount: 2,
          zeroGapBetweenFirstTwoLeadingColumns: true,
        })}
      >
        <MDBox
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          <MDBox
            ref={setPaginationHost}
            className="saas-settings-table-pagination-top"
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexShrink: 0,
              width: "100%",
            }}
          />

          <DataTable
            table={{ columns, rows: computedRows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={{
              defaultValue: 50,
              entries: [10, 25, 50, 100, 500],
            }}
            page={pageNumber - 1}
            pageSize={pageSize}
            onPageChange={(newPage) => setPageNumber(newPage + 1)}
            onEntriesPerPageChange={(value) => {
              setPageSize(value);
              setPageNumber(1);
            }}
            showTotalEntries={false}
            noEndBorder
            canSearch
            exportFileName="Inter-Acc-Transfer"
            contentFitTable
            disableHeaderMetrics
            paginationFooter={serverPaginationFooter}
            paginationHost={paginationHost}
          />
          <WorkspaceLoadingOverlay active={loading} />
        </MDBox>
      </EnterpriseWorkspace>

      <InterAccTransferForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        readOnly={formReadOnly}
        activeLockDate={activeLockDate}
      />

      <AgreementProvPdfPreviewDialog
        open={pdfPreviewOpen}
        onClose={handleCloseTransferPdfPreview}
        data={pdfPreviewRecord}
        generatePdfBlob={generateTransferPdfBlob}
        title="PDF Preview"
        previewTitle="Transfer Entry PDF"
        defaultMargins={RECEIPT_PDF_DEFAULT_MARGINS}
        loadMargins={loadReceiptPdfMargins}
        saveMargins={saveReceiptPdfMargins}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this transfer?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={() => setDeleteDialogOpen(false)}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
