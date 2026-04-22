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

// react-router components
import { Routes, Route, Navigate, useLocation } from "react-router-dom";

// @mui material components
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";

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
import api, { canViewCurrentMenu } from "services/api.service";

// Material Dashboard 2 React contexts
import { useMaterialUIController, setMiniSidenav, setOpenConfigurator } from "context";

// Images
import pafLogo from "examples/login_page/assets/img/PAF-Logo.gif";

const LAST_ACTIVITY_KEY = "lastActivityAt";
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;
const SLIDING_TOKEN_REFRESH_MS = 5 * 60 * 1000;

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

  const hasAccessToken = () => {
    try {
      return Boolean(
        localStorage.getItem("token") ||
          localStorage.getItem("authToken") ||
          localStorage.getItem("accessToken")
      );
    } catch (e) {
      return false;
    }
  };

  // Note: route-level guard is applied in getRoutes(). Keeping this file-level helper removed to avoid unused vars.

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
  }, [pathname]);

  // Fetch user context (including IP) from backend when authenticated - no external IP APIs
  useEffect(() => {
    if (
      hasAccessToken() &&
      pathname &&
      !pathname.startsWith("/") &&
      !pathname.startsWith("/authentication") &&
      !pathname.startsWith("/login") &&
      !pathname.startsWith("/sign-in")
    ) {
      api.fetchAndUpdateUserContext().catch(() => {});
    }
  }, [pathname]);

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
      try {
        localStorage.removeItem("token");
        localStorage.removeItem("authToken");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("auth");
        localStorage.removeItem(LAST_ACTIVITY_KEY);
      } catch (e) {
        // ignore
      }
      if (window.location.pathname !== "/") {
        window.location.assign("/");
      }
    };

    const resetInactivityTimer = () => {
      if (!hasAccessToken()) return;
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
      if (!hasAccessToken()) return;
      try {
        localStorage.setItem(LAST_ACTIVITY_KEY, String(Date.now()));
      } catch (e) {
        // ignore
      }
      resetInactivityTimer();
    };
    const handleStorage = (event) => {
      if (event.key === LAST_ACTIVITY_KEY && hasAccessToken()) {
        resetInactivityTimer();
      }
    };

    if (hasAccessToken()) {
      markActivity();
      activityEvents.forEach((eventName) => window.addEventListener(eventName, markActivity));
      window.addEventListener("storage", handleStorage);
    }

    return () => {
      clearTimeout(inactivityTimer);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, markActivity));
      window.removeEventListener("storage", handleStorage);
    };
  }, [pathname]);

  // While the user is active (same window as inactivity), periodically refresh so the server refresh token stays valid during work.
  useEffect(() => {
    if (!hasAccessToken()) return undefined;
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
    const tick = () => {
      if (!hasAccessToken() || !isWorkingSession()) return;
      api.refreshAccessToken().catch(() => {});
    };
    const id = setInterval(tick, SLIDING_TOKEN_REFRESH_MS);
    return () => clearInterval(id);
  }, [pathname]);

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
        ) : hasAccessToken() ? (
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
        {layout === "dashboard" && hasAccessToken() && (
          <>
            <Sidenav color={sidenavColor} brand={pafLogo} brandName="A1 LMS" routes={routes} />
            <Configurator />
            {configsButton}
          </>
        )}
        {layout === "vr" && hasAccessToken() && <Configurator />}
        <Routes>
          {getRoutes(routes)}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </ThemeProvider>
    </CacheProvider>
  ) : (
    <ThemeProvider theme={darkMode ? themeDark : theme}>
      <CssBaseline />
      {layout === "dashboard" && hasAccessToken() && (
        <>
          <Sidenav color={sidenavColor} brand={pafLogo} brandName="A1 LMS" routes={routes} />
          <Configurator />
        </>
      )}
      {layout === "vr" && hasAccessToken() && <Configurator />}
      <Routes>
        {getRoutes(routes)}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </ThemeProvider>
  );
}
