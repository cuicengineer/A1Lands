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
import SearchableSelect from "components/SearchableSelect";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useMaterialUIController } from "context";

import {
  buildFinancialShares,
  buildKpiCategoryRacMilMatrix,
  buildKpiRacGovtPafCells,
  formatKpiMoneyLabel,
  resolveKpiChartCategoryKeys,
  SHARE_DISTRIBUTION_CLASS_OPTIONS,
} from "../kpiDataUtils";
import ChartExportButton from "./ChartExportButton";
import {
  coerceChartDataValue,
  nullIfZeroChartBarValue,
  KPI_OVERVIEW_WIDE_BAR_OPTIONS,
  withKpiOverviewWideBarDatasets,
} from "utils/chartBarDataUtils";
import {
  applyKpiZoomBarChartEnhancements,
  applyKpiZoomDonutChartEnhancements,
  buildKpiDonutLegendLabelOptions,
  ensureKpiZoomChartPluginsRegistered,
} from "./kpiZoomChartEnhancements";
import {
  exportDonutChartDataToExcel,
  exportGroupedBarChartDataToExcel,
} from "utils/kpiChartExcelExport";

const DONUT_LABEL_FONT = "Inter, Roboto, Helvetica, Arial, sans-serif";

function measureDonutLabelWidth(ctx, text, fontSize, fontWeight) {
  ctx.font = `${fontWeight} ${fontSize}px ${DONUT_LABEL_FONT}`;
  return ctx.measureText(text).width;
}

/** Chart.js arc angles: 0 at top (12 o'clock), increasing clockwise. */
function chartAngleToPoint(cx, cy, radius, angle) {
  return {
    x: cx + Math.sin(angle) * radius,
    y: cy - Math.cos(angle) * radius,
  };
}

/** Tangent rotation for readable curved labels; flip 180° per character on the left. */
function chartAngleToLabelRotation(angle, x, cx) {
  return x < cx ? angle + Math.PI : angle;
}

