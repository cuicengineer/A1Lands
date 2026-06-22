import { COA_GROUP_OPTIONS } from "services/api.chartofaccounts.service";
import {
  buildInvoiceKey,
  formatAgreementPeriodLabel,
  formatContractNoLabel,
  isFinalizedContract,
  normalizeCatalogRow,
  normalizeTinTrn,
} from "layouts/income-agreements/collections/collectionsUtils";

export const PAID_FROM_ACCOUNTS = [
  "Main Operating Account",
  "Petty Cash",
  "Suspense",
  "Bank Clearing",
];

export const PAYEE_CONTACT_TYPES = ["Other", "Customer", "Supplier", "Tenant"];

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

export function formatLineAccountLabel(acctId, acctName, controlAccount) {
  const id = String(acctId || "").trim();
  const name = String(acctName || "").trim();
  const control = String(controlAccount || "").trim();
  const base = id && name ? `${id} - ${name}` : id || name;
  if (!base) return control;
  return control ? `${base} - ${control}` : base;
}

const GROUP_COLOR_PALETTE = [
  { bg: "rgba(25, 118, 210, 0.14)", accent: "#1976d2" },
  { bg: "rgba(211, 47, 47, 0.14)", accent: "#d32f2f" },
  { bg: "rgba(46, 125, 50, 0.14)", accent: "#2e7d32" },
  { bg: "rgba(156, 39, 176, 0.14)", accent: "#9c27b0" },
  { bg: "rgba(245, 124, 0, 0.14)", accent: "#f57c00" },
  { bg: "rgba(0, 151, 167, 0.14)", accent: "#0097a7" },
  { bg: "rgba(94, 53, 177, 0.14)", accent: "#5e35b1" },
  { bg: "rgba(0, 105, 92, 0.14)", accent: "#00695c" },
];

const KNOWN_GROUP_COLORS = COA_GROUP_OPTIONS.reduce((acc, name, index) => {
  acc[name.toLowerCase()] = GROUP_COLOR_PALETTE[index % GROUP_COLOR_PALETTE.length];
  return acc;
}, {});

const assignedGroupColors = new Map();

function hashGroupColorIndex(groupName) {
  const key = String(groupName || "")
    .trim()
    .toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % GROUP_COLOR_PALETTE.length;
}

