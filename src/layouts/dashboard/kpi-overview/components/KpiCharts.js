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
import ChartExportButton from "./ChartExportButton";
import { coerceChartDataValue, nullIfZeroChartBarValue } from "utils/chartBarDataUtils";
import {
  applyKpiZoomBarChartEnhancements,
  applyKpiZoomDonutChartEnhancements,
} from "./kpiZoomChartEnhancements";
import {
  exportDonutChartDataToExcel,
  exportGroupedBarChartDataToExcel,
} from "utils/kpiChartExcelExport";

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, Tooltip, Legend);

const SHARE_COLORS = ["#025B64", "#00D47E", "#F5A524", "#3B82F6", "#6B7280"];

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

const CATEGORY_BAR_COLORS = ["#025B64", "#00D47E", "#F5A524", "#3B82F6", "#6B7280", "#94A3B8"];

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

export function getEnterpriseCardSx() {
  return {
    borderRadius: "16px",
    height: "100%",
    border: "1px solid var(--ent-border, #dce6e7)",
    boxShadow: "var(--ent-shadow, 0 1px 2px rgba(0, 0, 0, 0.04))",
    background: "var(--ent-surface, #ffffff)",
    transition: "box-shadow 200ms ease-in-out",
    "&:hover": {
      boxShadow: "var(--ent-shadow, 0 1px 2px rgba(0, 0, 0, 0.04))",
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
      data: cards.map((a) => nullIfZeroChartBarValue(a.mil?.[s.milKey])),
      backgroundColor: SERIES_COLOR_BY_MIL_KEY[s.milKey],
      borderRadius: 6,
      maxBarThickness: 16,
    })),
  };
}

