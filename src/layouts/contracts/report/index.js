import React, { useState } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import { FormControl, InputLabel, Select, MenuItem } from "@mui/material";
import MDButton from "components/MDButton";

function ContractsReport() {
  const [command, setCommand] = useState("");
  const [base, setBase] = useState("");

  const handleCommandChange = (event) => {
    setCommand(event.target.value);
  };

  const handleBaseChange = (event) => {
    setBase(event.target.value);
  };

  const handleSearch = () => {
    console.log("Searching with:", { command, base });
    // Implement actual search logic here
  };

  // Placeholder data for dropdowns
  const commandOptions = ["CMD-A", "CMD-B", "CMD-C"];
  const baseOptions = ["Base-1", "Base-2", "Base-3"];

  // Define the complex header structure and data for the table
  const columns = [
    { Header: "Formation", accessor: "formation", align: "left" },
    {
      Header: "No of Contracts",
      columns: [
        { Header: "A", accessor: "noContractsA", align: "center" },
        { Header: "B", accessor: "noContractsB", align: "center" },
        { Header: "C", accessor: "noContractsC", align: "center" },
        { Header: "BTS", accessor: "noContractsBTS", align: "center" },
        { Header: "Hoarding", accessor: "noContractsHoarding", align: "center" },
      ],
    },
    {
      Header: "Annual Rent",
      columns: [
        { Header: "A", accessor: "annualRentA", align: "center" },
        { Header: "B", accessor: "annualRentB", align: "center" },
        { Header: "C", accessor: "annualRentC", align: "center" },
        { Header: "BTS", accessor: "annualRentBTS", align: "center" },
        { Header: "Hoarding", accessor: "annualRentHoarding", align: "center" },
      ],
    },
    {
      Header: "Govt Share",
      columns: [
        { Header: "A", accessor: "govtShareA", align: "center" },
        { Header: "C", accessor: "govtShareC", align: "center" },
      ],
    },
    {
      Header: "Base / Cmd Share",
      columns: [
        { Header: "A", accessor: "baseCmdShareA", align: "center" },
        { Header: "B", accessor: "baseCmdShareB", align: "center" },
        { Header: "C", accessor: "baseCmdShareC", align: "center" },
        { Header: "BTS", accessor: "baseCmdShareBTS", align: "center" },
        { Header: "Hoarding", accessor: "baseCmdShareHoarding", align: "center" },
      ],
    },
    {
      Header: "CNPF Share",
      columns: [
        { Header: "A", accessor: "cnpfShareA", align: "center" },
        { Header: "B", accessor: "cnpfShareB", align: "center" },
        { Header: "C", accessor: "cnpfShareC", align: "center" },
        { Header: "BTS", accessor: "cnpfShareBTS", align: "center" },
        { Header: "Hoarding", accessor: "cnpfShareHoarding", align: "center" },
      ],
    },
    {
      Header: "Grand Total",
      columns: [
        { Header: "No", accessor: "grandTotalNo", align: "center" },
        { Header: "Rent", accessor: "grandTotalRent", align: "center" },
        { Header: "Govt", accessor: "grandTotalGovt", align: "center" },
        { Header: "Cmd / Base", accessor: "grandTotalCmdBase", align: "center" },
        { Header: "CNPF", accessor: "grandTotalCNPF", align: "center" },
      ],
    },
  ];

  const rows = [
    {
      formation: "PAAK",
      noContractsA: 4,
      noContractsB: 56,
      noContractsC: "",
      noContractsBTS: 4,
      noContractsHoarding: "",
      annualRentA: "18.40 M",
      annualRentB: "14.81 M",
      annualRentC: "",
      annualRentBTS: "3.00 M",
      annualRentHoarding: "",
      govtShareA: "9.02 M",
      govtShareC: "",
      baseCmdShareA: "4.69 M",
      baseCmdShareB: "11.85 M",
      baseCmdShareC: "",
      baseCmdShareBTS: "1.13 M",
      baseCmdShareHoarding: "",
      cnpfShareA: "4.69 M",
      cnpfShareB: "2.96 M",
      cnpfShareC: "",
      cnpfShareBTS: "1.88 M",
      cnpfShareHoarding: "",
      grandTotalNo: 64,
      grandTotalRent: "36.21 M",
      grandTotalGovt: "9.02 M",
      grandTotalCmdBase: "17.66 M",
      grandTotalCNPF: "9.52 M",
    },
    {
      formation: "PAFAA",
      noContractsA: 2,
      noContractsB: 61,
      noContractsC: 1,
      noContractsBTS: 3,
      noContractsHoarding: "",
      annualRentA: "5.38 M",
      annualRentB: "11.19 M",
      annualRentC: "8.71 M",
      annualRentBTS: "1.80 M",
      annualRentHoarding: "",
      govtShareA: "0.56 M",
      govtShareC: "1.65 M",
      baseCmdShareA: "2.41 M",
      baseCmdShareB: "8.96 M",
      baseCmdShareC: "3.53 M",
      baseCmdShareBTS: "0.68 M",
      baseCmdShareHoarding: "",
      cnpfShareA: "2.41 M",
      cnpfShareB: "2.24 M",
      cnpfShareC: "3.53 M",
      cnpfShareBTS: "1.13 M",
      cnpfShareHoarding: "",
      grandTotalNo: 67,
      grandTotalRent: "27.09 M",
      grandTotalGovt: "2.21 M",
      grandTotalCmdBase: "15.57 M",
      grandTotalCNPF: "9.31 M",
    },
    {
      formation: "ACADEMIES",
      noContractsA: 6,
      noContractsB: 117,
      noContractsC: 1,
      noContractsBTS: 7,
      noContractsHoarding: "",
      annualRentA: "23.78 M",
      annualRentB: "26.00 M",
      annualRentC: "8.71 M",
      annualRentBTS: "4.80 M",
      annualRentHoarding: "",
      govtShareA: "9.58 M",
      govtShareC: "1.65 M",
      baseCmdShareA: "7.10 M",
      baseCmdShareB: "20.80 M",
      baseCmdShareC: "3.53 M",
      baseCmdShareBTS: "1.80 M",
      baseCmdShareHoarding: "",
      cnpfShareA: "7.10 M",
      cnpfShareB: "5.20 M",
      cnpfShareC: "3.53 M",
      cnpfShareBTS: "3.00 M",
      cnpfShareHoarding: "",
      grandTotalNo: 131,
      grandTotalRent: "63.30 M",
      grandTotalGovt: "11.23 M",
      grandTotalCmdBase: "33.23 M",
      grandTotalCNPF: "18.83 M",
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
                  Contracts Report
                </MDTypography>
              </MDBox>
              <MDBox pt={3} px={2}>
                <Grid container spacing={3} alignItems="center">
                  <Grid item xs={12} sm={4}>
                    <FormControl variant="standard" fullWidth>
                      <InputLabel id="command-label">Command</InputLabel>
                      <Select
                        labelId="command-label"
                        id="command"
                        value={command}
                        onChange={handleCommandChange}
                        label="Command"
                      >
                        {commandOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <FormControl variant="standard" fullWidth>
                      <InputLabel id="base-label">Base</InputLabel>
                      <Select
                        labelId="base-label"
                        id="base"
                        value={base}
                        onChange={handleBaseChange}
                        label="Base"
                      >
                        {baseOptions.map((option) => (
                          <MenuItem key={option} value={option}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <MDButton variant="gradient" color="info" onClick={handleSearch}>
                      Search
                    </MDButton>
                  </Grid>
                </Grid>
              </MDBox>
              <MDBox pt={3}>
                <DataTable
                  table={{ columns, rows }}
                  isSorted={false}
                  entriesPerPage={false}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch={false}
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default ContractsReport;
