/**
 * Dashboard sub-module navigation (Home, KPI Overview).
 */

import { useMemo, useTransition } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ModuleTabsBrandRow from "components/ModuleTabsBrandRow";
import {
  canViewModuleTab,
  resolveModuleTabIndex,
  usePermittedModuleTabs,
} from "utils/moduleTabsPermissionUtils";

export const DASHBOARD_MODULE_TABS = [
  { label: "Home", route: "/dashboard" },
  { label: "KPI Overview", route: "/dashboard/kpi-overview" },
];

function DashboardModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [, startTransition] = useTransition();

  const items = usePermittedModuleTabs(DASHBOARD_MODULE_TABS, tabs);
  const activeIndex = useMemo(
    () => resolveModuleTabIndex(pathname, items, { rootRoute: "/dashboard" }),
    [pathname, items]
  );

  if (items.length === 0) {
    return null;
  }

  const handleChange = (_, index) => {
    const target = items[index]?.route;
    const normalizedPath = pathname.replace(/\/$/, "") || "/";
    if (!target || target === normalizedPath || !canViewModuleTab(items[index])) {
      return;
    }
    startTransition(() => navigate(target));
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
