import React, { useState, useEffect, useMemo, useRef } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Chip from "@mui/material/Chip";
import Popover from "@mui/material/Popover";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import Divider from "@mui/material/Divider";
import Autocomplete from "@mui/material/Autocomplete";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import DataTable from "examples/Tables/DataTable";
import CurrencyLoading from "components/CurrencyLoading";
import MDBadge from "components/MDBadge";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import PropTypes from "prop-types";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  getLoggedInUsername,
} from "services/api.service";
import sharingFormulaApi from "services/api.sharingformula.service";
import { format, parseISO, isValid } from "date-fns";

const CONFIG_GRID_APPLICATION_DATE_FALLBACK_KEYS = {
  applicableDate: ["applicableDate", "ApplicableDate", "applicationDate", "ApplicationDate"],
  deactiveDate: ["deactiveDate", "DeactiveDate"],
};

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

ApplicationDateColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const CONFIG_GRID_FORMULA_MONEY_FALLBACK_KEYS = {
  baseShare: ["baseShare", "baseRate", "BaseRate"],
  commandShare: ["commandShare", "racRate", "RACRate"],
  ahqShare: ["ahqShare", "ahqRate", "AHQRate"],
};

function normalizeSharingFormulaMoneyRawToNumber(raw) {
  if (raw === undefined || raw === null) return null;
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  const s = String(raw).trim();
  if (s === "") return null;
  const n = Number(s.replace(/,/g, "").replace(/%/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

function parseSharingFormulaGridRowMoneyNumber(row, columnId) {
  let raw = row?.values?.[columnId];
  const o = row?.original;
  const fallbacks = CONFIG_GRID_FORMULA_MONEY_FALLBACK_KEYS[columnId] || [];
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
  return normalizeSharingFormulaMoneyRawToNumber(raw);
}

function sharingFormulaMoneyApproxEqual(a, b) {
  const scale = Math.max(Math.abs(a), Math.abs(b), 1);
  return Math.abs(a - b) <= 1e-6 * scale;
}

function sharingFormulaGridMoneyCompare(rowsToFilter, id, filterValue) {
  if (!filterValue || filterValue.mode === "none") return rowsToFilter;
  const columnId = Array.isArray(id) ? id[0] : id;
  return rowsToFilter.filter((row) => {
    const rowN = parseSharingFormulaGridRowMoneyNumber(row, columnId);
    if (rowN === null) return false;
    const { mode } = filterValue;
    if (mode === "gt") {
      const ref = normalizeSharingFormulaMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rowN > ref;
    }
    if (mode === "lte") {
      const ref = normalizeSharingFormulaMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return rowN <= ref;
    }
    if (mode === "eq") {
      const ref = normalizeSharingFormulaMoneyRawToNumber(filterValue.value);
      if (ref === null) return false;
      return sharingFormulaMoneyApproxEqual(rowN, ref);
    }
    if (mode === "between") {
      const a = normalizeSharingFormulaMoneyRawToNumber(filterValue.valueFrom);
      const b = normalizeSharingFormulaMoneyRawToNumber(filterValue.valueTo);
      if (a === null || b === null) return false;
      const low = Math.min(a, b);
      const high = Math.max(a, b);
      return rowN >= low && rowN <= high;
    }
    return true;
  });
}

function SharingFormulaMoneyColumnFilter({ column }) {
  const colLabel =
    typeof column?.Header === "string" && column.Header.trim() ? column.Header.trim() : "Amount";
  const modeLabelId = `sharing-formula-money-filter-mode-${column.id || "col"}`;

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

SharingFormulaMoneyColumnFilter.propTypes = {
  column: PropTypes.object.isRequired,
};

const CONFIG_DATATABLE_APPLICATION_DATE_FILTER_TYPES = Object.freeze({
  applicationDateCompare: configGridApplicationDateCompare,
  sharingFormulaMoneyCompare: sharingFormulaGridMoneyCompare,
});

/** Description column: first 30 characters; click … for full text in a popover. */
function DescriptionTableCell({ value }) {
  const [anchor, setAnchor] = useState(null);
  const text = value != null && String(value).trim() !== "" ? String(value) : "-";
  const hasContent = text !== "-";
  const showMore = hasContent && text.length > 30;
  const displayText = showMore ? text.slice(0, 30) : text;

  return (
    <MDBox display="flex" alignItems="flex-start" gap={0.25} sx={{ maxWidth: "100%", minWidth: 0 }}>
      <MDBox
        component="span"
        sx={{
          flex: 1,
          minWidth: 0,
          overflow: "hidden",
          wordBreak: "break-word",
          fontSize: "0.875rem",
          fontWeight: 400,
          lineHeight: "inherit",
          color: "#111111 !important",
        }}
      >
        {hasContent ? displayText : "-"}
      </MDBox>
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
              alignSelf: "flex-end",
              textDecoration: "underline",
            }}
            aria-label="Show full description"
          >
            …
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

DescriptionTableCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.oneOf([null])]),
};

function SharingFormulaForm({ open, onClose, onSubmit, classes, commands, bases, initialData }) {
  const [form, setForm] = useState({
    applicableDate: "",
    deactiveDate: "",
    cmdId: "",
    baseIds: [],
    classIds: [],
    baseShare: "",
    commandShare: "",
    ahqShare: "",
    description: "",
    status: true,
  });
  const [errors, setErrors] = useState({});
  const [filteredBases, setFilteredBases] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
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
        console.error("Error serializing sharing formula API response:", serializationError);
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

    return "Failed to save sharing formula. Please try again.";
  };

  // Filter bases based on selected command
  useEffect(() => {
    if (form.cmdId && bases.length > 0) {
      const filtered = bases.filter((base) => Number(base.cmd) === Number(form.cmdId));
      setFilteredBases(filtered);
      // Keep only valid selected bases for current command.
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
    if (!open) {
      // Reset form when dialog closes
      setForm({
        applicableDate: "",
        deactiveDate: "",
        cmdId: "",
        baseIds: [],
        classIds: [],
        baseShare: "",
        commandShare: "",
        ahqShare: "",
        description: "",
        status: true,
      });
      setErrors({});
    }
  }, [open]);

  // Populate form when editing
  useEffect(() => {
    if (open && initialData) {
      // Convert status to boolean if it's a string (strictly PascalCase)
      let statusValue = true;
      if (initialData.Status !== undefined) {
        if (typeof initialData.Status === "boolean") {
          statusValue = initialData.Status;
        } else if (typeof initialData.Status === "string") {
          statusValue =
            initialData.Status === "true" ||
            initialData.Status === "True" ||
            initialData.Status === "1";
        } else {
          statusValue = Boolean(initialData.Status);
        }
      } else if (initialData.status !== undefined) {
        // Fallback for camelCase (shouldn't happen but just in case)
        if (typeof initialData.status === "boolean") {
          statusValue = initialData.status;
        } else if (typeof initialData.status === "string") {
          statusValue =
            initialData.status === "true" ||
            initialData.status === "True" ||
            initialData.status === "1";
        } else {
          statusValue = Boolean(initialData.status);
        }
      }

      // Format date for date input (YYYY-MM-DD format)
      let formattedDate = "";
      if (initialData.ApplicableDate) {
        try {
          const date = new Date(initialData.ApplicableDate);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            formattedDate = `${year}-${month}-${day}`;
          }
        } catch (e) {
          // If date parsing fails, try to extract from string
          if (typeof initialData.ApplicableDate === "string") {
            formattedDate = initialData.ApplicableDate.split("T")[0] || "";
          }
        }
      } else if (initialData.applicableDate) {
        // Fallback for camelCase
        try {
          const date = new Date(initialData.applicableDate);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const day = String(date.getDate()).padStart(2, "0");
            formattedDate = `${year}-${month}-${day}`;
          }
        } catch (e) {
          if (typeof initialData.applicableDate === "string") {
            formattedDate = initialData.applicableDate.split("T")[0] || "";
          }
        }
      }

      // Format DeactiveDate for date input (YYYY-MM-DD)
      let formattedDeactiveDate = "";
      const deactiveRaw = initialData.DeactiveDate ?? initialData.deactiveDate ?? "";
      if (deactiveRaw) {
        try {
          const date = new Date(deactiveRaw);
          if (!isNaN(date.getTime())) {
            formattedDeactiveDate = date.toISOString().split("T")[0];
          } else if (typeof deactiveRaw === "string") {
            formattedDeactiveDate = deactiveRaw.split("T")[0] || "";
          }
        } catch (e) {
          if (typeof deactiveRaw === "string") {
            formattedDeactiveDate = deactiveRaw.split("T")[0] || "";
          }
        }
      }

      // Get classIds - handle both single value and array (strictly PascalCase)
      let classIdsArray = [];
      if (initialData.ClassId !== undefined && initialData.ClassId !== null) {
        if (Array.isArray(initialData.ClassId)) {
          classIdsArray = initialData.ClassId.map((id) => Number(id));
        } else {
          classIdsArray = [Number(initialData.ClassId)];
        }
      } else if (initialData.classId !== undefined && initialData.classId !== null) {
        // Fallback for camelCase
        if (Array.isArray(initialData.classId)) {
          classIdsArray = initialData.classId.map((id) => Number(id));
        } else {
          classIdsArray = [Number(initialData.classId)];
        }
      }

      setForm({
        applicableDate: formattedDate,
        deactiveDate: formattedDeactiveDate,
        cmdId:
          initialData.CmdId !== undefined && initialData.CmdId !== null
            ? String(initialData.CmdId)
            : initialData.cmdId !== undefined && initialData.cmdId !== null
            ? String(initialData.cmdId)
            : "",
        baseIds:
          initialData.BaseId !== undefined && initialData.BaseId !== null
            ? [String(initialData.BaseId)]
            : initialData.baseId !== undefined && initialData.baseId !== null
            ? [String(initialData.baseId)]
            : [],
        classIds: classIdsArray.map((id) => String(id)),
        baseShare:
          initialData.BaseRate !== undefined && initialData.BaseRate !== null
            ? String(initialData.BaseRate)
            : initialData.baseRate !== undefined && initialData.baseRate !== null
            ? String(initialData.baseRate)
            : initialData.baseShare !== undefined && initialData.baseShare !== null
            ? String(initialData.baseShare)
            : "",
        commandShare:
          initialData.RACRate !== undefined && initialData.RACRate !== null
            ? String(initialData.RACRate)
            : initialData.racRate !== undefined && initialData.racRate !== null
            ? String(initialData.racRate)
            : initialData.commandShare !== undefined && initialData.commandShare !== null
            ? String(initialData.commandShare)
            : "",
        ahqShare:
          initialData.AHQRate !== undefined && initialData.AHQRate !== null
            ? String(initialData.AHQRate)
            : initialData.ahqRate !== undefined && initialData.ahqRate !== null
            ? String(initialData.ahqRate)
            : initialData.ahqShare !== undefined && initialData.ahqShare !== null
            ? String(initialData.ahqShare)
            : "",
        description: initialData.Description || initialData.description || "",
        status: statusValue,
      });
    }
  }, [open, initialData]);

  const handleChange = (field, value) => {
    // Limit description to 250 characters
    if (field === "description" && value.length > 250) {
      return;
    }
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.applicableDate) newErrors.applicableDate = "Application Date is required";
    if (form.applicableDate && form.deactiveDate && form.deactiveDate <= form.applicableDate) {
      newErrors.deactiveDate = "Deactive Date must be after Application Date";
    }
    if (!form.cmdId) newErrors.cmdId = "Command is required";
    if (!form.baseIds || form.baseIds.length === 0) newErrors.baseIds = "Base is required";
    if (!form.classIds || form.classIds.length === 0) {
      newErrors.classIds = "At least one Class is required";
    }
    if (!form.baseShare) newErrors.baseShare = "Base Share is required";
    if (!form.commandShare) newErrors.commandShare = "Command Share is required";
    if (!form.ahqShare) newErrors.ahqShare = "AHQ Share is required";
    if (!form.description?.trim()) newErrors.description = "Description is required";
    if (form.description && form.description.length > 250) {
      newErrors.description = "Description must not exceed 250 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSubmitting(true);
    try {
      const deactiveDateValue = String(form.deactiveDate ?? "").trim()
        ? String(form.deactiveDate).trim()
        : null;

      const selectedBaseIds = Array.isArray(form.baseIds) ? form.baseIds : [];

      // Create array of records for each selected Base x Class combination.
      // Map to match database model column names
      const dataArray = selectedBaseIds.flatMap((baseId) =>
        form.classIds.map((classId) => ({
          ApplicableDate: form.applicableDate,
          DeactiveDate: deactiveDateValue,
          CmdId: Number(form.cmdId),
          BaseId: Number(baseId),
          ClassId: Number(classId), // Keep for multi-class selection logic
          BaseRate: form.baseShare ? Number(form.baseShare) : 0,
          RACRate: form.commandShare ? Number(form.commandShare) : 0,
          AHQRate: form.ahqShare ? Number(form.ahqShare) : 0,
          Description: form.description.trim(),
          Status: form.status !== undefined ? form.status : true,
        }))
      );

      // API accepts array of objects - send all at once
      await onSubmit(dataArray);
      onClose();
    } catch (error) {
      console.error("Error saving sharing formula:", error);
      alert(getSaveErrorMessage(error));
    } finally {
      setIsSubmitting(false);
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
      minHeight: "45px",
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
      minHeight: "45px",
    },
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {initialData ? "Edit Sharing Formula" : "New Sharing Formula"}
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
                  minHeight: "45px",
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
              options={filteredBases}
              getOptionLabel={(option) => option?.name ?? ""}
              isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
              value={(form.baseIds || [])
                .map((id) => filteredBases.find((b) => Number(b.id) === Number(id)))
                .filter(Boolean)}
              onChange={(_, newValue) =>
                handleChange(
                  "baseIds",
                  (newValue || []).map((b) => String(b.id))
                )
              }
              disabled={!form.cmdId}
              ListboxProps={{ style: { maxHeight: 300 } }}
              sx={{
                width: "100%",
                fontSize: "1rem",
                "& .MuiInputBase-root": { minHeight: "45px" },
                "& .MuiOutlinedInput-root": { minHeight: "45px" },
                "& .MuiAutocomplete-inputRoot": {
                  minHeight: "45px",
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
              <InputLabel id="class-label">Class (Multiple Selection)</InputLabel>
              <Select
                labelId="class-label"
                multiple
                value={form.classIds}
                label="Class (Multiple Selection)"
                onChange={(e) => handleChange("classIds", e.target.value)}
                renderValue={(selected) => (
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
                )}
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
              label="Base Share %"
              type="number"
              value={form.baseShare}
              onChange={(e) => handleChange("baseShare", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.baseShare}
              helperText={errors.baseShare}
              inputProps={{ step: "0.01", min: "0", max: "100" }}
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <MDInput
              label="RAC Share %"
              type="number"
              value={form.commandShare}
              onChange={(e) => handleChange("commandShare", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.commandShare}
              helperText={errors.commandShare}
              inputProps={{ step: "0.01", min: "0", max: "100" }}
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <MDInput
              label="AHQ Share %"
              type="number"
              value={form.ahqShare}
              onChange={(e) => handleChange("ahqShare", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.ahqShare}
              helperText={errors.ahqShare}
              inputProps={{ step: "0.01", min: "0", max: "100" }}
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
                onChange={(e) => {
                  // Convert string to boolean if needed
                  const value = e.target.value === "true" || e.target.value === true;
                  handleChange("status", value);
                }}
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
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={isSubmitting}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          disabled={isSubmitting || (isEditMode ? !canEditCurrentMenu() : !canCreateCurrentMenu())}
        >
          <Icon>save</Icon>&nbsp;{isSubmitting ? "Saving..." : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

SharingFormulaForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  classes: PropTypes.array.isRequired,
  commands: PropTypes.array.isRequired,
  bases: PropTypes.array.isRequired,
  initialData: PropTypes.object,
};

export default function SharingFormula() {
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const isSuperUser =
    String(getLoggedInUsername() || "")
      .trim()
      .toLowerCase()
      .replace(/\s+/g, "") === "superuser";

  const fetchSharingFormulas = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await sharingFormulaApi.getAll(page, size);
      const data = response?.data ?? (Array.isArray(response) ? response : []);
      const pagination = response?.pagination;

      setTableRows(Array.isArray(data) ? data : []);
      setTotalCount(Number(pagination?.totalCount || 0));
    } catch (error) {
      console.error("Error fetching sharing formulas:", error);
    } finally {
      setLoading(false);
    }
  };

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
    fetchSharingFormulas(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  const handleOpenForm = () => {
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
  };

  const handleEditRecord = (id) => {
    // Handle both PascalCase and camelCase for ID lookup
    // Find the original record from tableRows (raw API data)
    const record = tableRows.find(
      (r) => (r.Id || r.id) === id || Number(r.Id || r.id) === Number(id)
    );
    if (record) {
      if ((record.DeactiveDate || record.deactiveDate) && !isSuperUser) {
        alert("Deactive date already exists contact Administrator");
        return;
      }
      // Ensure we pass the original record with all PascalCase fields preserved
      setCurrentRecord({
        ...record,
        // Ensure all fields are present in PascalCase
        Id: record.Id || record.id,
        id: record.Id || record.id,
        ApplicableDate: record.ApplicableDate || record.applicableDate,
        DeactiveDate: record.DeactiveDate || record.deactiveDate,
        CmdId: record.CmdId || record.cmdId,
        BaseId: record.BaseId || record.baseId,
        ClassId: record.ClassId || record.classId,
        BaseRate: record.BaseRate || record.baseRate || record.baseShare,
        RACRate: record.RACRate || record.racRate || record.commandShare,
        AHQRate: record.AHQRate || record.ahqRate || record.ahqShare,
        Description: record.Description || record.description,
        Status:
          record.Status !== undefined
            ? record.Status
            : record.status !== undefined
            ? record.status
            : true,
      });
      setOpenForm(true);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!canDeleteCurrentMenu()) return;
    if (window.confirm("Are you sure you want to delete this sharing formula?")) {
      try {
        await sharingFormulaApi.remove(id);
        fetchSharingFormulas(pageNumber, pageSize);
      } catch (error) {
        console.error("Error deleting sharing formula:", error);
        alert("Failed to delete sharing formula. Please try again.");
      }
    }
  };

  const handleToggleGroup = (groupKey) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const handleSubmit = async (dataArray) => {
    try {
      const currentRecordId = currentRecord?.id || currentRecord?.Id;
      const rows = Array.isArray(dataArray) ? dataArray : [];
      if (currentRecordId) {
        if (rows.length > 1) {
          await sharingFormulaApi.update(currentRecordId, rows[0]);
          await sharingFormulaApi.create(rows.slice(1));
        } else if (rows.length === 1) {
          await sharingFormulaApi.update(currentRecordId, rows[0]);
        }
      } else {
        await sharingFormulaApi.create(dataArray);
      }
      fetchSharingFormulas(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving sharing formula:", error);
      throw error; // Re-throw to let form handle it
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
      Header: "Actions",
      accessor: "actions",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isExpandedRow) {
          // eslint-disable-next-line react/prop-types
          const recordId = row.original.Id || row.original.id;
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
                onClick={() => handleEditRecord(recordId)}
                title="Edit"
                sx={{ padding: "1px" }}
                disabled={!canEditCurrentMenu()}
              >
                <Icon>edit</Icon>
              </IconButton>
              <IconButton
                size="small"
                color="error"
                onClick={() => handleDeleteRecord(recordId)}
                title="Delete"
                sx={{ padding: "1px" }}
                disabled={!canDeleteCurrentMenu()}
              >
                <Icon>delete</Icon>
              </IconButton>
            </MDBox>
          );
        }
        return "";
      },
    },
    {
      Header: "",
      accessor: "expand",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isGroupRow) {
          // eslint-disable-next-line react/prop-types
          const groupKey = row.original.groupKey;
          const isExpanded = expandedGroups.has(groupKey);
          return (
            <IconButton
              size="small"
              onClick={() => handleToggleGroup(groupKey)}
              title={isExpanded ? "Collapse" : "Expand"}
            >
              <Icon>{isExpanded ? "expand_less" : "expand_more"}</Icon>
            </IconButton>
          );
        }
        return "";
      },
    },
    {
      Header: "S.No",
      accessor: "sno",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isExpandedRow) {
          return "";
        }
        // eslint-disable-next-line react/prop-types
        return row.original.sno || "-";
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
      Cell: ({ value }) => {
        return formatDateDDMMMYYYY(value);
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
      Cell: ({ value }) => {
        return formatDateDDMMMYYYY(value) || "-";
      },
    },
    {
      Header: "RAC",
      accessor: "cmdName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => {
        return value || "-";
      },
    },
    {
      Header: "Base",
      accessor: "baseName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => {
        return value || "-";
      },
    },
    {
      Header: "Class",
      accessor: "className",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isExpandedRow) {
          // eslint-disable-next-line react/prop-types
          const classId = row.original.classId;
          const classItem = classes.find((c) => Number(c.id) === Number(classId));
          return classItem ? classItem.name : value || "-";
        }
        return value || "-";
      },
    },
    {
      id: "baseShare",
      Header: "BaseRate",
      accessor: "baseShare",
      align: "right",
      filter: "sharingFormulaMoneyCompare",
      Filter: SharingFormulaMoneyColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isExpandedRow) {
          // eslint-disable-next-line react/prop-types
          const rateValue = row.original.baseRate ?? row.original.baseShare ?? value;
          return rateValue !== null && rateValue !== undefined && rateValue !== ""
            ? `${Number(rateValue).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}%`
            : "-";
        }
        // Support both camelCase and PascalCase field names
        const rateValue =
          row.original?.baseRate ?? row.original?.BaseRate ?? row.original?.baseShare ?? value;
        return rateValue !== null && rateValue !== undefined && rateValue !== ""
          ? `${Number(rateValue).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}%`
          : "-";
      },
    },
    {
      id: "commandShare",
      Header: "RACRate",
      accessor: "commandShare",
      align: "right",
      filter: "sharingFormulaMoneyCompare",
      Filter: SharingFormulaMoneyColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isExpandedRow) {
          // eslint-disable-next-line react/prop-types
          const rateValue = row.original.racRate ?? row.original.commandShare ?? value;
          return rateValue !== null && rateValue !== undefined && rateValue !== ""
            ? `${Number(rateValue).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}%`
            : "-";
        }
        // Support both camelCase and PascalCase field names
        const rateValue =
          row.original?.racRate ?? row.original?.RACRate ?? row.original?.commandShare ?? value;
        return rateValue !== null && rateValue !== undefined && rateValue !== ""
          ? `${Number(rateValue).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}%`
          : "-";
      },
    },
    {
      id: "ahqShare",
      Header: "AHQRate",
      accessor: "ahqShare",
      align: "right",
      filter: "sharingFormulaMoneyCompare",
      Filter: SharingFormulaMoneyColumnFilter,
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // eslint-disable-next-line react/prop-types
        if (row.original.isExpandedRow) {
          // eslint-disable-next-line react/prop-types
          const rateValue = row.original.ahqRate ?? row.original.ahqShare ?? value;
          return rateValue !== null && rateValue !== undefined && rateValue !== ""
            ? `${Number(rateValue).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}%`
            : "-";
        }
        // Support both camelCase and PascalCase field names
        const rateValue =
          row.original?.ahqRate ?? row.original?.AHQRate ?? row.original?.ahqShare ?? value;
        return rateValue !== null && rateValue !== undefined && rateValue !== ""
          ? `${Number(rateValue).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}%`
          : "-";
      },
    },
    {
      Header: "Description",
      accessor: "description",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => {
        return <DescriptionTableCell value={value} />;
      },
    },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Helper function to render status badge (same format as class.js)
        const renderStatusBadge = (status) => {
          const s = String(status ?? "")
            .trim()
            .toLowerCase();

          let label = "Inactive";
          if (status === 1 || status === "1" || s === "true" || status === true || s === "active") {
            label = "Active";
          }
          return (
            <MDBox ml={-1}>
              <MDBadge
                badgeContent={label}
                color={label === "Active" ? "success" : "dark"}
                variant="gradient"
                size="sm"
              />
            </MDBox>
          );
        };

        // eslint-disable-next-line react/prop-types
        if (row.original.isExpandedRow) {
          // eslint-disable-next-line react/prop-types
          const statusValue = row.original.Status ?? value;
          return renderStatusBadge(statusValue);
        }
        // eslint-disable-next-line react/prop-types
        if (
          // eslint-disable-next-line react/prop-types
          row.original.isGroupRow &&
          // eslint-disable-next-line react/prop-types
          row.original.statuses &&
          // eslint-disable-next-line react/prop-types
          Array.isArray(row.original.statuses)
        ) {
          // Only display status if all child rows have the same status
          // If statuses array has more than 1 unique value, child rows have different statuses
          // eslint-disable-next-line react/prop-types
          if (row.original.statuses.length > 1) {
            return ""; // Show blank if child rows have different statuses
            // eslint-disable-next-line react/prop-types
          } else if (row.original.statuses.length === 1) {
            // All child rows have the same status, display it
            // eslint-disable-next-line react/prop-types
            const statusValue = row.original.statuses[0];
            return renderStatusBadge(statusValue);
          }
          // If statuses array is empty, show blank
          return "";
        }
        const statusValue = value;
        return renderStatusBadge(statusValue);
      },
    },
  ];

  // Group data by ApplicableDate, CmdId, BaseId and combine classes
  const groupedData = useMemo(() => {
    // First, normalize all rows
    const normalizedRows = tableRows.map((row) => {
      const classId = row.classId ?? row.ClassId;
      const cmdId = row.cmdId ?? row.CmdId;
      const baseId = row.baseId ?? row.BaseId;
      const applicableDate = row.ApplicableDate ?? row.applicableDate;
      const deactiveDate = row.DeactiveDate ?? row.deactiveDate;

      const classItem = classes.find((c) => Number(c.id) === Number(classId));
      const cmdItem = commands.find((c) => Number(c.id) === Number(cmdId));
      const baseItem = bases.find((b) => Number(b.id) === Number(baseId));

      return {
        ...row,
        cmdId: cmdId,
        baseId: baseId,
        classId: classId,
        applicableDate: applicableDate,
        deactiveDate: deactiveDate,
        // Support multiple field name formats from API
        baseShare: row.baseRate ?? row.BaseRate ?? row.baseShare,
        commandShare: row.racRate ?? row.RACRate ?? row.commandShare,
        ahqShare: row.ahqRate ?? row.AHQRate ?? row.ahqShare,
        baseRate: row.baseRate ?? row.BaseRate ?? row.baseShare,
        racRate: row.racRate ?? row.RACRate ?? row.commandShare,
        ahqRate: row.ahqRate ?? row.AHQRate ?? row.ahqShare,
        description: row.Description ?? row.description,
        cmdName: cmdItem?.name || row.cmdName || row.cmdname || "",
        baseName: baseItem?.name || row.baseName || row.basename || "",
        className: classItem?.name || row.className || row.classname || "",
      };
    });

    // Group by ApplicableDate, CmdId, BaseId, BaseRate, AHQRate, RACRate, Description
    const groups = new Map();
    normalizedRows.forEach((row) => {
      // Create group key including all grouping fields
      const baseRate = row.baseRate ?? row.baseShare ?? "";
      const racRate = row.racRate ?? row.commandShare ?? "";
      const ahqRate = row.ahqRate ?? row.ahqShare ?? "";
      const description = row.description || "";

      const groupKey = `${row.applicableDate || ""}_${row.cmdId || ""}_${
        row.baseId || ""
      }_${baseRate}_${racRate}_${ahqRate}_${description}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          applicableDate: row.applicableDate,
          deactiveDate: row.deactiveDate,
          cmdId: row.cmdId,
          baseId: row.baseId,
          cmdName: row.cmdName,
          baseName: row.baseName,
          baseRate: baseRate,
          racRate: racRate,
          ahqRate: ahqRate,
          description: description,
          classNames: [],
          statuses: new Set(), // Use Set to collect unique statuses
          rows: [],
        });
      }
      const group = groups.get(groupKey);
      group.rows.push(row);
      // Collect unique class names
      if (row.className && !group.classNames.includes(row.className)) {
        group.classNames.push(row.className);
      }
      // Collect unique statuses
      const statusValue = row.status !== undefined ? Boolean(row.status) : null;
      if (statusValue !== null) {
        group.statuses.add(statusValue);
      }
    });

    // Convert groups to single rows with comma-separated classes
    const result = [];
    let globalSno = 1;
    // Sort groups by ApplicableDate, then Command, then Base for consistent ordering
    const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
      const [keyA, groupA] = a;
      const [keyB, groupB] = b;
      // Compare by date first
      const dateCompare = (groupA.applicableDate || "").localeCompare(groupB.applicableDate || "");
      if (dateCompare !== 0) return dateCompare;
      // Then by command name
      const cmdCompare = (groupA.cmdName || "").localeCompare(groupB.cmdName || "");
      if (cmdCompare !== 0) return cmdCompare;
      // Then by base name
      return (groupA.baseName || "").localeCompare(groupB.baseName || "");
    });

    sortedGroups.forEach(([groupKey, group]) => {
      // Use the first row's data for other fields (they should be the same within a group)
      const firstRow = group.rows[0];
      const isExpanded = expandedGroups.has(groupKey);

      // Convert statuses Set to array and sort (true first, then false)
      const statusArray = Array.from(group.statuses).sort((a, b) => {
        // Sort: true (Active) first, then false (Inactive)
        if (a === b) return 0;
        return a ? -1 : 1;
      });

      // Add group row with group's rate and description values
      result.push({
        ...firstRow,
        sno: globalSno++,
        className: group.classNames.sort().join(", "), // Comma-separated sorted class names
        baseShare: group.baseRate,
        commandShare: group.racRate,
        ahqShare: group.ahqRate,
        baseRate: group.baseRate,
        racRate: group.racRate,
        ahqRate: group.ahqRate,
        description: group.description,
        status: statusArray.length === 1 ? statusArray[0] : statusArray, // Single status or array of statuses
        statuses: statusArray, // Store array for display
        isGroupRow: true,
        isExpandedRow: false,
        groupKey: groupKey,
        groupRows: group.rows,
      });

      // Add expanded rows if group is expanded
      if (isExpanded) {
        group.rows.forEach((row) => {
          result.push({
            ...row,
            isGroupRow: false,
            isExpandedRow: true,
            groupKey: groupKey,
            sno: "", // Empty sno for expanded rows
          });
        });
      }
    });

    return result;
  }, [tableRows, classes, commands, bases, expandedGroups]);

  const computedRows = groupedData;

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
                  Sharing Formula
                </MDTypography>
                {canCreateCurrentMenu() && (
                  <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                    <Icon>add</Icon>&nbsp;Add New
                  </MDButton>
                )}
              </MDBox>
              <MDBox
                pt={3}
                position="relative"
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  height: "88vh",
                  minHeight: "680px",
                  overflow: "hidden",
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
                    fontSize: "12px !important",
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
                  entriesPerPage={{
                    defaultValue: 20,
                    entries: [10, 25, 50, 100],
                  }}
                  page={pageNumber - 1}
                  pageSize={pageSize}
                  onPageChange={(newPage) => {
                    setPageNumber(newPage + 1);
                    fetchSharingFormulas(newPage + 1, pageSize);
                  }}
                  onEntriesPerPageChange={(value) => {
                    setPageSize(value);
                    setPageNumber(1);
                    fetchSharingFormulas(1, value);
                  }}
                  showTotalEntries={true}
                  noEndBorder
                  canSearch
                  pagination={{ variant: "gradient", color: "info" }}
                  exportFileName="Sharing-Formula"
                  exportCellFormatter={exportCellFormatter}
                  extraFilterTypes={CONFIG_DATATABLE_APPLICATION_DATE_FILTER_TYPES}
                  contentFitTable
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <SharingFormulaForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        classes={classes}
        commands={commands}
        bases={bases}
        initialData={currentRecord}
      />
    </DashboardLayout>
  );
}
