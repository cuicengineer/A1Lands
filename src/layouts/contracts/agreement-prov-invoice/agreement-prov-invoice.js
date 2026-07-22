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
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import InputAdornment from "@mui/material/InputAdornment";
import Autocomplete from "@mui/material/Autocomplete";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import IncomeAgreementsModuleTabs from "layouts/income-agreements/components/IncomeAgreementsModuleTabs";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import CompactGroupBySelect from "components/CompactGroupBySelect";
import { withGridValueChip } from "utils/gridValueChipCell";
import PropTypes from "prop-types";
import api, { isSuperuserOrAhqSupervisorUser } from "services/api.service";
import contractApi from "services/api.contract.service";
import accountingSysApi from "services/api.accountingsys.service";
import salesReturnsApi from "services/api.salesReturns.service";
import { productServiceApi } from "services/api.product.service";
import {
  buildProductUomLookup,
  fetchProductUomOptions,
  formatProductUomLabel,
  normalizeServiceRecord,
} from "layouts/products/shared/productUtils";
import {
  buildInvoiceKey,
  resolveCollectionTenantAccount,
} from "layouts/income-agreements/collections/collectionsUtils";
import SalesReturnForm from "layouts/income-agreements/sales-returns/SalesReturnForm";
import {
  buildSalesReturnPrefillFromAgreementProvInvoiceRow,
  buildSalesReturnTotalsByInvoiceKey,
  computeSalesReturnGrandTotal,
  formatAmount,
} from "layouts/income-agreements/sales-returns/salesReturnUtils";
import { SALES_RETURNS_LABELS } from "layouts/income-agreements/transactionLabels";
import AgreementDetailsDialog from "layouts/contracts/components/AgreementDetailsDialog";
import {
  AGREEMENT_DETAILS_COLUMNS,
  fetchNormalizedContractRiseTerms,
  resolveAgreementContract,
} from "utils/agreementDetailsSupport";
import { addContractPdfWatermarks } from "layouts/contracts/contracts/contractPdfWatermark";
import { useMaterialUIController } from "context";
import jsPDF from "jspdf";
import { format, parseISO, isValid, addDays, addMonths, addYears } from "date-fns";
import { useNavigate } from "react-router-dom";

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

/** Grid row flags: dimmed disabled styling when invoice is locked (IsLocked = 1). */
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
            <SearchableSelect
              labelId={modeLabelId}
              label="Comparison"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <MenuItem value="none">No date filter</MenuItem>
              <MenuItem value="gt">Greater than (after)</MenuItem>
              <MenuItem value="lt">Less than (before)</MenuItem>
              <MenuItem value="between">Date range</MenuItem>
            </SearchableSelect>
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

/** Schedule grid only: one row per ContractNo + InvoiceNo (JOIN fan-out guard). */
function dedupeAgreementProvScheduleRowsByInvoice(rows = []) {
  const seen = new Set();
  const output = [];
  (rows || []).forEach((row) => {
    const contractNo = String(row?.ContractNo ?? row?.contractNo ?? "").trim();
    const invoiceNo = String(row?.InvoiceNo ?? row?.invoiceNo ?? "").trim();
    if (!contractNo || !invoiceNo) {
      output.push(row);
      return;
    }
    const key = `${contractNo}|${invoiceNo}`.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    output.push(row);
  });
  return output;
}

