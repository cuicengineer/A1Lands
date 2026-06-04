import PropTypes from "prop-types";

const VALID_VARIANTS = new Set(["rac", "base", "class", "category", "neutral"]);

function GridValueChip({ value, variant }) {
  const text = value == null || String(value).trim() === "" ? "" : String(value).trim();
  if (!text) return null;

  const chipVariant = VALID_VARIANTS.has(variant) ? variant : "neutral";

  return (
    <span className={`saas-grid-value-chip saas-grid-value-chip--${chipVariant}`}>{text}</span>
  );
}

GridValueChip.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  variant: PropTypes.oneOf(["rac", "base", "class", "category", "neutral"]),
};

GridValueChip.defaultProps = {
  value: "",
  variant: "neutral",
};

export default GridValueChip;
