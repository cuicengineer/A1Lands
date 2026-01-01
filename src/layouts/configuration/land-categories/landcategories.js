import Card from "@mui/material/Card";
import { useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import StatusBadge from "components/StatusBadge";

function LandCategories() {
  const statusOptions = ["Active", "Deactive"];

  const [tableRows, setTableRows] = useState([
    { sno: "1", class: "Agricultural", status: "Active" },
    { sno: "2", class: "Residential", status: "Deactive" },
    { sno: "3", class: "Commercial", status: "Active" },
    { sno: "4", class: "Industrial", status: "Active" },
    { sno: "5", class: "Recreational", status: "Deactive" },
  ]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const handleAddCategory = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({ sno: "", class: "", status: statusOptions[0] });
  };

  const handleEditCategory = (cls) => {
    if (editingRowId) return;
    const row = tableRows.find((r) => r.class === cls);
    if (!row) return;
    setEditingRowId(cls);
    setEditDraft({ ...row });
  };

  const handleChange = (field, value) => {
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: value }));
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: value }));
    }
  };

  const handleSave = () => {
    if (editingRowId === "__new__" && newRowDraft) {
      setTableRows((prev) => [newRowDraft, ...prev]);
      setEditingRowId(null);
      setNewRowDraft(null);
    } else if (editingRowId && editDraft) {
      setTableRows((prev) => prev.map((r) => (r.class === editingRowId ? editDraft : r)));
      setEditingRowId(null);
      setEditDraft(null);
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const handleDeleteCategory = (cls) => {
    setTableRows((prev) => prev.filter((r) => r.class !== cls));
  };

  const columns = [
    { Header: "Sno", accessor: "sno", align: "left", width: "10%" },
    { Header: "Class", accessor: "class", align: "left" },
    { Header: "Status", accessor: "status", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const renderInput = (field, value) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
    />
  );

  const renderStatusSelect = (value) => (
    <Select
      value={value}
      onChange={(e) => handleChange("status", e.target.value)}
      size="small"
      fullWidth
    >
      {statusOptions.map((opt) => (
        <MenuItem key={opt} value={opt}>
          {opt}
        </MenuItem>
      ))}
    </Select>
  );

  const computedRows = (() => {
    const rows = [];
    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        sno: renderInput("sno", newRowDraft.sno),
        class: renderInput("class", newRowDraft.class),
        status: renderStatusSelect(newRowDraft.status),
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
      const isEditing = editingRowId === r.class;
      const draft = isEditing ? editDraft : r;
      rows.push({
        sno: isEditing ? renderInput("sno", draft.sno) : r.sno,
        class: isEditing ? renderInput("class", draft.class) : r.class,
        status: isEditing ? (
          renderStatusSelect(draft.status)
        ) : (
          <StatusBadge value={r.status} inactiveLabel="Deactive" inactiveColor="error" />
        ),
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
              onClick={() => handleEditCategory(r.class)}
            >
              Edit
            </MDButton>
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleDeleteCategory(r.class)}
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
              Land Categories
            </MDTypography>
            <MDButton variant="gradient" color="info" onClick={handleAddCategory}>
              Add Category
            </MDButton>
          </MDBox>
          <MDBox pt={3}>
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

export default LandCategories;

// Command to format configuration layout:
// npx --yes prettier --write src\\layouts\\configuration\\
