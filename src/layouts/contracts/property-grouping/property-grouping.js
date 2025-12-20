import React, { useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import PropTypes from "prop-types";

function PropertyGroupingForm({ open, onClose, onSubmit }) {
  const [form, setForm] = useState({
    command: "",
    base: "",
    className: "",
    property: "",
    groupId: "",
    address: "",
    totalArea: "",
    createdBy: "",
    createdDate: "",
    status: "",
  });
  const handleChange = (f, v) => setForm((p) => ({ ...p, [f]: v }));
  const handleSave = () => onSubmit(form);
  const fields = [
    { label: "Command", key: "command" },
    { label: "Base", key: "base" },
    { label: "Class", key: "className" },
    { label: "Property", key: "property" },
    { label: "GroupID", key: "groupId" },
    { label: "Address", key: "address" },
    { label: "Total Area", key: "totalArea" },
    { label: "CreatedBy", key: "createdBy" },
    { label: "CreatedDate", key: "createdDate", type: "date" },
    { label: "Status", key: "status" },
  ];
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>New Property Grouping</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0.5}>
          {fields.map((f) => (
            <Grid item xs={12} sm={6} key={f.key}>
              <MDInput
                label={f.label}
                type={f.type || "text"}
                value={form[f.key]}
                onChange={(e) => handleChange(f.key, e.target.value)}
                fullWidth
              />
            </Grid>
          ))}
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave}>
          <Icon>save</Icon>&nbsp;Save
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

PropertyGroupingForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
};

export default function PropertyGrouping() {
  const [openForm, setOpenForm] = useState(false);
  const [rows, setRows] = useState([
    {
      sno: 1,
      command: "CMD001",
      base: "Base A",
      className: "Class A",
      property: "Property A",
      groupId: "GPA-01",
      address: "123 Street",
      totalArea: "1000 sqft",
      createdBy: "Admin",
      createdDate: "2023-01-01",
      status: "Active",
      actions: (
        <MDBox display="flex" alignItems="center" mt={{ xs: 2, sm: 0 }} ml={{ xs: -1.5, sm: 0 }}>
          <MDButton variant="text" color="dark">
            <Icon>edit</Icon>&nbsp;edit
          </MDButton>
          <MDButton variant="text" color="error">
            <Icon>delete</Icon>&nbsp;delete
          </MDButton>
        </MDBox>
      ),
    },
    {
      sno: 2,
      command: "CMD002",
      base: "Base B",
      className: "Class B",
      property: "Property B",
      groupId: "GPB-02",
      address: "456 Avenue",
      totalArea: "1500 sqft",
      createdBy: "Admin",
      createdDate: "2023-02-01",
      status: "Inactive",
      actions: (
        <MDBox display="flex" alignItems="center" mt={{ xs: 2, sm: 0 }} ml={{ xs: -1.5, sm: 0 }}>
          <MDButton variant="text" color="dark">
            <Icon>edit</Icon>&nbsp;edit
          </MDButton>
          <MDButton variant="text" color="error">
            <Icon>delete</Icon>&nbsp;delete
          </MDButton>
        </MDBox>
      ),
    },
  ]);

  const columns = [
    { Header: "Sno", accessor: "sno", align: "left" },
    { Header: "Command", accessor: "command", align: "left" },
    { Header: "Base", accessor: "base", align: "left" },
    { Header: "Class", accessor: "className", align: "left" },
    { Header: "Property", accessor: "property", align: "left" },
    { Header: "GroupID", accessor: "groupId", align: "left" },
    { Header: "Address", accessor: "address", align: "left" },
    { Header: "Total Area", accessor: "totalArea", align: "left" },
    { Header: "CreatedBy", accessor: "createdBy", align: "left" },
    { Header: "CreatedDate", accessor: "createdDate", align: "left" },
    { Header: "Status", accessor: "status", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const handleOpenForm = () => setOpenForm(true);
  const handleCloseForm = () => setOpenForm(false);
  const handleSubmit = (data) => {
    const sno = rows.length ? Math.max(...rows.map((r) => r.sno)) + 1 : 1;
    const newRow = {
      sno,
      ...data,
      actions: (
        <MDBox display="flex" alignItems="center" mt={{ xs: 2, sm: 0 }} ml={{ xs: -1.5, sm: 0 }}>
          <MDButton variant="text" color="dark">
            <Icon>edit</Icon>&nbsp;edit
          </MDButton>
          <MDButton variant="text" color="error">
            <Icon>delete</Icon>&nbsp;delete
          </MDButton>
        </MDBox>
      ),
    };
    setRows((prev) => [newRow, ...prev]);
    handleCloseForm();
  };

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
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
                  Property Grouping
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              </MDBox>
              <MDBox pt={3}>
                <DataTable
                  table={{ columns, rows }}
                  isSorted={false}
                  entriesPerPage={true}
                  showTotalEntries={true}
                  noEndBorder
                  canSearch={true}
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
      <PropertyGroupingForm open={openForm} onClose={handleCloseForm} onSubmit={handleSubmit} />
    </DashboardLayout>
  );
}
