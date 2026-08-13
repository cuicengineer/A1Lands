import PropTypes from "prop-types";
import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import Breadcrumbs from "@mui/material/Breadcrumbs";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Link from "@mui/material/Link";
import MenuItem from "@mui/material/MenuItem";
import SearchableSelect from "components/SearchableSelect";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useMaterialUIController } from "context";

import {
  applyTenureToAssetCards,
  buildKpiBaseCategoryGovtPafCells,
  buildKpiBaseGovtPafCells,
  buildKpiCategoryRacMilMatrix,
  buildKpiRacGovtPafCells,
  filterKpiRowsByRacBase,
  formatKpiBarAxisTick,
  formatKpiMoneyLabel,
  formatKpiBarMoneyLabel,
  formatKpiCrosshairBarValue,
  KPI_GOVT_PAF_UNASSIGNED_BASE_KEY,
  scaleKpiCellsByTenure,
} from "../kpiDataUtils";
import ChartExportButton from "./ChartExportButton";
import {
  coerceChartDataValue,
  nullIfZeroChartBarValue,
  KPI_OVERVIEW_WIDE_BAR_OPTIONS,
  roundChartBarNumber,
  withKpiOverviewWideBarDatasets,
} from "utils/chartBarDataUtils";
import {
  applyKpiZoomBarChartEnhancements,
  applyKpiZoomDonutChartEnhancements,
  ensureKpiZoomChartPluginsRegistered,
} from "./kpiZoomChartEnhancements";
import {
  exportDonutChartDataToExcel,
  exportGroupedBarChartDataToExcel,
} from "utils/kpiChartExcelExport";
import useDashboardChartColors from "hooks/useDashboardChartColors";

function applyKpiCrosshairBarChartEnhancements(baseOptions, options = {}) {
  return applyKpiZoomBarChartEnhancements(baseOptions, {
    ...options,
    crosshair: true,
  });
}

const DONUT_LABEL_FONT = "Inter, Roboto, Helvetica, Arial, sans-serif";

function measureDonutLabelWidth(ctx, text, fontSize, fontWeight) {
  ctx.font = `${fontWeight} ${fontSize}px ${DONUT_LABEL_FONT}`;
  return ctx.measureText(text).width;
}

/** Chart.js/canvas arc angles: 0 at right (3 o'clock), increasing clockwise. */
function chartAngleToPoint(cx, cy, radius, angle) {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

/** Horizontal static label at arc midpoint — supports multiple lines; shrinks/truncates to fit. */
function truncateDonutLineToWidth(ctx, line, maxWidth) {
  let displayText = line;
  if (ctx.measureText(displayText).width <= maxWidth) return displayText;
  while (displayText.length > 1 && ctx.measureText(`${displayText}…`).width > maxWidth) {
    displayText = displayText.slice(0, -1);
  }
  if (ctx.measureText(`${displayText}…`).width <= maxWidth && displayText !== line) {
    return `${displayText}…`;
  }
  if (ctx.measureText(displayText).width > maxWidth && displayText.length > 1) {
    return `${displayText.slice(0, 1)}…`;
  }
  return displayText;
}

function drawHorizontalSliceLabel(ctx, text, cx, cy, radius, startAngle, endAngle, opts = {}) {
  const lines = String(text ?? "")
    .trim()
    .split("\n")
    .map((part) => part.trim())
    .filter(Boolean);
  if (!lines.length) return;

  let fontSize = opts.fontSize ?? 10;
  const minFontSize = opts.minFontSize ?? 5;
  const fontWeight = opts.fontWeight ?? 700;
  const fillStyle = opts.fillStyle ?? "#ffffff";
  const shadowColor = opts.shadowColor ?? "rgba(0, 0, 0, 0.75)";
  const shadowBlur = opts.shadowBlur ?? 4;
  const arcSpan = Math.max(endAngle - startAngle, 0.04);
  const chordFactor = opts.clipSliceLabels === true ? 0.94 : 0.98;
  const maxChordWidth = Math.max(2 * radius * Math.sin(arcSpan / 2) * chordFactor, 8);
  const lineHeightRatio = opts.lineHeightRatio ?? 1.15;
  const maxVerticalHeight =
    opts.maxVerticalHeight ??
    (opts.clipSliceLabels === true && opts.clipInnerRadius != null && opts.clipOuterRadius != null
      ? Math.max((opts.clipOuterRadius - opts.clipInnerRadius) * 0.88, fontSize * lineHeightRatio)
      : null);

  while (fontSize > minFontSize) {
    ctx.font = `${fontWeight} ${fontSize}px ${DONUT_LABEL_FONT}`;
    const allFitWidth = lines.every((line) => ctx.measureText(line).width <= maxChordWidth);
    const totalHeight = fontSize * lineHeightRatio * lines.length;
    const fitsHeight = maxVerticalHeight == null || totalHeight <= maxVerticalHeight;
    if (allFitWidth && fitsHeight) break;
    fontSize -= 1;
  }

  ctx.font = `${fontWeight} ${fontSize}px ${DONUT_LABEL_FONT}`;
  const fittedLines =
    opts.clipSliceLabels === true
      ? lines.map((line) => truncateDonutLineToWidth(ctx, line, maxChordWidth))
      : lines;
  const lineHeight = fontSize * lineHeightRatio;
  const totalHeight = lineHeight * fittedLines.length;
  const midAngle = (startAngle + endAngle) / 2;
  const { x, y } = chartAngleToPoint(cx, cy, radius, midAngle);
  const startY = y - totalHeight / 2 + lineHeight / 2;

  ctx.save();
  if (
    opts.clipSliceLabels === true &&
    opts.clipInnerRadius != null &&
    opts.clipOuterRadius != null
  ) {
    ctx.beginPath();
    ctx.arc(cx, cy, opts.clipOuterRadius, startAngle, endAngle);
    ctx.arc(cx, cy, opts.clipInnerRadius, endAngle, startAngle, true);
    ctx.closePath();
    ctx.clip();
  }

  ctx.font = `${fontWeight} ${fontSize}px ${DONUT_LABEL_FONT}`;
  ctx.fillStyle = fillStyle;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = shadowColor;
  ctx.shadowBlur = shadowBlur;

  fittedLines.forEach((line, index) => {
    ctx.fillText(line, x, startY + index * lineHeight);
  });

  ctx.restore();
}

function getDonutRingLabelMetrics(
  innerRadius,
  outerRadius,
  { radiusRatio = 0.5, insetRatio = 0.08 } = {}
) {
  const thickness = Math.max(outerRadius - innerRadius, 0);
  const inset = Math.max(thickness * insetRatio, 0.5);
  return {
    thickness,
    labelRadius: innerRadius + thickness * radiusRatio,
    clipInnerRadius: innerRadius + inset,
    clipOuterRadius: outerRadius - inset,
  };
}

function formatDonutSlicePercent(value, total) {
  const numeric = coerceChartDataValue(value) ?? 0;
  const sum = coerceChartDataValue(total) ?? 0;
  if (sum <= 0) return "0.0%";
  return `${((numeric / sum) * 100).toFixed(1)}%`;
}

function buildDonutRacPercentOuterLabel(racLabel, value, total) {
  const rac = String(racLabel ?? "").trim();
  const pct = formatDonutSlicePercent(value, total);
  return rac ? `${rac}\n${pct}` : pct;
}

function buildDonutClassPercentInnerLabel(classLabel, value, total) {
  const label = String(classLabel ?? "").trim();
  const pct = formatDonutSlicePercent(value, total);
  return label ? `${label}\n${pct}` : pct;
}

function getDonutArcDataIndex(arc, fallbackIndex) {
  const fromContext = arc?.$context?.dataIndex ?? arc?.$context?.index;
  return Number.isInteger(fromContext) ? fromContext : fallbackIndex;
}

function getDonutArcSliceProps(arc) {
  return arc.getProps(["startAngle", "endAngle", "innerRadius", "outerRadius", "x", "y"], true);
}

function buildRacClassSliceLabel(racLabel, classLabel) {
  const rac = String(racLabel ?? "").trim();
  const cls = String(classLabel ?? "").trim();
  if (rac && cls) return `${rac} — ${cls}`;
  return rac || cls;
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
  let angle = midAngle - totalAngle / 2;

  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    const w = charWidths[i];
    const charAngle = angle + w / (2 * radius);
    angle += w / radius;

    const { x, y } = chartAngleToPoint(cx, cy, radius, charAngle);

    ctx.save();
    ctx.translate(x, y);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(ch, 0, 0);
    ctx.restore();
  }
}

