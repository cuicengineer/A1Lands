/** Chart.js may pass parsed point objects ({ y }) instead of raw numbers. */
export function coerceChartDataValue(value) {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof value === "object") {
    const candidates = [value.y, value.v, value.value, value.raw];
    for (let i = 0; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
    }
  }
  return null;
}

/** Round chart numeric values for display (max 2 decimal places). */
export function roundChartBarNumber(value, decimals = 2) {
  const n = coerceChartDataValue(value);
  if (n == null) return null;
  const factor = 10 ** decimals;
  return Math.round(n * factor) / factor;
}

/** Chart.js treats null as "no bar" — avoids empty slots and zero labels. */
export function nullIfZeroChartBarValue(value) {
  const n = roundChartBarNumber(value);
  if (n == null || n === 0) return null;
  return n;
}

/** Grouped bars: null points do not reserve width (same effect as hiding a legend series). */
export const COMPACT_GROUPED_BAR_DATASET_DEFAULTS = {
  skipNull: true,
  grouped: true,
  barThickness: "flex",
  maxBarThickness: 20,
};

export const COMPACT_GROUPED_BAR_OPTIONS = {
  datasets: {
    bar: {
      skipNull: true,
      grouped: true,
      barThickness: "flex",
      maxBarThickness: 20,
    },
  },
};

export function withCompactGroupedBarDatasets(datasets) {
  return (datasets || []).map((dataset) => ({
    ...COMPACT_GROUPED_BAR_DATASET_DEFAULTS,
    ...dataset,
  }));
}

/** Wide grouped bars — same proportions as KPI Analytics fiscal year chart. */
export const KPI_OVERVIEW_WIDE_BAR_DATASET_DEFAULTS = {
  skipNull: true,
  grouped: true,
  barThickness: "flex",
  maxBarThickness: 1000,
  categoryPercentage: 0.66,
  /** Vertical bar width = 25% of previous full-width (barPercentage: 1) sizing. */
  barPercentage: 0.25,
};

export const KPI_OVERVIEW_WIDE_BAR_OPTIONS = {
  datasets: {
    bar: {
      ...KPI_OVERVIEW_WIDE_BAR_DATASET_DEFAULTS,
    },
  },
};

export function withKpiOverviewWideBarDatasets(datasets) {
  return (datasets || []).map((dataset) => ({
    ...KPI_OVERVIEW_WIDE_BAR_DATASET_DEFAULTS,
    ...dataset,
  }));
}
