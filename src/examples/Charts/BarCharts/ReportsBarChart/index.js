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

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

function ReportsBarChart({ color, title, description, date, chart, chartHeight }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const { data, options } = configs(chart.labels || [], chart.datasets || {});

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
          [color, chart, chartHeight]
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
};

// Typechecking props for the ReportsBarChart
ReportsBarChart.propTypes = {
  color: PropTypes.oneOf(["primary", "secondary", "info", "success", "warning", "error", "dark"]),
  title: PropTypes.string.isRequired,
  description: PropTypes.oneOfType([PropTypes.string, PropTypes.node]),
  date: PropTypes.string.isRequired,
  chart: PropTypes.objectOf(PropTypes.oneOfType([PropTypes.array, PropTypes.object])).isRequired,
  chartHeight: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

export default ReportsBarChart;