/** Draw label characters tangential to an arc, centered within the slice. */
function drawTextAlongArc(ctx, text, cx, cy, radius, startAngle, endAngle, opts = {}) {
  const raw = String(text ?? "").trim();
  if (!raw) return;

  let fontSize = opts.fontSize ?? 10;
  const fontWeight = opts.fontWeight ?? 700;
  const fillStyle = opts.fillStyle ?? "#111827";
  const shadowColor = opts.shadowColor;
  const shadowBlur = opts.shadowBlur ?? 3;
  const edgePadding = opts.edgePadding ?? 0.1;

  const arcSpan = endAngle - startAngle;
  let textWidth = measureDonutLabelWidth(ctx, raw, fontSize, fontWeight);
  let angularSpan = textWidth / radius;
  const maxAngular = Math.max(arcSpan - edgePadding * 2, 0.04);

  while (angularSpan > maxAngular && fontSize > 6) {
    fontSize -= 1;
    textWidth = measureDonutLabelWidth(ctx, raw, fontSize, fontWeight);
    angularSpan = textWidth / radius;
  }
  if (angularSpan > maxAngular) return;

  ctx.font = `${fontWeight} ${fontSize}px ${DONUT_LABEL_FONT}`;
  ctx.fillStyle = fillStyle;
  ctx.shadowColor = shadowColor || "transparent";
  ctx.shadowBlur = shadowColor ? shadowBlur : 0;

  const chars = [...raw];
  const charWidths = chars.map((ch) => ctx.measureText(ch).width);
  const totalWidth = charWidths.reduce((sum, w) => sum + w, 0);
  const totalAngle = totalWidth / radius;

  const midAngle = (startAngle + endAngle) / 2;
  const { x: midX } = chartAngleToPoint(cx, cy, radius, midAngle);
  const reverseOrder = midX < cx;
  const renderChars = reverseOrder ? [...chars].reverse() : chars;
  const renderWidths = reverseOrder ? [...charWidths].reverse() : charWidths;

  let angle = reverseOrder ? midAngle + totalAngle / 2 : midAngle - totalAngle / 2;

  for (let i = 0; i < renderChars.length; i += 1) {
    const ch = renderChars[i];
    const w = renderWidths[i];
    let charAngle;
    if (reverseOrder) {
      charAngle = angle - w / (2 * radius);
      angle -= w / radius;
    } else {
      charAngle = angle + w / (2 * radius);
      angle += w / radius;
    }

    const { x, y } = chartAngleToPoint(cx, cy, radius, charAngle);
    const rotation = chartAngleToLabelRotation(charAngle, x, cx);

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
}

const kpiOuterDonutLegendRingPlugin = {
  id: "kpiOuterDonutLegendRing",
  afterDatasetsDraw(chart) {
    const opts = chart?.options?.plugins?.kpiOuterDonutLegendRing;
    if (!opts?.enabled) return;
    const labels = chart?.data?.labels || [];
    const innerDatasetIndex = 0;
    const outerDatasetIndex = chart.data?.datasets?.length - 1;
    if (outerDatasetIndex < 0) return;
    const innerMeta = chart.getDatasetMeta(innerDatasetIndex);
    const outerMeta = chart.getDatasetMeta(outerDatasetIndex);
    if (!innerMeta?.data?.length || !outerMeta?.data?.length) return;

    const { ctx } = chart;
    const textColor = opts.textColor || "#111827";
    const fontSize = opts.fontSize || 10;
    const fontWeight = opts.fontWeight || 700;
    const formatValue =
      typeof opts.formatValue === "function"
        ? opts.formatValue
        : (value) => formatKpiMoneyLabel(coerceChartDataValue(value) ?? 0);
    const valueTextColor = opts.valueTextColor || opts.textColor || "#111827";
    const curveOuterText = opts.curveOuterText !== false;
    const outerRingMode = opts.outerRingMode || "value";
    const innerShowValue = Boolean(opts.innerShowValue);
    const curveInnerText = opts.curveInnerText !== false;
    const racLabels = chart?.data?.racLabels || [];
    const innerLabelColor = opts.innerLabelColor || valueTextColor;

    // Inner ring: curved class label or numeric value
    innerMeta.data.forEach((arc, index) => {
      const value = coerceChartDataValue(chart.data?.datasets?.[0]?.data?.[index]);
      if (value == null || value <= 0) return;

      const innerText = innerShowValue
        ? formatValue(value, index)
        : String(labels[index] ?? "").trim();
      if (!innerText) return;

      const props = arc.getProps(
        ["startAngle", "endAngle", "innerRadius", "outerRadius", "x", "y"],
        true
      );
      const labelRadius = props.innerRadius + (props.outerRadius - props.innerRadius) * 0.52;
      const innerFillStyle = innerShowValue ? valueTextColor : innerLabelColor;

      if (curveInnerText) {
        drawTextAlongArc(
          ctx,
          innerText,
          props.x,
          props.y,
          labelRadius,
          props.startAngle,
          props.endAngle,
          {
            fontSize,
            fontWeight,
            fillStyle: innerFillStyle,
            shadowColor: opts.textShadowColor || "rgba(0, 0, 0, 0.65)",
            shadowBlur: 3,
          }
        );
        return;
      }

      const midAngle = (props.startAngle + props.endAngle) / 2;
      const x = props.x + Math.cos(midAngle) * labelRadius;
      const y = props.y + Math.sin(midAngle) * labelRadius;

      ctx.save();
      ctx.font = `${fontWeight} ${fontSize}px ${DONUT_LABEL_FONT}`;
      ctx.fillStyle = innerFillStyle;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = opts.textShadowColor || "rgba(255, 255, 255, 0.85)";
      ctx.shadowBlur = 3;
      ctx.fillText(innerText, x, y);
      ctx.restore();
    });

    // Outer ring: RAC name or numeric value, curved along the colored band
    outerMeta.data.forEach((arc, index) => {
      const value = coerceChartDataValue(chart.data?.datasets?.[0]?.data?.[index]);
      if (value == null || value <= 0) return;

      const valueText =
        outerRingMode === "rac" ? String(racLabels[index] ?? "").trim() : formatValue(value, index);
      if (!valueText) return;

      const props = arc.getProps(
        ["startAngle", "endAngle", "innerRadius", "outerRadius", "x", "y"],
        true
      );
      const valueRadius = props.innerRadius + (props.outerRadius - props.innerRadius) * 0.52;
      const outerFillStyle = valueTextColor;

      if (curveOuterText) {
        drawTextAlongArc(
          ctx,
          valueText,
          props.x,
          props.y,
          valueRadius,
          props.startAngle,
          props.endAngle,
          {
            fontSize: fontSize + 1,
            fontWeight,
            fillStyle: outerFillStyle,
            shadowColor: opts.textShadowColor || "rgba(255, 255, 255, 0.85)",
            shadowBlur: 3,
          }
        );
        return;
      }

      const midAngle = (props.startAngle + props.endAngle) / 2;
      const x = props.x + Math.cos(midAngle) * valueRadius;
      const y = props.y + Math.sin(midAngle) * valueRadius;

      ctx.save();
      ctx.font = `700 ${fontSize + 1}px ${DONUT_LABEL_FONT}`;
      ctx.fillStyle = outerFillStyle;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = opts.textShadowColor || "rgba(255, 255, 255, 0.85)";
      ctx.shadowBlur = 3;
      ctx.fillText(valueText, x, y);
      ctx.restore();
    });
  },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  ArcElement,
  Tooltip,
  Legend,
  kpiOuterDonutLegendRingPlugin
);
ensureKpiZoomChartPluginsRegistered();

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
  assetsGovtPafBar: "assetsGovtPafBar",
  assetsGovtPafDonut: "assetsGovtPafDonut",
  govtPafBar: "govtPafBar",
  govtPafDonut: "govtPafDonut",
  ahqRacBaseBar: "ahqRacBaseBar",
  ahqRacBaseDonut: "ahqRacBaseDonut",
};

