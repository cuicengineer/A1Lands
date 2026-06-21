import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Chip from "@mui/material/Chip";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import SearchableSelect from "components/SearchableSelect";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import CurrencyLoading from "components/CurrencyLoading";
import DataTable from "examples/Tables/DataTable";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import incomeStatementApi, {
  IS_GROUP_OPTIONS,
  UPLOAD_TABLE_NAME,
} from "services/api.incomestatement.service";
import uploadApi from "services/api.upload.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  isSuperuserOrAhqSupervisorUser,
} from "services/api.service";
import { useMaterialUIController } from "context";
import {
  DUPLICATE_ACCT_ROW_STYLE,
  getDuplicateAcctRowIds,
} from "layouts/configuration/utils/coaDuplicateHighlight";
import { coaPanelColumnSx, coaPanelTableBodySx } from "utils/coaPanelTableSx";

const SHOW_ATTACHMENTS = false;
const MAX_ATTACHMENT_FILES = 2;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function formatFileSize(bytes) {
  if (!bytes) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
}

function getAttachmentPath(file) {
  return (
    file?.Path ||
    file?.path ||
    file?.filePath ||
    file?.file_path ||
    file?.downloadUrl ||
    file?.fileUrl ||
    file?.url ||
    ""
  );
}

function normalizeAttachmentFile(file) {
  if (typeof file === "string") {
    return { fileName: file.split(/[\\/]/).pop(), downloadUrl: file };
  }
  const fileName =
    file?.fileName || file?.name || file?.filePath?.split(/[\\/]/).pop() || "Unknown File";
  const downloadUrl = getAttachmentPath(file) || file?.filePath || "";
  return { ...file, fileName, downloadUrl };
}

function hasAttachmentData(row) {
  const rawIsAttachment = row?.IsAttachment ?? row?.isAttachment;
  const countValue =
    row?.attachmentCount ??
    row?.attachmentsCount ??
    row?.filesCount ??
    row?.AttachmentCount ??
    row?.AttachmentsCount ??
    row?.FilesCount;

  return (
    rawIsAttachment === true ||
    rawIsAttachment === 1 ||
    rawIsAttachment === "1" ||
    String(rawIsAttachment || "")
      .trim()
      .toLowerCase() === "true" ||
    Number(countValue || 0) > 0
  );
}

function normalizeRow(row) {
  const id = row?.Id ?? row?.id;
  return {
    id: id != null ? Number(id) : null,
    acctId: pickField(row, "acctId", "AcctId"),
    acctName: pickField(row, "acctName", "AcctName"),
    groupName: pickField(row, "groupName", "GroupName"),
    subGroup: pickField(row, "subGroup", "SubGroup"),
    sortOrder: Number(row?.sortOrder ?? row?.SortOrder ?? 0),
    isAttachment: hasAttachmentData(row),
  };
}

function normalizeSubGroupRow(row) {
  return {
    id: row?.Id ?? row?.id,
    groupName: pickField(row, "groupName", "GroupName"),
    subGroupName: pickField(row, "subGroupName", "SubGroupName"),
  };
}

function unwrapCreatedId(response) {
  const id = response?.Id ?? response?.id ?? response?.data?.Id ?? response?.data?.id;
  return id != null ? Number(id) : null;
}

function suggestNextSortOrder(rows) {
  const orders = (rows || [])
    .map((row) => Number(row?.sortOrder ?? 0))
    .filter((n) => Number.isFinite(n));
  if (!orders.length) return 1;
  return Math.max(...orders) + 1;
}

function buildEmptyForm(rows) {
  return {
    acctId: "",
    acctName: "",
    groupName: "",
    subGroup: "",
    sortOrder: suggestNextSortOrder(rows),
  };
}

