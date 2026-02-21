import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
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
import { useMaterialUIController } from "context";

export default function AgreementProvInvoice() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
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
        // Filter only active contracts (handle both PascalCase and camelCase)
        const activeContracts = contractsData.filter(
          (contract) =>
            contract.Status === true ||
            contract.Status === 1 ||
            contract.status === true ||
            contract.status === 1 ||
            contract.status === "Active" ||
            contract.Status === "Active"
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

      // Filter by criteria (handle both PascalCase and camelCase)
      if (filters.command) {
        contractsData = contractsData.filter(
          (c) =>
            Number(c.CmdId || c.cmdId) === Number(filters.command) ||
            Number(c.CmdID || c.cmdID) === Number(filters.command)
        );
      }
      if (filters.base) {
        contractsData = contractsData.filter(
          (c) =>
            Number(c.BaseId || c.baseId) === Number(filters.base) ||
            Number(c.BaseID || c.baseID) === Number(filters.base)
        );
      }
      if (filters.unit) {
        const selectedUnit = units.find((u) => u.id === filters.unit);
        const unitName = selectedUnit?.name || selectedUnit?.unitName || selectedUnit?.Name;
        if (unitName) {
          contractsData = contractsData.filter(
            (c) =>
              (c.UnitName || c.unitName || "") === unitName ||
              (c.UoM || c.uoM || "") === unitName ||
              (c.UOM || c.uom || "") === unitName ||
              (c.Unitname || c.unitname || "") === unitName ||
              (c.UoMName || c.uomName || "") === unitName
          );
        }
      }
      if (filters.dateFrom) {
        contractsData = contractsData.filter(
          (c) => (c.ContractStartDate || c.contractStartDate || "") >= filters.dateFrom
        );
      }
      if (filters.dateTo) {
        contractsData = contractsData.filter(
          (c) => (c.ContractEndDate || c.contractEndDate || "") <= filters.dateTo
        );
      }
      if (filters.contractNo) {
        const contractNoValue =
          filters.contractNo.contractNo || filters.contractNo.ContractNo || filters.contractNo;
        contractsData = contractsData.filter(
          (c) => (c.ContractNo || c.contractNo || "") === contractNoValue
        );
      }

      // Filter only active contracts
      contractsData = contractsData.filter(
        (contract) =>
          contract.Status === true ||
          contract.Status === 1 ||
          contract.status === true ||
          contract.status === 1 ||
          contract.status === "Active" ||
          contract.Status === "Active"
      );

      // Normalize data to handle both PascalCase (API response) and camelCase
      const normalizedRows = contractsData.map((row) => {
        return {
          ...row,
          // Create camelCase aliases for column accessors (PascalCase from API)
          id: row.Id || row.id,
          contractNo: row.ContractNo || row.contractNo || "",
          businessName: row.BusinessName || row.businessName || "",
          tenantNo: row.TenantNo || row.tenantNo || "",
          contractStartDate: row.ContractStartDate || row.contractStartDate || "",
          contractEndDate: row.ContractEndDate || row.contractEndDate || "",
          initialRentPM: row.InitialRentPM || row.initialRentPM || "",
          initialRentPA: row.InitialRentPA || row.initialRentPA || "",
          natureOfBusiness: row.NatureOfBusiness || row.natureOfBusiness || "",
          status: row.Status !== undefined ? row.Status : row.status,
        };
      });

      setRows(normalizedRows);
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

  // Define table columns with Cell functions to handle both PascalCase and camelCase
  const columns = [
    {
      Header: "Contract No",
      accessor: "contractNo",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        return rowData.ContractNo || rowData.contractNo || value || "-";
      },
    },
    {
      Header: "Business Name",
      accessor: "businessName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        return rowData.BusinessName || rowData.businessName || value || "-";
      },
    },
    {
      Header: "Tenant No",
      accessor: "tenantNo",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        return rowData.TenantNo || rowData.tenantNo || value || "-";
      },
    },
    {
      Header: "Contract Start Date",
      accessor: "contractStartDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const dateValue = rowData.ContractStartDate || rowData.contractStartDate || value;
        return formatDateDDMMYYYY(dateValue);
      },
    },
    {
      Header: "Contract End Date",
      accessor: "contractEndDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const dateValue = rowData.ContractEndDate || rowData.contractEndDate || value;
        return formatDateDDMMYYYY(dateValue);
      },
    },
    {
      Header: "Initial Rent PM",
      accessor: "initialRentPM",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const numValue = rowData.InitialRentPM || rowData.initialRentPM || value;
        return numValue ? Number(numValue).toLocaleString() : "-";
      },
    },
    {
      Header: "Initial Rent PA",
      accessor: "initialRentPA",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const numValue = rowData.InitialRentPA || rowData.initialRentPA || value;
        return numValue ? Number(numValue).toLocaleString() : "-";
      },
    },
    {
      Header: "Nature of Business",
      accessor: "natureOfBusiness",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        return rowData.NatureOfBusiness || rowData.natureOfBusiness || value || "-";
      },
    },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const statusValue =
          rowData.Status !== undefined
            ? rowData.Status
            : rowData.status !== undefined
            ? rowData.status
            : value;
        return <StatusBadge value={statusValue} />;
      },
    },
  ];

  // Unified styling for all filter inputs to ensure same size and symmetry
  // Add dark mode support for white text
  const baseFilterInputSx = {
    fontSize: "1rem",
    minHeight: "45px",
    "& .MuiInputBase-root": {
      minHeight: "45px",
      height: "45px",
    },
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "10px 12px",
      minHeight: "45px",
      height: "45px",
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
    "& .MuiInputBase-input": {
      fontSize: "1rem",
      padding: "10px 12px",
      minHeight: "45px",
      height: "45px",
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
    "& .MuiOutlinedInput-root": {
      minHeight: "45px",
      height: "45px",
    },
  };

  // Dark mode styling for filter inputs
  const darkModeFilterSx = darkMode
    ? {
        "& .MuiInputBase-input": {
          color: "#ffffff !important",
        },
        "& .MuiSelect-select": {
          color: "#ffffff !important",
        },
        "& .MuiInputLabel-root": {
          color: "#ffffff !important",
        },
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.3) !important",
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.5) !important",
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.7) !important",
        },
        "& .MuiSvgIcon-root": {
          color: "#ffffff !important",
        },
      }
    : {};

  const filterInputSx = { ...baseFilterInputSx, ...darkModeFilterSx };
  const selectSx = filterInputSx;
  const inputSx = filterInputSx;

  // Autocomplete specific styling to match other inputs
  const autocompleteSx = {
    "& .MuiInputBase-root": {
      minHeight: "45px",
      height: "45px",
    },
    "& .MuiInputBase-input": {
      fontSize: "1rem",
      padding: "10px 12px",
      minHeight: "45px",
      height: "45px",
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
      ...(darkMode ? { color: "#ffffff !important" } : {}),
    },
    ...(darkMode
      ? {
          "& .MuiInputLabel-root": {
            color: "#ffffff !important",
          },
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.3) !important",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.5) !important",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "rgba(255, 255, 255, 0.7) !important",
          },
        }
      : {}),
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
                {/* Filters Section - Symmetrical Layout */}
                <Grid container spacing={2} mb={3}>
                  {/* First Row: Command, Base, Unit, Date From, Date To */}
                  <Grid item xs={12} sm={6} md={2.4}>
                    <FormControl fullWidth size="small" sx={{ minHeight: "45px", height: "45px" }}>
                      <InputLabel
                        id="command-filter-label"
                        sx={darkMode ? { color: "#ffffff !important" } : {}}
                      >
                        Command
                      </InputLabel>
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
                    <FormControl
                      fullWidth
                      size="small"
                      disabled={!filters.command}
                      sx={{ minHeight: "45px", height: "45px" }}
                    >
                      <InputLabel
                        id="base-filter-label"
                        sx={darkMode ? { color: "#ffffff !important" } : {}}
                      >
                        Base
                      </InputLabel>
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
                    <FormControl fullWidth size="small" sx={{ minHeight: "45px", height: "45px" }}>
                      <InputLabel
                        id="unit-filter-label"
                        sx={darkMode ? { color: "#ffffff !important" } : {}}
                      >
                        Unit
                      </InputLabel>
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

                  {/* Second Row: Contract No and Search Button */}
                  <Grid item xs={8} sm={8} md={2}>
                    <Autocomplete
                      options={contracts}
                      getOptionLabel={(option) =>
                        option.ContractNo || option.contractNo || String(option)
                      }
                      value={
                        filters.contractNo
                          ? contracts.find(
                              (c) =>
                                (c.ContractNo || c.contractNo) ===
                                (filters.contractNo.ContractNo ||
                                  filters.contractNo.contractNo ||
                                  filters.contractNo)
                            ) || null
                          : null
                      }
                      onChange={(event, newValue) => {
                        handleFilterChange("contractNo", newValue);
                      }}
                      renderInput={(params) => (
                        <MDInput
                          {...params}
                          label="Contract No"
                          size="small"
                          sx={{ ...inputSx, ...autocompleteSx }}
                        />
                      )}
                      renderOption={(props, option) => (
                        <li
                          {...props}
                          key={option.Id || option.id || option.ContractNo || option.contractNo}
                        >
                          {option.ContractNo || option.contractNo}
                        </li>
                      )}
                      sx={autocompleteSx}
                    />
                  </Grid>

                  <Grid item xs={4} sm={4} md={2}>
                    <MDBox
                      display="flex"
                      alignItems="center"
                      justifyContent="center"
                      sx={{ height: "45px" }}
                    >
                      <IconButton
                        color="info"
                        onClick={handleSearch}
                        disabled={loading}
                        sx={{
                          minHeight: "45px",
                          height: "45px",
                          width: "45px",
                          backgroundColor: "info.main",
                          color: "white !important",
                          "& .MuiSvgIcon-root": {
                            color: "white !important",
                            fontWeight: "bold",
                            fontSize: "1.5rem",
                          },
                          "&:hover": {
                            backgroundColor: "info.light",
                            "& .MuiSvgIcon-root": {
                              color: "white !important",
                            },
                          },
                          "&:disabled": {
                            backgroundColor: "action.disabledBackground",
                            color: "action.disabled",
                            "& .MuiSvgIcon-root": {
                              color: "action.disabled",
                            },
                          },
                          boxShadow: 2,
                          transition: "all 0.3s ease",
                        }}
                        title="Search"
                      >
                        <Icon sx={{ fontWeight: "bold", fontSize: "1.5rem" }}>search</Icon>
                      </IconButton>
                    </MDBox>
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
