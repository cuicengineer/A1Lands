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
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DataTable from "examples/Tables/DataTable";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { GRID_DARK_ARROW_ICON_SX } from "utils/gridDarkArrowIconSx";
import chartOfAccountsApi, {
  COA_GROUP_OPTIONS,
  COA_SECTION_TYPE,
  UPLOAD_TABLE_NAME,
} from "services/api.chartofaccounts.service";
import uploadApi from "services/api.upload.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  isSuperuserOrAhqSupervisorUser,
} from "services/api.service";
import { useMaterialUIController } from "context";
import IncomeStatementPanel from "layouts/configuration/income-statement/IncomeStatementPanel";
import {
  DUPLICATE_ACCT_ROW_STYLE,
  getDuplicateAcctRowIds,
} from "layouts/configuration/utils/coaDuplicateHighlight";
import {
  coaActionControlsSx,
  coaCloneIconButtonSx,
  coaCloneIconSx,
  coaDeleteIconButtonSx,
  coaDeleteIconSx,
  coaEditIconButtonSx,
  coaEditIconSx,
  coaPanelColumnSx,
  coaPanelInnerSx,
  coaPanelTableBodySx,
  coaSortControlsSx,
  coaSplitBodySx,
  coaWorkspaceSx,
} from "utils/coaPanelTableSx";

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

