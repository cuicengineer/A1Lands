import api, { getActionBy } from "services/api.service";
import {
  buildSalesReturnFormState,
  computeSalesReturnGrandTotal,
  syncSalesReturnLineAmount,
  createSalesReturnLineRow,
} from "layouts/income-agreements/sales-returns/salesReturnUtils";

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

export function normalizeSalesReturnRow(row) {
  const lines = parseJsonArray(pickField(row, "linesJson", "LinesJson", "lines"), []).map((line) =>
    syncSalesReturnLineAmount({ ...createSalesReturnLineRow(), ...line })
  );
  return buildSalesReturnFormState({
    id: row?.id ?? row?.Id,
    date: toDateInputValue(pickField(row, "date", "Date")),
    vrNo: pickField(row, "vrNo", "VrNo"),
    contractCustomerKey: pickField(row, "contractCustomerKey", "ContractCustomerKey"),
    contractCustomerLabel: pickField(row, "contractCustomerLabel", "ContractCustomerLabel"),
    contractId: pickField(row, "contractId", "ContractId"),
    contractNo: pickField(row, "contractNo", "ContractNo"),
    customerId: pickField(row, "customerId", "CustomerId"),
    invoiceKey: pickField(row, "invoiceKey", "InvoiceKey"),
    invoiceNo: pickField(row, "invoiceNo", "InvoiceNo"),
    invoiceLabel: pickField(row, "invoiceLabel", "InvoiceLabel"),
    description: pickField(row, "description", "Description"),
    grandTotal:
      Number(pickField(row, "grandTotal", "GrandTotal")) || computeSalesReturnGrandTotal(lines),
    lines,
  });
}

export function buildSalesReturnApiPayload(form, grandTotal) {
  return {
    Date: form.date || null,
    VrNo: String(form.vrNo || "").trim() || null,
    ContractCustomerKey: form.contractCustomerKey || null,
    ContractCustomerLabel: form.contractCustomerLabel || null,
    ContractId: toNullableInt(form.contractId),
    ContractNo: form.contractNo || null,
    CustomerId: toNullableInt(form.customerId),
    InvoiceKey: form.invoiceKey || null,
    InvoiceNo: form.invoiceNo || null,
    InvoiceLabel: form.invoiceLabel || null,
    Description: form.description || null,
    GrandTotal: grandTotal,
    LinesJson: JSON.stringify(form.lines || []),
  };
}

function listSalesReturns() {
  return api.request("GET", "/api/SalesReturns");
}

function getSalesReturnById(id) {
  return api.request("GET", `/api/SalesReturns/${id}`);
}

async function createSalesReturn(data) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/SalesReturns", {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function updateSalesReturn(id, data) {
  const actionBy = await getActionBy();
  return api.request("PUT", `/api/SalesReturns/${id}`, {
    ...(data || {}),
    Id: Number(id),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function removeSalesReturn(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/SalesReturns/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: true,
  });
}

const salesReturnsApi = {
  listSalesReturns,
  getSalesReturnById,
  createSalesReturn,
  updateSalesReturn,
  removeSalesReturn,
  unwrapList,
  normalizeSalesReturnRow,
  buildSalesReturnApiPayload,
};

export default salesReturnsApi;
