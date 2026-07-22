import api, { getActionBy } from "services/api.service";

const UPLOAD_TABLE_NAME = "BankAccount";

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

function getAll(pageNumber = 1, pageSize = 850) {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  }).toString();
  return requestWithPagination("GET", `/api/BankAccounts?${params}`);
}

function getAllUnpaged() {
  return requestWithPagination("GET", "/api/BankAccounts");
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
  return requestWithPagination("POST", "/api/BankAccounts", payload);
}

async function update(id, data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("PUT", `/api/BankAccounts/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  const body = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/BankAccounts/${id}`, body);
}

/** Same unpaginated source as configuration/banks-list. */
export async function fetchBankListsForDropdown() {
  const response = await api.request("GET", "/api/BankLists");
  const data = response?.data ?? (Array.isArray(response) ? response : []);
  const list = Array.isArray(data) ? data : [];
  return list
    .map((item) => {
      const id = item?.id ?? item?.Id;
      if (id === undefined || id === null) return null;
      const name = String(item?.name ?? item?.Name ?? "").trim();
      const code = String(item?.code ?? item?.Code ?? "").trim();
      const label = code ? `${name || id} (${code})` : name || String(id);
      return { id, label, name, code };
    })
    .filter(Boolean);
}

const bankAccountApi = {
  getAll,
  getAllUnpaged,
  create,
  update,
  remove,
};

export { UPLOAD_TABLE_NAME };
export default bankAccountApi;
