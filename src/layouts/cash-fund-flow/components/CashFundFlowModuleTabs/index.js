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

export const CASH_FUND_FLOW_MODULE_TABS = [
  { label: "Payments", route: "/payments" },
  { label: "Receipts", route: "/receipts" },
  { label: "Cash & Bank", route: "/cash-and-bank" },
  { label: "Transfer Entry", route: "/inter-acc-transfer" },
];

function resolveCashFundFlowTabIndex(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const exact = CASH_FUND_FLOW_MODULE_TABS.findIndex((tab) => path === tab.route);
  if (exact >= 0) return exact;

  const prefixMatch = [...CASH_FUND_FLOW_MODULE_TABS]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => path.startsWith(`${tab.route}/`));

  if (prefixMatch) {
    return CASH_FUND_FLOW_MODULE_TABS.findIndex((tab) => tab.route === prefixMatch.route);
  }

  return false;
}

function CashFundFlowModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = tabs && tabs.length ? tabs : CASH_FUND_FLOW_MODULE_TABS;
  const activeIndex = useMemo(() => resolveCashFundFlowTabIndex(pathname), [pathname]);

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
