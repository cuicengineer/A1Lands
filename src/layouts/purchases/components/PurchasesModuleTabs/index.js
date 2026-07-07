/**
 * Contextual navigation tabs for Purchases sub-modules.
 * Visual/routing shell only — mirrors sidebar submenu entries.
 */

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ModuleTabsBrandRow from "components/ModuleTabsBrandRow";

export const PURCHASES_MODULE_TABS = [
  { label: "Supplier", route: "/supplier" },
  { label: "Purchase Returns", route: "/purchases/purchase-returns" },
];

function resolvePurchasesTabIndex(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const exact = PURCHASES_MODULE_TABS.findIndex((tab) => path === tab.route);
  if (exact >= 0) return exact;

  const prefixMatch = [...PURCHASES_MODULE_TABS]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => path.startsWith(`${tab.route}/`));

  if (prefixMatch) {
    return PURCHASES_MODULE_TABS.findIndex((tab) => tab.route === prefixMatch.route);
  }

  return false;
}

function PurchasesModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = tabs && tabs.length ? tabs : PURCHASES_MODULE_TABS;
  const activeIndex = useMemo(() => resolvePurchasesTabIndex(pathname), [pathname]);

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
        aria-label="Purchases module navigation"
      >
        {items.map((tab) => (
          <Tab key={tab.route} label={tab.label} />
        ))}
      </Tabs>
    </ModuleTabsBrandRow>
  );
}

PurchasesModuleTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
};

PurchasesModuleTabs.defaultProps = {
  tabs: null,
};

export default PurchasesModuleTabs;
