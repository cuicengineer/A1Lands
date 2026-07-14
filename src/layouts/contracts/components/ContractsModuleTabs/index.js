/**
 * Contextual navigation tabs for Contracts Mgmt sub-modules.
 * Visual/routing shell only — mirrors sidebar submenu entries.
 */

import { useMemo } from "react";
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

export const CONTRACTS_MODULE_TABS = [
  { label: "Rental Properties", route: "/contracts/rental-properties" },
  { label: "Revenue Rates", route: "/contracts/revenue-rates" },
  { label: "Property Grouping", route: "/contracts/property-grouping" },
  { label: "Agreements", route: "/contracts" },
];

function ContractsModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = usePermittedModuleTabs(CONTRACTS_MODULE_TABS, tabs);
  const activeIndex = useMemo(
    () => resolveModuleTabIndex(pathname, items, { rootRoute: "/contracts" }),
    [pathname, items]
  );

  if (items.length === 0) {
    return null;
  }

  const handleChange = (_, index) => {
    const target = items[index]?.route;
    if (!target || target === pathname.replace(/\/$/, "") || !canViewModuleTab(items[index])) {
      return;
    }
    navigate(target);
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
        aria-label="Agreements module navigation"
      >
        {items.map((tab) => (
          <Tab key={tab.route} label={tab.label} />
        ))}
      </Tabs>
    </ModuleTabsBrandRow>
  );
}

ContractsModuleTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
};

ContractsModuleTabs.defaultProps = {
  tabs: null,
};

export default ContractsModuleTabs;
