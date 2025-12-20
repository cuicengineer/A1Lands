import { useState } from "react";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDBadge from "components/MDBadge";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import Card from "@mui/material/Card";

function UnitsConfig() {
  const [tableRows, setTableRows] = useState([
    {
      sno: "1",
      command: "North",
      base: "Alpha",
      unitName: "Unit 1",
      status: "Active",
      createdDate: "15/01/2024",
    },
    {
      sno: "2",
      command: "South",
      base: "Bravo",
      unitName: "Unit 2",
      status: "Inactive",
      createdDate: "02/02/2024",
    },
    {
      sno: "3",
      command: "East",
      base: "Charlie",
      unitName: "Unit 3",
      status: "Active",
      createdDate: "20/02/2024",
    },
    {
      sno: "4",
      command: "West",
      base: "Delta",
      unitName: "Unit 4",
      status: "Active",
      createdDate: "03/03/2024",
    },
    {
      sno: "5",
      command: "HQ",
      base: "Echo",
      unitName: "Unit 5",
      status: "Inactive",
      createdDate: "20/03/2024",
    },
  ]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const handleAddUnit = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({ sno: "", command: "", base: "", unitName: "", status: "", createdDate: "" });
  };

  const handleEditUnit = (sno) => {
    if (editingRowId) return;
    const row = tableRows.find((r) => r.sno === sno);
    if (!row) return;
    setEditingRowId(sno);
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
      setTableRows((prev) => prev.map((r) => (r.sno === editingRowId ? editDraft : r)));
      setEditingRowId(null);
      setEditDraft(null);
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
  };

  const handleDeleteUnit = (sno) => {
    setTableRows((prev) => prev.filter((r) => r.sno !== sno));
  };

  const columns = [
    { Header: "Sno", accessor: "sno", align: "left", width: "5%" },
    { Header: "Command", accessor: "command", align: "left" },
    { Header: "Base", accessor: "base", align: "left" },
    { Header: "Unit Name", accessor: "unitName", align: "left" },
    { Header: "Status", accessor: "status", align: "center" },
    { Header: "Created Date", accessor: "createdDate", align: "center" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const renderStatusBadge = (status) => (
    <MDBox ml={-1}>
      <MDBadge
        badgeContent={status}
        color={status === "Active" ? "success" : "dark"}
        variant="gradient"
        size="sm"
      />
    </MDBox>
  );

  const renderInput = (field, value) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
    />
  );

  const computedRows = (() => {
    const rows = [];

    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        sno: renderInput("sno", newRowDraft.sno),
        command: renderInput("command", newRowDraft.command),
        base: renderInput("base", newRowDraft.base),
        unitName: renderInput("unitName", newRowDraft.unitName),
        status: renderInput("status", newRowDraft.status),
        createdDate: renderInput("createdDate", newRowDraft.createdDate),
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
      const isEditing = editingRowId === r.sno;
      const draft = isEditing ? editDraft : r;
      rows.push({
        sno: isEditing ? renderInput("sno", draft.sno) : r.sno,
        command: isEditing ? renderInput("command", draft.command) : r.command,
        base: isEditing ? renderInput("base", draft.base) : r.base,
        unitName: isEditing ? renderInput("unitName", draft.unitName) : r.unitName,
        status: isEditing ? renderInput("status", draft.status) : renderStatusBadge(r.status),
        createdDate: isEditing ? renderInput("createdDate", draft.createdDate) : r.createdDate,
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
              onClick={() => handleEditUnit(r.sno)}
            >
              Edit
            </MDButton>
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleDeleteUnit(r.sno)}
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
              Units
            </MDTypography>
            <MDButton variant="gradient" color="info" onClick={handleAddUnit}>
              Add Unit
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

export default UnitsConfig;
