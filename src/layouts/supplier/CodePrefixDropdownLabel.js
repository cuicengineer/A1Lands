import PropTypes from "prop-types";

import MDBox from "components/MDBox";

import MDTypography from "components/MDTypography";

export default function CodePrefixDropdownLabel({ item, compact = false }) {
  const prefix = String(item?.prefixAlpha ?? "").trim();
  const description = String(item?.description ?? "").trim();

  if (!prefix) return null;

  return (
    <MDBox
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: compact ? "center" : "flex-start",
        flexDirection: compact ? "row" : "column",
        gap: compact ? 0.75 : 0.25,
        minWidth: 0,
        maxWidth: "100%",
        lineHeight: 1.3,
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
            fontSize: compact ? "0.75rem" : "0.72rem",
            whiteSpace: compact ? "nowrap" : "normal",
            overflow: compact ? "hidden" : "visible",
            textOverflow: compact ? "ellipsis" : "clip",
            minWidth: 0,
            flex: compact ? 1 : undefined,
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
  compact: PropTypes.bool,
};
