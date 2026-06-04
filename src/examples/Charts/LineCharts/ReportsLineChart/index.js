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
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
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

// ReportsLineChart configurations
import configs from "examples/Charts/LineCharts/ReportsLineChart/configs";
import { executiveLineConfigs, CHART_PRIMARY, CHART_SECONDARY } from "utils/executiveChartConfigs";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

function ReportsLineChart({
  color,
  title,
  description,
  date,
  chart,
  chartHeight,
  flat,
  seriesColor,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  const lineColor =
    seriesColor ||
    (color === "success" ? CHART_SECONDARY : color === "dark" ? CHART_SECONDARY : CHART_PRIMARY);

  const chartConfig = useMemo(() => {
    const labels = chart.labels || [];
    const datasets = chart.datasets || {};
    if (flat) {
      return executiveLineConfigs(labels, datasets, { color: lineColor });
    }
    return configs(labels, datasets);
  }, [flat, chart, lineColor]);

  const { data, options } = chartConfig;
  const resolvedHeight = chartHeight || "11rem";

  if (flat) {
    return (
      <MDBox
        className="erp-flat-chart"
        sx={{ height: resolvedHeight, width: "100%", minHeight: 200 }}
      >
        <Line data={data} options={options} />
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
              height={resolvedHeight}
            >
              <Line data={data} options={options} redraw />
            </MDBox>
          ),
          [color, data, options, resolvedHeight]
        )}
        <MDBox pt={3} pb={1} px={1}>
          <MDTypography
            variant="h6"
            textTransform="capitalize"
            sx={{
              color: darkMode ? "#ffffff !important" : "inherit",
            }}
          >
            {title}
          </MDTypography>
          <MDTypography
            component="div"
            variant="button"
            color="text"
            fontWeight="light"
            sx={{
              color: darkMode ? "#ffffff !important" : "inherit",
            }}
          >
            {description}
          </MDTypography>
          <Divider />
        </MDBox>
      </MDBox>
    </Card>
  );
}

// Setting default values for the props of ReportsLineChart
ReportsLineChart.defaultProps = {
  color: "info",
  description: "",
  chartHeight: "11rem",
  flat: false,
  seriesColor: null,
};

// Typechecking props for the ReportsLineChart
ReportsLineChart.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  title: PropTypes.string.isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  date: PropTypes.string.isRequired,
  chart: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.array, PropTypes.object])).isRequired,
  chartHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  flat: PropTypes.bool,
  seriesColor: PropTypes.string,
};

export default ReportsLineChart;
