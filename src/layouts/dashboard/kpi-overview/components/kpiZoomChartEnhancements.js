import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { coerceChartDataValue, roundChartBarNumber } from "utils/chartBarDataUtils";
import { formatKpiCrosshairBarValue } from "../kpiDataUtils";
import { KPI_BAR_INSIDE_LABEL_COLOR, KPI_BAR_INSIDE_LABEL_SHADOW } from "../kpiBarChartColors";

export { coerceChartDataValue, nullIfZeroChartBarValue } from "utils/chartBarDataUtils";

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

const LABEL_FONT_FAMILY = "Inter, Roboto, Helvetica, Arial, sans-serif";

function isPointInsideChartArea(chart, x, y) {
  const { chartArea } = chart;
  if (!chartArea) return false;
  return x >= chartArea.left && x <= chartArea.right && y >= chartArea.top && y <= chartArea.bottom;
}

function fillLabelBackground(ctx, x, y, width, height, radius = 4) {
  if (typeof ctx.roundRect === "function") {
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, radius);
    ctx.fill();
    return;
  }
  ctx.fillRect(x, y, width, height);
}

export const kpiBarCrosshairPlugin = {
  id: "kpiBarCrosshair",
  afterEvent(chart, args) {
    const opts = chart.options.plugins?.kpiBarCrosshair;
    if (!opts?.enabled) return;

    const { event } = args;
    if (event.type === "mousemove") {
      if (event.x == null || event.y == null) {
        chart.$kpiCrosshair = null;
        args.changed = true;
        return;
      }
      chart.$kpiCrosshair = isPointInsideChartArea(chart, event.x, event.y)
        ? { x: event.x, y: event.y }
        : null;
      args.changed = true;
      return;
    }

    if (event.type === "mouseout") {
      chart.$kpiCrosshair = null;
      args.changed = true;
    }
  },
  afterDraw(chart) {
    const opts = chart.options.plugins?.kpiBarCrosshair;
    const point = chart.$kpiCrosshair;
    if (!opts?.enabled || !point) return;

    const { ctx, chartArea, scales } = chart;
    const yScale = scales?.y;
    if (!yScale) return;

    const { x, y } = point;
    const formatValue =
      typeof opts.formatValue === "function"
        ? opts.formatValue
        : (value) => formatKpiCrosshairBarValue(value);
    const rawY = yScale.getValueForPixel(y);
    const yNumeric = roundChartBarNumber(coerceChartDataValue(rawY) ?? rawY, 2);
    const label = String(formatValue(yNumeric) ?? "").trim();
    if (!label) return;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = opts.lineColor || "#000000";
    ctx.lineWidth = 1;

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, chartArea.bottom);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(chartArea.left, y);
    ctx.stroke();

    ctx.setLineDash([]);
    const fontSize = opts.fontSize || 11;
    const fontWeight = opts.fontWeight || 600;
    ctx.font = `${fontWeight} ${fontSize}px ${LABEL_FONT_FAMILY}`;
    const paddingX = 6;
    const paddingY = 4;
    const textWidth = ctx.measureText(label).width;
    const boxWidth = textWidth + paddingX * 2;
    const boxHeight = fontSize + paddingY * 2;
    let labelX = x + 10;
    let labelY = y - boxHeight - 8;
    if (labelX + boxWidth > chartArea.right) {
      labelX = x - boxWidth - 10;
    }
    if (labelY < chartArea.top) {
      labelY = y + 10;
    }
    if (labelX < chartArea.left) {
      labelX = chartArea.left + 4;
    }

    ctx.fillStyle = opts.labelBackgroundColor || "rgba(255, 255, 255, 0.94)";
    ctx.strokeStyle = opts.lineColor || "#000000";
    ctx.lineWidth = 1;
    fillLabelBackground(ctx, labelX, labelY, boxWidth, boxHeight, 4);
    ctx.strokeRect(labelX, labelY, boxWidth, boxHeight);

    ctx.fillStyle = opts.labelColor || "#111827";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, labelX + paddingX, labelY + boxHeight / 2);
    ctx.restore();
  },
};

function wrapTooltipCallbacks(callbacks) {
  if (!callbacks) return callbacks;
  const next = { ...callbacks };
  if (typeof callbacks.label === "function") {
    next.label = (item) => {
      const numeric = coerceChartDataValue(item.raw);
      if (numeric == null || numeric === 0) return null;
      return callbacks.label({
        ...item,
        raw: numeric,
      });
    };
  }
  return next;
}

