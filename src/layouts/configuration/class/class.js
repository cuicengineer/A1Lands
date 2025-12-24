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
import MenuItem from "@mui/material/MenuItem";
import Card from "@mui/material/Card";

function ClassConfig() {
  const [tableRows, setTableRows] = useState([]);
  const [errors, setErrors] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(10);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const data = await api.list("Class");
        if (!mounted) return;
        const arr = Array.isArray(data) ? data : data && data.items ? data.items : [];
        setTableRows(arr);
      } catch (e) {
        console.error("Failed to load classes", e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [refreshTrigger]);

  const handleAddClass = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      id: 0,
      name: "",
      desc: "",
      status: 0,
    });
    setErrors({});
  };

  const handleEditClass = (id) => {
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
      if (field === "name") {
        const msg = nextValue && String(nextValue).trim() ? null : "Name is required";
        setErrors((prev) => ({ ...prev, name: msg }));
      }
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: nextValue }));
    }
  };

  const validateNew = () => {
    const errs = {};
    if (!newRowDraft?.name || !newRowDraft.name.trim()) {
      errs.name = "Name is required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    try {
      if (editingRowId === "__new__" && newRowDraft) {
        if (!validateNew()) return;
        const payload = {
          id: newRowDraft.id,
          name: newRowDraft.name,
          desc: newRowDraft.desc,
          status:
            typeof newRowDraft.status === "string"
              ? Number(newRowDraft.status)
              : newRowDraft.status,
        };
        const created = await api.create("Class", payload);
        setTableRows((prev) => [created || payload, ...prev]);
        setEditingRowId(null);
        setNewRowDraft(null);
        setRefreshTrigger((prev) => prev + 1);
      } else if (editingRowId && editDraft) {
        const payload = {
          id: editDraft.id,
          name: editDraft.name,
          desc: editDraft.desc,
          status:
            typeof editDraft.status === "string" ? Number(editDraft.status) : editDraft.status,
        };
        const updated = await api.update("Class", editDraft.id, payload);
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
  };

  const handleDeleteClass = async (id) => {
    try {
      await api.remove("Class", id);
      setTableRows((prev) => prev.filter((row) => row.id !== id));
      setRefreshTrigger((prev) => prev + 1);
    } catch (e) {
      console.error("Delete failed", e);
    }
  };

  const confirmDelete = async (id) => {
    const ok = window.confirm("Are you sure you want to delete this class?");
    if (!ok) return;
    await handleDeleteClass(id);
  };

  const columns = [
    { Header: "Id", accessor: "id", align: "left", width: "5%" },
    { Header: "Class Name", accessor: "name", align: "left" },
    { Header: "Description", accessor: "desc", align: "left" },
    { Header: "Status", accessor: "status", align: "center" },
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
      required={editingRowId === "__new__" && field === "name"}
      error={editingRowId === "__new__" && field === "name" && Boolean(errors?.name)}
      helperText={editingRowId === "__new__" && field === "name" ? errors?.name : undefined}
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
    const filteredRows = tableRows.filter((row) =>
      Object.values(row).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

    const paginatedRows = filteredRows.slice(page * pageSize, (page + 1) * pageSize);

    const rows = [];

    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: newRowDraft.id,
        name: renderInput("name", newRowDraft.name),
        desc: renderInput("desc", newRowDraft.desc),
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

    paginatedRows.forEach((row) => {
      const isEditing = editingRowId === row.id;
      const currentRow = isEditing ? editDraft : row;

      rows.push({
        id: isEditing ? renderInput("id", currentRow.id) : currentRow.id,
        name: isEditing ? renderInput("name", currentRow.name) : currentRow.name,
        desc: isEditing ? renderInput("desc", currentRow.desc) : currentRow.desc,
        status: isEditing
          ? renderStatusSelect("status", currentRow.status)
          : renderStatusBadge(currentRow.status),
        actions: (
          <MDBox display="flex" gap={1}>
            {isEditing ? (
              <>
                <MDButton variant="gradient" color="success" size="small" onClick={handleSave}>
                  Save
                </MDButton>
                <MDButton variant="outlined" color="secondary" size="small" onClick={handleCancel}>
                  Cancel
                </MDButton>
              </>
            ) : (
              <>
                <MDButton
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={() => handleEditClass(row.id)}
                >
                  Edit
                </MDButton>
                <MDButton
                  variant="outlined"
                  color="error"
                  size="small"
                  onClick={() => confirmDelete(row.id)}
                >
                  Delete
                </MDButton>
              </>
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
              Class
            </MDTypography>
            <MDBox display="flex" alignItems="center" gap={2}>
              <MDInput
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                size="small"
              />
              <MDButton variant="gradient" bgColor="dark" onClick={handleAddClass}>
                Add Class
              </MDButton>
            </MDBox>
          </MDBox>
          <MDBox pt={3}>
            <MDBox sx={{ overflowX: "scroll" }}>
              <DataTable
                table={{ columns, rows: computedRows }}
                isSorted={false}
                entriesPerPage={{ defaultValue: pageSize, entries: [5, 10, 15, 20, 25] }}
                showTotalEntries={true}
                noEndBorder
                canSearch={true}
              />
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default ClassConfig;
