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
  return requestWithPagination("GET", `/api/Contracts?${params}`);
}

// Get active contracts as of a specific date (yyyy-MM-dd) using the ActiveByAsOfDate endpoint
function getActiveByAsOfDate(asOfDateYyyyMmDd) {
  const params = new URLSearchParams({
    asOfDate: asOfDateYyyyMmDd,
  }).toString();
  return requestWithPagination("GET", `/api/Contracts/ActiveByAsOfDate?${params}`);
}

// Backwards-compatible alias
function list(pageNumber = 1, pageSize = 50) {
  return getAll(pageNumber, pageSize);
}

// Search contracts by group name
function searchByGrpName(grpName) {
  return api.post("/api/Contracts/searchByGrpName", { grpName });
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
  return requestWithPagination("POST", `/api/Contracts`, payload);
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
  return requestWithPagination("PUT", `/api/Contracts/${id}`, payload);
}

function remove(id, data = {}) {
  const payload = {
    ...data,
    Action: "Delete",
  };
  return requestWithPagination("DELETE", `/api/Contracts/${id}`, payload);
}

// Get ContractRiseTerms by ContractID
// Tries multiple endpoint patterns to match ContractRiseTermsController
function getContractRiseTermsByContractId(contractId) {
  // Try the standard pattern: /api/ContractRiseTerms/GetByContractId/{contractId}
  return api.request("GET", `/api/ContractRiseTerms/ByContract/${contractId}`);
}

// Delete ContractRiseTerm by ID
async function deleteContractRiseTerm(riseTermId) {
  const actionBy = await getActionBy();
  const payload = {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  };
  return api.request("DELETE", `/api/ContractRiseTerms/${riseTermId}`, payload);
}

const contractApi = {
  getAll,
  getActiveByAsOfDate,
  list,
  searchByGrpName,
  create,
  update,
  remove,
  getContractRiseTermsByContractId,
  deleteContractRiseTerm,
};
export default contractApi;
