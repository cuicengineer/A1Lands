import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Grid from "@mui/material/Grid";
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
import CurrencyLoading from "components/CurrencyLoading";
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
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ContractsModuleTabs from "layouts/contracts/components/ContractsModuleTabs";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import CompactGroupBySelect from "components/CompactGroupBySelect";
import { withGridValueChip } from "utils/gridValueChipCell";
import PropTypes from "prop-types";
import api from "services/api.service";
import contractApi from "services/api.contract.service";
import accountingSysApi from "services/api.accountingsys.service";
import { useMaterialUIController } from "context";
import jsPDF from "jspdf";
import { format, parseISO, isValid, addDays, addMonths, addYears } from "date-fns";

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
  if (v === null || v === undefined || v === "" || v === false || v === 0 || v === "0") {
    return false;
  }
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "string" && v.trim().toLowerCase() === "true") return true;
  const n = Number(v);
  return Number.isFinite(n) && n === 1;
}

function pickScheduleRowIsFinalized(rowData) {
  if (!rowData) return false;
  const v =
    rowData?.IsFinalized ?? rowData?.isFinalized ?? rowData?.IsFinalize ?? rowData?.isFinalize;
  if (v === true || v === 1 || v === "1") return true;
  if (typeof v === "string" && v.trim().toLowerCase() === "true") return true;
  return false;
}

