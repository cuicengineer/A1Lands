/** Dashboard KPI chart color combinations (soft tones, readable bar labels). */

export const DASHBOARD_COLOR_COMBINATION_IDS = [1, 2, 3, 4, 5];

export function normalizeDashboardColorCombination(value) {
  const n = Number(value);
  if (DASHBOARD_COLOR_COMBINATION_IDS.includes(n)) return n;
  return 1;
}

const COMBINATION_1 = {
  id: 1,
  label: "Combination 1",
  description: "Teal & mint",
  preview: ["#72BCC8", "#73CFA8", "#E0BF82", "#8EB0EA"],
  series: ["#72BCC8", "#73CFA8", "#E0BF82", "#8EB0EA", "#9CAAB8", "#AEBACA"],
  fiscalExtra: ["#B0A0D8", "#DDB896"],
  ahqRacBase: { ahq: "#025B64", rac: "#037078", base: "#048890" },
  share: ["#025B64", "#00D47E", "#F5A524", "#3B82F6", "#6B7280"],
  barPrimary: "#72BCC8",
  barSecondary: "#73CFA8",
  executivePrimary: "#025B64",
  executiveSecondary: "#00D47E",
  incomeDue: "#E0BF82",
  incomeTurnoverIncome: "#8EB0EA",
  outstandingTotal: "#9CAAB8",
  lineCollection: "#38BDF8",
  lineCollectionPoint: "#F5A524",
  nestedGovt: "#CBD5E1",
  nestedPaf: "#3B82F6",
  insideLabelColor: "#1f2937",
  insideLabelShadow: "rgba(255, 255, 255, 0.9)",
};

const COMBINATION_2 = {
  id: 2,
  label: "Combination 2",
  description: "Sage & mist",
  preview: ["#94BFA8", "#A8CDB8", "#C9D9A8", "#A8BED4"],
  series: ["#94BFA8", "#A8CDB8", "#C9D9A8", "#A8BED4", "#B0BEC5", "#C5D0D8"],
  fiscalExtra: ["#C4B5D4", "#DCC9B0"],
  ahqRacBase: { ahq: "#5A8470", rac: "#6E9884", base: "#82AC98" },
  share: ["#5A8470", "#94BFA8", "#D4B896", "#7BA3C4", "#8B959E"],
  barPrimary: "#94BFA8",
  barSecondary: "#A8CDB8",
  executivePrimary: "#5A8470",
  executiveSecondary: "#94BFA8",
  incomeDue: "#C9D9A8",
  incomeTurnoverIncome: "#A8BED4",
  outstandingTotal: "#B0BEC5",
  lineCollection: "#7EB8D4",
  lineCollectionPoint: "#D4B896",
  nestedGovt: "#D1DDE8",
  nestedPaf: "#7BA3C4",
  insideLabelColor: "#1f2937",
  insideLabelShadow: "rgba(255, 255, 255, 0.9)",
};

const COMBINATION_3 = {
  id: 3,
  label: "Combination 3",
  description: "Soft ocean",
  preview: ["#8EBFD4", "#9ECADE", "#B8DAEA", "#7AADCC"],
  series: ["#8EBFD4", "#9ECADE", "#B8DAEA", "#7AADCC", "#A0BFD0", "#B8CCD8"],
  fiscalExtra: ["#B5A8D4", "#D4C0A8"],
  ahqRacBase: { ahq: "#4A7894", rac: "#5E8CA8", base: "#72A0BC" },
  share: ["#4A7894", "#8EBFD4", "#E0C898", "#6B9FD4", "#8898A5"],
  barPrimary: "#8EBFD4",
  barSecondary: "#9ECADE",
  executivePrimary: "#4A7894",
  executiveSecondary: "#8EBFD4",
  incomeDue: "#B8DAEA",
  incomeTurnoverIncome: "#7AADCC",
  outstandingTotal: "#A0BFD0",
  lineCollection: "#6B9FD4",
  lineCollectionPoint: "#E0C898",
  nestedGovt: "#C8D8E4",
  nestedPaf: "#6B9FD4",
  insideLabelColor: "#1f2937",
  insideLabelShadow: "rgba(255, 255, 255, 0.9)",
};

const COMBINATION_4 = {
  id: 4,
  label: "Combination 4",
  description: "Plum & sand",
  preview: ["#C4A8D4", "#D4B8DC", "#E8D0A8", "#B8A8D4"],
  series: ["#C4A8D4", "#D4B8DC", "#E8D0A8", "#B8A8D4", "#C0B0C8", "#D8C8B8"],
  fiscalExtra: ["#A8B8D4", "#E0C8B0"],
  ahqRacBase: { ahq: "#7A6894", rac: "#8E7CA8", base: "#A290BC" },
  share: ["#7A6894", "#C4A8D4", "#E8D0A8", "#8898D4", "#9A9098"],
  barPrimary: "#C4A8D4",
  barSecondary: "#D4B8DC",
  executivePrimary: "#7A6894",
  executiveSecondary: "#C4A8D4",
  incomeDue: "#E8D0A8",
  incomeTurnoverIncome: "#B8A8D4",
  outstandingTotal: "#C0B0C8",
  lineCollection: "#8898D4",
  lineCollectionPoint: "#E8D0A8",
  nestedGovt: "#DCD4E4",
  nestedPaf: "#8898D4",
  insideLabelColor: "#1f2937",
  insideLabelShadow: "rgba(255, 255, 255, 0.9)",
};

