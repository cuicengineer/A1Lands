/**
 * Shared dashboard shell — keeps header + module tabs mounted across Home / KPI Overview.
 */

import { useCallback, useLayoutEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import DashboardPageShell from "layouts/dashboard/components/DashboardPageShell";
import Dashboard from "layouts/dashboard";
import KpiOverview from "layouts/dashboard/kpi-overview";

const HOME_SHELL = {
  title: "Dashboard",
  subtitle: "Executive overview of land, contracts, and revenue performance",
  actions: null,
};

const KPI_SHELL_FALLBACK = {
  title: "KPI Overview",
  subtitle: "Property, contract, and financial analytics with RAC / Base filters",
  actions: null,
};

function isKpiOverviewPath(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  return path === "/dashboard/kpi-overview" || path.startsWith("/dashboard/kpi-overview/");
}

function DashboardModuleLayout() {
  const { pathname } = useLocation();
  const isKpiOverview = isKpiOverviewPath(pathname);
  const [kpiShellProps, setKpiShellProps] = useState(KPI_SHELL_FALLBACK);

  useLayoutEffect(() => {
    if (!isKpiOverview) {
      setKpiShellProps(KPI_SHELL_FALLBACK);
    }
  }, [isKpiOverview]);

  const handleKpiShellProps = useCallback((props) => {
    setKpiShellProps((prev) => ({ ...prev, ...props }));
  }, []);

  const shellProps = isKpiOverview ? kpiShellProps : HOME_SHELL;

  return (
    <DashboardPageShell
      title={shellProps.title}
      subtitle={shellProps.subtitle}
      actions={shellProps.actions}
      moduleBodyClassName={isKpiOverview ? "erp-kpi-overview-module-body" : undefined}
    >
      {isKpiOverview ? (
        <KpiOverview embedded onShellProps={handleKpiShellProps} />
      ) : (
        <Dashboard embedded />
      )}
    </DashboardPageShell>
  );
}

export default DashboardModuleLayout;
