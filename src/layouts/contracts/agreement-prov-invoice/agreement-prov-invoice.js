import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Menu from "@mui/material/Menu";
import Popover from "@mui/material/Popover";
import Divider from "@mui/material/Divider";
import TableContainer from "@mui/material/TableContainer";
import CircularProgress from "@mui/material/CircularProgress";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Autocomplete from "@mui/material/Autocomplete";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import CurrencyLoading from "components/CurrencyLoading";
import PropTypes from "prop-types";
import api from "services/api.service";
import contractApi from "services/api.contract.service";
import { useMaterialUIController } from "context";
import jsPDF from "jspdf";
import { format, parseISO, isValid, addDays, addMonths } from "date-fns";

const AGREEMENT_PROV_GRID_DATE_FALLBACK_KEYS = {
  contractStartDate: ["contractStartDate", "ContractStartDate"],
  contractEndDate: ["contractEndDate", "ContractEndDate"],
  periodStart: ["periodStart", "PeriodStart"],
  periodEnd: ["periodEnd", "PeriodEnd"],
  riseDate: ["riseDate", "RiseDate"],
  invoiceDate: ["invoiceDate", "InvoiceDate", "PeriodStart", "periodStart"],
  dueDate: ["dueDate", "DueDate"],
  contractPeriod: ["contractPeriod", "ContractPeriod", "contractStartDate", "ContractStartDate"],
  period: ["period", "Period", "periodStart", "PeriodStart"],
};

function pickScheduleRowField(rowData, pascalKey, camelKey) {
  const v = rowData?.[pascalKey] ?? rowData?.[camelKey];
  if (v === null || v === undefined) return "";
  return v;
}

function pickScheduleRowIsLocked(rowData) {
  if (!rowData) return false;
  const v = rowData?.IsLocked ?? rowData?.isLocked;
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "string" && v.trim().toLowerCase() === "true") return true;
  return false;
}

function formatScheduleGridNumber(value, integerOnly = false) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const display = integerOnly ? Math.round(n) : n;
  return display.toLocaleString(undefined, integerOnly ? { maximumFractionDigits: 0 } : undefined);
}

function pickScheduleInvoiceDate(rowData) {
  const dateType = String(pickScheduleRowField(rowData, "InvoiceDateType", "invoiceDateType"))
    .trim()
    .toLowerCase();
  if (dateType.includes("end")) {
    return pickScheduleRowField(rowData, "PeriodEnd", "periodEnd");
  }
  return pickScheduleRowField(rowData, "PeriodStart", "periodStart");
}

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

function unwrapContractInvoiceScheduleList(res) {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.data)) return res.data;
  if (Array.isArray(res?.Data)) return res.Data;
  if (Array.isArray(res?.items)) return res.items;
  if (Array.isArray(res?.Items)) return res.Items;
  return [];
}

function readAgreementProvInvoiceUrlParams() {
  const readFromSearch = (searchText) => {
    try {
      const params = new URLSearchParams(String(searchText || ""));
      return {
        contractNo: String(params.get("contractNo") || "").trim(),
        invoiceNo: String(params.get("invoiceNo") || "").trim(),
      };
    } catch {
      return { contractNo: "", invoiceNo: "" };
    }
  };

  if (typeof window === "undefined") return { contractNo: "", invoiceNo: "" };

  const fromSearch = readFromSearch(window.location?.search || "");
  if (fromSearch.contractNo || fromSearch.invoiceNo) return fromSearch;

  const hash = String(window.location?.hash || "");
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0) return readFromSearch(hash.slice(queryIndex));

  return { contractNo: "", invoiceNo: "" };
}

function openContractsFormInNewTab(contractNo) {
  const c = String(contractNo || "").trim();
  if (!c || c === "-") return;
  window.open(`/contracts?contractNo=${encodeURIComponent(c)}&viewDetails=1`, "_blank");
}

const EDIT_INVOICE_LINES_TABLE_COLUMNS = [
  { label: "Order", pascal: "SortOrder", camel: "sortOrder", numeric: true, align: "right" },
  { label: "Sub Invoice", pascal: "SubInvoiceNo", camel: "subInvoiceNo", align: "left" },
  { label: "Item with Code", pascal: "ItemwithCode", camel: "itemwithCode", align: "left" },
  { label: "Desc", pascal: "Description", camel: "description", align: "left" },
  { label: "Acc Head", pascal: "AccHead", camel: "accHead", align: "left" },
  { label: "Quantity", pascal: "Months", camel: "months", numeric: true, align: "right" },
  {
    label: "Unit Price",
    pascal: "CalculatedRentPM",
    camel: "calculatedRentPM",
    numeric: true,
    align: "right",
  },
  { label: "Discount %", pascal: "Discount", camel: "discount", numeric: true, align: "center" },
  { label: "Total", pascal: "Total", camel: "total", numeric: true, align: "right" },
];

const INVOICE_LINES_DATA_GRID_COLUMNS =
  "minmax(52px, 0.65fr) minmax(72px, 0.85fr) minmax(88px, 1fr) minmax(96px, 1.1fr) minmax(80px, 0.9fr) minmax(64px, 0.75fr) minmax(80px, 0.9fr) minmax(64px, 0.75fr) minmax(88px, 0.95fr)";

const INVOICE_LINES_GRID_COLUMNS = `${INVOICE_LINES_DATA_GRID_COLUMNS} 150px`;

const INVOICE_LINES_GRID_COLUMNS_READONLY = INVOICE_LINES_DATA_GRID_COLUMNS;

function isMainInvoiceScheduleRow(lineRow) {
  if (!lineRow) return false;
  const sub = pickScheduleRowField(lineRow, "SubInvoiceNo", "subInvoiceNo");
  if (sub === null || sub === undefined) return true;
  const subText = String(sub).trim();
  return subText === "" || subText === "0";
}

function findMainInvoiceScheduleRow(lines) {
  if (!Array.isArray(lines)) return null;
  return lines.find(isMainInvoiceScheduleRow) || null;
}

/** Header-level Description on invoice schedule (not line-item Desc). */
function pickAgreementProvHeaderDescription(row) {
  if (!row) return "";
  return String(
    pickScheduleRowField(row, "Description", "description") ||
      pickScheduleRowField(row, "Desc", "desc") ||
      ""
  ).trim();
}

function applyInvoiceLinesToForm(parentRow, lines, prevForm = {}) {
  const mainRow = findMainInvoiceScheduleRow(lines);
  const sourceRow = mainRow || parentRow || {};
  const fromSource = buildAgreementProvEditForm(sourceRow);
  const headerDescription =
    pickAgreementProvHeaderDescription(parentRow) || pickAgreementProvHeaderDescription(mainRow);
  const keptDescription = String(prevForm.description ?? "").trim();

  return {
    ...fromSource,
    ...prevForm,
    contractNo:
      prevForm.contractNo ||
      fromSource.contractNo ||
      String(pickScheduleRowField(sourceRow, "ContractNo", "contractNo") || ""),
    invoiceNo:
      prevForm.invoiceNo ||
      fromSource.invoiceNo ||
      String(pickScheduleRowField(sourceRow, "InvoiceNo", "invoiceNo") || ""),
    cod: pickScheduleCodDate(parentRow) || pickScheduleCodDate(sourceRow) || prevForm.cod || "",
    description: keptDescription !== "" ? keptDescription : headerDescription,
  };
}

function pickInvoiceLineSortOrder(row) {
  const v =
    pickScheduleRowField(row, "SortOrder", "sortOrder") ||
    pickScheduleRowField(row, "InvoiceOrder", "invoiceOrder");
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function getMaxInvoiceSortOrderForLines(scheduleRows) {
  let maxOrder = -1;
  (scheduleRows || []).forEach((r) => {
    if (isMainInvoiceScheduleRow(r)) return;
    const o = pickInvoiceLineSortOrder(r);
    if (o !== null) maxOrder = Math.max(maxOrder, o);
  });
  return maxOrder;
}

function suggestNextInvoiceSortOrder(scheduleRows) {
  const maxOrder = getMaxInvoiceSortOrderForLines(scheduleRows);
  return maxOrder < 1 ? 1 : maxOrder + 1;
}

function sortInvoiceLinesByOrder(rows) {
  return [...(rows || [])].sort((a, b) => {
    const oa = pickInvoiceLineSortOrder(a);
    const ob = pickInvoiceLineSortOrder(b);
    const na = oa !== null ? oa : Number.MAX_SAFE_INTEGER;
    const nb = ob !== null ? ob : Number.MAX_SAFE_INTEGER;
    if (na !== nb) return na - nb;
    const subA = pickInvoiceLineSubInvoiceNo(a);
    const subB = pickInvoiceLineSubInvoiceNo(b);
    return String(subA).localeCompare(String(subB), undefined, { numeric: true });
  });
}

function getInvoiceLineEffectiveSortOrder(row, index) {
  const order = pickInvoiceLineSortOrder(row);
  return order !== null && order > 0 ? order : index + 1;
}

function buildEmptyDraftInvoiceAddForm(parentForm, parentRow, invoiceLinesRows) {
  const invoiceDate =
    parentForm?.invoiceDate ||
    toScheduleDateInputValue(pickScheduleInvoiceDate(parentRow || {})) ||
    "";
  const dueDate =
    parentForm?.dueDate ||
    toScheduleDateInputValue(pickScheduleRowField(parentRow || {}, "DueDate", "dueDate")) ||
    (invoiceDate ? addDaysToYyyyMmDd(invoiceDate, 9) : "");
  const months =
    parentForm?.months ?? pickScheduleRowField(parentRow || {}, "Months", "months") ?? "";
  const desc = pickAgreementProvHeaderDescription(parentRow || {});
  return {
    invoiceDate,
    dueDate,
    sortOrder: String(suggestNextInvoiceSortOrder(invoiceLinesRows || [])),
    itemCode: "",
    desc,
    accHead: "",
    months: months === "" ? "" : String(months),
    calculatedRentPM: "",
    discountPercent: "",
    total: "",
    pendingSubInvoiceNo: suggestNextSubInvoiceNo(parentRow, parentForm, invoiceLinesRows || []),
  };
}

function buildDuplicateDraftInvoiceAddForm(sourceLine, parentForm, parentRow, invoiceLinesRows) {
  const base = buildEmptyDraftInvoiceAddForm(parentForm, parentRow, invoiceLinesRows);
  const itemCode =
    pickScheduleRowField(sourceLine, "ItemwithCode", "itemwithCode") ||
    pickScheduleRowField(sourceLine, "ItemCode", "itemCode");
  const accHead = pickScheduleRowField(sourceLine, "AccHead", "accHead");
  const months = pickScheduleRowField(sourceLine, "Months", "months");
  const calculatedRentPM = pickScheduleRowField(sourceLine, "CalculatedRentPM", "calculatedRentPM");
  const discountRaw =
    pickScheduleRowField(sourceLine, "Discount", "discount") ||
    pickScheduleRowField(sourceLine, "DiscountPercent", "discountPercent");
  const desc = String(parentForm?.description ?? "").trim();
  const pendingSubInvoiceNo = suggestNextSubInvoiceNo(
    parentRow,
    parentForm,
    invoiceLinesRows || []
  );
  const discountPercent =
    discountRaw === "" || discountRaw == null ? "" : sanitizeIntegerInputValue(String(discountRaw));
  const monthsStr =
    months === "" || months == null ? "" : sanitizeIntegerInputValue(String(months));
  const calculatedRentPMStr =
    calculatedRentPM === "" || calculatedRentPM == null
      ? ""
      : sanitizeDecimalNumericInputValue(String(calculatedRentPM));
  const totalVal = computeInvoiceRecordLineTotal(monthsStr, calculatedRentPMStr, discountPercent);

  return {
    ...base,
    itemCode: itemCode === "" ? "" : String(itemCode),
    desc,
    accHead: accHead === "" ? "" : String(accHead),
    months: monthsStr,
    calculatedRentPM: calculatedRentPMStr,
    discountPercent,
    pendingSubInvoiceNo,
    total: totalVal != null ? String(totalVal) : "",
  };
}

function pickInvoiceLineSubInvoiceNo(lineRow) {
  return String(pickScheduleRowField(lineRow, "SubInvoiceNo", "subInvoiceNo") || "").trim();
}

/** React row key — SubInvoiceNo only (never shared schedule Id). */
function getInvoiceLineDraftRowKey(lineRow, idx) {
  const sub = pickInvoiceLineSubInvoiceNo(lineRow);
  if (sub) return `sub-${sub}`;
  if (isMainInvoiceScheduleRow(lineRow)) return "main-schedule-row";
  return `idx-${idx}`;
}

function isInvoiceLineDraftEditing(lineRow, draftLineForm) {
  if (!draftLineForm?.editingLineKey) return false;
  const editingSub = String(draftLineForm.editingSubInvoiceNo ?? "").trim();
  const rowSub = pickInvoiceLineSubInvoiceNo(lineRow);
  if (editingSub && rowSub) return editingSub === rowSub;
  return false;
}

function buildDraftInvoiceEditFormFromLine(lineRow, parentForm, parentRow, lineKey) {
  const months = pickScheduleRowField(lineRow, "Months", "months");
  const calculatedRentPM = pickScheduleRowField(lineRow, "CalculatedRentPM", "calculatedRentPM");
  const discountRaw =
    pickScheduleRowField(lineRow, "Discount", "discount") ||
    pickScheduleRowField(lineRow, "DiscountPercent", "discountPercent");
  const discountPercent =
    discountRaw === "" || discountRaw == null ? "" : sanitizeIntegerInputValue(String(discountRaw));
  const monthsStr =
    months === "" || months == null ? "" : sanitizeIntegerInputValue(String(months));
  const calculatedRentPMStr =
    calculatedRentPM === "" || calculatedRentPM == null
      ? ""
      : sanitizeDecimalNumericInputValue(String(calculatedRentPM));
  const totalVal = computeInvoiceRecordLineTotal(monthsStr, calculatedRentPMStr, discountPercent);
  const savedTotal =
    pickScheduleRowField(lineRow, "Total", "total") ||
    pickScheduleRowField(lineRow, "TotalRent", "totalRent");

  const orderRaw =
    pickScheduleRowField(lineRow, "SortOrder", "sortOrder") ||
    pickScheduleRowField(lineRow, "InvoiceOrder", "invoiceOrder");
  const sortOrder =
    orderRaw === "" || orderRaw == null ? "" : sanitizeIntegerInputValue(String(orderRaw));

  return {
    editingLineKey: lineKey,
    editingSubInvoiceNo: pickInvoiceLineSubInvoiceNo(lineRow),
    editingLineRow: lineRow,
    sortOrder,
    invoiceDate: toScheduleDateInputValue(pickScheduleInvoiceDate(lineRow)),
    dueDate: toScheduleDateInputValue(pickScheduleRowField(lineRow, "DueDate", "dueDate")),
    itemCode:
      pickScheduleRowField(lineRow, "ItemwithCode", "itemwithCode") ||
      pickScheduleRowField(lineRow, "ItemCode", "itemCode"),
    desc:
      pickScheduleRowField(lineRow, "Description", "description") ||
      pickScheduleRowField(lineRow, "Desc", "desc"),
    accHead: pickScheduleRowField(lineRow, "AccHead", "accHead"),
    months: monthsStr,
    calculatedRentPM: calculatedRentPMStr,
    discountPercent,
    pendingSubInvoiceNo: pickInvoiceLineSubInvoiceNo(lineRow),
    total: totalVal != null ? String(totalVal) : savedTotal === "" ? "" : String(savedTotal),
  };
}

const invoiceLineDraftInputSx = {
  "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30 },
  "& .MuiInputBase-input": { py: 0.5, px: 0.75 },
};

function AgreementProvInvoiceLineDraftRow({
  gridRowSx,
  bodyCellSx,
  draftForm,
  onDraftFieldChange,
  onDraftIntegerFieldChange,
  onDraftNumericFieldChange,
  onDraftSave,
  onDraftCancel,
  draftSaving,
  saving,
  lineActionSaving,
}) {
  const subLabel = draftForm.pendingSubInvoiceNo || "—";
  const isEditRow = Boolean(draftForm.editingLineKey);

  return (
    <MDBox
      sx={{
        ...gridRowSx,
        bgcolor: "rgba(25, 118, 210, 0.06)",
        "& > *": { borderBottom: "1px solid rgba(0,0,0,0.08)" },
      }}
    >
      <MDBox sx={{ ...bodyCellSx, textAlign: "right", fontWeight: 600 }}>
        {draftForm.sortOrder || "1"}
      </MDBox>
      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "left",
          fontWeight: 600,
          color: subLabel !== "—" ? "text.primary" : "text.secondary",
        }}
      >
        {subLabel}
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        <MDInput
          value={draftForm.itemCode ?? ""}
          onChange={onDraftFieldChange("itemCode")}
          fullWidth
          size="small"
          placeholder="Item with Code"
          sx={invoiceLineDraftInputSx}
        />
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        <MDInput
          value={draftForm.desc ?? ""}
          onChange={onDraftFieldChange("desc")}
          fullWidth
          size="small"
          placeholder="Desc"
          sx={invoiceLineDraftInputSx}
        />
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        <MDInput
          value={draftForm.accHead ?? ""}
          onChange={onDraftFieldChange("accHead")}
          fullWidth
          size="small"
          placeholder="Acc Head"
          sx={invoiceLineDraftInputSx}
        />
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "right", p: 0.5 }}>
        <MDInput
          value={draftForm.months ?? ""}
          onChange={onDraftIntegerFieldChange("months")}
          fullWidth
          size="small"
          placeholder="Qty"
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          sx={invoiceLineDraftInputSx}
        />
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "right", p: 0.5 }}>
        <MDInput
          value={draftForm.calculatedRentPM ?? ""}
          onChange={onDraftNumericFieldChange("calculatedRentPM")}
          fullWidth
          size="small"
          placeholder="Unit Price"
          inputProps={{ inputMode: "decimal" }}
          sx={invoiceLineDraftInputSx}
        />
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "center", p: 0.5 }}>
        <MDInput
          value={draftForm.discountPercent ?? ""}
          onChange={onDraftIntegerFieldChange("discountPercent")}
          fullWidth
          size="small"
          placeholder="Disc %"
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          sx={invoiceLineDraftInputSx}
        />
      </MDBox>
      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
        }}
      >
        {(() => {
          const totalVal = computeInvoiceRecordLineTotal(
            draftForm.months,
            draftForm.calculatedRentPM,
            draftForm.discountPercent
          );
          return totalVal != null ? formatScheduleGridNumber(totalVal, true) : "—";
        })()}
      </MDBox>
      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "center",
          display: "flex",
          justifyContent: "center",
          gap: 0.25,
        }}
      >
        <Tooltip title={isEditRow ? "Update" : "Save"}>
          <span>
            <IconButton
              size="small"
              color="info"
              disabled={draftSaving || saving || lineActionSaving}
              onClick={onDraftSave}
              sx={{ padding: "2px" }}
            >
              <Icon fontSize="small">check</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Cancel">
          <span>
            <IconButton
              size="small"
              color="secondary"
              disabled={draftSaving || saving || lineActionSaving}
              onClick={onDraftCancel}
              sx={{ padding: "2px" }}
            >
              <Icon fontSize="small">close</Icon>
            </IconButton>
          </span>
        </Tooltip>
      </MDBox>
    </MDBox>
  );
}

