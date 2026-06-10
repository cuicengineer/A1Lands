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

import { useEffect } from "react";

// react-router-dom components
import { useLocation } from "react-router-dom";

// prop-types is a library for typechecking of props.
import PropTypes from "prop-types";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";

// Material Dashboard 2 React context
import { useMaterialUIController, setLayout } from "context";

function DashboardLayout({ children }) {
  const [controller, dispatch] = useMaterialUIController();
  const { miniSidenav } = controller;
  const { pathname } = useLocation();

  useEffect(() => {
    setLayout(dispatch, "dashboard");
  }, [pathname]);

  return (
    <MDBox
      className="dashboard-layout-root"
      sx={({ breakpoints, transitions, functions: { pxToRem } }) => ({
        p: 0,
        position: "relative",
        backgroundColor: "transparent",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        minHeight: 0,
        overflow: "hidden",
        boxSizing: "border-box",

        [breakpoints.up("xl")]: {
          marginLeft: miniSidenav ? pxToRem(72) : pxToRem(252),
          width: `calc(100% - ${miniSidenav ? pxToRem(72) : pxToRem(252)})`,
          transition: transitions.create(["margin-left", "margin-right", "width"], {
            easing: transitions.easing.easeInOut,
            duration: transitions.duration.standard,
          }),
        },
      })}
    >
      {children}
    </MDBox>
  );
}

// Typechecking props for the DashboardLayout
DashboardLayout.propTypes = {
  children: PropTypes.node.isRequired,
};

export default DashboardLayout;
