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

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// @mui material components
import ListItem from "@mui/material/ListItem";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";

// Custom styles for the SidenavCollapse
import {
  collapseItem,
  collapseIconBox,
  collapseIcon,
  collapseText,
} from "examples/Sidenav/styles/sidenavCollapse";

// Material Dashboard 2 React context
import { useMaterialUIController } from "context";

function SidenavCollapse({ icon, name, active, hasSubmenu, expanded, ...rest }) {
  const [controller] = useMaterialUIController();
  const { miniSidenav, transparentSidenav, whiteSidenav, darkMode, sidenavColor } = controller;

  const navItemClass = [
    "enterprise-sidenav-nav-item",
    miniSidenav ? "enterprise-sidenav-nav-item--mini" : "",
    active ? "enterprise-sidenav-nav-item--active" : "",
    hasSubmenu ? "enterprise-sidenav-nav-item--has-submenu" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <ListItem
      component="li"
      disablePadding
      sx={{
        px: miniSidenav ? 0.25 : 1,
        py: 0.125,
        display: "flex",
        justifyContent: miniSidenav ? "center" : "flex-start",
      }}
    >
      <MDBox
        {...rest}
        className={navItemClass}
        sx={(theme) =>
          collapseItem(theme, {
            active,
            transparentSidenav,
            whiteSidenav,
            darkMode,
            sidenavColor,
            miniSidenav,
          })
        }
      >
        <ListItemIcon
          sx={(theme) =>
            collapseIconBox(theme, {
              transparentSidenav,
              whiteSidenav,
              darkMode,
              active,
              miniSidenav,
            })
          }
        >
          {typeof icon === "string" ? (
            <Icon
              className="material-icons-outlined"
              sx={(theme) => collapseIcon(theme, { active })}
            >
              {icon}
            </Icon>
          ) : (
            <MDBox
              className="enterprise-sidenav-nav-icon-wrap"
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "inherit",
                lineHeight: 0,
                "& .MuiIcon-root": {
                  color: "inherit !important",
                  fontSize: miniSidenav ? "1.2rem !important" : "1.125rem !important",
                  width: miniSidenav ? "1.2rem !important" : "1.125rem !important",
                  height: miniSidenav ? "1.2rem !important" : "1.125rem !important",
                },
              }}
            >
              {icon}
            </MDBox>
          )}
        </ListItemIcon>

        {!miniSidenav && (
          <ListItemText
            primary={name}
            sx={(theme) =>
              collapseText(theme, {
                miniSidenav,
                transparentSidenav,
                whiteSidenav,
                active,
              })
            }
          />
        )}

        {hasSubmenu && !miniSidenav ? (
          <Icon
            className="enterprise-sidenav-submenu-arrow material-icons-outlined"
            sx={{
              flexShrink: 0,
              ml: 0.5,
              color: "inherit",
              opacity: 0.9,
              fontSize: "1.125rem !important",
              width: "1.125rem !important",
              height: "1.125rem !important",
              transition: "transform 200ms ease-in-out",
            }}
            aria-hidden
          >
            {expanded ? "keyboard_arrow_down" : "keyboard_arrow_right"}
          </Icon>
        ) : null}
      </MDBox>
    </ListItem>
  );
}

// Setting default values for the props of SidenavCollapse
SidenavCollapse.defaultProps = {
  active: false,
  hasSubmenu: false,
  expanded: false,
};

// Typechecking props for the SidenavCollapse
SidenavCollapse.propTypes = {
  icon: PropTypes.node.isRequired,
  name: PropTypes.string.isRequired,
  active: PropTypes.bool,
  hasSubmenu: PropTypes.bool,
  expanded: PropTypes.bool,
};

export default SidenavCollapse;