function kpiNumeric(value) {
  return coerceChartDataValue(value) ?? 0;
}

/** Category financial donut total — excludes Govt Share and PAF Share. */
function cellFinancialCategoryTotal(mil) {
  if (!mil || typeof mil !== "object") return 0;
  const income = kpiNumeric(mil.incomePA);
  if (income > 0) return income;
  return kpiNumeric(mil.ahq) + kpiNumeric(mil.rac) + kpiNumeric(mil.base);
}

function buildCategoryRacBarDataFromMatrix(cells, series) {
  return {
    labels: cells.map((c) => c.chartLabel),
    datasets: withKpiOverviewWideBarDatasets(
      series.map((s) => ({
        label: s.label,
        data: cells.map((c) => nullIfZeroChartBarValue(c.mil?.[s.milKey])),
        backgroundColor: SERIES_COLOR_BY_MIL_KEY[s.milKey],
        borderRadius: 6,
      }))
    ),
  };
}

const CLASS_COLOR_BY_CATEGORY_KEY = {
  categoryA: CATEGORY_BAR_COLORS[0],
  categoryB: CATEGORY_BAR_COLORS[1],
  categoryC: CATEGORY_BAR_COLORS[2],
  bts: CATEGORY_BAR_COLORS[3],
  hb: CATEGORY_BAR_COLORS[4],
};

function parseCellCategoryKey(cell) {
  const idx = String(cell?.key ?? "").lastIndexOf("-");
  return idx >= 0 ? cell.key.slice(idx + 1) : "";
}

/** RAC on x-axis; one clustered bar per property class, colored by class. */
function buildRacClusteredClassFinancialBarData(cells) {
  const racLabels = [];
  const racSeen = new Set();
  const categoryKeys = [];
  const categorySeen = new Set();
  const valueByRacCategory = new Map();

  for (const cell of cells) {
    if (!racSeen.has(cell.racLabel)) {
      racSeen.add(cell.racLabel);
      racLabels.push(cell.racLabel);
    }

    const categoryKey = parseCellCategoryKey(cell);
    if (categoryKey && !categorySeen.has(categoryKey)) {
      categorySeen.add(categoryKey);
      categoryKeys.push(categoryKey);
    }

    valueByRacCategory.set(
      `${cell.racLabel}::${categoryKey}`,
      cellFinancialCategoryTotal(cell.mil)
    );
  }

  return {
    labels: racLabels,
    datasets: withKpiOverviewWideBarDatasets(
      categoryKeys.map((categoryKey, idx) => {
        const sample = cells.find((c) => parseCellCategoryKey(c) === categoryKey);
        return {
          label: sample?.catLabel || categoryKey,
          data: racLabels.map((racLabel) =>
            nullIfZeroChartBarValue(valueByRacCategory.get(`${racLabel}::${categoryKey}`))
          ),
          backgroundColor:
            CLASS_COLOR_BY_CATEGORY_KEY[categoryKey] ||
            CATEGORY_BAR_COLORS[idx % CATEGORY_BAR_COLORS.length],
          borderRadius: 6,
        };
      })
    ),
  };
}

