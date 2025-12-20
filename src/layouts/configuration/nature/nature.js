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

function NatureConfig() {
  const statusOptions = ["Active", "Deactive"];

  const [tableRows, setTableRows] = useState([
    { sno: "1", name: "Forest", status: "Active" },
    { sno: "2", name: "Desert", status: "Deactive" },
    { sno: "3", name: "Mountain", status: "Active" },
    { sno: "4", name: "Ocean", status: "Active" },
    { sno: "5", name: "River", status: "Deactive" },
  ]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const handleAddNature = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({ sno: "", name: "", status: statusOptions[0] });
  };

  const handleEditNature = (name) => {
    if (editingRowId) return;
    const row = tableRows.find((r) => r.name === name);
    if (!row) return;
    setEditingRowId(name);
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
      setTableRows((prev) => prev.map((r) => (r.name === editingRowId ? editDraft : r)));
      setEditingRowId(null);
      setEditDraft(null);
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const handleDeleteNature = (name) => {
    setTableRows((prev) => prev.filter((r) => r.name !== name));
  };

  const columns = [
    { Header: "Sno", accessor: "sno", align: "left", width: "10%" },
    { Header: "Name", accessor: "name", align: "left" },
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
        name: renderInput("name", newRowDraft.name),
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
      const isEditing = editingRowId === r.name;
      const draft = isEditing ? editDraft : r;
      rows.push({
        sno: isEditing ? renderInput("sno", draft.sno) : r.sno,
        name: isEditing ? renderInput("name", draft.name) : r.name,
        status: isEditing ? renderStatusSelect(draft.status) : r.status,
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
              onClick={() => handleEditNature(r.name)}
            >
              Edit
            </MDButton>
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleDeleteNature(r.name)}
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
              Nature
            </MDTypography>
            <MDButton variant="gradient" color="info" onClick={handleAddNature}>
              Add Nature
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

export default NatureConfig;
