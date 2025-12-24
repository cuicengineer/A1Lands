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
  if (contentType && contentType.includes("application/json")) {
    return await res.json();
  }
  return await res.text();
}

function list(entity, params) {
  let qs = "";
  if (params && typeof params === "object") {
    const s = new URLSearchParams(params).toString();
    if (s) qs = `?${s}`;
  }
  return request("GET", `/api/${entity}${qs}`);
}

function get(entity, id) {
  return request("GET", `/api/${entity}/${id}`);
}

function create(entity, data) {
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return request("POST", `/api/${entity}`, payload);
}

function update(entity, id, data) {
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: "admin",
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return request("PUT", `/api/${entity}/${id}`, payload);
}

function remove(entity, id) {
  const payload = { Action: "Delete", ActionBy: "admin", ActionDate: new Date().toISOString() };
  return request("DELETE", `/api/${entity}/${id}`, payload);
}

const api = { list, get, create, update, remove };
export default api;