AgreementProvInvoiceLineDraftRow.propTypes = {
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
  draftForm: PropTypes.object.isRequired,
  onDraftFieldChange: PropTypes.func.isRequired,
  onDraftIntegerFieldChange: PropTypes.func.isRequired,
  onDraftNumericFieldChange: PropTypes.func.isRequired,
  onDraftSave: PropTypes.func.isRequired,
  onDraftCancel: PropTypes.func.isRequired,
  draftSaving: PropTypes.bool,
  saving: PropTypes.bool,
  lineActionSaving: PropTypes.bool,
};

function AgreementProvInvoiceLinesGrid({
  rows,
  loading,
  error,
  lineActionSaving,
  saving,
  form,
  rowData,
  onEditLine,
  onDeleteLine,
  onDuplicateLine,
  onMoveLine,
  readOnly,
  draftLineForm,
  onDraftFieldChange,
  onDraftIntegerFieldChange,
  onDraftNumericFieldChange,
  onDraftSave,
  onDraftCancel,
  draftSaving,
}) {
  const draftAtTop = draftLineForm && !draftLineForm.editingLineKey;
  const itemRows = (rows || []).filter((r) => !isMainInvoiceScheduleRow(r));
  const moveRows = sortInvoiceLinesByOrder(itemRows);
  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: readOnly
      ? INVOICE_LINES_GRID_COLUMNS_READONLY
      : INVOICE_LINES_GRID_COLUMNS,
    width: "100%",
    alignItems: "center",
    columnGap: 0,
  };

  const cellBaseSx = {
    fontSize: "0.8125rem",
    lineHeight: 1.25,
    py: 0.75,
    px: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  };

  const headerCellSx = {
    ...cellBaseSx,
    fontWeight: 700,
    fontSize: "0.75rem",
    bgcolor: "#f4f6f8",
    borderBottom: "1px solid rgba(0,0,0,0.12)",
  };

  const bodyCellSx = {
    ...cellBaseSx,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  };

  if (loading) {
    return (
      <MDBox display="flex" justifyContent="center" py={3}>
        <CircularProgress color="info" size={28} />
      </MDBox>
    );
  }

  if (error) {
    return (
      <MDTypography variant="caption" color="error">
        {error}
      </MDTypography>
    );
  }

  return (
    <TableContainer
      component={MDBox}
      sx={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 1,
        overflow: "hidden",
        display: "block",
      }}
    >
      <MDBox sx={gridRowSx}>
        {EDIT_INVOICE_LINES_TABLE_COLUMNS.map((col) => (
          <MDBox
            key={col.camel}
            sx={{
              ...headerCellSx,
              textAlign: col.align === "right" ? "right" : "left",
            }}
          >
            {col.label}
          </MDBox>
        ))}
        {!readOnly && <MDBox sx={{ ...headerCellSx, textAlign: "center" }}>Action</MDBox>}
      </MDBox>

      <MDBox sx={{ maxHeight: 240, overflow: "auto" }}>
        {draftAtTop && !readOnly && (
          <AgreementProvInvoiceLineDraftRow
            gridRowSx={gridRowSx}
            bodyCellSx={bodyCellSx}
            draftForm={draftLineForm}
            onDraftFieldChange={onDraftFieldChange}
            onDraftIntegerFieldChange={onDraftIntegerFieldChange}
            onDraftNumericFieldChange={onDraftNumericFieldChange}
            onDraftSave={onDraftSave}
            onDraftCancel={onDraftCancel}
            draftSaving={draftSaving}
            saving={saving}
            lineActionSaving={lineActionSaving}
          />
        )}
        {itemRows.length === 0 && !draftLineForm ? (
          <MDTypography variant="caption" color="text" display="block" textAlign="center" py={2}>
            No records found for this invoice.
          </MDTypography>
        ) : (
          itemRows.map((lineRow, idx) => {
            const lineKey = getInvoiceLineDraftRowKey(lineRow, idx);
            const isEditingRow = isInvoiceLineDraftEditing(lineRow, draftLineForm);

            if (isEditingRow && !readOnly) {
              return (
                <AgreementProvInvoiceLineDraftRow
                  key={lineKey}
                  gridRowSx={gridRowSx}
                  bodyCellSx={bodyCellSx}
                  draftForm={draftLineForm}
                  onDraftFieldChange={onDraftFieldChange}
                  onDraftIntegerFieldChange={onDraftIntegerFieldChange}
                  onDraftNumericFieldChange={onDraftNumericFieldChange}
                  onDraftSave={onDraftSave}
                  onDraftCancel={onDraftCancel}
                  draftSaving={draftSaving}
                  saving={saving}
                  lineActionSaving={lineActionSaving}
                />
              );
            }

            const lineSubInvoiceNo = pickInvoiceLineSubInvoiceNo(lineRow);
            const lineMoveIndex = moveRows.findIndex(
              (r) => pickInvoiceLineSubInvoiceNo(r) === lineSubInvoiceNo
            );
            const canMoveUp = lineMoveIndex > 0;
            const canMoveDown = lineMoveIndex >= 0 && lineMoveIndex < moveRows.length - 1;

            return (
              <MDBox
                key={lineKey}
                sx={{
                  ...gridRowSx,
                  "&:hover": { bgcolor: "rgba(25, 118, 210, 0.04)" },
                  "&:last-of-type > *": { borderBottom: "none" },
                }}
              >
                {EDIT_INVOICE_LINES_TABLE_COLUMNS.map((col) => (
                  <MDBox
                    key={col.camel}
                    sx={{
                      ...bodyCellSx,
                      textAlign: col.align === "right" ? "right" : "left",
                      fontVariantNumeric: col.numeric ? "tabular-nums" : undefined,
                    }}
                  >
                    {col.camel === "description" ? (
                      <AgreementProvLongTextCell
                        compact
                        maxVisibleChars={15}
                        value={
                          pickScheduleRowField(lineRow, "Description", "description") ||
                          pickScheduleRowField(lineRow, "Desc", "desc")
                        }
                      />
                    ) : (
                      formatEditInvoiceLineCellValue(lineRow, col)
                    )}
                  </MDBox>
                ))}
                {!readOnly && (
                  <MDBox
                    sx={{
                      ...bodyCellSx,
                      textAlign: "center",
                      display: "flex",
                      justifyContent: "center",
                      gap: 0.25,
                    }}
                  >
                    <Tooltip title="Move up">
                      <span>
                        <IconButton
                          size="small"
                          color="info"
                          disabled={
                            !canMoveUp ||
                            lineActionSaving ||
                            saving ||
                            Boolean(draftLineForm) ||
                            draftSaving
                          }
                          onClick={() => onMoveLine?.(lineRow, "up")}
                          sx={{ padding: "2px" }}
                        >
                          <Icon fontSize="small">keyboard_arrow_up</Icon>
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton
                          size="small"
                          color="info"
                          disabled={
                            !canMoveDown ||
                            lineActionSaving ||
                            saving ||
                            Boolean(draftLineForm) ||
                            draftSaving
                          }
                          onClick={() => onMoveLine?.(lineRow, "down")}
                          sx={{ padding: "2px" }}
                        >
                          <Icon fontSize="small">keyboard_arrow_down</Icon>
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Edit">
                      <span>
                        <IconButton
                          size="small"
                          color="info"
                          disabled={
                            lineActionSaving || saving || Boolean(draftLineForm) || draftSaving
                          }
                          onClick={() => onEditLine?.(lineRow, lineKey)}
                          sx={{ padding: "2px" }}
                        >
                          <Icon fontSize="small">edit</Icon>
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                      <span>
                        <IconButton
                          size="small"
                          color="secondary"
                          disabled={
                            lineActionSaving || saving || Boolean(draftLineForm) || draftSaving
                          }
                          onClick={() => onDuplicateLine?.(lineRow, form, rowData)}
                          sx={{ padding: "2px" }}
                        >
                          <Icon fontSize="small">content_copy</Icon>
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <span>
                        <IconButton
                          size="small"
                          color="error"
                          disabled={
                            lineActionSaving || saving || Boolean(draftLineForm) || draftSaving
                          }
                          onClick={() => onDeleteLine?.(lineRow, form, rowData)}
                          sx={{ padding: "2px" }}
                        >
                          <Icon fontSize="small">delete</Icon>
                        </IconButton>
                      </span>
                    </Tooltip>
                  </MDBox>
                )}
              </MDBox>
            );
          })
        )}
      </MDBox>
    </TableContainer>
  );
}

AgreementProvInvoiceLinesGrid.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object),
  loading: PropTypes.bool,
  error: PropTypes.string,
  lineActionSaving: PropTypes.bool,
  saving: PropTypes.bool,
  form: PropTypes.object,
  rowData: PropTypes.object,
  onEditLine: PropTypes.func,
  onDeleteLine: PropTypes.func,
  onDuplicateLine: PropTypes.func,
  onMoveLine: PropTypes.func,
  readOnly: PropTypes.bool,
  draftLineForm: PropTypes.object,
  onDraftFieldChange: PropTypes.func,
  onDraftIntegerFieldChange: PropTypes.func,
  onDraftNumericFieldChange: PropTypes.func,
  onDraftSave: PropTypes.func,
  onDraftCancel: PropTypes.func,
  draftSaving: PropTypes.bool,
};

