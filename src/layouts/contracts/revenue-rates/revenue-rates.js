import React, { useState, useEffect, useMemo, useRef } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import MDSnackbar from "components/MDSnackbar";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  getLoggedInUsername,
} from "services/api.service";
import uploadApi from "services/api.upload.service";
import revenueRatesApi from "services/api.revenuerates.service";
import CurrencyLoading from "components/CurrencyLoading";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import PropTypes from "prop-types";
import StatusBadge from "components/StatusBadge";
import { format, parseISO, isValid } from "date-fns";

const REVENUE_RATES_GRID_DATE_FALLBACK_KEYS = {
  applicableDate: ["applicableDate", "ApplicableDate", "applicationDate", "ApplicationDate"],
};

function parseRevenueRatesGridDateYyyyMmDd(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = REVENUE_RATES_GRID_DATE_FALLBACK_KEYS[columnId] || [];
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

function revenueRatesGridDateCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowD = parseRevenueRatesGridDateYyyyMmDd(row, columnId);
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

function RevenueRatesDateColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Date";
  const modeLabelId = `revenue-rates-date-filter-mode-${column.id || "col"}`;

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

RevenueRatesDateColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const REVENUE_RATES_GRID_MONEY_FALLBACK_KEYS = {
  rate: ["rate", "Rate"],
};

function normalizeRevenueRatesMoneyRawToNumber(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

function parseRevenueRatesGridRowMoneyNumber(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = REVENUE_RATES_GRID_MONEY_FALLBACK_KEYS[columnId] || [];
  const isMissing = (v) =>
    v === undefined || v === null || (typeof v === "string" && v.trim() === "") || v === "";
  if (isMissing(raw) && o && fallbacks.length) {
    for (let i = 0; i < fallbacks.length; i += 1) {
      const v = o[fallbacks[i]];
      if (!isMissing(v)) {
        raw = v;
        break;
      }
    }
  }
  return normalizeRevenueRatesMoneyRawToNumber(raw);
}

function revenueRatesMoneyApproxEqual(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= 1e-6 * scale;
}

function revenueRatesGridMoneyCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowN = parseRevenueRatesGridRowMoneyNumber(row, columnId);
    if (rowN === null) return false;
    const { mode } = filterValue;
    if (mode === "gt") {
      const ref = normalizeRevenueRatesMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rowN > ref;
    }
    if (mode === "lte") {
      const ref = normalizeRevenueRatesMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rowN <= ref;
    }
    if (mode === "eq") {
      const ref = normalizeRevenueRatesMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return revenueRatesMoneyApproxEqual(rowN, ref);
    }
    if (mode === "between") {
      const a = normalizeRevenueRatesMoneyRawToNumber(filterValue.valueFrom);
      const b = normalizeRevenueRatesMoneyRawToNumber(filterValue.valueTo);
      if (a === null || b === null) return false;
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      return rowN >= low && rowN <= high;
    }
    return true;
  });
}

function RevenueRatesMoneyColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Amount";
  const modeLabelId = `revenue-rates-money-filter-mode-${column.id || "col"}`;

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

RevenueRatesMoneyColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const REVENUE_RATES_DATATABLE_DATE_FILTER_TYPES = Object.freeze({
  revenueRatesDateCompare: revenueRatesGridDateCompare,
  revenueRatesMoneyCompare: revenueRatesGridMoneyCompare,
});

