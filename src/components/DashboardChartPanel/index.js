/**
 * ERP v1.0 chart container — card surface, 24px padding, 16px radius, min 320px.
 */

import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function DashboardChartPanel({ title, description, headerAction, children, minHeight, className }) {
  return (
    <MDBox
      className={["erp-chart-panel", className].filter(Boolean).join(" ")}
      sx={minHeight ? { minHeight } : undefined}
    >
      {title || description || headerAction ? (
        <MDBox className="erp-chart-panel__header">
          <MDBox display="flex" alignItems="flex-start" justifyContent="space-between" gap={2}>
            <MDBox flex={1} minWidth={0}>
              {title ? (
                <MDTypography component="h3" className="erp-chart-panel__title">
                  {title}
                </MDTypography>
              ) : null}
              {description ? (
                <MDTypography component="p" className="erp-chart-panel__description">
                  {description}
                </MDTypography>
              ) : null}
            </MDBox>
            {headerAction || null}
          </MDBox>
        </MDBox>
      ) : null}
      <MDBox className="erp-chart-panel__body">{children}</MDBox>
    </MDBox>
  );
}

DashboardChartPanel.propTypes = {
  title: PropTypes.node,
  description: PropTypes.node,
  headerAction: PropTypes.node,
  children: PropTypes.node.isRequired,
  minHeight: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
  className: PropTypes.string,
};

DashboardChartPanel.defaultProps = {
  title: null,
  description: null,
  headerAction: null,
  minHeight: null,
  className: null,
};

export default DashboardChartPanel;