function buildCategoryRacFinancialDonutChart(cells, darkMode) {
  const labels = cells.map((c) => c.catLabel);
  const racLabels = cells.map((c) => c.racLabel);
  const values = cells.map((c) => cellFinancialCategoryTotal(c.mil));
  const colors = cells.map((c) => {
    const categoryKey = parseCellCategoryKey(c);
    const idx = ["categoryA", "categoryB", "categoryC", "bts", "hb"].indexOf(categoryKey);
    return (
      CLASS_COLOR_BY_CATEGORY_KEY[categoryKey] ||
      CATEGORY_BAR_COLORS[(idx >= 0 ? idx : 0) % CATEGORY_BAR_COLORS.length]
    );
  });
  const sumTotal = values.reduce((a, b) => a + kpiNumeric(b), 0) || 1;
  const outerRingColors = colors.map((hex) => `${hex}80`);

  return {
    data: {
      labels,
      racLabels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: darkMode ? "#1e1e1e" : "#fff",
          hoverOffset: 4,
          weight: 1.8,
        },
        {
          data: values,
          backgroundColor: outerRingColors,
          borderWidth: 1,
          borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
          hoverOffset: 0,
          weight: 0.9,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "52%",
      plugins: {
        legend: {
          position: "right",
          labels: buildKpiDonutLegendLabelOptions({
            darkMode,
            fontSize: 11,
            fontWeight: "bold",
            padding: 8,
            boxWidth: 10,
          }),
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if ((ctx.datasetIndex ?? 0) > 0) return null;
              const pct = ((ctx.raw / sumTotal) * 100).toFixed(1);
              const rac = racLabels[ctx.dataIndex] || "";
              const classLabel = labels[ctx.dataIndex] || ctx.label;
              const prefix = rac ? `${classLabel} — ${rac}` : classLabel;
              return `${prefix}: ${formatKpiMoneyLabel(kpiNumeric(ctx.raw))} (${pct}%)`;
            },
          },
        },
        kpiOuterDonutLegendRing: {
          enabled: true,
          outerRingMode: "value",
          innerShowValue: false,
          curveInnerText: true,
          curveOuterText: true,
          valueTextColor: "#ffffff",
          innerLabelColor: "#ffffff",
          textColor: darkMode ? "#f3f4f6" : "#1f2937",
          textShadowColor: "rgba(0, 0, 0, 0.65)",
          fontSize: 9,
          fontWeight: 700,
          formatValue: (value) => formatKpiMoneyLabel(kpiNumeric(value)),
        },
      },
    },
  };
}

function buildGovtPafOuterRingDonutChart({
  labels,
  values,
  colors,
  darkMode,
  legendFontSize = 11,
}) {
  const sumTotal = values.reduce((a, b) => a + kpiNumeric(b), 0) || 1;
  const outerRingColors = colors.map((hex) => `${hex}80`);

  return {
    data: {
      labels,
      datasets: [
        {
          data: values,
          backgroundColor: colors,
          borderWidth: 2,
          borderColor: darkMode ? "#1e1e1e" : "#fff",
          hoverOffset: 4,
          weight: 1.8,
        },
        {
          data: values,
          backgroundColor: outerRingColors,
          borderWidth: 1,
          borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
          hoverOffset: 0,
          weight: 0.9,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "52%",
      plugins: {
        legend: {
          position: "right",
          labels: buildKpiDonutLegendLabelOptions({
            darkMode,
            fontSize: legendFontSize,
            fontWeight: "bold",
            padding: legendFontSize >= 13 ? 10 : 8,
            boxWidth: legendFontSize >= 13 ? 12 : 10,
          }),
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if ((ctx.datasetIndex ?? 0) > 0) return null;
              const pct = ((ctx.raw / sumTotal) * 100).toFixed(1);
              return `${ctx.label}: ${formatKpiMoneyLabel(kpiNumeric(ctx.raw))} (${pct}%)`;
            },
          },
        },
        kpiOuterDonutLegendRing: {
          enabled: true,
          textColor: darkMode ? "#f3f4f6" : "#1f2937",
          textShadowColor: darkMode ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.9)",
          fontSize: 10,
          fontWeight: 700,
          curveOuterText: true,
          formatValue: (value) => formatKpiMoneyLabel(kpiNumeric(value)),
        },
      },
    },
  };
}

