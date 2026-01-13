import Card from "@mui/material/Card";
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
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import api from "../../../services/api.service";

function UserRole() {
  const [tableRows, setTableRows] = useState([]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [errors, setErrors] = useState({});
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  const fetchRoles = async () => {
    try {
      const data = await api.list("Role");
      const arr = Array.isArray(data) ? data : data && data.items ? data.items : [];
      setTableRows(arr);
    } catch (e) {
      console.error("Failed to load roles", e);
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
    try {
      await api.remove("Role", id);
      await fetchRoles();
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const confirmDelete = async (id) => {
    const ok = window.confirm("Are you sure you want to delete this role?");
    if (!ok) return;
    await handleDeleteRole(id);
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "8%" },
    { Header: "Id", accessor: "id", align: "left", width: "6%" },
    { Header: "Role Name", accessor: "roleName", align: "left", width: "20%" },
    { Header: "Description", accessor: "description", align: "left", width: "28%" },
    { Header: "Status", accessor: "status", align: "center", width: "10%" },
  ];

  const renderStatusBadge = (status) => {
    return (
      <MDBox ml={-1}>
        <StatusBadge value={status} inactiveLabel="DeActive" inactiveColor="error" />
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
          minHeight: "45px",
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      <MenuItem value={1}>Active</MenuItem>
      <MenuItem value={0}>Not Active</MenuItem>
    </MDInput>
  );

  const computedRows = (() => {
    const rows = [];

    if (editingRowId === "__new__" && newRowDraft) {
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
      rows.push({
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
              backgroundColor: "#f8f9fa",
              gap: "2px",
              padding: "2px 2px",
              borderRadius: "2px",
            }}
          >
            <IconButton
              size="small"
              color="info"
              onClick={() => handleEditRole(r.id)}
              title="Edit"
              sx={{ padding: "1px" }}
            >
              <Icon>edit</Icon>
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => confirmDelete(r.id)}
              title="Delete"
              sx={{ padding: "1px" }}
            >
              <Icon>delete</Icon>
            </IconButton>
          </MDBox>
        ),
      });
    });

    return rows;
  })();

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Card>
          <MDBox
            mx={2}
            mt={-3}
            py={3}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <MDTypography variant="h6" color="white">
              User Roles
            </MDTypography>
            <MDButton variant="gradient" color="info" onClick={handleAddUser}>
              Add Roles
            </MDButton>
          </MDBox>
          <MDBox pt={3}>
            <MDBox
              sx={{
                overflowX: "auto",
                "& .MuiTable-root": {
                  tableLayout: "fixed",
                  width: "100%",
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
                  fontSize: "1.15rem !important",
                  fontWeight: "700 !important",
                  padding: "12px 10px !important",
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
                "& .MuiTable-root th:nth-of-type(3), & .MuiTable-root td:nth-of-type(3)": {
                  maxWidth: "240px",
                  width: "20%",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  lineHeight: 1.4,
                },
                "& .MuiTable-root td:nth-of-type(3) > *": {
                  display: "block",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  maxWidth: "100%",
                },
                "& .MuiTable-root th:nth-of-type(4), & .MuiTable-root td:nth-of-type(4)": {
                  maxWidth: "240px",
                  width: "20%",
                  whiteSpace: "normal !important",
                  wordBreak: "break-word !important",
                  overflowWrap: "anywhere !important",
                  lineHeight: 1.4,
                },
              }}
            >
              <DataTable
                table={{ columns, rows: computedRows }}
                isSorted={false}
                canSearch
                page={pageIndex}
                entriesPerPage={{ defaultValue: pageSize, entries: [5, 10, 15, 20, 25] }}
                onPageChange={(page) => setPageIndex(page)}
                onEntriesPerPageChange={(value) => {
                  setPageSize(value);
                  setPageIndex(0);
                }}
                showTotalEntries
                noEndBorder
              />
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default UserRole;
