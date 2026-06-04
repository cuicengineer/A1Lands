import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import { GRID_DISPLAY_DEFAULT_PAGE_SIZE } from "utils/gridDisplayPageSize";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import Divider from "@mui/material/Divider";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import Checkbox from "@mui/material/Checkbox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import CompactGroupBySelect from "components/CompactGroupBySelect";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { withGridValueChip } from "utils/gridValueChipCell";
import StatusBadge from "components/StatusBadge";
import CurrencyLoading from "components/CurrencyLoading";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import PropTypes from "prop-types";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  getLoggedInUsername,
} from "services/api.service";
import uploadApi from "services/api.upload.service";
import rentalValueRateApi from "services/api.rentalvaluerate.service";
import { format, parseISO, isValid } from "date-fns";

const CONFIG_GRID_APPLICATION_DATE_FALLBACK_KEYS = {
  applicableDate: ["applicableDate", "ApplicableDate", "applicationDate", "ApplicationDate"],
  deactiveDate: ["deactiveDate", "DeactiveDate"],
};

const RENTAL_VALUE_RATE_DEFAULT_GROUP_BY_COLUMNS = ["cmdName", "baseName", "className"];

const RENTAL_VALUE_RATE_GROUPING_COLUMN_OPTIONS = [
  { value: "cmdName", label: "RAC" },
  { value: "baseName", label: "Base" },
  { value: "className", label: "Class" },
  { value: "applicableDate", label: "Application Date" },
  { value: "deactiveDate", label: "Deactive Date" },
  { value: "rate", label: "Rate(%)" },
  { value: "description", label: "Description" },
  { value: "status", label: "Status" },
];

function parseConfigGridApplicationDateYyyyMmDd(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = CONFIG_GRID_APPLICATION_DATE_FALLBACK_KEYS[columnId] || [];
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

function configGridApplicationDateCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowD = parseConfigGridApplicationDateYyyyMmDd(row, columnId);
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

function ApplicationDateColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Date";
  const modeLabelId = `config-application-date-filter-mode-${column.id || "col"}`;

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

ApplicationDateColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const RENTAL_VALUE_RATE_GRID_MONEY_FALLBACK_KEYS = {
  rate: ["rate", "Rate"],
};

function normalizeRentalValueRateMoneyRawToNumber(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseRentalValueRateGridRowMoneyNumber(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = RENTAL_VALUE_RATE_GRID_MONEY_FALLBACK_KEYS[columnId] || [];
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
  return normalizeRentalValueRateMoneyRawToNumber(raw);
}

function rentalValueRateMoneyApproxEqual(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= 1e-6 * scale;
}

function rentalValueRateGridMoneyCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowN = parseRentalValueRateGridRowMoneyNumber(row, columnId);
    if (rowN === null) return false;
    const { mode } = filterValue;
    if (mode === "gt") {
      const ref = normalizeRentalValueRateMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rowN > ref;
    }
    if (mode === "lte") {
      const ref = normalizeRentalValueRateMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rowN <= ref;
    }
    if (mode === "eq") {
      const ref = normalizeRentalValueRateMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rentalValueRateMoneyApproxEqual(rowN, ref);
    }
    if (mode === "between") {
      const a = normalizeRentalValueRateMoneyRawToNumber(filterValue.valueFrom);
      const b = normalizeRentalValueRateMoneyRawToNumber(filterValue.valueTo);
      if (a === null || b === null) return false;
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      return rowN >= low && rowN <= high;
    }
    return true;
  });
}

function RentalValueRateMoneyColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Amount";
  const modeLabelId = `rental-value-rate-money-filter-mode-${column.id || "col"}`;

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

RentalValueRateMoneyColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const CONFIG_DATATABLE_APPLICATION_DATE_FILTER_TYPES = Object.freeze({
  applicationDateCompare: configGridApplicationDateCompare,
  rentalValueRateMoneyCompare: rentalValueRateGridMoneyCompare,
});

