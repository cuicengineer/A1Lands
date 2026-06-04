import api, { getActionBy } from "services/api.service";
import { fetchAllPaginatedRecords } from "utils/fetchAllPaginatedRecords";

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

function getAll(pageNumber = 1, pageSize = 1000) {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  }).toString();
  return requestWithPagination("GET", `/api/RentalProperties?${params}`);
}

/** Load the full catalog in one round trip when possible (not a fixed 1000-row page). */
async function getAllRecords() {
  return fetchAllPaginatedRecords(getAll, { listEntities: ["rentalproperty", "RentalProperties"] });
}

async function create(data) {
  const actionBy = await getActionBy();
  const normalizedStatus =
    data?.status === true || data?.status === 1 || data?.status === "1"
      ? true
      : data?.status === false || data?.status === 0 || data?.status === "0"
      ? false
      : null;

  const payload = {
    ...(data || {}),
    status: normalizedStatus,
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("POST", `/api/RentalProperties`, payload);
}

async function update(id, data) {
  const actionBy = await getActionBy();
  const normalizedStatus =
    data?.status === true || data?.status === 1 || data?.status === "1"
      ? true
      : data?.status === false || data?.status === 0 || data?.status === "0"
      ? false
      : null;

  const payload = {
    ...(data || {}),
    status: normalizedStatus,
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("PUT", `/api/RentalProperties/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  const payload = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/RentalProperties/${id}`, payload);
}

const rentalPropertiesApi = { getAll, getAllRecords, create, update, remove };
export default rentalPropertiesApi;
