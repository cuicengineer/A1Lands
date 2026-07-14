import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Checkbox from "@mui/material/Checkbox";
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
import CurrencyLoading from "components/CurrencyLoading";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import CashFundFlowModuleTabs from "layouts/cash-fund-flow/components/CashFundFlowModuleTabs";
import journalEntryApi from "services/api.journalEntry.service";
import lockDateApi from "services/api.lockdate.service";
import uploadApi from "services/api.upload.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  isSuperuserOrAhqSupervisorUser,
} from "services/api.service";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";
import {
  formatTransactionLockDateValidationMessage,
  isDateLockedByLockDate,
  pickActiveLockDateYyyyMmDd,
  unwrapLockDateConfigList,
} from "layouts/income-agreements/collections/collectionsUtils";
import JournalEntryForm from "./JournalEntryForm";
import AgreementProvPdfPreviewDialog from "components/AgreementProvPdfPreviewDialog";
import {
  loadReceiptPdfMargins,
  RECEIPT_PDF_DEFAULT_MARGINS,
  saveReceiptPdfMargins,
} from "utils/agreementProvPdfMargins";
import { generateJournalEntryPdf } from "./journalEntryPdf";
import {
  fetchJournalEntryAttachmentCount,
  fetchJournalEntryUploadedFiles,
} from "./journalEntryAttachmentUtils";
import {
  flattenJournalEntryForGrid,
  formatJournalEntryDisplayDate,
  isJournalEntryLocked,
} from "./journalEntryUtils";

function formatDateDisplay(value) {
  if (!value) return "-";
  return formatDateDDMMMYYYY(value) || formatJournalEntryDisplayDate(value) || "-";
}

function LockStatusCell({ locked, canManage, busy, onLock, onUnlock }) {
  return (
    <Tooltip
      title={
        locked
          ? canManage
            ? "Locked — double-click to unlock"
            : "Locked — only superuser or AHQ supervisor can unlock"
          : canManage
          ? "Click to lock"
          : "Only superuser or AHQ supervisor can lock"
      }
    >
      <span
        onDoubleClick={(e) => {
          if (canManage && !busy) {
            e.preventDefault();
            e.stopPropagation();
            void (locked ? onUnlock() : onLock());
          }
        }}
      >
        <IconButton
          size="small"
          disabled={busy || locked || !canManage}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (!canManage || locked) return;
            void onLock();
          }}
          title={locked ? "Locked" : "Unlocked"}
          sx={{
            ...COLLECTIONS_GRID_ICON_BUTTON_SX,
            color: locked ? "#856404" : "info.main",
            bgcolor: locked ? "#fff3cd" : "transparent",
            border: locked ? "1px solid #ffe69c" : "1px solid transparent",
            borderRadius: "4px",
            "&:hover": {
              bgcolor: locked ? "#fff3cd" : "rgba(25,118,210,0.08)",
            },
            "&.Mui-disabled": {
              color: locked ? "#856404" : "rgba(0,0,0,0.26)",
            },
          }}
        >
          <Icon fontSize="small">{locked ? "lock" : "lock_open"}</Icon>
        </IconButton>
      </span>
    </Tooltip>
  );
}

LockStatusCell.propTypes = {
  locked: PropTypes.bool.isRequired,
  canManage: PropTypes.bool.isRequired,
  busy: PropTypes.bool.isRequired,
  onLock: PropTypes.func.isRequired,
  onUnlock: PropTypes.func.isRequired,
};

