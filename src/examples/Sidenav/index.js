/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useState, useEffect } from "react";

// react-router-dom components
import { useLocation, NavLink } from "react-router-dom";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @mui material components
import List from "@mui/material/List";
import Divider from "@mui/material/Divider";
import Link from "@mui/material/Link";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";

// Material Dashboard 2 React example components
import SidenavCollapse from "examples/Sidenav/SidenavCollapse";

// Custom styles for the Sidenav
import SidenavRoot from "examples/Sidenav/SidenavRoot";
import sidenavLogoLabel from "examples/Sidenav/styles/sidenav";

// Material Dashboard 2 React context
import {
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
  setHasUserManuallyToggledSidenav,
} from "context";

function Sidenav({ color, brand, brandName, routes, ...rest }) {
  const [controller, dispatch] = useMaterialUIController();
  const {
    miniSidenav,
    transparentSidenav,
    whiteSidenav,
    darkMode,
    sidenavColor,
    hasUserManuallyToggledSidenav,
  } = controller;
  const location = useLocation();

  const [openCollapse, setOpenCollapse] = useState(null);

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

  // Render routes recursively to support nested collapse items
  const renderNestedRoutes = (allRoutes) =>
    allRoutes.map((route) => {
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
              onClick={handleClick} // 🔧 FIX
            />
          </Link>
        ) : path ? (
          <NavLink key={key} to={path}>
            <SidenavCollapse name={name} icon={iconNode} active={isOpen} />
          </NavLink>
        ) : (
          <SidenavCollapse
            key={key}
            name={name}
            icon={iconNode}
            active={isOpen}
            onClick={handleClick} // 🔧 FIX
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
        <MDBox component={NavLink} to="/" display="flex" alignItems="center">
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
            onClick={toggleSidenavCollapse}
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
      <List>{renderNestedRoutes(routes)}</List>
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
