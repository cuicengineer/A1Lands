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

import { forwardRef } from "react";

// prop-types is a library for typechecking of props
import PropTypes from "prop-types";

// Custom styles for the MDBadge
import MDBadgeRoot from "components/MDBadge/MDBadgeRoot";
import { isEnterpriseSettingsUI } from "utils/enterpriseSettingsUI";

const ENTERPRISE_BADGE_PALETTES = {
  success: { bg: "#ecfdf3", border: "#86efac", fg: "#15803d" },
  error: { bg: "#fef2f2", border: "#fecaca", fg: "#b91c1c" },
  dark: { bg: "#fef2f2", border: "#fecaca", fg: "#b91c1c" },
  warning: { bg: "#fffbeb", border: "#fde68a", fg: "#b45309" },
  info: { bg: "#eff6ff", border: "#bfdbfe", fg: "#1d4ed8" },
  primary: { bg: "#ecfdf3", border: "#86efac", fg: "#15803d" },
  secondary: { bg: "#f4f4f5", border: "#e4e4e7", fg: "#52525b" },
  light: { bg: "#f8fafc", border: "#e2e8f0", fg: "#475569" },
};

function getEnterpriseBadgeSx(color, variant, sx) {
  if (!isEnterpriseSettingsUI() || variant !== "gradient") return sx;
  const palette = ENTERPRISE_BADGE_PALETTES[color] || ENTERPRISE_BADGE_PALETTES.info;
  return {
    ...(sx && typeof sx === "object" ? sx : {}),
    "& .MuiBadge-badge": {
      backgroundImage: "none !important",
      background: `${palette.bg} !important`,
      color: `${palette.fg} !important`,
      border: `1px solid ${palette.border} !important`,
      textTransform: "none !important",
      boxShadow: "none !important",
    },
  };
}

const MDBadge = forwardRef(
  (
    { color, variant, size, circular, indicator, border, container, children, sx, ...rest },
    ref
  ) => (
    <MDBadgeRoot
      {...rest}
      sx={getEnterpriseBadgeSx(color, variant, sx)}
      ownerState={{ color, variant, size, circular, indicator, border, container, children }}
      ref={ref}
      color="default"
    >
      {children}
    </MDBadgeRoot>
  )
);

// Setting default values for the props of MDBadge
MDBadge.defaultProps = {
  color: "info",
  variant: "gradient",
  size: "sm",
  circular: false,
  indicator: false,
  border: false,
  children: false,
  container: false,
};

// Typechecking props of the MDBadge
MDBadge.propTypes = {
  color: PropTypes.oneOf([
    "primary",
    "secondary",
    "info",
    "success",
    "warning",
    "error",
    "light",
    "dark",
  ]),
  variant: PropTypes.oneOf(["gradient", "contained"]),
  size: PropTypes.oneOf(["xs", "sm", "md", "lg"]),
  circular: PropTypes.bool,
  indicator: PropTypes.bool,
  border: PropTypes.bool,
  children: PropTypes.node,
  container: PropTypes.bool,
  sx: PropTypes.oneOfType([PropTypes.object, PropTypes.array, PropTypes.func]),
};

export default MDBadge;
