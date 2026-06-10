/**
=========================================================
* Material Dashboard 2  React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { useMemo } from "react";

// porp-types is a library for typechecking of props
import PropTypes from "prop-types";

// react-chartjs-2 components
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";

// @mui material components
import Card from "@mui/material/Card";
import Divider from "@mui/material/Divider";
import Icon from "@mui/material/Icon";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React contexts
import { useMaterialUIController } from "context";

// ReportsBarChart configurations
import configs from "examples/Charts/BarCharts/ReportsBarChart/configs";
import { executiveBarConfigs, CHART_PRIMARY, CHART_SECONDARY } from "utils/executiveChartConfigs";
import { coerceChartDataValue } from "utils/chartBarDataUtils";
import { applyKpiZoomBarChartEnhancements } from "layouts/dashboard/kpi-overview/components/kpiZoomChartEnhancements";
import { formatKpiMoneyLabel } from "layouts/dashboard/kpi-overview/kpiDataUtils";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function formatExecutiveBarValue(value) {
  const n = coerceChartDataValue(value);
  if (n == null) return "";
  if (Math.abs(n) >= 1000000) {
    const millions = n / 1000000;
    return `${millions.toFixed(millions >= 1 ? 1 : 2)}M`;
  }
  return n.toLocaleString();
}

function ReportsBarChart({
  color,
  title,
  description,
  date,
  chart,
  chartHeight,
  flat,
  seriesColor,
  zoomEnhanced,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  const barColor =
    seriesColor ||
    (color === "success" ? CHART_SECONDARY : color === "dark" ? CHART_SECONDARY : CHART_PRIMARY);

  const chartConfig = useMemo(() => {
    const labels = chart.labels || [];
    const datasets = chart.datasets || {};
    if (flat) {
      return executiveBarConfigs(labels, datasets, { color: barColor });
    }
    return configs(labels, datasets);
  }, [flat, chart, barColor]);

  const { data, options: baseOptions } = chartConfig;

  const options = useMemo(() => {
    if (!zoomEnhanced) return baseOptions;
    return applyKpiZoomBarChartEnhancements(baseOptions, {
      darkMode,
      formatValue: (value) =>
        formatKpiMoneyLabel(coerceChartDataValue(value) ?? 0) || formatExecutiveBarValue(value),
      fontSize: 13,
    });
  }, [baseOptions, zoomEnhanced, darkMode]);

  if (flat) {
    return (
      <MDBox className="erp-flat-chart" sx={{ height: chartHeight, width: "100%", minHeight: 200 }}>
        <Bar data={data} options={options} />
      </MDBox>
    );
  }

  return (
    <Card sx={{ height: "100%" }}>
      <MDBox padding="1rem">
        {useMemo(
          () => (
            <MDBox
              variant="gradient"
              bgColor={color}
              borderRadius="lg"
              coloredShadow={color}
              py={2}
              pr={0.5}
              mt={-5}
              height={chartHeight}
            >
              <Bar data={data} options={options} />
            </MDBox>
          ),
          [color, data, options, chartHeight]
        )}
        <MDBox>
          <MDTypography
            variant="h5"
            sx={{
              lineHeight: 2.2,
              mb: 1.25,
              color: darkMode ? "#ffffff !important" : "#000000 !important",
              fontSize: "1.5rem !important",
              fontWeight: "700 !important",
            }}
          >
            {title}
          </MDTypography>
          <MDTypography
            variant="button"
            sx={{
              lineHeight: 1.1,
              mb: 0.25,
              color: darkMode ? "#ffffff !important" : "#000000 !important",
              fontSize: "0.875rem !important",
              fontWeight: "600 !important",
            }}
          >
            {description}
          </MDTypography>
        </MDBox>
      </MDBox>
    </Card>
  );
}

// Setting default values for the props of ReportsBarChart
ReportsBarChart.defaultProps = {
  color: "info",
  description: "",
  chartHeight: "12.5rem",
  flat: false,
  seriesColor: null,
  zoomEnhanced: false,
};

// Typechecking props for the ReportsBarChart
ReportsBarChart.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  title: PropTypes.string.isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  date: PropTypes.string.isRequired,
  chart: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.array, PropTypes.object])).isRequired,
  chartHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  flat: PropTypes.bool,
  seriesColor: PropTypes.string,
  zoomEnhanced: PropTypes.bool,
};

export default ReportsBarChart;
