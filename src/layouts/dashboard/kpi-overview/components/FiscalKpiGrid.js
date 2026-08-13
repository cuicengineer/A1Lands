import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
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
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import CurrencyLoading from "components/CurrencyLoading";
import * as XLSX from "xlsx";
import { logExcelExport } from "services/api.auditLog.service";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { useMaterialUIController } from "context";
import { ChartZoomSurface, getEnterpriseCardSx } from "./KpiCharts";
import ChartExportButton from "./ChartExportButton";
import {
  coerceChartDataValue,
  nullIfZeroChartBarValue,
  roundChartBarNumber,
  withCompactGroupedBarDatasets,
  COMPACT_GROUPED_BAR_OPTIONS,
} from "utils/chartBarDataUtils";
import { applyKpiCrosshairBarChartEnhancements } from "./kpiZoomChartEnhancements";
import { exportGroupedBarChartDataToExcel } from "utils/kpiChartExcelExport";
import {
  formatKpiBarMoneyLabel,
  formatKpiBarAxisTick,
  formatKpiMoneyLabel,
  formatKpiCrosshairBarValue,
} from "../kpiDataUtils";
import useDashboardChartColors from "hooks/useDashboardChartColors";
import { KPI_BAR_INSIDE_LABEL_COLOR, KPI_BAR_INSIDE_LABEL_SHADOW } from "../kpiBarChartColors";

/** Ensures null/zero grouped bars never reserve width (legend-uncheck style layout). */
const fiscalGroupedBarCompactPlugin = {
  id: "fiscalGroupedBarCompact",
  beforeUpdate(chart) {
    const pluginOpts = chart.options?.plugins?.fiscalGroupedBarCompact;
    if (pluginOpts?.enabled === false) return;

    const barDefaults = chart.options?.datasets?.bar || {};
    chart.data.datasets.forEach((dataset) => {
      dataset.skipNull = true;
      dataset.grouped = true;
      if (dataset.barThickness == null) dataset.barThickness = "flex";
      if (dataset.maxBarThickness == null) {
        dataset.maxBarThickness = barDefaults.maxBarThickness ?? 20;
      }
    });
  },
};

/** Draw vertical series name and numeric value inside each fiscal bar. */
const fiscalBarVerticalSeriesLabelPlugin = {
  id: "fiscalBarVerticalSeriesLabel",
  afterDatasetsDraw(chart) {
    const opts = chart?.options?.plugins?.fiscalBarVerticalSeriesLabel;
    if (!opts?.enabled) return;
    const { ctx } = chart;
    const minBarHeight = Number(opts.minBarHeight ?? 28);
    const fontSize = Number(opts.fontSize ?? 10);
    const fontWeight = opts.fontWeight ?? 700;
    const textColor = opts.color || KPI_BAR_INSIDE_LABEL_COLOR;
    const showValue = opts.showValue !== false;
    const valueMinBarHeight = Number(opts.valueMinBarHeight ?? 36);
    const valueFontSize = Number(opts.valueFontSize ?? 8);
    const valueFontWeight = opts.valueFontWeight ?? 700;
    const valueColor = opts.valueColor || textColor;
    const valueTopInset = Number(opts.valueTopInset ?? 4);
    const fontFamily = "Inter, Roboto, Helvetica, Arial, sans-serif";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const label = String(dataset?.label || "").trim();
      if (!label) return;
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      meta.data.forEach((bar, dataIndex) => {
        const raw = dataset?.data?.[dataIndex];
        const n = coerceChartDataValue(raw);
        if (n == null || n === 0) return;

        const { x, y, base, width } = bar.getProps(["x", "y", "base", "width"], true);
        const barHeight = Math.abs(base - y);
        if (barHeight < minBarHeight) return;
        const centerY = (y + base) / 2;

        ctx.save();
        ctx.translate(x, centerY);
        ctx.rotate(-Math.PI / 2);
        ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.fillStyle = textColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = KPI_BAR_INSIDE_LABEL_SHADOW;
        ctx.shadowBlur = 2;
        ctx.fillText(label, 0, 0);
        ctx.restore();

        if (!showValue || barHeight < valueMinBarHeight) return;

        const valueText = formatFiscalChartValue(n, dataset.fiscalRowId);
        if (!valueText || valueText === "—") return;

        let drawValueFontSize = valueFontSize;
        ctx.save();
        ctx.font = `${valueFontWeight} ${drawValueFontSize}px ${fontFamily}`;
        let drawValueText = valueText;
        let textWidth = ctx.measureText(drawValueText).width;
        const barWidth = width ?? 0;
        while (drawValueFontSize > 6 && barWidth > 0 && textWidth + 4 > barWidth) {
          drawValueFontSize -= 1;
          ctx.font = `${valueFontWeight} ${drawValueFontSize}px ${fontFamily}`;
          textWidth = ctx.measureText(drawValueText).width;
        }
        if (barWidth > 0 && textWidth + 2 > barWidth) {
          ctx.restore();
          return;
        }

        const topY = Math.min(y, base) + valueTopInset;
        ctx.fillStyle = valueColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.shadowColor = KPI_BAR_INSIDE_LABEL_SHADOW;
        ctx.shadowBlur = 2;
        ctx.fillText(drawValueText, x, topY);
        ctx.restore();
      });
    });
  },
};

