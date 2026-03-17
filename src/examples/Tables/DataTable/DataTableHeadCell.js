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
import { useMaterialUIController } from "context";

function DataTableHeadCell({ width, children, sorted, align, filterNode, ...rest }) {
  const [controller] = useMaterialUIController();
  const headerTextColor = "#111111 !important";
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
        color: headerTextColor,
        "& *": {
          color: headerTextColor,
        },
      })}
    >
      <MDBox
        {...rest}
        position="relative"
        textAlign={align}
        color={headerTextColor}
        opacity={1}
        sx={({ typography: { size, fontWeightBold } }) => ({
          fontSize: "14px !important",
          fontWeight: fontWeightBold,
          textTransform: "none",
          cursor: "grab",
          userSelect: "none",
          "&:active": {
            cursor: "grabbing",
          },
          display: "flex",
          alignItems: "flex-start",
          justifyContent:
            align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start",
          gap: "4px",
          color: headerTextColor,
        })}
      >
        <MDBox
          sx={{
            display: "inline-block",
            whiteSpace: "nowrap",
            color: headerTextColor,
          }}
        >
          {children}
        </MDBox>
        {(sorted || filterNode) && (
          <MDBox
            sx={{
              display: "inline-flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              flexShrink: 0,
              marginLeft: "2px",
              minWidth: "16px",
            }}
          >
            {sorted && (
              <MDBox
                sx={{
                  display: "inline-flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  lineHeight: 0.7,
                  transform: "translateY(1px)",
                }}
              >
                <Icon
                  sx={{
                    fontSize: "18px !important",
                    marginBottom: "-10px",
                    color: sorted === "asce" ? "#111111" : "#6c757d",
                    opacity: sorted === "asce" ? 1 : 0.5,
                  }}
                >
                  arrow_drop_up
                </Icon>
                <Icon
                  sx={{
                    fontSize: "18px !important",
                    marginTop: "-10px",
                    color: sorted === "desc" ? "#111111" : "#6c757d",
                    opacity: sorted === "desc" ? 1 : 0.5,
                  }}
                >
                  arrow_drop_down
                </Icon>
              </MDBox>
            )}
            {filterNode && (
              <MDBox
                sx={{
                  cursor: "default",
                  userSelect: "none",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginTop: sorted ? "-2px" : "2px",
                }}
              >
                {filterNode}
              </MDBox>
            )}
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
  filterNode: null,
};

// Typechecking props for the DataTableHeadCell
DataTableHeadCell.propTypes = {
  width: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  children: PropTypes.node.isRequired,
  sorted: PropTypes.oneOf([false, "none", "asce", "desc"]),
  align: PropTypes.oneOf(["left", "right", "center"]),
  filterNode: PropTypes.node,
};

export default DataTableHeadCell;
