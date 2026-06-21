import api, { getActionBy } from "services/api.service";
import {
  buildReceiptFormState,
  createLineRow,
  currentMonthYear,
  isValidMonthYear,
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

export function normalizeReceiptRow(row) {
  const lines = parseJsonArray(pickField(row, "linesJson", "LinesJson"), []).map((line) => ({
    ...createLineRow(),
    ...line,
  }));
  const attachments = parseJsonArray(pickField(row, "attachmentsJson", "AttachmentsJson"), []);

  return buildReceiptFormState({
    id: row?.id ?? row?.Id,
    date: toDateInputValue(pickField(row, "date", "Date")),
    month: pickField(row, "month", "Month") || currentMonthYear(),
    referenceAutomatic: Boolean(row?.referenceAutomatic ?? row?.ReferenceAutomatic ?? false),
    reference: pickField(row, "reference", "Reference"),
    paidFrom: pickField(row, "paidFrom", "PaidFrom"),
    payeeContactType: pickField(row, "payeeContactType", "PayeeContactType") || "Supplier",
    payeeName: pickField(row, "payeeName", "PayeeName"),
    description: pickField(row, "description", "Description"),
    finalizedByAhq: pickBoolean(row, "finalizedByAhq", "FinalizedByAhq"),
    grandTotal: Number(pickField(row, "grandTotal", "GrandTotal")) || 0,
    lines,
    attachments,
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
    PayeeContactType: form.payeeContactType || null,
    PayeeName: form.payeeName || null,
    Description: form.description || null,
    GrandTotal: grandTotal,
    LinesJson: JSON.stringify(form.lines || []),
    AttachmentsJson: JSON.stringify(
      (form.attachments || []).map((file) => ({
        id: file.id,
        name: file.name,
        size: file.size,
      }))
    ),
  };

  if (includeFinalizedByAhq) {
    payload.FinalizedByAhq = Boolean(form.finalizedByAhq);
  }

  return payload;
}

function listReceipts() {
  return api.request("GET", "/api/Receipts");
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
  listReceipts,
  getReceiptById,
  createReceipt,
  updateReceipt,
  removeReceipt,
};

export default receiptsApi;
