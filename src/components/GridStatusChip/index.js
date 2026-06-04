import PropTypes from "prop-types";

function normalizeStatusToken(value) {
  if (value === true || value === 1 || value === "1") return "active";
  if (value === false || value === 0 || value === "0") return "inactive";
  const token = String(value || "")
    .trim()
    .toLowerCase();
  if (!token) return "neutral";
  if (token === "active" || token === "valid") return "active";
  if (token === "inactive" || token === "in active") return "inactive";
  if (token.includes("pending")) return "pending";
  if (token.includes("approv")) return "approved";
  if (token.includes("archive")) return "archive";
  if (token.includes("reject")) return "rejected";
  return "neutral";
}

function resolveStatusLabel(value, token) {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (token === "active") return "Active";
  if (token === "inactive") return "Inactive";
  if (token === "pending") return "Pending";
  if (token === "approved") return "Approved";
  if (token === "archive") return "Archive";
  if (token === "rejected") return "Rejected";
  return String(value ?? "");
}

function GridStatusChip({ value, label }) {
  const token = normalizeStatusToken(value);
  const display = label || resolveStatusLabel(value, token);
  if (!display) return null;

  return <span className={`saas-grid-status-chip saas-grid-status-chip--${token}`}>{display}</span>;
}

GridStatusChip.propTypes = {
  value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string]),
  label: PropTypes.string,
};

GridStatusChip.defaultProps = {
  value: "",
  label: null,
};

export default GridStatusChip;
