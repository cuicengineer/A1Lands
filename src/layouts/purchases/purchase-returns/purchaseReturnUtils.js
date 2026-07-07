import supplierApi from "services/api.supplier.service";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import {
  createLineRow,
  fetchReceiptProductOptions,
  formatAmount,
  parseAmount,
  resolveReceiptProductAccountOption,
  buildLineAccountOptions,
} from "layouts/accounts/receipts/receiptUtils";

export {
  formatAmount,
  parseAmount,
  fetchReceiptProductOptions as fetchPurchaseReturnProductOptions,
};

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function createPurchaseReturnLineRow(overrides = {}) {
  return createLineRow({
    particulars: "",
    quantity: "",
    unitPrice: "",
    amount: "",
    discount: "0",
    total: 0,
    ...overrides,
  });
}

export function computePurchaseReturnLineAmount(line) {
  const qty = parseAmount(line?.quantity);
  const unitPrice = parseAmount(line?.unitPrice);
  const gross = qty * unitPrice;
  const discountPercent = Math.max(0, parseAmount(line?.discount));
  if (discountPercent <= 0) return gross;
  return gross - (gross * discountPercent) / 100;
}

export function syncPurchaseReturnLineAmount(line) {
  const normalized = {
    ...line,
    discount: String(line?.discount ?? "").trim() === "" ? "0" : String(line.discount),
  };
  const amount = computePurchaseReturnLineAmount(normalized);
  return {
    ...normalized,
    amount: amount > 0 ? String(amount) : "",
    total: amount,
  };
}

export function computePurchaseReturnGrandTotal(lines) {
  return (lines || []).reduce((sum, line) => sum + computePurchaseReturnLineAmount(line), 0);
}

export function buildPurchaseReturnFormState(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    vrNo: "",
    supplierKey: "",
    supplierId: "",
    supplierCode: "",
    supplierLabel: "",
    purchaseInvoiceNo: "",
    purchaseInvoiceLabel: "",
    description: "",
    lines: [],
    ...overrides,
  };
}

export const PURCHASE_RETURN_VR_NO_PREFIX = "PR";

export function getPurchaseReturnYearFromDate(dateValue) {
  const text = String(dateValue || "").trim();
  if (!text) return new Date().getFullYear();
  const match = text.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).getFullYear();
  return new Date().getFullYear();
}

export function parsePurchaseReturnVrNo(vrNo) {
  const match = String(vrNo || "")
    .trim()
    .match(/^PR-(\d+)\/(\d{4})$/i);
  if (!match) return null;
  const sequence = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isFinite(sequence) || !Number.isFinite(year)) return null;
  return { sequence, year };
}

export function formatPurchaseReturnVrNo(sequence, year) {
  const seq = Math.max(1, Number(sequence) || 1);
  const yr = Number(year) || new Date().getFullYear();
  return `${PURCHASE_RETURN_VR_NO_PREFIX}-${seq}/${yr}`;
}

export function computeNextPurchaseReturnVrNo(existingVrNos, dateValue) {
  const year = getPurchaseReturnYearFromDate(dateValue);
  let maxSequence = 0;
  (existingVrNos || []).forEach((vrNo) => {
    const parsed = parsePurchaseReturnVrNo(vrNo);
    if (parsed && parsed.year === year) {
      maxSequence = Math.max(maxSequence, parsed.sequence);
    }
  });
  return formatPurchaseReturnVrNo(maxSequence + 1, year);
}

export async function fetchPurchaseReturnVrNos(api) {
  if (!api?.listPurchaseReturns) return [];
  const response = await api.listPurchaseReturns();
  const rows = Array.isArray(response) ? response : response?.data ?? [];
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.vrNo ?? row?.VrNo ?? "").trim())
    .filter(Boolean);
}

