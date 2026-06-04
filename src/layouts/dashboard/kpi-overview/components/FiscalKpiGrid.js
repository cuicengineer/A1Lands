import { useCallback, useMemo } from "react";
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
import Collapse from "@mui/material/Collapse";
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
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import { useMaterialUIController } from "context";
import { getEnterpriseCardSx } from "./KpiCharts";
import ChartExportButton from "./ChartExportButton";
import { exportGroupedBarChartDataToExcel } from "utils/kpiChartExcelExport";
import { formatKpiMoneyLabel } from "../kpiDataUtils";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

/** Draws each segment’s value (Mil) on stacked fiscal share bars. */
const fiscalShareStackLabelsPlugin = {
  id: "fiscalShareStackLabels",
  afterDatasetsDraw(chart) {
    const cfg = chart.options.plugins?.fiscalShareStackLabels;
    if (cfg?.enabled === false) return;
    const { ctx } = chart;
    const minPx = cfg?.minSegmentPx ?? 14;
    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden === true) return;
      meta.data.forEach((element, index) => {
        const raw = dataset.data[index];
        const value = Number(raw);
        if (!Number.isFinite(value) || value <= 0) return;
        const { x, y, base } = element.getProps(["x", "y", "base"], true);
        if (x == null || y == null || base == null) return;
        const h = Math.abs(base - y);
        if (h < minPx) return;
        const midY = (y + base) / 2;
        const text = value.toLocaleString(undefined, { maximumFractionDigits: 2 });
        ctx.save();
        ctx.font = cfg?.font ?? "bold 11px system-ui,-apple-system,sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = cfg?.color ?? "rgba(255,255,255,0.96)";
        ctx.shadowColor = "rgba(0,0,0,0.45)";
        ctx.shadowBlur = 3;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 1;
        ctx.fillText(text, x, midY);
        ctx.restore();
      });
    });
  },
};

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

