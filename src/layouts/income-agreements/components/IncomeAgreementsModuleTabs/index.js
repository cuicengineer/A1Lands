/**
 * Contextual navigation tabs for Income Agreements sub-modules.
 * Visual/routing shell only — mirrors sidebar submenu entries.
 */

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ModuleTabsBrandRow from "components/ModuleTabsBrandRow";

export const INCOME_AGREEMENTS_MODULE_TABS = [
  { label: "Agreement Invoice", route: "/contracts/agreement-prov-invoice" },
  { label: "Sales Returns", route: "/income-agreements/sales-returns" },
  { label: "Collections", route: "/income-agreements/collections" },
  { label: "Share Distribution", route: "/contracts/share-distribution" },
];

function resolveIncomeAgreementsTabIndex(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const exact = INCOME_AGREEMENTS_MODULE_TABS.findIndex((tab) => path === tab.route);
  if (exact >= 0) return exact;

  const prefixMatch = [...INCOME_AGREEMENTS_MODULE_TABS]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => path.startsWith(`${tab.route}/`));

  if (prefixMatch) {
    return INCOME_AGREEMENTS_MODULE_TABS.findIndex((tab) => tab.route === prefixMatch.route);
  }

  return false;
}

function IncomeAgreementsModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = tabs && tabs.length ? tabs : INCOME_AGREEMENTS_MODULE_TABS;
  const activeIndex = useMemo(() => resolveIncomeAgreementsTabIndex(pathname), [pathname]);

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
        aria-label="Income Agreements module navigation"
      >
        {items.map((tab) => (
          <Tab key={tab.route} label={tab.label} />
        ))}
      </Tabs>
    </ModuleTabsBrandRow>
  );
}

IncomeAgreementsModuleTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
};

IncomeAgreementsModuleTabs.defaultProps = {
  tabs: null,
};

export default IncomeAgreementsModuleTabs;
