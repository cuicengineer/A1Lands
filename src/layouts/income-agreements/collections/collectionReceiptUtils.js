import {
  buildInvoiceKey,
  formatAmount,
  formatDisplayDate,
  normalizeCatalogRow,
  normalizeTinTrn,
  parseAmount,
  parseInvoiceKey,
  pickField,
  toDateInputValue,
} from "./collectionsUtils";

function parseJsonArray(raw, fallback = []) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

export const COLLECTION_STATUS_OPTIONS = ["All", "Received", "Pending"];

export function normalizeCollectionStatus(value) {
  const text = String(value || "")
    .trim()
    .toLowerCase();
  if (text === "received") return "Received";
  if (text === "pending") return "Pending";
  return "";
}

export function deriveCollectionEntryStatus(row, { allowManualOverride = false } = {}) {
  const vrNo = String(row?.vrNo ?? row?.VrNo ?? "").trim();

  if (allowManualOverride) {
    const explicit = normalizeCollectionStatus(row?.status ?? row?.Status);
    if (explicit) return explicit;
    return vrNo ? "Received" : "Pending";
  }

  return vrNo ? "Received" : "Pending";
}

export function isCollectionRowUnderEdit(row) {
  return Boolean(row?.isEditing || row?.isLocalOnly);
}

export function matchesCollectionStatusFilter(row, filter, { allowManualOverride = false } = {}) {
  if (isCollectionRowUnderEdit(row)) return true;
  const normalizedFilter = String(filter || "")
    .trim()
    .toLowerCase();
  if (!normalizedFilter || normalizedFilter === "all") return true;
  const targetStatus = normalizeCollectionStatus(filter);
  if (!targetStatus) return true;
  return deriveCollectionEntryStatus(row, { allowManualOverride }) === targetStatus;
}

export function normalizeReceiptCatalogRow(row) {
  const lines = parseJsonArray(pickField(row, "linesJson", "LinesJson"), []);
  return {
    id: row?.id ?? row?.Id ?? null,
    date: toDateInputValue(pickField(row, "date", "Date")),
    reference: pickField(row, "reference", "Reference"),
    vrNo: pickField(row, "vrNo", "VrNo", "reference", "Reference"),
    payeeContactType: pickField(row, "payeeContactType", "PayeeContactType"),
    payeePartyCode: pickField(row, "payeePartyCode", "PayeePartyCode"),
    payeePartyId: row?.payeePartyId ?? row?.PayeePartyId ?? "",
    payeeName: pickField(row, "payeeName", "PayeeName"),
    grandTotal: parseAmount(row?.grandTotal ?? row?.GrandTotal),
    lines,
    isDeleted: row?.isDeleted ?? row?.IsDeleted,
  };
}

function receiptLineMatchesInvoice(line, invoiceKey) {
  const key = String(invoiceKey || "").trim();
  if (!key) return true;
  const lineKey = buildInvoiceKey({
    contractNo: pickField(line, "contractNo", "ContractNo"),
    invoiceNo: pickField(line, "invoiceNo", "InvoiceNo"),
  });
  if (lineKey && lineKey === key) return true;
  const { invoiceNo } = parseInvoiceKey(key);
  const lineInvoiceNo = pickField(line, "invoiceNo", "InvoiceNo");
  return invoiceNo && lineInvoiceNo && invoiceNo.toLowerCase() === lineInvoiceNo.toLowerCase();
}

function receiptMatchesTenant(receipt, tenantNo) {
  const tn = String(tenantNo || "").trim();
  if (!tn) return true;
  const code = String(receipt.payeePartyCode || "").trim();
  if (code && code.toLowerCase() === tn.toLowerCase()) return true;
  const name = String(receipt.payeeName || "")
    .trim()
    .toLowerCase();
  return name.startsWith(tn.toLowerCase());
}

export function formatReceiptVoucherDropdownLabel({ vrNo, vrDate, amount, tinTrn }) {
  const parts = [
    String(vrNo || "").trim(),
    vrDate ? formatDisplayDate(vrDate) : "",
    amount != null && amount !== "" ? formatAmount(amount) : "",
    normalizeTinTrn(tinTrn).trim(),
  ].filter(Boolean);
  return parts.join(" | ") || "—";
}

