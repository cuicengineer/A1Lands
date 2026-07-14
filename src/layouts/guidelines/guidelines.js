import { useCallback, useEffect, useMemo, useState } from "react";
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
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import GridStatusChip from "components/GridStatusChip";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";
import { isSuperuserOrAhqSupervisorUser } from "services/api.service";
import uploadApi from "services/api.upload.service";
import guidelinesApi from "services/api.guidelines.service";
import GuidelineForm from "./GuidelineForm";
import { GUIDELINES_MAX_ROWS, fetchGuidelinesUploadedFiles } from "./guidelinesAttachmentUtils";

export default function Guidelines() {
  const canManage = isSuperuserOrAhqSupervisorUser();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [formReadOnly, setFormReadOnly] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [paginationHost, setPaginationHost] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsRecord, setAttachmentsRecord] = useState(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);

  const txt = (v) => renderCollectionsGridText(v);

  const fetchGuidelines = useCallback(async () => {
    setLoading(true);
    try {
      const response = await guidelinesApi.listGuidelines();
      const rows = guidelinesApi.unwrapList(response);
      setRecords(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Error fetching guidelines:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGuidelines();
  }, [fetchGuidelines]);

  const handleOpenCreate = () => {
    if (!canManage) return;
    if (records.length >= GUIDELINES_MAX_ROWS) {
      alert(`Maximum of ${GUIDELINES_MAX_ROWS} guidelines allowed.`);
      return;
    }
    setCurrentRecord(null);
    setFormReadOnly(false);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
    setFormReadOnly(false);
  };

  const handleViewOrEdit = (row, readOnly) => {
    const id = row?.id ?? row?.Id;
    const record = records.find((r) => Number(r.id ?? r.Id) === Number(id));
    if (!record) return;
    setCurrentRecord({
      id: record.id ?? record.Id,
      title: record.title ?? record.Title ?? "",
      description: record.description ?? record.Description ?? "",
      status: record.status ?? record.Status,
    });
    setFormReadOnly(Boolean(readOnly));
    setOpenForm(true);
  };

  const handleOpenAttachments = async (row) => {
    const id = row?.id ?? row?.Id;
    if (id == null) return;
    setAttachmentsRecord({
      id,
      title: row.title ?? row.Title ?? "",
    });
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    setAttachmentsFiles([]);
    try {
      const files = await fetchGuidelinesUploadedFiles(id);
      setAttachmentsFiles(files);
    } catch (error) {
      console.error("Failed to load guideline attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsRecord(null);
    setAttachmentsFiles([]);
  };

  const handleDownloadAttachment = async (file, index) => {
    try {
      await uploadApi.downloadFile(file, file.fileName || `File-${index + 1}`);
    } catch (error) {
      console.error("Failed to download guideline attachment:", error);
      alert(error?.message || "Failed to download file.");
    }
  };

  const handleOpenAttachment = async (file, index) => {
    const fileName = file.fileName || file.FileName || `File-${index + 1}`;
    try {
      if (uploadApi.isPdfFileName(fileName)) {
        await uploadApi.openFile(file, fileName);
        return;
      }
      await uploadApi.downloadFile(file, fileName);
    } catch (error) {
      console.error("Failed to open guideline attachment:", error);
      alert(error?.message || "Failed to open file.");
    }
  };

  const handleDelete = (id) => {
    if (!canManage) return;
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null || !canManage) return;
    try {
      await guidelinesApi.removeGuideline(recordToDelete);
      await fetchGuidelines();
    } catch (error) {
      console.error("Error deleting guideline:", error);
      alert(error?.message || "Failed to delete guideline.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const columns = useMemo(
    () => [
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        width: "96px",
        // eslint-disable-next-line react/prop-types
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "viewDownload",
        Header: "View/Download",
        accessor: "viewDownload",
        align: "center",
        width: "110px",
        // eslint-disable-next-line react/prop-types
        Cell: ({ row }) => row?.original?.viewDownload,
      },
      {
        id: "title",
        Header: "Title",
        accessor: "title",
        align: "left",
        // eslint-disable-next-line react/prop-types
        Cell: ({ value }) => txt(value),
      },
      {
        id: "description",
        Header: "Description",
        accessor: "description",
        align: "left",
        // eslint-disable-next-line react/prop-types
        Cell: ({ value }) => txt(value),
      },
      {
        id: "status",
        Header: "Status",
        accessor: "status",
        align: "center",
        width: "100px",
        // eslint-disable-next-line react/prop-types
        Cell: ({ value }) => <GridStatusChip value={value} />,
      },
    ],
    []
  );

  const rows = useMemo(
    () =>
      records.map((row) => {
        const id = row.id ?? row.Id;
        return {
          id,
          title: row.title ?? row.Title ?? "",
          description: row.description ?? row.Description ?? "",
          status: row.status ?? row.Status,
          viewDownload: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              <Tooltip title="View / download attachments">
                <IconButton
                  size="small"
                  color="success"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                  onClick={() => handleOpenAttachments(row)}
                >
                  <Icon fontSize="small">visibility</Icon>
                </IconButton>
              </Tooltip>
            </MDBox>
          ),
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              {canManage ? (
                <Tooltip title="Edit">
                  <IconButton
                    size="small"
                    color="info"
                    sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                    onClick={() => handleViewOrEdit(row, false)}
                  >
                    <Icon fontSize="small">edit</Icon>
                  </IconButton>
                </Tooltip>
              ) : null}
              {canManage && (
                <Tooltip title="Delete">
                  <IconButton
                    size="small"
                    color="error"
                    sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                    onClick={() => handleDelete(id)}
                  >
                    <Icon fontSize="small">delete</Icon>
                  </IconButton>
                </Tooltip>
              )}
            </MDBox>
          ),
        };
      }),
    [records, canManage]
  );

  const atRowLimit = records.length >= GUIDELINES_MAX_ROWS;

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Guidelines"
        subtitle="Upload and view guideline documents"
        metrics={buildWorkspaceRecordMetrics(records.length)}
        actions={
          canManage ? (
            <MDButton
              variant="gradient"
              color="info"
              onClick={handleOpenCreate}
              disabled={atRowLimit}
            >
              <Icon>add</Icon>&nbsp;New Guideline
            </MDButton>
          ) : null
        }
      >
        <WorkspaceLoadingOverlay loading={loading} />
        <MDBox
          sx={{
            ...buildCollectionsGridTableBodySx(),
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            opacity: loading ? 0.55 : 1,
            pointerEvents: loading ? "none" : "auto",
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
              minHeight: 28,
            }}
          />
          <DataTable
            table={{ columns, rows }}
            canSearch
            stickyToolbarAndHeader
            entriesPerPage={{ defaultValue: 10, entries: [10, 25, 50] }}
            showTotalEntries={false}
            pagination={{ variant: "gradient", color: "info" }}
            paginationHost={paginationHost}
            exportFileName="Guidelines"
            isSorted={false}
            noEndBorder
            contentFitTable
          />
        </MDBox>
        {canManage && atRowLimit && (
          <MDTypography variant="caption" color="text" sx={{ mt: 1, display: "block" }}>
            Maximum of {GUIDELINES_MAX_ROWS} guidelines reached.
          </MDTypography>
        )}
      </EnterpriseWorkspace>

      <GuidelineForm
        open={openForm}
        onClose={handleCloseForm}
        initialData={currentRecord}
        readOnly={formReadOnly}
        onSaved={fetchGuidelines}
      />

      <Dialog open={attachmentsDialogOpen} onClose={handleCloseAttachments} maxWidth="sm" fullWidth>
        <DialogTitle>
          Attachments{attachmentsRecord?.title ? ` — ${attachmentsRecord.title}` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {attachmentsLoading ? (
            <MDBox display="flex" justifyContent="center" py={2}>
              <CurrencyLoading size={28} />
            </MDBox>
          ) : attachmentsFiles.length ? (
            attachmentsFiles.map((file, index) => {
              const fileName = file.fileName || file.FileName || `File ${index + 1}`;
              const isPdf = uploadApi.isPdfFileName(fileName);
              return (
                <MDBox
                  key={file.id ?? file.fileId ?? `${fileName}-${index}`}
                  display="flex"
                  alignItems="center"
                  justifyContent="space-between"
                  gap={1}
                  mb={1}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 1,
                    px: 1,
                    py: 0.5,
                  }}
                >
                  <MDButton
                    variant="text"
                    color="info"
                    size="small"
                    onClick={() => handleOpenAttachment(file, index)}
                    sx={{
                      flex: 1,
                      justifyContent: "flex-start",
                      textTransform: "none",
                      minWidth: 0,
                    }}
                  >
                    <Icon sx={{ mr: 1 }}>{isPdf ? "picture_as_pdf" : "attach_file"}</Icon>
                    <MDTypography
                      variant="button"
                      color="inherit"
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        textAlign: "left",
                      }}
                    >
                      {fileName}
                    </MDTypography>
                  </MDButton>
                  <Tooltip title="Download">
                    <IconButton
                      size="small"
                      color="secondary"
                      onClick={() => handleDownloadAttachment(file, index)}
                      aria-label={`Download ${fileName}`}
                    >
                      <Icon fontSize="small">download</Icon>
                    </IconButton>
                  </Tooltip>
                </MDBox>
              );
            })
          ) : (
            <MDTypography variant="body2">No attachments uploaded.</MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseAttachments}>Close</MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this guideline?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={() => setDeleteDialogOpen(false)}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canManage}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
