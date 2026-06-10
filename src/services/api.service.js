const RAW_API_BASE = (process.env.REACT_APP_API_BASE_URL || "").trim();
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
if (!RAW_API_BASE) {
  console.warn("REACT_APP_API_BASE_URL is empty or missing; using relative API paths.");
}

const JSON_HEADERS = { "Content-Type": "application/json" };
const LAST_ACTIVITY_KEY = "lastActivityAt";
const LOGOUT_EVENT_KEY = "auth:logout";
const REFRESH_LOCK_KEY = "auth:refreshLock";
const REFRESH_LOCK_TTL_MS = 20000;
const AUTH_SESSION_CHANGED_EVENT = "auth:session-changed";
const TOKEN_REFRESH_SKEW_SECONDS = 60;

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

function getAccessTokenExpiryMs() {
  const token = getStoredAccessToken();
  const payload = tryParseJwtPayload(token);
  const exp = payload?.exp;
  return exp && typeof exp === "number" ? exp * 1000 : null;
}

function isAuthRefreshPath(path) {
  const lower = String(path || "").toLowerCase();
  return lower.includes("/api/login") || lower.includes("/api/login/refresh");
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

function notifyAuthSessionChanged() {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new Event(AUTH_SESSION_CHANGED_EVENT));
  } catch (e) {
    // ignore
  }
}

function isRefreshLockHeld() {
  try {
    const lockTs = Number(localStorage.getItem(REFRESH_LOCK_KEY) || 0);
    return Number.isFinite(lockTs) && lockTs > 0 && Date.now() - lockTs < REFRESH_LOCK_TTL_MS;
  } catch (e) {
    return false;
  }
}

function acquireRefreshLock() {
  try {
    if (isRefreshLockHeld()) return false;
    localStorage.setItem(REFRESH_LOCK_KEY, String(Date.now()));
    return true;
  } catch (e) {
    return true;
  }
}

function releaseRefreshLock() {
  try {
    localStorage.removeItem(REFRESH_LOCK_KEY);
  } catch (e) {
    // ignore
  }
}

function waitForTokenFromAnotherTab(timeoutMs = REFRESH_LOCK_TTL_MS) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("no window"));
      return;
    }
    const initialToken = getStoredAccessToken();
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      cleanup();
      fn(value);
    };

    const tryResolve = () => {
      if (getStoredAccessToken() && getStoredAccessToken() !== initialToken) {
        finish(resolve, getStoredAccessToken());
        return true;
      }
      const token = getStoredAccessToken();
      if (token && !isJwtExpiredOrNearExpiry(token, TOKEN_REFRESH_SKEW_SECONDS)) {
        finish(resolve, token);
        return true;
      }
      return false;
    };

    const onStorage = (event) => {
      if (!event) return;
      if (event.key === LOGOUT_EVENT_KEY) {
        finish(reject, new Error("logged out"));
        return;
      }
      if (
        event.key === "token" ||
        event.key === "authToken" ||
        event.key === "accessToken" ||
        event.key === REFRESH_LOCK_KEY
      ) {
        tryResolve();
      }
    };

    const poll = setInterval(() => {
      if (tryResolve()) return;
      if (!isRefreshLockHeld()) {
        finish(reject, new Error("refresh wait timeout"));
      }
    }, 200);

    const timeout = setTimeout(() => {
      if (tryResolve()) return;
      finish(reject, new Error("refresh wait timeout"));
    }, timeoutMs);

    const cleanup = () => {
      clearInterval(poll);
      clearTimeout(timeout);
      window.removeEventListener("storage", onStorage);
    };

    window.addEventListener("storage", onStorage);
    tryResolve();
  });
}

function storeAccessToken(token) {
  if (!token) return;
  try {
    localStorage.setItem("token", token);
    notifyAuthSessionChanged();
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
    localStorage.removeItem(LAST_ACTIVITY_KEY);
    localStorage.removeItem(REFRESH_LOCK_KEY);
    notifyAuthSessionChanged();
  } catch (e) {
    // ignore
  }
}

function hasStoredAccessToken() {
  return Boolean(getStoredAccessToken());
}

function redirectToLogin() {
  try {
    if (typeof window === "undefined") return;
    const path = window.location?.pathname || "";
    const onLoginScreen = path === "/login" || path === "/";
    if (onLoginScreen) {
      window.location.reload();
      return;
    }
    window.location.assign("/login");
  } catch (e) {
    // ignore
  }
}

