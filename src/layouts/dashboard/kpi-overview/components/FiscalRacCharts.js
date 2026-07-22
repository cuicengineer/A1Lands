import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Chart } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  BarController,
  LineController,
} from "chart.js";
import Card from "@mui/material/Card";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import Grid from "@mui/material/Grid";
import CurrencyLoading from "components/CurrencyLoading";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { useMaterialUIController } from "context";
import { ChartZoomSurface, getEnterpriseCardSx } from "./KpiCharts";
import ChartExportButton from "./ChartExportButton";
import { applyKpiCrosshairBarChartEnhancements } from "./kpiZoomChartEnhancements";
import { exportGroupedBarChartDataToExcel } from "utils/kpiChartExcelExport";
import {
  coerceChartDataValue,
  nullIfZeroChartBarValue,
  withCompactGroupedBarDatasets,
  COMPACT_GROUPED_BAR_OPTIONS,
} from "utils/chartBarDataUtils";
import {
  buildKpiRacIncomeTurnoverCells,
  buildKpiRacIncomeDueCollectionsCells,
  buildKpiRacOutstandingIncomeCells,
  buildKpiNatureOfBusinessIncomeCells,
  asOfAmountToMillions,
  PROPERTY_CLASS_STICKERS,
  formatKpiBarAxisTick,
  formatKpiBarAxisTickRounded,
  formatKpiCrosshairBarValue,
  formatKpiMoneyLabel,
  scaleKpiAmountByTenure,
} from "../kpiDataUtils";
import {
  KPI_BAR_CHART_PRIMARY,
  KPI_BAR_CHART_SECONDARY,
  KPI_BAR_CHART_SERIES_COLORS,
  KPI_FISCAL_BAR_CHART_COLORS,
  KPI_BAR_INSIDE_LABEL_COLOR,
  KPI_BAR_INSIDE_LABEL_SHADOW,
} from "../kpiBarChartColors";

const natureOfBusinessBarLabelPlugin = {
  id: "natureOfBusinessBarLabel",
  afterDatasetsDraw(chart) {
    const opts = chart.options.plugins?.natureOfBusinessBarLabel;
    if (!opts?.enabled) return;

    const categoryLabels = opts.categoryLabels || [];
    const fontSize = Number(opts.fontSize ?? 12);
    const fontWeight = opts.fontWeight ?? 700;
    const axisPadding = Number(opts.axisPadding ?? 8);
    const insideColor = opts.insideColor || KPI_BAR_INSIDE_LABEL_COLOR;
    const fontFamily = "Inter, Roboto, Helvetica, Arial, sans-serif";
    const { ctx, chartArea } = chart;
    const yScale = chart.scales?.y;
    const axisLineY = yScale?.getPixelForValue?.(0) ?? chartArea?.bottom ?? null;
    if (axisLineY == null || !chartArea) return;

    const labelFloorY = axisLineY - axisPadding;

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      meta.data.forEach((bar, dataIndex) => {
        const label = String(categoryLabels[dataIndex] ?? "").trim();
        if (!label) return;

        const raw = dataset?.data?.[dataIndex];
        const n = coerceChartDataValue(raw);
        if (n == null || n === 0) return;

        const { x, y, base } = bar.getProps(["x", "y", "base"], true);
        const barTopY = Math.min(y, base);
        const barBottomY = Math.max(y, base);
        const barHeight = barBottomY - barTopY;

        let drawFontSize = fontSize;
        ctx.font = `${fontWeight} ${drawFontSize}px ${fontFamily}`;
        let textWidth = ctx.measureText(label).width;

        while (drawFontSize > 9 && barHeight > 0 && textWidth > barHeight - axisPadding * 2) {
          drawFontSize -= 1;
          ctx.font = `${fontWeight} ${drawFontSize}px ${fontFamily}`;
          textWidth = ctx.measureText(label).width;
        }

        const fitsInsideBar = barHeight >= textWidth + axisPadding * 2;
        if (!fitsInsideBar) return;

        ctx.save();
        ctx.beginPath();
        ctx.rect(
          chartArea.left,
          chartArea.top,
          chartArea.right - chartArea.left,
          labelFloorY - chartArea.top
        );
        ctx.clip();
        ctx.translate(x, labelFloorY);
        ctx.rotate(-Math.PI / 2);
        ctx.fillStyle = insideColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "bottom";
        ctx.shadowColor = KPI_BAR_INSIDE_LABEL_SHADOW;
        ctx.shadowBlur = 2;
        ctx.fillText(label, 0, 0);
        ctx.restore();
      });
    });
  },
};

const NATURE_X_AXIS_FONT = "600 12px Inter, Roboto, Helvetica, Arial, sans-serif";
const NATURE_X_AXIS_MAX_LINES = 3;
const NATURE_X_AXIS_LINE_HEIGHT = 14;
const NATURE_X_AXIS_PAD_X = 4;

