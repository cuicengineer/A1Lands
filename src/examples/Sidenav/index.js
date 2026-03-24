/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useEffect, useState } from "react";

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

// Custom styles for the Sidenav
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import sidenavLogoLabel from "examples/Sidenav/styles/sidenav";

// Material Dashboard 2 React context
import {
  useMaterialUIController,
  setMiniSidenav,
  setOpenConfigurator,
  setTransparentSidenav,
  setWhiteSidenav,
  setHasUserManuallyToggledSidenav,
} from "context";
import { canAccessPrivilegedConfigRoute, canViewMenu } from "services/api.service";

// Images
import adminProfile from "assets/images/bruce-mars.PNG";

function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    transparentSidenav,
    whiteSidenav,
    darkMode,
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
    try {
      localStorage.removeItem("token");
      localStorage.removeItem("authToken");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("auth");
    } catch (e) {
      // ignore
    }
    navigate("/");
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

  // Render routes recursively to support nested collapse items
  const renderNestedRoutes = (allRoutes) =>
    allRoutes
      .filter((route) => {
        const routePath = route?.route;
        if (!routePath) return true;
        return canAccessPrivilegedConfigRoute(routePath);
      })
      .map((route) => {
        const { type, name, icon, title, noCollapse, key, href, route: path, collapse } = route;
        const defaultIcon = <Icon fontSize="small">chevron_right</Icon>;

        if (type === "collapse") {
          const iconNode = icon || defaultIcon;
          const isOpen = openCollapse === key;

          const handleClick = () => {
            if (Array.isArray(collapse)) {
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
                active={isOpen}
                noCollapse={noCollapse}
                onClick={handleClick}
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
                if (Array.isArray(collapse)) {
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
              <SidenavCollapse name={name} icon={iconNode} active={isOpen} />
            </Link>
          ) : (
            <SidenavCollapse
              key={key}
              name={name}
              icon={iconNode}
              active={isOpen}
              onClick={handleClick}
            />
          );

          if (Array.isArray(collapse) && collapse.length > 0) {
            return (
              <MDBox key={`${key}-wrapper`}>
                {item}
                {isOpen && <MDBox ml={2}>{renderNestedRoutes(collapse)}</MDBox>}
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
              pl={3}
              mt={2}
              mb={1}
              ml={1}
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

  return (
    <SidenavRoot
      {...rest}
      variant="permanent"
      ownerState={{ transparentSidenav, whiteSidenav, miniSidenav, darkMode }}
    >
      <MDBox display="flex" flexDirection="column" height="100%">
        {/* Header */}
        <MDBox pt={3} pb={1} px={4} textAlign="center">
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
          <MDBox
            display="flex"
            alignItems="center"
            sx={{ textDecoration: "none", cursor: "default" }}
          >
            {brand && <MDBox component="img" src={brand} alt="Brand" width="2rem" />}
            <MDBox
              width={!brandName && "100%"}
              sx={(theme) => sidenavLogoLabel(theme, { miniSidenav })}
            >
              <MDTypography component="h6" variant="button" fontWeight="medium" color={textColor}>
                {brandName}
              </MDTypography>
            </MDBox>
            <MDBox
              display={{ xs: "none", xl: "block" }}
              onClick={(e) => {
                e.stopPropagation();
                toggleSidenavCollapse(e);
              }}
              sx={{ cursor: "pointer", ml: "auto", zIndex: 1 }}
            >
              <MDTypography variant="h6" color="secondary">
                <Icon sx={{ fontWeight: "bold" }}>{miniSidenav ? "menu_open" : "menu"}</Icon>
              </MDTypography>
            </MDBox>
          </MDBox>
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
            // Firefox - transparent track
            scrollbarWidth: "thin",
            scrollbarColor: "#333333 transparent",
            // Chrome/Safari/Edge - transparent track, visible thumb only
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
          <List>
            {renderNestedRoutes(
              routes.filter((route) => route?.type !== "collapse" || canViewMenu(route?.name))
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
          px={miniSidenav ? 2 : 3}
          py={2}
          display="flex"
          alignItems="center"
          justifyContent={miniSidenav ? "center" : "space-between"}
          gap={1}
        >
          <MDBox display="flex" alignItems="center" gap={1}>
            <MDAvatar
              src={adminProfile}
              alt="Admin User"
              size="sm"
              shadow="sm"
              sx={{ cursor: "pointer" }}
              onClick={handleOpenUserMenu}
            />
            {!miniSidenav && (
              <MDBox display="flex" flexDirection="column" lineHeight={1.2}>
                <MDTypography variant="button" fontWeight="medium" color={textColor}>
                  {loggedInUser.username}
                </MDTypography>
                <MDTypography variant="caption" fontWeight="regular" color={textColor}>
                  {loggedInUser.category}
                </MDTypography>
              </MDBox>
            )}
          </MDBox>

          <IconButton
            size="small"
            onClick={handleConfiguratorOpen}
            sx={{
              color: "#ffffff !important",
            }}
            title="Settings"
          >
            <Icon>settings</Icon>
          </IconButton>

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