function logoutEverywhere(reason = "logout", options = {}) {
  const { broadcast = true } = options || {};
  clearStoredAuth();
  try {
    if (broadcast && typeof localStorage !== "undefined") {
      localStorage.setItem(LOGOUT_EVENT_KEY, `${Date.now()}:${reason}`);
    }
  } catch (e) {
    // ignore
  }
  redirectToLogin();
}

function handleAuthStorageEvent(event) {
  if (!event) return;
  if (event.key === LOGOUT_EVENT_KEY || (event.key === "auth" && event.newValue === null)) {
    if (!hasStoredAccessToken()) {
      notifyAuthSessionChanged();
      redirectToLogin();
      return;
    }
    logoutEverywhere("cross-tab", { broadcast: false });
    return;
  }
  if (
    event.key === "token" ||
    event.key === "authToken" ||
    event.key === "accessToken" ||
    event.key === REFRESH_LOCK_KEY
  ) {
    notifyAuthSessionChanged();
  }
}

function handleUnauthorized(reason = "unauthorized") {
  if (isRefreshLockHeld()) {
    return;
  }
  const token = getStoredAccessToken();
  if (token && !isJwtExpiredOrNearExpiry(token, TOKEN_REFRESH_SKEW_SECONDS + 30)) {
    notifyAuthSessionChanged();
    return;
  }
  logoutEverywhere(reason, { broadcast: true });
}

function getAxiosRequestUrl(config) {
  return config?.url || config?.baseURL || "";
}

function setupAxiosInterceptors(axiosInstance) {
  if (!axiosInstance?.interceptors?.request || !axiosInstance?.interceptors?.response) return null;
  const requestId = axiosInstance.interceptors.request.use(async (config) => {
    const requestUrl = getAxiosRequestUrl(config);
    if (!isAuthRefreshPath(requestUrl)) {
      const token = getStoredAccessToken();
      if (token && isJwtExpiredOrNearExpiry(token, TOKEN_REFRESH_SKEW_SECONDS)) {
        await refreshAccessToken();
      }
      const nextToken = getStoredAccessToken();
      if (nextToken) {
        config.headers = config.headers || {};
        config.headers.Authorization = `Bearer ${nextToken}`;
      }
    }
    config.withCredentials = true;
    return config;
  });
  const responseId = axiosInstance.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error?.config || {};
      const requestUrl = getAxiosRequestUrl(originalRequest);
      if (
        error?.response?.status === 401 &&
        !originalRequest._authRetried &&
        !isAuthRefreshPath(requestUrl)
      ) {
        try {
          const token = await refreshAccessToken();
          originalRequest._authRetried = true;
          originalRequest.headers = originalRequest.headers || {};
          originalRequest.headers.Authorization = `Bearer ${token}`;
          originalRequest.withCredentials = true;
          return axiosInstance(originalRequest);
        } catch (refreshErr) {
          return Promise.reject(refreshErr);
        }
      }
      if (error?.response?.status === 401 && !isAuthRefreshPath(requestUrl)) {
        handleUnauthorized("axios-401");
      }
      return Promise.reject(error);
    }
  );
  return { requestId, responseId };
}

if (typeof window !== "undefined" && window.axios) {
  setupAxiosInterceptors(window.axios);
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
  { menuName: "Sales Agreements", prefix: "/contracts" },
  { menuName: "Accounts", prefix: "/accounts" },
  { menuName: "Payments", prefix: "/payments" },
  { menuName: "Receipts", prefix: "/receipts" },
  { menuName: "Supplier", prefix: "/supplier" },
];

/** Menus that must have an Assign Rights row; otherwise navbar, routes, and actions stay hidden. */
function menuRequiresExplicitPermission(menuName) {
  const normalized = normalizeMenuName(menuName);
  return (
    normalized === "accounts" ||
    normalized === "account" ||
    normalized === "payments" ||
    normalized === "receipts" ||
    normalized === "supplier"
  );
}

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

function isSuperuserUser() {
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
    return normalized.includes("superuser");
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
  // User Roles: any user with Configuration menu assigned (can view), not only AHQ/superuser
  if (cleaned.startsWith("/configuration/user-role")) {
    return isAhqOrSuperuserUser() || canViewMenu("Configuration");
  }
  if (cleaned.startsWith("/configuration/user-mgmt")) {
    return isAhqOrSuperuserUser();
  }
  return true;
}

