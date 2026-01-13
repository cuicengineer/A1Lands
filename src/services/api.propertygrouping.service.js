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
        totalCount: totalCount ? parseInt(totalCount, 10) : null,
        pageNumber: pageNumber ? parseInt(pageNumber, 10) : null,
        pageSize: pageSize ? parseInt(pageSize, 10) : null,
      },
    };
  }

  return data;
}

function list(pageNumber = 1, pageSize = 50) {
  const params = {
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  };
  const qs = new URLSearchParams(params).toString();
  return requestWithPagination("GET", `/api/PropertyGroup?${qs}`);
}

function get(id) {
  return requestWithPagination("GET", `/api/PropertyGroup/${id}`);
}

function create(data) {
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("POST", `/api/PropertyGroup`, payload);
}

function update(id, data) {
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("PUT", `/api/PropertyGroup/${id}`, payload);
}

function remove(id) {
  const payload = { Action: "Delete", ActionBy: "admin", ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/PropertyGroup/${id}`, payload);
}

function getByGroup(id, pageNumber = 1, pageSize = 100) {
  const params = {
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  };
  const qs = new URLSearchParams(params).toString();
  return requestWithPagination("GET", `/api/PropertyGroup/ByGroup/${id}?${qs}`);
}

function removePropertyFromGroup(linkingId) {
  const payload = { Action: "Delete", ActionBy: "admin", ActionDate: new Date().toISOString() };
  return requestWithPagination("DELETE", `/api/PropertyGroup/Linking/${linkingId}`, payload);
}

function createPropertyGroupLinking(data) {
  // Backend: [HttpPost("Linking")] CreatePropertyGroupLinking([FromBody] PropertyGroupLinking request)
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return requestWithPagination("POST", `/api/PropertyGroup/Linking`, payload);
}

const propertyGroupingApi = {
  list,
  get,
  create,
  update,
  remove,
  getByGroup,
  removePropertyFromGroup,
  createPropertyGroupLinking,
};
export default propertyGroupingApi;
