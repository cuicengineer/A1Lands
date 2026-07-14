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
import {
  canViewModuleTab,
  resolveModuleTabIndex,
  usePermittedModuleTabs,
} from "utils/moduleTabsPermissionUtils";

export const INCOME_AGREEMENTS_MODULE_TABS = [
  { label: "Agreement Invoice", route: "/contracts/agreement-prov-invoice" },
  { label: "Sales Returns", route: "/income-agreements/sales-returns" },
  { label: "Collections", route: "/income-agreements/collections" },
  { label: "Share Distribution", route: "/contracts/share-distribution" },
];

function IncomeAgreementsModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = usePermittedModuleTabs(INCOME_AGREEMENTS_MODULE_TABS, tabs);
  const activeIndex = useMemo(() => resolveModuleTabIndex(pathname, items), [pathname, items]);

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
