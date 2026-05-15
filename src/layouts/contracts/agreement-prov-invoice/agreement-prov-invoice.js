import React, { useState, useEffect, useMemo } from "react";
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
import PropTypes from "prop-types";
import api from "services/api.service";
import contractApi from "services/api.contract.service";
import { useMaterialUIController } from "context";
import jsPDF from "jspdf";
import { format, parseISO, isValid } from "date-fns";

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

function formatScheduleGridNumber(value) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString() : String(value);
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

function getInvoiceScheduleRouteKeys(row, form) {
  const contractNo = String(
    form?.contractNo ?? pickScheduleRowField(row || {}, "ContractNo", "contractNo") ?? ""
  ).trim();
  const invoiceNo = String(
    form?.invoiceNo ?? pickScheduleRowField(row || {}, "InvoiceNo", "invoiceNo") ?? ""
  ).trim();
  return { contractNo, invoiceNo };
}

function toScheduleNumberOrNull(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
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
  };
}

function getAgreementProvSaveErrorMessage(error) {
  const rawMessage = String(error?.message || "").trim();
  const httpMatch = rawMessage.match(/^HTTP\s+\d+\s+[^:]+:\s*(.*)$/i);
  if (httpMatch?.[1]?.trim()) return httpMatch[1].trim();
  return rawMessage || "Failed to save invoice schedule. Please try again.";
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
    invoiceDateType: String(pickScheduleRowField(row, "InvoiceDateType", "invoiceDateType") || ""),
    invoiceStatus: String(pickScheduleRowField(row, "InvoiceStatus", "invoiceStatus") || ""),
  };
}

function AgreementProvInvoiceEditDialog({ open, onClose, rowData, onSave, saving }) {
  const [form, setForm] = useState({});

  useEffect(() => {
    if (open && rowData) {
      setForm(buildAgreementProvEditForm(rowData));
    }
  }, [open, rowData]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSave = async () => {
    if (!onSave) return;
    await onSave(form, rowData);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        Edit Agreement Invoice
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0.5}>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Contract No"
              value={form.contractNo || ""}
              onChange={handleChange("contractNo")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Invoice ID"
              value={form.invoiceNo || ""}
              onChange={handleChange("invoiceNo")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Contract Start Date"
              type="date"
              value={form.contractStartDate || ""}
              onChange={handleChange("contractStartDate")}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Contract End Date"
              type="date"
              value={form.contractEndDate || ""}
              onChange={handleChange("contractEndDate")}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Invoice Date"
              type="date"
              value={form.invoiceDate || ""}
              onChange={handleChange("invoiceDate")}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Due Date"
              type="date"
              value={form.dueDate || ""}
              onChange={handleChange("dueDate")}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Period Start"
              type="date"
              value={form.periodStart || ""}
              onChange={handleChange("periodStart")}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Period End"
              type="date"
              value={form.periodEnd || ""}
              onChange={handleChange("periodEnd")}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MDInput
              label="Rate PM"
              value={form.calculatedRentPM ?? ""}
              onChange={handleChange("calculatedRentPM")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MDInput
              label="Months"
              value={form.months ?? ""}
              onChange={handleChange("months")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MDInput
              label="Net Amount"
              value={form.totalRent ?? ""}
              onChange={handleChange("totalRent")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MDInput
              label="Amount Received"
              value={form.amountReceived ?? ""}
              onChange={handleChange("amountReceived")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MDInput
              label="Amount Receivable"
              value={form.amountReceivable ?? ""}
              onChange={handleChange("amountReceivable")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <MDInput
              label="Amount Pending"
              value={form.amountPending ?? ""}
              onChange={handleChange("amountPending")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Business Name"
              value={form.businessName || ""}
              onChange={handleChange("businessName")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Invoice Date Type"
              value={form.invoiceDateType || ""}
              onChange={handleChange("invoiceDateType")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Invoice Status"
              value={form.invoiceStatus || ""}
              onChange={handleChange("invoiceStatus")}
              fullWidth
              size="small"
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              label="Remarks"
              value={form.remarks || ""}
              onChange={handleChange("remarks")}
              fullWidth
              size="small"
              multiline
              minRows={2}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          Close
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </MDButton>
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
  const [savingEdit, setSavingEdit] = useState(false);
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
      ? renderClickableAmountCell
      : // eslint-disable-next-line react/prop-types
        ({ row }) => {
          const rowData = row?.original || {};
          return formatScheduleGridNumber(pickScheduleRowField(rowData, pascalKey, camelKey));
        },
  });

  const handleOpenEditRow = (rowData) => {
    setEditRowData(rowData);
    setEditDialogOpen(true);
  };

  const handleCloseEditRow = () => {
    setEditDialogOpen(false);
    setEditRowData(null);
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
      if (rowData.isGroupRow || rowData.IsGroupRow) return "";
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
    Header: "View PDF",
    accessor: "generatePdf",
    align: "center",
    width: "100px",
    disableSortBy: true,
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
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
      return formatDateDDMMMYYYY(pickScheduleInvoiceDate(rowData));
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
      return formatDateDDMMMYYYY(pickScheduleRowField(rowData, "DueDate", "dueDate"));
    },
  };

  const commandColumn = {
    id: "cmdId",
    Header: "Command",
    accessor: "cmdId",
    align: "left",
    // eslint-disable-next-line react/prop-types
    Cell: ({ row }) => {
      // eslint-disable-next-line react/prop-types
      const rowData = row?.original || {};
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
      const statusValue = pickScheduleRowField(rowData, "InvoiceStatus", "invoiceStatus");
      return statusValue === "" ? "-" : String(statusValue);
    },
  };

  // Primary column order, then remaining API fields
  const columns = [
    viewPdfColumn,
    actionColumn,
    scheduleTextColumn("contractNo", "Contract No", "ContractNo", "contractNo", "right"),
    contractPeriodColumn,
    scheduleTextColumn("invoiceNo", "Invoice ID", "InvoiceNo", "invoiceNo"),
    invoiceDateColumn,
    dueDateColumn,
    periodColumn,
    scheduleNumberColumn("calculatedRentPM", "Rate PM", "CalculatedRentPM", "calculatedRentPM"),
    scheduleNumberColumn("months", "Months", "Months", "months"),
    scheduleNumberColumn("totalRent", "Net Amount", "TotalRent", "totalRent", true),
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

    scheduleTextColumn("businessName", "Business Name", "BusinessName", "businessName"),

    scheduleTextColumn(
      "invoiceDateType",
      "Invoice Date Type",
      "InvoiceDateType",
      "invoiceDateType"
    ),

    invoiceStatusColumn,
  ];

  const groupingColumnOptions = [
    { label: "Contract No", value: "contractNo" },
    { label: "Contract ID", value: "contractId" },
    { label: "Business Name", value: "businessName" },
    { label: "Invoice ID", value: "invoiceNo" },
    { label: "Invoice Status", value: "invoiceStatus" },
    { label: "Invoice Date Type", value: "invoiceDateType" },
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
      return {
        ...row,
        cmdName: cmd?.name || (cmdId !== "" && cmdId != null ? String(cmdId) : ""),
        baseName: base?.name || (baseId !== "" && baseId != null ? String(baseId) : ""),
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

  const computedRows = groupedData;

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
      />
    </DashboardLayout>
  );
}
