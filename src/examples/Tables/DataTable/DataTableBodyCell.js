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

// prop-types is a library for typechecking of props
import PropTypes from "prop-types";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";

function DataTableBodyCell({ noBorder, align, children, isEvenRow }) {
  return (
    <MDBox
      component="td"
      textAlign={align}
      py={0.2}
      px={0.1}
      sx={({ palette: { light }, borders: { borderWidth } }) => ({
        fontSize: "0.875rem",
        borderBottom: noBorder ? "none" : `${borderWidth[1]} solid ${light.main}`,
        backgroundColor: isEvenRow ? "#f0f0f0" : "#ffffff",
        whiteSpace: "nowrap",
      })}
    >
      <MDBox
        display="inline-block"
        width="max-content"
        color="text"
        sx={{ verticalAlign: "middle" }}
      >
        {children}
      </MDBox>
    </MDBox>
  );
}

// Setting default values for the props of DataTableBodyCell
DataTableBodyCell.defaultProps = {
  noBorder: false,
  align: "left",
  isEvenRow: false,
};

// Typechecking props for the DataTableBodyCell
DataTableBodyCell.propTypes = {
  children: PropTypes.node.isRequired,
  noBorder: PropTypes.bool,
  align: PropTypes.oneOf(["left", "right", "center"]),
  isEvenRow: PropTypes.bool,
};

export default DataTableBodyCell;
