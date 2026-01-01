// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import { useState } from "react";
import ProfitSharingForm from "layouts/configuration/profit-sharing/components/ProfitSharingForm";
import StatusBadge from "components/StatusBadge";

function ProfitSharing() {
  const [openForm, setOpenForm] = useState(false);

  const handleOpenForm = () => setOpenForm(true);
  const handleCloseForm = () => setOpenForm(false);

  // Placeholder for columns and rows data
  const columns = [
    { Header: "Cmd", accessor: "cmd", align: "left" },
    { Header: "Unit", accessor: "unit", align: "left" },
    { Header: "Category", accessor: "category", align: "left" },
    { Header: "Govt Share", accessor: "govtShare", align: "left" },
    { Header: "AHQ Share", accessor: "ahqShare", align: "left" },
    { Header: "RAC Share", accessor: "racShare", align: "left" },
    { Header: "Base Share", accessor: "baseShare", align: "left" },
    { Header: "Effective Date", accessor: "effectiveDate", align: "left" },
    { Header: "Remarks", accessor: "remarks", align: "left" },
    { Header: "Updated By", accessor: "updatedBy", align: "left" },
    { Header: "Updated Date", accessor: "updatedDate", align: "left" },
    { Header: "Status", accessor: "status", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const rows = [
    // Sample data - replace with actual data from an API or state
    {
      cmd: "CMD-A",
      unit: "Unit-1",
      category: "Category-X",
      govtShare: "10%",
      ahqShare: "5%",
      racShare: "3%",
      baseShare: "82%",
      effectiveDate: "2023-01-01",
      remarks: "Sample remarks 1",
      updatedBy: "Admin",
      updatedDate: "2023-01-01",
      status: <StatusBadge value="Active" inactiveLabel="Inactive" inactiveColor="error" />,
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
      cmd: "CMD-B",
      unit: "Unit-2",
      category: "Category-Y",
      govtShare: "12%",
      ahqShare: "6%",
      racShare: "4%",
      baseShare: "78%",
      effectiveDate: "2023-02-01",
      remarks: "Sample remarks 2",
      updatedBy: "Admin",
      updatedDate: "2023-02-01",
      status: <StatusBadge value={false} inactiveLabel="Inactive" inactiveColor="error" />,
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
  ];

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
                  Profit Sharing
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  Add New Profit Share
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
      <ProfitSharingForm open={openForm} handleClose={handleCloseForm} />
    </DashboardLayout>
  );
}

export default ProfitSharing;
