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
  return requestWithPagination("GET", `/api/Contracts?${params}`);
}

/** Load the full contracts catalog in one round trip when possible. */
async function getAllRecords() {
  return fetchAllPaginatedRecords(getAll, {
    listEntities: ["contract", "contracts", "Contracts"],
  });
}

function appendIsFinalizedQueryParam(params, isFinalized) {
  if (isFinalized === true || isFinalized === 1 || isFinalized === "1" || isFinalized === "true") {
    params.set("isFinalized", "true");
  } else if (
    isFinalized === false ||
    isFinalized === 0 ||
    isFinalized === "0" ||
    isFinalized === "false"
  ) {
    params.set("isFinalized", "false");
  }
}

function getInvoiceSchedulePage(pageNumber = 1, pageSize = 1000, filters = {}) {
  const params = new URLSearchParams({
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  });
  const contractNo = filters.contractNo != null ? String(filters.contractNo).trim() : "";
  if (contractNo) params.set("contractNo", contractNo);
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.cmdId != null && filters.cmdId !== "") {
    params.set("cmdId", String(filters.cmdId));
  }
  if (filters.classId != null && filters.classId !== "") {
    params.set("classId", String(filters.classId));
  }
  if (filters.baseId != null && filters.baseId !== "") {
    params.set("baseId", String(filters.baseId));
  }
  appendIsFinalizedQueryParam(params, filters.isFinalized);
  if (filters.invoiceNo != null && String(filters.invoiceNo).trim() !== "") {
    params.set("invoiceNo", String(filters.invoiceNo).trim());
  }
  const qs = params.toString();
  return requestWithPagination("GET", `/api/ContractInvoiceSchedule?${qs}`);
}

/** Load all invoice schedule rows (no filter query) for client-side filtering. */
async function getAllInvoiceScheduleRecords() {
  return fetchAllPaginatedRecords((page, size) => getInvoiceSchedulePage(page, size), {
    listEntities: ["contractinvoiceschedule", "ContractInvoiceSchedule"],
  });
}

/**
 * GET /api/ContractInvoiceSchedule — optional query: contractNo, fromDate, toDate, cmdId, classId, baseId
 */
function getInvoiceSchedule(filters = {}) {
  const hasPagination = filters.pageNumber != null || filters.pageSize != null;
  if (hasPagination) {
    return getInvoiceSchedulePage(filters.pageNumber ?? 1, filters.pageSize ?? 1000, filters);
  }
  const params = new URLSearchParams();
  const contractNo = filters.contractNo != null ? String(filters.contractNo).trim() : "";
  if (contractNo) params.set("contractNo", contractNo);
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.cmdId != null && filters.cmdId !== "") {
    params.set("cmdId", String(filters.cmdId));
  }
  if (filters.classId != null && filters.classId !== "") {
    params.set("classId", String(filters.classId));
  }
  if (filters.baseId != null && filters.baseId !== "") {
    params.set("baseId", String(filters.baseId));
  }
  appendIsFinalizedQueryParam(params, filters.isFinalized);
  if (filters.invoiceNo != null && String(filters.invoiceNo).trim() !== "") {
    params.set("invoiceNo", String(filters.invoiceNo).trim());
  }
  const qs = params.toString();
  return requestWithPagination("GET", `/api/ContractInvoiceSchedule${qs ? `?${qs}` : ""}`);
}

function appendAgreementProvInvoiceScheduleQueryParams(params, filters = {}) {
  const contractNo = filters.contractNo != null ? String(filters.contractNo).trim() : "";
  if (contractNo) params.set("contractNo", contractNo);
  if (filters.fromDate) params.set("fromDate", filters.fromDate);
  if (filters.toDate) params.set("toDate", filters.toDate);
  if (filters.cmdId != null && filters.cmdId !== "") {
    params.set("cmdId", String(filters.cmdId));
  }
  if (filters.classId != null && filters.classId !== "") {
    params.set("classId", String(filters.classId));
  }
  if (filters.baseId != null && filters.baseId !== "") {
    params.set("baseId", String(filters.baseId));
  }
  if (filters.invoiceNo != null && String(filters.invoiceNo).trim() !== "") {
    params.set("invoiceNo", String(filters.invoiceNo).trim());
  }
  appendIsFinalizedQueryParam(params, filters.isFinalized);
}

/** Agreement-prov-invoice initial load: GET /api/ContractInvoiceSchedule?isFinalized=true */
async function getAgreementProvFinalizedInvoiceScheduleRecords() {
  return getInvoiceSchedule({ isFinalized: true });
}

/**
 * Agreement-prov-invoice search: GET /api/ContractInvoiceSchedule with filter query params only (no pagination).
 */
