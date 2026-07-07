import api, { getActionBy } from "services/api.service";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

async function requestWithPagination(method, path, body) {
  const res = await api.requestRaw(method, path, body);
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type");
  const data =
    contentType && contentType.includes("application/json") ? await res.json() : await res.text();

  const totalCount = res.headers.get("X-Total-Count");
  const pageNumber = res.headers.get("X-Page-Number");
  const pageSize = res.headers.get("X-Page-Size");
  if (totalCount !== null || pageNumber !== null || pageSize !== null) {
    return {
      data: Array.isArray(data) ? data : [data],
      pagination: {
        totalCount: totalCount ? parseInt(totalCount, 10) : 0,
        pageNumber: pageNumber ? parseInt(pageNumber, 10) : 1,
        pageSize: pageSize ? parseInt(pageSize, 10) : 0,
      },
    };
  }

  return data;
}

export function normalizeCurrencyStatus(raw) {
  if (raw === true || raw === 1 || raw === "1") return 1;
  if (raw === false || raw === 0 || raw === "0") return 0;
  if (typeof raw === "string" && raw.trim().toLowerCase() === "active") return 1;
  if (typeof raw === "string" && raw.trim().toLowerCase() === "inactive") return 0;
  return raw == null ? null : 1;
}

export function normalizeCurrencyRow(row) {
  const id = row?.id ?? row?.Id;
  const code = String(row?.code ?? row?.Code ?? "").trim();
  const name = String(row?.name ?? row?.Name ?? "").trim();
  const currencyType = String(
    row?.currencyType ?? row?.CurrencyType ?? row?.type ?? row?.Type ?? ""
  ).trim();
  const decimalPlaces = row?.decimalPlaces ?? row?.DecimalPlaces ?? row?.decimal ?? row?.Decimal;
  const status = normalizeCurrencyStatus(row?.status ?? row?.Status);
  return {
    id,
    code,
    name,
    currencyType,
    decimalPlaces,
    status,
    label: code && name ? `${code} - ${name}` : code || name,
  };
}

function getAll(pageNumber = 1, pageSize = 0) {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  }).toString();
  return requestWithPagination("GET", `/api/Currencies?${params}`);
}

async function create(data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("POST", "/api/Currencies", payload);
}

async function update(id, data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Id: id,
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("PUT", `/api/Currencies/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  const body = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/Currencies/${id}`, body);
}

export function isActiveCurrency(row) {
  const status = row?.status;
  return status === 1 || status === "1";
}

export async function fetchCurrenciesForDropdown() {
  const params = new URLSearchParams({ pageNumber: "1", pageSize: "0" }).toString();
  const response = await api.request("GET", `/api/Currencies?${params}`);
  const list = unwrapList(response);
  return list.map(normalizeCurrencyRow).filter((row) => row.id != null && isActiveCurrency(row));
}

export function findDefaultBaseCurrencyId(currencies) {
  const pkr = (currencies || []).find((c) => String(c.code).toUpperCase() === "PKR");
  if (pkr?.id != null) return pkr.id;
  const base = (currencies || []).find((c) => String(c.currencyType).toLowerCase() === "base");
  return base?.id ?? "";
}

const currencyApi = {
  unwrapList,
  normalizeCurrencyStatus,
  normalizeCurrencyRow,
  fetchCurrenciesForDropdown,
  findDefaultBaseCurrencyId,
  getAll,
  create,
  update,
  remove,
};

export default currencyApi;