function truncateTextToWidth(ctx, text, maxWidth) {
  const full = String(text || "");
  if (!full || ctx.measureText(full).width <= maxWidth) return full;
  const ellipsis = "…";
  let low = 0;
  let high = full.length;
  let best = ellipsis;
  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const candidate = `${full.slice(0, mid).trimEnd()}${ellipsis}`;
    if (ctx.measureText(candidate).width <= maxWidth) {
      best = candidate;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }
  return best;
}

function wrapAxisLabelToLines(ctx, text, maxWidth, maxLines) {
  const full = String(text || "").trim();
  if (!full) return { lines: [], truncated: false };

  const words = full.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";
  let wordIndex = 0;

  while (wordIndex < words.length && lines.length < maxLines) {
    const word = words[wordIndex];
    const next = current ? `${current} ${word}` : word;

    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
      wordIndex += 1;
      continue;
    }

    if (current) {
      if (lines.length === maxLines - 1) {
        const remaining = words.slice(wordIndex).join(" ");
        lines.push(truncateTextToWidth(ctx, `${current} ${remaining}`, maxWidth));
        current = "";
        wordIndex = words.length;
        break;
      }
      lines.push(current);
      current = "";
      continue;
    }

    // Single word wider than the slot — truncate it onto this line.
    lines.push(truncateTextToWidth(ctx, word, maxWidth));
    wordIndex += 1;
    current = "";
  }

  if (current && lines.length < maxLines) {
    lines.push(current);
  } else if (current && lines.length === maxLines) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] = truncateTextToWidth(ctx, `${last} ${current}`, maxWidth);
  }

  const fitted = lines.join(" ");
  const truncated =
    wordIndex < words.length || fitted !== full || lines.some((line) => line.includes("…"));

  return { lines: lines.length ? lines : [truncateTextToWidth(ctx, full, maxWidth)], truncated };
}

function ensureNatureXAxisTooltipEl(chart) {
  const parent = chart.canvas?.parentNode;
  if (!parent) return null;
  const parentStyle = window.getComputedStyle(parent);
  if (parentStyle.position === "static") {
    parent.style.position = "relative";
  }
  let el = parent.querySelector("[data-nature-xaxis-tooltip='true']");
  if (!el) {
    el = document.createElement("div");
    el.setAttribute("data-nature-xaxis-tooltip", "true");
    el.style.cssText = [
      "position:absolute",
      "display:none",
      "z-index:30",
      "pointer-events:none",
      "max-width:280px",
      "padding:6px 10px",
      "border-radius:6px",
      "font:600 12px Inter, Roboto, Helvetica, Arial, sans-serif",
      "line-height:1.35",
      "box-shadow:0 4px 14px rgba(0,0,0,0.18)",
      "white-space:normal",
      "word-break:break-word",
    ].join(";");
    parent.appendChild(el);
  }
  return el;
}

function hideNatureXAxisTooltip(chart) {
  const el = chart.canvas?.parentNode?.querySelector?.("[data-nature-xaxis-tooltip='true']");
  if (el) el.style.display = "none";
}

