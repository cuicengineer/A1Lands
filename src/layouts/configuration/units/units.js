import { useEffect, useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import StatusBadge from "components/StatusBadge";
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DataTable from "examples/Tables/DataTable";
import { gridValueChipCell } from "utils/gridValueChipCell";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "../../../services/api.service"; // Assuming api service is available
import { useMaterialUIController } from "context";

function UnitsConfig() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [tableRows, setTableRows] = useState([]);
  const [commandOptions, setCommandOptions] = useState([]);
  const [allBaseOptions, setAllBaseOptions] = useState([]);
  const [filteredBaseOptions, setFilteredBaseOptions] = useState([]);
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
        const [unitData, commandData, baseData] = await Promise.all([
          api.list("Units"),
          api.list("Command"),
          api.list("Base"),
        ]);
        if (!mounted) return;

        const unitArr = Array.isArray(unitData) ? unitData : unitData?.items || [];
        const commandArr = Array.isArray(commandData) ? commandData : commandData?.items || [];
        const baseArr = Array.isArray(baseData) ? baseData : baseData?.items || [];

        setTableRows(unitArr);
        const mappedCommandOptions = commandArr.map((cmd) => ({ id: cmd.id, name: cmd.name }));
        setCommandOptions(mappedCommandOptions);
        console.log("commandArr fetched:", commandArr); // Log the raw data
        console.log("mappedCommandOptions set:", mappedCommandOptions); // Log the mapped options
        setAllBaseOptions(
          baseArr.map((base) => ({ id: base.id, name: base.name, cmdId: base.cmd }))
        );
        if (commandArr.length > 0) {
          setFilteredBaseOptions(
            baseArr
              .filter((base) => base.cmd === commandArr[0]?.id)
              .map((base) => ({ id: base.id, name: base.name, cmdId: base.cmd }))
          );
        } else {
          setFilteredBaseOptions([]);
        }
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

  // Add a separate useEffect to log commandOptions after it's updated
  useEffect(() => {
    console.log("commandOptions state updated:", commandOptions);
  }, [commandOptions]);

  const validateNew = () => {
    const errs = {};
    if (!newRowDraft?.name || !String(newRowDraft.name).trim()) errs.name = "Name is required";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAddUnit = () => {
    if (!canCreate) return;
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      id: 0,
      name: "",
      cmd: commandOptions.length > 0 ? commandOptions[0]?.id : "",
      base:
        commandOptions.length > 0 && commandOptions[0]?.id
          ? allBaseOptions.filter((base) => base.cmdId === commandOptions[0]?.id)[0]?.id || ""
          : "",
      status: 0,
    });
    setErrors({});
  };

  const handleEditUnit = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({ ...row });
    setFilteredBaseOptions(allBaseOptions.filter((base) => base.cmdId === row.cmd));
  };

  const handleChange = (field, value) => {
    const nextValue = field === "status" ? Number(value) : value;
    let finalValue = nextValue;
    if (field === "cmd") {
      const basesForCmd = allBaseOptions.filter((base) => base.cmdId === value);
      setFilteredBaseOptions(basesForCmd);
      if (editingRowId === "__new__") {
        setNewRowDraft((draft) => ({
          ...draft,
          cmd: value,
          base: basesForCmd.length > 0 ? basesForCmd[0].id : "",
        }));
      } else if (editingRowId) {
        setEditDraft((draft) => ({
          ...draft,
          cmd: value,
          base: basesForCmd.length > 0 ? basesForCmd[0].id : "",
        }));
      }
      return;
    } else if (field === "base") {
      finalValue = value;
    }

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
          Base: newRowDraft.base,
          Status: newRowDraft.status,
        };
        const created = await api.create("Units", payload);
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
          Base: editDraft.base,
          Status: editDraft.status,
        };
        const updated = await api.update("Units", editDraft.id, payload);
        setTableRows((prev) => prev.map((r) => (r.id === editDraft.id ? updated || payload : r)));
        setEditingRowId(null);
        setEditDraft(null);
        setRefreshTrigger((prev) => prev + 1);
      }
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
    setErrors({});
  };

  const handleDeleteUnit = async (id) => {
    if (!canDelete) return;
    try {
      await api.remove("Units", id);
      setTableRows((prev) => prev.filter((row) => row.id !== id));
      setRefreshTrigger((prev) => prev + 1);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const confirmDelete = async (id) => {
    if (!canDelete) return;
    const ok = window.confirm("Are you sure you want to delete this unit?");
    if (!ok) return;
    await handleDeleteUnit(id);
  };

  const columns = [
    { Header: "Id", accessor: "id", align: "left", width: "10%" },
    { Header: "Name", accessor: "name", align: "left" },
    { Header: "Cmd", accessor: "cmd", align: "left" },
    { Header: "Base", accessor: "base", align: "left", Cell: gridValueChipCell("base") },
    { Header: "Status", accessor: "status", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const renderStatusBadge = (status) => {
    return (
      <MDBox ml={-1}>
        <StatusBadge value={status} inactiveLabel="Not Active" inactiveColor="error" />
      </MDBox>
    );
  };

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

  const renderCommandSelect = (value) => {
    console.log("renderCommandSelect - commandOptions:", commandOptions); // Log options here
    console.log("renderCommandSelect - current value:", value); // Log current value
    return (
      <SearchableSelect
        value={value === null || value === undefined ? "" : value}
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
  };

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

  const renderBaseSelect = (value) => (
    <SearchableSelect
      value={value === null ? "" : value}
      onChange={(e) => handleChange("base", e.target.value)}
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
      {filteredBaseOptions.length > 0 ? (
        filteredBaseOptions.map((opt) => (
          <MenuItem key={opt.id} value={opt.id}>
            {opt.name}
          </MenuItem>
        ))
      ) : (
        <MenuItem value="">No Base Options</MenuItem>
      )}
    </SearchableSelect>
  );

  const computedRows = (() => {
    const rows = [];

    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: newRowDraft.id,
        name: renderInput("name", newRowDraft.name),
        cmd: renderCommandSelect(newRowDraft.cmd),
        base: renderBaseSelect(newRowDraft.base),
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
        id: r.id,
        name: isEditing ? renderInput("name", draft.name) : r.name,
        cmd: isEditing
          ? renderCommandSelect(draft.cmd)
          : commandOptions.find((opt) => opt.id === r.cmd)?.name || r.cmd,
        base: isEditing
          ? renderBaseSelect(draft.base)
          : allBaseOptions.find((opt) => opt.id === r.base)?.name || r.base,
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
                onClick={() => handleEditUnit(r.id)}
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
        title="Units"
        subtitle="Manage units configuration"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreate ? (
            <MDButton variant="outlined" color="dark" onClick={handleAddUnit}>
              Add Unit
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
          exportFileName="Units"
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>
    </DashboardLayout>
  );
}

export default UnitsConfig;