function getInsideBarLabelCandidates(labelText) {
  const normalized = String(labelText ?? "").trim();
  if (!normalized) return [];

  const candidates = [normalized];
  const compactUnitLabel = normalized.replace(/^(-?[\d,]+(?:\.\d+)?)\s+([MB])$/i, "$1$2");
  if (compactUnitLabel !== normalized) candidates.push(compactUnitLabel);

  return candidates;
}

function ensureBarLabelHasMoneyUnit(labelText) {
  const text = String(labelText ?? "").trim();
  if (!text) return text;
  if (/[MB]\s*$/i.test(text) || /\d[MB]$/i.test(text)) return text;
  return `${text} M`;
}

export const kpiZoomPermanentLabelsPlugin = {
  id: "kpiZoomPermanentLabels",
  afterDatasetsDraw(chart) {
    const opts = chart.options.plugins?.kpiZoomPermanentLabels;
    if (!opts?.enabled) return;

    const { ctx } = chart;
    const formatValue =
      typeof opts.formatValue === "function" ? opts.formatValue : (value) => String(value ?? "");
    const color = opts.color || "#1f2937";
    const fontSize = opts.fontSize || 13;
    const fontWeight =
      typeof opts.fontWeight === "number" || typeof opts.fontWeight === "string"
        ? opts.fontWeight
        : 600;
    const chartType = chart.config?.type || chart.config?._config?.type;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;
      const elementType = meta.type || chartType;

      meta.data.forEach((element, dataIndex) => {
        const raw = dataset.data[dataIndex];
        const numeric = coerceChartDataValue(raw);
        if (numeric == null || numeric === 0) return;

        const text = formatValue(numeric, {
          chart,
          dataset,
          datasetIndex,
          dataIndex,
          element,
          chartType: elementType,
        });
        const labelText = String(text ?? "").trim();
        if (!labelText) return;

        ctx.save();
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";

        if (
          elementType === "doughnut" ||
          elementType === "pie" ||
          chartType === "doughnut" ||
          chartType === "pie"
        ) {
          ctx.font = `${fontWeight} ${fontSize}px ${LABEL_FONT_FAMILY}`;
          ctx.fillStyle = color;
          ctx.shadowColor = opts.textShadowColor || "rgba(255, 255, 255, 0.9)";
          ctx.shadowBlur = 4;
          const props = element.getProps(
            ["startAngle", "endAngle", "innerRadius", "outerRadius", "x", "y"],
            true
          );
          const angle = (props.startAngle + props.endAngle) / 2;
          const radius = (props.innerRadius + props.outerRadius) / 2;
          const x = props.x + Math.cos(angle) * radius;
          const y = props.y + Math.sin(angle) * radius;
          const lines = labelText.split("\n");
          const lineHeight = fontSize + 3;
          const startY = y - ((lines.length - 1) * lineHeight) / 2;
          lines.forEach((line, lineIndex) => {
            ctx.fillText(line, x, startY + lineIndex * lineHeight);
          });
        } else if (elementType === "bar" && opts.labelPlacement === "inside") {
          const props = element.getProps(["x", "y", "base", "width"], true);
          const segmentHeight = Math.abs(props.base - props.y);
          const barWidth = props.width ?? 0;
          let drawFontSize = fontSize;
          let drawLabelText = labelText;

          ctx.font = `${fontWeight} ${drawFontSize}px ${LABEL_FONT_FAMILY}`;
          let textWidth = ctx.measureText(drawLabelText).width;
          while (
            drawFontSize > 6 &&
            (segmentHeight < drawFontSize * 1.15 || barWidth < textWidth + 4)
          ) {
            drawFontSize -= 1;
            ctx.font = `${fontWeight} ${drawFontSize}px ${LABEL_FONT_FAMILY}`;
            const fittingLabel = getInsideBarLabelCandidates(labelText).find(
              (candidate) => barWidth >= ctx.measureText(candidate).width + 4
            );
            drawLabelText = fittingLabel || labelText;
            textWidth = ctx.measureText(drawLabelText).width;
          }

          if (segmentHeight < drawFontSize * 0.8 || barWidth < textWidth + 2) {
            ctx.restore();
            return;
          }

          drawLabelText = ensureBarLabelHasMoneyUnit(drawLabelText);
          ctx.font = `${fontWeight} ${drawFontSize}px ${LABEL_FONT_FAMILY}`;
          textWidth = ctx.measureText(drawLabelText).width;

          const labelY = (props.y + props.base) / 2;
          ctx.fillStyle = opts.insideLabelColor || KPI_BAR_INSIDE_LABEL_COLOR;
          ctx.shadowColor = opts.insideTextShadowColor || KPI_BAR_INSIDE_LABEL_SHADOW;
          ctx.shadowBlur = 3;
          ctx.fillText(drawLabelText, props.x, labelY);
        } else if (elementType === "bar") {
          ctx.font = `${fontWeight} ${fontSize}px ${LABEL_FONT_FAMILY}`;
          ctx.fillStyle = color;
          ctx.shadowColor = opts.textShadowColor || "rgba(255, 255, 255, 0.9)";
          ctx.shadowBlur = 4;
          const props = element.getProps(["x", "y", "base"], true);
          const labelY = Math.min(props.y, props.base) - 6;
          ctx.textBaseline = "bottom";
          ctx.fillText(labelText, props.x, labelY);
        }

        ctx.restore();
      });
    });
  },
};

