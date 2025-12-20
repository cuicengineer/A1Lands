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

function RentalProperties() {
  const [tableRows, setTableRows] = useState([
    {
      sno: "1",
      command: "North",
      base: "Alpha",
      class: "A",
      propertyId: "RP-001",
      uom: "sqft",
      area: "1200",
      location: "Block A",
      description: "Corner shop",
      createdBy: "Admin",
      createdDate: "2024-01-15",
      isActive: "Yes",
    },
    {
      sno: "2",
      command: "South",
      base: "Bravo",
      class: "B",
      propertyId: "RP-002",
      uom: "sqm",
      area: "90",
      location: "Main Road",
      description: "Kiosk",
      createdBy: "Admin",
      createdDate: "2024-02-02",
      isActive: "No",
    },
    {
      sno: "3",
      command: "East",
      base: "Charlie",
      class: "C",
      propertyId: "RP-003",
      uom: "sqft",
      area: "600",
      location: "Bazaar",
      description: "Shop lot",
      createdBy: "Manager",
      createdDate: "2024-02-20",
      isActive: "Yes",
    },
  ]);

  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);

  const handleAddProperty = () => {
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewRowDraft({
      sno: "",
      command: "",
      base: "",
      class: "",
      propertyId: "",
      uom: "",
      area: "",
      location: "",
      description: "",
      createdBy: "",
      createdDate: "",
      isActive: "Yes",
    });
  };

  const handleEditProperty = (sno) => {
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

  const handleDeleteProperty = (sno) => {
    setTableRows((prev) => prev.filter((r) => r.sno !== sno));
  };

  const columns = [
    { Header: "Sno", accessor: "sno", align: "left", width: "5%" },
    { Header: "Command", accessor: "command", align: "left" },
    { Header: "Base", accessor: "base", align: "left" },
    { Header: "Class", accessor: "class", align: "left" },
    { Header: "PropertyID", accessor: "propertyId", align: "left" },
    { Header: "UoM", accessor: "uom", align: "left" },
    { Header: "Area", accessor: "area", align: "left" },
    { Header: "Location", accessor: "location", align: "left" },
    { Header: "Decsription", accessor: "description", align: "left" },
    { Header: "CreatedBy", accessor: "createdBy", align: "left" },
    { Header: "CreatedDate", accessor: "createdDate", align: "center" },
    { Header: "IsActive", accessor: "isActive", align: "center" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const renderActiveBadge = (value) => (
    <MDBox ml={-1}>
      <MDBadge
        badgeContent={value}
        color={value === "Yes" ? "success" : "dark"}
        variant="gradient"
        size="sm"
      />
    </MDBox>
  );

  const renderInput = (field, value) => (
    <MDInput
      type={field === "createdDate" ? "date" : "text"}
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
        class: renderInput("class", newRowDraft.class),
        propertyId: renderInput("propertyId", newRowDraft.propertyId),
        uom: renderInput("uom", newRowDraft.uom),
        area: renderInput("area", newRowDraft.area),
        location: renderInput("location", newRowDraft.location),
        description: renderInput("description", newRowDraft.description),
        createdBy: renderInput("createdBy", newRowDraft.createdBy),
        createdDate: renderInput("createdDate", newRowDraft.createdDate),
        isActive: renderInput("isActive", newRowDraft.isActive),
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
        class: isEditing ? renderInput("class", draft.class) : r.class,
        propertyId: isEditing ? renderInput("propertyId", draft.propertyId) : r.propertyId,
        uom: isEditing ? renderInput("uom", draft.uom) : r.uom,
        area: isEditing ? renderInput("area", draft.area) : r.area,
        location: isEditing ? renderInput("location", draft.location) : r.location,
        description: isEditing ? renderInput("description", draft.description) : r.description,
        createdBy: isEditing ? renderInput("createdBy", draft.createdBy) : r.createdBy,
        createdDate: isEditing ? renderInput("createdDate", draft.createdDate) : r.createdDate,
        isActive: isEditing
          ? renderInput("isActive", draft.isActive)
          : renderActiveBadge(r.isActive),
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
              onClick={() => handleEditProperty(r.sno)}
            >
              Edit
            </MDButton>
            <MDButton
              variant="outlined"
              color="error"
              size="small"
              onClick={() => handleDeleteProperty(r.sno)}
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
              Rental Properties
            </MDTypography>
            <MDButton variant="gradient" color="info" onClick={handleAddProperty}>
              Add Rental Property
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

export default RentalProperties;
