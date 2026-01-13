const RAW_API_BASE = (process.env.REACT_APP_API_BASE_URL || "").trim();
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
if (!RAW_API_BASE) {
  console.warn("REACT_APP_API_BASE_URL is empty or missing; using relative API paths.");
}

const JSON_HEADERS = { "Content-Type": "application/json" };

function getStoredAccessToken() {
  try {
    return (
      localStorage.getItem("token") ||
      localStorage.getItem("authToken") ||
      localStorage.getItem("accessToken") ||
      ""
    );
  } catch (e) {
    return "";
  }
}

function storeAccessToken(token) {
  if (!token) return;
  try {
    localStorage.setItem("token", token);
  } catch (e) {
    // ignore
  }
}

function clearStoredAuth() {
  try {
    localStorage.removeItem("token");
    localStorage.removeItem("authToken");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("auth");
  } catch (e) {
    // ignore
  }
}

function redirectToLogin(reason) {
  // Refresh token is HttpOnly cookie; frontend can't read it.
  // If refresh fails (401/403) we assume refresh token is missing/expired -> force re-login.
  console.log("refresh token missing", reason || "");
  clearStoredAuth();
  try {
    if (typeof window !== "undefined" && window.location) {
      if (window.location.pathname !== "/") {
        window.location.assign("/");
      }
    }
  } catch (e) {
    // ignore
  }
}

function getCurrentUserRole() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return "";
    const obj = JSON.parse(raw);
    return String(
      obj?.role ||
        obj?.Role ||
        obj?.roleName ||
        obj?.RoleName ||
        obj?.category ||
        obj?.Category ||
        obj?.userRole ||
        obj?.UserRole ||
        ""
    ).trim();
  } catch (e) {
    return "";
  }
}

function isOperatorUser() {
  return getCurrentUserRole().toLowerCase() === "operator";
}

let refreshPromise = null;

async function refreshAccessToken() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    // Refresh token is HttpOnly cookie; frontend just calls refresh endpoint with credentials.
    const res = await fetch(`${API_BASE}/api/Login/refresh`, {
      method: "POST",
      headers: { ...JSON_HEADERS },
      credentials: "include",
    });
    if (res.status === 401 || res.status === 403) {
      redirectToLogin(`refresh failed (${res.status})`);
      throw new Error(`HTTP ${res.status} ${res.statusText}`);
    }
    if (!res.ok) {
      let errText = "";
      try {
        errText = await res.text();
      } catch (e) {
        errText = res.statusText;
      }
      throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
    }
    const contentType = res.headers.get("content-type");
    const data =
      contentType && contentType.includes("application/json") ? await res.json() : await res.text();

    const nextToken =
      data?.accessToken ||
      data?.AccessToken ||
      data?.token ||
      data?.Token ||
      data?.jwt ||
      data?.Jwt;
    if (!nextToken) {
      redirectToLogin("refresh succeeded but no access token returned");
      throw new Error("Refresh response did not include access token");
    }
    storeAccessToken(nextToken);
    return nextToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function fetchWithAuth(method, path, body, headers = {}, requestOptions = {}) {
  // Frontend RBAC: Operator can only GET and POST. Do not send PUT/DELETE.
  const m = String(method || "").toUpperCase();
  if (isOperatorUser() && (m === "PUT" || m === "DELETE")) {
    console.log(`Blocked ${m} request for Operator user: ${path}`);
    throw new Error("Operator user is not allowed to perform update/delete operations.");
  }

  const pathWithLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const url = `${API_BASE}${pathWithLeadingSlash}`;

  // Optional auth token support (for secured APIs)
  let authHeader = {};
  try {
    const token = getStoredAccessToken();
    if (token) authHeader = { Authorization: `Bearer ${token}` };
  } catch (e) {
    // ignore
  }

  const mergedHeaders = { ...authHeader, ...headers };
  const hasBody = body !== undefined && body !== null;
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  const isString = typeof body === "string";

  // Default to JSON header ONLY when we're going to JSON.stringify the payload
  const finalHeaders =
    hasBody && !isFormData && !isString && !("Content-Type" in mergedHeaders)
      ? { ...JSON_HEADERS, ...mergedHeaders }
      : { ...mergedHeaders };

  const fetchOptions = {
    method,
    headers: finalHeaders,
    // Needed so HttpOnly refresh cookie can be set/sent by the browser
    credentials: "include",
    ...(requestOptions || {}),
  };

  if (hasBody) {
    // If caller passes FormData or string, send as-is. Otherwise send JSON.
    fetchOptions.body = isFormData || isString ? body : JSON.stringify(body);
  }

  const res = await fetch(url, fetchOptions);

  // If access token expired, refresh using HttpOnly cookie then retry ONCE.
  const shouldTryRefresh =
    res.status === 401 &&
    !requestOptions?._retried &&
    !String(pathWithLeadingSlash).toLowerCase().includes("/api/login") &&
    !String(pathWithLeadingSlash).toLowerCase().includes("/api/login/refresh");

  if (shouldTryRefresh) {
    try {
      await refreshAccessToken();
      return await fetchWithAuth(method, path, body, headers, {
        ...(requestOptions || {}),
        _retried: true,
      });
    } catch (refreshErr) {
      // If refresh token missing/expired, refreshAccessToken already redirected.
      // Fall through to standard error handling below.
    }
  }

  return res;
}

async function requestRaw(method, path, body, headers = {}, requestOptions = {}) {
  const res = await fetchWithAuth(method, path, body, headers, requestOptions);
  if (!res.ok) {
    let errText = "";
    try {
      errText = await res.text();
    } catch (e) {
      errText = res.statusText;
    }
    throw new Error(`HTTP ${res.status} ${res.statusText}: ${errText}`);
  }
  return res;
}

async function request(method, path, body, headers = {}, requestOptions = {}) {
  const res = await requestRaw(method, path, body, headers, requestOptions);
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

function post(path, data, headers) {
  return request("POST", path, data, headers);
}

function login(data) {
  // LoginController: [HttpPost] public async Task<IActionResult> Login([FromBody] LoginRequest request)
  return request("POST", `/api/Login`, data);
}

const api = {
  list,
  get,
  create,
  update,
  remove,
  post,
  login,
  request,
  requestRaw,
  refreshAccessToken,
};
export default api;