const kpiOuterDonutLegendRingPlugin = {
  id: "kpiOuterDonutLegendRing",
  /** Draw after all chart layers so labels stay on top. */
  afterDraw(chart, _args, pluginOptions) {
    const opts =
      pluginOptions ??
      chart?.config?.options?.plugins?.kpiOuterDonutLegendRing ??
      chart?.options?.plugins?.kpiOuterDonutLegendRing;
    if (!opts || opts.enabled === false || opts.showSliceLabels === false) return;
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
    const valueTextColor = opts.valueTextColor || "#ffffff";
    const curveOuterText = opts.curveOuterText === true;
    const outerRingMode = opts.outerRingMode || "value";
    const innerRingMode = opts.innerRingMode || "racClass";
    const innerShowValue = Boolean(opts.innerShowValue);
    const curveInnerText = opts.curveInnerText === true;
    const racLabels = chart?.data?.racLabels || [];
    const classLabels = chart?.data?.classLabels || [];
    const innerLabelColor = opts.innerLabelColor || valueTextColor;
    const primaryMeta = innerMeta;
    const secondaryMeta = outerMeta;
    const hasSeparateOuterRing = outerDatasetIndex > innerDatasetIndex;

    const sliceTotal =
      coerceChartDataValue(chart.data?.donutSliceTotal) ??
      ((chart.data?.datasets?.[0]?.data || []).reduce(
        (sum, raw) => sum + (coerceChartDataValue(raw) ?? 0),
        0
      ) ||
        1);

    primaryMeta.data.forEach((primaryArc, loopIndex) => {
      const index = getDonutArcDataIndex(primaryArc, loopIndex);
      if (typeof chart.getDataVisibility === "function" && !chart.getDataVisibility(index)) {
        return;
      }
      if (primaryArc.hidden || primaryArc.skip) return;

      const value =
        coerceChartDataValue(chart.data?.datasets?.[0]?.data?.[index]) ??
        coerceChartDataValue(primaryArc?.$context?.raw);
      if (value == null || value <= 0) return;

      const primaryProps = getDonutArcSliceProps(primaryArc);
      if (
        !Number.isFinite(primaryProps.x) ||
        !Number.isFinite(primaryProps.y) ||
        primaryProps.outerRadius <= primaryProps.innerRadius
      ) {
        return;
      }

      const sliceStart = primaryProps.startAngle;
      const sliceEnd = primaryProps.endAngle;
      const { x: cx, y: cy } = primaryProps;

      const innerRingMetrics = getDonutRingLabelMetrics(
        primaryProps.innerRadius,
        primaryProps.outerRadius,
        {
          radiusRatio: opts.innerLabelRadiusRatio ?? 0.5,
          insetRatio: opts.innerLabelInsetRatio ?? 0.08,
        }
      );

      const innerText = innerShowValue
        ? formatValue(value, index)
        : innerRingMode === "classPercent"
        ? buildDonutClassPercentInnerLabel(classLabels[index] ?? labels[index], value, sliceTotal)
        : innerRingMode === "class"
        ? String(classLabels[index] ?? labels[index] ?? "").trim()
        : innerRingMode === "rac"
        ? String(racLabels[index] ?? "").trim()
        : buildRacClassSliceLabel(racLabels[index], classLabels[index]) ||
          String(labels[index] ?? "").trim();

      const innerFillStyle = innerShowValue ? valueTextColor : innerLabelColor;

      if (innerText) {
        const innerLabelOpts = {
          fontSize,
          minFontSize: opts.minFontSize ?? 4,
          fontWeight,
          fillStyle: innerFillStyle,
          shadowColor: opts.textShadowColor || "rgba(0, 0, 0, 0.75)",
          shadowBlur: 4,
          clipSliceLabels: opts.clipInnerSliceLabels ?? opts.clipSliceLabels === true,
          clipInnerRadius: innerRingMetrics.clipInnerRadius,
          clipOuterRadius: innerRingMetrics.clipOuterRadius,
        };

        if (curveInnerText) {
          drawTextAlongArc(
            ctx,
            innerText,
            cx,
            cy,
            innerRingMetrics.labelRadius,
            sliceStart,
            sliceEnd,
            innerLabelOpts
          );
        } else {
          drawHorizontalSliceLabel(
            ctx,
            innerText,
            cx,
            cy,
            innerRingMetrics.labelRadius,
            sliceStart,
            sliceEnd,
            innerLabelOpts
          );
        }
      }

      if (!hasSeparateOuterRing) return;

      const secondaryArc = secondaryMeta.data[index] ?? secondaryMeta.data[loopIndex];
      if (!secondaryArc || secondaryArc.hidden || secondaryArc.skip) return;

      const secondaryProps = getDonutArcSliceProps(secondaryArc);
      if (secondaryProps.outerRadius <= secondaryProps.innerRadius) return;

      const classLabel = String(classLabels[index] ?? "").trim();
      let outerText = "";
      if (typeof opts.formatOuterLabel === "function") {
        outerText = String(
          opts.formatOuterLabel(value, index, {
            racLabel: racLabels[index],
            classLabel,
            sliceTotal,
            chart,
          }) ?? ""
        ).trim();
      } else if (outerRingMode === "racPercent") {
        outerText = buildDonutRacPercentOuterLabel(racLabels[index], value, sliceTotal);
      } else if (outerRingMode === "racClass") {
        outerText = buildRacClassSliceLabel(racLabels[index], classLabel);
      } else if (outerRingMode === "rac") {
        outerText = String(racLabels[index] ?? "").trim();
      } else {
        outerText = formatValue(value, index);
      }
      if (!outerText) return;

      const outerRingMetrics = getDonutRingLabelMetrics(
        secondaryProps.innerRadius,
        secondaryProps.outerRadius,
        {
          radiusRatio: opts.outerLabelRadiusRatio ?? 0.5,
          insetRatio: opts.outerLabelInsetRatio ?? 0.08,
        }
      );

      const sliceColors = chart.data?.datasets?.[innerDatasetIndex]?.backgroundColor;
      const sliceColor = Array.isArray(sliceColors)
        ? sliceColors[index]
        : typeof sliceColors === "string"
        ? sliceColors
        : null;
      const outerFillStyle =
        opts.outerLabelUseSliceColor && sliceColor
          ? String(sliceColor)
          : opts.outerLabelColor || valueTextColor;

      const outerLabelOpts = {
        fontSize: Math.max(fontSize - 1, opts.minFontSize ?? 4),
        minFontSize: opts.minFontSize ?? 4,
        fontWeight,
        fillStyle: outerFillStyle,
        shadowColor: opts.outerLabelUseSliceColor
          ? "transparent"
          : opts.textShadowColor || "rgba(0, 0, 0, 0.75)",
        shadowBlur: opts.outerLabelUseSliceColor ? 0 : 4,
        clipSliceLabels: opts.clipOuterSliceLabels ?? opts.clipSliceLabels === true,
        clipInnerRadius: outerRingMetrics.clipInnerRadius,
        clipOuterRadius: outerRingMetrics.clipOuterRadius,
      };

      if (curveOuterText) {
        drawTextAlongArc(
          ctx,
          outerText,
          cx,
          cy,
          outerRingMetrics.labelRadius,
          sliceStart,
          sliceEnd,
          outerLabelOpts
        );
      } else {
        drawHorizontalSliceLabel(
          ctx,
          outerText,
          cx,
          cy,
          outerRingMetrics.labelRadius,
          sliceStart,
          sliceEnd,
          outerLabelOpts
        );
      }
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

function buildKpiChartColorMaps(chartColors) {
  const series = chartColors.series;
  const categoryBarColorByIndex = (_, idx) => series[idx % series.length];
  const seriesColorByMilKey = Object.fromEntries(
    CATEGORY_SERIES.map((s, i) => [s.milKey, series[i % series.length]])
  );

  return {
    seriesColorByMilKey,
    categoryBarColorByIndex,
    donutColorByShareId: chartColors.shareById,
    shareFallbackColor: chartColors.share[0],
    ahqRacBase: chartColors.ahqRacBase,
  };
}

const DONUT_TOOLTIP_INTERACTION = {
  mode: "nearest",
  intersect: true,
};

const KPI_DUAL_RING_CUTOUT = "46%";
const KPI_DUAL_RING_DATASET_WEIGHTS = { inner: 2.2, outer: 0.85 };

function buildKpiDualRingDatasets(values, colors, darkMode) {
  const outerRingColors = colors.map((hex) => `${hex}80`);

  return [
    {
      data: values,
      backgroundColor: colors,
      borderWidth: 2,
      borderColor: darkMode ? "#1e1e1e" : "#fff",
      hoverOffset: 0,
      weight: KPI_DUAL_RING_DATASET_WEIGHTS.inner,
    },
    {
      data: values,
      backgroundColor: outerRingColors,
      borderWidth: 1,
      borderColor: darkMode ? "rgba(255,255,255,0.08)" : "rgba(15,23,42,0.08)",
      hoverOffset: 0,
      weight: KPI_DUAL_RING_DATASET_WEIGHTS.outer,
    },
  ];
}

function buildKpiDualRingDonutTooltipCallbacks(sumTotal) {
  return {
    label: (ctx) => {
      if ((ctx.datasetIndex ?? 0) > 0) return null;
      const pct = ((ctx.raw / sumTotal) * 100).toFixed(1);
      return `${ctx.label}: ${formatKpiMoneyLabel(kpiNumeric(ctx.raw))} (${pct}%)`;
    },
  };
}

function buildKpiDualRingLabelPluginOptions(darkMode, overrides = {}) {
  return {
    enabled: true,
    showSliceLabels: true,
    clipSliceLabels: false,
    clipInnerSliceLabels: false,
    clipOuterSliceLabels: false,
    innerLabelRadiusRatio: 0.5,
    outerLabelRadiusRatio: 0.5,
    innerLabelInsetRatio: 0.06,
    outerLabelInsetRatio: 0.06,
    curveInnerText: false,
    curveOuterText: false,
    textColor: darkMode ? "#f3f4f6" : "#1f2937",
    valueTextColor: "#ffffff",
    innerLabelColor: "#ffffff",
    textShadowColor: "rgba(0, 0, 0, 0.75)",
    fontSize: 11,
    fontWeight: 700,
    minFontSize: 4,
    formatValue: (value) => formatKpiMoneyLabel(kpiNumeric(value)),
    ...overrides,
  };
}

function buildKpiStandardDualRingDonutChartOptions(sumTotal, darkMode, pluginOverrides = {}) {
  return {
    responsive: true,
    maintainAspectRatio: false,
    cutout: KPI_DUAL_RING_CUTOUT,
    interaction: DONUT_TOOLTIP_INTERACTION,
    hover: DONUT_TOOLTIP_INTERACTION,
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        mode: "nearest",
        intersect: true,
        callbacks: buildKpiDualRingDonutTooltipCallbacks(sumTotal),
      },
      kpiOuterDonutLegendRing: buildKpiDualRingLabelPluginOptions(darkMode, {
        innerRingMode: "classPercent",
        outerRingMode: "value",
        innerShowValue: false,
        ...pluginOverrides,
      }),
    },
  };
}

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

const ZOOM_CHARTS_WITH_RAC_FILTER = new Set([ZOOM_CHART.assetsDonut, ZOOM_CHART.ahqRacBaseDonut]);
const GOVT_PAF_DRILL_ZOOM_CHARTS = new Set([ZOOM_CHART.govtPafBar, ZOOM_CHART.assetsGovtPafBar]);

function getRacOptionLabel(option) {
  return String(
    option?.name ??
      option?.Name ??
      option?.cmdName ??
      option?.CmdName ??
      option?.id ??
      option?.Id ??
      ""
  ).trim();
}

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

function buildCategoryRacBarDataFromMatrix(cells, series, colorByMilKey) {
  return {
    labels: cells.map((c) => c.chartLabel),
    datasets: withKpiOverviewWideBarDatasets(
      series.map((s) => ({
        label: s.label,
        data: cells.map((c) => nullIfZeroChartBarValue(c.mil?.[s.milKey])),
        backgroundColor: colorByMilKey[s.milKey],
        borderRadius: 6,
      }))
    ),
  };
}

/** Sum financial totals by RAC (all property classes consolidated). */
function groupDonutCellsByRac(cells) {
  const grouped = new Map();
  const racOrder = [];

  for (const cell of cells || []) {
    const value = cellFinancialCategoryTotal(cell.mil);
    if (value <= 0) continue;

    const racLabel = String(cell.racLabel ?? "").trim() || "All";
    if (!grouped.has(racLabel)) {
      grouped.set(racLabel, 0);
      racOrder.push(racLabel);
    }
    grouped.set(racLabel, grouped.get(racLabel) + value);
  }

  return racOrder.map((racLabel) => ({
    racLabel,
    value: grouped.get(racLabel) || 0,
  }));
}

/** RAC on x-axis; one bar per RAC (no class breakdown). */
function buildRacOnlyFinancialBarData(cells, categoryBarColorByIndex) {
  const grouped = groupDonutCellsByRac(cells);

  return {
    labels: grouped.map((entry) => entry.racLabel),
    datasets: withKpiOverviewWideBarDatasets([
      {
        label: "Share",
        data: grouped.map((entry) => nullIfZeroChartBarValue(entry.value)),
        backgroundColor: grouped.map(categoryBarColorByIndex),
        borderRadius: 6,
      },
    ]),
  };
}

function buildCategoryRacFinancialDonutChart(cells, darkMode, categoryBarColorByIndex) {
  const groupedCells = groupDonutCellsByRac(cells);
  const labels = groupedCells.map((c) => c.racLabel);
  const racLabels = groupedCells.map((c) => c.racLabel);
  const values = groupedCells.map((c) => c.value);
  const colors = groupedCells.map(categoryBarColorByIndex);
  const sumTotal = values.reduce((a, b) => a + kpiNumeric(b), 0) || 1;

  return {
    data: {
      labels,
      racLabels,
      classLabels: labels,
      donutSliceTotal: sumTotal,
      datasets: buildKpiDualRingDatasets(values, colors, darkMode),
    },
    options: {
      ...buildKpiStandardDualRingDonutChartOptions(sumTotal, darkMode),
      animation: { duration: 0 },
      elements: {
        arc: {
          borderAlign: "center",
        },
      },
    },
  };
}

function buildGovtPafOuterRingDonutChart({ labels, values, colors, darkMode }) {
  const sumTotal = values.reduce((a, b) => a + kpiNumeric(b), 0) || 1;

  return {
    data: {
      labels,
      classLabels: labels,
      donutSliceTotal: sumTotal,
      datasets: buildKpiDualRingDatasets(values, colors, darkMode),
    },
    options: {
      ...buildKpiStandardDualRingDonutChartOptions(sumTotal, darkMode),
      animation: { duration: 0 },
    },
  };
}

/** Sum Govt / PAF (Mil) from RAC-level Govt & PAF bar cells — keeps donut aligned with the bar chart. */
function sumGovtPafMilFromKpiCells(cells) {
  let govt = 0;
  let paf = 0;
  for (const cell of cells || []) {
    govt += kpiNumeric(cell?.mil?.govt);
    paf += kpiNumeric(cell?.mil?.paf);
  }
  return { govt, paf };
}

function buildGovtPafSharesFromRacBarCells(cells) {
  const { govt, paf } = sumGovtPafMilFromKpiCells(cells);
  return [
    { id: "govt", label: "Govt Share", value: govt },
    { id: "paf", label: "PAF Share", value: paf },
  ];
}

/** Sum AHQ / RAC / Base (Mil) across category asset cards — aligns donut with the category bar chart. */
function sumAhqRacBaseMilFromCategoryCards(cards) {
  let ahq = 0;
  let rac = 0;
  let base = 0;
  for (const card of cards || []) {
    ahq += kpiNumeric(card?.mil?.ahq);
    rac += kpiNumeric(card?.mil?.rac);
    base += kpiNumeric(card?.mil?.base);
  }
  return { ahq, rac, base };
}

function buildAhqRacBaseSharesFromCategoryBarCards(cards) {
  const { ahq, rac, base } = sumAhqRacBaseMilFromCategoryCards(cards);
  return [
    { id: "ahq", label: "AHQ Share", value: ahq },
    { id: "rac", label: "RAC Share", value: rac },
    { id: "base", label: "Base Share", value: base },
  ];
}

function buildRacGovtPafStackedBarData(cells, colorByMilKey) {
  const base = buildCategoryRacBarDataFromMatrix(cells, GOVT_PAF_SERIES, colorByMilKey);
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

function buildGroupedBarData(cards, series, { colorByMilKey } = {}) {
  return {
    labels: cards.map((a) => a.label),
    datasets: withKpiOverviewWideBarDatasets(
      series.map((s) => ({
        label: s.label,
        data: cards.map((a) => nullIfZeroChartBarValue(a.mil?.[s.milKey])),
        backgroundColor: colorByMilKey[s.milKey],
        borderRadius: 6,
      }))
    ),
  };
}

function buildShareDonutChart(
  shareItems,
  shareIds,
  darkMode,
  { outerLegendRing = false, labelPluginOverrides = {}, colorByShareId, shareFallbackColor } = {}
) {
  const filtered = (shareItems || []).filter((s) => shareIds.includes(s.id));
  const donutLabels = filtered.map((s) => s.label);
  const donutValues = filtered.map((s) => s.value);
  const donutColors = shareIds.map((id) => colorByShareId[id] || shareFallbackColor);

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
    });
  }

  const sumTotal = donutValues.reduce((a, b) => a + kpiNumeric(b), 0) || 1;

  if (outerLegendRing) {
    return {
      data: {
        labels: donutLabels,
        classLabels: donutLabels,
        donutSliceTotal: sumTotal,
        datasets: buildKpiDualRingDatasets(donutValues, donutColors, darkMode),
      },
      options: buildKpiStandardDualRingDonutChartOptions(sumTotal, darkMode, labelPluginOverrides),
    };
  }

  const datasets = [
    {
      data: donutValues,
      backgroundColor: donutColors,
      borderWidth: 2,
      borderColor: darkMode ? "#1e1e1e" : "#fff",
      hoverOffset: 4,
      weight: 1,
    },
  ];

  return {
    data: {
      labels: donutLabels,
      datasets,
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: "62%",
      interaction: DONUT_TOOLTIP_INTERACTION,
      hover: DONUT_TOOLTIP_INTERACTION,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: "nearest",
          intersect: true,
          callbacks: buildKpiDualRingDonutTooltipCallbacks(sumTotal),
        },
        kpiOuterDonutLegendRing: {
          enabled: false,
          showSliceLabels: false,
        },
      },
    },
  };
}

