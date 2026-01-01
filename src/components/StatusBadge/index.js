import PropTypes from "prop-types";
import MDBadge from "components/MDBadge";

function StatusBadge({
  value,
  activeLabel = "Active",
  inactiveLabel = "Inactive",
  activeColor = "success",
  inactiveColor = "error",
}) {
  const isActive =
    value === true ||
    value === 1 ||
    value === "1" ||
    (typeof value === "string" && value.toLowerCase() === "active");

  return (
    <MDBadge
      badgeContent={isActive ? activeLabel : inactiveLabel}
      color={isActive ? activeColor : inactiveColor}
      variant="gradient"
      size="sm"
    />
  );
}

StatusBadge.propTypes = {
  value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string]).isRequired,
  activeLabel: PropTypes.string,
  inactiveLabel: PropTypes.string,
  activeColor: PropTypes.oneOf([
    "primary",
    "secondary",
    "info",
    "success",
    "warning",
    "error",
    "dark",
  ]),
  inactiveColor: PropTypes.oneOf([
    "primary",
    "secondary",
    "info",
    "success",
    "warning",
    "error",
    "dark",
  ]),
};

export default StatusBadge;
