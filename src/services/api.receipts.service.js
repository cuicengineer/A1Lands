import api, { getActionBy } from "services/api.service";
import {
  buildReceiptFormState,
  createLineRow,
  currentMonthYear,
  isValidMonthYear,
  normalizeReceiptLineNumericDefaults,
} from "layouts/accounts/receipts/receiptUtils";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function toDateInputValue(raw) {
  if (!raw) return "";
  const text = String(raw).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return "";
  const d = new Date(parsed);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

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

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return row[keys[i]];
  }
  return "";
}

function pickBoolean(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value === true || value === 1 || value === "1") return true;
    if (value === false || value === 0 || value === "0") return false;
  }
  return false;
}

function resolveReceiptLinesFromRow(row) {
  const embedded = row?.lines ?? row?.Lines ?? row?.receiptLines ?? row?.ReceiptLines;
  if (Array.isArray(embedded) && embedded.length) return embedded;
  return parseJsonArray(pickField(row, "linesJson", "LinesJson"), []);
}

function mapReceiptLineToApi(line, index) {
  const amount = Number(line?.amount) || 0;
  const discount = Number(line?.discount) || 0;
  const tax = Number(line?.tax) || 0;
  const total = Number(line?.total) || Math.max(0, amount - discount + tax);
  const quantityRaw = line?.quantity;
  const unitPriceRaw = line?.unitPrice;
  const quantity = quantityRaw === "" || quantityRaw == null ? null : Number(quantityRaw) || null;
  const unitPrice =
    unitPriceRaw === "" || unitPriceRaw == null ? null : Number(unitPriceRaw) || null;

  return {
    LineNo: index + 1,
    RacId: String(line?.racId || "").trim() || null,
    BaseId: String(line?.baseId || "").trim() || null,
    Item: String(line?.item || "").trim() || null,
    Account: String(line?.account || "").trim() || null,
    AccountCoaId: String(line?.accountCoaId || "").trim() || null,
    PartyKey: String(line?.partyKey || "").trim() || null,
    PartyType: String(line?.partyType || "").trim() || null,
    PartyId: String(line?.partyId || "").trim() || null,
    PartyCode: String(line?.partyCode || "").trim() || null,
    PartyName: String(line?.partyName || "").trim() || null,
    PartyLabel: String(line?.partyLabel || "").trim() || null,
    ContractId: String(line?.contractId || "").trim() || null,
    InvoiceKey: String(line?.invoiceKey || "").trim() || null,
    ContractNo: String(line?.contractNo || "").trim() || null,
    InvoiceNo: String(line?.invoiceNo || "").trim() || null,
    CollectionEntryId: String(line?.collectionEntryId || "").trim() || null,
    TinTrn: String(line?.tinTrn || "").trim() || null,
    TinFtn: String(line?.tinFtn || "").trim() || null,
    Amount: amount,
    UnitPrice: unitPrice,
    Quantity: quantity,
    ProductKey: String(line?.productKey || "").trim() || null,
    ProductType: String(line?.productType || "").trim() || null,
    ProductId: String(line?.productId || "").trim() || null,
    Discount: discount,
    Tax: tax,
    Total: total,
  };
}

function normalizeReceiptLineFromApi(line) {
  return normalizeReceiptLineNumericDefaults({
    ...createLineRow(),
    ...line,
    id:
      line?.id ||
      line?.Id ||
      `line-${line?.lineNo ?? line?.LineNo ?? Date.now()}-${Math.random()
        .toString(36)
        .slice(2, 8)}`,
    racId: line?.racId ?? line?.RacId ?? "",
    baseId: line?.baseId ?? line?.BaseId ?? "",
    item: line?.item ?? line?.Item ?? "",
    account: line?.account ?? line?.Account ?? "",
    accountCoaId: String(line?.accountCoaId ?? line?.AccountCoaId ?? ""),
    partyKey: line?.partyKey ?? line?.PartyKey ?? "",
    partyType: line?.partyType ?? line?.PartyType ?? "",
    partyId: String(line?.partyId ?? line?.PartyId ?? ""),
    partyCode: line?.partyCode ?? line?.PartyCode ?? "",
    partyName: line?.partyName ?? line?.PartyName ?? "",
    partyLabel: line?.partyLabel ?? line?.PartyLabel ?? "",
    contractId: String(line?.contractId ?? line?.ContractId ?? ""),
    invoiceKey: line?.invoiceKey ?? line?.InvoiceKey ?? "",
    contractNo: line?.contractNo ?? line?.ContractNo ?? "",
    invoiceNo: line?.invoiceNo ?? line?.InvoiceNo ?? "",
    collectionEntryId: String(line?.collectionEntryId ?? line?.CollectionEntryId ?? ""),
    tinTrn: line?.tinTrn ?? line?.TinTrn ?? "",
    tinFtn: line?.tinFtn ?? line?.TinFtn ?? "",
    amount: line?.amount ?? line?.Amount ?? "",
    unitPrice: line?.unitPrice ?? line?.UnitPrice ?? "",
    quantity: line?.quantity ?? line?.Quantity ?? "",
    productKey: line?.productKey ?? line?.ProductKey ?? "",
    productType: line?.productType ?? line?.ProductType ?? "",
    productId: String(line?.productId ?? line?.ProductId ?? ""),
    discount: line?.discount ?? line?.Discount ?? "0",
    tax: line?.tax ?? line?.Tax ?? "0",
    total: line?.total ?? line?.Total ?? 0,
  });
}