function readAgreementProvInvoiceUrlParams() {
  const readFromSearch = (searchText) => {
    try {
      const params = new URLSearchParams(String(searchText || ""));
      return {
        contractNo: String(params.get("contractNo") || "").trim(),
        invoiceNo: String(params.get("invoiceNo") || "").trim(),
        tenantNo: String(params.get("tenantNo") || "").trim(),
        view: String(params.get("view") || "")
          .trim()
          .toLowerCase(),
      };
    } catch {
      return { contractNo: "", invoiceNo: "", tenantNo: "", view: "" };
    }
  };

  if (typeof window === "undefined") {
    return { contractNo: "", invoiceNo: "", tenantNo: "", view: "" };
  }

  const fromSearch = readFromSearch(window.location?.search || "");
  if (fromSearch.contractNo || fromSearch.invoiceNo || fromSearch.tenantNo || fromSearch.view) {
    return fromSearch;
  }

  const hash = String(window.location?.hash || "");
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0) return readFromSearch(hash.slice(queryIndex));

  return { contractNo: "", invoiceNo: "", tenantNo: "", view: "" };
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
  const tenantNo = String(extra?.tenantNo || "").trim();
  return {
    ...(contractNo ? { contractNo } : {}),
    ...(filters?.dateFrom ? { fromDate: filters.dateFrom } : {}),
    ...(filters?.dateTo ? { toDate: filters.dateTo } : {}),
    ...(filters?.command !== "" && filters?.command != null
      ? { cmdId: Number(filters.command) }
      : {}),
    ...(filters?.base !== "" && filters?.base != null ? { baseId: Number(filters.base) } : {}),
    ...(invoiceNo ? { invoiceNo } : {}),
    ...(tenantNo ? { tenantNo } : {}),
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

const EDIT_INVOICE_LINES_TABLE_COLUMNS = [
  {
    label: "Order",
    pascal: "SortOrder",
    camel: "sortOrder",
    numeric: true,
    align: "left",
    compact: true,
  },
  {
    label: "Sub Invoice",
    pascal: "SubInvoiceNo",
    camel: "subInvoiceNo",
    align: "left",
    compact: true,
  },
  { label: "Item with Code", pascal: "ItemwithCode", camel: "itemwithCode", align: "left" },
  {
    label: "Particular",
    pascal: "Description",
    camel: "description",
    align: "left",
    wide: true,
    showFull: true,
  },
  { label: "Acc Head", pascal: "AccHead", camel: "accHead", align: "left", showFull: true },
  {
    label: "Qty",
    pascal: "Months",
    camel: "months",
    numeric: true,
    align: "right",
    compact: true,
  },
  {
    label: "Unit Price",
    pascal: "CalculatedRentPM",
    camel: "calculatedRentPM",
    numeric: true,
    align: "right",
    compact: true,
  },
  {
    label: "Disc",
    pascal: "Discount",
    camel: "discount",
    numeric: true,
    align: "center",
    compact: true,
  },
  {
    label: "Total",
    pascal: "Total",
    camel: "total",
    numeric: true,
    align: "right",
    compact: true,
    showFull: true,
  },
];

// Fixed fr tracks (not max-content) so header and draft/body rows share identical column positions.
// Order | Sub Inv | Item Code | Particular | Acc Head | Qty | Unit Price | Disc | Total
const INVOICE_LINES_DATA_GRID_COLUMNS =
  "minmax(30px, 0.25fr) minmax(44px, 0.36fr) minmax(160px, 1.8fr) minmax(280px, 2.3fr) minmax(160px, 1.4fr) minmax(64px, 0.55fr) minmax(140px, 1.15fr) 58px minmax(120px, 0.95fr)";

const INVOICE_LINES_GRID_COLUMNS = `${INVOICE_LINES_DATA_GRID_COLUMNS} 96px`;

const INVOICE_LINES_GRID_COLUMNS_READONLY = INVOICE_LINES_DATA_GRID_COLUMNS;

const INVOICE_LINES_GRID_MIN_WIDTH = 1280;

const INVOICE_LINE_ACTION_BUTTON_SX = {
  p: 0,
  width: 18,
  height: 18,
  minWidth: 18,
  minHeight: 18,
};

const INVOICE_LINE_ACTION_ICON_SX = { fontSize: "0.85rem !important" };

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

/** Acc Head saved on the finalized invoice (main schedule row), with safe fallbacks. */
function resolveFinalizedInvoiceAccHead(parentRow, invoiceLinesRows) {
  const mainRow = findMainInvoiceScheduleRow(invoiceLinesRows);
  const fromMain = String(pickScheduleRowField(mainRow, "AccHead", "accHead") || "").trim();
  if (fromMain) return fromMain;

  const fromParent = String(pickScheduleRowField(parentRow, "AccHead", "accHead") || "").trim();
  if (fromParent) return fromParent;

  for (const row of getInvoiceItemRecordRows(invoiceLinesRows)) {
    const value = String(pickScheduleRowField(row, "AccHead", "accHead") || "").trim();
    if (value) return value;
  }
  return "";
}

/** Tenant chart-of-account label (AcctId-AcctName) for agreement invoice Acc Head. */
export function resolveAgreementProvTenantAccHead(contractRow, tenants, coaOptions) {
  const { accountLabel } = resolveCollectionTenantAccount(contractRow, tenants, coaOptions);
  return String(accountLabel || "").trim();
}

/** Acc Head label linked to a product/service Item with Code (Sale Account). */
export function resolveItemWithCodeAccHead(productOrService) {
  if (!productOrService) return "";
  return String(productOrService.saleAccountDisplay || "").trim();
}

function normalizeInvoiceAccHeadKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

/** Unique Acc Head labels linked to active Item with Code products. */
function buildInvoiceAccHeadOptions(productServiceOptions = [], savedAccHead = "") {
  const byKey = new Map();
  (productServiceOptions || []).forEach((option) => {
    const label = resolveItemWithCodeAccHead(option);
    if (!label) return;
    const key = normalizeInvoiceAccHeadKey(label);
    if (!byKey.has(key)) {
      byKey.set(key, { value: label, label });
    }
  });
  const saved = String(savedAccHead || "").trim();
  if (saved) {
    const key = normalizeInvoiceAccHeadKey(saved);
    if (!byKey.has(key)) {
      byKey.set(key, { value: saved, label: saved });
    }
  }
  return [...byKey.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

function findInvoiceProductByAccHead(options, accHead, preferredItemCode = "") {
  const key = normalizeInvoiceAccHeadKey(accHead);
  if (!key) return null;
  const matches = (options || []).filter(
    (option) => normalizeInvoiceAccHeadKey(resolveItemWithCodeAccHead(option)) === key
  );
  if (matches.length === 0) return null;
  const preferred = String(preferredItemCode || "")
    .trim()
    .toUpperCase();
  if (preferred) {
    const keep = matches.find(
      (option) =>
        String(option?.itemCode || "")
          .trim()
          .toUpperCase() === preferred
    );
    if (keep) return keep;
  }
  return matches[0];
}

export function withInvoiceScheduleAccHead(payload, accHead) {
  const value = String(accHead || "").trim();
  if (!value) return payload || {};
  return { ...(payload || {}), AccHead: value, accHead: value };
}

/** Header-level Description on invoice schedule (not line-item Desc). */
const AGREEMENT_PROV_PARTICULAR_PREFIX = "Rent/Fee for the Period: ";

function withAgreementProvParticularPrefix(value) {
  const prefix = AGREEMENT_PROV_PARTICULAR_PREFIX;
  const prefixTrimmed = prefix.trim();
  const raw = String(value ?? "").trim();
  if (!raw) return prefix;
  if (raw.toLowerCase().startsWith(prefixTrimmed.toLowerCase())) {
    const rest = raw.slice(prefixTrimmed.length).replace(/^\s*/, "");
    return rest ? `${prefix}${rest}` : prefix;
  }
  return `${prefix}${raw}`;
}

function pickAgreementProvHeaderDescription(row) {
  if (!row) return withAgreementProvParticularPrefix("");
  return withAgreementProvParticularPrefix(
    pickScheduleRowField(row, "Description", "description") ||
      pickScheduleRowField(row, "Desc", "desc") ||
      ""
  );
}

/** Contract-level field from schedule header row (parent grid row), then optional fallback row. */
function pickAgreementProvScheduleHeaderField(headerRow, fallbackRow, pascalKey, camelKey) {
  for (const row of [headerRow, fallbackRow]) {
    if (!row) continue;
    const v = pickScheduleRowField(row, pascalKey, camelKey);
    if (v !== "" && v !== null && v !== undefined) return v;
  }
  return "";
}

function mergeAgreementProvEditFormContractHeaderFields(form, headerRow, fallbackRow) {
  const f = form || {};
  const initialRentPM = pickAgreementProvScheduleHeaderField(
    headerRow,
    fallbackRow,
    "InitialRentPM",
    "initialRentPM"
  );
  const initialRentPA = pickAgreementProvScheduleHeaderField(
    headerRow,
    fallbackRow,
    "InitialRentPA",
    "initialRentPA"
  );
  const securityDepositAmount = pickAgreementProvScheduleHeaderField(
    headerRow,
    fallbackRow,
    "SecurityDepositAmount",
    "securityDepositAmount"
  );

  return {
    ...f,
    initialRentPM: initialRentPM !== "" ? initialRentPM : f.initialRentPM,
    initialRentPA: initialRentPA !== "" ? initialRentPA : f.initialRentPA,
    securityDepositAmount:
      securityDepositAmount !== "" ? securityDepositAmount : f.securityDepositAmount,
  };
}

function enrichAgreementProvRowWithContractHeaderFields(rowData, scheduleRows) {
  if (!rowData) return rowData;
  const contractNo = scheduleRowContractNo(rowData);
  if (!contractNo) return rowData;

  let initialRentPM = pickScheduleRowField(rowData, "InitialRentPM", "initialRentPM");
  let initialRentPA = pickScheduleRowField(rowData, "InitialRentPA", "initialRentPA");
  let securityDepositAmount = pickScheduleRowField(
    rowData,
    "SecurityDepositAmount",
    "securityDepositAmount"
  );

  if (
    (initialRentPM === "" || initialRentPA === "" || securityDepositAmount === "") &&
    Array.isArray(scheduleRows)
  ) {
    for (const row of scheduleRows) {
      if (row?.isGroupRow || row?.IsGroupRow) continue;
      if (scheduleRowContractNo(row).toLowerCase() !== contractNo.toLowerCase()) continue;
      if (initialRentPM === "") {
        initialRentPM =
          pickScheduleRowField(row, "InitialRentPM", "initialRentPM") || initialRentPM;
      }
      if (initialRentPA === "") {
        initialRentPA =
          pickScheduleRowField(row, "InitialRentPA", "initialRentPA") || initialRentPA;
      }
      if (securityDepositAmount === "") {
        securityDepositAmount =
          pickScheduleRowField(row, "SecurityDepositAmount", "securityDepositAmount") ||
          securityDepositAmount;
      }
      if (initialRentPM !== "" && initialRentPA !== "" && securityDepositAmount !== "") break;
    }
  }

  return {
    ...rowData,
    InitialRentPM: initialRentPM !== "" ? initialRentPM : rowData.InitialRentPM,
    initialRentPM: initialRentPM !== "" ? initialRentPM : rowData.initialRentPM,
    InitialRentPA: initialRentPA !== "" ? initialRentPA : rowData.InitialRentPA,
    initialRentPA: initialRentPA !== "" ? initialRentPA : rowData.initialRentPA,
    SecurityDepositAmount:
      securityDepositAmount !== "" ? securityDepositAmount : rowData.SecurityDepositAmount,
    securityDepositAmount:
      securityDepositAmount !== "" ? securityDepositAmount : rowData.securityDepositAmount,
  };
}

function applyInvoiceLinesToForm(parentRow, lines, prevForm = {}) {
  const mainRow = findMainInvoiceScheduleRow(lines);
  const sourceRow = mainRow || parentRow || {};
  const fromSource = buildAgreementProvEditForm(sourceRow);
  const headerDescription =
    pickAgreementProvHeaderDescription(parentRow) || pickAgreementProvHeaderDescription(mainRow);
  const keptDescription = String(prevForm.description ?? "").trim();

  return mergeAgreementProvEditFormContractHeaderFields(
    {
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
      description: withAgreementProvParticularPrefix(
        keptDescription !== "" ? keptDescription : headerDescription
      ),
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
    },
    parentRow,
    mainRow
  );
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
  return {
    invoiceDate,
    dueDate,
    sortOrder: String(suggestNextInvoiceSortOrder(invoiceLinesRows || [])),
    itemCode: "",
    desc: "",
    accHead: resolveFinalizedInvoiceAccHead(parentRow, invoiceLinesRows),
    months: "",
    calculatedRentPM: "",
    discountPercent: "0",
    total: "",
    pendingSubInvoiceNo: suggestNextSubInvoiceNo(parentRow, parentForm, invoiceLinesRows || []),
  };
}

function buildDefaultMandatoryInvoiceLineDraft(parentForm, parentRow, invoiceLinesRows) {
  const scheduleLines = mergeAllDraftsIntoWorkingInvoiceLines(
    invoiceLinesRows || [],
    [],
    null,
    parentForm,
    parentRow
  );
  const base = buildEmptyDraftInvoiceAddForm(parentForm, parentRow, scheduleLines);
  return {
    ...base,
    discountPercent: "0",
    __draftId: createNewLineDraftId(),
    __isDefaultMandatory: true,
  };
}

function getInvoiceItemRecordRows(invoiceLinesRows) {
  return (invoiceLinesRows || []).filter((row) => !isMainInvoiceScheduleRow(row));
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
    discountRaw === "" || discountRaw == null
      ? "0"
      : sanitizeIntegerInputValue(String(discountRaw));
  const monthsStr =
    months === "" || months == null ? "" : sanitizeSignedIntegerInputValue(String(months));
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

function pickInvoiceLineDraftSubInvoiceNo(draftForm) {
  return String(draftForm?.pendingSubInvoiceNo ?? draftForm?.editingSubInvoiceNo ?? "").trim();
}

function isInvoiceLineSubInvoiceOneOptionalFields(draftForm) {
  if (draftForm?.__isDefaultMandatory) return true;
  return pickInvoiceLineDraftSubInvoiceNo(draftForm) === "1";
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
  const fields = [draft.itemCode, draft.desc, draft.accHead, draft.months, draft.calculatedRentPM];
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
  if (total === null || !Number.isFinite(total) || total === 0) {
    return "Total must be a non-zero amount.";
  }
  return "";
}

function validateInvoiceLineDraftForm(draftForm, parentForm) {
  const invoiceDate = String(draftForm?.invoiceDate || parentForm?.invoiceDate || "").trim();
  if (!invoiceDate) return "Invoice Date is required.";
  if (!isInvoiceLineSubInvoiceOneOptionalFields(draftForm)) {
    if (!isInvoiceLineDraftFieldFilled(draftForm?.itemCode)) {
      return "Item with Code is required.";
    }
    if (!isInvoiceLineDraftFieldFilled(draftForm?.accHead)) {
      return "Acc Head is required.";
    }
  }
  if (!isInvoiceLineDraftFieldFilled(draftForm?.desc)) {
    return "Particular is required.";
  }
  if (
    !isInvoiceLineDraftFieldFilled(draftForm?.months) ||
    String(draftForm?.months).trim() === "-"
  ) {
    return "Qty is required.";
  }
  const qty = Number(draftForm?.months);
  if (!Number.isFinite(qty) || qty === 0) {
    return "Qty must be a non-zero number.";
  }
  if (!isInvoiceLineDraftFieldFilled(draftForm?.calculatedRentPM)) {
    return "Unit Price is required.";
  }
  const sub = String(draftForm?.pendingSubInvoiceNo ?? draftForm?.editingSubInvoiceNo ?? "").trim();
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
  const discount = normalizeInvoiceLineDiscount(draftForm.discountPercent);
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
    PeriodEnd: resolveInvoiceLinePeriodEnd(invoiceDate, months),
    periodEnd: resolveInvoiceLinePeriodEnd(invoiceDate, months),
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
    const payload = {
      ...buildInvoiceScheduleCreatePayload(parentRow, parentForm, addForm),
      SubInvoiceNo: sub,
      subInvoiceNo: sub,
    };
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

function willPersistInvoiceItemLines({
  invoiceLines,
  pendingDeleteSubs,
  newLineDrafts,
  editingLineDraft,
}) {
  if ((pendingDeleteSubs || []).some((sub) => String(sub || "").trim())) return true;

  if (editingLineDraft && !isInvoiceLineDraftEmpty(editingLineDraft)) {
    if (pickInvoiceLineDraftSubInvoiceNo(editingLineDraft)) return true;
  }

  if (
    (newLineDrafts || []).some(
      (draft) => !isInvoiceLineDraftEmpty(draft) && pickInvoiceLineDraftSubInvoiceNo(draft)
    )
  ) {
    return true;
  }

  const existingItemRows = (invoiceLines || []).filter((r) => !isMainInvoiceScheduleRow(r));
  return existingItemRows.some((line) => {
    const sub = pickInvoiceLineSubInvoiceNo(line);
    if (!sub) return false;
    if (line.__isNewLocal) return true;
    return Boolean(line.__dirtyLocal);
  });
}

async function persistAllInvoiceScheduleLines({
  rowData,
  form,
  invoiceLines,
  pendingDeleteSubs,
  newLineDrafts,
  editingLineDraft,
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

  const persistingItemLines = willPersistInvoiceItemLines({
    invoiceLines,
    pendingDeleteSubs,
    newLineDrafts,
    editingLineDraft,
  });

  // Keep main invoice AmountReceivable in sync with the sum of item line totals.
  await contractApi.updateInvoiceSchedule(
    contractNo,
    invoiceNo,
    buildInvoiceSchedulePutPayload(rowData, form)
  );

  if (!persistingItemLines) {
    return;
  }

  const deleteSubs = [
    ...new Set((pendingDeleteSubs || []).map((s) => String(s).trim()).filter(Boolean)),
  ];
  for (const sub of deleteSubs) {
    await contractApi.deleteInvoiceSchedule(contractNo, invoiceNo, sub);
  }

  const persistedSubs = new Set();

  const persistLine = async (sub, addForm) => {
    const normalizedSub = String(sub || "").trim();
    if (!normalizedSub || persistedSubs.has(normalizedSub)) return;
    const payload = {
      ...buildInvoiceScheduleCreatePayload(rowData, form, addForm),
      SubInvoiceNo: normalizedSub,
      subInvoiceNo: normalizedSub,
    };
    const baselineKey = originalLinePayloadSnapshots?.get?.(normalizedSub);
    if (baselineKey && baselineKey === JSON.stringify(payload)) return;
    await contractApi.updateInvoiceScheduleSub(contractNo, invoiceNo, normalizedSub, payload);
    persistedSubs.add(normalizedSub);
  };

  for (const draft of newLineDrafts || []) {
    if (isInvoiceLineDraftEmpty(draft)) continue;
    const sub = pickInvoiceLineDraftSubInvoiceNo(draft);
    if (!sub) continue;
    await persistLine(sub, buildInvoiceLinePersistSourceFromDraft(draft, form, rowData));
  }

  if (editingLineDraft && !isInvoiceLineDraftEmpty(editingLineDraft)) {
    const sub = pickInvoiceLineDraftSubInvoiceNo(editingLineDraft);
    if (sub) {
      await persistLine(
        sub,
        buildInvoiceLinePersistSourceFromDraft(editingLineDraft, form, rowData)
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
    await persistLine(sub, addForm);
  }
}

function buildDraftInvoiceEditFormFromLine(lineRow, parentForm, parentRow, lineKey) {
  const months = pickScheduleRowField(lineRow, "Months", "months");
  const calculatedRentPM = pickScheduleRowField(lineRow, "CalculatedRentPM", "calculatedRentPM");
  const discountRaw =
    pickScheduleRowField(lineRow, "Discount", "discount") ||
    pickScheduleRowField(lineRow, "DiscountPercent", "discountPercent");
  const discountPercent =
    discountRaw === "" || discountRaw == null
      ? "0"
      : sanitizeIntegerInputValue(String(discountRaw));
  const monthsStr =
    months === "" || months == null ? "" : sanitizeSignedIntegerInputValue(String(months));
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

function unwrapProductListResponse(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function isActiveProductServiceStatus(status) {
  return (
    String(status || "Active")
      .trim()
      .toLowerCase() !== "inactive"
  );
}

function getInvoiceProductServiceOptionLabel(option) {
  if (!option) return "";
  const code = String(option.itemCode || "").trim();
  const name = String(option.itemName || "").trim();
  const uom = String(option.uomLabel || option.uom || "").trim();
  return [code, name, uom].filter((part) => part && part !== "-").join(" — ");
}

function buildActiveProductServiceOptions(serviceRows, uomLookup = {}) {
  return (serviceRows || [])
    .map(normalizeServiceRecord)
    .filter((row) => row?.id != null && isActiveProductServiceStatus(row.status))
    .map((row) => {
      const uomRaw = String(row.uom || "").trim();
      const uomLabel = uomRaw ? formatProductUomLabel(uomRaw, uomLookup) : "";
      return {
        ...row,
        uomLabel: uomLabel && uomLabel !== "-" ? uomLabel : uomRaw,
        label: getInvoiceProductServiceOptionLabel({
          itemCode: row.itemCode,
          itemName: row.itemName,
          uomLabel: uomLabel && uomLabel !== "-" ? uomLabel : uomRaw,
        }),
      };
    })
    .filter((row) => Boolean(String(row.itemCode || "").trim()))
    .sort((a, b) =>
      getInvoiceProductServiceOptionLabel(a).localeCompare(
        getInvoiceProductServiceOptionLabel(b),
        undefined,
        { sensitivity: "base" }
      )
    );
}

function findInvoiceProductServiceOption(options, itemCode) {
  const code = String(itemCode || "")
    .trim()
    .toUpperCase();
  if (!code) return null;
  return (
    (options || []).find(
      (option) =>
        String(option?.itemCode || "")
          .trim()
          .toUpperCase() === code
    ) || null
  );
}

function AgreementProvInvoiceLineDraftRow({
  gridRowSx,
  bodyCellSx,
  draftForm,
  productServiceOptions,
  onDraftFieldChange,
  onDraftItemServiceChange,
  onDraftAccHeadChange,
  onDraftIntegerFieldChange,
  onDraftNumericFieldChange,
  onDraftCancel,
  onDuplicateLine,
  hasIncompleteNewLineDrafts,
  disableCancel,
  saving,
}) {
  const subLabel = draftForm.pendingSubInvoiceNo || "—";
  const serviceOptions = productServiceOptions || [];
  const selectedService = findInvoiceProductServiceOption(serviceOptions, draftForm.itemCode);
  const linkedAccHead = resolveItemWithCodeAccHead(selectedService);
  const currentAccHead = String(draftForm.accHead || linkedAccHead || "").trim();
  const accHeadOptions = buildInvoiceAccHeadOptions(serviceOptions, currentAccHead);
  const selectedAccHeadOption =
    accHeadOptions.find(
      (option) =>
        normalizeInvoiceAccHeadKey(option.value) === normalizeInvoiceAccHeadKey(currentAccHead)
    ) || null;
  const itemCodeOptions =
    selectedService || !String(draftForm.itemCode || "").trim()
      ? serviceOptions
      : [
          {
            id: `saved:${draftForm.itemCode}`,
            itemCode: String(draftForm.itemCode).trim(),
            itemName: "",
            uom: "",
            uomLabel: "",
            label: String(draftForm.itemCode).trim(),
          },
          ...serviceOptions,
        ];

  useEffect(() => {
    if (!linkedAccHead) return;
    if (String(draftForm.accHead || "").trim() === linkedAccHead) return;
    onDraftFieldChange?.("accHead")?.({ target: { value: linkedAccHead } });
  }, [linkedAccHead, draftForm.accHead, onDraftFieldChange]);

  return (
    <MDBox
      sx={{
        ...gridRowSx,
        bgcolor: "rgba(25, 118, 210, 0.06)",
        "& > *": { borderBottom: "1px solid rgba(0,0,0,0.08)" },
      }}
    >
      <MDBox sx={{ ...bodyCellSx, px: 0.5, py: 0.5, textAlign: "left", fontWeight: 600 }}>
        {draftForm.sortOrder || "1"}
      </MDBox>
      <MDBox
        sx={{
          ...bodyCellSx,
          px: 0.5,
          py: 0.5,
          textAlign: "left",
          fontWeight: 600,
          color: subLabel !== "—" ? "text.primary" : "text.secondary",
        }}
      >
        {subLabel}
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        <Autocomplete
          size="small"
          fullWidth
          options={itemCodeOptions}
          value={
            selectedService ||
            findInvoiceProductServiceOption(itemCodeOptions, draftForm.itemCode) ||
            null
          }
          getOptionLabel={getInvoiceProductServiceOptionLabel}
          isOptionEqualToValue={(a, b) =>
            String(a?.itemCode || "")
              .trim()
              .toUpperCase() ===
            String(b?.itemCode || "")
              .trim()
              .toUpperCase()
          }
          onChange={(_, newValue) => onDraftItemServiceChange?.(newValue)}
          renderOption={(props, option) => (
            <li {...props} key={option.id ?? option.itemCode}>
              <MDTypography
                component="span"
                variant="caption"
                sx={{
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: "0.8125rem",
                }}
              >
                {getInvoiceProductServiceOptionLabel(option)}
              </MDTypography>
            </li>
          )}
          renderInput={(params) => (
            <MDInput
              {...params}
              placeholder="Item Code — Name — UoM"
              sx={invoiceLineDraftInputSx}
            />
          )}
        />
      </MDBox>
      <MDBox
        sx={{ ...bodyCellSx, textAlign: "left", px: 0.5, py: 0.5, minWidth: 0, overflow: "hidden" }}
      >
        <MDInput
          value={draftForm.desc ?? ""}
          onChange={onDraftFieldChange("desc")}
          fullWidth
          size="small"
          placeholder="Particular"
          title={draftForm.desc || undefined}
          sx={{
            ...invoiceLineDraftInputSx,
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            "& .MuiInputBase-root": {
              fontSize: "0.8125rem",
              minHeight: 30,
              width: "100%",
              maxWidth: "100%",
            },
            "& .MuiInputBase-input": {
              py: 0.5,
              px: 0.75,
              overflow: "hidden",
              textOverflow: "ellipsis",
            },
          }}
        />
      </MDBox>
      <MDBox
        sx={{ ...bodyCellSx, textAlign: "left", px: 0.5, py: 0.5, minWidth: 0, overflow: "hidden" }}
      >
        <Autocomplete
          size="small"
          fullWidth
          options={accHeadOptions}
          value={selectedAccHeadOption}
          getOptionLabel={(option) => String(option?.label || option?.value || "").trim()}
          isOptionEqualToValue={(a, b) =>
            normalizeInvoiceAccHeadKey(a?.value ?? a) === normalizeInvoiceAccHeadKey(b?.value ?? b)
          }
          onChange={(_, newValue) =>
            onDraftAccHeadChange?.(String(newValue?.value || newValue || "").trim())
          }
          renderOption={(props, option) => (
            <li {...props} key={option.value}>
              <MDTypography
                component="span"
                variant="caption"
                sx={{
                  display: "block",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontSize: "0.8125rem",
                }}
                title={option.label}
              >
                {option.label}
              </MDTypography>
            </li>
          )}
          renderInput={(params) => (
            <MDInput
              {...params}
              placeholder="Acc Head"
              title={currentAccHead || undefined}
              sx={invoiceLineDraftInputSx}
            />
          )}
        />
      </MDBox>
      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "right",
          px: 0.5,
          py: 0.5,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        <MDInput
          value={draftForm.months ?? ""}
          onChange={onDraftIntegerFieldChange("months")}
          fullWidth
          size="small"
          placeholder="Qty"
          inputProps={{ inputMode: "text", pattern: "-?[0-9]*" }}
          sx={{
            ...invoiceLineDraftInputSx,
            width: "100%",
            minWidth: 0,
            maxWidth: "100%",
            "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30, width: "100%" },
            "& .MuiInputBase-input": { py: 0.5, px: 0.5, textAlign: "right" },
          }}
        />
      </MDBox>
      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "right",
          px: 0.5,
          py: 0.5,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.5,
          overflow: "hidden",
        }}
      >
        <MDInput
          value={draftForm.calculatedRentPM ?? ""}
          onChange={onDraftNumericFieldChange("calculatedRentPM")}
          size="small"
          placeholder="Unit Price"
          inputProps={{ inputMode: "decimal" }}
          sx={{
            ...invoiceLineDraftInputSx,
            flex: "1 1 auto",
            width: "auto",
            minWidth: 0,
            maxWidth: "100%",
            "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30, width: "100%" },
            "& .MuiInputBase-input": { py: 0.5, px: 0.5, textAlign: "right" },
          }}
        />
        <MDTypography
          component="span"
          variant="caption"
          color="text"
          sx={{
            flex: "0 0 auto",
            maxWidth: "42%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: "0.75rem",
            lineHeight: 1.2,
            textAlign: "left",
          }}
          title={
            String(selectedService?.uomLabel || selectedService?.uom || "").trim() || undefined
          }
        >
          {String(selectedService?.uomLabel || selectedService?.uom || "").trim() || "—"}
        </MDTypography>
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "center", p: 0.5, minWidth: 0, overflow: "hidden" }}>
        <MDInput
          value={draftForm.discountPercent ?? ""}
          onChange={onDraftIntegerFieldChange("discountPercent")}
          fullWidth
          size="small"
          placeholder="Disc %"
          inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
          sx={{
            ...invoiceLineDraftInputSx,
            width: "100%",
            minWidth: 0,
            "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30, width: "100%" },
            "& .MuiInputBase-input": { py: 0.5, px: 0.35, textAlign: "center" },
          }}
        />
      </MDBox>
      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          overflow: "visible",
          textOverflow: "clip",
          whiteSpace: "nowrap",
          px: 0.75,
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
          gap: 0.15,
          px: 0.25,
        }}
      >
        <Tooltip title="Duplicate">
          <span>
            <IconButton
              size="small"
              color="secondary"
              disabled={saving || hasIncompleteNewLineDrafts}
              onClick={() => onDuplicateLine?.(draftForm)}
              sx={INVOICE_LINE_ACTION_BUTTON_SX}
            >
              <Icon sx={INVOICE_LINE_ACTION_ICON_SX}>content_copy</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Cancel">
          <span>
            <IconButton
              size="small"
              color="secondary"
              disabled={saving || disableCancel}
              onClick={onDraftCancel}
              sx={INVOICE_LINE_ACTION_BUTTON_SX}
            >
              <Icon sx={INVOICE_LINE_ACTION_ICON_SX}>close</Icon>
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
  productServiceOptions: PropTypes.arrayOf(PropTypes.object),
  onDraftFieldChange: PropTypes.func.isRequired,
  onDraftItemServiceChange: PropTypes.func,
  onDraftAccHeadChange: PropTypes.func,
  onDraftIntegerFieldChange: PropTypes.func.isRequired,
  onDraftNumericFieldChange: PropTypes.func.isRequired,
  onDraftCancel: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func,
  hasIncompleteNewLineDrafts: PropTypes.bool,
  disableCancel: PropTypes.bool,
  saving: PropTypes.bool,
};

AgreementProvInvoiceLineDraftRow.defaultProps = {
  productServiceOptions: [],
  onDraftItemServiceChange: undefined,
  onDraftAccHeadChange: undefined,
  onDuplicateLine: undefined,
  hasIncompleteNewLineDrafts: false,
  disableCancel: false,
  saving: false,
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
  productServiceOptions,
  onDraftFieldChange,
  onDraftItemServiceChange,
  onDraftAccHeadChange,
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
    minWidth: INVOICE_LINES_GRID_MIN_WIDTH,
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

  const getInvoiceLineColumnCellSx = (col, variant = "body") => {
    const base = variant === "header" ? headerCellSx : bodyCellSx;
    const isTotalCol = col.camel === "total";
    return {
      ...base,
      textAlign: col.align === "right" ? "right" : col.align === "center" ? "center" : "left",
      ...(col.compact ? { px: 0.5, py: 0.5 } : {}),
      ...(col.wide || col.showFull
        ? {
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }
        : {}),
      ...(isTotalCol
        ? {
            overflow: "visible",
            textOverflow: "clip",
            whiteSpace: "nowrap",
            minWidth: 0,
          }
        : {}),
      ...(col.numeric && variant === "body" ? { fontVariantNumeric: "tabular-nums" } : {}),
    };
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

  const linesScrollSx = fillHeight
    ? { flex: "1 1 0", minHeight: 0, overflowX: "auto", overflowY: "auto" }
    : { maxHeight: 240, overflowX: "auto", overflowY: "auto" };

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
      <MDBox sx={{ ...linesScrollSx, minWidth: 0 }}>
        <MDBox
          sx={{
            width: "100%",
            minWidth: INVOICE_LINES_GRID_MIN_WIDTH,
          }}
        >
          <MDBox sx={gridRowSx}>
            {EDIT_INVOICE_LINES_TABLE_COLUMNS.map((col) => (
              <MDBox key={col.camel} sx={getInvoiceLineColumnCellSx(col, "header")}>
                {col.label}
              </MDBox>
            ))}
            {!readOnly && <MDBox sx={{ ...headerCellSx, textAlign: "center" }}>Action</MDBox>}
          </MDBox>

          {!readOnly &&
            pendingNewDrafts.map((draftForm) => (
              <AgreementProvInvoiceLineDraftRow
                key={draftForm.__draftId || draftForm.pendingSubInvoiceNo}
                gridRowSx={gridRowSx}
                bodyCellSx={bodyCellSx}
                draftForm={draftForm}
                productServiceOptions={productServiceOptions}
                onDraftFieldChange={onDraftFieldChange(draftForm.__draftId)}
                onDraftItemServiceChange={onDraftItemServiceChange?.(draftForm.__draftId)}
                onDraftAccHeadChange={onDraftAccHeadChange?.(draftForm.__draftId)}
                onDraftIntegerFieldChange={onDraftIntegerFieldChange(draftForm.__draftId)}
                onDraftNumericFieldChange={onDraftNumericFieldChange(draftForm.__draftId)}
                onDraftCancel={() => onDraftCancel?.(draftForm.__draftId)}
                onDuplicateLine={onDuplicateLine}
                hasIncompleteNewLineDrafts={hasIncompleteNewLineDrafts}
                disableCancel={Boolean(draftForm.__isDefaultMandatory)}
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
                    productServiceOptions={productServiceOptions}
                    onDraftFieldChange={onDraftFieldChange(editDraftId)}
                    onDraftItemServiceChange={onDraftItemServiceChange?.(editDraftId)}
                    onDraftAccHeadChange={onDraftAccHeadChange?.(editDraftId)}
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
                  {EDIT_INVOICE_LINES_TABLE_COLUMNS.map((col) => {
                    const cellValue = formatEditInvoiceLineCellValue(
                      lineRow,
                      col,
                      productServiceOptions
                    );
                    const fullText = cellValue && cellValue !== "—" ? String(cellValue) : undefined;
                    return (
                      <MDBox
                        key={col.camel}
                        sx={getInvoiceLineColumnCellSx(col, "body")}
                        title={
                          (col.camel === "itemwithCode" || col.showFull) && fullText
                            ? fullText
                            : undefined
                        }
                      >
                        {cellValue}
                      </MDBox>
                    );
                  })}
                  {!readOnly && (
                    <MDBox
                      sx={{
                        ...bodyCellSx,
                        textAlign: "center",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 0.1,
                        px: 0.25,
                      }}
                    >
                      <MDBox
                        sx={{
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          lineHeight: 0,
                          "& > span": { display: "flex", height: 14 },
                        }}
                      >
                        <Tooltip title="Move up">
                          <span>
                            <IconButton
                              size="small"
                              color="info"
                              disabled={!canMoveUp || saving || Boolean(editingLineDraft)}
                              onClick={() => onMoveLine?.(lineRow, "up")}
                              sx={{ ...INVOICE_LINE_ACTION_BUTTON_SX, height: 14, minHeight: 14 }}
                            >
                              <Icon sx={INVOICE_LINE_ACTION_ICON_SX}>keyboard_arrow_up</Icon>
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
                              sx={{ ...INVOICE_LINE_ACTION_BUTTON_SX, height: 14, minHeight: 14 }}
                            >
                              <Icon sx={INVOICE_LINE_ACTION_ICON_SX}>keyboard_arrow_down</Icon>
                            </IconButton>
                          </span>
                        </Tooltip>
                      </MDBox>
                      <Tooltip title="Edit">
                        <span>
                          <IconButton
                            size="small"
                            color="info"
                            disabled={saving || Boolean(editingLineDraft)}
                            onClick={() => onEditLine?.(lineRow, lineKey)}
                            sx={INVOICE_LINE_ACTION_BUTTON_SX}
                          >
                            <Icon sx={INVOICE_LINE_ACTION_ICON_SX}>edit</Icon>
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
                            sx={INVOICE_LINE_ACTION_BUTTON_SX}
                          >
                            <Icon sx={INVOICE_LINE_ACTION_ICON_SX}>content_copy</Icon>
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
                            sx={INVOICE_LINE_ACTION_BUTTON_SX}
                          >
                            <Icon sx={INVOICE_LINE_ACTION_ICON_SX}>delete</Icon>
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
  productServiceOptions: PropTypes.arrayOf(PropTypes.object),
  onDraftFieldChange: PropTypes.func,
  onDraftItemServiceChange: PropTypes.func,
  onDraftAccHeadChange: PropTypes.func,
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

const AGREEMENT_PROV_INVOICE_STATUS_PALETTES = {
  unpaid: { bg: "#f8d7da", fg: "#721c24", outline: "#f5c6cb" },
  "full paid": { bg: "#d4edda", fg: "#155724", outline: "#c3e6cb" },
  "partial paid": { bg: "#cfe2ff", fg: "#084298", outline: "#b6d4fe" },
  "over paid": { bg: "#ffe0b2", fg: "#e65100", outline: "#ffcc80" },
  "over due": { bg: "#f8d7da", fg: "#721c24", outline: "#f5c6cb" },
  "coming due": { bg: "#fff9c4", fg: "#f57f17", outline: "#fff59d" },
};

function resolveAgreementProvInvoiceStatusKey(raw) {
  const key = normalizeAgreementProvInvoiceStatusKey(raw);
  if (!key) return "";
  if (key === "paid") return "full paid";
  if (key === "partial") return "partial paid";
  if (key === "overdue") return "over due";
  if (key === "overpaid") return "over paid";
  return key;
}

function agreementProvInvoiceStatusBadgePalette(raw) {
  const key = resolveAgreementProvInvoiceStatusKey(raw);
  return AGREEMENT_PROV_INVOICE_STATUS_PALETTES[key] || null;
}

/** Single-word label for PDF invoice status watermark. */
function getAgreementProvPdfInvoiceStatusWatermarkWord(raw) {
  const key = resolveAgreementProvInvoiceStatusKey(raw);
  if (!key) return "";
  const words = {
    unpaid: "Unpaid",
    "full paid": "FullPaid",
    "partial paid": "PartialPaid",
    "over paid": "OverPaid",
    "over due": "OverDue",
    "coming due": "ComingDue",
  };
  return words[key] || "";
}

function drawAgreementProvPdfInvoiceStatusWatermark(doc, statusWord, pageWidth, pageHeight) {
  const text = String(statusWord || "").trim();
  if (!text) return;

  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;

  doc.saveGraphicsState();
  try {
    if (typeof doc.GState === "function") {
      doc.setGState(new doc.GState({ opacity: 0.5 }));
    }
  } catch {
    // GState may be unavailable in some environments.
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(64);
  doc.setTextColor(160, 160, 160);
  doc.text(text, centerX, centerY, {
    align: "center",
    baseline: "middle",
    angle: 45,
  });

  doc.restoreGraphicsState();
  doc.setTextColor(0, 0, 0);
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

function formatInvoiceItemWithCodeDisplay(rawCode, productServiceOptions = []) {
  const raw = String(rawCode ?? "").trim();
  if (!raw) return "—";
  const matched = findInvoiceProductServiceOption(productServiceOptions, raw);
  if (matched) {
    const label = getInvoiceProductServiceOptionLabel(matched);
    if (label) return label;
  }
  return raw;
}

function formatEditInvoiceLineCellValue(lineRow, col, productServiceOptions = []) {
  if (col.camel === "subInvoiceNo") {
    const sub = pickInvoiceLineSubInvoiceNo(lineRow);
    return sub || "—";
  }
  if (col.camel === "itemwithCode") {
    const raw =
      pickScheduleRowField(lineRow, "ItemwithCode", "itemwithCode") ||
      pickScheduleRowField(lineRow, "ItemCode", "itemCode");
    return formatInvoiceItemWithCodeDisplay(raw, productServiceOptions);
  }
  if (col.camel === "description") {
    const raw =
      pickScheduleRowField(lineRow, "Description", "description") ||
      pickScheduleRowField(lineRow, "Desc", "desc");
    return raw === "" ? "—" : String(raw);
  }
  if (col.camel === "calculatedRentPM") {
    const raw = pickScheduleRowField(lineRow, "CalculatedRentPM", "calculatedRentPM");
    const price = raw === "" ? "—" : formatScheduleGridNumber(raw);
    const itemCode =
      pickScheduleRowField(lineRow, "ItemwithCode", "itemwithCode") ||
      pickScheduleRowField(lineRow, "ItemCode", "itemCode");
    const matched = findInvoiceProductServiceOption(productServiceOptions, itemCode);
    const uom = String(matched?.uomLabel || matched?.uom || "").trim();
    if (!uom) return price;
    return price === "—" ? uom : `${price} ${uom}`;
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
  // Period length uses |Qty| so negative (credit) qty still yields a valid PeriodEnd for the API.
  if (!Number.isFinite(n) || n === 0) return "";
  const spanMonths = Math.abs(n);
  try {
    const parsed = parseISO(String(periodStart).trim());
    if (!isValid(parsed)) return "";
    // Inclusive period: 01-Jul-2024 + 1 month => 31-Jul-2024 (not 01-Aug-2024).
    return format(addDays(addMonths(parsed, spanMonths), -1), "yyyy-MM-dd");
  } catch {
    return "";
  }
}

/** Always returns a yyyy-MM-dd (or null) suitable for non-nullable API PeriodEnd. */
function resolveInvoiceLinePeriodEnd(periodStart, months, fallbackPeriodEnd = null) {
  const computed = periodEndFromStartAndMonths(periodStart, months);
  if (computed) return computed;
  const fallback = toScheduleDateInputValue(fallbackPeriodEnd);
  if (fallback) return fallback;
  return toScheduleDateInputValue(periodStart) || null;
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
    description: withAgreementProvParticularPrefix(periodText === "—" ? "" : periodText),
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
  contentScale: 1,
};

/** Selectable PDF body columns. Total is always shown and is not listed here. */
const AGREEMENT_PROV_PDF_SELECTABLE_COLUMNS = [
  { key: "subInvoiceNo", label: "Sub Invoice" },
  { key: "itemWithCode", label: "Item with Code" },
  { key: "particular", label: "Particular" },
  { key: "accHead", label: "Acc Head" },
  { key: "qty", label: "Qty" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "discount", label: "Disc" },
];

const AGREEMENT_PROV_PDF_DEFAULT_COLUMN_KEYS = ["particular", "qty", "unitPrice"];

function createDefaultAgreementProvPdfColumnKeys() {
  return new Set(AGREEMENT_PROV_PDF_DEFAULT_COLUMN_KEYS);
}

function countPdfAmountIntegerDigits(value) {
  const n = Math.abs(Math.trunc(Number(String(value ?? "").replace(/,/g, "")) || 0));
  return String(n).length;
}

const AGREEMENT_PROV_PDF_RIGHT_COLUMN_KEYS = new Set(["qty", "unitPrice", "discount", "total"]);

const AGREEMENT_PROV_PDF_COLUMN_BASE_WIDTH_MM = {
  subInvoiceNo: 16,
  itemWithCode: 34,
  particular: 40,
  accHead: 28,
  qty: 14,
  unitPrice: 28,
  discount: 14,
};

/**
 * Build body-table column geometry. Total is always included.
 * When totals exceed 5 integer digits, Total gets extra reserved width.
 */
function buildAgreementProvPdfBodyColumns({
  contentWidth,
  marginLeft,
  selectedKeys,
  maxTotalValue,
  doc,
  bodyFontSize,
}) {
  const selected = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || []);
  const orderedKeys = [
    ...AGREEMENT_PROV_PDF_SELECTABLE_COLUMNS.map((c) => c.key).filter((key) => selected.has(key)),
    "total",
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(bodyFontSize);
  const totalSample = formatPdfCurrency(maxTotalValue);
  const totalTextWidth = Math.max(doc.getTextWidth(String(totalSample)), 1);
  const totalDigits = countPdfAmountIntegerDigits(maxTotalValue);
  const totalMinWidth = totalDigits > 5 ? 36 : 22;
  const totalWidth = Math.max(totalTextWidth + 4, totalMinWidth);

  const fixedKeys = orderedKeys.filter((key) => key !== "particular");
  let fixedSum = 0;
  fixedKeys.forEach((key) => {
    if (key === "total") {
      fixedSum += totalWidth;
      return;
    }
    fixedSum += AGREEMENT_PROV_PDF_COLUMN_BASE_WIDTH_MM[key] || 20;
  });

  const hasParticular = orderedKeys.includes("particular");
  let particularWidth = hasParticular ? Math.max(contentWidth - fixedSum, 28) : 0;
  let leftover = hasParticular ? 0 : Math.max(contentWidth - fixedSum, 0);

  if (leftover > 0) {
    const expandKey =
      orderedKeys.find(
        (key) => key !== "total" && !AGREEMENT_PROV_PDF_RIGHT_COLUMN_KEYS.has(key)
      ) || orderedKeys.find((key) => key !== "total");
    if (expandKey === "particular") {
      particularWidth += leftover;
      leftover = 0;
    }
  }

  const cols = [];
  let x = marginLeft;
  orderedKeys.forEach((key) => {
    const meta =
      key === "total"
        ? { key: "total", label: "Total" }
        : AGREEMENT_PROV_PDF_SELECTABLE_COLUMNS.find((c) => c.key === key);
    let width =
      key === "particular"
        ? particularWidth
        : key === "total"
        ? totalWidth
        : AGREEMENT_PROV_PDF_COLUMN_BASE_WIDTH_MM[key] || 20;
    if (leftover > 0 && key !== "total" && !AGREEMENT_PROV_PDF_RIGHT_COLUMN_KEYS.has(key)) {
      width += leftover;
      leftover = 0;
    } else if (
      leftover > 0 &&
      key !== "total" &&
      orderedKeys.every((k) => k === "total" || AGREEMENT_PROV_PDF_RIGHT_COLUMN_KEYS.has(k)) &&
      key === orderedKeys[0]
    ) {
      width += leftover;
      leftover = 0;
    }
    const align = AGREEMENT_PROV_PDF_RIGHT_COLUMN_KEYS.has(key) ? "right" : "left";
    cols.push({
      key,
      label: meta?.label || key,
      left: x,
      width,
      textX: align === "right" ? x + width : x,
      align,
    });
    x += width;
  });

  return cols;
}

function getAgreementProvPdfLineCellValues(lineRow, productServiceOptions = []) {
  const itemWithCode = String(
    pickScheduleRowField(lineRow, "ItemwithCode", "itemwithCode") ||
      pickScheduleRowField(lineRow, "ItemCode", "itemCode") ||
      ""
  ).trim();
  const particularText = withAgreementProvParticularPrefix(
    pickScheduleRowField(lineRow, "Description", "description") ||
      pickScheduleRowField(lineRow, "Desc", "desc") ||
      itemWithCode ||
      ""
  );
  const accHead = String(pickScheduleRowField(lineRow, "AccHead", "accHead") || "").trim();
  const qty = pickScheduleRowField(lineRow, "Months", "months");
  const unitPrice = pickScheduleRowField(lineRow, "CalculatedRentPM", "calculatedRentPM");
  const discountRaw =
    pickScheduleRowField(lineRow, "Discount", "discount") ||
    pickScheduleRowField(lineRow, "DiscountPercent", "discountPercent");
  const discount =
    discountRaw === null || discountRaw === undefined || discountRaw === ""
      ? ""
      : String(discountRaw);
  const lineTotal = pickInvoiceLineTotalNumeric(lineRow);

  return {
    subInvoiceNo: pickInvoiceLineSubInvoiceNo(lineRow) || "—",
    itemWithCode: itemWithCode || "—",
    particular: particularText || "—",
    accHead: accHead || "—",
    qty: qty === null || qty === undefined || qty === "" ? "—" : String(qty),
    unitPrice: formatPdfUnitPriceWithUom(unitPrice, lineRow, productServiceOptions),
    discount: discount === "" ? "—" : discount,
    total: lineTotal,
  };
}

const AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN = 0.5;
const AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX = 1.5;
const AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP = 0.05;
const AGREEMENT_PROV_PDF_FONT_TITLE = 18;
const AGREEMENT_PROV_PDF_FONT_BODY = 10;
const AGREEMENT_PROV_PDF_LINE_HEIGHT_MM = 5;

function agreementProvInchesToMm(inches) {
  const n = Number(inches);
  return Number.isFinite(n) ? n * 25.4 : 0;
}

function normalizeAgreementProvPdfContentScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return AGREEMENT_PROV_PDF_DEFAULT_MARGINS.contentScale;
  const clamped = Math.min(
    AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX,
    Math.max(AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN, n)
  );
  return Math.round(clamped * 100) / 100;
}

function formatAgreementProvPdfContentScalePercent(contentScale) {
  return `${Math.round(normalizeAgreementProvPdfContentScale(contentScale) * 100)}%`;
}

function createAgreementProvPdfScaleHelpers({
  contentScale,
  marginLeft,
  marginTop,
  pageHeight,
  marginBottom,
}) {
  const scale = normalizeAgreementProvPdfContentScale(contentScale);
  const scaleFromOrigin = (value, origin) => origin + (value - origin) * scale;

  return {
    contentScale: scale,
    sx: (x) => scaleFromOrigin(x, marginLeft),
    sy: (y) => scaleFromOrigin(y, marginTop),
    sf: (pt) => pt * scale,
    sc: (mm) => mm * scale,
    logicalPageBottomY: marginTop + (pageHeight - marginBottom - marginTop) / scale,
    logicalPageBottomReserve: 20 / scale,
  };
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
      contentScale: normalizeAgreementProvPdfContentScale(parsed?.contentScale),
    };
  } catch {
    return { ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS };
  }
}

function saveAgreementProvPdfMargins(margins) {
  try {
    localStorage.setItem(
      AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY,
      JSON.stringify({
        topIn: Number(margins?.topIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.topIn,
        bottomIn: Number(margins?.bottomIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.bottomIn,
        leftIn: Number(margins?.leftIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.leftIn,
        rightIn: Number(margins?.rightIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.rightIn,
        contentScale: normalizeAgreementProvPdfContentScale(margins?.contentScale),
      })
    );
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

const AGREEMENT_PROV_PDF_VALUE_UNDERLINE_GAP_MM = 0.75;

function getPdfRowCenteredBaselineY(rowTop, rowBandHeight, textHeight) {
  return rowTop + (rowBandHeight + textHeight) / 2 - textHeight * 0.12;
}

/** Place underline slightly below the rendered text baseline (not through glyph bottoms). */
function getPdfValueUnderlineY(baselineY, textHeight, scaleLength = (mm) => mm) {
  return baselineY + textHeight * 0.32 + scaleLength(AGREEMENT_PROV_PDF_VALUE_UNDERLINE_GAP_MM);
}

function resolveSingleLinePdfFontSize(
  doc,
  text,
  maxWidth,
  startSize,
  minSize,
  fontStyle = "normal"
) {
  let size = startSize;
  const value = String(text ?? "");
  doc.setFont("helvetica", fontStyle);
  while (size > minSize) {
    doc.setFontSize(size);
    if (doc.getTextWidth(value) <= maxWidth) return size;
    size -= 0.5;
  }
  doc.setFontSize(minSize);
  return minSize;
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

function sumInvoiceItemRecordTotals(lines) {
  return getInvoiceItemRecordRows(lines).reduce(
    (sum, row) => sum + pickInvoiceLineTotalNumeric(row),
    0
  );
}

function formatPdfUnitPriceWithUom(unitPrice, lineRow, productServiceOptions = []) {
  const priceText = formatPdfCurrency(unitPrice);
  const itemCode =
    pickScheduleRowField(lineRow, "ItemwithCode", "itemwithCode") ||
    pickScheduleRowField(lineRow, "ItemCode", "itemCode");
  const matched = findInvoiceProductServiceOption(productServiceOptions, itemCode);
  const uom = String(matched?.uomLabel || matched?.uom || "").trim();
  return uom ? `${priceText} ${uom}` : priceText;
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
  const periodEnd = resolveInvoiceLinePeriodEnd(
    periodStart,
    months,
    pickScheduleRowField(src, "PeriodEnd", "periodEnd") || parentForm?.periodEnd
  );
  const calculatedRentPM = toScheduleNumberOrNull(
    src.calculatedRentPM ?? pickScheduleRowField(src, "CalculatedRentPM", "calculatedRentPM")
  );
  const discountRaw =
    src.discountPercent ??
    pickScheduleRowField(src, "DiscountPercent", "discountPercent") ??
    pickScheduleRowField(src, "Discount", "discount");
  const discount = normalizeInvoiceLineDiscount(discountRaw);
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
      discount
    );
  const totalRent =
    toScheduleNumberOrNull(pickScheduleRowField(src, "TotalRent", "totalRent") ?? src.totalRent) ??
    lineTotal;
  const subInvoiceNo = String(
    src.pendingSubInvoiceNo ??
      src.editingSubInvoiceNo ??
      pickScheduleRowField(src, "SubInvoiceNo", "subInvoiceNo") ??
      ""
  ).trim();

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
    SubInvoiceNo: subInvoiceNo || null,
    subInvoiceNo: subInvoiceNo || null,
    PeriodStart: periodStart,
    PeriodEnd: periodEnd || toScheduleDateInputValue(periodStart) || periodStart,
    DueDate:
      src.dueDate || pickScheduleRowField(src, "DueDate", "dueDate") || parentForm?.dueDate || null,
    CalculatedRentPM: calculatedRentPM,
    Months: months,
    TotalRent: totalRent,
    ItemwithCode: itemCode || null,
    Description: desc || null,
    AccHead: accHead || null,
    Discount: discount,
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

function normalizeInvoiceLineDiscount(value) {
  return toScheduleIntOrNull(value) ?? 0;
}

function sanitizeIntegerInputValue(raw) {
  const s = String(raw ?? "");
  if (s === "") return "";
  return s.replace(/\D/g, "");
}

/** Allows optional leading minus for Qty (credit / adjustment lines). */
function sanitizeSignedIntegerInputValue(raw) {
  const s = String(raw ?? "");
  if (s === "" || s === "-") return s;
  const negative = s.trimStart().startsWith("-");
  const digits = s.replace(/\D/g, "");
  if (!digits) return negative ? "-" : "";
  return negative ? `-${digits}` : digits;
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
    Description: withAgreementProvParticularPrefix(form.description),
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

const EDIT_INVOICE_HEADER_ROW_SX = {
  display: "flex",
  flexWrap: { xs: "wrap", lg: "nowrap" },
  gap: { xs: 1.25, lg: 1 },
  mt: 0.75,
  alignItems: "flex-start",
  width: "100%",
};

const EDIT_INVOICE_HEADER_COMPACT_GROUP_SX = {
  display: "flex",
  flexWrap: { xs: "wrap", sm: "nowrap" },
  gap: 0.75,
  flexShrink: 0,
  alignItems: "flex-start",
};

const EDIT_INVOICE_HEADER_INVOICE_NO_SX = {
  flex: "0 0 auto",
  width: { xs: "100%", sm: 128 },
  maxWidth: { sm: 128 },
};

const EDIT_INVOICE_HEADER_DATE_SX = {
  flex: "0 0 auto",
  width: { xs: "100%", sm: 142 },
  maxWidth: { sm: 142 },
};

const EDIT_INVOICE_HEADER_DESCRIPTION_SX = {
  flex: "1 1 0",
  minWidth: { xs: "100%", lg: 200 },
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

function getAgreementProvEditDialogReadonlyBasicInfoItems(form, headerRow) {
  const f = mergeAgreementProvEditFormContractHeaderFields(form || {}, headerRow, null);
  return [
    { label: "Contract No", value: f.contractNo },
    { label: "CSD", value: formatDateDDMMMYYYY(f.contractStartDate) },
    { label: "COD", value: formatDateDDMMMYYYY(f.cod) },
    { label: "CED", value: formatDateDDMMMYYYY(f.contractEndDate) },
    { label: "Initial Rent PM", value: formatScheduleGridNumber(f.initialRentPM) },
    { label: "Initial Rent PA", value: formatScheduleGridNumber(f.initialRentPA) },
    { label: "Security Deposit", value: formatScheduleGridNumber(f.securityDepositAmount) },
    { label: "Tenant No", value: f.prefixNo },
    { label: "Business Name", value: f.businessName },
    { label: "Address", value: f.address },
    { label: "Rate PM", value: formatScheduleGridNumber(f.calculatedRentPM) },
    { label: "Months", value: formatScheduleGridNumber(f.months, true) },
    {
      label: "Payment Term (Months)",
      value: formatScheduleGridNumber(f.paymentTermMonths, true),
    },
    { label: "Rise Term", value: f.riseTerm },
    { label: "Rise Rate", value: formatScheduleGridNumber(f.riseRate) },
  ];
}

function AgreementProvEditDialogReadonlyStrip({ form, headerRow }) {
  const items = getAgreementProvEditDialogReadonlyBasicInfoItems(form, headerRow);
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
  headerRow: PropTypes.object,
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
    { label: "COD", value: formatDateDDMMMYYYY(f.cod) },
    { label: "CED", value: formatDateDDMMMYYYY(f.contractEndDate) },
    { label: "Initial Rent PM", value: formatScheduleGridNumber(f.initialRentPM) },
    { label: "Initial Rent PA", value: formatScheduleGridNumber(f.initialRentPA) },
    { label: "Security Deposit", value: formatScheduleGridNumber(f.securityDepositAmount) },
    { label: "Tenant No", value: f.prefixNo },
    { label: "Business Name", value: f.businessName },
    { label: "Address", value: f.address },
    { label: "Payment Term (Months)", value: formatScheduleGridNumber(f.paymentTermMonths, true) },
    { label: "Rise Term", value: f.riseTerm },
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
    periodEnd: (() => {
      const start = toScheduleDateInputValue(
        pickScheduleRowField(row, "PeriodStart", "periodStart")
      );
      const paymentTerm = pickScheduleRowField(row, "PaymentTermMonths", "paymentTermMonths");
      const inclusiveEnd = periodEndFromStartAndMonths(start, paymentTerm);
      return (
        inclusiveEnd ||
        toScheduleDateInputValue(pickScheduleRowField(row, "PeriodEnd", "periodEnd"))
      );
    })(),
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
    initialRentPA: pickScheduleRowField(row, "InitialRentPA", "initialRentPA"),
    securityDepositAmount: pickScheduleRowField(
      row,
      "SecurityDepositAmount",
      "securityDepositAmount"
    ),
    invoiceDateType: String(pickScheduleRowField(row, "InvoiceDateType", "invoiceDateType") || ""),
    invoiceStatus: String(pickScheduleRowField(row, "InvoiceStatus", "invoiceStatus") || ""),
    description: (() => {
      const start = toScheduleDateInputValue(
        pickScheduleRowField(row, "PeriodStart", "periodStart") || pickScheduleInvoiceDate(row)
      );
      const paymentTerm = pickScheduleRowField(row, "PaymentTermMonths", "paymentTermMonths");
      const inclusiveEnd =
        periodEndFromStartAndMonths(start, paymentTerm) ||
        toScheduleDateInputValue(pickScheduleRowField(row, "PeriodEnd", "periodEnd"));
      const periodText = formatInvoicePeriodDisplay(start, inclusiveEnd);
      if (periodText && periodText !== "—") {
        return withAgreementProvParticularPrefix(periodText);
      }
      return pickAgreementProvHeaderDescription(row);
    })(),
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
  const payload = buildInvoiceSchedulePutPayload(rowData, form);
  delete payload.IsLocked;
  delete payload.isLocked;
  payload.IsLocked = nextLocked === true;
  payload.IgnoreLockDate = true;
  return payload;
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
  onAddSaleReturn,
}) {
  const isCreateMode = Boolean(createMode);
  const editInvoiceHeaderFields = isCreateMode || !viewMode;
  const headerDescriptionLabel = isCreateMode ? "Period" : "Particular";
  const [form, setForm] = useState({});
  const [invoiceLinesRows, setInvoiceLinesRows] = useState([]);
  const [invoiceLinesLoading, setInvoiceLinesLoading] = useState(false);
  const [invoiceLinesError, setInvoiceLinesError] = useState("");
  const [newLineDrafts, setNewLineDrafts] = useState([]);
  const [editingLineDraft, setEditingLineDraft] = useState(null);
  const [pendingDeleteSubs, setPendingDeleteSubs] = useState([]);
  const [productServiceOptions, setProductServiceOptions] = useState([]);
  const originalServerSubsRef = useRef(new Set());
  const originalLinePayloadSnapshotsRef = useRef(new Map());
  const newLineDraftsRef = useRef([]);
  const editingLineDraftRef = useRef(null);
  const invoiceLinesRowsRef = useRef([]);
  const pendingDeleteSubsRef = useRef([]);
  const invoiceDateInputRef = useRef(null);
  const dueDateInputRef = useRef(null);
  const loadedInvoiceKeyRef = useRef("");

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

  useEffect(() => {
    if (!open) {
      setProductServiceOptions([]);
      return undefined;
    }

    let cancelled = false;
    const loadActiveProductServices = async () => {
      try {
        const [servicesResponse, uomRows] = await Promise.all([
          productServiceApi.getAll(1, 10000),
          fetchProductUomOptions().catch(() => []),
        ]);
        if (cancelled) return;
        const uomLookup = buildProductUomLookup(Array.isArray(uomRows) ? uomRows : []);
        setProductServiceOptions(
          buildActiveProductServiceOptions(unwrapProductListResponse(servicesResponse), uomLookup)
        );
      } catch (error) {
        console.error("Error loading active product services:", error);
        if (!cancelled) setProductServiceOptions([]);
      }
    };

    loadActiveProductServices();
    return () => {
      cancelled = true;
    };
  }, [open]);

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

  const reloadInvoiceLines = useCallback(
    async (rowDataOverride, options = {}) => {
      const activeRow = rowDataOverride || rowData;
      const freshForm = Boolean(options?.freshForm);
      if (!activeRow) return [];
      const invoiceNo = String(
        pickScheduleRowField(activeRow, "InvoiceNo", "invoiceNo") || ""
      ).trim();
      if (!invoiceNo) {
        setInvoiceLinesRows([]);
        setForm(
          mergeAgreementProvEditFormContractHeaderFields(
            buildAgreementProvEditForm(activeRow),
            activeRow,
            null
          )
        );
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
          const next = applyInvoiceLinesToForm(activeRow, lines, freshForm ? {} : prev);
          originalLinePayloadSnapshotsRef.current = captureOriginalInvoiceLinePayloadSnapshots(
            sorted,
            next,
            activeRow
          );
          return next;
        });
        if (!viewMode) {
          onInvoiceLinesLoaded?.(sorted, activeRow);
        }
        return lines;
      } catch (error) {
        console.error("Error loading invoice records by invoice no:", error);
        setInvoiceLinesRows([]);
        setInvoiceLinesError(getAgreementProvSaveErrorMessage(error));
        setForm(
          mergeAgreementProvEditFormContractHeaderFields(
            buildAgreementProvEditForm(activeRow),
            activeRow,
            null
          )
        );
        return [];
      } finally {
        setInvoiceLinesLoading(false);
      }
    },
    [rowData, syncOriginalServerSubs, viewMode, onInvoiceLinesLoaded]
  );

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
      loadedInvoiceKeyRef.current = "";
      return undefined;
    }

    if (isCreateMode) {
      loadedInvoiceKeyRef.current = "";
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

    setForm(
      mergeAgreementProvEditFormContractHeaderFields(
        buildAgreementProvEditForm(rowData),
        rowData,
        null
      )
    );
    setInvoiceLinesError("");
    setNewLineDrafts([]);
    setEditingLineDraft(null);
    setPendingDeleteSubs([]);
    originalServerSubsRef.current = new Set();
    originalLinePayloadSnapshotsRef.current = new Map();

    const invoiceKey = getAgreementProvInvoiceActionKey(rowData) || String(rowData?.id ?? "");
    if (loadedInvoiceKeyRef.current === invoiceKey) {
      return undefined;
    }
    loadedInvoiceKeyRef.current = invoiceKey;

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
    if (!open || isCreateMode || viewMode || invoiceLinesLoading) return undefined;

    const itemRows = getInvoiceItemRecordRows(invoiceLinesRows);
    if (itemRows.length > 0) return undefined;

    setNewLineDrafts((prev) => {
      const drafts = prev || [];
      if (drafts.some((draft) => draft.__isDefaultMandatory)) return drafts;
      if (drafts.some((draft) => !isInvoiceLineDraftEmpty(draft))) return drafts;
      return [buildDefaultMandatoryInvoiceLineDraft(form, rowData, invoiceLinesRows)];
    });

    return undefined;
  }, [open, isCreateMode, viewMode, invoiceLinesLoading, invoiceLinesRows, rowData]);

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

  const canAddRecord = Boolean(
    String(form.contractNo || "").trim() && String(form.invoiceNo || "").trim()
  );

  const hasIncompleteNewLineDrafts = useMemo(
    () => Boolean(getFirstIncompleteNewLineDraftError(newLineDrafts, form)),
    [newLineDrafts, form]
  );

  const invoiceItemRecordsTotalAmount = useMemo(() => {
    const workingLines = mergeAllDraftsIntoWorkingInvoiceLines(
      invoiceLinesRows,
      newLineDrafts,
      editingLineDraft,
      form,
      rowData
    );
    return sumInvoiceItemRecordTotals(workingLines);
  }, [invoiceLinesRows, newLineDrafts, editingLineDraft, form, rowData]);

  const handleSave = async () => {
    if (!onSave) return;
    const formWithLineTotals = {
      ...form,
      amountReceivable: invoiceItemRecordsTotalAmount,
      totalRent: invoiceItemRecordsTotalAmount,
      amountPending: Math.max(
        0,
        Number(invoiceItemRecordsTotalAmount) - Number(form.amountReceived || 0)
      ),
    };
    const refreshedRow = await onSave(formWithLineTotals, rowData, {
      invoiceLines: invoiceLinesRowsRef.current,
      pendingDeleteSubs: pendingDeleteSubsRef.current,
      newLineDrafts: newLineDraftsRef.current,
      editingLineDraft: editingLineDraftRef.current,
      originalServerSubs: originalServerSubsRef.current,
      originalLinePayloadSnapshots: originalLinePayloadSnapshotsRef.current,
    });
    if (!refreshedRow) return;
    await reloadInvoiceLines(refreshedRow, { freshForm: true });
  };

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

  const handleDraftItemServiceChange = (draftId) => (service) => {
    updateDraftById(draftId, (prev) => {
      if (!service) {
        return { ...prev, itemCode: "", accHead: "" };
      }
      const nextUnitPrice =
        service.defaultUnitPriceSales !== "" && service.defaultUnitPriceSales != null
          ? String(service.defaultUnitPriceSales)
          : prev.calculatedRentPM;
      const nextDesc =
        String(service.defaultParticulars || "").trim() ||
        String(service.itemName || "").trim() ||
        prev.desc;
      const linkedAccHead = resolveItemWithCodeAccHead(service);
      return recalcDraftTotal({
        ...prev,
        itemCode: String(service.itemCode || "").trim(),
        desc: nextDesc,
        accHead: linkedAccHead || prev.accHead || "",
        calculatedRentPM: nextUnitPrice,
      });
    });
  };

  const handleDraftAccHeadChange = (draftId) => (accHeadValue) => {
    const nextAccHead = String(accHeadValue || "").trim();
    if (!nextAccHead) {
      updateDraftById(draftId, (prev) => ({ ...prev, accHead: "", itemCode: "" }));
      return;
    }

    updateDraftById(draftId, (prev) => {
      const matched = findInvoiceProductByAccHead(
        productServiceOptions,
        nextAccHead,
        prev.itemCode
      );
      if (!matched) {
        return { ...prev, accHead: nextAccHead };
      }
      const nextUnitPrice =
        matched.defaultUnitPriceSales !== "" && matched.defaultUnitPriceSales != null
          ? String(matched.defaultUnitPriceSales)
          : prev.calculatedRentPM;
      const nextDesc =
        String(matched.defaultParticulars || "").trim() ||
        String(matched.itemName || "").trim() ||
        prev.desc;
      return recalcDraftTotal({
        ...prev,
        accHead: nextAccHead,
        itemCode: String(matched.itemCode || "").trim(),
        desc: nextDesc,
        calculatedRentPM: nextUnitPrice,
      });
    });
  };

  const handleDraftIntegerFieldChange = (draftId) => (field) => (e) => {
    const value =
      field === "months"
        ? sanitizeSignedIntegerInputValue(e.target.value)
        : sanitizeIntegerInputValue(e.target.value);
    updateDraftById(draftId, (prev) => recalcDraftTotal({ ...prev, [field]: value }));
  };

  const handleDraftNumericFieldChange = (draftId) => (field) => (e) => {
    const value = sanitizeDecimalNumericInputValue(e.target.value);
    updateDraftById(draftId, (prev) => recalcDraftTotal({ ...prev, [field]: value }));
  };

  const handleDraftCancel = (draftId) => {
    if (saving) return;
    if (draftId != null) {
      const draft = newLineDrafts.find((row) => row.__draftId === draftId);
      if (draft?.__isDefaultMandatory) {
        const itemRows = getInvoiceItemRecordRows(invoiceLinesRows);
        const otherDrafts = newLineDrafts.filter(
          (row) => row.__draftId !== draftId && !isInvoiceLineDraftEmpty(row)
        );
        if (itemRows.length === 0 && otherDrafts.length === 0) return;
      }
    }
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
      <DialogTitle
        sx={{
          fontSize: "1.25rem",
          fontWeight: 600,
          pb: 1,
          flexShrink: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <span>
          {isCreateMode
            ? "Create Agreement Invoice"
            : viewMode
            ? "View Agreement Invoice"
            : "Edit Agreement Invoice"}
        </span>
        {!isCreateMode &&
        !viewMode &&
        onAddSaleReturn &&
        !pickScheduleRowIsLocked(rowData) &&
        String(pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || "").trim() ? (
          <MDButton
            variant="outlined"
            color="info"
            size="small"
            onClick={onAddSaleReturn}
            sx={{ flexShrink: 0 }}
          >
            <Icon sx={{ fontSize: "1rem !important", mr: 0.5 }}>add</Icon>
            Add Sale Return
          </MDButton>
        ) : null}
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
              <AgreementProvEditDialogReadonlyStrip form={form} headerRow={rowData} />
              <MDBox sx={EDIT_INVOICE_HEADER_ROW_SX}>
                <MDBox sx={EDIT_INVOICE_HEADER_COMPACT_GROUP_SX}>
                  <MDBox sx={EDIT_INVOICE_HEADER_INVOICE_NO_SX}>
                    <AgreementProvReadOnlyField compact label="Invoice No" value={form.invoiceNo} />
                  </MDBox>
                  <MDBox sx={EDIT_INVOICE_HEADER_DATE_SX}>
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
                  </MDBox>
                  <MDBox sx={EDIT_INVOICE_HEADER_DATE_SX}>
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
                            onChange={(e) =>
                              setForm((prev) => ({ ...prev, dueDate: e.target.value }))
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
                  </MDBox>
                </MDBox>
                <MDBox sx={EDIT_INVOICE_HEADER_DESCRIPTION_SX}>
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
                          maxVisibleChars={120}
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
                    Total Amount: {formatScheduleGridNumber(invoiceItemRecordsTotalAmount)}
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
                  productServiceOptions={productServiceOptions}
                  onDraftFieldChange={handleDraftFieldChange}
                  onDraftItemServiceChange={handleDraftItemServiceChange}
                  onDraftAccHeadChange={handleDraftAccHeadChange}
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
  onAddSaleReturn: PropTypes.func,
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
    // Receivable must match Edit dialog Total Amount (item-line sum / AmountReceivable).
    totalRent: (() => {
      const receivable = row.AmountReceivable ?? row.amountReceivable;
      if (receivable !== null && receivable !== undefined && receivable !== "") {
        return receivable;
      }
      return row.TotalRent ?? row.totalRent;
    })(),
    remarks: row.Remarks ?? row.remarks ?? "",
    contractStartDate,
    contractEndDate,
    businessName: row.BusinessName ?? row.businessName ?? "",
    tenantName: formatPrefixNoDisplay(row),
    initialRentPM: row.InitialRentPM ?? row.initialRentPM ?? "",
    initialRentPA: row.InitialRentPA ?? row.initialRentPA ?? "",
    securityDepositAmount: row.SecurityDepositAmount ?? row.securityDepositAmount ?? "",
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
    amountReceivable: (() => {
      const receivable = row.AmountReceivable ?? row.amountReceivable;
      if (receivable !== null && receivable !== undefined && receivable !== "") {
        return receivable;
      }
      return row.TotalRent ?? row.totalRent ?? 0;
    })(),
    invoiceStatus: row.InvoiceStatus ?? row.invoiceStatus ?? "",
    daysToDue: row.DaysToDue ?? row.daysToDue ?? row.daystodue ?? "",
    daysOverdue: row.DaysOverdue ?? row.daysOverdue ?? row.daysoverdue ?? "",
    description: pickAgreementProvHeaderDescription(row),
    amountTotal: (() => {
      const receivable = row.AmountReceivable ?? row.amountReceivable;
      if (receivable !== null && receivable !== undefined && receivable !== "") {
        return receivable;
      }
      return row.TotalRent ?? row.totalRent ?? 0;
    })(),
    amountPending:
      row.AmountPending ??
      row.amountPending ??
      Math.max(
        0,
        Number(
          (row.AmountReceivable ?? row.amountReceivable ?? row.TotalRent ?? row.totalRent ?? 0) || 0
        ) - Number(row.AmountReceived ?? row.amountReceived ?? 0)
      ),
  };
}

export default function AgreementProvInvoice() {
  const navigate = useNavigate();
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [filters, setFilters] = useState(buildInitialAgreementProvFilters);
  const [appliedFilters, setAppliedFilters] = useState(buildInitialAgreementProvFilters);
  const [searchApplied, setSearchApplied] = useState(false);
  const [paginationHost, setPaginationHost] = useState(null);

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [units, setUnits] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [agreementDetailsOpen, setAgreementDetailsOpen] = useState(false);
  const [selectedAgreementDetails, setSelectedAgreementDetails] = useState(null);
  const [agreementRiseTerms, setAgreementRiseTerms] = useState([]);
  const [loadingAgreementRiseTerms, setLoadingAgreementRiseTerms] = useState(false);
  const [openingAgreementDetails, setOpeningAgreementDetails] = useState(false);
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
  const [pdfPreviewColumnKeys, setPdfPreviewColumnKeys] = useState(() =>
    createDefaultAgreementProvPdfColumnKeys()
  );
  const [salesReturnTotalsByInvoiceKey, setSalesReturnTotalsByInvoiceKey] = useState({});
  const [salesReturnFormOpen, setSalesReturnFormOpen] = useState(false);
  const [salesReturnFormRecord, setSalesReturnFormRecord] = useState(null);
  const pdfPreviewUrlRef = useRef(null);
  const reloadInvoiceLinesRef = useRef(null);
  const urlDeepLink = useMemo(() => readAgreementProvInvoiceUrlParams(), []);
  const urlDeepLinkAppliedRef = useRef(false);
  const registerReloadInvoiceLines = useCallback((fn) => {
    reloadInvoiceLinesRef.current = typeof fn === "function" ? fn : null;
  }, []);
  const canUnlockInvoiceFromGrid = isSuperuserOrAhqSupervisorUser();
  const canDeleteInvoiceFromGrid = canUnlockInvoiceFromGrid;
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
        const [commandsRes, basesRes, unitsRes, tenantsRes] = await Promise.all([
          api.list("command"),
          api.list("base"),
          api.list("unit"),
          api.list("tenant"),
        ]);
        setCommands(Array.isArray(commandsRes) ? commandsRes : []);
        setBases(Array.isArray(basesRes) ? basesRes : []);
        setUnits(Array.isArray(unitsRes) ? unitsRes : []);
        setTenants(Array.isArray(tenantsRes) ? tenantsRes : []);
      } catch (error) {
        console.error("Error fetching lookup data:", error);
      }
    };
    fetchLookups();
  }, []);

  const reloadAllScheduleRows = useCallback(async () => {
    const response = await contractApi.getAgreementProvFinalizedInvoiceScheduleRecords();
    const scheduleData = dedupeAgreementProvScheduleRowsByInvoice(
      unwrapContractInvoiceScheduleList(response)
    ).map(normalizeAgreementProvInvoiceRow);
    setAllScheduleRows(scheduleData);
    return scheduleData;
  }, []);

  const executeFinalizedInvoiceSearch = useCallback(async (filterSnapshot, extra = {}) => {
    const apiFilters = buildAgreementProvSearchApiFilters(filterSnapshot, extra);
    const response = await contractApi.searchAgreementProvFinalizedInvoiceSchedule(apiFilters);
    const rows = dedupeAgreementProvScheduleRowsByInvoice(
      unwrapContractInvoiceScheduleList(response)
    ).map(normalizeAgreementProvInvoiceRow);
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

  const refreshSalesReturnTotals = useCallback(async () => {
    try {
      const response = await salesReturnsApi.listSalesReturns();
      const rows = salesReturnsApi
        .unwrapList(response)
        .map(salesReturnsApi.normalizeSalesReturnRow);
      setSalesReturnTotalsByInvoiceKey(buildSalesReturnTotalsByInvoiceKey(rows));
    } catch (error) {
      console.error("Error loading sales return totals:", error);
      setSalesReturnTotalsByInvoiceKey({});
    }
  }, []);

  useEffect(() => {
    refreshSalesReturnTotals();
  }, [refreshSalesReturnTotals]);

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
    if (urlDeepLinkAppliedRef.current) return;
    const contractNoParam = urlDeepLink.contractNo;
    const invoiceNoParam = urlDeepLink.invoiceNo;
    const tenantNoParam = urlDeepLink.tenantNo;
    const wantsGridView =
      urlDeepLink.view === "grid" || contractNoParam || invoiceNoParam || tenantNoParam;
    if (!wantsGridView) return;
    if (!contractNoParam && !invoiceNoParam && !tenantNoParam) return;

    urlDeepLinkAppliedRef.current = true;

    const filterSnapshot = { ...buildInitialAgreementProvFilters() };
    if (contractNoParam) {
      const contractNoFilter = { ContractNo: contractNoParam, contractNo: contractNoParam };
      filterSnapshot.contractNo = contractNoFilter;
      setFilters((prev) => ({ ...prev, contractNo: contractNoFilter }));
    }

    setAppliedFilters(filterSnapshot);
    setInvoiceKeysWithItemRecords(new Set());
    setLoading(true);
    executeFinalizedInvoiceSearch(filterSnapshot, {
      invoiceNo: invoiceNoParam,
      tenantNo: tenantNoParam,
    })
      .then(() => {
        setSearchApplied(true);
      })
      .catch((error) => {
        console.error("Error searching finalized invoices from deep link:", error);
        setSearchResultRows([]);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [
    executeFinalizedInvoiceSearch,
    urlDeepLink.contractNo,
    urlDeepLink.invoiceNo,
    urlDeepLink.tenantNo,
    urlDeepLink.view,
  ]);

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
    if (!nextLocked && !canUnlockInvoiceFromGrid) return;
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
      const lockPayload = buildInvoiceScheduleLockPayload(rowData, nextLocked);
      lockPayload.IsLocked = nextLocked === true;
      await contractApi.updateInvoiceSchedule(contractNo, invoiceNo, lockPayload);
      await refreshScheduleGrid();
    } catch (error) {
      console.error("Error updating invoice lock:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    } finally {
      setInvoiceLockSavingKey("");
    }
  };

  const generatePDF = async (
    rowData,
    marginsInParam = null,
    { openNewTab = true, columnKeys = null } = {}
  ) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginsIn = marginsInParam ?? loadAgreementProvPdfMargins();
    const { marginLeft, marginRight, marginTop, marginBottom } =
      agreementProvPdfMarginsInchesToMm(marginsIn);
    const { sx, sy, sf, sc, logicalPageBottomY, logicalPageBottomReserve } =
      createAgreementProvPdfScaleHelpers({
        contentScale: marginsIn?.contentScale,
        marginLeft,
        marginTop,
        pageHeight,
        marginBottom,
      });
    const contentRight = pageWidth - marginRight;
    const contentWidth = contentRight - marginLeft;
    const lineHeight = AGREEMENT_PROV_PDF_LINE_HEIGHT_MM;
    const bodyFont = AGREEMENT_PROV_PDF_FONT_BODY;
    const selectedPdfColumns =
      columnKeys instanceof Set
        ? columnKeys
        : columnKeys
        ? new Set(columnKeys)
        : createDefaultAgreementProvPdfColumnKeys();

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
    const periodStartForDesc = toScheduleDateInputValue(
      pickScheduleRowField(rowData, "PeriodStart", "periodStart") ||
        pickScheduleInvoiceDate(rowData)
    );
    const inclusivePeriodEnd =
      periodEndFromStartAndMonths(periodStartForDesc, paymentTermMonths) ||
      toScheduleDateInputValue(pickScheduleRowField(rowData, "PeriodEnd", "periodEnd"));
    const descriptionText = withAgreementProvParticularPrefix(
      formatInvoicePeriodDisplay(periodStartForDesc, inclusivePeriodEnd)
    );
    const invoiceDateDisplay = formatPdfInvoiceDate(pickScheduleInvoiceDate(rowData));
    const dueDateDisplay = formatPdfInvoiceDate(
      pickScheduleRowField(rowData, "DueDate", "dueDate")
    );
    const contractPeriodStart = formatPdfContractDateShort(contractStartDate);
    const contractPeriodEnd = formatPdfContractDateShort(contractEndDate);
    const businessName = String(
      pickScheduleRowField(rowData, "BusinessName", "businessName") || ""
    ).trim();
    let contractDisplay =
      contractPeriodStart && contractPeriodEnd
        ? `${contractNo} (${contractPeriodStart} To ${contractPeriodEnd})`
        : contractNo || "—";
    if (businessName) {
      contractDisplay =
        contractDisplay && contractDisplay !== "—"
          ? `${contractDisplay} — ${businessName}`
          : businessName;
    }

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

    let pdfProductServiceOptions = [];
    try {
      const [servicesResponse, uomRows] = await Promise.all([
        productServiceApi.getAll(1, 10000),
        fetchProductUomOptions().catch(() => []),
      ]);
      const uomLookup = buildProductUomLookup(Array.isArray(uomRows) ? uomRows : []);
      pdfProductServiceOptions = buildActiveProductServiceOptions(
        unwrapProductListResponse(servicesResponse),
        uomLookup
      );
    } catch (error) {
      console.error("Error loading product services for PDF unit price UoM:", error);
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

    await loadPafLogoIntoPdf(doc, sx(marginLeft), sy(marginTop), sc(LOGO_WIDTH_MM));

    const drawBodyText = (text, x, y, options = {}) => {
      doc.setFont("helvetica", options.bold ? "bold" : "normal");
      doc.setFontSize(sf(options.fontSize || bodyFont));
      doc.text(String(text ?? ""), sx(x), sy(y), options.textOptions);
    };

    const drawPdfLine = (x1, y1, x2, y2) => {
      doc.line(sx(x1), sy(y1), sx(x2), sy(y2));
    };

    const ensurePageSpace = (y, needed = lineHeight) => {
      if (y + needed <= logicalPageBottomY - logicalPageBottomReserve) return y;
      doc.addPage();
      return marginTop;
    };

    doc.setLineWidth(sc(0.15));

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(AGREEMENT_PROV_PDF_FONT_TITLE));
    doc.text("Sales Invoice", sx(textStartX), sy(marginTop + 5));

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

    const drawUnderlinedCustomerRow = (label, value, withColon = true, options = {}) => {
      const { singleLine = false, shrinkFont = false, minFontSize = 6 } = options;
      const rowTop = yPos;
      const labelText = withColon ? `${label} :` : label;
      const maxValueWidth = contentRight - customerValueX - 1;
      const valueText = String(value || "—");
      const rowBandHeight = lineHeight;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(sf(bodyFont));
      const labelHeight = doc.getTextDimensions(labelText).h;
      const labelBaselineY = getPdfRowCenteredBaselineY(rowTop, rowBandHeight, labelHeight);
      doc.text(labelText, sx(marginLeft + 1), sy(labelBaselineY));

      let valueFontSize = sf(bodyFont);
      if (singleLine && shrinkFont) {
        valueFontSize = resolveSingleLinePdfFontSize(
          doc,
          valueText,
          maxValueWidth,
          sf(bodyFont),
          sf(minFontSize),
          "normal"
        );
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueFontSize);

      if (singleLine) {
        const valueHeight = doc.getTextDimensions(valueText).h;
        const valueBaselineY = getPdfRowCenteredBaselineY(rowTop, rowBandHeight, valueHeight);
        doc.text(valueText, sx(customerValueX), sy(valueBaselineY));
        const underlineY = getPdfValueUnderlineY(valueBaselineY, valueHeight, sc);
        drawPdfLine(customerValueX, underlineY, contentRight, underlineY);
        yPos = underlineY + 1.75;
        return underlineY - rowTop + 1.75;
      }

      const valueLines = doc.splitTextToSize(valueText, maxValueWidth);
      let lastLineBaselineY = rowTop;
      let lastLineHeight = 0;
      valueLines.forEach((line, index) => {
        const lineHeightDim = doc.getTextDimensions(line).h;
        const lineBaselineY = getPdfRowCenteredBaselineY(
          rowTop + index * lineHeight,
          lineHeight,
          lineHeightDim
        );
        doc.text(line, sx(customerValueX), sy(lineBaselineY));
        lastLineBaselineY = lineBaselineY;
        lastLineHeight = lineHeightDim;
      });
      const underlineY = getPdfValueUnderlineY(lastLineBaselineY, lastLineHeight, sc);
      drawPdfLine(customerValueX, underlineY, contentRight, underlineY);
      yPos = underlineY + 1.75;
      return underlineY - rowTop + 1.75;
    };

    drawUnderlinedCustomerRow("Tenant", customerDisplay, true, { singleLine: true });
    drawUnderlinedCustomerRow("Contract", contractDisplay, true, {
      singleLine: true,
      shrinkFont: true,
    });
    drawUnderlinedCustomerRow("Description", descriptionText, false);

    yPos += lineHeight;

    const pmMonthsFallback = paymentTermMonths || 12;
    const fallbackLineTotal = Number(initialRentPM) * Number(pmMonthsFallback);
    const lineCellRows =
      invoiceLineRows.length > 0
        ? invoiceLineRows.map((lineRow) =>
            getAgreementProvPdfLineCellValues(lineRow, pdfProductServiceOptions)
          )
        : [
            {
              subInvoiceNo: "—",
              itemWithCode: "—",
              particular: withAgreementProvParticularPrefix("MR Monthly Rent"),
              accHead: "—",
              qty: String(pmMonthsFallback),
              unitPrice: formatPdfCurrency(initialRentPM),
              discount: "—",
              total: Number.isFinite(fallbackLineTotal) ? fallbackLineTotal : 0,
            },
          ];

    let calculatedTotal = 0;
    let maxLineTotal = 0;
    lineCellRows.forEach((cells) => {
      const lineTotal = Number(cells.total) || 0;
      calculatedTotal += lineTotal;
      if (lineTotal > maxLineTotal) maxLineTotal = lineTotal;
    });

    const amountReceivable = Number(
      pickScheduleRowField(rowData, "AmountReceivable", "amountReceivable") || 0
    );
    const displayTotal =
      invoiceLineRows.length > 0
        ? calculatedTotal
        : Number.isFinite(amountReceivable) && amountReceivable > 0
        ? amountReceivable
        : Number(pickScheduleRowField(rowData, "TotalRent", "totalRent") || 0) || calculatedTotal;

    const pdfBodyColumns = buildAgreementProvPdfBodyColumns({
      contentWidth,
      marginLeft,
      selectedKeys: selectedPdfColumns,
      maxTotalValue: Math.max(maxLineTotal, displayTotal, 0),
      doc,
      bodyFontSize: sf(bodyFont),
    });
    const wrapColumn =
      pdfBodyColumns.find((col) => col.key === "particular") ||
      pdfBodyColumns.find((col) => !AGREEMENT_PROV_PDF_RIGHT_COLUMN_KEYS.has(col.key));

    const formatCellDisplay = (colKey, cells) => {
      if (colKey === "total") return formatPdfCurrency(cells.total);
      return String(cells[colKey] ?? "—");
    };

    const drawBodyTableHeader = () => {
      const rowTop = yPos;
      pdfBodyColumns.forEach((col) => {
        drawBodyText(col.label, col.textX, rowTop, {
          bold: true,
          textOptions: col.align === "right" ? { align: "right" } : undefined,
        });
      });

      doc.setFont("helvetica", "bold");
      doc.setFontSize(sf(bodyFont));
      const headerTextHeight = doc.getTextDimensions(pdfBodyColumns[0]?.label || "Total").h;
      const underlineY = rowTop + headerTextHeight * 0.28 + sc(0.4);
      drawPdfLine(marginLeft, underlineY, contentRight, underlineY);
      yPos = underlineY + lineHeight;
    };

    const drawBodyTableRow = (cells) => {
      yPos = ensurePageSpace(yPos, lineHeight + 2);
      if (yPos === marginTop) {
        drawBodyTableHeader();
      }

      const wrapWidth = Math.max((wrapColumn?.width || contentWidth) - 1, 20);
      const wrapText = wrapColumn ? formatCellDisplay(wrapColumn.key, cells) : "";
      doc.setFont("helvetica", "normal");
      doc.setFontSize(sf(bodyFont));
      const wrapLines = wrapColumn ? doc.splitTextToSize(String(wrapText || "—"), wrapWidth) : [""];

      wrapLines.forEach((line, index) => {
        if (index > 0) {
          yPos = ensurePageSpace(yPos, lineHeight);
          if (yPos === marginTop) {
            drawBodyTableHeader();
          }
        }
        pdfBodyColumns.forEach((col) => {
          if (wrapColumn && col.key === wrapColumn.key) {
            drawBodyText(line, col.textX, yPos, {
              textOptions: col.align === "right" ? { align: "right" } : undefined,
            });
            return;
          }
          if (index !== 0) return;
          drawBodyText(formatCellDisplay(col.key, cells), col.textX, yPos, {
            textOptions: col.align === "right" ? { align: "right" } : undefined,
          });
        });
        yPos += lineHeight;
      });
    };

    drawBodyTableHeader();
    lineCellRows.forEach((cells) => drawBodyTableRow(cells));

    yPos = ensurePageSpace(yPos + 4, lineHeight * 3);
    yPos += 4;

    const totalText = `Total: ${formatPdfCurrency(displayTotal)}`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const totalDims = doc.getTextDimensions(totalText);
    const totalRowY = yPos;
    const totalOverlineY = totalRowY - totalDims.h * 0.75 - sc(0.5);
    drawPdfLine(marginLeft, totalOverlineY, contentRight, totalOverlineY);
    drawBodyText(totalText, contentRight, totalRowY, {
      bold: true,
      textOptions: { align: "right" },
    });

    yPos += lineHeight + 8;
    if (yPos > logicalPageBottomY - logicalPageBottomReserve) {
      doc.addPage();
      yPos = marginTop;
    }
    const signatureY = Math.max(yPos + 10, logicalPageBottomY - sc(18));
    drawPdfLine(marginLeft, signatureY, contentRight, signatureY);

    const invoiceStatusWatermark = getAgreementProvPdfInvoiceStatusWatermarkWord(
      pickScheduleRowField(rowData, "InvoiceStatus", "invoiceStatus")
    );
    if (invoiceStatusWatermark) {
      const pageCount = doc.internal.getNumberOfPages();
      for (let page = 1; page <= pageCount; page += 1) {
        doc.setPage(page);
        drawAgreementProvPdfInvoiceStatusWatermark(
          doc,
          invoiceStatusWatermark,
          pageWidth,
          pageHeight
        );
      }
    }

    addContractPdfWatermarks(doc);
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

  const regeneratePdfPreview = async (rowData, marginsIn, columnKeys = pdfPreviewColumnKeys) => {
    if (!rowData) return;
    setPdfPreviewLoading(true);
    try {
      saveAgreementProvPdfMargins(marginsIn);
      const pdfBlob = await generatePDF(rowData, marginsIn, {
        openNewTab: false,
        columnKeys,
      });
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
    const columnKeys = createDefaultAgreementProvPdfColumnKeys();
    setPdfPreviewRowData(rowData);
    setPdfPreviewMarginsIn(marginsIn);
    setPdfPreviewColumnKeys(columnKeys);
    setPdfPreviewOpen(true);
    await regeneratePdfPreview(rowData, marginsIn, columnKeys);
  };

  const handleApplyPdfMargins = async () => {
    await regeneratePdfPreview(pdfPreviewRowData, pdfPreviewMarginsIn, pdfPreviewColumnKeys);
  };

  const togglePdfPreviewColumn = (columnKey) => {
    setPdfPreviewColumnKeys((prev) => {
      const next = new Set(prev);
      if (next.has(columnKey)) next.delete(columnKey);
      else next.add(columnKey);
      return next;
    });
  };

  const handleResetPdfPreviewOptions = () => {
    setPdfPreviewMarginsIn({ ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS });
    setPdfPreviewColumnKeys(createDefaultAgreementProvPdfColumnKeys());
  };

  const adjustPdfPreviewContentScale = (delta) => {
    setPdfPreviewMarginsIn((prev) => ({
      ...prev,
      contentScale: normalizeAgreementProvPdfContentScale(
        normalizeAgreementProvPdfContentScale(prev?.contentScale) + delta
      ),
    }));
  };

  const pdfPreviewContentScale = normalizeAgreementProvPdfContentScale(
    pdfPreviewMarginsIn?.contentScale
  );

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
  const renderClickableAmountCell = ({ value, onClick }) => {
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
          if (typeof onClick === "function") onClick();
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

  const scheduleNumberColumn = (
    id,
    header,
    pascalKey,
    camelKey,
    clickable = false,
    onClickRowValue = null
  ) => ({
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
            onClick: () => onClickRowValue?.(rowData),
          });
        }
      : // eslint-disable-next-line react/prop-types
        ({ row }) => {
          const rowData = row?.original || {};
          if (isAgreementProvContractBasicInfoRow(rowData)) return null;
          return formatScheduleGridNumber(pickScheduleRowField(rowData, pascalKey, camelKey));
        },
  });

  const agreementProvScheduleHeaderLookupRows = useMemo(() => {
    if (searchApplied) return searchResultRows;
    return allScheduleRows;
  }, [allScheduleRows, searchResultRows, searchApplied]);

  const handleOpenEditRow = (rowData) => {
    if (pickScheduleRowIsLocked(rowData)) return;
    setEditRowData(
      enrichAgreementProvRowWithContractHeaderFields(rowData, agreementProvScheduleHeaderLookupRows)
    );
    setEditDialogViewMode(false);
    setEditDialogOpen(true);
  };

  const handleOpenViewRow = (rowData) => {
    setEditRowData(
      enrichAgreementProvRowWithContractHeaderFields(rowData, agreementProvScheduleHeaderLookupRows)
    );
    setEditDialogViewMode(true);
    setEditDialogOpen(true);
  };

  const handleCloseEditRow = () => {
    setEditDialogOpen(false);
    setEditRowData(null);
    setEditDialogViewMode(false);
  };

  const handleOpenCollectionsForInvoice = (rowData) => {
    const invoiceNo = String(pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || "").trim();
    const contractNo = String(
      pickScheduleRowField(rowData, "ContractNo", "contractNo") || ""
    ).trim();
    if (!invoiceNo) return;
    const params = new URLSearchParams({ invoiceNo });
    if (contractNo) params.set("contractNo", contractNo);
    navigate(`/income-agreements/collections?${params.toString()}`);
  };

  const handleOpenSalesReturnForInvoice = (rowData) => {
    if (pickScheduleRowIsLocked(rowData)) return;
    const invoiceNo = String(pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || "").trim();
    if (!invoiceNo) return;
    setSalesReturnFormRecord(buildSalesReturnPrefillFromAgreementProvInvoiceRow(rowData));
    setSalesReturnFormOpen(true);
  };

  const handleCloseSalesReturnForm = () => {
    setSalesReturnFormOpen(false);
    setSalesReturnFormRecord(null);
  };

  const handleSubmitSalesReturn = async (payload) => {
    const grandTotal = computeSalesReturnGrandTotal(payload.lines);
    const apiPayload = salesReturnsApi.buildSalesReturnApiPayload(payload, grandTotal);
    const created = await salesReturnsApi.createSalesReturn(apiPayload);
    await refreshSalesReturnTotals();
    return { id: created?.id ?? created?.Id };
  };

  const handleDeleteInvoiceRow = async (rowData) => {
    if (!canDeleteInvoiceFromGrid) return;
    if (pickScheduleRowIsLocked(rowData)) {
      alert("This invoice is locked. Unlock it before deleting.");
      return;
    }
    const { contractNo, invoiceNo } = getInvoiceScheduleRouteKeys(rowData);
    if (!contractNo || !invoiceNo) {
      alert("Cannot delete: Contract No and Invoice ID are required.");
      return;
    }
    if (
      !window.confirm(
        `Delete invoice "${invoiceNo}" for contract "${contractNo}"?\n\nThis will soft-delete the invoice and all its line items.`
      )
    ) {
      return;
    }
    try {
      await contractApi.deleteInvoiceScheduleInvoice(contractNo, invoiceNo);
      if (
        editDialogOpen &&
        getAgreementProvInvoiceActionKey(editRowData) === getAgreementProvInvoiceActionKey(rowData)
      ) {
        handleCloseEditRow();
      }
      await refreshScheduleGrid();
    } catch (error) {
      console.error("Error deleting invoice schedule:", error);
      alert(getAgreementProvSaveErrorMessage(error));
    }
  };

  const handleSaveEditRow = async (form, rowData, lineSaveContext = {}) => {
    const { contractNo, invoiceNo } = getInvoiceScheduleRouteKeys(rowData, form);
    if (!contractNo || !invoiceNo) {
      alert("Cannot update: Contract No and Invoice ID are required.");
      return null;
    }
    if (pickScheduleRowIsLocked(rowData)) {
      alert("This invoice is locked. Unlock it before editing.");
      return null;
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
      await refreshScheduleGrid();

      const response = await contractApi.getInvoiceScheduleByInvoiceNo(invoiceNo);
      const refreshedLines = sortInvoiceLinesByOrder(unwrapContractInvoiceScheduleList(response));
      const refreshedMainRow = findMainInvoiceScheduleRow(refreshedLines) || rowData;
      const updatedEditRow = enrichAgreementProvRowWithContractHeaderFields(
        refreshedMainRow,
        refreshedLines
      );
      setEditRowData(updatedEditRow);
      syncInvoiceItemRecordKeyFromLines(updatedEditRow, refreshedLines);
      return updatedEditRow;
    } catch (error) {
      console.error("Error updating contract invoice schedule:", error);
      alert(getAgreementProvSaveErrorMessage(error));
      throw error;
    } finally {
      setSavingEdit(false);
    }
  };

  const actionColumn = {
    Header: "Action",
    accessor: "actions",
    align: "center",
    width: canDeleteInvoiceFromGrid ? "88px" : "56px",
    disableSortBy: true,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      if (rowData.isGroupRow || rowData.IsGroupRow) return "";
      const isLocked = pickScheduleRowIsLocked(rowData);
      const showEdit = !isLocked;
      const showDelete = canDeleteInvoiceFromGrid && !isLocked;
      if (!showEdit && !showDelete) return "";
      const hasItemRecords = invoiceKeysWithItemRecords.has(
        getAgreementProvInvoiceActionKey(rowData)
      );
      return (
        <MDBox display="flex" alignItems="center" justifyContent="center" gap={0.25}>
          {showEdit ? (
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
          ) : null}
          {showDelete ? (
            <Tooltip title="Delete invoice">
              <IconButton
                size="small"
                className="erp-grid-action-delete"
                onClick={() => handleDeleteInvoiceRow(rowData)}
                aria-label="Delete invoice"
                sx={agreementProvActionIconSx.delete}
              >
                <Icon>delete</Icon>
              </IconButton>
            </Tooltip>
          ) : null}
        </MDBox>
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
    delete: {
      padding: "2px",
      color: "#d32f2f",
      opacity: "1 !important",
      transform: "none !important",
      filter: "none !important",
      transition: "background-color 0.15s ease",
      "&:hover": {
        opacity: "1 !important",
        transform: "none !important",
        filter: "none !important",
        backgroundColor: "rgba(211, 47, 47, 0.12)",
      },
      "& .MuiIcon-root": {
        color: "#d32f2f !important",
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
      const canUnlockInvoice = canUnlockInvoiceFromGrid;
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
            if (canUnlockInvoice && isLocked) {
              e.preventDefault();
              e.stopPropagation();
              void handleInvoiceLockChange(rowData, false);
            }
          }}
        >
          <Tooltip
            title={
              isLocked
                ? canUnlockInvoice
                  ? "Locked — double-click this cell to unlock"
                  : "Locked — only superuser or AHQ supervisor can unlock"
                : "Lock invoice"
            }
          >
            <span>
              <IconButton
                size="small"
                disabled={lockBusy || isLocked}
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

  const handleOpenAgreementDetails = useCallback(async (contractNo, contractId) => {
    const key = String(contractNo || "").trim();
    if (!key) return;
    setOpeningAgreementDetails(true);
    setAgreementDetailsOpen(true);
    setSelectedAgreementDetails(null);
    setAgreementRiseTerms([]);
    setLoadingAgreementRiseTerms(true);
    try {
      const contract = await resolveAgreementContract({ contractNo: key, contractId });
      if (!contract) {
        setAgreementDetailsOpen(false);
        alert(`Agreement not found: ${key}`);
        return;
      }
      setSelectedAgreementDetails(contract);
      const riseTerms = await fetchNormalizedContractRiseTerms(contract.Id ?? contract.id);
      setAgreementRiseTerms(riseTerms);
    } catch (error) {
      console.error("Error opening agreement details:", error);
      setAgreementDetailsOpen(false);
      alert("Failed to load agreement details. Please try again.");
    } finally {
      setOpeningAgreementDetails(false);
      setLoadingAgreementRiseTerms(false);
    }
  }, []);

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
            handleOpenAgreementDetails(
              contractNo,
              rowData.contractId ?? rowData.ContractId ?? rowData.contractID
            );
          }}
        >
          {contractNo}
        </MDTypography>
      );
    },
  };

  const saleReturnColumn = {
    id: "saleReturn",
    Header: "Sale Return",
    accessor: "saleReturn",
    align: "center",
    width: "96px",
    disableSortBy: true,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
      if (isAgreementProvContractBasicInfoRow(rowData)) return null;
      if (rowData.isGroupRow || rowData.IsGroupRow) return "";
      const contractNo = String(
        pickScheduleRowField(rowData, "ContractNo", "contractNo") || ""
      ).trim();
      const invoiceNo = String(
        pickScheduleRowField(rowData, "InvoiceNo", "invoiceNo") || ""
      ).trim();
      if (!invoiceNo) return "-";
      const invoiceKey = buildInvoiceKey({ contractNo, invoiceNo });
      const returnTotal = Number(salesReturnTotalsByInvoiceKey[invoiceKey] || 0);
      return (
        <MDTypography
          component="span"
          variant="caption"
          sx={{ fontSize: "0.72rem", fontWeight: 700, lineHeight: 1, whiteSpace: "nowrap" }}
        >
          {returnTotal > 0 ? formatAmount(returnTotal) : "-"}
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
    // Prefer AmountReceivable (item-line Total Amount); totalRent is normalized to the same value.
    scheduleNumberColumn("totalRent", "Receivable", "AmountReceivable", "totalRent", true),
    scheduleTextColumn("remarks", "Remarks", "Remarks", "remarks"),
    scheduleNumberColumn(
      "amountReceived",
      "Received",
      "AmountReceived",
      "amountReceived",
      true,
      handleOpenCollectionsForInvoice
    ),
    scheduleNumberColumn("amountPending", "Balance", "AmountPending", "amountPending", true),
    saleReturnColumn,

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
    const tenantKey = String(urlDeepLink.tenantNo || "")
      .trim()
      .toLowerCase();
    const invKey = String(urlDeepLink.invoiceNo || "")
      .trim()
      .toLowerCase();
    if (!tenantKey && !invKey) return groupedData;

    const matchesInvoice = (row) =>
      String(pickScheduleRowField(row, "InvoiceNo", "invoiceNo")).trim().toLowerCase() === invKey;
    const matchesTenant = (row) =>
      String(pickScheduleRowField(row, "TenantNo", "tenantNo")).trim().toLowerCase() === tenantKey;
    const matchesRow = (row) => {
      if (tenantKey && !matchesTenant(row)) return false;
      if (invKey && !matchesInvoice(row)) return false;
      return true;
    };

    return groupedData.filter((row) => {
      if (row.isContractBasicInfoRow || row.IsContractBasicInfoRow) {
        return (row.GroupRows || []).some(matchesRow);
      }
      if (row.isGroupRow || row.IsGroupRow) {
        return (row.GroupRows || []).some(matchesRow);
      }
      return matchesRow(row);
    });
  }, [groupedData, urlDeepLink.invoiceNo, urlDeepLink.tenantNo]);

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
        tabs={<IncomeAgreementsModuleTabs />}
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
                  <SearchableSelect
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
                  </SearchableSelect>
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
                  <SearchableSelect
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
                  </SearchableSelect>
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
                  <SearchableSelect
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
                  </SearchableSelect>
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
                backgroundColor: "rgba(0, 0, 0, 0.045)",
                color: "rgba(52, 71, 103, 0.82)",
                userSelect: "none",
              },
              "& tr.agreement-prov-invoice-locked-row > td .MuiIconButton-root, & tr.agreement-prov-invoice-locked-row > td .MuiIconButton-root:hover":
                {
                  opacity: "1 !important",
                  color: "inherit",
                },
              "& td .MuiIconButton-root.erp-grid-action-edit, & td .MuiIconButton-root.erp-grid-action-edit:hover":
                {
                  opacity: "1 !important",
                  transform: "none !important",
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

            <MDTypography variant="h6" sx={{ mt: 2, mb: 1 }}>
              Content scale
            </MDTypography>
            <MDBox display="flex" alignItems="center" gap={0.5}>
              <Tooltip title="Zoom out content">
                <span>
                  <IconButton
                    size="small"
                    color="dark"
                    onClick={() =>
                      adjustPdfPreviewContentScale(-AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP)
                    }
                    disabled={
                      pdfPreviewLoading ||
                      pdfPreviewContentScale <= AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN
                    }
                  >
                    <Icon fontSize="small">zoom_out</Icon>
                  </IconButton>
                </span>
              </Tooltip>
              <MDInput
                size="small"
                label="Scale %"
                type="number"
                value={Math.round(pdfPreviewContentScale * 100)}
                readOnly
                InputProps={{ readOnly: true }}
                inputProps={{
                  min: AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN * 100,
                  max: AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX * 100,
                  step: AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP * 100,
                }}
                sx={{
                  width: 100,
                  "& .MuiInputBase-input": { cursor: "default" },
                }}
              />
              <Tooltip title="Zoom in content">
                <span>
                  <IconButton
                    size="small"
                    color="dark"
                    onClick={() =>
                      adjustPdfPreviewContentScale(AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP)
                    }
                    disabled={
                      pdfPreviewLoading ||
                      pdfPreviewContentScale >= AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX
                    }
                  >
                    <Icon fontSize="small">zoom_in</Icon>
                  </IconButton>
                </span>
              </Tooltip>
            </MDBox>
            <MDTypography variant="body2" sx={{ mt: 0.75, color: "text.secondary" }}>
              Current: {formatAgreementProvPdfContentScalePercent(pdfPreviewContentScale)} (print
              content size)
            </MDTypography>
            <MDTypography variant="body2" sx={{ mt: 0.5, color: "text.secondary" }}>
              A4 size is 100% scale.
            </MDTypography>

            <MDTypography variant="h6" sx={{ mt: 2, mb: 1 }}>
              PDF columns
            </MDTypography>
            <MDBox display="flex" flexDirection="column" gap={0.25}>
              {AGREEMENT_PROV_PDF_SELECTABLE_COLUMNS.map((col) => (
                <FormControlLabel
                  key={col.key}
                  sx={{ m: 0, alignItems: "center" }}
                  control={
                    <Checkbox
                      size="small"
                      checked={pdfPreviewColumnKeys.has(col.key)}
                      onChange={() => togglePdfPreviewColumn(col.key)}
                      disabled={pdfPreviewLoading}
                    />
                  }
                  label={
                    <MDTypography variant="body2" sx={{ fontSize: "0.8125rem" }}>
                      {col.label}
                    </MDTypography>
                  }
                />
              ))}
              <FormControlLabel
                sx={{ m: 0, alignItems: "center" }}
                control={<Checkbox size="small" checked disabled />}
                label={
                  <MDTypography variant="body2" sx={{ fontSize: "0.8125rem" }}>
                    Total (always shown)
                  </MDTypography>
                }
              />
            </MDBox>

            <MDBox mt={2} display="flex" gap={1} alignItems="center">
              <MDButton
                variant="outlined"
                color="dark"
                size="small"
                onClick={handleResetPdfPreviewOptions}
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

            <MDTypography
              variant="caption"
              sx={{ mt: 1, color: "text.secondary", display: "block" }}
            >
              Margins, content scale, and columns are applied when you click Update. Scale adjusts
              fonts, spacing, and layout in the generated PDF (not just the preview display).
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
        onAddSaleReturn={() => handleOpenSalesReturnForInvoice(editRowData)}
      />

      <SalesReturnForm
        open={salesReturnFormOpen}
        onClose={handleCloseSalesReturnForm}
        onSubmit={handleSubmitSalesReturn}
        initialData={salesReturnFormRecord}
        labels={SALES_RETURNS_LABELS}
      />

      <AgreementDetailsDialog
        open={agreementDetailsOpen}
        onClose={() => {
          setAgreementDetailsOpen(false);
          setSelectedAgreementDetails(null);
          setAgreementRiseTerms([]);
        }}
        contractDetails={selectedAgreementDetails}
        columns={AGREEMENT_DETAILS_COLUMNS}
        riseTerms={agreementRiseTerms}
        loadingRiseTerms={loadingAgreementRiseTerms || openingAgreementDetails}
        displayContext={{ tenants }}
      />
    </DashboardLayout>
  );
}

export {
  AgreementProvContractBasicInfoStrip,
  AgreementProvInvoiceEditDialog,
  buildAgreementProvContractBasicInfoForm,
  buildAgreementProvEditForm,
  enrichAgreementProvRowWithContractHeaderFields,
  getAgreementProvSaveErrorMessage,
  mergeAgreementProvEditFormContractHeaderFields,
  persistAllInvoiceScheduleLines,
};
