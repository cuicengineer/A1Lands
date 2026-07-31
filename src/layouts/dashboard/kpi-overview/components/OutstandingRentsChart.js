import PropTypes from "prop-types";
import { useMemo } from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import Card from "@mui/material/Card";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useMaterialUIController } from "context";
import useDashboardChartColors from "hooks/useDashboardChartColors";
import {
  nullIfZeroChartBarValue,
  KPI_OVERVIEW_WIDE_BAR_OPTIONS,
  withKpiOverviewWideBarDatasets,
} from "utils/chartBarDataUtils";
import { exportSingleSeriesBarChartToExcel } from "utils/kpiChartExcelExport";
import { formatKpiBarAxisTick, formatKpiCrosshairBarValue } from "../kpiDataUtils";
import { applyKpiCrosshairBarChartEnhancements } from "./kpiZoomChartEnhancements";
import ChartExportButton from "./ChartExportButton";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function OutstandingRentsChart({ stickers, cardSx, loading }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const chartColors = useDashboardChartColors();

  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const labels = useMemo(() => (stickers || []).map((s) => s.label), [stickers]);
  const values = useMemo(() => (stickers || []).map((s) => s.value), [stickers]);
  const barColors = useMemo(
    () => (stickers || []).map((_, idx) => chartColors.fiscal[idx % chartColors.fiscal.length]),
    [stickers, chartColors]
  );

  const chartData = useMemo(
    () => ({
      labels,
      datasets: withKpiOverviewWideBarDatasets([
        {
          label: "Outstanding Rent (M)",
          data: values.map((value) => nullIfZeroChartBarValue(value)),
          backgroundColor: barColors,
          borderRadius: 6,
          borderSkipped: false,
        },
      ]),
    }),
    [labels, values, barColors]
  );

  const exportChart = useMemo(
    () => ({
      labels,
      datasets: {
        label: "Outstanding Rent (M)",
        data: values,
      },
    }),
    [labels, values]
  );

  const chartOptions = useMemo(() => {
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      ...KPI_OVERVIEW_WIDE_BAR_OPTIONS,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = ctx.raw;
              if (raw == null || raw === 0) return null;
              return `${ctx.label}: ${formatKpiCrosshairBarValue(raw)}`;
            },
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            maxRotation: 0,
            minRotation: 0,
            font: { size: 12, weight: "bold" },
          },
          title: {
            display: true,
            text: "Cat",
            color: textColor,
            font: { size: 12, weight: "600" },
          },
        },
        y: {
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (value) => formatKpiBarAxisTick(value),
          },
          title: {
            display: true,
            text: "Amount (M)",
            color: textColor,
            font: { size: 12, weight: "600" },
          },
        },
      },
    };

    return applyKpiCrosshairBarChartEnhancements(base, {
      darkMode,
      formatValue: formatKpiCrosshairBarValue,
      fontSize: 13,
      labelPlacement: "inside",
    });
  }, [darkMode, textColor, gridColor]);

  const hasData = values.some((value) => Number(value) > 0);

  return (
    <>
      <p className="erp-dashboard-section-title erp-dashboard-section-title--spaced">
        Outstanding Rents
      </p>
      <Card sx={{ ...cardSx, p: 2 }}>
        <MDBox
          display="flex"
          alignItems="flex-start"
          justifyContent="space-between"
          gap={0.5}
          mb={1}
        >
          <MDBox minWidth={0}>
            <MDTypography variant="caption" color="text">
              Outstanding rent by property category
            </MDTypography>
          </MDBox>
          <ChartExportButton
            disabled={loading || !hasData}
            ariaLabel="Export Outstanding Rents to Excel"
            onExport={() => exportSingleSeriesBarChartToExcel("Outstanding Rents", exportChart)}
          />
        </MDBox>
        <MDBox sx={{ height: 280, width: "100%", minHeight: 220, position: "relative" }}>
          {!loading && hasData ? (
            <Bar data={chartData} options={chartOptions} />
          ) : (
            <MDBox display="flex" alignItems="center" justifyContent="center" height="100%">
              <MDTypography variant="body2" color="text">
                {loading ? "Loading…" : "No outstanding rent data"}
              </MDTypography>
            </MDBox>
          )}
        </MDBox>
      </Card>
    </>
  );
}

OutstandingRentsChart.propTypes = {
  stickers: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      label: PropTypes.string.isRequired,
      value: PropTypes.number,
    })
  ),
  cardSx: PropTypes.object.isRequired,
  loading: PropTypes.bool,
};

OutstandingRentsChart.defaultProps = {
  stickers: [],
  loading: false,
};

export default OutstandingRentsChart;
