import { useCallback, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { Bar, Chart } from "react-chartjs-2";
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
import {
  applyKpiCrosshairBarChartEnhancements,
  applyKpiZoomBarChartEnhancements,
} from "./kpiZoomChartEnhancements";
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
  formatNatureActivityChartLabel,
  asOfAmountToMillions,
  PROPERTY_CLASS_STICKERS,
  formatKpiBarAxisTick,
  formatKpiBarAxisTickRounded,
  formatKpiBarMoneyLabel,
  formatKpiCrosshairBarValue,
  formatKpiMoneyLabel,
  scaleKpiAmountByTenure,
} from "../kpiDataUtils";
import useDashboardChartColors from "hooks/useDashboardChartColors";
import { KPI_BAR_INSIDE_LABEL_COLOR, KPI_BAR_INSIDE_LABEL_SHADOW } from "../kpiBarChartColors";

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

/** Value label at the end of each horizontal nature-of-activity bar (outside when space allows). */
const natureActivityBarEndLabelPlugin = {
  id: "natureActivityBarEndLabel",
  afterDatasetsDraw(chart) {
    const opts = chart.options?.plugins?.natureActivityBarEndLabel;
    if (!opts?.enabled) return;
    if (chart.options?.indexAxis !== "y") return;

    const { ctx, chartArea } = chart;
    if (!ctx || !chartArea) return;

    const fontSize = Number(opts.fontSize ?? 12);
    const fontWeight = opts.fontWeight ?? 700;
    const textColor = opts.color || (opts.darkMode ? "#e8e8e8" : "#344767");
    const gap = Number(opts.gap ?? 6);
    const fontFamily = "Inter, Roboto, Helvetica, Arial, sans-serif";
    const formatValue =
      typeof opts.formatValue === "function"
        ? opts.formatValue
        : (value) => formatKpiBarMoneyLabel(value);

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      meta.data.forEach((bar, dataIndex) => {
        const raw = dataset?.data?.[dataIndex];
        const n = coerceChartDataValue(raw);
        if (n == null || n === 0) return;

        const valueText = String(formatValue(n) ?? "").trim();
        if (!valueText || valueText === "—") return;

        const { x, y, base, height } = bar.getProps(["x", "y", "base", "height"], true);
        const endX = Math.max(x, base);
        const startX = Math.min(x, base);
        const barWidth = Math.abs(endX - startX);

        ctx.save();
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        const textWidth = ctx.measureText(valueText).width;
        const outsideX = endX + gap;
        const fitsOutside = outsideX + textWidth <= chartArea.right - 2;
        const fitsInside = barWidth >= textWidth + gap * 2;

        let drawX;
        let align;
        if (fitsOutside) {
          drawX = outsideX;
          align = "left";
        } else if (fitsInside) {
          drawX = endX - gap;
          align = "right";
          ctx.fillStyle = KPI_BAR_INSIDE_LABEL_COLOR;
          ctx.shadowColor = KPI_BAR_INSIDE_LABEL_SHADOW;
          ctx.shadowBlur = 2;
        } else {
          ctx.restore();
          return;
        }

        if (fitsOutside) {
          ctx.fillStyle = textColor;
          ctx.shadowColor = "transparent";
          ctx.shadowBlur = 0;
        }

        ctx.textAlign = align;
        ctx.textBaseline = "middle";
        ctx.fillText(valueText, drawX, y);
        ctx.restore();
      });
    });
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
  natureOfActivityXAxisLabelPlugin,
  natureActivityBarEndLabelPlugin
);

function formatNatureActivityAxisTick(value, index, ticks) {
  const n = coerceChartDataValue(value);
  if (n == null || n === 0) return "";
  const formatted = formatKpiBarAxisTickRounded(n);
  if (!formatted) return "";
  if (index > 0) {
    const prev = coerceChartDataValue(ticks[index - 1]?.value);
    if (prev != null && formatKpiBarAxisTickRounded(prev) === formatted) {
      return "";
    }
  }
  return formatted;
}

const INCOME_TURNOVER_TITLE = "Income Turnover RAC Wise";
const INCOME_DUE_COLLECTIONS_TITLE = "Income Due vs Collections RAC Wise";
const OUTSTANDING_INCOME_TITLE = "Outstanding Income Formation Wise";
const NATURE_ACTIVITY_INCOME_TITLE = "Nature of Activity Wise Income";

const OUTSTANDING_INCOME_CLASS_KEYS = ["categoryA", "categoryB", "categoryC", "bts", "hb"];

function buildOutstandingIncomeClassColors(chartColors) {
  const fiscal = chartColors.fiscal;
  return {
    total: chartColors.outstandingTotal,
    categoryA: fiscal[0],
    categoryB: fiscal[1],
    categoryC: fiscal[2],
    bts: fiscal[3],
    hb: fiscal[6],
  };
}

