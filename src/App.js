/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";

// react-router components
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// @mui material components
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDSnackbar from "components/MDSnackbar";

// Material Dashboard 2 React example components
import Sidenav from "examples/Sidenav";
import Configurator from "examples/Configurator";

// Material Dashboard 2 React themes
import theme from "assets/theme";
import themeRTL from "assets/theme/theme-rtl";

// Material Dashboard 2 React Dark Mode themes
import themeDark from "assets/theme-dark";
import themeDarkRTL from "assets/theme-dark/theme-rtl";

// RTL plugins
import rtlPlugin from "stylis-plugin-rtl";
import { CacheProvider } from "@emotion/react";
import createCache from "@emotion/cache";

// Material Dashboard 2 React routes
import routes from "routes";
import api, {
  canViewCurrentMenu,
  handleAuthStorageEvent,
  hasStoredAccessToken,
  logoutEverywhere,
} from "services/api.service";

// Material Dashboard 2 React contexts
import { useMaterialUIController, setMiniSidenav, setLayout, setOpenConfigurator } from "context";

// Images
import pafLogo from "examples/login_page/assets/img/PAF-Logo.gif";

const LAST_ACTIVITY_KEY = "lastActivityAt";
const AUTH_SESSION_CHANGED_EVENT = "auth:session-changed";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const SLIDING_TOKEN_REFRESH_MS = 5 * 60 * 1000;
const TOKEN_REFRESH_BEFORE_EXPIRY_MS = 60 * 1000;
const MIN_TOKEN_REFRESH_DELAY_MS = 30 * 1000;

const isPublicAuthRoute = (path) =>
  path === "/" ||
  path === "/login" ||
  path.startsWith("/authentication/") ||
  path.startsWith("/sign-in");

function getContractsAlertTone(message) {
  const text = String(message || "").toLowerCase();
  if (
    /\b(success|saved|created|updated|deleted|uploaded|finalized|approved|complete)\b/.test(text)
  ) {
    return { color: "success", icon: "check_circle", title: "Success" };
  }
  if (/\b(error|failed|failure|exception)\b/.test(text)) {
    return { color: "error", icon: "error", title: "Error" };
  }
  return { color: "info", icon: "info", title: "Notice" };
}

function ContractsAlertSkin({ enabled }) {
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!enabled) return undefined;

    const nativeAlert = window.alert;
    window.alert = (message) => {
      const content = String(message ?? "");
      const tone = getContractsAlertTone(content);
      setToast({
        id: Date.now(),
        content,
        ...tone,
      });
    };

    return () => {
      window.alert = nativeAlert;
    };
  }, [enabled]);

  if (!enabled || !toast) return null;

  return (
    <MDSnackbar
      key={toast.id}
      color={toast.color}
      icon={toast.icon}
      title={toast.title}
      content={toast.content}
      dateTime="now"
      open={Boolean(toast)}
      close={() => setToast(null)}
      onClose={() => setToast(null)}
      anchorOrigin={{ vertical: "top", horizontal: "right" }}
      sx={{ mt: 6 }}
    />
  );
}

ContractsAlertSkin.defaultProps = {
  enabled: false,
};

ContractsAlertSkin.propTypes = {
  enabled: PropTypes.bool,
};

