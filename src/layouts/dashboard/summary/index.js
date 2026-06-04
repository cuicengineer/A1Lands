/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

// @mui material components
import Grid from "@mui/material/Grid";
import CurrencyLoading from "components/CurrencyLoading";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

import PieChart from "examples/Charts/PieChart";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import { CHART_PRIMARY } from "utils/executiveChartConfigs";
import DashboardKpiCard from "components/DashboardKpiCard";
import DashboardChartPanel from "components/DashboardChartPanel";
import DashboardPageShell from "layouts/dashboard/components/DashboardPageShell";

import api from "services/api.service";

/** Read numeric total-lands style fields from varied API / JSON.NET shapes. */
function readTotalProperties(row) {
  if (!row || typeof row !== "object") return null;
  const keys = [
    "TotalProperties",
    "totalProperties",
    "Total_Lands",
    "totalLands",
    "total_lands",
    "TotalLands",
  ];
  for (const k of keys) {
    if (row[k] === undefined || row[k] === null) continue;
    const n = Number(row[k]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Read area from PropertySummary row (PascalCase / camelCase). */
function readPropertySummaryArea(row) {
  if (!row || typeof row !== "object") return null;
  const keys = ["Area", "area", "TotalArea", "totalArea"];
  for (const k of keys) {
    if (row[k] === undefined || row[k] === null || row[k] === "") continue;
    const n = Number(row[k]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Read unit of measure from PropertySummary row. */
function readPropertySummaryUom(row) {
  if (!row || typeof row !== "object") return "";
  const keys = [
    "UoM",
    "uom",
    "UOM",
    "Uom",
    "UnitName",
    "unitName",
    "UnitOfMeasure",
    "unitOfMeasure",
  ];
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

function formatPropertySummaryAreaValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/** e.g. "123 (Marla), 1,298 (Acre)" */
function formatAreasByUomLine(areasByUom) {
  if (!areasByUom || typeof areasByUom !== "object") return "";
  const parts = Object.entries(areasByUom)
    .filter(([, area]) => Number.isFinite(area))
    .sort(([uomA], [uomB]) => uomA.localeCompare(uomB))
    .map(([uom, area]) => `${formatPropertySummaryAreaValue(area)} (${uom})`);
  return parts.join(", ");
}

/** Read revenue-in-millions from varied naming (PascalCase, camelCase, ASP.NET defaults). */
function readTotalRevenueMillion(row) {
  if (!row || typeof row !== "object") return null;
  const keys = [
    "TotalRevenue_Million",
    "totalRevenue_Million",
    "TotalRevenueMillion",
    "totalRevenueMillion",
    "totalRevenue_Millions",
    "TotalRevenue",
    "totalRevenue",
  ];
  for (const k of keys) {
    if (row[k] === undefined || row[k] === null) continue;
    const n = Number(row[k]);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

const DATA_SET_PROPERTY_SUMMARY = "PropertySummary";
const DATA_SET_CONTRACTS_SUMMARY = "ContractsSummary";
const DATA_SET_GOVT_PAF_SHARE = "GovtPAFShare";

/** ClassId values 1–5 → labels in Govt/PAF share filter dropdown. */
const GOVT_PAF_CLASS_ID_LABELS = {
  1: "A",
  2: "B",
  3: "C",
  4: "BTS",
  5: "HB",
};

function getGovtPafClassIdLabel(classId) {
  const n = Number(classId);
  if (!Number.isFinite(n)) return String(classId);
  const label = GOVT_PAF_CLASS_ID_LABELS[n];
  return label != null ? label : String(n);
}

function isPropertySummaryRow(row) {
  if (!row || typeof row !== "object") return false;
  const n = row.DataSetName ?? row.dataSetName;
  return String(n) === DATA_SET_PROPERTY_SUMMARY;
}

function isContractsSummaryRow(row) {
  if (!row || typeof row !== "object") return false;
  const n = row.DataSetName ?? row.dataSetName;
  return String(n) === DATA_SET_CONTRACTS_SUMMARY;
}

function isGovtPafShareRow(row) {
  if (!row || typeof row !== "object") return false;
  const n = row.DataSetName ?? row.dataSetName;
  return String(n) === DATA_SET_GOVT_PAF_SHARE;
}

/** Second (or any) result set: rows with DataSetName === "ContractsSummary". */
function extractContractsSummaryRows(payload) {
  if (payload == null || typeof payload !== "object") return [];

  const root = payload.data ?? payload.Data ?? payload.result ?? payload.Result ?? payload;

  const resultSets = root.resultSets ?? root.ResultSets ?? payload.resultSets ?? payload.ResultSets;
  if (Array.isArray(resultSets)) {
    for (const inner of resultSets) {
      if (!Array.isArray(inner) || inner.length === 0) continue;
      const first = inner[0];
      if (first && typeof first === "object" && isContractsSummaryRow(first)) {
        return inner.filter(isContractsSummaryRow);
      }
    }
  }

  return [];
}

/** Result set where rows have DataSetName === "GovtPAFShare". */
function extractGovtPafShareRows(payload) {
  if (payload == null || typeof payload !== "object") return [];

  const root = payload.data ?? payload.Data ?? payload.result ?? payload.Result ?? payload;

  const resultSets = root.resultSets ?? root.ResultSets ?? payload.resultSets ?? payload.ResultSets;
  if (Array.isArray(resultSets)) {
    for (const inner of resultSets) {
      if (!Array.isArray(inner) || inner.length === 0) continue;
      const first = inner[0];
      if (first && typeof first === "object" && isGovtPafShareRow(first)) {
        return inner.filter(isGovtPafShareRow);
      }
    }
  }

  return [];
}

/** Pie chart: sum GovtShare / PAFShare; optional filter by ClassId ("all" = every row). */
function buildShareChartDataFromGovtPafRows(rows, classIdFilter) {
  const base = {
    labels: ["Govt Share", "PAF Share"],
    datasets: {
      label: "Share Distribution",
      data: [0, 0],
      backgroundColors: ["#F5A524", "#025B64"],
    },
  };

  if (!Array.isArray(rows) || rows.length === 0) {
    return base;
  }

  let filtered = rows.filter(isGovtPafShareRow);
  if (
    classIdFilter != null &&
    classIdFilter !== "" &&
    classIdFilter !== "all" &&
    String(classIdFilter).toLowerCase() !== "all"
  ) {
    const cid = Number(classIdFilter);
    if (Number.isFinite(cid)) {
      filtered = filtered.filter((r) => Number(r.ClassId ?? r.classId) === cid);
    }
  }

  let govt = 0;
  let paf = 0;
  for (const r of filtered) {
    const g = Number(r.GovtShare ?? r.govtShare);
    const p = Number(r.PAFShare ?? r.pafShare);
    if (Number.isFinite(g)) govt += g;
    if (Number.isFinite(p)) paf += p;
  }

  return {
    labels: base.labels,
    datasets: {
      ...base.datasets,
      data: [govt, paf],
    },
  };
}

function uniqueClassIdsFromGovtPafRows(rows) {
  if (!Array.isArray(rows)) return [];
  const s = new Set();
  for (const r of rows) {
    if (!isGovtPafShareRow(r)) continue;
    const cid = r.ClassId ?? r.classId;
    if (cid != null && cid !== "") s.add(Number(cid));
  }
  return Array.from(s)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}

/** Sum contract counts across Cmd/Base groups for status stickers. */
function buildStatusDataFromContractsRows(rows) {
  const empty = [
    { label: "Active Contracts", count: 0 },
    { label: "Expired Contracts", count: 0 },
    { label: "Border Line Contracts", count: 0 },
    { label: "Closed Contracts", count: 0 },
  ];
  if (!Array.isArray(rows) || rows.length === 0) {
    return empty;
  }

  let active = 0;
  let expired = 0;
  let borderLine = 0;
  let closed = 0;

  for (const r of rows) {
    if (!isContractsSummaryRow(r)) continue;
    const a = Number(r.ActiveContracts ?? r.activeContracts);
    const e = Number(r.ExpiredContracts ?? r.expiredContracts);
    const b = Number(r.BorderLineContracts ?? r.borderLineContracts);
    const c = Number(r.ClosedContracts ?? r.closedContracts);
    if (Number.isFinite(a)) active += a;
    if (Number.isFinite(e)) expired += e;
    if (Number.isFinite(b)) borderLine += b;
    if (Number.isFinite(c)) closed += c;
  }

  return [
    { label: "Active Contracts", count: active },
    { label: "Expired Contracts", count: expired },
    { label: "Border Line", count: borderLine },
    { label: "Closed Contracts", count: closed },
  ];
}

/**
 * API shape: { "resultSets": [ [ { DataSetName, PropertyCount, ClassRevenue_Million, ... }, ... ], [ ContractsSummary... ], ... ] }
 * First result set: rows with DataSetName === "PropertySummary" on each object.
 */
function extractPropertySummaryRows(payload) {
  if (payload == null || typeof payload !== "object") return [];

  const root = payload.data ?? payload.Data ?? payload.result ?? payload.Result ?? payload;

  const resultSets = root.resultSets ?? root.ResultSets ?? payload.resultSets ?? payload.ResultSets;
  if (Array.isArray(resultSets)) {
    for (const inner of resultSets) {
      if (!Array.isArray(inner) || inner.length === 0) continue;
      const first = inner[0];
      if (first && typeof first === "object" && isPropertySummaryRow(first)) {
        return inner.filter(isPropertySummaryRow);
      }
    }
  }

  const tryRow = (row) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) return null;
    if (readTotalProperties(row) != null || readTotalRevenueMillion(row) != null) return row;
    return null;
  };

  let hit = tryRow(payload) || tryRow(root);
  if (hit) return [hit];

  const ps = root.PropertySummary ?? root.propertySummary ?? payload.PropertySummary;
  if (ps != null) {
    if (Array.isArray(ps) && ps.length) {
      hit = tryRow(ps[0]);
      if (hit) return [hit];
      if (ps[0] && typeof ps[0] === "object") return [ps[0]];
    } else if (typeof ps === "object") {
      hit = tryRow(ps);
      if (hit) return [hit];
      return [ps];
    }
  }

  if (Array.isArray(root) && root.length && root[0] && typeof root[0] === "object") {
    hit = tryRow(root[0]);
    if (hit) return [hit];
    return [root[0]];
  }
  if (Array.isArray(payload) && payload.length && payload[0] && typeof payload[0] === "object") {
    hit = tryRow(payload[0]);
    if (hit) return [hit];
    return [payload[0]];
  }

  const collections = [
    root.DataSets,
    root.dataSets,
    root.Tables,
    root.tables,
    root.Data,
    root.data,
  ].filter(Boolean);

  for (const col of collections) {
    const list = Array.isArray(col) ? col : [col];
    for (const ds of list) {
      if (!ds || typeof ds !== "object") continue;
      const name = String(ds.DataSetName ?? ds.dataSetName ?? "").trim();
      if (name && name !== DATA_SET_PROPERTY_SUMMARY) continue;
      const rows = ds.Rows ?? ds.rows ?? ds.Data ?? ds.data;
      if (Array.isArray(rows) && rows.length > 0) {
        if (name === DATA_SET_PROPERTY_SUMMARY) return rows;
        const withFields = rows.find((r) => tryRow(r));
        if (withFields) return [withFields];
      }
    }
  }

  return [];
}

/** ClassId on PropertySummary rows → sticker keys (align with backend class ids). */
const PROPERTY_CLASS_ID_TO_STICKER = {
  2: "categoryA",
  3: "categoryB",
  4: "categoryC",
  9: "bts",
  6: "hb",
};

/** Shown only after API resolves when there are no rows (no placeholder flash). */
const EMPTY_SUMMARY_DATA = {
  total: { value: 0, amount: 0, label: "Total Worth" },
  categoryA: { value: 0, amount: 0 },
  categoryB: { value: 0, amount: 0 },
  categoryC: { value: 0, amount: 0 },
  bts: { value: 0, amount: 0 },
  hb: { value: 0, amount: 0 },
};

function SummarySectionLoader({ minHeight }) {
  return (
    <MDBox
      display="flex"
      justifyContent="center"
      alignItems="center"
      minHeight={minHeight}
      width="100%"
    >
      <CurrencyLoading size={50} />
    </MDBox>
  );
}

SummarySectionLoader.defaultProps = {
  minHeight: 160,
};

SummarySectionLoader.propTypes = {
  minHeight: PropTypes.number,
};

/** Build summaryData from PropertySummary rows (PropertyCount / ClassRevenue_Million per row; group by ClassId). */
function buildSummaryDataFromPropertyRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return EMPTY_SUMMARY_DATA;
  }

  const z = EMPTY_SUMMARY_DATA;
  let sumPropertyCount = 0;
  let sumClassRevenueMillion = 0;
  const byClassId = {};

  for (const r of rows) {
    if (!isPropertySummaryRow(r)) continue;

    const pc = Number(r.PropertyCount ?? r.propertyCount);
    const cr = Number(r.ClassRevenue_Million ?? r.classRevenue_Million);
    if (Number.isFinite(pc)) sumPropertyCount += pc;
    if (Number.isFinite(cr)) sumClassRevenueMillion += cr;

    const cid = Number(r.ClassId ?? r.classId);
    if (!Number.isFinite(cid)) continue;
    if (!byClassId[cid]) byClassId[cid] = { value: 0, amount: 0, areasByUom: {} };
    if (Number.isFinite(pc)) byClassId[cid].value += pc;
    if (Number.isFinite(cr)) byClassId[cid].amount += cr;

    const areaVal = readPropertySummaryArea(r);
    if (Number.isFinite(areaVal)) {
      const uomLabel = readPropertySummaryUom(r) || "—";
      byClassId[cid].areasByUom[uomLabel] = (byClassId[cid].areasByUom[uomLabel] || 0) + areaVal;
    }
  }

  const out = {
    total: {
      value: sumPropertyCount,
      amount: sumClassRevenueMillion,
      label: "Total Worth",
    },
    categoryA: { ...z.categoryA },
    categoryB: { ...z.categoryB },
    categoryC: { ...z.categoryC },
    bts: { ...z.bts },
    hb: { ...z.hb },
  };

  for (const [classIdStr, stickerKey] of Object.entries(PROPERTY_CLASS_ID_TO_STICKER)) {
    const cid = Number(classIdStr);
    const agg = byClassId[cid];
    if (agg) {
      out[stickerKey] = {
        value: agg.value,
        amount: agg.amount,
        areaLine: formatAreasByUomLine(agg.areasByUom),
      };
    }
  }

  return out;
}

/** ERP chart palette — max 6 segments */
const SUMMARY_CATEGORY_COLORS = {
  A: "#025B64",
  B: "#00D47E",
  C: "#F5A524",
  BTS: "#F31260",
  HB: "#3B82F6",
};

function SummaryOfA1Activities() {
  const [propertySummaryRows, setPropertySummaryRows] = useState([]);
  const [contractsSummaryRows, setContractsSummaryRows] = useState([]);
  const [govtPafShareRows, setGovtPafShareRows] = useState([]);
  const [propertySummaryReady, setPropertySummaryReady] = useState(false);
  const [shareClassIdFilter, setShareClassIdFilter] = useState("all");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.request("GET", "/api/Dashboards/property-summary");
        if (!cancelled) {
          setPropertySummaryRows(extractPropertySummaryRows(data));
          setContractsSummaryRows(extractContractsSummaryRows(data));
          setGovtPafShareRows(extractGovtPafShareRows(data));
        }
      } catch (e) {
        if (!cancelled) console.error(e);
      } finally {
        if (!cancelled) {
          setPropertySummaryReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summaryData = useMemo(() => {
    if (!propertySummaryReady) return null;
    return buildSummaryDataFromPropertyRows(propertySummaryRows);
  }, [propertySummaryReady, propertySummaryRows]);

  const statusData = useMemo(() => {
    if (!propertySummaryReady) return null;
    return buildStatusDataFromContractsRows(contractsSummaryRows);
  }, [propertySummaryReady, contractsSummaryRows]);

  const shareClassIdOptions = useMemo(
    () => uniqueClassIdsFromGovtPafRows(govtPafShareRows),
    [govtPafShareRows]
  );

  const shareChartData = useMemo(() => {
    if (!propertySummaryReady) {
      return buildShareChartDataFromGovtPafRows([], "all");
    }
    return buildShareChartDataFromGovtPafRows(govtPafShareRows, shareClassIdFilter);
  }, [propertySummaryReady, govtPafShareRows, shareClassIdFilter]);

  const categoryChartData = useMemo(() => {
    const base = {
      labels: ["A", "B", "C", "BTS", "HB"],
      datasets: {
        label: "Category Distribution",
        data: [0, 0, 0, 0, 0],
        backgroundColor: [
          SUMMARY_CATEGORY_COLORS.A,
          SUMMARY_CATEGORY_COLORS.B,
          SUMMARY_CATEGORY_COLORS.C,
          SUMMARY_CATEGORY_COLORS.BTS,
          SUMMARY_CATEGORY_COLORS.HB,
        ],
      },
    };
    if (!propertySummaryReady || !summaryData) {
      return base;
    }
    const s = summaryData;
    return {
      ...base,
      datasets: {
        ...base.datasets,
        data: [s.categoryA.value, s.categoryB.value, s.categoryC.value, s.bts.value, s.hb.value],
      },
    };
  }, [propertySummaryReady, summaryData]);

  const propertyKpiItems = [
    {
      key: "total",
      label: "Lands",
      data: summaryData?.total,
      icon: "properties",
      variant: "primary",
    },
    { key: "categoryA", label: "CAT A", data: summaryData?.categoryA, icon: "category" },
    { key: "categoryB", label: "CAT B", data: summaryData?.categoryB, icon: "category" },
    { key: "categoryC", label: "CAT C", data: summaryData?.categoryC, icon: "category" },
    { key: "bts", label: "BTS", data: summaryData?.bts, icon: "signal_cellular_alt" },
    { key: "hb", label: "HB", data: summaryData?.hb, icon: "home" },
  ];

  const statusMeta = {
    "Active Contracts": { icon: "contracts", trendVariant: "positive" },
    "Expired Contracts": { icon: "schedule", trendVariant: "negative" },
    "Border Line": { icon: "warning", trendVariant: "neutral" },
    "Border Line Contracts": { icon: "warning", trendVariant: "neutral" },
    "Closed Contracts": { icon: "archive", trendVariant: "neutral" },
  };

  return (
    <DashboardPageShell
      title="Summary"
      subtitle="Property, contract, and share distribution from live dashboard data"
    >
      <Grid container spacing={1}>
        <Grid item xs={12}>
          {!propertySummaryReady || !summaryData ? (
            <SummarySectionLoader minHeight={160} />
          ) : (
            <Grid container spacing={1} className="erp-dashboard-kpi-grid">
              {propertyKpiItems.map((item, itemIndex) => {
                const showAreaLine = item.key !== "total" && Boolean(item.data?.areaLine);
                const valueNode = showAreaLine ? (
                  <MDBox component="span" display="block">
                    <MDBox component="span" display="block">
                      {item.data.value}
                    </MDBox>
                    <MDTypography
                      component="span"
                      className="erp-kpi-card__subtext"
                      sx={{ display: "block", mt: 0.5 }}
                    >
                      Area: {item.data.areaLine}
                    </MDTypography>
                  </MDBox>
                ) : (
                  item.data?.value ?? "—"
                );

                return (
                  <Grid item xs={12} sm={6} md={4} lg={2} key={item.key}>
                    <DashboardKpiCard
                      label={item.label}
                      value={valueNode}
                      trend={`Worth: ${Number(item.data?.amount || 0).toFixed(2)} Mil`}
                      variant={itemIndex === 0 || item.variant === "primary" ? "primary" : "default"}
                      icon={item.icon}
                    />
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Grid>

        <Grid item xs={12}>
          <p className="erp-dashboard-section-title">Contract status</p>
          {!propertySummaryReady || !statusData ? (
            <SummarySectionLoader minHeight={120} />
          ) : (
            <Grid container spacing={1} className="erp-dashboard-kpi-grid">
              {statusData.map((status, statusIndex) => {
                const meta = statusMeta[status.label] || {
                  icon: "info",
                  trendVariant: "neutral",
                };
                return (
                  <Grid item xs={12} sm={6} md={3} key={status.label}>
                    <DashboardKpiCard
                      className="erp-status-card"
                      label={status.label}
                      value={status.count.toLocaleString()}
                      trend={status.label}
                      trendVariant={meta.trendVariant}
                      icon={meta.icon}
                      variant={statusIndex === 0 ? "primary" : "default"}
                    />
                  </Grid>
                );
              })}
            </Grid>
          )}
        </Grid>

        <Grid item xs={12}>
          <p className="erp-dashboard-section-title erp-dashboard-section-title--spaced">
            Analytics
          </p>
          <Grid container spacing={1}>
            <Grid item xs={12} md={4}>
              <DashboardChartPanel
                title="Share Distribution"
                description="Govt Share vs PAF Share"
                headerAction={
                  <FormControl size="small" className="erp-dashboard-filter" sx={{ minWidth: 100 }}>
                    <InputLabel id="govt-paf-class-filter-label">Class</InputLabel>
                    <Select
                      labelId="govt-paf-class-filter-label"
                      label="Class"
                      value={shareClassIdFilter}
                      onChange={(e) => setShareClassIdFilter(e.target.value)}
                      renderValue={(val) => (val === "all" ? "All" : getGovtPafClassIdLabel(val))}
                    >
                      <MenuItem value="all">All</MenuItem>
                      {shareClassIdOptions.map((id) => (
                        <MenuItem key={id} value={String(id)}>
                          {getGovtPafClassIdLabel(id)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                }
              >
                <PieChart chart={shareChartData} height="240px" icon={{}} title="" description="" />
              </DashboardChartPanel>
            </Grid>

            <Grid item xs={12} md={8}>
              <DashboardChartPanel
                title="Category Distribution"
                description="Property count by class"
              >
                <ReportsBarChart
                  flat
                  seriesColor={CHART_PRIMARY}
                  title=""
                  description=""
                  date=""
                  chart={categoryChartData}
                  chartHeight="260px"
                />
                <MDBox mt={2} display="flex" flexWrap="wrap" gap={2} justifyContent="center">
                  {Object.entries(SUMMARY_CATEGORY_COLORS).map(([category, color]) => (
                    <MDBox key={category} display="flex" alignItems="center" gap={1}>
                      <MDBox
                        sx={{
                          width: 12,
                          height: 12,
                          borderRadius: "4px",
                          backgroundColor: color,
                        }}
                      />
                      <MDTypography variant="caption" sx={{ fontWeight: 600, color: "#6b7280" }}>
                        {category}
                      </MDTypography>
                    </MDBox>
                  ))}
                </MDBox>
              </DashboardChartPanel>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </DashboardPageShell>
  );
}

export default SummaryOfA1Activities;
