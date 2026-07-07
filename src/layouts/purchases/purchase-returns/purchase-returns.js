import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
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
import PurchasesModuleTabs from "layouts/purchases/components/PurchasesModuleTabs";
import { PURCHASE_RETURNS_LABELS } from "layouts/purchases/transactionLabels";
import {
  computePurchaseReturnGrandTotal,
  flattenPurchaseReturnForGrid,
  formatAmount,
} from "layouts/purchases/purchase-returns/purchaseReturnUtils";
import PurchaseReturnForm from "layouts/purchases/purchase-returns/PurchaseReturnForm";
import {
  fetchPurchaseReturnAttachmentCount,
  fetchPurchaseReturnUploadedFiles,
} from "layouts/purchases/purchase-returns/purchaseReturnAttachmentUtils";
import purchaseReturnsApi from "services/api.purchaseReturns.service";
import uploadApi from "services/api.upload.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import CurrencyLoading from "components/CurrencyLoading";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridAmount,
  renderCollectionsGridSno,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";

function formatDateDisplay(value) {
  if (!value) return "-";
  return formatDateDDMMMYYYY(value) || "-";
}

export default function PurchaseReturns() {
  const labels = PURCHASE_RETURNS_LABELS;
  const [records, setRecords] = useState([]);
  const [paginationHost, setPaginationHost] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [readOnlyForm, setReadOnlyForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsRecord, setAttachmentsRecord] = useState(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);
  const [attachmentCountsById, setAttachmentCountsById] = useState({});
  const [loading, setLoading] = useState(true);

  const loadAttachmentCounts = useCallback(async (rows) => {
    if (!rows?.length) {
      setAttachmentCountsById({});
      return;
    }
    const results = await Promise.allSettled(
      rows.map(async (row) => {
        const count = await fetchPurchaseReturnAttachmentCount(row.id);
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
      const response = await purchaseReturnsApi.listPurchaseReturns();
      const rows = purchaseReturnsApi
        .unwrapList(response)
        .map(purchaseReturnsApi.normalizePurchaseReturnRow);
      setRecords(rows);
      await loadAttachmentCounts(rows);
    } catch (error) {
      console.error("Failed to load purchase returns:", error);
      setRecords([]);
      setAttachmentCountsById({});
    } finally {
      setLoading(false);
    }
  }, [loadAttachmentCounts]);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const refreshAttachmentCount = useCallback(async (recordId) => {
    if (recordId == null) return;
    const count = await fetchPurchaseReturnAttachmentCount(recordId);
    setAttachmentCountsById((prev) => ({ ...prev, [recordId]: count }));
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

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    try {
      await purchaseReturnsApi.removePurchaseReturn(recordToDelete);
      setRecords((prev) => prev.filter((row) => Number(row.id) !== Number(recordToDelete)));
    } catch (error) {
      console.error("Failed to delete purchase return:", error);
      window.alert("Failed to delete purchase return.");
      return;
    }
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleOpenAttachments = async (record) => {
    if (!record?.id) return;
    setAttachmentsRecord(record);
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    try {
      const files = await fetchPurchaseReturnUploadedFiles(record.id);
      setAttachmentsFiles(files);
    } catch (error) {
      console.error("Failed to load purchase return attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleDeleteAttachment = async (file) => {
    if (!canDeleteCurrentMenu()) return;
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      window.alert("File ID is not available. Cannot delete this file.");
      return;
    }
    if (!window.confirm(`Delete "${file.fileName || file.name || "this file"}"?`)) return;
    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (attachmentsRecord?.id) {
        setAttachmentsLoading(true);
        const files = await fetchPurchaseReturnUploadedFiles(attachmentsRecord.id);
        setAttachmentsFiles(files);
        setAttachmentCountsById((prev) => ({
          ...prev,
          [attachmentsRecord.id]: files.length,
        }));
      }
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      window.alert(error?.message || "Failed to delete file.");
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsRecord(null);
    setAttachmentsFiles([]);
  };

  const handleSubmit = async (payload) => {
    const existingId = currentRecord?.id;
    const grandTotal = computePurchaseReturnGrandTotal(payload.lines);
    const apiPayload = purchaseReturnsApi.buildPurchaseReturnApiPayload(payload, grandTotal);

    if (existingId) {
      await purchaseReturnsApi.updatePurchaseReturn(existingId, apiPayload);
      const normalized = purchaseReturnsApi.normalizePurchaseReturnRow({
        ...apiPayload,
        Id: existingId,
      });
      setRecords((prev) =>
        prev.map((row) => (Number(row.id) === Number(existingId) ? normalized : row))
      );
      return { id: existingId };
    }

    const created = await purchaseReturnsApi.createPurchaseReturn(apiPayload);
    const createdId = created?.id ?? created?.Id;
    const normalized = purchaseReturnsApi.normalizePurchaseReturnRow({
      ...apiPayload,
      ...(created || {}),
      Id: createdId,
    });
    setRecords((prev) => [normalized, ...prev]);
    if (createdId) {
      await refreshAttachmentCount(createdId);
    }
    return { id: createdId };
  };

  const txt = (v) => renderCollectionsGridText(v);

  const columns = useMemo(
    () => [
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
        width: "36px",
        Cell: ({ value }) => renderCollectionsGridSno(value),
      },
      {
        id: "date",
        Header: "Date",
        accessor: "date",
        align: "left",
        Cell: ({ value }) => renderCollectionsGridText(formatDateDisplay(value)),
      },
      {
        id: "vrNo",
        Header: "Vr No",
        accessor: "vrNo",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "supplier",
        Header: labels.gridSupplier || "Supplier",
        accessor: "supplier",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "purchaseInvoice",
        Header: labels.gridPurchaseInvoice || "Purchase Invoice",
        accessor: "purchaseInvoice",
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
        id: "total",
        Header: "Total",
        accessor: "total",
        align: "right",
        Cell: ({ value }) => renderCollectionsGridAmount(formatAmount(value)),
      },
      {
        id: "attachments",
        Header: "Attach",
        accessor: "attachments",
        align: "center",
        width: "32px",
        Cell: ({ row }) => row?.original?.attachments,
      },
    ],
    [labels.gridPurchaseInvoice, labels.gridSupplier]
  );

  const computedRows = useMemo(
    () =>
      records.map((record, index) => {
        const attachmentCount = attachmentCountsById[record.id] ?? 0;
        const flat = flattenPurchaseReturnForGrid(record, index, { attachmentCount });
        const hasAttachments = attachmentCount > 0;
        return {
          ...flat,
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
              {canEditCurrentMenu() ? (
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
              {canDeleteCurrentMenu() ? (
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
            </MDBox>
          ),
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
    [attachmentCountsById, records]
  );

  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: records.length }),
    [records.length]
  );

  const gridBodySx = useMemo(
    () =>
      buildCollectionsGridTableBodySx({
        leadingCompactColumnCount: 2,
        trailingCompactColumnCount: 1,
      }),
    []
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title={labels.pageTitle}
        subtitle={labels.pageSubtitle}
        metadata={workspaceMetadata}
        tabs={<PurchasesModuleTabs />}
        filters={
          <MDBox
            ref={setPaginationHost}
            className="purchases-filter-pagination saas-settings-table-pagination-top"
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexShrink: 0,
              width: "100%",
              px: 1,
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
        }
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={gridBodySx}
      >
        {loading ? (
          <MDTypography variant="caption" color="text" px={2} py={1}>
            Loading purchase returns...
          </MDTypography>
        ) : (
          <DataTable
            table={{ columns, rows: computedRows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={false}
            paginationPortalTarget={paginationHost}
            showTotalEntries={false}
            canSearch
            canExport
            exportFileName={labels.exportFileName}
          />
        )}
      </EnterpriseWorkspace>

      <PurchaseReturnForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        labels={labels}
        readOnly={readOnlyForm}
        onUploadSuccess={(recordId) => {
          const id = recordId ?? currentRecord?.id;
          if (id) refreshAttachmentCount(id);
        }}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Delete Purchase Return</DialogTitle>
        <DialogContent>
          <MDTypography variant="body2">{labels.deleteConfirm}</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={handleCancelDelete}>
            Cancel
          </MDButton>
          <MDButton variant="gradient" color="error" onClick={handleConfirmDelete}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={attachmentsDialogOpen} onClose={handleCloseAttachments} maxWidth="sm" fullWidth>
        <DialogTitle>
          Attachments {attachmentsRecord?.id ? `(#${attachmentsRecord.id})` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {attachmentsLoading ? (
            <MDBox display="flex" justifyContent="center" py={2}>
              <CurrencyLoading size={28} />
            </MDBox>
          ) : attachmentsFiles.length ? (
            <MDBox display="flex" flexDirection="column" gap={1}>
              {attachmentsFiles.map((file, idx) => (
                <MDBox
                  key={file.id || `${file.fileName}-${idx}`}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={() => {
                      uploadApi
                        .downloadFile(file, file.fileName || `File-${idx + 1}`)
                        .catch((e) => window.alert(`Download failed: ${e.message}`));
                    }}
                    sx={{ justifyContent: "flex-start", flex: 1 }}
                  >
                    <Icon sx={{ mr: 1 }}>attach_file</Icon>
                    {file.fileName || `File ${idx + 1}`}
                  </MDButton>
                  {canDeleteCurrentMenu() ? (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteAttachment(file)}
                      title="Delete"
                    >
                      <Icon fontSize="small">delete</Icon>
                    </IconButton>
                  ) : null}
                </MDBox>
              ))}
            </MDBox>
          ) : (
            <MDTypography variant="body2" color="text">
              {labels.noAttachments}
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={handleCloseAttachments}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