async function searchAgreementProvFinalizedInvoiceSchedule(filters = {}) {
  return getInvoiceSchedule({
    ...filters,
    isFinalized: filters.isFinalized === false || filters.isFinalized === 0 ? false : true,
  });
}

/**
 * GET /api/ContractInvoiceSchedule/by-invoice/{invoiceNo}
 */
function getInvoiceScheduleByInvoiceNo(invoiceNo) {
  const encodedInvoiceNo = encodeURIComponent(String(invoiceNo ?? "").trim());
  return requestWithPagination(
    "GET",
    `/api/ContractInvoiceSchedule/by-invoice/${encodedInvoiceNo}`
  );
}

/**
 * POST /api/ContractInvoiceSchedule/{contractNo}/{invoiceNo}/{subInvoiceNo}
 * Main invoice header (empty sub) uses PUT upsert — POST requires a sub segment (405 otherwise).
 */
async function createInvoiceSchedule(contractNo, invoiceNo, subInvoiceNo, data) {
  const actionBy = await getActionBy();
  const input = data || {};
  const payload = {
    ...input,
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  if (input.IsFinalized === true || input.isFinalized === true) {
    payload.IsFinalized = true;
    payload.isFinalized = true;
  }
  const sub = String(subInvoiceNo ?? "").trim();
  if (!sub) {
    return updateInvoiceSchedule(contractNo, invoiceNo, payload);
  }
  const encodedContractNo = encodeURIComponent(String(contractNo ?? "").trim());
  const encodedInvoiceNo = encodeURIComponent(String(invoiceNo ?? "").trim());
  const encodedSubInvoiceNo = encodeURIComponent(sub);
  return requestWithPagination(
    "POST",
    `/api/ContractInvoiceSchedule/${encodedContractNo}/${encodedInvoiceNo}/${encodedSubInvoiceNo}`,
    payload
  );
}

/**
 * PUT /api/ContractInvoiceSchedule/{contractNo}/{invoiceNo}/{subInvoiceNo}
 */
async function updateInvoiceScheduleSub(contractNo, invoiceNo, subInvoiceNo, data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  const encodedContractNo = encodeURIComponent(String(contractNo ?? "").trim());
  const encodedInvoiceNo = encodeURIComponent(String(invoiceNo ?? "").trim());
  const encodedSubInvoiceNo = encodeURIComponent(String(subInvoiceNo ?? "").trim());
  return requestWithPagination(
    "PUT",
    `/api/ContractInvoiceSchedule/${encodedContractNo}/${encodedInvoiceNo}/${encodedSubInvoiceNo}`,
    payload
  );
}

/**
 * DELETE /api/ContractInvoiceSchedule/{contractNo}/{invoiceNo}/{subInvoiceNo}
 */
async function deleteInvoiceSchedule(contractNo, invoiceNo, subInvoiceNo) {
  const actionBy = await getActionBy();
  const payload = {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: true,
  };
  const encodedContractNo = encodeURIComponent(String(contractNo ?? "").trim());
  const encodedInvoiceNo = encodeURIComponent(String(invoiceNo ?? "").trim());
  const encodedSubInvoiceNo = encodeURIComponent(String(subInvoiceNo ?? "").trim());
  return requestWithPagination(
    "DELETE",
    `/api/ContractInvoiceSchedule/${encodedContractNo}/${encodedInvoiceNo}/${encodedSubInvoiceNo}`,
    payload
  );
}

/**
 * PUT /api/ContractInvoiceSchedule/{contractNo}/{invoiceNo}
 */
async function updateInvoiceSchedule(contractNo, invoiceNo, data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  const encodedContractNo = encodeURIComponent(String(contractNo ?? "").trim());
  const encodedInvoiceNo = encodeURIComponent(String(invoiceNo ?? "").trim());
  return requestWithPagination(
    "PUT",
    `/api/ContractInvoiceSchedule/${encodedContractNo}/${encodedInvoiceNo}`,
    payload
  );
}

// Get active contracts as of a specific date (yyyy-MM-dd) using the ActiveByAsOfDate endpoint
function getActiveByAsOfDate(asOfDateYyyyMmDd) {
  const params = new URLSearchParams({
    asOfDate: asOfDateYyyyMmDd,
  }).toString();
  return requestWithPagination("GET", `/api/Contracts/ActiveByAsOfDate?${params}`);
}

// Backwards-compatible alias
function list(pageNumber = 1, pageSize = 1000) {
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
  getAllRecords,
  getAllInvoiceScheduleRecords,
  getAgreementProvFinalizedInvoiceScheduleRecords,
  searchAgreementProvFinalizedInvoiceSchedule,
  getInvoiceSchedule,
  getInvoiceScheduleByInvoiceNo,
  createInvoiceSchedule,
  updateInvoiceScheduleSub,
  deleteInvoiceSchedule,
  updateInvoiceSchedule,
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