const natureOfActivityXAxisLabelPlugin = {
  id: "natureOfActivityXAxisLabel",
  afterInit(chart) {
    chart.$natureXAxisHits = [];
  },
  beforeDestroy(chart) {
    const el = chart.canvas?.parentNode?.querySelector?.("[data-nature-xaxis-tooltip='true']");
    if (el?.parentNode) el.parentNode.removeChild(el);
    chart.$natureXAxisHits = [];
  },
  afterDraw(chart) {
    const opts = chart.options.plugins?.natureOfActivityXAxisLabel;
    if (!opts?.enabled) return;

    const { ctx, chartArea } = chart;
    const xScale = chart.scales?.x;
    if (!ctx || !chartArea || !xScale) return;

    const fullLabels = (opts.categoryLabels || chart.data?.labels || []).map((l) =>
      String(l ?? "").trim()
    );
    const labelCount = fullLabels.length;
    if (!labelCount) {
      chart.$natureXAxisHits = [];
      return;
    }

    const font = opts.font || NATURE_X_AXIS_FONT;
    const color = opts.color || "#344767";
    const maxLines = Number(opts.maxLines ?? NATURE_X_AXIS_MAX_LINES);
    const lineHeight = Number(opts.lineHeight ?? NATURE_X_AXIS_LINE_HEIGHT);
    const startY = chartArea.bottom + Number(opts.paddingTop ?? 8);

    ctx.save();
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    // Clip so labels never paint outside the chart plot width or canvas bounds.
    ctx.beginPath();
    ctx.rect(chartArea.left, 0, chartArea.right - chartArea.left, chart.height);
    ctx.clip();

    const hits = [];
    for (let i = 0; i < labelCount; i += 1) {
      const full = fullLabels[i];
      if (!full) continue;

      const centerX = xScale.getPixelForTick(i);
      const leftEdge = i === 0 ? chartArea.left : (xScale.getPixelForTick(i - 1) + centerX) / 2;
      const rightEdge =
        i === labelCount - 1 ? chartArea.right : (centerX + xScale.getPixelForTick(i + 1)) / 2;

      const slotLeft = Math.max(chartArea.left, leftEdge) + NATURE_X_AXIS_PAD_X;
      const slotRight = Math.min(chartArea.right, rightEdge) - NATURE_X_AXIS_PAD_X;
      const maxWidth = Math.max(12, slotRight - slotLeft);
      const drawX = Math.min(Math.max(centerX, slotLeft + maxWidth / 2), slotRight - maxWidth / 2);

      const { lines, truncated } = wrapAxisLabelToLines(ctx, full, maxWidth, maxLines);
      lines.forEach((line, lineIdx) => {
        ctx.fillText(line, drawX, startY + lineIdx * lineHeight);
      });

      hits.push({
        index: i,
        full,
        truncated,
        left: slotLeft,
        right: slotRight,
        top: startY,
        bottom: startY + Math.max(lines.length, 1) * lineHeight,
      });
    }

    chart.$natureXAxisHits = hits;
    ctx.restore();
  },
  afterEvent(chart, args) {
    const opts = chart.options.plugins?.natureOfActivityXAxisLabel;
    if (!opts?.enabled) return;

    const event = args?.event;
    if (!event || event.type === "mouseout") {
      hideNatureXAxisTooltip(chart);
      return;
    }
    if (event.type !== "mousemove" && event.type !== "mouseover") return;

    const hits = chart.$natureXAxisHits || [];
    const { x, y } = event;
    const hit = hits.find((h) => x >= h.left && x <= h.right && y >= h.top && y <= h.bottom);
    const tooltipEl = ensureNatureXAxisTooltipEl(chart);
    if (!tooltipEl) return;

    if (!hit || !hit.truncated) {
      tooltipEl.style.display = "none";
      return;
    }

    const dark = Boolean(opts.darkMode);
    tooltipEl.textContent = hit.full;
    tooltipEl.style.display = "block";
    tooltipEl.style.background = dark ? "rgba(30,30,30,0.95)" : "rgba(255,255,255,0.98)";
    tooltipEl.style.color = dark ? "#f5f5f5" : "#1f2937";
    tooltipEl.style.border = dark
      ? "1px solid rgba(255,255,255,0.16)"
      : "1px solid rgba(0,0,0,0.12)";

    const parent = chart.canvas.parentNode;
    const parentWidth = parent?.clientWidth || chart.width;
    const tipWidth = tooltipEl.offsetWidth || 160;
    const left = Math.min(Math.max(8, x + 12), Math.max(8, parentWidth - tipWidth - 8));
    const tipHeight = tooltipEl.offsetHeight || 32;
    const top = Math.max(8, y - tipHeight - 10);
    tooltipEl.style.left = `${left}px`;
    tooltipEl.style.top = `${top}px`;
  },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
  BarController,
  LineController,
  natureOfBusinessBarLabelPlugin,
  natureOfActivityXAxisLabelPlugin
);

const INCOME_TURNOVER_TITLE = "Income Turnover RAC Wise";
const INCOME_DUE_COLLECTIONS_TITLE = "Income Due vs Collections RAC Wise";
const OUTSTANDING_INCOME_TITLE = "Outstanding Income Formation Wise";
const NATURE_ACTIVITY_INCOME_TITLE = "Nature of Activity Wise Income";

const INCOME_TURNOVER_COLORS = {
  income: KPI_BAR_CHART_SERIES_COLORS[3],
  govt: KPI_BAR_CHART_PRIMARY,
  paf: KPI_BAR_CHART_SECONDARY,
};

const INCOME_DUE_BAR_COLOR = KPI_BAR_CHART_SERIES_COLORS[2];

const OUTSTANDING_INCOME_CLASS_KEYS = ["categoryA", "categoryB", "categoryC", "bts", "hb"];

const OUTSTANDING_INCOME_CLASS_COLORS = {
  total: KPI_BAR_CHART_SERIES_COLORS[4],
  categoryA: KPI_FISCAL_BAR_CHART_COLORS[0],
  categoryB: KPI_FISCAL_BAR_CHART_COLORS[1],
  categoryC: KPI_FISCAL_BAR_CHART_COLORS[2],
  bts: KPI_FISCAL_BAR_CHART_COLORS[3],
  hb: KPI_FISCAL_BAR_CHART_COLORS[6],
};

/** Matches KPI Analytics by fiscal year chart bar proportions (25% of prior full width). */
const FISCAL_SHARE_BAR_OPTIONS = {
  categoryPercentage: 0.66,
  barPercentage: 0.25,
  barThickness: "flex",
  maxBarThickness: 1000,
};

/** Nature of Activity chart — 2× prior nature bar width (half category slot, full fiscal bar %). */
const NATURE_ACTIVITY_BAR_OPTIONS = {
  categoryPercentage: FISCAL_SHARE_BAR_OPTIONS.categoryPercentage * 0.5,
  barPercentage: FISCAL_SHARE_BAR_OPTIONS.barPercentage,
  barThickness: "flex",
  maxBarThickness: FISCAL_SHARE_BAR_OPTIONS.maxBarThickness,
};

const TENURE_LABELS = {
  Annual: "Annual",
  Biannual: "Six Monthly",
  Quarterly: "Quarterly",
  Monthly: "Monthly",
};

