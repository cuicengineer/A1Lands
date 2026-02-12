import api from "services/api.service";

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
    type: "1", // Filter to only fetch type 1 values (Rental Value Rate)
  }).toString();
  return requestWithPagination("GET", `/api/RentalValueGovtShareRates?${params}`);
}

function create(data) {
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("POST", `/api/RentalValueGovtShareRates`, payload);
}

function update(id, data) {
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("PUT", `/api/RentalValueGovtShareRates/${id}`, payload);
}

function remove(id) {
  const payload = { Action: "Delete", ActionBy: "admin", ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/RentalValueGovtShareRates/${id}`, payload);
}

const rentalValueRateApi = { getAll, create, update, remove };
export default rentalValueRateApi;
