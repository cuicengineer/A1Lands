/**
 * Contextual navigation tabs for Cash & Fund Flow sub-modules.
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

export const CASH_FUND_FLOW_MODULE_TABS = [
  { label: "Payments", route: "/payments" },
  { label: "Receipts", route: "/receipts" },
  { label: "Cash & Bank", route: "/cash-and-bank" },
  { label: "Transfer Entry", route: "/inter-acc-transfer" },
  { label: "Journal Entry", route: "/journal-entry", menuName: "Journal Entry" },
];

function CashFundFlowModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = usePermittedModuleTabs(CASH_FUND_FLOW_MODULE_TABS, tabs);
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
        aria-label="Cash and Fund Flow module navigation"
      >
        {items.map((tab) => (
          <Tab key={tab.route} label={tab.label} />
        ))}
      </Tabs>
    </ModuleTabsBrandRow>
  );
}

CashFundFlowModuleTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
};

CashFundFlowModuleTabs.defaultProps = {
  tabs: null,
};

export default CashFundFlowModuleTabs;
