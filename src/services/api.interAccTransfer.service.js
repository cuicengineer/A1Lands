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

function getAll(pageNumber = 1, pageSize = 50) {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  }).toString();
  return requestWithPagination("GET", `/api/InterAccTransfers?${params}`);
}

function getAllUnpaged() {
  return requestWithPagination("GET", "/api/InterAccTransfers");
}

async function create(data) {
  const actionBy = await getActionBy();
  return requestWithPagination("POST", "/api/InterAccTransfers", {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function update(id, data) {
  const actionBy = await getActionBy();
  return requestWithPagination("PUT", `/api/InterAccTransfers/${id}`, {
    ...(data || {}),
    Id: id,
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function remove(id) {
  const actionBy = await getActionBy();
  const body = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/InterAccTransfers/${id}`, body);
}

const interAccTransferApi = {
  getAll,
  getAllUnpaged,
  create,
  update,
  remove,
};

export default interAccTransferApi;