/** Numeric value + unit at the end of each nested horizontal bar. */
const fiscalNestedBarEndLabelPlugin = {
  id: "fiscalNestedBarEndLabel",
  afterDatasetsDraw(chart) {
    const opts = chart?.options?.plugins?.fiscalNestedBarEndLabel;
    if (!opts?.enabled) return;
    if (chart.options?.indexAxis !== "y") return;

    const { ctx, chartArea } = chart;
    if (!ctx || !chartArea) return;

    const fontSize = Number(opts.fontSize ?? 11);
    const fontWeight = opts.fontWeight ?? 700;
    const textColor = opts.color || (opts.darkMode ? "#e8e8e8" : "#344767");
    const gap = Number(opts.gap ?? 6);
    const fontFamily = "Inter, Roboto, Helvetica, Arial, sans-serif";

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (!meta || meta.hidden) return;

      const isGovtShare = dataset?.fiscalRowId === "fiscal-govt" || dataset?.label === "Govt Share";

      meta.data.forEach((bar, dataIndex) => {
        const raw = dataset?.data?.[dataIndex];
        const n = coerceChartDataValue(raw);
        if (n == null || n === 0) return;

        const valueText = formatFiscalChartValue(n, dataset.fiscalRowId);
        if (!valueText || valueText === "—") return;

        const { x, y, base, height } = bar.getProps(["x", "y", "base", "height"], true);
        const endX = Math.max(x, base);
        const startX = Math.min(x, base);
        const barWidth = Math.abs(endX - startX);
        const barHeight = Math.abs(height ?? 0);
        const barTop = y - barHeight / 2;
        const barBottom = y + barHeight / 2;

        // Govt Share value sits on the top edge of its thicker bar; PAF stays centered on its bar.
        const labelY = isGovtShare ? barTop : y;
        const textBaseline = isGovtShare ? "top" : "middle";

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
        } else {
          ctx.restore();
          return;
        }

        // Keep label within the chart vertically when top-aligned.
        const clampedY = isGovtShare
          ? Math.min(Math.max(labelY, chartArea.top), barBottom)
          : labelY;

        ctx.fillStyle = textColor;
        ctx.textAlign = align;
        ctx.textBaseline = textBaseline;
        ctx.shadowColor = KPI_BAR_INSIDE_LABEL_SHADOW;
        ctx.shadowBlur = 2;
        ctx.fillText(valueText, drawX, clampedY);
        ctx.restore();
      });
    });
  },
};

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
  fiscalGroupedBarCompactPlugin,
  fiscalBarVerticalSeriesLabelPlugin,
  fiscalNestedBarEndLabelPlugin
);

/** Row ids whose table values are in millions (vs integer receipts/payments). */
const FISCAL_MIL_ROW_IDS = new Set([
  "fiscal-income",
  "fiscal-govt",
  "fiscal-paf",
  "fiscal-ahq",
  "fiscal-rac",
  "fiscal-base",
]);

const FISCAL_SHARE_OVERVIEW_LABEL = "Fiscal year shares";
const FISCAL_SHARE_DRILL_LABEL = "Fiscal year share breakdown";
const FISCAL_SHARE_DRILL_ROW_IDS = ["fiscal-ahq", "fiscal-rac", "fiscal-base"];
const FISCAL_SHARE_DATASET_LABEL_TO_ROW_ID = {
  "Govt Share": "fiscal-govt",
  "PAF Share": "fiscal-paf",
};
const FISCAL_DETAIL_LABELS = {
  "fiscal-ahq": "AHQ Share",
  "fiscal-rac": "RAC Share",
  "fiscal-base": "Base Share",
};

/** Nested horizontal bar: thick background (Govt) + thin foreground (PAF). */
const FISCAL_NESTED_GOVT_BAR_THICKNESS = 28;
const FISCAL_NESTED_PAF_BAR_THICKNESS = 14;

