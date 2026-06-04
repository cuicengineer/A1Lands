/**
 * ERP KPI card — primary featured variant + contextual outlined icons.
 */

import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import { resolveKpiIcon } from "components/DashboardKpiCard/kpiIconMap";
import { ERP_PRIMARY_COLOR, mergeKpiCardSx } from "utils/kpiCardSx";

function DashboardKpiCard({
  label,
  value,
  trend,
  trendVariant,
  variant,
  icon,
  className,
  children,
}) {
  const isPrimary = variant === "primary";
  const IconComponent = resolveKpiIcon(icon);

  const trendClass = isPrimary
    ? "erp-kpi-card__trend"
    : trendVariant === "positive"
    ? "erp-kpi-card__trend erp-kpi-card__trend--positive"
    : trendVariant === "negative"
    ? "erp-kpi-card__trend erp-kpi-card__trend--negative"
    : "erp-kpi-card__trend";

  const cardClass = ["erp-kpi-card", isPrimary ? "erp-kpi-card--primary" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <MDBox
      className={cardClass}
      bgColor={isPrimary ? ERP_PRIMARY_COLOR : "transparent"}
      color={isPrimary ? "white" : "dark"}
      sx={mergeKpiCardSx({}, { primary: isPrimary })}
    >
      <MDBox className="erp-kpi-card__top" color="inherit">
        <p className="erp-kpi-card__label">{label}</p>
        {IconComponent ? (
          <span className="erp-kpi-card__icon-wrap" aria-hidden="true">
            <IconComponent
              className="erp-kpi-card__icon"
              sx={{
                color: isPrimary ? "#ffffff !important" : `${ERP_PRIMARY_COLOR} !important`,
              }}
            />
          </span>
        ) : null}
      </MDBox>
      <div className="erp-kpi-card__metric">{value}</div>
      {trend ? <p className={trendClass}>{trend}</p> : null}
      {children || null}
    </MDBox>
  );
}

DashboardKpiCard.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.node.isRequired,
  trend: PropTypes.string,
  trendVariant: PropTypes.oneOf(["neutral", "positive", "negative"]),
  variant: PropTypes.oneOf(["default", "primary"]),
  icon: PropTypes.string,
  className: PropTypes.string,
  children: PropTypes.node,
};

DashboardKpiCard.defaultProps = {
  trend: null,
  trendVariant: "neutral",
  variant: "default",
  icon: null,
  className: null,
  children: null,
};

export default DashboardKpiCard;
