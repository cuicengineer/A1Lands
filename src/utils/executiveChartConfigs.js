/**
 * Executive / flat Chart.js configs for ERP dashboard (Stripe / Linear style).
 */

import {
  nullIfZeroChartBarValue,
  coerceChartDataValue,
  roundChartBarNumber,
} from "utils/chartBarDataUtils";

const GRID_COLOR = "rgba(0, 0, 0, 0.06)";
const TICK_COLOR = "#6b7280";
export const CHART_PRIMARY = "#025B64";
export const CHART_SECONDARY = "#00D47E";

function hexToRgba(hex, alpha) {
  const h = String(hex || "").replace("#", "");
  if (h.length !== 6) return `rgba(2, 91, 100, ${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const tickFont = { size: 11, family: "Inter, Helvetica, Arial, sans-serif" };
const xAxisTickFont = { ...tickFont, weight: "bold" };

function formatAxisValue(value) {
  const n = roundChartBarNumber(value);
  if (n == null) return "";
  if (Math.abs(n) >= 1000000) {
    const millions = roundChartBarNumber(n / 1000000);
    return `${millions.toLocaleString(undefined, { maximumFractionDigits: 2 })}M`;
  }
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function executiveBarConfigs(
  labels,
  datasets,
  { color = CHART_PRIMARY, wideBars = false } = {}
) {
  const backgroundColor = datasets.backgroundColor || color;

  return {
    data: {
      labels,
      datasets: [
        {
          label: datasets.label,
          data: (datasets.data || []).map((value) => nullIfZeroChartBarValue(value)),
          backgroundColor,
          borderRadius: 6,
          borderSkipped: false,
          borderWidth: 0,
          ...(wideBars
            ? {
                barThickness: "flex",
                maxBarThickness: 1000,
                categoryPercentage: 0.66,
                barPercentage: 0.5,
              }
            : { maxBarThickness: 40 }),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: { legend: { display: false } },
      interaction: { intersect: false, mode: "index" },
      ...(wideBars
        ? {
            datasets: {
              bar: {
                barThickness: "flex",
                maxBarThickness: 1000,
                categoryPercentage: 0.66,
                barPercentage: 0.5,
              },
            },
          }
        : {}),
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: GRID_COLOR, drawBorder: false },
          ticks: {
            color: TICK_COLOR,
            font: tickFont,
            padding: 8,
            callback: formatAxisValue,
          },
        },
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: TICK_COLOR, font: xAxisTickFont, padding: 8 },
        },
      },
    },
  };
}

export function executiveLineConfigs(
  labels,
  datasets,
  { color = CHART_PRIMARY, fill = true } = {}
) {
  return {
    data: {
      labels,
      datasets: [
        {
          label: datasets.label,
          data: datasets.data,
          borderColor: color,
          backgroundColor: fill ? hexToRgba(color, 0.1) : "transparent",
          borderWidth: 3,
          pointRadius: 0,
          pointHoverRadius: 4,
          pointBackgroundColor: color,
          pointBorderColor: color,
          tension: 0.35,
          fill,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 0 },
      plugins: { legend: { display: false } },
      interaction: { intersect: false, mode: "index" },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: GRID_COLOR, drawBorder: false },
          ticks: { color: TICK_COLOR, font: tickFont, padding: 8 },
        },
        x: {
          grid: { display: false, drawBorder: false },
          ticks: { color: TICK_COLOR, font: tickFont, padding: 8 },
        },
      },
    },
  };
}