/** Grid row flags: blur + disabled styling when invoice is locked (IsLocked = 1). */
function agreementProvGridRowLockFlags(row) {
  const locked =
    row &&
    !row.isGroupRow &&
    !row.IsGroupRow &&
    !isAgreementProvContractBasicInfoRow(row) &&
    pickScheduleRowIsLocked(row);
  if (!locked) {
    return { __disabledRow: false, __rowClassName: "", __rowStyle: {} };
  }
  return {
    __disabledRow: true,
    __rowClassName: "agreement-prov-invoice-locked-row",
    __rowStyle: {},
  };
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

const EMPTY_AGREEMENT_PROV_FILTERS = {
  command: "",
  base: "",
  unit: "",
  dateFrom: "",
  dateTo: "",
  contractNo: null,
};

function getAgreementProvDefaultDateTo() {
  return format(addYears(new Date(), 1), "yyyy-MM-dd");
}

function scheduleRowContractStartDate(row) {
  const raw = pickScheduleRowField(row, "ContractStartDate", "contractStartDate");
  if (!raw) return null;
  try {
    const text = String(raw).trim().split("T")[0];
    const d = parseISO(text);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

/** Earliest ContractStartDate among schedule rows (yyyy-MM-dd for date inputs). */
function getOldestContractStartDateInput(scheduleRows) {
  let oldest = null;
  (scheduleRows || []).forEach((row) => {
    const contractStart = scheduleRowContractStartDate(row);
    if (!contractStart) return;
    if (!oldest || contractStart < oldest) oldest = contractStart;
  });
  return oldest ? format(oldest, "yyyy-MM-dd") : "";
}

function buildInitialAgreementProvFilters() {
  return {
    ...EMPTY_AGREEMENT_PROV_FILTERS,
    dateTo: getAgreementProvDefaultDateTo(),
  };
}

function scheduleRowContractNo(row) {
  return String(row?.ContractNo ?? row?.contractNo ?? "").trim();
}

/** Unique contract numbers from loaded schedule/grid rows (no separate contracts API). */
function buildAgreementProvContractNoFilterOptions(scheduleRows) {
  const byContractNo = new Map();
  (scheduleRows || []).forEach((row) => {
    if (row?.isGroupRow || row?.IsGroupRow) return;
    const contractNo = scheduleRowContractNo(row);
    if (!contractNo) return;
    const key = contractNo.toLowerCase();
    if (byContractNo.has(key)) return;
    byContractNo.set(key, { ContractNo: contractNo, contractNo });
  });
  return Array.from(byContractNo.values()).sort((a, b) =>
    a.contractNo.localeCompare(b.contractNo, undefined, { sensitivity: "base" })
  );
}

function scheduleRowFilterDate(row) {
  const raw =
    row?.InvoiceDate ??
    row?.invoiceDate ??
    row?.DueDate ??
    row?.dueDate ??
    row?.PeriodStart ??
    row?.periodStart ??
    "";
  if (!raw) return null;
  try {
    const text = String(raw).trim().split("T")[0];
    const d = parseISO(text);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

function buildAgreementProvSearchApiFilters(filters, extra = {}) {
  const contractNoRaw = filters?.contractNo;
  const contractNo = contractNoRaw
    ? String(contractNoRaw.contractNo || contractNoRaw.ContractNo || contractNoRaw).trim()
    : "";
  const invoiceNo = String(extra?.invoiceNo || "").trim();
  return {
    ...(contractNo ? { contractNo } : {}),
    ...(filters?.dateFrom ? { fromDate: filters.dateFrom } : {}),
    ...(filters?.dateTo ? { toDate: filters.dateTo } : {}),
    ...(filters?.command !== "" && filters?.command != null
      ? { cmdId: Number(filters.command) }
      : {}),
    ...(filters?.base !== "" && filters?.base != null ? { baseId: Number(filters.base) } : {}),
    ...(invoiceNo ? { invoiceNo } : {}),
    isFinalized: true,
  };
}

function filterAgreementProvScheduleRows(
  scheduleData,
  filters,
  units,
  { skipFinalized = false, skipServerFilters = false } = {}
) {
  let data = Array.isArray(scheduleData) ? scheduleData : [];
  if (!skipFinalized) {
    data = data.filter((row) => pickScheduleRowIsFinalized(row));
  }
  if (!skipServerFilters) {
    if (filters.command) {
      data = data.filter((row) => Number(row.cmdId ?? row.CmdId) === Number(filters.command));
    }
    if (filters.base) {
      data = data.filter((row) => Number(row.baseId ?? row.BaseId) === Number(filters.base));
    }
    if (filters.dateFrom) {
      const from = parseISO(String(filters.dateFrom).trim());
      if (isValid(from)) {
        data = data.filter((row) => {
          const d = scheduleRowFilterDate(row);
          return !d || d >= from;
        });
      }
    }
    if (filters.dateTo) {
      const to = parseISO(String(filters.dateTo).trim());
      if (isValid(to)) {
        data = data.filter((row) => {
          const d = scheduleRowFilterDate(row);
          return !d || d <= to;
        });
      }
    }
    if (filters.contractNo) {
      const cn = String(
        filters.contractNo.contractNo || filters.contractNo.ContractNo || filters.contractNo
      ).trim();
      if (cn) {
        data = data.filter((row) => scheduleRowContractNo(row) === cn);
      }
    }
  }
  if (filters.unit) {
    const selectedUnit = units.find((u) => Number(u.id) === Number(filters.unit));
    const unitName = selectedUnit?.name || selectedUnit?.unitName || selectedUnit?.Name;
    if (unitName) {
      const unitKey = String(unitName).trim();
      data = data.filter((row) => {
        const rowUnit = String(
          row.UnitName ?? row.unitName ?? row.UoM ?? row.uoM ?? row.UOM ?? row.uom ?? ""
        ).trim();
        return rowUnit === unitKey;
      });
    }
  }
  return data;
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
    cmdName:
      prevForm.cmdName ||
      fromSource.cmdName ||
      String(pickScheduleRowField(parentRow, "CmdName", "cmdName") || ""),
    baseName:
      prevForm.baseName ||
      fromSource.baseName ||
      String(pickScheduleRowField(parentRow, "BaseName", "baseName") || ""),
    daysToDue:
      prevForm.daysToDue ??
      fromSource.daysToDue ??
      pickScheduleRowField(parentRow, "DaysToDue", "daysToDue"),
    daysOverdue:
      prevForm.daysOverdue ??
      fromSource.daysOverdue ??
      pickScheduleRowField(parentRow, "DaysOverdue", "daysOverdue"),
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

/** Stable key for main-grid invoice rows (contract + invoice). */
function getAgreementProvInvoiceActionKey(rowData) {
  const contractNo = String(pickScheduleRowField(rowData, "ContractNo", "contractNo") || "").trim();
  const invoiceNo = String(pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || "").trim();
  if (!contractNo || !invoiceNo) return "";
  return `${contractNo}|${invoiceNo}`;
}

function isAgreementProvInvoiceItemRecordRow(lineRow) {
  const sub = pickInvoiceLineSubInvoiceNo(lineRow);
  return sub !== "" && sub !== "0";
}

/** React row key — SubInvoiceNo only (never shared schedule Id). */
function getInvoiceLineDraftRowKey(lineRow, idx) {
  const sub = pickInvoiceLineSubInvoiceNo(lineRow);
  if (sub) return `sub-${sub}`;
  if (isMainInvoiceScheduleRow(lineRow)) return "main-schedule-row";
  return `idx-${idx}`;
}

function isInvoiceLineDraftEditing(lineRow, editingLineDraft) {
  if (!editingLineDraft?.editingLineKey) return false;
  const editingSub = String(editingLineDraft.editingSubInvoiceNo ?? "").trim();
  const rowSub = pickInvoiceLineSubInvoiceNo(lineRow);
  if (editingSub && rowSub) return editingSub === rowSub;
  return false;
}

function isInvoiceLineDraftEmpty(draft) {
  if (!draft) return true;
  const fields = [
    draft.itemCode,
    draft.desc,
    draft.accHead,
    draft.months,
    draft.calculatedRentPM,
    draft.discountPercent,
  ];
  return fields.every((v) => v === null || v === undefined || String(v).trim() === "");
}

function createNewLineDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function buildDuplicateDraftFromDraftForm(sourceDraft, parentForm, parentRow, scheduleRows) {
  const pseudoLine = buildLocalLineRowFromDraft(sourceDraft, parentForm, parentRow);
  return {
    ...buildDuplicateDraftInvoiceAddForm(pseudoLine, parentForm, parentRow, scheduleRows),
    __draftId: createNewLineDraftId(),
  };
}

function isInvoiceLineDraftFieldFilled(value) {
  return !(value === null || value === undefined || String(value).trim() === "");
}

function getInvoiceLineComputedTotal(draftForm) {
  const computed = computeInvoiceRecordLineTotal(
    draftForm?.months,
    draftForm?.calculatedRentPM,
    draftForm?.discountPercent
  );
  if (computed != null && Number.isFinite(computed)) return computed;
  const savedTotal = Number(draftForm?.total);
  if (Number.isFinite(savedTotal)) return savedTotal;
  const savedRent = Number(
    draftForm?.totalRent ?? draftForm?.TotalRent ?? draftForm?.Total ?? draftForm?.total
  );
  if (Number.isFinite(savedRent)) return savedRent;
  return null;
}

function validateInvoiceLineDraftTotal(draftForm) {
  const total = getInvoiceLineComputedTotal(draftForm);
  if (total === null || !Number.isFinite(total) || total <= 0) {
    return "Total must be greater than 0.";
  }
  return "";
}

function validateInvoiceLineDraftForm(draftForm, parentForm) {
  const invoiceDate = String(draftForm?.invoiceDate || parentForm?.invoiceDate || "").trim();
  if (!invoiceDate) return "Invoice Date is required.";
  if (!isInvoiceLineDraftFieldFilled(draftForm?.itemCode)) {
    return "Item with Code is required.";
  }
  if (!isInvoiceLineDraftFieldFilled(draftForm?.desc)) {
    return "Description is required.";
  }
  if (!isInvoiceLineDraftFieldFilled(draftForm?.accHead)) {
    return "Acc Head is required.";
  }
  if (!isInvoiceLineDraftFieldFilled(draftForm?.months)) {
    return "Quantity is required.";
  }
  if (!isInvoiceLineDraftFieldFilled(draftForm?.calculatedRentPM)) {
    return "Unit Price is required.";
  }
  if (!isInvoiceLineDraftFieldFilled(draftForm?.discountPercent)) {
    return "Discount % is required.";
  }
  const sub = String(draftForm?.pendingSubInvoiceNo ?? "").trim();
  if (!sub) return "Sub Invoice is required.";
  const totalErr = validateInvoiceLineDraftTotal(draftForm);
  if (totalErr) return totalErr;
  return "";
}

function getFirstIncompleteNewLineDraftError(newLineDrafts, parentForm) {
  const drafts = newLineDrafts || [];
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    if (isInvoiceLineDraftEmpty(draft)) {
      return "Complete or cancel the empty invoice row before adding another.";
    }
    const err = validateInvoiceLineDraftForm(draft, parentForm);
    if (err) return err;
  }
  return "";
}

function buildLocalLineRowFromDraft(draftForm, parentForm, parentRow) {
  const totalVal = computeInvoiceRecordLineTotal(
    draftForm.months,
    draftForm.calculatedRentPM,
    draftForm.discountPercent
  );
  const sub = String(draftForm.pendingSubInvoiceNo ?? draftForm.editingSubInvoiceNo ?? "").trim();
  const sortOrder = toScheduleIntOrNull(draftForm.sortOrder) ?? 1;
  const invoiceDate =
    draftForm.invoiceDate ||
    parentForm?.invoiceDate ||
    toScheduleDateInputValue(pickScheduleInvoiceDate(parentRow || {}));
  const dueDate =
    draftForm.dueDate ||
    parentForm?.dueDate ||
    toScheduleDateInputValue(pickScheduleRowField(parentRow || {}, "DueDate", "dueDate"));
  const itemCode = String(draftForm.itemCode ?? "").trim();
  const desc = String(draftForm.desc ?? "").trim();
  const accHead = String(draftForm.accHead ?? "").trim();
  const months = toScheduleIntOrNull(draftForm.months);
  const calculatedRentPM = toScheduleNumberOrNull(draftForm.calculatedRentPM);
  const discount = toScheduleIntOrNull(draftForm.discountPercent);
  const lineTotal =
    totalVal ??
    toScheduleNumberOrNull(draftForm.total) ??
    computeInvoiceRecordLineTotal(
      draftForm.months,
      draftForm.calculatedRentPM,
      draftForm.discountPercent
    );

  return {
    __isNewLocal: !draftForm.editingLineRow,
    SubInvoiceNo: sub,
    subInvoiceNo: sub,
    SortOrder: sortOrder,
    sortOrder,
    InvoiceDate: invoiceDate,
    invoiceDate,
    DueDate: dueDate,
    dueDate,
    PeriodStart: invoiceDate,
    periodStart: invoiceDate,
    PeriodEnd: periodEndFromStartAndMonths(invoiceDate, months) || null,
    periodEnd: periodEndFromStartAndMonths(invoiceDate, months) || null,
    ItemwithCode: itemCode,
    itemwithCode: itemCode,
    ItemCode: itemCode,
    itemCode,
    Description: desc,
    description: desc,
    Desc: desc,
    desc,
    AccHead: accHead,
    accHead,
    Months: months,
    months,
    CalculatedRentPM: calculatedRentPM,
    calculatedRentPM,
    Discount: discount,
    discount,
    DiscountPercent: discount,
    discountPercent: discount,
    TotalRent: lineTotal,
    totalRent: lineTotal,
    Total: lineTotal,
    total: lineTotal,
    ContractNo:
      parentForm?.contractNo ?? pickScheduleRowField(parentRow, "ContractNo", "contractNo"),
    contractNo:
      parentForm?.contractNo ?? pickScheduleRowField(parentRow, "ContractNo", "contractNo"),
    InvoiceNo: parentForm?.invoiceNo ?? pickScheduleRowField(parentRow, "InvoiceNo", "invoiceNo"),
    invoiceNo: parentForm?.invoiceNo ?? pickScheduleRowField(parentRow, "InvoiceNo", "invoiceNo"),
  };
}

function pickInvoiceLineDraftField(src, camelKey, pascalKey) {
  if (!src) return "";
  const direct = src[camelKey];
  if (direct !== null && direct !== undefined && String(direct).trim() !== "") {
    return direct;
  }
  return pickScheduleRowField(src, pascalKey, camelKey);
}

/** Merge draft editor state with a schedule-shaped row for API payload building. */
function buildInvoiceLinePersistSourceFromDraft(draft, parentForm, parentRow) {
  const localRow = buildLocalLineRowFromDraft(draft, parentForm, parentRow);
  const sub = String(
    draft?.pendingSubInvoiceNo ??
      draft?.editingSubInvoiceNo ??
      pickInvoiceLineSubInvoiceNo(localRow) ??
      ""
  ).trim();
  const totalVal = computeInvoiceRecordLineTotal(
    draft?.months,
    draft?.calculatedRentPM,
    draft?.discountPercent
  );
  return {
    ...localRow,
    itemCode: String(pickInvoiceLineDraftField(draft, "itemCode", "ItemwithCode") || "").trim(),
    desc: String(
      pickInvoiceLineDraftField(draft, "desc", "Desc") ||
        pickInvoiceLineDraftField(draft, "description", "Description") ||
        ""
    ).trim(),
    accHead: String(pickInvoiceLineDraftField(draft, "accHead", "AccHead") || "").trim(),
    months: draft?.months ?? pickScheduleRowField(localRow, "Months", "months"),
    calculatedRentPM:
      draft?.calculatedRentPM ??
      pickScheduleRowField(localRow, "CalculatedRentPM", "calculatedRentPM"),
    discountPercent:
      draft?.discountPercent ??
      pickScheduleRowField(localRow, "DiscountPercent", "discountPercent") ??
      pickScheduleRowField(localRow, "Discount", "discount"),
    sortOrder:
      draft?.sortOrder ??
      pickScheduleRowField(localRow, "SortOrder", "sortOrder") ??
      pickScheduleRowField(localRow, "InvoiceOrder", "invoiceOrder"),
    pendingSubInvoiceNo: sub,
    invoiceDate:
      draft?.invoiceDate ||
      pickScheduleRowField(localRow, "PeriodStart", "periodStart") ||
      parentForm?.invoiceDate,
    dueDate:
      draft?.dueDate || pickScheduleRowField(localRow, "DueDate", "dueDate") || parentForm?.dueDate,
    total: totalVal != null ? String(totalVal) : String(draft?.total ?? localRow?.total ?? ""),
  };
}

function buildInvoiceLineAddFormFromDraft(draft, parentForm, parentRow) {
  return buildInvoiceLinePersistSourceFromDraft(draft, parentForm, parentRow);
}

function validateInvoiceLinesScheduledForPersist({
  newLineDrafts,
  editingLineDraft,
  invoiceLines,
  form,
  rowData,
}) {
  if (editingLineDraft && !isInvoiceLineDraftEmpty(editingLineDraft)) {
    const draftErr = validateInvoiceLineDraftForm(editingLineDraft, form);
    if (draftErr) throw new Error(draftErr);
  }

  (newLineDrafts || []).forEach((draft) => {
    if (isInvoiceLineDraftEmpty(draft)) return;
    const draftErr = validateInvoiceLineDraftForm(draft, form);
    if (draftErr) throw new Error(draftErr);
  });

  const existingItemRows = (invoiceLines || []).filter((r) => !isMainInvoiceScheduleRow(r));
  existingItemRows.forEach((line, idx) => {
    if (!line.__dirtyLocal) return;
    const lineKey = getInvoiceLineDraftRowKey(line, idx);
    const draft = buildDraftInvoiceEditFormFromLine(line, form, rowData, lineKey);
    const lineErr = validateInvoiceLineDraftForm(
      {
        ...draft,
        invoiceDate: draft.invoiceDate || form.invoiceDate,
        dueDate: draft.dueDate || form.dueDate,
      },
      form
    );
    if (lineErr) throw new Error(lineErr);
  });
}

function buildInvoiceLineAddFormFromLine(lineRow, parentForm, parentRow, lineKey) {
  const draft = buildDraftInvoiceEditFormFromLine(lineRow, parentForm, parentRow, lineKey);
  return buildInvoiceLinePersistSourceFromDraft(
    {
      ...draft,
      invoiceDate: draft.invoiceDate || parentForm?.invoiceDate,
      dueDate: draft.dueDate || parentForm?.dueDate,
    },
    parentForm,
    parentRow
  );
}

function captureOriginalInvoiceLinePayloadSnapshots(lines, parentForm, parentRow) {
  const snapshots = new Map();
  const itemRows = (lines || []).filter((r) => !isMainInvoiceScheduleRow(r));
  itemRows.forEach((line, idx) => {
    const sub = pickInvoiceLineSubInvoiceNo(line);
    if (!sub) return;
    const lineKey = getInvoiceLineDraftRowKey(line, idx);
    const addForm = buildInvoiceLineAddFormFromLine(line, parentForm, parentRow, lineKey);
    const payload = buildInvoiceScheduleCreatePayload(parentRow, parentForm, addForm);
    snapshots.set(sub, JSON.stringify(payload));
  });
  return snapshots;
}

function mergeAllDraftsIntoWorkingInvoiceLines(
  lines,
  newLineDrafts,
  editingLineDraft,
  parentForm,
  parentRow
) {
  const mainRows = (lines || []).filter((r) => isMainInvoiceScheduleRow(r));
  let itemRows = (lines || []).filter((r) => !isMainInvoiceScheduleRow(r));

  if (editingLineDraft?.editingLineKey) {
    const localRow = buildLocalLineRowFromDraft(editingLineDraft, parentForm, parentRow);
    const editingSub = String(editingLineDraft.editingSubInvoiceNo ?? "").trim();
    if (editingSub) {
      itemRows = itemRows.map((r) => {
        if (pickInvoiceLineSubInvoiceNo(r) !== editingSub) return r;
        return {
          ...r,
          ...localRow,
          __isNewLocal: Boolean(r.__isNewLocal || localRow.__isNewLocal),
        };
      });
    }
  }

  (newLineDrafts || []).forEach((draft) => {
    if (isInvoiceLineDraftEmpty(draft)) return;
    itemRows.push(buildLocalLineRowFromDraft(draft, parentForm, parentRow));
  });

  return [...mainRows, ...itemRows];
}

async function persistAllInvoiceScheduleLines({
  rowData,
  form,
  invoiceLines,
  pendingDeleteSubs,
  newLineDrafts,
  editingLineDraft,
  originalServerSubs,
  originalLinePayloadSnapshots,
}) {
  const { contractNo, invoiceNo } = getInvoiceScheduleRouteKeys(rowData, form);
  if (!contractNo || !invoiceNo) {
    throw new Error("Cannot save: Contract No and Invoice ID are required.");
  }

  validateInvoiceLinesScheduledForPersist({
    newLineDrafts,
    editingLineDraft,
    invoiceLines,
    form,
    rowData,
  });

  await contractApi.updateInvoiceSchedule(
    contractNo,
    invoiceNo,
    buildInvoiceSchedulePutPayload(rowData, form)
  );

  const deleteSubs = [
    ...new Set((pendingDeleteSubs || []).map((s) => String(s).trim()).filter(Boolean)),
  ];
  for (const sub of deleteSubs) {
    await contractApi.deleteInvoiceSchedule(contractNo, invoiceNo, sub);
  }

  const persistedSubs = new Set();

  const persistLine = async (sub, addForm, isNew) => {
    if (!sub || persistedSubs.has(sub)) return;
    const payload = buildInvoiceScheduleCreatePayload(rowData, form, addForm);
    if (isNew) {
      await contractApi.createInvoiceSchedule(contractNo, invoiceNo, sub, payload);
    } else {
      const baselineKey = originalLinePayloadSnapshots?.get?.(sub);
      if (baselineKey && baselineKey === JSON.stringify(payload)) return;
      await contractApi.updateInvoiceScheduleSub(contractNo, invoiceNo, sub, payload);
    }
    persistedSubs.add(sub);
  };

  for (const draft of newLineDrafts || []) {
    if (isInvoiceLineDraftEmpty(draft)) continue;
    const sub = String(draft.pendingSubInvoiceNo ?? draft.editingSubInvoiceNo ?? "").trim();
    if (!sub) continue;
    await persistLine(sub, buildInvoiceLinePersistSourceFromDraft(draft, form, rowData), true);
  }

  if (editingLineDraft && !isInvoiceLineDraftEmpty(editingLineDraft)) {
    const sub = String(
      editingLineDraft.editingSubInvoiceNo ?? editingLineDraft.pendingSubInvoiceNo ?? ""
    ).trim();
    if (sub) {
      const isNew =
        Boolean(editingLineDraft.editingLineRow?.__isNewLocal) ||
        !(originalServerSubs && originalServerSubs.has(sub));
      await persistLine(
        sub,
        buildInvoiceLinePersistSourceFromDraft(editingLineDraft, form, rowData),
        isNew
      );
    }
  }

  const existingItemRows = (invoiceLines || []).filter((r) => !isMainInvoiceScheduleRow(r));
  const sortedExisting = sortInvoiceLinesByOrder(existingItemRows);
  for (let idx = 0; idx < sortedExisting.length; idx += 1) {
    const line = sortedExisting[idx];
    const sub = pickInvoiceLineSubInvoiceNo(line);
    if (!sub || persistedSubs.has(sub)) continue;
    if (line.__isNewLocal) continue;
    if (!line.__dirtyLocal) continue;

    const lineKey = getInvoiceLineDraftRowKey(line, idx);
    const addForm = buildInvoiceLineAddFormFromLine(line, form, rowData, lineKey);
    await persistLine(sub, addForm, false);
  }
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
  onDraftCancel,
  onDuplicateLine,
  hasIncompleteNewLineDrafts,
  saving,
}) {
  const subLabel = draftForm.pendingSubInvoiceNo || "—";

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
        <Tooltip title="Duplicate">
          <span>
            <IconButton
              size="small"
              color="secondary"
              disabled={saving || hasIncompleteNewLineDrafts}
              onClick={() => onDuplicateLine?.(draftForm)}
              sx={{ padding: "2px" }}
            >
              <Icon fontSize="small">content_copy</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Cancel">
          <span>
            <IconButton
              size="small"
              color="secondary"
              disabled={saving}
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
  onDraftCancel: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func,
  hasIncompleteNewLineDrafts: PropTypes.bool,
  saving: PropTypes.bool,
};

function AgreementProvInvoiceLinesGrid({
  rows,
  loading,
  error,
  saving,
  form,
  rowData,
  onEditLine,
  onDeleteLine,
  onDuplicateLine,
  onMoveLine,
  readOnly,
  newLineDrafts,
  editingLineDraft,
  hasIncompleteNewLineDrafts,
  onDraftFieldChange,
  onDraftIntegerFieldChange,
  onDraftNumericFieldChange,
  onDraftCancel,
  fillHeight,
}) {
  const pendingNewDrafts = (newLineDrafts || []).filter((d) => !d.editingLineKey);
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
        <CurrencyLoading size={36} />
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

  const linesBodySx = fillHeight
    ? { flex: "1 1 0", minHeight: 0, overflow: "auto" }
    : { maxHeight: 240, overflow: "auto" };

  return (
    <TableContainer
      component={MDBox}
      sx={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 1,
        overflow: "hidden",
        display: fillHeight ? "flex" : "block",
        flexDirection: fillHeight ? "column" : undefined,
        flex: fillHeight ? "1 1 0" : undefined,
        minHeight: fillHeight ? 0 : undefined,
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

      <MDBox sx={linesBodySx}>
        {!readOnly &&
          pendingNewDrafts.map((draftForm) => (
            <AgreementProvInvoiceLineDraftRow
              key={draftForm.__draftId || draftForm.pendingSubInvoiceNo}
              gridRowSx={gridRowSx}
              bodyCellSx={bodyCellSx}
              draftForm={draftForm}
              onDraftFieldChange={onDraftFieldChange(draftForm.__draftId)}
              onDraftIntegerFieldChange={onDraftIntegerFieldChange(draftForm.__draftId)}
              onDraftNumericFieldChange={onDraftNumericFieldChange(draftForm.__draftId)}
              onDraftCancel={() => onDraftCancel?.(draftForm.__draftId)}
              onDuplicateLine={onDuplicateLine}
              hasIncompleteNewLineDrafts={hasIncompleteNewLineDrafts}
              saving={saving}
            />
          ))}
        {itemRows.length === 0 && pendingNewDrafts.length === 0 ? (
          <MDTypography variant="caption" color="text" display="block" textAlign="center" py={2}>
            No records found for this invoice.
          </MDTypography>
        ) : (
          itemRows.map((lineRow, idx) => {
            const lineKey = getInvoiceLineDraftRowKey(lineRow, idx);
            const isEditingRow = isInvoiceLineDraftEditing(lineRow, editingLineDraft);

            if (isEditingRow && !readOnly && editingLineDraft) {
              const editDraftId = editingLineDraft.__draftId || editingLineDraft.editingLineKey;
              return (
                <AgreementProvInvoiceLineDraftRow
                  key={lineKey}
                  gridRowSx={gridRowSx}
                  bodyCellSx={bodyCellSx}
                  draftForm={editingLineDraft}
                  onDraftFieldChange={onDraftFieldChange(editDraftId)}
                  onDraftIntegerFieldChange={onDraftIntegerFieldChange(editDraftId)}
                  onDraftNumericFieldChange={onDraftNumericFieldChange(editDraftId)}
                  onDraftCancel={() => onDraftCancel?.(editDraftId)}
                  onDuplicateLine={onDuplicateLine}
                  hasIncompleteNewLineDrafts={hasIncompleteNewLineDrafts}
                  saving={saving}
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
                          disabled={!canMoveUp || saving || Boolean(editingLineDraft)}
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
                          disabled={!canMoveDown || saving || Boolean(editingLineDraft)}
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
                          disabled={saving || Boolean(editingLineDraft)}
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
                            saving || Boolean(editingLineDraft) || hasIncompleteNewLineDrafts
                          }
                          onClick={() => onDuplicateLine?.(lineRow)}
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
                          disabled={saving || Boolean(editingLineDraft)}
                          onClick={() => onDeleteLine?.(lineRow)}
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
  saving: PropTypes.bool,
  form: PropTypes.object,
  rowData: PropTypes.object,
  onEditLine: PropTypes.func,
  onDeleteLine: PropTypes.func,
  onDuplicateLine: PropTypes.func,
  onMoveLine: PropTypes.func,
  readOnly: PropTypes.bool,
  newLineDrafts: PropTypes.arrayOf(PropTypes.object),
  editingLineDraft: PropTypes.object,
  hasIncompleteNewLineDrafts: PropTypes.bool,
  onDraftFieldChange: PropTypes.func,
  onDraftIntegerFieldChange: PropTypes.func,
  onDraftNumericFieldChange: PropTypes.func,
  onDraftCancel: PropTypes.func,
  fillHeight: PropTypes.bool,
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

/** Filter bar date: native picker (yyyy-MM-dd) with dd-MMM-yyyy display. */
function AgreementProvFilterDateInput({
  label,
  value,
  onChange,
  min,
  sx,
  "aria-label": ariaLabel,
}) {
  const inputRef = useRef(null);
  return (
    <MDBox sx={{ position: "relative", width: "100%" }}>
      <input
        type="date"
        ref={inputRef}
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        min={min || undefined}
        style={{
          position: "absolute",
          opacity: 0.01,
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
          cursor: "pointer",
          zIndex: 2,
        }}
        aria-label={ariaLabel || label}
      />
      <MDInput
        label={label}
        type="text"
        value={toAgreementProvDisplayDate(value)}
        fullWidth
        size="small"
        InputLabelProps={{ shrink: true }}
        onClick={() => openAgreementProvDatePicker(inputRef)}
        InputProps={{
          readOnly: true,
          endAdornment: (
            <InputAdornment position="end">
              <Icon
                sx={{ cursor: "pointer", fontSize: "1.1rem" }}
                onClick={(e) => {
                  e.stopPropagation();
                  openAgreementProvDatePicker(inputRef);
                }}
              >
                calendar_today
              </Icon>
            </InputAdornment>
          ),
        }}
        sx={{
          ...sx,
          "& .MuiInputBase-input": { cursor: "pointer" },
        }}
      />
    </MDBox>
  );
}

AgreementProvFilterDateInput.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  min: PropTypes.string,
  sx: PropTypes.object,
  "aria-label": PropTypes.string,
};

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
      pickScheduleRowField(row, "Prefix", "prefix") ||
      ""
  ).trim();
  const ownerName = String(pickScheduleRowField(row, "OwnerName", "ownerName") || "").trim();
  return [tenantNo, ownerName].filter(Boolean).join(" ").trim();
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

const AGREEMENT_PROV_PDF_MARGIN_LEFT_IN = 1.3;
const AGREEMENT_PROV_PDF_MARGIN_OTHER_IN = 0.5;
const AGREEMENT_PROV_PDF_MARGIN_LEFT_MM = AGREEMENT_PROV_PDF_MARGIN_LEFT_IN * 25.4;
const AGREEMENT_PROV_PDF_MARGIN_OTHER_MM = AGREEMENT_PROV_PDF_MARGIN_OTHER_IN * 25.4;
const AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY = "agreement-prov-invoice-pdf-margins";
const AGREEMENT_PROV_PDF_DEFAULT_MARGINS = {
  topIn: AGREEMENT_PROV_PDF_MARGIN_OTHER_IN,
  bottomIn: AGREEMENT_PROV_PDF_MARGIN_OTHER_IN,
  leftIn: AGREEMENT_PROV_PDF_MARGIN_LEFT_IN,
  rightIn: AGREEMENT_PROV_PDF_MARGIN_OTHER_IN,
};
const AGREEMENT_PROV_PDF_FONT_TITLE = 18;
const AGREEMENT_PROV_PDF_FONT_BODY = 10;
const AGREEMENT_PROV_PDF_LINE_HEIGHT_MM = 5;

function agreementProvInchesToMm(inches) {
  const n = Number(inches);
  return Number.isFinite(n) ? n * 25.4 : 0;
}

function agreementProvPdfMarginsInchesToMm(marginsIn) {
  return {
    marginTop: agreementProvInchesToMm(marginsIn.topIn),
    marginBottom: agreementProvInchesToMm(marginsIn.bottomIn),
    marginLeft: agreementProvInchesToMm(marginsIn.leftIn),
    marginRight: agreementProvInchesToMm(marginsIn.rightIn),
  };
}

function loadAgreementProvPdfMargins() {
  try {
    const raw = localStorage.getItem(AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY);
    if (!raw) return { ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS };
    const parsed = JSON.parse(raw);
    return {
      topIn: Number(parsed?.topIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.topIn,
      bottomIn: Number(parsed?.bottomIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.bottomIn,
      leftIn: Number(parsed?.leftIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.leftIn,
      rightIn: Number(parsed?.rightIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.rightIn,
    };
  } catch {
    return { ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS };
  }
}

function saveAgreementProvPdfMargins(margins) {
  try {
    localStorage.setItem(AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY, JSON.stringify(margins));
  } catch {
    // ignore storage errors
  }
}

function formatPdfContractDateShort(dateString) {
  const formatted = formatDateDDMMMYYYY(dateString);
  if (formatted === "—") return "";
  const parts = formatted.split("-");
  if (parts.length !== 3) return formatted;
  return `${parts[0]} ${parts[1]} ${parts[2].slice(-2)}`;
}

function formatPdfInvoiceDate(dateString) {
  const formatted = formatDateDDMMMYYYY(dateString);
  return formatted === "—" ? "" : formatted;
}

function formatPdfCurrency(value) {
  if (value === null || value === undefined || value === "") return "0";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
}

function unwrapAccountingSysList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.Items)) return response.Items;
  if (Array.isArray(response?.result)) return response.result;
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    return [response.data];
  }
  if (response && typeof response === "object") return [response];
  return [];
}

function splitAccountingSysAddressForPdf(address) {
  const trimmed = String(address ?? "").trim();
  if (!trimmed) return { line1: "—", line2: "" };
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex === -1) return { line1: trimmed, line2: "" };
  return {
    line1: trimmed.slice(0, commaIndex).trim() || "—",
    line2: trimmed.slice(commaIndex + 1).trim(),
  };
}

function pickInvoiceLineTotalNumeric(lineRow) {
  const raw = pickScheduleRowField(lineRow, "Total", "total");
  if (raw !== "" && raw != null) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  const totalRent = pickScheduleRowField(lineRow, "TotalRent", "totalRent");
  if (totalRent !== "" && totalRent != null) {
    const n = Number(totalRent);
    if (Number.isFinite(n)) return n;
  }
  const months = pickScheduleRowField(lineRow, "Months", "months");
  const ratePM = pickScheduleRowField(lineRow, "CalculatedRentPM", "calculatedRentPM");
  const discount =
    pickScheduleRowField(lineRow, "Discount", "discount") ||
    pickScheduleRowField(lineRow, "DiscountPercent", "discountPercent");
  const computed = computeInvoiceRecordLineTotal(months, ratePM, discount);
  return computed != null ? computed : 0;
}

function loadPafLogoIntoPdf(doc, x, y, widthMm = 18) {
  return new Promise((resolve) => {
    const logoPath = `${process.env.PUBLIC_URL || ""}/login_page/assets/img/PAF-Logo.gif`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const logoHeight = (img.height / img.width) * widthMm;
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", x, y, widthMm, logoHeight);
        resolve(logoHeight);
      } catch (error) {
        console.error("Error adding logo to PDF:", error);
        resolve(0);
      }
    };
    img.onerror = () => {
      console.error("Error loading logo image");
      resolve(0);
    };
    img.src = logoPath;
  });
}

function buildInvoiceScheduleCreatePayload(parentRow, parentForm, addForm) {
  const src = addForm || {};
  const contractNo = String(
    parentForm?.contractNo ??
      pickScheduleRowField(parentRow || {}, "ContractNo", "contractNo") ??
      ""
  ).trim();
  const invoiceNo = String(
    parentForm?.invoiceNo ?? pickScheduleRowField(parentRow || {}, "InvoiceNo", "invoiceNo") ?? ""
  ).trim();
  const periodStart =
    src.invoiceDate ||
    pickScheduleRowField(src, "PeriodStart", "periodStart") ||
    parentForm?.invoiceDate ||
    null;
  const months = toScheduleIntOrNull(src.months ?? pickScheduleRowField(src, "Months", "months"));
  const periodEnd = periodEndFromStartAndMonths(periodStart, months) || null;
  const calculatedRentPM = toScheduleNumberOrNull(
    src.calculatedRentPM ?? pickScheduleRowField(src, "CalculatedRentPM", "calculatedRentPM")
  );
  const discountRaw =
    src.discountPercent ??
    pickScheduleRowField(src, "DiscountPercent", "discountPercent") ??
    pickScheduleRowField(src, "Discount", "discount");
  const itemCode = String(
    src.itemCode ??
      pickScheduleRowField(src, "ItemwithCode", "itemwithCode") ??
      pickScheduleRowField(src, "ItemCode", "itemCode") ??
      ""
  ).trim();
  const desc = String(
    src.desc ??
      pickScheduleRowField(src, "Desc", "desc") ??
      pickScheduleRowField(src, "Description", "description") ??
      ""
  ).trim();
  const accHead = String(
    src.accHead ?? pickScheduleRowField(src, "AccHead", "accHead") ?? ""
  ).trim();
  const sortOrder =
    toScheduleIntOrNull(
      src.sortOrder ??
        pickScheduleRowField(src, "SortOrder", "sortOrder") ??
        pickScheduleRowField(src, "InvoiceOrder", "invoiceOrder")
    ) ?? 1;
  const lineTotal =
    toScheduleNumberOrNull(src.total ?? pickScheduleRowField(src, "Total", "total")) ??
    computeInvoiceRecordLineTotal(
      src.months ?? pickScheduleRowField(src, "Months", "months"),
      src.calculatedRentPM ?? pickScheduleRowField(src, "CalculatedRentPM", "calculatedRentPM"),
      discountRaw
    );
  const totalRent =
    toScheduleNumberOrNull(pickScheduleRowField(src, "TotalRent", "totalRent") ?? src.totalRent) ??
    lineTotal;

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
    DueDate:
      src.dueDate || pickScheduleRowField(src, "DueDate", "dueDate") || parentForm?.dueDate || null,
    CalculatedRentPM: calculatedRentPM,
    Months: months,
    TotalRent: totalRent,
    ItemwithCode: itemCode || null,
    Description: desc || null,
    AccHead: accHead || null,
    Discount: toScheduleIntOrNull(discountRaw),
    SortOrder: sortOrder,
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

const EDIT_BASIC_INFO_READONLY_SCROLL_SX = {
  display: "flex",
  flexWrap: "nowrap",
  gap: 2,
  overflowX: "auto",
  overflowY: "hidden",
  alignItems: "flex-start",
  pb: 0.5,
  scrollbarWidth: "thin",
  "&::-webkit-scrollbar": { height: 6 },
  "&::-webkit-scrollbar-thumb": {
    borderRadius: 3,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
};

function getAgreementProvEditDialogReadonlyBasicInfoItems(form) {
  const f = form || {};
  return [
    { label: "Contract No", value: f.contractNo },
    { label: "CSD", value: formatDateDDMMMYYYY(f.contractStartDate) },
    { label: "CED", value: formatDateDDMMMYYYY(f.contractEndDate) },
    { label: "COD", value: formatDateDDMMMYYYY(f.cod) },
    { label: "Revenue Rate", value: formatScheduleGridNumber(f.rentalValueRate) },
    { label: "Initial Rent PM", value: formatScheduleGridNumber(f.initialRentPM) },
    { label: "Tenant No", value: f.prefixNo },
    { label: "Business Name", value: f.businessName },
    { label: "Address", value: f.address },
    { label: "Period Start", value: formatDateDDMMMYYYY(f.periodStart) },
    { label: "Period End", value: formatDateDDMMMYYYY(f.periodEnd) },
    { label: "Invoice Date Type", value: f.invoiceDateType },
    { label: "Invoice Status", value: f.invoiceStatus },
    { label: "Rate PM", value: formatScheduleGridNumber(f.calculatedRentPM) },
    { label: "Months", value: formatScheduleGridNumber(f.months, true) },
    { label: "Total Amount", value: formatScheduleGridNumber(f.totalRent) },
    { label: "Amount Received", value: formatScheduleGridNumber(f.amountReceived) },
    { label: "Amount Receivable", value: formatScheduleGridNumber(f.amountReceivable) },
    { label: "Amount Pending", value: formatScheduleGridNumber(f.amountPending) },
    { label: "Days to Due", value: formatScheduleGridNumber(f.daysToDue, true) },
    { label: "Days Overdue", value: formatScheduleGridNumber(f.daysOverdue, true) },
    {
      label: "Payment Term (Months)",
      value: formatScheduleGridNumber(f.paymentTermMonths, true),
    },
    { label: "RAC", value: f.cmdName },
    { label: "Base", value: f.baseName },
    { label: "Rise Term Type", value: f.riseTermType },
    { label: "Rise Term", value: f.riseTerm },
    { label: "Rise Rate", value: formatScheduleGridNumber(f.riseRate) },
    { label: "Rise Date", value: formatDateDDMMMYYYY(f.riseDate) },
    { label: "Remarks", value: f.remarks },
  ];
}

function AgreementProvEditDialogReadonlyStrip({ form }) {
  const items = getAgreementProvEditDialogReadonlyBasicInfoItems(form);
  return (
    <MDBox sx={EDIT_BASIC_INFO_READONLY_SCROLL_SX}>
      {items.map((item) => (
        <MDBox key={item.label} sx={{ flex: "0 0 auto", minWidth: 88, maxWidth: 220 }}>
          <AgreementProvReadOnlyField compact label={item.label} value={item.value} />
        </MDBox>
      ))}
    </MDBox>
  );
}

AgreementProvEditDialogReadonlyStrip.propTypes = {
  form: PropTypes.object,
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
  mt: 0.15,
  "& .MuiInputBase-root": {
    fontSize: "0.75rem",
    minHeight: 26,
    bgcolor: "#fff",
  },
  "& .MuiInputBase-input": {
    py: 0.35,
    px: 0.5,
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
    paymentTermMonths: pickScheduleRowField(row, "PaymentTermMonths", "paymentTermMonths"),
    riseTermType: String(pickScheduleRowField(row, "RiseTermType", "riseTermType") || ""),
    riseTerm: String(pickScheduleRowField(row, "RiseTerm", "riseTerm") || ""),
    riseRate: pickScheduleRowField(row, "RiseRate", "riseRate"),
    riseDate: toScheduleDateInputValue(pickScheduleRowField(row, "RiseDate", "riseDate")),
    daysToDue: pickScheduleRowField(row, "DaysToDue", "daysToDue"),
    daysOverdue: pickScheduleRowField(row, "DaysOverdue", "daysOverdue"),
    cmdName: String(pickScheduleRowField(row, "CmdName", "cmdName") || ""),
    baseName: String(pickScheduleRowField(row, "BaseName", "baseName") || ""),
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
  registerReloadInvoiceLines,
  onInvoiceLinesLoaded,
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
  const [newLineDrafts, setNewLineDrafts] = useState([]);
  const [editingLineDraft, setEditingLineDraft] = useState(null);
  const [pendingDeleteSubs, setPendingDeleteSubs] = useState([]);
  const originalServerSubsRef = useRef(new Set());
  const originalLinePayloadSnapshotsRef = useRef(new Map());
  const newLineDraftsRef = useRef([]);
  const editingLineDraftRef = useRef(null);
  const invoiceLinesRowsRef = useRef([]);
  const pendingDeleteSubsRef = useRef([]);
  const invoiceDateInputRef = useRef(null);
  const dueDateInputRef = useRef(null);

  useEffect(() => {
    newLineDraftsRef.current = newLineDrafts;
  }, [newLineDrafts]);

  useEffect(() => {
    editingLineDraftRef.current = editingLineDraft;
  }, [editingLineDraft]);

  useEffect(() => {
    invoiceLinesRowsRef.current = invoiceLinesRows;
  }, [invoiceLinesRows]);

  useEffect(() => {
    pendingDeleteSubsRef.current = pendingDeleteSubs;
  }, [pendingDeleteSubs]);

  const getScheduleLinesForSuggest = useCallback(
    () =>
      mergeAllDraftsIntoWorkingInvoiceLines(
        invoiceLinesRows,
        newLineDrafts,
        editingLineDraft,
        form,
        rowData
      ),
    [invoiceLinesRows, newLineDrafts, editingLineDraft, form, rowData]
  );

  const syncOriginalServerSubs = useCallback((lines) => {
    const subs = sortInvoiceLinesByOrder(lines || [])
      .filter((r) => !isMainInvoiceScheduleRow(r))
      .map((r) => pickInvoiceLineSubInvoiceNo(r))
      .filter(Boolean);
    originalServerSubsRef.current = new Set(subs);
  }, []);

  const reloadInvoiceLines = useCallback(async () => {
    if (!rowData) return [];
    const invoiceNo = String(pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || "").trim();
    if (!invoiceNo) {
      setInvoiceLinesRows([]);
      setForm(buildAgreementProvEditForm(rowData));
      originalServerSubsRef.current = new Set();
      originalLinePayloadSnapshotsRef.current = new Map();
      return [];
    }
    setInvoiceLinesLoading(true);
    setInvoiceLinesError("");
    try {
      const response = await contractApi.getInvoiceScheduleByInvoiceNo(invoiceNo);
      const lines = unwrapContractInvoiceScheduleList(response);
      const sorted = sortInvoiceLinesByOrder(lines);
      setInvoiceLinesRows(sorted);
      syncOriginalServerSubs(sorted);
      setPendingDeleteSubs([]);
      setNewLineDrafts([]);
      setEditingLineDraft(null);
      setForm((prev) => {
        const next = applyInvoiceLinesToForm(rowData, lines, prev);
        originalLinePayloadSnapshotsRef.current = captureOriginalInvoiceLinePayloadSnapshots(
          sorted,
          next,
          rowData
        );
        return next;
      });
      if (!viewMode) {
        onInvoiceLinesLoaded?.(sorted, rowData);
      }
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
  }, [rowData, syncOriginalServerSubs, viewMode, onInvoiceLinesLoaded]);

  useEffect(() => {
    if (!open || !rowData) {
      setInvoiceLinesRows([]);
      setInvoiceLinesError("");
      setInvoiceLinesLoading(false);
      setForm({});
      setNewLineDrafts([]);
      setEditingLineDraft(null);
      setPendingDeleteSubs([]);
      originalServerSubsRef.current = new Set();
      originalLinePayloadSnapshotsRef.current = new Map();
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
      setNewLineDrafts([]);
      setEditingLineDraft(null);
      return undefined;
    }

    if (viewMode) {
      setForm(buildAgreementProvEditForm(rowData));
      setInvoiceLinesRows([]);
      setInvoiceLinesError("");
      setInvoiceLinesLoading(false);
      setNewLineDrafts([]);
      setEditingLineDraft(null);
      setPendingDeleteSubs([]);
      originalServerSubsRef.current = new Set();
      originalLinePayloadSnapshotsRef.current = new Map();
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
  }, [open, rowData, isCreateMode, viewMode, reloadInvoiceLines]);

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
    await onSave(form, rowData, {
      invoiceLines: invoiceLinesRowsRef.current,
      pendingDeleteSubs: pendingDeleteSubsRef.current,
      newLineDrafts: newLineDraftsRef.current,
      editingLineDraft: editingLineDraftRef.current,
      originalServerSubs: originalServerSubsRef.current,
      originalLinePayloadSnapshots: originalLinePayloadSnapshotsRef.current,
    });
  };

  const canAddRecord = Boolean(
    String(form.contractNo || "").trim() && String(form.invoiceNo || "").trim()
  );

  const hasIncompleteNewLineDrafts = useMemo(
    () => Boolean(getFirstIncompleteNewLineDraftError(newLineDrafts, form)),
    [newLineDrafts, form]
  );

  const appendNewLineDraft = (draftSeed) => {
    setNewLineDrafts((prev) => [
      ...prev,
      {
        ...draftSeed,
        __draftId: draftSeed.__draftId || createNewLineDraftId(),
      },
    ]);
  };

  const handleStartAddRecord = () => {
    if (!canAddRecord || saving || editingLineDraft) return;
    const incompleteErr = getFirstIncompleteNewLineDraftError(newLineDrafts, form);
    if (incompleteErr) {
      alert(incompleteErr);
      return;
    }
    const scheduleLines = getScheduleLinesForSuggest();
    appendNewLineDraft(buildEmptyDraftInvoiceAddForm(form, rowData, scheduleLines));
  };

  const handleStartEditRecord = (lineRow, lineKey) => {
    if (!canAddRecord || editingLineDraft || !lineRow || saving) return;
    setEditingLineDraft({
      ...buildDraftInvoiceEditFormFromLine(lineRow, form, rowData, lineKey),
      __draftId: lineKey,
    });
  };

  const handleDuplicateRecord = (sourceLine) => {
    if (!canAddRecord || saving || !sourceLine || editingLineDraft) return;
    const incompleteErr = getFirstIncompleteNewLineDraftError(newLineDrafts, form);
    if (incompleteErr) {
      alert(incompleteErr);
      return;
    }
    const scheduleLines = getScheduleLinesForSuggest();
    if (sourceLine.__draftId) {
      appendNewLineDraft(
        buildDuplicateDraftFromDraftForm(sourceLine, form, rowData, scheduleLines)
      );
      return;
    }
    appendNewLineDraft({
      ...buildDuplicateDraftInvoiceAddForm(sourceLine, form, rowData, scheduleLines),
      __draftId: createNewLineDraftId(),
    });
  };

  const handleMoveLineOrder = (lineRow, direction) => {
    if (!canAddRecord || editingLineDraft || !lineRow || saving) return;
    setInvoiceLinesRows((prev) => {
      const mainRows = (prev || []).filter((r) => isMainInvoiceScheduleRow(r));
      const orderedRows = sortInvoiceLinesByOrder(
        (prev || []).filter((r) => !isMainInvoiceScheduleRow(r))
      );
      const currentSub = pickInvoiceLineSubInvoiceNo(lineRow);
      const currentIndex = orderedRows.findIndex(
        (r) => pickInvoiceLineSubInvoiceNo(r) === currentSub
      );
      const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
      if (currentIndex < 0 || targetIndex < 0 || targetIndex >= orderedRows.length) return prev;

      const currentRow = orderedRows[currentIndex];
      const targetRow = orderedRows[targetIndex];
      const currentOrder = getInvoiceLineEffectiveSortOrder(currentRow, currentIndex);
      const targetOrder = getInvoiceLineEffectiveSortOrder(targetRow, targetIndex);
      const swapped = orderedRows.map((r) => {
        const sub = pickInvoiceLineSubInvoiceNo(r);
        if (sub === pickInvoiceLineSubInvoiceNo(currentRow)) {
          return { ...r, SortOrder: targetOrder, sortOrder: targetOrder, __dirtyLocal: true };
        }
        if (sub === pickInvoiceLineSubInvoiceNo(targetRow)) {
          return { ...r, SortOrder: currentOrder, sortOrder: currentOrder, __dirtyLocal: true };
        }
        return r;
      });
      return [...mainRows, ...swapped];
    });
  };

  const handleDeleteLineLocal = (lineRow) => {
    if (!lineRow || saving) return;
    if (!window.confirm("Delete this invoice record?")) return;
    const sub = pickInvoiceLineSubInvoiceNo(lineRow);
    if (!sub) return;
    if (!lineRow.__isNewLocal && originalServerSubsRef.current.has(sub)) {
      setPendingDeleteSubs((prev) => (prev.includes(sub) ? prev : [...prev, sub]));
    }
    setInvoiceLinesRows((prev) =>
      (prev || []).filter(
        (r) => isMainInvoiceScheduleRow(r) || pickInvoiceLineSubInvoiceNo(r) !== sub
      )
    );
    if (String(editingLineDraft?.editingSubInvoiceNo ?? "").trim() === sub) {
      setEditingLineDraft(null);
    }
    setNewLineDrafts((prev) =>
      prev.filter((d) => String(d.pendingSubInvoiceNo ?? "").trim() !== sub)
    );
  };

  const updateDraftById = (draftId, updater) => {
    if (
      editingLineDraft &&
      (editingLineDraft.__draftId === draftId || editingLineDraft.editingLineKey === draftId)
    ) {
      setEditingLineDraft((prev) => (prev ? updater(prev) : prev));
      return;
    }
    setNewLineDrafts((prev) => prev.map((d) => (d.__draftId === draftId ? updater(d) : d)));
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

  const handleDraftFieldChange = (draftId) => (field) => (e) => {
    updateDraftById(draftId, (prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleDraftIntegerFieldChange = (draftId) => (field) => (e) => {
    const value = sanitizeIntegerInputValue(e.target.value);
    updateDraftById(draftId, (prev) => recalcDraftTotal({ ...prev, [field]: value }));
  };

  const handleDraftNumericFieldChange = (draftId) => (field) => (e) => {
    const value = sanitizeDecimalNumericInputValue(e.target.value);
    updateDraftById(draftId, (prev) => recalcDraftTotal({ ...prev, [field]: value }));
  };

  const handleDraftCancel = (draftId) => {
    if (saving) return;
    if (draftId == null) {
      setEditingLineDraft(null);
      return;
    }
    if (
      editingLineDraft &&
      (editingLineDraft.__draftId === draftId || editingLineDraft.editingLineKey === draftId)
    ) {
      setEditingLineDraft(null);
      return;
    }
    setNewLineDrafts((prev) => prev.filter((d) => d.__draftId !== draftId));
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen
      PaperProps={{
        sx: {
          display: "flex",
          flexDirection: "column",
          m: 0,
          height: "100%",
          maxHeight: "100%",
          borderRadius: 0,
        },
      }}
    >
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600, pb: 1, flexShrink: 0 }}>
        {isCreateMode ? "Create Agreement Invoice" : "Edit Agreement Invoice"}
      </DialogTitle>
      <DialogContent
        sx={{
          pt: 0.5,
          flex: 1,
          minHeight: 0,
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <MDBox
          sx={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            display: "flex",
            flexDirection: "column",
            gap: 1.5,
          }}
        >
          <MDBox sx={{ flexShrink: 0, width: "100%" }}>
            <AgreementProvReadOnlyInfoPanel>
              <AgreementProvEditDialogReadonlyStrip form={form} />
              <MDBox
                sx={{
                  ...EDIT_BASIC_INFO_ROW_SX,
                  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
                  mt: 0.75,
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
          </MDBox>
          {!isCreateMode && (
            <MDBox
              sx={{
                flex: "1 1 0",
                minHeight: 0,
                width: "100%",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <MDBox
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap={1}
                mt={0.5}
                mb={0.75}
                sx={{ flexShrink: 0, flexWrap: "nowrap" }}
              >
                <MDTypography variant="button" fontWeight="bold" sx={{ whiteSpace: "nowrap" }}>
                  Invoice Item records
                </MDTypography>
                <MDBox
                  display="flex"
                  alignItems="center"
                  gap={1}
                  sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
                >
                  <MDTypography variant="button" fontWeight="medium">
                    Total Amount: {formatScheduleGridNumber(form.amountReceivable)}
                  </MDTypography>
                  {!viewMode && (
                    <Tooltip
                      title={
                        hasIncompleteNewLineDrafts
                          ? "Complete all fields in the current row(s) before adding another"
                          : "Add invoice record"
                      }
                    >
                      <span>
                        <IconButton
                          color="info"
                          size="small"
                          disabled={
                            saving ||
                            !canAddRecord ||
                            Boolean(editingLineDraft) ||
                            hasIncompleteNewLineDrafts
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
              </MDBox>
              <MDBox sx={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column" }}>
                <AgreementProvInvoiceLinesGrid
                  fillHeight
                  rows={invoiceLinesRows}
                  loading={invoiceLinesLoading}
                  error={invoiceLinesError}
                  saving={saving}
                  form={form}
                  rowData={rowData}
                  readOnly={viewMode}
                  newLineDrafts={viewMode ? [] : newLineDrafts}
                  editingLineDraft={viewMode ? null : editingLineDraft}
                  hasIncompleteNewLineDrafts={hasIncompleteNewLineDrafts}
                  onDraftFieldChange={handleDraftFieldChange}
                  onDraftIntegerFieldChange={handleDraftIntegerFieldChange}
                  onDraftNumericFieldChange={handleDraftNumericFieldChange}
                  onDraftCancel={handleDraftCancel}
                  onDuplicateLine={handleDuplicateRecord}
                  onEditLine={(lineRow, lineKey) => handleStartEditRecord(lineRow, lineKey)}
                  onMoveLine={handleMoveLineOrder}
                  onDeleteLine={handleDeleteLineLocal}
                />
              </MDBox>
            </MDBox>
          )}
        </MDBox>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2, flexShrink: 0 }}>
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
  registerReloadInvoiceLines: PropTypes.func,
  onInvoiceLinesLoaded: PropTypes.func,
  viewMode: PropTypes.bool,
  createMode: PropTypes.bool,
};

function normalizeAgreementProvInvoiceRow(row) {
  const periodStart = row.PeriodStart ?? row.periodStart ?? "";
  const periodEnd = row.PeriodEnd ?? row.periodEnd ?? "";
  const contractStartDate = row.ContractStartDate ?? row.contractStartDate ?? "";
  const contractEndDate = row.ContractEndDate ?? row.contractEndDate ?? "";
  const invoiceDate = pickScheduleInvoiceDate(row);
  const isLocked = pickScheduleRowIsLocked(row);
  return {
    ...row,
    IsLocked: isLocked ? 1 : 0,
    isLocked,
    IsFinalized: pickScheduleRowIsFinalized(row) ? 1 : 0,
    isFinalized: pickScheduleRowIsFinalized(row),
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
  const [filters, setFilters] = useState(buildInitialAgreementProvFilters);
  const [appliedFilters, setAppliedFilters] = useState(buildInitialAgreementProvFilters);
  const [searchApplied, setSearchApplied] = useState(false);
  const [paginationHost, setPaginationHost] = useState(null);

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [units, setUnits] = useState([]);
  const [filteredBases, setFilteredBases] = useState([]);
  const [allScheduleRows, setAllScheduleRows] = useState([]);
  const [searchResultRows, setSearchResultRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editRowData, setEditRowData] = useState(null);
  const [editDialogViewMode, setEditDialogViewMode] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [invoiceKeysWithItemRecords, setInvoiceKeysWithItemRecords] = useState(() => new Set());
  const [invoiceLockSavingKey, setInvoiceLockSavingKey] = useState("");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewRowData, setPdfPreviewRowData] = useState(null);
  const [pdfPreviewMarginsIn, setPdfPreviewMarginsIn] = useState(() =>
    loadAgreementProvPdfMargins()
  );
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState(null);
  const [pdfPreviewLoading, setPdfPreviewLoading] = useState(false);
  const pdfPreviewUrlRef = useRef(null);
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

  const reloadAllScheduleRows = useCallback(async () => {
    const response = await contractApi.getAgreementProvFinalizedInvoiceScheduleRecords();
    const scheduleData = unwrapContractInvoiceScheduleList(response).map(
      normalizeAgreementProvInvoiceRow
    );
    setAllScheduleRows(scheduleData);
    return scheduleData;
  }, []);

  const executeFinalizedInvoiceSearch = useCallback(async (filterSnapshot, extra = {}) => {
    const apiFilters = buildAgreementProvSearchApiFilters(filterSnapshot, extra);
    const response = await contractApi.searchAgreementProvFinalizedInvoiceSchedule(apiFilters);
    const rows = unwrapContractInvoiceScheduleList(response).map(normalizeAgreementProvInvoiceRow);
    setSearchResultRows(rows);
    return rows;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        if (!cancelled) await reloadAllScheduleRows();
      } catch (error) {
        console.error("Error loading contract invoice schedule:", error);
        if (!cancelled) setAllScheduleRows([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reloadAllScheduleRows]);

  useEffect(() => {
    if (!allScheduleRows.length) return;
    const oldestContractStartDate = getOldestContractStartDateInput(allScheduleRows);
    setFilters((prev) => {
      const dateFrom = prev.dateFrom || oldestContractStartDate;
      const dateTo = prev.dateTo || getAgreementProvDefaultDateTo();
      if (dateFrom === prev.dateFrom && dateTo === prev.dateTo) return prev;
      return { ...prev, dateFrom, dateTo };
    });
  }, [allScheduleRows]);

  const contractNoFilterOptions = useMemo(() => {
    const rowSource =
      searchApplied && searchResultRows.length > 0 ? searchResultRows : allScheduleRows;
    return buildAgreementProvContractNoFilterOptions(rowSource);
  }, [allScheduleRows, searchResultRows, searchApplied]);

  useEffect(() => {
    if (urlDeepLinkAppliedRef.current || !urlDeepLink.contractNo) return;
    urlDeepLinkAppliedRef.current = true;

    const contractNoParam = urlDeepLink.contractNo;
    const contractNoFilter = { ContractNo: contractNoParam, contractNo: contractNoParam };
    setFilters((prev) => ({ ...prev, contractNo: contractNoFilter }));
    setAppliedFilters((prev) => ({ ...prev, contractNo: contractNoFilter }));
    setSearchApplied(true);
  }, [urlDeepLink.contractNo]);

  useEffect(() => {
    if (!urlDeepLink.contractNo || !contractNoFilterOptions.length) return;
    const matchedContract = contractNoFilterOptions.find(
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
  }, [contractNoFilterOptions, urlDeepLink.contractNo]);

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

  const displayScheduleRows = useMemo(() => {
    if (!searchApplied) {
      return Array.isArray(allScheduleRows) ? allScheduleRows : [];
    }
    return filterAgreementProvScheduleRows(searchResultRows, appliedFilters, units, {
      skipFinalized: true,
      skipServerFilters: true,
    });
  }, [allScheduleRows, searchResultRows, appliedFilters, units, searchApplied]);

  const syncInvoiceItemRecordKeyFromLines = useCallback((rowData, lines) => {
    const key = getAgreementProvInvoiceActionKey(rowData);
    if (!key) return;
    const hasItems = (lines || []).some(isAgreementProvInvoiceItemRecordRow);
    setInvoiceKeysWithItemRecords((prev) => {
      const next = new Set(prev);
      if (hasItems) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const handleSearch = async () => {
    const snapshot = { ...filters, contractNo: filters.contractNo };
    setAppliedFilters(snapshot);
    setInvoiceKeysWithItemRecords(new Set());
    setLoading(true);
    try {
      await executeFinalizedInvoiceSearch(snapshot, { invoiceNo: urlDeepLink.invoiceNo });
      setSearchApplied(true);
    } catch (error) {
      console.error("Error searching finalized invoices:", error);
      setSearchResultRows([]);
      alert("Failed to search finalized invoices. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const refreshScheduleGrid = async () => {
    setLoading(true);
    try {
      await reloadAllScheduleRows();
      if (searchApplied) {
        await executeFinalizedInvoiceSearch(appliedFilters, { invoiceNo: urlDeepLink.invoiceNo });
      }
    } catch (error) {
      console.error("Error refreshing contract invoice schedule:", error);
      alert("Failed to refresh invoice schedule. Please try again.");
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
      await refreshScheduleGrid();
    } catch (error) {
      console.error("Error updating invoice lock:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    } finally {
      setInvoiceLockSavingKey("");
    }
  };

  const generatePDF = async (rowData, marginsInParam = null, { openNewTab = true } = {}) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const { marginLeft, marginRight, marginTop, marginBottom } = agreementProvPdfMarginsInchesToMm(
      marginsInParam ?? loadAgreementProvPdfMargins()
    );
    const contentRight = pageWidth - marginRight;
    const contentWidth = contentRight - marginLeft;
    const lineHeight = AGREEMENT_PROV_PDF_LINE_HEIGHT_MM;
    const bodyFont = AGREEMENT_PROV_PDF_FONT_BODY;

    const contractNo = String(pickScheduleRowField(rowData, "ContractNo", "contractNo") || "");
    const invoiceNo = String(pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || "");
    const contractStartDate = pickScheduleRowField(
      rowData,
      "ContractStartDate",
      "contractStartDate"
    );
    const contractEndDate = pickScheduleRowField(rowData, "ContractEndDate", "contractEndDate");
    const initialRentPM = pickScheduleRowField(rowData, "InitialRentPM", "initialRentPM") || 0;
    const paymentTermMonths =
      pickScheduleRowField(rowData, "PaymentTermMonths", "paymentTermMonths") || 12;
    const tenantNo = String(pickScheduleRowField(rowData, "TenantNo", "tenantNo") || "").trim();
    const customerDisplay = formatPrefixNoDisplay(rowData) || tenantNo || "—";
    const descriptionText = pickAgreementProvHeaderDescription(rowData) || "Sales Invoice";
    const invoiceDateDisplay = formatPdfInvoiceDate(pickScheduleInvoiceDate(rowData));
    const dueDateDisplay = formatPdfInvoiceDate(
      pickScheduleRowField(rowData, "DueDate", "dueDate")
    );
    const contractPeriodStart = formatPdfContractDateShort(contractStartDate);
    const contractPeriodEnd = formatPdfContractDateShort(contractEndDate);
    const contractDisplay =
      contractPeriodStart && contractPeriodEnd
        ? `${contractNo} (${contractPeriodStart} To ${contractPeriodEnd})`
        : contractNo || "—";

    let particularName = "—";
    let accountingAddressLine1 = "—";
    let accountingAddressLine2 = "";
    let accountingTelNo = "";

    try {
      const accountingResponse = await accountingSysApi.getAll();
      const accountingConfig = unwrapAccountingSysList(accountingResponse)[0];
      if (accountingConfig) {
        particularName =
          String(
            accountingConfig?.ParticularName ?? accountingConfig?.particularName ?? ""
          ).trim() || "—";
        const addressParts = splitAccountingSysAddressForPdf(
          accountingConfig?.Address ?? accountingConfig?.address
        );
        accountingAddressLine1 = addressParts.line1;
        accountingAddressLine2 = addressParts.line2;
        accountingTelNo = String(accountingConfig?.TelNo ?? accountingConfig?.telNo ?? "").trim();
      }
    } catch (error) {
      console.error("Error fetching accounting system config for PDF:", error);
    }

    let invoiceLineRows = [];
    if (invoiceNo) {
      try {
        const response = await contractApi.getInvoiceScheduleByInvoiceNo(invoiceNo);
        const lines = unwrapContractInvoiceScheduleList(response);
        invoiceLineRows = sortInvoiceLinesByOrder(
          (lines || []).filter((lineRow) => !isMainInvoiceScheduleRow(lineRow))
        );
      } catch (error) {
        console.error("Error loading invoice item records for PDF:", error);
      }
    }

    const LOGO_WIDTH_MM = 18;
    const LOGO_GAP_MM = 3;
    const textStartX = marginLeft + LOGO_WIDTH_MM + LOGO_GAP_MM;
    const INVOICE_BOX_WIDTH_MM = 54;
    const INVOICE_LABEL_COL_MM = 24;
    const invoiceBoxLeft = contentRight - INVOICE_BOX_WIDTH_MM;
    const invoiceSepX = invoiceBoxLeft + INVOICE_LABEL_COL_MM;
    const invoiceValueX = invoiceSepX + 2;
    const customerValueX = textStartX;

    await loadPafLogoIntoPdf(doc, marginLeft, marginTop, LOGO_WIDTH_MM);

    const drawBodyText = (text, x, y, options = {}) => {
      doc.setFont("helvetica", options.bold ? "bold" : "normal");
      doc.setFontSize(options.fontSize || bodyFont);
      doc.text(String(text ?? ""), x, y, options.textOptions);
    };

    const ensurePageSpace = (y, needed = lineHeight) => {
      if (y + needed <= pageHeight - marginBottom - 20) return y;
      doc.addPage();
      return marginTop;
    };

    doc.setLineWidth(0.15);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(AGREEMENT_PROV_PDF_FONT_TITLE);
    doc.text("Sales Invoice", textStartX, marginTop + 5);

    let headerY = marginTop + 11;
    drawBodyText(particularName, textStartX, headerY, { bold: true });
    headerY += lineHeight;
    drawBodyText(accountingAddressLine1, textStartX, headerY);
    headerY += lineHeight;
    drawBodyText(accountingAddressLine2 || " ", textStartX, headerY);
    headerY += lineHeight;
    drawBodyText(accountingTelNo ? `Tel No ${accountingTelNo}` : "Tel No", textStartX, headerY);

    let invoiceMetaY = marginTop + 5 + lineHeight;
    const invoiceMetaRows = [
      ["Invoice No", invoiceNo || "—"],
      ["Invoice Date", invoiceDateDisplay || "—"],
      ["Due Date", dueDateDisplay || "—"],
    ];
    invoiceMetaRows.forEach(([label, value]) => {
      drawBodyText(label, invoiceBoxLeft + 2, invoiceMetaY, { bold: true });
      drawBodyText(value, invoiceValueX, invoiceMetaY);
      invoiceMetaY += lineHeight;
    });

    let yPos = Math.max(headerY, invoiceMetaY) + lineHeight + 3;

    const drawUnderlinedCustomerRow = (label, value, withColon = true) => {
      const rowTop = yPos;
      const labelText = withColon ? `${label} :` : label;
      drawBodyText(labelText, marginLeft + 1, rowTop, { bold: true });
      const valueLines = doc.splitTextToSize(String(value || "—"), contentRight - textStartX - 1);
      valueLines.forEach((line, index) => {
        drawBodyText(line, customerValueX, rowTop + index * lineHeight);
      });
      const rowHeight = Math.max(lineHeight, valueLines.length * lineHeight);
      const underlineY = rowTop + rowHeight - 0.5;
      doc.line(customerValueX, underlineY, contentRight, underlineY);
      yPos = rowTop + rowHeight + 3;
      return rowHeight + 3;
    };

    drawUnderlinedCustomerRow("Customer", customerDisplay, true);
    drawUnderlinedCustomerRow("Contract", contractDisplay, true);
    drawUnderlinedCustomerRow("Description", descriptionText, false);

    yPos += lineHeight;

    const pdfBodyColQtyX = marginLeft + contentWidth * 0.58;
    const pdfBodyColUnitPriceX = marginLeft + contentWidth * 0.72;
    const pdfBodyDescWidth = pdfBodyColQtyX - marginLeft - 2;

    const drawBodyTableHeader = () => {
      const rowTop = yPos;
      drawBodyText("Description", marginLeft, rowTop, { bold: true });
      drawBodyText("Qty", pdfBodyColQtyX, rowTop, { bold: true });
      drawBodyText("Unit price", pdfBodyColUnitPriceX, rowTop, { bold: true });
      drawBodyText("Total", contentRight, rowTop, { bold: true, textOptions: { align: "right" } });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(bodyFont);
      const headerTextHeight = doc.getTextDimensions("Description").h;
      const underlineY = rowTop + headerTextHeight * 0.28 + 0.4;
      doc.line(marginLeft, underlineY, contentRight, underlineY);
      yPos = underlineY + lineHeight;
    };

    const drawBodyTableRow = (description, qty, unitPrice, total) => {
      yPos = ensurePageSpace(yPos, lineHeight + 2);
      if (yPos === marginTop) {
        drawBodyTableHeader();
      }

      const descLines = doc.splitTextToSize(String(description || "—"), pdfBodyDescWidth);
      descLines.forEach((line, index) => {
        if (index > 0) {
          yPos = ensurePageSpace(yPos, lineHeight);
          if (yPos === marginTop) {
            drawBodyTableHeader();
          }
        }
        drawBodyText(line, marginLeft, yPos);
        if (index === 0) {
          drawBodyText(String(qty ?? "—"), pdfBodyColQtyX, yPos);
          drawBodyText(formatPdfCurrency(unitPrice), pdfBodyColUnitPriceX, yPos);
          drawBodyText(formatPdfCurrency(total), contentRight, yPos, {
            textOptions: { align: "right" },
          });
        }
        yPos += lineHeight;
      });
    };

    let calculatedTotal = 0;

    drawBodyTableHeader();

    if (invoiceLineRows.length > 0) {
      invoiceLineRows.forEach((lineRow) => {
        const desc =
          pickScheduleRowField(lineRow, "Description", "description") ||
          pickScheduleRowField(lineRow, "Desc", "desc") ||
          pickScheduleRowField(lineRow, "ItemwithCode", "itemwithCode") ||
          pickScheduleRowField(lineRow, "ItemCode", "itemCode") ||
          "—";
        const qty = pickScheduleRowField(lineRow, "Months", "months") || "—";
        const unitPrice = pickScheduleRowField(lineRow, "CalculatedRentPM", "calculatedRentPM");
        const lineTotal = pickInvoiceLineTotalNumeric(lineRow);
        calculatedTotal += lineTotal;
        drawBodyTableRow(desc, qty, unitPrice, lineTotal);
      });
    } else {
      const pmMonths = paymentTermMonths || 12;
      const fallbackTotal = Number(initialRentPM) * Number(pmMonths);
      calculatedTotal = Number.isFinite(fallbackTotal) ? fallbackTotal : 0;
      drawBodyTableRow("MR Monthly Rent", pmMonths, initialRentPM, calculatedTotal);
    }

    const amountReceivable = Number(
      pickScheduleRowField(rowData, "AmountReceivable", "amountReceivable") || 0
    );
    const displayTotal =
      calculatedTotal > 0
        ? calculatedTotal
        : Number.isFinite(amountReceivable) && amountReceivable > 0
        ? amountReceivable
        : Number(pickScheduleRowField(rowData, "TotalRent", "totalRent") || 0);

    yPos = ensurePageSpace(yPos + 4, lineHeight * 3);
    yPos += 4;

    const totalText = `Total: ${formatPdfCurrency(displayTotal)}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(bodyFont);
    const totalDims = doc.getTextDimensions(totalText);
    const totalRowY = yPos;
    const totalOverlineY = totalRowY - totalDims.h * 0.75 - 0.5;
    doc.line(marginLeft, totalOverlineY, contentRight, totalOverlineY);
    drawBodyText(totalText, contentRight, totalRowY, {
      bold: true,
      textOptions: { align: "right" },
    });

    yPos += lineHeight + 8;
    if (yPos > pageHeight - marginBottom - 20) {
      doc.addPage();
      yPos = marginTop;
    }
    const signatureY = Math.max(yPos + 10, pageHeight - marginBottom - 18);
    doc.line(marginLeft, signatureY, contentRight, signatureY);

    const pdfBlob = doc.output("blob");
    if (!openNewTab) return pdfBlob;
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  };

  const revokePdfPreviewObjectUrl = () => {
    if (pdfPreviewUrlRef.current) {
      URL.revokeObjectURL(pdfPreviewUrlRef.current);
      pdfPreviewUrlRef.current = null;
    }
    setPdfPreviewUrl(null);
  };

  const handleClosePdfPreview = () => {
    setPdfPreviewOpen(false);
    setPdfPreviewRowData(null);
    setPdfPreviewLoading(false);
    revokePdfPreviewObjectUrl();
  };

  const regeneratePdfPreview = async (rowData, marginsIn) => {
    if (!rowData) return;
    setPdfPreviewLoading(true);
    try {
      saveAgreementProvPdfMargins(marginsIn);
      const pdfBlob = await generatePDF(rowData, marginsIn, { openNewTab: false });
      revokePdfPreviewObjectUrl();
      const nextUrl = URL.createObjectURL(pdfBlob);
      pdfPreviewUrlRef.current = nextUrl;
      setPdfPreviewUrl(nextUrl);
    } catch (error) {
      console.error("Error generating PDF preview:", error);
      alert(error?.message || "Failed to generate PDF preview.");
    } finally {
      setPdfPreviewLoading(false);
    }
  };

  const handleOpenPdfPreview = async (rowData) => {
    const marginsIn = loadAgreementProvPdfMargins();
    setPdfPreviewRowData(rowData);
    setPdfPreviewMarginsIn(marginsIn);
    setPdfPreviewOpen(true);
    await regeneratePdfPreview(rowData, marginsIn);
  };

  const handleApplyPdfMargins = async () => {
    await regeneratePdfPreview(pdfPreviewRowData, pdfPreviewMarginsIn);
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

  const handleSaveEditRow = async (form, rowData, lineSaveContext = {}) => {
    const { contractNo, invoiceNo } = getInvoiceScheduleRouteKeys(rowData, form);
    if (!contractNo || !invoiceNo) {
      alert("Cannot update: Contract No and Invoice ID are required.");
      return;
    }

    setSavingEdit(true);
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
      const savedLines = lineSaveContext.invoiceLines ?? [];
      syncInvoiceItemRecordKeyFromLines(rowData, savedLines);
      handleCloseEditRow();
      await refreshScheduleGrid();
    } catch (error) {
      console.error("Error updating contract invoice schedule:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    } finally {
      setSavingEdit(false);
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
      const hasItemRecords = invoiceKeysWithItemRecords.has(
        getAgreementProvInvoiceActionKey(rowData)
      );
      return (
        <Tooltip title={hasItemRecords ? "Edit (has invoice item records)" : "Edit"}>
          <IconButton
            size="small"
            className="erp-grid-action-edit"
            onClick={() => handleOpenEditRow(rowData)}
            aria-label="Edit"
            sx={
              hasItemRecords
                ? agreementProvActionIconSx.editWithItemRecords
                : agreementProvActionIconSx.edit
            }
          >
            <Icon>edit</Icon>
          </IconButton>
        </Tooltip>
      );
    },
  };

  const agreementProvActionIconSx = {
    edit: {
      padding: "2px",
      color: "#2563eb",
      opacity: "1 !important",
      transform: "none !important",
      filter: "none !important",
      transition: "background-color 0.15s ease",
      "&:hover": {
        opacity: "1 !important",
        transform: "none !important",
        filter: "none !important",
        backgroundColor: "rgba(37, 99, 235, 0.1)",
      },
      "& .MuiIcon-root": {
        color: "#2563eb !important",
        fontSize: "1.15rem",
      },
    },
    editWithItemRecords: {
      padding: "2px",
      color: "#16a34a",
      opacity: "1 !important",
      transform: "none !important",
      filter: "none !important",
      transition: "background-color 0.15s ease",
      "&:hover": {
        opacity: "1 !important",
        transform: "none !important",
        filter: "none !important",
        backgroundColor: "rgba(22, 163, 74, 0.12)",
      },
      "& .MuiIcon-root": {
        color: "#16a34a !important",
        fontSize: "1.15rem",
      },
    },
  };

  const viewColIconSx = {
    expand: {
      padding: "2px",
      color: "#6a1b9a",
      "&:hover": { backgroundColor: "rgba(106, 27, 154, 0.12)" },
      "& .MuiIcon-root": { color: "#6a1b9a", fontSize: "1.15rem" },
    },
    lockOpen: {
      padding: "2px",
      color: "#ed6c02",
      "&:hover:not(:disabled)": { backgroundColor: "rgba(237, 108, 2, 0.12)" },
      "& .MuiIcon-root": { color: "#ed6c02", fontSize: "1.15rem" },
    },
    lockClosed: {
      padding: "2px",
      color: "#d32f2f",
      "&:hover:not(:disabled)": { backgroundColor: "rgba(211, 47, 47, 0.12)" },
      "& .MuiIcon-root": { color: "#d32f2f", fontSize: "1.15rem" },
      "&.Mui-disabled .MuiIcon-root": { color: "rgba(211, 47, 47, 0.45)" },
    },
    visibility: {
      padding: "2px",
      color: "#0288d1",
      "&:hover": { backgroundColor: "rgba(2, 136, 209, 0.12)" },
      "& .MuiIcon-root": { color: "#0288d1", fontSize: "1.2rem" },
    },
    pdf: {
      padding: "4px",
      color: "#2e7d32",
      "&:hover": { backgroundColor: "rgba(46, 125, 50, 0.12)" },
      "& .MuiIcon-root": { color: "#2e7d32", fontSize: "1.35rem" },
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
            onClick={() => {
              setExpandedGroups((prev) => {
                const next = new Set(prev);
                if (next.has(groupKey)) next.delete(groupKey);
                else next.add(groupKey);
                return next;
              });
            }}
            title={isExpanded ? "Collapse" : "Expand"}
            sx={viewColIconSx.expand}
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
                disabled={lockBusy || (isLocked && !isSuper)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (isLocked) return;
                  void handleInvoiceLockChange(rowData, true);
                }}
                sx={isLocked ? viewColIconSx.lockClosed : viewColIconSx.lockOpen}
              >
                <Icon>{isLocked ? "lock" : "lock_open"}</Icon>
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="View invoice">
            <IconButton
              size="small"
              onClick={() => handleOpenViewRow(rowData)}
              sx={viewColIconSx.visibility}
            >
              <Icon>visibility</Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title="Generate PDF">
            <IconButton
              onClick={() => handleOpenPdfPreview(rowData)}
              size="medium"
              sx={viewColIconSx.pdf}
            >
              <Icon>picture_as_pdf</Icon>
            </IconButton>
          </Tooltip>
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
      const display = cmd?.name || (id !== "" ? String(id) : "-");
      return withGridValueChip(display, "rac", { row });
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
      const display = base?.name || (id !== "" ? String(id) : "-");
      return withGridValueChip(display, "base", { row });
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
    scheduleNumberColumn("totalRent", "Receivable", "TotalRent", "totalRent", true),
    scheduleTextColumn("remarks", "Remarks", "Remarks", "remarks"),
    scheduleNumberColumn("amountReceived", "Received", "AmountReceived", "amountReceived", true),
    scheduleNumberColumn("amountPending", "Balance", "AmountPending", "amountPending", true),

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
    "amountPending",
  ];

  const groupedData = useMemo(() => {
    const enrichedRows = (displayScheduleRows || []).map((row) => {
      const cmdId = row.cmdId ?? row.CmdId;
      const baseId = row.baseId ?? row.BaseId;
      const cmd = commands.find((c) => Number(c.id) === Number(cmdId));
      const base = bases.find((b) => Number(b.id) === Number(baseId));
      return {
        ...row,
        cmdName: cmd?.name || (cmdId !== "" && cmdId != null ? String(cmdId) : ""),
        baseName: base?.name || (baseId !== "" && baseId != null ? String(baseId) : ""),
        ...agreementProvGridRowLockFlags(row),
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
        __disabledRow: false,
        __rowClassName: "",
        __rowStyle: {},
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
  }, [displayScheduleRows, commands, bases, expandedGroups, groupByColumns]);

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
      <EnterpriseWorkspace
        title="Agreement Invoice"
        subtitle="Manage agreement provisional invoice records"
        tabs={<ContractsModuleTabs />}
        filters={
          <MDBox px={3} sx={{ flexShrink: 0 }}>
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
                <AgreementProvFilterDateInput
                  label="Date From"
                  value={filters.dateFrom}
                  onChange={(v) => handleFilterChange("dateFrom", v)}
                  sx={inputSx}
                  aria-label="Date From"
                />
              </MDBox>

              <MDBox sx={{ flex: "1 1 115px", minWidth: 0 }}>
                <AgreementProvFilterDateInput
                  label="Date To"
                  value={filters.dateTo}
                  onChange={(v) => handleFilterChange("dateTo", v)}
                  min={filters.dateFrom || undefined}
                  sx={inputSx}
                  aria-label="Date To"
                />
              </MDBox>

              <MDBox sx={{ flex: "1 1 120px", minWidth: 0 }}>
                <Autocomplete
                  options={contractNoFilterOptions}
                  getOptionLabel={(option) =>
                    option.ContractNo || option.contractNo || String(option)
                  }
                  value={
                    filters.contractNo
                      ? contractNoFilterOptions.find(
                          (c) =>
                            (c.ContractNo || c.contractNo) ===
                            (filters.contractNo.ContractNo ||
                              filters.contractNo.contractNo ||
                              filters.contractNo)
                        ) ||
                        (typeof filters.contractNo === "object"
                          ? filters.contractNo
                          : { ContractNo: filters.contractNo, contractNo: filters.contractNo })
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

              <MDBox
                sx={{
                  flex: "0 0 auto",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-end",
                  gap: 0.25,
                }}
              >
                <MDBox
                  sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 0.75,
                    flexShrink: 0,
                  }}
                >
                  <IconButton
                    color="info"
                    onClick={handleSearch}
                    disabled={loading}
                    sx={{
                      flexShrink: 0,
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
                    title="Search Finalized Invoices"
                  >
                    <Icon sx={{ fontWeight: "bold", fontSize: "1.25rem" }}>search</Icon>
                  </IconButton>
                  <MDTypography
                    variant="caption"
                    color="text"
                    sx={{
                      fontSize: "0.7rem",
                      lineHeight: 1.2,
                      fontWeight: 500,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Search Finalized Invoices
                  </MDTypography>
                </MDBox>
                <MDBox
                  ref={setPaginationHost}
                  className="agreement-prov-invoice-filter-pagination"
                  sx={{
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                    minHeight: 22,
                    "& .MuiPaginationItem-root": {
                      fontSize: "0.6rem",
                      minWidth: "1.2rem",
                      height: "1.2rem",
                      padding: "0 2px",
                    },
                    "& .MuiPaginationItem-icon": {
                      fontSize: "0.8rem",
                    },
                    "& .compact-grid-pagination": {
                      gap: 0,
                    },
                  }}
                />
              </MDBox>
            </MDBox>
          </MDBox>
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <MDBox px={3} sx={{ flexShrink: 0 }}>
          {/* Results Table */}
          <MDBox
            className="agreement-prov-invoice-page-grid"
            position="relative"
            aria-busy={loading}
            sx={{
              display: "flex",
              flexDirection: "column",
              flex: "1 1 0",
              minHeight: 0,
              overflow: "hidden",
              "& tr.agreement-prov-invoice-locked-row > td": {
                filter: "blur(1px)",
                WebkitFilter: "blur(1px)",
                opacity: 0.72,
                userSelect: "none",
              },
              "& td .MuiIconButton-root.erp-grid-action-edit, & td .MuiIconButton-root.erp-grid-action-edit:hover":
                {
                  opacity: "1 !important",
                  transform: "none !important",
                  filter: "none !important",
                },
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
                fontSize: "0.875rem !important",
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
                  backgroundColor: darkMode ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.8)",
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
              showTotalEntries={false}
              pagination={true}
              isSorted={true}
              noEndBorder
              exportFileName="Agreement-Prov-Invoice"
              exportCellFormatter={exportCellFormatter}
              exportExcludeGroupParentsWhenExpanded
              extraFilterTypes={AGREEMENT_PROV_DATATABLE_DATE_FILTER_TYPES}
              toolbarStartInHeader
              toolbarStart={
                <CompactGroupBySelect
                  options={groupingColumnOptions}
                  value={groupByColumns}
                  onChange={setGroupByColumns}
                />
              }
              paginationHost={paginationHost}
            />
          </MDBox>
        </MDBox>
      </EnterpriseWorkspace>

      <Dialog open={pdfPreviewOpen} onClose={handleClosePdfPreview} maxWidth={false} fullWidth>
        <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 700, pb: 1 }}>PDF Preview</DialogTitle>
        <DialogContent sx={{ p: 0, height: "75vh", display: "flex" }}>
          <MDBox
            sx={{
              width: 320,
              borderRight: "1px solid #e0e0e0",
              p: 2,
              overflow: "auto",
            }}
          >
            <MDTypography variant="h6" sx={{ mb: 1 }}>
              Margins (in)
            </MDTypography>

            <MDBox display="flex" flexDirection="column" gap={1}>
              <MDInput
                size="small"
                label="Top"
                type="number"
                value={pdfPreviewMarginsIn?.topIn ?? 0}
                onChange={(e) =>
                  setPdfPreviewMarginsIn((prev) => ({
                    ...prev,
                    topIn: Number(e.target.value),
                  }))
                }
                inputProps={{ step: 0.1, min: 0 }}
              />
              <MDInput
                size="small"
                label="Bottom"
                type="number"
                value={pdfPreviewMarginsIn?.bottomIn ?? 0}
                onChange={(e) =>
                  setPdfPreviewMarginsIn((prev) => ({
                    ...prev,
                    bottomIn: Number(e.target.value),
                  }))
                }
                inputProps={{ step: 0.1, min: 0 }}
              />
              <MDInput
                size="small"
                label="Left"
                type="number"
                value={pdfPreviewMarginsIn?.leftIn ?? 0}
                onChange={(e) =>
                  setPdfPreviewMarginsIn((prev) => ({
                    ...prev,
                    leftIn: Number(e.target.value),
                  }))
                }
                inputProps={{ step: 0.1, min: 0 }}
              />
              <MDInput
                size="small"
                label="Right"
                type="number"
                value={pdfPreviewMarginsIn?.rightIn ?? 0}
                onChange={(e) =>
                  setPdfPreviewMarginsIn((prev) => ({
                    ...prev,
                    rightIn: Number(e.target.value),
                  }))
                }
                inputProps={{ step: 0.1, min: 0 }}
              />
            </MDBox>

            <MDBox mt={2} display="flex" gap={1} alignItems="center">
              <MDButton
                variant="outlined"
                color="dark"
                size="small"
                onClick={() => setPdfPreviewMarginsIn({ ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS })}
                disabled={pdfPreviewLoading}
              >
                Reset
              </MDButton>
              <MDButton
                variant="contained"
                color="dark"
                size="small"
                onClick={handleApplyPdfMargins}
                disabled={!pdfPreviewRowData || pdfPreviewLoading}
              >
                Update
              </MDButton>
            </MDBox>

            <MDTypography variant="caption" sx={{ mt: 1, color: "text.secondary" }}>
              Values are applied when you click Update.
            </MDTypography>
          </MDBox>

          <MDBox sx={{ flex: 1, position: "relative", backgroundColor: "#ffffff" }}>
            {pdfPreviewLoading && (
              <MDBox
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                display="flex"
                justifyContent="center"
                alignItems="center"
                zIndex={2}
                sx={{
                  backgroundColor: "rgba(255, 255, 255, 0.75)",
                  backdropFilter: "blur(2px)",
                }}
              >
                <CurrencyLoading size={40} />
              </MDBox>
            )}

            {pdfPreviewUrl ? (
              <iframe
                title="Agreement Prov Invoice PDF"
                src={pdfPreviewUrl}
                style={{ width: "100%", height: "100%", border: 0 }}
              />
            ) : (
              <MDBox height="100%" display="flex" justifyContent="center" alignItems="center">
                <MDTypography variant="body2" sx={{ color: "text.secondary" }}>
                  No preview generated yet.
                </MDTypography>
              </MDBox>
            )}
          </MDBox>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <MDButton variant="outlined" color="dark" onClick={handleClosePdfPreview}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>

      <AgreementProvInvoiceEditDialog
        open={editDialogOpen}
        onClose={handleCloseEditRow}
        rowData={editRowData}
        onSave={handleSaveEditRow}
        saving={savingEdit}
        viewMode={editDialogViewMode}
        registerReloadInvoiceLines={registerReloadInvoiceLines}
        onInvoiceLinesLoaded={syncInvoiceItemRecordKeyFromLines}
      />
    </DashboardLayout>
  );
}

export {
  AgreementProvContractBasicInfoStrip,
  AgreementProvInvoiceEditDialog,
  buildAgreementProvContractBasicInfoForm,
  buildAgreementProvEditForm,
  getAgreementProvSaveErrorMessage,
  persistAllInvoiceScheduleLines,
};