function getTenureLabel(tenure) {
  return TENURE_LABELS[tenure] || tenure || "Annual";
}

function scaleTurnoverCellsByTenure(cells, tenure) {
  return (cells || []).map((cell) => ({
    ...cell,
    mil: {
      income: scaleKpiAmountByTenure(cell.mil?.income, tenure),
      govt: scaleKpiAmountByTenure(cell.mil?.govt, tenure),
      paf: scaleKpiAmountByTenure(cell.mil?.paf, tenure),
    },
  }));
}

function scaleDueCollectionsCellsByTenure(cells, tenure) {
  return (cells || []).map((cell) => ({
    ...cell,
    mil: {
      incomeDue: scaleKpiAmountByTenure(cell.mil?.incomeDue, tenure),
      collections: scaleKpiAmountByTenure(cell.mil?.collections, tenure),
    },
  }));
}

function scaleOutstandingIncomeCellsByTenure(cells, tenure) {
  return (cells || []).map((cell) => {
    const scaledMil = { total: scaleKpiAmountByTenure(cell.mil?.total, tenure) };
    OUTSTANDING_INCOME_CLASS_KEYS.forEach((key) => {
      scaledMil[key] = scaleKpiAmountByTenure(cell.mil?.[key], tenure);
    });
    return { ...cell, mil: scaledMil };
  });
}

function buildIncomeTurnoverChartData(cells) {
  const labels = cells.map((cell) => cell.chartLabel);
  return {
    labels,
    datasets: withCompactGroupedBarDatasets([
      {
        label: "Income",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.income)),
        backgroundColor: INCOME_TURNOVER_COLORS.income,
        stack: "income",
        borderSkipped: false,
        borderRadius: 6,
        ...FISCAL_SHARE_BAR_OPTIONS,
      },
      {
        label: "Govt Share",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.govt)),
        backgroundColor: INCOME_TURNOVER_COLORS.govt,
        stack: "shares",
        borderSkipped: false,
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
        ...FISCAL_SHARE_BAR_OPTIONS,
      },
      {
        label: "PAF Share",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.paf)),
        backgroundColor: INCOME_TURNOVER_COLORS.paf,
        stack: "shares",
        borderSkipped: false,
        borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
        ...FISCAL_SHARE_BAR_OPTIONS,
      },
    ]),
  };
}

function buildIncomeDueCollectionsChartData(cells) {
  const labels = cells.map((cell) => cell.chartLabel);
  return {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Income Due",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.incomeDue)),
        backgroundColor: INCOME_DUE_BAR_COLOR,
        borderSkipped: false,
        borderRadius: 6,
        order: 2,
        yAxisID: "y",
        ...FISCAL_SHARE_BAR_OPTIONS,
      },
      {
        type: "line",
        label: "Collections",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.collections)),
        borderColor: "#38BDF8",
        backgroundColor: "#38BDF8",
        pointBackgroundColor: "#F5A524",
        pointBorderColor: "#F5A524",
        pointRadius: 5,
        pointHoverRadius: 6,
        borderWidth: 3,
        tension: 0.35,
        fill: false,
        order: 1,
        yAxisID: "y",
      },
    ],
  };
}

function buildOutstandingIncomeChartData(cells) {
  const labels = cells.map((cell) => cell.chartLabel);
  const classDatasets = OUTSTANDING_INCOME_CLASS_KEYS.map((key, idx, arr) => ({
    label: PROPERTY_CLASS_STICKERS[key]?.label || key,
    data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.[key])),
    backgroundColor: OUTSTANDING_INCOME_CLASS_COLORS[key],
    stack: "classes",
    borderSkipped: false,
    ...FISCAL_SHARE_BAR_OPTIONS,
    borderRadius:
      idx === arr.length - 1
        ? { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 }
        : { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
  }));

  return {
    labels,
    datasets: withCompactGroupedBarDatasets([
      {
        label: "Total",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.total)),
        backgroundColor: OUTSTANDING_INCOME_CLASS_COLORS.total,
        stack: "total",
        borderSkipped: false,
        borderRadius: 6,
        ...FISCAL_SHARE_BAR_OPTIONS,
      },
      ...classDatasets,
    ]),
  };
}

function buildNatureActivityIncomeChartData(cells) {
  return {
    labels: cells.map((cell) => cell.chartLabel),
    datasets: [
      {
        label: "Income",
        data: cells.map((cell) => {
          const mil = asOfAmountToMillions(cell.mil?.income);
          return nullIfZeroChartBarValue(mil);
        }),
        backgroundColor: cells.map(
          (_, idx) => KPI_FISCAL_BAR_CHART_COLORS[idx % KPI_FISCAL_BAR_CHART_COLORS.length]
        ),
        borderSkipped: false,
        borderRadius: 6,
        ...NATURE_ACTIVITY_BAR_OPTIONS,
      },
    ],
  };
}

function scaleNatureActivityCellsByTenure(cells, tenure) {
  return (cells || []).map((cell) => ({
    ...cell,
    mil: {
      income: scaleKpiAmountByTenure(cell.mil?.income, tenure),
    },
  }));
}