export default function App() {
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    direction,
    layout,
    openConfigurator,
    sidenavColor,
    transparentSidenav,
    whiteSidenav,
    darkMode,
    hasUserManuallyToggledSidenav,
  } = controller;

  const [rtlCache, setRtlCache] = useState(null);
  const { pathname } = useLocation();
  const [isAuthenticated, setIsAuthenticated] = useState(() => hasStoredAccessToken());

  useEffect(() => {
    const syncAuth = () => setIsAuthenticated(hasStoredAccessToken());
    window.addEventListener("storage", syncAuth);
    window.addEventListener(AUTH_SESSION_CHANGED_EVENT, syncAuth);
    return () => {
      window.removeEventListener("storage", syncAuth);
      window.removeEventListener(AUTH_SESSION_CHANGED_EVENT, syncAuth);
    };
  }, []);

  useEffect(() => {
    setIsAuthenticated(hasStoredAccessToken());
  }, [pathname]);

  useEffect(() => {
    if (!isAuthenticated && isPublicAuthRoute(pathname)) {
      setLayout(dispatch, "page");
    }
  }, [pathname, isAuthenticated, dispatch]);

  const showDashboardChrome =
    hasStoredAccessToken() && layout === "dashboard" && !isPublicAuthRoute(pathname);
  const useContractsAlertSkin = pathname === "/contracts" || pathname.startsWith("/contracts/");

  // Enterprise visual theme is applied to every dashboard page but never to
  // the login / public auth screens, which keep their original design.
  useEffect(() => {
    const enableEnterpriseUi = !isPublicAuthRoute(pathname);
    document.body.classList.toggle("enterprise-ui", enableEnterpriseUi);
    return () => {
      document.body.classList.remove("enterprise-ui");
    };
  }, [pathname]);

  // Cache for the rtl
  useMemo(() => {
    const cacheRtl = createCache({
      key: "rtl",
      stylisPlugins: [rtlPlugin],
    });

    setRtlCache(cacheRtl);
  }, []);

  // Change the openConfigurator state
  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);

  // Setting the dir attribute for the body element
  useEffect(() => {
    document.body.setAttribute("dir", direction);
  }, [direction]);

  // Setting page scroll to 0 when changing the route
  useEffect(() => {
    document.documentElement.scrollTop = 0;
    document.scrollingElement.scrollTop = 0;

    const active = document.activeElement;
    if (active instanceof HTMLElement) {
      const inWorkspaceHeader =
        active.closest(".saas-workspace-page-header") ||
        active.closest(".saas-workspace-page-heading");
      if (inWorkspaceHeader) {
        active.blur();
      }
    }
  }, [pathname]);

  // Fetch user context (including IP) from backend when authenticated - no external IP APIs
  useEffect(() => {
    if (isAuthenticated && pathname && !isPublicAuthRoute(pathname)) {
      api.fetchAndUpdateUserContext().catch(() => {});
    }
  }, [pathname, isAuthenticated]);

  // Logout only on inactivity of 5 minutes.
  useEffect(() => {
    let inactivityTimer;
    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "click"];
    const getLastActivityTs = () => {
      try {
        const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
        const ts = Number(raw);
        return Number.isFinite(ts) ? ts : 0;
      } catch (e) {
        return 0;
      }
    };

    const clearAuthAndLogout = () => {
      logoutEverywhere("inactive");
    };

    const resetInactivityTimer = () => {
      if (!hasStoredAccessToken()) return;
      clearTimeout(inactivityTimer);
      inactivityTimer = setTimeout(() => {
        const lastTs = getLastActivityTs();
        const isInactive = !lastTs || Date.now() - lastTs >= INACTIVITY_TIMEOUT_MS;
        // Cross-tab safe: logout only if all tabs have been inactive.
        if (isInactive) {
          clearAuthAndLogout();
        } else {
          resetInactivityTimer();
        }
      }, INACTIVITY_TIMEOUT_MS);
    };

    const markActivity = () => {
      if (!hasStoredAccessToken()) return;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      } catch (e) {
        // ignore
      }
      resetInactivityTimer();
    };
    const handleStorage = (event) => {
      handleAuthStorageEvent(event);
      if (event.key === LAST_ACTIVITY_KEY && hasStoredAccessToken()) {
        resetInactivityTimer();
      }
    };

    if (isAuthenticated) {
      markActivity();
      activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity));
      window.addEventListener("storage", handleStorage);
    }

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.removeEventListener("storage", handleStorage);
    };
  }, [pathname, isAuthenticated]);

  // While the user is active, silently refresh just before the access token expires.
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let refreshTimer;
    const isWorkingSession = () => {
      try {
        const raw = localStorage.getItem(LAST_ACTIVITY_KEY);
        const ts = Number(raw);
        if (!Number.isFinite(ts) || ts <= 0) return true;
        return Date.now() - ts < INACTIVITY_TIMEOUT_MS;
      } catch (e) {
        return false;
      }
    };

    const scheduleRefresh = () => {
      clearTimeout(refreshTimer);
      if (!hasStoredAccessToken() || !isWorkingSession()) return;
      const expiresAt = api.getAccessTokenExpiryMs();
      const delay = expiresAt
        ? Math.max(
            expiresAt - Date.now() - TOKEN_REFRESH_BEFORE_EXPIRY_MS,
            MIN_TOKEN_REFRESH_DELAY_MS
          )
        : SLIDING_TOKEN_REFRESH_MS;
      refreshTimer = setTimeout(() => {
        if (!hasStoredAccessToken() || !isWorkingSession()) return;
        api
          .refreshAccessToken()
          .catch(() => {})
          .finally(scheduleRefresh);
      }, delay);
    };

    const handleStorage = (event) => {
      handleAuthStorageEvent(event);
      if (
        event.key === LAST_ACTIVITY_KEY ||
        event.key === "token" ||
        event.key === "authToken" ||
        event.key === "accessToken"
      ) {
        scheduleRefresh();
      }
    };

    scheduleRefresh();
    window.addEventListener("storage", handleStorage);
    return () => {
      clearTimeout(refreshTimer);
      window.removeEventListener("storage", handleStorage);
    };
  }, [pathname, isAuthenticated]);

  const getRoutes = (allRoutes) =>
    allRoutes.map((route) => {
      if (route.collapse) {
        return getRoutes(route.collapse);
      }

      if (route.route) {
        const isPublicRoute =
          route.route === "/" ||
          route.route.startsWith("/authentication/") ||
          route.route.startsWith("/login") ||
          route.route.startsWith("/sign-in");

        const element = isPublicRoute ? (
          route.component
        ) : hasStoredAccessToken() ? (
          canViewCurrentMenu(route.route) ? (
            route.component
          ) : (
            <Navigate to="/" replace />
          )
        ) : (
          <Navigate to="/" replace />
        );

        return <Route exact path={route.route} element={element} key={route.key} />;
      }

      return null;
    });

  const configsButton = (
    <MDBox
      display="flex"
      justifyContent="center"
      alignItems="center"
      width="3.25rem"
      height="3.25rem"
      bgColor="white"
      shadow="sm"
      borderRadius="50%"
      position="fixed"
      right="2rem"
      bottom="2rem"
      zIndex={99}
      color="dark"
      sx={{ cursor: "pointer" }}
      onClick={handleConfiguratorOpen}
    >
      <Icon fontSize="small" color="inherit">
        settings2
      </Icon>
    </MDBox>
  );

  return direction === "rtl" ? (
    <CacheProvider value={rtlCache}>
      <ThemeProvider theme={darkMode ? themeDarkRTL : themeRTL}>
        <CssBaseline />
        {showDashboardChrome && (
          <>
            <Sidenav color={sidenavColor} brand={pafLogo} brandName="A1 LMS" routes={routes} />
            <Configurator />
            {configsButton}
          </>
        )}
        {layout === "vr" && hasStoredAccessToken() && !isPublicAuthRoute(pathname) && (
          <Configurator />
        )}
        <Routes>
          {getRoutes(routes)}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
        <ContractsAlertSkin enabled={useContractsAlertSkin} />
      </ThemeProvider>
    </CacheProvider>
  ) : (
    <ThemeProvider theme={darkMode ? themeDark : theme}>
      <CssBaseline />
      {showDashboardChrome && (
        <>
          <Sidenav color={sidenavColor} brand={pafLogo} brandName="A1 LMS" routes={routes} />
          <Configurator />
        </>
      )}
      {layout === "vr" && hasStoredAccessToken() && !isPublicAuthRoute(pathname) && (
        <Configurator />
      )}
      <Routes>
        {getRoutes(routes)}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
      <ContractsAlertSkin enabled={useContractsAlertSkin} />
    </ThemeProvider>
  );
}