let pluginRegistered = false;

export function ensureKpiZoomChartPluginsRegistered() {
  if (pluginRegistered) return;
  ChartJS.register(kpiZoomPermanentLabelsPlugin, kpiBarCrosshairPlugin);
  pluginRegistered = true;
}

export function buildKpiZoomTooltipOptions(darkMode) {
  const titleColor = darkMode ? "#f9fafb" : "#ffffff";
  const bodyColor = darkMode ? "#f3f4f6" : "#ffffff";

  return {
    enabled: true,
    mode: "index",
    intersect: false,
    position: "nearest",
    backgroundColor: darkMode ? "rgba(17, 24, 39, 0.96)" : "rgba(15, 23, 42, 0.94)",
    titleColor,
    bodyColor,
    footerColor: bodyColor,
    borderColor: darkMode ? "rgba(255, 255, 255, 0.14)" : "rgba(255, 255, 255, 0.2)",
    borderWidth: 1,
    titleFont: { size: 15, weight: "700", family: LABEL_FONT_FAMILY },
    bodyFont: { size: 14, weight: "600", family: LABEL_FONT_FAMILY },
    footerFont: { size: 13, weight: "600", family: LABEL_FONT_FAMILY },
    padding: 14,
    cornerRadius: 8,
    displayColors: true,
    boxWidth: 14,
    boxHeight: 14,
    boxPadding: 6,
    caretSize: 8,
    caretPadding: 10,
    bodySpacing: 6,
    titleSpacing: 8,
  };
}

export function buildKpiZoomPermanentLabelOptions({
  darkMode,
  formatValue,
  fontSize = 13,
  labelPlacement = "above",
  insideLabelColor = KPI_BAR_INSIDE_LABEL_COLOR,
  insideTextShadowColor = KPI_BAR_INSIDE_LABEL_SHADOW,
}) {
  return {
    enabled: true,
    formatValue,
    color: darkMode ? "#f9fafb" : "#111827",
    textShadowColor: darkMode ? "rgba(0, 0, 0, 0.75)" : "rgba(255, 255, 255, 0.95)",
    fontSize,
    fontWeight: 700,
    labelPlacement,
    insideLabelColor,
    insideTextShadowColor,
  };
}

export function buildKpiDonutLegendLabelOptions({
  darkMode = false,
  fontSize = 13,
  fontWeight = "bold",
  padding = 10,
  boxWidth = 12,
} = {}) {
  const textColor = darkMode ? "#e8e8e8" : "#344767";

  return {
    boxWidth,
    padding,
    usePointStyle: true,
    pointStyle: "circle",
    font: {
      size: fontSize,
      weight: fontWeight,
      family: LABEL_FONT_FAMILY,
    },
    color: textColor,
    generateLabels(chart) {
      const labels = chart?.data?.labels || [];
      const dataset = chart?.data?.datasets?.[0] || {};
      const colors = dataset?.backgroundColor;

      return labels.map((label, index) => {
        let sliceColor = textColor;
        if (Array.isArray(colors)) {
          sliceColor = colors[index] || textColor;
        } else if (typeof colors === "string") {
          sliceColor = colors;
        }
        return {
          text: String(label ?? ""),
          fillStyle: sliceColor,
          strokeStyle: sliceColor,
          lineWidth: 1,
          hidden: !chart.getDataVisibility(index),
          index,
          pointStyle: "circle",
          fontColor: textColor,
        };
      });
    },
  };
}

