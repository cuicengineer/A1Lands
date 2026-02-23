import api, { getActionBy } from "services/api.service";

async function requestWithPagination(method, path, body) {
  const res = await api.requestRaw(method, path, body);
  if (res.status === 204) return null;

  const contentType = res.headers.get("content-type");
  const data =
    contentType && contentType.includes("application/json") ? await res.json() : await res.text();

  // Extract pagination headers if present
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
  return requestWithPagination("GET", `/api/SharingFormula?${params}`);
}

function getById(id) {
  return api.request("GET", `/api/SharingFormula/${id}`);
}

// POST accepts single object or list of objects
async function create(data) {
  const actionBy = await getActionBy();
  // If data is an array, send as-is. If single object, wrap in array.
  const payload = Array.isArray(data) ? data : [data];
  const payloadWithAction = payload.map((item) => ({
    ...(item || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  }));
  return requestWithPagination("POST", `/api/SharingFormula`, payloadWithAction);
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
  return requestWithPagination("PUT", `/api/SharingFormula/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  const payload = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/SharingFormula/${id}`, payload);
}

const sharingFormulaApi = { getAll, getById, create, update, remove };
export default sharingFormulaApi;
