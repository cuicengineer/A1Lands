import api, { getActionBy } from "services/api.service";
import {
  buildPurchaseReturnFormState,
  computePurchaseReturnGrandTotal,
  syncPurchaseReturnLineAmount,
  createPurchaseReturnLineRow,
} from "layouts/purchases/purchase-returns/purchaseReturnUtils";

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

function toNullableInt(value) {
  if (value === "" || value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function normalizePurchaseReturnRow(row) {
  const lines = parseJsonArray(pickField(row, "linesJson", "LinesJson", "lines"), []).map((line) =>
    syncPurchaseReturnLineAmount({ ...createPurchaseReturnLineRow(), ...line })
  );
  return buildPurchaseReturnFormState({
    id: row?.id ?? row?.Id,
    date: toDateInputValue(pickField(row, "date", "Date")),
    vrNo: pickField(row, "vrNo", "VrNo"),
    supplierKey: pickField(row, "supplierKey", "SupplierKey"),
    supplierLabel: pickField(row, "supplierLabel", "SupplierLabel"),
    supplierId: pickField(row, "supplierId", "SupplierId"),
    supplierCode: pickField(row, "supplierCode", "SupplierCode"),
    purchaseInvoiceNo: pickField(row, "purchaseInvoiceNo", "PurchaseInvoiceNo"),
    purchaseInvoiceLabel: pickField(row, "purchaseInvoiceLabel", "PurchaseInvoiceLabel"),
    description: pickField(row, "description", "Description"),
    grandTotal:
      Number(pickField(row, "grandTotal", "GrandTotal")) || computePurchaseReturnGrandTotal(lines),
    lines,
  });
}

export function buildPurchaseReturnApiPayload(form, grandTotal) {
  const invoiceNo = String(form.purchaseInvoiceNo || "").trim();
  return {
    Date: form.date || null,
    VrNo: String(form.vrNo || "").trim() || null,
    SupplierKey: form.supplierKey || null,
    SupplierLabel: form.supplierLabel || null,
    SupplierId: toNullableInt(form.supplierId),
    SupplierCode: form.supplierCode || null,
    PurchaseInvoiceNo: invoiceNo || null,
    PurchaseInvoiceLabel: String(form.purchaseInvoiceLabel || invoiceNo || "").trim() || null,
    Description: form.description || null,
    GrandTotal: grandTotal,
    LinesJson: JSON.stringify(form.lines || []),
  };
}

function listPurchaseReturns() {
  return api.request("GET", "/api/PurchaseReturns");
}

function getPurchaseReturnById(id) {
  return api.request("GET", `/api/PurchaseReturns/${id}`);
}

async function createPurchaseReturn(data) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/PurchaseReturns", {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function updatePurchaseReturn(id, data) {
  const actionBy = await getActionBy();
  return api.request("PUT", `/api/PurchaseReturns/${id}`, {
    ...(data || {}),
    Id: Number(id),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function removePurchaseReturn(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/PurchaseReturns/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: true,
  });
}

const purchaseReturnsApi = {
  listPurchaseReturns,
  getPurchaseReturnById,
  createPurchaseReturn,
  updatePurchaseReturn,
  removePurchaseReturn,
  unwrapList,
  normalizePurchaseReturnRow,
  buildPurchaseReturnApiPayload,
};

export default purchaseReturnsApi;