function getPermissionByMenuName(menuName) {
  const normalized = normalizeMenuName(menuName);
  if (!normalized) return null;
  const allPermissions = getStoredPermissions();
  const find = (n) =>
    allPermissions.find((item) => {
      const name = String(item?.menuName ?? item?.MenuName ?? "").trim();
      return normalizeMenuName(name) === n;
    });
  const direct = find(normalized);
  if (direct) return direct;
  if (normalized === "accounts" || normalized === "account") {
    return find("accounts") || find("account");
  }
  if (normalized === "sales agreements" || normalized === "contracts mgmt") {
    return find("sales agreements") || find("contracts mgmt");
  }
  return null;
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
  if (isSuperuserUser()) return true;
  const p = getPermissionByMenuName(menuName);
  if (!p) {
    if (menuRequiresExplicitPermission(menuName)) return false;
    return true;
  }
  return toBooleanFlag(p?.canView ?? p?.CanView ?? p?.view ?? p?.View);
}

function canCreateInMenu(menuName) {
  if (isSuperuserUser()) return true;
  const p = getPermissionByMenuName(menuName);
  if (!p) return menuRequiresExplicitPermission(menuName) ? false : true;
  return toBooleanFlag(p?.canCreate ?? p?.CanCreate ?? p?.create ?? p?.Create);
}

function canEditInMenu(menuName) {
  if (isSuperuserUser()) return true;
  const p = getPermissionByMenuName(menuName);
  if (!p) return menuRequiresExplicitPermission(menuName) ? false : true;
  return toBooleanFlag(p?.canEdit ?? p?.CanEdit ?? p?.edit ?? p?.Edit);
}

function canDeleteInMenu(menuName) {
  if (isSuperuserUser()) return true;
  const p = getPermissionByMenuName(menuName);
  if (!p) return menuRequiresExplicitPermission(menuName) ? false : true;
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

/** Category/role string from session (may be comma-separated). */
function getLoggedInUserCategoryRaw() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return "";
    const obj = JSON.parse(raw);
    return String(obj?.category ?? obj?.Category ?? "").trim();
  } catch (e) {
    return "";
  }
}

function loggedInUserHasCategoryToken(token) {
  const want = String(token || "")
    .trim()
    .toLowerCase();
  if (!want) return false;
  const raw = getLoggedInUserCategoryRaw();
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .includes(want);
}

/** True when user may add contract annotation remarks (superuser or supervisor category). */
function canAddContractAnnotations() {
  if (isSuperuserUser()) return true;
  if (loggedInUserHasCategoryToken("category supervisor")) return true;
  const raw = getLoggedInUserCategoryRaw();
  if (!raw) return false;
  return raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .some((token) => token.includes("supervisor"));
}

/** True when Contracts grid should ignore ApprovalStatus for Edit/Delete visibility (superuser OR Category Supervisor with AHQ RAC/base). */
function contractsApprovalActionsBypassUser() {
  if (isSuperuserUser()) return true;
  if (!loggedInUserHasCategoryToken("category supervisor")) return false;
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return false;
    const o = JSON.parse(raw);
    const parts = [
      o?.cmdName,
      o?.CmdName,
      o?.commandName,
      o?.CommandName,
      o?.rac,
      o?.Rac,
      o?.racName,
      o?.RacName,
      o?.baseName,
      o?.BaseName,
      o?.base,
      o?.Base,
    ];
    return parts.some((v) => normalizeAccessValue(v) === "ahq");
  } catch (e) {
    return false;
  }
}

/** True when session category list includes the Base-Read role (case-insensitive). */
function isLoggedInUserBaseReadCategory() {
  return loggedInUserHasCategoryToken("Base-Read");
}

/** Logged-in user's assigned base id from session, or null if not present. */
function getLoggedInUserBaseId() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return null;
    const obj = JSON.parse(raw);
    const v =
      obj?.baseId ?? obj?.BaseId ?? obj?.userBaseId ?? obj?.UserBaseId ?? obj?.base ?? obj?.Base;
    if (v === null || v === undefined || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  } catch (e) {
    return null;
  }
}

