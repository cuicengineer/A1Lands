import PropTypes from "prop-types";
import { useCallback, useMemo } from "react";
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
import Breadcrumbs from "@mui/material/Breadcrumbs";
import Link from "@mui/material/Link";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import {
  nullIfZeroChartBarValue,
  KPI_OVERVIEW_WIDE_BAR_OPTIONS,
  withKpiOverviewWideBarDatasets,
} from "utils/chartBarDataUtils";
import { exportSingleSeriesBarChartToExcel } from "utils/kpiChartExcelExport";
import {
  buildFinancialMetricBarChart,
  buildKpiBaseCategoryFinancialMetricCells,
  buildKpiBaseFinancialMetricCells,
  buildKpiRacFinancialMetricCells,
  formatKpiBarAxisTick,
  formatKpiCrosshairBarValue,
  KPI_FINANCIAL_DRILL_BASE,
  KPI_FINANCIAL_DRILL_CATEGORY,
  KPI_FINANCIAL_DRILL_INITIAL,
  KPI_FINANCIAL_DRILL_RAC,
  KPI_GOVT_PAF_UNASSIGNED_BASE_KEY,
  scaleFinancialMetricCellsByTenure,
} from "../kpiDataUtils";
import { applyKpiCrosshairBarChartEnhancements } from "./kpiZoomChartEnhancements";
import ChartExportButton from "./ChartExportButton";
import useDashboardChartColors from "hooks/useDashboardChartColors";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

