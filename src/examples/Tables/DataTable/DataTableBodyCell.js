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

function DataTableBodyCell({ noBorder, align, children, isEvenRow, disabledRow }) {
  return (
    <MDBox
      component="td"
      textAlign={align}
      py={0.2}
      px={0.1}
      sx={({ palette: { light }, borders: { borderWidth } }) => ({
        fontSize: "0.875rem",
        borderBottom: noBorder ? "none" : `${borderWidth[1]} solid ${light.main}`,
        backgroundColor: disabledRow ? "#e6e6e6" : isEvenRow ? "#f0f0f0" : "#ffffff",
        // Force readable row text even when dark theme is enabled
        color: disabledRow ? "#777777 !important" : "#111111 !important",
        // Allow multi-line cells and prevent overflow into adjacent columns
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        verticalAlign: "top",
      })}
    >
      <MDBox
        display="block"
        width="100%"
        color="inherit"
        sx={{
          verticalAlign: "top",
          maxWidth: "100%",
          whiteSpace: "normal",
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
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
  disabledRow: false,
};

// Typechecking props for the DataTableBodyCell
DataTableBodyCell.propTypes = {
  children: PropTypes.node.isRequired,
  noBorder: PropTypes.bool,
  align: PropTypes.oneOf(["left", "right", "center"]),
  isEvenRow: PropTypes.bool,
  disabledRow: PropTypes.bool,
};

export default DataTableBodyCell;
