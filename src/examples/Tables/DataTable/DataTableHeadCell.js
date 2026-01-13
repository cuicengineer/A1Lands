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

// @mui material components
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";

// Material Dashboard 2 React contexts
function DataTableHeadCell({ width, children, sorted, align, ...rest }) {
  return (
    <MDBox
      component="th"
      width={width}
      py={0.5}
      px={0.5}
      sx={({ palette: { light }, borders: { borderWidth }, functions: { rgba } }) => ({
        borderBottom: `${borderWidth[1]} solid ${light.main}`,
        backgroundColor: rgba(light.main, 0.2),
        // Allow multi-line headers and prevent overflow into adjacent columns
        whiteSpace: "normal",
        overflowWrap: "anywhere",
        wordBreak: "break-word",
        verticalAlign: "top",
      })}
    >
      <MDBox
        {...rest}
        position="relative"
        textAlign={align}
        color="#111111 !important"
        opacity={1}
        sx={({ typography: { size, fontWeightBold } }) => ({
          fontSize: "16px",
          fontWeight: fontWeightBold,
          textTransform: "none",
          cursor: "grab",
          userSelect: "none",
          "&:active": {
            cursor: "grabbing",
          },
        })}
      >
        {children}
        {sorted && (
          <MDBox
            position="absolute"
            top={0}
            right={align !== "right" ? "16px" : 0}
            left={align === "right" ? "-5px" : "unset"}
            sx={({ typography: { size } }) => ({
              fontSize: size.lg,
            })}
          >
            <MDBox
              position="absolute"
              top={-6}
              color={sorted === "asce" ? "text" : "secondary"}
              opacity={sorted === "asce" ? 1 : 0.5}
            >
              <Icon>arrow_drop_up</Icon>
            </MDBox>
            <MDBox
              position="absolute"
              top={0}
              color={sorted === "desc" ? "text" : "secondary"}
              opacity={sorted === "desc" ? 1 : 0.5}
            >
              <Icon>arrow_drop_down</Icon>
            </MDBox>
          </MDBox>
        )}
      </MDBox>
    </MDBox>
  );
}

// Setting default values for the props of DataTableHeadCell
DataTableHeadCell.defaultProps = {
  width: "auto",
  sorted: "none",
  align: "left",
};

// Typechecking props for the DataTableHeadCell
DataTableHeadCell.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  children: PropTypes.node.isRequired,
  sorted: PropTypes.oneOf([false, "none", "asce", "desc"]),
  align: PropTypes.oneOf(["left", "right", "center"]),
};

export default DataTableHeadCell;