export function buildKpiBarCrosshairOptions({ darkMode, formatValue, fontSize = 11 } = {}) {
  return {
    enabled: true,
    lineColor: "#000000",
    labelColor: darkMode ? "#f9fafb" : "#111827",
    labelBackgroundColor: darkMode ? "rgba(17, 24, 39, 0.92)" : "rgba(255, 255, 255, 0.94)",
    fontSize,
    fontWeight: 600,
    formatValue: (value) => {
      const numeric = roundChartBarNumber(coerceChartDataValue(value) ?? value, 2);
      const formatted = formatValue?.(numeric);
      const label =
        formatted != null && String(formatted).trim()
          ? String(formatted).trim()
          : formatKpiCrosshairBarValue(numeric);
      return ensureBarLabelHasMoneyUnit(label);
    },
  };
}

export function applyKpiZoomBarChartEnhancements(
  baseOptions,
  {
    darkMode,
    formatValue,
    tooltipCallbacks,
    fontSize = 13,
    labelPlacement = "above",
    crosshair = false,
    insideLabelColor,
    insideTextShadowColor,
  } = {}
) {
  ensureKpiZoomChartPluginsRegistered();

  return {
    ...baseOptions,
    animation: { ...(baseOptions.animation || {}), duration: 0 },
    plugins: {
      ...baseOptions.plugins,
      tooltip: crosshair
        ? {
            ...(baseOptions.plugins?.tooltip || {}),
            enabled: false,
          }
        : {
            ...(baseOptions.plugins?.tooltip || {}),
            ...buildKpiZoomTooltipOptions(darkMode),
            ...(tooltipCallbacks ? { callbacks: wrapTooltipCallbacks(tooltipCallbacks) } : {}),
          },
      kpiZoomPermanentLabels: buildKpiZoomPermanentLabelOptions({
        darkMode,
        formatValue,
        fontSize,
        labelPlacement,
        insideLabelColor,
        insideTextShadowColor,
      }),
      ...(crosshair
        ? {
            kpiBarCrosshair: buildKpiBarCrosshairOptions({
              darkMode,
              formatValue,
              fontSize: Math.max(fontSize - 1, 10),
            }),
          }
        : {}),
    },
  };
}

export function applyKpiCrosshairBarChartEnhancements(
  baseOptions,
  {
    darkMode,
    formatValue,
    tooltipCallbacks,
    fontSize = 10,
    labelPlacement = "inside",
    insideLabelColor,
    insideTextShadowColor,
  } = {}
) {
  const formatBarValue = formatValue || formatKpiCrosshairBarValue;

  return applyKpiZoomBarChartEnhancements(baseOptions, {
    darkMode,
    formatValue: formatBarValue,
    tooltipCallbacks,
    fontSize,
    labelPlacement,
    crosshair: true,
    insideLabelColor,
    insideTextShadowColor,
  });
}

export function applyKpiZoomDonutChartEnhancements(
  baseOptions,
  { darkMode, formatValue, tooltipCallbacks, fontSize = 12 } = {}
) {
  ensureKpiZoomChartPluginsRegistered();
  const permanentLabelsDisabled = baseOptions?.plugins?.kpiZoomPermanentLabels?.enabled === false;

  return {
    ...baseOptions,
    animation: { ...(baseOptions.animation || {}), duration: 0 },
    interaction: { ...(baseOptions.interaction || {}), mode: "nearest", intersect: true },
    hover: { ...(baseOptions.hover || {}), mode: "nearest", intersect: true },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...(baseOptions.plugins?.tooltip || {}),
        ...buildKpiZoomTooltipOptions(darkMode),
        mode: "nearest",
        intersect: true,
        ...(tooltipCallbacks ? { callbacks: wrapTooltipCallbacks(tooltipCallbacks) } : {}),
      },
      kpiZoomPermanentLabels: permanentLabelsDisabled
        ? { enabled: false }
        : buildKpiZoomPermanentLabelOptions({
            darkMode,
            formatValue,
            fontSize,
          }),
    },
  };
}