export function normalizeReceiptRow(row) {
  const lines = resolveReceiptLinesFromRow(row).map(normalizeReceiptLineFromApi);
  return buildReceiptFormState({
    id: row?.id ?? row?.Id,
    date: toDateInputValue(pickField(row, "date", "Date")),
    month: pickField(row, "month", "Month") || currentMonthYear(),
    referenceAutomatic: Boolean(row?.referenceAutomatic ?? row?.ReferenceAutomatic ?? false),
    reference: pickField(row, "reference", "Reference"),
    paidFrom: pickField(row, "paidFrom", "PaidFrom"),
    receivedInCoaId: pickField(row, "payeePartyId", "PayeePartyId"),
    cashAndBankAccountId: row?.cashAndBankAccountId ?? row?.CashAndBankAccountId ?? "",
    receiptPartyType: pickField(row, "payeeContactType", "PayeeContactType"),
    payeeContactType: pickField(row, "payeeContactType", "PayeeContactType"),
    payeePartyId: pickField(row, "payeePartyId", "PayeePartyId"),
    payeePartyCode: pickField(row, "payeePartyCode", "PayeePartyCode"),
    payeePartyKey: [
      pickField(row, "payeeContactType", "PayeeContactType") || "Supplier",
      pickField(row, "payeePartyId", "PayeePartyId") ||
        pickField(row, "payeePartyCode", "PayeePartyCode") ||
        pickField(row, "payeeName", "PayeeName"),
    ]
      .map((part) => String(part || "").trim())
      .join("|"),
    payeeName: pickField(row, "payeeName", "PayeeName"),
    description: pickField(row, "description", "Description"),
    finalizedByAhq: pickBoolean(row, "finalizedByAhq", "FinalizedByAhq"),
    grandTotal: Number(pickField(row, "grandTotal", "GrandTotal")) || 0,
    lines,
  });
}

export function buildReceiptApiPayload(form, grandTotal, { includeFinalizedByAhq = false } = {}) {
  const month = isValidMonthYear(form.month) ? String(form.month).trim() : null;

  const payload = {
    Date: form.date || null,
    Month: month,
    ReferenceAutomatic: Boolean(form.referenceAutomatic),
    Reference: form.reference || null,
    PaidFrom: form.paidFrom || null,
    PayeeContactType: form.receiptPartyType || form.payeeContactType || null,
    PayeePartyId:
      form.receivedInCoaId !== "" && form.receivedInCoaId != null
        ? Number(form.receivedInCoaId)
        : form.payeePartyId !== "" && form.payeePartyId != null
        ? Number(form.payeePartyId)
        : null,
    PayeePartyCode: form.payeePartyCode || null,
    PayeeName: form.payeeName || null,
    Description: form.description || null,
    GrandTotal: grandTotal,
    Lines: (form.lines || []).map(mapReceiptLineToApi),
  };

  if (includeFinalizedByAhq) {
    payload.FinalizedByAhq = Boolean(form.finalizedByAhq);
  }

  return payload;
}

export function buildReceiptFinalizePayload(record, finalizedByAhq) {
  const grandTotal =
    Number(record?.grandTotal) ||
    (Array.isArray(record?.lines)
      ? record.lines.reduce((sum, line) => sum + (Number(line?.total) || 0), 0)
      : 0);
  return {
    ...buildReceiptApiPayload(record, grandTotal, { includeFinalizedByAhq: true }),
    FinalizedByAhq: Boolean(finalizedByAhq),
  };
}

function listReceipts() {
  return api.request("GET", "/api/Receipts");
}

function listReceiptTinLinesByInvoice(invoiceNo, contractNo = "") {
  const params = new URLSearchParams();
  params.set("invoiceNo", String(invoiceNo || "").trim());
  const cn = String(contractNo || "").trim();
  if (cn) params.set("contractNo", cn);
  return api.request("GET", `/api/Receipts/lines-by-invoice?${params.toString()}`);
}

function getReceiptById(id) {
  return api.request("GET", `/api/Receipts/${id}`);
}

async function createReceipt(data) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/Receipts", {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function updateReceipt(id, data) {
  const actionBy = await getActionBy();
  return api.request("PUT", `/api/Receipts/${id}`, {
    ...(data || {}),
    Id: Number(id),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function removeReceipt(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/Receipts/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: true,
  });
}

const receiptsApi = {
  unwrapList,
  normalizeReceiptRow,
  buildReceiptApiPayload,
  buildReceiptFinalizePayload,
  listReceipts,
  listReceiptTinLinesByInvoice,
  getReceiptById,
  createReceipt,
  updateReceipt,
  removeReceipt,
};

export default receiptsApi;