/** Color Scheme - Graphs.xlsx palette (muted slate, sage, blue, gold, peach, lavender, teal, rose). */
const COMBINATION_5 = {
  id: 5,
  label: "Combination 5",
  description: "Graph palette",
  preview: ["#647887", "#8FAF8A", "#7DA0C4", "#D4BC72"],
  series: ["#647887", "#8FAF8A", "#7DA0C4", "#D4BC72", "#D4A078", "#A894C4"],
  fiscalExtra: ["#6BB0B0", "#C87E74"],
  ahqRacBase: { ahq: "#4A6670", rac: "#5A8888", base: "#6BB0B0" },
  share: ["#647887", "#8FAF8A", "#4A6670", "#7DA0C4", "#6BB0B0"],
  barPrimary: "#647887",
  barSecondary: "#8FAF8A",
  executivePrimary: "#4A6670",
  executiveSecondary: "#6BB0B0",
  incomeDue: "#D4BC72",
  incomeTurnoverIncome: "#7DA0C4",
  outstandingTotal: "#9AAAB8",
  lineCollection: "#6BB0B0",
  lineCollectionPoint: "#D4A078",
  nestedGovt: "#C8D2DC",
  nestedPaf: "#7DA0C4",
  insideLabelColor: "#1f2937",
  insideLabelShadow: "rgba(255, 255, 255, 0.9)",
};

export const DASHBOARD_COLOR_COMBINATIONS = {
  1: COMBINATION_1,
  2: COMBINATION_2,
  3: COMBINATION_3,
  4: COMBINATION_4,
  5: COMBINATION_5,
};

export function getDashboardChartColorCombinationMeta(combination) {
  const id = normalizeDashboardColorCombination(combination);
  const theme = DASHBOARD_COLOR_COMBINATIONS[id];
  return {
    id,
    label: theme.label,
    description: theme.description,
    preview: theme.preview,
  };
}

export function getDashboardChartColors(combination = 1) {
  const id = normalizeDashboardColorCombination(combination);
  const theme = DASHBOARD_COLOR_COMBINATIONS[id];
  const series = [...theme.series];
  const fiscal = [...series, ...theme.fiscalExtra];
  const share = [...theme.share];

  return {
    id,
    label: theme.label,
    description: theme.description,
    preview: theme.preview,
    series,
    fiscal,
    ahqRacBase: { ...theme.ahqRacBase },
    share,
    shareById: {
      govt: share[0],
      paf: share[1],
      ahq: share[2],
      rac: share[3],
      base: share[4],
    },
    barPrimary: theme.barPrimary,
    barSecondary: theme.barSecondary,
    executivePrimary: theme.executivePrimary,
    executiveSecondary: theme.executiveSecondary,
    incomeDue: theme.incomeDue,
    incomeTurnover: {
      income: theme.incomeTurnoverIncome,
      govt: theme.barPrimary,
      paf: theme.barSecondary,
    },
    outstandingTotal: theme.outstandingTotal,
    lineCollection: theme.lineCollection,
    lineCollectionPoint: theme.lineCollectionPoint,
    nestedGovt: theme.nestedGovt,
    nestedPaf: theme.nestedPaf,
    insideLabelColor: theme.insideLabelColor,
    insideLabelShadow: theme.insideLabelShadow,
    fiscalDetail: {
      "fiscal-ahq": theme.ahqRacBase.ahq,
      "fiscal-rac": theme.ahqRacBase.rac,
      "fiscal-base": theme.ahqRacBase.base,
    },
  };
}

/** Apply chart CSS variables on the dashboard shell. */
export function applyDashboardChartColorTheme(combination = 1) {
  if (typeof document === "undefined") return;
  const colors = getDashboardChartColors(combination);
  const root = document.documentElement;
  root.style.setProperty("--dash-chart-primary", colors.executivePrimary);
  root.style.setProperty("--dash-chart-secondary", colors.executiveSecondary);
  root.dataset.dashboardColorCombination = String(colors.id);
}

export const DASHBOARD_COLOR_COMBINATION_OPTIONS = DASHBOARD_COLOR_COMBINATION_IDS.map((id) => {
  const theme = DASHBOARD_COLOR_COMBINATIONS[id];
  return {
    value: id,
    label: theme.label,
    description: theme.description,
    preview: theme.preview,
  };
});
