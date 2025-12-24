import Card from "@mui/material/Card";
import MenuItem from "@mui/material/MenuItem";
import { useEffect, useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDInput from "components/MDInput";
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
  const validateNew = () => {
    const errs = {};
    if (!newRowDraft?.roleName || !newRowDraft.roleName.trim()) {
      errs.roleName = "Role Name is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.list("Role");
        if (!mounted) return;
        const arr = Array.isArray(data) ? data : data && data.items ? data.items : [];
        setTableRows(arr);
      } catch (e) {
        console.error("Failed to load roles", e);
      }
    })();
    return () => {
      mounted = false;
    };
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
        const created = await api.create("Role", payload);
        setTableRows((prev) => [created || payload, ...prev]);
        setEditingRowId(null);
        setNewRowDraft(null);
      } else if (editingRowId && editDraft) {
        const payload = {
          ...editDraft,
          status:
            typeof editDraft.status === "string" ? Number(editDraft.status) : editDraft.status,
        };
        const updated = await api.update("Role", editDraft.id, payload);
        setTableRows((prev) => prev.map((r) => (r.id === editDraft.id ? updated || payload : r)));
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
      setTableRows((prev) => prev.filter((row) => row.id !== id));
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
    { Header: "Id", accessor: "id", align: "left", width: "8%" },
    { Header: "Role Name", accessor: "roleName", align: "left", width: "18%" },
    { Header: "Description", accessor: "description", align: "left" },
    { Header: "Status", accessor: "status", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const renderStatusBadge = (status) => {
    const label =
      status === 1 ||
      status === "1" ||
      (typeof status === "string" && status.toLowerCase() === "active")
        ? "Active"
        : "DeActive";
    return (
      <MDBox ml={-1}>
        <MDBadge
          badgeContent={label}
          color={label === "Active" ? "success" : "dark"}
          variant="gradient"
          size="sm"
        />
      </MDBox>
    );
  };

  const renderInput = (field, value) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required={editingRowId === "__new__" && field === "roleName"}
      error={editingRowId === "__new__" && field === "roleName" && Boolean(errors?.roleName)}
      helperText={editingRowId === "__new__" && field === "roleName" ? errors?.roleName : undefined}
    />
  );

  const renderStatusSelect = (field, value) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
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
        roleName: isEditing ? renderInput("roleName", draft.roleName) : r.roleName,
        description: isEditing ? renderInput("description", draft.description) : r.description,
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
            <MDButton
              variant="outlined"
              color="info"
              size="small"
              onClick={() => handleEditRole(r.id)}
            >
              Edit
            </MDButton>
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => confirmDelete(r.id)}
            >
              Delete
            </MDButton>
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
          <MDBox pt={1} sx={{ "& .MuiTableCell-root": { padding: "6px 8px" } }}>
            <DataTable
              table={{ columns, rows: computedRows }}
              isSorted={false}
              canSearch={true}
              entriesPerPage={{ defaultValue: 5, entries: [5, 10, 15, 20, 25] }}
              showTotalEntries={true}
              noEndBorder
            />
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default UserRole;