function buildApiPayload(draft) {
  return {
    AcctId: String(draft?.acctId ?? "").trim() || null,
    AcctName: String(draft?.acctName ?? "").trim(),
    GroupName: String(draft?.groupName ?? "").trim(),
    SubGroup: String(draft?.subGroup ?? "").trim() || null,
    SortOrder: Number(draft?.sortOrder ?? 0) || 0,
  };
}

function displayCell(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function IncomeStatementPanel({ panelTitle = "Income Statement" }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();
  const canManageSubGroups = isSuperuserOrAhqSupervisorUser();

  const [tableRows, setTableRows] = useState([]);
  const [subGroupOptions, setSubGroupOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reorderingId, setReorderingId] = useState(null);
  const [formDialogOpen, setFormDialogOpen] = useState(false);
  const [formMode, setFormMode] = useState("create");
  const [formDraft, setFormDraft] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [addSubGroupOpen, setAddSubGroupOpen] = useState(false);
  const [addSubGroupName, setAddSubGroupName] = useState("");
  const [subGroupDialogMode, setSubGroupDialogMode] = useState("add");
  const [editingSubGroup, setEditingSubGroup] = useState(null);
  const [formExistingFiles, setFormExistingFiles] = useState([]);
  const [formSelectedFiles, setFormSelectedFiles] = useState([]);
  const [loadingFormFiles, setLoadingFormFiles] = useState(false);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);
  const [attachmentsForId, setAttachmentsForId] = useState(null);
  const fileInputRef = useRef(null);

  const inputSx = darkMode
    ? {
        "& .MuiInputBase-input": { color: "#000000 !important" },
        "& .MuiInputLabel-root": { color: "#000000 !important" },
        "& .MuiFormHelperText-root": { color: "#000000 !important" },
        "& .MuiSelect-select": { color: "#000000 !important" },
        "& .MuiSvgIcon-root": { color: "#000000 !important" },
      }
    : {};

  const fetchSubGroups = useCallback(async () => {
    try {
      const response = await incomeStatementApi.getSubGroups();
      setSubGroupOptions((incomeStatementApi.unwrapList(response) || []).map(normalizeSubGroupRow));
    } catch (error) {
      console.error("Error fetching income statement sub-groups:", error);
      setSubGroupOptions([]);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await incomeStatementApi.getAll();
      const list = (incomeStatementApi.unwrapList(response) || [])
        .map(normalizeRow)
        .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
      setTableRows(list);
    } catch (error) {
      console.error("Error fetching income statements:", error);
      setTableRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadFormExistingFiles = useCallback(async (recordId) => {
    if (!recordId) {
      setFormExistingFiles([]);
      return;
    }
    setLoadingFormFiles(true);
    try {
      const response = await uploadApi.getUploadedFiles(recordId, UPLOAD_TABLE_NAME);
      const filesArray = response?.files || (Array.isArray(response) ? response : []);
      setFormExistingFiles(
        filesArray.map(normalizeAttachmentFile).filter((f) => getAttachmentPath(f))
      );
    } catch (error) {
      console.error("Error fetching form attachments:", error);
      setFormExistingFiles([]);
    } finally {
      setLoadingFormFiles(false);
    }
  }, []);

  const refreshAttachments = useCallback(async (recordId) => {
    const response = await uploadApi.getUploadedFiles(recordId, UPLOAD_TABLE_NAME);
    const filesArray = response?.files || (Array.isArray(response) ? response : []);
    const normalized = filesArray.map(normalizeAttachmentFile).filter((f) => getAttachmentPath(f));
    setAttachmentsFiles(normalized);
  }, []);

  useEffect(() => {
    fetchRows();
    fetchSubGroups();
  }, [fetchRows, fetchSubGroups]);

  const resetFormDialog = () => {
    setFormDialogOpen(false);
    setFormMode("create");
    setFormDraft(null);
    setFormErrors({});
    setFormExistingFiles([]);
    setFormSelectedFiles([]);
  };

  const handleAddNew = () => {
    if (!canCreate) return;
    setFormMode("create");
    setFormDraft(buildEmptyForm(tableRows));
    setFormErrors({});
    setFormExistingFiles([]);
    setFormSelectedFiles([]);
    setFormDialogOpen(true);
  };

  const handleEdit = useCallback(
    async (id) => {
      if (!canEdit) return;
      const row = tableRows.find((r) => r.id === id);
      if (!row) return;
      setFormMode("edit");
      setFormDraft({ ...row });
      setFormErrors({});
      setFormSelectedFiles([]);
      setFormDialogOpen(true);
      if (SHOW_ATTACHMENTS) {
        await loadFormExistingFiles(id);
      }
    },
    [canEdit, tableRows, loadFormExistingFiles]
  );

  const handleClone = useCallback(
    (id) => {
      if (!canCreate) return;
      const row = tableRows.find((r) => r.id === id);
      if (!row) return;
      setFormMode("create");
      setFormDraft({
        acctId: "",
        acctName: row.acctName || "",
        groupName: row.groupName || "",
        subGroup: row.subGroup || "",
        sortOrder: suggestNextSortOrder(tableRows),
      });
      setFormErrors({});
      setFormExistingFiles([]);
      setFormSelectedFiles([]);
      setFormDialogOpen(true);
    },
    [canCreate, tableRows]
  );

  const handleFormChange = (field, value) => {
    setFormDraft((draft) => {
      if (!draft) return draft;
      const next = { ...draft, [field]: value };
      if (field === "groupName") next.subGroup = "";
      return next;
    });
    if (formErrors[field]) {
      setFormErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validateDraft = (draft) => {
    const next = {};
    if (!String(draft?.acctName ?? "").trim()) next.acctName = "Acct Name is required";
    if (!String(draft?.groupName ?? "").trim()) next.groupName = "Group is required";
    setFormErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleFormFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    const totalFiles = formExistingFiles.length + formSelectedFiles.length;
    const remainingSlots = MAX_ATTACHMENT_FILES - totalFiles;

    if (totalFiles >= MAX_ATTACHMENT_FILES) {
      alert(
        `Maximum ${MAX_ATTACHMENT_FILES} files allowed. Please delete some existing files before uploading new ones.`
      );
      event.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      alert(`You can only upload ${remainingSlots} more file(s).`);
      event.target.value = "";
      return;
    }

    const validFiles = files.filter((file) => {
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });

    if (totalFiles + validFiles.length > MAX_ATTACHMENT_FILES) {
      alert(`You can only upload ${remainingSlots} more file(s).`);
      event.target.value = "";
      return;
    }

    setFormSelectedFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleSaveForm = async () => {
    if (formMode === "create" && !canCreate) return;
    if (formMode === "edit" && !canEdit) return;
    if (!formDraft || !validateDraft(formDraft)) return;

    setSaving(true);
    try {
      const payload = buildApiPayload(formDraft);
      let recordId = formDraft.id;

      if (formMode === "create") {
        const created = await incomeStatementApi.create(payload);
        recordId = unwrapCreatedId(created);
      } else {
        await incomeStatementApi.update(recordId, payload);
      }

      if (SHOW_ATTACHMENTS && recordId && formSelectedFiles.length > 0) {
        await uploadApi.uploadFiles(recordId, UPLOAD_TABLE_NAME, formSelectedFiles);
      }

      await fetchRows();
      resetFormDialog();
    } catch (error) {
      console.error("Error saving income statement:", error);
      alert(error?.message || "Failed to save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    if (!canDelete || formDialogOpen) return;
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!canDelete || !recordToDelete) return;
    try {
      await incomeStatementApi.remove(recordToDelete);
      await fetchRows();
    } catch (error) {
      console.error("Error deleting income statement:", error);
      alert(error?.message || "Failed to delete. Please try again.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleSaveSubGroup = async () => {
    const groupName = pickField(formDraft, "groupName", "GroupName");
    const subGroupName = String(addSubGroupName || "").trim();
    if (!groupName) {
      alert("Group is required.");
      return;
    }
    if (!subGroupName) {
      alert("Enter a sub-group name.");
      return;
    }
    try {
      if (subGroupDialogMode === "edit" && editingSubGroup?.id) {
        await incomeStatementApi.updateSubGroup(editingSubGroup.id, groupName, subGroupName);
        if (formDraft?.subGroup === editingSubGroup.subGroupName) {
          handleFormChange("subGroup", subGroupName);
        }
      } else {
        await incomeStatementApi.createSubGroup(groupName, subGroupName);
        handleFormChange("subGroup", subGroupName);
      }
      await fetchSubGroups();
      resetSubGroupDialog();
    } catch (error) {
      alert(error?.message || "Failed to save sub-group.");
    }
  };

  const handleEditSubGroup = (item, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    if (!canManageSubGroups || !item?.id) return;
    setSubGroupDialogMode("edit");
    setEditingSubGroup(item);
    setAddSubGroupName(item.subGroupName || "");
    setAddSubGroupOpen(true);
  };

  const handleDeleteSubGroup = async (item, event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    if (!canManageSubGroups || !item?.id) return;
    const label = item.subGroupName || "this sub-group";
    if (!window.confirm(`Delete "${label}"? This cannot be undone from the dropdown.`)) return;
    try {
      await incomeStatementApi.deleteSubGroup(item.id);
      if (formDraft?.subGroup === item.subGroupName) {
        handleFormChange("subGroup", "");
      }
      await fetchSubGroups();
    } catch (error) {
      alert(error?.message || "Failed to delete sub-group.");
    }
  };

  const resetSubGroupDialog = () => {
    setAddSubGroupOpen(false);
    setAddSubGroupName("");
    setSubGroupDialogMode("add");
    setEditingSubGroup(null);
  };

  const handleOpenAttachments = async (recordId) => {
    if (!recordId) return;
    setAttachmentsForId(recordId);
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    try {
      await refreshAttachments(recordId);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleDeleteAttachment = async (file) => {
    if (!canDelete) return;
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      alert("File ID is not available. Cannot delete this file.");
      return;
    }
    if (!window.confirm(`Delete "${file.fileName || file.name || "this file"}"?`)) return;
    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (attachmentsForId) {
        setAttachmentsLoading(true);
        await refreshAttachments(attachmentsForId);
        await fetchRows();
      }
    } catch (error) {
      alert(error?.message || "Failed to delete file.");
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsFiles([]);
    setAttachmentsForId(null);
  };

  const applyRowsFromApi = useCallback((response) => {
    const list = (incomeStatementApi.unwrapList(response) || [])
      .map(normalizeRow)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    setTableRows(list);
  }, []);

  const handleMoveRow = useCallback(
    async (id, direction) => {
      if (!canEdit || reorderingId != null || formDialogOpen) return;

      const orderedRows = [...(tableRows || [])].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.id - b.id
      );
      const currentIndex = orderedRows.findIndex((row) => row.id === id);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedRows.length) return;

      setReorderingId(id);
      try {
        const response = await incomeStatementApi.reorder(id, direction);
        applyRowsFromApi(response);
      } catch (error) {
        console.error("Error reordering income statement row:", error);
        alert(error?.message || "Failed to update sort order. Please try again.");
      } finally {
        setReorderingId(null);
      }
    },
    [applyRowsFromApi, canEdit, formDialogOpen, reorderingId, tableRows]
  );

  const filteredSubGroups = (subGroupOptions || []).filter(
    (item) => item.groupName === pickField(formDraft, "groupName", "GroupName")
  );

  const totalFormFiles = formExistingFiles.length + formSelectedFiles.length;

  const orderedTableRows = useMemo(
    () => [...(tableRows || [])].sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [tableRows]
  );

  const duplicateAcctRowIds = useMemo(
    () => getDuplicateAcctRowIds(orderedTableRows),
    [orderedTableRows]
  );

  const columns = useMemo(
    () => [
      { Header: "Order", accessor: "sortOrderControls", align: "center", width: "9%" },
      { Header: "Actions", accessor: "actions", align: "center", width: "13%" },
      ...(SHOW_ATTACHMENTS
        ? [{ Header: "Attach", accessor: "attachments", align: "center", width: "6%" }]
        : []),
      { Header: "S.No", accessor: "sno", align: "center", width: "6%" },
      { Header: "Acct ID", accessor: "acctId", align: "left", width: "12%" },
      { Header: "Acct Name", accessor: "acctName", align: "left", width: "26%" },
      { Header: "Group", accessor: "groupName", align: "left", width: "14%" },
      { Header: "Sub-Group", accessor: "subGroup", align: "left", width: "20%" },
    ],
    []
  );

  const computedRows = useMemo(
    () =>
      orderedTableRows.map((row, index) => {
        const canMoveUp = index > 0;
        const canMoveDown = index < orderedTableRows.length - 1;
        const isReordering = reorderingId === row.id;

        return {
          id: row.id,
          sno: index + 1,
          ...(duplicateAcctRowIds.has(row.id) ? { __rowStyle: DUPLICATE_ACCT_ROW_STYLE } : {}),
          sortOrderControls: (
            <MDBox display="flex" justifyContent="center" gap={0.25}>
              <Tooltip title="Move up">
                <span>
                  <IconButton
                    size="small"
                    color="info"
                    onClick={() => handleMoveRow(row.id, "up")}
                    disabled={!canEdit || !canMoveUp || formDialogOpen || reorderingId != null}
                    sx={{ padding: "2px" }}
                  >
                    {isReordering ? (
                      <CurrencyLoading size={16} />
                    ) : (
                      <Icon fontSize="small">keyboard_arrow_up</Icon>
                    )}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Move down">
                <span>
                  <IconButton
                    size="small"
                    color="info"
                    onClick={() => handleMoveRow(row.id, "down")}
                    disabled={!canEdit || !canMoveDown || formDialogOpen || reorderingId != null}
                    sx={{ padding: "2px" }}
                  >
                    <Icon fontSize="small">keyboard_arrow_down</Icon>
                  </IconButton>
                </span>
              </Tooltip>
            </MDBox>
          ),
          acctId: displayCell(row.acctId),
          acctName: displayCell(row.acctName),
          groupName: displayCell(row.groupName),
          subGroup: displayCell(row.subGroup),
          ...(SHOW_ATTACHMENTS
            ? {
                attachments: (
                  <IconButton
                    size="small"
                    color={row.isAttachment ? "success" : "error"}
                    onClick={() => handleOpenAttachments(row.id)}
                    title="View Attachments"
                    sx={{ padding: "1px" }}
                  >
                    <Icon>visibility</Icon>
                  </IconButton>
                ),
              }
            : {}),
          actions: (
            <MDBox display="flex" gap={0.25}>
              {canCreate && (
                <IconButton
                  size="small"
                  color="secondary"
                  onClick={() => handleClone(row.id)}
                  title="Clone"
                  disabled={formDialogOpen}
                >
                  <Icon fontSize="small">content_copy</Icon>
                </IconButton>
              )}
              <IconButton
                size="small"
                color="info"
                onClick={() => handleEdit(row.id)}
                title="Edit"
                disabled={!canEdit || formDialogOpen}
              >
                <Icon fontSize="small">edit</Icon>
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDelete(row.id)}
                title="Delete"
                disabled={!canDelete || formDialogOpen}
              >
                <Icon fontSize="small">delete</Icon>
              </IconButton>
            </MDBox>
          ),
        };
      }),
    [
      orderedTableRows,
      duplicateAcctRowIds,
      canCreate,
      canEdit,
      canDelete,
      formDialogOpen,
      handleEdit,
      handleClone,
      handleMoveRow,
      reorderingId,
    ]
  );

  const tableData = useMemo(
    () => ({ columns: columns || [], rows: computedRows || [] }),
    [columns, computedRows]
  );

  return (
    <MDBox sx={{ ...coaPanelColumnSx, ...coaPanelTableBodySx }}>
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        mb={1.5}
        flexShrink={0}
        gap={1}
      >
        <MDTypography variant="h6" fontWeight="medium" sx={{ fontSize: "1rem" }}>
          {panelTitle}
        </MDTypography>
        {canCreate ? (
          <MDButton
            variant="outlined"
            color="dark"
            size="small"
            onClick={handleAddNew}
            disabled={formDialogOpen}
          >
            Add New
          </MDButton>
        ) : null}
      </MDBox>

      <MDBox className="coa-panel-grid-host">
        <DataTable
          table={tableData}
          isSorted={false}
          stickyToolbarAndHeader
          canSearch
          entriesPerPage={false}
          showTotalEntries={false}
          exportFileName="Income-Statement"
          noEndBorder
        />
        <WorkspaceLoadingOverlay active={loading} />
      </MDBox>

      <Dialog
        open={formDialogOpen}
        onClose={saving ? undefined : resetFormDialog}
        fullWidth
        maxWidth="lg"
        scroll="paper"
      >
        <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
          {formMode === "create" ? "New Income Statement" : "Edit Income Statement"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <MDInput
                label="Acct ID"
                value={formDraft?.acctId || ""}
                onChange={(e) => handleFormChange("acctId", e.target.value)}
                fullWidth
                size="small"
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <MDInput
                label="Acct Name"
                value={formDraft?.acctName || ""}
                onChange={(e) => handleFormChange("acctName", e.target.value)}
                fullWidth
                size="small"
                required
                error={Boolean(formErrors.acctName)}
                helperText={formErrors.acctName}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl size="small" fullWidth required error={Boolean(formErrors.groupName)}>
                <InputLabel sx={inputSx}>Group</InputLabel>
                <SearchableSelect
                  value={formDraft?.groupName || ""}
                  label="Group"
                  onChange={(e) => handleFormChange("groupName", e.target.value)}
                  sx={inputSx}
                >
                  <MenuItem value="">
                    <em>Select group</em>
                  </MenuItem>
                  {(IS_GROUP_OPTIONS || []).map((option) => (
                    <MenuItem key={option} value={option}>
                      {option}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {formErrors.groupName && (
                  <FormHelperText sx={inputSx}>{formErrors.groupName}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={inputSx}>Sub-Group</InputLabel>
                <SearchableSelect
                  value={formDraft?.subGroup || ""}
                  label="Sub-Group"
                  disabled={!formDraft?.groupName}
                  onChange={(e) => {
                    if (e.target.value === "__add__") {
                      setAddSubGroupName("");
                      setAddSubGroupOpen(true);
                      return;
                    }
                    handleFormChange("subGroup", e.target.value);
                  }}
                  sx={inputSx}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {filteredSubGroups.map((item) => (
                    <MenuItem
                      key={item.id || item.subGroupName}
                      value={item.subGroupName}
                      sx={canManageSubGroups ? { pr: 1 } : undefined}
                    >
                      <MDBox
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                        gap={0.5}
                      >
                        <span>{item.subGroupName}</span>
                        {canManageSubGroups && (
                          <MDBox
                            display="flex"
                            alignItems="center"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <IconButton
                              size="small"
                              color="info"
                              title="Edit sub-group"
                              onClick={(e) => handleEditSubGroup(item, e)}
                              sx={{ padding: "2px" }}
                            >
                              <Icon fontSize="small">edit</Icon>
                            </IconButton>
                            <IconButton
                              size="small"
                              color="error"
                              title="Delete sub-group"
                              onClick={(e) => handleDeleteSubGroup(item, e)}
                              sx={{ padding: "2px" }}
                            >
                              <Icon fontSize="small">delete</Icon>
                            </IconButton>
                          </MDBox>
                        )}
                      </MDBox>
                    </MenuItem>
                  ))}
                  <MenuItem value="__add__" sx={{ fontStyle: "italic", color: "info.main" }}>
                    + Add sub-group...
                  </MenuItem>
                </SearchableSelect>
              </FormControl>
            </Grid>

            {SHOW_ATTACHMENTS && (
              <Grid item xs={12}>
                <MDBox
                  sx={{
                    border: "1px dashed",
                    borderColor: "#b0b0b0",
                    borderRadius: 2,
                    p: 2,
                    bgcolor: "background.paper",
                  }}
                >
                  <MDTypography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
                    Attachments (Max {MAX_ATTACHMENT_FILES} files total)
                  </MDTypography>

                  {formMode === "edit" && formDraft?.id && (
                    <>
                      {loadingFormFiles ? (
                        <MDBox display="flex" justifyContent="center" py={1}>
                          <CurrencyLoading size={20} />
                        </MDBox>
                      ) : (
                        formExistingFiles.length > 0 && (
                          <MDBox mb={2}>
                            <MDTypography
                              variant="caption"
                              color="text"
                              sx={{ display: "block", mb: 1 }}
                            >
                              Already uploaded files ({formExistingFiles.length}/
                              {MAX_ATTACHMENT_FILES}):
                            </MDTypography>
                            {formExistingFiles.map((file, index) => (
                              <Chip
                                key={file.id || index}
                                label={file.fileName || `File ${index + 1}`}
                                sx={{ mr: 1, mb: 1, fontSize: "0.95rem" }}
                                color="default"
                                variant="outlined"
                                disabled
                              />
                            ))}
                          </MDBox>
                        )
                      )}
                    </>
                  )}

                  {totalFormFiles >= MAX_ATTACHMENT_FILES ? (
                    <MDBox
                      sx={{
                        p: 2,
                        bgcolor: "warning.light",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "warning.main",
                      }}
                    >
                      <MDTypography variant="body2" color="warning.dark">
                        Maximum {MAX_ATTACHMENT_FILES} files already uploaded. Delete existing files
                        from the grid eye icon to upload new ones.
                      </MDTypography>
                    </MDBox>
                  ) : (
                    <>
                      <input
                        ref={fileInputRef}
                        accept="*/*"
                        type="file"
                        multiple
                        hidden
                        onChange={handleFormFileSelect}
                        disabled={totalFormFiles >= MAX_ATTACHMENT_FILES || saving}
                      />
                      <MDButton
                        variant="gradient"
                        color="info"
                        size="small"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={totalFormFiles >= MAX_ATTACHMENT_FILES || saving}
                        sx={{ mb: 1 }}
                      >
                        <Icon sx={{ mr: 0.5 }}>cloud_upload</Icon>
                        Upload Files ({totalFormFiles}/{MAX_ATTACHMENT_FILES})
                      </MDButton>
                      {totalFormFiles < MAX_ATTACHMENT_FILES && (
                        <MDTypography
                          variant="caption"
                          color="text"
                          sx={{ display: "block", mb: 1 }}
                        >
                          You can upload {MAX_ATTACHMENT_FILES - totalFormFiles} more file(s).
                        </MDTypography>
                      )}
                    </>
                  )}

                  {formSelectedFiles.length > 0 && (
                    <MDBox mt={1}>
                      <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                        New files to upload:
                      </MDTypography>
                      {formSelectedFiles.map((file, index) => (
                        <Chip
                          key={`${file.name}-${index}`}
                          label={`${file.name} (${formatFileSize(file.size)})`}
                          onDelete={() =>
                            setFormSelectedFiles((prev) => prev.filter((_, i) => i !== index))
                          }
                          deleteIcon={<Icon>cancel</Icon>}
                          sx={{ mr: 1, mb: 1, fontSize: "0.95rem" }}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </MDBox>
                  )}

                  {formSelectedFiles.length === 0 && formExistingFiles.length === 0 && (
                    <MDTypography variant="caption" color="text" sx={{ display: "block", mt: 1 }}>
                      No files selected. Click &quot;Upload Files&quot; to add attachments.
                    </MDTypography>
                  )}
                </MDBox>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <MDButton
            color="secondary"
            variant="outlined"
            onClick={resetFormDialog}
            disabled={saving}
          >
            Cancel
          </MDButton>
          <MDButton color="info" variant="gradient" onClick={handleSaveForm} disabled={saving}>
            <Icon sx={{ mr: 0.5 }}>save</Icon>
            {saving ? "Saving..." : "Save"}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body2">
            Are you sure you want to delete this income statement record?
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton color="secondary" variant="outlined" onClick={() => setDeleteDialogOpen(false)}>
            Cancel
          </MDButton>
          <MDButton color="error" variant="gradient" onClick={handleConfirmDelete}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={addSubGroupOpen} onClose={resetSubGroupDialog} maxWidth="xs" fullWidth>
        <DialogTitle>
          {subGroupDialogMode === "edit" ? "Edit Sub-Group" : "Add Sub-Group"}
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Sub-Group name"
            fullWidth
            value={addSubGroupName}
            onChange={(e) => setAddSubGroupName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <MDButton color="secondary" onClick={resetSubGroupDialog}>
            Cancel
          </MDButton>
          <MDButton color="info" onClick={handleSaveSubGroup}>
            {subGroupDialogMode === "edit" ? "Save" : "Add"}
          </MDButton>
        </DialogActions>
      </Dialog>

      {SHOW_ATTACHMENTS && (
        <Dialog
          open={attachmentsDialogOpen}
          onClose={handleCloseAttachments}
          fullWidth
          maxWidth="sm"
        >
          <DialogTitle>Attachments {attachmentsForId ? `(#${attachmentsForId})` : ""}</DialogTitle>
          <DialogContent dividers>
            {attachmentsLoading ? (
              <MDBox display="flex" justifyContent="center" py={2}>
                <CurrencyLoading size={28} />
              </MDBox>
            ) : attachmentsFiles.length > 0 ? (
              <MDBox display="flex" flexDirection="column" gap={1}>
                {attachmentsFiles.map((f, idx) => (
                  <MDBox
                    key={`${f.fileName || "file"}-${idx}`}
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >
                    <MDButton
                      variant="outlined"
                      color="info"
                      onClick={() => {
                        uploadApi
                          .downloadFile(f, f.fileName || `File-${idx + 1}`)
                          .catch((e) => alert(`Download failed: ${e.message}`));
                      }}
                      sx={{ justifyContent: "flex-start", flex: 1 }}
                    >
                      <Icon sx={{ mr: 1 }}>attach_file</Icon>
                      {f.fileName || `File ${idx + 1}`}
                    </MDButton>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteAttachment(f)}
                      title="Delete Attachment"
                      disabled={!canDelete}
                      sx={{ border: "1px solid", borderColor: "error.main", borderRadius: 1 }}
                    >
                      <Icon>delete</Icon>
                    </IconButton>
                  </MDBox>
                ))}
              </MDBox>
            ) : (
              <MDTypography variant="body2" color="text">
                No attachments found for this record.
              </MDTypography>
            )}
          </DialogContent>
          <DialogActions>
            <MDButton onClick={handleCloseAttachments} variant="gradient" color="info">
              Close
            </MDButton>
          </DialogActions>
        </Dialog>
      )}
    </MDBox>
  );
}

IncomeStatementPanel.propTypes = {
  panelTitle: PropTypes.string,
};

export default IncomeStatementPanel;
