/**
 * Contextual navigation tabs for Sales sub-modules.
 * Visual/routing shell only — mirrors sidebar submenu entries.
 */

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ModuleTabsBrandRow from "components/ModuleTabsBrandRow";

export const SALES_MODULE_TABS = [{ label: "Customer", route: "/customer" }];

function resolveSalesTabIndex(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const exact = SALES_MODULE_TABS.findIndex((tab) => path === tab.route);
  if (exact >= 0) return exact;

  const prefixMatch = [...SALES_MODULE_TABS]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => path.startsWith(`${tab.route}/`));

  if (prefixMatch) {
    return SALES_MODULE_TABS.findIndex((tab) => tab.route === prefixMatch.route);
  }

  return false;
}

function SalesModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = tabs && tabs.length ? tabs : SALES_MODULE_TABS;
  const activeIndex = useMemo(() => resolveSalesTabIndex(pathname), [pathname]);

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
        aria-label="Sales module navigation"
      >
        {items.map((tab) => (
          <Tab key={tab.route} label={tab.label} />
        ))}
      </Tabs>
    </ModuleTabsBrandRow>
  );
}

SalesModuleTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
};

SalesModuleTabs.defaultProps = {
  tabs: null,
};

export default SalesModuleTabs;