function FiscalRacCharts({
  shareRows,
  propertyRows,
  contractRows,
  asOfContractRows = [],
  contractCatalogRows = [],
  contractMetaById,
  racOptions,
  racIds,
  tenure = "Annual",
  loading,
  chartZoomOnClick = true,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [zoomChartKey, setZoomChartKey] = useState(null);

  const tenureLabel = getTenureLabel(tenure);
  const cardSx = useMemo(() => getEnterpriseCardSx(), []);
  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const tableShellBorder = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  const turnoverCells = useMemo(() => {
    const cells = buildKpiRacIncomeTurnoverCells({
      shareRows,
      propertyRows,
      contractRows,
      racOptions,
      racIds,
    });
    return scaleTurnoverCellsByTenure(cells, tenure);
  }, [shareRows, propertyRows, contractRows, racOptions, racIds, tenure]);

  const dueCollectionsCells = useMemo(() => {
    const cells = buildKpiRacIncomeDueCollectionsCells({
      propertyRows,
      contractRows,
      racOptions,
      racIds,
    });
    return scaleDueCollectionsCellsByTenure(cells, tenure);
  }, [propertyRows, contractRows, racOptions, racIds, tenure]);

  const outstandingIncomeCells = useMemo(() => {
    const cells = buildKpiRacOutstandingIncomeCells({
      propertyRows,
      racOptions,
      racIds,
    });
    return scaleOutstandingIncomeCellsByTenure(cells, tenure);
  }, [propertyRows, racOptions, racIds, tenure]);

  const natureActivityCells = useMemo(() => {
    const cells = buildKpiNatureOfBusinessIncomeCells({
      asOfContractRows,
      contractCatalogRows,
      contractMetaById,
    });
    return scaleNatureActivityCellsByTenure(cells, tenure);
  }, [asOfContractRows, contractCatalogRows, contractMetaById, tenure]);

  const turnoverChartData = useMemo(
    () => buildIncomeTurnoverChartData(turnoverCells),
    [turnoverCells]
  );

  const dueCollectionsChartData = useMemo(
    () => buildIncomeDueCollectionsChartData(dueCollectionsCells),
    [dueCollectionsCells]
  );

  const outstandingIncomeChartData = useMemo(
    () => buildOutstandingIncomeChartData(outstandingIncomeCells),
    [outstandingIncomeCells]
  );

  const natureActivityChartData = useMemo(
    () => buildNatureActivityIncomeChartData(natureActivityCells),
    [natureActivityCells]
  );

  const natureActivityCategoryLabels = useMemo(
    () => natureActivityCells.map((cell) => cell.chartLabel),
    [natureActivityCells]
  );

  const formatCrosshairValue = useCallback((value) => formatKpiCrosshairBarValue(value), []);

  const turnoverTooltipCallbacks = useMemo(
    () => ({
      label: (ctx) => {
        const n = coerceChartDataValue(ctx.raw);
        if (n == null || n === 0) return null;
        return `${ctx.dataset.label}: ${formatKpiMoneyLabel(n)}`;
      },
    }),
    []
  );

  const dueCollectionsTooltipCallbacks = useMemo(
    () => ({
      label: (ctx) => {
        const n = coerceChartDataValue(ctx.raw);
        if (n == null || n === 0) return null;
        return `${ctx.dataset.label}: ${formatKpiMoneyLabel(n)}`;
      },
    }),
    []
  );

  const outstandingIncomeTooltipCallbacks = useMemo(
    () => ({
      label: (ctx) => {
        const n = coerceChartDataValue(ctx.raw);
        if (n == null || n === 0) return null;
        return `${ctx.dataset.label}: ${formatKpiMoneyLabel(n)}`;
      },
    }),
    []
  );

  const natureActivityTooltipCallbacks = useMemo(
    () => ({
      label: (ctx) => {
        const n = coerceChartDataValue(ctx.raw);
        if (n == null || n === 0) return null;
        const nature = natureActivityCategoryLabels[ctx.dataIndex] || ctx.label || "Income";
        return `${nature}: ${formatKpiMoneyLabel(n)}`;
      },
    }),
    [natureActivityCategoryLabels]
  );

  const baseChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: textColor, boxWidth: 12, padding: 12, font: { size: 11 } },
        },
      },
      scales: {
        x: {
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            maxRotation: 45,
            minRotation: 0,
            font: { size: 11, weight: "bold" },
          },
          title: {
            display: true,
            text: "RAC",
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
            text: "Amount (M / B)",
            color: textColor,
            font: { size: 12, weight: "600" },
          },
        },
      },
    }),
    [gridColor, textColor]
  );

  const roundedYAxisScale = useMemo(
    () => ({
      ...baseChartOptions.scales.y,
      ticks: {
        ...baseChartOptions.scales.y.ticks,
        callback: (value) => formatKpiBarAxisTickRounded(value),
      },
    }),
    [baseChartOptions.scales.y]
  );

  const natureActivityYAxisScale = useMemo(
    () => ({
      ...roundedYAxisScale,
      ticks: {
        ...roundedYAxisScale.ticks,
        font: { size: 12, weight: "600" },
        callback: (value) => formatKpiBarAxisTickRounded(value),
      },
      title: {
        ...roundedYAxisScale.title,
        text: "Amount (M)",
        font: { size: 13, weight: "600" },
      },
    }),
    [roundedYAxisScale]
  );

  const turnoverChartOptions = useMemo(() => {
    const options = {
      ...baseChartOptions,
      ...COMPACT_GROUPED_BAR_OPTIONS,
      datasets: {
        bar: {
          ...COMPACT_GROUPED_BAR_OPTIONS.datasets.bar,
          ...FISCAL_SHARE_BAR_OPTIONS,
        },
      },
      scales: {
        ...baseChartOptions.scales,
        x: { ...baseChartOptions.scales.x, stacked: true },
        y: { ...baseChartOptions.scales.y, stacked: true },
      },
      plugins: {
        ...baseChartOptions.plugins,
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: turnoverTooltipCallbacks,
        },
      },
    };

    return applyKpiCrosshairBarChartEnhancements(options, {
      darkMode,
      formatValue: formatCrosshairValue,
      tooltipCallbacks: turnoverTooltipCallbacks,
      fontSize: 9,
      labelPlacement: "inside",
    });
  }, [baseChartOptions, darkMode, formatCrosshairValue, turnoverTooltipCallbacks]);

  const dueCollectionsChartOptions = useMemo(() => {
    const options = {
      ...baseChartOptions,
      ...COMPACT_GROUPED_BAR_OPTIONS,
      datasets: {
        bar: {
          ...COMPACT_GROUPED_BAR_OPTIONS.datasets.bar,
          ...FISCAL_SHARE_BAR_OPTIONS,
        },
      },
      plugins: {
        ...baseChartOptions.plugins,
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: dueCollectionsTooltipCallbacks,
        },
      },
      scales: {
        ...baseChartOptions.scales,
        y: roundedYAxisScale,
      },
    };

    return applyKpiCrosshairBarChartEnhancements(options, {
      darkMode,
      formatValue: formatCrosshairValue,
      tooltipCallbacks: dueCollectionsTooltipCallbacks,
      fontSize: 9,
      labelPlacement: "inside",
    });
  }, [
    baseChartOptions,
    darkMode,
    formatCrosshairValue,
    dueCollectionsTooltipCallbacks,
    roundedYAxisScale,
  ]);

  const outstandingIncomeChartOptions = useMemo(() => {
    const options = {
      ...baseChartOptions,
      ...COMPACT_GROUPED_BAR_OPTIONS,
      datasets: {
        bar: {
          ...COMPACT_GROUPED_BAR_OPTIONS.datasets.bar,
          ...FISCAL_SHARE_BAR_OPTIONS,
        },
      },
      scales: {
        ...baseChartOptions.scales,
        x: {
          ...baseChartOptions.scales.x,
          stacked: true,
          title: {
            ...baseChartOptions.scales.x.title,
            text: "Formation",
          },
        },
        y: { ...roundedYAxisScale, stacked: true },
      },
      plugins: {
        ...baseChartOptions.plugins,
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: outstandingIncomeTooltipCallbacks,
        },
      },
    };

    return applyKpiCrosshairBarChartEnhancements(options, {
      darkMode,
      formatValue: formatCrosshairValue,
      tooltipCallbacks: outstandingIncomeTooltipCallbacks,
      fontSize: 9,
      labelPlacement: "inside",
    });
  }, [
    baseChartOptions,
    darkMode,
    formatCrosshairValue,
    outstandingIncomeTooltipCallbacks,
    roundedYAxisScale,
  ]);

  const natureActivityChartOptions = useMemo(() => {
    const xAxisReservedHeight = NATURE_X_AXIS_MAX_LINES * NATURE_X_AXIS_LINE_HEIGHT + 20;
    const options = {
      ...baseChartOptions,
      layout: {
        padding: {
          top: 4,
          right: 8,
          bottom: 4,
          left: 0,
        },
      },
      datasets: {
        bar: {
          skipNull: true,
          grouped: true,
          ...NATURE_ACTIVITY_BAR_OPTIONS,
        },
      },
      scales: {
        ...baseChartOptions.scales,
        x: {
          ...baseChartOptions.scales.x,
          grid: { display: false },
          title: {
            ...baseChartOptions.scales.x.title,
            text: "Nature of Business",
            font: { size: 13, weight: "600" },
            padding: { top: 8, bottom: 0 },
          },
          ticks: {
            ...baseChartOptions.scales.x.ticks,
            display: false,
            autoSkip: false,
            maxRotation: 0,
            minRotation: 0,
          },
          afterFit(scale) {
            scale.height = Math.max(scale.height || 0, xAxisReservedHeight);
          },
        },
        y: natureActivityYAxisScale,
      },
      plugins: {
        ...baseChartOptions.plugins,
        legend: {
          ...baseChartOptions.plugins.legend,
          display: false,
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: natureActivityTooltipCallbacks,
        },
        natureOfBusinessBarLabel: {
          enabled: true,
          categoryLabels: natureActivityCategoryLabels,
          darkMode,
          fontSize: 12,
        },
        natureOfActivityXAxisLabel: {
          enabled: true,
          categoryLabels: natureActivityCategoryLabels,
          color: textColor,
          darkMode,
          maxLines: NATURE_X_AXIS_MAX_LINES,
          lineHeight: NATURE_X_AXIS_LINE_HEIGHT,
          font: NATURE_X_AXIS_FONT,
          paddingTop: 8,
        },
      },
    };

    const enhanced = applyKpiCrosshairBarChartEnhancements(options, {
      darkMode,
      formatValue: formatCrosshairValue,
      tooltipCallbacks: natureActivityTooltipCallbacks,
      fontSize: 12,
      labelPlacement: "inside",
    });

    return {
      ...enhanced,
      scales: {
        ...enhanced.scales,
        x: options.scales.x,
        y: options.scales.y,
      },
      plugins: {
        ...enhanced.plugins,
        kpiZoomPermanentLabels: { enabled: false },
        natureOfBusinessBarLabel: options.plugins.natureOfBusinessBarLabel,
        natureOfActivityXAxisLabel: options.plugins.natureOfActivityXAxisLabel,
      },
    };
  }, [
    baseChartOptions,
    darkMode,
    formatCrosshairValue,
    natureActivityCategoryLabels,
    natureActivityTooltipCallbacks,
    natureActivityYAxisScale,
    textColor,
  ]);

  const zoomEnabled = Boolean(chartZoomOnClick) && !loading;
  const closeZoom = useCallback(() => setZoomChartKey(null), []);

  const zoomConfig = useMemo(() => {
    if (zoomChartKey === "turnover") {
      return {
        title: `${INCOME_TURNOVER_TITLE} (${tenureLabel})`,
        data: turnoverChartData,
        options: {
          ...turnoverChartOptions,
          plugins: {
            ...turnoverChartOptions.plugins,
            kpiZoomPermanentLabels: {
              ...turnoverChartOptions.plugins?.kpiZoomPermanentLabels,
              fontSize: 12,
            },
          },
        },
      };
    }
    if (zoomChartKey === "dueCollections") {
      return {
        title: `${INCOME_DUE_COLLECTIONS_TITLE} (${tenureLabel})`,
        data: dueCollectionsChartData,
        options: {
          ...dueCollectionsChartOptions,
          plugins: {
            ...dueCollectionsChartOptions.plugins,
            kpiZoomPermanentLabels: {
              ...dueCollectionsChartOptions.plugins?.kpiZoomPermanentLabels,
              fontSize: 12,
            },
          },
        },
      };
    }
    if (zoomChartKey === "outstandingIncome") {
      return {
        title: `${OUTSTANDING_INCOME_TITLE} (${tenureLabel})`,
        data: outstandingIncomeChartData,
        options: {
          ...outstandingIncomeChartOptions,
          plugins: {
            ...outstandingIncomeChartOptions.plugins,
            kpiZoomPermanentLabels: {
              ...outstandingIncomeChartOptions.plugins?.kpiZoomPermanentLabels,
              fontSize: 12,
            },
          },
        },
      };
    }
    if (zoomChartKey === "natureActivity") {
      return {
        title: `${NATURE_ACTIVITY_INCOME_TITLE} (${tenureLabel})`,
        data: natureActivityChartData,
        options: {
          ...natureActivityChartOptions,
          plugins: {
            ...natureActivityChartOptions.plugins,
            natureOfBusinessBarLabel: {
              ...natureActivityChartOptions.plugins?.natureOfBusinessBarLabel,
              fontSize: 14,
            },
          },
        },
      };
    }
    return null;
  }, [
    zoomChartKey,
    tenureLabel,
    turnoverChartData,
    turnoverChartOptions,
    dueCollectionsChartData,
    dueCollectionsChartOptions,
    outstandingIncomeChartData,
    outstandingIncomeChartOptions,
    natureActivityChartData,
    natureActivityChartOptions,
  ]);

  const renderChartCard = ({
    chartKey,
    title,
    subtitle,
    chartData,
    chartOptions,
    hasData,
    onExport,
    emptyMessage = "No RAC data for the selected filters.",
    chartHeight = 280,
  }) => (
    <Card sx={{ ...cardSx, overflow: "hidden", height: "100%" }}>
      <MDBox px={2} py={1.5}>
        <MDBox display="flex" alignItems="center" justifyContent="space-between" gap={1} mb={1}>
          <MDBox minWidth={0}>
            <MDTypography variant="button" fontWeight="bold" color={darkMode ? "white" : "dark"}>
              {title}
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block">
              {subtitle}
            </MDTypography>
          </MDBox>
          <ChartExportButton
            disabled={loading || !hasData}
            ariaLabel={`Export ${title} to Excel`}
            onExport={onExport}
          />
        </MDBox>
        <MDBox height={chartHeight} sx={{ position: "relative" }}>
          {loading ? (
            <MDBox display="flex" justifyContent="center" alignItems="center" height="100%">
              <CurrencyLoading size={40} />
            </MDBox>
          ) : hasData ? (
            <ChartZoomSurface
              enabled={zoomEnabled}
              darkMode={darkMode}
              showZoomHint={false}
              onZoom={() => setZoomChartKey(chartKey)}
            >
              <Chart type="bar" data={chartData} options={chartOptions} />
            </ChartZoomSurface>
          ) : (
            <MDBox
              display="flex"
              justifyContent="center"
              alignItems="center"
              height="100%"
              sx={{ border: `1px dashed ${tableShellBorder}`, borderRadius: 1.5 }}
            >
              <MDTypography variant="caption" color="text">
                {emptyMessage}
              </MDTypography>
            </MDBox>
          )}
        </MDBox>
      </MDBox>
    </Card>
  );

  return (
    <>
      <Grid container spacing={2} mt={1}>
        <Grid item xs={12}>
          {renderChartCard({
            chartKey: "turnover",
            title: INCOME_TURNOVER_TITLE,
            subtitle: `Income with Govt & PAF share by RAC (${tenureLabel})`,
            chartData: turnoverChartData,
            chartOptions: turnoverChartOptions,
            hasData: turnoverCells.length > 0,
            onExport: () =>
              exportGroupedBarChartDataToExcel(
                `${INCOME_TURNOVER_TITLE} (${tenureLabel})`,
                turnoverChartData
              ),
          })}
        </Grid>
        <Grid item xs={12}>
          {renderChartCard({
            chartKey: "dueCollections",
            title: INCOME_DUE_COLLECTIONS_TITLE,
            subtitle: `Income due vs collections by RAC (${tenureLabel})`,
            chartData: dueCollectionsChartData,
            chartOptions: dueCollectionsChartOptions,
            hasData: dueCollectionsCells.length > 0,
            onExport: () =>
              exportGroupedBarChartDataToExcel(
                `${INCOME_DUE_COLLECTIONS_TITLE} (${tenureLabel})`,
                dueCollectionsChartData
              ),
          })}
        </Grid>
        <Grid item xs={12}>
          {renderChartCard({
            chartKey: "outstandingIncome",
            title: OUTSTANDING_INCOME_TITLE,
            subtitle: `Class-wise outstanding income by formation (${tenureLabel})`,
            chartData: outstandingIncomeChartData,
            chartOptions: outstandingIncomeChartOptions,
            hasData: outstandingIncomeCells.length > 0,
            onExport: () =>
              exportGroupedBarChartDataToExcel(
                `${OUTSTANDING_INCOME_TITLE} (${tenureLabel})`,
                outstandingIncomeChartData
              ),
          })}
        </Grid>
        <Grid item xs={12}>
          {renderChartCard({
            chartKey: "natureActivity",
            title: NATURE_ACTIVITY_INCOME_TITLE,
            subtitle: `Income grouped by nature of business from contracts (${tenureLabel})`,
            chartData: natureActivityChartData,
            chartOptions: natureActivityChartOptions,
            hasData: natureActivityCells.length > 0,
            chartHeight: 400,
            emptyMessage: "No contract income data for the selected filters.",
            onExport: () =>
              exportGroupedBarChartDataToExcel(
                `${NATURE_ACTIVITY_INCOME_TITLE} (${tenureLabel})`,
                natureActivityChartData
              ),
          })}
        </Grid>
      </Grid>

      <Dialog
        fullScreen
        open={Boolean(zoomConfig)}
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
            {zoomConfig?.title || ""}
          </MDTypography>
          <MDBox display="flex" alignItems="center" gap={0.5}>
            {zoomConfig ? (
              <ChartExportButton
                disabled={loading}
                ariaLabel={`Export ${zoomConfig.title} to Excel`}
                onExport={() => exportGroupedBarChartDataToExcel(zoomConfig.title, zoomConfig.data)}
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
          {zoomConfig ? (
            <MDBox sx={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
              <Chart type="bar" data={zoomConfig.data} options={zoomConfig.options} />
            </MDBox>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

FiscalRacCharts.propTypes = {
  shareRows: PropTypes.arrayOf(PropTypes.object).isRequired,
  propertyRows: PropTypes.arrayOf(PropTypes.object).isRequired,
  contractRows: PropTypes.arrayOf(PropTypes.object).isRequired,
  asOfContractRows: PropTypes.arrayOf(PropTypes.object),
  contractCatalogRows: PropTypes.arrayOf(PropTypes.object),
  contractMetaById: PropTypes.instanceOf(Map),
  racOptions: PropTypes.arrayOf(PropTypes.object).isRequired,
  racIds: PropTypes.arrayOf(PropTypes.string),
  tenure: PropTypes.oneOf(["Annual", "Biannual", "Quarterly", "Monthly"]),
  loading: PropTypes.bool,
  chartZoomOnClick: PropTypes.bool,
};

FiscalRacCharts.defaultProps = {
  asOfContractRows: [],
  contractCatalogRows: [],
  contractMetaById: new Map(),
  racIds: [],
  tenure: "Annual",
  loading: false,
  chartZoomOnClick: true,
};

export default FiscalRacCharts;