function normalizeCoaRow(row) {
  const id = row?.Id ?? row?.id;
  return {
    id: id != null ? Number(id) : null,
    acctId: pickField(row, "acctId", "AcctId"),
    acctName: pickField(row, "acctName", "AcctName"),
    groupName: pickField(row, "groupName", "GroupName"),
    subGroup: pickField(row, "subGroup", "SubGroup"),
    controlAccount: pickField(row, "controlAccount", "ControlAccount"),
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

function normalizeControlAccountRow(row) {
  return {
    id: row?.Id ?? row?.id,
    controlAccountName: pickField(row, "controlAccountName", "ControlAccountName"),
  };
}

function unwrapCreatedId(response) {
  const id = response?.Id ?? response?.id ?? response?.data?.Id ?? response?.data?.id;
  return id != null ? Number(id) : null;
}

const COA_GROUP_SORT_RANK = COA_GROUP_OPTIONS.reduce((acc, name, index) => {
  acc[name.toLowerCase()] = index;
  return acc;
}, {});

function getCoaGroupSortRank(groupName) {
  const key = String(groupName || "")
    .trim()
    .toLowerCase();
  if (key in COA_GROUP_SORT_RANK) return COA_GROUP_SORT_RANK[key];
  return COA_GROUP_OPTIONS.length;
}

function compareCoaRowsByGroupAndSortOrder(a, b) {
  const groupDiff = getCoaGroupSortRank(a?.groupName) - getCoaGroupSortRank(b?.groupName);
  if (groupDiff !== 0) return groupDiff;

  const sortDiff = Number(a?.sortOrder ?? 0) - Number(b?.sortOrder ?? 0);
  if (sortDiff !== 0) return sortDiff;

  return Number(a?.id ?? 0) - Number(b?.id ?? 0);
}

function sortCoaRows(rows) {
  return [...(rows || [])].sort(compareCoaRowsByGroupAndSortOrder);
}

function suggestNextSortOrder(rows, groupName) {
  const groupKey = String(groupName || "")
    .trim()
    .toLowerCase();
  const sameGroupRows = (rows || []).filter(
    (row) =>
      String(row?.groupName || "")
        .trim()
        .toLowerCase() === groupKey
  );
  const orders = sameGroupRows
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
    controlAccount: "",
    sortOrder: suggestNextSortOrder(rows),
  };
}

function buildApiPayload(draft) {
  return {
    AcctId: String(draft?.acctId ?? "").trim() || null,
    AcctName: String(draft?.acctName ?? "").trim(),
    GroupName: String(draft?.groupName ?? "").trim(),
    SubGroup: String(draft?.subGroup ?? "").trim() || null,
    ControlAccount: String(draft?.controlAccount ?? "").trim() || null,
    SortOrder: Number(draft?.sortOrder ?? 0) || 0,
    SectionType: COA_SECTION_TYPE,
  };
}

function displayCell(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function displayAccountCell(row) {
  const acctId = String(row?.acctId ?? "").trim();
  const acctName = String(row?.acctName ?? "").trim();
  const accountText =
    acctId && acctName ? `${acctId} - ${acctName}` : displayCell(acctId || acctName);
  return (
    <MDBox
      component="span"
      sx={{
        display: "block",
        width: "100%",
        maxWidth: "100%",
        whiteSpace: "normal !important",
        wordBreak: "break-word !important",
        overflowWrap: "anywhere !important",
        lineHeight: 1.1,
      }}
    >
      {accountText}
    </MDBox>
  );
}

export function ChartOfAccountsPanel({ panelTitle = "Balance Sheet" }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();
  const canManageSubGroups = isSuperuserOrAhqSupervisorUser();

  const [tableRows, setTableRows] = useState([]);
  const [subGroupOptions, setSubGroupOptions] = useState([]);
  const [controlAccountOptions, setControlAccountOptions] = useState([]);
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
  const [addControlAccountOpen, setAddControlAccountOpen] = useState(false);
  const [addControlAccountName, setAddControlAccountName] = useState("");
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
      const response = await chartOfAccountsApi.getSubGroups();
      setSubGroupOptions((chartOfAccountsApi.unwrapList(response) || []).map(normalizeSubGroupRow));
    } catch (error) {
      console.error("Error fetching sub-groups:", error);
      setSubGroupOptions([]);
    }
  }, []);

  const fetchControlAccounts = useCallback(async () => {
    try {
      const response = await chartOfAccountsApi.getControlAccounts();
      setControlAccountOptions(
        (chartOfAccountsApi.unwrapList(response) || []).map(normalizeControlAccountRow)
      );
    } catch (error) {
      console.error("Error fetching control accounts:", error);
      setControlAccountOptions([]);
    }
  }, []);

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const response = await chartOfAccountsApi.getAll(COA_SECTION_TYPE);
      const list = sortCoaRows(
        (chartOfAccountsApi.unwrapList(response) || []).map(normalizeCoaRow)
      );
      setTableRows(list);
    } catch (error) {
      console.error("Error fetching chart of accounts:", error);
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
    fetchControlAccounts();
  }, [fetchRows, fetchSubGroups, fetchControlAccounts]);

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
        controlAccount: row.controlAccount || "",
        sortOrder: suggestNextSortOrder(tableRows, row.groupName),
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
      if (field === "groupName") {
        next.subGroup = "";
        next.sortOrder = suggestNextSortOrder(tableRows, value);
      }
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
        const created = await chartOfAccountsApi.create(payload);
        recordId = unwrapCreatedId(created);
      } else {
        await chartOfAccountsApi.update(recordId, payload);
      }

      if (SHOW_ATTACHMENTS && recordId && formSelectedFiles.length > 0) {
        await uploadApi.uploadFiles(recordId, UPLOAD_TABLE_NAME, formSelectedFiles);
      }

      await fetchRows();
      resetFormDialog();
    } catch (error) {
      console.error("Error saving chart of account:", error);
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
      await chartOfAccountsApi.remove(recordToDelete);
      await fetchRows();
    } catch (error) {
      console.error("Error deleting chart of account:", error);
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
        await chartOfAccountsApi.updateSubGroup(editingSubGroup.id, groupName, subGroupName);
        if (formDraft?.subGroup === editingSubGroup.subGroupName) {
          handleFormChange("subGroup", subGroupName);
        }
      } else {
        await chartOfAccountsApi.createSubGroup(groupName, subGroupName);
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
      await chartOfAccountsApi.deleteSubGroup(item.id);
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

  const handleSaveControlAccount = async () => {
    const controlAccountName = String(addControlAccountName || "").trim();
    if (!controlAccountName) {
      alert("Enter a control account name.");
      return;
    }
    try {
      await chartOfAccountsApi.createControlAccount(controlAccountName);
      await fetchControlAccounts();
      handleFormChange("controlAccount", controlAccountName);
      setAddControlAccountOpen(false);
      setAddControlAccountName("");
    } catch (error) {
      alert(error?.message || "Failed to add control account.");
    }
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
    const list = sortCoaRows((chartOfAccountsApi.unwrapList(response) || []).map(normalizeCoaRow));
    setTableRows(list);
  }, []);

  const handleMoveRow = useCallback(
    async (id, direction) => {
      if (!canEdit || reorderingId != null || formDialogOpen) return;

      const orderedRows = sortCoaRows(tableRows);
      const currentIndex = orderedRows.findIndex((row) => row.id === id);
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedRows.length) return;

      setReorderingId(id);
      try {
        const response = await chartOfAccountsApi.reorder(id, direction, COA_SECTION_TYPE);
        applyRowsFromApi(response);
      } catch (error) {
        console.error("Error reordering chart of account:", error);
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

  const orderedTableRows = useMemo(() => sortCoaRows(tableRows), [tableRows]);

  const duplicateAcctRowIds = useMemo(
    () => getDuplicateAcctRowIds(orderedTableRows),
    [orderedTableRows]
  );

  const columns = useMemo(
    () => [
      {
        Header: "Sort",
        accessor: "sortOrderControls",
        align: "right",
        width: "36px",
        disableFilters: true,
      },
      { Header: "Actions", accessor: "actions", align: "center", width: "9%" },
      ...(SHOW_ATTACHMENTS
        ? [{ Header: "Attach", accessor: "attachments", align: "center", width: "5%" }]
        : []),
      { Header: "Acct ID - Acct Name", accessor: "account", align: "left", width: "28%" },
      { Header: "Group", accessor: "groupName", align: "left", width: "14%" },
      {
        Header: (
          <MDBox component="span" sx={{ whiteSpace: "nowrap !important" }}>
            Sub Group
          </MDBox>
        ),
        accessor: "subGroup",
        align: "left",
        width: "17%",
      },
      { Header: "Control Account", accessor: "controlAccount", align: "left", width: "26%" },
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
          ...(duplicateAcctRowIds.has(row.id) ? { __rowStyle: DUPLICATE_ACCT_ROW_STYLE } : {}),
          sortOrderControls: (
            <MDBox sx={coaSortControlsSx}>
              <Tooltip title="Move up">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => handleMoveRow(row.id, "up")}
                    disabled={!canEdit || !canMoveUp || formDialogOpen || reorderingId != null}
                    sx={GRID_DARK_ARROW_ICON_SX}
                  >
                    {isReordering ? (
                      <CurrencyLoading size={12} />
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
                    onClick={() => handleMoveRow(row.id, "down")}
                    disabled={!canEdit || !canMoveDown || formDialogOpen || reorderingId != null}
                    sx={GRID_DARK_ARROW_ICON_SX}
                  >
                    <Icon fontSize="small">keyboard_arrow_down</Icon>
                  </IconButton>
                </span>
              </Tooltip>
            </MDBox>
          ),
          account: displayAccountCell(row),
          groupName: displayCell(row.groupName),
          subGroup: displayCell(row.subGroup),
          controlAccount: displayCell(row.controlAccount),
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
            <MDBox sx={coaActionControlsSx}>
              {canCreate && (
                <IconButton
                  size="small"
                  className="coa-grid-action-icon"
                  onClick={() => handleClone(row.id)}
                  title="Clone"
                  disabled={formDialogOpen}
                  sx={coaCloneIconButtonSx}
                >
                  <Icon fontSize="small" sx={coaCloneIconSx}>
                    content_copy
                  </Icon>
                </IconButton>
              )}
              <IconButton
                size="small"
                className="coa-grid-action-icon"
                onClick={() => handleEdit(row.id)}
                title="Edit"
                disabled={!canEdit || formDialogOpen}
                sx={coaEditIconButtonSx}
              >
                <Icon fontSize="small" sx={coaEditIconSx}>
                  edit
                </Icon>
              </IconButton>
              <IconButton
                size="small"
                className="coa-grid-action-icon"
                onClick={() => handleDelete(row.id)}
                title="Delete"
                disabled={!canDelete || formDialogOpen}
                sx={coaDeleteIconButtonSx}
              >
                <Icon fontSize="small" sx={coaDeleteIconSx}>
                  delete
                </Icon>
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
    <MDBox sx={{ ...coaPanelInnerSx, ...coaPanelTableBodySx }}>
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
          exportFileName="Chart-of-Accounts"
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
          {formMode === "create" ? "New Chart of Account" : "Edit Chart of Account"}
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
                  {(COA_GROUP_OPTIONS || []).map((option) => (
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
            <Grid item xs={12}>
              <FormControl size="small" fullWidth>
                <InputLabel sx={inputSx}>Control Account</InputLabel>
                <SearchableSelect
                  value={formDraft?.controlAccount || ""}
                  label="Control Account"
                  onChange={(e) => {
                    if (e.target.value === "__add__") {
                      setAddControlAccountName("");
                      setAddControlAccountOpen(true);
                      return;
                    }
                    handleFormChange("controlAccount", e.target.value);
                  }}
                  sx={inputSx}
                >
                  <MenuItem value="">
                    <em>None</em>
                  </MenuItem>
                  {(controlAccountOptions || []).map((item) => (
                    <MenuItem
                      key={item.id || item.controlAccountName}
                      value={item.controlAccountName}
                    >
                      {item.controlAccountName}
                    </MenuItem>
                  ))}
                  <MenuItem value="__add__" sx={{ fontStyle: "italic", color: "info.main" }}>
                    + Add control account...
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
            Are you sure you want to delete this chart of account record?
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

      <Dialog
        open={addControlAccountOpen}
        onClose={() => setAddControlAccountOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Add Control Account</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Control Account name"
            fullWidth
            value={addControlAccountName}
            onChange={(e) => setAddControlAccountName(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <MDButton color="secondary" onClick={() => setAddControlAccountOpen(false)}>
            Cancel
          </MDButton>
          <MDButton color="info" onClick={handleSaveControlAccount}>
            Add
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

ChartOfAccountsPanel.propTypes = {
  panelTitle: PropTypes.string,
};

function ChartOfAccounts() {
  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Chart of Accounts"
        subtitle={`${COA_SECTION_TYPE} & Income Statement`}
        tabs={<ConfigurationModuleTabs />}
        pageClassName="coa-split-workspace-page"
        sx={coaWorkspaceSx}
        bodySx={coaSplitBodySx}
      >
        <MDBox sx={coaPanelColumnSx}>
          <ChartOfAccountsPanel panelTitle="Balance Sheet" />
        </MDBox>
        <MDBox
          sx={{
            ...coaPanelColumnSx,
            pl: 0,
            borderLeft: "none",
            pt: { xs: 2, md: 0 },
          }}
        >
          <IncomeStatementPanel panelTitle="Income Statement" />
        </MDBox>
      </EnterpriseWorkspace>
    </DashboardLayout>
  );
}

export default ChartOfAccounts;
