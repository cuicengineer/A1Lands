export const PAID_FROM_ACCOUNTS = [
  "Main Operating Account",
  "Petty Cash",
  "Suspense",
  "Bank Clearing",
];

export const PAYEE_CONTACT_TYPES = ["Other", "Customer", "Supplier"];

export const RAC_OPTIONS = [
  { id: 1, name: "AHQ" },
  { id: 2, name: "Northern Command" },
  { id: 3, name: "Southern Command" },
];

export const BASE_OPTIONS = [
  { id: 1, name: "Base Alpha", racId: 1 },
  { id: 2, name: "Base Bravo", racId: 2 },
  { id: 3, name: "Base Charlie", racId: 3 },
];

export const ITEM_OPTIONS = [
  "Office Supplies",
  "Utilities",
  "Professional Services",
  "Equipment",
  "Maintenance",
];

export const LINE_ACCOUNT_OPTIONS = ["Suspense", "Expenses", "Receivable", "Clearing"];

export const MAX_ATTACHMENT_FILES = 5;

export function createLineRow(overrides = {}) {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    racId: "",
    baseId: "",
    item: "",
    account: "Suspense",
    tinTrn: "",
    amount: "",
    total: 0,
    ...overrides,
  };
}

export function buildReceiptFormState(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    referenceAutomatic: true,
    reference: "Automatic",
    paidFrom: "",
    payeeContactType: "Supplier",
    payeeName: "",
    description: "",
    lines: [createLineRow()],
    attachments: [],
    ...overrides,
  };
}

export function parseAmount(value) {
  const n = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
}

export function computeLineTotal(line) {
  return parseAmount(line?.amount);
}

export function computeGrandTotal(lines) {
  return (lines || []).reduce((sum, line) => sum + computeLineTotal(line), 0);
}

export function formatAmount(value) {
  const n = parseAmount(value);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function getRacName(racId, options = RAC_OPTIONS) {
  const row = options.find((o) => Number(o.id) === Number(racId));
  return row?.name || "";
}

export function getBaseName(baseId, options = BASE_OPTIONS) {
  const row = options.find((o) => Number(o.id) === Number(baseId));
  return row?.name || "";
}

export function flattenReceiptForGrid(receipt, index) {
  const firstLine = receipt?.lines?.[0] || {};
  const grandTotal = computeGrandTotal(receipt?.lines);
  return {
    id: receipt.id,
    sno: index + 1,
    date: receipt.date || "",
    reference: receipt.referenceAutomatic
      ? receipt.reference || "Automatic"
      : receipt.reference || "",
    paidFrom: receipt.paidFrom || "",
    payee: [receipt.payeeContactType, receipt.payeeName].filter(Boolean).join(" - ") || "-",
    racDisplay: getRacName(firstLine.racId) || "-",
    baseDisplay: getBaseName(firstLine.baseId) || "-",
    item: firstLine.item || (receipt.lines?.length > 1 ? `${receipt.lines.length} items` : "-"),
    account: firstLine.account || "-",
    tinTrn: firstLine.tinTrn || "-",
    amount: grandTotal,
    total: grandTotal,
    attachmentCount: Array.isArray(receipt.attachments) ? receipt.attachments.length : 0,
    _receipt: receipt,
  };
}