// Get user's IP address from session (auth stored in localStorage).
// No extra API calls — IP is provided by backend at login/refresh and stored in user session.
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

  if (isRefreshLockHeld()) {
    try {
      return await waitForTokenFromAnotherTab();
    } catch (waitErr) {
      const existing = getStoredAccessToken();
      if (existing && !isJwtExpiredOrNearExpiry(existing, TOKEN_REFRESH_SKEW_SECONDS)) {
        return existing;
      }
    }
  }

  refreshPromise = (async () => {
    if (!acquireRefreshLock()) {
      try {
        return await waitForTokenFromAnotherTab();
      } catch (waitErr) {
        const existing = getStoredAccessToken();
        if (existing && !isJwtExpiredOrNearExpiry(existing, TOKEN_REFRESH_SKEW_SECONDS)) {
          return existing;
        }
        throw waitErr;
      }
    }

    try {
      // Refresh token is HttpOnly cookie; frontend just calls refresh endpoint with credentials.
      const res = await fetch(`${API_BASE}/api/Login/refresh`, {
        method: "POST",
        headers: { ...JSON_HEADERS },
        credentials: "include",
      });
      if (res.status === 401 || res.status === 403) {
        try {
          return await waitForTokenFromAnotherTab(3000);
        } catch (waitErr) {
          handleUnauthorized(`refresh failed (${res.status})`);
          throw new Error(`HTTP ${res.status} ${res.statusText}`);
        }
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
        contentType && contentType.includes("application/json")
          ? await res.json()
          : await res.text();

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
        handleUnauthorized("refresh succeeded but no access token returned");
        throw new Error("Refresh response did not include access token");
      }
      storeAccessToken(nextToken);
      // Merge user context (including IP) from refresh response into auth - no external API calls
      if (data && typeof data === "object") {
        try {
          const existing = JSON.parse(localStorage.getItem("auth") || "{}");
          const merged = { ...existing, ...data };
          localStorage.setItem("auth", JSON.stringify(merged));
          notifyAuthSessionChanged();
        } catch (e) {
          // ignore
        }
      }
      return nextToken;
    } finally {
      releaseRefreshLock();
    }
  })();

  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

async function fetchWithAuth(method, path, body, headers = {}, requestOptions = {}) {
  const m = String(method || "").toUpperCase();
  const pathLower = String(path || "").toLowerCase();
  const isRoleApi = pathLower.includes("/api/role");
  const isRoleMutation =
    isRoleApi && (m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE");
  if (isRoleMutation) {
    if (!isSuperuserUser()) {
      throw new Error("Only a superuser can create, update, or delete roles.");
    }
  } else {
    if (m === "POST" && !canCreateCurrentMenu()) {
      throw new Error("You are not allowed to create in this module.");
    }
    if ((m === "PUT" || m === "PATCH") && !canEditCurrentMenu()) {
      throw new Error("You are not allowed to edit in this module.");
    }
    if (m === "DELETE" && !canDeleteCurrentMenu()) {
      throw new Error("You are not allowed to delete in this module.");
    }
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

  const currentToken = getStoredAccessToken();
  if (
    currentToken &&
    isJwtExpiredOrNearExpiry(currentToken, TOKEN_REFRESH_SKEW_SECONDS) &&
    !isAuthRefreshPath(pathWithLeadingSlash)
  ) {
    try {
      await refreshAccessToken();
      const nextToken = getStoredAccessToken();
      if (nextToken) finalHeaders.Authorization = `Bearer ${nextToken}`;
    } catch (refreshErr) {
      // refreshAccessToken handles logout when refresh is unauthorized.
    }
  }

  const res = await fetch(url, fetchOptions);

  // If access token expired, refresh using HttpOnly cookie then retry ONCE.
  const tokenAfterRequest = getStoredAccessToken();
  const tokenLikelyExpired = tokenAfterRequest
    ? isJwtExpiredOrNearExpiry(tokenAfterRequest, TOKEN_REFRESH_SKEW_SECONDS)
    : false;
  const shouldTryRefresh =
    res.status === 401 &&
    Boolean(tokenAfterRequest) &&
    tokenLikelyExpired &&
    !requestOptions?._retried &&
    !isAuthRefreshPath(pathWithLeadingSlash);

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

  if (res.status === 401 && !isAuthRefreshPath(pathWithLeadingSlash)) {
    handleUnauthorized("fetch-401");
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
  getAccessTokenExpiryMs,
  logoutEverywhere,
  handleAuthStorageEvent,
  hasStoredAccessToken,
  storeAccessToken,
  setupAxiosInterceptors,
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
  isSuperuserUser,
  getCurrentUserRole,
  getActionBy,
  getLoggedInUsername,
  getUserIPAddress,
  getLoggedInUserBaseId,
  isLoggedInUserBaseReadCategory,
  getLoggedInUserCategoryRaw,
  loggedInUserHasCategoryToken,
  canAddContractAnnotations,
  contractsApprovalActionsBypassUser,
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
  isSuperuserUser,
  getCurrentUserRole,
  getActionBy,
  getLoggedInUsername,
  getUserIPAddress,
  getLoggedInUserBaseId,
  isLoggedInUserBaseReadCategory,
  getLoggedInUserCategoryRaw,
  loggedInUserHasCategoryToken,
  canAddContractAnnotations,
  contractsApprovalActionsBypassUser,
  logoutEverywhere,
  handleAuthStorageEvent,
  hasStoredAccessToken,
  storeAccessToken,
  notifyAuthSessionChanged,
  setupAxiosInterceptors,
  getAccessTokenExpiryMs,
};