function getInvoiceLineRouteKeys(lineRow, parentRow, parentForm) {
  const contractNo = String(
    parentForm?.contractNo ??
      pickScheduleRowField(parentRow || {}, "ContractNo", "contractNo") ??
      pickScheduleRowField(lineRow || {}, "ContractNo", "contractNo") ??
      ""
  ).trim();
  const invoiceNo = String(
    parentForm?.invoiceNo ??
      pickScheduleRowField(parentRow || {}, "InvoiceNo", "invoiceNo") ??
      pickScheduleRowField(lineRow || {}, "InvoiceNo", "invoiceNo") ??
      ""
  ).trim();
  const subInvoiceNo = pickInvoiceLineSubInvoiceNo(lineRow);
  return { contractNo, invoiceNo, subInvoiceNo };
}

function formatDateDDMMMYYYY(dateString) {
  if (!dateString) return "—";
  const raw = String(dateString).trim();
  if (!raw) return "—";

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
  } catch (e) {
    return dateString;
  }
}

function formatScheduleDisplayDate(value) {
  const v = toScheduleDateInputValue(value);
  return v || "—";
}

/** Display yyyy-MM-dd state as dd-MMM-yyyy (same as contracts CSD). */
function toAgreementProvDisplayDate(isoStr) {
  if (!isoStr || typeof isoStr !== "string") return "";
  const trimmed = String(isoStr).trim();
  if (!trimmed) return "";
  try {
    const d = parseISO(trimmed);
    return isValid(d) ? format(d, "dd-MMM-yyyy") : trimmed;
  } catch {
    return trimmed;
  }
}

function openAgreementProvDatePicker(ref) {
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
}

function formatInvoicePeriodDisplay(periodStart, periodEnd) {
  const start = formatDateDDMMMYYYY(periodStart);
  const end = formatDateDDMMMYYYY(periodEnd);
  if (start === "—" && end === "—") return "—";
  if (start !== "—" && end !== "—") return `${start} to ${end}`;
  return start !== "—" ? start : end;
}

function formatPrefixNoDisplay(row) {
  const tenantNo = String(
    pickScheduleRowField(row, "TenantNo", "tenantNo") ||
      pickScheduleRowField(row, "PrefixNo", "prefixNo") ||
      ""
  ).trim();
  if (tenantNo) return tenantNo;
  const prefix = String(pickScheduleRowField(row, "Prefix", "prefix") || "").trim();
  const ownerName = String(pickScheduleRowField(row, "OwnerName", "ownerName") || "").trim();
  return [prefix, ownerName].filter(Boolean).join(" ").trim();
}

function normalizeAgreementProvInvoiceStatusKey(raw) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function agreementProvInvoiceStatusBadgePalette(raw) {
  const key = normalizeAgreementProvInvoiceStatusKey(raw);
  if (!key) return null;
  if (key === "paid" || key === "full paid")
    return { bg: "#d4edda", fg: "#155724", outline: "#c3e6cb" };
  if (key === "unpaid") return { bg: "#f8d7da", fg: "#721c24", outline: "#f5c6cb" };
  if (key === "partial" || key === "partial paid")
    return { bg: "#ffe0b2", fg: "#e65100", outline: "#ffcc80" };
  if (key === "coming due") return { bg: "#fff9c4", fg: "#f57f17", outline: "#fff59d" };
  if (key === "overdue") return { bg: "#ffe0b2", fg: "#e65100", outline: "#ffcc80" };
  return null;
}

function pickScheduleCodDate(row) {
  const raw =
    pickScheduleRowField(row, "Cod", "cod") ||
    row?.COD ||
    pickScheduleRowField(row, "CommercialOperationDate", "commercialOperationDate");
  return toScheduleDateInputValue(raw);
}

function formatEditInvoiceLineCell(row, col) {
  const raw = pickScheduleRowField(row, col.pascal, col.camel);
  if (col.date) return formatScheduleDisplayDate(raw);
  if (col.numeric) return formatScheduleGridNumber(raw, col.camel === "total");
  return raw === "" ? "—" : String(raw);
}

function formatEditInvoiceLineCellValue(lineRow, col) {
  if (col.camel === "subInvoiceNo") {
    const sub = pickInvoiceLineSubInvoiceNo(lineRow);
    return sub || "—";
  }
  if (col.camel === "itemwithCode") {
    const raw =
      pickScheduleRowField(lineRow, "ItemwithCode", "itemwithCode") ||
      pickScheduleRowField(lineRow, "ItemCode", "itemCode");
    return raw === "" ? "—" : String(raw);
  }
  if (col.camel === "description") {
    const raw =
      pickScheduleRowField(lineRow, "Description", "description") ||
      pickScheduleRowField(lineRow, "Desc", "desc");
    return raw === "" ? "—" : String(raw);
  }
  if (col.camel === "discount") {
    const raw =
      pickScheduleRowField(lineRow, "Discount", "discount") ||
      pickScheduleRowField(lineRow, "DiscountPercent", "discountPercent");
    return raw === "" ? "—" : formatScheduleGridNumber(raw);
  }
  if (col.camel === "total") {
    const raw = pickScheduleRowField(lineRow, "Total", "total");
    if (raw !== "") return formatScheduleGridNumber(raw, true);
    const totalRent = pickScheduleRowField(lineRow, "TotalRent", "totalRent");
    if (totalRent !== "") return formatScheduleGridNumber(totalRent, true);
    const months = pickScheduleRowField(lineRow, "Months", "months");
    const ratePM = pickScheduleRowField(lineRow, "CalculatedRentPM", "calculatedRentPM");
    const discount =
      pickScheduleRowField(lineRow, "Discount", "discount") ||
      pickScheduleRowField(lineRow, "DiscountPercent", "discountPercent");
    const computed = computeInvoiceRecordLineTotal(months, ratePM, discount);
    return computed != null ? formatScheduleGridNumber(computed, true) : "—";
  }
  return formatEditInvoiceLineCell(lineRow, col);
}

function toScheduleDateInputValue(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "";
  const raw = String(value).trim();
  const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
  if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return datePart;
  try {
    const parsed = parseISO(raw);
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
  } catch {
    // ignore invalid parseISO
  }
  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) return format(new Date(ts), "yyyy-MM-dd");
  return "";
}

/** True when due date is today or in the past. */
function isAgreementProvDueDatePassed(rowData) {
  const dueStr = toScheduleDateInputValue(pickScheduleRowField(rowData, "DueDate", "dueDate"));
  if (!dueStr) return false;
  const dueTs = Date.parse(dueStr);
  if (!Number.isFinite(dueTs)) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dueDay = new Date(dueTs);
  dueDay.setHours(0, 0, 0, 0);
  return dueDay.getTime() <= today.getTime();
}

function getInvoiceScheduleRouteKeys(row, form) {
  const contractNo = String(
    form?.contractNo ?? pickScheduleRowField(row || {}, "ContractNo", "contractNo") ?? ""
  ).trim();
  const invoiceNo = String(
    form?.invoiceNo ?? pickScheduleRowField(row || {}, "InvoiceNo", "invoiceNo") ?? ""
  ).trim();
  return { contractNo, invoiceNo };
}

