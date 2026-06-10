import {
  Chart as ChartJS,
  BarElement,
  ArcElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  Legend,
} from "chart.js";
import { coerceChartDataValue } from "utils/chartBarDataUtils";

export { coerceChartDataValue, nullIfZeroChartBarValue } from "utils/chartBarDataUtils";

ChartJS.register(BarElement, ArcElement, CategoryScale, LinearScale, Tooltip, Legend);

const LABEL_FONT_FAMILY = "Inter, Roboto, Helvetica, Arial, sans-serif";

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
    const chartType = chart.config?.type;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

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
          chartType,
        });
        const labelText = String(text ?? "").trim();
        if (!labelText) return;

        ctx.save();
        ctx.font = `${fontWeight} ${fontSize}px ${LABEL_FONT_FAMILY}`;
        ctx.fillStyle = color;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = opts.textShadowColor || "rgba(255, 255, 255, 0.9)";
        ctx.shadowBlur = 4;

        if (chartType === "doughnut" || chartType === "pie") {
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
        } else {
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
  ChartJS.register(kpiZoomPermanentLabelsPlugin);
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

export function buildKpiZoomPermanentLabelOptions({ darkMode, formatValue, fontSize = 13 }) {
  return {
    enabled: true,
    formatValue,
    color: darkMode ? "#f9fafb" : "#111827",
    textShadowColor: darkMode ? "rgba(0, 0, 0, 0.75)" : "rgba(255, 255, 255, 0.95)",
    fontSize,
    fontWeight: 700,
  };
}

export function applyKpiZoomBarChartEnhancements(
  baseOptions,
  { darkMode, formatValue, tooltipCallbacks, fontSize = 13 } = {}
) {
  ensureKpiZoomChartPluginsRegistered();

  return {
    ...baseOptions,
    animation: { ...(baseOptions.animation || {}), duration: 0 },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...(baseOptions.plugins?.tooltip || {}),
        ...buildKpiZoomTooltipOptions(darkMode),
        ...(tooltipCallbacks ? { callbacks: wrapTooltipCallbacks(tooltipCallbacks) } : {}),
      },
      kpiZoomPermanentLabels: buildKpiZoomPermanentLabelOptions({
        darkMode,
        formatValue,
        fontSize,
      }),
    },
  };
}

export function applyKpiZoomDonutChartEnhancements(
  baseOptions,
  { darkMode, formatValue, tooltipCallbacks, fontSize = 12 } = {}
) {
  ensureKpiZoomChartPluginsRegistered();

  return {
    ...baseOptions,
    animation: { ...(baseOptions.animation || {}), duration: 0 },
    plugins: {
      ...baseOptions.plugins,
      tooltip: {
        ...(baseOptions.plugins?.tooltip || {}),
        ...buildKpiZoomTooltipOptions(darkMode),
        ...(tooltipCallbacks ? { callbacks: wrapTooltipCallbacks(tooltipCallbacks) } : {}),
      },
      kpiZoomPermanentLabels: buildKpiZoomPermanentLabelOptions({
        darkMode,
        formatValue,
        fontSize,
      }),
    },
  };
}