export function ChartZoomSurface({ enabled, onZoom, children, darkMode, showZoomHint = true }) {
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
        cursor: showZoomHint ? "zoom-in" : "crosshair",
        borderRadius: 1,
        position: "relative",
        outline: "none",
        "&:focus-visible": {
          boxShadow: (theme) => `0 0 0 2px ${theme.palette.info.main}`,
        },
        ...(showZoomHint
          ? {
              "&:hover .kpi-chart-zoom-hint": {
                opacity: 1,
              },
            }
          : {}),
      }}
      aria-label={showZoomHint ? "Click to enlarge chart" : "Chart crosshair"}
    >
      {children}
      {showZoomHint ? (
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
      ) : null}
    </MDBox>
  );
}

ChartZoomSurface.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onZoom: PropTypes.func.isRequired,
  children: PropTypes.node.isRequired,
  darkMode: PropTypes.bool.isRequired,
  showZoomHint: PropTypes.bool,
};

const GOVT_PAF_DRILL_RAC = "rac";
const GOVT_PAF_DRILL_BASE = "base";
const GOVT_PAF_DRILL_CATEGORY = "category";

const GOVT_PAF_DRILL_INITIAL = { level: GOVT_PAF_DRILL_RAC };

function govtPafDonutSliceValuesEqual(prevDonut, nextDonut) {
  const prevValues = prevDonut?.data?.datasets?.[0]?.data || [];
  const nextValues = nextDonut?.data?.datasets?.[0]?.data || [];
  if (prevValues.length !== nextValues.length) return false;
  for (let i = 0; i < prevValues.length; i += 1) {
    if (kpiNumeric(prevValues[i]) !== kpiNumeric(nextValues[i])) return false;
  }
  return (
    kpiNumeric(prevDonut?.data?.donutSliceTotal) === kpiNumeric(nextDonut?.data?.donutSliceTotal)
  );
}