export function getCoaGroupColor(groupName) {
  const key = String(groupName || "").trim();
  if (!key) {
    return { bg: "rgba(158, 158, 158, 0.1)", accent: "#9e9e9e" };
  }
  const knownKey = key.toLowerCase();
  if (knownKey in KNOWN_GROUP_COLORS) return KNOWN_GROUP_COLORS[knownKey];
  if (!assignedGroupColors.has(knownKey)) {
    assignedGroupColors.set(knownKey, GROUP_COLOR_PALETTE[hashGroupColorIndex(key)]);
  }
  return assignedGroupColors.get(knownKey);
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
  const groupNameDiff = String(a.groupName).localeCompare(String(b.groupName), undefined, {
    sensitivity: "base",
  });
  if (groupNameDiff !== 0) return groupNameDiff;
  const idDiff = String(a.acctId).localeCompare(String(b.acctId), undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (idDiff !== 0) return idDiff;
  return String(a.acctName).localeCompare(String(b.acctName), undefined, {
    sensitivity: "base",
  });
}

export function findLineAccountOption(options, ref) {
  if (ref == null) return null;
  if (typeof ref !== "object") {
    const directValue = String(ref);
    return (
      (options || []).find(
        (option) =>
          String(option.value) === directValue ||
          String(option.label) === directValue ||
          String(option.coaId ?? option.id) === directValue
      ) || null
    );
  }
  const coaId = ref?.accountCoaId ?? ref?.coaId;
  if (coaId != null && coaId !== "") {
    const byCoaId = (options || []).find(
      (option) => Number(option.coaId ?? option.id) === Number(coaId)
    );
    if (byCoaId) return byCoaId;
  }
  if (ref?.account) {
    return (
      (options || []).find(
        (option) =>
          String(option.label) === String(ref.account) ||
          String(option.value) === String(ref.account)
      ) || null
    );
  }
  return null;
}

export function normalizeLineAccountOption(row) {
  const id = row?.id ?? row?.Id ?? "";
  const controlAccount = pickField(row, "controlAccount", "ControlAccount");
  const groupName = pickField(row, "groupName", "GroupName");
  const acctId = pickField(row, "acctId", "AcctId");
  const acctName = pickField(row, "acctName", "AcctName");
  const label = formatLineAccountLabel(acctId, acctName, controlAccount);
  if (!label) return null;

  const groupColor = getCoaGroupColor(groupName);
  const coaId = id != null && id !== "" ? String(id) : "";
  return {
    id,
    coaId,
    acctId,
    acctName,
    controlAccount,
    groupName,
    groupColor,
    value: coaId || label,
    label,
  };
}

export function buildLineAccountOptions(coaRows, savedAccounts = []) {
  const byKey = new Map();

  (coaRows || []).forEach((row) => {
    const option = normalizeLineAccountOption(row);
    if (!option?.value) return;
    byKey.set(option.value, option);
  });

  (savedAccounts || []).forEach((saved) => {
    const trimmed = String(saved || "").trim();
    if (!trimmed) return;
    const existing = [...byKey.values()].find(
      (option) => option.label === trimmed || option.value === trimmed
    );
    if (existing) return;
    byKey.set(`legacy:${trimmed}`, {
      controlAccount: trimmed.split(" - ").pop()?.trim() || trimmed,
      groupName: "",
      groupColor: getCoaGroupColor(""),
      value: trimmed,
      label: trimmed,
    });
  });

  return [...byKey.values()].sort(compareLineAccountOptions);
}

export function formatReceiptContractDropdownLabel(contract) {
  const contractNo = formatContractNoLabel(contract);
  const period = formatAgreementPeriodLabel(
    pickField(contract, "contractStartDate", "ContractStartDate"),
    pickField(contract, "contractEndDate", "ContractEndDate")
  );
  if (!contractNo) return "";
  return period ? `${contractNo} - ${period}` : contractNo;
}

export function buildReceiptContractOptions(contracts) {
  return (contracts || [])
    .map(normalizeCatalogRow)
    .filter(isFinalizedContract)
    .map((row) => ({
      value: String(row.id),
      label: formatReceiptContractDropdownLabel(row),
      contractNo: formatContractNoLabel(row),
      contractId: row.id,
    }))
    .filter((option) => option.label)
    .sort((a, b) =>
      String(a.contractNo).localeCompare(String(b.contractNo), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

export function getReceiptLineContractSelectValue(line, contractOptions) {
  if (line?.contractId != null && String(line.contractId).trim() !== "") {
    return String(line.contractId);
  }
  const contractNo = String(line?.contractNo || "").trim();
  if (!contractNo) return "";
  const match = (contractOptions || []).find(
    (option) => String(option.contractNo || "").trim() === contractNo
  );
  return match?.value || "";
}

function isActiveCollectionEntryRow(row) {
  const deleted = row?.isDeleted ?? row?.IsDeleted;
  if (deleted === true || deleted === 1 || deleted === "1") return false;
  if (typeof deleted === "string" && deleted.trim().toLowerCase() === "true") return false;
  const invoiceNo = String(pickField(row, "invoiceNo", "InvoiceNo") || "").trim();
  if (invoiceNo) return true;
  const { invoiceNo: parsedInvoiceNo } = (() => {
    const key = String(row?.invoiceKey || "").trim();
    if (!key) return { invoiceNo: "" };
    const [contractNo, inv] = key.split("|");
    return { invoiceNo: (inv || contractNo || "").trim() };
  })();
  return Boolean(parsedInvoiceNo);
}

export function getCollectionEntriesForInvoiceKey(collectionRows, invoiceKey) {
  const key = String(invoiceKey || "").trim();
  if (!key) return [];
  return (collectionRows || [])
    .filter(isActiveCollectionEntryRow)
    .filter((row) => buildInvoiceKey(row) === key)
    .filter((row) => parseAmount(row?.amount ?? row?.Amount) > 0)
    .sort((a, b) => Number(a?.id ?? a?.Id ?? 0) - Number(b?.id ?? b?.Id ?? 0));
}

export function buildReceiptLineFromCollectionEntry(sourceLine, collectionEntry, invoiceMeta = {}) {
  const amount = parseAmount(collectionEntry?.amount ?? collectionEntry?.Amount);
  const entryTinTrn = normalizeTinTrn(collectionEntry?.tinTrn ?? collectionEntry?.TinTrn ?? "");
  const line = {
    ...createLineRow(),
    ...sourceLine,
    id: createLineRow().id,
    invoiceKey: invoiceMeta.invoiceKey || sourceLine?.invoiceKey || "",
    contractNo: invoiceMeta.contractNo || sourceLine?.contractNo || "",
    invoiceNo: invoiceMeta.invoiceNo || sourceLine?.invoiceNo || "",
    collectionEntryId:
      collectionEntry?.id != null && collectionEntry?.id !== "" ? String(collectionEntry.id) : "",
    amount: amount > 0 ? String(amount) : "",
    tinTrn: entryTinTrn || normalizeTinTrn(sourceLine?.tinTrn ?? ""),
  };
  line.total = computeLineTotal(line);
  return normalizeReceiptLineNumericDefaults(line);
}

export function applyReceiptLineInvoiceSelection(
  lines,
  lineId,
  invoiceKey,
  { collectionRows, invoiceRowsByKey, pickField: pickRowField, getCollectionEntryOpenAmount }
) {
  const lineIndex = (lines || []).findIndex((line) => line.id === lineId);
  if (lineIndex < 0) return lines;

  const sourceLine = lines[lineIndex];
  const key = String(invoiceKey || "").trim();

  if (!key) {
    return lines.map((line) => {
      if (line.id !== lineId) return line;
      const cleared = {
        ...line,
        invoiceKey: "",
        invoiceNo: "",
        collectionEntryId: "",
      };
      cleared.total = computeLineTotal(cleared);
      return cleared;
    });
  }

  const invoice = invoiceRowsByKey?.get?.(key);
  const contractNo =
    pickRowField(invoice, "contractNo", "ContractNo") ||
    pickRowField(sourceLine, "contractNo", "ContractNo") ||
    "";
  const invoiceNo =
    pickRowField(invoice, "invoiceNo", "InvoiceNo") ||
    pickRowField(sourceLine, "invoiceNo", "InvoiceNo") ||
    "";
  const template = {
    ...sourceLine,
    invoiceKey: key,
    contractNo,
    invoiceNo,
  };
  const collectionEntries = getCollectionEntriesForInvoiceKey(collectionRows, key);

  if (collectionEntries.length > 1) {
    const withoutSameInvoice = lines.filter(
      (line, idx) => idx === lineIndex || String(line.invoiceKey || "") !== key
    );
    const insertAt = withoutSameInvoice.findIndex((line) => line.id === lineId);
    const expanded = collectionEntries.map((entry) =>
      buildReceiptLineFromCollectionEntry(template, entry, {
        invoiceKey: key,
        contractNo,
        invoiceNo,
      })
    );
    return [
      ...withoutSameInvoice.slice(0, insertAt),
      ...expanded,
      ...withoutSameInvoice.slice(insertAt + 1),
    ];
  }

  if (collectionEntries.length === 1) {
    const updated = buildReceiptLineFromCollectionEntry(template, collectionEntries[0], {
      invoiceKey: key,
      contractNo,
      invoiceNo,
    });
    return lines.map((line) => (line.id === lineId ? updated : line));
  }

  const fallbackEntry = (collectionRows || []).find((row) => buildInvoiceKey(row) === key);
  const updated = {
    ...template,
    collectionEntryId: "",
  };
  if (!String(updated.amount || "").trim()) {
    const balance = getCollectionEntryOpenAmount?.(fallbackEntry, invoice) ?? 0;
    if (balance > 0) updated.amount = String(balance);
  }
  updated.total = computeLineTotal(updated);
  return lines.map((line) => (line.id === lineId ? updated : line));
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
  return normalizeReceiptLineNumericDefaults({
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    racId: "",
    baseId: "",
    item: "",
    account: "",
    accountCoaId: "",
    partyKey: "",
    partyType: "",
    partyId: "",
    partyCode: "",
    partyName: "",
    partyLabel: "",
    contractId: "",
    invoiceKey: "",
    contractNo: "",
    invoiceNo: "",
    collectionEntryId: "",
    tinTrn: "",
    amount: "",
    quantity: "",
    discount: "0",
    tax: "0",
    total: 0,
    ...overrides,
  });
}

/** Ensures discount/tax default to 0 when left empty on line items. */
export function normalizeReceiptLineNumericDefaults(line) {
  if (!line) return line;
  const normalized = { ...line };
  if (String(normalized.discount ?? "").trim() === "") normalized.discount = "0";
  if (String(normalized.tax ?? "").trim() === "") normalized.tax = "0";
  normalized.total = computeLineTotal(normalized);
  return normalized;
}

export function isReceiptLineComplete(line, { requireItem = true } = {}) {
  if (!line) return false;
  return (
    (!requireItem || Boolean(String(line.item || "").trim())) &&
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
    paidFrom: PAID_FROM_ACCOUNTS[0],
    payeeContactType: "Supplier",
    payeePartyKey: "",
    payeePartyId: "",
    payeePartyCode: "",
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
  const amount = parseAmount(line?.amount);
  const rawQuantity = String(line?.quantity ?? "").trim();
  const quantity = rawQuantity === "" ? 1 : parseAmount(rawQuantity);
  const discountPercent = Math.max(0, parseAmount(line?.discount));
  const taxPercent = Math.max(0, parseAmount(line?.tax));
  const gross = amount * Math.max(0, quantity);
  const discounted = gross - (gross * discountPercent) / 100;
  const total = discounted + (discounted * taxPercent) / 100;
  return Number.isFinite(total) ? Math.max(0, total) : 0;
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

export function normalizeReceiptInvoiceKey(line) {
  const invoiceKey = pickField(line, "invoiceKey", "InvoiceKey");
  const contractNo = pickField(line, "contractNo", "ContractNo");
  const invoiceNo = pickField(line, "invoiceNo", "InvoiceNo");

  if (contractNo && invoiceNo) return `${contractNo}|${invoiceNo}`;
  if (!invoiceKey) return invoiceNo;

  if (invoiceKey.includes("|")) {
    const [keyContractNo, keyInvoiceNo] = invoiceKey.split("|");
    const resolvedContractNo = contractNo || String(keyContractNo || "").trim();
    const resolvedInvoiceNo = invoiceNo || String(keyInvoiceNo || "").trim();
    if (resolvedContractNo && resolvedInvoiceNo) {
      return `${resolvedContractNo}|${resolvedInvoiceNo}`;
    }
    return resolvedInvoiceNo || invoiceKey;
  }

  const resolvedInvoiceNo = invoiceNo || invoiceKey;
  return contractNo && resolvedInvoiceNo ? `${contractNo}|${resolvedInvoiceNo}` : resolvedInvoiceNo;
}

export function getReceiptInvoiceKeys(receipt) {
  const keys = new Set();
  (receipt?.lines || []).forEach((line) => {
    const key = normalizeReceiptInvoiceKey(line);
    if (key) keys.add(key);
  });
  return Array.from(keys);
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