function addDaysToYyyyMmDd(dateStr, days) {
  if (!dateStr || !String(dateStr).trim()) return "";
  try {
    const parsed = parseISO(String(dateStr).trim());
    if (!isValid(parsed)) return "";
    return format(addDays(parsed, Number(days) || 0), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function periodEndFromStartAndMonths(periodStart, months) {
  if (!periodStart || months === null || months === undefined || months === "") return "";
  const n = Number(months);
  if (!Number.isFinite(n) || n <= 0) return "";
  try {
    const parsed = parseISO(String(periodStart).trim());
    if (!isValid(parsed)) return "";
    return format(addMonths(parsed, n), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

function buildCreateAgreementInvoiceDateDefaults(invoiceDate, sourceRow) {
  const date = toScheduleDateInputValue(invoiceDate);
  const paymentTermMonths = pickScheduleRowField(
    sourceRow || {},
    "PaymentTermMonths",
    "paymentTermMonths"
  );
  const periodEnd = periodEndFromStartAndMonths(date, paymentTermMonths);
  const periodText = periodEnd ? formatInvoicePeriodDisplay(date, periodEnd) : "";
  return {
    dueDate: date ? addDaysToYyyyMmDd(date, 9) : "",
    description: periodText === "—" ? "" : periodText,
  };
}

function getMaxSubInvoiceNoForInvoice(parentRow, parentForm, scheduleRows) {
  const contractNo = String(
    parentForm?.contractNo ??
      pickScheduleRowField(parentRow || {}, "ContractNo", "contractNo") ??
      ""
  ).trim();
  const invoiceNo = String(
    parentForm?.invoiceNo ?? pickScheduleRowField(parentRow || {}, "InvoiceNo", "invoiceNo") ?? ""
  ).trim();
  if (!contractNo || !invoiceNo) return 0;

  let maxSub = 0;
  (scheduleRows || []).forEach((r) => {
    const rowContract = String(pickScheduleRowField(r, "ContractNo", "contractNo") || "").trim();
    const rowInvoice = String(pickScheduleRowField(r, "InvoiceNo", "invoiceNo") || "").trim();
    if (rowContract !== contractNo || rowInvoice !== invoiceNo) return;
    const subRaw = pickScheduleRowField(r, "SubInvoiceNo", "subInvoiceNo");
    if (subRaw === null || subRaw === undefined || String(subRaw).trim() === "") return;
    const subNum = parseInt(String(subRaw).replace(/\D/g, ""), 10);
    if (Number.isFinite(subNum)) maxSub = Math.max(maxSub, subNum);
  });
  return maxSub;
}

function suggestNextSubInvoiceNo(parentRow, parentForm, scheduleRows) {
  return String(getMaxSubInvoiceNoForInvoice(parentRow, parentForm, scheduleRows) + 1);
}

function computeInvoiceRecordLineTotal(months, ratePM, discountPercent) {
  const m = Number(months);
  const r = Number(ratePM);
  if (!Number.isFinite(m) || !Number.isFinite(r)) return null;
  const gross = m * r;
  const d = Number(discountPercent);
  const raw = !Number.isFinite(d) || d <= 0 ? gross : gross - (gross * d) / 100;
  return Math.round(raw);
}

function buildInvoiceScheduleCreatePayload(parentRow, parentForm, addForm) {
  const contractNo = String(
    parentForm?.contractNo ??
      pickScheduleRowField(parentRow || {}, "ContractNo", "contractNo") ??
      ""
  ).trim();
  const invoiceNo = String(
    parentForm?.invoiceNo ?? pickScheduleRowField(parentRow || {}, "InvoiceNo", "invoiceNo") ?? ""
  ).trim();
  const periodStart = addForm.invoiceDate || null;
  const months = toScheduleIntOrNull(addForm.months);
  const periodEnd = periodEndFromStartAndMonths(periodStart, months) || null;
  const calculatedRentPM = toScheduleNumberOrNull(addForm.calculatedRentPM);
  const lineTotal =
    toScheduleNumberOrNull(addForm.total) ??
    computeInvoiceRecordLineTotal(
      addForm.months,
      addForm.calculatedRentPM,
      addForm.discountPercent
    );
  const totalRent = lineTotal;

  return {
    ContractId: pickRowNumberField(parentRow, "ContractId", "contractId"),
    ClassId: pickRowNumberField(parentRow, "ClassId", "classId"),
    CmdId: pickRowNumberField(parentRow, "CmdId", "cmdId"),
    BaseId: pickRowNumberField(parentRow, "BaseId", "baseId"),
    ContractNo: contractNo,
    ContractStartDate:
      parentForm?.contractStartDate ||
      toScheduleDateInputValue(
        pickScheduleRowField(parentRow, "ContractStartDate", "contractStartDate")
      ) ||
      null,
    ContractEndDate:
      parentForm?.contractEndDate ||
      toScheduleDateInputValue(
        pickScheduleRowField(parentRow, "ContractEndDate", "contractEndDate")
      ) ||
      null,
    InvoiceNo: invoiceNo,
    PeriodStart: periodStart,
    PeriodEnd: periodEnd,
    DueDate: addForm.dueDate || null,
    CalculatedRentPM: calculatedRentPM,
    Months: months,
    TotalRent: totalRent,
    ItemwithCode: String(addForm.itemCode ?? "").trim(),
    Description: String(addForm.desc ?? "").trim(),
    AccHead: String(addForm.accHead ?? "").trim(),
    Discount: toScheduleIntOrNull(addForm.discountPercent),
    Total: lineTotal,
    Remarks: pickScheduleRowField(parentRow, "Remarks", "remarks") || "",
    AmountReceived: 0,
    AmountReceivable: totalRent,
    AmountPending: totalRent,
    BusinessName:
      parentForm?.businessName ??
      String(pickScheduleRowField(parentRow, "BusinessName", "businessName") || ""),
    InvoiceDateType:
      parentForm?.invoiceDateType ??
      String(pickScheduleRowField(parentRow, "InvoiceDateType", "invoiceDateType") || ""),
    InvoiceStatus: "Unpaid",
    InitialRentPM: pickRowNumberField(parentRow, "InitialRentPM", "initialRentPM"),
    PaymentTermMonths: pickRowNumberField(parentRow, "PaymentTermMonths", "paymentTermMonths"),
    RiseTermType: pickScheduleRowField(parentRow, "RiseTermType", "riseTermType") || "",
    RiseTerm: pickScheduleRowField(parentRow, "RiseTerm", "riseTerm") || "",
    RiseRate: pickRowNumberField(parentRow, "RiseRate", "riseRate"),
    RiseDate: pickScheduleRowField(parentRow, "RiseDate", "riseDate") || null,
    SubInvoiceNo: String(addForm.pendingSubInvoiceNo ?? "").trim(),
    subInvoiceNo: String(addForm.pendingSubInvoiceNo ?? "").trim(),
    SortOrder: toScheduleIntOrNull(addForm.sortOrder) ?? 1,
    sortOrder: toScheduleIntOrNull(addForm.sortOrder) ?? 1,
  };
}

function toScheduleNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function toScheduleIntOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = parseInt(String(value).trim(), 10);
  return Number.isFinite(n) ? n : null;
}

function sanitizeIntegerInputValue(raw) {
  const s = String(raw ?? "");
  if (s === "") return "";
  return s.replace(/\D/g, "");
}

function sanitizeDecimalNumericInputValue(raw) {
  let s = String(raw ?? "").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0) {
    s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, "")}`;
  }
  return s;
}

function pickRowNumberField(row, pascalKey, camelKey) {
  const v = pickScheduleRowField(row, pascalKey, camelKey);
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildInvoiceSchedulePutPayload(rowData, form) {
  return {
    ContractId: pickRowNumberField(rowData, "ContractId", "contractId"),
    ClassId: pickRowNumberField(rowData, "ClassId", "classId"),
    CmdId: pickRowNumberField(rowData, "CmdId", "cmdId"),
    BaseId: pickRowNumberField(rowData, "BaseId", "baseId"),
    ContractNo: form.contractNo ?? "",
    ContractStartDate: form.contractStartDate || null,
    ContractEndDate: form.contractEndDate || null,
    InvoiceNo: form.invoiceNo ?? "",
    PeriodStart: form.periodStart || null,
    PeriodEnd: form.periodEnd || null,
    DueDate: form.dueDate || null,
    CalculatedRentPM: toScheduleNumberOrNull(form.calculatedRentPM),
    Months: toScheduleNumberOrNull(form.months),
    TotalRent: toScheduleNumberOrNull(form.totalRent),
    Remarks: form.remarks ?? "",
    Description: String(form.description ?? "").trim(),
    AmountReceived: toScheduleNumberOrNull(form.amountReceived),
    AmountReceivable: toScheduleNumberOrNull(form.amountReceivable),
    AmountPending: toScheduleNumberOrNull(form.amountPending),
    BusinessName: form.businessName ?? "",
    InvoiceDateType: form.invoiceDateType ?? "",
    InvoiceStatus: form.invoiceStatus ?? "",
    InitialRentPM: pickRowNumberField(rowData, "InitialRentPM", "initialRentPM"),
    PaymentTermMonths: pickRowNumberField(rowData, "PaymentTermMonths", "paymentTermMonths"),
    RiseTermType: pickScheduleRowField(rowData, "RiseTermType", "riseTermType") || "",
    RiseTerm: pickScheduleRowField(rowData, "RiseTerm", "riseTerm") || "",
    RiseRate: pickRowNumberField(rowData, "RiseRate", "riseRate"),
    RiseDate: pickScheduleRowField(rowData, "RiseDate", "riseDate") || null,
    IsLocked: pickScheduleRowIsLocked(rowData),
  };
}

function getAgreementProvSaveErrorMessage(error) {
  const rawMessage = String(error?.message || "").trim();
  const httpMatch = rawMessage.match(/^HTTP\s+\d+\s+[^:]+:\s*(.*)$/i);
  if (httpMatch?.[1]?.trim()) return httpMatch[1].trim();
  return rawMessage || "Failed to save invoice schedule. Please try again.";
}

const EDIT_BASIC_INFO_ROW_SX = {
  display: "grid",
  gap: 1.25,
  alignItems: "start",
};

function AgreementProvReadOnlyField({ label, value, compact }) {
  const display =
    value === null || value === undefined || String(value).trim() === "" ? "—" : String(value);
  return (
    <MDBox sx={{ minHeight: compact ? 34 : 44, pr: 0.5 }}>
      <MDTypography
        variant="caption"
        color="text"
        fontWeight="medium"
        display="block"
        lineHeight={1.15}
        sx={{
          textTransform: "uppercase",
          letterSpacing: "0.03em",
          fontSize: compact ? "0.625rem" : "0.7rem",
          opacity: 0.85,
        }}
      >
        {label}
      </MDTypography>
      <MDTypography
        variant="body2"
        fontWeight="medium"
        color="dark"
        sx={{
          mt: 0.25,
          fontSize: compact ? "0.8125rem" : "0.875rem",
          wordBreak: "break-word",
          whiteSpace: "pre-wrap",
          lineHeight: 1.25,
        }}
      >
        {display}
      </MDTypography>
    </MDBox>
  );
}

AgreementProvReadOnlyField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  compact: PropTypes.bool,
};

function AgreementProvLongTextCell({ value, maxVisibleChars = 25, compact }) {
  const [anchor, setAnchor] = useState(null);
  const text = value != null && String(value).trim() !== "" ? String(value).trim() : "—";
  const showMore = text !== "—" && text.length > maxVisibleChars;
  const displayText = showMore ? text.slice(0, maxVisibleChars) : text;
  const fontSize = compact ? "0.8125rem" : "0.875rem";

  return (
    <MDBox display="flex" alignItems="center" gap={0.25} sx={{ maxWidth: "100%", minWidth: 0 }}>
      <MDTypography
        component="span"
        variant="body2"
        sx={{
          minWidth: 0,
          overflow: "hidden",
          textOverflow: "clip",
          whiteSpace: "nowrap",
          fontSize,
          lineHeight: 1.25,
        }}
      >
        {displayText}
      </MDTypography>
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

AgreementProvLongTextCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  maxVisibleChars: PropTypes.number,
  compact: PropTypes.bool,
};

const agreementProvPanelFieldLabelSx = {
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  fontSize: "0.625rem",
  opacity: 0.85,
  lineHeight: 1.15,
};

const agreementProvPanelInputSx = {
  mt: 0.25,
  "& .MuiInputBase-root": {
    fontSize: "0.8125rem",
    minHeight: 32,
    bgcolor: "#fff",
  },
  "& .MuiInputBase-input": {
    py: 0.75,
  },
};

function AgreementProvPanelEditableField({ label, children }) {
  return (
    <MDBox sx={{ minWidth: 0 }}>
      <MDTypography
        variant="caption"
        color="text"
        fontWeight="medium"
        display="block"
        sx={agreementProvPanelFieldLabelSx}
      >
        {label}
      </MDTypography>
      <MDBox sx={{ mt: 0.25 }}>{children}</MDBox>
    </MDBox>
  );
}

AgreementProvPanelEditableField.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node.isRequired,
};

function AgreementProvReadOnlyInfoPanel({ children, action }) {
  return (
    <MDBox
      sx={{
        borderRadius: 1.5,
        border: "1px solid rgba(0,0,0,0.08)",
        bgcolor: "rgba(0,0,0,0.02)",
        overflow: "hidden",
      }}
    >
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={1.5}
        py={1}
        sx={{
          borderBottom: "1px solid rgba(0,0,0,0.06)",
          bgcolor: "rgba(0,0,0,0.03)",
        }}
      >
        <MDTypography
          variant="caption"
          fontWeight="bold"
          color="text"
          sx={{ letterSpacing: "0.04em" }}
        >
          BASIC INFORMATION
        </MDTypography>
        {action || null}
      </MDBox>
      <MDBox
        sx={{
          display: "flex",
          flexDirection: "column",
          gap: 1.25,
          p: 1.5,
        }}
      >
        {children}
      </MDBox>
    </MDBox>
  );
}

AgreementProvReadOnlyInfoPanel.propTypes = {
  children: PropTypes.node,
  action: PropTypes.node,
};

function isAgreementProvContractBasicInfoRow(rowData) {
  return Boolean(rowData?.isContractBasicInfoRow || rowData?.IsContractBasicInfoRow);
}

/** Contract-only fields from Basic Information (edit dialog row 1 + row 2). */
function AgreementProvContractBasicInfoStrip({ form }) {
  const f = form || {};
  const items = [
    { label: "Contract No", value: f.contractNo },
    { label: "CSD", value: formatDateDDMMMYYYY(f.contractStartDate) },
    { label: "CED", value: formatDateDDMMMYYYY(f.contractEndDate) },
    { label: "COD", value: formatDateDDMMMYYYY(f.cod) },
    { label: "Revenue Rate", value: formatScheduleGridNumber(f.rentalValueRate) },
    { label: "Initial Rent PM", value: formatScheduleGridNumber(f.initialRentPM) },
    { label: "Tenant No", value: f.prefixNo },
    { label: "Business Name", value: f.businessName },
    { label: "Address", value: f.address },
  ];

  return (
    <AgreementProvReadOnlyInfoPanel>
      <MDBox
        sx={{
          display: "flex",
          flexWrap: "nowrap",
          gap: 2,
          overflowX: "auto",
          alignItems: "flex-start",
          pb: 0.25,
        }}
      >
        {items.map((item) => (
          <MDBox key={item.label} sx={{ flex: "0 0 auto", minWidth: 88, maxWidth: 200 }}>
            <AgreementProvReadOnlyField compact label={item.label} value={item.value} />
          </MDBox>
        ))}
      </MDBox>
    </AgreementProvReadOnlyInfoPanel>
  );
}

AgreementProvContractBasicInfoStrip.propTypes = {
  form: PropTypes.object,
};

function buildAgreementProvContractBasicInfoForm(row) {
  if (!row) return {};
  const merged = {
    ...row,
    RentalValueRate:
      row.RentalValueRate ?? row.rentalValueRate ?? row.RentalValue ?? row.rentalValue,
  };
  return buildAgreementProvEditForm(merged);
}

function buildAgreementProvEditForm(row) {
  if (!row) return {};
  return {
    contractNo: String(pickScheduleRowField(row, "ContractNo", "contractNo") || ""),
    contractStartDate: toScheduleDateInputValue(
      pickScheduleRowField(row, "ContractStartDate", "contractStartDate")
    ),
    contractEndDate: toScheduleDateInputValue(
      pickScheduleRowField(row, "ContractEndDate", "contractEndDate")
    ),
    invoiceNo: String(pickScheduleRowField(row, "InvoiceNo", "invoiceNo") || ""),
    invoiceDate: toScheduleDateInputValue(pickScheduleInvoiceDate(row)),
    dueDate: toScheduleDateInputValue(pickScheduleRowField(row, "DueDate", "dueDate")),
    periodStart: toScheduleDateInputValue(pickScheduleRowField(row, "PeriodStart", "periodStart")),
    periodEnd: toScheduleDateInputValue(pickScheduleRowField(row, "PeriodEnd", "periodEnd")),
    calculatedRentPM: pickScheduleRowField(row, "CalculatedRentPM", "calculatedRentPM"),
    months: pickScheduleRowField(row, "Months", "months"),
    totalRent: pickScheduleRowField(row, "TotalRent", "totalRent"),
    remarks: String(pickScheduleRowField(row, "Remarks", "remarks") || ""),
    amountReceived: pickScheduleRowField(row, "AmountReceived", "amountReceived"),
    amountReceivable: pickScheduleRowField(row, "AmountReceivable", "amountReceivable"),
    amountPending: pickScheduleRowField(row, "AmountPending", "amountPending"),
    businessName: String(pickScheduleRowField(row, "BusinessName", "businessName") || ""),
    prefixNo: formatPrefixNoDisplay(row),
    address: String(pickScheduleRowField(row, "Address", "address") || ""),
    cod: pickScheduleCodDate(row),
    rentalValueRate: pickScheduleRowField(row, "RentalValueRate", "rentalValueRate"),
    initialRentPM: pickScheduleRowField(row, "InitialRentPM", "initialRentPM"),
    invoiceDateType: String(pickScheduleRowField(row, "InvoiceDateType", "invoiceDateType") || ""),
    invoiceStatus: String(pickScheduleRowField(row, "InvoiceStatus", "invoiceStatus") || ""),
    description: pickAgreementProvHeaderDescription(row),
  };
}

/** Lock/unlock PUT — bypasses configured lock-date validation (icon only). */
function buildInvoiceScheduleLockPayload(rowData, nextLocked) {
  const form = buildAgreementProvEditForm(rowData);
  return {
    ...buildInvoiceSchedulePutPayload(rowData, form),
    IsLocked: Boolean(nextLocked),
    isLocked: Boolean(nextLocked),
    IgnoreLockDate: true,
    ignoreLockDate: true,
  };
}

function AgreementProvInvoiceEditDialog({
  open,
  onClose,
  rowData,
  onSave,
  saving,
  onSaveInvoiceLine,
  onDeleteInvoiceLine,
  lineActionSaving,
  registerReloadInvoiceLines,
  viewMode,
  createMode,
}) {
  const isCreateMode = Boolean(createMode);
  const editInvoiceHeaderFields = isCreateMode || !viewMode;
  const headerDescriptionLabel = isCreateMode ? "Period" : "Description";
  const [form, setForm] = useState({});
  const [invoiceLinesRows, setInvoiceLinesRows] = useState([]);
  const [invoiceLinesLoading, setInvoiceLinesLoading] = useState(false);
  const [invoiceLinesError, setInvoiceLinesError] = useState("");
  const [draftLineForm, setDraftLineForm] = useState(null);
  const [draftSaving, setDraftSaving] = useState(false);
  const [orderMoveSaving, setOrderMoveSaving] = useState(false);
  const invoiceDateInputRef = useRef(null);
  const dueDateInputRef = useRef(null);

  const reloadInvoiceLines = useCallback(async () => {
    if (!rowData) return [];
    const invoiceNo = String(pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || "").trim();
    if (!invoiceNo) {
      setInvoiceLinesRows([]);
      setForm(buildAgreementProvEditForm(rowData));
      return [];
    }
    setInvoiceLinesLoading(true);
    setInvoiceLinesError("");
    try {
      const response = await contractApi.getInvoiceScheduleByInvoiceNo(invoiceNo);
      const lines = unwrapContractInvoiceScheduleList(response);
      setInvoiceLinesRows(sortInvoiceLinesByOrder(lines));
      setForm((prev) => applyInvoiceLinesToForm(rowData, lines, prev));
      return lines;
    } catch (error) {
      console.error("Error loading invoice records by invoice no:", error);
      setInvoiceLinesRows([]);
      setInvoiceLinesError(getAgreementProvSaveErrorMessage(error));
      setForm(buildAgreementProvEditForm(rowData));
      return [];
    } finally {
      setInvoiceLinesLoading(false);
    }
  }, [rowData]);

  useEffect(() => {
    if (!open || !rowData) {
      setInvoiceLinesRows([]);
      setInvoiceLinesError("");
      setInvoiceLinesLoading(false);
      setForm({});
      setDraftLineForm(null);
      return undefined;
    }

    if (isCreateMode) {
      const base = buildAgreementProvEditForm(rowData);
      const invoiceDate =
        toScheduleDateInputValue(rowData.__draftInvoiceDate) || base.invoiceDate || "";
      const dateDefaults = buildCreateAgreementInvoiceDateDefaults(invoiceDate, rowData);
      setForm({
        ...base,
        invoiceNo: String(rowData.InvoiceNo ?? rowData.invoiceNo ?? base.invoiceNo ?? ""),
        invoiceDate,
        dueDate:
          dateDefaults.dueDate ||
          toScheduleDateInputValue(rowData.__draftDueDate) ||
          base.dueDate ||
          "",
        description: dateDefaults.description || base.description || "",
      });
      setInvoiceLinesRows([]);
      setInvoiceLinesError("");
      setInvoiceLinesLoading(false);
      setDraftLineForm(null);
      return undefined;
    }

    let cancelled = false;
    const load = async () => {
      if (!cancelled) await reloadInvoiceLines();
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [open, rowData, isCreateMode, reloadInvoiceLines]);

  useEffect(() => {
    if (!registerReloadInvoiceLines || isCreateMode) return undefined;
    if (open) {
      registerReloadInvoiceLines(reloadInvoiceLines);
    } else {
      registerReloadInvoiceLines(null);
    }
    return () => registerReloadInvoiceLines(null);
  }, [open, isCreateMode, registerReloadInvoiceLines, reloadInvoiceLines]);

  const handleChange = (field) => (e) => {
    const value = e.target.value;
    setForm((prev) => {
      if (isCreateMode && field === "invoiceDate") {
        const dateDefaults = buildCreateAgreementInvoiceDateDefaults(value, rowData);
        return {
          ...prev,
          invoiceDate: value,
          dueDate: dateDefaults.dueDate,
          description: dateDefaults.description,
        };
      }
      return { ...prev, [field]: value };
    });
  };

  const handleSave = async () => {
    if (!onSave) return;
    await onSave(form, rowData);
  };

  const canAddRecord = Boolean(
    String(form.contractNo || "").trim() && String(form.invoiceNo || "").trim()
  );

  const handleStartAddRecord = () => {
    if (!canAddRecord || draftLineForm) return;
    setDraftLineForm(buildEmptyDraftInvoiceAddForm(form, rowData, invoiceLinesRows));
  };

  const handleStartEditRecord = (lineRow, lineKey) => {
    if (!canAddRecord || draftLineForm || !lineRow) return;
    setDraftLineForm(buildDraftInvoiceEditFormFromLine(lineRow, form, rowData, lineKey));
  };

  const handleDuplicateRecord = (sourceLine) => {
    if (!canAddRecord || draftLineForm || !sourceLine) return;
    setDraftLineForm(
      buildDuplicateDraftInvoiceAddForm(sourceLine, form, rowData, invoiceLinesRows)
    );
  };

  const handleMoveLineOrder = async (lineRow, direction) => {
    if (!canAddRecord || draftLineForm || !lineRow || orderMoveSaving) return;
    const orderedRows = sortInvoiceLinesByOrder(invoiceLinesRows || []).filter(
      (r) => !isMainInvoiceScheduleRow(r)
    );
    const currentSub = pickInvoiceLineSubInvoiceNo(lineRow);
    const currentIndex = orderedRows.findIndex(
      (r) => pickInvoiceLineSubInvoiceNo(r) === currentSub
    );
    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedRows.length) return;

    const currentRow = orderedRows[currentIndex];
    const targetRow = orderedRows[targetIndex];
    const currentKeys = getInvoiceLineRouteKeys(currentRow, rowData, form);
    const targetKeys = getInvoiceLineRouteKeys(targetRow, rowData, form);
    if (
      !currentKeys.contractNo ||
      !currentKeys.invoiceNo ||
      !currentKeys.subInvoiceNo ||
      !targetKeys.contractNo ||
      !targetKeys.invoiceNo ||
      !targetKeys.subInvoiceNo
    ) {
      alert("Cannot move: Contract No, Invoice ID, and Sub Invoice are required.");
      return;
    }

    const currentOrder = getInvoiceLineEffectiveSortOrder(currentRow, currentIndex);
    const targetOrder = getInvoiceLineEffectiveSortOrder(targetRow, targetIndex);
    const currentForm = {
      ...buildDraftInvoiceEditFormFromLine(
        currentRow,
        form,
        rowData,
        `sub-${currentKeys.subInvoiceNo}`
      ),
      sortOrder: String(targetOrder),
      pendingSubInvoiceNo: currentKeys.subInvoiceNo,
    };
    const targetForm = {
      ...buildDraftInvoiceEditFormFromLine(
        targetRow,
        form,
        rowData,
        `sub-${targetKeys.subInvoiceNo}`
      ),
      sortOrder: String(currentOrder),
      pendingSubInvoiceNo: targetKeys.subInvoiceNo,
    };

    setOrderMoveSaving(true);
    try {
      await Promise.all([
        contractApi.updateInvoiceScheduleSub(
          currentKeys.contractNo,
          currentKeys.invoiceNo,
          currentKeys.subInvoiceNo,
          buildInvoiceScheduleCreatePayload(rowData, form, currentForm)
        ),
        contractApi.updateInvoiceScheduleSub(
          targetKeys.contractNo,
          targetKeys.invoiceNo,
          targetKeys.subInvoiceNo,
          buildInvoiceScheduleCreatePayload(rowData, form, targetForm)
        ),
      ]);
      await reloadInvoiceLines();
    } catch (error) {
      console.error("Error moving invoice record:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    } finally {
      setOrderMoveSaving(false);
    }
  };

  const recalcDraftTotal = (draft) => {
    const totalVal = computeInvoiceRecordLineTotal(
      draft.months,
      draft.calculatedRentPM,
      draft.discountPercent
    );
    return {
      ...draft,
      total: totalVal != null ? String(totalVal) : "",
    };
  };

  const handleDraftFieldChange = (field) => (e) => {
    setDraftLineForm((prev) => {
      if (!prev) return prev;
      return { ...prev, [field]: e.target.value };
    });
  };

  const handleDraftIntegerFieldChange = (field) => (e) => {
    const value = sanitizeIntegerInputValue(e.target.value);
    setDraftLineForm((prev) => {
      if (!prev) return prev;
      return recalcDraftTotal({ ...prev, [field]: value });
    });
  };

  const handleDraftNumericFieldChange = (field) => (e) => {
    const value = sanitizeDecimalNumericInputValue(e.target.value);
    setDraftLineForm((prev) => {
      if (!prev) return prev;
      return recalcDraftTotal({ ...prev, [field]: value });
    });
  };

  const handleDraftCancel = () => {
    if (draftSaving) return;
    setDraftLineForm(null);
  };

  const handleDraftSave = async () => {
    if (!draftLineForm || !onSaveInvoiceLine) return;
    const totalVal = computeInvoiceRecordLineTotal(
      draftLineForm.months,
      draftLineForm.calculatedRentPM,
      draftLineForm.discountPercent
    );
    const addForm = {
      ...draftLineForm,
      invoiceDate: draftLineForm.invoiceDate || form.invoiceDate,
      dueDate: draftLineForm.dueDate || form.dueDate,
      total: totalVal != null ? String(totalVal) : draftLineForm.total,
    };
    setDraftSaving(true);
    try {
      await onSaveInvoiceLine(addForm, rowData, form, draftLineForm.editingLineRow || null);
      setDraftLineForm(null);
    } finally {
      setDraftSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600, pb: 1 }}>
        {isCreateMode ? "Create Agreement Invoice" : "Edit Agreement Invoice"}
      </DialogTitle>
      <DialogContent sx={{ pt: 0.5 }}>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <AgreementProvReadOnlyInfoPanel>
              <MDBox
                sx={{
                  ...EDIT_BASIC_INFO_ROW_SX,
                  gridTemplateColumns: "repeat(6, minmax(0, 1fr))",
                }}
              >
                <AgreementProvReadOnlyField compact label="Contract No" value={form.contractNo} />
                <AgreementProvReadOnlyField
                  compact
                  label="CSD"
                  value={formatDateDDMMMYYYY(form.contractStartDate)}
                />
                <AgreementProvReadOnlyField
                  compact
                  label="CED"
                  value={formatDateDDMMMYYYY(form.contractEndDate)}
                />
                <AgreementProvReadOnlyField
                  compact
                  label="COD"
                  value={formatDateDDMMMYYYY(form.cod)}
                />
                <AgreementProvReadOnlyField
                  compact
                  label="Revenue Rate"
                  value={formatScheduleGridNumber(form.rentalValueRate)}
                />
                <AgreementProvReadOnlyField
                  compact
                  label="Initial Rent PM"
                  value={formatScheduleGridNumber(form.initialRentPM)}
                />
              </MDBox>
              <MDBox
                sx={{
                  ...EDIT_BASIC_INFO_ROW_SX,
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                }}
              >
                <AgreementProvReadOnlyField compact label="Tenant No" value={form.prefixNo} />
                <AgreementProvReadOnlyField
                  compact
                  label="Business Name"
                  value={form.businessName}
                />
                <AgreementProvReadOnlyField compact label="Address" value={form.address} />
              </MDBox>
              <MDBox
                sx={{
                  ...EDIT_BASIC_INFO_ROW_SX,
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                }}
              >
                <AgreementProvReadOnlyField compact label="Invoice No" value={form.invoiceNo} />
                {!editInvoiceHeaderFields ? (
                  <AgreementProvReadOnlyField
                    compact
                    label="Invoice Date"
                    value={formatDateDDMMMYYYY(form.invoiceDate)}
                  />
                ) : (
                  <AgreementProvPanelEditableField label="Invoice Date">
                    <MDBox sx={{ position: "relative" }}>
                      <input
                        type="date"
                        ref={invoiceDateInputRef}
                        value={form.invoiceDate || ""}
                        onChange={handleChange("invoiceDate")}
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
                        type="text"
                        value={toAgreementProvDisplayDate(form.invoiceDate)}
                        readOnly
                        fullWidth
                        size="small"
                        onClick={() => openAgreementProvDatePicker(invoiceDateInputRef)}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <InputAdornment position="end">
                              <Icon
                                sx={{ cursor: "pointer", fontSize: "1.1rem" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAgreementProvDatePicker(invoiceDateInputRef);
                                }}
                              >
                                calendar_today
                              </Icon>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          ...agreementProvPanelInputSx,
                          mt: 0,
                          "& .MuiInputBase-input": { cursor: "pointer" },
                        }}
                      />
                    </MDBox>
                  </AgreementProvPanelEditableField>
                )}
                {!editInvoiceHeaderFields ? (
                  <AgreementProvReadOnlyField
                    compact
                    label="Due Date"
                    value={formatDateDDMMMYYYY(form.dueDate)}
                  />
                ) : (
                  <AgreementProvPanelEditableField label="Due Date">
                    <MDBox sx={{ position: "relative" }}>
                      <input
                        type="date"
                        ref={dueDateInputRef}
                        value={form.dueDate || ""}
                        onChange={(e) => setForm((prev) => ({ ...prev, dueDate: e.target.value }))}
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
                        type="text"
                        value={toAgreementProvDisplayDate(form.dueDate)}
                        readOnly
                        fullWidth
                        size="small"
                        onClick={() => openAgreementProvDatePicker(dueDateInputRef)}
                        InputProps={{
                          readOnly: true,
                          endAdornment: (
                            <InputAdornment position="end">
                              <Icon
                                sx={{ cursor: "pointer", fontSize: "1.1rem" }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openAgreementProvDatePicker(dueDateInputRef);
                                }}
                              >
                                calendar_today
                              </Icon>
                            </InputAdornment>
                          ),
                        }}
                        sx={{
                          ...agreementProvPanelInputSx,
                          mt: 0,
                          "& .MuiInputBase-input": { cursor: "pointer" },
                        }}
                      />
                    </MDBox>
                  </AgreementProvPanelEditableField>
                )}
                {!editInvoiceHeaderFields ? (
                  <MDBox sx={{ minHeight: 34, pr: 0.5 }}>
                    <MDTypography
                      variant="caption"
                      color="text"
                      fontWeight="medium"
                      display="block"
                      lineHeight={1.15}
                      sx={agreementProvPanelFieldLabelSx}
                    >
                      {headerDescriptionLabel}
                    </MDTypography>
                    <MDBox sx={{ mt: 0.25 }}>
                      <AgreementProvLongTextCell
                        compact
                        maxVisibleChars={35}
                        value={form.description}
                      />
                    </MDBox>
                  </MDBox>
                ) : (
                  <AgreementProvPanelEditableField label={headerDescriptionLabel}>
                    <MDInput
                      value={form.description ?? ""}
                      onChange={handleChange("description")}
                      fullWidth
                      size="small"
                      sx={{ ...agreementProvPanelInputSx, mt: 0 }}
                    />
                  </AgreementProvPanelEditableField>
                )}
              </MDBox>
            </AgreementProvReadOnlyInfoPanel>
          </Grid>
          {!isCreateMode && (
            <Grid item xs={12}>
              <MDBox
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                mt={1.5}
                mb={1}
              >
                <MDTypography variant="button" fontWeight="bold">
                  Invoice Item records
                </MDTypography>
                {!viewMode && (
                  <Tooltip title="Add invoice record">
                    <span>
                      <IconButton
                        color="info"
                        size="small"
                        disabled={
                          saving ||
                          orderMoveSaving ||
                          !canAddRecord ||
                          Boolean(draftLineForm) ||
                          draftSaving
                        }
                        onClick={handleStartAddRecord}
                        sx={{
                          p: 0.35,
                          border: "1px solid",
                          borderColor: "info.main",
                          borderRadius: 1,
                        }}
                      >
                        <Icon sx={{ fontSize: "1rem !important" }}>add</Icon>
                      </IconButton>
                    </span>
                  </Tooltip>
                )}
              </MDBox>
              <AgreementProvInvoiceLinesGrid
                rows={invoiceLinesRows}
                loading={invoiceLinesLoading}
                error={invoiceLinesError}
                lineActionSaving={lineActionSaving || orderMoveSaving}
                saving={saving}
                form={form}
                rowData={rowData}
                readOnly={viewMode}
                draftLineForm={viewMode ? null : draftLineForm}
                onDraftFieldChange={handleDraftFieldChange}
                onDraftIntegerFieldChange={handleDraftIntegerFieldChange}
                onDraftNumericFieldChange={handleDraftNumericFieldChange}
                onDraftSave={handleDraftSave}
                onDraftCancel={handleDraftCancel}
                draftSaving={draftSaving}
                onDuplicateLine={(lineRow) => handleDuplicateRecord(lineRow)}
                onEditLine={(lineRow, lineKey) => handleStartEditRecord(lineRow, lineKey)}
                onMoveLine={handleMoveLineOrder}
                onDeleteLine={(lineRow, parentForm, parentRow) =>
                  onDeleteInvoiceLine?.(lineRow, parentForm, parentRow, reloadInvoiceLines)
                }
              />
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          Close
        </MDButton>
        {!viewMode && (
          <MDButton variant="gradient" color="info" onClick={handleSave} disabled={saving}>
            {saving
              ? isCreateMode
                ? "Creating..."
                : "Saving..."
              : isCreateMode
              ? "Create"
              : "Save"}
          </MDButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

AgreementProvInvoiceEditDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  saving: PropTypes.bool,
  rowData: PropTypes.object,
  onSaveInvoiceLine: PropTypes.func,
  onDeleteInvoiceLine: PropTypes.func,
  lineActionSaving: PropTypes.bool,
  registerReloadInvoiceLines: PropTypes.func,
  viewMode: PropTypes.bool,
  createMode: PropTypes.bool,
};

function normalizeAgreementProvInvoiceRow(row) {
  const periodStart = row.PeriodStart ?? row.periodStart ?? "";
  const periodEnd = row.PeriodEnd ?? row.periodEnd ?? "";
  const contractStartDate = row.ContractStartDate ?? row.contractStartDate ?? "";
  const contractEndDate = row.ContractEndDate ?? row.contractEndDate ?? "";
  const invoiceDate = pickScheduleInvoiceDate(row);
  return {
    ...row,
    id:
      row.InvoiceScheduleId ??
      row.invoiceScheduleId ??
      row.Id ??
      row.id ??
      row.ContractId ??
      row.contractId,
    contractId: row.ContractId ?? row.contractId,
    invoiceScheduleId: row.InvoiceScheduleId ?? row.invoiceScheduleId ?? row.Id ?? row.id,
    contractPeriod:
      contractStartDate && contractEndDate
        ? `${contractStartDate}|${contractEndDate}`
        : contractStartDate || contractEndDate || "",
    period:
      periodStart && periodEnd ? `${periodStart}|${periodEnd}` : periodStart || periodEnd || "",
    invoiceDate,
    dueDate: row.DueDate ?? row.dueDate ?? "",
    contractNo: row.ContractNo ?? row.contractNo ?? "",
    invoiceNo: row.InvoiceNo ?? row.invoiceNo ?? "",
    periodStart: row.PeriodStart ?? row.periodStart ?? "",
    periodEnd: row.PeriodEnd ?? row.periodEnd ?? "",
    months: row.Months ?? row.months,
    calculatedRentPM: row.CalculatedRentPM ?? row.calculatedRentPM,
    totalRent: row.TotalRent ?? row.totalRent,
    remarks: row.Remarks ?? row.remarks ?? "",
    contractStartDate,
    contractEndDate,
    businessName: row.BusinessName ?? row.businessName ?? "",
    tenantName: formatPrefixNoDisplay(row),
    initialRentPM: row.InitialRentPM ?? row.initialRentPM ?? "",
    paymentTermMonths: row.PaymentTermMonths ?? row.paymentTermMonths ?? "",
    riseTermType: row.RiseTermType ?? row.riseTermType ?? "",
    riseTerm: row.RiseTerm ?? row.riseTerm ?? "",
    riseRate: row.RiseRate ?? row.riseRate,
    riseDate: row.RiseDate ?? row.riseDate ?? "",
    invoiceDateType: row.InvoiceDateType ?? row.invoiceDateType ?? "",
    cmdId: row.CmdId ?? row.cmdId,
    baseId: row.BaseId ?? row.baseId,
    classId: row.ClassId ?? row.classId,
    amountReceived: row.AmountReceived ?? row.amountReceived ?? 0,
    amountReceivable: row.AmountReceivable ?? row.amountReceivable ?? 0,
    invoiceStatus: row.InvoiceStatus ?? row.invoiceStatus ?? "",
    daysToDue: row.DaysToDue ?? row.daysToDue ?? row.daystodue ?? "",
    daysOverdue: row.DaysOverdue ?? row.daysOverdue ?? row.daysoverdue ?? "",
    description: pickAgreementProvHeaderDescription(row),
    amountTotal: row.TotalRent ?? row.totalRent ?? 0,
    amountPending:
      row.AmountPending ??
      row.amountPending ??
      Math.max(
        0,
        Number(row.AmountReceivable ?? row.amountReceivable ?? 0) -
          Number(row.AmountReceived ?? row.amountReceived ?? 0)
      ),
  };
}

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
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRowData, setEditRowData] = useState(null);
  const [editDialogViewMode, setEditDialogViewMode] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [savingAdd, setSavingAdd] = useState(false);
  const [lineActionSaving, setLineActionSaving] = useState(false);
  const [invoiceLockSavingKey, setInvoiceLockSavingKey] = useState("");
  const reloadInvoiceLinesRef = useRef(null);
  const urlDeepLink = useMemo(() => readAgreementProvInvoiceUrlParams(), []);
  const urlDeepLinkAppliedRef = useRef(false);
  const registerReloadInvoiceLines = useCallback((fn) => {
    reloadInvoiceLinesRef.current = typeof fn === "function" ? fn : null;
  }, []);
  const AGREEMENT_PROV_GROUP_BY_CACHE_KEY = "agreementProvInvoice_groupByColumns";
  const [groupByColumns, setGroupByColumns] = useState(() => {
    try {
      const cached = localStorage.getItem(AGREEMENT_PROV_GROUP_BY_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (_) {
      // ignore invalid cache
    }
    return [];
  });

  useEffect(() => {
    try {
      localStorage.setItem(AGREEMENT_PROV_GROUP_BY_CACHE_KEY, JSON.stringify(groupByColumns));
    } catch (_) {
      // ignore storage errors
    }
  }, [groupByColumns]);

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupByColumns]);

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

  useEffect(() => {
    if (urlDeepLinkAppliedRef.current || !urlDeepLink.contractNo) return;
    urlDeepLinkAppliedRef.current = true;

    const contractNoParam = urlDeepLink.contractNo;
    setFilters((prev) => ({
      ...prev,
      contractNo: { ContractNo: contractNoParam, contractNo: contractNoParam },
    }));

    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const response = await contractApi.getInvoiceSchedule({ contractNo: contractNoParam });
        let scheduleData = unwrapContractInvoiceScheduleList(response);
        if (urlDeepLink.invoiceNo) {
          const invKey = urlDeepLink.invoiceNo.toLowerCase();
          scheduleData = scheduleData.filter(
            (row) =>
              String(row.InvoiceNo ?? row.invoiceNo ?? "")
                .trim()
                .toLowerCase() === invKey
          );
        }
        if (!cancelled) setRows(scheduleData.map(normalizeAgreementProvInvoiceRow));
      } catch (error) {
        console.error("Error loading contract invoice schedule from URL:", error);
        if (!cancelled) setRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [urlDeepLink.contractNo, urlDeepLink.invoiceNo]);

  useEffect(() => {
    if (!urlDeepLink.contractNo || !contracts.length) return;
    const matchedContract = contracts.find(
      (c) =>
        String(c.ContractNo || c.contractNo || "")
          .trim()
          .toLowerCase() === urlDeepLink.contractNo.toLowerCase()
    );
    if (!matchedContract) return;
    setFilters((prev) => {
      const current =
        prev.contractNo?.ContractNo || prev.contractNo?.contractNo || prev.contractNo || "";
      if (String(current).trim().toLowerCase() !== urlDeepLink.contractNo.toLowerCase()) {
        return prev;
      }
      if (prev.contractNo === matchedContract) return prev;
      return { ...prev, contractNo: matchedContract };
    });
  }, [contracts, urlDeepLink.contractNo]);

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
      const apiParams = {};
      if (filters.command) apiParams.cmdId = Number(filters.command);
      if (filters.base) apiParams.baseId = Number(filters.base);
      if (filters.dateFrom) apiParams.fromDate = filters.dateFrom;
      if (filters.dateTo) apiParams.toDate = filters.dateTo;
      if (filters.contractNo) {
        apiParams.contractNo =
          filters.contractNo.contractNo || filters.contractNo.ContractNo || filters.contractNo;
      }

      const response = await contractApi.getInvoiceSchedule(apiParams);
      let scheduleData = unwrapContractInvoiceScheduleList(response);

      // Unit (UoM) is not a ContractInvoiceSchedule query param; match on row UoM/UnitName when selected.
      if (filters.unit) {
        const selectedUnit = units.find((u) => Number(u.id) === Number(filters.unit));
        const unitName = selectedUnit?.name || selectedUnit?.unitName || selectedUnit?.Name;
        if (unitName) {
          scheduleData = scheduleData.filter((row) => {
            const rowUnit = String(
              row.UnitName ?? row.unitName ?? row.UoM ?? row.uoM ?? row.UOM ?? row.uom ?? ""
            ).trim();
            return rowUnit === String(unitName).trim();
          });
        }
      }

      setRows(scheduleData.map(normalizeAgreementProvInvoiceRow));
    } catch (error) {
      console.error("Error loading contract invoice schedule:", error);
      alert("Failed to load invoice schedule. Please try again.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const handleInvoiceLockChange = async (rowData, nextLocked) => {
    const contractNo = String(
      pickScheduleRowField(rowData, "ContractNo", "contractNo") || ""
    ).trim();
    const invoiceNo = String(pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || "").trim();
    if (!contractNo || !invoiceNo) {
      alert("Cannot update lock: Contract No and Invoice No are required.");
      return;
    }
    const key = `${contractNo}|${invoiceNo}`;
    setInvoiceLockSavingKey(key);
    try {
      await contractApi.updateInvoiceSchedule(
        contractNo,
        invoiceNo,
        buildInvoiceScheduleLockPayload(rowData, nextLocked)
      );
      await handleSearch();
    } catch (error) {
      console.error("Error updating invoice lock:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    } finally {
      setInvoiceLockSavingKey("");
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
      const formatPdfScheduleDate = (raw) => {
        const formatted = formatDateDDMMMYYYY(raw);
        return formatted === "-" ? "" : formatted;
      };
      const invoiceDateDisplay = formatPdfScheduleDate(pickScheduleInvoiceDate(rowData));
      const dueDateDisplay = formatPdfScheduleDate(
        pickScheduleRowField(rowData, "DueDate", "dueDate")
      );
      doc.text("Invoice date:", invoiceInfoX, yPos);
      yPos += 5;
      doc.text(`${invoiceDateDisplay}`, invoiceInfoX, yPos);
      yPos += 7;
      doc.text("Due date:", invoiceInfoX, yPos);
      yPos += 5;
      doc.text(`${dueDateDisplay}`, invoiceInfoX, yPos);
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

  const AGREEMENT_PROV_DATE_COLUMN_IDS = new Set([
    "contractstartdate",
    "contractenddate",
    "periodstart",
    "periodend",
    "risedate",
    "invoicedate",
    "duedate",
  ]);

  const AGREEMENT_PROV_NUMBER_COLUMN_IDS = new Set([
    "contractid",
    "months",
    "calculatedrentpm",
    "totalrent",
    "initialrentpm",
    "paymenttermmonths",
    "riserate",
    "cmdid",
    "baseid",
    "classid",
    "amountreceived",
    "amountreceivable",
    "amountpending",
    "totalrent",
    "netamount",
  ]);

  // Excel export cell formatter to format dates as dd-mmm-yyyy
  const exportCellFormatter = ({ value, column }) => {
    const colId = String(column?.id || column?.accessor || "").toLowerCase();
    if (AGREEMENT_PROV_DATE_COLUMN_IDS.has(colId)) {
      return formatDateDDMMMYYYY(value);
    }
    if (AGREEMENT_PROV_NUMBER_COLUMN_IDS.has(colId)) {
      const n = Number(value);
      return Number.isFinite(n) ? n : value ?? "";
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

  const scheduleDateColumn = (id, header, pascalKey, camelKey) => ({
    id,
    Header: header,
    accessor: camelKey,
    align: "left",
    filter: "agreementProvDateCompare",
    Filter: AgreementProvDateColumnFilter,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      return formatDateDDMMMYYYY(pickScheduleRowField(rowData, pascalKey, camelKey));
    },
  });

  const scheduleTextColumn = (id, header, pascalKey, camelKey, align = "left") => ({
    id,
    Header: header,
    accessor: camelKey,
    align,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      const v = pickScheduleRowField(rowData, pascalKey, camelKey);
      return v === "" ? "-" : String(v);
    },
  });

  const scheduleNumberColumn = (id, header, pascalKey, camelKey, clickable = false) => ({
    id,
    Header: header,
    accessor: camelKey,
    align: "right",
    Cell: clickable
      ? // eslint-disable-next-line react/prop-types
        ({ row }) => {
          const rowData = row?.original || {};
          if (isAgreementProvContractBasicInfoRow(rowData)) return null;
          return renderClickableAmountCell({
            value: pickScheduleRowField(rowData, pascalKey, camelKey),
          });
        }
      : // eslint-disable-next-line react/prop-types
        ({ row }) => {
          const rowData = row?.original || {};
          if (isAgreementProvContractBasicInfoRow(rowData)) return null;
          return formatScheduleGridNumber(pickScheduleRowField(rowData, pascalKey, camelKey));
        },
  });

  const handleOpenEditRow = (rowData) => {
    if (pickScheduleRowIsLocked(rowData) && !api.isSuperuserUser()) return;
    setEditRowData(rowData);
    setEditDialogViewMode(false);
    setEditDialogOpen(true);
  };

  const handleOpenViewRow = (rowData) => {
    setEditRowData(rowData);
    setEditDialogViewMode(true);
    setEditDialogOpen(true);
  };

  const handleCloseEditRow = () => {
    setEditDialogOpen(false);
    setEditRowData(null);
    setEditDialogViewMode(false);
  };

  const handleSaveEditRow = async (form, rowData) => {
    const { contractNo, invoiceNo } = getInvoiceScheduleRouteKeys(rowData, form);
    if (!contractNo || !invoiceNo) {
      alert("Cannot update: Contract No and Invoice ID are required.");
      return;
    }

    setSavingEdit(true);
    try {
      const payload = buildInvoiceSchedulePutPayload(rowData, form);
      await contractApi.updateInvoiceSchedule(contractNo, invoiceNo, payload);
      handleCloseEditRow();
      await handleSearch();
    } catch (error) {
      console.error("Error updating contract invoice schedule:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDeleteInvoiceLine = async (lineRow, parentForm, parentRow, reloadInvoiceLines) => {
    const { contractNo, invoiceNo, subInvoiceNo } = getInvoiceLineRouteKeys(
      lineRow,
      parentRow,
      parentForm
    );
    if (!contractNo || !invoiceNo || !subInvoiceNo) {
      alert("Cannot delete: Contract No, Invoice ID, and Sub Invoice are required.");
      return;
    }
    if (!window.confirm("Delete this invoice record?")) return;

    setLineActionSaving(true);
    try {
      await contractApi.deleteInvoiceSchedule(contractNo, invoiceNo, subInvoiceNo);
      if (typeof reloadInvoiceLines === "function") await reloadInvoiceLines();
    } catch (error) {
      console.error("Error deleting invoice record:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    } finally {
      setLineActionSaving(false);
    }
  };

  const handleSaveAddRecord = async (addForm, parentRow, parentForm, editLineRow) => {
    const { contractNo, invoiceNo } = getInvoiceScheduleRouteKeys(parentRow, parentForm);
    if (!contractNo || !invoiceNo) {
      alert("Cannot add: Contract No and Invoice ID are required.");
      return;
    }
    if (!addForm.invoiceDate?.trim()) {
      alert("Invoice Date is required.");
      return;
    }
    if (addForm.calculatedRentPM === "" || addForm.calculatedRentPM == null) {
      alert("Rate PM is required.");
      return;
    }
    if (addForm.months === "" || addForm.months == null) {
      alert("Months is required.");
      return;
    }
    let subInvoiceNo = "";
    if (editLineRow) {
      subInvoiceNo = getInvoiceLineRouteKeys(editLineRow, parentRow, parentForm).subInvoiceNo;
      if (!subInvoiceNo) {
        alert("Cannot update: Sub Invoice is required.");
        return;
      }
    }

    setSavingAdd(true);
    try {
      if (editLineRow) {
        const payload = buildInvoiceScheduleCreatePayload(parentRow, parentForm, {
          ...addForm,
          pendingSubInvoiceNo: subInvoiceNo,
          sortOrder: addForm.sortOrder || "1",
        });
        await contractApi.updateInvoiceScheduleSub(contractNo, invoiceNo, subInvoiceNo, payload);
      } else {
        let linesForSuggest = rows;
        const reload = reloadInvoiceLinesRef.current;
        if (typeof reload === "function") {
          const freshLines = await reload();
          if (Array.isArray(freshLines) && freshLines.length > 0) {
            linesForSuggest = freshLines;
          }
        } else {
          try {
            const response = await contractApi.getInvoiceScheduleByInvoiceNo(invoiceNo);
            const apiLines = unwrapContractInvoiceScheduleList(response);
            if (apiLines.length > 0) linesForSuggest = apiLines;
          } catch (error) {
            console.error("Error loading invoice lines for SubInvoiceNo:", error);
          }
        }
        const newSubInvoiceNo =
          String(addForm.pendingSubInvoiceNo || "").trim() ||
          suggestNextSubInvoiceNo(parentRow, parentForm, linesForSuggest);
        const payload = buildInvoiceScheduleCreatePayload(parentRow, parentForm, {
          ...addForm,
          pendingSubInvoiceNo: newSubInvoiceNo,
          sortOrder: String(suggestNextInvoiceSortOrder(linesForSuggest)),
        });
        await contractApi.createInvoiceSchedule(contractNo, invoiceNo, newSubInvoiceNo, payload);
      }
      const reload = reloadInvoiceLinesRef.current;
      if (typeof reload === "function") await reload();
    } catch (error) {
      console.error("Error saving contract invoice schedule:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    } finally {
      setSavingAdd(false);
    }
  };

  const actionColumn = {
    Header: "Action",
    accessor: "actions",
    align: "center",
    width: "56px",
    disableSortBy: true,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      if (rowData.isGroupRow || rowData.IsGroupRow) return "";
      if (pickScheduleRowIsLocked(rowData) && !api.isSuperuserUser()) return "";
      return (
        <Tooltip title="Edit">
          <IconButton
            size="small"
            color="info"
            onClick={() => handleOpenEditRow(rowData)}
            sx={{ padding: "2px" }}
          >
            <Icon>edit</Icon>
          </IconButton>
        </Tooltip>
      );
    },
  };

  const viewPdfColumn = {
    Header: "View",
    accessor: "generatePdf",
    align: "center",
    width: "132px",
    disableSortBy: true,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      if (rowData.isGroupRow || rowData.IsGroupRow) {
        const groupKey = rowData.GroupKey ?? rowData.groupKey ?? "";
        const isExpanded = expandedGroups.has(groupKey);
        return (
          <IconButton
            size="small"
            color="info"
            onClick={() => {
              setExpandedGroups((prev) => {
                const next = new Set(prev);
                if (next.has(groupKey)) next.delete(groupKey);
                else next.add(groupKey);
                return next;
              });
            }}
            title={isExpanded ? "Collapse" : "Expand"}
            sx={{ padding: "2px" }}
          >
            <Icon>{isExpanded ? "expand_less" : "expand_more"}</Icon>
          </IconButton>
        );
      }
      const isLocked = pickScheduleRowIsLocked(rowData);
      const isSuper = api.isSuperuserUser();
      const contractNo = String(
        pickScheduleRowField(rowData, "ContractNo", "contractNo") || ""
      ).trim();
      const invoiceNo = String(
        pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || ""
      ).trim();
      const lockBusyKey = `${contractNo}|${invoiceNo}`;
      const lockBusy = invoiceLockSavingKey === lockBusyKey;

      return (
        <MDBox
          display="flex"
          justifyContent="center"
          alignItems="center"
          gap={0.25}
          onDoubleClick={(e) => {
            if (isSuper && isLocked) {
              e.preventDefault();
              e.stopPropagation();
              void handleInvoiceLockChange(rowData, false);
            }
          }}
        >
          <Tooltip
            title={
              isLocked
                ? isSuper
                  ? "Locked — double-click this cell to unlock"
                  : "Locked"
                : "Lock invoice"
            }
          >
            <span>
              <IconButton
                size="small"
                color={isLocked ? "secondary" : "default"}
                disabled={lockBusy || (isLocked && !isSuper)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLocked) return;
                  void handleInvoiceLockChange(rowData, true);
                }}
                sx={{ padding: "2px" }}
              >
                <Icon sx={{ fontSize: "1.15rem" }}>{isLocked ? "lock" : "lock_open"}</Icon>
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="View invoice">
            <IconButton
              size="small"
              color="info"
              onClick={() => handleOpenViewRow(rowData)}
              sx={{ padding: "2px" }}
            >
              <Icon sx={{ fontSize: "1.2rem" }}>visibility</Icon>
            </IconButton>
          </Tooltip>
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
        </MDBox>
      );
    },
  };

  const contractPeriodColumn = {
    id: "contractPeriod",
    Header: "Contract Period",
    accessor: "contractPeriod",
    align: "left",
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      const start = pickScheduleRowField(rowData, "ContractStartDate", "contractStartDate");
      const end = pickScheduleRowField(rowData, "ContractEndDate", "contractEndDate");
      if (!start && !end) return "-";
      if (start && end) {
        return `${formatDateDDMMMYYYY(start)} To ${formatDateDDMMMYYYY(end)}`;
      }
      return formatDateDDMMMYYYY(start || end);
    },
  };

  const periodColumn = {
    id: "period",
    Header: "Period",
    accessor: "period",
    align: "left",
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      const start = pickScheduleRowField(rowData, "PeriodStart", "periodStart");
      const end = pickScheduleRowField(rowData, "PeriodEnd", "periodEnd");
      if (!start && !end) return "-";
      if (start && end) {
        return `${formatDateDDMMMYYYY(start)} To ${formatDateDDMMMYYYY(end)}`;
      }
      return formatDateDDMMMYYYY(start || end);
    },
  };

  const invoiceDateColumn = {
    id: "invoiceDate",
    Header: "Invoice Date",
    accessor: "invoiceDate",
    align: "left",
    filter: "agreementProvDateCompare",
    Filter: AgreementProvDateColumnFilter,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      const dateLabel = formatDateDDMMMYYYY(pickScheduleInvoiceDate(rowData));
      const duePassed = isAgreementProvDueDatePassed(rowData);
      const overdueTone = duePassed ? "#111111" : "#d32f2f";
      return (
        <MDBox display="inline-flex" alignItems="center" gap={0.5} sx={{ minWidth: 0 }}>
          <Icon
            sx={{
              fontSize: "1.1rem",
              color: overdueTone,
              flexShrink: 0,
            }}
          >
            schedule
          </Icon>
          <MDTypography
            component="span"
            variant="caption"
            sx={{
              fontSize: "inherit",
              lineHeight: "inherit",
              whiteSpace: "nowrap",
              color: overdueTone,
            }}
          >
            {dateLabel}
          </MDTypography>
        </MDBox>
      );
    },
  };

  const descriptionColumn = {
    id: "description",
    Header: "Description",
    accessor: "description",
    align: "left",
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      return (
        <AgreementProvLongTextCell
          compact
          maxVisibleChars={25}
          value={pickAgreementProvHeaderDescription(rowData)}
        />
      );
    },
  };

  const dueDateColumn = {
    id: "dueDate",
    Header: "Due Date",
    accessor: "dueDate",
    align: "left",
    filter: "agreementProvDateCompare",
    Filter: AgreementProvDateColumnFilter,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      return formatDateDDMMMYYYY(pickScheduleRowField(rowData, "DueDate", "dueDate"));
    },
  };

  const commandColumn = {
    id: "cmdId",
    Header: "RAC",
    accessor: "cmdId",
    align: "left",
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      const id = pickScheduleRowField(rowData, "CmdId", "cmdId");
      const cmd = commands.find((c) => Number(c.id) === Number(id));
      return cmd?.name || (id !== "" ? String(id) : "-");
    },
  };

  const baseColumn = {
    id: "baseId",
    Header: "Base",
    accessor: "baseId",
    align: "left",
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      const id = pickScheduleRowField(rowData, "BaseId", "baseId");
      const base = bases.find((b) => Number(b.id) === Number(id));
      return base?.name || (id !== "" ? String(id) : "-");
    },
  };

  const invoiceStatusColumn = {
    id: "invoiceStatus",
    Header: "Invoice Status",
    accessor: (row) => pickScheduleRowField(row, "InvoiceStatus", "invoiceStatus"),
    align: "center",
    skipStatusNormalization: true,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      const statusValue = pickScheduleRowField(rowData, "InvoiceStatus", "invoiceStatus");
      if (statusValue === "") return "-";
      const label = String(statusValue).trim();
      const palette = agreementProvInvoiceStatusBadgePalette(label);
      if (!palette) return label;
      const { bg, fg, outline } = palette;
      return (
        <MDBox
          component="span"
          sx={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: "72px",
            px: 1,
            py: 0.35,
            borderRadius: "999px",
            fontWeight: 700,
            fontSize: "0.8125rem",
            lineHeight: 1.25,
            whiteSpace: "nowrap",
            backgroundColor: `${bg} !important`,
            color: `${fg} !important`,
            boxShadow: `inset 0 0 0 1px ${outline}`,
            "&, & *": { color: `${fg} !important` },
          }}
        >
          {label}
        </MDBox>
      );
    },
  };

  const tenantNameColumn = {
    id: "tenantName",
    Header: "Tenant Name",
    accessor: "tenantName",
    align: "left",
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      const v = formatPrefixNoDisplay(rowData);
      return v || "-";
    },
  };

  const contractNoColumn = {
    id: "contractNo",
    Header: "Contract No",
    accessor: "contractNo",
    align: "right",
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) {
        return (
          <MDBox sx={{ textAlign: "left", py: 0.5, minWidth: 720 }}>
            <AgreementProvContractBasicInfoStrip form={rowData.__basicInfoForm} />
          </MDBox>
        );
      }
      if (rowData.isGroupRow || rowData.IsGroupRow) {
        const groupLabel = pickScheduleRowField(rowData, "ContractNo", "contractNo");
        return groupLabel === "" ? "-" : String(groupLabel);
      }
      const contractNo = String(
        pickScheduleRowField(rowData, "ContractNo", "contractNo") || ""
      ).trim();
      if (!contractNo) return "-";
      return (
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
            openContractsFormInNewTab(contractNo);
          }}
        >
          {contractNo}
        </MDTypography>
      );
    },
  };

  // Primary column order, then remaining API fields
  const columns = [
    viewPdfColumn,
    actionColumn,
    commandColumn,
    baseColumn,
    contractNoColumn,
    contractPeriodColumn,
    scheduleTextColumn("businessName", "Business", "BusinessName", "businessName"),
    tenantNameColumn,
    scheduleTextColumn("invoiceNo", "Invoice ID", "InvoiceNo", "invoiceNo"),
    invoiceDateColumn,
    dueDateColumn,
    periodColumn,
    scheduleNumberColumn("calculatedRentPM", "Rate PM", "CalculatedRentPM", "calculatedRentPM"),
    scheduleNumberColumn("months", "Months", "Months", "months"),
    scheduleNumberColumn("totalRent", "Total Amount", "TotalRent", "totalRent", true),
    scheduleTextColumn("remarks", "Remarks", "Remarks", "remarks"),
    scheduleNumberColumn(
      "amountReceived",
      "Amount Received",
      "AmountReceived",
      "amountReceived",
      true
    ),
    scheduleNumberColumn(
      "amountReceivable",
      "Amount Receivable",
      "AmountReceivable",
      "amountReceivable",
      true
    ),
    scheduleNumberColumn("amountPending", "Amount Pending", "AmountPending", "amountPending", true),

    descriptionColumn,
    scheduleNumberColumn("daysToDue", "Days to due", "DaysToDue", "daysToDue"),
    scheduleNumberColumn("daysOverdue", "Days overdue", "DaysOverdue", "daysOverdue"),
    invoiceStatusColumn,
  ];

  const groupingColumnOptions = [
    { label: "Contract No", value: "contractNo" },
    { label: "Business", value: "businessName" },
    { label: "Invoice ID", value: "invoiceNo" },
    { label: "Invoice Status", value: "invoiceStatus" },
    { label: "Rise Term Type", value: "riseTermType" },
    { label: "Command", value: "cmdName" },
    { label: "Base", value: "baseName" },
    { label: "Months", value: "months" },
    { label: "Payment Term Months", value: "paymentTermMonths" },
  ];

  const AGREEMENT_PROV_GROUP_NUMERIC_SUM_KEYS = [
    "months",
    "calculatedRentPM",
    "totalRent",
    "initialRentPM",
    "paymentTermMonths",
    "riseRate",
    "amountReceived",
    "amountReceivable",
    "amountPending",
  ];

  const groupedData = useMemo(() => {
    const enrichedRows = (rows || []).map((row) => {
      const cmdId = row.cmdId ?? row.CmdId;
      const baseId = row.baseId ?? row.BaseId;
      const cmd = commands.find((c) => Number(c.id) === Number(cmdId));
      const base = bases.find((b) => Number(b.id) === Number(baseId));
      const locked = pickScheduleRowIsLocked(row);
      return {
        ...row,
        cmdName: cmd?.name || (cmdId !== "" && cmdId != null ? String(cmdId) : ""),
        baseName: base?.name || (baseId !== "" && baseId != null ? String(baseId) : ""),
        __disabledRow: locked,
      };
    });

    if (!Array.isArray(groupByColumns) || groupByColumns.length === 0) {
      return enrichedRows;
    }

    const groups = new Map();
    enrichedRows.forEach((row) => {
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
        groups.set(groupKey, { groupLabel, rows: [] });
      }
      groups.get(groupKey).rows.push(row);
    });

    const result = [];
    groups.forEach((group, groupKey) => {
      const isExpanded = expandedGroups.has(groupKey);
      const groupRows = group.rows;
      const numericSums = AGREEMENT_PROV_GROUP_NUMERIC_SUM_KEYS.reduce((acc, key) => {
        acc[key] = 0;
        return acc;
      }, {});

      groupRows.forEach((row) => {
        AGREEMENT_PROV_GROUP_NUMERIC_SUM_KEYS.forEach((key) => {
          numericSums[key] += Number(row[key] ?? 0);
        });
      });

      const groupedColumnValues = {};
      groupByColumns.forEach((col) => {
        const firstVal = groupRows[0]?.[col];
        groupedColumnValues[col] = firstVal !== undefined && firstVal !== null ? firstVal : "";
      });

      const groupedRowCount = groupRows.length;
      const contractNoWithGroupCount = group.groupLabel
        ? `${group.groupLabel} (${groupedRowCount})`
        : `(${groupedRowCount})`;

      const groupRow = {
        ...groupRows[0],
        ...numericSums,
        ...groupedColumnValues,
        contractNo: contractNoWithGroupCount,
        ContractNo: contractNoWithGroupCount,
        invoiceNo: "",
        InvoiceNo: "",
        contractPeriod: "",
        period: "",
        invoiceDate: "",
        dueDate: "",
        contractStartDate: "",
        contractEndDate: "",
        ContractStartDate: "",
        ContractEndDate: "",
        PeriodStart: "",
        PeriodEnd: "",
        periodStart: "",
        periodEnd: "",
        RiseDate: "",
        riseDate: "",
        remarks: "",
        Remarks: "",
        businessName: groupedColumnValues.businessName ?? "",
        BusinessName: groupedColumnValues.businessName ?? "",
        invoiceStatus: "",
        InvoiceStatus: "",
        invoiceDateType: groupedColumnValues.invoiceDateType ?? "",
        InvoiceDateType: groupedColumnValues.invoiceDateType ?? "",
        riseTermType: groupedColumnValues.riseTermType ?? "",
        RiseTermType: groupedColumnValues.riseTermType ?? "",
        riseTerm: groupedColumnValues.riseTerm ?? "",
        RiseTerm: groupedColumnValues.riseTerm ?? "",
        isGroupRow: true,
        IsGroupRow: true,
        GroupKey: groupKey,
        groupKey,
        GroupRows: groupRows,
      };

      result.push(groupRow);

      if (isExpanded) {
        groupRows.forEach((row) => {
          result.push({
            ...row,
            isExpandedRow: true,
            IsExpandedRow: true,
          });
        });
      }
    });

    return result;
  }, [rows, commands, bases, expandedGroups, groupByColumns]);

  const computedRows = useMemo(() => {
    if (!urlDeepLink.invoiceNo) return groupedData;
    const invKey = urlDeepLink.invoiceNo.toLowerCase();
    const matchesInvoice = (row) =>
      String(pickScheduleRowField(row, "InvoiceNo", "invoiceNo")).trim().toLowerCase() === invKey;
    return groupedData.filter((row) => {
      if (row.isContractBasicInfoRow || row.IsContractBasicInfoRow) {
        return (row.GroupRows || []).some(matchesInvoice);
      }
      if (row.isGroupRow || row.IsGroupRow) {
        return (row.GroupRows || []).some(matchesInvoice);
      }
      return matchesInvoice(row);
    });
  }, [groupedData, urlDeepLink.invoiceNo]);

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

  const filterControlHeight = "38px";
  const filterControlSx = { minHeight: filterControlHeight, height: filterControlHeight };

  // Unified styling for all filter inputs to ensure same size and symmetry
  // Add dark mode support for white text
  const baseFilterInputSx = {
    fontSize: "0.8125rem",
    minHeight: filterControlHeight,
    "& .MuiInputBase-root": {
      minHeight: filterControlHeight,
      height: filterControlHeight,
    },
    "& .MuiSelect-select": {
      fontSize: "0.8125rem",
      padding: "6px 10px",
      minHeight: filterControlHeight,
      height: filterControlHeight,
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
    "& .MuiInputBase-input": {
      fontSize: "0.8125rem",
      padding: "6px 10px",
      minHeight: filterControlHeight,
      height: filterControlHeight,
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
    "& .MuiOutlinedInput-root": {
      minHeight: filterControlHeight,
      height: filterControlHeight,
    },
    "& .MuiInputLabel-root": {
      fontSize: "0.8125rem",
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
  const dateFilterInputSx = [
    inputSx,
    {
      "& .MuiInputBase-input": {
        color: "transparent !important",
        caretColor: "transparent",
      },
      "& input::-webkit-datetime-edit, & input::-webkit-datetime-edit-fields-wrapper, & input::-webkit-datetime-edit-text, & input::-webkit-datetime-edit-month-field, & input::-webkit-datetime-edit-day-field, & input::-webkit-datetime-edit-year-field":
        {
          color: "transparent",
        },
    },
  ];

  // Autocomplete specific styling to match other inputs
  const autocompleteSx = {
    "& .MuiInputBase-root": {
      minHeight: filterControlHeight,
      height: filterControlHeight,
    },
    "& .MuiInputBase-input": {
      fontSize: "0.8125rem",
      padding: "6px 10px",
      minHeight: filterControlHeight,
      height: filterControlHeight,
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
                {/* Filters — single compact row before Search */}
                <MDBox
                  display="flex"
                  flexDirection="row"
                  flexWrap="nowrap"
                  alignItems="center"
                  gap={1}
                  mb={2}
                  sx={{ width: "100%", overflow: "hidden" }}
                >
                  <MDBox sx={{ flex: "1 1 95px", minWidth: 0 }}>
                    <FormControl fullWidth size="small" sx={filterControlSx}>
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
                  </MDBox>

                  <MDBox sx={{ flex: "1 1 95px", minWidth: 0 }}>
                    <FormControl
                      fullWidth
                      size="small"
                      disabled={!filters.command}
                      sx={filterControlSx}
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
                  </MDBox>

                  <MDBox sx={{ flex: "1 1 95px", minWidth: 0 }}>
                    <FormControl fullWidth size="small" sx={filterControlSx}>
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
                  </MDBox>

                  <MDBox sx={{ flex: "1 1 115px", minWidth: 0 }}>
                    <MDBox position="relative" sx={{ width: "100%" }}>
                      <MDInput
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => handleFilterChange("dateFrom", e.target.value)}
                        fullWidth
                        size="small"
                        inputProps={{ "aria-label": "Date From" }}
                        sx={dateFilterInputSx}
                      />
                      <MDBox
                        pointerEvents="none"
                        sx={{
                          position: "absolute",
                          left: 10,
                          right: 28,
                          top: 8,
                          bottom: 6,
                          display: "flex",
                          alignItems: "center",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <MDTypography
                          variant="caption"
                          sx={{
                            fontSize: "0.8125rem",
                            color: filters.dateFrom
                              ? "text.primary"
                              : darkMode
                              ? "rgba(255, 255, 255, 0.6)"
                              : "text.secondary",
                          }}
                        >
                          {filters.dateFrom ? formatDateDDMMMYYYY(filters.dateFrom) : "Date From"}
                        </MDTypography>
                      </MDBox>
                    </MDBox>
                  </MDBox>

                  <MDBox sx={{ flex: "1 1 115px", minWidth: 0 }}>
                    <MDBox position="relative" sx={{ width: "100%" }}>
                      <MDInput
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => handleFilterChange("dateTo", e.target.value)}
                        fullWidth
                        size="small"
                        inputProps={{
                          "aria-label": "Date To",
                          min: filters.dateFrom || undefined,
                        }}
                        sx={dateFilterInputSx}
                      />
                      <MDBox
                        pointerEvents="none"
                        sx={{
                          position: "absolute",
                          left: 10,
                          right: 28,
                          top: 8,
                          bottom: 6,
                          display: "flex",
                          alignItems: "center",
                          overflow: "hidden",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                        }}
                      >
                        <MDTypography
                          variant="caption"
                          sx={{
                            fontSize: "0.8125rem",
                            color: filters.dateTo
                              ? "text.primary"
                              : darkMode
                              ? "rgba(255, 255, 255, 0.6)"
                              : "text.secondary",
                          }}
                        >
                          {filters.dateTo ? formatDateDDMMMYYYY(filters.dateTo) : "Date To"}
                        </MDTypography>
                      </MDBox>
                    </MDBox>
                  </MDBox>

                  <MDBox sx={{ flex: "1 1 120px", minWidth: 0 }}>
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
                  </MDBox>

                  <MDBox sx={{ flex: "0 0 auto" }}>
                    <IconButton
                      color="info"
                      onClick={handleSearch}
                      disabled={loading}
                      sx={{
                        minHeight: filterControlHeight,
                        height: filterControlHeight,
                        width: filterControlHeight,
                        backgroundColor: "info.main",
                        color: "white !important",
                        "& .MuiSvgIcon-root": {
                          color: "white !important",
                          fontWeight: "bold",
                          fontSize: "1.25rem",
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
                      <Icon sx={{ fontWeight: "bold", fontSize: "1.25rem" }}>search</Icon>
                    </IconButton>
                  </MDBox>
                </MDBox>

                {/* Results Table */}
                <MDBox
                  position="relative"
                  aria-busy={loading}
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
                      minWidth: "100%",
                      borderCollapse: "collapse",
                    },
                    "& .MuiTable-root th, & .MuiTable-root td": {
                      textAlign: "center !important",
                    },
                    "& .MuiTable-root th": {
                      fontSize: "1.0rem !important",
                      fontWeight: "700 !important",
                      width: "auto !important",
                      minWidth: "0 !important",
                      padding: "1px 4px !important",
                      borderBottom: "1px solid #d0d0d0",
                      whiteSpace: "nowrap",
                      lineHeight: 1.3,
                      verticalAlign: "middle",
                    },
                    "& .MuiTable-root td": {
                      width: "auto !important",
                      minWidth: "0 !important",
                      padding: "1px 4px !important",
                      borderBottom: "1px solid #e0e0e0",
                      whiteSpace: "nowrap",
                      lineHeight: 1.3,
                      verticalAlign: "middle",
                      fontSize: "0.875rem",
                    },
                    "& table th > div, & table td > div": {
                      display: "inline-block !important",
                      width: "max-content !important",
                      maxWidth: "100% !important",
                      marginLeft: "auto !important",
                      marginRight: "auto !important",
                      textAlign: "center !important",
                    },
                    "& .MuiTable-root thead th > .MuiBox-root": {
                      justifyContent: "center !important",
                      textAlign: "center !important",
                    },
                    "& .MuiTable-root tbody td.MuiBox-root": {
                      textAlign: "center !important",
                    },
                    "& .MuiTable-root thead th:nth-of-type(3), & .MuiTable-root tbody td:nth-of-type(3)":
                      {
                        textAlign: "left !important",
                      },
                    "& .MuiTable-root thead th:nth-of-type(3) > .MuiBox-root": {
                      justifyContent: "flex-end !important",
                    },
                    "& .MuiTable-root tbody td:nth-of-type(3) > div": {
                      marginLeft: "auto !important",
                      marginRight: "0 !important",
                      textAlign: "left !important",
                    },
                    "& table td .MuiTypography-root": {
                      fontSize: "0.875rem !important",
                      lineHeight: "1.3 !important",
                    },
                    "& .MuiTable-root th:first-of-type, & .MuiTable-root td:first-of-type": {
                      paddingLeft: "2px !important",
                      paddingRight: "2px !important",
                    },
                    "& .MuiIconButton-root": {
                      padding: "2px",
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
                        backgroundColor: darkMode
                          ? "rgba(0, 0, 0, 0.65)"
                          : "rgba(255, 255, 255, 0.8)",
                        backdropFilter: "blur(2px)",
                        pointerEvents: "auto",
                      }}
                    >
                      <CurrencyLoading size={50} />
                    </MDBox>
                  )}
                  <DataTable
                    table={{ columns, rows: computedRows }}
                    stickyToolbarAndHeader
                    canSearch={true}
                    entriesPerPage={false}
                    showTotalEntries={true}
                    pagination={true}
                    isSorted={true}
                    noEndBorder
                    toolbarStart={
                      <MDBox width={{ xs: "100%", sm: "200px" }} sx={{ minWidth: { sm: 200 } }}>
                        <Autocomplete
                          multiple
                          size="small"
                          options={groupingColumnOptions}
                          disableCloseOnSelect
                          value={groupingColumnOptions.filter((opt) =>
                            groupByColumns.includes(opt.value)
                          )}
                          isOptionEqualToValue={(option, value) => option.value === value.value}
                          getOptionLabel={(option) => option.label}
                          onChange={(event, newValue) => {
                            setGroupByColumns((newValue || []).map((item) => item.value));
                          }}
                          renderInput={(params) => (
                            <MDInput
                              {...params}
                              label="Group By Columns"
                              placeholder="Select columns"
                              sx={{ ...filterInputSx, ...groupByInputSx }}
                            />
                          )}
                        />
                      </MDBox>
                    }
                    exportFileName="Agreement-Prov-Invoice"
                    exportCellFormatter={exportCellFormatter}
                    exportExcludeGroupParentsWhenExpanded
                    extraFilterTypes={AGREEMENT_PROV_DATATABLE_DATE_FILTER_TYPES}
                  />
                </MDBox>
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <AgreementProvInvoiceEditDialog
        open={editDialogOpen}
        onClose={handleCloseEditRow}
        rowData={editRowData}
        onSave={handleSaveEditRow}
        saving={savingEdit}
        viewMode={editDialogViewMode}
        onSaveInvoiceLine={handleSaveAddRecord}
        onDeleteInvoiceLine={handleDeleteInvoiceLine}
        lineActionSaving={lineActionSaving}
        registerReloadInvoiceLines={registerReloadInvoiceLines}
      />
    </DashboardLayout>
  );
}

export {
  AgreementProvContractBasicInfoStrip,
  AgreementProvInvoiceEditDialog,
  buildAgreementProvContractBasicInfoForm,
  buildAgreementProvEditForm,
};
