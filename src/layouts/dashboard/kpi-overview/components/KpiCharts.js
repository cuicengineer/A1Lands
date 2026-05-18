import PropTypes from "prop-types";
import { useMemo, useState } from "react";
import { Bar, Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import Card from "@mui/material/Card";
import Grid from "@mui/material/Grid";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useMaterialUIController } from "context";

import { buildFinancialShares, SHARE_DISTRIBUTION_CLASS_OPTIONS } from "../kpiDataUtils";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const SHARE_COLORS = ["#1A73E8", "#34A853", "#FBBC04", "#EA4335", "#9334E6"];

const CATEGORY_SERIES = [
  { milKey: "incomePA", label: "Income PA" },
  { milKey: "govt", label: "Govt Share" },
  { milKey: "paf", label: "PAF Share" },
  { milKey: "ahq", label: "AHQ Share" },
  { milKey: "rac", label: "RAC Share" },
  { milKey: "base", label: "Base Share" },
];

const CATEGORY_BAR_COLORS = ["#5C6BC0", "#1A73E8", "#34A853", "#FBBC04", "#EA4335", "#9334E6"];

export function getEnterpriseCardSx(darkMode) {
  return {
    borderRadius: 2,
    height: "100%",
    border: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.06)",
    boxShadow: darkMode ? "0 4px 24px rgba(0,0,0,0.35)" : "0 4px 20px rgba(0,0,0,0.06)",
    transition: "transform 0.25s ease, box-shadow 0.25s ease",
    "&:hover": {
      transform: "translateY(-3px)",
      boxShadow: darkMode ? "0 8px 32px rgba(0,0,0,0.5)" : "0 8px 28px rgba(0,0,0,0.1)",
    },
  };
}

function KpiCharts({ shareRows, assetCards, loading }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [shareClassFilter, setShareClassFilter] = useState("all");

  const donutShares = useMemo(
    () => buildFinancialShares(shareRows || [], shareClassFilter),
    [shareRows, shareClassFilter]
  );

  const cards = assetCards || [];

  const groupedBarData = useMemo(
    () => ({
      labels: cards.map((a) => a.label),
      datasets: CATEGORY_SERIES.map((s, i) => ({
        label: s.label,
        data: cards.map((a) => Number(a.mil?.[s.milKey]) || 0),
        backgroundColor: CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length],
        borderRadius: 3,
        maxBarThickness: 16,
      })),
    }),
    [cards]
  );

  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const donutChart = useMemo(() => {
    const donutLabels = donutShares.map((s) => s.label);
    const donutValues = donutShares.map((s) => s.value);
    const sumTotal = donutValues.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
    const tc = darkMode ? "#e8e8e8" : "#344767";

    return {
      data: {
        labels: donutLabels,
        datasets: [
          {
            data: donutValues,
            backgroundColor: SHARE_COLORS,
            borderWidth: 2,
            borderColor: darkMode ? "#1e1e1e" : "#fff",
            hoverOffset: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: {
            position: "right",
            labels: { color: tc, boxWidth: 12, padding: 10 },
          },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const pct = ((ctx.raw / sumTotal) * 100).toFixed(1);
                return `${ctx.label}: ${Number(ctx.raw).toLocaleString()} (${pct}%)`;
              },
            },
          },
        },
      },
    };
  }, [donutShares, darkMode]);

  const groupedBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    scales: {
      x: {
        stacked: false,
        grid: { color: gridColor },
        ticks: { color: textColor, maxRotation: 40, minRotation: 0 },
      },
      y: {
        stacked: false,
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor },
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: { color: textColor, boxWidth: 10, padding: 10, font: { size: 11 } },
      },
      tooltip: {
        mode: "index",
        intersect: false,
        callbacks: {
          label: (ctx) =>
            `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString(undefined, {
              maximumFractionDigits: 2,
            })} Mil`,
        },
      },
    },
  };

  const cardSx = getEnterpriseCardSx(darkMode);

  return (
    <Grid container spacing={2}>
      <Grid item xs={12} lg={7}>
        <Card sx={{ ...cardSx, p: 2, minHeight: 280 }}>
          <MDTypography variant="h6" fontWeight="bold" mb={1} color={darkMode ? "white" : "dark"}>
            Financial share by category (Mil)
          </MDTypography>
          <MDBox height={220} opacity={loading ? 0.4 : 1}>
            <Bar data={groupedBarData} options={groupedBarOptions} />
          </MDBox>
        </Card>
      </Grid>
      <Grid item xs={12} lg={5}>
        <Card sx={{ ...cardSx, p: 2, minHeight: 280 }}>
          <MDBox
            display="flex"
            alignItems="center"
            justifyContent="space-between"
            gap={1}
            flexWrap="wrap"
            mb={1}
          >
            <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
              Share Distribution
            </MDTypography>
            <FormControl size="small" sx={{ minWidth: 88 }}>
              <InputLabel id="kpi-share-class-label">Class</InputLabel>
              <Select
                labelId="kpi-share-class-label"
                label="Class"
                value={shareClassFilter}
                onChange={(e) => setShareClassFilter(e.target.value)}
                renderValue={(val) =>
                  SHARE_DISTRIBUTION_CLASS_OPTIONS.find((o) => o.value === val)?.label ?? val
                }
              >
                {SHARE_DISTRIBUTION_CLASS_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </MDBox>
          <MDBox height={220} opacity={loading ? 0.4 : 1}>
            <Doughnut data={donutChart.data} options={donutChart.options} />
          </MDBox>
        </Card>
      </Grid>
    </Grid>
  );
}

KpiCharts.propTypes = {
  shareRows: PropTypes.arrayOf(PropTypes.object),
  assetCards: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string,
      mil: PropTypes.shape({
        incomePA: PropTypes.number,
        govt: PropTypes.number,
        paf: PropTypes.number,
        ahq: PropTypes.number,
        rac: PropTypes.number,
        base: PropTypes.number,
      }),
    })
  ),
  loading: PropTypes.bool,
};

KpiCharts.defaultProps = {
  shareRows: [],
  assetCards: [],
  loading: false,
};

export default KpiCharts;
