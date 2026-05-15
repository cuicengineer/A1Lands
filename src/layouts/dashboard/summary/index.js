/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================
*/

import { useEffect, useMemo, useState } from "react";

// @mui material components
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import CircularProgress from "@mui/material/CircularProgress";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Select from "@mui/material/Select";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import PieChart from "examples/Charts/PieChart";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import ComplexStatisticsCard from "examples/Cards/StatisticsCards/ComplexStatisticsCard";

// Material Dashboard 2 React contexts
import { useMaterialUIController } from "context";

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
      backgroundColors: ["warning", "info"],
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
    if (!byClassId[cid]) byClassId[cid] = { value: 0, amount: 0 };
    if (Number.isFinite(pc)) byClassId[cid].value += pc;
    if (Number.isFinite(cr)) byClassId[cid].amount += cr;
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
      };
    }
  }

  return out;
}

function SummaryOfA1Activities() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
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

  // Category distribution bar chart data
  const categoryColors = {
    A: "rgba(247, 14, 14, 0.8)", // Blue
    B: "rgba(15, 1, 1, 0.93)", // Green
    C: "rgba(255, 152, 0, 0.8)", // Orange
    BTS: "rgba(244, 67, 54, 0.8)", // Red
    HB: "rgba(156, 39, 176, 0.8)", // Purple
  };

  const categoryChartData = useMemo(() => {
    const base = {
      labels: ["A", "B", "C", "BTS", "HB"],
      datasets: {
        label: "Category Distribution",
        data: [0, 0, 0, 0, 0],
        backgroundColor: [
          categoryColors.A,
          categoryColors.B,
          categoryColors.C,
          categoryColors.BTS,
          categoryColors.HB,
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

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox py={3}>
        {/* Main Container with Light Blue Border */}
        <Card
          sx={{
            border: darkMode ? "3px solid rgba(255, 255, 255, 0.2)" : "0px solid #87CEEB",
            borderRadius: "12px",
            padding: 3,
            backgroundColor: darkMode ? "#1a1a1a" : "Transparent",
          }}
        >
          <Grid container spacing={2}>
            {/* Top Section: Summary Cards - Using ComplexStatisticsCard format */}
            <Grid item xs={12}>
              {!propertySummaryReady || !summaryData ? (
                <MDBox
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  minHeight={160}
                  width="100%"
                >
                  <CircularProgress color="info" />
                </MDBox>
              ) : (
                <Grid container spacing={3}>
                  {[
                    {
                      key: "total",
                      label: "Lands",
                      data: summaryData.total,
                      icon: "dashboard",
                      color: "info",
                    },
                    {
                      key: "categoryA",
                      label: "CAT A",
                      data: summaryData.categoryA,
                      icon: "category",
                      color: "primary",
                    },
                    {
                      key: "categoryB",
                      label: "CAT B",
                      data: summaryData.categoryB,
                      icon: "category",
                      color: "success",
                    },
                    {
                      key: "categoryC",
                      label: "CAT C",
                      data: summaryData.categoryC,
                      icon: "category",
                      color: "warning",
                    },
                    {
                      key: "bts",
                      label: "BTS",
                      data: summaryData.bts,
                      icon: "signal_cellular_alt",
                      color: "error",
                    },
                    { key: "hb", label: "HB", data: summaryData.hb, icon: "home", color: "dark" },
                  ].map((item) => (
                    <Grid item xs={12} sm={6} md={2} key={item.key}>
                      <MDBox mb={1.5}>
                        <ComplexStatisticsCard
                          color={item.color}
                          icon={item.icon}
                          title={item.label}
                          count={item.data.value}
                          percentage={{
                            color: "info",
                            amount: `Worth: ${item.data.amount.toFixed(2)} Mil`,
                          }}
                        />
                      </MDBox>
                    </Grid>
                  ))}
                </Grid>
              )}
            </Grid>

            {/* Status Stickers - ContractsSummary (aggregated counts) */}
            <Grid item xs={12}>
              {!propertySummaryReady || !statusData ? (
                <MDBox
                  display="flex"
                  justifyContent="center"
                  alignItems="center"
                  minHeight={120}
                  width="100%"
                >
                  <CircularProgress color="info" />
                </MDBox>
              ) : (
                <Grid container spacing={3} mt={2}>
                  {statusData.map((status, index) => {
                    let color = "success";
                    let icon = "check_circle";
                    let percentageColor = "success";
                    let percentageAmount = "";
                    let percentageLabel = "";

                    if (status.label === "Active Contracts") {
                      color = "success";
                      icon = "check_circle";
                      percentageColor = "success";
                      percentageLabel = "Active contracts";
                    } else if (status.label === "Expired Contracts") {
                      color = "error";
                      icon = "schedule";
                      percentageColor = "error";
                      percentageLabel = "Expired contracts";
                    } else if (status.label === "Border Line") {
                      color = "warning";
                      icon = "warning";
                      percentageColor = "warning";
                      percentageLabel = "Border line contracts";
                    } else if (status.label === "Closed Contracts") {
                      color = "warning";
                      icon = "close";
                      percentageColor = "warning";
                      percentageLabel = "Closed contracts";
                    }

                    return (
                      <Grid item xs={12} sm={6} md={3} key={status.label}>
                        <MDBox mb={1.5}>
                          <ComplexStatisticsCard
                            color={color}
                            icon={icon}
                            title={status.label}
                            count={status.count}
                            percentage={{
                              color: percentageColor,
                              amount: percentageAmount,
                              label: percentageLabel,
                            }}
                          />
                        </MDBox>
                      </Grid>
                    );
                  })}
                </Grid>
              )}
            </Grid>

            {/* Bottom Section: Charts in one row */}
            <Grid item xs={12}>
              <Grid container spacing={3} mt={2}>
                {/* Share Distribution Pie Chart - 4 columns with modern styling */}
                <Grid item xs={12} md={4}>
                  <MDBox
                    mb={3}
                    sx={{
                      "& .MuiCard-root": {
                        borderRadius: "16px",
                        boxShadow: darkMode
                          ? "0 8px 24px rgba(0, 0, 0, 0.5)"
                          : "0 8px 24px rgba(0, 0, 0, 0.12)",
                        background: darkMode
                          ? "linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%)"
                          : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
                        border: darkMode
                          ? "1px solid rgba(255, 255, 255, 0.1)"
                          : "1px solid rgba(0, 0, 0, 0.05)",
                        transition: "all 0.3s ease-in-out",
                        color: darkMode ? "#ffffff" : "inherit",
                        "&:hover": {
                          boxShadow: darkMode
                            ? "0 12px 32px rgba(0, 0, 0, 0.7)"
                            : "0 12px 32px rgba(0, 0, 0, 0.15)",
                          transform: "translateY(-4px)",
                        },
                      },
                      "& .MuiTypography-root": {
                        color: darkMode ? "#ffffff !important" : "inherit",
                      },
                    }}
                  >
                    <PieChart
                      chart={shareChartData}
                      height="240px"
                      icon={{ color: "info", component: "pie_chart" }}
                      title={
                        <MDBox
                          display="flex"
                          alignItems="center"
                          justifyContent="space-between"
                          gap={1}
                          flexWrap="wrap"
                          width="100%"
                          pr={{ xs: 0, sm: 1 }}
                        >
                          <MDTypography
                            variant="h6"
                            sx={{
                              color: darkMode ? "#ffffff !important" : "#000000 !important",
                              fontSize: "1.25rem !important",
                              fontWeight: "700 !important",
                              m: 0,
                            }}
                          >
                            Share Distribution
                          </MDTypography>
                          <FormControl size="small" sx={{ minWidth: 55, maxWidth: 50 }}>
                            <InputLabel id="govt-paf-class-filter-label">Class</InputLabel>
                            <Select
                              labelId="govt-paf-class-filter-label"
                              label="Class"
                              value={shareClassIdFilter}
                              onChange={(e) => setShareClassIdFilter(e.target.value)}
                              renderValue={(val) =>
                                val === "all" ? "All" : getGovtPafClassIdLabel(val)
                              }
                            >
                              <MenuItem value="all">All</MenuItem>
                              {shareClassIdOptions.map((id) => (
                                <MenuItem key={id} value={String(id)}>
                                  {getGovtPafClassIdLabel(id)}
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </MDBox>
                      }
                      description="Govt Share vs PAF Share"
                    />
                  </MDBox>
                </Grid>

                {/* Category Distribution Bar Chart - 8 columns (remaining width) */}
                <Grid item xs={12} md={8}>
                  <MDBox
                    mb={3}
                    sx={{
                      height: "300px",
                      "& .MuiCard-root": {
                        borderRadius: "16px",
                        boxShadow: darkMode
                          ? "0 8px 24px rgba(0, 0, 0, 0.5)"
                          : "0 8px 24px rgba(0, 0, 0, 0.12)",
                        background: darkMode
                          ? "linear-gradient(135deg, #2a2a2a 0%, #1f1f1f 100%)"
                          : "linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%)",
                        border: darkMode
                          ? "1px solid rgba(255, 255, 255, 0.1)"
                          : "1px solid rgba(0, 0, 0, 0.05)",
                        transition: "all 0.3s ease-in-out",
                        color: darkMode ? "#ffffff" : "inherit",
                        height: "100%",
                        "&:hover": {
                          boxShadow: darkMode
                            ? "0 12px 32px rgba(0, 0, 0, 0.7)"
                            : "0 12px 32px rgba(0, 0, 0, 0.15)",
                          transform: "translateY(-4px)",
                        },
                      },
                      "& .MuiTypography-root": {
                        color: darkMode ? "#ffffff !important" : "inherit",
                      },
                    }}
                  >
                    <MDBox>
                      <ReportsBarChart
                        color="info"
                        title="Category Distribution"
                        description=""
                        date=""
                        chart={categoryChartData}
                        height="300px"
                      />
                      {/* Color Map Legend */}
                      <MDBox
                        mt={2}
                        display="flex"
                        flexWrap="wrap"
                        gap={2}
                        justifyContent="center"
                        sx={{
                          "& .color-item": {
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                          },
                          "& .color-box": {
                            width: "20px",
                            height: "20px",
                            borderRadius: "4px",
                            border: "1px solid rgba(0, 0, 0, 0.1)",
                          },
                          "& .color-label": {
                            fontSize: "0.875rem",
                            fontWeight: "600",
                            color: darkMode ? "#ffffff !important" : "#000000",
                          },
                        }}
                      >
                        {Object.entries(categoryColors).map(([category, color]) => (
                          <MDBox key={category} className="color-item">
                            <MDBox
                              className="color-box"
                              sx={{
                                backgroundColor: color,
                              }}
                            />
                            <MDTypography className="color-label">{category}</MDTypography>
                          </MDBox>
                        ))}
                      </MDBox>
                    </MDBox>
                  </MDBox>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Card>
      </MDBox>
      <Footer />
    </DashboardLayout>
  );
}

export default SummaryOfA1Activities;
