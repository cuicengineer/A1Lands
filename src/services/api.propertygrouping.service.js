const RAW_API_BASE = (process.env.REACT_APP_API_BASE_URL || "").trim();
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
if (!RAW_API_BASE) {
  console.warn("REACT_APP_API_BASE_URL is empty or missing; using relative API paths.");
}

const JSON_HEADERS = { "Content-Type": "application/json" };

async function request(method, path, body, headers = {}) {
  const pathWithLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${pathWithLeadingSlash}`;
  const options = {
    method,
    headers: { ...JSON_HEADERS, ...headers },
  };
  if (body !== undefined && body !== null) {
    options.body = JSON.stringify(body);
  }
  const res = await fetch(url, options);
  if (!res.ok) {
    let errText = "";
    try {
      errText = await res.text();
    } catch (e) {
      errText = res.statusText;
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
  }
  if (res.status === 204) return null;
  const contentType = res.headers.get("content-type");
  let data;
  if (contentType && contentType.includes("application/json")) {
    data = await res.json();
  } else {
    data = await res.text();
  }

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
  return request("GET", `/api/PropertyGroup?${qs}`);
}

function get(id) {
  return request("GET", `/api/PropertyGroup/${id}`);
}

function create(data) {
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return request("POST", `/api/PropertyGroup`, payload);
}

function update(id, data) {
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return request("PUT", `/api/PropertyGroup/${id}`, payload);
}

function remove(id) {
  const payload = { Action: "Delete", ActionBy: "admin", ActionDate: new Date().toISOString() };
  return request("DELETE", `/api/PropertyGroup/${id}`, payload);
}

function getByGroup(id, pageNumber = 1, pageSize = 100) {
  const params = {
    pageNumber: pageNumber.toString(),
    pageSize: pageSize.toString(),
  };
  const qs = new URLSearchParams(params).toString();
  return request("GET", `/api/PropertyGroup/ByGroup/${id}?${qs}`);
}

function removePropertyFromGroup(linkingId) {
  const payload = { Action: "Delete", ActionBy: "admin", ActionDate: new Date().toISOString() };
  return request("DELETE", `/api/PropertyGroup/Linking/${linkingId}`, payload);
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
  return request("POST", `/api/PropertyGroup/Linking`, payload);
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
