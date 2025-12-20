// @mui material components
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
import NewContractForm from "layouts/contracts/components/NewContractForm";
import { useState } from "react";

function Contracts() {
  const [openForm, setOpenForm] = useState(false);

  const handleOpenForm = () => setOpenForm(true);
  const handleCloseForm = () => setOpenForm(false);

  // Placeholder for columns and rows data
  const columns = [
    { Header: "Sno", accessor: "sno", align: "left" },
    { Header: "Class", accessor: "class", align: "left" },
    { Header: "Cmd", accessor: "cmd", align: "left" },
    { Header: "Unit", accessor: "unit", align: "left" },
    { Header: "CA No", accessor: "caNo", align: "left" },
    { Header: "Contractor Name", accessor: "contractorName", align: "left" },
    { Header: "Contractor Address", accessor: "contractorAddress", align: "left" },
    { Header: "Business Title", accessor: "businessTitle", align: "left" },
    { Header: "Nature of Business", accessor: "natureOfBusiness", align: "left" },
    { Header: "Location", accessor: "location", align: "left" },
    { Header: "GP ID", accessor: "gpId", align: "left" },
    { Header: "Area-CA", accessor: "areaCA", align: "left" },
    { Header: "Area-BOO", accessor: "areaBOO", align: "left" },
    { Header: "Revenue Rate", accessor: "revenueRate", align: "left" },
    { Header: "Revenue Rate Date", accessor: "revenueRateDate", align: "left" },
    { Header: "Rental Value", accessor: "rentalValue", align: "left" },
    { Header: "Initial Contractor Name", accessor: "initialContractorName", align: "left" },
    { Header: "Initial Contract Date", accessor: "initialContractDate", align: "left" },
    { Header: "Contract From", accessor: "contractFrom", align: "left" },
    { Header: "Contract To", accessor: "contractTo", align: "left" },
    { Header: "1st Y Rent PM", accessor: "firstYRentPM", align: "left" },
    { Header: "1st Y Rent PA", accessor: "firstYRentPA", align: "left" },
    { Header: "Term of Payment", accessor: "termOfPayment", align: "left" },
    { Header: "Profit Term", accessor: "profitTerm", align: "left" },
    { Header: "Increase (Rate)", accessor: "increaseRate", align: "left" },
    { Header: "Increase Interval", accessor: "increaseInterval", align: "left" },
    { Header: "Security Deposit Term", accessor: "securityDepositTerm", align: "left" },
    { Header: "Security Deposit Rs", accessor: "securityDepositRs", align: "left" },
    { Header: "DPC (Per Day)", accessor: "dpcPerDay", align: "left" },
    { Header: "Govt Share-PA", accessor: "govtSharePA", align: "left" },
    { Header: "PAF Share-PA", accessor: "pafSharePA", align: "left" },
    { Header: "Status", accessor: "status", align: "left" },
    { Header: "Feasible", accessor: "feasible", align: "left" },
    { Header: "CA Status", accessor: "caStatus", align: "left" },
    { Header: "Approving Authority", accessor: "approvingAuthority", align: "left" },
    { Header: "Remarks", accessor: "remarks", align: "left" },
    { Header: "Documents", accessor: "documents", align: "center" },
    { Header: "Created By", accessor: "createdBy", align: "left" },
    { Header: "Created Date", accessor: "createdDate", align: "left" },
    { Header: "IsDeleted", accessor: "isDeleted", align: "left" },
    { Header: "Actions", accessor: "actions", align: "center" },
  ];

  const rows = [
    // Sample data - replace with actual data from an API or state
    {
      sno: 1,
      class: "Class A",
      cmd: "CMD001",
      unit: "Unit 1",
      caNo: "CA-123",
      contractorName: "Contractor A",
      contractorAddress: "123 Contractor St",
      businessTitle: "Business Title A",
      natureOfBusiness: "Nature A",
      location: "Location A",
      gpId: "GPID001",
      areaCA: "Area CA 1",
      areaBOO: "Area BOO 1",
      revenueRate: "10%",
      revenueRateDate: "2023-01-01",
      rentalValue: "10000",
      initialContractorName: "Initial Contractor A",
      initialContractDate: "2022-01-01",
      contractFrom: "2023-01-01",
      contractTo: "2024-01-01",
      firstYRentPM: "1000",
      firstYRentPA: "12000",
      termOfPayment: "Net 30",
      profitTerm: "Profit Term A",
      increaseRate: "5%",
      increaseInterval: "Annual",
      securityDepositTerm: "30 Days",
      securityDepositRs: "1000",
      dpcPerDay: "1%",
      govtSharePA: "5%",
      pafSharePA: "2%",
      status: "Active",
      feasible: "Yes",
      caStatus: "Approved",
      approvingAuthority: "Authority A",
      remarks: "Remarks A",
      documents: (
        <a href="#" download>
          <Icon fontSize="small">download</Icon>
        </a>
      ),
      createdBy: "Admin",
      createdDate: "2022-12-01",
      isDeleted: "No",
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
      class: "Class B",
      cmd: "CMD002",
      unit: "Unit 2",
      caNo: "CA-456",
      contractorName: "Contractor B",
      contractorAddress: "456 Contractor Ave",
      businessTitle: "Business Title B",
      natureOfBusiness: "Nature B",
      location: "Location B",
      gpId: "GPID002",
      areaCA: "Area CA 2",
      areaBOO: "Area BOO 2",
      revenueRate: "12%",
      revenueRateDate: "2023-02-01",
      rentalValue: "20000",
      initialContractorName: "Initial Contractor B",
      initialContractDate: "2022-02-01",
      contractFrom: "2023-02-01",
      contractTo: "2024-02-01",
      firstYRentPM: "2000",
      firstYRentPA: "24000",
      termOfPayment: "Net 60",
      profitTerm: "Profit Term B",
      increaseRate: "6%",
      increaseInterval: "Bi-Annual",
      securityDepositTerm: "60 Days",
      securityDepositRs: "2000",
      dpcPerDay: "1.5%",
      govtSharePA: "6%",
      pafSharePA: "3%",
      status: "Inactive",
      feasible: "No",
      caStatus: "Pending",
      approvingAuthority: "Authority B",
      remarks: "Remarks B",
      documents: (
        <a href="#" download>
          <Icon fontSize="small">download</Icon>
        </a>
      ),
      createdBy: "Admin",
      createdDate: "2022-11-10",
      isDeleted: "No",
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
                  Contracts
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  Add New Contract
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
      <NewContractForm open={openForm} handleClose={handleCloseForm} />
    </DashboardLayout>
  );
}

export default Contracts;
