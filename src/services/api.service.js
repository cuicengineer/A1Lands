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

// Cache for IP address to avoid multiple fetches
let cachedIPAddress = null;
let ipFetchPromise = null;

// Helper function to get user's IP address
async function getUserIPAddress() {
  // Return cached IP if available
  if (cachedIPAddress) {
    return cachedIPAddress;
  }

  // If fetch is already in progress, return the promise
  if (ipFetchPromise) {
    return ipFetchPromise;
  }

  // Start fetching IP
  ipFetchPromise = (async () => {
    try {
      // Try multiple IP services for reliability
      const ipServices = [
        { url: "https://api.ipify.org?format=json", extract: (data) => data.ip },
        {
          url: "https://api.ip.sb/ip",
          extract: (data) => (typeof data === "string" ? data.trim() : data.ip),
        },
        { url: "https://api.myip.com", extract: (data) => data.ip || data.query },
        {
          url: "https://ipapi.co/ip/",
          extract: (data) => (typeof data === "string" ? data.trim() : data.ip),
        },
      ];

      for (const service of ipServices) {
        try {
          const response = await fetch(service.url, { method: "GET" });
          if (response.ok) {
            const contentType = response.headers.get("content-type");
            let data;
            if (contentType && contentType.includes("application/json")) {
              data = await response.json();
            } else {
              data = await response.text();
            }
            const ip = service.extract(data);
            if (ip && typeof ip === "string" && ip.trim().length > 0) {
              cachedIPAddress = ip.trim();
              return cachedIPAddress;
            }
          }
        } catch (e) {
          // Try next service
          continue;
        }
      }
      // Fallback: set to unknown if all services fail
      cachedIPAddress = "unknown";
      return cachedIPAddress;
    } catch (error) {
      console.error("Error fetching IP address:", error);
      cachedIPAddress = "unknown";
      return cachedIPAddress;
    } finally {
      ipFetchPromise = null;
    }
  })();

  return ipFetchPromise;
}

// Helper function to get ActionBy value in format: "username (IP_ADDRESS)"
async function getActionBy() {
  const username = getLoggedInUsername();
  const ip = await getUserIPAddress();
  return `${username} (${ip})`;
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
  isOperatorUser,
  getCurrentUserRole,
  getActionBy,
  getLoggedInUsername,
  getUserIPAddress,
};
export default api;
export { isOperatorUser, getCurrentUserRole, getActionBy, getLoggedInUsername, getUserIPAddress };
