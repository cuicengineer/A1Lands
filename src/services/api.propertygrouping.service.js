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
        totalCount: totalCount ? parseInt(totalCount, 10) : null,
        pageNumber: pageNumber ? parseInt(pageNumber, 10) : null,
        pageSize: pageSize ? parseInt(pageSize, 10) : null,
      },
    };
  }

  return data;
}

function list(pageNumber = 1, pageSize = 1000) {
  const params = {
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  };
  const qs = new URLSearchParams(params).toString();
  return requestWithPagination("GET", `/api/PropertyGroup?${qs}`);
}

/** Load the full property-group catalog in one round trip when possible. */
async function getAllRecords() {
  return fetchAllPaginatedRecords(list, { listEntities: ["propertygroup", "PropertyGroup"] });
}

function get(id) {
  return requestWithPagination("GET", `/api/PropertyGroup/${id}`);
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
  return requestWithPagination("POST", `/api/PropertyGroup`, payload);
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
  return requestWithPagination("PUT", `/api/PropertyGroup/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  const payload = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/PropertyGroup/${id}`, payload);
}

function getByGroup(id, pageNumber = 1, pageSize = 1000) {
  const params = {
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  };
  const qs = new URLSearchParams(params).toString();
  return requestWithPagination("GET", `/api/PropertyGroup/ByGroup/${id}?${qs}`);
}

function notGroupedProperties(cmdId, baseId, classId) {
  const query = new URLSearchParams({
    cmdId: String(cmdId),
    baseId: String(baseId),
  });
  if (classId !== undefined && classId !== null && classId !== "") {
    query.set("classId", String(classId));
  }
  return requestWithPagination(
    "GET",
    `/api/PropertyGroup/NotGroupedProperties?${query.toString()}`
  );
}

async function removePropertyFromGroup(linkingId) {
  const actionBy = await getActionBy();
  const payload = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/PropertyGroup/Linking/${linkingId}`, payload);
}

async function createPropertyGroupLinking(data) {
  // Backend: [HttpPost("Linking")] CreatePropertyGroupLinking([FromBody] PropertyGroupLinking request)
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("POST", `/api/PropertyGroup/Linking`, payload);
}

const propertyGroupingApi = {
  list,
  getAllRecords,
  get,
  create,
  update,
  remove,
  getByGroup,
  notGroupedProperties,
  removePropertyFromGroup,
  createPropertyGroupLinking,
};
export default propertyGroupingApi;