function FiscalKpiGrid({ rows, fiscalPeriods, expanded, onToggleExpanded, loading }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;

  const periods = fiscalPeriods || [];

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
    XLSX.writeFile(wb, `Fiscal-KPIs-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }, [rows, periods]);

  const cardSx = getEnterpriseCardSx();
  const headerBg = darkMode ? "rgba(255,255,255,0.06)" : "#f4f6f8";
  const stickyBg = darkMode ? "#1e1e1e" : "#ffffff";
  const rowBorder = darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)";
  const tableShellBorder = darkMode ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.08)";

  /** Fixed widths so `table-layout: fixed` keeps header and body cells aligned. */
  const kpiColWidthPx = 212;
  const fiscalPeriodColWidthPx = 96;
  const tableWidthPx = kpiColWidthPx + periods.length * fiscalPeriodColWidthPx;

  const kpiColWidthSx = {
    width: kpiColWidthPx,
    minWidth: kpiColWidthPx,
    maxWidth: kpiColWidthPx,
    overflow: "hidden",
  };

  const fiscalPeriodColSx = {
    width: fiscalPeriodColWidthPx,
    minWidth: fiscalPeriodColWidthPx,
    maxWidth: fiscalPeriodColWidthPx,
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
    ...stickyCellSx,
    zIndex: 4,
    backgroundColor: headerBg,
    fontWeight: 700,
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

  const shareStackChartData = useMemo(() => {
    const ahq = rows.find((r) => r.id === "fiscal-ahq");
    const rac = rows.find((r) => r.id === "fiscal-rac");
    const base = rows.find((r) => r.id === "fiscal-base");
    return {
      labels: periods.map((p) => p.headerLabel),
      datasets: [
        {
          label: "AHQ Share",
          data: periods.map((p) => fiscalRowMil(ahq, p.fieldKey)),
          backgroundColor: "#1976d2",
          borderRadius: 2,
        },
        {
          label: "RAC Share",
          data: periods.map((p) => fiscalRowMil(rac, p.fieldKey)),
          backgroundColor: "#ed6c02",
          borderRadius: 2,
        },
        {
          label: "Base Share",
          data: periods.map((p) => fiscalRowMil(base, p.fieldKey)),
          backgroundColor: "#2e7d32",
          borderRadius: 2,
        },
      ],
    };
  }, [rows, periods]);

  const shareStackChartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "x",
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: {
          position: "bottom",
          labels: { color: textColor, boxWidth: 12, padding: 12, font: { size: 11 } },
        },
        tooltip: {
          mode: "index",
          intersect: false,
          callbacks: {
            label: (ctx) => `${ctx.dataset.label}: ${formatKpiMoneyLabel(Number(ctx.raw) || 0)}`,
            footer: (items) => {
              const sum = items.reduce((a, it) => a + (Number(it.raw) || 0), 0);
              return `Total: ${formatKpiMoneyLabel(sum)}`;
            },
          },
        },
        fiscalShareStackLabels: {
          enabled: true,
          minSegmentPx: 14,
          color: darkMode ? "rgba(255,255,255,0.96)" : "rgba(255,255,255,0.98)",
          font: "bold 11px system-ui,-apple-system,sans-serif",
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { color: gridColor },
          ticks: { color: textColor, maxRotation: 45, minRotation: 0 },
          title: {
            display: true,
            text: "Fiscal year",
            color: textColor,
            font: { size: 12, weight: "600" },
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: gridColor },
          ticks: { color: textColor },
          title: {
            display: true,
            text: "Amount (M. / B.)",
            color: textColor,
            font: { size: 12, weight: "600" },
          },
        },
      },
    }),
    [darkMode, gridColor, textColor]
  );

  return (
    <Card sx={{ ...cardSx, overflow: "hidden" }}>
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        px={2}
        py={1.5}
        sx={{ cursor: "pointer" }}
        onClick={onToggleExpanded}
      >
        <MDTypography variant="h6" fontWeight="bold" color={darkMode ? "white" : "dark"}>
          KPI Analytics — Fiscal Years
        </MDTypography>
        <IconButton size="small" aria-label="toggle analytics grid">
          <Icon>{expanded ? "expand_less" : "expand_more"}</Icon>
        </IconButton>
      </MDBox>
      <Collapse in={expanded}>
        <MDBox px={2} pb={1} display="flex" justifyContent="flex-end">
          <MDButton variant="outlined" color="info" size="small" onClick={handleExport}>
            <Icon sx={{ mr: 0.5, fontSize: "1rem !important" }}>download</Icon>
            Export Excel
          </MDButton>
        </MDBox>
        <TableContainer
          sx={{
            mx: 2,
            mb: 2,
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
              sx={{
                tableLayout: "fixed",
                width: tableWidthPx,
                minWidth: tableWidthPx,
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
                <col style={{ width: kpiColWidthPx }} />
                {periods.map((p) => (
                  <col key={p.fieldKey} style={{ width: fiscalPeriodColWidthPx }} />
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
                      sx={{ ...fiscalNumericHeaderSx, ...fiscalPeriodColSx }}
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
              <MDTypography variant="button" fontWeight="bold" color={darkMode ? "white" : "dark"}>
                AHQ / RAC / Base share by fiscal year (M.)
              </MDTypography>
              <ChartExportButton
                disabled={loading}
                ariaLabel="Export fiscal share chart to Excel"
                onExport={() =>
                  exportGroupedBarChartDataToExcel(
                    "AHQ RAC Base share by fiscal year",
                    shareStackChartData
                  )
                }
              />
            </MDBox>
            <MDBox height={280} sx={{ position: "relative" }}>
              <Bar
                data={shareStackChartData}
                options={shareStackChartOptions}
                plugins={[fiscalShareStackLabelsPlugin]}
              />
            </MDBox>
          </MDBox>
        )}
      </Collapse>
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
};

FiscalKpiGrid.defaultProps = {
  loading: false,
};

export default FiscalKpiGrid;
