import incomeStatementApi from "services/api.incomestatement.service";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import supplierApi from "services/api.supplier.service";
import { productServiceApi } from "services/api.product.service";
import {
  formatCoaLabel,
  normalizeServiceRecord,
  fetchProductUomOptions,
  buildProductUomLookup,
  formatProductUomLabel,
} from "layouts/products/shared/productUtils";
import { formatAmount } from "layouts/accounts/receipts/receiptUtils";
import {
  getPartyCoaDropdownLabel,
  isSupplierPayableCoaOption,
  mergePartyCoaOption,
  normalizePartyCoaOption,
} from "utils/partyCoaUtils";

export { formatAmount };

export const PURCHASE_INVOICE_PI_NO_PREFIX = "PI";

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

export function getPurchaseInvoiceYearFromDate(dateValue) {
  const text = String(dateValue || "").trim();
  if (!text) return new Date().getFullYear();
  const match = text.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).getFullYear();
  return new Date().getFullYear();
}

export function parsePurchaseInvoicePiNo(piNo) {
  const match = String(piNo || "")
    .trim()
    .match(/^PI-(\d+)\/(\d{4})$/i);
  if (!match) return null;
  const sequence = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isFinite(sequence) || !Number.isFinite(year)) return null;
  return { sequence, year };
}

export function formatPurchaseInvoicePiNo(sequence, year) {
  const seq = Math.max(1, Number(sequence) || 1);
  const yr = Number(year) || new Date().getFullYear();
  return `${PURCHASE_INVOICE_PI_NO_PREFIX}-${seq}/${yr}`;
}

export function computeNextPurchaseInvoicePiNo(existingPiNos, dateValue) {
  const year = getPurchaseInvoiceYearFromDate(dateValue);
  let maxSequence = 0;
  (existingPiNos || []).forEach((piNo) => {
    const parsed = parsePurchaseInvoicePiNo(piNo);
    if (parsed && parsed.year === year) {
      maxSequence = Math.max(maxSequence, parsed.sequence);
    }
  });
  return formatPurchaseInvoicePiNo(maxSequence + 1, year);
}

export async function fetchPurchaseInvoicePiNos(api) {
  if (!api?.listPurchaseInvoices) return [];
  const response = await api.listPurchaseInvoices();
  return unwrapList(response)
    .map((row) => String(row?.piNo ?? row?.PiNo ?? "").trim())
    .filter(Boolean);
}

