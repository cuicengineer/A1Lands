/** Soft-medium palette for KPI overview bar charts — denser than pastels, no sharp yellows or dark tones. */
export const KPI_BAR_CHART_SERIES_COLORS = [
  "#72BCC8", // medium teal
  "#73CFA8", // medium mint
  "#E0BF82", // muted wheat
  "#8EB0EA", // medium soft blue
  "#9CAAB8", // blue-gray
  "#AEBACA", // cool slate
];

export const KPI_BAR_CHART_PRIMARY = KPI_BAR_CHART_SERIES_COLORS[0];
export const KPI_BAR_CHART_SECONDARY = KPI_BAR_CHART_SERIES_COLORS[1];

/** Extended palette for fiscal-year grouped bars (one color per KPI row). */
export const KPI_FISCAL_BAR_CHART_COLORS = [
  ...KPI_BAR_CHART_SERIES_COLORS,
  "#B0A0D8", // medium lilac
  "#DDB896", // medium sand
];

/** Value labels drawn inside light bar fills. */
export const KPI_BAR_INSIDE_LABEL_COLOR = "#1f2937";
export const KPI_BAR_INSIDE_LABEL_SHADOW = "rgba(255, 255, 255, 0.9)";

/** AHQ / RAC / Base charts — same tone as PAF Annual Rent & Govt Share. */
export const KPI_AHQ_RAC_BASE_CHART_COLORS = {
  ahq: KPI_BAR_CHART_PRIMARY,
  rac: KPI_BAR_CHART_SECONDARY,
  base: KPI_BAR_CHART_SERIES_COLORS[2],
};
