import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import { useEffect, useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import StatusBadge from "components/StatusBadge";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DataTable from "examples/Tables/DataTable";
import { compactActionSnoColumnsSx } from "utils/compactActionSnoColumnsSx";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import api, { isSuperuserUser } from "../../../services/api.service";
import { useMaterialUIController } from "context";

function UserRole() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [tableRows, setTableRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const canMutateRoles = isSuperuserUser();
  const canCreate = canMutateRoles;
  const canEdit = canMutateRoles;
  const canDelete = canMutateRoles;

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const data = await api.list("Role");
      const arr = Array.isArray(data) ? data : data && data.items ? data.items : [];
      setTableRows(arr);
    } catch (e) {
      console.error("Failed to load roles", e);
    } finally {
      setLoading(false);
    }
  };

  const validateNew = () => {
    const errs = {};
    if (!newRowDraft?.roleName || !newRowDraft.roleName.trim()) {
      errs.roleName = "Role Name is required";
    }
    if (!newRowDraft?.description || !String(newRowDraft.description).trim()) {
      errs.description = "Description is required";
    }
    if (
      newRowDraft?.status === "" ||
      newRowDraft?.status === null ||
      newRowDraft?.status === undefined
    ) {
      errs.status = "Status is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  useEffect(() => {
    fetchRoles();
  }, []);

  const handleAddUser = () => {
    if (!canCreate) return;
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      id: 0,
      roleName: "",
      description: "",
      status: "",
    });
    setErrors({});
  };

  const handleEditRole = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({ ...row });
  };

  const handleChange = (field, value) => {
    const nextValue = field === "status" ? Number(value) : value;
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: nextValue }));
      if (field === "roleName") {
        const msg = nextValue && String(nextValue).trim() ? null : "Role Name is required";
        setErrors((prev) => ({ ...prev, roleName: msg }));
      }
      if (field === "description") {
        const msg = nextValue && String(nextValue).trim() ? null : "Description is required";
        setErrors((prev) => ({ ...prev, description: msg }));
      }
      if (field === "status") {
        const msg =
          nextValue !== "" && nextValue !== null && nextValue !== undefined
            ? null
            : "Status is required";
        setErrors((prev) => ({ ...prev, status: msg }));
      }
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: nextValue }));
    }
  };

  const handleSave = async () => {
    try {
      if (editingRowId === "__new__" && newRowDraft) {
        if (!canCreate) return;
        if (!validateNew()) return;
        const payload = {
          ...newRowDraft,
          status:
            typeof newRowDraft.status === "string"
              ? Number(newRowDraft.status)
              : newRowDraft.status,
        };
        await api.create("Role", payload);
        await fetchRoles();
        setEditingRowId(null);
        setNewRowDraft(null);
      } else if (editingRowId && editDraft) {
        if (!canEdit) return;
        const payload = {
          ...editDraft,
          status:
            typeof editDraft.status === "string" ? Number(editDraft.status) : editDraft.status,
        };
        await api.update("Role", editDraft.id, payload);
        await fetchRoles();
        setEditingRowId(null);
        setEditDraft(null);
      }
    } catch (e) {
      console.error("Save failed", e);
    }
  };

  const handleDeleteRole = async (id) => {
    if (!canDelete) return;
    try {
      await api.remove("Role", id);
      await fetchRoles();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const confirmDelete = async (id) => {
    if (!canDelete) return;
    const ok = window.confirm("Are you sure you want to delete this role?");
    if (!ok) return;
    await handleDeleteRole(id);
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const dataColumns = [
    { Header: "Id", accessor: "id", align: "left", width: "60px" },
    { Header: "Role Name", accessor: "roleName", align: "left", width: "150px" },
    { Header: "Description", accessor: "description", align: "left", minWidth: "200px" },
    { Header: "Status", accessor: "status", align: "center", width: "100px" },
  ];
  const columns = canMutateRoles
    ? [{ Header: "Actions", accessor: "actions", align: "center", width: "56px" }, ...dataColumns]
    : dataColumns;

  const renderStatusBadge = (status) => {
    return (
      <MDBox ml={-1}>
        <StatusBadge value={status} />
      </MDBox>
    );
  };

  const renderInput = (field, value) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required={editingRowId === "__new__" && (field === "roleName" || field === "description")}
      error={
        editingRowId === "__new__" &&
        ((field === "roleName" && Boolean(errors?.roleName)) ||
          (field === "description" && Boolean(errors?.description)))
      }
      helperText={
        editingRowId === "__new__" && field === "roleName"
          ? errors?.roleName
          : editingRowId === "__new__" && field === "description"
          ? errors?.description
          : undefined
      }
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

  const renderStatusSelect = (field, value) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required={editingRowId === "__new__"}
      error={editingRowId === "__new__" && Boolean(errors?.status)}
      helperText={editingRowId === "__new__" ? errors?.status : undefined}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
          ...(darkMode ? { color: "#000000 !important" } : {}),
        },
        ...(darkMode
          ? {
              "& .MuiFormHelperText-root": {
                color: "#000000 !important",
              },
              "& .MuiSvgIcon-root": {
                color: "#000000 !important",
              },
            }
          : {}),
      }}
    >
      <MenuItem value={1}>Active</MenuItem>
      <MenuItem value={0}>Inactive</MenuItem>
    </MDInput>
  );

  const computedRows = (() => {
    const rows = [];

    if (editingRowId === "__new__" && newRowDraft && canMutateRoles) {
      rows.push({
        id: newRowDraft.id,
        roleName: renderInput("roleName", newRowDraft.roleName),
        description: renderInput("description", newRowDraft.description),
        status: renderStatusSelect("status", newRowDraft.status),
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

    tableRows.forEach((r) => {
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      const baseRow = {
        id: r.id,
        roleName: isEditing ? (
          renderInput("roleName", draft.roleName)
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
            {r.roleName}
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
        status: isEditing
          ? renderStatusSelect("status", draft.status)
          : renderStatusBadge(r.status),
      };
      if (canMutateRoles) {
        baseRow.actions = isEditing ? (
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
              backgroundColor: "#f8f9fa",
              gap: "2px",
              padding: "2px 2px",
              borderRadius: "2px",
            }}
          >
            {canEdit && (
              <IconButton
                size="small"
                color="info"
                onClick={() => handleEditRole(r.id)}
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
                onClick={() => confirmDelete(r.id)}
                title="Delete"
                sx={{ padding: "1px" }}
              >
                <Icon>delete</Icon>
              </IconButton>
            )}
          </MDBox>
        );
      }
      rows.push(baseRow);
    });

    return rows;
  })();

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="User Roles"
        subtitle="Manage user role configuration"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreate ? (
            <MDButton variant="outlined" color="dark" onClick={handleAddUser}>
              Add Roles
            </MDButton>
          ) : null
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "hidden",
          },
          flex: "1 1 0",
          minHeight: 0,
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
            padding: "4px 4px !important",
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            borderBottom: "1px solid #d0d0d0",
          },
          "& .MuiTable-root td": {
            padding: "10px 10px !important",
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
          table={{ columns, rows: computedRows }}
          isSorted={false}
          stickyToolbarAndHeader
          canSearch
          page={pageIndex}
          pageSize={pageSize}
          entriesPerPage={{ defaultValue: 20, entries: [5, 10, 15, 20, 25] }}
          onPageChange={(page) => setPageIndex(page)}
          onEntriesPerPageChange={(value) => {
            setPageSize(value);
            setPageIndex(0);
          }}
          showTotalEntries
          exportFileName="User-Roles"
          noEndBorder
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>
    </DashboardLayout>
  );
}

export default UserRole;