function buildRacGovtPafStackedBarData(cells) {
  const base = buildCategoryRacBarDataFromMatrix(cells, GOVT_PAF_SERIES);
  const lastIdx = base.datasets.length - 1;
  return {
    labels: base.labels,
    datasets: base.datasets.map((ds, idx) => ({
      ...ds,
      borderSkipped: false,
      borderRadius:
        idx === lastIdx
          ? { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 }
          : { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
    })),
  };
}

function buildGroupedBarData(cards, series) {
  return {
    labels: cards.map((a) => a.label),
    datasets: withKpiOverviewWideBarDatasets(
      series.map((s) => ({
        label: s.label,
        data: cards.map((a) => nullIfZeroChartBarValue(a.mil?.[s.milKey])),
        backgroundColor: SERIES_COLOR_BY_MIL_KEY[s.milKey],
        borderRadius: 6,
      }))
    ),
  };
}

function buildShareDonutChart(shareItems, shareIds, darkMode, { outerLegendRing = false } = {}) {
  const filtered = (shareItems || []).filter((s) => shareIds.includes(s.id));
  const donutLabels = filtered.map((s) => s.label);
  const donutValues = filtered.map((s) => s.value);
  const donutColors = shareIds.map((id) => DONUT_COLOR_BY_SHARE_ID[id] || SHARE_COLORS[0]);

  if (
    outerLegendRing &&
    shareIds.length === 2 &&
    shareIds.includes("govt") &&
    shareIds.includes("paf")
  ) {
    return buildGovtPafOuterRingDonutChart({
      labels: donutLabels,
      values: donutValues,
      colors: donutColors,
      darkMode,
      legendFontSize: 13,
    });
  }

  const sumTotal = donutValues.reduce((a, b) => a + kpiNumeric(b), 0) || 1;
  const outerRingColors = donutColors.map((hex) => `${hex}80`);

  const datasets = [
    {
      data: donutValues,
      backgroundColor: donutColors,
      borderWidth: 2,
      borderColor: darkMode ? "#1e1e1e" : "#fff",
      hoverOffset: 4,
      weight: outerLegendRing ? 1.8 : 1,
    },
  ];

  if (outerLegendRing) {
    datasets.push({
      data: donutValues,
      backgroundColor: outerRingColors,
      borderWidth: 1,
      borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
      hoverOffset: 0,
      weight: 0.9,
    });
  }

  return {
    data: {
      labels: donutLabels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: outerLegendRing ? "52%" : "62%",
      plugins: {
        legend: {
          position: "right",
          labels: buildKpiDonutLegendLabelOptions({
            darkMode,
            fontSize: 13,
            fontWeight: "bold",
            padding: 10,
            boxWidth: 12,
          }),
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              if ((ctx.datasetIndex ?? 0) > 0) return null;
              const pct = ((ctx.raw / sumTotal) * 100).toFixed(1);
              return `${ctx.label}: ${formatKpiMoneyLabel(kpiNumeric(ctx.raw))} (${pct}%)`;
            },
          },
        },
        kpiOuterDonutLegendRing: {
          enabled: outerLegendRing,
          textColor: darkMode ? "#f3f4f6" : "#1f2937",
          textShadowColor: darkMode ? "rgba(0, 0, 0, 0.65)" : "rgba(255, 255, 255, 0.9)",
          fontSize: 10,
          fontWeight: 700,
          curveOuterText: true,
          formatValue: (value) => formatKpiMoneyLabel(kpiNumeric(value)),
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
  propertyRows,
  racOptions,
  racIds,
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

  const categoryKeys = useMemo(
    () => resolveKpiChartCategoryKeys(shareClassFilter),
    [shareClassFilter]
  );

  const categoryRacCells = useMemo(
    () =>
      buildKpiCategoryRacMilMatrix({
        shareRows: shareRows || [],
        propertyRows: propertyRows || [],
        contractRows: contractRows || [],
        racOptions: racOptions || [],
        racIds: racIds || [],
        categoryKeys,
      }),
    [shareRows, propertyRows, contractRows, racOptions, racIds, categoryKeys]
  );

  const categoryRacBarData = useMemo(
    () => buildRacClusteredClassFinancialBarData(categoryRacCells),
    [categoryRacCells]
  );

  const categoryRacDonutChart = useMemo(
    () => buildCategoryRacFinancialDonutChart(categoryRacCells, darkMode),
    [categoryRacCells, darkMode]
  );

  const racGovtPafCells = useMemo(
    () =>
      buildKpiRacGovtPafCells({
        shareRows: shareRows || [],
        contractRows: contractRows || [],
        racOptions: racOptions || [],
        racIds: racIds || [],
      }),
    [shareRows, contractRows, racOptions, racIds]
  );

  const categoryRacGovtPafBarData = useMemo(
    () => buildRacGovtPafStackedBarData(racGovtPafCells),
    [racGovtPafCells]
  );

  const govtPafDonutChart = useMemo(
    () =>
      buildShareDonutChart(
        buildFinancialShares(shareRows || [], "all", contractRows || []),
        ["govt", "paf"],
        darkMode,
        { outerLegendRing: true }
      ),
    [shareRows, contractRows, darkMode]
  );

  const cards = (assetCards || []).filter((c) => c.chartInclude !== false && c.key !== "total");

  const groupedBarData = useMemo(() => buildGroupedBarData(cards, CATEGORY_SERIES), [cards]);
  const ahqRacBaseBarData = useMemo(() => buildGroupedBarData(cards, AHQ_RAC_BASE_SERIES), [cards]);

  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";

  const ahqRacBaseDonutChart = useMemo(
    () =>
      buildShareDonutChart(donutShares, ["ahq", "rac", "base"], darkMode, {
        outerLegendRing: true,
      }),
    [donutShares, darkMode]
  );

  const isFinancialsLayout = chartLayout === "financials";

  const groupedBarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: "index", intersect: false },
    ...KPI_OVERVIEW_WIDE_BAR_OPTIONS,
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

  const financialShareBarOptions = useMemo(
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
                font: { size: 11, weight: "600" },
              },
            },
          },
        },
        {
          darkMode,
          formatValue: (value) => formatKpiMoneyLabel(coerceChartDataValue(value) ?? 0),
          tooltipCallbacks: groupedBarOptions.plugins.tooltip.callbacks,
          fontSize: 9,
          labelPlacement: "inside",
        }
      ),
    [groupedBarOptions, darkMode]
  );

  const zoomedFinancialShareBarOptions = useMemo(
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
          fontSize: 11,
          labelPlacement: "inside",
        }
      ),
    [groupedBarOptions, darkMode]
  );

  const govtPafBarOptions = useMemo(
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
                font: { size: 11, weight: "600" },
              },
            },
          },
        },
        {
          darkMode,
          formatValue: (value) => formatKpiMoneyLabel(coerceChartDataValue(value) ?? 0),
          tooltipCallbacks: stackedBarOptions.plugins.tooltip.callbacks,
          fontSize: 10,
          labelPlacement: "inside",
        }
      ),
    [stackedBarOptions, darkMode]
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
          fontSize: 12,
          labelPlacement: "inside",
        }
      ),
    [stackedBarOptions, darkMode]
  );

  const makeZoomedDonutOptions = useCallback(
    (donut) => {
      const values = donut.data?.datasets?.[0]?.data || [];
      const sumTotal = values.reduce((a, b) => a + (coerceChartDataValue(b) ?? 0), 0) || 1;
      const useLegendNamesOnly = donut?.options?.plugins?.kpiOuterDonutLegendRing?.enabled === true;
      return applyKpiZoomDonutChartEnhancements(
        {
          ...donut.options,
          plugins: {
            ...donut.options.plugins,
            legend: {
              ...donut.options.plugins.legend,
              labels: buildKpiDonutLegendLabelOptions({
                darkMode,
                fontSize: 16,
                fontWeight: "bold",
                padding: 14,
                boxWidth: 14,
              }),
            },
            ...(useLegendNamesOnly
              ? {
                  // Prevent numeric permanent labels from overlaying legend names.
                  kpiZoomPermanentLabels: { enabled: false },
                  kpiOuterDonutLegendRing: {
                    ...donut.options.plugins?.kpiOuterDonutLegendRing,
                    fontSize: 14,
                  },
                }
              : {}),
          },
        },
        {
          darkMode,
          formatValue: (value, meta = {}) => {
            if (useLegendNamesOnly) {
              if ((meta.datasetIndex ?? 0) > 0) return "";
              return String(donut?.data?.labels?.[meta.dataIndex] ?? "");
            }
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
        data: categoryRacBarData,
        options: zoomedFinancialShareBarOptions,
      },
      [ZOOM_CHART.assetsDonut]: {
        title: "Share Distribution",
        type: "donut",
        data: categoryRacDonutChart.data,
        options: makeZoomedDonutOptions(categoryRacDonutChart),
      },
      [ZOOM_CHART.assetsGovtPafBar]: {
        title: "Govt & PAF share by category (M)",
        type: "bar",
        data: categoryRacGovtPafBarData,
        options: zoomedGovtPafBarOptions,
      },
      [ZOOM_CHART.assetsGovtPafDonut]: {
        title: "Govt & PAF share distribution",
        type: "donut",
        data: govtPafDonutChart.data,
        options: makeZoomedDonutOptions(govtPafDonutChart),
      },
      [ZOOM_CHART.govtPafBar]: {
        title: "Govt & PAF share by category (M)",
        type: "bar",
        data: categoryRacGovtPafBarData,
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
    categoryRacBarData,
    categoryRacDonutChart,
    categoryRacGovtPafBarData,
    govtPafDonutChart,
    ahqRacBaseBarData,
    ahqRacBaseDonutChart,
    zoomedBarOptions,
    zoomedFinancialShareBarOptions,
    zoomedGovtPafBarOptions,
    makeZoomedDonutOptions,
  ]);

  const renderShareClassFilter = (filterIdSuffix) => (
    <FormControl size="small" sx={{ minWidth: 88 }}>
      <InputLabel id={`kpi-share-class-label-${filterIdSuffix}`}>Class</InputLabel>
      <SearchableSelect
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
      </SearchableSelect>
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
    { filterIdSuffix = "default", zoomKey = ZOOM_CHART.assetsDonut, showClassFilter = true } = {}
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
          {showClassFilter ? renderShareClassFilter(filterIdSuffix) : null}
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
                categoryRacGovtPafBarData,
                ZOOM_CHART.govtPafBar,
                govtPafBarOptions
              )}
            </Grid>
            <Grid item xs={12} md={6}>
              {renderDonutCard("Govt & PAF share distribution", govtPafDonutChart, {
                zoomKey: ZOOM_CHART.govtPafDonut,
                showClassFilter: false,
              })}
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
              {renderDonutCard("AHQ, RAC & Base share distribution", ahqRacBaseDonutChart, {
                filterIdSuffix: "ahq-rac-base",
                zoomKey: ZOOM_CHART.ahqRacBaseDonut,
              })}
            </Grid>
          </Grid>
        </>
      ) : (
        <>
          <Grid container spacing={2}>
            <Grid item xs={12} lg={7}>
              {renderBarCard(
                "Financial share by category (M)",
                categoryRacBarData,
                ZOOM_CHART.assetsBar,
                financialShareBarOptions
              )}
            </Grid>
            <Grid item xs={12} lg={5}>
              {renderDonutCard("Share Distribution", categoryRacDonutChart, {
                filterIdSuffix: "assets",
                zoomKey: ZOOM_CHART.assetsDonut,
              })}
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} lg={7}>
              {renderBarCard(
                "Govt & PAF share by category (M)",
                categoryRacGovtPafBarData,
                ZOOM_CHART.assetsGovtPafBar,
                govtPafBarOptions
              )}
            </Grid>
            <Grid item xs={12} lg={5}>
              {renderDonutCard("Govt & PAF share distribution", govtPafDonutChart, {
                zoomKey: ZOOM_CHART.assetsGovtPafDonut,
                showClassFilter: false,
              })}
            </Grid>
          </Grid>
        </>
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
  propertyRows: PropTypes.arrayOf(PropTypes.object),
  racOptions: PropTypes.arrayOf(PropTypes.object),
  racIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
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
  propertyRows: [],
  racOptions: [],
  racIds: [],
  assetCards: [],
  loading: false,
  chartZoomOnClick: false,
  chartLayout: "default",
};

export default KpiCharts;