function RentalValueRateForm({
  open,
  onClose,
  onSubmit,
  initialData,
  classes,
  commands,
  bases,
  onUploadSuccess,
}) {
  const [form, setForm] = useState({
    applicableDate: "",
    deactiveDate: "",
    cmdId: "",
    baseIds: [],
    classIds: [],
    rate: "",
    description: "",
    status: true,
  });
  const [errors, setErrors] = useState({});
  const [filteredBases, setFilteredBases] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);
  const isEditMode = Boolean(initialData && (initialData.id || initialData.Id));

  const baseAutocompleteOptionsAddMode = useMemo(() => {
    const allSelected =
      filteredBases.length > 0 &&
      filteredBases.every((base) => form.baseIds.includes(String(base.id)));
    return [{ id: "__all__", name: allSelected ? "Deselect All" : "Select All" }, ...filteredBases];
  }, [filteredBases, form.baseIds]);

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
        console.error("Error serializing rental value rate API response:", serializationError);
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

    return "Failed to save rental value rate. Please try again.";
  };

  // Filter bases based on selected command
  useEffect(() => {
    if (form.cmdId && bases.length > 0) {
      const filtered = bases.filter((base) => Number(base.cmd) === Number(form.cmdId));
      setFilteredBases(filtered);
      // Keep only valid selected bases for current command
      if (Array.isArray(form.baseIds) && form.baseIds.length > 0) {
        const validIds = new Set(filtered.map((b) => String(b.id)));
        const nextBaseIds = form.baseIds.filter((id) => validIds.has(String(id)));
        if (nextBaseIds.length !== form.baseIds.length) {
          setForm((prev) => ({ ...prev, baseIds: nextBaseIds }));
        }
      }
    } else {
      setFilteredBases([]);
      if (Array.isArray(form.baseIds) && form.baseIds.length > 0) {
        setForm((prev) => ({ ...prev, baseIds: [] }));
      }
    }
  }, [form.cmdId, bases, form.baseIds]);

  useEffect(() => {
    if (initialData) {
      // Handle both camelCase and PascalCase for all fields
      const applicableDateValue =
        initialData.applicableDate ||
        initialData.ApplicableDate ||
        initialData.applicationDate ||
        initialData.ApplicationDate ||
        "";
      const dateValue = applicableDateValue
        ? typeof applicableDateValue === "string"
          ? applicableDateValue.split("T")[0]
          : applicableDateValue
        : "";

      const deactiveDateValue = initialData.deactiveDate ?? initialData.DeactiveDate ?? "";
      const deactiveStr = deactiveDateValue
        ? typeof deactiveDateValue === "string"
          ? deactiveDateValue.split("T")[0]
          : String(deactiveDateValue).split("T")[0]
        : "";

      setForm({
        applicableDate: dateValue,
        deactiveDate: deactiveStr,
        cmdId: initialData.cmdId || initialData.CmdId || "",
        baseIds: [String(initialData.baseId || initialData.BaseId || "")].filter(Boolean),
        classIds: [String(initialData.classId || initialData.ClassId || "")].filter(Boolean),
        rate: initialData.rate || initialData.Rate || "",
        description: initialData.description || initialData.Description || "",
        status:
          initialData.status !== undefined
            ? initialData.status
            : initialData.Status !== undefined
            ? initialData.Status
            : true,
      });
    } else {
      setForm({
        applicableDate: "",
        deactiveDate: "",
        cmdId: "",
        baseIds: [],
        classIds: [],
        rate: "",
        description: "",
        status: true,
      });
    }
    setErrors({});
    // Reset new files when dialog opens
    setSelectedFiles([]);
    // Fetch existing uploaded files if editing
    if (initialData && initialData.id) {
      fetchExistingFiles(initialData.id);
    } else {
      setExistingFiles([]);
    }
  }, [initialData, open]);

  const fetchExistingFiles = async (id) => {
    setLoadingExistingFiles(true);
    try {
      const response = await uploadApi.getUploadedFiles(id, "RentalValueRate");
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
      const next = { ...prev, [field]: value };
      if (field === "applicableDate" && next.deactiveDate && value) {
        const appTs = new Date(value).getTime();
        const deactTs = new Date(next.deactiveDate).getTime();
        if (deactTs <= appTs) next.deactiveDate = "";
      }
      return next;
    });
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const totalExistingFiles = existingFiles.length;
    const totalSelectedFiles = selectedFiles.length;
    const totalFiles = totalExistingFiles + totalSelectedFiles;
    const remainingSlots = 2 - totalFiles;

    if (totalFiles >= 2) {
      alert(
        "Maximum 2 files allowed. Please delete some existing files before uploading new ones."
      );
      event.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      alert(
        `You can only upload ${remainingSlots} more file(s). Maximum 2 files allowed (${totalExistingFiles} already uploaded).`
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
      return true;
    });

    if (totalFiles + validFiles.length > 2) {
      const allowedCount = 2 - totalFiles;
      alert(
        `You can only upload ${allowedCount} more file(s). Maximum 2 files allowed (${totalExistingFiles} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
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

  const validate = () => {
    const newErrors = {};
    if (!form.applicableDate) newErrors.applicableDate = "Application Date is required";
    if (form.applicableDate && form.deactiveDate && form.deactiveDate <= form.applicableDate) {
      newErrors.deactiveDate = "Deactive Date must be after Application Date";
    }
    if (!form.cmdId) newErrors.cmdId = "Command is required";
    if (!form.baseIds || form.baseIds.length === 0) newErrors.baseIds = "Base is required";
    if (!form.classIds || form.classIds.length === 0) newErrors.classIds = "Class is required";
    if (!form.rate) newErrors.rate = "Rate is required";
    if (!form.description?.trim()) newErrors.description = "Description is required";
    if (form.description && form.description.length > 250) {
      newErrors.description = "Description must not exceed 250 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    try {
      const deactiveDateValue = String(form.deactiveDate ?? "").trim()
        ? String(form.deactiveDate).trim()
        : null;
      const payloadBase = {
        applicableDate: form.applicableDate,
        deactiveDate: deactiveDateValue,
        cmdId: Number(form.cmdId),
        rate: form.rate ? Number(form.rate) : null,
        description: form.description.trim(),
        status: form.status,
        category: "RentalValue", // Static value, not displayed to user
        type: 1, // Static value, not displayed to user
      };

      const comboPayloads = (form.baseIds || []).flatMap((baseId) =>
        (form.classIds || []).map((classId) => ({
          ...payloadBase,
          baseId: Number(baseId),
          classId: Number(classId),
        }))
      );
      if (comboPayloads.length === 0) return;
      const payloadToSubmit = isEditMode
        ? comboPayloads.length === 1
          ? comboPayloads[0]
          : comboPayloads
        : comboPayloads;

      const result = await onSubmit(payloadToSubmit);

      // Get the record ID (either from existing or newly created)
      const recordIds = Array.isArray(result?.ids)
        ? result.ids.filter(Boolean)
        : [initialData?.id || initialData?.Id || result?.id].filter(Boolean);

      // If files are selected, upload them
      if (recordIds.length > 0 && selectedFiles.length > 0) {
        setIsUploading(true);
        try {
          await Promise.all(
            recordIds.map((recordId) =>
              uploadApi.uploadFiles(recordId, "RentalValueRate", selectedFiles)
            )
          );
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
    } catch (error) {
      console.error("Error saving rental value rate:", error);
      alert(getSaveErrorMessage(error));
    }
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

  const inputSx = {
    "& .MuiInputBase-input": {
      fontSize: "1rem",
      padding: "10px 12px",
    },
    "& .MuiInputLabel-root": {
      fontSize: "1rem",
    },
  };

  const selectSx = {
    fontSize: "1rem",
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "10px 12px",
    },
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {initialData ? "Edit Rental Value Rate" : "New Rental Value Rate"}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} mt={1}>
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
                label="Application Date"
                type="text"
                value={toDisplayDate(form.applicableDate)}
                readOnly
                fullWidth
                size="small"
                required
                error={!!errors.applicableDate}
                helperText={errors.applicableDate}
                onClick={() => openDatePicker(applicableDateInputRef)}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                    </InputAdornment>
                  ),
                }}
                sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
              />
            </MDBox>
          </Grid>

          <Grid item xs={12} sm={6}>
            <MDBox sx={{ position: "relative" }}>
              <input
                type="date"
                ref={deactiveDateInputRef}
                value={form.deactiveDate || ""}
                onChange={(e) => handleChange("deactiveDate", e.target.value)}
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
                error={!!errors.deactiveDate}
                helperText={errors.deactiveDate}
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
                sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
              />
            </MDBox>
          </Grid>

          <Grid item xs={12} sm={6}>
            <Autocomplete
              size="small"
              fullWidth
              disableClearable
              options={commands || []}
              getOptionLabel={(option) => option?.name ?? ""}
              isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
              value={(commands || []).find((c) => Number(c.id) === Number(form.cmdId)) ?? null}
              onChange={(_, newValue) => handleChange("cmdId", newValue != null ? newValue.id : "")}
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
                  padding: "10px 12px",
                },
              }}
              renderInput={(params) => (
                <MDInput {...params} label="RAC" required error={!!errors.cmdId} sx={inputSx} />
              )}
            />
            {errors.cmdId && (
              <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                {errors.cmdId}
              </MDTypography>
            )}
          </Grid>

          <Grid item xs={12} sm={6}>
            <Autocomplete
              multiple
              disableCloseOnSelect
              size="small"
              fullWidth
              options={baseAutocompleteOptionsAddMode}
              filterOptions={(options, state) => {
                const input = (state.inputValue || "").toLowerCase().trim();
                const allOpt = options.find((o) => String(o.id) === "__all__");
                const rest = options.filter((o) => String(o.id) !== "__all__");
                const filtered = !input
                  ? rest
                  : rest.filter((o) =>
                      String(o.name || "")
                        .toLowerCase()
                        .includes(input)
                    );
                return allOpt ? [allOpt, ...filtered] : filtered;
              }}
              getOptionLabel={(option) => option?.name ?? ""}
              isOptionEqualToValue={(a, b) => {
                if (String(a?.id) === "__all__" || String(b?.id) === "__all__") {
                  return String(a?.id) === "__all__" && String(b?.id) === "__all__";
                }
                return Number(a?.id) === Number(b?.id);
              }}
              value={(form.baseIds || [])
                .map((id) => filteredBases.find((b) => Number(b.id) === Number(id)))
                .filter(Boolean)}
              onChange={(_, newValue) => {
                const raw = newValue || [];
                if (raw.some((o) => String(o.id) === "__all__")) {
                  const allIds = filteredBases.map((base) => String(base.id));
                  const allSelected =
                    allIds.length > 0 && allIds.every((id) => form.baseIds.includes(id));
                  handleChange("baseIds", allSelected ? [] : allIds);
                  return;
                }
                handleChange(
                  "baseIds",
                  raw.map((b) => String(b.id))
                );
              }}
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
                  padding: "10px 12px",
                },
              }}
              renderInput={(params) => (
                <MDInput
                  {...params}
                  label="Base (Multiple Selection)"
                  required
                  error={!!errors.baseIds}
                  sx={inputSx}
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    key={option.id}
                    label={option.name}
                    size="small"
                    sx={{ fontSize: "0.875rem" }}
                    {...getTagProps({ index })}
                  />
                ))
              }
            />
            {errors.baseIds && (
              <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                {errors.baseIds}
              </MDTypography>
            )}
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth required error={!!errors.classIds}>
              <InputLabel id="class-label">
                {isEditMode ? "Class" : "Class (Multiple Selection)"}
              </InputLabel>
              <Select
                labelId="class-label"
                multiple={!isEditMode}
                value={isEditMode ? form.classIds[0] || "" : form.classIds}
                label={isEditMode ? "Class" : "Class (Multiple Selection)"}
                onChange={(e) => {
                  const value = e.target.value;
                  handleChange("classIds", isEditMode ? [String(value)] : value);
                }}
                renderValue={
                  isEditMode
                    ? undefined
                    : (selected) => (
                        <MDBox sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
                          {selected.map((value) => {
                            const classItem = classes.find((c) => Number(c.id) === Number(value));
                            return (
                              <Chip
                                key={value}
                                label={classItem?.name || value}
                                size="small"
                                sx={{ fontSize: "0.875rem" }}
                              />
                            );
                          })}
                        </MDBox>
                      )
                }
                sx={selectSx}
              >
                {classes.map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.classIds && (
                <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.classIds}
                </MDTypography>
              )}
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <MDInput
              label="Rate(%)"
              type="number"
              value={form.rate}
              onChange={(e) => handleChange("rate", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.rate}
              helperText={errors.rate}
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                value={form.status !== undefined ? form.status : true}
                label="Status"
                onChange={(e) => handleChange("status", e.target.value)}
                sx={selectSx}
              >
                <MenuItem value={true}>Active</MenuItem>
                <MenuItem value={false}>Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <MDInput
              label="Description"
              type="text"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              fullWidth
              size="small"
              required
              multiline
              rows={3}
              error={!!errors.description}
              helperText={errors.description || `${form.description.length}/250 characters`}
              inputProps={{ maxLength: 250 }}
              sx={inputSx}
            />
          </Grid>

          {/* Attachments - File Upload */}
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
                Attachments (Max 2 files total)
              </MDTypography>

              {/* Existing uploaded files (read-only) */}
              {initialData && initialData.id && (
                <>
                  {loadingExistingFiles ? (
                    <MDBox display="flex" justifyContent="center" py={1}>
                      <CurrencyLoading size={20} />
                    </MDBox>
                  ) : (
                    existingFiles.length > 0 && (
                      <MDBox mb={2}>
                        <MDTypography
                          variant="caption"
                          color="text"
                          sx={{ display: "block", mb: 1 }}
                        >
                          Already uploaded files ({existingFiles.length}/2):
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
                </>
              )}

              {/* New files to upload */}
              {existingFiles.length >= 2 ? (
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
                    Maximum 2 files already uploaded. Please delete existing files to upload new
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
                    disabled={existingFiles.length + selectedFiles.length >= 2 || isUploading}
                  />
                  <label htmlFor="file-upload-input">
                    <MDButton
                      variant="gradient"
                      color="info"
                      component="span"
                      disabled={existingFiles.length + selectedFiles.length >= 2 || isUploading}
                      sx={{
                        mb: 2,
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
                      Upload Files ({existingFiles.length + selectedFiles.length}/2)
                    </MDButton>
                  </label>
                  {existingFiles.length + selectedFiles.length < 2 && (
                    <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                      You can upload {2 - (existingFiles.length + selectedFiles.length)} more
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
                  No files selected. Click &quot;Upload Files&quot; to add attachments.
                </MDTypography>
              )}
            </MDBox>
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

RentalValueRateForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  classes: PropTypes.array.isRequired,
  commands: PropTypes.array.isRequired,
  bases: PropTypes.array.isRequired,
  onUploadSuccess: PropTypes.func,
};

export default function RentalValueRate() {
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [gridPageSize, setGridPageSize] = useState(GRID_DISPLAY_DEFAULT_PAGE_SIZE);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);
  const [attachmentsForId, setAttachmentsForId] = useState(null);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [groupByColumns, setGroupByColumns] = useState(RENTAL_VALUE_RATE_DEFAULT_GROUP_BY_COLUMNS);
  const isSuperUser =
    String(getLoggedInUsername() || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "") === "superuser";

  const handleToggleGroup = (groupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) {
        next.delete(groupKey);
      } else {
        next.add(groupKey);
      }
      return next;
    });
  };

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupByColumns]);

  const getAttachmentPath = (file) =>
    file?.Path ||
    file?.path ||
    file?.filePath ||
    file?.file_path ||
    file?.downloadUrl ||
    file?.fileUrl ||
    file?.url ||
    "";

  const refreshAttachments = async (recordId) => {
    const response = await uploadApi.getUploadedFiles(recordId, "RentalValueRate");
    const filesArray = response?.files || (Array.isArray(response) ? response : []);
    const normalized = filesArray
      .map((f) => {
        if (typeof f === "string") {
          return {
            fileName: f.split(/[\\/]/).pop(),
            downloadUrl: f,
          };
        }
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl =
          f?.Path || f?.path || f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || "";
        return { ...f, fileName, downloadUrl };
      })
      .filter((f) => getAttachmentPath(f));
    setAttachmentsFiles(normalized);
  };

  const fetchRentalValueRates = useCallback(async () => {
    setLoading(true);
    try {
      const response = await rentalValueRateApi.getAllRecords();
      const data = response?.data ?? (Array.isArray(response) ? response : []);
      const arr = Array.isArray(data) ? data : [];

      setTableRows(arr);
      setTotalCount(Number(response?.pagination?.totalCount ?? arr.length));
    } catch (error) {
      console.error("Error fetching rental value rates:", error);
      setTableRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchClasses = async () => {
    try {
      const response = await api.list("class");
      setClasses(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchCommands = async () => {
    try {
      const response = await api.list("command");
      setCommands(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching commands:", error);
    }
  };

  const fetchBases = async () => {
    try {
      const response = await api.list("base");
      setBases(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching bases:", error);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchCommands();
    fetchBases();
  }, []);

  useEffect(() => {
    fetchRentalValueRates();
  }, [fetchRentalValueRates]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditRecord = (id) => {
    // Handle both camelCase and PascalCase for id lookup
    const record = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!record) {
      console.error("Record not found for id:", id);
      return;
    }
    if ((record.deactiveDate ?? record.DeactiveDate) && !isSuperUser) {
      alert("Deactive date already exists contact Administrator");
      return;
    }
    // Handle both camelCase and PascalCase for all fields
    const applicableDate = record.applicableDate ?? record.ApplicableDate ?? null;
    const applicationDate = record.applicationDate ?? record.ApplicationDate ?? null;
    const deactiveDate = record.deactiveDate ?? record.DeactiveDate ?? null;
    const cmdId = record.cmdId ?? record.CmdId ?? "";
    const baseId = record.baseId ?? record.BaseId ?? "";
    const classId = record.classId ?? record.ClassId ?? "";
    const rate = record.rate ?? record.Rate ?? "";
    const description = record.description ?? record.Description ?? "";
    const status = record.status ?? record.Status ?? true;

    setCurrentRecord({
      ...record,
      id: record.id ?? record.Id,
      applicableDate: applicableDate
        ? typeof applicableDate === "string"
          ? applicableDate.split("T")[0]
          : applicableDate
        : applicationDate
        ? typeof applicationDate === "string"
          ? applicationDate.split("T")[0]
          : applicationDate
        : "",
      deactiveDate: deactiveDate
        ? typeof deactiveDate === "string"
          ? deactiveDate.split("T")[0]
          : String(deactiveDate).split("T")[0]
        : "",
      cmdId: cmdId || "",
      baseId: baseId || "",
      classId: classId || "",
      rate: rate || "",
      description: description || "",
      status: status !== undefined ? Boolean(status) : true,
    });
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      await rentalValueRateApi.remove(recordToDelete);
      fetchRentalValueRates();
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting rental value rate:", error);
      alert("Failed to delete rental value rate. Please try again.");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleOpenAttachments = async (recordId) => {
    if (!recordId) return;
    setAttachmentsForId(recordId);
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    try {
      await refreshAttachments(recordId);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleDeleteAttachment = async (file) => {
    if (!canDeleteCurrentMenu()) return;
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      alert("File ID is not available. Cannot delete this file.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file.fileName || file.name || "this file"}"?`
    );
    if (!confirmDelete) return;

    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (attachmentsForId) {
        setAttachmentsLoading(true);
        await refreshAttachments(attachmentsForId);
      } else {
        setAttachmentsFiles((prev) => prev.filter((f) => (f?.id || f?.fileId) !== fileId));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(`Failed to delete file: ${error.message}`);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsFiles([]);
    setAttachmentsForId(null);
  };

  const handleSubmit = async (data) => {
    try {
      if (currentRecord && currentRecord.id) {
        if (Array.isArray(data) && data.length > 0) {
          await rentalValueRateApi.update(currentRecord.id, data[0]);
          const createdIds = [];
          for (let i = 1; i < data.length; i += 1) {
            const r = await rentalValueRateApi.create(data[i]);
            const nid =
              r?.Id ||
              r?.id ||
              r?.data?.Id ||
              r?.data?.id ||
              (Array.isArray(r?.data) ? r.data[0]?.Id || r.data[0]?.id : null);
            if (nid) createdIds.push(nid);
          }
          await fetchRentalValueRates();
          handleCloseForm();
          return { ids: [currentRecord.id, ...createdIds], id: currentRecord.id };
        }
        await rentalValueRateApi.update(currentRecord.id, data);
      } else {
        const payloads = Array.isArray(data) ? data : [data];
        const createResults = [];
        const batchSize = 5;
        for (let i = 0; i < payloads.length; i += batchSize) {
          const batch = payloads.slice(i, i + batchSize);
          const batchResults = await Promise.all(
            batch.map((item) => rentalValueRateApi.create(item))
          );
          createResults.push(...batchResults);
        }
        const ids = createResults
          .map(
            (result) =>
              result?.Id ||
              result?.id ||
              result?.data?.Id ||
              result?.data?.id ||
              (Array.isArray(result?.data) ? result?.data[0]?.Id || result?.data[0]?.id : null)
          )
          .filter(Boolean);
        await fetchRentalValueRates();
        handleCloseForm();
        return { ids, id: ids[0] };
      }
      fetchRentalValueRates();
      handleCloseForm();
    } catch (error) {
      console.error("Error saving rental value rate:", error);
      throw error;
    }
  };

  // Format date for display as dd-MMM-yyyy (e.g., 10-Feb-2026)
  const formatDateDDMMMYYYY = (dateString) => {
    if (!dateString) return "";
    const raw = String(dateString).trim();
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
    } catch (e) {
      return dateString;
    }
  };

  // Excel export cell formatter to format dates as dd-mmm-yyyy
  const exportCellFormatter = ({ value, column }) => {
    const colId = String(column?.id || "").toLowerCase();
    if (colId === "applicabledate" || colId === "applicationdate" || colId === "deactivedate") {
      return formatDateDDMMMYYYY(value);
    }
    return value;
  };

  const columns = [
    {
      Header: "Action",
      accessor: "actions",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isGroupRow) {
          // eslint-disable-next-line react/prop-types
          const groupKey = row.original.groupKey;
          const isExpanded = expandedGroups.has(groupKey);
          return (
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
                onClick={() => handleToggleGroup(groupKey)}
                title={isExpanded ? "Collapse" : "Expand"}
                sx={{ padding: "1px" }}
              >
                <Icon>{isExpanded ? "expand_less" : "expand_more"}</Icon>
              </IconButton>
            </MDBox>
          );
        }
        // eslint-disable-next-line react/prop-types
        return row.original.actions;
      },
    },
    {
      Header: "Attach",
      accessor: "attachments",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isGroupRow) {
          return "";
        }
        // eslint-disable-next-line react/prop-types
        return row.original.attachments;
      },
    },
    {
      Header: "RAC",
      accessor: "cmdName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const cmdId = row?.original?.cmdId ?? row?.original?.CmdId ?? null;
        if (!cmdId) return withGridValueChip(value || "-", "rac", { row });
        const cmdItem = commands.find((c) => Number(c.id) === Number(cmdId));
        return withGridValueChip(cmdItem ? cmdItem.name : value || "-", "rac", { row });
      },
    },
    {
      Header: "Base",
      accessor: "baseName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        if (row?.original?.isGroupRow) {
          return value || "-";
        }
        const baseId = row?.original?.baseId ?? row?.original?.BaseId ?? null;
        if (!baseId) return withGridValueChip(value || "-", "base", { row });
        const baseItem = bases.find((b) => Number(b.id) === Number(baseId));
        return withGridValueChip(baseItem ? baseItem.name : value || "-", "base", { row });
      },
    },
    {
      id: "applicableDate",
      Header: "Application Date",
      accessor: "applicableDate",
      align: "left",
      filter: "applicationDateCompare",
      Filter: ApplicationDateColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Support both camelCase and PascalCase field names
        const rowData = row?.original || {};
        const dateValue =
          value ||
          rowData.applicableDate ||
          rowData.ApplicableDate ||
          rowData.applicationDate ||
          rowData.ApplicationDate ||
          "";
        return formatDateDDMMMYYYY(dateValue);
      },
    },
    {
      id: "deactiveDate",
      Header: "Deactive Date",
      accessor: "deactiveDate",
      align: "left",
      filter: "applicationDateCompare",
      Filter: ApplicationDateColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const rowData = row?.original || {};
        const dateValue = value || rowData.deactiveDate || rowData.DeactiveDate || "";
        return formatDateDDMMMYYYY(dateValue) || "-";
      },
    },
    {
      Header: "Class",
      accessor: "className",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        if (row?.original?.isGroupRow) {
          return value || "-";
        }
        const classId = row?.original?.classId ?? row?.original?.ClassId ?? null;
        if (!classId) return withGridValueChip(value || "-", "class", { row });
        const classItem = classes.find((c) => Number(c.id) === Number(classId));
        return withGridValueChip(classItem ? classItem.name : value || "-", "class", { row });
      },
    },
    {
      id: "rate",
      Header: "Rate(%)",
      accessor: "rate",
      align: "right",
      filter: "rentalValueRateMoneyCompare",
      Filter: RentalValueRateMoneyColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        if (row?.original?.isGroupRow) {
          const r = row?.original?.rate ?? row?.original?.Rate;
          if (r === null || r === undefined || r === "") return "";
          const n = Number(r);
          return Number.isFinite(n) ? `${n.toLocaleString()}%` : "";
        }
        return value ? `${Number(value).toLocaleString()}%` : "-";
      },
    },
    { Header: "Description", accessor: "description", align: "left" },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        /* eslint-disable react/prop-types -- react-table row.original */
        if (row.original.isExpandedRow) {
          const statusValue = row.original.status;
          return <StatusBadge value={statusValue} />;
        }
        if (
          row.original.isGroupRow &&
          row.original.statuses &&
          Array.isArray(row.original.statuses)
        ) {
          if (row.original.statuses.length > 1) {
            return "";
          }
          if (row.original.statuses.length === 1) {
            return <StatusBadge value={row.original.statuses[0]} />;
          }
          return "";
        }
        /* eslint-enable react/prop-types */
        return <StatusBadge value={value} />;
      },
    },
  ];

  const computedRows = useMemo(() => {
    const enrichedRows = tableRows.map((row, index) => {
      // Normalize id and foreign keys (handle both camelCase and PascalCase)
      const normalizedId = row?.id ?? row?.Id;
      const sno = index + 1;
      const classId = row.classId ?? row.ClassId;
      const cmdId = row.cmdId ?? row.CmdId;
      const baseId = row.baseId ?? row.BaseId;

      const classItem = classes.find((c) => Number(c.id) === Number(classId));
      const cmdItem = commands.find((c) => Number(c.id) === Number(cmdId));
      const baseItem = bases.find((b) => Number(b.id) === Number(baseId));

      // Check IsAttachment field (handle both camelCase and PascalCase)
      const rawIsAttachment = row?.IsAttachment ?? row?.isAttachment;
      const countValue =
        row?.attachmentCount ??
        row?.attachmentsCount ??
        row?.filesCount ??
        row?.AttachmentCount ??
        row?.AttachmentsCount ??
        row?.FilesCount;

      // Determine if attachments exist
      const hasAttachmentData =
        rawIsAttachment === true ||
        rawIsAttachment === 1 ||
        rawIsAttachment === "1" ||
        String(rawIsAttachment || "")
          .trim()
          .toLowerCase() === "true" ||
        Number(countValue || 0) > 0;

      return {
        ...row,
        id: normalizedId,
        sno: sno,
        cmdId: cmdId,
        baseId: baseId,
        classId: classId,
        cmdName: cmdItem?.name ?? row.cmdName ?? row.CmdName ?? row.cmdname ?? "",
        baseName: baseItem?.name ?? row.baseName ?? row.BaseName ?? row.basename ?? "",
        className: classItem?.name ?? row.className ?? row.ClassName ?? row.classname ?? "",
        rate: row.rate ?? row.Rate ?? 0,
        description: row.description ?? row.Description ?? "",
        status: row.status ?? row.Status ?? true,
        applicableDate:
          row.applicableDate ??
          row.ApplicableDate ??
          row.applicationDate ??
          row.ApplicationDate ??
          "",
        attachments: (
          <IconButton
            size="small"
            color={hasAttachmentData ? "success" : "error"}
            onClick={() => handleOpenAttachments(normalizedId)}
            title="View Attachments"
            sx={{ padding: "1px" }}
          >
            <Icon>visibility</Icon>
          </IconButton>
        ),
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
                onClick={() => handleEditRecord(normalizedId)}
                title="Edit"
                sx={{ padding: "1px", color: "#2563eb !important", opacity: "1 !important" }}
              >
                <Icon sx={{ color: "#2563eb" }}>edit</Icon>
              </IconButton>
            )}
            {canDeleteCurrentMenu() && (
              <IconButton
                size="small"
                onClick={() => handleDeleteRecord(normalizedId)}
                title="Delete"
                sx={{ padding: "1px", color: "#dc2626 !important", opacity: "1 !important" }}
              >
                <Icon sx={{ color: "#dc2626" }}>delete</Icon>
              </IconButton>
            )}
          </MDBox>
        ),
      };
    });

    if (!Array.isArray(groupByColumns) || groupByColumns.length === 0) {
      return enrichedRows.map((row) => ({
        ...row,
        isGroupRow: false,
        isExpandedRow: false,
      }));
    }

    const getGroupValue = (row, columnKey) => {
      const raw = row?.[columnKey];
      if (raw === null || raw === undefined || raw === "") return "-";
      if (columnKey === "applicableDate" || columnKey === "deactiveDate") {
        return formatDateDDMMMYYYY(raw) || "-";
      }
      if (columnKey === "status") return raw ? "Active" : "Inactive";
      if (columnKey === "rate") {
        const n = Number(raw);
        return Number.isFinite(n) ? `${n.toLocaleString()}%` : String(raw);
      }
      return String(raw);
    };

    const byKey = new Map();
    enrichedRows.forEach((r) => {
      const groupValues = groupByColumns.map((columnKey) => getGroupValue(r, columnKey));
      const k = groupValues.join(" || ");
      if (!byKey.has(k)) {
        const groupLabel = groupByColumns
          .map((columnKey, idx) => {
            const label =
              RENTAL_VALUE_RATE_GROUPING_COLUMN_OPTIONS.find((opt) => opt.value === columnKey)
                ?.label || columnKey;
            return `${label}: ${groupValues[idx]}`;
          })
          .join(" | ");
        byKey.set(k, { label: groupLabel, rows: [] });
      }
      byKey.get(k).rows.push(r);
    });

    const sortedKeys = Array.from(byKey.keys()).sort((ka, kb) => {
      const a = byKey.get(ka).rows[0];
      const b = byKey.get(kb).rows[0];
      const d = String(a.applicableDate || "").localeCompare(String(b.applicableDate || ""));
      if (d !== 0) return d;
      return String(a.cmdName || "").localeCompare(String(b.cmdName || ""));
    });

    const result = [];
    let topSno = 0;
    sortedKeys.forEach((gk) => {
      const group = byKey.get(gk);
      const gRows = group.rows;
      const snoValue = ++topSno;

      const firstRow = gRows[0];
      const isExpanded = expandedGroups.has(gk);
      const statusesSet = new Set();
      gRows.forEach((gr) => {
        const sv = gr.status !== undefined && gr.status !== null ? Boolean(gr.status) : null;
        if (sv !== null) statusesSet.add(sv);
      });
      const statusArray = Array.from(statusesSet).sort((a, b) => {
        if (a === b) return 0;
        return a ? -1 : 1;
      });

      const classNameSet = new Set();
      gRows.forEach((gr) => {
        const n = gr.className || "";
        if (n) classNameSet.add(n);
      });
      const classNamesJoined = Array.from(classNameSet).sort().join(", ");

      const baseNameSet = new Set();
      gRows.forEach((gr) => {
        const n = gr.baseName || "";
        if (n) baseNameSet.add(n);
      });
      const baseNamesJoined = Array.from(baseNameSet).sort().join(", ");

      let uniformGroupRate = null;
      const rateTokens = gRows.map((gr) => {
        const rv = gr.rate ?? gr.Rate;
        if (rv === null || rv === undefined || rv === "") return "__E__";
        const n = Number(rv);
        return Number.isFinite(n) ? String(n) : "__BAD__";
      });
      if (!rateTokens.includes("__BAD__")) {
        const uniq = new Set(rateTokens);
        if (uniq.size === 1 && !uniq.has("__E__")) {
          uniformGroupRate = Number([...uniq][0]);
        }
      }

      const safeId = gk.replace(/[^a-zA-Z0-9_|.-]/g, "_");
      result.push({
        ...firstRow,
        id: `group-${safeId}`,
        sno: snoValue,
        cmdName: groupByColumns.includes("cmdName") ? firstRow.cmdName : group.label,
        baseName: groupByColumns.includes("baseName") ? firstRow.baseName : baseNamesJoined,
        baseId: null,
        BaseId: null,
        className: groupByColumns.includes("className") ? firstRow.className : classNamesJoined,
        classId: null,
        ClassId: null,
        rate: groupByColumns.includes("rate") ? firstRow.rate : uniformGroupRate,
        Rate: groupByColumns.includes("rate") ? firstRow.rate : uniformGroupRate,
        description: groupByColumns.includes("description") ? firstRow.description : "",
        applicableDate: groupByColumns.includes("applicableDate") ? firstRow.applicableDate : "",
        deactiveDate: groupByColumns.includes("deactiveDate") ? firstRow.deactiveDate : "",
        isGroupRow: true,
        isExpandedRow: false,
        groupKey: gk,
        groupLabel: group.label,
        groupRows: gRows,
        statuses: statusArray,
        status: statusArray.length === 1 ? statusArray[0] : statusArray,
      });

      if (isExpanded) {
        gRows.forEach((row) => {
          result.push({
            ...row,
            sno: "",
            isGroupRow: false,
            isExpandedRow: true,
            groupKey: gk,
          });
        });
      }
    });

    return result;
  }, [tableRows, classes, commands, bases, expandedGroups, groupByColumns]);

  const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: displayTotal,
      }),
    [displayTotal]
  );

  const handleGridPageSizeChange = useCallback((value) => {
    setGridPageSize(Number(value));
  }, []);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Rental Value Rate"
        subtitle="Manage rental value rate configuration"
        tabs={<ConfigurationModuleTabs />}
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
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "auto",
          },
          "& .MuiTable-root": {
            tableLayout: "auto",
            width: "max-content",
            borderCollapse: "collapse",
          },
          "& .MuiTable-root th": {
            fontSize: "0.875rem !important",
            fontWeight: "700 !important",
            width: "auto !important",
            minWidth: "0 !important",
            padding: "8px 10px !important",
            borderBottom: "1px solid #d0d0d0",
            whiteSpace: "nowrap",
          },
          "& .MuiTable-root td": {
            width: "auto !important",
            minWidth: "0 !important",
            padding: "8px 10px !important",
            borderBottom: "1px solid #e0e0e0",
            whiteSpace: "nowrap",
          },
        }}
      >
        <DataTable
          table={{
            columns,
            rows: computedRows,
          }}
          isSorted={false}
          stickyToolbarAndHeader
          entriesPerPage={{
            defaultValue: GRID_DISPLAY_DEFAULT_PAGE_SIZE,
            entries: [10, 25, 50, 100],
          }}
          pageSize={gridPageSize}
          onEntriesPerPageChange={handleGridPageSizeChange}
          showTotalEntries={false}
          noEndBorder
          canSearch
          autoResetFilters={false}
          exportFileName="Rental-Value-Rate"
          exportCellFormatter={exportCellFormatter}
          extraFilterTypes={CONFIG_DATATABLE_APPLICATION_DATE_FILTER_TYPES}
          contentFitTable
          disableHeaderMetrics
          toolbarStartInHeader
          toolbarStart={
            <CompactGroupBySelect
              options={RENTAL_VALUE_RATE_GROUPING_COLUMN_OPTIONS}
              value={groupByColumns}
              onChange={setGroupByColumns}
            />
          }
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>

      <RentalValueRateForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        classes={classes}
        commands={commands}
        bases={bases}
        onUploadSuccess={() => {
          fetchRentalValueRates();
        }}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this record?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={attachmentsDialogOpen} onClose={handleCloseAttachments} fullWidth maxWidth="sm">
        <DialogTitle>Attachments {attachmentsForId ? `(#${attachmentsForId})` : ""}</DialogTitle>
        <DialogContent dividers>
          {attachmentsLoading ? (
            <MDBox display="flex" justifyContent="center" py={2}>
              <CurrencyLoading size={28} />
            </MDBox>
          ) : attachmentsFiles.length > 0 ? (
            <MDBox display="flex" flexDirection="column" gap={1}>
              {attachmentsFiles.map((f, idx) => (
                <MDBox
                  key={`${f.fileName || "file"}-${idx}`}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={() => {
                      uploadApi
                        .downloadFile(f, f.fileName || `File-${idx + 1}`)
                        .catch((e) => alert(`Download failed: ${e.message}`));
                    }}
                    sx={{ justifyContent: "flex-start", flex: 1 }}
                  >
                    <Icon sx={{ mr: 1 }}>attach_file</Icon>
                    {f.fileName || `File ${idx + 1}`}
                  </MDButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteAttachment(f)}
                    title="Delete Attachment"
                    disabled={!canDeleteCurrentMenu()}
                    sx={{ border: "1px solid", borderColor: "error.main", borderRadius: 1 }}
                  >
                    <Icon>delete</Icon>
                  </IconButton>
                </MDBox>
              ))}
            </MDBox>
          ) : (
            <MDTypography variant="body2" color="text">
              No attachments found for this record.
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseAttachments} variant="gradient" color="info">
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
