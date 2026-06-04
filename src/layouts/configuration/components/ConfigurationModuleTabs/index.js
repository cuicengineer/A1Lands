/**
 * Contextual navigation tabs for Configuration sub-modules.
 * Visual/routing shell only — mirrors sidebar submenu entries.
 */

import { useMemo } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import PropTypes from "prop-types";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import ModuleTabsBrandRow from "components/ModuleTabsBrandRow";

export const CONFIGURATION_MODULE_TABS = [
  { label: "User Roles", route: "/configuration/user-role" },
  { label: "User Mgmt", route: "/configuration/user-mgmt" },
  { label: "Class", route: "/configuration/class" },
  { label: "Nature", route: "/configuration/nature" },
  { label: "Property Type", route: "/configuration/property-type" },
  { label: "Banks List", route: "/configuration/banks-list" },
  { label: "Rental Value Rate", route: "/configuration/rental-value-rate" },
  { label: "Govt Share Rate", route: "/configuration/govt-share-rate" },
  { label: "Sharing Formula", route: "/configuration/sharing-formula" },
  { label: "Tenants", route: "/configuration/tenants" },
  { label: "Lock Date", route: "/configuration/lock-date" },
];

function resolveConfigurationTabIndex(pathname) {
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const exact = CONFIGURATION_MODULE_TABS.findIndex((tab) => path === tab.route);
  if (exact >= 0) return exact;

  const prefixMatch = [...CONFIGURATION_MODULE_TABS]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => path.startsWith(`${tab.route}/`));

  if (prefixMatch) {
    return CONFIGURATION_MODULE_TABS.findIndex((tab) => tab.route === prefixMatch.route);
  }

  return false;
}

function ConfigurationModuleTabs({ tabs }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();

  const items = tabs && tabs.length ? tabs : CONFIGURATION_MODULE_TABS;
  const activeIndex = useMemo(() => resolveConfigurationTabIndex(pathname), [pathname]);

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
        aria-label="Configuration module navigation"
      >
        {items.map((tab) => (
          <Tab key={tab.route} label={tab.label} />
        ))}
      </Tabs>
    </ModuleTabsBrandRow>
  );
}

ConfigurationModuleTabs.propTypes = {
  tabs: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      route: PropTypes.string.isRequired,
    })
  ),
};

ConfigurationModuleTabs.defaultProps = {
  tabs: null,
};

export default ConfigurationModuleTabs;
