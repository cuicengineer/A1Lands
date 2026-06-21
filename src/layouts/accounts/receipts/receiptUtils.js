import { COA_GROUP_OPTIONS } from "services/api.chartofaccounts.service";

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

export const MAX_ATTACHMENT_FILES = 5;

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function formatLineAccountLabel(controlAccount, groupName) {
  const account = String(controlAccount || "").trim();
  const group = String(groupName || "").trim();
  if (!account) return "";
  return group ? `${account} - ${group}` : account;
}

const COA_GROUP_SORT_RANK = COA_GROUP_OPTIONS.reduce((acc, name, index) => {
  acc[name.toLowerCase()] = index;
  return acc;
}, {});

function getGroupSortRank(groupName) {
  const key = String(groupName || "")
    .trim()
    .toLowerCase();
  if (key in COA_GROUP_SORT_RANK) return COA_GROUP_SORT_RANK[key];
  return COA_GROUP_OPTIONS.length;
}

function compareLineAccountOptions(a, b) {
  const groupDiff = getGroupSortRank(a.groupName) - getGroupSortRank(b.groupName);
  if (groupDiff !== 0) return groupDiff;
  return String(a.controlAccount).localeCompare(String(b.controlAccount), undefined, {
    sensitivity: "base",
  });
}

export function normalizeLineAccountOption(row) {
  const controlAccount = pickField(row, "controlAccount", "ControlAccount");
  const groupName = pickField(row, "groupName", "GroupName");
  if (!controlAccount) return null;

  const value = formatLineAccountLabel(controlAccount, groupName);
  return {
    controlAccount,
    groupName,
    value,
    label: value,
  };
}

export function buildLineAccountOptions(coaRows, savedAccounts = []) {
  const byValue = new Map();

  (coaRows || []).forEach((row) => {
    const option = normalizeLineAccountOption(row);
    if (option?.value) byValue.set(option.value, option);
  });

  (savedAccounts || []).forEach((saved) => {
    const trimmed = String(saved || "").trim();
    if (!trimmed || byValue.has(trimmed)) return;
    byValue.set(trimmed, {
      controlAccount: trimmed,
      groupName: "",
      value: trimmed,
      label: trimmed,
    });
  });

  return [...byValue.values()].sort(compareLineAccountOptions);
}

const MONTH_SHORT = [
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

const MONTH_YEAR_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}$/;

export function currentMonthYear() {
  const now = new Date();
  return `${MONTH_SHORT[now.getMonth()]}/${now.getFullYear()}`;
}

export function monthYearToInputValue(mmmYyyy) {
  const match = String(mmmYyyy || "")
    .trim()
    .match(/^([A-Za-z]{3})\/(\d{4})$/);
  if (!match) return "";
  const monthIndex = MONTH_SHORT.findIndex((name) => name.toLowerCase() === match[1].toLowerCase());
  if (monthIndex < 0) return "";
  return `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function inputValueToMonthYear(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return "";
  const [year, month] = yyyyMm.split("-");
  const monthLabel = MONTH_SHORT[Number(month) - 1];
  return monthLabel ? `${monthLabel}/${year}` : "";
}

export function isValidMonthYear(value) {
  return MONTH_YEAR_PATTERN.test(String(value || "").trim());
}

export function createLineRow(overrides = {}) {
  return {
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    racId: "",
    baseId: "",
    item: "",
    account: "",
    tinTrn: "",
    amount: "",
    total: 0,
    ...overrides,
  };
}

export function isReceiptLineComplete(line) {
  if (!line) return false;
  return (
    Boolean(String(line.item || "").trim()) &&
    Boolean(String(line.account || "").trim()) &&
    parseAmount(line.amount) > 0
  );
}

export function buildReceiptFormState(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    month: currentMonthYear(),
    referenceAutomatic: true,
    reference: "Automatic",
    paidFrom: "",
    payeeContactType: "Supplier",
    payeeName: "",
    description: "",
    finalizedByAhq: false,
    lines: [],
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

export function isReceiptFinalizedByAhq(receipt) {
  return Boolean(receipt?.finalizedByAhq);
}

export const RECEIPT_AHQ_TAB = {
  PENDING: "pending",
  FINALIZED: "finalized",
};

export function flattenReceiptForGrid(receipt, index) {
  const firstLine = receipt?.lines?.[0] || {};
  const grandTotal = computeGrandTotal(receipt?.lines);
  return {
    id: receipt.id,
    sno: index + 1,
    date: receipt.date || "",
    month: receipt.month || "",
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