export function createNewLineDraftId() {
  return `draft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyPurchaseInvoiceLineDraft(overrides = {}) {
  return {
    __draftId: createNewLineDraftId(),
    sortOrder: "1",
    itemCode: "",
    desc: "",
    accHead: "",
    months: "",
    calculatedRentPM: "",
    discountPercent: "0",
    total: "",
    ...overrides,
  };
}

export function buildPurchaseInvoiceFormState(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    piNo: "",
    controlAccountCoaId: "",
    description: "",
    lines: [],
    ...overrides,
  };
}

export function computePurchaseInvoiceLineTotal(months, ratePM, discountPercent) {
  const m = Number(months);
  const r = Number(ratePM);
  if (!Number.isFinite(m) || !Number.isFinite(r)) return null;
  const gross = m * r;
  const d = Number(discountPercent);
  const raw = !Number.isFinite(d) || d <= 0 ? gross : gross - (gross * d) / 100;
  return Math.round(raw);
}

export function getPurchaseInvoiceLineComputedTotal(line) {
  const computed = computePurchaseInvoiceLineTotal(
    line?.months ?? line?.quantity,
    line?.calculatedRentPM ?? line?.unitPrice,
    line?.discountPercent ?? line?.discount
  );
  if (computed != null && Number.isFinite(computed)) return computed;
  const saved = Number(line?.total);
  return Number.isFinite(saved) ? saved : null;
}

export function computePurchaseInvoiceGrandTotal(lines) {
  return (lines || []).reduce((sum, line) => {
    const total = getPurchaseInvoiceLineComputedTotal(line);
    return sum + (total != null && Number.isFinite(total) ? total : 0);
  }, 0);
}

export function normalizePurchaseInvoiceLine(line = {}) {
  const months = line.months ?? line.quantity ?? "";
  const calculatedRentPM = line.calculatedRentPM ?? line.unitPrice ?? "";
  const discountPercent =
    line.discountPercent ??
    line.discount ??
    (String(line.discount ?? "").trim() === "" ? "0" : line.discount);
  const total = computePurchaseInvoiceLineTotal(months, calculatedRentPM, discountPercent);
  return {
    id: line.id || line.__draftId || createNewLineDraftId(),
    __draftId: line.__draftId || line.id || createNewLineDraftId(),
    sortOrder: String(line.sortOrder ?? line.SortOrder ?? "").trim() || "1",
    itemCode: String(line.itemCode ?? line.ItemwithCode ?? line.itemwithCode ?? "").trim(),
    desc: String(
      line.desc ?? line.description ?? line.Description ?? line.particulars ?? ""
    ).trim(),
    accHead: String(line.accHead ?? line.AccHead ?? line.account ?? "").trim(),
    months: months === null || months === undefined ? "" : String(months),
    calculatedRentPM:
      calculatedRentPM === null || calculatedRentPM === undefined ? "" : String(calculatedRentPM),
    discountPercent:
      discountPercent === null ||
      discountPercent === undefined ||
      String(discountPercent).trim() === ""
        ? "0"
        : String(discountPercent),
    total: total != null ? String(total) : String(line.total ?? "").trim(),
    uom: String(line.uom ?? "").trim(),
    uomLabel: String(line.uomLabel ?? "").trim(),
  };
}

export function suggestNextPurchaseInvoiceSortOrder(lines) {
  let max = 0;
  (lines || []).forEach((line) => {
    const n = Number(line?.sortOrder);
    if (Number.isFinite(n)) max = Math.max(max, n);
  });
  return String(max + 1);
}

export function isPurchaseInvoiceLineDraftEmpty(draft) {
  if (!draft) return true;
  const fields = [draft.itemCode, draft.desc, draft.accHead, draft.months, draft.calculatedRentPM];
  return fields.every((v) => v === null || v === undefined || String(v).trim() === "");
}

function isFilled(value) {
  return !(value === null || value === undefined || String(value).trim() === "");
}

export function getPurchaseInvoiceLineEffectiveAccHead(draft, productOptions = []) {
  const stored = String(draft?.accHead ?? "").trim();
  if (stored) return stored;
  const itemCode = String(draft?.itemCode ?? "").trim();
  if (!itemCode || !productOptions?.length) return "";
  const product = findPurchaseInvoiceProductOption(productOptions, itemCode);
  return resolveItemWithCodePurchaseAccHead(product);
}

export function validatePurchaseInvoiceLineDraft(draft, productOptions = []) {
  if (!isFilled(draft?.itemCode)) return "Item with Code is required.";
  if (!isFilled(getPurchaseInvoiceLineEffectiveAccHead(draft, productOptions))) {
    return "Acc Head is required.";
  }
  if (!isFilled(draft?.desc)) return "Particular is required.";
  if (!isFilled(draft?.months) || String(draft?.months).trim() === "-") return "Qty is required.";
  const qty = Number(draft?.months);
  if (!Number.isFinite(qty) || qty === 0) return "Qty must be a non-zero number.";
  if (!isFilled(draft?.calculatedRentPM)) return "Unit Price is required.";
  const total = getPurchaseInvoiceLineComputedTotal(draft);
  if (total === null || !Number.isFinite(total) || total === 0) {
    return "Total must be a non-zero amount.";
  }
  return "";
}

export function getFirstIncompletePurchaseInvoiceDraftError(lines, productOptions = []) {
  const drafts = lines || [];
  for (let i = 0; i < drafts.length; i += 1) {
    const draft = drafts[i];
    if (isPurchaseInvoiceLineDraftEmpty(draft)) {
      return "Complete or cancel the empty invoice row before adding another.";
    }
    const err = validatePurchaseInvoiceLineDraft(draft, productOptions);
    if (err) return err;
  }
  return "";
}

export function validatePurchaseInvoiceForm(form, productOptions = []) {
  const errors = {};
  if (!String(form?.date || "").trim()) errors.date = "Date is required";
  if (!String(form?.piNo || "").trim()) errors.piNo = "PI No is required";

  const lines = form?.lines || [];
  if (!lines.length) {
    errors.lines = "At least one line item is required";
  } else {
    const incomplete = getFirstIncompletePurchaseInvoiceDraftError(lines, productOptions);
    if (incomplete) errors.lines = incomplete;
  }
  return errors;
}

export function sanitizeIntegerInputValue(raw) {
  const s = String(raw ?? "");
  if (s === "") return "";
  return s.replace(/\D/g, "");
}

export function sanitizeSignedIntegerInputValue(raw) {
  const s = String(raw ?? "");
  if (s === "" || s === "-") return s;
  const negative = s.trimStart().startsWith("-");
  const digits = s.replace(/\D/g, "");
  if (!digits) return negative ? "-" : "";
  return negative ? `-${digits}` : digits;
}

export function sanitizeDecimalNumericInputValue(raw) {
  let s = String(raw ?? "").replace(/[^\d.]/g, "");
  const dot = s.indexOf(".");
  if (dot >= 0) {
    s = `${s.slice(0, dot + 1)}${s.slice(dot + 1).replace(/\./g, "")}`;
  }
  return s;
}

export function formatPurchaseInvoiceGridNumber(value, integerOnly = false) {
  if (value === null || value === undefined || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  const display = integerOnly ? Math.round(n) : n;
  return display.toLocaleString(undefined, integerOnly ? { maximumFractionDigits: 0 } : undefined);
}

function normalizeAccHeadKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isExpensesGroup(row) {
  return pickField(row, "groupName", "GroupName").toLowerCase() === "expenses";
}

/** Acc Head options: Expenses group (Income Statement + any Balance Sheet COA with Expenses). */
export async function fetchPurchaseInvoiceAccHeadOptions() {
  const [incomeResponse, coaResponse] = await Promise.all([
    incomeStatementApi.getAll().catch(() => []),
    chartOfAccountsApi.getAll(COA_SECTION_TYPE).catch(() => []),
  ]);

  const byKey = new Map();
  const pushRow = (row, source) => {
    if (!isExpensesGroup(row)) return;
    const id = row?.id ?? row?.Id;
    const label = formatCoaLabel(row);
    if (!label) return;
    const key = normalizeAccHeadKey(label);
    if (byKey.has(key)) return;
    byKey.set(key, {
      value: label,
      label,
      id,
      source,
      acctId: pickField(row, "acctId", "AcctId"),
      acctName: pickField(row, "acctName", "AcctName"),
      groupName: pickField(row, "groupName", "GroupName"),
    });
  };

  unwrapList(incomeResponse).forEach((row) => pushRow(row, "is"));
  unwrapList(coaResponse).forEach((row) => pushRow(row, "coa"));

  return [...byKey.values()].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

export function withSavedAccHeadOption(options = [], savedAccHead = "") {
  const saved = String(savedAccHead || "").trim();
  if (!saved) return options || [];
  const key = normalizeAccHeadKey(saved);
  if ((options || []).some((opt) => normalizeAccHeadKey(opt.value) === key)) {
    return options;
  }
  return [{ value: saved, label: saved }, ...(options || [])];
}

export function resolveItemWithCodePurchaseAccHead(productOrService) {
  if (!productOrService) return "";
  return String(productOrService.purchaseAccountDisplay || "").trim();
}

function isActiveProductServiceStatus(status) {
  return (
    String(status || "Active")
      .trim()
      .toLowerCase() !== "inactive"
  );
}

export function getPurchaseInvoiceProductOptionLabel(option) {
  if (!option) return "";
  const code = String(option.itemCode || "").trim();
  const name = String(option.itemName || "").trim();
  const uom = String(option.uomLabel || option.uom || "").trim();
  return [code, name, uom].filter((part) => part && part !== "-").join(" — ");
}

export function buildActivePurchaseInvoiceProductOptions(serviceRows, uomLookup = {}) {
  return (serviceRows || [])
    .map(normalizeServiceRecord)
    .filter((row) => row?.id != null && isActiveProductServiceStatus(row.status))
    .map((row) => {
      const uomRaw = String(row.uom || "").trim();
      const uomLabel = uomRaw ? formatProductUomLabel(uomRaw, uomLookup) : "";
      return {
        ...row,
        uomLabel: uomLabel && uomLabel !== "-" ? uomLabel : uomRaw,
        label: getPurchaseInvoiceProductOptionLabel({
          itemCode: row.itemCode,
          itemName: row.itemName,
          uomLabel: uomLabel && uomLabel !== "-" ? uomLabel : uomRaw,
        }),
      };
    })
    .filter((row) => Boolean(String(row.itemCode || "").trim()))
    .sort((a, b) =>
      getPurchaseInvoiceProductOptionLabel(a).localeCompare(
        getPurchaseInvoiceProductOptionLabel(b),
        undefined,
        { sensitivity: "base" }
      )
    );
}

export function findPurchaseInvoiceProductOption(options, itemCode) {
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

export function findPurchaseInvoiceProductByAccHead(options, accHead, preferredItemCode = "") {
  const key = normalizeAccHeadKey(accHead);
  if (!key) return null;
  const matches = (options || []).filter(
    (option) => normalizeAccHeadKey(resolveItemWithCodePurchaseAccHead(option)) === key
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

function buildSuppliersByPayableCoaId(suppliers) {
  const map = new Map();
  (suppliers || []).forEach((row) => {
    const coaId = row?.coaId ?? row?.CoaId;
    if (coaId == null || coaId === "") return;
    const key = Number(coaId);
    if (!Number.isFinite(key)) return;
    const code = pickField(row, "code", "Code", "supplierCode", "SupplierCode");
    const name = pickField(row, "name", "Name");
    if (!map.has(key)) map.set(key, []);
    map.get(key).push({ code, name });
  });
  return map;
}

function formatPurchaseInvoiceSupplierDropdownLabel(coaOption, suppliersForCoa = []) {
  const controlAccountLabel = getPartyCoaDropdownLabel(coaOption);
  const controlPart = controlAccountLabel ? `Control Account: ${controlAccountLabel}` : "";
  const supplier = suppliersForCoa[0];
  if (supplier) {
    const supplierPart = [supplier.code, supplier.name].filter(Boolean).join(" - ");
    if (supplierPart && controlPart) return `${supplierPart} — ${controlPart}`;
    return supplierPart || controlPart;
  }
  return controlPart || controlAccountLabel;
}

function formatPurchaseInvoiceSupplierDisplayValue(coaOption, suppliersForCoa = []) {
  const supplier = suppliersForCoa[0];
  if (supplier) {
    return [supplier.code, supplier.name].filter(Boolean).join(" - ");
  }
  return getPartyCoaDropdownLabel(coaOption);
}

export async function fetchPurchaseInvoiceControlAccountOptions(savedCoaId = null) {
  const [coaResponse, supplierResponse] = await Promise.all([
    chartOfAccountsApi.getAll(COA_SECTION_TYPE).catch(() => []),
    supplierApi.listSuppliers().catch(() => []),
  ]);
  const rows = chartOfAccountsApi.unwrapList(coaResponse) || [];
  const suppliers = supplierApi.unwrapList(supplierResponse) || [];
  const suppliersByCoaId = buildSuppliersByPayableCoaId(suppliers);
  let options = rows
    .map(normalizePartyCoaOption)
    .filter((row) => row.id != null && isSupplierPayableCoaOption(row));

  const coaId = savedCoaId === "" || savedCoaId == null ? null : Number(savedCoaId);
  if (Number.isFinite(coaId) && !options.some((opt) => Number(opt.id) === coaId)) {
    const savedRow = rows.find((row) => Number(row?.id ?? row?.Id) === coaId);
    if (savedRow) {
      const savedOption = normalizePartyCoaOption(savedRow);
      if (savedOption.id != null) {
        options = mergePartyCoaOption(options, savedOption);
      }
    }
  }

  return options
    .map((row) => {
      const linkedSuppliers = suppliersByCoaId.get(Number(row.id)) || [];
      const label = formatPurchaseInvoiceSupplierDropdownLabel(row, linkedSuppliers);
      const displayValue = formatPurchaseInvoiceSupplierDisplayValue(row, linkedSuppliers);
      const searchLabel = [
        ...linkedSuppliers.flatMap((supplier) => [supplier.code, supplier.name]),
        getPartyCoaDropdownLabel(row),
      ]
        .filter(Boolean)
        .join(" ");
      return {
        id: row.id,
        label,
        displayValue,
        searchLabel: searchLabel || label,
      };
    })
    .filter((row) => row.label)
    .sort((a, b) =>
      String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" })
    );
}

export async function loadPurchaseInvoiceFormCatalogs(savedControlAccountCoaId = null) {
  const [servicesResponse, uomRows, accHeadOptions, controlAccountOptions] = await Promise.all([
    productServiceApi.getAll(1, 10000).catch(() => []),
    fetchProductUomOptions().catch(() => []),
    fetchPurchaseInvoiceAccHeadOptions(),
    fetchPurchaseInvoiceControlAccountOptions(savedControlAccountCoaId),
  ]);
  const uomLookup = buildProductUomLookup(Array.isArray(uomRows) ? uomRows : []);
  return {
    productOptions: buildActivePurchaseInvoiceProductOptions(
      unwrapList(servicesResponse),
      uomLookup
    ),
    accHeadOptions,
    controlAccountOptions,
  };
}

export function flattenPurchaseInvoiceForGrid(record) {
  const lines = record?.lines || [];
  if (!lines.length) {
    return [
      {
        ...record,
        item: "",
        account: "",
        total: record?.grandTotal ?? 0,
      },
    ];
  }
  return lines.map((line, index) => ({
    ...record,
    lineIndex: index,
    item: line.itemCode || "",
    account: line.accHead || "",
    particular: line.desc || "",
    total: getPurchaseInvoiceLineComputedTotal(line) ?? 0,
  }));
}