/** One bar per category with Govt + PAF as stacked shaded segments. */
function buildGovtPafStackedBarData(cards) {
  const base = buildGroupedBarData(cards, GOVT_PAF_SERIES);
  const lastIdx = base.datasets.length - 1;
  return {
    labels: base.labels,
    datasets: base.datasets.map((ds, idx) => ({
      ...ds,
      maxBarThickness: 36,
      borderSkipped: false,
      borderRadius:
        idx === lastIdx
          ? { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 }
          : { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
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
          hoverOffset: 4,
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

export function ChartZoomSurface({ enabled, onZoom, children, darkMode }) {
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

function KpiCharts({
  shareRows,
  contractRows,
  assetCards,
  loading,
  chartZoomOnClick,
  chartLayout,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [shareClassFilter, setShareClassFilter] = useState("all");
  const [zoomChart, setZoomChart] = useState(null);

  const closeZoom = useCallback(() => setZoomChart(null), []);

  const donutShares = useMemo(
    () => buildFinancialShares(shareRows || [], shareClassFilter, contractRows || []),
    [shareRows, shareClassFilter, contractRows]
  );

  const cards = (assetCards || []).filter((c) => c.chartInclude !== false && c.key !== "total");

  const groupedBarData = useMemo(() => buildGroupedBarData(cards, CATEGORY_SERIES), [cards]);

  const govtPafBarData = useMemo(() => buildGovtPafStackedBarData(cards), [cards]);
  const ahqRacBaseBarData = useMemo(() => buildGroupedBarData(cards, AHQ_RAC_BASE_SERIES), [cards]);

  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";

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
        ticks: {
          color: textColor,
          maxRotation: 40,
          minRotation: 0,
          font: { size: 11, weight: "bold" },
        },
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
          label: (ctx) => {
            const n = coerceChartDataValue(ctx.raw);
            if (n == null || n === 0) return null;
            return `${ctx.dataset.label}: ${formatKpiMoneyLabel(n)}`;
          },
        },
      },
    },
  };

  const stackedBarOptions = useMemo(
    () => ({
      ...groupedBarOptions,
      scales: {
        x: { ...groupedBarOptions.scales.x, stacked: true },
        y: { ...groupedBarOptions.scales.y, stacked: true },
      },
    }),
    [textColor, gridColor]
  );

  const cardSx = getEnterpriseCardSx();
  const zoomEnabled = Boolean(chartZoomOnClick) && !loading;

  const zoomedBarOptions = useMemo(
    () =>
      applyKpiZoomBarChartEnhancements(
        {
          ...groupedBarOptions,
          plugins: {
            ...groupedBarOptions.plugins,
            legend: {
              ...groupedBarOptions.plugins.legend,
              labels: {
                ...groupedBarOptions.plugins.legend.labels,
                font: { size: 13, weight: "600" },
              },
            },
          },
        },
        {
          darkMode,
          formatValue: (value) => formatKpiMoneyLabel(coerceChartDataValue(value) ?? 0),
          tooltipCallbacks: groupedBarOptions.plugins.tooltip.callbacks,
          fontSize: 13,
        }
      ),
    [groupedBarOptions, darkMode]
  );

  const zoomedGovtPafBarOptions = useMemo(
    () =>
      applyKpiZoomBarChartEnhancements(
        {
          ...stackedBarOptions,
          plugins: {
            ...stackedBarOptions.plugins,
            legend: {
              ...stackedBarOptions.plugins.legend,
              labels: {
                ...stackedBarOptions.plugins.legend.labels,
                font: { size: 13, weight: "600" },
              },
            },
          },
        },
        {
          darkMode,
          formatValue: (value) => formatKpiMoneyLabel(coerceChartDataValue(value) ?? 0),
          tooltipCallbacks: stackedBarOptions.plugins.tooltip.callbacks,
          fontSize: 13,
        }
      ),
    [stackedBarOptions, darkMode]
  );

  const makeZoomedDonutOptions = useCallback(
    (donut) => {
      const values = donut.data?.datasets?.[0]?.data || [];
      const sumTotal = values.reduce((a, b) => a + (coerceChartDataValue(b) ?? 0), 0) || 1;
      return applyKpiZoomDonutChartEnhancements(
        {
          ...donut.options,
          plugins: {
            ...donut.options.plugins,
            legend: {
              ...donut.options.plugins.legend,
              labels: {
                ...donut.options.plugins.legend.labels,
                font: { size: 13, weight: "600" },
                padding: 14,
              },
            },
          },
        },
        {
          darkMode,
          formatValue: (value) => {
            const n = coerceChartDataValue(value) ?? 0;
            const pct = ((n / sumTotal) * 100).toFixed(1);
            return `${formatKpiMoneyLabel(n)}\n${pct}%`;
          },
          tooltipCallbacks: donut.options.plugins?.tooltip?.callbacks,
          fontSize: 12,
        }
      );
    },
    [darkMode]
  );

  const zoomDialogConfig = useMemo(() => {
    const configsByKey = {
      [ZOOM_CHART.assetsBar]: {
        title: "Financial share by category (M)",
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
        title: "Govt & PAF share by category (M)",
        type: "bar",
        data: govtPafBarData,
        options: zoomedGovtPafBarOptions,
      },
      [ZOOM_CHART.govtPafDonut]: {
        title: "Govt & PAF share distribution",
        type: "donut",
        data: govtPafDonutChart.data,
        options: makeZoomedDonutOptions(govtPafDonutChart),
      },
      [ZOOM_CHART.ahqRacBaseBar]: {
        title: "AHQ, RAC & Base share by category (M)",
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
    zoomedGovtPafBarOptions,
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

  const renderBarCard = (title, barData, zoomKey, barOptions = groupedBarOptions) => (
    <Card sx={{ ...cardSx, p: 2, minHeight: 280 }}>
      <MDBox display="flex" alignItems="center" justifyContent="space-between" gap={0.5} mb={1}>
        <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
          {title}
        </MDTypography>
        <ChartExportButton
          disabled={loading}
          ariaLabel={`Export ${title} to Excel`}
          onExport={() => exportGroupedBarChartDataToExcel(title, barData)}
        />
      </MDBox>
      <MDBox height={220} opacity={loading ? 0.4 : 1}>
        <ChartZoomSurface
          enabled={zoomEnabled}
          darkMode={darkMode}
          onZoom={() => setZoomChart(zoomKey)}
        >
          <Bar data={barData} options={barOptions} />
        </ChartZoomSurface>
      </MDBox>
    </Card>
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
        <MDBox display="flex" alignItems="center" gap={0.5} flexShrink={0}>
          {renderShareClassFilter(filterIdSuffix)}
          <ChartExportButton
            disabled={loading}
            ariaLabel={`Export ${title} to Excel`}
            onExport={() => exportDonutChartDataToExcel(title, donut.data)}
          />
        </MDBox>
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
              {renderBarCard(
                "Govt & PAF share by category (M)",
                govtPafBarData,
                ZOOM_CHART.govtPafBar,
                stackedBarOptions
              )}
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
              {renderBarCard(
                "AHQ, RAC & Base share by category (M)",
                ahqRacBaseBarData,
                ZOOM_CHART.ahqRacBaseBar
              )}
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
            {renderBarCard("Financial share by category (M)", groupedBarData, ZOOM_CHART.assetsBar)}
          </Grid>
          <Grid item xs={12} lg={5}>
            {renderDonutCard("Share Distribution", donutChart, "assets")}
          </Grid>
        </Grid>
      )}

      <Dialog
        fullScreen
        open={Boolean(zoomChart)}
        onClose={closeZoom}
        PaperProps={{
          sx: {
            display: "flex",
            flexDirection: "column",
            m: 0,
            height: "100%",
            maxHeight: "100%",
            borderRadius: 0,
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
            flexShrink: 0,
          }}
        >
          <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
            {zoomDialogConfig?.title || ""}
          </MDTypography>
          <MDBox display="flex" alignItems="center" gap={0.5}>
            {zoomDialogConfig ? (
              <ChartExportButton
                disabled={loading}
                ariaLabel={`Export ${zoomDialogConfig.title} to Excel`}
                onExport={() => {
                  if (zoomDialogConfig.type === "bar") {
                    exportGroupedBarChartDataToExcel(zoomDialogConfig.title, zoomDialogConfig.data);
                  } else {
                    exportDonutChartDataToExcel(zoomDialogConfig.title, zoomDialogConfig.data);
                  }
                }}
              />
            ) : null}
            <IconButton onClick={closeZoom} size="small" aria-label="Close enlarged chart">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            flex: "1 1 auto",
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            overflow: "hidden",
            p: { xs: 1.5, sm: 2 },
          }}
        >
          {zoomDialogConfig?.type === "bar" && (
            <MDBox sx={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
              <Bar data={zoomDialogConfig.data} options={zoomDialogConfig.options} />
            </MDBox>
          )}
          {zoomDialogConfig?.type === "donut" && (
            <MDBox sx={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
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
  contractRows: PropTypes.arrayOf(PropTypes.object),
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
  contractRows: [],
  assetCards: [],
  loading: false,
  chartZoomOnClick: false,
  chartLayout: "default",
};

export default KpiCharts;
