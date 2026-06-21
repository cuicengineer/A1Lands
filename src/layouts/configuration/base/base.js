import { useEffect, useState } from "react";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "../../../services/api.service";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import StatusBadge from "components/StatusBadge";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import { useMaterialUIController } from "context";

function Base() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [tableRows, setTableRows] = useState([]);
  const [commandOptions, setCommandOptions] = useState([]);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const [baseData, commandData] = await Promise.all([api.list("Base"), api.list("Command")]);
        if (!mounted) return;

        const baseArr = Array.isArray(baseData) ? baseData : baseData?.items || [];
        const commandArr = Array.isArray(commandData) ? commandData : commandData?.items || [];

        setTableRows(baseArr);
        setCommandOptions(commandArr.map((cmd) => ({ id: cmd.id, name: cmd.name })));
      } catch (e) {
        console.error("Failed to load data", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  const validateNew = () => {
    const errs = {};
    if (!newRowDraft?.name || !String(newRowDraft.name).trim()) errs.name = "Name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddBase = () => {
    if (!canCreate) return;
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({ id: 0, name: "", cmd: commandOptions[0]?.id, status: 0 });
    setErrors({});
  };

  const handleEditBase = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({ ...row });
  };

  const handleChange = (field, value) => {
    const nextValue = field === "status" ? Number(value) : value;
    const finalValue = field === "cmd" ? value : nextValue;
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: finalValue }));
      if (field === "name") {
        const msg = finalValue && String(finalValue).trim() ? null : "Name is required";
        setErrors((prev) => ({ ...prev, name: msg }));
      }
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: finalValue }));
    }
  };

  const handleSave = async () => {
    try {
      if (editingRowId === "__new__" && newRowDraft) {
        if (!canCreate) return;
        if (!validateNew()) return;
        const payload = {
          Id: newRowDraft.id,
          Name: newRowDraft.name,
          Cmd: newRowDraft.cmd,
          Status: newRowDraft.status,
        };
        const created = await api.create("Base", payload);
        setTableRows((prev) => [created || payload, ...prev]);
        setEditingRowId(null);
        setNewRowDraft(null);
        setRefreshTrigger((prev) => prev + 1);
      } else if (editingRowId && editDraft) {
        if (!canEdit) return;
        const payload = {
          Id: editDraft.id,
          Name: editDraft.name,
          Cmd: editDraft.cmd,
          Status: editDraft.status,
        };
        const updated = await api.update("Base", editDraft.id, payload);
        setTableRows((prev) => prev.map((r) => (r.id === editDraft.id ? updated || payload : r)));
        setEditingRowId(null);
        setEditDraft(null);
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const handleDeleteBase = async (id) => {
    if (!canDelete) return;
    try {
      await api.remove("Base", id);
      setTableRows((prev) => prev.filter((row) => row.id !== id));
      setRefreshTrigger((prev) => prev + 1);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const confirmDelete = async (id) => {
    if (!canDelete) return;
    const ok = window.confirm("Are you sure you want to delete this base?");
    if (!ok) return;
    await handleDeleteBase(id);
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
    setErrors({});
  };

  const columns = [
    { Header: "Id", accessor: "id", align: "left", width: "10%" },
    { Header: "Name", accessor: "name", align: "left" },
    { Header: "Cmd", accessor: "cmd", align: "left" },
    { Header: "Status", accessor: "status", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const renderInput = (field, value) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required={editingRowId === "__new__" && field === "name"}
      error={editingRowId === "__new__" && field === "name" && Boolean(errors?.name)}
      helperText={editingRowId === "__new__" && field === "name" ? errors?.name : undefined}
      inputProps={field === "id" ? { readOnly: true } : {}}
      sx={{
        ...(field === "id" ? { width: "50%" } : {}),
        ...(darkMode
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
          : {}),
      }}
    />
  );

  const renderCommandSelect = (value) => (
    <SearchableSelect
      value={value}
      onChange={(e) => handleChange("cmd", e.target.value)}
      size="small"
      fullWidth
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
      {commandOptions.map((opt) => (
        <MenuItem key={opt.id} value={opt.id}>
          {opt.name}
        </MenuItem>
      ))}
    </SearchableSelect>
  );

  const renderStatusSelect = (field, value) => (
    <SearchableSelect
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
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
      <MenuItem value={1}>Active</MenuItem>
      <MenuItem value={0}>Not Active</MenuItem>
    </SearchableSelect>
  );

  const renderStatusBadge = (status) => {
    return (
      <MDBox ml={-1}>
        <StatusBadge value={status} inactiveLabel="Not Active" inactiveColor="error" />
      </MDBox>
    );
  };

  const computedRows = (() => {
    const rows = [];
    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: renderInput("id", newRowDraft.id),
        name: renderInput("name", newRowDraft.name),
        cmd: renderCommandSelect(newRowDraft.cmd),
        status: renderStatusSelect("status", newRowDraft.status),
        actions: (
          <MDBox display="flex" gap={1}>
            <MDButton variant="gradient" color="success" size="small" onClick={handleSave}>
              Save
            </MDButton>
            <MDButton variant="outlined" color="secondary" size="small" onClick={handleCancel}>
              Cancel
            </MDButton>
          </MDBox>
        ),
      });
    }

    tableRows.forEach((r) => {
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      rows.push({
        id: isEditing ? renderInput("id", draft.id) : r.id,
        name: isEditing ? renderInput("name", draft.name) : r.name,
        cmd: isEditing
          ? renderCommandSelect(draft.cmd)
          : commandOptions.find((cmd) => cmd.id === r.cmd)?.name || r.cmd,
        status: isEditing
          ? renderStatusSelect("status", draft.status)
          : renderStatusBadge(r.status),
        actions: isEditing ? (
          <MDBox display="flex" gap={1}>
            <MDButton variant="gradient" color="success" size="small" onClick={handleSave}>
              Save
            </MDButton>

            <MDButton variant="outlined" color="secondary" size="small" onClick={handleCancel}>
              Cancel
            </MDButton>
          </MDBox>
        ) : (
          <MDBox display="flex" gap={1}>
            {canEdit && (
              <MDButton
                variant="outlined"
                color="info"
                size="small"
                onClick={() => handleEditBase(r.id)}
              >
                Edit
              </MDButton>
            )}
            {canDelete && (
              <MDButton
                variant="outlined"
                color="error"
                size="small"
                onClick={() => confirmDelete(r.id)}
              >
                Delete
              </MDButton>
            )}
          </MDBox>
        ),
      });
    });

    return rows;
  })();

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Base"
        subtitle="Manage base configuration records"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreate ? (
            <MDButton variant="outlined" color="dark" onClick={handleAddBase}>
              Add Base
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
        }}
      >
        <DataTable
          table={{ columns, rows: computedRows }}
          isSorted={false}
          stickyToolbarAndHeader
          canSearch={true}
          entriesPerPage={{ defaultValue: 20, entries: [5, 10, 15, 20, 25] }}
          showTotalEntries={true}
          noEndBorder
          exportFileName="Base"
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>
    </DashboardLayout>
  );
}

export default Base;