export function buildCollectionReceiptVoucherOptions(
  receipts,
  { tenantNo = "", invoiceKey = "" } = {}
) {
  const options = [];
  const seen = new Set();

  (receipts || []).forEach((raw) => {
    const receipt = normalizeReceiptCatalogRow(raw);
    if (receipt.isDeleted === true || receipt.isDeleted === 1) return;
    if (!receiptMatchesTenant(receipt, tenantNo)) return;

    const headerAmount = receipt.grandTotal;
    const headerTinTrn = normalizeTinTrn(
      receipt.lines?.[0]?.tinTrn ?? receipt.lines?.[0]?.TinTrn ?? ""
    );
    const headerVrNo = receipt.vrNo || receipt.reference;
    const headerKey = `${receipt.id}|header`;

    if (
      headerVrNo &&
      (!invoiceKey || receipt.lines.some((line) => receiptLineMatchesInvoice(line, invoiceKey)))
    ) {
      if (!seen.has(headerKey)) {
        seen.add(headerKey);
        options.push({
          key: headerKey,
          receiptId: receipt.id,
          vrNo: headerVrNo,
          vrDate: receipt.date,
          amount: headerAmount,
          tinTrn: headerTinTrn,
          label: formatReceiptVoucherDropdownLabel({
            vrNo: headerVrNo,
            vrDate: receipt.date,
            amount: headerAmount,
            tinTrn: headerTinTrn,
          }),
        });
      }
    }

    (receipt.lines || []).forEach((line, index) => {
      if (invoiceKey && !receiptLineMatchesInvoice(line, invoiceKey)) return;
      const lineAmount = parseAmount(line?.amount ?? line?.Amount);
      const lineTinTrn = normalizeTinTrn(line?.tinTrn ?? line?.TinTrn ?? "");
      const lineVrNo = headerVrNo || `Receipt-${receipt.id}`;
      const lineKey = `${receipt.id}|${index}`;
      if (seen.has(lineKey)) return;
      seen.add(lineKey);
      options.push({
        key: lineKey,
        receiptId: receipt.id,
        vrNo: lineVrNo,
        vrDate: receipt.date,
        amount: lineAmount > 0 ? lineAmount : headerAmount,
        tinTrn: lineTinTrn || headerTinTrn,
        label: formatReceiptVoucherDropdownLabel({
          vrNo: lineVrNo,
          vrDate: receipt.date,
          amount: lineAmount > 0 ? lineAmount : headerAmount,
          tinTrn: lineTinTrn || headerTinTrn,
        }),
      });
    });
  });

  return options.sort((a, b) => String(a.vrNo).localeCompare(String(b.vrNo)));
}

export function findReceiptVoucherOption(options, { receiptId, vrNo, key } = {}) {
  const optionKey = String(key || "").trim();
  if (optionKey) {
    return (options || []).find((option) => option.key === optionKey) || null;
  }
  const id = receiptId != null && receiptId !== "" ? Number(receiptId) : null;
  const no = String(vrNo || "").trim();
  return (
    (options || []).find((option) => {
      if (id != null && Number(option.receiptId) === id) {
        if (!no || option.vrNo === no) return true;
      }
      return no && option.vrNo === no;
    }) || null
  );
}

export function applyReceiptVoucherSelection(row, option) {
  if (!option) {
    return {
      ...row,
      receiptId: "",
      vrNo: "",
      vrDate: "",
      status: "Pending",
    };
  }
  return {
    ...row,
    receiptId: option.receiptId ?? "",
    vrNo: option.vrNo || "",
    vrDate: toDateInputValue(option.vrDate),
    tinTrn: normalizeTinTrn(option.tinTrn),
    amount:
      row.amount === "" || row.amount == null
        ? String(parseAmount(option.amount) || "")
        : row.amount,
    status: "Received",
  };
}
