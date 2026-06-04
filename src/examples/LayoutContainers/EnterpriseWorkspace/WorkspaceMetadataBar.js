import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

const CHIP_VARIANT_BY_KEY = {
  total: "success",
  records: "success",
  contracts: "contracts",
  page: "info",
  showing: "neutral",
  visible: "neutral",
  racs: "racs",
  bases: "bases",
  classes: "classes",
};

function resolveChipVariant(chip) {
  const known = ["success", "info", "neutral", "accent", "contracts", "racs", "bases", "classes"];
  if (chip.variant && known.includes(chip.variant)) {
    return chip.variant;
  }
  return CHIP_VARIANT_BY_KEY[chip.key] || "neutral";
}

function WorkspaceMetadataBar({ chips, inline }) {
  if (!chips || chips.length === 0) return null;

  return (
    <MDBox
      className={`saas-workspace-metadata${inline ? " saas-workspace-metadata-inline" : ""}`}
      display="flex"
      alignItems="center"
      gap={inline ? 0.75 : 1.25}
      flexWrap={inline ? "nowrap" : "wrap"}
      sx={{ minHeight: 0 }}
    >
      {chips.map((chip) => {
        const variant = resolveChipVariant(chip);
        return (
          <MDBox
            key={chip.key || chip.label}
            component="span"
            className={`saas-metadata-chip-badge saas-metadata-chip-badge--${variant}`}
          >
            <MDTypography component="span" className="saas-metadata-chip-badge-value">
              {chip.value}
            </MDTypography>
            <MDTypography component="span" className="saas-metadata-chip-badge-label">
              {chip.label}
            </MDTypography>
          </MDBox>
        );
      })}
    </MDBox>
  );
}

WorkspaceMetadataBar.propTypes = {
  chips: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
      variant: PropTypes.oneOf([
        "success",
        "info",
        "neutral",
        "accent",
        "contracts",
        "racs",
        "bases",
        "classes",
      ]),
    })
  ),
  inline: PropTypes.bool,
};

WorkspaceMetadataBar.defaultProps = {
  chips: null,
  inline: false,
};

export default WorkspaceMetadataBar;
