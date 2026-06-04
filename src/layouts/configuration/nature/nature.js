import { useEffect, useState, useMemo } from "react";

// @mui material components
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DataTable from "examples/Tables/DataTable";
import { compactActionSnoColumnsSx } from "utils/compactActionSnoColumnsSx";

import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import StatusBadge from "components/StatusBadge";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { useMaterialUIController } from "context";

function NatureConfig() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const statusOptions = [
    { value: 1, label: "Active" },
    { value: 0, label: "Not Active" },
  ];

  const [tableRows, setTableRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [newErrors, setNewErrors] = useState({});
  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();

  useEffect(() => {
    fetchNatures();
  }, []);

  const fetchNatures = async () => {
    setLoading(true);
    try {
      const response = await api.list("Nature");
      setTableRows(response);
    } catch (error) {
      console.error("Error fetching natures:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddNature = () => {
    if (!canCreate) return;
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewErrors({});
    setNewRowDraft({
      id: tableRows.length > 0 ? Math.max(...tableRows.map((r) => r.id)) + 1 : 1,
      name: "",
      description: "",
      status: statusOptions[0].value,
    });
  };

  const handleEditNature = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({ ...row });
  };

  const handleChange = (field, value) => {
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: value }));
      if (newErrors?.[field]) setNewErrors((prev) => ({ ...prev, [field]: undefined }));
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: value }));
    }
  };

  const isEmpty = (val) => {
    if (val === null || val === undefined) return true;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "string") return val.trim().length === 0;
    return false;
  };

  const validateNewRow = () => {
    const next = {};
    const required = [
      { key: "name", label: "Name" },
      { key: "description", label: "Description" },
      { key: "status", label: "Status" },
    ];
    required.forEach(({ key, label }) => {
      if (isEmpty(newRowDraft?.[key])) next[key] = `${label} is required`;
    });
    setNewErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (editingRowId === "__new__" && newRowDraft) {
      if (!canCreate) return;
      // Mandatory validation only for Create New (as requested)
      const ok = validateNewRow();
      if (!ok) return;
      try {
        const { id, ...createPayload } = newRowDraft;
        await api.create("Nature", createPayload);
        fetchNatures();
        setEditingRowId(null);
        setNewRowDraft(null);
      } catch (error) {
        console.error("Error creating nature:", error);
      }
    } else if (editingRowId && editDraft) {
      if (!canEdit) return;
      if (!editDraft.name) {
        alert("Name is mandatory.");
        return;
      }
      try {
        await api.update("Nature", editingRowId, editDraft);
        fetchNatures();
        setEditingRowId(null);
        setEditDraft(null);
      } catch (error) {
        console.error("Error updating nature:", error);
      }
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
    setNewErrors({});
  };

  const handleDeleteNature = (id) => {
    if (!canDelete) return;
    if (editingRowId) return;
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!canDelete) return;
    if (!recordToDelete) return;
    try {
      await api.remove("Nature", recordToDelete);
      fetchNatures();
    } catch (error) {
      console.error("Error deleting nature:", error);
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "56px" },
    { Header: "Id", accessor: "id", align: "left", width: "50px" },
    { Header: "Name", accessor: "name", align: "left", width: "150px" },
    { Header: "Description", accessor: "description", align: "left", minWidth: "200px" },
    { Header: "Status", accessor: "status", align: "center", width: "100px" },
  ];

  const renderInput = (field, value, type = "text", mandatory = false) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      type={type}
      required={mandatory}
      error={Boolean(newErrors[field])}
      helperText={newErrors[field]}
      sx={
        darkMode
          ? {
              "& .MuiInputBase-input": {
                color: "#000000 !important",
              },
              "& .MuiInputLabel-root": {
                color: "#000000 !important",
              },
              "& .MuiFormHelperText-root": {
                color: "#000000 !important",
              },
            }
          : {}
      }
    />
  );

  const renderStatusSelect = (value, mandatory = false) => (
    <FormControl size="small" fullWidth required={mandatory} error={Boolean(newErrors.status)}>
      <InputLabel id="nature-status-label" sx={darkMode ? { color: "#000000 !important" } : {}}>
        Status
      </InputLabel>
      <Select
        labelId="nature-status-label"
        value={value}
        label="Status"
        onChange={(e) => handleChange("status", e.target.value)}
        sx={
          darkMode
            ? {
                "& .MuiSelect-select": {
                  color: "#000000 !important",
                },
                "& .MuiSvgIcon-root": {
                  color: "#000000 !important",
                },
              }
            : {}
        }
      >
        {statusOptions.map((opt) => (
          <MenuItem key={opt.value} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {newErrors.status && (
        <FormHelperText sx={darkMode ? { color: "#000000 !important" } : {}}>
          {newErrors.status}
        </FormHelperText>
      )}
    </FormControl>
  );

  const computedRows = useMemo(() => {
    const filteredRows = tableRows.filter((row) =>
      Object.values(row || {}).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

    const rows = [];
    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: newRowDraft.id,
        name: renderInput("name", newRowDraft.name, "text", true),
        description: renderInput("description", newRowDraft.description, "text", true),
        status: renderStatusSelect(newRowDraft.status, true),
        actions: (
          <MDBox display="flex" gap={1}>
            <IconButton size="small" color="success" onClick={handleSave} title="Save">
              <Icon>check</Icon>
            </IconButton>
            <IconButton size="small" color="error" onClick={handleCancel} title="Cancel">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        ),
      });
    }

    filteredRows.forEach((r) => {
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      rows.push({
        id: r.id,
        name: isEditing ? (
          renderInput("name", draft.name, "text", true)
        ) : (
          <MDBox
            component="span"
            sx={{
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {r.name}
          </MDBox>
        ),
        description: isEditing ? (
          renderInput("description", draft.description)
        ) : (
          <MDBox
            component="span"
            sx={{
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {r.description}
          </MDBox>
        ),
        status: isEditing ? (
          renderStatusSelect(draft.status)
        ) : (
          <StatusBadge value={r.status} inactiveLabel="Not Active" inactiveColor="error" />
        ),
        actions: isEditing ? (
          <MDBox display="flex" gap={1}>
            <IconButton size="small" color="success" onClick={handleSave} title="Save">
              <Icon>check</Icon>
            </IconButton>
            <IconButton size="small" color="error" onClick={handleCancel} title="Cancel">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        ) : (
          <MDBox
            alignItems="left"
            justifyContent="left"
            sx={{
              backgroundColor: "#f8f9fa", // Light grey background
              gap: "2px", // Manually set small gap between icons
              padding: "2px 2px", // Adds some internal padding
              borderRadius: "2px", // Optional: softens the box edges
            }}
          >
            {canEdit && (
              <IconButton
                size="small"
                color="info"
                onClick={() => handleEditNature(r.id)}
                title="Edit"
                sx={{ padding: "1px" }}
              >
                <Icon>edit</Icon>
              </IconButton>
            )}
            {canDelete && (
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteNature(r.id)}
                title="Delete"
                sx={{ padding: "1px" }}
              >
                <Icon>delete</Icon>
              </IconButton>
            )}
          </MDBox>
        ),
      });
    });

    return rows;
  }, [tableRows, searchQuery, editingRowId, editDraft, newRowDraft]);

  // Memoize the table object to prevent DataTable from resetting pagination
  // This is lightweight - just stores a reference to columns and computedRows
  const tableData = useMemo(() => ({ columns, rows: computedRows }), [columns, computedRows]);

  // Create a stable key based on the actual data (not editing state)
  // This prevents DataTable remounting when only editing state changes
  // Very lightweight - just a string concatenation
  const tableKey = useMemo(
    () => `nature-table-${tableRows.length}-${tableRows.map((r) => r.id).join("-")}`,
    [tableRows]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Nature"
        subtitle="Manage nature configuration"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreate ? (
            <MDButton variant="outlined" color="dark" onClick={handleAddNature}>
              Add Nature
            </MDButton>
          ) : null
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          flex: "1 1 0",
          minHeight: 0,
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "hidden",
          },
          "& .MuiTable-root": {
            tableLayout: "auto",
            width: "auto",
            minWidth: "100%",
          },
          "& .MuiTableCell-root": {
            whiteSpace: "normal !important",
            wordBreak: "break-word !important",
            overflowWrap: "anywhere !important",
            lineHeight: 1.4,
            maxWidth: "100%",
            verticalAlign: "top",
          },
          "& .MuiTableCell-root *": {
            whiteSpace: "normal !important",
            wordBreak: "break-word !important",
            overflowWrap: "anywhere !important",
            maxWidth: "100%",
          },
          "& .MuiTable-root th": {
            fontSize: "1rem !important",
            fontWeight: "700 !important",
            padding: "8px 6px !important",
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            borderBottom: "1px solid #d0d0d0",
          },
          "& .MuiTable-root td": {
            padding: "8px 6px !important",
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            hyphens: "auto",
            maxWidth: "100%",
            borderBottom: "1px solid #e0e0e0",
          },
          "& .MuiTable-root td > div": {
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          },
          "& .MuiTable-root td *": {
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
          },
          ...compactActionSnoColumnsSx,
        }}
      >
        <DataTable
          table={tableData}
          isSorted={false}
          stickyToolbarAndHeader
          canSearch={true}
          page={pageIndex}
          entriesPerPage={{
            defaultValue: 20,
            entries: [5, 10, 15, 20, 25],
          }}
          pageSize={pageSize}
          onPageChange={(page) => setPageIndex(page)}
          onEntriesPerPageChange={(value) => {
            setPageSize(value);
            setPageIndex(0);
          }}
          showTotalEntries
          exportFileName="Nature"
          noEndBorder
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1" sx={{ fontSize: "1.1rem" }}>
            Are you sure you want to delete this nature? This action cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary" variant="outlined">
            <Icon>close</Icon>&nbsp;Cancel
          </MDButton>
          <MDButton
            onClick={handleConfirmDelete}
            color="error"
            variant="gradient"
            disabled={!canDelete}
          >
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default NatureConfig;
