import { useEffect, useState } from "react";

// @mui material components
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";

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

function ClassConfig() {
  const [tableRows, setTableRows] = useState([]);
  const [errors, setErrors] = useState({});

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  useEffect(() => {
    fetchClasses();
  }, []);

  const fetchClasses = async () => {
    try {
      const data = await api.list("Class");
      const arr = Array.isArray(data) ? data : data && data.items ? data.items : [];
      setTableRows(arr);
    } catch (e) {
      console.error("Failed to load classes", e);
    }
  };

  const handleAddClass = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      id: 0,
      code: "",
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
    let nextValue = field === "status" ? Number(value) : value;

    // Limit code to 2 characters
    if (field === "code") {
      nextValue = String(value || "")
        .slice(0, 2)
        .toUpperCase();
    }

    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: nextValue }));
      if (field === "name") {
        const msg = nextValue && String(nextValue).trim() ? null : "Name is required";
        setErrors((prev) => ({ ...prev, name: msg }));
      } else if (field === "code") {
        const codeStr = String(nextValue || "").trim();
        const msg = codeStr.length === 2 ? null : "Code must be exactly 2 characters";
        setErrors((prev) => ({ ...prev, code: msg }));
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
    const codeStr = String(newRowDraft?.code || "").trim();
    if (!codeStr || codeStr.length !== 2) {
      errs.code = "Code must be exactly 2 characters";
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
          code: String(newRowDraft.code || "")
            .trim()
            .toUpperCase(),
          name: newRowDraft.name,
          desc: newRowDraft.desc,
          status:
            typeof newRowDraft.status === "string"
              ? Number(newRowDraft.status)
              : newRowDraft.status,
        };
        await api.create("Class", payload);
        await fetchClasses();
        setEditingRowId(null);
        setNewRowDraft(null);
      } else if (editingRowId && editDraft) {
        const payload = {
          id: editDraft.id,
          code: String(editDraft.code || "")
            .trim()
            .toUpperCase(),
          name: editDraft.name,
          desc: editDraft.desc,
          status:
            typeof editDraft.status === "string" ? Number(editDraft.status) : editDraft.status,
        };
        await api.update("Class", editDraft.id, payload);
        await fetchClasses();
        setEditingRowId(null);
        setEditDraft(null);
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
      await fetchClasses();
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
    { Header: "Actions", accessor: "actions", align: "center", width: "8%" },
    { Header: "Id", accessor: "id", align: "left", width: "6%" },
    { Header: "Code", accessor: "code", align: "left", width: "8%" },
    { Header: "Class Name", accessor: "name", align: "left", width: "18%" },
    { Header: "Description", accessor: "desc", align: "left", width: "26%" },
    { Header: "Status", accessor: "status", align: "center", width: "10%" },
  ];

  const renderStatusBadge = (status) => {
    const s = String(status ?? "")
      .trim()
      .toLowerCase();

    let label = "Inactive";
    if (status === 1 || status === "1" || s === "true" || s === "active") {
      label = "Active";
    }
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
      required={editingRowId === "__new__" && (field === "name" || field === "code")}
      error={editingRowId === "__new__" && Boolean(errors?.[field])}
      helperText={editingRowId === "__new__" ? errors?.[field] : undefined}
      {...(field === "code" && {
        inputProps: { maxLength: 2, style: { textTransform: "uppercase" } },
      })}
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
      <MenuItem value={0}>Inactive</MenuItem>
    </MDInput>
  );

  const computedRows = (() => {
    const rows = [];

    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: newRowDraft.id,
        code: renderInput("code", newRowDraft.code),
        name: renderInput("name", newRowDraft.name),
        desc: renderInput("desc", newRowDraft.desc),
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

    tableRows.forEach((row) => {
      const isEditing = editingRowId === row.id;
      const currentRow = isEditing ? editDraft : row;

      rows.push({
        id: currentRow.id,
        code: isEditing ? (
          renderInput("code", currentRow.code)
        ) : (
          <MDBox component="span" sx={{ fontWeight: "medium" }}>
            {row.code || ""}
          </MDBox>
        ),
        name: isEditing ? (
          renderInput("name", currentRow.name)
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
            {row.name}
          </MDBox>
        ),
        desc: isEditing ? (
          renderInput("desc", currentRow.desc)
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
            {row.desc}
          </MDBox>
        ),
        status: isEditing
          ? renderStatusSelect("status", currentRow.status)
          : renderStatusBadge(currentRow.status),
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
              onClick={() => handleEditClass(row.id)}
              title="Edit"
              sx={{ padding: "1px" }}
            >
              <Icon>edit</Icon>
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => confirmDelete(row.id)}
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
              Class
            </MDTypography>
            <MDBox display="flex" alignItems="center" gap={2}>
              <MDButton variant="gradient" color="info" onClick={handleAddClass}>
                Add Class
              </MDButton>
            </MDBox>
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
                entriesPerPage={{ defaultValue: 5, entries: [5, 10, 15, 20, 25] }}
                showTotalEntries
                noEndBorder
                canSearch
                exportFileName="Class"
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