function RevenueRatesForm({
  open,
  onClose,
  onSubmit,
  initialData,
  rentalProperties,
  commandOptions,
  baseOptions,
  onUploadSuccess,
}) {
  const [form, setForm] = useState({
    cmdId: "",
    baseId: "",
    propertyId: "",
    applicableDate: "",
    deactiveDate: "",
    rate: "",
    attachments: "",
    status: true,
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);
  const isEditMode = Boolean(initialData && (initialData.id || initialData.Id));

  const getSaveErrorMessage = (error) => {
    if (error?.response?.status === 400) {
      const responseData = error.response?.data;
      if (typeof responseData === "string" && responseData.trim()) {
        return responseData;
      }
      if (typeof responseData?.message === "string" && responseData.message.trim()) {
        return responseData.message;
      }
      if (typeof responseData?.title === "string" && responseData.title.trim()) {
        return responseData.title;
      }
      try {
        const serialized = JSON.stringify(responseData);
        if (serialized && serialized !== "{}") {
          return serialized;
        }
      } catch (serializationError) {
        console.error("Error serializing revenue rate API response:", serializationError);
      }
    }

    const rawMessage = String(error?.message || "").trim();
    if (rawMessage) {
      const http400PrefixMatch = rawMessage.match(/^HTTP\s+400\s+Bad\s+Request:\s*(.*)$/i);
      if (http400PrefixMatch?.[1]?.trim()) {
        return http400PrefixMatch[1].trim();
      }

      if (/^HTTP\s+400\b/i.test(rawMessage)) {
        return rawMessage;
      }
    }

    return "Failed to save revenue rate. Please try again.";
  };

  const applicableDateInputRef = useRef(null);
  const deactiveDateInputRef = useRef(null);

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
    if (ref?.current) {
      if (ref.current.showPicker) ref.current.showPicker();
      else ref.current.click();
    }
  };

  useEffect(() => {
    if (initialData) {
      const propId = initialData.propertyId ?? initialData.PropertyId ?? null;
      const isPropertyDash =
        propId === 0 || propId === null || propId === undefined || propId === "";
      const selectedProp = (rentalProperties || []).find(
        (p) => Number(p.id) === Number(initialData.propertyId)
      );
      const resolvedCmdId =
        initialData.cmdId ?? initialData.cmdid ?? selectedProp?.cmdId ?? selectedProp?.cmdid ?? "";
      const resolvedBaseId =
        initialData.baseId ??
        initialData.baseid ??
        selectedProp?.baseId ??
        selectedProp?.baseid ??
        "";
      const cmdIdValue = isPropertyDash ? 0 : resolvedCmdId ? Number(resolvedCmdId) : "";
      const baseIdValue = isPropertyDash ? 0 : resolvedBaseId ? Number(resolvedBaseId) : "";
      const propertyIdValue = isPropertyDash ? 0 : initialData.propertyId || "";

      const rawDeactive = initialData.deactiveDate ?? initialData.DeactiveDate ?? "";
      const deactiveDateValue =
        rawDeactive && String(rawDeactive).trim()
          ? String(rawDeactive).split("T")[0].slice(0, 10)
          : "";
      setForm({
        cmdId: cmdIdValue,
        baseId: baseIdValue,
        propertyId: propertyIdValue,
        applicableDate: initialData.applicableDate || "",
        deactiveDate: deactiveDateValue,
        rate: initialData.rate || "",
        attachments: initialData.attachments || "",
        status: initialData.status !== undefined ? initialData.status : true,
      });
      // Reset new files when editing
      setSelectedFiles([]);
      // Fetch existing uploaded files
      if (initialData.id) {
        fetchExistingFiles(initialData.id);
      } else {
        setExistingFiles([]);
      }
    } else {
      setForm({
        cmdId: "",
        baseId: "",
        propertyId: "",
        applicableDate: "",
        deactiveDate: "",
        rate: "",
        attachments: "",
        status: true,
      });
      setSelectedFiles([]);
      setExistingFiles([]);
    }
  }, [initialData, open, rentalProperties]);

  const fetchExistingFiles = async (id) => {
    setLoadingExistingFiles(true);
    try {
      const response = await uploadApi.getUploadedFiles(id, "RevenueRates");
      // Handle response format: { files: [...] } or direct array
      const filesArray = response?.files || (Array.isArray(response) ? response : []);

      // Normalize the response to ensure we have fileName and downloadUrl
      const normalized = filesArray.map((f) => {
        // Handle different response formats
        if (typeof f === "string") {
          return {
            fileName: f.split(/[\\/]/).pop(),
            downloadUrl: f,
          };
        }
        // Extract fileName and downloadUrl from various possible field names
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
        return {
          ...f,
          fileName,
          downloadUrl,
        };
      });

      setExistingFiles(normalized);
    } catch (error) {
      console.error("Error fetching existing files:", error);
      setExistingFiles([]);
    } finally {
      setLoadingExistingFiles(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: field === "rate" ? (value ? Number(value) : "") : value,
      };

      if (field === "cmdId") {
        const cmdIsAll = value === 0 || value === "0";
        next.baseId = cmdIsAll ? 0 : "";
        next.propertyId = cmdIsAll ? 0 : "";
      } else if (field === "baseId") {
        next.propertyId = value === 0 || value === "0" ? 0 : "";
      } else if (field === "applicableDate") {
        if (next.deactiveDate && value) {
          const appTs = new Date(value).getTime();
          const deactTs = new Date(next.deactiveDate).getTime();
          if (deactTs <= appTs) next.deactiveDate = "";
        }
      }

      return next;
    });
  };

  const getOptionLabel = (opt) =>
    String(
      opt?.name ??
        opt?.value ??
        opt?.label ??
        opt?.Name ??
        opt?.Value ??
        opt?.Label ??
        opt?.id ??
        ""
    );

  const isBothAll =
    (form.cmdId === 0 || form.cmdId === "0") && (form.baseId === 0 || form.baseId === "0");
  const isBaseAll = form.baseId === 0 || form.baseId === "0";

  useEffect(() => {
    if (isBothAll && form.propertyId !== 0 && form.propertyId !== "0") {
      setForm((prev) => ({ ...prev, propertyId: 0 }));
    }
  }, [isBothAll, form.propertyId]);

  useEffect(() => {
    if (isBaseAll && form.propertyId !== 0 && form.propertyId !== "0") {
      setForm((prev) => ({ ...prev, propertyId: 0 }));
    }
  }, [isBaseAll, form.propertyId]);

  const filteredBaseOptions = useMemo(() => {
    if (form.cmdId === 0 || form.cmdId === "0") return baseOptions || [];
    const numCmdId = Number(form.cmdId || 0);
    if (!numCmdId) return [];
    return (baseOptions || []).filter((b) => Number(b?.cmdId) === numCmdId);
  }, [baseOptions, form.cmdId]);

  const racAutocompleteOptions = useMemo(
    () => [{ id: 0, name: "All" }, ...(commandOptions || [])],
    [commandOptions]
  );

  const baseAutocompleteOptions = useMemo(
    () => [{ id: 0, name: "All" }, ...filteredBaseOptions],
    [filteredBaseOptions]
  );

  const racAutocompleteValue = useMemo(() => {
    const v = form.cmdId;
    if (v === "" || v == null) return null;
    return racAutocompleteOptions.find((o) => Number(o.id) === Number(v)) ?? null;
  }, [form.cmdId, racAutocompleteOptions]);

  const baseAutocompleteValue = useMemo(() => {
    const v = form.baseId;
    if (v === "" || v == null) return null;
    return baseAutocompleteOptions.find((o) => Number(o.id) === Number(v)) ?? null;
  }, [form.baseId, baseAutocompleteOptions]);

  const filteredRentalProperties = useMemo(() => {
    const isCmdAll = form.cmdId === 0 || form.cmdId === "0";
    const isBaseAll = form.baseId === 0 || form.baseId === "0";
    const numCmdId = Number(form.cmdId || 0);
    const numBaseId = Number(form.baseId || 0);
    return (rentalProperties || []).filter((p) => {
      const cmdId = Number(p?.cmdId ?? p?.cmdid ?? p?.commandId ?? 0);
      const baseId = Number(p?.baseId ?? p?.baseid ?? 0);
      if (!isCmdAll && numCmdId && cmdId !== numCmdId) return false;
      if (!isBaseAll && numBaseId && baseId !== numBaseId) return false;
      return true;
    });
  }, [rentalProperties, form.cmdId, form.baseId]);

  const selectedProperty = useMemo(() => {
    const propId = form.propertyId ?? "";
    if (propId === 0 || propId === "0" || propId === "") return null;
    return (rentalProperties || []).find((p) => Number(p.id) === Number(propId)) ?? null;
  }, [rentalProperties, form.propertyId]);

  const selectedArea = selectedProperty?.area ?? selectedProperty?.Area ?? "";
  const selectedUoM = selectedProperty?.uoM ?? selectedProperty?.UoM ?? "";

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const totalExistingFiles = existingFiles.length;
    const totalSelectedFiles = selectedFiles.length;
    const totalFiles = totalExistingFiles + totalSelectedFiles;
    const remainingSlots = 5 - totalFiles;

    if (totalFiles >= 5) {
      alert(
        "Maximum 5 files allowed. Please delete some existing files before uploading new ones."
      );
      event.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      alert(
        `You can only upload ${remainingSlots} more file(s). Maximum 5 files allowed (${totalExistingFiles} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    // Validate file sizes (optional: limit to 10MB per file for memory efficiency)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });

    // Check again after filtering valid files
    if (totalFiles + validFiles.length > 5) {
      const allowedCount = 5 - totalFiles;
      alert(
        `You can only upload ${allowedCount} more file(s). Maximum 5 files allowed (${totalExistingFiles} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    // Reset input
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSave = async () => {
    const applicableDate = String(form.applicableDate ?? "").trim();
    if (!applicableDate) {
      alert("Applicable Date is required.");
      return;
    }
    const deactiveDate = String(form.deactiveDate ?? "").trim();
    if (applicableDate && deactiveDate) {
      const appDate = new Date(applicableDate);
      const deactDate = new Date(deactiveDate);
      if (deactDate.getTime() <= appDate.getTime()) {
        alert("Deactive Date must be greater than Applicable Date.");
        return;
      }
    }
    try {
      // First save the form data
      await onSubmit(form);
    } catch (error) {
      console.error("Error saving revenue rate:", error);
      alert(getSaveErrorMessage(error));
      return;
    }

    // If editing and files are selected, upload them
    if (initialData && initialData.id && selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        await uploadApi.uploadFiles(initialData.id, "RevenueRates", selectedFiles);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
        setSelectedFiles([]);
      } catch (error) {
        console.error("Error uploading files:", error);
        alert(`Failed to upload files: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {initialData ? "Edit Revenue Rate" : "New Revenue Rate"}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} mt={1}>
          {/* Command Dropdown */}
          <Grid item xs={12} sm={6}>
            <Autocomplete
              size="small"
              fullWidth
              disableClearable
              options={racAutocompleteOptions}
              getOptionLabel={(option) => (option == null ? "" : getOptionLabel(option))}
              isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
              value={racAutocompleteValue}
              onChange={(_, newValue) => handleChange("cmdId", newValue != null ? newValue.id : "")}
              ListboxProps={{ style: { maxHeight: 300 } }}
              sx={{
                fontSize: "1.1rem",
                "& .MuiInputBase-root": { minHeight: "45px" },
                "& .MuiAutocomplete-inputRoot": { paddingTop: 0, paddingBottom: 0 },
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  paddingTop: 0,
                  paddingBottom: 0,
                },
              }}
              renderInput={(params) => (
                <MDInput
                  {...params}
                  label="RAC"
                  sx={{ "& .MuiInputLabel-root": { fontSize: "1.1rem" } }}
                />
              )}
            />
          </Grid>

          {/* Base Dropdown */}
          <Grid item xs={12} sm={6}>
            <Autocomplete
              size="small"
              fullWidth
              disableClearable
              options={baseAutocompleteOptions}
              getOptionLabel={(option) => (option == null ? "" : getOptionLabel(option))}
              isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
              value={baseAutocompleteValue}
              onChange={(_, newValue) =>
                handleChange("baseId", newValue != null ? newValue.id : "")
              }
              disabled={
                form.cmdId === "" || form.cmdId == null || form.cmdId === 0 || form.cmdId === "0"
              }
              ListboxProps={{ style: { maxHeight: 300 } }}
              sx={{
                fontSize: "1.1rem",
                "& .MuiInputBase-root": { minHeight: "45px" },
                "& .MuiAutocomplete-inputRoot": { paddingTop: 0, paddingBottom: 0 },
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  paddingTop: 0,
                  paddingBottom: 0,
                },
              }}
              renderInput={(params) => (
                <MDInput
                  {...params}
                  label="Base"
                  sx={{ "& .MuiInputLabel-root": { fontSize: "1.1rem" } }}
                />
              )}
            />
          </Grid>

          {/* Property and Revenue Rate - same row */}
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="property-label" sx={{ fontSize: "1.1rem" }}>
                Property
              </InputLabel>
              <Select
                labelId="property-label"
                value={isBaseAll ? 0 : form.propertyId ?? ""}
                label="Property"
                onChange={(e) => handleChange("propertyId", e.target.value)}
                disabled={isBaseAll}
                renderValue={(v) => {
                  if (isBaseAll) return "—";
                  if (v === "" || v == null) return "";
                  const opt = filteredRentalProperties.find((p) => Number(p.id) === Number(v));
                  return opt ? opt.pId ?? opt.pid ?? opt.PId ?? String(v) : String(v);
                }}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontSize: "1.1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1.1rem",
                    padding: "0 32px 0 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "10px",
                  },
                }}
              >
                {isBaseAll && (
                  <MenuItem key="prop-0" value={0} sx={{ fontSize: "1.1rem" }}>
                    —
                  </MenuItem>
                )}
                {!isBaseAll &&
                  filteredRentalProperties.map((option) => (
                    <MenuItem
                      key={option.id}
                      value={option.id}
                      sx={{ fontSize: "1.1rem", padding: "10px 14px" }}
                    >
                      {option.pId}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            {selectedProperty && !isBaseAll && (
              <MDTypography variant="caption" color="text" sx={{ mt: 0.5, display: "block" }}>
                Area: {selectedArea || "-"} UoM: {selectedUoM || "-"}
              </MDTypography>
            )}
          </Grid>

          <Grid item xs={12} sm={6}>
            <MDInput
              label="Revenue Rate"
              type="number"
              value={form.rate}
              onChange={(e) => handleChange("rate", e.target.value)}
              fullWidth
              size="small"
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* Applicable Date - display dd-MMM-yyyy, state remains yyyy-mm-dd */}
          <Grid item xs={12} sm={6}>
            <MDBox sx={{ position: "relative" }}>
              <input
                type="date"
                ref={applicableDateInputRef}
                value={form.applicableDate || ""}
                onChange={(e) => handleChange("applicableDate", e.target.value)}
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  top: 0,
                  left: 0,
                  cursor: "pointer",
                }}
                aria-hidden
              />
              <MDInput
                label="Applicable Date *"
                type="text"
                value={toDisplayDate(form.applicableDate)}
                readOnly
                fullWidth
                size="small"
                required
                onClick={() => openDatePicker(applicableDateInputRef)}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiInputBase-input": {
                    fontSize: "1.1rem",
                    padding: "12px 14px",
                    cursor: "pointer",
                  },
                  "& .MuiInputLabel-root": { fontSize: "1.1rem" },
                }}
              />
            </MDBox>
          </Grid>

          {/* Deactive Date - display dd-MMM-yyyy, state remains yyyy-mm-dd */}
          <Grid item xs={12} sm={6}>
            <MDBox sx={{ position: "relative" }}>
              <input
                type="date"
                ref={deactiveDateInputRef}
                value={form.deactiveDate || ""}
                onChange={(e) => handleChange("deactiveDate", e.target.value)}
                disabled={!form.applicableDate || !String(form.applicableDate).trim()}
                min={
                  form.applicableDate
                    ? (() => {
                        const d = new Date(form.applicableDate);
                        d.setDate(d.getDate() + 1);
                        return d.toISOString().split("T")[0];
                      })()
                    : undefined
                }
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  top: 0,
                  left: 0,
                  cursor: "pointer",
                }}
                aria-hidden
              />
              <MDInput
                label="Deactive Date"
                type="text"
                value={toDisplayDate(form.deactiveDate)}
                readOnly
                fullWidth
                size="small"
                disabled={!form.applicableDate || !String(form.applicableDate).trim()}
                onClick={() => openDatePicker(deactiveDateInputRef)}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                    </InputAdornment>
                  ),
                }}
                sx={{
                  "& .MuiInputBase-input": {
                    fontSize: "1.1rem",
                    padding: "12px 14px",
                    cursor: "pointer",
                  },
                  "& .MuiInputLabel-root": { fontSize: "1.1rem" },
                }}
              />
            </MDBox>
          </Grid>

          {/* Attachments - File Upload (only when editing) */}
          {initialData && initialData.id && (
            <Grid item xs={12}>
              <MDBox
                sx={{
                  border: "1px dashed",
                  borderColor: "#b0b0b0",
                  borderRadius: 2,
                  p: 2,
                  bgcolor: "background.paper",
                }}
              >
                <MDTypography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
                  Attachments (Max 5 files total)
                </MDTypography>

                {/* Existing uploaded files (read-only) */}
                {loadingExistingFiles ? (
                  <MDBox display="flex" justifyContent="center" py={1}>
                    <CurrencyLoading size={20} />
                  </MDBox>
                ) : (
                  existingFiles.length > 0 && (
                    <MDBox mb={2}>
                      <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                        Already uploaded files ({existingFiles.length}/5):
                      </MDTypography>
                      {existingFiles.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.fileName || `File ${index + 1}`}
                          sx={{ mr: 1, mb: 1, fontSize: "0.95rem" }}
                          color="default"
                          variant="outlined"
                          disabled
                        />
                      ))}
                    </MDBox>
                  )
                )}

                {/* New files to upload */}
                {existingFiles.length >= 5 ? (
                  <MDBox
                    sx={{
                      p: 2,
                      bgcolor: "warning.light",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "warning.main",
                    }}
                  >
                    <MDTypography variant="body2" color="warning.dark">
                      Maximum 5 files already uploaded. Please delete existing files to upload new
                      ones.
                    </MDTypography>
                  </MDBox>
                ) : (
                  <>
                    <input
                      accept="*/*"
                      style={{ display: "none" }}
                      id="file-upload-input"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      disabled={existingFiles.length + selectedFiles.length >= 5 || isUploading}
                    />
                    <label htmlFor="file-upload-input">
                      <MDButton
                        variant="gradient"
                        color="info"
                        component="span"
                        disabled={existingFiles.length + selectedFiles.length >= 5 || isUploading}
                        sx={{
                          mb: 2,
                          minHeight: "56px",
                          fontSize: "1.1rem",
                          fontWeight: 600,
                          px: 4,
                          py: 1.5,
                          "& .MuiSvgIcon-root": {
                            fontSize: "1.5rem",
                            mr: 1,
                          },
                        }}
                      >
                        <Icon>cloud_upload</Icon>
                        Upload Files ({existingFiles.length + selectedFiles.length}/5)
                      </MDButton>
                    </label>
                    {existingFiles.length + selectedFiles.length < 5 && (
                      <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                        You can upload {5 - (existingFiles.length + selectedFiles.length)} more
                        file(s).
                      </MDTypography>
                    )}
                  </>
                )}
                {selectedFiles.length > 0 && (
                  <MDBox mt={2}>
                    <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                      New files to upload:
                    </MDTypography>
                    {selectedFiles.map((file, index) => (
                      <Chip
                        key={index}
                        label={`${file.name} (${formatFileSize(file.size)})`}
                        onDelete={() => handleRemoveFile(index)}
                        deleteIcon={<Icon>cancel</Icon>}
                        sx={{ mr: 1, mb: 1, fontSize: "0.95rem" }}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </MDBox>
                )}
                {selectedFiles.length === 0 && existingFiles.length === 0 && (
                  <MDTypography variant="caption" color="text" sx={{ display: "block", mt: 1 }}>
                    No files selected. Click &quot;Select New Files&quot; to upload attachments.
                  </MDTypography>
                )}
              </MDBox>
            </Grid>
          )}

          {/* Attachments - Note for new records */}
          {(!initialData || !initialData.id) && (
            <Grid item xs={12}>
              <MDBox
                sx={{
                  p: 2,
                  bgcolor: "info.light",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "info.main",
                }}
              >
                <MDBox display="flex" alignItems="center">
                  <Icon sx={{ color: "info.main", mr: 1, fontSize: "1.5rem" }}>info</Icon>
                  <MDTypography variant="body2" sx={{ fontSize: "1rem", color: "white" }}>
                    <strong>Note:</strong> Attachment files will be uploaded after saving this form.
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Grid>
          )}

          {/* Status */}
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="status-label" sx={{ fontSize: "1.1rem" }}>
                Status
              </InputLabel>
              <Select
                labelId="status-label"
                value={form.status !== undefined ? form.status : true}
                label="Status"
                onChange={(e) => handleChange("status", e.target.value)}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontSize: "1.1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1.1rem",
                    padding: "0 32px 0 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "10px",
                  },
                }}
              >
                <MenuItem value={true} sx={{ fontSize: "1.1rem", padding: "10px 14px" }}>
                  Active
                </MenuItem>
                <MenuItem value={false} sx={{ fontSize: "1.1rem", padding: "10px 14px" }}>
                  Inactive
                </MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={isUploading}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          disabled={isUploading || (isEditMode ? !canEditCurrentMenu() : !canCreateCurrentMenu())}
        >
          <Icon>save</Icon>&nbsp;{isUploading ? "Uploading..." : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

RevenueRatesForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  rentalProperties: PropTypes.array.isRequired,
  commandOptions: PropTypes.array.isRequired,
  baseOptions: PropTypes.array.isRequired,
  onUploadSuccess: PropTypes.func,
};

export default function RevenueRates() {
  const [openForm, setOpenForm] = useState(false);
  const [currentRevenueRate, setCurrentRevenueRate] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [rentalProperties, setRentalProperties] = useState([]);
  const [commandOptions, setCommandOptions] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [visibleRowCount, setVisibleRowCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Search is handled by shared DataTable (canSearch)
  const [successSB, setSuccessSB] = useState(false);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentList, setAttachmentList] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentLoadingId, setAttachmentLoadingId] = useState(null);
  const [currentViewingRecord, setCurrentViewingRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const isSuperUser =
    String(getLoggedInUsername() || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "") === "superuser";

  const openSuccessSB = () => setSuccessSB(true);
  const closeSuccessSB = () => setSuccessSB(false);

  const fetchRevenueRates = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await revenueRatesApi.getAll(page, size);
      const data = response?.data ?? (Array.isArray(response) ? response : []);
      const pagination = response?.pagination;

      setTableRows(Array.isArray(data) ? data : []);
      setTotalCount(Number(pagination?.totalCount || 0));
    } catch (error) {
      console.error("Error fetching revenue rates:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRentalProperties = async () => {
    try {
      const response = await api.list("rentalproperty");
      setRentalProperties(response);
    } catch (error) {
      console.error("Error fetching rental properties:", error);
    }
  };

  const fetchCommands = async () => {
    try {
      const response = await api.list("command");
      const arr = Array.isArray(response) ? response : [];
      setCommandOptions(
        arr.map((cmd) => ({
          id: Number(cmd?.id),
          name: String(cmd?.name ?? cmd?.value ?? cmd?.label ?? cmd?.Name ?? cmd?.Value ?? ""),
        }))
      );
    } catch (error) {
      console.error("Error fetching commands:", error);
      setCommandOptions([]);
    }
  };

  const fetchBases = async () => {
    try {
      const response = await api.list("base");
      const arr = Array.isArray(response) ? response : [];
      setBaseOptions(
        arr.map((base) => ({
          id: Number(base?.id),
          name: String(base?.name ?? base?.value ?? base?.label ?? base?.Name ?? base?.Value ?? ""),
          cmdId: Number(base?.cmdId ?? base?.cmd ?? base?.commandId ?? 0),
        }))
      );
    } catch (error) {
      console.error("Error fetching bases:", error);
      setBaseOptions([]);
    }
  };

  useEffect(() => {
    fetchRentalProperties();
    fetchCommands();
    fetchBases();
  }, []);

  useEffect(() => {
    fetchRevenueRates(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  const handleOpenForm = () => {
    setCurrentRevenueRate(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditRevenueRate = (id) => {
    // Handle both camelCase and PascalCase for id lookup
    const revenueRate = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!revenueRate) {
      console.error("Revenue rate not found for id:", id);
      return;
    }
    if ((revenueRate.deactiveDate ?? revenueRate.DeactiveDate) && !isSuperUser) {
      alert("Deactive date already exists contact Administrator");
      return;
    }
    // Handle both camelCase and PascalCase for all fields
    const propertyId = revenueRate.propertyId ?? revenueRate.PropertyId ?? null;
    const applicableDate = revenueRate.applicableDate ?? revenueRate.ApplicableDate ?? null;
    const rate = revenueRate.rate ?? revenueRate.Rate ?? "";
    const attachments = revenueRate.attachments ?? revenueRate.Attachments ?? "";
    const status = revenueRate.status ?? revenueRate.Status ?? true;

    setCurrentRevenueRate({
      ...revenueRate,
      id: revenueRate.id ?? revenueRate.Id,
      propertyId: propertyId,
      applicableDate: applicableDate
        ? typeof applicableDate === "string"
          ? applicableDate.split("T")[0]
          : applicableDate
        : "",
      rate: rate || "",
      attachments: attachments || "",
      status: status !== undefined ? Boolean(status) : true,
    });
    setOpenForm(true);
  };

  const handleDeleteRevenueRate = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      await revenueRatesApi.remove(recordToDelete);
      fetchRevenueRates(pageNumber, pageSize);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting revenue rate:", error);
      alert("Failed to delete revenue rate. Please try again.");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };
  const handleViewAttachments = async (record) => {
    if (!record?.id) return;

    setAttachmentLoading(true);
    setAttachmentLoadingId(record.id);
    setCurrentViewingRecord(record);
    try {
      const response = await uploadApi.getUploadedFiles(record.id, "RevenueRates");
      // Handle response format: { files: [...] } or direct array
      const filesArray = response?.files || (Array.isArray(response) ? response : []);

      // Normalize the response to ensure we have fileName and downloadUrl
      const normalized = filesArray.map((f) => {
        // Handle different response formats
        if (typeof f === "string") {
          return {
            fileName: f.split(/[\\/]/).pop(),
            downloadUrl: f,
          };
        }
        // Extract fileName and downloadUrl from various possible field names
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
        return {
          ...f,
          fileName,
          downloadUrl,
        };
      });

      setAttachmentList(normalized);
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
  };

  const handleDownloadAttachment = (file) => {
    const downloadUrl =
      file?.downloadUrl || file?.fileUrl || file?.url || file?.filePath || file?.path;
    if (downloadUrl) {
      // If it's a relative path, prepend the API base URL
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
    if (!canDeleteCurrentMenu()) return;
    if (!file?.id) {
      alert("File ID is not available. Cannot delete this file.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file.fileName || file.name || "this file"}"?`
    );

    if (!confirmDelete) {
      return;
    }

    try {
      await uploadApi.deleteUploadedFile(file.id);
      // Refresh the attachment list from the server
      const recordId = currentViewingRecord?.id;
      if (recordId) {
        const response = await uploadApi.getUploadedFiles(recordId, "RevenueRates");
        const filesArray = response?.files || (Array.isArray(response) ? response : []);
        const normalized = filesArray.map((f) => {
          if (typeof f === "string") {
            return {
              fileName: f.split(/[\\/]/).pop(),
              downloadUrl: f,
            };
          }
          const fileName =
            f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
          const downloadUrl =
            f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
          return {
            ...f,
            fileName,
            downloadUrl,
          };
        });
        setAttachmentList(normalized);
      } else {
        // If no record ID, just remove from list
        setAttachmentList((prev) => prev.filter((f) => f.id !== file.id));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const isBothAll =
        (data.cmdId === 0 || data.cmdId === "0") && (data.baseId === 0 || data.baseId === "0");
      const isBaseAll = data.baseId === 0 || data.baseId === "0";
      const rawDeactive = data.deactiveDate ?? "";
      const deactiveDateValue =
        rawDeactive && String(rawDeactive).trim()
          ? String(rawDeactive).length === 10 && !String(rawDeactive).includes("T")
            ? new Date(String(rawDeactive) + "T12:00:00").toISOString()
            : String(rawDeactive)
          : null;
      const formattedData = {
        cmdId:
          data.cmdId === 0 || data.cmdId === "0"
            ? 0
            : data.cmdId !== "" && data.cmdId != null
            ? Number(data.cmdId)
            : null,
        baseId:
          data.baseId === 0 || data.baseId === "0"
            ? 0
            : data.baseId !== "" && data.baseId != null
            ? Number(data.baseId)
            : null,
        propertyId: isBothAll || isBaseAll ? 0 : Number(data.propertyId) || null,
        applicableDate: data.applicableDate || null,
        rate: data.rate !== "" && data.rate != null ? Number(data.rate) : null,
        attachments: data.attachments || null,
        status: data.status !== undefined ? Boolean(data.status) : true,
        DeactiveDate: deactiveDateValue,
      };
      if (currentRevenueRate) {
        await revenueRatesApi.update(currentRevenueRate.id, formattedData);
      } else {
        await revenueRatesApi.create(formattedData);
      }
      fetchRevenueRates(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving revenue rate:", error);
      throw error;
    }
  };

  // Status cell renderer with PropTypes
  const StatusCell = ({ value }) => <StatusBadge value={value} />;
  StatusCell.propTypes = {
    value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string]),
  };

  // Format date for display as dd-MMM-yyyy (e.g., 10-Feb-2026)
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
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        [year, month, day] = datePart.split("-");
      } else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
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

  // Excel export cell formatter to format dates as dd-MMM-yyyy
  const exportCellFormatter = ({ value, column, row }) => {
    const colId = String(column?.id || "").toLowerCase();
    if (colId === "applicabledate" || colId === "applicationdate" || colId === "deactivedate") {
      return formatDateDDMMMYYYY(value);
    }
    // For Property column, use propertyName instead of propertyId
    const accessor = String(column?.accessor || "").toLowerCase();
    if (colId === "propertyid" || accessor === "propertyid" || colId === "property") {
      const rowData = row || {};
      return rowData.propertyName || value || "";
    }
    return value;
  };

  const columns = [
    {
      Header: "Actions",
      accessor: "actions",
      align: "center",
    },
    { Header: "ID", accessor: "id", align: "center" },
    {
      Header: "Property",
      accessor: "propertyName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Filter/search must run on text (propertyName), while preserving fallback for old rows.
        const propId = row?.original?.propertyId ?? row?.original?.PropertyId ?? null;
        const textValue = value ?? row?.original?.propertyName ?? "";
        if (textValue && String(textValue).trim() !== "") return String(textValue);
        if (!propId) return "-";
        const property = rentalProperties.find((p) => Number(p.id) === Number(propId));
        return property ? property.pId ?? property.pid ?? property.PId ?? "" : String(propId);
      },
    },
    {
      Header: "RAC",
      accessor: "cmdName",
      align: "left",
      Cell: ({ value, row }) => {
        const cmdId = row?.original?.cmdId ?? row?.original?.CmdId ?? null;
        const isCmdAll = cmdId === 0 || cmdId === "0" || cmdId === null || cmdId === undefined;
        return isCmdAll ? "All" : value ?? "-";
      },
    },
    {
      Header: "Base",
      accessor: "baseName",
      align: "left",
      Cell: ({ value, row }) => {
        const propId = row?.original?.propertyId ?? row?.original?.PropertyId ?? null;
        const isPropertyDash =
          propId === 0 || propId === null || propId === undefined || propId === "";
        return isPropertyDash ? "All" : value ?? "-";
      },
    },
    {
      Header: "Class",
      accessor: "className",
      align: "left",
      Cell: ({ value, row }) => {
        const propId = row?.original?.propertyId ?? row?.original?.PropertyId ?? null;
        const isPropertyDash =
          propId === 0 || propId === null || propId === undefined || propId === "";
        return isPropertyDash ? "All" : value ?? "-";
      },
    },
    {
      Header: "Area  UoM",
      accessor: "areaUoM",
      align: "left",
      Cell: ({ row }) => {
        const propId = row?.original?.propertyId ?? row?.original?.PropertyId ?? null;
        const isPropertyDash =
          propId === 0 || propId === null || propId === undefined || propId === "";
        if (isPropertyDash) return "-";
        const property = rentalProperties.find((p) => Number(p.id) === Number(propId));
        const area = property?.area ?? property?.Area ?? "";
        const uoM = property?.uoM ?? property?.UoM ?? "";
        const areaStr = area ? Number(area).toLocaleString() : "";
        const uoMStr = uoM || "";
        if (!areaStr && !uoMStr) return "-";
        return [areaStr, uoMStr].filter(Boolean).join("  ");
      },
    },
    {
      id: "applicableDate",
      Header: "Applicable Date",
      accessor: "applicableDate",
      align: "left",
      filter: "revenueRatesDateCompare",
      Filter: RevenueRatesDateColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const dateValue =
          value ?? row?.original?.applicableDate ?? row?.original?.ApplicableDate ?? null;
        return formatDateDDMMMYYYY(dateValue) || "";
      },
    },
    {
      Header: "RR FY",
      accessor: "fiscal",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const v = value ?? row?.original?.fiscal ?? row?.original?.Fiscal ?? "";
        return v !== null && v !== undefined && String(v).trim() !== "" ? String(v) : "-";
      },
    },
    {
      id: "rate",
      Header: "Revenue Rate",
      accessor: "rate",
      align: "left",
      filter: "revenueRatesMoneyCompare",
      Filter: RevenueRatesMoneyColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Handle both camelCase and PascalCase - use value from accessor first, then fallback
        const rateValue = value ?? row?.original?.rate ?? row?.original?.Rate ?? 0;
        if (rateValue === "" || rateValue == null) return "";
        const parsedRate = Number(rateValue);
        return Number.isFinite(parsedRate) ? parsedRate.toLocaleString() : "";
      },
    },
    {
      Header: "Attachments",
      accessor: "attachments",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // Show view icon if record has been saved (has an id)
        // Files are uploaded separately, so we show the icon for any saved record
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const hasAttachments = rowData?.id;
        const rawIsAttachment = rowData?.IsAttachment ?? rowData?.isAttachment;
        const countValue =
          rowData?.attachmentCount ??
          rowData?.attachmentsCount ??
          rowData?.filesCount ??
          rowData?.AttachmentCount ??
          rowData?.AttachmentsCount ??
          rowData?.FilesCount;
        const hasAttachmentData =
          rawIsAttachment === true ||
          rawIsAttachment === 1 ||
          rawIsAttachment === "1" ||
          String(rawIsAttachment || "")
            .trim()
            .toLowerCase() === "true" ||
          Number(countValue || 0) > 0;
        return hasAttachments ? (
          <IconButton
            size="small"
            color={hasAttachmentData ? "success" : "error"}
            // eslint-disable-next-line react/prop-types
            onClick={() => handleViewAttachments(row.original)}
            // eslint-disable-next-line react/prop-types
            disabled={attachmentLoading && attachmentLoadingId === row?.original?.id}
            title="View attachments"
          >
            <Icon>visibility</Icon>
          </IconButton>
        ) : (
          <span>-</span>
        );
      },
    },
    {
      Header: "Status",
      accessor: "status",
      align: "left",
      Cell: StatusCell,
    },
    {
      Header: "Deactive Date",
      accessor: "deactiveDate",
      align: "left",
      Cell: ({ value, row }) => {
        const dateValue =
          value ?? row?.original?.deactiveDate ?? row?.original?.DeactiveDate ?? null;
        return formatDateDDMMMYYYY(dateValue) || "";
      },
    },
  ];

  const computedRows = tableRows.map((row) => {
    // Normalize id and propertyId (handle both camelCase and PascalCase)
    const normalizedId = row?.id ?? row?.Id;
    const propertyId = row.propertyId ?? row.PropertyId;
    const prop = rentalProperties.find((p) => Number(p.id) === Number(propertyId));
    const propertyName = prop ? prop.pId ?? prop.pid ?? prop.PId ?? "" : "";
    const cmdId = row.cmdId ?? row.CmdId ?? prop?.cmdId ?? null;
    const isCmdAll = cmdId === 0 || cmdId === "0" || cmdId === null || cmdId === undefined;
    const resolvedCmdName = isCmdAll
      ? "All"
      : (() => {
          const cmd = (commandOptions || []).find((c) => Number(c?.id) === Number(cmdId));
          return cmd
            ? cmd.name ?? cmd.Name ?? cmd.value ?? cmd.Value ?? String(cmdId)
            : row.cmdName ?? row.CmdName ?? row.cmdname ?? prop?.cmdName ?? String(cmdId ?? "");
        })();

    return {
      ...row,
      id: normalizedId,
      propertyId: propertyId,
      propertyName: propertyName,
      rate: row.rate ?? row.Rate ?? 0,
      applicableDate: row.applicableDate ?? row.ApplicableDate ?? null,
      fiscal: row.fiscal ?? row.Fiscal ?? "",
      deactiveDate: row.deactiveDate ?? row.DeactiveDate ?? null,
      status: row.status ?? row.Status ?? true,
      cmdName: resolvedCmdName,
      baseName:
        row.baseName ??
        row.BaseName ??
        row.basename ??
        prop?.baseName ??
        prop?.basename ??
        row.baseId ??
        row.BaseId ??
        prop?.baseId ??
        "",
      className:
        row.className ??
        row.ClassName ??
        row.classname ??
        prop?.className ??
        prop?.classname ??
        row.classId ??
        row.ClassId ??
        prop?.classId ??
        "",
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
          {canEditCurrentMenu() && (
            <IconButton
              size="small"
              color="info"
              onClick={() => handleEditRevenueRate(normalizedId)}
              title="Edit"
              sx={{ padding: "1px" }}
            >
              <Icon>edit</Icon>
            </IconButton>
          )}
          {canDeleteCurrentMenu() && (
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteRevenueRate(normalizedId)}
              title="Delete"
              sx={{ padding: "1px" }}
            >
              <Icon>delete</Icon>
            </IconButton>
          )}
        </MDBox>
      ),
    };
  });

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
                  Revenue Rates
                </MDTypography>
                {canCreateCurrentMenu() && (
                  <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                    <Icon>add</Icon>&nbsp;Add New
                  </MDButton>
                )}
              </MDBox>
              <MDBox
                pt={3}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  height: "88vh",
                  minHeight: "680px",
                  overflow: "hidden",
                  position: "relative",
                  "& .MuiTable-root": {
                    tableLayout: "auto",
                    width: "max-content",
                    borderCollapse: "collapse",
                  },
                  "& .MuiTable-root th": {
                    fontSize: "1.0rem !important",
                    fontWeight: "700 !important",
                    width: "auto !important",
                    minWidth: "0 !important",
                    padding: "1px 4px !important",
                    borderBottom: "1px solid #d0d0d0",
                    whiteSpace: "nowrap",
                  },
                  "& .MuiTable-root td": {
                    width: "auto !important",
                    minWidth: "0 !important",
                    padding: "1px 4px !important",
                    borderBottom: "1px solid #e0e0e0",
                    whiteSpace: "nowrap",
                  },
                }}
              >
                {/* Scroll region: horizontal bar stays at bottom via overflow-x scroll + stable gutter */}
                <MDBox
                  sx={{
                    position: "relative",
                    flex: "1 1 0",
                    minHeight: 0,
                    overflowX: "scroll",
                    overflowY: "scroll",
                    scrollbarGutter: "stable both-edges",
                    scrollbarWidth: "thin",
                    "&::-webkit-scrollbar": {
                      width: "10px",
                      height: "10px",
                    },
                    "&::-webkit-scrollbar-thumb": {
                      backgroundColor: "#9e9e9e",
                      borderRadius: "6px",
                    },
                  }}
                >
                  {/* Loading Overlay */}
                  {loading && (
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
                      columns,
                      rows: computedRows,
                    }}
                    isSorted={false}
                    stickyToolbarAndHeader
                    autoHeight
                    entriesPerPage={{
                      defaultValue: 50,
                      entries: [10, 25, 50, 100, 500, 1000, 2000],
                    }}
                    page={0}
                    onPageChange={() => {}}
                    pageSize={pageSize}
                    onEntriesPerPageChange={(value) => {
                      setPageNumber(1);
                      setPageSize(value);
                    }}
                    showTotalEntries={false}
                    noEndBorder
                    canSearch
                    autoResetFilters={false}
                    exportFileName="Revenue-Rates"
                    exportCellFormatter={exportCellFormatter}
                    extraFilterTypes={REVENUE_RATES_DATATABLE_DATE_FILTER_TYPES}
                    onVisibleRowCountChange={setVisibleRowCount}
                    contentFitTable
                  />
                </MDBox>

                {/* Entries count footer (server-side total; no page controls) */}
                <MDBox
                  display="flex"
                  alignItems="center"
                  px={2}
                  py={1.5}
                  sx={{ flexShrink: 0, borderTop: "1px solid #e0e0e0" }}
                >
                  <MDTypography variant="button" color="secondary" fontWeight="regular">
                    {(() => {
                      const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
                      const displayVisible = displayTotal === 0 ? 0 : visibleRowCount;
                      return displayTotal === 0
                        ? "0 of 0 entries"
                        : `${displayVisible} of ${displayTotal} entries`;
                    })()}
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
      <RevenueRatesForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRevenueRate}
        rentalProperties={rentalProperties}
        commandOptions={commandOptions}
        baseOptions={baseOptions}
        onUploadSuccess={openSuccessSB}
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
          ) : attachmentList.length === 0 ? (
            <MDTypography variant="body2" color="text">
              No attachments uploaded for this record.
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
                        disabled={!canDeleteCurrentMenu()}
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
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseAttachmentDialog}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
      <MDSnackbar
        color="success"
        icon="check"
        title="Success"
        content="Files uploaded successfully!"
        open={successSB}
        onClose={closeSuccessSB}
        close={closeSuccessSB}
        bgWhite
      />
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1" sx={{ fontSize: "1.1rem" }}>
            Are you sure you want to delete this revenue rate? This action cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary" variant="outlined">
            <Icon>close</Icon>&nbsp;Cancel
          </MDButton>
          <MDButton
            onClick={handleConfirmDelete}
            color="error"
            variant="gradient"
            disabled={!canDeleteCurrentMenu()}
          >
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
