import api, { getActionBy } from "services/api.service";
import {
  buildPurchaseInvoiceFormState,
  computePurchaseInvoiceGrandTotal,
  normalizePurchaseInvoiceLine,
} from "layouts/purchases/purchase-invoice/purchaseInvoiceUtils";

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
  if (typeof raw !== "string" || !raw.trim()) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return value;
  }
  return "";
}

export function normalizePurchaseInvoiceRow(row) {
  const lines = parseJsonArray(pickField(row, "linesJson", "LinesJson", "lines"), []).map(
    normalizePurchaseInvoiceLine
  );
  return buildPurchaseInvoiceFormState({
    id: row?.id ?? row?.Id,
    date: toDateInputValue(pickField(row, "date", "Date")),
    piNo: pickField(row, "piNo", "PiNo"),
    controlAccountCoaId: row?.controlAccountCoaId ?? row?.ControlAccountCoaId ?? "",
    description: pickField(row, "description", "Description"),
    grandTotal:
      Number(pickField(row, "grandTotal", "GrandTotal")) || computePurchaseInvoiceGrandTotal(lines),
    lines,
  });
}

export function buildPurchaseInvoiceApiPayload(form, grandTotal) {
  return {
    Date: form.date || null,
    PiNo: String(form.piNo || "").trim() || null,
    Description: form.description || null,
    ControlAccountCoaId:
      form.controlAccountCoaId === "" || form.controlAccountCoaId == null
        ? null
        : Number(form.controlAccountCoaId),
    GrandTotal: grandTotal,
    LinesJson: JSON.stringify(form.lines || []),
  };
}

function listPurchaseInvoices() {
  return api.request("GET", "/api/PurchaseInvoices");
}

function getPurchaseInvoiceById(id) {
  return api.request("GET", `/api/PurchaseInvoices/${id}`);
}

async function createPurchaseInvoice(data) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/PurchaseInvoices", {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function updatePurchaseInvoice(id, data) {
  const actionBy = await getActionBy();
  return api.request("PUT", `/api/PurchaseInvoices/${id}`, {
    ...(data || {}),
    Id: Number(id),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function removePurchaseInvoice(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/PurchaseInvoices/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: true,
  });
}

const purchaseInvoicesApi = {
  listPurchaseInvoices,
  getPurchaseInvoiceById,
  createPurchaseInvoice,
  updatePurchaseInvoice,
  removePurchaseInvoice,
  unwrapList,
  normalizePurchaseInvoiceRow,
  buildPurchaseInvoiceApiPayload,
};

export default purchaseInvoicesApi;
