const RAW_API_BASE = (process.env.REACT_APP_API_BASE_URL || "").trim();
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
if (!RAW_API_BASE) {
  console.warn("REACT_APP_API_BASE_URL is empty or missing; using relative API paths.");
}

const JSON_HEADERS = { "Content-Type": "application/json" };
const LAST_ACTIVITY_KEY = "lastActivityAt";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function getLastActivityTs() {
  try {
    const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
    const ts = Number(raw);
    return Number.isFinite(ts) ? ts : 0;
  } catch (e) {
    return 0;
  }
}

function isUserInactive() {
  const lastTs = getLastActivityTs();
  if (!lastTs) return false;
  return Date.now() - lastTs >= INACTIVITY_TIMEOUT_MS;
}

function tryParseJwtPayload(token) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    // Pad base64 string
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json =
      typeof atob === "function" ? atob(padded) : Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json);
  } catch (e) {
    return null;
  }
}

function isJwtExpiredOrNearExpiry(token, skewSeconds = 60) {
  const payload = tryParseJwtPayload(token);
  const exp = payload?.exp;
  if (!exp || typeof exp !== "number") return true; // if we can't determine, be conservative
  const nowSeconds = Math.floor(Date.now() / 1000);
  return exp <= nowSeconds + skewSeconds;
}

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
  console.warn(
    "Auth refresh failed. Common causes: refresh cookie not stored/sent (check SameSite/Secure), or frontend not running on HTTPS while cookie is Secure."
  );
  // Keep user on screen while actively working; App.js enforces 5-min idle logout.
  if (!isUserInactive()) {
    console.warn("Skipping forced logout because user is still active.", reason || "");
    return;
  }

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

// Lightweight cache for role to avoid repeated localStorage parse (RBAC checks)
let _cachedAuthRaw = null;
let _cachedRole = null;

function getCurrentUserRole() {
  try {
    const raw = localStorage.getItem("auth");
    if (raw === _cachedAuthRaw && _cachedRole !== null) return _cachedRole;
    _cachedAuthRaw = raw;
    if (!raw) {
      _cachedRole = "";
      return "";
    }
    const obj = JSON.parse(raw);
    _cachedRole = String(
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
    return _cachedRole;
  } catch (e) {
    _cachedAuthRaw = null;
    _cachedRole = "";
    return "";
  }
}

function isOperatorUser() {
  return false;
}

const MENU_ROUTE_PREFIXES = [
  { menuName: "Dashboard", prefix: "/dashboard" },
  { menuName: "Configuration", prefix: "/configuration" },
  { menuName: "Contracts Mgmt", prefix: "/contracts" },
];

function toBooleanFlag(value) {
  if (value === true || value === 1 || value === "1") return true;
  const lower = String(value ?? "")
    .trim()
    .toLowerCase();
  return lower === "true" || lower === "yes";
}

function getStoredPermissions() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return [];
    const authObj = JSON.parse(raw);
    const perms = Array.isArray(authObj?.permissions)
      ? authObj.permissions
      : Array.isArray(authObj?.Permissions)
      ? authObj.Permissions
      : [];
    return perms;
  } catch (e) {
    return [];
  }
}

function normalizeMenuName(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeAccessValue(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

function isAhqOrSuperuserUser() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return false;
    const authObj = JSON.parse(raw);
    const candidates = [
      authObj?.role,
      authObj?.Role,
      authObj?.roleName,
      authObj?.RoleName,
      authObj?.category,
      authObj?.Category,
      authObj?.userRole,
      authObj?.UserRole,
      authObj?.username,
      authObj?.Username,
      authObj?.userName,
      authObj?.UserName,
      authObj?.unique_name,
    ];
    const normalized = candidates.map(normalizeAccessValue);
    return normalized.includes("ahq") || normalized.includes("superuser");
  } catch (e) {
    return false;
  }
}

