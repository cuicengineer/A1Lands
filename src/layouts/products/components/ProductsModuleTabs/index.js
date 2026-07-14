/**
 * Contextual navigation tabs for Products sub-modules.
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

export const PRODUCTS_MODULE_TABS = [
  { label: "Services", route: "/products/services" },
  { label: "Goods", route: "/products/goods" },
];

function ProductsModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = usePermittedModuleTabs(PRODUCTS_MODULE_TABS, tabs);
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
        aria-label="Products module navigation"
      >
        {items.map((tab) => (
          <Tab key={tab.route} label={tab.label} />
        ))}
      </Tabs>
    </ModuleTabsBrandRow>
  );
}

ProductsModuleTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
};

ProductsModuleTabs.defaultProps = {
  tabs: null,
};

export default ProductsModuleTabs;