export default function JournalEntryPage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [readOnlyForm, setReadOnlyForm] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewRecord, setPdfPreviewRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsRecord, setAttachmentsRecord] = useState(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);
  const [attachmentCountsById, setAttachmentCountsById] = useState({});
  const [activeLockDate, setActiveLockDate] = useState("");
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const [lockSaving, setLockSaving] = useState(false);
  const [lockSavingId, setLockSavingId] = useState(null);

  const txt = (v) => renderCollectionsGridText(v);
  const canManageLock = isSuperuserOrAhqSupervisorUser();

  const loadAttachmentCounts = useCallback(async (rows) => {
    if (!rows?.length) {
      setAttachmentCountsById({});
      return;
    }
    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const count = await fetchJournalEntryAttachmentCount(row.id);
        return [row.id, count];
      })
    );
    const next = {};
    results.forEach((result) => {
      if (result.status === "fulfilled") {
        const [id, count] = result.value;
        next[id] = count;
      }
    });
    setAttachmentCountsById(next);
  }, []);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await journalEntryApi.listJournalEntries();
      const rows = journalEntryApi
        .unwrapList(response)
        .map(journalEntryApi.normalizeJournalEntryRow);
      setRecords(rows);
      setSelectedIds(new Set());
      await loadAttachmentCounts(rows);
    } catch (error) {
      console.error("Failed to load journal entries:", error);
      setRecords([]);
      setAttachmentCountsById({});
      setSelectedIds(new Set());
    } finally {
      setLoading(false);
    }
  }, [loadAttachmentCounts]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  useEffect(() => {
    let cancelled = false;
    const loadLockDate = async () => {
      try {
        const response = await lockDateApi.getAll();
        const active = pickActiveLockDateYyyyMmDd(unwrapLockDateConfigList(response));
        if (!cancelled) setActiveLockDate(active);
      } catch (error) {
        console.error("Failed to load lock date:", error);
        if (!cancelled) setActiveLockDate("");
      }
    };
    loadLockDate();
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshAttachmentCount = useCallback(async (id) => {
    const count = await fetchJournalEntryAttachmentCount(id);
    setAttachmentCountsById((prev) => ({ ...prev, [id]: count }));
  }, []);

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
    if (isJournalEntryLocked(record)) {
      setCurrentRecord(record);
      setReadOnlyForm(true);
      setOpenForm(true);
      return;
    }
    setCurrentRecord(record);
    setReadOnlyForm(false);
    setOpenForm(true);
  };

  const handleViewRecord = async (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    setCurrentRecord(record);
    setReadOnlyForm(true);
    setOpenForm(true);
    try {
      const full = await journalEntryApi.getJournalEntry(id);
      const normalized = journalEntryApi.normalizeJournalEntryRow(full?.data ?? full);
      if (normalized?.id != null) {
        setCurrentRecord(normalized);
      }
    } catch (error) {
      console.error("Failed to load journal entry for view:", error);
    }
  };

  const handleOpenJournalEntryPdfPreview = (record) => {
    if (!record) return;
    setPdfPreviewRecord(record);
    setPdfPreviewOpen(true);
  };

  const handleCloseJournalEntryPdfPreview = () => {
    setPdfPreviewOpen(false);
    setPdfPreviewRecord(null);
  };

  const generateJournalEntryPdfBlob = useCallback(
    (record, marginsIn) => generateJournalEntryPdf(record, marginsIn, { openNewTab: false }),
    []
  );

  const handleDeleteRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    if (isJournalEntryLocked(record)) {
      window.alert("Locked journal entries cannot be deleted.");
      return;
    }
    setRecordToDelete(record);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!recordToDelete?.id) return;
    try {
      await journalEntryApi.deleteJournalEntry(recordToDelete.id);
      setRecords((prev) => prev.filter((row) => Number(row.id) !== Number(recordToDelete.id)));
      setAttachmentCountsById((prev) => {
        const next = { ...prev };
        delete next[recordToDelete.id];
        return next;
      });
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(Number(recordToDelete.id));
        return next;
      });
    } catch (error) {
      console.error("Failed to delete journal entry:", error);
      window.alert(error?.message || "Failed to delete journal entry.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleOpenAttachments = async (record) => {
    setAttachmentsRecord(record);
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    try {
      const files = await fetchJournalEntryUploadedFiles(record.id);
      setAttachmentsFiles(files);
    } catch (error) {
      console.error("Failed to load attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleFormSubmit = async (payload) => {
    const existingId = currentRecord?.id;
    if (existingId && isJournalEntryLocked(currentRecord)) {
      window.alert("Locked journal entries cannot be edited.");
      throw new Error("Entry locked");
    }
    if (payload?.date && isDateLockedByLockDate(payload.date, activeLockDate)) {
      window.alert(formatTransactionLockDateValidationMessage(activeLockDate));
      throw new Error("Date locked");
    }

    try {
      if (existingId) {
        await journalEntryApi.updateJournalEntry(existingId, payload);
        const normalized = journalEntryApi.normalizeJournalEntryRow({
          ...journalEntryApi.buildJournalEntryApiPayload(payload),
          Id: existingId,
          id: existingId,
          IsLock: currentRecord?.isLock,
        });
        setRecords((prev) =>
          prev.map((row) => (Number(row.id) === Number(existingId) ? normalized : row))
        );
        await refreshAttachmentCount(existingId);
        handleCloseForm();
        return { id: existingId };
      }

      const created = await journalEntryApi.createJournalEntry(payload);
      const createdId = created?.id ?? created?.Id;
      const normalized = journalEntryApi.normalizeJournalEntryRow({
        ...journalEntryApi.buildJournalEntryApiPayload(payload),
        ...(created || {}),
        Id: createdId,
        id: createdId,
        IsLock: false,
      });
      setRecords((prev) => [normalized, ...prev]);
      if (createdId) await refreshAttachmentCount(createdId);
      handleCloseForm();
      return { id: createdId };
    } catch (error) {
      console.error("Failed to save journal entry:", error);
      window.alert(error?.message || "Failed to save journal entry.");
      throw error;
    }
  };

  const applyLockStatusLocally = useCallback((ids, nextLock) => {
    const idSet = new Set((ids || []).map(Number));
    setRecords((prev) =>
      prev.map((row) => (idSet.has(Number(row.id)) ? { ...row, isLock: nextLock } : row))
    );
  }, []);

  const handleLockStatusChange = useCallback(
    async (ids, nextLock) => {
      if (!canManageLock) {
        window.alert("Only superuser or AHQ supervisor can change journal entry lock status.");
        return;
      }
      const uniqueIds = Array.from(new Set((ids || []).map(Number).filter((id) => id > 0)));
      if (!uniqueIds.length) return;

      setLockSaving(true);
      if (uniqueIds.length === 1) setLockSavingId(uniqueIds[0]);
      try {
        await journalEntryApi.updateJournalEntryLockStatus(uniqueIds, nextLock);
        applyLockStatusLocally(uniqueIds, nextLock);
        setSelectedIds(new Set());
      } catch (error) {
        console.error("Failed to update journal entry lock status:", error);
        window.alert(error?.message || "Failed to update lock status.");
      } finally {
        setLockSaving(false);
        setLockSavingId(null);
      }
    },
    [applyLockStatusLocally, canManageLock]
  );

  const toggleRowSelection = useCallback((id) => {
    const numericId = Number(id);
    if (!Number.isFinite(numericId)) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(numericId)) next.delete(numericId);
      else next.add(numericId);
      return next;
    });
  }, []);

  const allVisibleIds = useMemo(
    () => records.map((row) => Number(row.id)).filter((id) => Number.isFinite(id) && id > 0),
    [records]
  );

  const allSelected =
    canManageLock && allVisibleIds.length > 0 && allVisibleIds.every((id) => selectedIds.has(id));
  const someSelected = canManageLock && selectedIds.size > 0 && !allSelected;

  const toggleSelectAll = useCallback(() => {
    if (!canManageLock) return;
    setSelectedIds((prev) => {
      if (allVisibleIds.length > 0 && allVisibleIds.every((id) => prev.has(id))) {
        return new Set();
      }
      return new Set(allVisibleIds);
    });
  }, [allVisibleIds, canManageLock]);

  const columns = useMemo(() => {
    const cols = [];
    if (canManageLock) {
      cols.push({
        id: "select",
        Header: (
          <Checkbox
            size="small"
            checked={allSelected}
            indeterminate={someSelected}
            onChange={toggleSelectAll}
            inputProps={{ "aria-label": "Select all journal entries" }}
          />
        ),
        accessor: "select",
        align: "center",
        width: "36px",
        disableSortBy: true,
        Cell: ({ row }) => row?.original?.selectControl,
      });
    }
    cols.push(
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        width: "1%",
        disableSortBy: true,
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "date",
        Header: "Date",
        accessor: "date",
        align: "left",
        Cell: ({ value }) => txt(formatDateDisplay(value)),
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
        id: "totalDebitDisplay",
        Header: "Total Debit",
        accessor: "totalDebitDisplay",
        align: "center",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "totalCreditDisplay",
        Header: "Total Credit",
        accessor: "totalCreditDisplay",
        align: "center",
        Cell: ({ value }) => txt(value),
      }
    );
    return cols;
  }, [allSelected, canManageLock, someSelected, toggleSelectAll]);

  const computedRows = useMemo(
    () =>
      records.map((record, index) => {
        const flat = flattenJournalEntryForGrid(record, index);
        const locked = isJournalEntryLocked(record);
        const dateLocked =
          Boolean(record.date) && isDateLockedByLockDate(record.date, activeLockDate);
        const attachmentCount = attachmentCountsById[record.id] || 0;
        const recordId = Number(record.id);
        return {
          ...flat,
          __rowStyle: locked
            ? {
                backgroundColor: "rgba(0, 0, 0, 0.035)",
              }
            : undefined,
          selectControl: canManageLock ? (
            <Checkbox
              size="small"
              checked={selectedIds.has(recordId)}
              onChange={() => toggleRowSelection(recordId)}
              inputProps={{ "aria-label": `Select journal entry ${record.vrNo || recordId}` }}
            />
          ) : null,
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              <Tooltip title="View as PDF">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleOpenJournalEntryPdfPreview(record)}
                    title="View as PDF"
                    sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                  >
                    <Icon fontSize="small">picture_as_pdf</Icon>
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton
                size="small"
                color="secondary"
                onClick={() => handleViewRecord(record.id)}
                title="View"
                sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
              >
                <Icon fontSize="small">visibility</Icon>
              </IconButton>
              {canEditCurrentMenu() && !dateLocked && !locked ? (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(record.id)}
                  title="Edit"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">edit</Icon>
                </IconButton>
              ) : null}
              {canDeleteCurrentMenu() && !dateLocked && !locked ? (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(record.id)}
                  title="Delete"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">delete</Icon>
                </IconButton>
              ) : null}
              <Tooltip title={attachmentCount ? `${attachmentCount} file(s)` : "No attachments"}>
                <span>
                  <IconButton
                    size="small"
                    color={attachmentCount ? "info" : "inherit"}
                    onClick={() => handleOpenAttachments(record)}
                    title="Files"
                    sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                  >
                    <Icon fontSize="small">attach_file</Icon>
                  </IconButton>
                </span>
              </Tooltip>
              <LockStatusCell
                locked={locked}
                canManage={canManageLock}
                busy={lockSaving && (lockSavingId == null || Number(lockSavingId) === recordId)}
                onLock={() => handleLockStatusChange([recordId], true)}
                onUnlock={() => handleLockStatusChange([recordId], false)}
              />
            </MDBox>
          ),
        };
      }),
    [
      records,
      attachmentCountsById,
      activeLockDate,
      canManageLock,
      selectedIds,
      lockSaving,
      lockSavingId,
      handleLockStatusChange,
      toggleRowSelection,
    ]
  );

  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: records.length }),
    [records.length]
  );

  const gridBodySx = useMemo(() => {
    const base = buildCollectionsGridTableBodySx({
      leadingCompactColumnCount: canManageLock ? 2 : 1,
      zeroGapBetweenFirstTwoLeadingColumns: canManageLock,
    });
    return {
      ...base,
      "& .MuiTable-root th": {
        ...(base["& .MuiTable-root th"] || {}),
        padding: "2px 4px !important",
        lineHeight: "1.1 !important",
      },
      "& .MuiTable-root td": {
        ...(base["& .MuiTable-root td"] || {}),
        padding: "1px 4px !important",
        lineHeight: "1.1 !important",
      },
      "& .MuiTable-root tbody tr": {
        height: "28px",
      },
      "& .MuiTable-root tbody td .MuiIconButton-root": {
        padding: "0px !important",
      },
    };
  }, [canManageLock]);

  const workspaceActions = (
    <MDBox display="flex" gap={1} flexWrap="wrap" justifyContent="flex-end">
      {canManageLock && selectedIds.size > 0 ? (
        <>
          <MDButton
            variant="outlined"
            color="warning"
            disabled={lockSaving}
            onClick={() => handleLockStatusChange(Array.from(selectedIds), true)}
          >
            <Icon>lock</Icon>&nbsp;Lock ({selectedIds.size})
          </MDButton>
          <MDButton
            variant="outlined"
            color="info"
            disabled={lockSaving}
            onClick={() => handleLockStatusChange(Array.from(selectedIds), false)}
          >
            <Icon>lock_open</Icon>&nbsp;Unlock ({selectedIds.size})
          </MDButton>
        </>
      ) : null}
      {canCreateCurrentMenu() ? (
        <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
          <Icon>add</Icon>&nbsp;Add New
        </MDButton>
      ) : null}
    </MDBox>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Journal Entry"
        subtitle="Record balanced journal vouchers with line-level account detail"
        metadata={workspaceMetadata}
        tabs={<CashFundFlowModuleTabs />}
        actions={workspaceActions}
        bodySx={gridBodySx}
      >
        {loading ? (
          <CurrencyLoading />
        ) : (
          <MDBox
            sx={{
              display: "flex",
              flexDirection: "column",
              flex: 1,
              minHeight: 0,
              position: "relative",
            }}
          >
            <DataTable
              table={{ columns, rows: computedRows }}
              isSorted={false}
              stickyToolbarAndHeader
              entriesPerPage={{
                defaultValue: 50,
                entries: [10, 25, 50, 100, 500],
              }}
              showTotalEntries={false}
              noEndBorder
              canSearch
              exportFileName="Journal-Entry"
              contentFitTable
              disableHeaderMetrics
            />
          </MDBox>
        )}
      </EnterpriseWorkspace>

      <JournalEntryForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleFormSubmit}
        initialData={currentRecord}
        readOnly={readOnlyForm || isJournalEntryLocked(currentRecord)}
        activeLockDate={activeLockDate}
      />

      <AgreementProvPdfPreviewDialog
        open={pdfPreviewOpen}
        onClose={handleCloseJournalEntryPdfPreview}
        data={pdfPreviewRecord}
        generatePdfBlob={generateJournalEntryPdfBlob}
        title="PDF Preview"
        previewTitle="Journal Entry PDF"
        defaultMargins={RECEIPT_PDF_DEFAULT_MARGINS}
        loadMargins={loadReceiptPdfMargins}
        saveMargins={saveReceiptPdfMargins}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Journal Entry</DialogTitle>
        <DialogContent>
          <MDTypography variant="body2">
            Delete journal entry <strong>{recordToDelete?.vrNo}</strong>?
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton color="secondary" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </MDButton>
          <MDButton color="error" onClick={confirmDelete}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={attachmentsDialogOpen}
        onClose={() => setAttachmentsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Attachments — {attachmentsRecord?.vrNo}</DialogTitle>
        <DialogContent dividers>
          {attachmentsLoading ? (
            <CurrencyLoading />
          ) : attachmentsFiles.length ? (
            attachmentsFiles.map((file, index) => (
              <MDBox key={file.id || index} mb={1}>
                <MDButton
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={() => {
                    uploadApi
                      .downloadFile(file, file.fileName || `File-${index + 1}`)
                      .catch((e) => window.alert(`Download failed: ${e.message}`));
                  }}
                  sx={{ justifyContent: "flex-start", textTransform: "none" }}
                >
                  <Icon sx={{ mr: 1 }}>attach_file</Icon>
                  {file.fileName || `File ${index + 1}`}
                </MDButton>
              </MDBox>
            ))
          ) : (
            <MDTypography variant="body2">No attachments uploaded.</MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={() => setAttachmentsDialogOpen(false)}>Close</MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
