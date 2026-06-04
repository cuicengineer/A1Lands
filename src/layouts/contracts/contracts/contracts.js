import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import Popover from "@mui/material/Popover";
import Chip from "@mui/material/Chip";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import { GRID_DISPLAY_DEFAULT_PAGE_SIZE } from "utils/gridDisplayPageSize";
import CurrencyLoading from "components/CurrencyLoading";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import FormHelperText from "@mui/material/FormHelperText";
import Switch from "@mui/material/Switch";
import FormControlLabel from "@mui/material/FormControlLabel";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import api, {
  canCreateCurrentMenu,
  canEditCurrentMenu,
  canDeleteCurrentMenu,
  getActionBy,
  getUserIPAddress,
  contractsApprovalActionsBypassUser,
} from "services/api.service";
import contractApi from "services/api.contract.service";
import lockDateApi from "services/api.lockdate.service";
import uploadApi from "services/api.upload.service";
import propertyGroupingApi from "services/api.propertygrouping.service";
import rentalValueRateApi from "services/api.rentalvaluerate.service";
import govtShareRateApi from "services/api.govtsharerate.service";
import StatusBadge from "components/StatusBadge";
import GridValueChip from "components/GridValueChip";
import GridStatusChip from "components/GridStatusChip";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { PropertyGroupingForm } from "layouts/contracts/property-grouping/property-grouping";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ContractsModuleTabs from "layouts/contracts/components/ContractsModuleTabs";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import CompactGroupBySelect from "components/CompactGroupBySelect";
import CompactMultiSelectFilter from "components/CompactMultiSelectFilter";
import { useMaterialUIController } from "context";
import PropTypes from "prop-types";
import jsPDF from "jspdf";
import { addMonths, format, parseISO, isValid } from "date-fns";
import {
  hasContractsKpiGridFilters,
  readContractsUrlKpiFilters,
  resolveBaseNameById,
  resolveClassNameById,
  resolveCommandNameById,
} from "layouts/dashboard/kpi-overview/kpiOverviewNavigation";
import {
  AgreementProvContractBasicInfoStrip,
  AgreementProvInvoiceEditDialog,
  buildAgreementProvContractBasicInfoForm,
  getAgreementProvSaveErrorMessage,
  persistAllInvoiceScheduleLines,
} from "layouts/contracts/agreement-prov-invoice/agreement-prov-invoice";

/** API contract payload without identity — used to open the form as “New Contract” with prefills (clone). */
function stripContractForClone(contract) {
  if (!contract || typeof contract !== "object") return null;
  const c = { ...contract };
  delete c.Id;
  delete c.id;
  c.ContractNo = "";
  c.contractNo = "";
  const terms = c.ContractRiseTerms || c.contractRiseTerms;
  if (Array.isArray(terms)) {
    const mapped = terms.map((t) => {
      if (!t || typeof t !== "object") return t;
      const m = { ...t };
      delete m.Id;
      delete m.id;
      m.ContractID = null;
      m.contractID = null;
      return m;
    });
    c.ContractRiseTerms = mapped;
    c.contractRiseTerms = mapped;
  }
  return c;
}

function ContractGridLongTextCell({ value, matchGridPlainText = false }) {
  const [anchor, setAnchor] = useState(null);
  const text = value != null && String(value).trim() !== "" ? String(value).trim() : "-";
  const showMore = text !== "-" && text.length > 25;
  const displayText = showMore ? text.slice(0, 25) : text;

  const textSx = {
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "clip",
    whiteSpace: "nowrap",
    ...(matchGridPlainText
      ? {
          fontSize: "0.875rem",
          fontWeight: 400,
          lineHeight: "inherit",
          color: "#111111 !important",
        }
      : {}),
  };

  return (
    <MDBox display="flex" alignItems="center" gap={0.25} sx={{ maxWidth: "100%", minWidth: 0 }}>
      {matchGridPlainText ? (
        <MDBox component="span" sx={textSx}>
          {displayText}
        </MDBox>
      ) : (
        <MDTypography component="span" variant="body2" sx={textSx}>
          {displayText}
        </MDTypography>
      )}
      {showMore && (
        <>
          <MDBox
            component="button"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setAnchor(e.currentTarget);
            }}
            sx={{
              border: "none",
              background: "none",
              padding: "0 1px",
              cursor: "pointer",
              color: "info.main",
              fontSize: "0.8rem",
              lineHeight: 1.2,
              flexShrink: 0,
              textDecoration: "underline",
            }}
            aria-label="Show full value"
          >
            ...
          </MDBox>
          <Popover
            open={Boolean(anchor)}
            anchorEl={anchor}
            onClose={() => setAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
            PaperProps={{
              sx: { maxWidth: "min(92vw, 420px)", p: 1.5, boxShadow: 3, bgcolor: "#ffffff" },
            }}
          >
            <MDTypography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {text}
            </MDTypography>
          </Popover>
        </>
      )}
    </MDBox>
  );
}

ContractGridLongTextCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.oneOf([null])]),
  matchGridPlainText: PropTypes.bool,
};

const RISE_TERM_MONTHS_INTERVAL_OPTIONS = [
  6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72, 78, 84, 90, 96, 102, 108, 114, 120, 126, 132, 138,
  144, 150, 156, 162, 168, 174, 180, 186, 192, 198, 204, 210, 216, 222, 228, 234, 240, 246, 252,
  258, 264, 270, 276, 282, 288, 294, 300,
];

/** Months from CSD to CED (aligned with SQL DATEDIFF(MONTH, CSD, CED)). */
function getContractMonthsBetweenCsdAndCed(contractStartDate, contractEndDate) {
  const csd = String(contractStartDate || "").trim();
  const ced = String(contractEndDate || "").trim();
  if (!csd || !ced) return null;
  const start = new Date(`${csd}T00:00:00`);
  const end = new Date(`${ced}T00:00:00`);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime())) return null;
  if (end <= start) return 0;
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function isRiseMonthsIntervalWithinContractDuration(
  monthsInterval,
  contractStartDate,
  contractEndDate
) {
  const maxMonths = getContractMonthsBetweenCsdAndCed(contractStartDate, contractEndDate);
  if (maxMonths === null) return false;
  const mi = Number(monthsInterval);
  return Number.isFinite(mi) && mi > 0 && mi <= maxMonths;
}

const CONTRACT_PAYMENT_TERM_OPTIONS = [
  { value: 1, label: "Monthly" },
  { value: 3, label: "Quarterly" },
  { value: 6, label: "BiAnnual" },
  { value: 12, label: "Annual" },
];

const CONTRACT_SD_RATE_MONTH_VALUES = [1, 2, 3, 4, 6, 9, 12];

const CONTRACT_PAYMENT_TIMING_OPTIONS = ["Start", "End"];

function formatContractPaymentTermDisplay(months) {
  if (months === "" || months === null || months === undefined) return "";
  const n = Number(months);
  const match = CONTRACT_PAYMENT_TERM_OPTIONS.find((o) => o.value === n);
  if (match) return match.label;
  return String(months);
}

function formatContractSdRateDisplay(months) {
  if (months === "" || months === null || months === undefined) return "";
  const n = Number(months);
  if (!Number.isFinite(n)) return String(months);
  return `${n} Month${n === 1 ? "" : "s"}`;
}

