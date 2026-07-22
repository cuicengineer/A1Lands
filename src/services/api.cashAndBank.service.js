import api, { getActionBy } from "services/api.service";

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

function getAll(pageNumber = 1, pageSize = 50, options = {}) {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  });
  if (options.parentCashAndBankId != null && options.parentCashAndBankId !== "") {
    params.set("parentCashAndBankId", String(options.parentCashAndBankId));
  }
  if (options.topLevelOnly) {
    params.set("topLevelOnly", "true");
  }
  return requestWithPagination("GET", `/api/CashAndBanks?${params.toString()}`);
}

function getAllUnpaged(options = {}) {
  const params = new URLSearchParams();
  if (options.parentCashAndBankId != null && options.parentCashAndBankId !== "") {
    params.set("parentCashAndBankId", String(options.parentCashAndBankId));
  }
  if (options.topLevelOnly) {
    params.set("topLevelOnly", "true");
  }
  const query = params.toString();
  return requestWithPagination("GET", `/api/CashAndBanks${query ? `?${query}` : ""}`);
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
  return requestWithPagination("POST", "/api/CashAndBanks", payload);
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
  return requestWithPagination("PUT", `/api/CashAndBanks/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  const body = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/CashAndBanks/${id}`, body);
}

const cashAndBankApi = {
  getAll,
  getAllUnpaged,
  create,
  update,
  remove,
};

export default cashAndBankApi;