function FinancialMetricDrillChart({
  metricConfig,
  shareRows,
  propertyRows,
  contractRows,
  agreementContractRows,
  useAsOfContracts,
  contractMetaById,
  racOptions,
  baseOptions,
  allBases,
  racIds,
  tenure,
  cardSx,
  loading,
  darkMode,
  title,
  description,
  seriesColor,
  zoomKey,
  onZoom,
  drill,
  onDrillChange,
  isZoomed = false,
  preferSpGovtPafShare = false,
}) {
  const chartColors = useDashboardChartColors();
  const textColor = darkMode ? "#e8e8e8" : "#344767";
  const gridColor = darkMode ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)";

  const racMetricCells = useMemo(
    () =>
      scaleFinancialMetricCellsByTenure(
        buildKpiRacFinancialMetricCells({
          metricId: metricConfig.id,
          shareRows,
          propertyRows,
          contractRows,
          agreementContractRows,
          useAsOfContracts,
          contractMetaById,
          racOptions,
          racIds,
          preferSpGovtPafShare,
        }),
        tenure
      ),
    [
      metricConfig.id,
      shareRows,
      propertyRows,
      contractRows,
      agreementContractRows,
      useAsOfContracts,
      contractMetaById,
      racOptions,
      racIds,
      tenure,
      preferSpGovtPafShare,
    ]
  );

  const baseMetricCells = useMemo(() => {
    if (drill.level === KPI_FINANCIAL_DRILL_RAC) return [];
    return scaleFinancialMetricCellsByTenure(
      buildKpiBaseFinancialMetricCells({
        metricId: metricConfig.id,
        shareRows,
        propertyRows,
        contractRows,
        agreementContractRows,
        useAsOfContracts,
        contractMetaById,
        baseOptions,
        allBases,
        racCmdId: drill.racId,
        preferSpGovtPafShare,
      }),
      tenure
    );
  }, [
    drill.level,
    drill.racId,
    metricConfig.id,
    shareRows,
    propertyRows,
    contractRows,
    agreementContractRows,
    useAsOfContracts,
    contractMetaById,
    baseOptions,
    allBases,
    tenure,
    preferSpGovtPafShare,
  ]);

  const categoryMetricCells = useMemo(() => {
    if (drill.level !== KPI_FINANCIAL_DRILL_CATEGORY) return [];
    return scaleFinancialMetricCellsByTenure(
      buildKpiBaseCategoryFinancialMetricCells({
        metricId: metricConfig.id,
        shareRows,
        propertyRows,
        contractRows,
        agreementContractRows,
        useAsOfContracts,
        contractMetaById,
        racCmdId: drill.racId,
        baseId: drill.baseId,
        preferSpGovtPafShare,
      }),
      tenure
    );
  }, [
    drill.level,
    drill.racId,
    drill.baseId,
    metricConfig.id,
    shareRows,
    propertyRows,
    contractRows,
    agreementContractRows,
    useAsOfContracts,
    contractMetaById,
    tenure,
    preferSpGovtPafShare,
  ]);

  const activeCells = useMemo(() => {
    if (drill.level === KPI_FINANCIAL_DRILL_BASE) return baseMetricCells;
    if (drill.level === KPI_FINANCIAL_DRILL_CATEGORY) return categoryMetricCells;
    return racMetricCells;
  }, [drill.level, racMetricCells, baseMetricCells, categoryMetricCells]);

  const chartTitle = useMemo(() => {
    if (drill.level === KPI_FINANCIAL_DRILL_CATEGORY) {
      return `${title} by land category (M) — ${drill.baseLabel || "Base"}`;
    }
    if (drill.level === KPI_FINANCIAL_DRILL_BASE) {
      return `${title} by base (M) — ${drill.racLabel || "RAC"}`;
    }
    return `${title} by RAC`;
  }, [title, drill]);

  const exportChart = useMemo(
    () => buildFinancialMetricBarChart(activeCells, metricConfig.datasetLabel),
    [activeCells, metricConfig.datasetLabel]
  );

  const barChartData = useMemo(
    () => ({
      labels: exportChart.labels,
      datasets: withKpiOverviewWideBarDatasets([
        {
          label: metricConfig.datasetLabel,
          data: exportChart.datasets.data.map((value) => nullIfZeroChartBarValue(value)),
          backgroundColor: seriesColor,
          borderRadius: 6,
          borderSkipped: false,
        },
      ]),
    }),
    [exportChart, metricConfig.datasetLabel, seriesColor]
  );

  const barChartOptions = useMemo(() => {
    const base = {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index", intersect: false },
      ...KPI_OVERVIEW_WIDE_BAR_OPTIONS,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const raw = ctx.raw;
              if (raw == null || raw === 0) return null;
              return `${ctx.label}: ${formatKpiCrosshairBarValue(raw)}`;
            },
          },
        },
      },
      ...(isZoomed
        ? {
            layout: {
              padding: { bottom: 4, left: 4, right: 4 },
            },
          }
        : {}),
      scales: {
        x: {
          grid: { display: false },
          ticks: {
            color: textColor,
            autoSkip: isZoomed ? false : true,
            maxRotation: 45,
            minRotation: 0,
            font: { size: isZoomed ? 12 : 11, weight: "bold" },
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
            text: "Amount (M)",
            color: textColor,
            font: { size: 12, weight: "600" },
          },
        },
      },
    };

    return applyKpiCrosshairBarChartEnhancements(base, {
      darkMode,
      formatValue: formatKpiCrosshairBarValue,
      fontSize: isZoomed ? 15 : 13,
      labelPlacement: "inside",
      insideLabelColor: chartColors.insideLabelColor,
      insideTextShadowColor: chartColors.insideLabelShadow,
    });
  }, [darkMode, textColor, gridColor, isZoomed, chartColors]);

  const handleBarClick = useCallback(
    (_event, elements) => {
      if (!elements?.length || loading) return;

      const index = elements[0].index;
      if (drill.level === KPI_FINANCIAL_DRILL_RAC) {
        const cell = racMetricCells[index];
        if (!cell?.key || cell.key === "all") return;
        onDrillChange({
          level: KPI_FINANCIAL_DRILL_BASE,
          racId: cell.key,
          racLabel: cell.chartLabel,
        });
        return;
      }

      if (drill.level === KPI_FINANCIAL_DRILL_BASE) {
        const cell = baseMetricCells[index];
        if (!cell?.key || cell.key === "all" || cell.key === KPI_GOVT_PAF_UNASSIGNED_BASE_KEY) {
          return;
        }
        onDrillChange({
          level: KPI_FINANCIAL_DRILL_CATEGORY,
          racId: drill.racId,
          racLabel: drill.racLabel,
          baseId: cell.key,
          baseLabel: cell.chartLabel,
        });
      }
    },
    [loading, drill, racMetricCells, baseMetricCells, onDrillChange]
  );

  const barOptionsWithDrill = useMemo(
    () => ({
      ...barChartOptions,
      onClick: handleBarClick,
      onHover: (event, elements) => {
        const target = event.native?.target;
        if (!target) return;
        const drillable =
          drill.level !== KPI_FINANCIAL_DRILL_CATEGORY && elements?.length > 0 && !loading;
        target.style.cursor = drillable ? "pointer" : "default";
      },
    }),
    [barChartOptions, handleBarClick, drill.level, loading]
  );

  const handleDrillNavigate = useCallback(
    (targetLevel) => {
      if (targetLevel === KPI_FINANCIAL_DRILL_RAC) {
        onDrillChange(KPI_FINANCIAL_DRILL_INITIAL);
        return;
      }
      if (targetLevel === KPI_FINANCIAL_DRILL_BASE && drill.racId) {
        onDrillChange({
          level: KPI_FINANCIAL_DRILL_BASE,
          racId: drill.racId,
          racLabel: drill.racLabel,
        });
      }
    },
    [drill.racId, drill.racLabel, onDrillChange]
  );

  const renderDrillNav = () => (
    <MDBox minWidth={0}>
      {drill.level !== KPI_FINANCIAL_DRILL_RAC ? (
        <Breadcrumbs
          aria-label={`${title} chart drill-down`}
          sx={{
            mt: isZoomed ? 0 : 0.5,
            "& .MuiBreadcrumbs-li": { fontSize: isZoomed ? "0.875rem" : "0.75rem" },
          }}
        >
          <Link
            component="button"
            type="button"
            underline="hover"
            color="info"
            sx={{ border: 0, background: "none", cursor: "pointer", p: 0, font: "inherit" }}
            onClick={() => handleDrillNavigate(KPI_FINANCIAL_DRILL_RAC)}
          >
            All RACs
          </Link>
          {drill.racLabel ? (
            drill.level === KPI_FINANCIAL_DRILL_CATEGORY ? (
              <Link
                component="button"
                type="button"
                underline="hover"
                color="info"
                sx={{ border: 0, background: "none", cursor: "pointer", p: 0, font: "inherit" }}
                onClick={() => handleDrillNavigate(KPI_FINANCIAL_DRILL_BASE)}
              >
                {drill.racLabel}
              </Link>
            ) : (
              <MDTypography variant={isZoomed ? "body2" : "caption"} color="text">
                {drill.racLabel}
              </MDTypography>
            )
          ) : null}
          {drill.level === KPI_FINANCIAL_DRILL_CATEGORY && drill.baseLabel ? (
            <MDTypography variant={isZoomed ? "body2" : "caption"} color="text">
              {drill.baseLabel}
            </MDTypography>
          ) : null}
        </Breadcrumbs>
      ) : (
        <MDTypography
          variant={isZoomed ? "body2" : "caption"}
          color="text"
          sx={{ display: "block", mt: isZoomed ? 0 : 0.25 }}
        >
          Click a bar to drill down by base
        </MDTypography>
      )}
      {drill.level === KPI_FINANCIAL_DRILL_BASE ? (
        <MDTypography
          variant={isZoomed ? "body2" : "caption"}
          color="text"
          sx={{ display: "block", mt: 0.25 }}
        >
          Click a bar to drill down by land category
        </MDTypography>
      ) : null}
    </MDBox>
  );

  const chartHeight = isZoomed ? "100%" : "220px";

  const chartBody = (
    <MDBox
      sx={{
        height: chartHeight,
        width: "100%",
        minHeight: isZoomed ? 0 : 200,
        flex: isZoomed ? "1 1 auto" : undefined,
      }}
    >
      <Bar
        key={`${drill.level}-${drill.racId ?? ""}-${drill.baseId ?? ""}`}
        data={barChartData}
        options={barOptionsWithDrill}
      />
    </MDBox>
  );

  if (isZoomed) {
    return (
      <MDBox display="flex" flexDirection="column" height="100%" minHeight={0}>
        <MDBox
          display="flex"
          alignItems="flex-start"
          justifyContent="space-between"
          gap={1}
          mb={1}
          flexShrink={0}
        >
          <MDBox minWidth={0} flex={1}>
            {renderDrillNav()}
          </MDBox>
          <ChartExportButton
            disabled={loading}
            ariaLabel={`Export ${chartTitle} to Excel`}
            onExport={() => exportSingleSeriesBarChartToExcel(chartTitle, exportChart)}
          />
        </MDBox>
        <MDBox flex={1} minHeight={0} display="flex" flexDirection="column">
          {chartBody}
        </MDBox>
      </MDBox>
    );
  }

  return (
    <Card sx={{ ...cardSx, p: 2, height: "100%" }}>
      <MDBox
        display="flex"
        alignItems="flex-start"
        justifyContent="space-between"
        gap={0.5}
        mb={0.5}
      >
        <MDBox minWidth={0}>
          <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
            {chartTitle}
          </MDTypography>
          {description ? (
            <MDTypography variant="caption" color="text" display="block">
              {description}
            </MDTypography>
          ) : null}
          {renderDrillNav()}
        </MDBox>
        <MDBox display="flex" alignItems="center" gap={0.5} flexShrink={0}>
          {zoomKey && onZoom ? (
            <IconButton
              size="small"
              aria-label={`Enlarge ${title} chart`}
              disabled={loading}
              onClick={() => onZoom(zoomKey)}
            >
              <Icon fontSize="small">zoom_in</Icon>
            </IconButton>
          ) : null}
          <ChartExportButton
            disabled={loading}
            ariaLabel={`Export ${chartTitle} to Excel`}
            onExport={() => exportSingleSeriesBarChartToExcel(chartTitle, exportChart)}
          />
        </MDBox>
      </MDBox>
      {chartBody}
    </Card>
  );
}

