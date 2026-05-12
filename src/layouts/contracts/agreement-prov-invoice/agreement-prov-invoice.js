import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import Divider from "@mui/material/Divider";
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
import { useMaterialUIController } from "context";
import jsPDF from "jspdf";
import { format, parseISO, isValid } from "date-fns";

const AGREEMENT_PROV_GRID_DATE_FALLBACK_KEYS = {
  contractStartDate: ["contractStartDate", "ContractStartDate"],
  contractEndDate: ["contractEndDate", "ContractEndDate"],
};

function parseAgreementProvGridDateYyyyMmDd(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = AGREEMENT_PROV_GRID_DATE_FALLBACK_KEYS[columnId] || [];
  if ((raw === undefined || raw === null || String(raw).trim() === "") && o && fallbacks.length) {
    for (let i = 0; i < fallbacks.length; i += 1) {
      const v = o[fallbacks[i]];
      if (v != null && String(v).trim() !== "") {
        raw = v;
        break;
      }
    }
  }
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const s = String(raw).trim();
  const isoHead = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoHead) return isoHead[1];
  try {
    const parsed = parseISO(s);
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
  } catch {
    // ignore invalid parseISO
  }
  const ts = Date.parse(s);
  if (!Number.isNaN(ts)) return format(new Date(ts), "yyyy-MM-dd");
  return null;
}

function agreementProvGridDateCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowD = parseAgreementProvGridDateYyyyMmDd(row, columnId);
    if (!rowD) return false;
    const { mode } = filterValue;
    if (mode === "gt") return Boolean(filterValue.date) && rowD > filterValue.date;
    if (mode === "lt") return Boolean(filterValue.date) && rowD < filterValue.date;
    if (mode === "between") {
      const { dateFrom, dateTo } = filterValue;
      if (!dateFrom || !dateTo) return false;
      const start = dateFrom <= dateTo ? dateFrom : dateTo;
      const end = dateFrom <= dateTo ? dateTo : dateFrom;
      return rowD >= start && rowD <= end;
    }
    return true;
  });
}

function AgreementProvDateColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Date";
  const modeLabelId = `agreement-prov-date-filter-mode-${column.id || "col"}`;

  const [anchorEl, setAnchorEl] = useState(null);
  const [mode, setMode] = useState("none");
  const [refDate, setRefDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const open = Boolean(anchorEl);

  useEffect(() => {
    if (!open) return;
    const fv = column.filterValue;
    if (!fv || fv.mode === undefined || fv.mode === "none") {
      setMode("none");
      setRefDate("");
      setEndDate("");
      return;
    }
    if (fv.mode === "between") {
      setMode("between");
      setRefDate(fv.dateFrom || "");
      setEndDate(fv.dateTo || "");
    } else {
      setMode(fv.mode === "gt" || fv.mode === "lt" ? fv.mode : "none");
      setRefDate(fv.date || "");
      setEndDate("");
    }
  }, [open, column.filterValue]);

  const handleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault?.();
      e.stopPropagation?.();
    }
    setAnchorEl(null);
  };

  const hasActiveFilter = Boolean(column.filterValue && column.filterValue.mode !== "none");

  const commit = () => {
    if (mode === "none") column.setFilter(undefined);
    else if (mode === "gt" || mode === "lt") {
      if (!refDate.trim()) return;
      column.setFilter({ mode, date: refDate });
    } else if (mode === "between") {
      if (!refDate.trim() || !endDate.trim()) return;
      const start = refDate <= endDate ? refDate : endDate;
      const finish = refDate <= endDate ? endDate : refDate;
      column.setFilter({ mode: "between", dateFrom: start, dateTo: finish });
    }
    handleClose();
  };

  const clearFilter = () => {
    column.setFilter(undefined);
    setMode("none");
    setRefDate("");
    setEndDate("");
    handleClose();
  };

  const inputSx = { width: "100%", fontSize: "0.8125rem" };

  return (
    <>
      <Tooltip title={`Filter by ${colLabel} date`}>
        <IconButton
          size="small"
          onClick={handleOpen}
          onMouseDown={(ev) => ev.stopPropagation()}
          sx={{
            fontSize: "10px",
            padding: "0px",
            minWidth: "14px",
            minHeight: "14px",
            color: hasActiveFilter ? "#1A73E8" : "#111111",
          }}
        >
          <Icon fontSize="inherit">filter_alt</Icon>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{ sx: { width: 300, px: 0.5 } }}
        MenuListProps={{ dense: true, onClick: (ev) => ev.stopPropagation(), autoFocus: false }}
      >
        <MDBox px={1.5} pt={1.5} pb={1} onClick={(ev) => ev.stopPropagation()}>
          <MDTypography variant="button" fontWeight="bold" display="block" sx={{ mb: 1 }}>
            {colLabel} filter
          </MDTypography>
          <FormControl size="small" fullWidth sx={{ mb: 1.5 }}>
            <InputLabel id={modeLabelId}>Comparison</InputLabel>
            <Select
              labelId={modeLabelId}
              label="Comparison"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <MenuItem value="none">No date filter</MenuItem>
              <MenuItem value="gt">Greater than (after)</MenuItem>
              <MenuItem value="lt">Less than (before)</MenuItem>
              <MenuItem value="between">Date range</MenuItem>
            </Select>
          </FormControl>
          {(mode === "gt" || mode === "lt") && (
            <MDTypography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
              Reference date
            </MDTypography>
          )}
          {(mode === "gt" || mode === "lt") && (
            <input
              type="date"
              value={refDate}
              onChange={(e) => setRefDate(e.target.value)}
              style={inputSx}
            />
          )}
          {mode === "between" && (
            <>
              <MDTypography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
                From date
              </MDTypography>
              <input
                type="date"
                value={refDate}
                onChange={(e) => setRefDate(e.target.value)}
                style={inputSx}
              />
              <MDTypography variant="caption" color="text" display="block" sx={{ mt: 1, mb: 0.5 }}>
                To date
              </MDTypography>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={inputSx}
              />
            </>
          )}
          <Divider sx={{ my: 1.5 }} />
          <MDBox display="flex" justifyContent="flex-end" gap={1}>
            <MDButton variant="outlined" color="secondary" size="small" onClick={clearFilter}>
              Clear
            </MDButton>
            <MDButton variant="gradient" color="info" size="small" onClick={commit}>
              Apply
            </MDButton>
          </MDBox>
        </MDBox>
      </Menu>
    </>
  );
}

AgreementProvDateColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const AGREEMENT_PROV_DATATABLE_DATE_FILTER_TYPES = Object.freeze({
  agreementProvDateCompare: agreementProvGridDateCompare,
});

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
          amountTotal:
            row.AmountTotal ?? row.amountTotal ?? row.TotalAmount ?? row.totalAmount ?? 0,
          amountReceived:
            row.AmountReceived ??
            row.amountReceived ??
            row.ReceivedAmount ??
            row.receivedAmount ??
            0,
          amountPending:
            row.AmountPending ?? row.amountPending ?? row.PendingAmount ?? row.pendingAmount ?? 0,
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

  // Format date for display as dd-MMM-yyyy (e.g., 10-Feb-2026)
  const formatDateDDMMMYYYY = (dateString) => {
    if (!dateString) return "-";
    const raw = String(dateString).trim();
    if (!raw) return "-";

    const monthShort = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    try {
      const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
      let day = "";
      let month = "";
      let year = "";

      // yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        [year, month, day] = datePart.split("-");
      }
      // dd-mm-yyyy
      else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
        [day, month, year] = datePart.split("-");
      } else {
        const parsed = new Date(raw);
        if (!Number.isFinite(parsed.getTime())) return raw;
        day = String(parsed.getDate()).padStart(2, "0");
        month = String(parsed.getMonth() + 1).padStart(2, "0");
        year = String(parsed.getFullYear());
      }

      const monthIndex = Number(month) - 1;
      const monthText = monthShort[monthIndex] || month;
      return `${String(day).padStart(2, "0")}-${monthText}-${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // Generate PDF for a contract row
  const generatePDF = (rowData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = margin;

    // Helper function to format date as dd-MMM-yyyy
    const formatDate = (dateString) => {
      if (!dateString) return "";
      try {
        const raw = String(dateString).trim();
        if (!raw) return "";
        const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
        const monthShort = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        let day = "";
        let month = "";
        let year = "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
          [year, month, day] = datePart.split("-");
        } else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
          [day, month, year] = datePart.split("-");
        } else {
          const date = new Date(dateString);
          if (!Number.isFinite(date.getTime())) return dateString;
          day = String(date.getDate()).padStart(2, "0");
          month = String(date.getMonth() + 1).padStart(2, "0");
          year = String(date.getFullYear());
        }
        const monthText = monthShort[Number(month) - 1] || month;
        return `${String(day).padStart(2, "0")}-${monthText}-${year}`;
      } catch (e) {
        return dateString;
      }
    };

    // Helper function to format currency
    const formatCurrency = (value) => {
      if (!value) return "0";
      return Number(value).toLocaleString("en-US");
    };

    // Load and add PAF Logo below Sales Invoice on left side
    const addLogoToPDF = () => {
      return new Promise((resolve) => {
        const logoPath = `${process.env.PUBLIC_URL || ""}/login_page/assets/img/PAF-Logo.gif`;
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          try {
            // Logo dimensions and position
            const logoWidth = 18; // Reduced size for better fit
            const logoHeight = (img.height / img.width) * logoWidth; // Maintain aspect ratio
            const logoX = margin; // Left aligned
            const logoY = margin + 4; // Move up to avoid text collision

            // Convert image to base64 and add to PDF
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0);
            const imgData = canvas.toDataURL("image/png");

            doc.addImage(imgData, "PNG", logoX, logoY, logoWidth, logoHeight);
            resolve();
          } catch (error) {
            console.error("Error adding logo to PDF:", error);
            resolve(); // Continue even if logo fails
          }
        };
        img.onerror = () => {
          console.error("Error loading logo image");
          resolve(); // Continue even if logo fails
        };
        img.src = logoPath;
      });
    };

    // Get contract data (handle both PascalCase and camelCase)
    const contractNo = rowData.ContractNo || rowData.contractNo || "";
    const businessName = rowData.BusinessName || rowData.businessName || "";
    const tenantNo = rowData.TenantNo || rowData.tenantNo || "";
    const contractStartDate = rowData.ContractStartDate || rowData.contractStartDate || "";
    const contractEndDate = rowData.ContractEndDate || rowData.contractEndDate || "";
    const commercialOpDate =
      rowData.CommercialOperationDate || rowData.commercialOperationDate || "";
    const tenantAddress = rowData.Address || rowData.address || "";
    const initialRentPM = rowData.InitialRentPM || rowData.initialRentPM || 0;
    const initialRentPA = rowData.InitialRentPA || rowData.initialRentPA || 0;
    const natureOfBusiness = rowData.NatureOfBusiness || rowData.natureOfBusiness || "";
    const cmdName = rowData.CmdName || rowData.cmdName || "";
    const baseName = rowData.BaseName || rowData.baseName || "";
    const className = rowData.ClassName || rowData.className || "";
    const term = rowData.Term || rowData.term || "";
    const paymentTermMonths = rowData.PaymentTermMonths || rowData.paymentTermMonths || "";
    const uoM = rowData.UoM || rowData.uoM || rowData.UnitName || rowData.unitName || "";
    const increaseIntervalMonths =
      rowData.IncreaseIntervalMonths || rowData.increaseIntervalMonths || "";
    const riseDate = rowData.RiseDate || rowData.riseDate || "";

    // Build PDF content function
    const buildPDFContent = (resolvedTenantAddress = "") => {
      // Top Left Section - Title "Sales Invoice"
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Sales Invoice", margin, margin + 2);

      let yPos = margin + 11;

      // Top Right Section - Invoice Details (dates and number)
      // Position text to the left of the logo (logo is 18mm wide + gap to prevent collision)
      const logoWidth = 18;
      const logoGap = 5; // Gap between logo and page edge
      const textLogoGap = 10; // Gap between text and logo to prevent collision
      const rightX = pageWidth - margin - logoWidth - logoGap - textLogoGap - 40; // Leave sufficient space for logo
      const invoiceInfoX = pageWidth / 2 - 12; // Keep invoice meta in center area
      const invoiceBlockStartY = margin + 2; // Start slightly below top to align with text baseline
      yPos = invoiceBlockStartY;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const invoiceDate = formatDate(commercialOpDate || contractStartDate);
      doc.text("Invoice date:", invoiceInfoX, yPos);
      yPos += 5;
      doc.text(`${invoiceDate}`, invoiceInfoX, yPos);
      yPos += 7;
      doc.text("Due date:", invoiceInfoX, yPos);
      yPos += 5;
      doc.text(`${invoiceDate}`, invoiceInfoX, yPos);
      yPos += 7;
      doc.text("Invoice number:", invoiceInfoX, yPos);
      yPos += 5;
      doc.text(`${contractNo}`, invoiceInfoX, yPos);

      // Top Right Section - Sender/Billing Entity Information (below invoice details)
      yPos = invoiceBlockStartY;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("General Admin Fund - Air HQs", rightX, yPos);
      yPos += 5;
      doc.setFont("helvetica", "normal");
      doc.text("Directorate of CNPF", rightX, yPos);
      yPos += 5;
      doc.text("Air Headquarters, Islamabad, Pakistan", rightX, yPos);
      yPos += 5;
      doc.text("Contact No: 051-9505187 Ext 5187, 5183, 5193, 5197", rightX, yPos);

      // Top Right Section - Bank Account Details (below sender info)
      yPos += 8;
      doc.setLineWidth(0.1);
      doc.line(rightX, yPos, rightX + 60, yPos);
      yPos += 5;
      doc.text("Title of Account = General Admin Fund", rightX, yPos);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      const clientInfo = `${contractNo}-${businessName}`;
      doc.text(clientInfo, margin, yPos + 1.5);
      yPos += 5;
      doc.text("IBAN = XXXXXXXXXXXXXXXXXXXXXXXX", rightX, yPos);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const tenantInfo = tenantNo ? `Tenant: ${tenantNo}` : "";
      if (tenantInfo) {
        doc.text(tenantInfo, margin, yPos + 2);
      }
      yPos += 5;
      const tenantAddressInfo = resolvedTenantAddress ? `Address: ${resolvedTenantAddress}` : "";
      if (tenantAddressInfo) {
        doc.text(tenantAddressInfo, margin, yPos);
      }
      yPos += 5;
      doc.text("Bank = Allied Bank E-9, PAF Complex Islamabad", rightX, yPos);

      // Bottom Section - Itemized Charges Table (move up to remove blank space)
      yPos += 10;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.text("Item", margin, yPos);
      doc.text("PM", margin + 40, yPos);
      doc.text("Unit price", margin + 70, yPos);
      doc.text("Total", margin + 120, yPos);

      yPos += 8;
      doc.setLineWidth(0.1);
      doc.line(margin, yPos, pageWidth - margin, yPos);

      yPos += 6;
      doc.setFont("helvetica", "normal");
      doc.text("MR Monthly Rent", margin, yPos);
      const pmMonths = paymentTermMonths || 12;
      doc.text(String(pmMonths), margin + 40, yPos);
      doc.text(formatCurrency(initialRentPM), margin + 70, yPos);
      const totalRent = Number(initialRentPM) * Number(pmMonths);
      doc.text(formatCurrency(totalRent), margin + 120, yPos);

      // Summary calculations - align to right
      yPos += 15;
      doc.setFont("helvetica", "bold");
      const totalX = pageWidth - margin - 50; // Right align
      doc.text(`Total: ${formatCurrency(totalRent)}`, totalX, yPos);
    };

    const resolveTenantAddress = async () => {
      const existingAddress = String(tenantAddress || "").trim();
      if (existingAddress) return existingAddress;
      const normalizedTenantNo = String(tenantNo || "").trim();
      if (!normalizedTenantNo) return "";
      try {
        const tenantsResponse = await api.list("tenant");
        const tenants = Array.isArray(tenantsResponse) ? tenantsResponse : [];
        const tenant = tenants.find(
          (t) => String(t?.tenantNo || t?.TenantNo || "").trim() === normalizedTenantNo
        );
        return String(tenant?.address || tenant?.Address || "").trim();
      } catch (error) {
        console.error("Error fetching tenant address:", error);
        return "";
      }
    };

    // Load logo first, then fetch tenant address, build content and open PDF
    addLogoToPDF().then(async () => {
      const resolvedTenantAddress = await resolveTenantAddress();
      buildPDFContent(resolvedTenantAddress);
      const pdfBlob = doc.output("blob");
      const pdfUrl = URL.createObjectURL(pdfBlob);
      window.open(pdfUrl, "_blank", "noopener,noreferrer");

      setTimeout(() => {
        URL.revokeObjectURL(pdfUrl);
      }, 60000);
    });
  };

  // Excel export cell formatter to format dates as dd-mmm-yyyy
  const exportCellFormatter = ({ value, column }) => {
    const colId = String(column?.id || "").toLowerCase();
    if (
      colId === "contractstartdate" ||
      colId === "contractenddate" ||
      colId === "applicabledate" ||
      colId === "applicationdate"
    ) {
      return formatDateDDMMMYYYY(value);
    }
    if (colId === "amounttotal" || colId === "amountreceived" || colId === "amountpending") {
      const n = Number(value);
      return Number.isFinite(n) ? n : 0;
    }
    return value;
  };

  const clickableAmountCellSx = {
    cursor: "pointer",
    color: "primary.main",
    textDecoration: "underline",
    fontFamily: "inherit",
    fontSize: "inherit",
    lineHeight: "inherit",
    background: "none",
    border: "none",
    padding: 0,
    "&:hover": { opacity: 0.85 },
  };

  // eslint-disable-next-line react/prop-types
  const renderClickableAmountCell = ({ value }) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return (
      <MDTypography
        component="button"
        type="button"
        variant="caption"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        sx={clickableAmountCellSx}
      >
        {safe.toLocaleString()}
      </MDTypography>
    );
  };

  // Define table columns with Cell functions to handle both PascalCase and camelCase
  const columns = [
    {
      Header: "View PDF",
      accessor: "generatePdf",
      align: "center",
      width: "100px",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        return (
          <IconButton
            onClick={() => generatePDF(rowData)}
            size="medium"
            sx={{
              padding: "4px",
              color: "#1976d2",
              "&:hover": {
                backgroundColor: "rgba(25, 118, 210, 0.1)",
              },
            }}
          >
            <Icon sx={{ fontSize: "1.35rem" }}>picture_as_pdf</Icon>
          </IconButton>
        );
      },
    },
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
      id: "contractStartDate",
      Header: "Contract Start Date",
      accessor: "contractStartDate",
      align: "left",
      filter: "agreementProvDateCompare",
      Filter: AgreementProvDateColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const dateValue = rowData.ContractStartDate || rowData.contractStartDate || value;
        return formatDateDDMMMYYYY(dateValue);
      },
    },
    {
      id: "contractEndDate",
      Header: "Contract End Date",
      accessor: "contractEndDate",
      align: "left",
      filter: "agreementProvDateCompare",
      Filter: AgreementProvDateColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const dateValue = rowData.ContractEndDate || rowData.contractEndDate || value;
        return formatDateDDMMMYYYY(dateValue);
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
      Header: "Total Amount",
      accessor: "amountTotal",
      align: "right",
      Cell: renderClickableAmountCell,
    },
    {
      Header: "Received",
      accessor: "amountReceived",
      align: "right",
      Cell: renderClickableAmountCell,
    },
    {
      Header: "Pending",
      accessor: "amountPending",
      align: "right",
      Cell: renderClickableAmountCell,
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
                  Agreement Invoice
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
                    <MDBox position="relative" sx={{ width: "100%" }}>
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
                      <MDBox
                        pointerEvents="none"
                        sx={{
                          position: "absolute",
                          left: 12,
                          right: 32,
                          top: 12,
                          bottom: 8,
                          display: "flex",
                          alignItems: "center",
                          color: "text.primary",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <MDTypography variant="button">
                          {filters.dateFrom ? formatDateDDMMMYYYY(filters.dateFrom) : ""}
                        </MDTypography>
                      </MDBox>
                    </MDBox>
                  </Grid>

                  <Grid item xs={12} sm={6} md={2.4}>
                    <MDBox position="relative" sx={{ width: "100%" }}>
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
                      <MDBox
                        pointerEvents="none"
                        sx={{
                          position: "absolute",
                          left: 12,
                          right: 32,
                          top: 12,
                          bottom: 8,
                          display: "flex",
                          alignItems: "center",
                          color: "text.primary",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <MDTypography variant="button">
                          {filters.dateTo ? formatDateDDMMMYYYY(filters.dateTo) : ""}
                        </MDTypography>
                      </MDBox>
                    </MDBox>
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
                <MDBox
                  sx={{
                    display: "flex",
                    flexDirection: "column",
                    height: "88vh",
                    minHeight: "680px",
                    overflow: "hidden",
                    "& .MuiTableContainer-root": {
                      flex: "1 1 0",
                      minHeight: 0,
                      overflow: "hidden",
                    },
                    "& .MuiTable-root": {
                      tableLayout: "fixed",
                      width: "100%",
                    },
                    "& .MuiTable-root th": {
                      fontSize: "1.0rem !important",
                      fontWeight: "700 !important",
                      padding: "8px 8px !important",
                      borderBottom: "1px solid #d0d0d0",
                    },
                    "& .MuiTable-root td": {
                      padding: "6px 8px !important",
                      borderBottom: "1px solid #e0e0e0",
                    },
                  }}
                >
                  <DataTable
                    table={{ columns, rows }}
                    stickyToolbarAndHeader
                    canSearch={true}
                    entriesPerPage={true}
                    showTotalEntries={true}
                    pagination={true}
                    isSorted={true}
                    noEndBorder
                    exportFileName="Agreement-Prov-Invoice"
                    exportCellFormatter={exportCellFormatter}
                    extraFilterTypes={AGREEMENT_PROV_DATATABLE_DATE_FILTER_TYPES}
                  />
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
    </DashboardLayout>
  );
}