function canAccessPrivilegedConfigRoute(pathnameArg) {
  const pathname =
    pathnameArg ??
    (typeof window !== "undefined" && window.location
      ? String(window.location.pathname || "")
      : "");
  const cleaned = String(pathname || "")
    .trim()
    .toLowerCase();
  const isPrivilegedOnlyRoute =
    cleaned.startsWith("/configuration/user-mgmt") ||
    cleaned.startsWith("/configuration/user-role");
  if (!isPrivilegedOnlyRoute) return true;
  return isAhqOrSuperuserUser();
}

function getPermissionByMenuName(menuName) {
  const normalized = normalizeMenuName(menuName);
  if (!normalized) return null;
  const allPermissions = getStoredPermissions();
  const row = allPermissions.find((item) => {
    const name = String(item?.menuName ?? item?.MenuName ?? "").trim();
    return normalizeMenuName(name) === normalized;
  });
  return row || null;
}

function getCurrentMainMenuName(pathnameArg) {
  const pathname =
    pathnameArg ??
    (typeof window !== "undefined" && window.location
      ? String(window.location.pathname || "")
      : "");
  const cleaned = String(pathname || "")
    .trim()
    .toLowerCase();
  const matched = MENU_ROUTE_PREFIXES.find(({ prefix }) => cleaned.startsWith(prefix));
  return matched?.menuName || "";
}

function canViewMenu(menuName) {
  const p = getPermissionByMenuName(menuName);
  if (!p) return true;
  return toBooleanFlag(p?.canView ?? p?.CanView ?? p?.view ?? p?.View);
}

function canCreateInMenu(menuName) {
  const p = getPermissionByMenuName(menuName);
  if (!p) return true;
  return toBooleanFlag(p?.canCreate ?? p?.CanCreate ?? p?.create ?? p?.Create);
}

function canEditInMenu(menuName) {
  const p = getPermissionByMenuName(menuName);
  if (!p) return true;
  return toBooleanFlag(p?.canEdit ?? p?.CanEdit ?? p?.edit ?? p?.Edit);
}

function canDeleteInMenu(menuName) {
  const p = getPermissionByMenuName(menuName);
  if (!p) return true;
  return toBooleanFlag(p?.canDelete ?? p?.CanDelete ?? p?.delete ?? p?.Delete);
}

function canViewCurrentMenu(pathnameArg) {
  if (!canAccessPrivilegedConfigRoute(pathnameArg)) return false;
  return canViewMenu(getCurrentMainMenuName(pathnameArg));
}

function canCreateCurrentMenu(pathnameArg) {
  return canCreateInMenu(getCurrentMainMenuName(pathnameArg));
}

function canEditCurrentMenu(pathnameArg) {
  return canEditInMenu(getCurrentMainMenuName(pathnameArg));
}

function canDeleteCurrentMenu(pathnameArg) {
  return canDeleteInMenu(getCurrentMainMenuName(pathnameArg));
}

// Invalidate role cache when auth changes (e.g. login/logout or another tab)
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e?.key === "auth") {
      _cachedAuthRaw = null;
      _cachedRole = null;
    }
  });
}

// Helper function to get logged-in username
function getLoggedInUsername() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return "unknown";
    const obj = JSON.parse(raw);
    return String(
      obj?.username || obj?.Username || obj?.userName || obj?.unique_name || obj?.name || "unknown"
    ).trim();
  } catch (e) {
    return "unknown";
  }
}

// Get user's IP address from session (auth stored in localStorage).
// No external API calls - IP is provided by backend at login/refresh and stored in user session.
function getUserIPAddress() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return "";
    const obj = JSON.parse(raw);
    const ip = String(
      obj?.userIP ||
        obj?.UserIP ||
        obj?.clientIP ||
        obj?.ClientIP ||
        obj?.ClientIp ||
        obj?.clientIp ||
        obj?.ipAddress ||
        obj?.IpAddress ||
        obj?.ip ||
        obj?.IP ||
        obj?.Ip ||
        ""
    ).trim();
    return ip || "";
  } catch (e) {
    return "";
  }
}

