/**
 * Dashboard sub-module navigation (Home, KPI Overview).
 */

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ModuleTabsBrandRow from "components/ModuleTabsBrandRow";

export const DASHBOARD_MODULE_TABS = [
  { label: "Home", route: "/dashboard" },
  { label: "KPI Overview", route: "/dashboard/kpi-overview" },
];

function resolveDashboardTabIndex(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const exact = DASHBOARD_MODULE_TABS.findIndex((tab) => path === tab.route);
  if (exact >= 0) return exact;

  const prefixMatch = [...DASHBOARD_MODULE_TABS]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => tab.route !== "/dashboard" && path.startsWith(`${tab.route}/`));

  if (prefixMatch) {
    return DASHBOARD_MODULE_TABS.findIndex((tab) => tab.route === prefixMatch.route);
  }

  return path === "/dashboard" ? 0 : false;
}

function DashboardModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = tabs && tabs.length ? tabs : DASHBOARD_MODULE_TABS;
  const activeIndex = useMemo(() => resolveDashboardTabIndex(pathname), [pathname]);

  const handleChange = (_, index) => {
    const target = items[index]?.route;
    if (target && target !== pathname.replace(/\/$/, "")) {
      navigate(target);
    }
  };

  return (
    <ModuleTabsBrandRow>
      <Tabs
        className="saas-settings-nav-tabs"
        value={activeIndex === false ? false : activeIndex}
        onChange={handleChange}
        variant="scrollable"
        scrollButtons="auto"
        allowScrollButtonsMobile
        aria-label="Dashboard module navigation"
      >
        {items.map((tab) => (
          <Tab key={tab.route} label={tab.label} />
        ))}
      </Tabs>
    </ModuleTabsBrandRow>
  );
}

DashboardModuleTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
};

DashboardModuleTabs.defaultProps = {
  tabs: null,
};

export default DashboardModuleTabs;
