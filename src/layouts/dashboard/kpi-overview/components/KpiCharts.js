import PropTypes from "prop-types";
import { useCallback, useMemo, useState } from "react";
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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useMaterialUIController } from "context";

import {
  buildFinancialShares,
  formatKpiMoneyLabel,
  SHARE_DISTRIBUTION_CLASS_OPTIONS,
} from "../kpiDataUtils";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const SHARE_COLORS = ["#1A73E8", "#34A853", "#FBBC04", "#EA4335", "#9334E6"];

const CATEGORY_SERIES = [
  { milKey: "incomePA", label: "Income PA" },
  { milKey: "govt", label: "Govt Share", shareId: "govt" },
  { milKey: "paf", label: "PAF Share", shareId: "paf" },
  { milKey: "ahq", label: "AHQ Share", shareId: "ahq" },
  { milKey: "rac", label: "RAC Share", shareId: "rac" },
  { milKey: "base", label: "Base Share", shareId: "base" },
];

const GOVT_PAF_SERIES = CATEGORY_SERIES.filter((s) => s.milKey === "govt" || s.milKey === "paf");
const AHQ_RAC_BASE_SERIES = CATEGORY_SERIES.filter(
  (s) => s.milKey === "ahq" || s.milKey === "rac" || s.milKey === "base"
);

const CATEGORY_BAR_COLORS = ["#5C6BC0", "#1A73E8", "#34A853", "#FBBC04", "#EA4335", "#9334E6"];

const SERIES_COLOR_BY_MIL_KEY = Object.fromEntries(
  CATEGORY_SERIES.map((s, i) => [s.milKey, CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length]])
);

const DONUT_COLOR_BY_SHARE_ID = {
  govt: SHARE_COLORS[0],
  paf: SHARE_COLORS[1],
  ahq: SHARE_COLORS[2],
  rac: SHARE_COLORS[3],
  base: SHARE_COLORS[4],
};

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

const ZOOM_CHART = {
  assetsBar: "assetsBar",
  assetsDonut: "assetsDonut",
  govtPafBar: "govtPafBar",
  govtPafDonut: "govtPafDonut",
  ahqRacBaseBar: "ahqRacBaseBar",
  ahqRacBaseDonut: "ahqRacBaseDonut",
};

function buildGroupedBarData(cards, series) {
  return {
    labels: cards.map((a) => a.label),
    datasets: series.map((s) => ({
      label: s.label,
      data: cards.map((a) => Number(a.mil?.[s.milKey]) || 0),
      backgroundColor: SERIES_COLOR_BY_MIL_KEY[s.milKey],
      borderRadius: 3,
      maxBarThickness: 16,
    })),
  };
}

function buildShareDonutChart(shareItems, shareIds, darkMode) {
  const filtered = (shareItems || []).filter((s) => shareIds.includes(s.id));
  const donutLabels = filtered.map((s) => s.label);
  const donutValues = filtered.map((s) => s.value);
  const sumTotal = donutValues.reduce((a, b) => a + (Number(b) || 0), 0) || 1;
  const tc = darkMode ? "#e8e8e8" : "#344767";

  return {
    data: {
      labels: donutLabels,
      datasets: [
        {
          data: donutValues,
          backgroundColor: shareIds.map((id) => DONUT_COLOR_BY_SHARE_ID[id] || SHARE_COLORS[0]),
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
              return `${ctx.label}: ${formatKpiMoneyLabel(Number(ctx.raw) || 0)} (${pct}%)`;
            },
          },
        },
      },
    },
  };
}

function ChartZoomSurface({ enabled, onZoom, children, darkMode }) {
  if (!enabled) {
    return children;
  }

  return (
    <MDBox
      role="button"
      tabIndex={0}
      onClick={onZoom}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onZoom();
        }
      }}
      sx={{
        height: "100%",
        cursor: "zoom-in",
        borderRadius: 1,
        position: "relative",
        outline: "none",
        "&:focus-visible": {
          boxShadow: (theme) => `0 0 0 2px ${theme.palette.info.main}`,
        },
        "&:hover .kpi-chart-zoom-hint": {
          opacity: 1,
        },
      }}
      aria-label="Click to enlarge chart"
    >
      {children}
      <MDBox
        className="kpi-chart-zoom-hint"
        display="flex"
        alignItems="center"
        gap={0.25}
        sx={{
          position: "absolute",
          top: 6,
          right: 6,
          opacity: 0,
          transition: "opacity 0.2s ease",
          px: 0.75,
          py: 0.25,
          borderRadius: 1,
          bgcolor: darkMode ? "rgba(0,0,0,0.55)" : "rgba(255,255,255,0.92)",
          boxShadow: 1,
          pointerEvents: "none",
        }}
      >
        <Icon sx={{ fontSize: "1rem", color: "info.main" }}>zoom_in</Icon>
        <MDTypography variant="caption" color="text" sx={{ lineHeight: 1.2 }}>
          Click to enlarge
        </MDTypography>
      </MDBox>
    </MDBox>
  );
}