function ContractsForm({
  open,
  onClose,
  onSubmit,
  initialData,
  isClone = false,
  commands,
  bases,
  classes,
  propertyGroups,
  tenants,
  natures,
  onPropertyGroupsRefresh,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [form, setForm] = useState({
    contractNo: "",
    cmdId: "",
    baseId: "",
    classId: "",
    grpId: "",
    tenantNo: "",
    businessName: "",
    natureOfBusiness: "",
    contractStartDate: "",
    contractEndDate: "",
    commercialOperationDate: "",
    initialRentPM: "",
    initialRentPA: "",
    paymentTermMonths: "",
    term: "",
    increaseRatePercent: "",
    increaseIntervalMonths: "",
    sdRateMonths: "",
    paymentTiming: "",
    dpc: "",
    signatory: "",
    securityDepositAmount: "",
    rentalValue: "",
    govtShare: "",
    pafShare: "",
    fiscal: "",
    status: true,
    isArchive: false,
    remarks: "",
    riseTermType: "",
    riseyear: "",
    risedate: "",
    vaArea: "",
    profitRate: "",
    approvalStatus: "0",
  });
  const [errors, setErrors] = useState({});
  const [filteredBases, setFilteredBases] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [filteredPropertyGroups, setFilteredPropertyGroups] = useState([]);

  // Rise Terms state
  const [riseTermsDialogOpen, setRiseTermsDialogOpen] = useState(false);
  const [riseTerms, setRiseTerms] = useState([]);
  const [editingRiseTermIndex, setEditingRiseTermIndex] = useState(null);
  const [riseTermForm, setRiseTermForm] = useState({
    monthsInterval: "",
    risePercent: "",
    sequenceNo: "",
  });
  const [riseTermErrors, setRiseTermErrors] = useState({});

  // Contracts dialog state
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [activeContracts, setActiveContracts] = useState([]);
  const [loadingContracts, setLoadingContracts] = useState(false);

  // Form loading state
  const [formLoading, setFormLoading] = useState(false);

  // Property Grouping form state
  const [propertyGroupingFormOpen, setPropertyGroupingFormOpen] = useState(false);
  const [rentalProperties, setRentalProperties] = useState([]);
  const [allPropertyGroupings, setAllPropertyGroupings] = useState([]);
  const [rentalValueRates, setRentalValueRates] = useState([]);
  const [govtShareRates, setGovtShareRates] = useState([]);

  const contractStartDateInputRef = useRef(null);
  const contractEndDateInputRef = useRef(null);
  const commercialOperationDateInputRef = useRef(null);
  const riseDateInputRef = useRef(null);

  const toDisplayDate = (isoStr) => {
    if (!isoStr || typeof isoStr !== "string") return "";
    const trimmed = isoStr.trim();
    if (!trimmed) return "";
    try {
      const d = parseISO(trimmed);
      return isValid(d) ? format(d, "dd-MMM-yyyy") : trimmed;
    } catch {
      return trimmed;
    }
  };

  const openDatePicker = (ref) => {
    const el = ref?.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.click();
      }
    } catch (_) {
      try {
        el.click();
      } catch (_e) {
        // ignore
      }
    }
  };

  const normalizeRiseTermType = (value) => {
    if (!value) return "";
    const token = String(value).trim().toLowerCase();
    if (!token) return "";
    if (token.includes("uniform")) return "Uniform";
    if (token.includes("fixed")) return "Fixed Date";
    if (token.includes("increase") || token.includes("variable")) return "Variable";
    // Fallback: return original trimmed value so it at least shows in the UI if it matches exactly
    return String(value).trim();
  };

  useEffect(() => {
    // Set loading when form opens with initialData (edit mode)
    if (open && initialData) {
      setFormLoading(true);
    } else if (open && !initialData) {
      // New form - no loading needed
      setFormLoading(false);
    }

    if (initialData) {
      // Use only PascalCase (strict API response format)
      const rawRiseType = initialData.RiseTermType || "";
      const rawRiseYear = initialData.RiseYear ?? null;
      const rawRiseDate = initialData.RiseDate ?? null;

      const normalizedRiseYear = rawRiseYear !== null ? String(rawRiseYear) : "";
      const normalizedRiseDate =
        rawRiseDate !== null && String(rawRiseDate).trim() !== ""
          ? String(rawRiseDate).split("T")[0].slice(0, 10)
          : "";

      const rawGovtShare = initialData.GovtShare ?? 0;

      setForm({
        contractNo: initialData.ContractNo || "",
        cmdId: initialData.CmdId || "",
        baseId: initialData.BaseId || "",
        classId: initialData.ClassId || "",
        grpId: initialData.GrpId || "",
        tenantNo: initialData.TenantNo || "",
        businessName: initialData.BusinessName || "",
        natureOfBusiness: initialData.NatureOfBusiness || "",
        contractStartDate: initialData.ContractStartDate
          ? initialData.ContractStartDate.split("T")[0]
          : "",
        contractEndDate: initialData.ContractEndDate
          ? initialData.ContractEndDate.split("T")[0]
          : "",
        commercialOperationDate: initialData.CommercialOperationDate
          ? initialData.CommercialOperationDate.split("T")[0]
          : "",
        initialRentPM: initialData.InitialRentPM || "",
        initialRentPA:
          initialData.InitialRentPA !== "" &&
          initialData.InitialRentPA != null &&
          !Number.isNaN(Number(initialData.InitialRentPA))
            ? String(Math.round(Number(initialData.InitialRentPA)))
            : initialData.InitialRentPA || "",
        paymentTermMonths: initialData.PaymentTermMonths || "",
        term: initialData.Term || "",
        increaseRatePercent: initialData.IncreaseRatePercent || "",
        increaseIntervalMonths: initialData.IncreaseIntervalMonths || "",
        sdRateMonths: initialData.SDRateMonths || "",
        paymentTiming: initialData.PaymentTiming || initialData.paymentTiming || "",
        dpc:
          initialData.Dpc !== undefined && initialData.Dpc !== null
            ? String(initialData.Dpc)
            : initialData.dpc !== undefined && initialData.dpc !== null
            ? String(initialData.dpc)
            : initialData.DPC !== undefined && initialData.DPC !== null
            ? String(initialData.DPC)
            : "",
        signatory:
          initialData.Signatory !== undefined && initialData.Signatory !== null
            ? String(initialData.Signatory)
            : initialData.signatory !== undefined && initialData.signatory !== null
            ? String(initialData.signatory)
            : "",
        securityDepositAmount:
          initialData.SecurityDepositAmount !== "" &&
          initialData.SecurityDepositAmount != null &&
          !Number.isNaN(Number(initialData.SecurityDepositAmount))
            ? String(Math.round(Number(initialData.SecurityDepositAmount)))
            : initialData.SecurityDepositAmount || "",
        rentalValue:
          initialData.RentalValue !== "" &&
          initialData.RentalValue != null &&
          !Number.isNaN(Number(initialData.RentalValue))
            ? String(Math.round(Number(initialData.RentalValue)))
            : initialData.RentalValue || "",
        govtShare: Math.round(Number(rawGovtShare || 0)),
        pafShare:
          initialData.PAFShare !== "" &&
          initialData.PAFShare != null &&
          !Number.isNaN(Number(initialData.PAFShare))
            ? String(Math.round(Number(initialData.PAFShare)))
            : initialData.PAFShare || "",
        fiscal: initialData.Fiscal ?? initialData.fiscal ?? "",
        status: initialData.Status !== undefined ? initialData.Status : true,
        isArchive:
          initialData.IsArchive !== undefined && initialData.IsArchive !== null
            ? Boolean(initialData.IsArchive)
            : false,
        remarks: initialData.Remarks || "",
        riseTermType: normalizeRiseTermType(rawRiseType),
        riseyear: normalizedRiseYear,
        risedate: normalizedRiseDate,
        vaArea: initialData.VaArea || "",
        profitRate: initialData.ProfitRate ?? initialData.profitRate ?? "",
        approvalStatus:
          initialData.ApprovalStatus === true ||
          initialData.ApprovalStatus === 1 ||
          initialData.ApprovalStatus === "1" ||
          initialData.approvalStatus === true ||
          initialData.approvalStatus === 1 ||
          initialData.approvalStatus === "1"
            ? "1"
            : "0",
      });

      // Initialize riseTerms list from existing contract rise terms, if any
      const rawRiseTerms = initialData.ContractRiseTerms || [];
      if (Array.isArray(rawRiseTerms) && rawRiseTerms.length > 0) {
        const normalizedRiseTerms = rawRiseTerms
          .map((t) => {
            const monthsInterval = t.MonthsInterval ?? null;
            const risePercent = t.RisePercent ?? null;
            const sequenceNo = t.SequenceNo ?? null;
            const contractID = t.ContractID ?? null;
            const isDeleted = t.IsDeleted ?? null;
            const id = t.Id ?? null;

            if (monthsInterval === null || risePercent === null || sequenceNo === null) {
              return null;
            }

            return {
              id: id ? Number(id) : null,
              monthsInterval: String(monthsInterval),
              risePercent: String(risePercent),
              sequenceNo: String(sequenceNo),
              contractID: contractID ? Number(contractID) : null,
              isDeleted: isDeleted !== null && isDeleted !== undefined ? Boolean(isDeleted) : null,
            };
          })
          .filter(Boolean);

        setRiseTerms(normalizedRiseTerms);
      } else {
        setRiseTerms([]);
      }

      // Data loaded, turn off loading after a small delay to ensure all state updates complete
      setTimeout(() => {
        setFormLoading(false);
      }, 100);
    } else {
      setForm({
        contractNo: "",
        cmdId: "",
        baseId: "",
        classId: "",
        grpId: "",
        tenantNo: "",
        businessName: "",
        natureOfBusiness: "",
        contractStartDate: "",
        contractEndDate: "",
        commercialOperationDate: "",
        initialRentPM: "",
        initialRentPA: "",
        paymentTermMonths: "",
        term: "",
        increaseRatePercent: "",
        increaseIntervalMonths: "",
        sdRateMonths: "",
        paymentTiming: "",
        dpc: "",
        signatory: "",
        securityDepositAmount: "",
        rentalValue: "",
        govtShare: "",
        pafShare: "",
        fiscal: "",
        status: true,
        isArchive: false,
        remarks: "",
        riseTermType: "",
        riseyear: "",
        risedate: "",
        vaArea: "",
        profitRate: "",
        approvalStatus: "0",
      });
      // Reset rise terms when opening new form
      setRiseTerms([]);
      setFormLoading(false);
    }
    setErrors({});
  }, [initialData, open]);

  // Filter bases based on selected command
  useEffect(() => {
    if (form.cmdId && bases.length > 0) {
      const filtered = bases.filter((base) => Number(base.cmd) === Number(form.cmdId));
      setFilteredBases(filtered);
      if (form.baseId && !filtered.find((b) => b.id === form.baseId)) {
        setForm((prev) => ({ ...prev, baseId: "" }));
      }
    } else {
      setFilteredBases([]);
    }
  }, [form.cmdId, bases]);

  // Show all classes (not filtered by base)
  useEffect(() => {
    if (classes.length > 0) {
      setFilteredClasses(classes);
    } else {
      setFilteredClasses([]);
    }
  }, [classes]);

  // Filter property groups based on selected command, base, and class
  useEffect(() => {
    if (form.cmdId && form.baseId && form.classId && propertyGroups.length > 0) {
      const filtered = propertyGroups.filter(
        (pg) =>
          Number(pg.CmdId || pg.cmdId) === Number(form.cmdId) &&
          Number(pg.BaseId || pg.baseId) === Number(form.baseId) &&
          Number(pg.ClassId || pg.classId) === Number(form.classId)
      );
      setFilteredPropertyGroups(filtered);
      if (form.grpId && !filtered.find((pg) => (pg.Id || pg.id) === form.grpId)) {
        setForm((prev) => ({ ...prev, grpId: "" }));
      }
    } else {
      setFilteredPropertyGroups([]);
    }
  }, [form.cmdId, form.baseId, form.classId, propertyGroups]);

  // Auto-calculate initialRentPA when initialRentPM changes (rounded to integer)
  useEffect(() => {
    if (initialData && !isClone) return;
    const initialRent = Number(form.initialRentPM);

    if (initialRent && !isNaN(initialRent)) {
      const calculated = Math.round(initialRent * 12);
      setForm((prev) => ({
        ...prev,
        initialRentPA: String(calculated),
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        initialRentPA: "",
      }));
    }
  }, [form.initialRentPM, initialData, isClone]);

  // Auto-calculate securityDepositAmount when sdRateMonths or initialRentPM changes (rounded to integer)
  useEffect(() => {
    if (initialData && !isClone) return;
    const sdRate = Number(form.sdRateMonths);
    const initialRent = Number(form.initialRentPM);

    if (sdRate && initialRent && !isNaN(sdRate) && !isNaN(initialRent)) {
      const calculated = Math.round(sdRate * initialRent);
      setForm((prev) => ({
        ...prev,
        securityDepositAmount: String(calculated),
      }));
    } else if ((!sdRate || isNaN(sdRate)) && (!initialRent || isNaN(initialRent))) {
      setForm((prev) => ({
        ...prev,
        securityDepositAmount: "",
      }));
    }
  }, [form.sdRateMonths, form.initialRentPM, initialData, isClone]);

  // Load Rental Value Rate (%) records when form opens.
  useEffect(() => {
    if (!open) return;
    const fetchRentalValueRates = async () => {
      try {
        const response = await rentalValueRateApi.getAll(1, 10000);
        const list =
          response && response.pagination
            ? response.data || []
            : Array.isArray(response)
            ? response
            : [];
        setRentalValueRates(list);
      } catch (error) {
        console.error("Error fetching rental value rates:", error);
        setRentalValueRates([]);
      }
    };
    fetchRentalValueRates();
  }, [open]);

  // Load Govt Share Rate (%) records when form opens.
  useEffect(() => {
    if (!open) return;
    const fetchGovtShareRates = async () => {
      try {
        const response = await govtShareRateApi.getAll(1, 10000);
        const list =
          response && response.pagination
            ? response.data || []
            : Array.isArray(response)
            ? response
            : [];
        setGovtShareRates(list);
      } catch (error) {
        console.error("Error fetching govt share rates:", error);
        setGovtShareRates([]);
      }
    };
    fetchGovtShareRates();
  }, [open]);

  const handleChange = (field, value) => {
    // Prevent manual editing of auto-calculated fields
    if (
      field === "securityDepositAmount" ||
      field === "initialRentPA" ||
      field === "rentalValue" ||
      field === "govtShare" ||
      field === "pafShare"
    ) {
      return;
    }

    if (field === "dpc") {
      const nextValue = String(value ?? "");
      if (nextValue !== "" && !/^\d+(\.\d{0,2})?$/.test(nextValue)) {
        return;
      }
    }

    setForm((prev) => {
      const updated = {
        ...prev,
        [field]: value,
        // Clear related fields when riseTermType changes
        ...(field === "riseTermType" && {
          riseyear: "",
          risedate: "",
          increaseIntervalMonths: "",
        }),
        // If selected Term does not contain "Rent", keep rent-increase fields empty
        ...(field === "term" &&
          !String(value || "")
            .toLowerCase()
            .includes("rent") && {
            increaseRatePercent: "",
            increaseIntervalMonths: "",
          }),
      };

      // If start date changes and end date is now invalid, clear end date
      if (field === "contractStartDate" && updated.contractEndDate) {
        if (updated.contractEndDate <= value) {
          updated.contractEndDate = "";
        }
      }
      // Auto-fill COD with selected CSD. User can still manually change COD afterwards.
      if (field === "contractStartDate") {
        updated.commercialOperationDate = value || "";
      }
      // In New (or clone) mode, auto-fill Business Name when Tenant No is selected.
      if (field === "tenantNo" && (!initialData || isClone)) {
        const selectedTenant = tenants.find(
          (t) => String(t?.tenantNo ?? "").trim() === String(value || "").trim()
        );
        updated.businessName = selectedTenant?.businessName ?? selectedTenant?.BusinessName ?? "";
      }

      // If start date or end date changes, validate commercial operation date
      if (
        (field === "contractStartDate" || field === "contractEndDate") &&
        updated.commercialOperationDate
      ) {
        if (
          updated.contractStartDate &&
          updated.contractEndDate &&
          (updated.commercialOperationDate < updated.contractStartDate ||
            updated.commercialOperationDate > updated.contractEndDate)
        ) {
          updated.commercialOperationDate = "";
        }
      }

      return updated;
    });

    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }

    // Clear rise terms when switching away from Variable
    if (field === "riseTermType" && value !== "Variable") {
      setRiseTerms([]);
    }

    // When Group ID is selected, fetch active contracts for that group
    if (field === "grpId" && value) {
      const selectedGroup = filteredPropertyGroups.find((pg) => pg.id === Number(value));
      if (selectedGroup && selectedGroup.gId) {
        fetchActiveContractsByGroupId(selectedGroup.gId);
      }
    }
  };

  // Fetch active contracts by Group ID
  const fetchActiveContractsByGroupId = async (groupId) => {
    if (!groupId || !groupId.trim()) {
      setActiveContracts([]);
      return;
    }

    setLoadingContracts(true);
    try {
      // Call API endpoint to search contracts by group name
      const response = await contractApi.searchByGrpName(groupId.trim());

      // Handle response - could be array or object with data property
      const contracts = response?.data || (Array.isArray(response) ? response : []);

      setActiveContracts(contracts);
      setContractsDialogOpen(true);
    } catch (error) {
      console.error("Error fetching contracts by Group ID:", error);
      setActiveContracts([]);
      alert("Error fetching contracts. Please try again.");
    } finally {
      setLoadingContracts(false);
    }
  };

  // Fetch rental properties and all property groupings for PropertyGroupingForm
  useEffect(() => {
    if (propertyGroupingFormOpen) {
      const fetchRentalProperties = async () => {
        try {
          const response = await api.list("rentalproperty");
          setRentalProperties(response);
        } catch (error) {
          console.error("Error fetching rental properties:", error);
        }
      };
      const fetchAllPropertyGroupings = async () => {
        try {
          // Fetch a large number to get all records for validation
          const response = await propertyGroupingApi.getAllRecords();
          const data = response?.data ?? (Array.isArray(response) ? response : []);
          setAllPropertyGroupings(Array.isArray(data) ? data : []);
        } catch (error) {
          console.error("Error fetching all property groupings:", error);
          setAllPropertyGroupings([]);
        }
      };
      if (rentalProperties.length === 0) {
        fetchRentalProperties();
      }
      fetchAllPropertyGroupings();
    }
  }, [propertyGroupingFormOpen, rentalProperties.length]);

  // Handle Property Grouping form save
  const handlePropertyGroupingSave = async (formData) => {
    try {
      const formattedData = {
        cmdId: Number(formData.cmdid),
        baseId: Number(formData.baseid),
        classId: Number(formData.classid),
        gId: formData.gId || "",
        location: formData.location || "",
        area: Number(formData.area) || 0,
        remarks: formData.remarks || "",
        property: formData.property.join(", "),
        PropertyGroupLinkings: formData.property.map((propId) => Number(propId)),
        status: Boolean(formData.status),
        isDeleted: Boolean(formData.isDeleted),
      };

      await propertyGroupingApi.create(formattedData);
      setPropertyGroupingFormOpen(false);

      // Refresh property groups list
      if (onPropertyGroupsRefresh) {
        onPropertyGroupsRefresh();
      }
    } catch (error) {
      console.error("Error saving property grouping:", error);
      alert("Failed to save property grouping. Please try again.");
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.contractNo?.trim()) newErrors.contractNo = "Contract No is required";
    if (!form.cmdId) newErrors.cmdId = "Command is required";
    if (!form.baseId) newErrors.baseId = "Base is required";
    if (!form.classId) newErrors.classId = "Class is required";
    if (!form.grpId) newErrors.grpId = "Group is required";
    if (!form.tenantNo?.trim()) newErrors.tenantNo = "Tenant No is required";
    if (!form.businessName?.trim()) newErrors.businessName = "Business Name is required";
    if (!form.natureOfBusiness?.trim())
      newErrors.natureOfBusiness = "Nature of Business is required";
    if (!form.contractStartDate) newErrors.contractStartDate = "Contract Start Date is required";
    if (!form.contractEndDate) newErrors.contractEndDate = "Contract End Date is required";
    if (
      form.contractStartDate &&
      form.contractEndDate &&
      form.contractEndDate <= form.contractStartDate
    ) {
      newErrors.contractEndDate = "Contract End Date must be greater than Contract Start Date";
    }
    if (form.commercialOperationDate && form.contractStartDate && form.contractEndDate) {
      if (form.commercialOperationDate < form.contractStartDate) {
        newErrors.commercialOperationDate =
          "Commercial Operation Date must be on or after Contract Start Date";
      } else if (form.commercialOperationDate > form.contractEndDate) {
        newErrors.commercialOperationDate =
          "Commercial Operation Date must be on or before Contract End Date";
      }
    }
    const isNewContractForm = !initialData || isClone;
    const hasRentInTermValidate = String(form.term || "")
      .toLowerCase()
      .includes("rent");
    const needsProfitRate = form.term && String(form.term).trim().toLowerCase() !== "rent";

    if (isNewContractForm) {
      if (!form.term?.trim()) newErrors.term = "Term is required";
      if (form.dpc == null || String(form.dpc).trim() === "") {
        newErrors.dpc = "DPC per day is required";
      }
      if (needsProfitRate && (form.profitRate == null || String(form.profitRate).trim() === "")) {
        newErrors.profitRate = "Profit Rate is required";
      }
      if (hasRentInTermValidate) {
        if (!form.riseTermType?.trim()) {
          newErrors.riseTermType = "Rise Terms is required";
        } else if (form.riseTermType === "Variable") {
          if (!riseTerms.length) {
            newErrors.riseTerms = "At least one variable rise term is required";
          }
        } else {
          if (!form.increaseRatePercent) {
            newErrors.increaseRatePercent = "Increase Rate Percent is required";
          }
          if (form.riseTermType === "Uniform" && !form.increaseIntervalMonths) {
            newErrors.increaseIntervalMonths = "Increase Interval Months is required";
          }
        }
      }
    }

    if (form.riseTermType === "Fixed Date") {
      if (!form.risedate?.trim()) {
        newErrors.risedate = "Rise Date is required";
      } else if (form.contractStartDate && form.contractEndDate) {
        if (form.risedate < form.contractStartDate) {
          newErrors.risedate = "Rise Date must be on or after Contract Start Date";
        } else if (form.risedate > form.contractEndDate) {
          newErrors.risedate = "Rise Date must be on or before Contract End Date";
        }
      }
    }
    if (!form.initialRentPM) newErrors.initialRentPM = "Initial Rent PM is required";
    // initialRentPA is auto-calculated, no validation needed
    if (!form.paymentTermMonths) newErrors.paymentTermMonths = "Payment Term is required";
    if (!form.sdRateMonths) newErrors.sdRateMonths = "SD Rate is required";
    if (!form.paymentTiming) newErrors.paymentTiming = "Payment Timing is required";
    if (form.remarks && form.remarks.length > 500) {
      newErrors.remarks = "Remarks cannot exceed 500 characters";
    }
    if (form.signatory && form.signatory.length > 250) {
      newErrors.signatory = "Signatory cannot exceed 250 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    const hasRentInTerm = String(form.term || "")
      .toLowerCase()
      .includes("rent");
    const initialApprovalRaw = initialData?.ApprovalStatus ?? initialData?.approvalStatus;
    const initialApprovalValue =
      initialApprovalRaw === true || initialApprovalRaw === 1 || initialApprovalRaw === "1"
        ? "1"
        : "0";
    const approvalStatusChanged = form.approvalStatus !== initialApprovalValue;
    const storedFeasibleValue = (() => {
      const raw =
        initialData?.Viability ??
        initialData?.viability ??
        initialData?.Feasible ??
        initialData?.feasible ??
        "";
      const trimmed = String(raw || "").trim();
      if (!trimmed) return "";
      const lower = trimmed.toLowerCase();
      if (lower === "viable") return "Viable";
      if (lower === "unviable") return "Unviable";
      return trimmed;
    })();

    const payload = {
      contractNo: form.contractNo.trim(),
      cmdId: Number(form.cmdId),
      baseId: Number(form.baseId),
      classId: Number(form.classId),
      grpId: Number(form.grpId),
      tenantNo: form.tenantNo.trim(),
      businessName: form.businessName.trim(),
      natureOfBusiness: form.natureOfBusiness.trim(),
      contractStartDate: form.contractStartDate,
      contractEndDate: form.contractEndDate,
      commercialOperationDate: form.commercialOperationDate || null,
      initialRentPM: form.initialRentPM ? Number(form.initialRentPM) : null,
      initialRentPA: form.initialRentPA ? Number(form.initialRentPA) : null,
      paymentTermMonths: form.paymentTermMonths ? Number(form.paymentTermMonths) : null,
      term: form.term || null,
      profitRate:
        form.term &&
        String(form.term).toLowerCase() !== "rent" &&
        form.profitRate != null &&
        String(form.profitRate).trim() !== ""
          ? String(form.profitRate).trim()
          : null,
      increaseRatePercent:
        hasRentInTerm && form.increaseRatePercent ? Number(form.increaseRatePercent) : null,
      increaseIntervalMonths:
        !hasRentInTerm || form.riseTermType === "Variable"
          ? null
          : form.increaseIntervalMonths
          ? Number(form.increaseIntervalMonths)
          : null,
      sdRateMonths: form.sdRateMonths ? Number(form.sdRateMonths) : null,
      paymentTiming: form.paymentTiming || null,
      PaymentTiming: form.paymentTiming || null,
      dpc: form.dpc != null && String(form.dpc).trim() !== "" ? Number(form.dpc) : null,
      signatory: form.signatory?.trim() || null,
      securityDepositAmount: form.securityDepositAmount ? Number(form.securityDepositAmount) : null,
      rentalValue: form.rentalValue ? Number(form.rentalValue) : null,
      govtShare: form.govtShare ? Number(form.govtShare) : null,
      pafShare: form.pafShare ? Number(form.pafShare) : null,
      feasible:
        initialData && !isClone && storedFeasibleValue
          ? storedFeasibleValue
          : Number(form.initialRentPA || 0) > Number(form.govtShare || 0)
          ? "Unviable"
          : "Viable",
      status: form.status,
      IsArchive: Boolean(form.isArchive),
      remarks: form.remarks?.trim() || null,
      ...(canShowAhqApprovalField && {
        ApprovalStatus: form.approvalStatus === "1",
        ...(approvalStatusChanged && {
          ApprovedBy: api.getLoggedInUsername(),
        }),
      }),
      riseTermType: form.riseTermType || null,
      riseyear:
        form.riseTermType === "Variable" || form.riseTermType === "Uniform"
          ? null
          : form.riseyear
          ? Number(form.riseyear)
          : null,
      // If Fixed Date is selected, include risedate
      ...(form.riseTermType === "Fixed Date" && {
        risedate: form.risedate || null,
      }),
      // Group Area, Group Rate, Rental Value Rate, and VA Area
      GroupArea: Number(selectedGroupArea) || null,
      GroupRate: Number(selectedGroupRate) || null,
      RentalValueRate: Number(selectedRentalValuePercentRate) || null,
      VaArea: form.vaArea ? Number(form.vaArea) : null,
      // If Variable is selected, include contractRiseTerms
      ...(form.riseTermType === "Variable" && {
        contractRiseTerms:
          riseTerms.length > 0
            ? riseTerms.map((term) => {
                // Get contract ID from initialData if editing, otherwise use term's existing contractID
                const contractID =
                  initialData?.id ??
                  initialData?.Id ??
                  initialData?.contractID ??
                  initialData?.ContractID ??
                  term.contractID ??
                  null;

                // Preserve existing isDeleted value, or set to false for new terms
                const isDeletedValue =
                  term.isDeleted !== null && term.isDeleted !== undefined
                    ? Boolean(term.isDeleted)
                    : false;

                return {
                  contractID: contractID ? Number(contractID) : 0,
                  monthsInterval: Number(term.monthsInterval),
                  risePercent: Number(term.risePercent),
                  sequenceNo: Number(term.sequenceNo),
                  status: 1, // true
                  action: contractID ? "update" : "create",
                  actionBy: null,
                  actionDate: null,
                  isDeleted: isDeletedValue,
                };
              })
            : [],
      }),
    };

    try {
      await onSubmit(payload);
    } catch (err) {
      console.error("Contract save failed:", err);
      alert("Failure: Contract could not be saved. Please try again.");
    }
  };

  const selectedPropertyGroup = filteredPropertyGroups.find(
    (pg) => Number(pg.Id || pg.id) === Number(form.grpId)
  );
  const isContractNoMissing = !form.contractNo?.trim();
  const hasTenantSelection = Boolean(String(form.tenantNo || "").trim());
  const selectedTenant = useMemo(() => {
    if (!hasTenantSelection) return null;
    const selectedTenantNo = String(form.tenantNo).trim();
    return tenants.find((t) => String(t?.tenantNo ?? "").trim() === selectedTenantNo) || null;
  }, [tenants, form.tenantNo, hasTenantSelection]);

  const canShowAhqApprovalField = useMemo(() => {
    if (!initialData || isClone) return false;
    if (api.isSuperuserUser()) return true;

    try {
      const raw = localStorage.getItem("auth");
      if (!raw) return false;
      const auth = JSON.parse(raw);
      const normalize = (value) =>
        String(value || "")
          .trim()
          .toLowerCase()
          .replace(/\s+/g, "");

      /* Match contractsApprovalActionsBypassUser string fields — some sessions only populate IDs when Base is null. */
      const hasAhqRacStrings = [
        auth?.cmdName,
        auth?.CmdName,
        auth?.commandName,
        auth?.CommandName,
        auth?.rac,
        auth?.Rac,
        auth?.racName,
        auth?.RacName,
        auth?.baseName,
        auth?.BaseName,
        auth?.base,
        auth?.Base,
      ].some((value) => normalize(value) === "ahq");

      const ahqCommandIds = new Set(
        (commands || [])
          .filter((cmd) => {
            const label = normalize(
              cmd?.name ?? cmd?.Name ?? cmd?.commandName ?? cmd?.CommandName ?? ""
            );
            const shortCode = normalize(cmd?.code ?? cmd?.Code ?? "");
            return label === "ahq" || shortCode === "ahq";
          })
          .map((cmd) => Number(cmd?.id ?? cmd?.Id))
          .filter((n) => Number.isFinite(n))
      );

      const sessionCmdIds = [
        auth?.cmdId,
        auth?.CmdId,
        auth?.commandId,
        auth?.CommandId,
        auth?.racId,
        auth?.RacId,
      ];

      const hasAhqRacIds =
        ahqCommandIds.size > 0 &&
        sessionCmdIds.some((v) => v != null && ahqCommandIds.has(Number(v)));

      const hasAhqRac = hasAhqRacStrings || hasAhqRacIds;

      const categoryTokens = String(auth?.category ?? auth?.Category ?? "")
        .split(",")
        .map((value) => normalize(value))
        .filter(Boolean);
      const hasAllowedCategory = categoryTokens.some(
        (token) => token.includes("power") || token.includes("supervisor")
      );

      return hasAhqRac && hasAllowedCategory;
    } catch (_) {
      return false;
    }
  }, [initialData, isClone, commands]);

  // Use only PascalCase (strict API response format)
  const selectedGroupArea = selectedPropertyGroup?.Area ?? "";
  const selectedGroupRate = selectedPropertyGroup?.Rate ?? "";
  const savedGroupRate = initialData?.GroupRate ?? initialData?.groupRate ?? "";
  const selectedGroupLocation =
    selectedPropertyGroup?.Location ?? selectedPropertyGroup?.location ?? "";
  const selectedGroupUoM = selectedPropertyGroup?.UoM ?? "";

  const selectedRentalValueRateMeta = useMemo(() => {
    if (!form.cmdId || !form.baseId || !form.classId || !form.contractStartDate) {
      return { percent: 0, applicationDate: "" };
    }
    const isActive = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const isDeleted = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const contractStartTs = new Date(`${form.contractStartDate}T23:59:59`).getTime();
    if (!Number.isFinite(contractStartTs) || contractStartTs <= 0) {
      return { percent: 0, applicationDate: "" };
    }

    // Use only PascalCase (strict API response format)
    const matched = (rentalValueRates || []).filter((r) => {
      const cmdId = r.CmdId ?? null;
      const baseId = r.BaseId ?? null;
      const classId = r.ClassId ?? null;
      const appDateRaw = r.ApplicableDate ?? null;

      // Check if IDs match
      if (
        !cmdId ||
        !baseId ||
        !classId ||
        Number(cmdId) !== Number(form.cmdId) ||
        Number(baseId) !== Number(form.baseId) ||
        Number(classId) !== Number(form.classId)
      ) {
        return false;
      }

      // Check status and deleted
      if (!isActive(r.Status) || isDeleted(r.IsDeleted)) {
        return false;
      }

      // Check application date
      if (!appDateRaw) {
        return false;
      }

      const appDateTs = new Date(appDateRaw).getTime();
      if (!Number.isFinite(appDateTs) || appDateTs <= 0 || appDateTs > contractStartTs) {
        return false;
      }

      // Rate must still be active at contract start: no DeactiveDate or DeactiveDate >= contractStartDate
      const deactiveRaw = r.DeactiveDate ?? r.deactiveDate ?? null;
      if (deactiveRaw) {
        const deactiveTs = new Date(String(deactiveRaw).split("T")[0]).getTime();
        if (Number.isFinite(deactiveTs) && deactiveTs < contractStartTs) {
          return false;
        }
      }

      return true;
    });
    if (matched.length === 0) return { percent: 0, applicationDate: "" };

    const sorted = [...matched].sort((a, b) => {
      const da = new Date(a.ApplicableDate || 0).getTime() || 0;
      const db = new Date(b.ApplicableDate || 0).getTime() || 0;
      return db - da;
    });
    const selected = sorted[0] || {};
    const rate = Number(selected?.Rate ?? 0);
    const appDate = selected?.ApplicableDate || "";
    return { percent: Number.isFinite(rate) ? rate : 0, applicationDate: String(appDate || "") };
  }, [rentalValueRates, form.cmdId, form.baseId, form.classId, form.contractStartDate]);
  const selectedRentalValuePercentRate = selectedRentalValueRateMeta.percent;
  const savedRentalValueRate = initialData?.RentalValueRate ?? initialData?.rentalValueRate ?? "";
  const displayGroupRate =
    initialData && !isClone && savedGroupRate !== "" && savedGroupRate != null
      ? savedGroupRate
      : selectedGroupRate;
  const displayRentalValueRate =
    initialData && !isClone && savedRentalValueRate !== "" && savedRentalValueRate != null
      ? savedRentalValueRate
      : selectedRentalValuePercentRate;

  // Auto-calculate Rental Value = Area * Rate * (%Rate / 100) (rounded to integer)
  useEffect(() => {
    if (initialData && !isClone) return;
    const area = Number(selectedGroupArea);
    const rate = Number(selectedGroupRate);
    const percent = Number(selectedRentalValuePercentRate);
    const hasInputs = Number.isFinite(area) && Number.isFinite(rate) && Number.isFinite(percent);
    const calculated = hasInputs ? Math.round((area * rate * percent) / 100) : 0;

    setForm((prev) => {
      const prevNum = Number(prev.rentalValue || 0);
      if (prevNum === calculated) return prev;
      return { ...prev, rentalValue: calculated };
    });
  }, [initialData, isClone, selectedGroupArea, selectedGroupRate, selectedRentalValuePercentRate]);

  const rentalValueFormulaText = useMemo(() => {
    if (initialData && !isClone) return "Stored value from this contract.";
    const area = Number(selectedGroupArea) || 0;
    const rate = Number(selectedGroupRate) || 0;
    const percent = Number(selectedRentalValuePercentRate) || 0;
    const calculated = Math.round((area * rate * percent) / 100);
    if (!form.contractStartDate) {
      return "Formula: Rental Value = Area x Revenue Rate x (Rental Value Rate %). Select Contract Start Date to apply the correct % Rate.";
    }
    const appDateInfo = selectedRentalValueRateMeta.applicationDate
      ? ` | % Rate App Date: ${String(selectedRentalValueRateMeta.applicationDate).split("T")[0]}`
      : " | % Rate App Date: N/A";
    return `Formula: ${area} x ${rate} x (${percent} / 100) = ${calculated}${appDateInfo}`;
  }, [
    selectedGroupArea,
    selectedGroupRate,
    selectedRentalValuePercentRate,
    selectedRentalValueRateMeta.applicationDate,
    form.contractStartDate,
    initialData,
    isClone,
  ]);

  const selectedGovtShareRateMeta = useMemo(() => {
    if (!form.cmdId || !form.baseId || !form.classId || !form.contractStartDate) {
      return { percent: 0, applicationDate: "", config: "" };
    }
    const isActive = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const isDeleted = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const contractStartTs = new Date(`${form.contractStartDate}T23:59:59`).getTime();
    if (!Number.isFinite(contractStartTs) || contractStartTs <= 0) {
      return { percent: 0, applicationDate: "", config: "" };
    }

    // Use only PascalCase (strict API response format)
    const matched = (govtShareRates || []).filter((r) => {
      const cmdId = r.CmdId ?? null;
      const baseId = r.BaseId ?? null;
      const classId = r.ClassId ?? null;
      const appDateRaw = r.ApplicableDate ?? null;

      // Check if IDs match
      if (
        !cmdId ||
        !baseId ||
        !classId ||
        Number(cmdId) !== Number(form.cmdId) ||
        Number(baseId) !== Number(form.baseId) ||
        Number(classId) !== Number(form.classId)
      ) {
        return false;
      }

      // Check status and deleted
      if (!isActive(r.Status) || isDeleted(r.IsDeleted)) {
        return false;
      }

      // Check application date
      if (!appDateRaw) {
        return false;
      }

      const appDateTs = new Date(appDateRaw).getTime();
      if (!Number.isFinite(appDateTs) || appDateTs <= 0 || appDateTs > contractStartTs) {
        return false;
      }

      // Rate must still be active at contract start: no DeactiveDate or DeactiveDate >= contractStartDate
      const deactiveRaw = r.DeactiveDate ?? r.deactiveDate ?? null;
      if (deactiveRaw) {
        const deactiveTs = new Date(String(deactiveRaw).split("T")[0]).getTime();
        if (Number.isFinite(deactiveTs) && deactiveTs < contractStartTs) {
          return false;
        }
      }

      return true;
    });
    if (matched.length === 0) return { percent: 0, applicationDate: "", config: "" };

    const sorted = [...matched].sort((a, b) => {
      const da = new Date(a.ApplicableDate || 0).getTime() || 0;
      const db = new Date(b.ApplicableDate || 0).getTime() || 0;
      return db - da;
    });
    const selected = sorted[0] || {};
    const rate = Number(selected?.Rate ?? 0);
    const appDate = selected?.ApplicableDate || "";
    const config = String(selected?.Config ?? selected?.config ?? "").trim();
    return {
      percent: Number.isFinite(rate) ? rate : 0,
      applicationDate: String(appDate || ""),
      config,
    };
  }, [govtShareRates, form.cmdId, form.baseId, form.classId, form.contractStartDate]);
  const selectedGovtSharePercentRate = selectedGovtShareRateMeta.percent;

  const govtShareUsesInitialRentPAForNewContract = useMemo(
    () =>
      !initialData &&
      String(selectedGovtShareRateMeta.config || "")
        .trim()
        .toLowerCase() === "annual rent",
    [initialData, selectedGovtShareRateMeta.config]
  );

  // Auto-calculate Govt Share = Rental Value * (%Govt Share / 100), or for New Contract when rate Config is "Annual Rent": Initial Rent PA * (% / 100) (rounded to integer)
  useEffect(() => {
    if (initialData) return;
    const percent = Number(selectedGovtSharePercentRate);
    const baseAmount = govtShareUsesInitialRentPAForNewContract
      ? Number(form.initialRentPA)
      : Number(form.rentalValue);
    const hasInputs = Number.isFinite(baseAmount) && Number.isFinite(percent);
    const calculated = hasInputs ? Math.round((baseAmount * percent) / 100) : 0;

    setForm((prev) => {
      const prevNum = Number(prev.govtShare || 0);
      if (prevNum === calculated) return prev;
      return { ...prev, govtShare: calculated };
    });
  }, [
    form.rentalValue,
    form.initialRentPA,
    selectedGovtSharePercentRate,
    govtShareUsesInitialRentPAForNewContract,
  ]);

  const govtShareFormulaText = useMemo(() => {
    if (initialData && !isClone) return "Stored value from this contract.";
    const percent = Number(selectedGovtSharePercentRate) || 0;
    const conceptOld =
      "Formula: GovtShare = Rental Value x (% Govt Share / 100). Select Contract Start Date to apply the correct % rate.";
    const conceptNew =
      "Formula: GovtShare = Initial Rent PA x (% Govt Share / 100). Select Contract Start Date to apply the correct % rate.";
    const conceptOldApplied = "Formula: GovtShare = Rental Value x (% Govt Share / 100).";
    const conceptNewApplied = "Formula: GovtShare = Initial Rent PA x (% Govt Share / 100).";
    if (!form.contractStartDate) {
      return govtShareUsesInitialRentPAForNewContract ? conceptNew : conceptOld;
    }
    const appDateInfo = selectedGovtShareRateMeta.applicationDate
      ? ` | % Rate App Date: ${String(selectedGovtShareRateMeta.applicationDate).split("T")[0]}`
      : " | % Rate App Date: N/A";
    if (govtShareUsesInitialRentPAForNewContract) {
      const initialRentPA = Number(form.initialRentPA) || 0;
      const calculated = Math.round((initialRentPA * percent) / 100);
      return `${conceptNewApplied} ${initialRentPA} x (${percent} / 100) = ${calculated}${appDateInfo}`;
    }
    const rentalValue = Number(form.rentalValue) || 0;
    const calculated = Math.round((rentalValue * percent) / 100);
    return `${conceptOldApplied} ${rentalValue} x (${percent} / 100) = ${calculated}${appDateInfo}`;
  }, [
    form.rentalValue,
    form.initialRentPA,
    selectedGovtSharePercentRate,
    selectedGovtShareRateMeta.applicationDate,
    form.contractStartDate,
    govtShareUsesInitialRentPAForNewContract,
    initialData,
    isClone,
  ]);

  // Auto-calculate PAF Share = Initial Rent PA - Govt Share (rounded, min 0)
  useEffect(() => {
    if (initialData) return;
    const initialRentPA = Number(form.initialRentPA);
    const govtShare = Number(form.govtShare);
    const hasInputs = Number.isFinite(initialRentPA) && Number.isFinite(govtShare);
    const calculated = hasInputs ? Math.max(0, Math.round(initialRentPA - govtShare)) : 0;

    setForm((prev) => {
      const prevNum = Number(prev.pafShare || 0);
      if (prevNum === calculated) return prev;
      return { ...prev, pafShare: calculated };
    });
  }, [form.initialRentPA, form.govtShare]);

  const pafShareFormulaText = useMemo(() => {
    if (initialData && !isClone) return "Stored value from this contract.";
    const initialRentPA = Number(form.initialRentPA) || 0;
    const govtShare = Number(form.govtShare) || 0;
    const calculated = Math.max(0, Math.round(initialRentPA - govtShare));
    return `Formula: ${initialRentPA} - ${govtShare} = ${calculated}`;
  }, [form.initialRentPA, form.govtShare, initialData, isClone]);

  const viabilityLabel = useMemo(() => {
    if (initialData && !isClone) {
      const stored =
        initialData?.Viability ??
        initialData?.viability ??
        initialData?.Feasible ??
        initialData?.feasible ??
        "";
      const trimmed = String(stored || "").trim();
      const lower = trimmed.toLowerCase();
      if (lower === "viable") return "Viable";
      if (lower === "unviable") return "Unviable";
      return trimmed || "-";
    }
    const initialRentPA = Number(form.initialRentPA) || 0;
    const govtShare = Number(form.govtShare) || 0;
    return initialRentPA > govtShare ? "Unviable" : "Viable";
  }, [form.initialRentPA, form.govtShare, initialData, isClone]);

  // Rise Terms handlers
  const getNextRiseSequenceNo = () => {
    const maxSeq = riseTerms.reduce((max, t) => {
      const n = Number(t?.sequenceNo);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    return String(maxSeq + 1);
  };

  const handleRiseTermChange = (field, value) => {
    // Sequence No is auto-generated; prevent manual edits
    if (field === "sequenceNo") return;
    setRiseTermForm((prev) => ({ ...prev, [field]: value }));
    if (riseTermErrors[field]) {
      setRiseTermErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const { usedRiseMonthsIntervals, maxUsedRiseMonthsInterval } = useMemo(() => {
    const used = new Set();
    const numericUsed = [];
    riseTerms.forEach((t, i) => {
      if (editingRiseTermIndex !== null && i === editingRiseTermIndex) return;
      const mi = String(t.monthsInterval || "").trim();
      if (mi) used.add(mi);
      const miNum = Number(mi);
      if (Number.isFinite(miNum) && miNum > 0) numericUsed.push(miNum);
    });
    return {
      usedRiseMonthsIntervals: used,
      maxUsedRiseMonthsInterval: numericUsed.length ? Math.max(...numericUsed) : 0,
    };
  }, [riseTerms, editingRiseTermIndex]);

  const maxRiseMonthsFromCsd = useMemo(
    () => getContractMonthsBetweenCsdAndCed(form.contractStartDate, form.contractEndDate),
    [form.contractStartDate, form.contractEndDate]
  );

  const validateRiseTerm = () => {
    const newErrors = {};
    if (!riseTermForm.monthsInterval || Number(riseTermForm.monthsInterval) <= 0) {
      newErrors.monthsInterval = "Months Interval is required and must be greater than 0";
    } else {
      const miStr = String(riseTermForm.monthsInterval).trim();
      const miNum = Number(riseTermForm.monthsInterval);
      const duplicate = riseTerms.some(
        (t, i) => editingRiseTermIndex !== i && String(t.monthsInterval || "").trim() === miStr
      );
      if (duplicate) {
        newErrors.monthsInterval = "This Months Interval is already used for another rise term.";
      } else if (
        maxUsedRiseMonthsInterval > 0 &&
        Number.isFinite(miNum) &&
        miNum < maxUsedRiseMonthsInterval
      ) {
        newErrors.monthsInterval = `Months Interval must be greater than ${maxUsedRiseMonthsInterval} months (a higher interval is already used).`;
      } else if (!form.contractStartDate || !form.contractEndDate) {
        newErrors.monthsInterval =
          "Contract Start Date (CSD) and Contract End Date (CED) are required.";
      } else if (
        !isRiseMonthsIntervalWithinContractDuration(
          riseTermForm.monthsInterval,
          form.contractStartDate,
          form.contractEndDate
        )
      ) {
        newErrors.monthsInterval = `Months Interval must not exceed contract duration (${maxRiseMonthsFromCsd} months from CSD to CED).`;
      }
    }
    if (!riseTermForm.risePercent || Number(riseTermForm.risePercent) <= 0) {
      newErrors.risePercent = "Rise Percent is required and must be greater than 0";
    }

    setRiseTermErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddRiseTerm = () => {
    if (!validateRiseTerm()) return;

    if (editingRiseTermIndex !== null) {
      // Update existing term
      const updated = [...riseTerms];
      updated[editingRiseTermIndex] = { ...riseTermForm };
      setRiseTerms(updated);
    } else {
      // Add new term
      const nextSeq = getNextRiseSequenceNo();
      setRiseTerms([...riseTerms, { ...riseTermForm, sequenceNo: nextSeq }]);
    }

    setRiseTermForm({
      monthsInterval: "",
      risePercent: "",
      sequenceNo: getNextRiseSequenceNo(),
    });
    setRiseTermErrors({});
    setEditingRiseTermIndex(null);
  };

  const handleEditRiseTerm = (index) => {
    setRiseTermForm({ ...riseTerms[index] });
    setEditingRiseTermIndex(index);
    setRiseTermErrors({});
  };

  const handleDeleteRiseTerm = async (index) => {
    const termToDelete = riseTerms[index];

    // If the term has an ID, call the API to delete it
    if (termToDelete && termToDelete.id) {
      try {
        await contractApi.deleteContractRiseTerm(termToDelete.id);
        alert("Rise term deleted successfully.");

        // Remove from local state
        const updated = riseTerms.filter((_, i) => i !== index);
        setRiseTerms(updated);
        if (editingRiseTermIndex === index) {
          setRiseTermForm({ monthsInterval: "", risePercent: "", sequenceNo: "" });
          setEditingRiseTermIndex(null);
        }
      } catch (error) {
        console.error("Error deleting rise term:", error);
        alert("Failed to delete rise term. Please try again.");
      }
    } else {
      // If no ID, just remove from local state (new term not yet saved)
      const updated = riseTerms.filter((_, i) => i !== index);
      setRiseTerms(updated);
      if (editingRiseTermIndex === index) {
        setRiseTermForm({ monthsInterval: "", risePercent: "", sequenceNo: "" });
        setEditingRiseTermIndex(null);
      }
    }
  };

  // Fetch ContractRiseTerms by ContractID (GET contract body often omits nested terms).
  const fetchContractRiseTerms = useCallback(async (contractId) => {
    if (!contractId) {
      setRiseTerms([]);
      return;
    }

    try {
      const response = await contractApi.getContractRiseTermsByContractId(contractId);
      const data = Array.isArray(response) ? response : response?.data || [];

      // Filter out deleted records and normalize data
      const normalizedRiseTerms = data
        .filter((t) => !t.IsDeleted && t.IsDeleted !== true)
        .map((t) => {
          const monthsInterval = t.MonthsInterval ?? null;
          const risePercent = t.RisePercent ?? null;
          const sequenceNo = t.SequenceNo ?? null;
          const contractID = t.ContractID ?? null;
          const isDeleted = t.IsDeleted ?? null;
          const id = t.Id ?? null;

          if (monthsInterval === null || risePercent === null || sequenceNo === null) {
            return null;
          }

          return {
            id: id ? Number(id) : null,
            monthsInterval: String(monthsInterval),
            risePercent: String(risePercent),
            sequenceNo: String(sequenceNo),
            contractID: contractID ? Number(contractID) : null,
            isDeleted: isDeleted !== null && isDeleted !== undefined ? Boolean(isDeleted) : null,
          };
        })
        .filter(Boolean);

      setRiseTerms(normalizedRiseTerms);
    } catch (error) {
      console.error("Error fetching ContractRiseTerms:", error);
      // If API call fails, keep existing riseTerms from initialData
    }
  }, []);

  // Edit + Variable: load rise terms when form opens so the summary shows "n term(s) configured".
  useEffect(() => {
    if (!open || isClone || !initialData) return;
    const contractId = initialData.Id ?? initialData.id;
    if (!contractId) return;
    const rawRt = initialData.RiseTermType ?? initialData.riseTermType ?? "";
    if (normalizeRiseTermType(String(rawRt)) !== "Variable") return;
    fetchContractRiseTerms(contractId);
  }, [open, initialData, isClone, fetchContractRiseTerms]);

  const handleOpenRiseTermsDialog = () => {
    // Reset form
    setRiseTermForm({
      monthsInterval: "",
      risePercent: "",
      sequenceNo: getNextRiseSequenceNo(),
    });
    setRiseTermErrors({});
    setEditingRiseTermIndex(null);

    // Fetch ContractRiseTerms if we have a contract ID (edit mode)
    const contractId = initialData?.Id || initialData?.id;
    if (contractId) {
      fetchContractRiseTerms(contractId);
    } else {
      // New contract - use existing riseTerms from state
      // (which should be empty for new contracts)
    }

    setRiseTermsDialogOpen(true);
  };

  const handleCloseRiseTermsDialog = () => {
    setRiseTermsDialogOpen(false);
    setRiseTermForm({ monthsInterval: "", risePercent: "", sequenceNo: "" });
    setRiseTermErrors({});
    setEditingRiseTermIndex(null);
  };

  const increaseIntervalOptions = [1, 2, 3, 4, 6, 12, 15, 24];
  const hasRentInTerm = String(form.term || "")
    .toLowerCase()
    .includes("rent");
  const isEditContract = Boolean(initialData) && !isClone;
  const lockTermAndRiseTermDropdowns =
    isEditContract && form.riseTermType === "Variable" && riseTerms.length > 0;
  const activeNatureOptions = useMemo(() => {
    const isActive = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
    const isDeleted = (v) =>
      v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";

    return (natures || []).filter((item) => {
      const name = item?.name ?? item?.Name ?? item?.natureName ?? item?.NatureName ?? "";
      return Boolean(String(name).trim()) && isActive(item?.status) && !isDeleted(item?.isDeleted);
    });
  }, [natures]);

  // Shared compact styling to keep all inputs/lookups consistent and simple
  const labelSx = { fontSize: "1rem" };
  const inputSx = {
    "& .MuiInputBase-input": { fontSize: "1rem", padding: "10px 12px" },
    "& .MuiInputLabel-root": { fontSize: "1rem" },
  };
  const selectSx = {
    fontSize: "1rem",
    display: "flex",
    alignItems: "center",
    boxSizing: "border-box",
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "12px 32px 12px 12px",
      minHeight: "45px !important",
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
  };
  const menuItemSx = { fontSize: "1rem" };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
        <DialogTitle
          sx={{
            py: 2,
            ...(darkMode ? { color: "#ffffff !important" } : {}),
          }}
        >
          <MDBox
            sx={{
              width: "100%",
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 1,
              flexWrap: { xs: "wrap", md: "nowrap" },
            }}
          >
            <MDTypography
              variant="h5"
              fontWeight="bold"
              sx={darkMode ? { color: "#ffffff !important" } : {}}
            >
              {initialData && !isClone ? "Edit Contract" : "New Contract"}
            </MDTypography>
            <MDBox sx={{ width: { xs: "100%", md: "340px" } }}>
              <MDInput
                label="Contract No"
                type="text"
                value={form.contractNo}
                onChange={(e) => handleChange("contractNo", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.contractNo || isContractNoMissing}
                helperText={
                  errors.contractNo || (isContractNoMissing ? "Contract No is required" : "")
                }
                sx={inputSx}
              />
            </MDBox>
          </MDBox>
        </DialogTitle>
        <DialogContent sx={{ position: "relative" }}>
          {formLoading && (
            <MDBox
              sx={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(255, 255, 255, 0.8)",
                zIndex: 1000,
              }}
            >
              <CurrencyLoading size={50} />
            </MDBox>
          )}
          <Grid container spacing={2} mt={1}>
            {/* Command, Base, Class - First Row */}
            <Grid item xs={6} sm={6} md={2}>
              <Autocomplete
                size="small"
                fullWidth
                disableClearable
                options={commands || []}
                getOptionLabel={(option) => option?.name ?? ""}
                isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                value={(commands || []).find((c) => Number(c.id) === Number(form.cmdId)) ?? null}
                onChange={(_, newValue) =>
                  handleChange("cmdId", newValue != null ? newValue.id : "")
                }
                ListboxProps={{ style: { maxHeight: 300 } }}
                sx={{
                  width: "100%",
                  fontSize: "1rem",
                  "& .MuiInputBase-root": { minHeight: "45px" },
                  "& .MuiOutlinedInput-root": { minHeight: "45px" },
                  "& .MuiAutocomplete-inputRoot": {
                    paddingTop: 0,
                    paddingBottom: 0,
                  },
                  "& .MuiInputBase-input": {
                    fontSize: "1rem",
                    padding: "12px 32px 12px 12px",
                  },
                }}
                renderInput={(params) => (
                  <MDInput {...params} label="RAC" error={!!errors.cmdId} sx={inputSx} />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                fullWidth
                disableClearable
                options={filteredBases}
                getOptionLabel={(option) => option?.name ?? ""}
                isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                value={filteredBases.find((b) => Number(b.id) === Number(form.baseId)) ?? null}
                onChange={(_, newValue) =>
                  handleChange("baseId", newValue != null ? newValue.id : "")
                }
                disabled={!form.cmdId}
                ListboxProps={{ style: { maxHeight: 300 } }}
                sx={{
                  width: "100%",
                  fontSize: "1rem",
                  "& .MuiInputBase-root": { minHeight: "45px" },
                  "& .MuiOutlinedInput-root": { minHeight: "45px" },
                  "& .MuiAutocomplete-inputRoot": {
                    paddingTop: 0,
                    paddingBottom: 0,
                  },
                  "& .MuiInputBase-input": {
                    fontSize: "1rem",
                    padding: "12px 32px 12px 12px",
                  },
                }}
                renderInput={(params) => (
                  <MDInput {...params} label="Base" error={!!errors.baseId} sx={inputSx} />
                )}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.classId}>
                <InputLabel id="class-label" sx={labelSx}>
                  Class
                </InputLabel>
                <Select
                  labelId="class-label"
                  value={form.classId || ""}
                  label="Class"
                  onChange={(e) => handleChange("classId", e.target.value)}
                  disabled={!form.cmdId || !form.baseId}
                  sx={selectSx}
                >
                  {filteredClasses.map((cls) => (
                    <MenuItem key={cls.id} value={cls.id} sx={menuItemSx}>
                      {cls.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            {/* Group ID - same row as Area, CA Area */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox display="flex" alignItems="center" gap={1}>
                <FormControl size="small" fullWidth error={!!errors.grpId} sx={{ flex: 1 }}>
                  <InputLabel id="grp-label" sx={labelSx}>
                    Group ID
                  </InputLabel>
                  <Select
                    labelId="grp-label"
                    value={form.grpId || ""}
                    label="Group ID"
                    onChange={(e) => handleChange("grpId", e.target.value)}
                    disabled={!form.cmdId || !form.baseId || !form.classId}
                    sx={selectSx}
                  >
                    {filteredPropertyGroups.map((pg) => (
                      <MenuItem key={pg.Id || pg.id} value={pg.Id || pg.id} sx={menuItemSx}>
                        {pg.GId || pg.gId}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
                <IconButton
                  color="primary"
                  onClick={() => setPropertyGroupingFormOpen(true)}
                  disabled={!form.cmdId || !form.baseId || !form.classId}
                  title="Create New Property Group"
                  sx={{
                    minWidth: "40px",
                    width: "40px",
                    height: "40px",
                  }}
                >
                  <Icon>add</Icon>
                </IconButton>
              </MDBox>
              {form.grpId && (
                <MDTypography variant="caption" color="text" sx={{ mt: 0.5, display: "block" }}>
                  Location: {selectedGroupLocation || "-"}
                </MDTypography>
              )}
            </Grid>

            {/* Area (Read-only) with UoM as read-only text beside - same row as Group ID, CA Area */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox display="flex" alignItems="flex-end" gap={1}>
                <MDInput
                  label="Area"
                  type="number"
                  value={selectedGroupArea}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                  sx={inputSx}
                />
                <MDTypography variant="caption" color="text" sx={{ pb: 1, flexShrink: 0 }}>
                  UoM: {selectedGroupUoM || "-"}
                </MDTypography>
              </MDBox>
            </Grid>

            {/* CA Area - same row as Group ID, Area */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="CA Area"
                type="number"
                value={form.vaArea}
                onChange={(e) => handleChange("vaArea", e.target.value)}
                fullWidth
                size="small"
                sx={inputSx}
              />
            </Grid>

            {/* TenantNo */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.tenantNo}>
                <InputLabel id="tenant-label" sx={labelSx}>
                  Tenant No
                </InputLabel>
                <Select
                  labelId="tenant-label"
                  value={form.tenantNo || ""}
                  label="Tenant No"
                  onChange={(e) => handleChange("tenantNo", e.target.value)}
                  sx={selectSx}
                >
                  {tenants.map((tenant) => (
                    <MenuItem key={tenant.id} value={tenant.tenantNo} sx={menuItemSx}>
                      {tenant.tenantNo} - {tenant.ownerName}
                    </MenuItem>
                  ))}
                </Select>
                {errors.tenantNo && <FormHelperText>{errors.tenantNo}</FormHelperText>}
              </FormControl>
              <MDBox mt={0.75} px={0.25}>
                <MDTypography variant="caption" color="text" sx={{ display: "block" }}>
                  Tenant Name: {hasTenantSelection ? selectedTenant?.ownerName || "-" : "-"}
                </MDTypography>
                <MDTypography variant="caption" color="text" sx={{ display: "block" }}>
                  Tenant Address: {hasTenantSelection ? selectedTenant?.address || "-" : "-"}
                </MDTypography>
              </MDBox>
            </Grid>

            {/* BusinessName */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Project Name"
                type="text"
                value={form.businessName}
                onChange={(e) => handleChange("businessName", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.businessName}
                helperText={errors.businessName}
                sx={inputSx}
              />
            </Grid>

            {/* NatureOfBusiness */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth required error={!!errors.natureOfBusiness}>
                <InputLabel id="nature-of-business-label" sx={labelSx}>
                  Nature of Business
                </InputLabel>
                <Select
                  labelId="nature-of-business-label"
                  value={form.natureOfBusiness || ""}
                  label="Nature of Business"
                  onChange={(e) => handleChange("natureOfBusiness", e.target.value)}
                  sx={selectSx}
                  MenuProps={{
                    PaperProps: {
                      sx: {
                        maxHeight: 280,
                      },
                    },
                  }}
                >
                  {activeNatureOptions.map((nature) => {
                    const natureName =
                      nature?.name ??
                      nature?.Name ??
                      nature?.natureName ??
                      nature?.NatureName ??
                      "";
                    return (
                      <MenuItem key={natureName} value={natureName} sx={menuItemSx}>
                        {natureName}
                      </MenuItem>
                    );
                  })}
                </Select>
                {errors.natureOfBusiness && (
                  <FormHelperText>{errors.natureOfBusiness}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* ContractStartDate - display dd-MMM-yyyy, state remains yyyy-mm-dd */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox sx={{ position: "relative" }}>
                <input
                  type="date"
                  ref={contractStartDateInputRef}
                  value={form.contractStartDate || ""}
                  onChange={(e) => handleChange("contractStartDate", e.target.value)}
                  style={{
                    position: "absolute",
                    opacity: 0.01,
                    width: "100%",
                    height: "100%",
                    top: 0,
                    left: 0,
                    cursor: "pointer",
                  }}
                  aria-hidden
                />
                <MDInput
                  label="Contract Start Date (CSD)"
                  type="text"
                  value={toDisplayDate(form.contractStartDate)}
                  readOnly
                  fullWidth
                  size="small"
                  required
                  error={!!errors.contractStartDate}
                  helperText={errors.contractStartDate}
                  onClick={() => openDatePicker(contractStartDateInputRef)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Icon
                          sx={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDatePicker(contractStartDateInputRef);
                          }}
                        >
                          calendar_today
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                />
              </MDBox>
            </Grid>

            {/* CommercialOperationDate (COD) - display dd-MMM-yyyy */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox sx={{ position: "relative" }}>
                <input
                  type="date"
                  ref={commercialOperationDateInputRef}
                  value={form.commercialOperationDate || ""}
                  onChange={(e) => handleChange("commercialOperationDate", e.target.value)}
                  min={form.contractStartDate || undefined}
                  max={form.contractEndDate || undefined}
                  style={{
                    position: "absolute",
                    opacity: 0.01,
                    width: "100%",
                    height: "100%",
                    top: 0,
                    left: 0,
                    cursor: "pointer",
                  }}
                  aria-hidden
                />
                <MDInput
                  label="Commercial Operation Date (COD)"
                  type="text"
                  value={toDisplayDate(form.commercialOperationDate)}
                  readOnly
                  fullWidth
                  size="small"
                  error={!!errors.commercialOperationDate}
                  helperText={errors.commercialOperationDate}
                  onClick={() => openDatePicker(commercialOperationDateInputRef)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Icon
                          sx={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDatePicker(commercialOperationDateInputRef);
                          }}
                        >
                          calendar_today
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                />
              </MDBox>
            </Grid>

            {/* ContractEndDate (CED) - display dd-MMM-yyyy */}
            <Grid item xs={12} sm={6} md={4}>
              <MDBox sx={{ position: "relative" }}>
                <input
                  type="date"
                  ref={contractEndDateInputRef}
                  value={form.contractEndDate || ""}
                  onChange={(e) => handleChange("contractEndDate", e.target.value)}
                  min={
                    form.contractStartDate
                      ? (() => {
                          const startDate = new Date(form.contractStartDate);
                          startDate.setDate(startDate.getDate() + 1);
                          return startDate.toISOString().split("T")[0];
                        })()
                      : undefined
                  }
                  style={{
                    position: "absolute",
                    opacity: 0.01,
                    width: "100%",
                    height: "100%",
                    top: 0,
                    left: 0,
                    cursor: "pointer",
                  }}
                  aria-hidden
                />
                <MDInput
                  label="Contract End Date (CED)"
                  type="text"
                  value={toDisplayDate(form.contractEndDate)}
                  readOnly
                  fullWidth
                  size="small"
                  required
                  error={!!errors.contractEndDate}
                  helperText={errors.contractEndDate}
                  onClick={() => openDatePicker(contractEndDateInputRef)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Icon
                          sx={{ cursor: "pointer" }}
                          onClick={(e) => {
                            e.stopPropagation();
                            openDatePicker(contractEndDateInputRef);
                          }}
                        >
                          calendar_today
                        </Icon>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                />
              </MDBox>
            </Grid>

            {/* Initial Rent PM, Payment Term Months - same row */}
            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="Initial Rent PM (Rs)"
                type="number"
                value={form.initialRentPM}
                onChange={(e) => handleChange("initialRentPM", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.initialRentPM}
                helperText={errors.initialRentPM}
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth required error={!!errors.paymentTermMonths}>
                <InputLabel id="payment-term-label" sx={labelSx}>
                  Payment Term
                </InputLabel>
                <Select
                  labelId="payment-term-label"
                  value={form.paymentTermMonths || ""}
                  label="Payment Term"
                  onChange={(e) => handleChange("paymentTermMonths", e.target.value)}
                  sx={selectSx}
                >
                  {CONTRACT_PAYMENT_TERM_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value} sx={menuItemSx}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
                {errors.paymentTermMonths && (
                  <FormHelperText>{errors.paymentTermMonths}</FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* Initial Rent PA (calculated) - same row as Payment Term */}
            <Grid item xs={12} sm={6} md={4}>
              <MDTypography
                variant="caption"
                color="black"
                fontWeight="bold"
                sx={{ display: "block" }}
              >
                Initial Rent PA
              </MDTypography>
              <MDTypography variant="h6" fontWeight="bold">
                {form.initialRentPA || 0}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                Initial Rent PM × 12
              </MDTypography>
            </Grid>

            {/* SD Rate, Payment Timing, Security Deposit (Rs) */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth required error={!!errors.sdRateMonths}>
                <InputLabel id="sd-rate-label" sx={labelSx}>
                  SD Rate
                </InputLabel>
                <Select
                  labelId="sd-rate-label"
                  value={
                    CONTRACT_SD_RATE_MONTH_VALUES.includes(Number(form.sdRateMonths))
                      ? Number(form.sdRateMonths)
                      : ""
                  }
                  label="SD Rate"
                  onChange={(e) => handleChange("sdRateMonths", e.target.value)}
                  sx={selectSx}
                >
                  {CONTRACT_SD_RATE_MONTH_VALUES.map((n) => (
                    <MenuItem key={n} value={n} sx={menuItemSx}>
                      {formatContractSdRateDisplay(n)}
                    </MenuItem>
                  ))}
                </Select>
                {errors.sdRateMonths && <FormHelperText>{errors.sdRateMonths}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth required error={!!errors.paymentTiming}>
                <InputLabel id="payment-timing-label" sx={labelSx}>
                  Payment Timing
                </InputLabel>
                <Select
                  labelId="payment-timing-label"
                  value={form.paymentTiming || ""}
                  label="Payment Timing"
                  onChange={(e) => handleChange("paymentTiming", e.target.value)}
                  sx={selectSx}
                >
                  {CONTRACT_PAYMENT_TIMING_OPTIONS.map((option) => (
                    <MenuItem key={option} value={option} sx={menuItemSx}>
                      {option}
                    </MenuItem>
                  ))}
                </Select>
                {errors.paymentTiming && <FormHelperText>{errors.paymentTiming}</FormHelperText>}
              </FormControl>
            </Grid>

            <Grid item xs={12} sm={6} md={4}>
              <MDTypography
                variant="caption"
                color="black"
                fontWeight="bold"
                sx={{ display: "block" }}
              >
                Security Deposit (Rs)
              </MDTypography>
              <MDTypography variant="h6" fontWeight="bold">
                {form.securityDepositAmount || 0}
              </MDTypography>
              <MDTypography variant="caption" color="text">
                Formula: SD Rate x Initial Rent PM
              </MDTypography>
            </Grid>

            {/* Term */}
            <Grid item xs={12} sm={6} md={4}>
              <FormControl size="small" fullWidth error={!!errors.term}>
                <InputLabel id="term-label" sx={labelSx}>
                  Term
                </InputLabel>
                <Select
                  labelId="term-label"
                  value={form.term || ""}
                  label="Term"
                  required
                  onChange={(e) => handleChange("term", e.target.value)}
                  disabled={lockTermAndRiseTermDropdowns}
                  sx={selectSx}
                >
                  <MenuItem value="Rent" sx={menuItemSx}>
                    Rent
                  </MenuItem>
                  <MenuItem value="Profit" sx={menuItemSx}>
                    Profit
                  </MenuItem>
                  <MenuItem value="Rent + Profit" sx={menuItemSx}>
                    Rent + Profit
                  </MenuItem>
                  <MenuItem value="Rent or Profit" sx={menuItemSx}>
                    Rent or Profit
                  </MenuItem>
                </Select>
                {(errors.term || lockTermAndRiseTermDropdowns) && (
                  <FormHelperText error={!!errors.term} sx={{ mx: 0, mt: 0.5, lineHeight: 1.35 }}>
                    {errors.term ||
                      "Delete all Variable rise terms first to change Term or Rise Terms."}
                  </FormHelperText>
                )}
              </FormControl>
            </Grid>

            {/* ProfitRate - shown when Term is not Rent (optional) */}
            {form.term && String(form.term).toLowerCase() !== "rent" && (
              <Grid item xs={12} sm={6} md={4}>
                <MDInput
                  label="Profit Rate"
                  type="number"
                  value={form.profitRate}
                  onChange={(e) => handleChange("profitRate", e.target.value)}
                  fullWidth
                  size="small"
                  required
                  error={!!errors.profitRate}
                  helperText={errors.profitRate}
                  sx={inputSx}
                />
              </Grid>
            )}

            {/* Rise Terms, Increase Rate Percent %, Increase Interval Months - same row when Term is Rent */}
            {hasRentInTerm && (
              <>
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl size="small" fullWidth error={!!errors.riseTermType}>
                    <InputLabel id="rise-term-type-label" sx={labelSx}>
                      Rise Terms
                    </InputLabel>
                    <Select
                      labelId="rise-term-type-label"
                      value={form.riseTermType || ""}
                      label="Rise Terms"
                      onChange={(e) => handleChange("riseTermType", e.target.value)}
                      disabled={lockTermAndRiseTermDropdowns}
                      sx={selectSx}
                    >
                      <MenuItem value="Uniform" sx={menuItemSx}>
                        Uniform
                      </MenuItem>
                      <MenuItem value="Fixed Date" sx={menuItemSx}>
                        Fixed Date
                      </MenuItem>
                      <MenuItem value="Variable" sx={menuItemSx}>
                        Variable
                      </MenuItem>
                    </Select>
                    {errors.riseTermType && (
                      <FormHelperText error sx={{ mx: 0 }}>
                        {errors.riseTermType}
                      </FormHelperText>
                    )}
                  </FormControl>
                </Grid>
                {form.riseTermType === "Variable" && (
                  <Grid item xs={12} sm={6} md={4}>
                    <MDBox
                      sx={{
                        flex: 1,
                        cursor: "pointer",
                        position: "relative",
                      }}
                      onClick={handleOpenRiseTermsDialog}
                    >
                      <MDInput
                        label="Variable"
                        value={
                          riseTerms.length > 0
                            ? `${riseTerms.length} term(s) configured`
                            : "Click for terms"
                        }
                        fullWidth
                        size="small"
                        required
                        error={!!errors.riseTerms}
                        helperText={errors.riseTerms}
                        InputProps={{ readOnly: true }}
                        sx={{
                          ...inputSx,
                          pointerEvents: "none",
                          "& .MuiInputBase-input": {
                            cursor: "pointer",
                          },
                        }}
                      />
                    </MDBox>
                  </Grid>
                )}
                {form.riseTermType !== "Variable" && (
                  <Grid item xs={12} sm={6} md={4}>
                    <MDInput
                      label="Increase Rate Percent %"
                      type="number"
                      value={form.increaseRatePercent}
                      onChange={(e) => handleChange("increaseRatePercent", e.target.value)}
                      fullWidth
                      size="small"
                      required
                      error={!!errors.increaseRatePercent}
                      helperText={errors.increaseRatePercent}
                      sx={inputSx}
                    />
                  </Grid>
                )}
                {form.riseTermType !== "Variable" && form.riseTermType !== "Fixed Date" && (
                  <Grid item xs={12} sm={6} md={4}>
                    <FormControl size="small" fullWidth error={!!errors.increaseIntervalMonths}>
                      <InputLabel id="increase-interval-label" sx={labelSx}>
                        Increase Interval Months
                      </InputLabel>
                      <Select
                        labelId="increase-interval-label"
                        value={form.increaseIntervalMonths || ""}
                        label="Increase Interval Months"
                        required
                        onChange={(e) => handleChange("increaseIntervalMonths", e.target.value)}
                        sx={selectSx}
                      >
                        {increaseIntervalOptions.map((option) => (
                          <MenuItem key={option} value={option} sx={menuItemSx}>
                            {option}
                          </MenuItem>
                        ))}
                      </Select>
                      {errors.increaseIntervalMonths && (
                        <FormHelperText error sx={{ mx: 0 }}>
                          {errors.increaseIntervalMonths}
                        </FormHelperText>
                      )}
                    </FormControl>
                  </Grid>
                )}
              </>
            )}

            {/* Rise Date - display dd-MMM-yyyy (when Fixed Date is selected) */}
            {form.riseTermType === "Fixed Date" && (
              <Grid item xs={12} sm={6} md={4}>
                <MDBox sx={{ position: "relative" }}>
                  <input
                    type="date"
                    ref={riseDateInputRef}
                    value={form.risedate || ""}
                    onChange={(e) => handleChange("risedate", e.target.value)}
                    style={{
                      position: "absolute",
                      opacity: 0.01,
                      width: "100%",
                      height: "100%",
                      top: 0,
                      left: 0,
                      cursor: "pointer",
                    }}
                    aria-hidden
                  />
                  <MDInput
                    label="Rise Date"
                    type="text"
                    value={toDisplayDate(form.risedate)}
                    readOnly
                    fullWidth
                    size="small"
                    error={!!errors.risedate}
                    helperText={errors.risedate}
                    onClick={() => openDatePicker(riseDateInputRef)}
                    InputProps={{
                      readOnly: true,
                      endAdornment: (
                        <InputAdornment position="end">
                          <Icon
                            sx={{ cursor: "pointer" }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openDatePicker(riseDateInputRef);
                            }}
                          >
                            calendar_today
                          </Icon>
                        </InputAdornment>
                      ),
                    }}
                    sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                  />
                </MDBox>
              </Grid>
            )}

            <Grid item xs={12} sm={6} md={4}>
              <MDInput
                label="DPC per day (%)"
                type="number"
                value={form.dpc}
                onChange={(e) => handleChange("dpc", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!errors.dpc}
                helperText={errors.dpc}
                inputProps={{ step: "0.01", min: 0 }}
                sx={inputSx}
              />
            </Grid>

            <Grid item xs={12}>
              <MDInput
                label="Representative"
                type="text"
                value={form.signatory}
                onChange={(e) => handleChange("signatory", e.target.value)}
                fullWidth
                multiline
                rows={3}
                size="small"
                error={!!errors.signatory}
                inputProps={{ maxLength: 250 }}
                helperText={errors.signatory || `${form.signatory?.length || 0}/250 characters`}
                sx={inputSx}
              />
            </Grid>

            {/* Auto-calculated summary (display-only, separated from editable fields) */}
            <Grid item xs={12}>
              <MDBox
                sx={{
                  mt: 0.5,
                  mb: 0.5,
                  px: 2,
                  py: 1.5,
                  border: "1px solid #d0d0d0",
                  borderLeft: "4px solid #2E7D32",
                  borderRadius: "8px",
                  backgroundColor: "#f8f9fa",
                }}
              >
                <MDBox
                  sx={{
                    mb: 1,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 1,
                    flexWrap: "wrap",
                  }}
                >
                  <MDTypography variant="button" fontWeight="bold">
                    Auto Calculated Values
                  </MDTypography>
                  <MDBox display="flex" flexDirection="column" alignItems="flex-end">
                    <Chip
                      label={viabilityLabel}
                      size="small"
                      color={viabilityLabel === "Viable" ? "success" : "error"}
                      sx={{ fontWeight: 700 }}
                    />
                    <MDTypography variant="caption" color="text" sx={{ mt: 0.5 }}>
                      Govt Share ≥ Initial Rent PA = Viable
                    </MDTypography>
                  </MDBox>
                </MDBox>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      Rental Value
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {form.rentalValue || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {rentalValueFormulaText}
                    </MDTypography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      Govt Share (Rs)
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {form.govtShare || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {govtShareFormulaText}
                    </MDTypography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      PAF Share (Rs)
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {form.pafShare || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {pafShareFormulaText}
                    </MDTypography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      Rate
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {displayGroupRate || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {initialData && !isClone
                        ? "Stored value from this contract"
                        : "From selected property group"}
                    </MDTypography>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <MDTypography
                      variant="caption"
                      color="black"
                      fontWeight="bold"
                      sx={{ display: "block" }}
                    >
                      % Rate
                    </MDTypography>
                    <MDTypography variant="h6" fontWeight="bold">
                      {displayRentalValueRate || 0}
                    </MDTypography>
                    <MDTypography variant="caption" color="text">
                      {initialData && !isClone
                        ? "Stored value from this contract"
                        : "From Rental Value Rate"}
                    </MDTypography>
                  </Grid>
                  {initialData && (
                    <Grid item xs={12} sm={6} md={3}>
                      <MDTypography
                        variant="caption"
                        color="black"
                        fontWeight="bold"
                        sx={{ display: "block" }}
                      >
                        Fiscal
                      </MDTypography>
                      <MDTypography variant="h6" fontWeight="bold">
                        {form.fiscal || "-"}
                      </MDTypography>
                      <MDTypography variant="caption" color="text">
                        Stored value from this contract
                      </MDTypography>
                    </Grid>
                  )}
                </Grid>
              </MDBox>
            </Grid>

            {/* Status */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl size="small" fullWidth>
                <InputLabel id="status-label" sx={labelSx}>
                  Status
                </InputLabel>
                <Select
                  labelId="status-label"
                  value={form.status !== undefined ? form.status : true}
                  label="Status"
                  onChange={(e) => handleChange("status", e.target.value)}
                  sx={selectSx}
                >
                  <MenuItem value={true} sx={menuItemSx}>
                    Active
                  </MenuItem>
                  <MenuItem value={false} sx={menuItemSx}>
                    Inactive
                  </MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {canShowAhqApprovalField && (
              <Grid item xs={12} sm={6} md={2}>
                <FormControl size="small" fullWidth>
                  <InputLabel id="approval-status-label" sx={labelSx}>
                    Apprv By AHQ
                  </InputLabel>
                  <Select
                    labelId="approval-status-label"
                    value={form.approvalStatus || "0"}
                    label="Apprv By AHQ"
                    onChange={(e) => handleChange("approvalStatus", e.target.value)}
                    sx={selectSx}
                  >
                    <MenuItem value="0" sx={menuItemSx}>
                      Pending
                    </MenuItem>
                    <MenuItem value="1" sx={menuItemSx}>
                      Approved
                    </MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            )}

            {/* IsArchive */}
            <Grid item xs={12} sm={6} md={2}>
              <FormControl size="small" fullWidth>
                <MDTypography
                  variant="caption"
                  color="black"
                  fontWeight="bold"
                  sx={{ display: "block", mb: 0.5 }}
                >
                  Archive
                </MDTypography>
                <FormControlLabel
                  control={
                    <Switch
                      size="small"
                      checked={Boolean(form.isArchive)}
                      onChange={(e) => handleChange("isArchive", e.target.checked)}
                    />
                  }
                  label={form.isArchive ? "On" : "Off"}
                />
              </FormControl>
            </Grid>

            {/* Remarks */}
            <Grid item xs={12}>
              <MDInput
                label="Remarks"
                type="text"
                value={form.remarks}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value.length <= 500) {
                    handleChange("remarks", value);
                  }
                }}
                fullWidth
                multiline
                rows={3}
                size="small"
                sx={inputSx}
                error={!!errors.remarks}
                helperText={errors.remarks || `${form.remarks?.length || 0}/500 characters`}
              />
            </Grid>
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

      {/* Active Contracts Dialog */}
      <Dialog
        open={contractsDialogOpen}
        onClose={() => setContractsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <MDTypography variant="h5" fontWeight="medium">
            Active Contracts for Group ID:{" "}
            {form.grpId
              ? filteredPropertyGroups.find((pg) => pg.id === Number(form.grpId))?.gId || form.grpId
              : ""}
          </MDTypography>
        </DialogTitle>
        <DialogContent>
          {loadingContracts ? (
            <MDBox display="flex" justifyContent="center" py={4}>
              <CurrencyLoading />
            </MDBox>
          ) : activeContracts.length === 0 ? (
            <MDBox py={4} textAlign="center">
              <MDTypography variant="body2" color="text">
                No active contracts found for this Group ID.
              </MDTypography>
            </MDBox>
          ) : (
            <MDBox
              sx={{
                maxHeight: "500px",
                overflowY: "auto",
                // Firefox
                scrollbarWidth: "thin",
                scrollbarColor: "#333333 transparent",
                // Chrome/Safari/Edge
                "&::-webkit-scrollbar": {
                  width: "8px",
                  height: "8px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                  borderRadius: "2px",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "#333333",
                  borderRadius: "10px",
                  border: "2px solid transparent",
                  backgroundClip: "padding-box",
                  "&:hover": {
                    backgroundColor: "#1a1a1a",
                  },
                },
                "&::-webkit-scrollbar-button": {
                  display: "none",
                },
              }}
            >
              <Card>
                <MDBox p={2}>
                  <MDTypography variant="caption" color="text" mb={2}>
                    Total Active Contracts: {activeContracts.length}
                  </MDTypography>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", backgroundColor: "#f5f5f5" }}>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Sno
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Class
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Cmd
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Unit
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          CA No
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contractor Name
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contractor Address
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Business Title
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Nature of Business
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Location
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          GP ID
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Area-CA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Area-BOO
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Revenue Rate
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Revenue Rate Date
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Rental Value
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Initial Contractor Name
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Initial Contract Date
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contract From
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contract To
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          1st Y Rent PM
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          1st Y Rent PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Term of Payment
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Profit Term
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Increase (Rate)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Increase Interval
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Security Deposit Term
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Security Deposit (Rs)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          DPC (Per Day)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Govt Share-PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          PAF Share-PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Status
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Feasible
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          CA Status
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Approving Authority
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeContracts.map((contract, index) => {
                        // Helper function to get field value with fallbacks
                        const getField = (camelCase, pascalCase, altNames = []) => {
                          if (contract[camelCase] !== undefined && contract[camelCase] !== null) {
                            return contract[camelCase];
                          }
                          if (contract[pascalCase] !== undefined && contract[pascalCase] !== null) {
                            return contract[pascalCase];
                          }
                          for (const alt of altNames) {
                            if (contract[alt] !== undefined && contract[alt] !== null) {
                              return contract[alt];
                            }
                          }
                          return "-";
                        };

                        // Helper function to format date as dd-MMM-yyyy
                        const formatDate = (dateValue) => {
                          if (!dateValue) return "-";
                          try {
                            const dateStr = String(dateValue).trim();
                            if (!dateStr) return "-";
                            const datePart = dateStr.includes("T")
                              ? dateStr.split("T")[0]
                              : dateStr;
                            const d = parseISO(datePart);
                            if (!isValid(d)) return "-";
                            return format(d, "dd-MMM-yyyy");
                          } catch {
                            return "-";
                          }
                        };

                        return (
                          <tr
                            key={contract.id || index}
                            style={{
                              borderBottom: "1px solid #e0e0e0",
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#f9f9f9";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {index + 1}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("class", "Class", ["className", "ClassName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("cmd", "Cmd", ["cmdName", "CmdName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("unit", "Unit", ["unitName", "UnitName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("caNo", "CANo", ["contractNo", "ContractNo"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("contractorName", "ContractorName", [
                                "businessName",
                                "BusinessName",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("contractorAddress", "ContractorAddress", [
                                "address",
                                "Address",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("businessTitle", "BusinessTitle", ["title", "Title"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("natureOfBusiness", "NatureOfBusiness", [
                                "nature",
                                "Nature",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("location", "Location")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("gpId", "GPId", [
                                "groupId",
                                "GroupId",
                                "gId",
                                "GId",
                                "grpId",
                                "GrpId",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("areaCA", "AreaCA", ["areaCa", "AreaCa"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("areaBOO", "AreaBOO", ["areaBoo", "AreaBoo"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("revenueRate", "RevenueRate")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(getField("revenueRateDate", "RevenueRateDate"))}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("rentalValue", "RentalValue")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("initialContractorName", "InitialContractorName")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(getField("initialContractDate", "InitialContractDate"))}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(
                                getField("contractFrom", "ContractFrom", [
                                  "contractStartDate",
                                  "ContractStartDate",
                                ])
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(
                                getField("contractTo", "ContractTo", [
                                  "contractEndDate",
                                  "ContractEndDate",
                                ])
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("firstYRentPM", "FirstYRentPM", [
                                "initialRentPM",
                                "InitialRentPM",
                                "firstYearRentPM",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("firstYRentPA", "FirstYRentPA", [
                                "initialRentPA",
                                "InitialRentPA",
                                "firstYearRentPA",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatContractPaymentTermDisplay(
                                getField("termOfPayment", "TermOfPayment", [
                                  "paymentTermMonths",
                                  "PaymentTermMonths",
                                ])
                              ) ||
                                getField("termOfPayment", "TermOfPayment", [
                                  "paymentTermMonths",
                                  "PaymentTermMonths",
                                ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("profitTerm", "ProfitTerm")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("increaseRate", "IncreaseRate", [
                                "increaseRatePercent",
                                "IncreaseRatePercent",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("increaseInterval", "IncreaseInterval", [
                                "increaseIntervalMonths",
                                "IncreaseIntervalMonths",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatContractSdRateDisplay(
                                getField("securityDepositTerm", "SecurityDepositTerm", [
                                  "sdRateMonths",
                                  "SdRateMonths",
                                ])
                              ) ||
                                getField("securityDepositTerm", "SecurityDepositTerm", [
                                  "sdRateMonths",
                                  "SdRateMonths",
                                ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("securityDepositRs", "SecurityDepositRs", [
                                "securityDepositAmount",
                                "SecurityDepositAmount",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("dpcPerDay", "DPCPerDay", ["dpc", "DPC"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("govtSharePA", "GovtSharePA", [
                                "govtShare",
                                "GovtShare",
                                "govtShareCondition",
                                "GovtShareCondition",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("pafSharePA", "PAFSharePA", ["pafShare", "PAFShare"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              <StatusBadge value={getField("status", "Status")} />
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("feasible", "Feasible")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("caStatus", "CAStatus")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("approvingAuthority", "ApprovingAuthority")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("remarks", "Remarks")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </MDBox>
              </Card>
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={() => setContractsDialogOpen(false)}
          >
            <Icon>close</Icon>&nbsp;Close
          </MDButton>
        </DialogActions>
      </Dialog>
      {/* Property Grouping Form Dialog */}
      <PropertyGroupingForm
        open={propertyGroupingFormOpen}
        onClose={() => setPropertyGroupingFormOpen(false)}
        onSubmit={handlePropertyGroupingSave}
        initialData={null}
        rentalProperties={rentalProperties}
        commands={commands}
        bases={bases}
        classes={classes}
        allPropertyGroupings={allPropertyGroupings}
      />

      {/* Rise Terms Dialog */}
      <Dialog
        open={riseTermsDialogOpen}
        onClose={handleCloseRiseTermsDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <MDTypography variant="h5" fontWeight="medium">
            {editingRiseTermIndex !== null ? "Edit Rise Term" : "Add Rise Term"}
          </MDTypography>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={4}>
              <FormControl size="small" fullWidth error={!!riseTermErrors.monthsInterval}>
                <InputLabel id="months-interval-label" sx={labelSx}>
                  Months Interval
                </InputLabel>
                <Select
                  labelId="months-interval-label"
                  value={riseTermForm.monthsInterval || ""}
                  label="Months Interval"
                  onChange={(e) => handleRiseTermChange("monthsInterval", e.target.value)}
                  sx={selectSx}
                >
                  {RISE_TERM_MONTHS_INTERVAL_OPTIONS.map((value) => {
                    const valueStr = String(value);
                    const isUsed = usedRiseMonthsIntervals.has(valueStr);
                    const belowUsedHigherInterval =
                      maxUsedRiseMonthsInterval > 0 && value < maxUsedRiseMonthsInterval;
                    const exceedsContract =
                      maxRiseMonthsFromCsd !== null && value > maxRiseMonthsFromCsd;
                    const disabled = isUsed || belowUsedHigherInterval || exceedsContract;
                    return (
                      <MenuItem
                        key={value}
                        value={valueStr}
                        disabled={disabled}
                        sx={{
                          ...menuItemSx,
                          ...(disabled ? { opacity: 0.45, color: "text.disabled" } : {}),
                        }}
                      >
                        {value}
                      </MenuItem>
                    );
                  })}
                </Select>
                {riseTermErrors.monthsInterval && (
                  <FormHelperText>{riseTermErrors.monthsInterval}</FormHelperText>
                )}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={4}>
              <MDInput
                label="Rise Percent"
                type="number"
                step="0.01"
                value={riseTermForm.risePercent}
                onChange={(e) => handleRiseTermChange("risePercent", e.target.value)}
                fullWidth
                size="small"
                required
                error={!!riseTermErrors.risePercent}
                helperText={riseTermErrors.risePercent}
                sx={inputSx}
              />
            </Grid>
            <Grid item xs={12} sm={4}>
              <MDInput
                label="Sequence No"
                type="number"
                value={riseTermForm.sequenceNo}
                fullWidth
                size="small"
                InputProps={{ readOnly: true }}
                sx={inputSx}
              />
            </Grid>
          </Grid>

          {riseTerms.length > 0 && (
            <MDBox mt={3}>
              <MDTypography variant="h6" fontWeight="medium" mb={2}>
                Existing Rise Terms
              </MDTypography>
              <Card>
                <MDBox p={2}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", backgroundColor: "#f5f5f5" }}>
                        <th>Sequence No</th>
                        <th>Months Interval</th>
                        <th>Rise Percent</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...riseTerms]
                        .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo))
                        .map((term, index) => {
                          const originalIndex = riseTerms.findIndex(
                            (t) =>
                              t.sequenceNo === term.sequenceNo &&
                              t.monthsInterval === term.monthsInterval
                          );
                          return (
                            <tr key={index} style={{ borderBottom: "1px solid #e0e0e0" }}>
                              <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                                {term.sequenceNo}
                              </td>
                              <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                                {term.monthsInterval}
                              </td>
                              <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                                {term.risePercent}%
                              </td>
                              <td style={{ padding: "10px 12px", textAlign: "center" }}>
                                <IconButton
                                  size="small"
                                  color="info"
                                  onClick={() => handleEditRiseTerm(originalIndex)}
                                  sx={{ mr: 1 }}
                                >
                                  <Icon>edit</Icon>
                                </IconButton>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => handleDeleteRiseTerm(originalIndex)}
                                >
                                  <Icon>delete</Icon>
                                </IconButton>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </MDBox>
              </Card>
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseRiseTermsDialog}>
            <Icon>close</Icon>&nbsp;Close
          </MDButton>
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleAddRiseTerm}
            disabled={!canCreateCurrentMenu()}
          >
            <Icon>{editingRiseTermIndex !== null ? "save" : "add"}</Icon>&nbsp;
            {editingRiseTermIndex !== null ? "Update" : "Add"} Term
          </MDButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

ContractsForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  isClone: PropTypes.bool,
  commands: PropTypes.array.isRequired,
  bases: PropTypes.array.isRequired,
  classes: PropTypes.array.isRequired,
  propertyGroups: PropTypes.array.isRequired,
  tenants: PropTypes.array.isRequired,
  natures: PropTypes.array,
  onPropertyGroupsRefresh: PropTypes.func,
};

/** Default-hidden column ids on the Contracts grid column picker (unchecked until user enables them). */
const CONTRACTS_GRID_INITIAL_HIDDEN_COLUMNS = Object.freeze([
  "tenantNo",
  "natureOfBusiness",
  "commercialOperationDate",
  "initialRentPM",
  "increaseRatePercent",
  "riseRatePercent",
  "securityDepositAmount",
  "percentRate",
]);

/** Fallback keys per column id for reading normalized row dates when values[] is empty. */
const CONTRACTS_GRID_DATE_COLUMN_FALLBACK_KEYS = {
  contractStartDate: ["contractStartDate", "ContractStartDate"],
  contractEndDate: ["contractEndDate", "ContractEndDate"],
  commercialOperationDate: ["commercialOperationDate", "CommercialOperationDate"],
};

/** Normalize grid date columns (CSD / COD / CED) to yyyy-MM-dd. */
function parseContractsGridRowDateYyyyMmDd(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = CONTRACTS_GRID_DATE_COLUMN_FALLBACK_KEYS[columnId] || [];
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

function contractsGridDateCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowD = parseContractsGridRowDateYyyyMmDd(row, columnId);
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

/** Header date filter (greater / less / range) for CSD, COD, CED on the Contracts grid. */
function ContractsDateColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Date";
  const modeLabelId = `contracts-date-filter-mode-${column.id || "col"}`;

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

ContractsDateColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const CONTRACTS_GRID_MONEY_COMPARE_FALLBACK_KEYS = {
  initialRentPM: ["initialRentPM", "InitialRentPM"],
  initialRentPA: ["initialRentPA", "InitialRentPA"],
  currentRentPA: ["CurrRentPA"],
  groupRate: ["groupRate", "GroupRate", "totalRate", "TotalRate"],
  rentalValue: ["rentalValue", "RentalValue"],
  govtShare: ["govtShare", "GovtShare"],
  pafShare: ["pafShare", "PAFShare"],
};

function normalizeContractsMoneyRawToNumber(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseContractsGridRowMoneyNumber(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = CONTRACTS_GRID_MONEY_COMPARE_FALLBACK_KEYS[columnId] || [];
  if (
    (raw === undefined || raw === null || (typeof raw === "string" && raw.trim() === "")) &&
    o &&
    fallbacks.length
  ) {
    for (let i = 0; i < fallbacks.length; i += 1) {
      const v = o[fallbacks[i]];
      if (v != null && !(typeof v === "string" && v.trim() === "")) {
        raw = v;
        break;
      }
    }
  }
  return normalizeContractsMoneyRawToNumber(raw);
}

function contractsMoneyApproxEqual(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= 1e-6 * scale;
}

function contractsGridMoneyCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowN = parseContractsGridRowMoneyNumber(row, columnId);
    if (rowN === null) return false;
    const { mode } = filterValue;
    if (mode === "gt") {
      const ref = normalizeContractsMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rowN > ref;
    }
    if (mode === "lte") {
      const ref = normalizeContractsMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rowN <= ref;
    }
    if (mode === "eq") {
      const ref = normalizeContractsMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return contractsMoneyApproxEqual(rowN, ref);
    }
    if (mode === "between") {
      const a = normalizeContractsMoneyRawToNumber(filterValue.valueFrom);
      const b = normalizeContractsMoneyRawToNumber(filterValue.valueTo);
      if (a === null || b === null) return false;
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      return rowN >= low && rowN <= high;
    }
    return true;
  });
}

/** Numeric / amount filters for money columns on the Contracts grid (gt / lte / eq / inclusive range). */
function ContractsMoneyColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Amount";
  const modeLabelId = `contracts-money-filter-mode-${column.id || "col"}`;

  const [anchorEl, setAnchorEl] = useState(null);
  const [mode, setMode] = useState("none");
  const [refAmt, setRefAmt] = useState("");
  const [endAmt, setEndAmt] = useState("");
  const open = Boolean(anchorEl);

  useEffect(() => {
    if (!open) return;
    const fv = column.filterValue;
    if (!fv || fv.mode === undefined || fv.mode === "none") {
      setMode("none");
      setRefAmt("");
      setEndAmt("");
      return;
    }
    if (fv.mode === "between") {
      setMode("between");
      setRefAmt(fv.valueFrom != null ? String(fv.valueFrom) : "");
      setEndAmt(fv.valueTo != null ? String(fv.valueTo) : "");
    } else {
      setMode(["gt", "lte", "eq"].includes(fv.mode) ? fv.mode : "none");
      setRefAmt(fv.value != null ? String(fv.value) : "");
      setEndAmt("");
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
    else if (mode === "gt" || mode === "lte" || mode === "eq") {
      if (!String(refAmt).trim()) return;
      column.setFilter({ mode, value: refAmt.trim() });
    } else if (mode === "between") {
      if (!String(refAmt).trim() || !String(endAmt).trim()) return;
      column.setFilter({
        mode: "between",
        valueFrom: refAmt.trim(),
        valueTo: endAmt.trim(),
      });
    }
    handleClose();
  };

  const clearFilter = () => {
    column.setFilter(undefined);
    setMode("none");
    setRefAmt("");
    setEndAmt("");
    handleClose();
  };

  const inputSx = { width: "100%", fontSize: "0.8125rem" };

  return (
    <>
      <Tooltip title={`Filter by ${colLabel}`}>
        <IconButton
          size="small"
          onClick={handleOpen}
          onMouseDown={(ev) => ev.stopPropagation()}
          sx={{
            fontSize: "10px",
            padding: "0px",
            minWidth: "14px",
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
              <MenuItem value="none">No amount filter</MenuItem>
              <MenuItem value="gt">Greater than</MenuItem>
              <MenuItem value="lte">Less than or equal to</MenuItem>
              <MenuItem value="eq">Equal to</MenuItem>
              <MenuItem value="between">Price range</MenuItem>
            </Select>
          </FormControl>
          {(mode === "gt" || mode === "lte" || mode === "eq") && (
            <>
              <MDTypography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
                Reference amount
              </MDTypography>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={refAmt}
                onChange={(e) => setRefAmt(e.target.value)}
                style={inputSx}
              />
            </>
          )}
          {mode === "between" && (
            <>
              <MDTypography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
                Lower bound
              </MDTypography>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={refAmt}
                onChange={(e) => setRefAmt(e.target.value)}
                style={inputSx}
              />
              <MDTypography variant="caption" color="text" display="block" sx={{ mt: 1, mb: 0.5 }}>
                Upper bound
              </MDTypography>
              <input
                type="number"
                step="any"
                inputMode="decimal"
                value={endAmt}
                onChange={(e) => setEndAmt(e.target.value)}
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

ContractsMoneyColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const CONTRACTS_DATATABLE_EXTRA_FILTER_TYPES = Object.freeze({
  contractsDateCompare: contractsGridDateCompare,
  contractsMoneyCompare: contractsGridMoneyCompare,
});

function unwrapContractInvoiceScheduleList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.Data)) return res.Data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.Items)) return res.Items;
  return [];
}

/** Leading numeric segment of InvoiceNo, e.g. 003-A001-BMSR-P1 → "3", 014-A001-BMSR-P1 → "14". */
function parseInvoiceNoLeadingSno(invoiceNo) {
  const raw = String(invoiceNo ?? "").trim();
  if (!raw) return "";
  const head = raw.split("-")[0];
  const n = parseInt(head, 10);
  return Number.isFinite(n) ? String(n) : head;
}

function toContractInvoiceDateInputValue(raw) {
  if (!raw) return "";
  const s = String(raw).trim();
  if (!s) return "";
  return s.includes("T") ? s.split("T")[0].slice(0, 10) : s.slice(0, 10);
}

function parsePositiveInteger(value) {
  const n = parseInt(String(value ?? "").trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function computeAgreementInvoicePeriodEnd(periodStartYyyyMmDd, paymentTermMonths) {
  const start = toContractInvoiceDateInputValue(periodStartYyyyMmDd);
  if (!start || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return "";
  const months = parsePositiveInteger(paymentTermMonths);
  if (!months) return "";
  const parsedStart = parseISO(start);
  if (!isValid(parsedStart)) return "";
  return format(addMonths(parsedStart, months), "yyyy-MM-dd");
}

const CONTRACT_SCH_MONTH_SHORT = [
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

function formatContractSchDateDisplay(raw) {
  const datePart = toContractInvoiceDateInputValue(raw);
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
  const [y, m, d] = datePart.split("-").map(Number);
  const month = CONTRACT_SCH_MONTH_SHORT[m - 1];
  if (!month) return "";
  return `${String(d).padStart(2, "0")}-${month}-${y}`;
}

/** Default Period text for invoice schedule grid / Description column. */
function formatContractSchPeriodDisplay(periodStart, periodEnd) {
  const start = formatContractSchDateDisplay(periodStart);
  const end = formatContractSchDateDisplay(periodEnd);
  if (!start && !end) return "";
  if (start && end) return `${start} To ${end}`;
  return start || end || "";
}

/** Create Agreement Invoice — Description from Period Start/End (e.g. Jan-2025 to Dec-2025). */
function formatContractSchMonthYearDisplay(raw) {
  const datePart = toContractInvoiceDateInputValue(raw);
  if (!datePart || !/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "";
  const [y, m] = datePart.split("-").map(Number);
  const month = CONTRACT_SCH_MONTH_SHORT[m - 1];
  if (!month) return "";
  return `${month}-${y}`;
}

function formatContractSchPeriodMonthYearDisplay(periodStart, periodEnd) {
  const start = formatContractSchMonthYearDisplay(periodStart);
  const end = formatContractSchMonthYearDisplay(periodEnd);
  if (!start && !end) return "";
  if (start && end) return `${start} to ${end}`;
  return start || end || "";
}

function pickContractSchPeriodDescription(row) {
  const stored = String(
    pickSchField(row, "Description", "description") || pickSchField(row, "Desc", "desc") || ""
  ).trim();
  if (stored) return stored;
  return formatContractSchPeriodDisplay(
    pickSchField(row, "PeriodStart", "periodStart"),
    pickSchField(row, "PeriodEnd", "periodEnd")
  );
}

/** e.g. 005-A1-ww → { num: 5, width: 3, restSuffix: "A1-ww" } */
function parseInvoiceNoLeadingSegment(invoiceNo) {
  const raw = String(invoiceNo ?? "").trim();
  if (!raw) return null;
  const dashIdx = raw.indexOf("-");
  const head = dashIdx >= 0 ? raw.slice(0, dashIdx) : raw;
  const restSuffix = dashIdx >= 0 ? raw.slice(dashIdx + 1) : "";
  const num = parseInt(head, 10);
  if (!Number.isFinite(num)) return null;
  return { num, width: head.length, restSuffix };
}

function generateNextContractInvoiceNo(rows) {
  let maxNum = 0;
  let width = 3;
  let restSuffix = "";
  (rows || []).forEach((r) => {
    if (r?.__isDraftNewInvoice) return;
    const inv = String(r?.InvoiceNo ?? r?.invoiceNo ?? "").trim();
    const parts = parseInvoiceNoLeadingSegment(inv);
    if (!parts) return;
    if (parts.num >= maxNum) {
      maxNum = parts.num;
      width = Math.max(width, parts.width);
      restSuffix = parts.restSuffix;
    }
  });
  const head = String(maxNum + 1).padStart(width, "0");
  return restSuffix ? `${head}-${restSuffix}` : head;
}

function generateNextFinalizedContractInvoiceNo(rows) {
  const finalizedRows = (rows || []).filter(
    (r) => pickScheduleRowIsFinalize(r) && !r?.__isDraftNewInvoice
  );
  return generateNextContractInvoiceNo(finalizedRows.length > 0 ? finalizedRows : rows);
}

function pickContractInvoiceTemplateRow(rows) {
  let best = null;
  let maxNum = -1;
  (rows || []).forEach((r) => {
    if (r?.__isDraftNewInvoice) return;
    const inv = String(r?.InvoiceNo ?? r?.invoiceNo ?? "").trim();
    const parts = parseInvoiceNoLeadingSegment(inv);
    if (parts && parts.num > maxNum) {
      maxNum = parts.num;
      best = r;
    }
  });
  if (best) return best;
  const list = (rows || []).filter((r) => !r?.__isDraftNewInvoice);
  return list.length ? list[list.length - 1] : null;
}

function unwrapLockDateConfigList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (response && typeof response === "object") return [response];
  return [];
}

function pickActiveLockDateYyyyMmDd(lockDateRows) {
  const rows = lockDateRows || [];
  const active =
    rows.find((r) => r?.IsActive === true || r?.IsActive === 1 || r?.isActive === true) || rows[0];
  if (!active) return "";
  const raw =
    active?.LockingDate ?? active?.lockingDate ?? active?.LockDate ?? active?.lockDate ?? "";
  return toContractInvoiceDateInputValue(raw);
}

/** Undo finalize allowed when invoice date is after the configured lock date. */
function isInvoiceRowAllowedByLockDateConstraint(invoiceRow, lockDateYyyyMmDd) {
  const lockStr = String(lockDateYyyyMmDd || "").trim();
  if (!lockStr) return true;
  const lockTs = Date.parse(lockStr);
  if (!Number.isFinite(lockTs)) return true;
  const invoiceDateRaw =
    pickScheduleInvoiceDateSch(invoiceRow) ||
    pickSchField(invoiceRow, "PeriodStart", "periodStart") ||
    pickSchField(invoiceRow, "DueDate", "dueDate");
  const invStr = toContractInvoiceDateInputValue(invoiceDateRaw);
  if (!invStr) return false;
  const invTs = Date.parse(invStr);
  if (!Number.isFinite(invTs)) return false;
  return invTs > lockTs;
}

function buildContractInvoiceDraftRow(templateRow, contractRow, allRows) {
  const template = templateRow || contractRow || {};
  const invoiceNo = generateNextContractInvoiceNo(allRows);
  const invoiceDateRaw =
    pickScheduleInvoiceDateSch(template) || pickSchField(template, "PeriodStart", "periodStart");
  const dueDateRaw = pickSchField(template, "DueDate", "dueDate");
  const contractNo = pickSchField(contractRow || template, "ContractNo", "contractNo");
  const periodStart = pickSchField(template, "PeriodStart", "periodStart");
  const periodEnd = pickSchField(template, "PeriodEnd", "periodEnd");
  const defaultPeriodDescription = formatContractSchPeriodDisplay(periodStart, periodEnd);
  return {
    ...template,
    ContractNo: contractNo || template.ContractNo,
    contractNo: contractNo || template.contractNo,
    PaymentTermMonths:
      template.PaymentTermMonths ??
      template.paymentTermMonths ??
      contractRow?.PaymentTermMonths ??
      contractRow?.paymentTermMonths,
    paymentTermMonths:
      template.paymentTermMonths ??
      template.PaymentTermMonths ??
      contractRow?.paymentTermMonths ??
      contractRow?.PaymentTermMonths,
    InvoiceNo: invoiceNo,
    invoiceNo,
    Description: defaultPeriodDescription,
    description: defaultPeriodDescription,
    Desc: defaultPeriodDescription,
    __isDraftNewInvoice: true,
    __finalizeKey: "__draft_new_invoice__",
    IsFinalized: false,
    isFinalized: false,
    __draftInvoiceDate: toContractInvoiceDateInputValue(invoiceDateRaw),
    __draftDueDate: toContractInvoiceDateInputValue(dueDateRaw),
  };
}

/** Selection key from InvoiceNo (Sno); API calls still use full InvoiceNo on the row. */
function buildContractInvoiceFinalizeRowKey(row, rowIndex) {
  const invoiceNo = String(row?.InvoiceNo ?? row?.invoiceNo ?? "").trim();
  const sno = parseInvoiceNoLeadingSno(invoiceNo);
  const sub = row?.SubInvoiceNo ?? row?.subInvoiceNo;
  const subStr = sub === null || sub === undefined ? "" : String(sub).trim();
  if (sno && subStr) return `${sno}|${subStr}`;
  if (sno) return sno;
  if (invoiceNo) return invoiceNo;
  return `row-${rowIndex ?? 0}`;
}

function getContractInvoiceFinalizeRowKey(r) {
  return String(r?.__finalizeKey ?? "").trim();
}

function getContractInvoiceFinalizeInvoiceNo(r) {
  return String(r?.InvoiceNo ?? r?.invoiceNo ?? "").trim();
}

function parseContractInvoiceLeadingSnoNumber(invoiceNo) {
  const sno = parseInvoiceNoLeadingSno(invoiceNo);
  const n = parseInt(String(sno || "").trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function getAllowedPendingFinalizeKeySet(rows) {
  const finalizedRows = (rows || []).filter(
    (r) => pickScheduleRowIsFinalize(r) && !r?.__isDraftNewInvoice
  );
  const pendingRows = (rows || []).filter(
    (r) => !pickScheduleRowIsFinalize(r) && !r?.__isDraftNewInvoice
  );
  if (pendingRows.length === 0) return new Set();

  let maxFinalizedSno = null;
  finalizedRows.forEach((r) => {
    const sno = parseContractInvoiceLeadingSnoNumber(getContractInvoiceFinalizeInvoiceNo(r));
    if (sno === null) return;
    maxFinalizedSno = maxFinalizedSno === null ? sno : Math.max(maxFinalizedSno, sno);
  });

  let nextAllowedSno = maxFinalizedSno !== null ? maxFinalizedSno + 1 : null;
  if (nextAllowedSno === null) {
    pendingRows.forEach((r) => {
      const sno = parseContractInvoiceLeadingSnoNumber(getContractInvoiceFinalizeInvoiceNo(r));
      if (sno === null) return;
      nextAllowedSno = nextAllowedSno === null ? sno : Math.min(nextAllowedSno, sno);
    });
  }

  if (nextAllowedSno === null) return new Set();

  const allowed = new Set();
  pendingRows.forEach((r) => {
    if (pickScheduleRowIsExplicitlyUnfinalized(r)) {
      const key = getContractInvoiceFinalizeRowKey(r);
      if (key) allowed.add(key);
      return;
    }
    const sno = parseContractInvoiceLeadingSnoNumber(getContractInvoiceFinalizeInvoiceNo(r));
    const isPreviouslyUnfinalizedSequence =
      maxFinalizedSno !== null && sno !== null && sno < maxFinalizedSno;
    if (sno !== nextAllowedSno && !isPreviouslyUnfinalizedSequence) return;
    const key = getContractInvoiceFinalizeRowKey(r);
    if (key) allowed.add(key);
  });
  return allowed;
}

function hasDuplicateInvoicePeriod(rows, periodStart, periodEnd, currentInvoiceNo = "") {
  const start = toContractInvoiceDateInputValue(periodStart);
  const end = toContractInvoiceDateInputValue(periodEnd);
  if (!start || !end) return false;
  const currentInvoice = String(currentInvoiceNo || "").trim();
  return (rows || []).some((r) => {
    if (r?.__isDraftNewInvoice) return false;
    const rowStart = toContractInvoiceDateInputValue(pickSchField(r, "PeriodStart", "periodStart"));
    const rowEnd = toContractInvoiceDateInputValue(pickSchField(r, "PeriodEnd", "periodEnd"));
    if (!rowStart || !rowEnd) return false;
    if (rowStart !== start || rowEnd !== end) return false;
    const rowInvoiceNo = getContractInvoiceFinalizeInvoiceNo(r);
    return !currentInvoice || rowInvoiceNo !== currentInvoice;
  });
}

function assignContractInvoiceFinalizeKeys(rows) {
  const seen = new Map();
  return (rows || []).map((row, index) => {
    let key = buildContractInvoiceFinalizeRowKey(row, index);
    const count = seen.get(key) ?? 0;
    if (count > 0) key = `${key}#${count}`;
    seen.set(buildContractInvoiceFinalizeRowKey(row, index), count + 1);
    return { ...row, __finalizeKey: key };
  });
}

function pickSchField(sch, pascal, camel) {
  const v = sch?.[pascal] ?? sch?.[camel];
  if (v === null || v === undefined) return "";
  return v;
}

function pickScheduleInvoiceDateSch(sch) {
  const dateType = String(pickSchField(sch, "InvoiceDateType", "invoiceDateType"))
    .trim()
    .toLowerCase();
  if (dateType.includes("end")) return pickSchField(sch, "PeriodEnd", "periodEnd");
  return pickSchField(sch, "PeriodStart", "periodStart");
}

function pickScheduleRowIsFinalize(rowData) {
  if (!rowData) return false;
  const v =
    rowData?.IsFinalized ?? rowData?.isFinalized ?? rowData?.IsFinalize ?? rowData?.isFinalize;
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "string" && v.trim().toLowerCase() === "true") return true;
  return false;
}

function pickScheduleRowIsExplicitlyUnfinalized(rowData) {
  if (!rowData) return false;
  const v =
    rowData?.IsFinalized ?? rowData?.isFinalized ?? rowData?.IsFinalize ?? rowData?.isFinalize;
  return v === 0 || v === "0";
}

function pickNum(obj, pascal, camel, fallback) {
  if (!obj) {
    if (fallback === null || fallback === undefined || fallback === "") return null;
    const fn = Number(fallback);
    return Number.isFinite(fn) ? fn : null;
  }
  const v = obj[pascal] ?? obj[camel] ?? fallback;
  if (v === null || v === undefined || v === "") {
    if (fallback === null || fallback === undefined || fallback === "") return null;
    const fn = Number(fallback);
    return Number.isFinite(fn) ? fn : null;
  }
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildFinalizeInvoiceSchedulePayload(contractRow, sch) {
  const cr = contractRow || {};
  const str = (pascal, camel, fb = "") =>
    String(sch?.[pascal] ?? sch?.[camel] ?? cr?.[pascal] ?? cr?.[camel] ?? fb ?? "").trim();
  const contractNo = str("ContractNo", "contractNo");
  const invoiceNo = str("InvoiceNo", "invoiceNo");
  const contractId = pickNum(sch, "ContractId", "contractId", pickNum(cr, "Id", "id", null));
  const periodStart = pickSchField(sch, "PeriodStart", "periodStart") || null;
  const periodEnd = pickSchField(sch, "PeriodEnd", "periodEnd") || null;
  const totalRent = pickNum(sch, "TotalRent", "totalRent", pickNum(sch, "Total", "total", null));
  const amountReceivable = pickNum(sch, "AmountReceivable", "amountReceivable", totalRent);
  const amountPending = pickNum(sch, "AmountPending", "amountPending", amountReceivable);
  const amountReceived = pickNum(sch, "AmountReceived", "amountReceived", 0) ?? 0;

  return {
    ContractId: contractId,
    ClassId: pickNum(sch, "ClassId", "classId", pickNum(cr, "ClassId", "classId", null)),
    CmdId: pickNum(sch, "CmdId", "cmdId", pickNum(cr, "CmdId", "cmdId", null)),
    BaseId: pickNum(sch, "BaseId", "baseId", pickNum(cr, "BaseId", "baseId", null)),
    ContractNo: contractNo,
    ContractStartDate:
      pickSchField(sch, "ContractStartDate", "contractStartDate") ||
      cr?.ContractStartDate ||
      cr?.contractStartDate ||
      null,
    ContractEndDate:
      pickSchField(sch, "ContractEndDate", "contractEndDate") ||
      cr?.ContractEndDate ||
      cr?.contractEndDate ||
      null,
    InvoiceNo: invoiceNo,
    PeriodStart: periodStart || null,
    PeriodEnd: periodEnd || null,
    DueDate: pickSchField(sch, "DueDate", "dueDate") || null,
    CalculatedRentPM: pickNum(sch, "CalculatedRentPM", "calculatedRentPM", null),
    Months: pickNum(sch, "Months", "months", null),
    TotalRent: totalRent,
    ItemwithCode: str("ItemwithCode", "itemwithCode", str("ItemCode", "itemCode")),
    Description: str("Description", "description", str("Desc", "desc")),
    AccHead: str("AccHead", "accHead"),
    Discount: pickNum(sch, "Discount", "discount", sch?.DiscountPercent ?? sch?.discountPercent),
    Total: pickNum(sch, "Total", "total", totalRent),
    Remarks: str("Remarks", "remarks"),
    AmountReceived: amountReceived,
    AmountReceivable: amountReceivable,
    AmountPending: amountPending,
    BusinessName: str("BusinessName", "businessName"),
    InvoiceDateType: str("InvoiceDateType", "invoiceDateType"),
    InvoiceStatus: str("InvoiceStatus", "invoiceStatus", "Unpaid"),
    InitialRentPM: pickNum(
      sch,
      "InitialRentPM",
      "initialRentPM",
      cr?.InitialRentPM ?? cr?.initialRentPM
    ),
    PaymentTermMonths: pickNum(
      sch,
      "PaymentTermMonths",
      "paymentTermMonths",
      cr?.PaymentTermMonths ?? cr?.paymentTermMonths
    ),
    RiseTermType: str("RiseTermType", "riseTermType"),
    RiseTerm: str("RiseTerm", "riseTerm"),
    RiseRate: pickNum(sch, "RiseRate", "riseRate", cr?.RiseRate ?? cr?.riseRate),
    RiseDate: pickSchField(sch, "RiseDate", "riseDate") || cr?.RiseDate || cr?.riseDate || null,
    IsFinalized: true,
    isFinalized: true,
  };
}

function formatSchGridNumber(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value);
}

/** Same columns as agreement-prov-invoice grid (excluding View / Action). */
const CONTRACT_INVOICE_FINALIZE_COLS = [
  {
    key: "contractNo",
    label: "Contract No",
    align: "right",
    get: (r) => pickSchField(r, "ContractNo", "contractNo") || "—",
  },
  {
    key: "contractPeriod",
    label: "Contract Period",
    align: "left",
    get: (r, formatDate) => {
      const start = pickSchField(r, "ContractStartDate", "contractStartDate");
      const end = pickSchField(r, "ContractEndDate", "contractEndDate");
      if (!start && !end) return "—";
      if (start && end) return `${formatDate(start)} To ${formatDate(end)}`;
      return formatDate(start || end) || "—";
    },
  },
  {
    key: "invoiceNo",
    label: "Invoice ID",
    align: "left",
    get: (r) => pickSchField(r, "InvoiceNo", "invoiceNo") || "—",
  },
  {
    key: "invoiceDate",
    label: "Invoice Date",
    align: "left",
    get: (r, formatDate) => formatDate(pickScheduleInvoiceDateSch(r)) || "—",
  },
  {
    key: "dueDate",
    label: "Due Date",
    align: "left",
    get: (r, formatDate) => formatDate(pickSchField(r, "DueDate", "dueDate")) || "—",
  },
  {
    key: "period",
    label: "Period",
    align: "left",
    get: (r) => pickContractSchPeriodDescription(r) || "—",
  },
  {
    key: "calculatedRentPM",
    label: "Rate PM",
    align: "right",
    get: (r) => formatSchGridNumber(pickSchField(r, "CalculatedRentPM", "calculatedRentPM")),
  },
  {
    key: "months",
    label: "Months",
    align: "right",
    get: (r) => formatSchGridNumber(pickSchField(r, "Months", "months")),
  },
  {
    key: "totalRent",
    label: "Net Amount",
    align: "right",
    get: (r) => formatSchGridNumber(pickSchField(r, "TotalRent", "totalRent")),
  },
  {
    key: "remarks",
    label: "Remarks",
    align: "left",
    get: (r) => pickSchField(r, "Remarks", "remarks") || "—",
  },
  {
    key: "amountReceived",
    label: "Amount Received",
    align: "right",
    get: (r) => formatSchGridNumber(pickSchField(r, "AmountReceived", "amountReceived")),
  },
  {
    key: "amountReceivable",
    label: "Amount Receivable",
    align: "right",
    get: (r) => formatSchGridNumber(pickSchField(r, "AmountReceivable", "amountReceivable")),
  },
  {
    key: "amountPending",
    label: "Amount Pending",
    align: "right",
    get: (r) => formatSchGridNumber(pickSchField(r, "AmountPending", "amountPending")),
  },
  {
    key: "businessName",
    label: "Business Name",
    align: "left",
    get: (r) => pickSchField(r, "BusinessName", "businessName") || "—",
  },
  {
    key: "invoiceStatus",
    label: "Invoice Status",
    align: "center",
    get: (r) => pickSchField(r, "InvoiceStatus", "invoiceStatus") || "—",
  },
];

const CONTRACT_INVOICE_FINALIZE_GRID_COLUMNS_DATA = [
  "minmax(96px, max-content)",
  "minmax(168px, max-content)",
  "minmax(120px, max-content)",
  "minmax(96px, max-content)",
  "minmax(96px, max-content)",
  "minmax(168px, max-content)",
  "minmax(80px, max-content)",
  "minmax(64px, max-content)",
  "minmax(88px, max-content)",
  "minmax(100px, max-content)",
  "minmax(96px, max-content)",
  "minmax(96px, max-content)",
  "minmax(96px, max-content)",
  "minmax(120px, max-content)",
  "minmax(96px, max-content)",
].join(" ");

const CONTRACT_INVOICE_FINALIZE_GRID_COLUMNS = [
  "44px",
  CONTRACT_INVOICE_FINALIZE_GRID_COLUMNS_DATA,
].join(" ");

function contractInvoiceFinalizeCellAlignSx(align) {
  const a = align === "right" ? "right" : align === "center" ? "center" : "left";
  return {
    textAlign: a,
    justifyContent: a === "right" ? "flex-end" : a === "center" ? "center" : "flex-start",
  };
}

function getContractInvoiceFinalizeRowDisplay(r, formatDate) {
  const cells = {};
  CONTRACT_INVOICE_FINALIZE_COLS.forEach((col) => {
    cells[col.key] = col.get(r, formatDate);
  });
  const searchText = Object.values(cells).join(" ").toLowerCase();
  return { cells, searchText };
}

/** Row payload for Edit Agreement Invoice dialog from Contracts finalize grid. */
function buildAgreementProvEditRowFromContractAndSchedule(contractRow, scheduleRow) {
  const contract = contractRow || {};
  const sch = scheduleRow || {};
  const contractNo =
    pickSchField(contract, "ContractNo", "contractNo") ||
    pickSchField(sch, "ContractNo", "contractNo");
  const invoiceNo =
    pickSchField(sch, "InvoiceNo", "invoiceNo") || pickSchField(contract, "InvoiceNo", "invoiceNo");
  return {
    ...contract,
    ...sch,
    ContractNo: contractNo || sch.ContractNo || contract.ContractNo,
    contractNo: contractNo || sch.contractNo || contract.contractNo,
    InvoiceNo: invoiceNo || sch.InvoiceNo,
    invoiceNo: invoiceNo || sch.invoiceNo,
    PaymentTermMonths:
      sch.PaymentTermMonths ??
      sch.paymentTermMonths ??
      contract.PaymentTermMonths ??
      contract.paymentTermMonths,
    paymentTermMonths:
      sch.paymentTermMonths ??
      sch.PaymentTermMonths ??
      contract.paymentTermMonths ??
      contract.PaymentTermMonths,
    RentalValueRate:
      contract.RentalValueRate ??
      contract.rentalValueRate ??
      contract.RentalValue ??
      contract.rentalValue ??
      sch.RentalValueRate ??
      sch.rentalValueRate,
    rentalValueRate:
      contract.rentalValueRate ??
      contract.RentalValueRate ??
      contract.rentalValue ??
      contract.rentalValue ??
      sch.rentalValueRate ??
      sch.RentalValueRate,
  };
}

function readContractsUrlContractNo() {
  return readContractsUrlKpiFilters().contractNo;
}

function rowMatchesKpiContractHealthFilter(row, filterKey, getRowContractStateNormalized) {
  if (!filterKey) return true;
  const st = getRowContractStateNormalized(row);
  const payload = String(
    row.ContractState ?? row.contractState ?? row.ContractStatus ?? row.contractStatus ?? ""
  )
    .trim()
    .toLowerCase();
  switch (filterKey) {
    case "active":
      return (
        st === "active" || st === "valid" || payload.includes("active") || payload.includes("valid")
      );
    case "expiring":
      return st === "expiring" || payload.includes("expir") || payload.includes("border");
    case "terminated":
      return st === "terminated" || payload.includes("terminat") || payload.includes("closed");
    case "vacant":
      return st === "vacant" || payload.includes("vacant");
    default:
      return true;
  }
}

function rowMatchesKpiContractStatusFilter(row, filterKey) {
  if (!filterKey) return true;
  if (filterKey === "viable" || filterKey === "unviable") {
    const v = String(
      row.feasible ?? row.Viability ?? row.viability ?? row.Feasible ?? row.feasible ?? ""
    )
      .trim()
      .toLowerCase();
    if (filterKey === "viable") return v === "viable";
    return v === "unviable";
  }
  const isActive =
    row.Status === true ||
    row.Status === 1 ||
    row.Status === "1" ||
    (typeof row.Status === "string" && String(row.Status).toLowerCase() === "active");
  if (filterKey === "active") return isActive;
  if (filterKey === "inactive") return !isActive;
  return true;
}

function ContractInvoiceFinalizeGrid({
  rows,
  selectedKeys,
  onSelectedKeysChange,
  busy,
  formatDate,
  readOnly,
  undoSelectable,
  searchValue,
  onSearchChange,
  hideSearchInput,
  draftNewRow,
  onDraftInvoiceDateChange,
  onDraftDueDateChange,
  onDraftSave,
  onDraftCancel,
  showDuplicateAction,
  onDuplicateRow,
  allowedSelectionKeys,
  blurNonSelectableRows,
  clickableInvoiceNo,
  onInvoiceNoClick,
}) {
  const [internalSearch, setInternalSearch] = useState("");
  const search =
    searchValue !== undefined && searchValue !== null ? String(searchValue) : internalSearch;
  const setSearch = onSearchChange || setInternalSearch;
  const selectable = !readOnly || undoSelectable;
  const hasDraft = Boolean(draftNewRow?.__isDraftNewInvoice);
  const gridTemplateColumns = [
    ...(selectable ? ["44px"] : []),
    CONTRACT_INVOICE_FINALIZE_GRID_COLUMNS_DATA,
    ...(showDuplicateAction ? ["minmax(72px, max-content)"] : []),
  ].join(" ");

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) =>
      getContractInvoiceFinalizeRowDisplay(r, formatDate).searchText.includes(q)
    );
  }, [rows, search, formatDate]);

  const allowedSelectionKeySet = useMemo(() => {
    if (undoSelectable || !allowedSelectionKeys) return null;
    const list =
      allowedSelectionKeys instanceof Set
        ? Array.from(allowedSelectionKeys)
        : Array.isArray(allowedSelectionKeys)
        ? allowedSelectionKeys
        : [];
    const normalized = list.map((k) => String(k || "").trim()).filter(Boolean);
    return normalized.length > 0 ? new Set(normalized) : null;
  }, [allowedSelectionKeys, undoSelectable]);

  const filteredKeys = useMemo(() => {
    if (!selectable) return [];
    if (undoSelectable) {
      return filteredRows
        .filter((r) => pickScheduleRowIsFinalize(r) && !r?.__isDraftNewInvoice)
        .map(getContractInvoiceFinalizeRowKey)
        .filter(Boolean);
    }
    return filteredRows
      .filter((r) => {
        if (pickScheduleRowIsFinalize(r)) return false;
        if (!allowedSelectionKeySet) return true;
        const rowKey = getContractInvoiceFinalizeRowKey(r);
        return Boolean(rowKey) && allowedSelectionKeySet.has(rowKey);
      })
      .map(getContractInvoiceFinalizeRowKey)
      .filter(Boolean);
  }, [filteredRows, selectable, undoSelectable, allowedSelectionKeySet]);

  const selectedInViewCount = filteredKeys.filter((k) => selectedKeys.has(k)).length;
  const allInViewSelected = filteredKeys.length > 0 && selectedInViewCount === filteredKeys.length;
  const someInViewSelected = selectedInViewCount > 0 && !allInViewSelected;

  const cellBaseSx = {
    display: "flex",
    alignItems: "center",
    minHeight: 36,
    fontSize: "0.8125rem",
    lineHeight: 1.3,
    py: 0.5,
    px: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  };

  const headerCellSx = {
    ...cellBaseSx,
    fontWeight: 700,
    fontSize: "0.7rem",
    letterSpacing: "0.02em",
    textTransform: "uppercase",
    bgcolor: "#f4f6f8",
    borderBottom: "1px solid rgba(0,0,0,0.12)",
    position: "sticky",
    top: 0,
    zIndex: 2,
  };

  const bodyCellSx = {
    ...cellBaseSx,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  };

  const gridTableSx = {
    display: "grid",
    gridTemplateColumns,
    width: "max-content",
    minWidth: "100%",
    columnGap: 0,
    alignItems: "stretch",
  };

  const toggleSelectAllInView = () => {
    onSelectedKeysChange((prev) => {
      const next = new Set(prev);
      if (allInViewSelected) {
        filteredKeys.forEach((k) => next.delete(k));
      } else {
        filteredKeys.forEach((k) => next.add(k));
      }
      return next;
    });
  };

  return (
    <MDBox>
      {!hideSearchInput && (
        <MDBox mb={1.5}>
          <MDInput
            placeholder="Search invoices..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            fullWidth
            size="small"
            disabled={busy}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Icon sx={{ fontSize: "1.1rem", opacity: 0.6 }}>search</Icon>
                </InputAdornment>
              ),
            }}
          />
        </MDBox>
      )}
      <MDBox
        sx={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <MDBox sx={{ overflow: "auto", maxHeight: "52vh" }}>
          {filteredRows.length === 0 && !hasDraft ? (
            <MDTypography variant="caption" color="text" display="block" textAlign="center" py={2}>
              {search.trim() ? "No rows match your search." : "No invoice schedule rows found."}
            </MDTypography>
          ) : (
            <MDBox sx={gridTableSx}>
              <MDBox sx={{ display: "contents" }}>
                {selectable && (
                  <MDBox
                    sx={{
                      ...headerCellSx,
                      justifyContent: "center",
                      px: 0.5,
                    }}
                  >
                    <Checkbox
                      size="small"
                      indeterminate={someInViewSelected}
                      checked={allInViewSelected}
                      onChange={toggleSelectAllInView}
                      disabled={busy || filteredKeys.length === 0}
                    />
                  </MDBox>
                )}
                {CONTRACT_INVOICE_FINALIZE_COLS.map((col) => (
                  <MDBox
                    key={col.key}
                    sx={{
                      ...headerCellSx,
                      ...contractInvoiceFinalizeCellAlignSx(col.align),
                    }}
                  >
                    {col.label}
                  </MDBox>
                ))}
                {showDuplicateAction && (
                  <MDBox
                    sx={{
                      ...headerCellSx,
                      ...contractInvoiceFinalizeCellAlignSx("center"),
                    }}
                  >
                    Action
                  </MDBox>
                )}
              </MDBox>
              {hasDraft &&
                (() => {
                  const r = draftNewRow;
                  const d = getContractInvoiceFinalizeRowDisplay(
                    {
                      ...r,
                      PeriodStart: r.__draftInvoiceDate || r.PeriodStart,
                      periodStart: r.__draftInvoiceDate || r.periodStart,
                      DueDate: r.__draftDueDate || r.DueDate,
                      dueDate: r.__draftDueDate || r.dueDate,
                    },
                    formatDate
                  );
                  return (
                    <MDBox
                      key="__draft_new_invoice__"
                      sx={{
                        display: "contents",
                        "& > *": {
                          bgcolor: "#e3f2fd !important",
                        },
                      }}
                    >
                      {selectable && (
                        <MDBox
                          sx={{
                            ...bodyCellSx,
                            justifyContent: "center",
                            gap: 0.25,
                            px: 0.25,
                          }}
                        >
                          <Tooltip title="Save invoice">
                            <span>
                              <IconButton
                                size="small"
                                color="success"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDraftSave();
                                }}
                              >
                                <Icon fontSize="small">check</Icon>
                              </IconButton>
                            </span>
                          </Tooltip>
                          <Tooltip title="Cancel">
                            <span>
                              <IconButton
                                size="small"
                                color="error"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDraftCancel();
                                }}
                              >
                                <Icon fontSize="small">close</Icon>
                              </IconButton>
                            </span>
                          </Tooltip>
                        </MDBox>
                      )}
                      {CONTRACT_INVOICE_FINALIZE_COLS.map((col) => {
                        const cellText = d.cells[col.key];
                        if (col.key === "invoiceDate") {
                          return (
                            <MDBox
                              key={col.key}
                              sx={{
                                ...bodyCellSx,
                                ...contractInvoiceFinalizeCellAlignSx(col.align),
                                overflow: "visible",
                              }}
                            >
                              <MDInput
                                type="date"
                                size="small"
                                value={r.__draftInvoiceDate || ""}
                                onChange={(e) => onDraftInvoiceDateChange(e.target.value)}
                                disabled={busy}
                                sx={{ width: "100%", minWidth: 130 }}
                              />
                            </MDBox>
                          );
                        }
                        if (col.key === "dueDate") {
                          return (
                            <MDBox
                              key={col.key}
                              sx={{
                                ...bodyCellSx,
                                ...contractInvoiceFinalizeCellAlignSx(col.align),
                                overflow: "visible",
                              }}
                            >
                              <MDInput
                                type="date"
                                size="small"
                                value={r.__draftDueDate || ""}
                                onChange={(e) => onDraftDueDateChange(e.target.value)}
                                disabled={busy}
                                sx={{ width: "100%", minWidth: 130 }}
                              />
                            </MDBox>
                          );
                        }
                        if (col.key === "invoiceNo") {
                          return (
                            <MDBox
                              key={col.key}
                              sx={{
                                ...bodyCellSx,
                                ...contractInvoiceFinalizeCellAlignSx(col.align),
                                fontWeight: 600,
                              }}
                              title={pickSchField(r, "InvoiceNo", "invoiceNo")}
                            >
                              {pickSchField(r, "InvoiceNo", "invoiceNo") || "—"}
                            </MDBox>
                          );
                        }
                        return (
                          <MDBox
                            key={col.key}
                            sx={{
                              ...bodyCellSx,
                              ...contractInvoiceFinalizeCellAlignSx(col.align),
                              fontVariantNumeric:
                                col.align === "right" ? "tabular-nums" : undefined,
                            }}
                            title={String(cellText ?? "")}
                          >
                            {cellText}
                          </MDBox>
                        );
                      })}
                    </MDBox>
                  );
                })()}
              {filteredRows.map((r, rowIdx) => {
                if (r?.__isDraftNewInvoice) return null;
                const rowKey = getContractInvoiceFinalizeRowKey(r);
                const d = getContractInvoiceFinalizeRowDisplay(r, formatDate);
                const isLast = rowIdx === filteredRows.length - 1;
                const isFinalized = pickScheduleRowIsFinalize(r);
                const sequenceBlocked =
                  !undoSelectable &&
                  !isFinalized &&
                  Boolean(allowedSelectionKeySet) &&
                  (!rowKey || !allowedSelectionKeySet.has(rowKey));
                const canSelectRow = undoSelectable
                  ? isFinalized && !r?.__isDraftNewInvoice
                  : !isFinalized && !sequenceBlocked;
                const rowDisabled =
                  selectable && !undoSelectable && (isFinalized || sequenceBlocked);
                const rowBlurred = blurNonSelectableRows && !undoSelectable && sequenceBlocked;
                return (
                  <MDBox
                    key={rowKey || `row-${r.InvoiceNo}-${r.SubInvoiceNo}`}
                    sx={{
                      display: "contents",
                      "& > *": {
                        bgcolor: rowDisabled ? "#ececec" : rowIdx % 2 === 0 ? "#fff" : "#fafbfc",
                        color: rowDisabled ? "text.disabled" : "inherit",
                        opacity: rowDisabled ? 0.72 : 1,
                        filter: rowBlurred ? "blur(1px)" : "none",
                        ...(isLast ? { borderBottom: "none" } : {}),
                      },
                      ...(!rowDisabled
                        ? {
                            "&:hover > *": {
                              bgcolor: "rgba(25, 118, 210, 0.06) !important",
                            },
                          }
                        : {}),
                    }}
                  >
                    {selectable && (
                      <MDBox
                        sx={{
                          ...bodyCellSx,
                          justifyContent: "center",
                          px: 0.5,
                        }}
                      >
                        <Checkbox
                          size="small"
                          checked={Boolean(rowKey) && canSelectRow && selectedKeys.has(rowKey)}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            e.stopPropagation();
                            if (!rowKey || !canSelectRow) return;
                            const checked = e.target.checked;
                            onSelectedKeysChange((prev) => {
                              const next = new Set(prev);
                              if (checked) next.add(rowKey);
                              else next.delete(rowKey);
                              return next;
                            });
                          }}
                          disabled={busy || !rowKey || !canSelectRow}
                        />
                      </MDBox>
                    )}
                    {CONTRACT_INVOICE_FINALIZE_COLS.map((col) => {
                      const cellText = d.cells[col.key];
                      const isInvoiceLink =
                        col.key === "invoiceNo" &&
                        cellText &&
                        cellText !== "—" &&
                        clickableInvoiceNo &&
                        typeof onInvoiceNoClick === "function";
                      return (
                        <MDBox
                          key={col.key}
                          sx={{
                            ...bodyCellSx,
                            ...contractInvoiceFinalizeCellAlignSx(col.align),
                            fontVariantNumeric: col.align === "right" ? "tabular-nums" : undefined,
                          }}
                          title={String(cellText ?? "")}
                        >
                          {isInvoiceLink ? (
                            <MDTypography
                              component="span"
                              variant="caption"
                              sx={{
                                cursor: "pointer",
                                color: "info.main",
                                textDecoration: "underline",
                                fontSize: "inherit",
                                lineHeight: "inherit",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                onInvoiceNoClick(r);
                              }}
                            >
                              {cellText}
                            </MDTypography>
                          ) : (
                            cellText
                          )}
                        </MDBox>
                      );
                    })}
                    {showDuplicateAction && (
                      <MDBox
                        sx={{
                          ...bodyCellSx,
                          ...contractInvoiceFinalizeCellAlignSx("center"),
                          gap: 0.25,
                        }}
                      >
                        {isFinalized && (
                          <Tooltip title="Duplicate">
                            <span>
                              <IconButton
                                size="small"
                                color="secondary"
                                disabled={busy}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onDuplicateRow?.(r);
                                }}
                                sx={{ padding: "2px" }}
                              >
                                <Icon fontSize="small">content_copy</Icon>
                              </IconButton>
                            </span>
                          </Tooltip>
                        )}
                      </MDBox>
                    )}
                  </MDBox>
                );
              })}
            </MDBox>
          )}
        </MDBox>
      </MDBox>
      {search.trim() && filteredRows.length > 0 && (
        <MDTypography variant="caption" color="text" sx={{ mt: 0.75, display: "block" }}>
          Showing {filteredRows.length} of {rows.length} row(s)
        </MDTypography>
      )}
    </MDBox>
  );
}

ContractInvoiceFinalizeGrid.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  selectedKeys: PropTypes.instanceOf(Set),
  onSelectedKeysChange: PropTypes.func,
  busy: PropTypes.bool,
  formatDate: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
  undoSelectable: PropTypes.bool,
  searchValue: PropTypes.string,
  onSearchChange: PropTypes.func,
  hideSearchInput: PropTypes.bool,
  draftNewRow: PropTypes.object,
  onDraftInvoiceDateChange: PropTypes.func,
  onDraftDueDateChange: PropTypes.func,
  onDraftSave: PropTypes.func,
  onDraftCancel: PropTypes.func,
  showDuplicateAction: PropTypes.bool,
  onDuplicateRow: PropTypes.func,
  allowedSelectionKeys: PropTypes.oneOfType([
    PropTypes.instanceOf(Set),
    PropTypes.arrayOf(PropTypes.string),
  ]),
  blurNonSelectableRows: PropTypes.bool,
  clickableInvoiceNo: PropTypes.bool,
  onInvoiceNoClick: PropTypes.func,
};

ContractInvoiceFinalizeGrid.defaultProps = {
  busy: false,
  selectedKeys: new Set(),
  onSelectedKeysChange: () => {},
  readOnly: false,
  undoSelectable: false,
  searchValue: undefined,
  onSearchChange: undefined,
  hideSearchInput: false,
  draftNewRow: null,
  onDraftInvoiceDateChange: () => {},
  onDraftDueDateChange: () => {},
  onDraftSave: () => {},
  onDraftCancel: () => {},
  showDuplicateAction: false,
  onDuplicateRow: undefined,
  allowedSelectionKeys: undefined,
  blurNonSelectableRows: false,
  clickableInvoiceNo: false,
  onInvoiceNoClick: undefined,
};

export default function Contracts() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [openForm, setOpenForm] = useState(false);
  const [currentContract, setCurrentContract] = useState(null);
  const [isCloneMode, setIsCloneMode] = useState(false);
  const [rows, setRows] = useState([]);

  const [gridPageSize, setGridPageSize] = useState(GRID_DISPLAY_DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [visibleRowCount, setVisibleRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Search is handled by shared DataTable (canSearch)

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [classes, setClasses] = useState([]);
  const [propertyGroups, setPropertyGroups] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [natures, setNatures] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentList, setAttachmentList] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentLoadingId, setAttachmentLoadingId] = useState(null);
  const [currentViewingRecord, setCurrentViewingRecord] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const CONTRACTS_GROUP_BY_CACHE_KEY = "contracts_groupByColumns";
  const [groupByColumns, setGroupByColumns] = useState(() => {
    try {
      const cached = localStorage.getItem(CONTRACTS_GROUP_BY_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {}
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem(CONTRACTS_GROUP_BY_CACHE_KEY, JSON.stringify(groupByColumns));
    } catch (_) {}
  }, [groupByColumns]);
  const [commandFilterIds, setCommandFilterIds] = useState([]);
  const [baseFilterIds, setBaseFilterIds] = useState([]);
  const [classFilterIds, setClassFilterIds] = useState([]);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [contractsArchiveFilter, setContractsArchiveFilter] = useState("all");
  const [contractsApprovalFilter, setContractsApprovalFilter] = useState("all");
  const [kpiContractHealthFilter, setKpiContractHealthFilter] = useState("");
  const [kpiContractStatusFilter, setKpiContractStatusFilter] = useState("");
  const urlKpiFilters = useMemo(() => readContractsUrlKpiFilters(), []);
  const urlContractNo = urlKpiFilters.contractNo;
  const urlContractNoAppliedRef = useRef(false);
  const urlKpiGridFiltersAppliedRef = useRef(false);
  // Increment to refetch as-of values (used on first load, send button, not on date-only change).
  const [asOfRefreshToken, setAsOfRefreshToken] = useState(1);
  const [asOfRefreshing, setAsOfRefreshing] = useState(false);
  const asOfFetchGenRef = useRef(0);
  // Holds only the columns that should be overridden "as of" a selected date.
  // Keyed by Contract Id (primary) and ContractNo (fallback).
  const [asOfOverrideMap, setAsOfOverrideMap] = useState(() => ({
    byId: new Map(),
    byContractNo: new Map(),
    asOfDate: "",
  }));
  const asOfOverrideMapRef = useRef(asOfOverrideMap);
  useEffect(() => {
    asOfOverrideMapRef.current = asOfOverrideMap;
  }, [asOfOverrideMap]);
  const [allPropertyGroupings, setAllPropertyGroupings] = useState([]);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedContractDetails, setSelectedContractDetails] = useState(null);
  const [contractDetailsRiseTerms, setContractDetailsRiseTerms] = useState([]);
  const [loadingContractDetailsRiseTerms, setLoadingContractDetailsRiseTerms] = useState(false);
  const [invoiceFinalizeOpen, setInvoiceFinalizeOpen] = useState(false);
  const [invoiceFinalizeContractRow, setInvoiceFinalizeContractRow] = useState(null);
  const [invoiceScheduleRows, setInvoiceScheduleRows] = useState([]);
  const [invoiceScheduleLoading, setInvoiceScheduleLoading] = useState(false);
  const [invoiceFinalizeSelectedKeys, setInvoiceFinalizeSelectedKeys] = useState(() => new Set());
  const [invoiceFinalizeTab, setInvoiceFinalizeTab] = useState("pending");
  const [invoiceFinalizeBusy, setInvoiceFinalizeBusy] = useState(false);
  const [agreementProvCreateDialogOpen, setAgreementProvCreateDialogOpen] = useState(false);
  const [agreementProvCreateRowData, setAgreementProvCreateRowData] = useState(null);
  const [agreementProvEditDialogOpen, setAgreementProvEditDialogOpen] = useState(false);
  const [agreementProvEditRowData, setAgreementProvEditRowData] = useState(null);
  const [agreementProvEditSaving, setAgreementProvEditSaving] = useState(false);
  const [invoiceFinalizeSearch, setInvoiceFinalizeSearch] = useState("");
  const [invoiceFinalizeLockDate, setInvoiceFinalizeLockDate] = useState("");
  const asOfDateInputRef = useRef(null);

  const openDatePicker = (ref) => {
    const el = ref?.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.click();
      }
    } catch (_) {
      try {
        el.click();
      } catch (_e) {
        // ignore
      }
    }
  };

  const toDisplayDate = (isoDateStr) => {
    if (!isoDateStr || typeof isoDateStr !== "string") return "";
    try {
      const d = parseISO(isoDateStr.trim());
      return isValid(d) ? format(d, "dd-MMM-yyyy") : isoDateStr;
    } catch {
      return isoDateStr;
    }
  };

  const selectSx = {
    fontSize: "1rem",
    "& .MuiOutlinedInput-root": {},
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "12px 32px 12px 12px",
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
          "& .MuiSvgIcon-root": {
            color: "#ffffff !important",
          },
        }
      : {}),
  };
  const groupByInputSx = darkMode
    ? {
        "& .MuiInputLabel-root": {
          color: "#ffffff !important",
        },
        "& .MuiInputBase-input": {
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
  const ALL_FILTER_VALUE = "__ALL__";

  const mergeAsOfOverrides = (baseRows, overrideState) => {
    const rowsArr = Array.isArray(baseRows) ? baseRows : [];
    if (!overrideState?.asOfDate) return rowsArr;

    const byId = overrideState?.byId instanceof Map ? overrideState.byId : new Map();
    const byContractNo =
      overrideState?.byContractNo instanceof Map ? overrideState.byContractNo : new Map();
    if (byId.size === 0 && byContractNo.size === 0) return rowsArr;

    const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key);
    const readFirstOwn = (obj, keys) => {
      for (let i = 0; i < keys.length; i += 1) {
        const k = keys[i];
        if (own(obj, k)) return obj[k];
      }
      return undefined;
    };

    return rowsArr.map((r) => {
      const idKey = r?.Id ?? r?.id ?? null;
      const contractNoKey = r?.ContractNo ?? r?.contractNo ?? null;

      const fromId = idKey !== null && idKey !== undefined ? byId.get(Number(idKey)) : null;
      const fromNo = !fromId && contractNoKey ? byContractNo.get(String(contractNoKey)) : null;
      const o = fromId || fromNo;
      if (!o) return r;

      const next = { ...r };

      const contractState = readFirstOwn(o, [
        "ContractState",
        "contractState",
        "ContractStatus",
        "contractStatus",
      ]);
      const rentalValue = readFirstOwn(o, ["RentalValue", "rentalValue"]);
      const govtShare = readFirstOwn(o, ["GovtShare", "govtShare"]);
      const pafShare = readFirstOwn(o, ["PAFShare", "pafShare"]);
      const viability = readFirstOwn(o, ["Viability", "viability", "Feasible", "feasible"]);
      // Rate column in grid represents GroupRate (property group rate), not any generic "Rate" field.
      const groupRate = readFirstOwn(o, ["GroupRate", "groupRate"]);
      const percentRate = readFirstOwn(o, [
        "RentalValueRatePercent",
        "rentalValueRatePercent",
        "RentalValueRate",
        "rentalValueRate",
      ]);
      const currRentPA = readFirstOwn(o, [
        "CurrRentPA",
        "currRentPA",
        "CurrentRentPA",
        "currentRentPA",
      ]);
      const fy = readFirstOwn(o, ["FY", "Fy", "fy"]);
      const rrfy = readFirstOwn(o, ["RRFY", "Rrfy", "rrfy"]);

      // Bind these calculated columns from as-of payload when key exists (including null).
      if (contractState !== undefined) {
        next.ContractState = contractState;
        next.contractState = contractState;
      }
      if (rentalValue !== undefined) {
        next.RentalValue = rentalValue;
        next.rentalValue = rentalValue;
      }
      if (govtShare !== undefined) {
        next.GovtShare = govtShare;
        next.govtShare = govtShare;
      }
      if (pafShare !== undefined) {
        next.PAFShare = pafShare;
        next.pafShare = pafShare;
      }
      const ahqShare = readFirstOwn(o, ["AHQShare", "ahqShare"]);
      const racShare = readFirstOwn(o, ["RACShare", "racShare"]);
      const baseShare = readFirstOwn(o, ["BaseShare", "baseShare"]);
      if (ahqShare !== undefined) {
        next.AHQShare = ahqShare;
        next.ahqShare = ahqShare;
      }
      if (racShare !== undefined) {
        next.RACShare = racShare;
        next.racShare = racShare;
      }
      if (baseShare !== undefined) {
        next.BaseShare = baseShare;
        next.baseShare = baseShare;
      }
      if (viability !== undefined) {
        next.Viability = viability;
        next.viability = viability;
        next.Feasible = viability;
        next.feasible = viability;
      }
      if (groupRate !== undefined) {
        next.GroupRate = groupRate;
        next.groupRate = groupRate;
      }
      if (percentRate !== undefined) {
        next.RentalValueRatePercent = percentRate;
        next.rentalValueRatePercent = percentRate;
        // Some parts of the grid also read RentalValueRate
        next.RentalValueRate = percentRate;
        next.rentalValueRate = percentRate;
      }
      if (currRentPA !== undefined) {
        next.CurrRentPA = currRentPA;
        next.currRentPA = currRentPA;
        next.CurrentRentPA = currRentPA;
        next.currentRentPA = currRentPA;
      }
      if (fy !== undefined) {
        next.FY = fy;
        next.Fy = fy;
        next.fy = fy;
      }
      if (rrfy !== undefined) {
        next.RRFY = rrfy;
        next.Rrfy = rrfy;
        next.rrfy = rrfy;
      }

      const due = readFirstOwn(o, [
        "Due",
        "due",
        "DueAmount",
        "dueAmount",
        "InvDue",
        "invDue",
        "InvoiceDue",
        "invoiceDue",
      ]);
      const paid = readFirstOwn(o, [
        "Paid",
        "paid",
        "PaidAmount",
        "paidAmount",
        "InvPaid",
        "invPaid",
        "InvoicePaid",
        "invoicePaid",
      ]);
      const rcvable = readFirstOwn(o, [
        "Rcvable",
        "rcvable",
        "Receivable",
        "receivable",
        "ReceivableAmount",
        "receivableAmount",
        "InvReceivable",
        "invReceivable",
        "InvoiceReceivable",
        "invoiceReceivable",
      ]);
      const invoiceLabel = (() => {
        const fromStatus = readFirstOwn(o, [
          "InvoicePaymentStatus",
          "invoicePaymentStatus",
          "InvoicePayStatus",
          "invoicePayStatus",
          "PaymentStatus",
          "paymentStatus",
        ]);
        if (fromStatus !== undefined) return fromStatus;
        const inv = readFirstOwn(o, ["Invoices", "invoices"]);
        if (typeof inv === "string" && String(inv).trim() !== "") return inv;
        return undefined;
      })();

      if (due !== undefined) {
        next.Due = due;
        next.due = due;
        next.DueAmount = due;
        next.dueAmount = due;
      }
      if (paid !== undefined) {
        next.Paid = paid;
        next.paid = paid;
        next.PaidAmount = paid;
        next.paidAmount = paid;
      }
      if (rcvable !== undefined) {
        next.Rcvable = rcvable;
        next.rcvable = rcvable;
        next.Receivable = rcvable;
        next.receivable = rcvable;
      }
      if (invoiceLabel !== undefined) {
        next.InvoicePaymentStatus = invoiceLabel;
        next.invoicePaymentStatus = invoiceLabel;
        next.Invoices = invoiceLabel;
        next.invoices = invoiceLabel;
      }

      return next;
    });
  };

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const response = await contractApi.getAllRecords();
      const base = response?.data ?? (Array.isArray(response) ? response : []);
      const arr = Array.isArray(base) ? base : [];
      setRows(mergeAsOfOverrides(arr, asOfOverrideMapRef.current));
      setTotalCount(Number(response?.pagination?.totalCount ?? arr.length));
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const normalizeCatalogList = (response) => {
    if (Array.isArray(response)) return response;
    if (Array.isArray(response?.data)) return response.data;
    if (Array.isArray(response?.items)) return response.items;
    return [];
  };

  const fetchCommands = async () => {
    try {
      const response = await api.list("command");
      setCommands(normalizeCatalogList(response));
    } catch (error) {
      console.error("Error fetching commands:", error);
      setCommands([]);
    }
  };

  const fetchBases = async () => {
    try {
      const response = await api.list("base");
      setBases(normalizeCatalogList(response));
    } catch (error) {
      console.error("Error fetching bases:", error);
      setBases([]);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.list("class");
      setClasses(normalizeCatalogList(response));
    } catch (error) {
      console.error("Error fetching classes:", error);
      setClasses([]);
    }
  };

  const fetchPropertyGroups = async () => {
    try {
      const response = await api.list("propertygroup");
      setPropertyGroups(response);
    } catch (error) {
      console.error("Error fetching property groups:", error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.list("tenant");
      setTenants(response);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  const fetchNatures = async () => {
    try {
      const response = await api.list("nature");
      setNatures(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching natures:", error);
      setNatures([]);
    }
  };

  // Fetch all property groupings for grouping display
  useEffect(() => {
    const fetchAllPropertyGroupings = async () => {
      try {
        const response = await propertyGroupingApi.getAllRecords();
        const data = response?.data ?? (Array.isArray(response) ? response : []);
        setAllPropertyGroupings(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Error fetching all property groupings:", error);
        setAllPropertyGroupings([]);
      }
    };
    fetchAllPropertyGroupings();
  }, []);

  // RAC/Base/Class grid labels resolve from these catalogs (not only when the form opens).
  useEffect(() => {
    fetchCommands();
    fetchBases();
    fetchClasses();
  }, []);

  useEffect(() => {
    if (!hasContractsKpiGridFilters(urlKpiFilters)) return;
    if (commands.length === 0) fetchCommands();
    if (bases.length === 0) fetchBases();
    if (classes.length === 0) fetchClasses();
  }, [urlKpiFilters]);

  useEffect(() => {
    if (urlKpiGridFiltersAppliedRef.current || !hasContractsKpiGridFilters(urlKpiFilters)) return;

    let cmdName = resolveCommandNameById(commands, urlKpiFilters.cmdId);
    let baseName = resolveBaseNameById(bases, urlKpiFilters.baseId);
    let className = resolveClassNameById(classes, urlKpiFilters.classId);

    if (!cmdName && urlKpiFilters.cmdId && rows.length > 0) {
      const row = rows.find((r) => Number(r.CmdId ?? r.cmdId) === Number(urlKpiFilters.cmdId));
      cmdName = String(row?.CmdName ?? row?.cmdName ?? "").trim();
    }
    if (!baseName && urlKpiFilters.baseId && rows.length > 0) {
      const row = rows.find((r) => Number(r.BaseId ?? r.baseId) === Number(urlKpiFilters.baseId));
      baseName = String(row?.BaseName ?? row?.baseName ?? "").trim();
    }
    if (!className && urlKpiFilters.classId && rows.length > 0) {
      const row = rows.find(
        (r) => Number(r.ClassId ?? r.classId) === Number(urlKpiFilters.classId)
      );
      className = String(row?.ClassName ?? row?.className ?? "").trim();
    }

    const waitingForLists =
      (urlKpiFilters.cmdId && !cmdName) ||
      (urlKpiFilters.baseId && !baseName) ||
      (urlKpiFilters.classId && !className);
    if (waitingForLists) return;

    if (cmdName) setCommandFilterIds([cmdName]);
    if (baseName) setBaseFilterIds([baseName]);
    if (className) setClassFilterIds([className]);
    if (urlKpiFilters.kpiContractHealth) {
      setKpiContractHealthFilter(urlKpiFilters.kpiContractHealth);
    }
    if (urlKpiFilters.kpiContractStatus) {
      setKpiContractStatusFilter(urlKpiFilters.kpiContractStatus);
    }
    if (urlKpiFilters.kpiApproval === "approved" || urlKpiFilters.kpiApproval === "pending") {
      setContractsApprovalFilter(urlKpiFilters.kpiApproval);
    }

    urlKpiGridFiltersAppliedRef.current = true;
  }, [urlKpiFilters, commands, bases, classes, rows]);

  // Lazy-load dropdown lists only when form opens (Add New / Edit)
  useEffect(() => {
    if (!openForm) return;

    if (commands.length === 0) fetchCommands();
    if (bases.length === 0) fetchBases();
    if (classes.length === 0) fetchClasses();
    if (propertyGroups.length === 0) fetchPropertyGroups();
    if (tenants.length === 0) fetchTenants();
    if (natures.length === 0) fetchNatures();
  }, [
    openForm,
    commands.length,
    bases.length,
    classes.length,
    propertyGroups.length,
    tenants.length,
    natures.length,
  ]);

  useEffect(() => {
    fetchContracts();
  }, [fetchContracts]);

  // When As of Date changes, fetch "as of" values and merge into existing rows.
  // Overrides: calculated columns plus Inv. Due / Paid / Rcvable and Invoices (payment status label).
  useEffect(() => {
    let isMounted = true;
    const myGen = ++asOfFetchGenRef.current;

    const finishAsOfRefreshUi = () => {
      if (myGen !== asOfFetchGenRef.current) return;
      if (isMounted) setAsOfRefreshing(false);
    };

    const fetchAsOfOverrides = async () => {
      try {
        if (!asOfRefreshToken) return; // no refresh requested yet
        if (!asOfDate) {
          if (!isMounted) return;
          const cleared = { byId: new Map(), byContractNo: new Map(), asOfDate: "" };
          asOfOverrideMapRef.current = cleared;
          setAsOfOverrideMap(cleared);
          return;
        }

        const res = await contractApi.getActiveByAsOfDate(asOfDate);
        const arr = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];

        const byId = new Map();
        const byContractNo = new Map();
        arr.forEach((r) => {
          const id = r?.Id ?? r?.id ?? null;
          const cn = r?.ContractNo ?? r?.contractNo ?? null;
          if (id !== null && id !== undefined && Number.isFinite(Number(id))) {
            byId.set(Number(id), r);
          }
          if (cn) byContractNo.set(String(cn), r);
        });

        if (!isMounted) return;
        const nextOverrideState = { byId, byContractNo, asOfDate };
        asOfOverrideMapRef.current = nextOverrideState;
        setAsOfOverrideMap(nextOverrideState);

        // Merge into currently visible rows without replacing other fields.
        setRows((prev) => {
          if (!Array.isArray(prev) || prev.length === 0) return prev;
          return mergeAsOfOverrides(prev, nextOverrideState);
        });
      } catch (e) {
        console.error("Error fetching ActiveByAsOfDate:", e);
        if (!isMounted) return;
        // Keep existing grid, just clear overrides (no destructive reload).
        const cleared = { byId: new Map(), byContractNo: new Map(), asOfDate: "" };
        asOfOverrideMapRef.current = cleared;
        setAsOfOverrideMap(cleared);
      } finally {
        finishAsOfRefreshUi();
      }
    };

    fetchAsOfOverrides();
    return () => {
      isMounted = false;
    };
  }, [asOfRefreshToken]);

  // Reset expanded state when grouping keys change.
  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupByColumns]);

  const handleOpenForm = () => {
    if (!canCreateCurrentMenu()) return;
    setIsCloneMode(false);
    setCurrentContract(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentContract(null);
    setIsCloneMode(false);
  };

  const handleEditContract = async (id) => {
    if (!canEditCurrentMenu()) return;
    try {
      // Fetch contract data from API by ID instead of using local storage/table data
      setLoading(true);
      const contract = await api.get("Contracts", id);
      setIsCloneMode(false);
      setCurrentContract(contract);
      setOpenForm(true);
    } catch (error) {
      console.error("Error fetching contract:", error);
      alert("Failed to load contract data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCloneContractFromDetails = async () => {
    if (!canCreateCurrentMenu()) return;
    const row = selectedContractDetails;
    if (!row) return;
    const contractId = row?.Id ?? row?.id;
    if (!contractId) {
      alert("Cannot clone: contract has no ID.");
      return;
    }
    try {
      setLoading(true);
      const contract = await api.get("Contracts", contractId);
      const stripped = stripContractForClone(contract);
      setIsCloneMode(true);
      setCurrentContract(stripped);
      setOpenForm(true);
      setDetailsDialogOpen(false);
    } catch (error) {
      console.error("Error loading contract to clone:", error);
      alert("Failed to load contract. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteContract = async (id) => {
    if (!canDeleteCurrentMenu()) return;
    const row = (rows || []).find((r) => Number(r?.id ?? r?.Id) === Number(id));
    const contractNo = String(row?.contractNo ?? row?.ContractNo ?? "").trim();
    if (contractNo) {
      try {
        const res = await contractApi.getInvoiceSchedule({ contractNo });
        const invoices = unwrapContractInvoiceScheduleList(res);
        if (invoices.length > 0) {
          alert("Cannot delete this contract: there are linked invoices.");
          return;
        }
      } catch (error) {
        console.error("Error checking linked invoices:", error);
      }
    }
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleViewDetails = async (rowData) => {
    setSelectedContractDetails(rowData);
    setDetailsDialogOpen(true);
    setContractDetailsRiseTerms([]);
    setLoadingContractDetailsRiseTerms(true);

    // Fetch ContractRiseTerms if contract has an ID
    const contractId = rowData?.Id || rowData?.id;
    if (contractId) {
      try {
        const response = await contractApi.getContractRiseTermsByContractId(contractId);
        const data = Array.isArray(response) ? response : response?.data || [];

        // Filter out deleted records and normalize data
        const normalizedRiseTerms = data
          .filter((t) => !t.IsDeleted && t.IsDeleted !== true)
          .map((t) => {
            const monthsInterval = t.MonthsInterval ?? null;
            const risePercent = t.RisePercent ?? null;
            const sequenceNo = t.SequenceNo ?? null;
            const id = t.Id ?? null;

            if (monthsInterval === null || risePercent === null || sequenceNo === null) {
              return null;
            }

            return {
              id: id ? Number(id) : null,
              monthsInterval: String(monthsInterval),
              risePercent: String(risePercent),
              sequenceNo: String(sequenceNo),
            };
          })
          .filter(Boolean)
          .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo));

        setContractDetailsRiseTerms(normalizedRiseTerms);
      } catch (error) {
        console.error("Error fetching ContractRiseTerms for details:", error);
        setContractDetailsRiseTerms([]);
      } finally {
        setLoadingContractDetailsRiseTerms(false);
      }
    } else {
      setLoadingContractDetailsRiseTerms(false);
    }
  };

  useEffect(() => {
    if (urlContractNoAppliedRef.current || !urlContractNo) return;
    urlContractNoAppliedRef.current = true;

    const openContractFromUrl = async () => {
      try {
        setLoading(true);
        const response = await contractApi.getAllRecords();
        const list = response?.data ?? (Array.isArray(response) ? response : []);
        const contractKey = urlContractNo.toLowerCase();
        const match = list.find(
          (c) =>
            String(c.ContractNo ?? c.contractNo ?? "")
              .trim()
              .toLowerCase() === contractKey
        );
        if (!match) {
          alert(`Contract not found: ${urlContractNo}`);
          return;
        }

        let openViewDetails = false;
        try {
          const v = String(
            new URLSearchParams(window.location.search).get("viewDetails") || ""
          ).toLowerCase();
          openViewDetails = v === "1" || v === "true" || v === "yes";
        } catch (_) {
          openViewDetails = false;
        }

        if (openViewDetails) {
          await handleViewDetails(match);
          return;
        }

        if (!canEditCurrentMenu()) return;
        const id = match.Id ?? match.id;
        if (!id) {
          alert(`Contract not found: ${urlContractNo}`);
          return;
        }
        const contract = await api.get("Contracts", id);
        setIsCloneMode(false);
        setCurrentContract(contract);
        setOpenForm(true);
      } catch (error) {
        console.error("Error opening contract from URL:", error);
        alert("Failed to load contract. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    void openContractFromUrl();
  }, [urlContractNo]);

  const handleOpenContractInvoices = useCallback(async (row) => {
    const contractNo = String(row?.ContractNo ?? row?.contractNo ?? "").trim();
    if (!contractNo) {
      alert("Contract number is missing.");
      return;
    }
    setInvoiceFinalizeContractRow(row);
    setInvoiceFinalizeOpen(true);
    setInvoiceScheduleLoading(true);
    setInvoiceScheduleRows([]);
    setInvoiceFinalizeSelectedKeys(new Set());
    setInvoiceFinalizeTab("pending");
    setAgreementProvCreateDialogOpen(false);
    setAgreementProvCreateRowData(null);
    setAgreementProvEditDialogOpen(false);
    setAgreementProvEditRowData(null);
    setInvoiceFinalizeSearch("");
    try {
      const [scheduleRes, lockDateRes] = await Promise.all([
        contractApi.getInvoiceSchedule({ contractNo }),
        lockDateApi.getAll().catch(() => null),
      ]);
      setInvoiceScheduleRows(
        assignContractInvoiceFinalizeKeys(unwrapContractInvoiceScheduleList(scheduleRes))
      );
      setInvoiceFinalizeLockDate(pickActiveLockDateYyyyMmDd(unwrapLockDateConfigList(lockDateRes)));
    } catch (error) {
      console.error("Error loading invoice schedule:", error);
      alert("Failed to load invoice schedule for this contract.");
      setInvoiceFinalizeOpen(false);
      setInvoiceFinalizeContractRow(null);
    } finally {
      setInvoiceScheduleLoading(false);
    }
  }, []);

  const handleCloseInvoiceFinalizeDialog = useCallback(() => {
    if (invoiceFinalizeBusy || agreementProvEditSaving) return;
    setInvoiceFinalizeOpen(false);
    setInvoiceFinalizeContractRow(null);
    setInvoiceScheduleRows([]);
    setInvoiceFinalizeSelectedKeys(new Set());
    setInvoiceFinalizeTab("pending");
    setAgreementProvCreateDialogOpen(false);
    setAgreementProvCreateRowData(null);
    setAgreementProvEditDialogOpen(false);
    setAgreementProvEditRowData(null);
    setInvoiceFinalizeSearch("");
  }, [invoiceFinalizeBusy, agreementProvEditSaving]);

  const invoiceFinalizePendingRows = useMemo(
    () =>
      invoiceScheduleRows
        .filter((r) => !pickScheduleRowIsFinalize(r))
        .sort((a, b) =>
          getContractInvoiceFinalizeInvoiceNo(a).localeCompare(
            getContractInvoiceFinalizeInvoiceNo(b),
            undefined,
            { numeric: true }
          )
        ),
    [invoiceScheduleRows]
  );

  const invoiceFinalizeFinalizedRows = useMemo(
    () => invoiceScheduleRows.filter((r) => pickScheduleRowIsFinalize(r)),
    [invoiceScheduleRows]
  );

  const invoiceFinalizeAllowedPendingKeys = useMemo(
    () => getAllowedPendingFinalizeKeySet(invoiceScheduleRows),
    [invoiceScheduleRows]
  );

  const handleFinalizeSelectedInvoices = useCallback(async () => {
    if (!invoiceFinalizeContractRow) return;
    if (invoiceFinalizeSelectedKeys.size === 0) {
      alert("Select at least one invoice row.");
      return;
    }
    if (invoiceFinalizeAllowedPendingKeys.size > 0) {
      const hasOutOfSequenceSelection = Array.from(invoiceFinalizeSelectedKeys).some(
        (k) => !invoiceFinalizeAllowedPendingKeys.has(k)
      );
      if (hasOutOfSequenceSelection) {
        alert("Only the next immediate pending invoice can be finalized.");
        return;
      }
    }
    const selected = invoiceScheduleRows.filter(
      (r) =>
        invoiceFinalizeSelectedKeys.has(getContractInvoiceFinalizeRowKey(r)) &&
        !pickScheduleRowIsFinalize(r) &&
        (invoiceFinalizeAllowedPendingKeys.size === 0 ||
          invoiceFinalizeAllowedPendingKeys.has(getContractInvoiceFinalizeRowKey(r)))
    );
    if (selected.length === 0) {
      alert("Selected rows are already finalized, invalid, or out of sequence.");
      return;
    }
    const contractNo = String(
      invoiceFinalizeContractRow?.ContractNo ?? invoiceFinalizeContractRow?.contractNo ?? ""
    ).trim();
    setInvoiceFinalizeBusy(true);
    try {
      for (let i = 0; i < selected.length; i += 1) {
        const schRow = selected[i];
        const rowContractNo = String(
          schRow?.ContractNo ?? schRow?.contractNo ?? contractNo ?? ""
        ).trim();
        const invoiceNo = getContractInvoiceFinalizeInvoiceNo(schRow);
        const subRaw = schRow?.SubInvoiceNo ?? schRow?.subInvoiceNo;
        const subInvoiceNo = subRaw === null || subRaw === undefined ? "" : String(subRaw).trim();
        if (rowContractNo && invoiceNo) {
          const payload = {
            ...buildFinalizeInvoiceSchedulePayload(invoiceFinalizeContractRow, schRow),
            IsFinalized: true,
            isFinalized: true,
          };
          await contractApi.updateInvoiceSchedule(rowContractNo, invoiceNo, payload);
        }
      }
      if (contractNo) {
        const res = await contractApi.getInvoiceSchedule({ contractNo });
        setInvoiceScheduleRows(
          assignContractInvoiceFinalizeKeys(unwrapContractInvoiceScheduleList(res))
        );
      }
      setInvoiceFinalizeSelectedKeys(new Set());
      setInvoiceFinalizeTab("finalized");
    } catch (error) {
      console.error("Error finalizing invoice rows:", error);
      alert(String(error?.message || "Finalize failed. Please try again."));
    } finally {
      setInvoiceFinalizeBusy(false);
    }
  }, [
    invoiceFinalizeContractRow,
    invoiceFinalizeSelectedKeys,
    invoiceScheduleRows,
    invoiceFinalizeAllowedPendingKeys,
  ]);

  const handleCloseAgreementProvCreateDialog = useCallback(() => {
    if (invoiceFinalizeBusy) return;
    setAgreementProvCreateDialogOpen(false);
    setAgreementProvCreateRowData(null);
  }, [invoiceFinalizeBusy]);

  const handleCloseAgreementProvEditDialog = useCallback(() => {
    if (agreementProvEditSaving) return;
    setAgreementProvEditDialogOpen(false);
    setAgreementProvEditRowData(null);
  }, [agreementProvEditSaving]);

  const handleOpenAgreementProvEditFromFinalizeRow = useCallback(
    (scheduleRow) => {
      if (!invoiceFinalizeContractRow || !scheduleRow) return;
      const invoiceNo = getContractInvoiceFinalizeInvoiceNo(scheduleRow);
      if (!invoiceNo || invoiceNo === "—") return;
      if (!pickScheduleRowIsFinalize(scheduleRow)) return;
      setAgreementProvEditRowData(
        buildAgreementProvEditRowFromContractAndSchedule(invoiceFinalizeContractRow, scheduleRow)
      );
      setAgreementProvEditDialogOpen(true);
      setAgreementProvCreateDialogOpen(false);
      setAgreementProvCreateRowData(null);
      setInvoiceFinalizeSelectedKeys(new Set());
    },
    [invoiceFinalizeContractRow]
  );

  const handleSaveAgreementProvEditInvoice = useCallback(
    async (form, rowData, lineSaveContext = {}) => {
      if (!rowData) return;
      setAgreementProvEditSaving(true);
      try {
        await persistAllInvoiceScheduleLines({
          rowData,
          form,
          invoiceLines: lineSaveContext.invoiceLines ?? [],
          pendingDeleteSubs: lineSaveContext.pendingDeleteSubs ?? [],
          newLineDrafts: lineSaveContext.newLineDrafts ?? [],
          editingLineDraft: lineSaveContext.editingLineDraft ?? null,
          originalServerSubs: lineSaveContext.originalServerSubs ?? new Set(),
          originalLinePayloadSnapshots: lineSaveContext.originalLinePayloadSnapshots ?? new Map(),
        });
        const contractNo = String(
          invoiceFinalizeContractRow?.ContractNo ??
            invoiceFinalizeContractRow?.contractNo ??
            form?.contractNo ??
            rowData?.ContractNo ??
            rowData?.contractNo ??
            ""
        ).trim();
        if (contractNo) {
          const res = await contractApi.getInvoiceSchedule({ contractNo });
          setInvoiceScheduleRows(
            assignContractInvoiceFinalizeKeys(unwrapContractInvoiceScheduleList(res))
          );
        }
        setAgreementProvEditDialogOpen(false);
        setAgreementProvEditRowData(null);
      } catch (error) {
        console.error("Error saving agreement prov invoice:", error);
        alert(getAgreementProvSaveErrorMessage(error));
      } finally {
        setAgreementProvEditSaving(false);
      }
    },
    [invoiceFinalizeContractRow]
  );

  const handleAddNewInvoiceDraft = useCallback(() => {
    if (!invoiceFinalizeContractRow) return;
    if (!(invoiceScheduleRows || []).some((r) => pickScheduleRowIsFinalize(r))) {
      alert("Please finalize at least 1 invoice before adding a new invoice.");
      return;
    }
    const template = pickContractInvoiceTemplateRow(invoiceScheduleRows);
    const draft = buildContractInvoiceDraftRow(
      template,
      invoiceFinalizeContractRow,
      invoiceScheduleRows
    );
    const nextInvoiceNo = generateNextFinalizedContractInvoiceNo(invoiceScheduleRows);
    setAgreementProvCreateRowData({
      ...draft,
      InvoiceNo: nextInvoiceNo,
      invoiceNo: nextInvoiceNo,
    });
    setAgreementProvCreateDialogOpen(true);
    setAgreementProvEditDialogOpen(false);
    setAgreementProvEditRowData(null);
    setInvoiceFinalizeSelectedKeys(new Set());
  }, [invoiceFinalizeContractRow, invoiceScheduleRows]);

  const handleDuplicateFinalizedInvoice = useCallback(
    (parentRow) => {
      if (!invoiceFinalizeContractRow || !parentRow || agreementProvCreateDialogOpen) return;
      const draft = buildContractInvoiceDraftRow(
        parentRow,
        invoiceFinalizeContractRow,
        invoiceScheduleRows
      );
      const periodDescription = pickContractSchPeriodDescription(parentRow);
      const invoiceDateRaw =
        pickScheduleInvoiceDateSch(parentRow) ||
        pickSchField(parentRow, "PeriodStart", "periodStart");
      const dueDateRaw = pickSchField(parentRow, "DueDate", "dueDate");
      setAgreementProvCreateRowData({
        ...draft,
        Description: periodDescription,
        description: periodDescription,
        Desc: periodDescription,
        __draftInvoiceDate: toContractInvoiceDateInputValue(invoiceDateRaw),
        __draftDueDate: toContractInvoiceDateInputValue(dueDateRaw),
      });
      setAgreementProvCreateDialogOpen(true);
      setInvoiceFinalizeSelectedKeys(new Set());
    },
    [invoiceFinalizeContractRow, invoiceScheduleRows, agreementProvCreateDialogOpen]
  );

  const handleSaveAgreementProvCreateInvoice = useCallback(
    async (form, rowData) => {
      if (!invoiceFinalizeContractRow || !rowData) return;
      const draftInvoiceDate = String(form?.invoiceDate || "").trim();
      const draftDueDate = String(form?.dueDate || "").trim();
      if (!draftInvoiceDate || !draftDueDate) {
        alert("Invoice Date and Due Date are required.");
        return;
      }
      const contractNo = String(
        invoiceFinalizeContractRow?.ContractNo ?? invoiceFinalizeContractRow?.contractNo ?? ""
      ).trim();
      const invoiceNo = String(
        form?.invoiceNo ?? rowData?.InvoiceNo ?? rowData?.invoiceNo ?? ""
      ).trim();
      if (!contractNo || !invoiceNo) {
        alert("Contract No and Invoice No are required.");
        return;
      }
      const subRaw = rowData?.SubInvoiceNo ?? rowData?.subInvoiceNo;
      const subInvoiceNo = subRaw === null || subRaw === undefined ? "" : String(subRaw).trim();
      const paymentTermMonths =
        invoiceFinalizeContractRow?.PaymentTermMonths ??
        invoiceFinalizeContractRow?.paymentTermMonths;
      const periodEndDate = computeAgreementInvoicePeriodEnd(draftInvoiceDate, paymentTermMonths);
      if (!periodEndDate) {
        alert("Unable to derive Period End from Period Start and Payment Term.");
        return;
      }
      if (
        hasDuplicateInvoicePeriod(invoiceScheduleRows, draftInvoiceDate, periodEndDate, invoiceNo)
      ) {
        alert("An invoice for the same period already exists.");
        return;
      }
      const periodDescription = String(form?.description ?? "").trim();
      const schRow = {
        ...rowData,
        InvoiceNo: invoiceNo,
        invoiceNo,
        PeriodStart: draftInvoiceDate,
        periodStart: draftInvoiceDate,
        PeriodEnd: periodEndDate || null,
        periodEnd: periodEndDate || null,
        DueDate: draftDueDate,
        dueDate: draftDueDate,
        Description: periodDescription,
        description: periodDescription,
        Desc: periodDescription,
      };
      setInvoiceFinalizeBusy(true);
      try {
        const payload = {
          ...buildFinalizeInvoiceSchedulePayload(invoiceFinalizeContractRow, schRow),
          Description: periodDescription,
          IsFinalized: true,
          isFinalized: true,
          IsFinalize: true,
          isFinalize: true,
        };
        await contractApi.createInvoiceSchedule(contractNo, invoiceNo, subInvoiceNo, payload);
        const res = await contractApi.getInvoiceSchedule({ contractNo });
        setInvoiceScheduleRows(
          assignContractInvoiceFinalizeKeys(unwrapContractInvoiceScheduleList(res))
        );
        setAgreementProvCreateDialogOpen(false);
        setAgreementProvCreateRowData(null);
        setInvoiceFinalizeSelectedKeys(new Set());
        setInvoiceFinalizeTab("finalized");
      } catch (error) {
        console.error("Error saving new invoice:", error);
        alert(String(error?.message || "Failed to save invoice. Please try again."));
      } finally {
        setInvoiceFinalizeBusy(false);
      }
    },
    [invoiceFinalizeContractRow, invoiceScheduleRows]
  );

  const handleUndoFinalizedInvoices = useCallback(async () => {
    if (!invoiceFinalizeContractRow) return;
    if (invoiceFinalizeSelectedKeys.size === 0) {
      alert("Select at least one finalized invoice to undo.");
      return;
    }
    const selected = invoiceScheduleRows.filter(
      (r) =>
        invoiceFinalizeSelectedKeys.has(getContractInvoiceFinalizeRowKey(r)) &&
        pickScheduleRowIsFinalize(r)
    );
    if (selected.length === 0) {
      alert("Selected rows are not finalized or invalid.");
      return;
    }
    const blocked = selected.filter(
      (r) => !isInvoiceRowAllowedByLockDateConstraint(r, invoiceFinalizeLockDate)
    );
    if (blocked.length > 0) {
      const lockLabel = invoiceFinalizeLockDate
        ? formatDateDDMMMYYYY(invoiceFinalizeLockDate)
        : "lock date";
      alert(
        `Cannot undo finalize: invoice date must be after the lock date (${lockLabel}) for all selected rows.`
      );
      return;
    }
    const contractNo = String(
      invoiceFinalizeContractRow?.ContractNo ?? invoiceFinalizeContractRow?.contractNo ?? ""
    ).trim();
    setInvoiceFinalizeBusy(true);
    try {
      for (let i = 0; i < selected.length; i += 1) {
        const schRow = selected[i];
        const rowContractNo = String(
          schRow?.ContractNo ?? schRow?.contractNo ?? contractNo ?? ""
        ).trim();
        const invoiceNo = getContractInvoiceFinalizeInvoiceNo(schRow);
        if (!rowContractNo || !invoiceNo) continue;
        const payload = {
          ...buildFinalizeInvoiceSchedulePayload(invoiceFinalizeContractRow, schRow),
          IsFinalized: false,
          isFinalized: false,
        };
        await contractApi.updateInvoiceSchedule(rowContractNo, invoiceNo, payload);
      }
      if (contractNo) {
        const res = await contractApi.getInvoiceSchedule({ contractNo });
        setInvoiceScheduleRows(
          assignContractInvoiceFinalizeKeys(unwrapContractInvoiceScheduleList(res))
        );
      }
      setInvoiceFinalizeSelectedKeys(new Set());
      setInvoiceFinalizeTab("pending");
    } catch (error) {
      console.error("Error undoing finalized invoices:", error);
      alert(String(error?.message || "Undo failed. Please try again."));
    } finally {
      setInvoiceFinalizeBusy(false);
    }
  }, [
    invoiceFinalizeContractRow,
    invoiceFinalizeSelectedKeys,
    invoiceScheduleRows,
    invoiceFinalizeLockDate,
  ]);

  const handleConfirmDelete = async () => {
    if (!canDeleteCurrentMenu()) return;
    if (recordToDelete) {
      try {
        // Include IP address in delete request body
        const deleteData = {
          ActionBy: await getActionBy(),
          ActionDate: new Date().toISOString(),
          userIPAddress: getUserIPAddress() || "session",
        };
        await contractApi.remove(recordToDelete, deleteData);
        await fetchContracts();
        setDeleteDialogOpen(false);
        setRecordToDelete(null);
      } catch (error) {
        console.error("Error deleting contract:", error);
        alert("Failed to delete contract. Please try again.");
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleSubmit = async (data) => {
    try {
      // Add IP address to the payload (from user session)
      const dataWithIP = {
        ...data,
        userIPAddress: getUserIPAddress() || "session",
      };

      // Check for contract ID in both PascalCase and camelCase
      const contractId = currentContract?.Id || currentContract?.id;
      if (currentContract && contractId) {
        await contractApi.update(contractId, dataWithIP);
      } else {
        await contractApi.create(dataWithIP);
      }
      await fetchContracts();
      setCurrentContract(null);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving contract:", error);
      alert("Error: Contract ID Duplicate or Please try again.");
    }
  };

  const normalizeFiles = (filesArray) =>
    filesArray.map((f) => {
      if (typeof f === "string") {
        return { fileName: f.split(/[\\/]/).pop(), downloadUrl: f };
      }
      const fileName =
        f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
      const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
      return { ...f, fileName, downloadUrl };
    });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const CONTRACT_ATTACH_MAX = 6;

  const isContractAttachmentFile = (file) => {
    const name = (file?.name || "").toLowerCase();
    const ext = name.includes(".") ? name.split(".").pop() : "";
    if (["pdf", "xlsx", "xls", "doc", "docx"].includes(ext)) return true;
    const t = (file?.type || "").toLowerCase();
    return (
      t.includes("pdf") ||
      t.includes("spreadsheetml") ||
      t.includes("ms-excel") ||
      t.includes("excel") ||
      t.includes("msword") ||
      t.includes("wordprocessingml")
    );
  };

  const handleViewAttachments = async (record) => {
    const contractId = record?.id ?? record?.Id;
    if (!contractId) return;
    setAttachmentLoading(true);
    setAttachmentLoadingId(contractId);
    setCurrentViewingRecord(record);
    setSelectedFiles([]);
    try {
      const response = await uploadApi.getUploadedFiles(contractId, "Contracts");
      const filesArray = response?.files || (Array.isArray(response) ? response : []);
      setAttachmentList(normalizeFiles(filesArray));
      setAttachmentDialogOpen(true);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      alert("Unable to load attachments.");
    } finally {
      setAttachmentLoading(false);
      setAttachmentLoadingId(null);
    }
  };

  const handleCloseAttachmentDialog = () => {
    setAttachmentDialogOpen(false);
    setAttachmentList([]);
    setCurrentViewingRecord(null);
    setSelectedFiles([]);
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const totalExisting = attachmentList.length;
    const totalSelected = selectedFiles.length;
    const totalFiles = totalExisting + totalSelected;
    const remainingSlots = CONTRACT_ATTACH_MAX - totalFiles;

    if (totalFiles >= CONTRACT_ATTACH_MAX) {
      alert(
        `Maximum ${CONTRACT_ATTACH_MAX} files allowed. Please delete some existing files before uploading new ones.`
      );
      event.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      alert(
        `You can only upload ${remainingSlots} more file(s). Maximum ${CONTRACT_ATTACH_MAX} files allowed.`
      );
      event.target.value = "";
      return;
    }

    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      if (!isContractAttachmentFile(file)) {
        alert(
          `File "${file.name}" is not allowed. Use PDF, Excel (.xls, .xlsx), or Word (.doc, .docx) only.`
        );
        return false;
      }
      return true;
    });

    if (totalFiles + validFiles.length > CONTRACT_ATTACH_MAX) {
      alert(
        `You can only upload ${
          CONTRACT_ATTACH_MAX - totalFiles
        } more file(s). Maximum ${CONTRACT_ATTACH_MAX} files allowed.`
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const refreshAttachments = async (recordId) => {
    const response = await uploadApi.getUploadedFiles(recordId, "Contracts");
    const filesArray = response?.files || (Array.isArray(response) ? response : []);
    setAttachmentList(normalizeFiles(filesArray));
  };

  const handleUploadSelected = async () => {
    const contractId = currentViewingRecord?.id ?? currentViewingRecord?.Id;
    if (!contractId) {
      alert("Record ID not found. Please reopen attachments and try again.");
      return;
    }
    if (selectedFiles.length === 0) {
      alert("Select at least one file to upload.");
      return;
    }
    setIsUploading(true);
    try {
      await uploadApi.uploadFiles(contractId, "Contracts", selectedFiles);
      await refreshAttachments(contractId);
      setSelectedFiles([]);
      alert("Files uploaded successfully.");
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(`Failed to upload files: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadAttachment = (file) => {
    const downloadUrl =
      file?.downloadUrl || file?.fileUrl || file?.url || file?.filePath || file?.path;
    if (downloadUrl) {
      const fullUrl = downloadUrl.startsWith("http")
        ? downloadUrl
        : `${process.env.REACT_APP_API_BASE_URL || ""}${
            downloadUrl.startsWith("/") ? "" : "/"
          }${downloadUrl}`;
      window.open(fullUrl, "_blank");
    } else {
      alert("Download URL is not available for this file.");
    }
  };

  const handleDeleteAttachment = async (file) => {
    if (!canEditCurrentMenu() && !canDeleteCurrentMenu()) return;
    if (!file?.id) {
      alert("File ID is not available. Cannot delete this file.");
      return;
    }
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file.fileName || file.name || "this file"}"?`
    );
    if (!confirmDelete) return;

    try {
      await uploadApi.deleteUploadedFile(file.id);
      const contractId = currentViewingRecord?.id ?? currentViewingRecord?.Id;
      if (contractId) {
        await refreshAttachments(contractId);
      } else {
        setAttachmentList((prev) => prev.filter((f) => f.id !== file.id));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  // Import centralized date formatter
  const formatDateDDMMMYYYY = (dateValue) => {
    if (!dateValue) return "";
    const raw = String(dateValue).trim();
    if (!raw) return "";

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
    } catch {
      return raw;
    }
  };

  const contractsExportCellFormatter = ({ value, column }) => {
    const colId = String(column?.id || column?.accessor || "").toLowerCase();
    if (
      colId === "contractstartdate" ||
      colId === "contractenddate" ||
      colId === "commercialoperationdate"
    ) {
      return formatContractGridDate(value);
    }

    if (colId === "increaseratepercent" || colId === "riseratepercent" || colId === "profitrate") {
      return formatContractGridNumber(value, "%");
    }
    if (colId === "percentrate") {
      if (isContractGridBlank(value)) return "";
      const n = Number(value);
      return Number.isFinite(n) ? `${n}%` : `${value}%`;
    }

    if (colId === "status") {
      return value === 1 || value === "1" || value === true ? "Active" : "Inactive";
    }
    if (colId === "approvalstatus") {
      return value === true || value === 1 || value === "1" ? "Approved" : "Pending";
    }
    if (colId === "paymenttermmonths") {
      return formatContractPaymentTermDisplay(value);
    }
    if (colId === "sdratemonths") {
      return formatContractSdRateDisplay(value);
    }

    return isContractGridBlank(value) ? "" : String(value);
  };

  const CALCULATED_CELL_BG = "#e9ecef";
  const CONTRACT_GRID_TABLE_WIDTH = "4300px";

  /** Active / Inactive status pill for contract grid. */
  const renderContractsStatusLightPill = (value) => {
    if (isContractGridBlank(value)) return "";
    return <GridStatusChip value={value} />;
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "72px", showInTable: true },
    { Header: "S.No", accessor: "id", align: "center", width: "56px", showInTable: true },
    { Header: "Contract No", accessor: "contractNo", align: "left", showInTable: true },
    // Backend now sends names directly (no mapping)
    { Header: "RAC", accessor: "cmdName", align: "left", width: "72px", showInTable: true },
    { Header: "Base", accessor: "baseName", align: "left", width: "72px", showInTable: true },
    { Header: "Class", accessor: "className", align: "left", width: "72px", showInTable: true },
    {
      Header: "Grouping ID",
      accessor: "grpId",
      align: "left",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => value || row?.original?.GId || "-",
    },
    {
      id: "currentRentPA",
      Header: "Current Rent PA",
      accessor: "initialRentPA",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const currentRentPA =
          // eslint-disable-next-line react/prop-types
          value ?? row?.original?.CurrentRentPA ?? row?.original?.currentRentPA ?? null;
        return (
          <MDTypography variant="body2">
            {currentRentPA != null && currentRentPA !== ""
              ? Number(currentRentPA).toLocaleString()
              : "-"}
          </MDTypography>
        );
      },
    },
    {
      Header: "Viability",
      accessor: "feasible",
      align: "center",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const fromPayload = String(
          value ??
            rowData.Viability ??
            rowData.viability ??
            rowData.Feasible ??
            rowData.feasible ??
            ""
        )
          .trim()
          .toLowerCase();
        const hasPayloadValue = fromPayload === "viable" || fromPayload === "unviable";
        const govt = Number(rowData.GovtShare ?? 0);
        const paf = Number(rowData.PAFShare ?? 0);
        const label = hasPayloadValue
          ? fromPayload === "viable"
            ? "Viable"
            : "Unviable"
          : govt > paf
          ? "Viable"
          : "Unviable";
        const viableStyles =
          label === "Viable"
            ? { backgroundColor: "#d4edda", color: "#155724" }
            : { backgroundColor: "#f8d7da", color: "#721c24" };
        return (
          <MDBox
            sx={{
              ...viableStyles,
              backgroundColor: `${viableStyles.backgroundColor} !important`,
              color: `${viableStyles.color} !important`,
              px: 1,
              py: 0.35,
              borderRadius: "999px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "88px",
              fontWeight: 600,
              "&, & *": {
                color: `${viableStyles.color} !important`,
              },
            }}
          >
            {label}
          </MDBox>
        );
      },
    },
    {
      Header: "Total Area (UoM)",
      accessor: "totalArea",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const totalArea = rowData?.TotalArea ?? 0;
        const uoM = rowData?.UoM || rowData?.uoM || rowData?.unitName || rowData?.UnitName || "";
        return (
          <MDTypography variant="body2">
            {totalArea ? `${Number(totalArea).toLocaleString()}${uoM ? ` (${uoM})` : ""}` : "-"}
          </MDTypography>
        );
      },
    },
    {
      Header: "Location",
      accessor: "location",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const location = row.original?.Location || "";
        return (
          <MDTypography variant="body2" fontWeight="medium">
            {location || "-"}
          </MDTypography>
        );
      },
    },
    {
      Header: "UoM",
      accessor: "uoM",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const uoM = value || rowData.UoM || rowData.unitName || rowData.UnitName || "";
        return (
          <MDTypography variant="body2" fontWeight="medium">
            {uoM || "-"}
          </MDTypography>
        );
      },
    },
    {
      Header: "Unit",
      accessor: "unitName",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const unitName = value || row.original?.UnitName || row.original?.UoM || "";
        return unitName || "-";
      },
    },
    {
      Header: "Tenant No",
      accessor: "tenantNo",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const tenantNo = value || row.original?.TenantNo || "";
        // Find tenant from tenants list
        const tenant = tenants.find((t) => t.tenantNo === tenantNo);
        if (tenant) {
          return (
            <MDBox>
              <MDTypography variant="caption" fontWeight="medium">
                {tenantNo}
              </MDTypography>
              <MDTypography variant="caption" display="block" color="text">
                {tenant.ownerName || "-"}
              </MDTypography>
              <MDTypography
                variant="caption"
                display="block"
                color="text"
                sx={{ fontSize: "0.75rem" }}
              >
                {tenant.address || "-"}
              </MDTypography>
            </MDBox>
          );
        }
        return tenantNo || "-";
      },
    },
    { Header: "Business Name", accessor: "businessName", align: "left", showInTable: false },
    {
      Header: "Nature of Business",
      accessor: "natureOfBusiness",
      align: "left",
      showInTable: false,
    },
    {
      Header: "Contract Start Date",
      accessor: "contractStartDate",
      align: "left",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatDateDDMMMYYYY(value),
    },
    {
      Header: "Contract End Date",
      accessor: "contractEndDate",
      align: "left",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatDateDDMMMYYYY(value),
    },
    {
      Header: "Commercial Operation Date",
      accessor: "commercialOperationDate",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? formatDateDDMMMYYYY(value) : "-"),
    },
    {
      Header: "Initial Rent PM",
      accessor: "initialRentPM",
      align: "right",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Initial Rent PA",
      accessor: "initialRentPA",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Payment Term",
      accessor: "paymentTermMonths",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatContractPaymentTermDisplay(value) || "-",
    },
    { Header: "Term", accessor: "term", align: "left", showInTable: false },
    {
      Header: "Increase Rate %",
      accessor: "increaseRatePercent",
      align: "right",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? `${value}%` : "-"),
    },
    {
      Header: "Increase Interval (Months)",
      accessor: "increaseIntervalMonths",
      align: "right",
      showInTable: false,
    },
    {
      Header: "SD Rate",
      accessor: "sdRateMonths",
      align: "left",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatContractSdRateDisplay(value) || "-",
    },
    {
      Header: "Security Deposit (Rs)",
      accessor: "securityDepositAmount",
      align: "right",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          Contract State
        </MDBox>
      ),
      accessor: "contractState",
      align: "left",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // Prefer backend-provided value if available, otherwise compute from dates.
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const renderContractStateBadge = (state) => {
          const normalizedState = String(state || "")
            .trim()
            .toLowerCase();
          const displayState =
            normalizedState === "upcoming" || normalizedState === "pre-mature"
              ? "Pre-Mature"
              : normalizedState === "valid" || normalizedState === "active"
              ? "Valid"
              : normalizedState === "terminated"
              ? "Terminated"
              : normalizedState === "expiring"
              ? "Expiring"
              : state;
          const badgeStyles =
            normalizedState === "valid" || normalizedState === "active"
              ? {
                  backgroundColor: "#d4edda",
                  color: "#155724",
                }
              : normalizedState === "terminated"
              ? {
                  backgroundColor: "#f8d7da",
                  color: "#842029",
                }
              : normalizedState === "expiring"
              ? {
                  backgroundColor: "#fff3cd",
                  color: "#721c24",
                }
              : normalizedState === "upcoming" || normalizedState === "pre-mature"
              ? {
                  backgroundColor: "#dbeafe",
                  color: "#1d4ed8",
                }
              : {
                  backgroundColor: CALCULATED_CELL_BG,
                  color: "#344767",
                };

          return (
            <MDBox
              sx={{
                ...badgeStyles,
                // Table body cells use strong !important colors; keep badges visible in the grid.
                backgroundColor: `${badgeStyles.backgroundColor} !important`,
                color: `${badgeStyles.color} !important`,
                px: 1,
                py: 0.35,
                borderRadius: "999px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                minWidth: "96px",
                fontWeight: 600,
                "&, & *": {
                  color: `${badgeStyles.color} !important`,
                },
              }}
            >
              {displayState}
            </MDBox>
          );
        };
        if (
          rowData.ContractState === null ||
          rowData.contractState === null ||
          rowData.ContractStatus === null ||
          rowData.contractStatus === null
        ) {
          return "null";
        }
        const fromPayload =
          rowData.ContractState ??
          rowData.contractState ??
          rowData.ContractStatus ??
          rowData.contractStatus ??
          "";
        const trimmedBackend = String(fromPayload || "").trim();
        if (trimmedBackend) {
          return renderContractStateBadge(trimmedBackend);
        }

        return renderContractStateBadge("-");
      },
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          Rental Value
        </MDBox>
      ),
      accessor: "rentalValue",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
            width: "100%",
            textAlign: "right",
          }}
        >
          {value === null ? "null" : value || value === 0 ? Number(value).toLocaleString() : "-"}
        </MDBox>
      ),
    },
    {
      Header: "CA Area",
      accessor: "vaArea",
      align: "right",
      showInTable: false,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        const vaArea = value || row?.original?.VaArea || 0;
        return vaArea || vaArea === 0 ? Number(vaArea).toLocaleString() : "-";
      },
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          Govt Share (Rs)
        </MDBox>
      ),
      accessor: "govtShare",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const finalValue = value;
        const display = finalValue || finalValue === 0 ? Number(finalValue).toLocaleString() : "-";
        return (
          <MDBox
            sx={{
              backgroundColor: CALCULATED_CELL_BG,
              px: 0.75,
              py: 0.25,
              borderRadius: "6px",
              display: "inline-block",
              width: "100%",
              textAlign: "right",
            }}
          >
            {finalValue === null ? "null" : display}
          </MDBox>
        );
      },
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          PAF Share (Rs)
        </MDBox>
      ),
      accessor: "pafShare",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
            width: "100%",
            textAlign: "right",
          }}
        >
          {value === null ? "null" : value || value === 0 ? Number(value).toLocaleString() : "-"}
        </MDBox>
      ),
    },
    {
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          Revenue Rate(Rs)
        </MDBox>
      ),
      accessor: "groupRate",
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        /* eslint-disable react/prop-types */
        if (
          value === null ||
          row?.original?.GroupRate === null ||
          row?.original?.groupRate === null
        ) {
          return (
            <MDBox
              sx={{
                backgroundColor: CALCULATED_CELL_BG,
                px: 0.75,
                py: 0.25,
                borderRadius: "6px",
                display: "inline-block",
                width: "100%",
                textAlign: "right",
              }}
            >
              null
            </MDBox>
          );
        }
        const groupRate =
          value ||
          row?.original?.GroupRate ||
          row?.original?.groupRate ||
          row?.original?.TotalRate ||
          row?.original?.totalRate ||
          0;
        /* eslint-enable react/prop-types */
        const display = groupRate || groupRate === 0 ? Number(groupRate).toLocaleString() : "-";
        return (
          <MDBox
            sx={{
              backgroundColor: CALCULATED_CELL_BG,
              px: 0.75,
              py: 0.25,
              borderRadius: "6px",
              display: "inline-block",
              width: "100%",
              textAlign: "right",
            }}
          >
            {display}
          </MDBox>
        );
      },
    },
    {
      id: "percentRate",
      Header: (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
          }}
        >
          RV Rate
        </MDBox>
      ),
      accessor: (row) =>
        row?.RentalValueRate ??
        row?.rentalValueRate ??
        row?.RentalValueRatePercent ??
        row?.rentalValueRatePercent ??
        null,
      align: "right",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDBox
          sx={{
            backgroundColor: CALCULATED_CELL_BG,
            px: 0.75,
            py: 0.25,
            borderRadius: "6px",
            display: "inline-block",
            width: "100%",
            textAlign: "right",
          }}
        >
          {value === null ? "null" : value || value === 0 ? `${Number(value)}%` : "-"}
        </MDBox>
      ),
    },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => renderContractsStatusLightPill(value),
    },
    {
      id: "approvalStatus",
      Header: "Apprv By AHQ",
      accessor: (row) => row.ApprovalStatus ?? row.approvalStatus ?? null,
      align: "center",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => {
        const raw = value;
        const isApproved = raw === true || raw === 1 || raw === "1";
        const badgeStyles = isApproved
          ? { backgroundColor: "#d4edda", color: "#155724" }
          : { backgroundColor: "#fff3cd", color: "#856404" };
        const label = isApproved ? "Approved" : "Pending";
        return (
          <MDBox
            sx={{
              ...badgeStyles,
              px: 1,
              py: 0.35,
              borderRadius: "999px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "96px",
              fontWeight: 600,
            }}
          >
            {label}
          </MDBox>
        );
      },
    },
    { Header: "Remarks", accessor: "remarks", align: "left" },
    {
      Header: "Attach",
      id: "contractAttachments",
      accessor: "contractAttachments",
      align: "center",
      width: "50px",
      showInTable: true,
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const contractKey = rowData?.id ?? rowData?.Id;
        const rawIsAttachment = rowData?.IsAttachment;
        const countValue =
          rowData?.AttachmentCount ?? rowData?.AttachmentsCount ?? rowData?.FilesCount;
        const hasAttachments =
          rawIsAttachment === true ||
          rawIsAttachment === 1 ||
          rawIsAttachment === "1" ||
          String(rawIsAttachment || "")
            .trim()
            .toLowerCase() === "true" ||
          Number(countValue || 0) > 0;
        return (
          <MDBox
            display="flex"
            alignItems="center"
            justifyContent="center"
            width="100%"
            sx={{ m: 0, p: 0, minHeight: 28 }}
          >
            {contractKey ? (
              <IconButton
                size="small"
                color={hasAttachments ? "success" : "error"}
                // eslint-disable-next-line react/prop-types
                onClick={() => handleViewAttachments(row.original)}
                // eslint-disable-next-line react/prop-types
                disabled={attachmentLoading && attachmentLoadingId === contractKey}
                title="View attachments"
                sx={{
                  p: "2px",
                  m: 0,
                  minWidth: 0,
                  "&:hover": { backgroundColor: "action.hover" },
                }}
              >
                <Icon sx={{ fontSize: "1.05rem" }}>visibility</Icon>
              </IconButton>
            ) : (
              <MDTypography component="span" variant="caption" sx={{ lineHeight: 1, m: 0, p: 0 }}>
                -
              </MDTypography>
            )}
          </MDBox>
        );
      },
    },
  ];

  const isContractGridBlank = (value) =>
    value === null || value === undefined || String(value).trim() === "";

  const getContractGridValue = (row, keys) => {
    const data = row || {};
    const sources = [data, data.original].filter(Boolean);
    for (let i = 0; i < sources.length; i += 1) {
      for (let j = 0; j < keys.length; j += 1) {
        const value = sources[i][keys[j]];
        if (!isContractGridBlank(value)) return value;
      }
    }
    return "";
  };

  const formatContractGridDate = (value) =>
    isContractGridBlank(value) ? "" : formatDateDDMMMYYYY(value);

  const formatContractGridNumber = (value, suffix = "") => {
    if (isContractGridBlank(value)) return "";
    const numericValue = Number(value);
    const display = Number.isFinite(numericValue) ? numericValue.toLocaleString() : String(value);
    return `${display}${suffix}`;
  };

  const formatContractGridAreaWithUnit = (areaValue, rtRow) => {
    const data = rtRow?.original ?? rtRow ?? {};
    const numPart = formatContractGridNumber(areaValue, "");
    const unit = getContractGridValue(data, ["unitName", "UnitName", "UoM"]);
    if (!numPart && isContractGridBlank(unit)) return "";
    if (!numPart) return isContractGridBlank(unit) ? "" : String(unit).trim();
    if (isContractGridBlank(unit)) return numPart;
    return `${numPart} (${String(unit).trim()})`;
  };

  const formatContractGridTenant = (tenantNoValue, rtRow) => {
    const data = rtRow?.original ?? rtRow ?? {};
    const tn = !isContractGridBlank(tenantNoValue)
      ? String(tenantNoValue).trim()
      : String(getContractGridValue(data, ["tenantNo", "TenantNo"]) || "").trim();
    if (!tn) return "";
    const tenant = tenants.find((t) => String(t?.tenantNo ?? t?.TenantNo ?? "").trim() === tn);
    const owner = String(tenant?.ownerName ?? tenant?.OwnerName ?? "").trim();
    return owner ? `${tn} - ${owner}` : tn;
  };

  const makeContractGridColumn = ({
    id,
    Header,
    keys,
    align = "left",
    type = "text",
    moneyCompareFilter = false,
    chipVariant = null,
  }) => ({
    id,
    Header,
    accessor: (row) => getContractGridValue(row, keys),
    align,
    ...(moneyCompareFilter
      ? { filter: "contractsMoneyCompare", Filter: ContractsMoneyColumnFilter }
      : {}),
    // eslint-disable-next-line react/prop-types
    Cell: ({ value }) => {
      if (type === "date") return formatContractGridDate(value);
      if (type === "number") return formatContractGridNumber(value);
      if (type === "percent") return formatContractGridNumber(value, "%");
      if (chipVariant && !isContractGridBlank(value)) {
        return <GridValueChip value={value} variant={chipVariant} />;
      }
      return isContractGridBlank(value) ? "" : String(value);
    },
  });

  const findContractColumn = (key) =>
    columns.find((col) => col.id === key || col.accessor === key) || {};

  const firstRiseRateAccessor = (row) => {
    const directValue = getContractGridValue(row, [
      "RiseRatePercent",
      "riseRatePercent",
      "RisePercent",
    ]);
    if (!isContractGridBlank(directValue)) return directValue;
    const terms = row?.ContractRiseTerms || row?.contractRiseTerms || [];
    if (Array.isArray(terms) && terms.length > 0) {
      return terms[0]?.RisePercent ?? terms[0]?.risePercent ?? "";
    }
    return "";
  };

  const openPropertyGroupingPopupByGrpId = (grpIdValue) => {
    const grpId = String(grpIdValue || "").trim();
    if (!grpId) return;
    const targetUrl = `/contracts/property-grouping?grpId=${encodeURIComponent(grpId)}`;
    window.open(targetUrl, "_blank");
  };

  const normalizeInvoicesPaymentLabelKey = (raw) =>
    String(raw || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  /** Badge palette: filled pill so status reads clearly over zebra row / td !important text color. */
  const invoicesPaymentBadgePalette = (raw) => {
    const key = normalizeInvoicesPaymentLabelKey(raw);
    if (!key) return null;
    if (key === "full paid") return { bg: "#d4edda", fg: "#155724", outline: "#c3e6cb" };
    if (key === "partial" || key === "partial paid")
      return { bg: "#fff3cd", fg: "#856404", outline: "#ffe69c" };
    if (key === "unpaid") return { bg: "#ef6c00", fg: "#ffffff", outline: "#e65100" }; // orange
    if (key === "overpaid") return { bg: "#f8d7da", fg: "#721c24", outline: "#f5c6cb" }; // light red (Unviable-style)
    return null;
  };

  const renderContractGridInvoices = (value) => {
    if (isContractGridBlank(value)) return "";
    const label = typeof value === "string" ? value.trim() : String(value);
    const palette = invoicesPaymentBadgePalette(label);
    if (!palette) {
      return (
        <MDTypography variant="body2" component="span" sx={{ fontWeight: 500 }}>
          {label}
        </MDTypography>
      );
    }
    const { bg, fg, outline } = palette;
    return (
      <MDBox
        component="span"
        data-contract-invoices-badge="1"
        sx={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: "88px",
          maxWidth: "100%",
          px: 1,
          py: 0.45,
          borderRadius: "999px",
          fontWeight: 700,
          fontSize: "0.8125rem",
          lineHeight: 1.25,
          whiteSpace: "normal",
          textAlign: "center",
          backgroundColor: `${bg} !important`,
          color: `${fg} !important`,
          boxShadow: `inset 0 0 0 1px ${outline}`,
          verticalAlign: "middle",
          "&, & *, & .MuiTypography-root": {
            color: `${fg} !important`,
          },
        }}
      >
        {label}
      </MDBox>
    );
  };

  const renderContractGridApproval = (value) => {
    if (isContractGridBlank(value)) return "";
    const isApproved = value === true || value === 1 || value === "1";
    return <GridStatusChip value={isApproved ? "approved" : "pending"} />;
  };

  const contractGridColumns = [
    { ...findContractColumn("actions"), Header: "Action" },
    makeContractGridColumn({
      id: "contractNo",
      Header: "CA No",
      keys: ["contractNo", "ContractNo"],
    }),
    makeContractGridColumn({
      id: "cmdName",
      Header: "RAC",
      keys: ["cmdName", "CmdName", "Cmd", "cmd", "Rac", "rac"],
      chipVariant: "rac",
    }),
    makeContractGridColumn({
      id: "baseName",
      Header: "Base",
      keys: ["baseName", "BaseName", "Base", "base"],
      chipVariant: "base",
    }),
    makeContractGridColumn({
      id: "className",
      Header: "Class",
      keys: ["className", "ClassName", "Class", "class"],
      chipVariant: "class",
    }),
    makeContractGridColumn({ id: "grpId", Header: "Gp ID", keys: ["grpId", "GId", "GrpId"] }),
    {
      id: "location",
      Header: "Location",
      accessor: (row) => getContractGridValue(row, ["location", "Location"]),
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => <ContractGridLongTextCell value={value} matchGridPlainText />,
    },
    {
      id: "tenantNo",
      Header: "Tenant",
      accessor: (row) => getContractGridValue(row, ["tenantNo", "TenantNo"]),
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => formatContractGridTenant(value, row),
    },
    makeContractGridColumn({
      id: "businessName",
      Header: "Business",
      keys: ["businessName", "BusinessName"],
    }),
    makeContractGridColumn({
      id: "natureOfBusiness",
      Header: "Nature",
      keys: ["natureOfBusiness", "NatureOfBusiness"],
    }),
    {
      id: "booArea",
      Header: "BoO Area",
      accessor: (row) => getContractGridValue(row, ["totalArea", "TotalArea", "Area"]),
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => formatContractGridAreaWithUnit(value, row),
    },
    {
      id: "vaArea",
      Header: "CA Area",
      accessor: (row) => getContractGridValue(row, ["vaArea", "VaArea"]),
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => formatContractGridAreaWithUnit(value, row),
    },
    {
      id: "contractStartDate",
      Header: "CSD",
      accessor: (row) => getContractGridValue(row, ["contractStartDate", "ContractStartDate"]),
      align: "left",
      filter: "contractsDateCompare",
      Filter: ContractsDateColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatContractGridDate(value),
    },
    {
      id: "commercialOperationDate",
      Header: "COD",
      accessor: (row) =>
        getContractGridValue(row, ["commercialOperationDate", "CommercialOperationDate"]),
      align: "left",
      filter: "contractsDateCompare",
      Filter: ContractsDateColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatContractGridDate(value),
    },
    {
      id: "contractEndDate",
      Header: "CED",
      accessor: (row) => getContractGridValue(row, ["contractEndDate", "ContractEndDate"]),
      align: "left",
      filter: "contractsDateCompare",
      Filter: ContractsDateColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatContractGridDate(value),
    },
    makeContractGridColumn({
      id: "fiscal",
      Header: "FY",
      keys: ["FY"],
    }),
    { ...findContractColumn("contractState") },
    makeContractGridColumn({ id: "term", Header: "Term", keys: ["term", "Term"] }),
    makeContractGridColumn({
      id: "initialRentPM",
      Header: "Initial Rent PM",
      keys: ["initialRentPM", "InitialRentPM"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    makeContractGridColumn({
      id: "initialRentPA",
      Header: "Initial Rent PA",
      keys: ["initialRentPA", "InitialRentPA"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    {
      id: "paymentTermMonths",
      Header: "Payment Term",
      accessor: (row) => getContractGridValue(row, ["paymentTermMonths", "PaymentTermMonths"]),
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatContractPaymentTermDisplay(value) || "-",
    },
    {
      id: "sdRateMonths",
      Header: "SD Rate",
      accessor: (row) =>
        getContractGridValue(row, ["sdRateMonths", "SdRateMonths", "SDRateMonths"]),
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => formatContractSdRateDisplay(value) || "-",
    },
    makeContractGridColumn({
      id: "increaseRatePercent",
      Header: "Increase Rate (%)",
      keys: ["increaseRatePercent", "IncreaseRatePercent"],
      align: "right",
      type: "percent",
    }),
    makeContractGridColumn({
      id: "riseTermType",
      Header: "Rise Term",
      keys: ["riseTermType", "RiseTermType"],
    }),
    {
      id: "riseRatePercent",
      Header: "Rise Rate (%)",
      accessor: firstRiseRateAccessor,
      align: "right",
      Cell: ({ value }) => formatContractGridNumber(value, "%"),
    },
    makeContractGridColumn({
      id: "profitRate",
      Header: "Profit Rate (%)",
      keys: ["profitRate", "ProfitRate"],
      align: "right",
      type: "percent",
    }),
    makeContractGridColumn({
      id: "securityDepositAmount",
      Header: "Security Deposit",
      keys: ["securityDepositAmount", "SecurityDepositAmount"],
      align: "right",
      type: "number",
    }),
    { ...findContractColumn("feasible"), Header: "Viability" },
    makeContractGridColumn({
      id: "percentRate",
      Header: "RV Rate",
      keys: ["RentalValueRate", "rentalValueRate", "RentalValueRatePercent"],
      align: "right",
      type: "percent",
    }),
    makeContractGridColumn({
      id: "currentRentPA",
      Header: "Current Rent PA",
      keys: ["CurrRentPA"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    makeContractGridColumn({
      id: "rrFy",
      Header: "RR FY",
      keys: ["RRFY", "Rrfy", "rrfy"],
    }),
    {
      id: "groupRate",
      Header: "Revenue Rate (Rs)",
      accessor: (row) =>
        getContractGridValue(row, ["groupRate", "GroupRate", "totalRate", "TotalRate"]),
      align: "center",
      filter: "contractsMoneyCompare",
      Filter: ContractsMoneyColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const numericValue = Number(value);
        if (Number.isFinite(numericValue) && numericValue === -99) {
          const grpId = getContractGridValue(row, ["grpId", "GId", "GrpId"]);
          return (
            <MDBox display="flex" justifyContent="center" width="100%">
              <IconButton
                size="small"
                color="error"
                title="Add Rate to Property Grouping for this FY"
                onClick={() => openPropertyGroupingPopupByGrpId(grpId)}
                sx={{ p: "2px", color: "#dc2626 !important", opacity: "1 !important" }}
              >
                <Icon sx={{ color: "#dc2626" }}>warning</Icon>
              </IconButton>
            </MDBox>
          );
        }
        return formatContractGridNumber(value);
      },
    },
    makeContractGridColumn({
      id: "rentalValue",
      Header: "Rental Value",
      keys: ["rentalValue", "RentalValue"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    makeContractGridColumn({
      id: "govtShare",
      Header: "Govt Share",
      keys: ["govtShare", "GovtShare"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    makeContractGridColumn({
      id: "pafShare",
      Header: "PAF Share",
      keys: ["pafShare", "PAFShare"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    makeContractGridColumn({
      id: "ahqShare",
      Header: "AHQ Share",
      keys: ["AHQShare", "ahqShare"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    makeContractGridColumn({
      id: "racShare",
      Header: "RAC Share",
      keys: ["RACShare", "racShare"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    makeContractGridColumn({
      id: "baseShare",
      Header: "Base Share",
      keys: ["BaseShare", "baseShare"],
      align: "right",
      type: "number",
      moneyCompareFilter: true,
    }),
    makeContractGridColumn({
      id: "due",
      Header: "Inv. Due",
      keys: [
        "due",
        "Due",
        "dueAmount",
        "DueAmount",
        "InvDue",
        "invDue",
        "InvoiceDue",
        "invoiceDue",
      ],
      align: "right",
      type: "number",
    }),
    makeContractGridColumn({
      id: "paid",
      Header: "Inv. Paid",
      keys: [
        "paid",
        "Paid",
        "paidAmount",
        "PaidAmount",
        "InvPaid",
        "invPaid",
        "InvoicePaid",
        "invoicePaid",
      ],
      align: "right",
      type: "number",
    }),
    makeContractGridColumn({
      id: "rcvable",
      Header: "Inv. Rcvable",
      keys: [
        "rcvable",
        "Rcvable",
        "receivable",
        "Receivable",
        "receivableAmount",
        "ReceivableAmount",
      ],
      align: "right",
      type: "number",
    }),
    {
      id: "invoices",
      Header: "Invoices",
      accessor: (row) =>
        getContractGridValue(row, [
          "InvoicePaymentStatus",
          "invoicePaymentStatus",
          "InvoicePayStatus",
          "invoicePayStatus",
          "PaymentStatus",
          "paymentStatus",
          "invoices",
          "Invoices",
        ]),
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => renderContractGridInvoices(value),
    },
    {
      id: "status",
      Header: "Status",
      accessor: (row) => getContractGridValue(row, ["status", "Status"]),
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) =>
        isContractGridBlank(value) ? "" : renderContractsStatusLightPill(value),
    },
    {
      id: "approvalStatus",
      Header: "AHQ Approval",
      accessor: (row) =>
        getContractGridValue(row, ["ApprovalStatus", "approvalStatus", "ApprovedStatus"]),
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => renderContractGridApproval(value),
    },
    {
      id: "remarks",
      Header: "Remarks",
      accessor: (row) => getContractGridValue(row, ["remarks", "Remarks"]),
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => <ContractGridLongTextCell value={value} />,
    },
    { ...findContractColumn("contractAttachments"), Header: "Attach" },
  ];

  const groupingColumnOptions = [
    { label: "Group ID", value: "grpId" },
    { label: "Command", value: "cmdName" },
    { label: "Base", value: "baseName" },
    { label: "Class", value: "className" },
    { label: "Tenant No", value: "tenantNo" },
    { label: "Business Name", value: "businessName" },
    { label: "Nature of Business", value: "natureOfBusiness" },
    { label: "Status", value: "status" },
    { label: "Term", value: "term" },
  ];

  const gridFilterOptions = useMemo(() => {
    const commandMap = new Map();
    const baseMap = new Map();
    const classMap = new Map();

    (rows || []).forEach((row) => {
      const cmdName = String(row?.CmdName || "").trim();
      const baseName = String(row?.BaseName || "").trim();
      const className = String(row?.ClassName || "").trim();

      if (cmdName) commandMap.set(cmdName.toLowerCase(), cmdName);
      if (baseName) baseMap.set(baseName.toLowerCase(), baseName);
      if (className) classMap.set(className.toLowerCase(), className);
    });

    return {
      commands: Array.from(commandMap.values()).sort((a, b) => a.localeCompare(b)),
      bases: Array.from(baseMap.values()).sort((a, b) => a.localeCompare(b)),
      classes: Array.from(classMap.values()).sort((a, b) => a.localeCompare(b)),
    };
  }, [rows]);

  const pickContractRowVal = (row, ...keys) => {
    for (let i = 0; i < keys.length; i += 1) {
      const v = row?.[keys[i]];
      if (v !== undefined && v !== null) return v;
    }
    return undefined;
  };

  const resolveContractCmdLabel = (row, commandList) => {
    const fromCatalog = resolveCommandNameById(
      commandList,
      pickContractRowVal(row, "CmdId", "cmdId", "CommandId", "commandId")
    );
    if (fromCatalog) return fromCatalog;
    const text = String(
      pickContractRowVal(
        row,
        "CmdName",
        "cmdName",
        "CommandName",
        "commandName",
        "Cmd",
        "cmd",
        "Rac",
        "rac"
      ) ?? ""
    ).trim();
    if (!text) return "";
    const asNum = Number(text);
    if (Number.isFinite(asNum) && String(asNum) === text) {
      return resolveCommandNameById(commandList, asNum) || text;
    }
    return text;
  };

  const resolveContractBaseLabel = (row, baseList) => {
    const fromCatalog = resolveBaseNameById(
      baseList,
      pickContractRowVal(row, "BaseId", "baseId", "BaseID", "baseID")
    );
    if (fromCatalog) return fromCatalog;
    const text = String(
      pickContractRowVal(row, "BaseName", "baseName", "BaseLabel", "baseLabel", "Base", "base") ??
        ""
    ).trim();
    if (!text) return "";
    const asNum = Number(text);
    if (Number.isFinite(asNum) && String(asNum) === text) {
      return resolveBaseNameById(baseList, asNum) || text;
    }
    return text;
  };

  const resolveContractClassLabel = (row, classList) => {
    const fromCatalog = resolveClassNameById(
      classList,
      pickContractRowVal(row, "ClassId", "classId", "ClassID", "classID")
    );
    if (fromCatalog) return fromCatalog;
    const text = String(
      pickContractRowVal(
        row,
        "ClassName",
        "className",
        "ClassLabel",
        "classLabel",
        "Class",
        "class"
      ) ?? ""
    ).trim();
    if (!text) return "";
    const asNum = Number(text);
    if (Number.isFinite(asNum) && String(asNum) === text) {
      return resolveClassNameById(classList, asNum) || text;
    }
    return text;
  };

  // Group contracts by selected grouping columns.
  const groupedData = useMemo(() => {
    const approvalActionsBypass = contractsApprovalActionsBypassUser();
    const normalizedRows = rows.map((row) => {
      const grpId =
        pickContractRowVal(row, "GrpId", "grpId", "GId", "gId", "GrpName", "grpName") ?? "";
      const propertyGrouping = allPropertyGroupings.find((pg) => {
        const pgGid = String(pickContractRowVal(pg, "GId", "gId") ?? "").trim();
        const pgId = Number(pickContractRowVal(pg, "Id", "id"));
        const grpKey = String(grpId).trim();
        if (grpKey && pgGid && pgGid === grpKey) return true;
        const grpNum = Number(grpId);
        return Number.isFinite(grpNum) && Number.isFinite(pgId) && pgId === grpNum;
      });

      // Calculate Viability (same logic as Cell function)
      const fromPayload = String(
        row.Viability ?? row.viability ?? row.Feasible ?? row.feasible ?? ""
      )
        .trim()
        .toLowerCase();
      const hasPayloadValue = fromPayload === "viable" || fromPayload === "unviable";
      const govt = Number(row.GovtShare ?? row.govtShare ?? 0);
      const initialRentPAValue = Number(row.InitialRentPA ?? row.initialRentPA ?? 0);
      const mergedPafFromAsOf = row.PAFShare ?? row.pafShare;
      const pafFromAsOfNum = Number(mergedPafFromAsOf);
      const paf = Number.isFinite(pafFromAsOfNum)
        ? pafFromAsOfNum
        : Math.max(0, Math.round(initialRentPAValue - govt));
      const feasibleValue = hasPayloadValue
        ? fromPayload === "viable"
          ? "Viable"
          : "Unviable"
        : govt > paf
        ? "Viable"
        : "Unviable";

      return {
        ...row,
        id: pickContractRowVal(row, "Id", "id"),
        contractNo: pickContractRowVal(row, "ContractNo", "contractNo") ?? "",
        feasible: feasibleValue,
        asOfToday: "Active", // Text value for Excel export
        cmdName: resolveContractCmdLabel(row, commands),
        baseName: resolveContractBaseLabel(row, bases),
        className: resolveContractClassLabel(row, classes),
        CmdName: resolveContractCmdLabel(row, commands),
        BaseName: resolveContractBaseLabel(row, bases),
        ClassName: resolveContractClassLabel(row, classes),
        grpName:
          pickContractRowVal(row, "GrpName", "grpName", "GId", "gId") ??
          propertyGrouping?.GId ??
          propertyGrouping?.gId ??
          "",
        grpId:
          propertyGrouping?.GId ??
          propertyGrouping?.gId ??
          pickContractRowVal(row, "GId", "gId", "GrpId", "grpId") ??
          "",
        totalArea:
          propertyGrouping?.Area ??
          propertyGrouping?.area ??
          pickContractRowVal(row, "TotalArea", "totalArea", "Area", "area") ??
          0,
        totalRate:
          propertyGrouping?.Rate ??
          propertyGrouping?.rate ??
          pickContractRowVal(row, "TotalRate", "totalRate", "Rate", "rate") ??
          0,
        location:
          propertyGrouping?.Location ??
          propertyGrouping?.location ??
          pickContractRowVal(row, "Location", "location") ??
          "",
        unitName:
          propertyGrouping?.UoM ??
          propertyGrouping?.uoM ??
          propertyGrouping?.uom ??
          pickContractRowVal(row, "UnitName", "unitName", "UoM", "uoM", "uom") ??
          "",
        uoM:
          propertyGrouping?.UoM ??
          propertyGrouping?.uoM ??
          pickContractRowVal(row, "UoM", "uoM", "uom", "UnitName", "unitName") ??
          "",
        tenantNo: pickContractRowVal(row, "TenantNo", "tenantNo") ?? "",
        businessName: pickContractRowVal(row, "BusinessName", "businessName") ?? "",
        natureOfBusiness: pickContractRowVal(row, "NatureOfBusiness", "natureOfBusiness") ?? "",
        contractStartDate: pickContractRowVal(row, "ContractStartDate", "contractStartDate") ?? "",
        contractEndDate: pickContractRowVal(row, "ContractEndDate", "contractEndDate") ?? "",
        fiscal: row.Fiscal ?? row.fiscal ?? "",
        RRFY: row.RRFY ?? row.Rrfy ?? row.rrfy ?? "",
        rrfy: row.RRFY ?? row.Rrfy ?? row.rrfy ?? "",
        commercialOperationDate:
          pickContractRowVal(row, "CommercialOperationDate", "commercialOperationDate") ?? "",
        initialRentPM: pickContractRowVal(row, "InitialRentPM", "initialRentPM") ?? "",
        currentRentPA:
          pickContractRowVal(row, "CurrRentPA", "currRentPA", "CurrentRentPA", "currentRentPA") ??
          "",
        initialRentPA: pickContractRowVal(row, "InitialRentPA", "initialRentPA") ?? "",
        paymentTermMonths: pickContractRowVal(row, "PaymentTermMonths", "paymentTermMonths") ?? "",
        term: pickContractRowVal(row, "Term", "term") ?? "",
        increaseRatePercent:
          pickContractRowVal(row, "IncreaseRatePercent", "increaseRatePercent") ?? "",
        increaseIntervalMonths:
          pickContractRowVal(row, "IncreaseIntervalMonths", "increaseIntervalMonths") ?? "",
        sdRateMonths: pickContractRowVal(row, "SDRateMonths", "sdRateMonths") ?? "",
        securityDepositAmount:
          pickContractRowVal(row, "SecurityDepositAmount", "securityDepositAmount") ?? "",
        contractState:
          row.ContractState ?? row.contractState ?? row.ContractStatus ?? row.contractStatus ?? "",
        rentalValue: row.RentalValue ?? row.rentalValue,
        govtShare: row.GovtShare ?? row.govtShare,
        pafShare: paf,
        ahqShare: row.AHQShare ?? row.ahqShare,
        racShare: row.RACShare ?? row.racShare,
        baseShare: row.BaseShare ?? row.baseShare,
        isArchive: row.IsArchive ?? row.isArchive ?? false,
        IsArchive: row.IsArchive ?? row.isArchive ?? false,
        status: row.Status,
        __disabledRow: !(
          row.Status === true ||
          row.Status === 1 ||
          row.Status === "1" ||
          (typeof row.Status === "string" && String(row.Status).toLowerCase() === "active")
        ),
        remarks: pickContractRowVal(row, "Remarks", "remarks") ?? "",
        vaArea: pickContractRowVal(row, "VaArea", "vaArea") ?? 0,
        groupRate:
          row.GroupRate !== undefined || row.groupRate !== undefined
            ? row.GroupRate ?? row.groupRate
            : propertyGrouping?.Rate ?? row.TotalRate ?? row.Rate ?? 0,
        // Also set PascalCase versions for direct access
        CurrentRentPA:
          pickContractRowVal(row, "CurrRentPA", "currRentPA", "CurrentRentPA", "currentRentPA") ??
          "",
        CurrRentPA:
          pickContractRowVal(row, "CurrRentPA", "currRentPA", "CurrentRentPA", "currentRentPA") ??
          "",
        TotalArea:
          propertyGrouping?.Area ??
          propertyGrouping?.area ??
          pickContractRowVal(row, "TotalArea", "totalArea", "Area", "area") ??
          0,
        TotalRate:
          propertyGrouping?.Rate ??
          propertyGrouping?.rate ??
          pickContractRowVal(row, "TotalRate", "totalRate", "Rate", "rate") ??
          0,
        GroupRate:
          row.GroupRate !== undefined || row.groupRate !== undefined
            ? row.GroupRate ?? row.groupRate
            : propertyGrouping?.Rate ?? row.TotalRate ?? row.Rate ?? 0,
        Location:
          propertyGrouping?.Location ??
          propertyGrouping?.location ??
          pickContractRowVal(row, "Location", "location") ??
          "",
        UnitName:
          propertyGrouping?.UoM ??
          propertyGrouping?.uoM ??
          pickContractRowVal(row, "UnitName", "unitName", "UoM", "uoM") ??
          "",
        UoM:
          propertyGrouping?.UoM ??
          propertyGrouping?.uoM ??
          pickContractRowVal(row, "UoM", "uoM", "uom") ??
          "",
        VaArea: pickContractRowVal(row, "VaArea", "vaArea") ?? 0,
      };
    });

    // Apply Command/Base/Class filters before grouping.
    const selectedCommandNames = new Set(
      (Array.isArray(commandFilterIds) ? commandFilterIds : [])
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );
    const selectedBaseNames = new Set(
      (Array.isArray(baseFilterIds) ? baseFilterIds : [])
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );
    const selectedClassNames = new Set(
      (Array.isArray(classFilterIds) ? classFilterIds : [])
        .map((v) =>
          String(v || "")
            .trim()
            .toLowerCase()
        )
        .filter(Boolean)
    );

    const getRowContractStateNormalized = (r) => {
      const fromPayload =
        r.ContractState ?? r.contractState ?? r.ContractStatus ?? r.contractStatus ?? "";
      const n = String(fromPayload || "")
        .trim()
        .toLowerCase();
      if (n) {
        if (n === "upcoming" || n === "not started") return "upcoming";
        return n;
      }
      const startRaw = r.contractStartDate ?? r.ContractStartDate ?? "";
      const endRaw = r.contractEndDate ?? r.ContractEndDate ?? "";
      const start = String(startRaw || "")
        .split("T")[0]
        .slice(0, 10);
      const end = String(endRaw || "")
        .split("T")[0]
        .slice(0, 10);
      const today = new Date().toISOString().split("T")[0];
      if (start && today < start) return "upcoming";
      if (end && today > end) return "terminated";
      if (start && end && today >= start && today <= end) return "active";
      return "";
    };

    const filteredRows = normalizedRows.filter((row) => {
      const isArchived = (v) =>
        v === true || v === 1 || v === "1" || String(v || "").toLowerCase() === "true";
      const cmdName = String(row.cmdName || "").toLowerCase();
      const baseName = String(row.baseName || "").toLowerCase();
      const className = String(row.className || "").toLowerCase();

      const matchesCommand = selectedCommandNames.size === 0 || selectedCommandNames.has(cmdName);
      const matchesBase = selectedBaseNames.size === 0 || selectedBaseNames.has(baseName);
      const matchesClass = selectedClassNames.size === 0 || selectedClassNames.has(className);

      // IMPORTANT:
      // "As of Date" is used only to refresh specific numeric columns via ActiveByAsOfDate,
      // not to filter/hide the master contracts list in the grid.
      const matchesAsOfDate = true;

      const approvalRaw =
        row.ApprovalStatus ?? row.approvalStatus ?? row.ApprovedStatus ?? row.approvedStatus;
      const rowApprovalApproved = approvalRaw === true || approvalRaw === 1 || approvalRaw === "1";

      let matchesArchiveComposite = true;
      let matchesApprovalDimension = true;
      switch (contractsArchiveFilter) {
        case "all":
          matchesArchiveComposite = true;
          break;
        case "valid": {
          const st = getRowContractStateNormalized(row);
          matchesArchiveComposite = st === "active" || st === "valid";
          break;
        }
        case "archive":
          matchesArchiveComposite = isArchived(row.IsArchive ?? row.isArchive);
          break;
        default:
          break;
      }
      switch (contractsApprovalFilter) {
        case "all":
          matchesApprovalDimension = true;
          break;
        case "approved":
          matchesApprovalDimension = rowApprovalApproved;
          break;
        case "pending":
          matchesApprovalDimension = !rowApprovalApproved;
          break;
        default:
          break;
      }

      const matchesKpiHealth = rowMatchesKpiContractHealthFilter(
        row,
        kpiContractHealthFilter,
        getRowContractStateNormalized
      );
      const matchesKpiStatus = rowMatchesKpiContractStatusFilter(row, kpiContractStatusFilter);

      return (
        matchesCommand &&
        matchesBase &&
        matchesClass &&
        matchesAsOfDate &&
        matchesArchiveComposite &&
        matchesApprovalDimension &&
        matchesKpiHealth &&
        matchesKpiStatus
      );
    });

    // If no grouping selected, return plain rows.
    if (!Array.isArray(groupByColumns) || groupByColumns.length === 0) {
      return filteredRows.map((row) => {
        const approvalRaw =
          row.ApprovalStatus ?? row.approvalStatus ?? row.ApprovedStatus ?? row.approvedStatus;
        const isApprovedStrict = approvalRaw === true || approvalRaw === 1;
        const showEditDeleteActions = approvalActionsBypass || !isApprovedStrict;
        return {
          ...row,
          actions: (
            <MDBox
              alignItems="left"
              justifyContent="left"
              sx={{
                backgroundColor: "#f8f9fa",
                gap: "2px",
                padding: "2px 2px",
                borderRadius: "2px",
              }}
            >
              {canEditCurrentMenu() && showEditDeleteActions && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditContract(row.id)}
                  title="Edit"
                  sx={{ padding: "1px" }}
                >
                  <Icon>edit</Icon>
                </IconButton>
              )}
              {canDeleteCurrentMenu() && showEditDeleteActions && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteContract(row.id)}
                  title="Delete"
                  sx={{ padding: "1px" }}
                >
                  <Icon>delete</Icon>
                </IconButton>
              )}
              <IconButton
                size="small"
                color="success"
                onClick={() => handleViewDetails(row)}
                title="View Details"
                sx={{ padding: "1px" }}
              >
                <Icon>visibility</Icon>
              </IconButton>
              <IconButton
                size="small"
                color="warning"
                onClick={() => handleOpenContractInvoices(row)}
                title="Invoices"
                sx={{ padding: "1px" }}
              >
                <Icon>receipt_long</Icon>
              </IconButton>
            </MDBox>
          ),
        };
      });
    }

    const groups = new Map();
    filteredRows.forEach((row) => {
      const groupValues = groupByColumns.map((col) => {
        const raw = row?.[col];
        if (raw === null || raw === undefined || raw === "") return "-";
        if (typeof raw === "boolean") return raw ? "Active" : "Inactive";
        return String(raw);
      });
      const groupKey = groupValues.join(" || ");
      const groupLabel = groupByColumns
        .map((col, idx) => {
          const colLabel = groupingColumnOptions.find((o) => o.value === col)?.label || col;
          return `${colLabel}: ${groupValues[idx]}`;
        })
        .join(" | ");

      if (!groups.has(groupKey)) {
        // Use property-group metadata when grouping includes grpId.
        const grpId = row.GrpId || row.GId || "";
        const propertyGrouping = allPropertyGroupings.find(
          (pg) => pg.GId === grpId || pg.Id === Number(grpId)
        );
        groups.set(groupKey, {
          grpId: grpId || "",
          grpName: propertyGrouping?.GId || row.GrpName || grpId || "",
          groupLabel,
          totalArea: propertyGrouping?.Area || 0,
          totalRate: propertyGrouping?.Rate ?? 0,
          location: propertyGrouping?.Location || "",
          rows: [],
        });
      }
      groups.get(groupKey).rows.push(row);
    });

    // Build result array
    const result = [];
    groups.forEach((group, groupKey) => {
      const isExpanded = expandedGroups.has(groupKey);
      const groupRows = group.rows;

      // Calculate sums for numeric fields
      const numericSums = {
        totalArea: 0,
        totalRate: 0,
        groupRate: 0,
        initialRentPM: 0,
        initialRentPA: 0,
        paymentTermMonths: 0,
        sdRateMonths: 0,
        increaseRatePercent: 0,
        increaseIntervalMonths: 0,
        securityDepositAmount: 0,
        rentalValue: 0,
        govtShare: 0,
        pafShare: 0,
        vaArea: 0,
        // PascalCase versions
        TotalArea: 0,
        TotalRate: 0,
        GroupRate: 0,
        InitialRentPM: 0,
        InitialRentPA: 0,
        PaymentTermMonths: 0,
        SDRateMonths: 0,
        IncreaseRatePercent: 0,
        IncreaseIntervalMonths: 0,
        SecurityDepositAmount: 0,
        RentalValue: 0,
        GovtShare: 0,
        PAFShare: 0,
        VaArea: 0,
      };

      groupRows.forEach((row) => {
        // Sum numeric fields
        numericSums.totalArea += Number(row.totalArea || row.TotalArea || 0);
        numericSums.totalRate += Number(row.totalRate || row.TotalRate || 0);
        numericSums.groupRate += Number(row.groupRate || row.GroupRate || 0);
        numericSums.initialRentPM += Number(row.initialRentPM || row.InitialRentPM || 0);
        numericSums.initialRentPA += Number(row.initialRentPA || row.InitialRentPA || 0);
        numericSums.paymentTermMonths += Number(
          row.paymentTermMonths || row.PaymentTermMonths || 0
        );
        numericSums.sdRateMonths += Number(row.sdRateMonths || row.SDRateMonths || 0);
        numericSums.increaseRatePercent += Number(
          row.increaseRatePercent || row.IncreaseRatePercent || 0
        );
        numericSums.increaseIntervalMonths += Number(
          row.increaseIntervalMonths || row.IncreaseIntervalMonths || 0
        );
        numericSums.securityDepositAmount += Number(
          row.securityDepositAmount || row.SecurityDepositAmount || 0
        );
        numericSums.rentalValue += Number(row.rentalValue || row.RentalValue || 0);
        numericSums.govtShare += Number(row.govtShare || row.GovtShare || 0);
        numericSums.pafShare += Number(row.pafShare || row.PAFShare || 0);
        numericSums.vaArea += Number(row.vaArea || row.VaArea || 0);

        // PascalCase versions
        numericSums.TotalArea += Number(row.TotalArea || row.totalArea || 0);
        numericSums.TotalRate += Number(row.TotalRate || row.totalRate || 0);
        numericSums.GroupRate += Number(row.GroupRate || row.groupRate || 0);
        numericSums.InitialRentPM += Number(row.InitialRentPM || row.initialRentPM || 0);
        numericSums.InitialRentPA += Number(row.InitialRentPA || row.initialRentPA || 0);
        numericSums.PaymentTermMonths += Number(
          row.PaymentTermMonths || row.paymentTermMonths || 0
        );
        numericSums.SDRateMonths += Number(row.SDRateMonths || row.sdRateMonths || 0);
        numericSums.IncreaseRatePercent += Number(
          row.IncreaseRatePercent || row.increaseRatePercent || 0
        );
        numericSums.IncreaseIntervalMonths += Number(
          row.IncreaseIntervalMonths || row.increaseIntervalMonths || 0
        );
        numericSums.SecurityDepositAmount += Number(
          row.SecurityDepositAmount || row.securityDepositAmount || 0
        );
        numericSums.RentalValue += Number(row.RentalValue || row.rentalValue || 0);
        numericSums.GovtShare += Number(row.GovtShare || row.govtShare || 0);
        numericSums.PAFShare += Number(row.PAFShare || row.pafShare || 0);
        numericSums.VaArea += Number(row.VaArea || row.vaArea || 0);
      });

      // Preserve values for grouped columns only
      const groupedColumnValues = {};
      groupByColumns.forEach((col) => {
        const firstRowValue = group.rows[0]?.[col];
        const firstRowValuePascal = group.rows[0]?.[col.charAt(0).toUpperCase() + col.slice(1)];
        groupedColumnValues[col] = firstRowValue !== undefined ? firstRowValue : "";
        // Also set PascalCase version if it exists
        if (firstRowValuePascal !== undefined) {
          groupedColumnValues[col.charAt(0).toUpperCase() + col.slice(1)] = firstRowValuePascal;
        }
      });

      // Create group row with sums for numeric fields and blank for date/text fields
      const groupedRowCount = groupRows.length;
      const contractNoWithGroupCount = group.groupLabel
        ? `${group.groupLabel} (${groupedRowCount})`
        : `(${groupedRowCount})`;
      const groupRow = {
        // Start with first row to get structure
        ...group.rows[0],
        // Group label in Contract No (both PascalCase and camelCase), with grouped row count
        ContractNo: contractNoWithGroupCount,
        contractNo: contractNoWithGroupCount,
        GrpName: group.grpName,
        grpName: group.grpName,
        // Numeric fields - use sums
        ...numericSums,
        // Preserve grouped column values
        ...groupedColumnValues,
        // Date fields - set to blank
        contractStartDate: "",
        contractEndDate: "",
        commercialOperationDate: "",
        ContractStartDate: "",
        ContractEndDate: "",
        CommercialOperationDate: "",
        // Text fields - set to blank (except grouped columns which are already set above)
        tenantNo: "",
        businessName: "",
        natureOfBusiness: "",
        term: "",
        remarks: "",
        location: "",
        unitName: "",
        TenantNo: "",
        BusinessName: "",
        NatureOfBusiness: "",
        Term: "",
        Remarks: "",
        Location: "",
        UnitName: "",
        UoM: "",
        // Status and other non-numeric, non-date fields
        status: "",
        Status: "",
        feasible: "",
        Feasible: "",
        __disabledRow: false,
        // Group metadata
        IsGroupRow: true,
        GroupKey: groupKey,
        GroupRows: group.rows,
        actions: (
          <MDBox
            alignItems="left"
            justifyContent="left"
            sx={{
              backgroundColor: "#f8f9fa",
              gap: "2px",
              padding: "2px 2px",
              borderRadius: "2px",
            }}
          >
            <IconButton
              size="small"
              color="info"
              onClick={() => {
                const newExpanded = new Set(expandedGroups);
                if (isExpanded) {
                  newExpanded.delete(groupKey);
                } else {
                  newExpanded.add(groupKey);
                }
                setExpandedGroups(newExpanded);
              }}
              title={isExpanded ? "Collapse" : "Expand"}
              sx={{ padding: "1px" }}
            >
              <Icon>{isExpanded ? "expand_less" : "expand_more"}</Icon>
            </IconButton>
          </MDBox>
        ),
      };

      result.push(groupRow);

      // Add expanded rows if group is expanded
      // Detail rows should show all original data (no aggregation)
      if (isExpanded) {
        group.rows.forEach((row) => {
          const approvalRaw =
            row.ApprovalStatus ?? row.approvalStatus ?? row.ApprovedStatus ?? row.approvedStatus;
          const isApprovedStrict = approvalRaw === true || approvalRaw === 1;
          const showEditDeleteActions = approvalActionsBypass || !isApprovedStrict;
          result.push({
            ...row,
            // Keep all original row data - no overrides needed
            IsExpandedRow: true,
            actions: (
              <MDBox
                alignItems="left"
                justifyContent="left"
                sx={{
                  backgroundColor: "#f8f9fa",
                  gap: "2px",
                  padding: "2px 2px",
                  borderRadius: "2px",
                }}
              >
                {canEditCurrentMenu() && showEditDeleteActions && (
                  <IconButton
                    size="small"
                    color="info"
                    onClick={() => handleEditContract(row.id)}
                    title="Edit"
                    sx={{ padding: "1px" }}
                  >
                    <Icon>edit</Icon>
                  </IconButton>
                )}
                {canDeleteCurrentMenu() && showEditDeleteActions && (
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteContract(row.id)}
                    title="Delete"
                    sx={{ padding: "1px" }}
                  >
                    <Icon>delete</Icon>
                  </IconButton>
                )}
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleViewDetails(row)}
                  title="View Details"
                  sx={{ padding: "1px" }}
                >
                  <Icon>visibility</Icon>
                </IconButton>
                <IconButton
                  size="small"
                  color="warning"
                  onClick={() => handleOpenContractInvoices(row)}
                  title="Invoices"
                  sx={{ padding: "1px" }}
                >
                  <Icon>receipt_long</Icon>
                </IconButton>
              </MDBox>
            ),
          });
        });
      }
    });

    return result;
  }, [
    rows,
    commands,
    bases,
    classes,
    commandFilterIds,
    baseFilterIds,
    classFilterIds,
    contractsArchiveFilter,
    contractsApprovalFilter,
    kpiContractHealthFilter,
    kpiContractStatusFilter,
    allPropertyGroupings,
    expandedGroups,
    groupByColumns,
    handleOpenContractInvoices,
  ]);

  const computedRows = groupedData;

  // Filter columns to only show those with showInTable: true
  const visibleColumnsBase = columns.filter((col) => col.showInTable !== false);

  // Group calculated columns under a top header
  const calculatedColumnKeys = new Set([
    "contractState",
    "rentalValue",
    "govtShare",
    "pafShare",
    "groupRate",
    "percentRate",
  ]);
  const getColumnKey = (col) => col?.id || (typeof col?.accessor === "string" ? col.accessor : "");
  const calcIndexes = visibleColumnsBase
    .map((c, i) => ({ i, key: getColumnKey(c) }))
    .filter(({ key }) => calculatedColumnKeys.has(key))
    .map(({ i }) => i);

  const visibleColumns = (() => {
    if (calcIndexes.length === 0) return visibleColumnsBase;
    const first = Math.min(...calcIndexes);
    const last = Math.max(...calcIndexes);
    const before = visibleColumnsBase.slice(0, first);
    const calcChildren = visibleColumnsBase.slice(first, last + 1);
    const after = visibleColumnsBase.slice(last + 1);
    return [
      ...before,
      {
        Header: (
          <MDBox
            sx={{
              backgroundColor: CALCULATED_CELL_BG,
              px: 1,
              py: 0.4,
              borderRadius: "8px",
              display: "inline-block",
              width: "100%",
              textAlign: "center",
            }}
          >
            Calculated Values
          </MDBox>
        ),
        align: "center",
        columns: calcChildren,
      },
      ...after,
    ];
  })();
  const allColumns = columns; // Keep all columns for details dialog and export

  const getUserId = () => {
    try {
      const raw = localStorage.getItem("auth");
      if (!raw) return "Unknown";
      const obj = JSON.parse(raw);
      return (
        obj?.username ||
        obj?.Username ||
        obj?.userName ||
        obj?.userId ||
        obj?.UserId ||
        obj?.unique_name ||
        obj?.UniqueName ||
        "Unknown"
      );
    } catch {
      return "Unknown";
    }
  };

  const generateContractDetailsPDF = (viewOnly = false) => {
    if (!selectedContractDetails) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const lineHeight = 5;
    const boxGap = 4;
    const colWidth = (pageWidth - 2 * margin - 2 * boxGap) / 3;
    const boxPadding = 3;
    const boxMinHeight = 10;

    const addWatermarks = () => {
      const totalPages = doc.internal.getNumberOfPages();
      const userId = getUserId();
      const ip = getUserIPAddress() || "session";
      doc.setTextColor(180, 180, 180, 0.4);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      for (let p = 1; p <= totalPages; p += 1) {
        doc.setPage(p);
        doc.text(`IP: ${ip}`, pageWidth - margin - 30, pageHeight - 8);
        doc.text(`User: ${userId}`, margin, pageHeight - 8);
      }
      doc.setTextColor(0, 0, 0);
      doc.setFontSize(10);
    };

    const getDisplayValue = (col, rowData) => {
      const accessor = col.accessor;
      const accessorKey = typeof accessor === "string" ? accessor : null;
      let value = accessorKey ? rowData[accessorKey] : undefined;
      if ((value === undefined || value === null) && accessorKey) {
        const pascal = accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1);
        value = rowData[pascal];
      }
      if ((value === undefined || value === null) && rowData.original && accessorKey) {
        value = rowData.original[accessorKey];
        if (value === undefined || value === null) {
          value = rowData.original[accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)];
        }
      }
      if (accessor === "groupRate" || accessor === "totalRate") {
        value =
          rowData.GroupRate || rowData.groupRate || rowData.TotalRate || rowData.totalRate || value;
      }
      if (accessor === "grpId") return value || rowData?.GId || "-";
      if (accessor === "asOfToday") return "Active";
      if (accessor === "feasible") {
        const fromPayload = String(
          value ??
            rowData?.Viability ??
            rowData?.viability ??
            rowData?.Feasible ??
            rowData?.feasible ??
            ""
        )
          .trim()
          .toLowerCase();
        if (fromPayload === "viable" || fromPayload === "unviable")
          return fromPayload === "viable" ? "Viable" : "Unviable";
        const govt = Number(rowData?.GovtShare ?? 0);
        const paf = Number(rowData?.PAFShare ?? 0);
        return govt > paf ? "Viable" : "Unviable";
      }
      if (accessor === "totalArea") {
        const v = rowData?.TotalArea ?? value ?? 0;
        return v ? Number(v).toLocaleString() : "-";
      }
      if (accessor === "paymentTermMonths") {
        const v = value ?? rowData?.PaymentTermMonths ?? rowData?.paymentTermMonths;
        return formatContractPaymentTermDisplay(v) || "-";
      }
      if (accessor === "sdRateMonths") {
        const v = value ?? rowData?.SDRateMonths ?? rowData?.SdRateMonths ?? rowData?.sdRateMonths;
        return formatContractSdRateDisplay(v) || "-";
      }
      if (accessor === "location") return rowData?.Location || value || "-";
      if (accessor === "uoM") return value || rowData?.UoM || rowData?.unitName || "-";
      if (accessor === "unitName") return value || rowData?.UnitName || rowData?.UoM || "-";
      if (accessor === "tenantNo") {
        const tn = value || rowData?.TenantNo || "";
        const tenant = tenants.find((t) => (t.tenantNo || t.TenantNo) === tn);
        if (tenant) {
          const parts = [tn];
          if (tenant.ownerName || tenant.OwnerName)
            parts.push(tenant.ownerName || tenant.OwnerName);
          if (tenant.address || tenant.Address) parts.push(tenant.address || tenant.Address);
          return parts.join(" - ");
        }
        return tn || "-";
      }
      const dateCols = [
        "contractStartDate",
        "contractEndDate",
        "commercialOperationDate",
        "risedate",
      ];
      if (dateCols.includes(accessor)) return formatDateDDMMMYYYY(value) || "-";
      const numCols = [
        "initialRentPM",
        "initialRentPA",
        "groupRate",
        "rentalValue",
        "vaArea",
        "govtShare",
        "pafShare",
        "securityDepositAmount",
      ];
      if (accessorKey && numCols.includes(accessorKey)) {
        const v = value ?? rowData?.[accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)];
        return v !== undefined && v !== null && v !== "" ? Number(v).toLocaleString() : "-";
      }
      if (accessor === "increaseRatePercent") return value ? `${value}%` : "-";
      if (accessor === "status")
        return value === true || value === 1 || value === "Active" ? "Active" : "Inactive";
      if (value === null || value === undefined || value === "") return "-";
      return String(value);
    };

    const detailsColumns = allColumns.filter(
      (col) =>
        col.accessor !== "actions" &&
        col.accessor !== "attachments" &&
        col.accessor !== "contractAttachments" &&
        typeof col.Header === "string"
    );

    const contractNo =
      selectedContractDetails.ContractNo || selectedContractDetails.contractNo || "-";

    if (viewOnly) {
      // Plain text only - no UI formatting (no boxes, no grid)
      const gap = 6;
      const rightContentPad = 8;
      const leftW = (pageWidth - 2 * margin - gap) * 0.56;
      const rightW = (pageWidth - 2 * margin - gap) * 0.44;
      const valueX = margin + leftW + gap;
      const valueWrapWidth = Math.max(10, rightW - rightContentPad);

      let yPos = margin;
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Contract Details", margin, yPos);
      yPos += lineHeight + 2;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");

      const racBaseClassAccessors = ["cmdName", "baseName", "className"];
      const racCol = detailsColumns.find((c) => c.accessor === "cmdName");
      const baseCol = detailsColumns.find((c) => c.accessor === "baseName");
      const classCol = detailsColumns.find((c) => c.accessor === "className");
      if (racCol || baseCol || classCol) {
        const usableW = pageWidth - 2 * margin;
        const colGap = 4;
        const contractBlockW = usableW * 0.3;
        const rbcAreaW = usableW - contractBlockW - colGap;
        const wCol = (rbcAreaW - 2 * colGap) / 3;
        const xContract = margin;
        const x1 = margin + contractBlockW + colGap;
        const x2 = x1 + wCol + colGap;
        const x3 = x2 + wCol + colGap;
        const seg = (c) => (c ? `${c.Header}: ${getDisplayValue(c, selectedContractDetails)}` : "");
        const contractLines = doc.splitTextToSize(`Contract No: ${contractNo}`, contractBlockW);
        const lines1 = doc.splitTextToSize(seg(racCol), wCol);
        const lines2 = doc.splitTextToSize(seg(baseCol), wCol);
        const lines3 = doc.splitTextToSize(seg(classCol), wCol);
        const maxHeadLines = Math.max(
          contractLines.length,
          lines1.length,
          lines2.length,
          lines3.length
        );
        doc.setFont("helvetica", "bold");
        for (let i = 0; i < maxHeadLines; i += 1) {
          if (yPos > pageHeight - 20) {
            doc.addPage();
            yPos = margin;
          }
          if (contractLines[i]) doc.text(contractLines[i], xContract, yPos);
          if (lines1[i]) doc.text(lines1[i], x1, yPos);
          if (lines2[i]) doc.text(lines2[i], x2, yPos);
          if (lines3[i]) doc.text(lines3[i], x3, yPos);
          yPos += lineHeight;
        }
        doc.setFont("helvetica", "normal");
        yPos += 2;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4;
      } else {
        doc.setFont("helvetica", "bold");
        doc.text(`Contract No: ${contractNo}`, margin, yPos);
        doc.setFont("helvetica", "normal");
        yPos += lineHeight + 2;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 4;
      }

      const restColumns = detailsColumns.filter(
        (col) =>
          !racBaseClassAccessors.includes(col.accessor) &&
          col.accessor !== "id" &&
          col.Header !== "S.No"
      );

      const contractorAccessors = new Set([
        "tenantNo",
        "businessName",
        "natureOfBusiness",
        "status",
        "remarks",
        "signatory",
      ]);
      const propertyAccessors = new Set([
        "grpId",
        "grpName",
        "totalArea",
        "location",
        "uoM",
        "unitName",
        "groupRate",
        "vaArea",
      ]);
      const termsAccessors = new Set([
        "contractStartDate",
        "contractEndDate",
        "commercialOperationDate",
        "initialRentPM",
        "initialRentPA",
        "paymentTermMonths",
        "term",
        "increaseRatePercent",
        "increaseIntervalMonths",
        "sdRateMonths",
        "securityDepositAmount",
        "contractState",
        "rentalValue",
        "govtShare",
        "pafShare",
        "percentRate",
        "dpc",
      ]);

      const getSectionName = (col) => {
        const accessor = String(col?.accessor || "")
          .trim()
          .toLowerCase();
        const header = String(col?.Header || "")
          .trim()
          .toLowerCase();
        if (contractorAccessors.has(accessor)) return "Contractor";
        if (propertyAccessors.has(accessor)) return "Property";
        if (termsAccessors.has(accessor)) return "Terms";

        if (
          header.includes("tenant") ||
          header.includes("business") ||
          header.includes("nature") ||
          header.includes("signatory") ||
          header.includes("remark") ||
          header === "status"
        ) {
          return "Contractor";
        }
        if (
          header.includes("group") ||
          header.includes("area") ||
          header.includes("location") ||
          header === "uom" ||
          header.includes("unit")
        ) {
          return "Property";
        }
        return "Terms";
      };

      const sectionTitles = ["Contractor", "Property", "Terms"];
      const sectionColumns = {
        Contractor: [],
        Property: [],
        Terms: [],
      };
      restColumns.forEach((col) => {
        sectionColumns[getSectionName(col)].push(col);
      });

      sectionTitles.forEach((sectionTitle) => {
        const cols = sectionColumns[sectionTitle];
        if (!cols || cols.length === 0) return;

        if (yPos > pageHeight - 24) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text(sectionTitle, margin, yPos);
        yPos += lineHeight + 1;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);

        let fieldSerial = 0;
        cols.forEach((col) => {
          fieldSerial += 1;
          const displayVal = getDisplayValue(col, selectedContractDetails);
          const labelBlock = `${fieldSerial}. ${col.Header}:`;
          const labelLines = doc.splitTextToSize(labelBlock, leftW);
          const valueLines = doc.splitTextToSize(String(displayVal), valueWrapWidth);
          const maxLines = Math.max(labelLines.length, valueLines.length);
          for (let i = 0; i < maxLines; i += 1) {
            if (yPos > pageHeight - 20) {
              doc.addPage();
              yPos = margin;
            }
            if (labelLines[i]) {
              doc.text(labelLines[i], margin, yPos);
            }
            if (valueLines[i]) {
              doc.text(valueLines[i], valueX, yPos);
            }
            yPos += lineHeight;
          }
          yPos += 2;
        });

        yPos += 1;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
      });

      if (contractDetailsRiseTerms.length > 0) {
        yPos += 4;
        if (yPos > pageHeight - 40) {
          doc.addPage();
          yPos = margin;
        }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.text("Existing Rise Terms", margin, yPos);
        yPos += lineHeight + 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text("Sequence No    Months Interval    Rise Percent (%)", margin, yPos);
        yPos += lineHeight + 2;
        contractDetailsRiseTerms.forEach((term, riseIdx) => {
          if (yPos > pageHeight - 20) {
            doc.addPage();
            yPos = margin;
          }
          doc.text(
            `${riseIdx + 1}. ${term.sequenceNo ?? ""}    ${term.monthsInterval ?? ""}    ${
              term.risePercent ?? ""
            }%`,
            margin,
            yPos
          );
          yPos += lineHeight;
        });

        yPos += 2;
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.5);
        doc.line(margin, yPos, pageWidth - margin, yPos);
        yPos += 5;
      }

      if (yPos > pageHeight - 42) {
        doc.addPage();
        yPos = margin;
      }

      const signatureGap = 10;
      const signatureWidth = (pageWidth - 2 * margin - 2 * signatureGap) / 3;
      const signatureY = pageHeight - 24;
      const signatureLabels = ["Signatory 1", "Signatory 2", "Counter Sign"];

      doc.setDrawColor(0, 0, 0);
      doc.setLineWidth(0.3);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);

      signatureLabels.forEach((label, index) => {
        const x = margin + index * (signatureWidth + signatureGap);
        doc.line(x, signatureY, x + signatureWidth, signatureY);
        doc.text(label, x + signatureWidth / 2, signatureY + 6, { align: "center" });
      });
    } else {
      // Formatted layout with boxes and grid (for download)
      let yPos = margin;

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("Contract Details", margin, yPos);
      yPos += lineHeight + 2;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Contract No: ${contractNo}`, margin, yPos);
      yPos += lineHeight + 6;

      const drawFieldBox = (x, y, label, value, align = "left") => {
        const innerWidth = colWidth - 2 * boxPadding;
        const valueLines = doc.splitTextToSize(String(value || "-"), innerWidth);
        const contentHeight = lineHeight + 2 + valueLines.length * lineHeight;
        const boxHeight = Math.max(boxMinHeight, contentHeight + 2 * boxPadding);

        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.rect(x, y, colWidth, boxHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(8);
        doc.setTextColor(80, 80, 80);
        doc.text(label, x + boxPadding, y + boxPadding + 4);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        doc.setTextColor(0, 0, 0);
        let valY = y + boxPadding + 4 + lineHeight + 2;
        const tx =
          align === "right"
            ? x + colWidth - boxPadding
            : align === "center"
            ? x + colWidth / 2
            : x + boxPadding;
        valueLines.forEach((line) => {
          doc.text(line, tx, valY, { align });
          valY += lineHeight;
        });

        return boxHeight + boxGap;
      };

      let currentRowY = yPos;
      let maxRowHeight = 0;
      let colIndex = 0;

      detailsColumns.forEach((col) => {
        const x = margin + colIndex * (colWidth + boxGap);
        const displayVal = getDisplayValue(col, selectedContractDetails);
        const align = col.align === "right" ? "right" : col.align === "center" ? "center" : "left";
        const boxH = drawFieldBox(x, currentRowY, `${col.Header}:`, displayVal, align);

        maxRowHeight = Math.max(maxRowHeight, boxH);
        colIndex += 1;

        if (colIndex >= 3) {
          colIndex = 0;
          currentRowY += maxRowHeight;
          maxRowHeight = 0;

          if (currentRowY > pageHeight - 35) {
            doc.addPage();
            currentRowY = margin;
          }
        }
      });

      if (colIndex > 0) currentRowY += maxRowHeight;
      yPos = currentRowY + 4;

      if (contractDetailsRiseTerms.length > 0) {
        if (yPos + 40 > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Existing Rise Terms", margin, yPos);
        yPos += lineHeight + 6;

        const thHeight = 9;
        const tdHeight = 8;
        const seqWidth = 45;
        const monthsWidth = 50;
        const riseWidth = pageWidth - 2 * margin - seqWidth - monthsWidth;

        doc.setFillColor(245, 245, 245);
        doc.rect(margin, yPos, seqWidth, thHeight, "F");
        doc.rect(margin + seqWidth, yPos, monthsWidth, thHeight, "F");
        doc.rect(margin + seqWidth + monthsWidth, yPos, riseWidth, thHeight, "F");

        doc.setDrawColor(224, 224, 224);
        doc.setLineWidth(0.3);
        doc.rect(margin, yPos, seqWidth + monthsWidth + riseWidth, thHeight);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.text("Sequence No", margin + 4, yPos + 6);
        doc.text("Months Interval", margin + seqWidth + 4, yPos + 6);
        doc.text("Rise Percent (%)", margin + seqWidth + monthsWidth + riseWidth - 4, yPos + 6, {
          align: "right",
        });
        yPos += thHeight;

        doc.setFont("helvetica", "normal");
        doc.setFontSize(9);
        contractDetailsRiseTerms.forEach((term) => {
          if (yPos + tdHeight > pageHeight - 25) {
            doc.addPage();
            yPos = margin;
          }
          doc.setDrawColor(224, 224, 224);
          doc.setLineWidth(0.1);
          doc.rect(margin, yPos, seqWidth, tdHeight);
          doc.rect(margin + seqWidth, yPos, monthsWidth, tdHeight);
          doc.rect(margin + seqWidth + monthsWidth, yPos, riseWidth, tdHeight);

          doc.text(String(term.sequenceNo || ""), margin + 4, yPos + 5.5);
          doc.text(String(term.monthsInterval || ""), margin + seqWidth + 4, yPos + 5.5);
          doc.text(
            `${term.risePercent || ""}%`,
            margin + seqWidth + monthsWidth + riseWidth - 4,
            yPos + 5.5,
            { align: "right" }
          );
          yPos += tdHeight;
        });
      }
    }

    addWatermarks();
    const fileName = `Contract-Details-${contractNo.replace(/\s/g, "-")}.pdf`;
    if (viewOnly) {
      const blob = doc.output("blob");
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
      doc.save(fileName);
    }
  };

  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: totalCount,
        visible: visibleRowCount > 0 && visibleRowCount !== totalCount ? visibleRowCount : null,
      }),
    [totalCount, visibleRowCount]
  );

  const contractsContextFilters = (
    <MDBox className="contracts-workspace-context-bar">
      <MDBox width="9.5rem" sx={{ position: "relative", flexShrink: 0 }}>
        <input
          type="date"
          ref={asOfDateInputRef}
          value={asOfDate || ""}
          onChange={(e) => setAsOfDate(e.target.value)}
          tabIndex={-1}
          style={{
            position: "absolute",
            opacity: 0,
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
        <MDInput
          placeholder="As of Date"
          value={toDisplayDate(asOfDate)}
          onClick={() => openDatePicker(asOfDateInputRef)}
          size="small"
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <Icon
                  sx={{ cursor: "pointer", fontSize: "1rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openDatePicker(asOfDateInputRef);
                  }}
                >
                  calendar_today
                </Icon>
              </InputAdornment>
            ),
          }}
          fullWidth
          sx={{
            "& .MuiInputBase-root": { minHeight: 32, maxHeight: 32, fontSize: "0.8125rem" },
          }}
        />
      </MDBox>
      <IconButton
        size="small"
        color="info"
        title="Refresh as-of values"
        onClick={() => {
          setAsOfRefreshing(true);
          setAsOfRefreshToken((t) => t + 1);
        }}
        sx={{ flexShrink: 0 }}
      >
        <Icon fontSize="small">send</Icon>
      </IconButton>
      <ToggleButtonGroup
        exclusive
        value={contractsArchiveFilter}
        onChange={(_, v) => {
          if (v !== null) setContractsArchiveFilter(v);
        }}
        size="small"
        color="info"
        aria-label="Filter contracts table by archive status"
        className="contracts-context-segmented contracts-context-toggle"
      >
        <ToggleButton value="all">ALL</ToggleButton>
        <ToggleButton value="valid">VALID</ToggleButton>
        <ToggleButton value="archive">ARCHIVE</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup
        exclusive
        value={contractsApprovalFilter}
        onChange={(_, v) => {
          setContractsApprovalFilter(v ?? "all");
        }}
        size="small"
        color="info"
        aria-label="Filter contracts table by approval status"
        className="contracts-context-segmented contracts-context-toggle"
      >
        <ToggleButton value="approved">APPROVED</ToggleButton>
        <ToggleButton value="pending">PENDING</ToggleButton>
      </ToggleButtonGroup>
    </MDBox>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Contracts"
        subtitle="Manage contract records and agreements"
        tabs={<ContractsModuleTabs />}
        metadata={workspaceMetadata}
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          flex: "1 1 0",
          minHeight: 0,
          "& > .contracts-workspace-context-bar": {
            flexShrink: 0,
          },
          "& > .saas-settings-table": {
            flex: "1 1 0",
            minHeight: 0,
            height: "100%",
            alignSelf: "stretch",
          },
          "& .saas-settings-table-scroll": {
            flex: "1 1 0",
            minHeight: 0,
          },
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          },
          "& .MuiTable-root": {
            tableLayout: "auto",
            width: "max-content",
            minWidth: CONTRACT_GRID_TABLE_WIDTH,
            borderCollapse: "collapse",
          },
          "& .MuiTable-root th": {
            fontSize: "0.875rem !important",
            fontWeight: "700 !important",
            width: "auto !important",
            minWidth: "0 !important",
            padding: "8px 6px !important",
            borderBottom: "1px solid #d0d0d0",
            whiteSpace: "nowrap",
          },
          "& .MuiTable-root td": {
            width: "auto !important",
            minWidth: "0 !important",
            padding: "6px 6px !important",
            borderBottom: "1px solid #e0e0e0",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
            verticalAlign: "top",
          },
          "& table td > div": {
            maxWidth: "none !important",
          },
          "& .MuiTable-root th:nth-of-type(1), & .MuiTable-root td:nth-of-type(1)": {
            minWidth: "max-content",
            paddingLeft: "4px !important",
            paddingRight: "4px !important",
          },
          "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2)": {
            minWidth: "max-content",
            paddingLeft: "4px !important",
            paddingRight: "4px !important",
          },
        }}
      >
        {contractsContextFilters}

        {(loading || asOfRefreshing) && (
          <MDBox
            position="absolute"
            top={0}
            left={0}
            right={0}
            bottom={0}
            display="flex"
            justifyContent="center"
            alignItems="center"
            zIndex={10}
            sx={{
              backgroundColor: "rgba(255, 255, 255, 0.8)",
              backdropFilter: "blur(2px)",
            }}
          >
            <CurrencyLoading size={50} />
          </MDBox>
        )}

        <DataTable
          table={{
            columns: contractGridColumns,
            rows: computedRows,
          }}
          isSorted={false}
          stickyToolbarAndHeader
          entriesPerPage={{
            defaultValue: GRID_DISPLAY_DEFAULT_PAGE_SIZE,
            entries: [10, 25, 50, 100],
          }}
          contentFitTable
          pageSize={gridPageSize}
          onEntriesPerPageChange={(n) => {
            setGridPageSize(Number(n));
          }}
          showTotalEntries={false}
          pagination={{ variant: "gradient", color: "info" }}
          noEndBorder
          canSearch
          exportFileName="Contracts"
          exportCellFormatter={contractsExportCellFormatter}
          exportExcludeGroupParentsWhenExpanded
          exportAllColumns
          extraFilterTypes={CONTRACTS_DATATABLE_EXTRA_FILTER_TYPES}
          initialHiddenColumns={CONTRACTS_GRID_INITIAL_HIDDEN_COLUMNS}
          onVisibleRowCountChange={setVisibleRowCount}
          toolbarStartInHeader
          toolbarStart={
            <>
              <CompactGroupBySelect
                options={groupingColumnOptions}
                value={groupByColumns}
                onChange={setGroupByColumns}
              />
              <CompactMultiSelectFilter
                label="RAC"
                options={[ALL_FILTER_VALUE, ...gridFilterOptions.commands]}
                allValue={ALL_FILTER_VALUE}
                value={commandFilterIds}
                onChange={setCommandFilterIds}
              />
              <CompactMultiSelectFilter
                label="Base"
                options={[ALL_FILTER_VALUE, ...gridFilterOptions.bases]}
                allValue={ALL_FILTER_VALUE}
                value={baseFilterIds}
                onChange={setBaseFilterIds}
              />
              <CompactMultiSelectFilter
                label="Class"
                options={[ALL_FILTER_VALUE, ...gridFilterOptions.classes]}
                allValue={ALL_FILTER_VALUE}
                value={classFilterIds}
                onChange={setClassFilterIds}
              />
            </>
          }
        />
      </EnterpriseWorkspace>
      <ContractsForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentContract}
        isClone={isCloneMode}
        commands={commands}
        bases={bases}
        classes={classes}
        propertyGroups={propertyGroups}
        tenants={tenants}
        natures={natures}
        onPropertyGroupsRefresh={fetchPropertyGroups}
      />
      <Dialog
        open={attachmentDialogOpen}
        onClose={handleCloseAttachmentDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Attachments</DialogTitle>
        <DialogContent>
          {attachmentLoading ? (
            <MDBox display="flex" justifyContent="center" py={3}>
              <CurrencyLoading size={40} />
            </MDBox>
          ) : (
            <>
              {attachmentList.length === 0 ? (
                <MDTypography variant="body2" color="text">
                  No attachments uploaded for this contract.
                </MDTypography>
              ) : (
                <List disablePadding>
                  {attachmentList.map((file, index) => (
                    <MDBox key={file.id || file.fileName || index}>
                      <ListItem
                        disableGutters
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          px: 0,
                        }}
                      >
                        <ListItemText
                          primary={file.fileName || file.name || `Attachment ${index + 1}`}
                        />
                        <MDBox display="flex" gap={1} alignItems="center">
                          <MDButton
                            size="small"
                            variant="outlined"
                            color="info"
                            onClick={() => handleDownloadAttachment(file)}
                            disabled={!file.downloadUrl}
                          >
                            <Icon>download</Icon>&nbsp;Download
                          </MDButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteAttachment(file)}
                            disabled={!canEditCurrentMenu() && !canDeleteCurrentMenu()}
                            sx={{ ml: 1 }}
                          >
                            <Icon>delete</Icon>
                          </IconButton>
                        </MDBox>
                      </ListItem>
                      {index < attachmentList.length - 1 && <Divider />}
                    </MDBox>
                  ))}
                </List>
              )}

              {(currentViewingRecord?.id || currentViewingRecord?.Id) && (
                <MDBox
                  mt={3}
                  p={2}
                  sx={{
                    border: "1px dashed",
                    borderColor: "#b0b0b0",
                    borderRadius: 2,
                    bgcolor: "background.paper",
                  }}
                >
                  <MDTypography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
                    Upload Attachments (Max {CONTRACT_ATTACH_MAX} total — PDF, Excel, or Word)
                  </MDTypography>

                  <input
                    accept=".pdf,.xlsx,.xls,.doc,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    style={{ display: "none" }}
                    id="contract-file-upload"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={
                      attachmentList.length + selectedFiles.length >= CONTRACT_ATTACH_MAX ||
                      isUploading
                    }
                  />
                  <label htmlFor="contract-file-upload">
                    <MDButton
                      variant="gradient"
                      color="info"
                      component="span"
                      disabled={
                        attachmentList.length + selectedFiles.length >= CONTRACT_ATTACH_MAX ||
                        isUploading
                      }
                      sx={{
                        mb: 2,
                        fontSize: "1rem",
                        fontWeight: 600,
                        px: 3,
                        "& .MuiSvgIcon-root": { fontSize: "1.4rem", mr: 1 },
                      }}
                    >
                      <Icon>cloud_upload</Icon>
                      Select Files ({attachmentList.length + selectedFiles.length}/
                      {CONTRACT_ATTACH_MAX})
                    </MDButton>
                  </label>

                  {attachmentList.length + selectedFiles.length < CONTRACT_ATTACH_MAX && (
                    <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                      You can upload{" "}
                      {CONTRACT_ATTACH_MAX - (attachmentList.length + selectedFiles.length)} more
                      file(s).
                    </MDTypography>
                  )}

                  {selectedFiles.length > 0 && (
                    <MDBox mt={1} display="flex" flexWrap="wrap" gap={1}>
                      {selectedFiles.map((file, index) => (
                        <Chip
                          key={index}
                          label={`${file.name} (${formatFileSize(file.size)})`}
                          onDelete={() => handleRemoveFile(index)}
                          deleteIcon={<Icon>cancel</Icon>}
                          sx={{ fontSize: "0.95rem" }}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </MDBox>
                  )}

                  <MDBox mt={2} display="flex" justifyContent="flex-end">
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={handleUploadSelected}
                      disabled={selectedFiles.length === 0 || isUploading}
                    >
                      <Icon>upload</Icon>&nbsp;{isUploading ? "Uploading..." : "Upload Selected"}
                    </MDButton>
                  </MDBox>
                </MDBox>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseAttachmentDialog}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1">
            Are you sure you want to delete this contract? This action cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary">
            Cancel
          </MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={invoiceFinalizeOpen}
        onClose={handleCloseInvoiceFinalizeDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <MDTypography variant="h5" fontWeight="bold">
            Agreement provisional invoices
          </MDTypography>
        </DialogTitle>
        <DialogContent dividers sx={{ position: "relative", minHeight: 280 }}>
          {invoiceFinalizeContractRow && (
            <MDBox mb={1.5}>
              <AgreementProvContractBasicInfoStrip
                form={buildAgreementProvContractBasicInfoForm(invoiceFinalizeContractRow)}
              />
            </MDBox>
          )}
          {invoiceFinalizeBusy && (
            <MDBox
              sx={{
                position: "absolute",
                inset: 0,
                zIndex: 2,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                bgcolor: "rgba(255,255,255,0.75)",
              }}
            >
              <CurrencyLoading size={56} />
            </MDBox>
          )}
          {invoiceScheduleLoading ? (
            <MDBox display="flex" justifyContent="center" py={6}>
              <CurrencyLoading size={48} />
            </MDBox>
          ) : (
            <MDBox>
              <MDBox
                mb={1.5}
                display="flex"
                alignItems="center"
                flexWrap="wrap"
                gap={1}
                sx={{ width: "100%" }}
              >
                <ToggleButtonGroup
                  exclusive
                  size="small"
                  value={invoiceFinalizeTab}
                  onChange={(_, value) => {
                    if (value) {
                      setInvoiceFinalizeTab(value);
                      setInvoiceFinalizeSelectedKeys(new Set());
                      setAgreementProvCreateDialogOpen(false);
                      setAgreementProvCreateRowData(null);
                      setAgreementProvEditDialogOpen(false);
                      setAgreementProvEditRowData(null);
                    }
                  }}
                  disabled={invoiceFinalizeBusy}
                >
                  <ToggleButton value="pending">
                    Pending ({invoiceFinalizePendingRows.length})
                  </ToggleButton>
                  <ToggleButton value="finalized">
                    Finalized ({invoiceFinalizeFinalizedRows.length})
                  </ToggleButton>
                </ToggleButtonGroup>
                {invoiceFinalizeTab === "pending" && (
                  <MDButton
                    variant="outlined"
                    color="info"
                    size="small"
                    onClick={handleAddNewInvoiceDraft}
                    disabled={
                      invoiceFinalizeBusy || invoiceScheduleLoading || agreementProvCreateDialogOpen
                    }
                    sx={{ flexShrink: 0 }}
                  >
                    <Icon sx={{ mr: 0.5 }}>add</Icon>
                    Add new invoice
                  </MDButton>
                )}
                <MDBox sx={{ flex: "1 1 200px", minWidth: 180 }}>
                  <MDInput
                    placeholder="Search invoices..."
                    value={invoiceFinalizeSearch}
                    onChange={(e) => setInvoiceFinalizeSearch(e.target.value)}
                    fullWidth
                    size="small"
                    disabled={invoiceFinalizeBusy}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <Icon sx={{ fontSize: "1.1rem", opacity: 0.6 }}>search</Icon>
                        </InputAdornment>
                      ),
                    }}
                  />
                </MDBox>
              </MDBox>
              {invoiceFinalizeTab === "pending" ? (
                <>
                  {invoiceFinalizePendingRows.length === 0 ? (
                    <MDTypography variant="body2" color="text">
                      No pending invoice rows. Add a new invoice or view the Finalized tab.
                    </MDTypography>
                  ) : (
                    <ContractInvoiceFinalizeGrid
                      rows={invoiceFinalizePendingRows}
                      selectedKeys={invoiceFinalizeSelectedKeys}
                      onSelectedKeysChange={setInvoiceFinalizeSelectedKeys}
                      busy={invoiceFinalizeBusy}
                      formatDate={formatDateDDMMMYYYY}
                      allowedSelectionKeys={invoiceFinalizeAllowedPendingKeys}
                      blurNonSelectableRows
                      hideSearchInput
                      searchValue={invoiceFinalizeSearch}
                      onSearchChange={setInvoiceFinalizeSearch}
                    />
                  )}
                </>
              ) : invoiceFinalizeFinalizedRows.length === 0 ? (
                <MDTypography variant="body2" color="text">
                  No finalized invoice rows yet.
                </MDTypography>
              ) : (
                <ContractInvoiceFinalizeGrid
                  rows={invoiceFinalizeFinalizedRows}
                  selectedKeys={invoiceFinalizeSelectedKeys}
                  onSelectedKeysChange={setInvoiceFinalizeSelectedKeys}
                  busy={
                    invoiceFinalizeBusy ||
                    agreementProvCreateDialogOpen ||
                    agreementProvEditDialogOpen
                  }
                  formatDate={formatDateDDMMMYYYY}
                  undoSelectable
                  showDuplicateAction
                  onDuplicateRow={handleDuplicateFinalizedInvoice}
                  clickableInvoiceNo
                  onInvoiceNoClick={handleOpenAgreementProvEditFromFinalizeRow}
                  hideSearchInput
                  searchValue={invoiceFinalizeSearch}
                  onSearchChange={setInvoiceFinalizeSearch}
                />
              )}
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseInvoiceFinalizeDialog}>
            Close
          </MDButton>
          {invoiceFinalizeTab === "pending" && (
            <MDButton
              variant="gradient"
              color="info"
              onClick={handleFinalizeSelectedInvoices}
              disabled={
                invoiceFinalizeBusy ||
                invoiceScheduleLoading ||
                invoiceFinalizeSelectedKeys.size === 0
              }
            >
              Finalize
            </MDButton>
          )}
          {invoiceFinalizeTab === "finalized" && (
            <MDButton
              variant="gradient"
              color="warning"
              onClick={handleUndoFinalizedInvoices}
              disabled={
                invoiceFinalizeBusy ||
                invoiceScheduleLoading ||
                invoiceFinalizeSelectedKeys.size === 0
              }
            >
              Undo
            </MDButton>
          )}
        </DialogActions>
      </Dialog>

      <AgreementProvInvoiceEditDialog
        open={agreementProvCreateDialogOpen}
        onClose={handleCloseAgreementProvCreateDialog}
        rowData={agreementProvCreateRowData}
        onSave={handleSaveAgreementProvCreateInvoice}
        saving={invoiceFinalizeBusy}
        createMode
      />

      <AgreementProvInvoiceEditDialog
        open={agreementProvEditDialogOpen}
        onClose={handleCloseAgreementProvEditDialog}
        rowData={agreementProvEditRowData}
        onSave={handleSaveAgreementProvEditInvoice}
        saving={agreementProvEditSaving}
      />

      {/* Contract Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <MDBox display="flex" justifyContent="space-between" alignItems="center">
            <MDBox>
              <MDTypography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
                Contract Details
              </MDTypography>
              {selectedContractDetails && (
                <MDTypography variant="body2" color="text" fontWeight="medium">
                  Contract No:{" "}
                  {selectedContractDetails.ContractNo || selectedContractDetails.contractNo || "-"}
                </MDTypography>
              )}
            </MDBox>
            <IconButton onClick={() => setDetailsDialogOpen(false)} size="small">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        </DialogTitle>
        <DialogContent dividers sx={{ maxHeight: "70vh", overflowY: "auto" }}>
          {selectedContractDetails && (
            <MDBox>
              <Grid container spacing={2} sx={{ mt: 1 }}>
                {allColumns
                  .filter(
                    (col) =>
                      col.accessor !== "actions" &&
                      col.accessor !== "attachments" &&
                      col.accessor !== "contractAttachments"
                  )
                  .map((col) => {
                    const accessor = col.accessor;
                    const accessorKey = typeof accessor === "string" ? accessor : null;
                    // Access value from both camelCase and PascalCase
                    const rowData = selectedContractDetails;
                    let value = accessorKey ? rowData[accessorKey] : undefined;

                    // If not found in camelCase, try PascalCase
                    if ((value === undefined || value === null) && accessorKey) {
                      const pascalAccessor =
                        accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1);
                      value = rowData[pascalAccessor];
                    }

                    // Also try accessing from original if available
                    if (
                      (value === undefined || value === null) &&
                      rowData.original &&
                      accessorKey
                    ) {
                      value = rowData.original[accessorKey];
                      if (value === undefined || value === null) {
                        value =
                          rowData.original[
                            accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)
                          ];
                      }
                    }

                    // Special handling for Rate field - use GroupRate
                    if (accessor === "groupRate" || accessor === "totalRate") {
                      value =
                        rowData.GroupRate ||
                        rowData.groupRate ||
                        rowData.TotalRate ||
                        rowData.totalRate ||
                        value;
                    }
                    if (accessor === "paymentTermMonths") {
                      value = value ?? rowData.PaymentTermMonths ?? rowData.paymentTermMonths;
                    }
                    if (accessor === "sdRateMonths") {
                      value =
                        value ??
                        rowData.SDRateMonths ??
                        rowData.SdRateMonths ??
                        rowData.sdRateMonths;
                    }

                    // Get the cell value using the column's Cell function if available
                    let displayValue = value;
                    if (col.Cell) {
                      try {
                        const cellProps = { value, row: { original: rowData.original || rowData } };
                        displayValue = col.Cell(cellProps);
                      } catch (e) {
                        displayValue = value || "-";
                      }
                    } else {
                      // Format based on type
                      if (typeof value === "number") {
                        displayValue = value.toLocaleString();
                      } else if (value === null || value === undefined || value === "") {
                        displayValue = "-";
                      } else {
                        displayValue = String(value);
                      }
                    }

                    return (
                      <Grid item xs={12} sm={6} md={4} key={accessor}>
                        <MDBox
                          sx={{
                            p: 1.5,
                            borderRadius: 1,
                            backgroundColor: "rgba(0, 0, 0, 0.02)",
                            border: "1px solid rgba(0, 0, 0, 0.05)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                              backgroundColor: "rgba(0, 0, 0, 0.04)",
                              borderColor: "rgba(0, 0, 0, 0.1)",
                            },
                          }}
                        >
                          <MDTypography
                            variant="caption"
                            color="text"
                            fontWeight="bold"
                            sx={{ display: "block", mb: 0.5 }}
                          >
                            {col.Header}:
                          </MDTypography>
                          <MDTypography variant="body2" fontWeight="regular" color="text">
                            {displayValue}
                          </MDTypography>
                        </MDBox>
                      </Grid>
                    );
                  })}
              </Grid>

              {/* Rise Terms Section */}
              {loadingContractDetailsRiseTerms ? (
                <MDBox display="flex" justifyContent="center" py={3} mt={3}>
                  <CurrencyLoading size={40} />
                </MDBox>
              ) : contractDetailsRiseTerms.length > 0 ? (
                <MDBox mt={4}>
                  <MDTypography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                    Existing Rise Terms
                  </MDTypography>
                  <Card
                    sx={{
                      boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                      borderRadius: 2,
                    }}
                  >
                    <MDBox p={2}>
                      <TableContainer
                        sx={{
                          maxHeight: "400px",
                          overflowY: "auto",
                          // Firefox
                          scrollbarWidth: "thin",
                          scrollbarColor: "#888 transparent",
                          // Chrome/Safari/Edge
                          "&::-webkit-scrollbar": {
                            width: "8px",
                            height: "8px",
                          },
                          "&::-webkit-scrollbar-track": {
                            background: "transparent",
                            borderRadius: "4px",
                          },
                          "&::-webkit-scrollbar-thumb": {
                            backgroundColor: "#888",
                            borderRadius: "4px",
                            border: "2px solid transparent",
                            backgroundClip: "padding-box",
                            "&:hover": {
                              backgroundColor: "#555",
                            },
                          },
                        }}
                      >
                        <Table size="small" sx={{ borderCollapse: "collapse" }}>
                          <thead
                            style={{
                              position: "sticky",
                              top: 0,
                              zIndex: 1,
                              backgroundColor: "#f5f5f5",
                            }}
                          >
                            <TableRow>
                              <TableCell
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  borderBottom: "2px solid #e0e0e0",
                                  backgroundColor: "#f5f5f5",
                                  padding: "12px 16px 12px 16px",
                                  paddingRight: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Sequence No
                              </TableCell>
                              <TableCell
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  borderBottom: "2px solid #e0e0e0",
                                  backgroundColor: "#f5f5f5",
                                  padding: "12px 16px 12px 4px",
                                  paddingLeft: "4px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Months Interval
                              </TableCell>
                              <TableCell
                                align="right"
                                sx={{
                                  fontWeight: 600,
                                  fontSize: "0.875rem",
                                  borderBottom: "2px solid #e0e0e0",
                                  backgroundColor: "#f5f5f5",
                                  padding: "12px 16px",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Rise Percent (%)
                              </TableCell>
                            </TableRow>
                          </thead>
                          <TableBody>
                            {contractDetailsRiseTerms.map((term, index) => (
                              <TableRow
                                key={term.id || index}
                                sx={{
                                  "&:hover": { backgroundColor: "rgba(0, 0, 0, 0.02)" },
                                  "&:last-child td": {
                                    borderBottom: "none",
                                  },
                                }}
                              >
                                <TableCell
                                  sx={{
                                    fontSize: "0.875rem",
                                    borderBottom: "1px solid #e0e0e0",
                                    padding: "8px 16px 8px 16px",
                                    paddingRight: "4px",
                                  }}
                                >
                                  <MDTypography variant="body2" fontWeight="medium">
                                    {term.sequenceNo}
                                  </MDTypography>
                                </TableCell>
                                <TableCell
                                  sx={{
                                    fontSize: "0.875rem",
                                    borderBottom: "1px solid #e0e0e0",
                                    padding: "8px 16px 8px 4px",
                                    paddingLeft: "4px",
                                  }}
                                >
                                  <MDTypography variant="body2">{term.monthsInterval}</MDTypography>
                                </TableCell>
                                <TableCell
                                  align="right"
                                  sx={{
                                    fontSize: "0.875rem",
                                    borderBottom: "1px solid #e0e0e0",
                                    padding: "8px 16px",
                                  }}
                                >
                                  <MDTypography variant="body2" fontWeight="bold" color="primary">
                                    {term.risePercent}%
                                  </MDTypography>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    </MDBox>
                  </Card>
                </MDBox>
              ) : null}
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton
            onClick={() => generateContractDetailsPDF(true)}
            color="info"
            variant="gradient"
            disabled={!selectedContractDetails}
          >
            <Icon>picture_as_pdf</Icon>&nbsp;View as PDF
          </MDButton>
          <MDButton
            onClick={handleCloneContractFromDetails}
            color="success"
            variant="gradient"
            disabled={!selectedContractDetails || !canCreateCurrentMenu()}
          >
            <Icon>content_copy</Icon>&nbsp;Clone Contract
          </MDButton>
          <MDButton onClick={() => setDetailsDialogOpen(false)} color="secondary">
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
