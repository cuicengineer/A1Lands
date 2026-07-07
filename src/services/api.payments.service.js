import api, { getActionBy } from "services/api.service";
import {
  buildPaymentFormState,
  getPaymentLineMode,
  normalizePaymentLineFromApi,
  normalizePaymentPartyType,
  resolveCashAndBankAccountIdFromSelection,
} from "layouts/accounts/receipts/paymentUtils";
import { currentMonthYear } from "layouts/accounts/receipts/receiptUtils";

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

export function normalizePaymentRow(row) {
  const lines = parseJsonArray(pickField(row, "linesJson", "LinesJson"), []).map((line) =>
    normalizePaymentLineFromApi(line)
  );
  const payeeContactType = pickField(row, "payeeContactType", "PayeeContactType") || "";

  return buildPaymentFormState({
    id: row?.id ?? row?.Id,
    date: toDateInputValue(pickField(row, "date", "Date")),
    month: pickField(row, "month", "Month") || currentMonthYear(),
    vrNo: pickField(row, "vrNo", "VrNo") || pickField(row, "reference", "Reference"),
    cashAndBankAccountId: row?.cashAndBankAccountId ?? row?.CashAndBankAccountId ?? "",
    receivedInCoaId: pickField(row, "receivedInCoaId", "ReceivedInCoaId"),
    receiptPartyType: normalizePaymentPartyType(payeeContactType),
    receivedFromAccountLabel:
      pickField(row, "receivedFromAccountDisplay", "ReceivedFromAccountDisplay") ||
      pickField(row, "paidFrom", "PaidFrom"),
    paidFrom:
      pickField(row, "receivedFromAccountDisplay", "ReceivedFromAccountDisplay") ||
      pickField(row, "paidFrom", "PaidFrom"),
    payeeContactType,
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
    grandTotal: Number(pickField(row, "grandTotal", "GrandTotal")) || 0,
    lines,
  });
}

export function buildPaymentApiPayload(form, grandTotal) {
  const cashAndBankAccountId = resolveCashAndBankAccountIdFromSelection(
    form.cashAndBankAccountId || form.receivedInCoaId,
    form.cashAndBankOptions
  );

  return {
    Date: form.date || null,
    VrNo: String(form.vrNo || "").trim() || null,
    CashAndBankAccountId: cashAndBankAccountId,
    PaidFrom: form.receivedFromAccountLabel || form.paidFrom || null,
    PayeeContactType: form.receiptPartyType || form.payeeContactType || null,
    PayeePartyId:
      form.payeePartyId !== "" && form.payeePartyId != null ? Number(form.payeePartyId) : null,
    PayeePartyCode: form.payeePartyCode || null,
    PayeeName: form.payeeName || null,
    Description: form.description || null,
    GrandTotal: grandTotal,
    LinesJson: JSON.stringify(form.lines || []),
    RecordType: "Payment",
  };
}

function listPayments() {
  return api.request("GET", "/api/Payments");
}

function getPaymentById(id) {
  return api.request("GET", `/api/Payments/${id}`);
}

async function createPayment(data) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/Payments", {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function updatePayment(id, data) {
  const actionBy = await getActionBy();
  return api.request("PUT", `/api/Payments/${id}`, {
    ...(data || {}),
    Id: Number(id),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function removePayment(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/Payments/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: true,
  });
}

const paymentsApi = {
  unwrapList,
  normalizePaymentRow,
  buildPaymentApiPayload,
  getPaymentLineMode,
  listPayments,
  getPaymentById,
  createPayment,
  updatePayment,
  removePayment,
};

export default paymentsApi;