/** Govt & PAF pie — frozen at RAC-level totals; must not re-render on bar-chart drill-down. */
const GovtPafRacLevelDonutCard = memo(
  function GovtPafRacLevelDonutCard({
    donutChart,
    loading,
    cardSx,
    darkMode,
    zoomEnabled,
    onZoom,
    zoomKey,
  }) {
    const title = "Govt & PAF share distribution";

    return (
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
          <ChartExportButton
            disabled={loading}
            ariaLabel={`Export ${title} to Excel`}
            onExport={() => exportDonutChartDataToExcel(title, donutChart.data)}
          />
        </MDBox>
        <MDBox height={220} opacity={loading ? 0.4 : 1}>
          <ChartZoomSurface enabled={zoomEnabled} darkMode={darkMode} onZoom={onZoom}>
            <Doughnut data={donutChart.data} options={donutChart.options} redraw={false} />
          </ChartZoomSurface>
        </MDBox>
      </Card>
    );
  },
  (prev, next) =>
    prev.loading === next.loading &&
    prev.darkMode === next.darkMode &&
    prev.zoomEnabled === next.zoomEnabled &&
    prev.zoomKey === next.zoomKey &&
    govtPafDonutSliceValuesEqual(prev.donutChart, next.donutChart)
);

GovtPafRacLevelDonutCard.propTypes = {
  donutChart: PropTypes.shape({
    data: PropTypes.object.isRequired,
    options: PropTypes.object.isRequired,
  }).isRequired,
  loading: PropTypes.bool,
  cardSx: PropTypes.object,
  darkMode: PropTypes.bool.isRequired,
  zoomEnabled: PropTypes.bool.isRequired,
  onZoom: PropTypes.func.isRequired,
  zoomKey: PropTypes.string.isRequired,
};