export function buildPurchaseReturnSupplierOptions(suppliers) {
  return (suppliers || [])
    .map((row) => {
      const id = row?.id ?? row?.Id;
      const code = pickField(row, "supplierCode", "SupplierCode", "code", "Code");
      const name = pickField(row, "name", "Name");
      const label = [code, name].filter(Boolean).join(" - ") || name || String(id || "");
      if (!id || !label) return null;
      return {
        value: String(id),
        label,
        supplierId: id,
        supplierCode: code,
        supplierLabel: label,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function findPurchaseReturnSupplierOption(options, key) {
  const value = String(key || "").trim();
  if (!value) return null;
  return (options || []).find((option) => String(option.value) === value) || null;
}

export async function loadPurchaseReturnFormCatalogs() {
  const [supplierRes, coaRes, productRes] = await Promise.allSettled([
    supplierApi.listSuppliers(),
    chartOfAccountsApi.getAll(COA_SECTION_TYPE),
    fetchReceiptProductOptions(),
  ]);

  const suppliers =
    supplierRes.status === "fulfilled" ? supplierApi.unwrapList(supplierRes.value) : [];
  const coaRows = coaRes.status === "fulfilled" ? chartOfAccountsApi.unwrapList(coaRes.value) : [];
  const products = productRes.status === "fulfilled" ? productRes.value : [];

  return {
    supplierOptions: buildPurchaseReturnSupplierOptions(suppliers),
    accountOptions: buildLineAccountOptions(coaRows),
    productOptions: products,
  };
}

export function applyPurchaseReturnProductSelection(
  line,
  productKey,
  productOptions,
  accountOptions
) {
  const product = (productOptions || []).find((option) => option.value === productKey);
  if (!product) {
    return syncPurchaseReturnLineAmount({
      ...line,
      productKey: "",
      productType: "",
      productId: "",
      item: "",
      account: "",
      accountCoaId: "",
    });
  }
  const accountOption = resolveReceiptProductAccountOption(product, accountOptions);
  return syncPurchaseReturnLineAmount({
    ...line,
    productKey: product.value,
    productType: product.productType || "",
    productId: product.productId || "",
    item: product.label || "",
    account: accountOption?.label || product.saleAccountDisplay || "",
    accountCoaId: accountOption?.coaId || accountOption?.value || "",
    unitPrice:
      line.unitPrice !== "" && line.unitPrice != null
        ? line.unitPrice
        : product.defaultUnitPrice != null && product.defaultUnitPrice !== ""
        ? String(product.defaultUnitPrice)
        : "",
  });
}

export function isPurchaseReturnLineComplete(line) {
  if (!line) return false;
  return (
    Boolean(String(line.item || "").trim()) &&
    Boolean(String(line.account || "").trim()) &&
    parseAmount(line.quantity) > 0 &&
    parseAmount(line.unitPrice) > 0
  );
}

export function validatePurchaseReturnForm(form) {
  const errors = {};
  if (!form.date) errors.date = "Date is required";
  if (!String(form.vrNo || "").trim()) errors.vrNo = "Vr No is required";
  if (!String(form.supplierKey || "").trim()) {
    errors.supplierKey = "Supplier is required";
  }
  if (!String(form.purchaseInvoiceNo || "").trim()) {
    errors.purchaseInvoiceNo = "Purchase Invoice is required";
  }

  const lines = form.lines || [];
  if (!lines.length) errors.lines = "At least one line item is required";

  lines.forEach((line, idx) => {
    if (!line.item) errors[`line-${idx}-item`] = "Item is required";
    if (!line.account) errors[`line-${idx}-account`] = "Account is required";
    if (parseAmount(line.quantity) <= 0) errors[`line-${idx}-quantity`] = "Qty is required";
    if (parseAmount(line.unitPrice) <= 0) {
      errors[`line-${idx}-unitPrice`] = "Unit Price is required";
    }
  });

  return errors;
}

export function flattenPurchaseReturnForGrid(record, index, { attachmentCount = 0 } = {}) {
  const firstLine = record?.lines?.[0] || {};
  const grandTotal = computePurchaseReturnGrandTotal(record?.lines);
  return {
    id: record.id,
    sno: index + 1,
    date: record.date || "",
    vrNo: record.vrNo || "-",
    supplier: record.supplierLabel || "-",
    purchaseInvoice: record.purchaseInvoiceLabel || record.purchaseInvoiceNo || "-",
    description: record.description || "-",
    item: firstLine.item || (record.lines?.length > 1 ? `${record.lines.length} items` : "-"),
    account: firstLine.account || "-",
    total: grandTotal,
    attachmentCount,
    _record: record,
  };
}
