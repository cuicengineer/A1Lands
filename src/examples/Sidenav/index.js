/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useEffect, useMemo, useState } from "react";

// react-router-dom components
import { useLocation, useNavigate } from "react-router-dom";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @mui material components
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDAvatar from "components/MDAvatar";

// Material Dashboard 2 React example components
import SidenavCollapse from "examples/Sidenav/SidenavCollapse";
import SidenavBrand from "components/SidenavBrand";

// Custom styles for the Sidenav
import SidenavRoot from "examples/Sidenav/SidenavRoot";
// Material Dashboard 2 React context
import {
  useMaterialUIController,
  setMiniSidenav,
  setOpenConfigurator,
  setTransparentSidenav,
  setWhiteSidenav,
  setHasUserManuallyToggledSidenav,
} from "context";
import {
  canAccessPrivilegedConfigRoute,
  canViewMenu,
  logoutEverywhere,
} from "services/api.service";
import { normalizeSidenavColor } from "utils/sidenavColorTheme";

// Images
import adminProfile from "assets/images/bruce-mars.PNG";

function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    transparentSidenav,
    whiteSidenav,
    darkMode,
    sidenavColor,
    hasUserManuallyToggledSidenav,
    openConfigurator,
  } = controller;
  const location = useLocation();
  const navigate = useNavigate();

  const [openCollapse, setOpenCollapse] = useState(null);
  const [openUserMenu, setOpenUserMenu] = useState(null);
  const [loggedInUser, setLoggedInUser] = useState({ username: "User", category: "N/A" });

  let textColor = "white";

  if (transparentSidenav || (whiteSidenav && !darkMode)) {
    textColor = "dark";
  } else if (whiteSidenav && darkMode) {
    textColor = "inherit";
  }

  const closeSidenav = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setMiniSidenav(dispatch, true);
    setHasUserManuallyToggledSidenav(dispatch, true);
  };
  const toggleSidenavCollapse = (event) => {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    setMiniSidenav(dispatch, !miniSidenav);
    setHasUserManuallyToggledSidenav(dispatch, true);
  };

  const handleConfiguratorOpen = () => setOpenConfigurator(dispatch, !openConfigurator);
  const handleOpenUserMenu = (event) => setOpenUserMenu(event.currentTarget);
  const handleCloseUserMenu = () => setOpenUserMenu(null);
  const handleLogout = () => {
    handleCloseUserMenu();
    logoutEverywhere("manual");
  };

  const readLoggedInUser = () => {
    try {
      const raw = localStorage.getItem("auth");
      if (!raw) return { username: "User", category: "N/A" };
      const obj = JSON.parse(raw);
      const username = String(
        obj?.username || obj?.Username || obj?.userName || obj?.unique_name || ""
      ).trim();
      const category = String(obj?.category || obj?.Category || "").trim();
      return {
        username: username || "User",
        category: category || "N/A",
      };
    } catch (e) {
      return { username: "User", category: "N/A" };
    }
  };

  useEffect(() => {
    function handleMiniSidenav() {
      if (!hasUserManuallyToggledSidenav) {
        if (window.innerWidth < 1200) {
          setMiniSidenav(dispatch, true);
          setTransparentSidenav(dispatch, false);
          setWhiteSidenav(dispatch, false);
        } else {
          setMiniSidenav(dispatch, false);
          setTransparentSidenav(dispatch, transparentSidenav);
          setWhiteSidenav(dispatch, whiteSidenav);
        }
      }
    }

    window.addEventListener("resize", handleMiniSidenav);
    handleMiniSidenav();

    return () => window.removeEventListener("resize", handleMiniSidenav);
  }, [dispatch, location, transparentSidenav, whiteSidenav, hasUserManuallyToggledSidenav]);

  useEffect(() => {
    setLoggedInUser(readLoggedInUser());
  }, [location.pathname]);

  useEffect(() => {
    const onStorage = (event) => {
      if (!event || event.key === "auth") {
        setLoggedInUser(readLoggedInUser());
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const normalizePath = (p) => {
    const s = String(p || "").trim();
    if (!s) return "";
    return s.replace(/\/$/, "") || "/";
  };

  const allNavRoutePaths = useMemo(() => {
    const paths = [];
    const walk = (items) => {
      if (!Array.isArray(items)) return;
      items.forEach((item) => {
        if (item?.route) paths.push(normalizePath(item.route));
        if (item?.collapse) walk(item.collapse);
      });
    };
    walk(routes);
    return paths;
  }, [routes]);

  const isPathActive = (path) => {
    const target = normalizePath(path);
    if (!target) return false;
    const current = normalizePath(location.pathname);
    if (target === "/") return current === "/";
    if (current === target) return true;
    if (!current.startsWith(`${target}/`)) return false;
    // Avoid marking parent paths active when a more specific nav route matches
    // (e.g. /contracts must not stay active on /contracts/rental-properties).
    const hasMoreSpecificNavMatch = allNavRoutePaths.some(
      (other) =>
        other !== target &&
        other.startsWith(`${target}/`) &&
        (current === other || current.startsWith(`${other}/`))
    );
    return !hasMoreSpecificNavMatch;
  };

  const collapseHasActiveChild = (collapse) => {
    if (!Array.isArray(collapse)) return false;
    return collapse.some((child) => {
      if (child.route && isPathActive(child.route)) return true;
      if (child.collapse) return collapseHasActiveChild(child.collapse);
      return false;
    });
  };

  const findParentCollapseKeyForActiveRoute = (items) => {
    for (const item of items || []) {
      if (item?.type !== "collapse" || !Array.isArray(item.collapse)) continue;
      if (collapseHasActiveChild(item.collapse)) return item.key;
    }
    return null;
  };

  useEffect(() => {
    const parentKey = findParentCollapseKeyForActiveRoute(routes);
    if (parentKey) {
      setOpenCollapse(parentKey);
    }
  }, [location.pathname, routes]);

  const isSidenavRouteVisible = (route) => {
    if (route?.hideFromSidenav) return false;
    const routePath = route?.route;
    if (routePath && !canAccessPrivilegedConfigRoute(routePath)) return false;
    const hasSubmenu = Array.isArray(route?.collapse) && route.collapse.length > 0;
    if (hasSubmenu) {
      return route.collapse.some((child) => isSidenavRouteVisible(child));
    }
    if (route?.name) return canViewMenu(route.name);
    return true;
  };

  // Render routes recursively to support nested collapse items
  const renderNestedRoutes = (allRoutes) =>
    allRoutes
      .filter((route) => isSidenavRouteVisible(route))
      .map((route) => {
        const { type, name, icon, title, noCollapse, key, href, route: path, collapse } = route;
        const defaultIcon = <Icon fontSize="small">chevron_right</Icon>;

        if (type === "collapse") {
          const iconNode = icon || defaultIcon;
          const hasSubmenu = Array.isArray(collapse) && collapse.length > 0;
          const isOpen = openCollapse === key;
          const routeActive = path ? isPathActive(path) : false;
          const childActive = collapseHasActiveChild(collapse);
          const navActive = routeActive || childActive;
          const submenuProps = {
            hasSubmenu,
            expanded: hasSubmenu && isOpen,
          };

          const handleClick = () => {
            if (hasSubmenu) {
              setOpenCollapse(isOpen ? null : key);
            }
          };

          const item = href ? (
            <Link
              href={href}
              key={key}
              target="_blank"
              rel="noreferrer"
              sx={{ textDecoration: "none" }}
            >
              <SidenavCollapse
                name={name}
                icon={iconNode}
                active={navActive}
                noCollapse={noCollapse}
                onClick={handleClick}
                {...submenuProps}
              />
            </Link>
          ) : path ? (
            <Link
              key={key}
              href={path}
              sx={{ textDecoration: "none" }}
              onClick={(e) => {
                // Allow Ctrl+Click, Middle-click, and Right-click to open in new tab
                if (e.ctrlKey || e.metaKey || e.button === 1 || e.button === 2) {
                  return; // Let browser handle it naturally
                }
                // Normal click: use React Router navigation
                e.preventDefault();
                navigate(path);
                // Handle collapse toggle if needed
                if (hasSubmenu) {
                  handleClick();
                }
              }}
              onAuxClick={(e) => {
                // Middle-click (button 1) - let browser handle it
                if (e.button === 1) {
                  return;
                }
              }}
            >
              <SidenavCollapse name={name} icon={iconNode} active={navActive} {...submenuProps} />
            </Link>
          ) : (
            <SidenavCollapse
              key={key}
              name={name}
              icon={iconNode}
              active={navActive || isOpen}
              onClick={handleClick}
              {...submenuProps}
            />
          );

          if (hasSubmenu) {
            return (
              <MDBox key={`${key}-wrapper`}>
                {item}
                {isOpen && (
                  <MDBox
                    sx={{
                      pl: miniSidenav ? 0 : 1,
                      minWidth: 0,
                      maxWidth: "100%",
                      boxSizing: "border-box",
                    }}
                  >
                    {renderNestedRoutes(collapse)}
                  </MDBox>
                )}
              </MDBox>
            );
          }

          return item;
        }

        if (type === "title") {
          return (
            <MDTypography
              key={key}
              color={textColor}
              display="block"
              variant="caption"
              fontWeight="bold"
              textTransform="uppercase"
              px={2}
              mt={2}
              mb={1}
              sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
            >
              {title}
            </MDTypography>
          );
        }

        if (type === "divider") {
          return (
            <Divider
              key={key}
              light={
                (!darkMode && !whiteSidenav && !transparentSidenav) ||
                (darkMode && !transparentSidenav && whiteSidenav)
              }
            />
          );
        }

        return null;
      });

  const resolvedSidenavColor = normalizeSidenavColor(sidenavColor);

  return (
    <SidenavRoot
      {...rest}
      variant="permanent"
      className={`enterprise-sidenav enterprise-sidenav--color-${resolvedSidenavColor}${
        miniSidenav ? " enterprise-sidenav--mini" : ""
      }`}
      ownerState={{
        transparentSidenav,
        whiteSidenav,
        miniSidenav,
        darkMode,
        sidenavColor: resolvedSidenavColor,
      }}
    >
      <MDBox
        display="flex"
        flexDirection="column"
        height="100%"
        sx={{ minWidth: 0, maxWidth: "100%", overflow: "hidden" }}
      >
        {/* Header */}
        <MDBox
          pt={miniSidenav ? 2 : 3}
          pb={1}
          px={miniSidenav ? 1 : 2}
          textAlign="center"
          position="relative"
          sx={{ minWidth: 0, overflow: "hidden" }}
        >
          <MDBox
            display={{ xs: "block", xl: "none" }}
            position="absolute"
            top={0}
            right={0}
            p={1.625}
            onClick={closeSidenav}
            sx={{ cursor: "pointer", zIndex: 1 }}
          >
            <MDTypography variant="h6" color="secondary">
              <Icon sx={{ fontWeight: "bold" }}>close</Icon>
            </MDTypography>
          </MDBox>
          <MDBox
            display={{ xs: "block", xl: "none" }}
            position="absolute"
            top={0}
            right={50}
            p={1.625}
            onClick={toggleSidenavCollapse}
            sx={{ cursor: "pointer", zIndex: 1 }}
          >
            <MDTypography variant="h6" color="secondary">
              <Icon sx={{ fontWeight: "bold" }}>{miniSidenav ? "menu_open" : "menu"}</Icon>
            </MDTypography>
          </MDBox>

          {miniSidenav ? (
            <MDBox display="flex" flexDirection="column" alignItems="center" gap={1}>
              <SidenavBrand mini />
              <MDBox
                display={{ xs: "none", xl: "flex" }}
                alignItems="center"
                justifyContent="center"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSidenavCollapse(e);
                }}
                sx={{
                  cursor: "pointer",
                  width: "100%",
                  py: 0.5,
                  borderRadius: 1,
                  "&:hover": { backgroundColor: "rgba(0,0,0,0.04)" },
                }}
                title="Expand sidebar"
              >
                <Icon className="material-icons-outlined" sx={{ fontWeight: "bold" }}>
                  menu_open
                </Icon>
              </MDBox>
            </MDBox>
          ) : (
            <MDBox
              display="flex"
              alignItems="center"
              sx={{ textDecoration: "none", cursor: "default", minWidth: 0, width: "100%" }}
            >
              <SidenavBrand />
              <MDBox
                display={{ xs: "none", xl: "block" }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleSidenavCollapse(e);
                }}
                sx={{ cursor: "pointer", ml: "auto", zIndex: 1, flexShrink: 0 }}
                title="Collapse sidebar"
              >
                <MDTypography variant="h6" color="secondary">
                  <Icon className="material-icons-outlined" sx={{ fontWeight: "bold" }}>
                    menu
                  </Icon>
                </MDTypography>
              </MDBox>
            </MDBox>
          )}
        </MDBox>

        <Divider
          light={
            (!darkMode && !whiteSidenav && !transparentSidenav) ||
            (darkMode && !transparentSidenav && whiteSidenav)
          }
        />

        {/* Main routes (scrollable) */}
        <MDBox
          flex={1}
          overflow="auto"
          sx={{
            minWidth: 0,
            maxWidth: "100%",
            overflowX: "hidden",
            scrollbarGutter: "stable",
            scrollbarWidth: "thin",
            scrollbarColor: "#333333 transparent",
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-track": {
              backgroundColor: "transparent",
            },
            "&::-webkit-scrollbar-thumb": {
              backgroundColor: "#333333",
              borderRadius: "10px",
              border: "none",
              "&:hover": {
                backgroundColor: "#1a1a1a",
              },
            },
            "&::-webkit-scrollbar-button": {
              display: "none",
              width: 0,
              height: 0,
            },
          }}
        >
          <List sx={{ py: 0, minWidth: 0, maxWidth: "100%" }}>
            {renderNestedRoutes(
              routes.filter((route) => route?.type !== "collapse" || isSidenavRouteVisible(route))
            )}
          </List>
        </MDBox>

        {/* Footer controls (avatar + settings) */}
        <Divider
          light={
            (!darkMode && !whiteSidenav && !transparentSidenav) ||
            (darkMode && !transparentSidenav && whiteSidenav)
          }
        />
        <MDBox
          className="enterprise-sidenav-footer"
          px={miniSidenav ? 1 : 2}
          py={2}
          display="flex"
          alignItems="center"
          justifyContent={miniSidenav ? "center" : "space-between"}
          gap={1}
          sx={{ minWidth: 0, maxWidth: "100%", overflow: "hidden", flexShrink: 0 }}
        >
          <MDBox display="flex" alignItems="center" gap={1} sx={{ minWidth: 0, flex: "1 1 auto" }}>
            <MDAvatar
              src={adminProfile}
              alt="Admin User"
              size="sm"
              shadow="sm"
              sx={{ cursor: "pointer", flexShrink: 0 }}
              onClick={handleOpenUserMenu}
            />
            {!miniSidenav && (
              <MDBox display="flex" flexDirection="column" lineHeight={1.2} sx={{ minWidth: 0 }}>
                <MDTypography
                  variant="button"
                  fontWeight="medium"
                  color={textColor}
                  sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {loggedInUser.username}
                </MDTypography>
                <MDTypography
                  variant="caption"
                  fontWeight="regular"
                  color={textColor}
                  sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                >
                  {loggedInUser.category}
                </MDTypography>
              </MDBox>
            )}
          </MDBox>

          {!miniSidenav ? (
            <IconButton
              size="small"
              onClick={handleConfiguratorOpen}
              sx={{
                color: "#ffffff !important",
                flexShrink: 0,
              }}
              title="Settings"
            >
              <Icon>settings</Icon>
            </IconButton>
          ) : null}

          <Menu
            anchorEl={openUserMenu}
            open={Boolean(openUserMenu)}
            onClose={handleCloseUserMenu}
            anchorOrigin={{ vertical: "top", horizontal: "right" }}
            transformOrigin={{ vertical: "bottom", horizontal: "right" }}
            sx={{ mt: -1 }}
          >
            <MenuItem onClick={handleLogout} sx={{ minWidth: 180 }}>
              <Icon sx={{ mr: 1, fontSize: 18 }}>logout</Icon>
              Logout
            </MenuItem>
          </Menu>
        </MDBox>
      </MDBox>
    </SidenavRoot>
  );
}

// Setting default values for the props of Sidenav
Sidenav.defaultProps = {
  color: "info",
  brand: "",
};

// Typechecking props for the Sidenav
Sidenav.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  brand: PropTypes.string,
  brandName: PropTypes.string.isRequired,
  routes: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default Sidenav;
