import { useMemo } from "react";
import { useMaterialUIController } from "context";
import { getDashboardChartColors } from "utils/dashboardChartColorThemes";

export default function useDashboardChartColors() {
  const [controller] = useMaterialUIController();
  const combination = controller.dashboardColorCombination ?? 1;

  return useMemo(() => getDashboardChartColors(combination), [combination]);
}