ChartZoomSurface.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onZoom: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  darkMode: PropTypes.bool.isRequired,
};

function KpiCharts({ shareRows, assetCards, loading, chartZoomOnClick, chartLayout }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [shareClassFilter, setShareClassFilter] = useState("all");
  const [zoomChart, setZoomChart] = useState(null);

  const closeZoom = useCallback(() => setZoomChart(null), []);

  const donutShares = useMemo(
    () => buildFinancialShares(shareRows || [], shareClassFilter),
    [shareRows, shareClassFilter]
  );

  const cards = (assetCards || []).filter((c) => c.chartInclude !== false && c.key !== "total");

  const groupedBarData = useMemo(() => buildGroupedBarData(cards, CATEGORY_SERIES), [cards]);

  const govtPafBarData = useMemo(() => buildGroupedBarData(cards, GOVT_PAF_SERIES), [cards]);
  const ahqRacBaseBarData = useMemo(() => buildGroupedBarData(cards, AHQ_RAC_BASE_SERIES), [cards]);

  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const donutChart = useMemo(
    () => buildShareDonutChart(donutShares, ["govt", "paf", "ahq", "rac", "base"], darkMode),
    [donutShares, darkMode]
  );

  const govtPafDonutChart = useMemo(
    () => buildShareDonutChart(donutShares, ["govt", "paf"], darkMode),
    [donutShares, darkMode]
  );

  const ahqRacBaseDonutChart = useMemo(
    () => buildShareDonutChart(donutShares, ["ahq", "rac", "base"], darkMode),
    [donutShares, darkMode]
  );

  const isFinancialsLayout = chartLayout === "financials";

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
          label: (ctx) => `${ctx.dataset.label}: ${formatKpiMoneyLabel(Number(ctx.raw) || 0)}`,
        },
      },
    },
  };

  const cardSx = getEnterpriseCardSx(darkMode);
  const zoomEnabled = Boolean(chartZoomOnClick) && !loading;

  const zoomedBarOptions = useMemo(
    () => ({
      ...groupedBarOptions,
      plugins: {
        ...groupedBarOptions.plugins,
        legend: {
          ...groupedBarOptions.plugins.legend,
          labels: {
            ...groupedBarOptions.plugins.legend.labels,
            font: { size: 13 },
          },
        },
      },
    }),
    [groupedBarOptions]
  );

  const makeZoomedDonutOptions = useCallback(
    (donut) => ({
      ...donut.options,
      plugins: {
        ...donut.options.plugins,
        legend: {
          ...donut.options.plugins.legend,
          labels: {
            ...donut.options.plugins.legend.labels,
            font: { size: 13 },
            padding: 14,
          },
        },
      },
    }),
    []
  );

  const zoomDialogConfig = useMemo(() => {
    const configsByKey = {
      [ZOOM_CHART.assetsBar]: {
        title: "Financial share by category (M.)",
        type: "bar",
        data: groupedBarData,
        options: zoomedBarOptions,
      },
      [ZOOM_CHART.assetsDonut]: {
        title: "Share Distribution",
        type: "donut",
        data: donutChart.data,
        options: makeZoomedDonutOptions(donutChart),
      },
      [ZOOM_CHART.govtPafBar]: {
        title: "Govt & PAF share by category (M.)",
        type: "bar",
        data: govtPafBarData,
        options: zoomedBarOptions,
      },
      [ZOOM_CHART.govtPafDonut]: {
        title: "Govt & PAF share distribution",
        type: "donut",
        data: govtPafDonutChart.data,
        options: makeZoomedDonutOptions(govtPafDonutChart),
      },
      [ZOOM_CHART.ahqRacBaseBar]: {
        title: "AHQ, RAC & Base share by category (M.)",
        type: "bar",
        data: ahqRacBaseBarData,
        options: zoomedBarOptions,
      },
      [ZOOM_CHART.ahqRacBaseDonut]: {
        title: "AHQ, RAC & Base share distribution",
        type: "donut",
        data: ahqRacBaseDonutChart.data,
        options: makeZoomedDonutOptions(ahqRacBaseDonutChart),
      },
    };
    return configsByKey[zoomChart] || null;
  }, [
    zoomChart,
    groupedBarData,
    donutChart,
    govtPafBarData,
    govtPafDonutChart,
    ahqRacBaseBarData,
    ahqRacBaseDonutChart,
    zoomedBarOptions,
    makeZoomedDonutOptions,
  ]);

  const renderShareClassFilter = (filterIdSuffix) => (
    <FormControl size="small" sx={{ minWidth: 88 }}>
      <InputLabel id={`kpi-share-class-label-${filterIdSuffix}`}>Class</InputLabel>
      <Select
        labelId={`kpi-share-class-label-${filterIdSuffix}`}
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
  );

  const renderDonutCard = (
    title,
    donut,
    filterIdSuffix = "default",
    zoomKey = ZOOM_CHART.assetsDonut
  ) => (
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
          {title}
        </MDTypography>
        {renderShareClassFilter(filterIdSuffix)}
      </MDBox>
      <MDBox height={220} opacity={loading ? 0.4 : 1}>
        <ChartZoomSurface
          enabled={zoomEnabled}
          darkMode={darkMode}
          onZoom={() => setZoomChart(zoomKey)}
        >
          <Doughnut data={donut.data} options={donut.options} />
        </ChartZoomSurface>
      </MDBox>
    </Card>
  );

  return (
    <>
      {isFinancialsLayout ? (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <Card sx={{ ...cardSx, p: 2, minHeight: 280 }}>
                <MDTypography
                  variant="h6"
                  fontWeight="bold"
                  mb={1}
                  color={darkMode ? "white" : "dark"}
                >
                  Govt & PAF share by category (M.)
                </MDTypography>
                <MDBox height={220} opacity={loading ? 0.4 : 1}>
                  <ChartZoomSurface
                    enabled={zoomEnabled}
                    darkMode={darkMode}
                    onZoom={() => setZoomChart(ZOOM_CHART.govtPafBar)}
                  >
                    <Bar data={govtPafBarData} options={groupedBarOptions} />
                  </ChartZoomSurface>
                </MDBox>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              {renderDonutCard(
                "Govt & PAF share distribution",
                govtPafDonutChart,
                "govt-paf",
                ZOOM_CHART.govtPafDonut
              )}
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} md={6}>
              <Card sx={{ ...cardSx, p: 2, minHeight: 280 }}>
                <MDTypography
                  variant="h6"
                  fontWeight="bold"
                  mb={1}
                  color={darkMode ? "white" : "dark"}
                >
                  AHQ, RAC & Base share by category (M.)
                </MDTypography>
                <MDBox height={220} opacity={loading ? 0.4 : 1}>
                  <ChartZoomSurface
                    enabled={zoomEnabled}
                    darkMode={darkMode}
                    onZoom={() => setZoomChart(ZOOM_CHART.ahqRacBaseBar)}
                  >
                    <Bar data={ahqRacBaseBarData} options={groupedBarOptions} />
                  </ChartZoomSurface>
                </MDBox>
              </Card>
            </Grid>
            <Grid item xs={12} md={6}>
              {renderDonutCard(
                "AHQ, RAC & Base share distribution",
                ahqRacBaseDonutChart,
                "ahq-rac-base",
                ZOOM_CHART.ahqRacBaseDonut
              )}
            </Grid>
          </Grid>
        </>
      ) : (
        <Grid container spacing={2}>
          <Grid item xs={12} lg={7}>
            <Card sx={{ ...cardSx, p: 2, minHeight: 280 }}>
              <MDTypography
                variant="h6"
                fontWeight="bold"
                mb={1}
                color={darkMode ? "white" : "dark"}
              >
                Financial share by category (M.)
              </MDTypography>
              <MDBox height={220} opacity={loading ? 0.4 : 1}>
                <ChartZoomSurface
                  enabled={zoomEnabled}
                  darkMode={darkMode}
                  onZoom={() => setZoomChart(ZOOM_CHART.assetsBar)}
                >
                  <Bar data={groupedBarData} options={groupedBarOptions} />
                </ChartZoomSurface>
              </MDBox>
            </Card>
          </Grid>
          <Grid item xs={12} lg={5}>
            {renderDonutCard("Share Distribution", donutChart, "assets")}
          </Grid>
        </Grid>
      )}

      <Dialog
        open={Boolean(zoomChart)}
        onClose={closeZoom}
        maxWidth="lg"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            bgcolor: darkMode ? "background.default" : "background.paper",
          },
        }}
      >
        <DialogTitle
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            pr: 1,
          }}
        >
          <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
            {zoomDialogConfig?.title || ""}
          </MDTypography>
          <IconButton onClick={closeZoom} size="small" aria-label="Close enlarged chart">
            <Icon>close</Icon>
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {zoomDialogConfig?.type === "bar" && (
            <MDBox height={{ xs: 360, sm: 420, md: 480 }}>
              <Bar data={zoomDialogConfig.data} options={zoomDialogConfig.options} />
            </MDBox>
          )}
          {zoomDialogConfig?.type === "donut" && (
            <MDBox height={{ xs: 360, sm: 420, md: 480 }}>
              <Doughnut data={zoomDialogConfig.data} options={zoomDialogConfig.options} />
            </MDBox>
          )}
        </DialogContent>
      </Dialog>
    </>
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
  chartZoomOnClick: PropTypes.bool,
  chartLayout: PropTypes.oneOf(["default", "financials"]),
};

KpiCharts.defaultProps = {
  shareRows: [],
  assetCards: [],
  loading: false,
  chartZoomOnClick: false,
  chartLayout: "default",
};

export default KpiCharts;
