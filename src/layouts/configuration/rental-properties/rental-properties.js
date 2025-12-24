import { useState, useEffect } from "react";
import PropTypes from "prop-types";
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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import RentalPropertyForm from "./RentalPropertyForm";
import api from "services/api.service";

const StatusBadge = ({ value }) => (
  <MDBadge
    badgeContent={value ? "Active" : "Disabled"}
    color={value ? "success" : "error"}
    variant="gradient"
    size="sm"
  />
);

StatusBadge.propTypes = {
  value: PropTypes.bool.isRequired,
};

function RentalProperties() {
  const [tableRows, setTableRows] = useState([]);
  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [classes, setClasses] = useState([]);

  const fetchRentalProperties = async () => {
    try {
      const response = await api.list("rentalproperty");
      setTableRows(response);
    } catch (error) {
      console.error("Error fetching rental properties:", error);
    }
  };

  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [rentalPropertiesResponse, commandsResponse, basesResponse, classesResponse] =
          await Promise.all([
            api.list("rentalproperty"),
            api.list("command"),
            api.list("base"),
            api.list("class"),
          ]);
        setTableRows(rentalPropertiesResponse);
        setCommands(commandsResponse);
        setBases(basesResponse);
        setClasses(classesResponse);
      } catch (error) {
        console.error("Error fetching initial data:", error);
      }
    };
    fetchInitialData();
  }, []);
  const [formOpen, setFormOpen] = useState(false);
  const [currentProperty, setCurrentProperty] = useState(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [propertyToDelete, setPropertyToDelete] = useState(null);

  const handleAddProperty = () => {
    setCurrentProperty(null);
    setFormOpen(true);
  };

  const handleEditProperty = (id) => {
    const property = tableRows.find((row) => row.id === id);
    setCurrentProperty({
      id: property.id,
      cmdId: property.cmdId,
      baseId: property.baseId,
      classId: property.classId,
      pId: property.pId,
      uoM: property.uoM,
      area: property.area,
      location: property.location,
      remarks: property.remarks,
      status: property.status,
    });
    setFormOpen(true);
  };

  const handleFormSubmit = async (formData) => {
    try {
      const formattedData = {
        cmdId: formData.cmdId,
        baseId: formData.baseId,
        classId: formData.classId,
        pId: formData.pId,
        uoM: formData.uoM,
        area: formData.area,
        location: formData.location,
        remarks: formData.remarks,
        status: formData.status,
      };

      if (currentProperty) {
        // Edit existing property
        await api.update("rentalproperty", currentProperty.id, formattedData);
        await fetchRentalProperties();
      } else {
        // Add new property
        await api.create("rentalproperty", formattedData);
        await fetchRentalProperties();
      }
      setFormOpen(false);
    } catch (error) {
      console.error("Error saving rental property:", error);
      // Optionally, show an error message to the user
    }
  };

  const handleFormClose = () => {
    setFormOpen(false);
  };

  const handleDeleteProperty = (id) => {
    setPropertyToDelete(id);
    setShowDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    try {
      await api.remove("rentalproperty", propertyToDelete);
      await fetchRentalProperties();
      setShowDeleteDialog(false);
      setPropertyToDelete(null);
    } catch (error) {
      console.error("Error deleting rental property:", error);
      // Optionally, show an error message to the user
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteDialog(false);
    setPropertyToDelete(null);
  };

  const getCommandName = (cmdId) => {
    const command = commands.find((cmd) => cmd.id === cmdId);
    return command ? command.name : cmdId;
  };

  const getBaseName = (baseId) => {
    const base = bases.find((b) => b.id === baseId);
    return base ? base.name : baseId;
  };

  const getClassName = (classId) => {
    const classItem = classes.find((c) => c.id === classId);
    return classItem ? classItem.name : classId;
  };

  const columns = [
    { Header: "Id", accessor: "id", align: "left" },
    { Header: "Command", accessor: "cmdId", align: "left" },
    { Header: "Base", accessor: "baseId", align: "left" },
    { Header: "Class", accessor: "classId", align: "left" },
    { Header: "Property ID", accessor: "pId", align: "left" },
    { Header: "UoM", accessor: "uoM", align: "left" },
    { Header: "Area", accessor: "area", align: "left" },
    { Header: "Location", accessor: "location", align: "left" },
    { Header: "Remarks", accessor: "remarks", align: "left" },
    { Header: "Is Active", accessor: "status", align: "center", Cell: StatusBadge },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const computedRows = tableRows.map((row) => ({
    ...row,
    cmdId: getCommandName(row.cmdId),
    baseId: getBaseName(row.baseId),
    classId: getClassName(row.classId),
    actions: (
      <MDBox display="flex" gap={1}>
        <MDButton
          variant="outlined"
          color="info"
          size="small"
          onClick={() => handleEditProperty(row.id)}
        >
          Edit
        </MDButton>
        <MDButton
          variant="outlined"
          color="error"
          size="small"
          onClick={() => handleDeleteProperty(row.id)}
        >
          Delete
        </MDButton>
      </MDBox>
    ),
  }));

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

      <RentalPropertyForm
        open={formOpen}
        onClose={handleFormClose}
        onSubmit={handleFormSubmit}
        initialData={currentProperty}
      />

      <Dialog open={showDeleteDialog} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1">
            Are you sure you want to delete this rental property?
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary">
            Cancel
          </MDButton>
          <MDButton onClick={handleConfirmDelete} color="error">
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default RentalProperties;