/** Matches KPI Analytics by fiscal year chart bar proportions (2× prior 0.25 bar width). */
const FISCAL_SHARE_BAR_OPTIONS = {
  categoryPercentage: 0.66,
  barPercentage: 0.5,
  barThickness: "flex",
  maxBarThickness: 1000,
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

function buildIncomeTurnoverChartData(cells, chartColors) {
  const colors = chartColors.incomeTurnover;
  const labels = cells.map((cell) => cell.chartLabel);
  return {
    labels,
    datasets: withCompactGroupedBarDatasets([
      {
        label: "Govt Share",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.govt)),
        backgroundColor: colors.govt,
        stack: "shares",
        borderSkipped: false,
        borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 6, bottomRight: 6 },
        ...FISCAL_SHARE_BAR_OPTIONS,
      },
      {
        label: "PAF Share",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.paf)),
        backgroundColor: colors.paf,
        stack: "shares",
        borderSkipped: false,
        borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 },
        ...FISCAL_SHARE_BAR_OPTIONS,
      },
    ]),
  };
}

function buildIncomeDueCollectionsChartData(cells, chartColors) {
  const labels = cells.map((cell) => cell.chartLabel);
  return {
    labels,
    datasets: [
      {
        type: "bar",
        label: "Income Due",
        data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.incomeDue)),
        backgroundColor: chartColors.incomeDue,
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
        borderColor: chartColors.lineCollection,
        backgroundColor: chartColors.lineCollection,
        pointBackgroundColor: chartColors.lineCollectionPoint,
        pointBorderColor: chartColors.lineCollectionPoint,
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

function buildOutstandingIncomeChartData(cells, chartColors) {
  const classColors = buildOutstandingIncomeClassColors(chartColors);
  const labels = cells.map((cell) => cell.chartLabel);
  const classDatasets = OUTSTANDING_INCOME_CLASS_KEYS.map((key, idx, arr) => ({
    label: PROPERTY_CLASS_STICKERS[key]?.label || key,
    data: cells.map((cell) => nullIfZeroChartBarValue(cell.mil?.[key])),
    backgroundColor: classColors[key],
    stack: "formation",
    borderSkipped: false,
    ...FISCAL_SHARE_BAR_OPTIONS,
    borderRadius:
      idx === 0
        ? { topLeft: 0, topRight: 0, bottomLeft: 6, bottomRight: 6 }
        : idx === arr.length - 1
        ? { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 }
        : { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
  }));

  return {
    labels,
    datasets: withCompactGroupedBarDatasets(classDatasets),
  };
}

function buildNatureActivityIncomeChartData(cells, chartColors) {
  const fiscal = chartColors.fiscal;
  return {
    labels: cells.map((cell) => formatNatureActivityChartLabel(cell)),
    datasets: [
      {
        label: "Income",
        data: cells.map((cell) => {
          const mil = asOfAmountToMillions(cell.mil?.income);
          return nullIfZeroChartBarValue(mil);
        }),
        backgroundColor: cells.map((_, idx) => fiscal[idx % fiscal.length]),
        borderSkipped: false,
        borderRadius: { topLeft: 0, bottomLeft: 0, topRight: 6, bottomRight: 6 },
        ...FISCAL_SHARE_BAR_OPTIONS,
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
  propertyGroups = [],
  racOptions,
  racIds,
  tenure = "Annual",
  loading,
  chartZoomOnClick = true,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const chartColors = useDashboardChartColors();
  const [zoomChartKey, setZoomChartKey] = useState(null);

  const tenureLabel = getTenureLabel(tenure);
  const cardSx = useMemo(() => getEnterpriseCardSx(), []);
  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";
  const tableShellBorder = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  const turnoverCells = useMemo(() => {
    const cells = buildKpiRacIncomeTurnoverCells({
      shareRows,
      contractRows,
      racOptions,
      racIds,
    });
    return scaleTurnoverCellsByTenure(cells, tenure);
  }, [shareRows, contractRows, racOptions, racIds, tenure]);

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
      propertyGroups,
      racIds,
    });
    return scaleNatureActivityCellsByTenure(cells, tenure);
  }, [asOfContractRows, contractCatalogRows, contractMetaById, propertyGroups, racIds, tenure]);

  const turnoverChartData = useMemo(
    () => buildIncomeTurnoverChartData(turnoverCells, chartColors),
    [turnoverCells, chartColors]
  );

  const dueCollectionsChartData = useMemo(
    () => buildIncomeDueCollectionsChartData(dueCollectionsCells, chartColors),
    [dueCollectionsCells, chartColors]
  );

  const outstandingIncomeChartData = useMemo(
    () => buildOutstandingIncomeChartData(outstandingIncomeCells, chartColors),
    [outstandingIncomeCells, chartColors]
  );

  const natureActivityChartData = useMemo(
    () => buildNatureActivityIncomeChartData(natureActivityCells, chartColors),
    [natureActivityCells, chartColors]
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
        const cell = natureActivityCells[ctx.dataIndex];
        const nature = cell?.chartLabel || ctx.label || "Income";
        const propertyCount = Number(cell?.propertyCount) || 0;
        const lines = [`${nature}: ${formatKpiMoneyLabel(n)}`];
        if (propertyCount > 0) {
          lines.push(
            propertyCount === 1
              ? "1 active property"
              : `${propertyCount.toLocaleString()} active properties`
          );
        }
        return lines;
      },
    }),
    [natureActivityCells]
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

  const natureActivityAmountScale = useMemo(
    () => ({
      beginAtZero: true,
      grid: { color: gridColor },
      ticks: {
        color: textColor,
        font: { size: 12, weight: "600" },
        callback: formatNatureActivityAxisTick,
      },
      title: {
        display: true,
        text: "Amount (M)",
        color: textColor,
        font: { size: 13, weight: "600" },
      },
    }),
    [gridColor, textColor]
  );

  const natureActivityCategoryScale = useMemo(
    () => ({
      grid: { display: false },
      ticks: {
        color: textColor,
        font: { size: 11, weight: "600" },
        autoSkip: false,
      },
      title: {
        display: true,
        text: "Nature of Business",
        color: textColor,
        font: { size: 13, weight: "600" },
      },
    }),
    [textColor]
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
      fontSize: 12,
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
      fontSize: 12,
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
      fontSize: 12,
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
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y",
      interaction: { mode: "index", intersect: false },
      ...COMPACT_GROUPED_BAR_OPTIONS,
      layout: {
        padding: { right: 48 },
      },
      datasets: {
        bar: {
          ...COMPACT_GROUPED_BAR_OPTIONS.datasets.bar,
          ...FISCAL_SHARE_BAR_OPTIONS,
        },
      },
      scales: {
        x: natureActivityAmountScale,
        y: natureActivityCategoryScale,
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: textColor, boxWidth: 12, padding: 12, font: { size: 11 } },
          display: false,
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: natureActivityTooltipCallbacks,
        },
        natureOfBusinessBarLabel: {
          enabled: false,
        },
        natureOfActivityXAxisLabel: {
          enabled: false,
        },
      },
    };

    const enhanced = applyKpiZoomBarChartEnhancements(options, {
      darkMode,
      formatValue: formatCrosshairValue,
      tooltipCallbacks: natureActivityTooltipCallbacks,
      fontSize: 15,
      labelPlacement: "above",
    });

    return {
      ...enhanced,
      plugins: {
        ...enhanced.plugins,
        kpiZoomPermanentLabels: { enabled: false },
        natureOfBusinessBarLabel: { enabled: false },
        natureOfActivityXAxisLabel: { enabled: false },
        natureActivityBarEndLabel: {
          enabled: true,
          darkMode,
          color: textColor,
          fontSize: 12,
          fontWeight: 700,
          gap: 6,
          formatValue: (value) => formatKpiBarMoneyLabel(value),
        },
      },
    };
  }, [
    darkMode,
    formatCrosshairValue,
    natureActivityAmountScale,
    natureActivityCategoryScale,
    natureActivityTooltipCallbacks,
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
              fontSize: 15,
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
              fontSize: 15,
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
              fontSize: 15,
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
          layout: {
            ...(natureActivityChartOptions.layout || {}),
            padding: { right: 72 },
          },
          plugins: {
            ...natureActivityChartOptions.plugins,
            natureActivityBarEndLabel: {
              ...natureActivityChartOptions.plugins?.natureActivityBarEndLabel,
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
    useBarComponent = false,
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
              {useBarComponent ? (
                <Bar data={chartData} options={chartOptions} />
              ) : (
                <Chart type="bar" data={chartData} options={chartOptions} />
              )}
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
            subtitle: `Govt & PAF share stacked by RAC (${tenureLabel})`,
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
            subtitle: `Stacked class-wise outstanding income by formation (${tenureLabel})`,
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
            subtitle: `Income and active property count by nature of business (${tenureLabel})`,
            chartData: natureActivityChartData,
            chartOptions: natureActivityChartOptions,
            hasData: natureActivityCells.length > 0,
            chartHeight: 400,
            useBarComponent: true,
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
              {zoomChartKey === "natureActivity" ? (
                <Bar data={zoomConfig.data} options={zoomConfig.options} />
              ) : (
                <Chart type="bar" data={zoomConfig.data} options={zoomConfig.options} />
              )}
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
  propertyGroups: PropTypes.arrayOf(PropTypes.object),
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
  propertyGroups: [],
  racIds: [],
  tenure: "Annual",
  loading: false,
  chartZoomOnClick: true,
};

export default FiscalRacCharts;
