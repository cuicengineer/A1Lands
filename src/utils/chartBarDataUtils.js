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

/** Chart.js treats null as "no bar" — avoids empty slots and zero labels. */
export function nullIfZeroChartBarValue(value) {
  const n = coerceChartDataValue(value);
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
  barPercentage: 1,
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