// Helper function to get ActionBy value in format: "username (IP_ADDRESS)"
function getActionBy() {
  const username = getLoggedInUsername();
  const ip = getUserIPAddress();
  return `${username} (${ip || "session"})`;
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
      data?.access_token ||
      data?.token ||
      data?.Token ||
      data?.jwt ||
      data?.Jwt ||
      data?.data?.accessToken ||
      data?.data?.AccessToken ||
      data?.data?.token ||
      data?.data?.Token;
    if (!nextToken) {
      redirectToLogin("refresh succeeded but no access token returned");
      throw new Error("Refresh response did not include access token");
    }
    storeAccessToken(nextToken);
    // Merge user context (including IP) from refresh response into auth - no external API calls
    if (data && typeof data === "object") {
      try {
        const existing = JSON.parse(localStorage.getItem("auth") || "{}");
        const merged = { ...existing, ...data };
        localStorage.setItem("auth", JSON.stringify(merged));
      } catch (e) {
        // ignore
      }
    }
    return nextToken;
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function fetchWithAuth(method, path, body, headers = {}, requestOptions = {}) {
  const m = String(method || "").toUpperCase();
  if (m === "POST" && !canCreateCurrentMenu()) {
    throw new Error("You are not allowed to create in this module.");
  }
  if ((m === "PUT" || m === "PATCH") && !canEditCurrentMenu()) {
    throw new Error("You are not allowed to edit in this module.");
  }
  if (m === "DELETE" && !canDeleteCurrentMenu()) {
    throw new Error("You are not allowed to delete in this module.");
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
  const currentToken = getStoredAccessToken();
  const tokenLikelyExpired = currentToken ? isJwtExpiredOrNearExpiry(currentToken, 60) : false;
  const shouldTryRefresh =
    res.status === 401 &&
    Boolean(currentToken) &&
    tokenLikelyExpired &&
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

// Fetch user context (including IP) from our backend - no external IP APIs (ipapi.co, etc.).
// Backend sees client IP from the request and returns it. Call on app load when authenticated.
async function fetchAndUpdateUserContext() {
  const token = getStoredAccessToken();
  if (!token) return;
  try {
    const res = await fetch(`${API_BASE}/api/Login/me`, {
      method: "GET",
      headers: { ...JSON_HEADERS, Authorization: `Bearer ${token}` },
      credentials: "include",
    });
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        const existing = JSON.parse(localStorage.getItem("auth") || "{}");
        const merged = { ...existing, ...data };
        localStorage.setItem("auth", JSON.stringify(merged));
      }
    }
  } catch (e) {
    // Endpoint may not exist; rely on login/refresh to provide IP
  }
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

async function create(entity, data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return request("POST", `/api/${entity}`, payload);
}

async function update(entity, id, data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return request("PUT", `/api/${entity}/${id}`, payload);
}

async function remove(entity, id) {
  const actionBy = await getActionBy();
  const payload = { Action: "Delete", ActionBy: actionBy, ActionDate: new Date().toISOString() };
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
  fetchAndUpdateUserContext,
  isOperatorUser,
  getStoredPermissions,
  getCurrentMainMenuName,
  canViewMenu,
  canViewCurrentMenu,
  canCreateCurrentMenu,
  canEditCurrentMenu,
  canDeleteCurrentMenu,
  canAccessPrivilegedConfigRoute,
  isAhqOrSuperuserUser,
  getCurrentUserRole,
  getActionBy,
  getLoggedInUsername,
  getUserIPAddress,
};
export default api;
export {
  isOperatorUser,
  getStoredPermissions,
  getCurrentMainMenuName,
  canViewMenu,
  canViewCurrentMenu,
  canCreateCurrentMenu,
  canEditCurrentMenu,
  canDeleteCurrentMenu,
  canAccessPrivilegedConfigRoute,
  isAhqOrSuperuserUser,
  getCurrentUserRole,
  getActionBy,
  getLoggedInUsername,
  getUserIPAddress,
  fetchAndUpdateUserContext,
};
