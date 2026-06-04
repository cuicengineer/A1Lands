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

// prop-types is a library for typechecking props
import PropTypes from "prop-types";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import { useMaterialUIController } from "context";
import { isEnterpriseSettingsUI } from "utils/enterpriseSettingsUI";

function DataTableBodyCell({
  noBorder,
  align,
  children,
  isEvenRow,
  disabledRow,
  tintBackground,
  rowHighlight,
  ...rest
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const settingsUI = isEnterpriseSettingsUI();

  const { style: cellInlineStyle, ...tdProps } = rest;
  const tdStyle =
    cellInlineStyle && typeof cellInlineStyle === "object"
      ? { ...cellInlineStyle, backgroundColor: undefined }
      : cellInlineStyle;

  const hasTint = Boolean(tintBackground);
  let cellTextColor;
  const tintedDarkFg = hasTint && darkMode && !disabledRow;
  if (disabledRow) {
    cellTextColor = tintedDarkFg ? "#93a8bc !important" : "#777777 !important";
  } else if (tintedDarkFg) {
    if (rowHighlight === "nestedExpanded") cellTextColor = "#e8f5e9 !important";
    else if (rowHighlight === "rateSubgroup") cellTextColor = "#f3e5f5 !important";
    else cellTextColor = "#e8f4fc !important";
  } else {
    cellTextColor = "#111111 !important";
  }

  return (
    <MDBox
      component="td"
      {...tdProps}
      style={tdStyle}
      textAlign={align}
      py={0.2}
      px={0.1}
      sx={({ palette: { light }, borders: { borderWidth } }) => ({
        fontSize: settingsUI ? "0.8125rem" : "0.875rem",
        borderBottom: noBorder
          ? "none"
          : settingsUI
          ? `1px solid #f0f0f0`
          : `${borderWidth[1]} solid ${light.main}`,
        backgroundColor: disabledRow
          ? settingsUI
            ? "#f5f5f5 !important"
            : "#e6e6e6 !important"
          : hasTint
          ? `${tintBackground} !important`
          : settingsUI
          ? "transparent !important"
          : isEvenRow
          ? "#f0f0f0 !important"
          : "#ffffff !important",
        color: cellTextColor,
        "& .MuiTypography-root, & .MuiInputBase-input, & .MuiInputLabel-root, & .MuiFormHelperText-root, & .MuiSelect-select, & .MuiChip-label":
          {
            color: cellTextColor,
          },
        "& .saas-grid-status-chip, & .MuiBadge-badge": {
          color: "unset",
        },
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

DataTableBodyCell.defaultProps = {
  noBorder: false,
  align: "left",
  isEvenRow: false,
  disabledRow: false,
  tintBackground: "",
  rowHighlight: undefined,
};

DataTableBodyCell.propTypes = {
  children: PropTypes.node.isRequired,
  noBorder: PropTypes.bool,
  align: PropTypes.oneOf(["left", "right", "center"]),
  isEvenRow: PropTypes.bool,
  disabledRow: PropTypes.bool,
  tintBackground: PropTypes.string,
  rowHighlight: PropTypes.oneOf(["expanded", "nestedExpanded", "rateSubgroup"]),
};

export default DataTableBodyCell;