function KpiCharts({
  shareRows,
  contractRows,
  propertyRows,
  agreementContractRows,
  useAsOfContracts = false,
  contractMetaById,
  racOptions,
  racIds,
  baseOptions,
  allBases,
  assetCards,
  loading,
  chartZoomOnClick,
  chartLayout,
  showShareDistributionCharts = true,
  showGovtPafCharts = true,
  tenure = "Annual",
  preferSpGovtPafShare = false,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const chartColors = useDashboardChartColors();
  const colorMaps = useMemo(() => buildKpiChartColorMaps(chartColors), [chartColors]);
  const [donutRacFilter, setDonutRacFilter] = useState("all");
  const [zoomChart, setZoomChart] = useState(null);
  const [govtPafDrill, setGovtPafDrill] = useState(GOVT_PAF_DRILL_INITIAL);

  const closeZoom = useCallback(() => setZoomChart(null), []);

  useEffect(() => {
    setGovtPafDrill(GOVT_PAF_DRILL_INITIAL);
  }, [shareRows, contractRows, propertyRows, agreementContractRows, racIds, tenure]);

  const agreementOptions = useMemo(
    () => ({
      useAsOf: useAsOfContracts,
      contractMetaById: contractMetaById || new Map(),
    }),
    [useAsOfContracts, contractMetaById]
  );

  const donutRacSelectOptions = useMemo(() => {
    const list = racOptions || [];
    if (!racIds?.length) return list;
    const selected = new Set(racIds.map(String));
    return list.filter((option) => selected.has(String(option.id ?? option.Id ?? "")));
  }, [racOptions, racIds]);

  const effectiveDonutRacIds = useMemo(() => {
    if (donutRacFilter && donutRacFilter !== "all") {
      return [String(donutRacFilter)];
    }
    return racIds || [];
  }, [donutRacFilter, racIds]);

  const categoryRacBarCells = useMemo(
    () =>
      scaleKpiCellsByTenure(
        buildKpiCategoryRacMilMatrix({
          shareRows: shareRows || [],
          propertyRows: propertyRows || [],
          contractRows: contractRows || [],
          racOptions: racOptions || [],
          racIds: racIds || [],
        }),
        tenure
      ),
    [shareRows, propertyRows, contractRows, racOptions, racIds, tenure]
  );

  const categoryRacDonutCells = useMemo(
    () =>
      scaleKpiCellsByTenure(
        buildKpiCategoryRacMilMatrix({
          shareRows: shareRows || [],
          propertyRows: propertyRows || [],
          contractRows: contractRows || [],
          racOptions: racOptions || [],
          racIds: effectiveDonutRacIds,
        }),
        tenure
      ),
    [shareRows, propertyRows, contractRows, racOptions, effectiveDonutRacIds, tenure]
  );

  const categoryRacBarData = useMemo(
    () => buildRacOnlyFinancialBarData(categoryRacBarCells, colorMaps.categoryBarColorByIndex),
    [categoryRacBarCells, colorMaps]
  );

  const categoryRacDonutChart = useMemo(
    () =>
      buildCategoryRacFinancialDonutChart(
        categoryRacDonutCells,
        darkMode,
        colorMaps.categoryBarColorByIndex
      ),
    [categoryRacDonutCells, darkMode, colorMaps]
  );

  const racFilteredAgreementRows = useMemo(
    () => filterKpiRowsByRacBase(agreementContractRows || [], racIds || [], []),
    [agreementContractRows, racIds]
  );

  const donutFilteredAgreementRows = useMemo(
    () => filterKpiRowsByRacBase(agreementContractRows || [], effectiveDonutRacIds, []),
    [agreementContractRows, effectiveDonutRacIds]
  );

  const racGovtPafCells = useMemo(
    () =>
      scaleKpiCellsByTenure(
        buildKpiRacGovtPafCells({
          shareRows: shareRows || [],
          contractRows: contractRows || [],
          agreementContractRows: racFilteredAgreementRows,
          useAsOfContracts,
          contractMetaById: agreementOptions.contractMetaById,
          racOptions: racOptions || [],
          racIds: racIds || [],
          preferSpGovtPafShare,
        }),
        tenure
      ),
    [
      shareRows,
      contractRows,
      racFilteredAgreementRows,
      useAsOfContracts,
      agreementOptions.contractMetaById,
      racOptions,
      racIds,
      tenure,
      preferSpGovtPafShare,
    ]
  );

  const categoryRacGovtPafBarData = useMemo(
    () => buildRacGovtPafStackedBarData(racGovtPafCells, colorMaps.seriesColorByMilKey),
    [racGovtPafCells, colorMaps]
  );

  const baseGovtPafCells = useMemo(() => {
    if (govtPafDrill.level === GOVT_PAF_DRILL_RAC) return [];
    return scaleKpiCellsByTenure(
      buildKpiBaseGovtPafCells({
        shareRows: shareRows || [],
        contractRows: contractRows || [],
        agreementContractRows: racFilteredAgreementRows,
        useAsOfContracts,
        contractMetaById: agreementOptions.contractMetaById,
        baseOptions: baseOptions || [],
        allBases: allBases || [],
        racCmdId: govtPafDrill.racId,
        preferSpGovtPafShare,
      }),
      tenure
    );
  }, [
    govtPafDrill.level,
    govtPafDrill.racId,
    shareRows,
    contractRows,
    racFilteredAgreementRows,
    useAsOfContracts,
    agreementOptions.contractMetaById,
    baseOptions,
    allBases,
    tenure,
  ]);

  const categoryGovtPafCells = useMemo(() => {
    if (govtPafDrill.level !== GOVT_PAF_DRILL_CATEGORY) return [];
    return scaleKpiCellsByTenure(
      buildKpiBaseCategoryGovtPafCells({
        shareRows: shareRows || [],
        propertyRows: propertyRows || [],
        contractRows: contractRows || [],
        agreementContractRows: racFilteredAgreementRows,
        useAsOfContracts,
        contractMetaById: agreementOptions.contractMetaById,
        racCmdId: govtPafDrill.racId,
        baseId: govtPafDrill.baseId,
        preferSpGovtPafShare,
      }),
      tenure
    );
  }, [
    govtPafDrill.level,
    govtPafDrill.racId,
    govtPafDrill.baseId,
    shareRows,
    propertyRows,
    contractRows,
    racFilteredAgreementRows,
    useAsOfContracts,
    agreementOptions.contractMetaById,
    tenure,
  ]);

  const activeGovtPafBarData = useMemo(() => {
    if (govtPafDrill.level === GOVT_PAF_DRILL_BASE) {
      return buildRacGovtPafStackedBarData(baseGovtPafCells, colorMaps.seriesColorByMilKey);
    }
    if (govtPafDrill.level === GOVT_PAF_DRILL_CATEGORY) {
      return buildRacGovtPafStackedBarData(categoryGovtPafCells, colorMaps.seriesColorByMilKey);
    }
    return categoryRacGovtPafBarData;
  }, [
    govtPafDrill.level,
    categoryRacGovtPafBarData,
    baseGovtPafCells,
    categoryGovtPafCells,
    colorMaps,
  ]);

  const govtPafBarTitle = useMemo(() => {
    const baseTitle = "Govt & PAF share";
    if (govtPafDrill.level === GOVT_PAF_DRILL_CATEGORY) {
      return `${baseTitle} by land category (M) — ${govtPafDrill.baseLabel || "Base"}`;
    }
    if (govtPafDrill.level === GOVT_PAF_DRILL_BASE) {
      return `${baseTitle} by base (M) — ${govtPafDrill.racLabel || "RAC"}`;
    }
    return `${baseTitle} by RAC`;
  }, [govtPafDrill]);

  // RAC-level totals only — never scoped to base/category bar drill-down.
  const govtPafDonutChartRef = useRef(null);
  const govtPafDonutChart = useMemo(() => {
    const shares = buildGovtPafSharesFromRacBarCells(racGovtPafCells);
    const govt = kpiNumeric(shares.find((share) => share.id === "govt")?.value);
    const paf = kpiNumeric(shares.find((share) => share.id === "paf")?.value);
    const fingerprint = `${govt}|${paf}|${darkMode}|${colorMaps.donutColorByShareId?.govt}|${colorMaps.donutColorByShareId?.paf}`;

    if (govtPafDonutChartRef.current?.fingerprint === fingerprint) {
      return govtPafDonutChartRef.current.chart;
    }

    const chart = buildShareDonutChart(shares, ["govt", "paf"], darkMode, {
      outerLegendRing: true,
      colorByShareId: colorMaps.donutColorByShareId,
      shareFallbackColor: colorMaps.shareFallbackColor,
    });
    govtPafDonutChartRef.current = { fingerprint, chart };
    return chart;
  }, [racGovtPafCells, darkMode, colorMaps]);

  const tenureScaledAssetCards = useMemo(
    () => applyTenureToAssetCards(assetCards, tenure),
    [assetCards, tenure]
  );

  const cards = (tenureScaledAssetCards || []).filter(
    (c) => c.chartInclude !== false && c.key !== "total"
  );

  const groupedBarData = useMemo(
    () =>
      buildGroupedBarData(cards, CATEGORY_SERIES, { colorByMilKey: colorMaps.seriesColorByMilKey }),
    [cards, colorMaps]
  );
  const ahqRacBaseBarData = useMemo(
    () =>
      buildGroupedBarData(cards, AHQ_RAC_BASE_SERIES, {
        colorByMilKey: colorMaps.ahqRacBase,
      }),
    [cards, colorMaps]
  );

  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)";

  const ahqRacBaseDonutChart = useMemo(
    () =>
      buildShareDonutChart(
        buildAhqRacBaseSharesFromCategoryBarCards(cards),
        ["ahq", "rac", "base"],
        darkMode,
        {
          outerLegendRing: true,
          colorByShareId: colorMaps.ahqRacBase,
          shareFallbackColor: colorMaps.shareFallbackColor,
        }
      ),
    [cards, darkMode, colorMaps]
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
        ticks: {
          color: textColor,
          callback: (value) => formatKpiBarAxisTick(value),
        },
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

  const formatKpiCrosshairBarValueLabel = useCallback(
    (value) => formatKpiCrosshairBarValue(value),
    []
  );

  const financialShareBarOptions = useMemo(
    () =>
      applyKpiCrosshairBarChartEnhancements(
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
          formatValue: formatKpiCrosshairBarValueLabel,
          tooltipCallbacks: groupedBarOptions.plugins.tooltip.callbacks,
          fontSize: 12,
          labelPlacement: "inside",
        }
      ),
    [groupedBarOptions, darkMode, formatKpiCrosshairBarValueLabel]
  );

  const zoomedFinancialShareBarOptions = useMemo(
    () =>
      applyKpiCrosshairBarChartEnhancements(
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
          formatValue: formatKpiCrosshairBarValueLabel,
          tooltipCallbacks: groupedBarOptions.plugins.tooltip.callbacks,
          fontSize: 14,
          labelPlacement: "inside",
        }
      ),
    [groupedBarOptions, darkMode, formatKpiCrosshairBarValueLabel]
  );

  const ahqRacBaseBarOptions = useMemo(
    () =>
      applyKpiCrosshairBarChartEnhancements(
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
          formatValue: formatKpiCrosshairBarValueLabel,
          tooltipCallbacks: groupedBarOptions.plugins.tooltip.callbacks,
          fontSize: 13,
          labelPlacement: "inside",
        }
      ),
    [groupedBarOptions, darkMode, formatKpiCrosshairBarValueLabel]
  );

  const zoomedAhqRacBaseBarOptions = useMemo(
    () =>
      applyKpiCrosshairBarChartEnhancements(
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
          formatValue: formatKpiCrosshairBarValueLabel,
          tooltipCallbacks: groupedBarOptions.plugins.tooltip.callbacks,
          fontSize: 15,
          labelPlacement: "inside",
        }
      ),
    [groupedBarOptions, darkMode, formatKpiCrosshairBarValueLabel]
  );

  const govtPafBarOptions = useMemo(
    () =>
      applyKpiCrosshairBarChartEnhancements(
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
          formatValue: formatKpiCrosshairBarValueLabel,
          tooltipCallbacks: stackedBarOptions.plugins.tooltip.callbacks,
          fontSize: 13,
          labelPlacement: "inside",
        }
      ),
    [stackedBarOptions, darkMode, formatKpiCrosshairBarValueLabel]
  );

  const handleGovtPafBarClick = useCallback(
    (_event, elements) => {
      if (!elements?.length || loading) return;

      const index = elements[0].index;
      if (govtPafDrill.level === GOVT_PAF_DRILL_RAC) {
        const cell = racGovtPafCells[index];
        if (!cell?.key || cell.key === "all") return;
        setGovtPafDrill({
          level: GOVT_PAF_DRILL_BASE,
          racId: cell.key,
          racLabel: cell.chartLabel,
        });
        return;
      }

      if (govtPafDrill.level === GOVT_PAF_DRILL_BASE) {
        const cell = baseGovtPafCells[index];
        if (!cell?.key || cell.key === "all" || cell.key === KPI_GOVT_PAF_UNASSIGNED_BASE_KEY) {
          return;
        }
        setGovtPafDrill({
          level: GOVT_PAF_DRILL_CATEGORY,
          racId: govtPafDrill.racId,
          racLabel: govtPafDrill.racLabel,
          baseId: cell.key,
          baseLabel: cell.chartLabel,
        });
      }
    },
    [loading, govtPafDrill, racGovtPafCells, baseGovtPafCells]
  );

  const govtPafBarOptionsWithDrill = useMemo(
    () => ({
      ...govtPafBarOptions,
      onClick: handleGovtPafBarClick,
      onHover: (event, elements) => {
        const target = event.native?.target;
        if (!target) return;
        const drillable = govtPafDrill.level !== GOVT_PAF_DRILL_CATEGORY && elements?.length > 0;
        target.style.cursor = drillable ? "pointer" : "default";
      },
    }),
    [govtPafBarOptions, handleGovtPafBarClick, govtPafDrill.level]
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
            legend: { display: false },
            ...(useLegendNamesOnly
              ? {
                  kpiZoomPermanentLabels: { enabled: false },
                  kpiOuterDonutLegendRing: {
                    ...donut.options.plugins?.kpiOuterDonutLegendRing,
                    enabled: true,
                    showSliceLabels: true,
                    clipSliceLabels:
                      donut.options.plugins?.kpiOuterDonutLegendRing?.clipSliceLabels ?? false,
                    fontSize: (donut.options.plugins?.kpiOuterDonutLegendRing?.fontSize ?? 11) + 2,
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
        title: "Share Distribution (M)",
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
        title: govtPafBarTitle,
        type: "bar",
        data: activeGovtPafBarData,
        options: govtPafBarOptionsWithDrill,
      },
      [ZOOM_CHART.assetsGovtPafDonut]: {
        title: "Govt & PAF share distribution",
        type: "donut",
        data: govtPafDonutChart.data,
        options: makeZoomedDonutOptions(govtPafDonutChart),
      },
      [ZOOM_CHART.govtPafBar]: {
        title: govtPafBarTitle,
        type: "bar",
        data: activeGovtPafBarData,
        options: govtPafBarOptionsWithDrill,
      },
      [ZOOM_CHART.govtPafDonut]: {
        title: "Govt & PAF share distribution",
        type: "donut",
        data: govtPafDonutChart.data,
        options: makeZoomedDonutOptions(govtPafDonutChart),
      },
      [ZOOM_CHART.ahqRacBaseBar]: {
        title: "AHQ, RAC & Base share by category",
        type: "bar",
        data: ahqRacBaseBarData,
        options: zoomedAhqRacBaseBarOptions,
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
    activeGovtPafBarData,
    govtPafBarTitle,
    govtPafBarOptionsWithDrill,
    govtPafDonutChart,
    ahqRacBaseBarData,
    ahqRacBaseDonutChart,
    zoomedAhqRacBaseBarOptions,
    zoomedFinancialShareBarOptions,
    makeZoomedDonutOptions,
  ]);

  const renderShareRacFilter = (filterIdSuffix) => (
    <FormControl size="small" sx={{ minWidth: 120 }}>
      <InputLabel id={`kpi-share-rac-label-${filterIdSuffix}`}>RAC</InputLabel>
      <SearchableSelect
        labelId={`kpi-share-rac-label-${filterIdSuffix}`}
        label="RAC"
        value={donutRacFilter}
        onChange={(e) => setDonutRacFilter(e.target.value)}
        renderValue={(val) => {
          if (!val || val === "all") return "All";
          const match = donutRacSelectOptions.find(
            (option) => String(option.id ?? option.Id ?? "") === String(val)
          );
          return getRacOptionLabel(match) || val;
        }}
      >
        <MenuItem value="all">All</MenuItem>
        {donutRacSelectOptions.map((option) => {
          const id = String(option.id ?? option.Id ?? "");
          return (
            <MenuItem key={id} value={id}>
              {getRacOptionLabel(option) || id}
            </MenuItem>
          );
        })}
      </SearchableSelect>
    </FormControl>
  );

  const renderBarCard = (
    title,
    barData,
    zoomKey,
    barOptions = groupedBarOptions,
    { showZoomHint = true } = {}
  ) => (
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
          showZoomHint={showZoomHint}
          onZoom={() => setZoomChart(zoomKey)}
        >
          <Bar data={barData} options={barOptions} />
        </ChartZoomSurface>
      </MDBox>
    </Card>
  );

  const handleGovtPafDrillNavigate = useCallback(
    (targetLevel) => {
      if (targetLevel === GOVT_PAF_DRILL_RAC) {
        setGovtPafDrill(GOVT_PAF_DRILL_INITIAL);
        return;
      }
      if (targetLevel === GOVT_PAF_DRILL_BASE && govtPafDrill.racId) {
        setGovtPafDrill({
          level: GOVT_PAF_DRILL_BASE,
          racId: govtPafDrill.racId,
          racLabel: govtPafDrill.racLabel,
        });
      }
    },
    [govtPafDrill.racId, govtPafDrill.racLabel]
  );

  const renderGovtPafDrillNav = ({ zoomed = false } = {}) => (
    <MDBox minWidth={0}>
      {govtPafDrill.level !== GOVT_PAF_DRILL_RAC ? (
        <Breadcrumbs
          aria-label="Govt and PAF chart drill-down"
          sx={{
            mt: zoomed ? 0 : 0.5,
            "& .MuiBreadcrumbs-li": { fontSize: zoomed ? "0.875rem" : "0.75rem" },
          }}
        >
          <Link
            component="button"
            type="button"
            underline="hover"
            color="info"
            sx={{ border: 0, background: "none", cursor: "pointer", p: 0, font: "inherit" }}
            onClick={() => handleGovtPafDrillNavigate(GOVT_PAF_DRILL_RAC)}
          >
            All RACs
          </Link>
          {govtPafDrill.racLabel ? (
            govtPafDrill.level === GOVT_PAF_DRILL_CATEGORY ? (
              <Link
                component="button"
                type="button"
                underline="hover"
                color="info"
                sx={{ border: 0, background: "none", cursor: "pointer", p: 0, font: "inherit" }}
                onClick={() => handleGovtPafDrillNavigate(GOVT_PAF_DRILL_BASE)}
              >
                {govtPafDrill.racLabel}
              </Link>
            ) : (
              <MDTypography variant={zoomed ? "body2" : "caption"} color="text">
                {govtPafDrill.racLabel}
              </MDTypography>
            )
          ) : null}
          {govtPafDrill.level === GOVT_PAF_DRILL_CATEGORY && govtPafDrill.baseLabel ? (
            <MDTypography variant={zoomed ? "body2" : "caption"} color="text">
              {govtPafDrill.baseLabel}
            </MDTypography>
          ) : null}
        </Breadcrumbs>
      ) : (
        <MDTypography
          variant={zoomed ? "body2" : "caption"}
          color="text"
          sx={{ display: "block", mt: zoomed ? 0 : 0.25 }}
        >
          Click a bar to drill down by base
        </MDTypography>
      )}
      {govtPafDrill.level === GOVT_PAF_DRILL_BASE ? (
        <MDTypography
          variant={zoomed ? "body2" : "caption"}
          color="text"
          sx={{ display: "block", mt: 0.25 }}
        >
          Click a bar to drill down by land category
        </MDTypography>
      ) : null}
    </MDBox>
  );

  const renderGovtPafDrillBarCard = (zoomKey) => (
    <Card sx={{ ...cardSx, p: 2, minHeight: 280 }}>
      <MDBox
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={0.5}
        mb={0.5}
      >
        <MDBox minWidth={0}>
          <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
            {govtPafBarTitle}
          </MDTypography>
          {renderGovtPafDrillNav()}
        </MDBox>
        <MDBox display="flex" alignItems="center" gap={0.5} flexShrink={0}>
          {zoomEnabled ? (
            <IconButton
              size="small"
              aria-label="Enlarge chart"
              onClick={() => setZoomChart(zoomKey)}
            >
              <Icon fontSize="small">zoom_in</Icon>
            </IconButton>
          ) : null}
          <ChartExportButton
            disabled={loading}
            ariaLabel={`Export ${govtPafBarTitle} to Excel`}
            onExport={() => exportGroupedBarChartDataToExcel(govtPafBarTitle, activeGovtPafBarData)}
          />
        </MDBox>
      </MDBox>
      <MDBox height={220} opacity={loading ? 0.4 : 1}>
        <Bar data={activeGovtPafBarData} options={govtPafBarOptionsWithDrill} />
      </MDBox>
    </Card>
  );

  const renderDonutCard = (
    title,
    donut,
    { filterIdSuffix = "default", zoomKey = ZOOM_CHART.assetsDonut, showRacFilter = true } = {}
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
          {showRacFilter ? renderShareRacFilter(filterIdSuffix) : null}
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
              {renderGovtPafDrillBarCard(ZOOM_CHART.govtPafBar)}
            </Grid>
            <Grid item xs={12} md={6}>
              <GovtPafRacLevelDonutCard
                donutChart={govtPafDonutChart}
                loading={loading}
                cardSx={cardSx}
                darkMode={darkMode}
                zoomEnabled={zoomEnabled}
                zoomKey={ZOOM_CHART.govtPafDonut}
                onZoom={() => setZoomChart(ZOOM_CHART.govtPafDonut)}
              />
            </Grid>
          </Grid>
          <Grid container spacing={2} sx={{ mt: 0 }}>
            <Grid item xs={12} md={6}>
              {renderBarCard(
                "AHQ, RAC & Base share by category",
                ahqRacBaseBarData,
                ZOOM_CHART.ahqRacBaseBar,
                ahqRacBaseBarOptions,
                { showZoomHint: false }
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
          {showShareDistributionCharts ? (
            <Grid container spacing={2}>
              <Grid item xs={12} lg={7}>
                {renderBarCard(
                  "Share Distribution (M)",
                  categoryRacBarData,
                  ZOOM_CHART.assetsBar,
                  financialShareBarOptions,
                  { showZoomHint: false }
                )}
              </Grid>
              <Grid item xs={12} lg={5}>
                {renderDonutCard("Share Distribution", categoryRacDonutChart, {
                  filterIdSuffix: "assets",
                  zoomKey: ZOOM_CHART.assetsDonut,
                })}
              </Grid>
            </Grid>
          ) : null}
          {showGovtPafCharts ? (
            <Grid container spacing={2} sx={{ mt: showShareDistributionCharts ? 0 : undefined }}>
              <Grid item xs={12} lg={7}>
                {renderGovtPafDrillBarCard(ZOOM_CHART.assetsGovtPafBar)}
              </Grid>
              <Grid item xs={12} lg={5}>
                <GovtPafRacLevelDonutCard
                  donutChart={govtPafDonutChart}
                  loading={loading}
                  cardSx={cardSx}
                  darkMode={darkMode}
                  zoomEnabled={zoomEnabled}
                  zoomKey={ZOOM_CHART.assetsGovtPafDonut}
                  onZoom={() => setZoomChart(ZOOM_CHART.assetsGovtPafDonut)}
                />
              </Grid>
            </Grid>
          ) : null}
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
            alignItems: "flex-start",
            justifyContent: "space-between",
            pr: 1,
            flexShrink: 0,
            gap: 1,
          }}
        >
          <MDBox minWidth={0} flex={1}>
            <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
              {zoomDialogConfig?.title || ""}
            </MDTypography>
            {zoomChart && GOVT_PAF_DRILL_ZOOM_CHARTS.has(zoomChart) ? (
              <MDBox mt={0.5}>{renderGovtPafDrillNav({ zoomed: true })}</MDBox>
            ) : null}
          </MDBox>
          <MDBox display="flex" alignItems="center" gap={0.5} flexShrink={0}>
            {zoomChart && ZOOM_CHARTS_WITH_RAC_FILTER.has(zoomChart)
              ? renderShareRacFilter("zoom")
              : null}
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
  agreementContractRows: PropTypes.arrayOf(PropTypes.object),
  useAsOfContracts: PropTypes.bool,
  contractMetaById: PropTypes.instanceOf(Map),
  racOptions: PropTypes.arrayOf(PropTypes.object),
  racIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.number])),
  baseOptions: PropTypes.arrayOf(PropTypes.object),
  allBases: PropTypes.arrayOf(PropTypes.object),
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
  showShareDistributionCharts: PropTypes.bool,
  showGovtPafCharts: PropTypes.bool,
  tenure: PropTypes.oneOf(["Annual", "Biannual", "Quarterly", "Monthly"]),
  preferSpGovtPafShare: PropTypes.bool,
};

KpiCharts.defaultProps = {
  shareRows: [],
  contractRows: [],
  propertyRows: [],
  agreementContractRows: [],
  useAsOfContracts: false,
  contractMetaById: undefined,
  racOptions: [],
  racIds: [],
  baseOptions: [],
  allBases: [],
  assetCards: [],
  loading: false,
  chartZoomOnClick: false,
  chartLayout: "default",
  showShareDistributionCharts: true,
  showGovtPafCharts: true,
  tenure: "Annual",
  preferSpGovtPafShare: false,
};

export default KpiCharts;