FinancialMetricDrillChart.propTypes = {
  metricConfig: PropTypes.shape({
    id: PropTypes.string.isRequired,
    datasetLabel: PropTypes.string.isRequired,
  }).isRequired,
  shareRows: PropTypes.array,
  propertyRows: PropTypes.array,
  contractRows: PropTypes.array,
  agreementContractRows: PropTypes.array,
  useAsOfContracts: PropTypes.bool,
  contractMetaById: PropTypes.object,
  racOptions: PropTypes.array,
  baseOptions: PropTypes.array,
  allBases: PropTypes.array,
  racIds: PropTypes.array,
  tenure: PropTypes.string,
  cardSx: PropTypes.object.isRequired,
  loading: PropTypes.bool,
  darkMode: PropTypes.bool,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  seriesColor: PropTypes.string.isRequired,
  zoomKey: PropTypes.string,
  onZoom: PropTypes.func,
  drill: PropTypes.shape({
    level: PropTypes.string.isRequired,
    racId: PropTypes.string,
    racLabel: PropTypes.string,
    baseId: PropTypes.string,
    baseLabel: PropTypes.string,
  }).isRequired,
  onDrillChange: PropTypes.func.isRequired,
  isZoomed: PropTypes.bool,
  preferSpGovtPafShare: PropTypes.bool,
};

FinancialMetricDrillChart.defaultProps = {
  shareRows: [],
  propertyRows: [],
  contractRows: [],
  agreementContractRows: [],
  useAsOfContracts: false,
  contractMetaById: undefined,
  racOptions: [],
  baseOptions: [],
  allBases: [],
  racIds: [],
  tenure: "Annual",
  loading: false,
  darkMode: false,
  description: "",
  zoomKey: undefined,
  onZoom: undefined,
  isZoomed: false,
  preferSpGovtPafShare: false,
};

export default FinancialMetricDrillChart;
