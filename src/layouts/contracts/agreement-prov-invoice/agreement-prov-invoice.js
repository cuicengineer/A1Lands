import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Autocomplete from "@mui/material/Autocomplete";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import StatusBadge from "components/StatusBadge";
import PropTypes from "prop-types";
import api from "services/api.service";
import contractApi from "services/api.contract.service";

export default function AgreementProvInvoice() {
  const [filters, setFilters] = useState({
    command: "",
    base: "",
    unit: "",
    dateFrom: "",
    dateTo: "",
    contractNo: null,
  });

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [units, setUnits] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [filteredBases, setFilteredBases] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch lookup data
  useEffect(() => {
    const fetchLookups = async () => {
      try {
        const [commandsRes, basesRes, unitsRes] = await Promise.all([
          api.list("command"),
          api.list("base"),
          api.list("unit"),
        ]);
        setCommands(Array.isArray(commandsRes) ? commandsRes : []);
        setBases(Array.isArray(basesRes) ? basesRes : []);
        setUnits(Array.isArray(unitsRes) ? unitsRes : []);
      } catch (error) {
        console.error("Error fetching lookup data:", error);
      }
    };
    fetchLookups();
  }, []);

  // Fetch active contracts for contract dropdown
  useEffect(() => {
    const fetchActiveContracts = async () => {
      try {
        const response = await contractApi.getAll(1, 10000); // Get all active contracts
        const contractsData = response?.data || (Array.isArray(response) ? response : []);
        // Filter only active contracts
        const activeContracts = contractsData.filter(
          (contract) =>
            contract.status === true || contract.status === 1 || contract.status === "Active"
        );
        setContracts(activeContracts);
      } catch (error) {
        console.error("Error fetching contracts:", error);
        setContracts([]);
      }
    };
    fetchActiveContracts();
  }, []);

  // Filter bases based on selected command
  useEffect(() => {
    if (filters.command && bases.length > 0) {
      const filtered = bases.filter((base) => Number(base.cmd) === Number(filters.command));
      setFilteredBases(filtered);
      // Clear base if it's no longer valid
      if (filters.base && !filtered.find((b) => b.id === filters.base)) {
        setFilters((prev) => ({ ...prev, base: "" }));
      }
    } else {
      setFilteredBases([]);
      if (filters.base) {
        setFilters((prev) => ({ ...prev, base: "" }));
      }
    }
  }, [filters.command, bases]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const handleSearch = async () => {
    setLoading(true);
    try {
      // Build search parameters
      const searchParams = {
        pageNumber: 1,
        pageSize: 10000, // Get all matching results
      };

      if (filters.command) {
        searchParams.cmdId = filters.command;
      }
      if (filters.base) {
        searchParams.baseId = filters.base;
      }
      if (filters.unit) {
        searchParams.unitId = filters.unit;
      }
      if (filters.dateFrom) {
        searchParams.dateFrom = filters.dateFrom;
      }
      if (filters.dateTo) {
        searchParams.dateTo = filters.dateTo;
      }
      if (filters.contractNo) {
        searchParams.contractNo = filters.contractNo.contractNo || filters.contractNo;
      }

      // Call API to search contracts
      const response = await contractApi.getAll(1, 10000);
      let contractsData = response?.data || (Array.isArray(response) ? response : []);

      // Filter by criteria
      if (filters.command) {
        contractsData = contractsData.filter((c) => Number(c.cmdId) === Number(filters.command));
      }
      if (filters.base) {
        contractsData = contractsData.filter((c) => Number(c.baseId) === Number(filters.base));
      }
      if (filters.unit) {
        const selectedUnit = units.find((u) => u.id === filters.unit);
        const unitName = selectedUnit?.name || selectedUnit?.unitName;
        if (unitName) {
          contractsData = contractsData.filter(
            (c) =>
              c.unitName === unitName ||
              c.unitname === unitName ||
              c.uomName === unitName ||
              c.uoM === unitName ||
              c.uoMName === unitName
          );
        }
      }
      if (filters.dateFrom) {
        contractsData = contractsData.filter((c) => c.contractStartDate >= filters.dateFrom);
      }
      if (filters.dateTo) {
        contractsData = contractsData.filter((c) => c.contractEndDate <= filters.dateTo);
      }
      if (filters.contractNo) {
        const contractNoValue = filters.contractNo.contractNo || filters.contractNo;
        contractsData = contractsData.filter((c) => c.contractNo === contractNoValue);
      }

      // Filter only active contracts
      contractsData = contractsData.filter(
        (contract) =>
          contract.status === true || contract.status === 1 || contract.status === "Active"
      );

      setRows(contractsData);
    } catch (error) {
      console.error("Error searching contracts:", error);
      alert("Failed to search contracts. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  // Format date for display
  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // Define table columns
  const columns = [
    { Header: "Contract No", accessor: "contractNo", align: "left" },
    { Header: "Business Name", accessor: "businessName", align: "left" },
    { Header: "Tenant No", accessor: "tenantNo", align: "left" },
    {
      Header: "Contract Start Date",
      accessor: "contractStartDate",
      align: "left",
      Cell: ({ value }) => formatDateDDMMYYYY(value),
    },
    {
      Header: "Contract End Date",
      accessor: "contractEndDate",
      align: "left",
      Cell: ({ value }) => formatDateDDMMYYYY(value),
    },
    {
      Header: "Initial Rent PM",
      accessor: "initialRentPM",
      align: "right",
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Initial Rent PA",
      accessor: "initialRentPA",
      align: "right",
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    { Header: "Nature of Business", accessor: "natureOfBusiness", align: "left" },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => <StatusBadge value={value} />,
    },
  ];

  const selectSx = {
    fontSize: "1rem",
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "10px 12px",
      minHeight: "45px",
    },
  };

  const inputSx = {
    "& .MuiInputBase-input": {
      fontSize: "1rem",
      padding: "10px 12px",
      minHeight: "45px",
    },
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
              >
                <MDTypography variant="h6" color="white">
                  Agreement Prov Invoice
                </MDTypography>
              </MDBox>
              <MDBox pt={3} px={3}>
                {/* Filters Section */}
                <Grid container spacing={3} mb={3}>
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="command-filter-label">Command</InputLabel>
                      <Select
                        labelId="command-filter-label"
                        value={filters.command}
                        label="Command"
                        onChange={(e) => handleFilterChange("command", e.target.value)}
                        sx={selectSx}
                      >
                        <MenuItem value="">
                          <em>All</em>
                        </MenuItem>
                        {commands.map((cmd) => (
                          <MenuItem key={cmd.id} value={cmd.id}>
                            {cmd.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl fullWidth size="small" disabled={!filters.command}>
                      <InputLabel id="base-filter-label">Base</InputLabel>
                      <Select
                        labelId="base-filter-label"
                        value={filters.base}
                        label="Base"
                        onChange={(e) => handleFilterChange("base", e.target.value)}
                        sx={selectSx}
                      >
                        <MenuItem value="">
                          <em>All</em>
                        </MenuItem>
                        {filteredBases.map((base) => (
                          <MenuItem key={base.id} value={base.id}>
                            {base.name}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="unit-filter-label">Unit</InputLabel>
                      <Select
                        labelId="unit-filter-label"
                        value={filters.unit}
                        label="Unit"
                        onChange={(e) => handleFilterChange("unit", e.target.value)}
                        sx={selectSx}
                      >
                        <MenuItem value="">
                          <em>All</em>
                        </MenuItem>
                        {units.map((unit) => (
                          <MenuItem key={unit.id} value={unit.id}>
                            {unit.name || unit.unitName}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <MDInput
                      label="Date From"
                      type="date"
                      value={filters.dateFrom}
                      onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      sx={inputSx}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <MDInput
                      label="Date To"
                      type="date"
                      value={filters.dateTo}
                      onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                      fullWidth
                      size="small"
                      InputLabelProps={{ shrink: true }}
                      inputProps={{
                        min: filters.dateFrom || undefined,
                      }}
                      sx={inputSx}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6} md={4}>
                    <Autocomplete
                      options={contracts}
                      getOptionLabel={(option) =>
                        option.contractNo || option.contractNo || String(option)
                      }
                      value={
                        filters.contractNo
                          ? contracts.find(
                              (c) =>
                                c.contractNo ===
                                (filters.contractNo.contractNo || filters.contractNo)
                            ) || null
                          : null
                      }
                      onChange={(event, newValue) => {
                        handleFilterChange("contractNo", newValue);
                      }}
                      renderInput={(params) => (
                        <MDInput {...params} label="Contract No" size="small" sx={inputSx} />
                      )}
                      renderOption={(props, option) => (
                        <li {...props} key={option.id || option.contractNo}>
                          {option.contractNo}
                        </li>
                      )}
                    />
                  </Grid>

                  <Grid item xs={12} sm={6} md={2}>
                    <MDButton
                      variant="gradient"
                      color="info"
                      fullWidth
                      onClick={handleSearch}
                      disabled={loading}
                      sx={{ minHeight: "45px" }}
                    >
                      <Icon>search</Icon>&nbsp;Search
                    </MDButton>
                  </Grid>
                </Grid>

                {/* Results Table */}
                <DataTable
                  table={{ columns, rows }}
                  canSearch={true}
                  entriesPerPage={true}
                  showTotalEntries={true}
                  pagination={true}
                  isSorted={true}
                  noEndBorder
                  exportFileName="Agreement-Prov-Invoice"
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
    </DashboardLayout>
  );
}
