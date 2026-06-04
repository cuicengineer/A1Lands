/**
 * Dashboard Home — ERP v1.0 executive layout (data-first KPIs + analytics).
 */

import { useEffect, useMemo, useState } from "react";
import Grid from "@mui/material/Grid";
import DashboardKpiCard from "components/DashboardKpiCard";
import DashboardChartPanel from "components/DashboardChartPanel";
import DashboardPageShell from "layouts/dashboard/components/DashboardPageShell";
import ReportsBarChart from "examples/Charts/BarCharts/ReportsBarChart";
import ReportsLineChart from "examples/Charts/LineCharts/ReportsLineChart";
import reportsBarChartData from "layouts/dashboard/data/reportsBarChartData";
import reportsLineChartData from "layouts/dashboard/data/reportsLineChartData";
import { CHART_PRIMARY, CHART_SECONDARY } from "utils/executiveChartConfigs";
import api from "services/api.service";
import {
  buildExecutiveKpis,
  extractContractsSummaryRows,
  extractPropertySummaryRows,
} from "layouts/dashboard/kpi-overview/kpiDataUtils";

const KPI_ROW = [
  {
    label: "Total Lands",
    trend: "+55% than last week",
    trendVariant: "positive",
    icon: "properties",
    variant: "primary",
  },
  {
    label: "Active Contracts",
    trend: "+3% than last month",
    trendVariant: "positive",
    icon: "contracts",
  },
  {
    label: "Revenue Last Month",
    value: "3M",
    trend: "+1% than last month",
    trendVariant: "positive",
    icon: "revenue",
  },
  {
    label: "Tenants",
    trend: "Just updated",
    trendVariant: "neutral",
    icon: "tenants",
  },
];

function formatKpiCount(value, ready) {
  if (!ready) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString();
}

function Dashboard() {
  const [propertyRows, setPropertyRows] = useState([]);
  const [contractRows, setContractRows] = useState([]);
  const [tenantCount, setTenantCount] = useState(null);
  const [kpiReady, setKpiReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [summaryPayload, tenantsPayload] = await Promise.all([
          api.request("GET", "/api/Dashboards/property-summary"),
          api.list("tenant"),
        ]);
        if (!cancelled) {
          setPropertyRows(extractPropertySummaryRows(summaryPayload));
          setContractRows(extractContractsSummaryRows(summaryPayload));
          const tenants = Array.isArray(tenantsPayload) ? tenantsPayload : [];
          setTenantCount(tenants.length);
        }
      } catch (e) {
        if (!cancelled) console.error("Dashboard home KPIs:", e);
      } finally {
        if (!cancelled) setKpiReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const executiveKpis = useMemo(
    () => buildExecutiveKpis(propertyRows, contractRows, []),
    [propertyRows, contractRows]
  );

  const kpiValueByLabel = useMemo(
    () => ({
      "Total Lands": executiveKpis.totalProperties,
      "Active Contracts": executiveKpis.activeContracts,
      Tenants: tenantCount,
    }),
    [executiveKpis.totalProperties, executiveKpis.activeContracts, tenantCount]
  );
  const { sales, tasks } = reportsLineChartData;

  const a1AnnualRent = {
    labels: ["FAC", "NAC", "CAC", "SAC", "WAC"],
    datasets: { label: "Annual Rent", data: [2000000, 3000000, 4000000, 5000000, 6000000] },
  };

  const a1GovtShare = {
    labels: ["FAC", "NAC", "CAC", "SAC", "WAC"],
    datasets: { label: "Govt Share", data: [1000000, 2000000, 3000000, 4000000, 5000000] },
  };

  return (
    <DashboardPageShell
      title="Dashboard"
      subtitle="Executive overview of land, contracts, and revenue performance"
    >
      <Grid container spacing={1} className="erp-dashboard-kpi-grid">
        {KPI_ROW.map((kpi, index) => (
          <Grid item xs={12} sm={6} lg={3} key={kpi.label}>
            <DashboardKpiCard
              label={kpi.label}
              value={
                kpi.value != null ? kpi.value : formatKpiCount(kpiValueByLabel[kpi.label], kpiReady)
              }
              trend={kpi.trend}
              trendVariant={kpi.trendVariant}
              variant={index === 0 || kpi.variant === "primary" ? "primary" : "default"}
              icon={kpi.icon}
            />
          </Grid>
        ))}

        <Grid item xs={12} lg={6}>
          <DashboardChartPanel title="Annual Rent" description="PAF all RAC — updated just now">
            <ReportsBarChart
              flat
              seriesColor={CHART_PRIMARY}
              title=""
              description=""
              date=""
              chart={a1AnnualRent}
              chartHeight="260px"
            />
          </DashboardChartPanel>
        </Grid>

        <Grid item xs={12} lg={6}>
          <DashboardChartPanel title="Govt Share" description="Command wise — updated just now">
            <ReportsBarChart
              flat
              seriesColor={CHART_SECONDARY}
              title=""
              description=""
              date=""
              chart={a1GovtShare}
              chartHeight="260px"
            />
          </DashboardChartPanel>
        </Grid>

        <Grid item xs={12}>
          <p className="erp-dashboard-section-title erp-dashboard-section-title--spaced">
            Activity & trends
          </p>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <DashboardChartPanel
            title="Daily New Contracts"
            description="(+5%) increase · campaign sent 2 days ago"
          >
            <ReportsBarChart
              flat
              seriesColor={CHART_PRIMARY}
              title=""
              description=""
              date=""
              chart={reportsBarChartData}
              chartHeight="240px"
            />
          </DashboardChartPanel>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <DashboardChartPanel title="Monthly Revenue Collection" description="(+15%) Dir. NPF">
            <ReportsLineChart
              flat
              seriesColor={CHART_SECONDARY}
              title=""
              description=""
              date=""
              chart={sales}
              chartHeight="240px"
            />
          </DashboardChartPanel>
        </Grid>

        <Grid item xs={12} md={6} lg={4}>
          <DashboardChartPanel title="Completed Contracts" description="Completion trend PAF">
            <ReportsLineChart
              flat
              seriesColor={CHART_PRIMARY}
              title=""
              description=""
              date=""
              chart={tasks}
              chartHeight="240px"
            />
          </DashboardChartPanel>
        </Grid>
      </Grid>
    </DashboardPageShell>
  );
}

export default Dashboard;
