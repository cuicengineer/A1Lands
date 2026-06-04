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
    type: "2", // Filter to only fetch type 2 values (Govt Share Rate)
  }).toString();
  return requestWithPagination("GET", `/api/RentalValueGovtShareRates?${params}`);
}

/** Load full govt share rate catalog (type=2); paginates until all rows are retrieved. */
async function getAllRecords() {
  return fetchAllPaginatedRecords(getAll);
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
  return requestWithPagination("POST", `/api/RentalValueGovtShareRates`, payload);
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
  return requestWithPagination("PUT", `/api/RentalValueGovtShareRates/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  const payload = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/RentalValueGovtShareRates/${id}`, payload);
}

const govtShareRateApi = { getAll, getAllRecords, create, update, remove };
export default govtShareRateApi;
