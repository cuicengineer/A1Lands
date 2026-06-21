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

export const CONTRACTS_MODULE_TABS = [
  { label: "Rental Properties", route: "/contracts/rental-properties" },
  { label: "Revenue Rates", route: "/contracts/revenue-rates" },
  { label: "Property Grouping", route: "/contracts/property-grouping" },
  { label: "Agreements", route: "/contracts" },
];

function resolveContractsTabIndex(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const exact = CONTRACTS_MODULE_TABS.findIndex((tab) => path === tab.route);
  if (exact >= 0) return exact;

  const prefixMatch = [...CONTRACTS_MODULE_TABS]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => tab.route !== "/contracts" && path.startsWith(`${tab.route}/`));

  if (prefixMatch) {
    return CONTRACTS_MODULE_TABS.findIndex((tab) => tab.route === prefixMatch.route);
  }

  return false;
}

function ContractsModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = tabs && tabs.length ? tabs : CONTRACTS_MODULE_TABS;
  const activeIndex = useMemo(() => resolveContractsTabIndex(pathname), [pathname]);

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
