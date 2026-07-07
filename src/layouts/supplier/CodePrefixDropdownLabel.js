import PropTypes from "prop-types";

import MDBox from "components/MDBox";

import MDTypography from "components/MDTypography";

export default function CodePrefixDropdownLabel({ item }) {
  const prefix = String(item?.prefixAlpha ?? "").trim();
  const description = String(item?.description ?? "").trim();

  if (!prefix) return null;

  return (
    <MDBox
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        flexDirection: "row",
        gap: 0.75,
        minWidth: 0,
        maxWidth: "100%",
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
      }}
    >
      <MDTypography
        component="span"
        variant="body2"
        sx={{ fontWeight: 600, fontSize: "0.875rem", flexShrink: 0 }}
      >
        {prefix}
      </MDTypography>
      {description ? (
        <MDTypography
          component="span"
          variant="caption"
          sx={{
            color: "text.secondary",
            fontSize: "0.75rem",
            overflow: "hidden",
            textOverflow: "ellipsis",
            minWidth: 0,
            flex: 1,
            userSelect: "text",
            pointerEvents: "none",
          }}
        >
          {description}
        </MDTypography>
      ) : null}
    </MDBox>
  );
}

CodePrefixDropdownLabel.propTypes = {
  item: PropTypes.shape({
    prefixAlpha: PropTypes.string,
    description: PropTypes.string,
  }),
};