function formatFiscalCell(value) {
  if (value === "—" || value === null || value === undefined) return "—";
  const n = Number(value);
  if (Number.isFinite(n)) return n.toLocaleString();
  return String(value);
}

function isNumericFiscalValue(value) {
  if (value === "—" || value === null || value === undefined) return false;
  return Number.isFinite(Number(value));
}

function fiscalRowMil(row, fieldKey) {
  if (!row || !fieldKey) return 0;
  const v = row[fieldKey];
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function formatFiscalChartValue(value, rowId) {
  const n = roundChartBarNumber(value);
  if (n == null) return "—";
  if (FISCAL_MIL_ROW_IDS.has(rowId)) return formatKpiMoneyLabel(n);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function findFiscalRow(rows, rowId) {
  return (rows || []).find((row) => row?.id === rowId) || null;
}

function FiscalKpiGrid({
  rows,
  fiscalPeriods,
  expanded,
  onToggleExpanded,
  loading,
  chartZoomOnClick = true,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const chartColors = useDashboardChartColors();
  const cardRef = useRef(null);
  const [chartZoomOpen, setChartZoomOpen] = useState(false);
  const [selectedFiscalPeriodKey, setSelectedFiscalPeriodKey] = useState(null);

  const closeChartZoom = useCallback(() => setChartZoomOpen(false), []);

  const periods = fiscalPeriods || [];

  const fiscalCardSx = useMemo(() => {
    const { height: _height, ...rest } = getEnterpriseCardSx();
    return rest;
  }, []);

  const handleExport = useCallback(() => {
    const exportRows = rows.map((r) => {
      const out = { KPI: r.kpiName };
      periods.forEach((p) => {
        out[p.headerLabel] = r[p.fieldKey];
      });
      return out;
    });
    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Fiscal KPIs");
    const fileName = `Fiscal-KPIs-${new Date().toISOString().slice(0, 10)}.xlsx`;
    XLSX.writeFile(wb, fileName);
    logExcelExport({
      moduleName: "Fiscal KPIs",
      fileName,
      rowCount: exportRows.length,
      exportType: "fiscalKpiGrid",
    });
  }, [rows, periods]);

  const headerBg = darkMode ? "rgba(255,255,255,0.06)" : "#f4f6f8";
  const stickyBg = darkMode ? "#1e1e1e" : "#ffffff";
  const rowBorder = darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const tableShellBorder = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  /** Min widths for horizontal scroll; % widths stretch the grid to fill the card. */
  const kpiColMinPx = 212;
  const fiscalPeriodColMinPx = 96;
  const tableMinWidthPx = kpiColMinPx + periods.length * fiscalPeriodColMinPx;
  const kpiColWidthPct = tableMinWidthPx > 0 ? (kpiColMinPx / tableMinWidthPx) * 100 : 100;
  const fiscalColWidthPct =
    periods.length > 0 && tableMinWidthPx > 0 ? (fiscalPeriodColMinPx / tableMinWidthPx) * 100 : 0;

  const kpiColWidthSx = {
    width: `${kpiColWidthPct}%`,
    minWidth: kpiColMinPx,
    overflow: "hidden",
  };

  const fiscalPeriodColSx = {
    width: `${fiscalColWidthPct}%`,
    minWidth: fiscalPeriodColMinPx,
    overflow: "hidden",
  };

  /** Header cells follow colgroup % only — minWidth on th breaks full-width stretch. */
  const kpiHeaderColSx = {
    width: `${kpiColWidthPct}%`,
    overflow: "hidden",
  };

  const fiscalHeaderColSx = {
    width: `${fiscalColWidthPct}%`,
    overflow: "hidden",
  };

  const stickyCellSx = {
    position: "sticky",
    left: 0,
    zIndex: 2,
    backgroundColor: stickyBg,
    ...kpiColWidthSx,
    borderRight: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
  };

  const stickyHeaderSx = {
    position: "sticky",
    left: 0,
    zIndex: 4,
    backgroundColor: headerBg,
    fontWeight: 700,
    ...kpiHeaderColSx,
    borderRight: darkMode ? "1px solid rgba(255,255,255,0.08)" : "1px solid rgba(0,0,0,0.08)",
  };

  /** Compact padding — shared by header and body so columns stay aligned. */
  const fiscalColPad = { py: 0.5, px: 1 };
  const fiscalNumericHeaderSx = {
    ...fiscalColPad,
    textAlign: "right",
    verticalAlign: "middle",
    backgroundColor: headerBg,
    fontWeight: 600,
    minWidth: 0,
    whiteSpace: "nowrap",
    lineHeight: 1.15,
    fontVariantNumeric: "tabular-nums",
    overflow: "hidden",
    borderBottom: `1px solid ${rowBorder}`,
  };
  const fiscalNumericBodySx = {
    ...fiscalColPad,
    textAlign: "right",
    verticalAlign: "middle",
    minWidth: 0,
    fontVariantNumeric: "tabular-nums",
    overflow: "hidden",
    borderBottom: `1px solid ${rowBorder}`,
  };
  const kpiColPad = { py: 0.5, px: 1 };

  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const fiscalChartContext = useMemo(() => {
    const govtRow = findFiscalRow(rows, "fiscal-govt");
    const pafRow = findFiscalRow(rows, "fiscal-paf");
    const chartPeriods = periods;

    if (selectedFiscalPeriodKey) {
      const period = periods.find((item) => item.fieldKey === selectedFiscalPeriodKey);
      if (period) {
        const detailRows = FISCAL_SHARE_DRILL_ROW_IDS.map((rowId) =>
          findFiscalRow(rows, rowId)
        ).filter((row) => row && isNumericFiscalValue(row[selectedFiscalPeriodKey]));
        const detailDataset = detailRows.map((row) =>
          nullIfZeroChartBarValue(fiscalRowMil(row, selectedFiscalPeriodKey))
        );
        const hasDetailData = detailDataset.some((value) => coerceChartDataValue(value) != null);

        if (hasDetailData) {
          return {
            mode: "detail",
            title: `${FISCAL_SHARE_DRILL_LABEL} — ${period.headerLabel}`,
            data: {
              labels: detailRows.map((row) => FISCAL_DETAIL_LABELS[row.id] || row.kpiName),
              datasets: withCompactGroupedBarDatasets([
                {
                  label: period.headerLabel,
                  fiscalRowId: period.fieldKey,
                  data: detailDataset,
                  backgroundColor: detailRows.map(
                    (row, idx) => chartColors.fiscalDetail[row.id] || chartColors.fiscal[idx]
                  ),
                  borderRadius: 6,
                  categoryPercentage: 0.66,
                  barPercentage: 0.5,
                  barThickness: "flex",
                  maxBarThickness: 1000,
                  yAxisID: "y",
                },
              ]),
            },
          };
        }
      }
    }

    return {
      mode: "overview",
      title: FISCAL_SHARE_OVERVIEW_LABEL,
      data: {
        labels: chartPeriods.map((period) => period.headerLabel),
        datasets: [
          {
            label: "Govt Share",
            fiscalRowId: "fiscal-govt",
            data: chartPeriods.map((period) =>
              nullIfZeroChartBarValue(fiscalRowMil(govtRow, period.fieldKey))
            ),
            backgroundColor: chartColors.nestedGovt,
            borderSkipped: false,
            borderRadius: 4,
            barThickness: FISCAL_NESTED_GOVT_BAR_THICKNESS,
            maxBarThickness: FISCAL_NESTED_GOVT_BAR_THICKNESS,
            categoryPercentage: 0.85,
            barPercentage: 0.95,
            grouped: false,
            order: 2,
            yAxisID: "y",
          },
          {
            label: "PAF Share",
            fiscalRowId: "fiscal-paf",
            data: chartPeriods.map((period) =>
              nullIfZeroChartBarValue(fiscalRowMil(pafRow, period.fieldKey))
            ),
            backgroundColor: chartColors.nestedPaf,
            borderSkipped: false,
            borderRadius: 4,
            barThickness: FISCAL_NESTED_PAF_BAR_THICKNESS,
            maxBarThickness: FISCAL_NESTED_PAF_BAR_THICKNESS,
            categoryPercentage: 0.85,
            barPercentage: 0.95,
            grouped: false,
            order: 1,
            yAxisID: "y",
          },
        ],
      },
    };
  }, [rows, periods, selectedFiscalPeriodKey, chartColors]);

  const fiscalTableChartData = fiscalChartContext.data;
  const chartZoomEnabled =
    Boolean(chartZoomOnClick) &&
    !loading &&
    periods.length > 0 &&
    fiscalTableChartData.datasets.length > 0 &&
    fiscalChartContext.mode === "overview";

  const fiscalTableChartOptions = useMemo(() => {
    const hasChartData = fiscalTableChartData.datasets.length > 0;
    const isOverview = fiscalChartContext.mode === "overview";

    if (isOverview) {
      return {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y",
        interaction: { mode: "index", intersect: false },
        datasets: {
          bar: {
            skipNull: true,
            grouped: false,
          },
        },
        onClick: (_event, elements) => {
          if (!elements?.length) return;
          const { datasetIndex, index } = elements[0] || {};
          const dataset = fiscalTableChartData.datasets?.[datasetIndex];
          const selectedLabel = fiscalTableChartData.labels?.[index];
          const fiscalRowId =
            dataset?.fiscalRowId || FISCAL_SHARE_DATASET_LABEL_TO_ROW_ID[dataset?.label];
          if (fiscalRowId !== "fiscal-paf" || !selectedLabel) return;
          const period = periods.find((item) => item.headerLabel === selectedLabel);
          if (!period?.fieldKey) return;
          setSelectedFiscalPeriodKey(period.fieldKey);
        },
        onHover: (event, elements) => {
          const target = event.native?.target;
          if (!target) return;
          if (!elements?.length) {
            target.style.cursor = chartZoomEnabled ? "crosshair" : "default";
            return;
          }
          const dataset = fiscalTableChartData.datasets?.[elements[0]?.datasetIndex];
          target.style.cursor = dataset?.fiscalRowId === "fiscal-paf" ? "pointer" : "default";
        },
        plugins: {
          legend: {
            position: "top",
            align: "end",
            labels: {
              color: textColor,
              boxWidth: 12,
              padding: 12,
              font: { size: 11 },
              usePointStyle: false,
            },
          },
          fiscalBarVerticalSeriesLabel: {
            enabled: false,
          },
          fiscalGroupedBarCompact: {
            enabled: false,
          },
          fiscalNestedBarEndLabel: {
            enabled: true,
            darkMode,
            color: textColor,
            fontSize: 14,
            fontWeight: 700,
            gap: 6,
          },
          tooltip: {
            mode: "index",
            intersect: false,
            callbacks: {
              label: (ctx) => {
                const n = coerceChartDataValue(ctx.raw);
                if (n == null || n === 0) return null;
                return `${ctx.dataset.label}: ${formatFiscalChartValue(
                  n,
                  ctx.dataset.fiscalRowId
                )}`;
              },
            },
          },
        },
        layout: {
          padding: {
            right: 56,
          },
        },
        scales: {
          x: {
            stacked: false,
            beginAtZero: true,
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 11, weight: "bold" },
              callback: (value) => formatKpiBarAxisTick(value),
            },
            title: {
              display: true,
              text: "Amount in Million",
              color: textColor,
              font: { size: 12, weight: "600" },
            },
          },
          y: {
            stacked: false,
            display: hasChartData,
            grid: { display: false },
            ticks: {
              color: textColor,
              font: { size: 11, weight: "600" },
              autoSkip: false,
            },
            title: {
              display: false,
            },
          },
        },
      };
    }

    return {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "x",
      interaction: { mode: "index", intersect: false },
      ...COMPACT_GROUPED_BAR_OPTIONS,
      datasets: {
        bar: {
          ...COMPACT_GROUPED_BAR_OPTIONS.datasets.bar,
          categoryPercentage: 0.66,
          barPercentage: 0.5,
          maxBarThickness: 1000,
        },
      },
      onClick: undefined,
      onHover: (event) => {
        const target = event.native?.target;
        if (target) target.style.cursor = "default";
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: textColor, boxWidth: 12, padding: 12, font: { size: 11 } },
        },
        fiscalBarVerticalSeriesLabel: {
          enabled: true,
          minBarHeight: 34,
          fontSize: 12,
          fontWeight: 700,
          color: chartColors.insideLabelColor,
          showValue: true,
          valueFontSize: 11,
          valueMinBarHeight: 38,
          valueTopInset: 4,
          valueColor: chartColors.insideLabelColor,
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: (ctx) => {
              const n = coerceChartDataValue(ctx.raw);
              if (n == null || n === 0) return null;
              return `${ctx.dataset.label}: ${formatFiscalChartValue(n, ctx.dataset.fiscalRowId)}`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: false,
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            maxRotation: 45,
            minRotation: 0,
            font: { size: 11, weight: "bold" },
          },
          title: {
            display: true,
            text: "Share",
            color: textColor,
            font: { size: 12, weight: "600" },
          },
        },
        y: {
          display: hasChartData,
          stacked: false,
          beginAtZero: true,
          position: "left",
          grid: { color: gridColor },
          ticks: {
            color: textColor,
            callback: (value) => formatKpiBarAxisTick(value),
          },
          title: {
            display: hasChartData,
            text: "Amount in Million",
            color: textColor,
            font: { size: 12, weight: "600" },
          },
        },
      },
    };
  }, [
    chartZoomEnabled,
    chartColors,
    darkMode,
    fiscalChartContext.mode,
    fiscalTableChartData,
    gridColor,
    periods,
    textColor,
  ]);

  const fiscalCrosshairFormatValue = useCallback((value) => formatKpiCrosshairBarValue(value), []);

  const fiscalTableChartCrosshairOptions = useMemo(() => {
    const isOverview = fiscalChartContext.mode === "overview";
    const enhanced = applyKpiCrosshairBarChartEnhancements(fiscalTableChartOptions, {
      darkMode,
      formatValue: fiscalCrosshairFormatValue,
      tooltipCallbacks: fiscalTableChartOptions.plugins.tooltip.callbacks,
      fontSize: isOverview ? 13 : 13,
      labelPlacement: isOverview ? "end" : "inside",
      insideLabelColor: chartColors.insideLabelColor,
      insideTextShadowColor: chartColors.insideLabelShadow,
    });

    return {
      ...enhanced,
      indexAxis: fiscalTableChartOptions.indexAxis,
      layout: fiscalTableChartOptions.layout,
      scales: fiscalTableChartOptions.scales,
      datasets: fiscalTableChartOptions.datasets,
      plugins: {
        ...enhanced.plugins,
        kpiZoomPermanentLabels: { enabled: false },
        fiscalBarVerticalSeriesLabel: fiscalTableChartOptions.plugins.fiscalBarVerticalSeriesLabel,
        fiscalGroupedBarCompact: fiscalTableChartOptions.plugins.fiscalGroupedBarCompact || {
          enabled: true,
        },
        fiscalNestedBarEndLabel: fiscalTableChartOptions.plugins.fiscalNestedBarEndLabel || {
          enabled: false,
        },
      },
    };
  }, [
    fiscalTableChartOptions,
    darkMode,
    fiscalCrosshairFormatValue,
    fiscalChartContext.mode,
    chartColors,
  ]);

  const fiscalZoomedChartOptions = useMemo(() => {
    const isOverview = fiscalChartContext.mode === "overview";
    const nestedLabelOpts = fiscalTableChartOptions.plugins.fiscalNestedBarEndLabel;
    const enhanced = applyKpiCrosshairBarChartEnhancements(
      {
        ...fiscalTableChartOptions,
        plugins: {
          ...fiscalTableChartOptions.plugins,
          legend: {
            ...fiscalTableChartOptions.plugins.legend,
            labels: {
              ...fiscalTableChartOptions.plugins.legend.labels,
              font: { size: 13, weight: "600" },
            },
          },
          fiscalNestedBarEndLabel: nestedLabelOpts
            ? { ...nestedLabelOpts, fontSize: 16 }
            : { enabled: false },
        },
      },
      {
        darkMode,
        formatValue: fiscalCrosshairFormatValue,
        tooltipCallbacks: fiscalTableChartOptions.plugins.tooltip.callbacks,
        fontSize: 15,
        labelPlacement: isOverview ? "end" : "inside",
        insideLabelColor: chartColors.insideLabelColor,
        insideTextShadowColor: chartColors.insideLabelShadow,
      }
    );

    return {
      ...enhanced,
      indexAxis: fiscalTableChartOptions.indexAxis,
      layout: fiscalTableChartOptions.layout,
      scales: fiscalTableChartOptions.scales,
      datasets: fiscalTableChartOptions.datasets,
      plugins: {
        ...enhanced.plugins,
        kpiZoomPermanentLabels: { enabled: false },
        fiscalBarVerticalSeriesLabel: {
          ...fiscalTableChartOptions.plugins.fiscalBarVerticalSeriesLabel,
          valueFontSize: 13,
        },
        fiscalGroupedBarCompact: fiscalTableChartOptions.plugins.fiscalGroupedBarCompact || {
          enabled: true,
        },
        fiscalNestedBarEndLabel: nestedLabelOpts
          ? { ...nestedLabelOpts, fontSize: 16 }
          : { enabled: false },
      },
    };
  }, [
    fiscalTableChartOptions,
    darkMode,
    fiscalCrosshairFormatValue,
    fiscalChartContext.mode,
    chartColors,
  ]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;

    if (!expanded) {
      const scrollHost = card.closest(".saas-workspace-grid-host");
      if (scrollHost) {
        const cardTop = card.offsetTop;
        if (scrollHost.scrollTop > cardTop) {
          scrollHost.scrollTop = Math.max(0, cardTop - 8);
        }
      }
    }

    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [expanded]);

  return (
    <Card
      ref={cardRef}
      className="erp-fiscal-kpi-grid-card"
      sx={{
        ...fiscalCardSx,
        overflow: "hidden",
        height: "auto",
        minHeight: 0,
        flex: "0 0 auto",
        flexGrow: 0,
        alignSelf: "flex-start",
        justifyContent: "flex-start",
        width: "100%",
      }}
    >
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        px={2}
        py={1.5}
      >
        <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
          KPI Analytics — Fiscal Years
        </MDTypography>
        {expanded ? (
          <MDButton
            variant="outlined"
            color="info"
            size="small"
            onClick={handleExport}
            sx={{ flexShrink: 0 }}
          >
            <Icon sx={{ mr: 0.5, fontSize: "1rem !important" }}>download</Icon>
            Export Excel
          </MDButton>
        ) : null}
      </MDBox>
      {expanded ? (
        <>
          <TableContainer
            className="erp-fiscal-kpi-table-shell"
            sx={{
              mx: 2,
              mb: 2,
              width: "calc(100% - 32px)",
              maxHeight: 400,
              overflow: "auto",
              borderRadius: 1.5,
              border: `1px solid ${tableShellBorder}`,
              bgcolor: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
            }}
          >
            {loading ? (
              <MDBox display="flex" justifyContent="center" py={6}>
                <CurrencyLoading size={40} />
              </MDBox>
            ) : (
              <Table
                stickyHeader
                size="small"
                className="erp-fiscal-kpi-table"
                sx={{
                  tableLayout: "fixed",
                  width: "100%",
                  minWidth: tableMinWidthPx,
                  "& .MuiTableHead-root": {
                    display: "table-header-group",
                    padding: 0,
                    width: "100%",
                  },
                  "& .MuiTableHead-root .MuiTableRow-root": {
                    display: "table-row",
                    width: "100%",
                  },
                  "& .MuiTableHead-root .MuiTableCell-root": {
                    display: "table-cell",
                  },
                  "& .MuiTableBody-root": {
                    display: "table-row-group",
                    width: "100%",
                  },
                  "& .MuiTableCell-root": {
                    boxSizing: "border-box",
                    borderBottom: "none",
                  },
                  "& .MuiTableBody-root .MuiTableRow-root:last-child .MuiTableCell-root": {
                    borderBottom: "none",
                  },
                }}
              >
                <colgroup>
                  <col style={{ width: `${kpiColWidthPct}%` }} />
                  {periods.map((p) => (
                    <col key={p.fieldKey} style={{ width: `${fiscalColWidthPct}%` }} />
                  ))}
                </colgroup>
                <TableHead>
                  <TableRow>
                    <TableCell
                      sx={{
                        ...stickyHeaderSx,
                        ...kpiColPad,
                        verticalAlign: "middle",
                        textAlign: "left",
                        borderBottom: `1px solid ${rowBorder}`,
                      }}
                    >
                      <MDTypography
                        component="span"
                        variant="caption"
                        fontWeight="bold"
                        color={darkMode ? "white" : "dark"}
                        sx={{
                          display: "block",
                          fontSize: "0.75rem",
                          lineHeight: 1.2,
                          letterSpacing: "0.02em",
                          textTransform: "uppercase",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        KPI
                      </MDTypography>
                    </TableCell>
                    {periods.map((p) => (
                      <TableCell
                        key={p.fieldKey}
                        sx={{ ...fiscalNumericHeaderSx, ...fiscalHeaderColSx }}
                      >
                        <MDTypography
                          component="span"
                          variant="caption"
                          fontWeight="bold"
                          color={darkMode ? "white" : "dark"}
                          sx={{
                            display: "block",
                            width: "100%",
                            m: 0,
                            textAlign: "right",
                            fontSize: "0.75rem",
                            lineHeight: 1.2,
                            fontVariantNumeric: "tabular-nums",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {p.headerLabel}
                        </MDTypography>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow
                      key={row.id}
                      hover
                      sx={{
                        "&:nth-of-type(even) td": {
                          backgroundColor: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)",
                        },
                        "&:nth-of-type(even) td:first-of-type": {
                          backgroundColor: darkMode ? "#1e1e1e" : "#fafbfc",
                        },
                        "&:hover td": {
                          backgroundColor: darkMode
                            ? "rgba(25,118,210,0.12)"
                            : "rgba(25,118,210,0.06)",
                        },
                        "&:hover td:first-of-type": {
                          backgroundColor: darkMode
                            ? "rgba(25,118,210,0.12)"
                            : "rgba(25,118,210,0.06)",
                        },
                      }}
                    >
                      <TableCell
                        sx={{
                          ...stickyCellSx,
                          ...kpiColPad,
                          verticalAlign: "middle",
                          textAlign: "left",
                          borderBottom: `1px solid ${rowBorder}`,
                        }}
                      >
                        <MDTypography
                          component="span"
                          variant="caption"
                          fontWeight="medium"
                          color={darkMode ? "white" : "dark"}
                          sx={{
                            display: "block",
                            m: 0,
                            fontSize: "0.8125rem",
                            lineHeight: 1.2,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.kpiName}
                        </MDTypography>
                      </TableCell>
                      {periods.map((p) => {
                        const raw = row[p.fieldKey];
                        const numeric = isNumericFiscalValue(raw);
                        const display = formatFiscalCell(raw);
                        return (
                          <TableCell
                            key={p.fieldKey}
                            sx={{ ...fiscalNumericBodySx, ...fiscalPeriodColSx }}
                          >
                            <MDTypography
                              component="span"
                              variant="caption"
                              fontWeight={numeric ? "bold" : "regular"}
                              color={numeric ? (darkMode ? "white" : "dark") : "text"}
                              sx={{
                                display: "block",
                                width: "100%",
                                m: 0,
                                textAlign: "right",
                                fontSize: "0.8125rem",
                                lineHeight: 1.2,
                                fontVariantNumeric: "tabular-nums",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {display}
                            </MDTypography>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </TableContainer>
          {!loading && periods.length > 0 && (
            <MDBox
              px={2}
              pb={2}
              pt={2.5}
              mt={3}
              sx={{
                borderTop: `1px solid ${tableShellBorder}`,
              }}
            >
              <MDBox display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <MDTypography
                  variant="button"
                  fontWeight="bold"
                  color={darkMode ? "white" : "dark"}
                >
                  {fiscalChartContext.title}
                </MDTypography>
                <MDBox display="flex" alignItems="center" gap={1}>
                  {fiscalChartContext.mode === "detail" ? (
                    <MDButton
                      variant="outlined"
                      color="info"
                      size="small"
                      onClick={() => setSelectedFiscalPeriodKey(null)}
                    >
                      Back to fiscal years
                    </MDButton>
                  ) : null}
                  <ChartExportButton
                    disabled={loading}
                    ariaLabel="Export fiscal KPI chart to Excel"
                    onExport={() =>
                      exportGroupedBarChartDataToExcel(
                        fiscalChartContext.title,
                        fiscalTableChartData
                      )
                    }
                  />
                </MDBox>
              </MDBox>
              <MDBox
                height={fiscalChartContext.mode === "overview" ? 360 : 280}
                sx={{ position: "relative" }}
              >
                <ChartZoomSurface
                  enabled={chartZoomEnabled}
                  darkMode={darkMode}
                  showZoomHint={false}
                  onZoom={() => setChartZoomOpen(true)}
                >
                  <Bar data={fiscalTableChartData} options={fiscalTableChartCrosshairOptions} />
                </ChartZoomSurface>
              </MDBox>
            </MDBox>
          )}
        </>
      ) : null}

      <Dialog
        fullScreen
        open={chartZoomOpen}
        onClose={closeChartZoom}
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
            {fiscalChartContext.title}
          </MDTypography>
          <MDBox display="flex" alignItems="center" gap={0.5}>
            {fiscalChartContext.mode === "detail" ? (
              <MDButton
                variant="outlined"
                color="info"
                size="small"
                onClick={() => setSelectedFiscalPeriodKey(null)}
                sx={{ mr: 0.5 }}
              >
                Back to fiscal years
              </MDButton>
            ) : null}
            <ChartExportButton
              disabled={loading}
              ariaLabel={`Export ${fiscalChartContext.title} to Excel`}
              onExport={() =>
                exportGroupedBarChartDataToExcel(fiscalChartContext.title, fiscalTableChartData)
              }
            />
            <IconButton onClick={closeChartZoom} size="small" aria-label="Close enlarged chart">
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
          <MDBox sx={{ flex: 1, minHeight: 0, width: "100%", position: "relative" }}>
            <Bar data={fiscalTableChartData} options={fiscalZoomedChartOptions} />
          </MDBox>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

FiscalKpiGrid.propTypes = {
  rows: PropTypes.arrayOf(PropTypes.object).isRequired,
  fiscalPeriods: PropTypes.arrayOf(
    PropTypes.shape({
      startYear: PropTypes.number,
      fieldKey: PropTypes.string,
      headerLabel: PropTypes.string,
    })
  ).isRequired,
  expanded: PropTypes.bool.isRequired,
  onToggleExpanded: PropTypes.func.isRequired,
  loading: PropTypes.bool,
  chartZoomOnClick: PropTypes.bool,
};

FiscalKpiGrid.defaultProps = {
  loading: false,
  chartZoomOnClick: true,
};

export default FiscalKpiGrid;
