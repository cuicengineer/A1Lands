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

import { useState } from "react";

// @mui material components
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import Tooltip from "@mui/material/Tooltip";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Custom styles for the Configurator
import ConfiguratorRoot from "examples/Configurator/ConfiguratorRoot";
import ChangePasswordDialog from "examples/Configurator/ChangePasswordDialog";

// Material Dashboard 2 React context
import { useMaterialUIController, setOpenConfigurator, setSidenavColor } from "context";
import { SIDENAV_COLOR_OPTIONS } from "utils/sidenavColorTheme";

const SIDENAV_COLORS_PER_ROW = 7;

function Configurator() {
  const [controller, dispatch] = useMaterialUIController();
  const { openConfigurator, sidenavColor, darkMode } = controller;
  const [changePasswordOpen, setChangePasswordOpen] = useState(false);

  const handleCloseConfigurator = () => setOpenConfigurator(dispatch, false);
  const firstRowColors = SIDENAV_COLOR_OPTIONS.slice(0, SIDENAV_COLORS_PER_ROW);
  const secondRowColors = SIDENAV_COLOR_OPTIONS.slice(SIDENAV_COLORS_PER_ROW);

  const renderColorSwatch = ({ value, color }) => (
    <IconButton
      key={value}
      sx={({ borders: { borderWidth }, palette: { white, dark, background }, transitions }) => ({
        width: "24px",
        height: "24px",
        padding: 0,
        border: `${borderWidth[1]} solid ${
          sidenavColor === value
            ? darkMode
              ? white.main
              : dark.main
            : darkMode
            ? background.sidenav
            : white.main
        }`,
        transition: transitions.create("border-color", {
          easing: transitions.easing.sharp,
          duration: transitions.duration.shorter,
        }),
        backgroundColor: color,

        "&:not(:last-child)": {
          mr: 1,
        },

        "&:hover, &:focus, &:active": {
          borderColor: darkMode ? white.main : dark.main,
        },
      })}
      onClick={() => setSidenavColor(dispatch, value)}
    />
  );

  return (
    <ConfiguratorRoot variant="permanent" ownerState={{ openConfigurator }}>
      <MDBox
        display="flex"
        justifyContent="space-between"
        alignItems="baseline"
        pt={4}
        pb={0.5}
        px={3}
      >
        <MDBox>
          <MDTypography variant="h5">UI Setting</MDTypography>
          <MDTypography variant="body2" color="text">
            Change as per Requirement
          </MDTypography>
        </MDBox>

        <Icon
          sx={({ typography: { size }, palette: { dark, white } }) => ({
            fontSize: `${size.lg} !important`,
            color: darkMode ? white.main : dark.main,
            stroke: "currentColor",
            strokeWidth: "2px",
            cursor: "pointer",
            transform: "translateY(5px)",
          })}
          onClick={handleCloseConfigurator}
        >
          close
        </Icon>
      </MDBox>

      <Divider />

      <MDBox pt={0.5} pb={3} px={3}>
        <MDBox>
          <MDTypography variant="h6">Sidenav Colors</MDTypography>

          <MDBox display="flex" flexWrap="nowrap" mb={secondRowColors.length ? 0.5 : 0}>
            {firstRowColors.map(renderColorSwatch)}
          </MDBox>
          {secondRowColors.length > 0 ? (
            <MDBox display="flex" flexWrap="nowrap">
              {secondRowColors.map(renderColorSwatch)}
            </MDBox>
          ) : null}
        </MDBox>

        <Divider sx={{ my: 2 }} />

        <MDBox display="flex" alignItems="center" justifyContent="space-between">
          <MDBox>
            <MDTypography variant="h6">Account</MDTypography>
            <MDTypography variant="caption" color="text">
              Update your login password
            </MDTypography>
          </MDBox>
          <Tooltip title="Change Password">
            <IconButton
              color="info"
              onClick={() => setChangePasswordOpen(true)}
              aria-label="Change Password"
              size="large"
            >
              <Icon>lock_reset</Icon>
            </IconButton>
          </Tooltip>
        </MDBox>
      </MDBox>

      <ChangePasswordDialog
        open={changePasswordOpen}
        onClose={() => setChangePasswordOpen(false)}
      />
    </ConfiguratorRoot>
  );
}

export default Configurator;
