import { useMemo } from "react";
import { canViewMenu, getCurrentMainMenuName } from "services/api.service";

export function getModuleTabMenuName(tab) {
  if (!tab || typeof tab !== "object") return "";
  return String(tab.menuName || getCurrentMainMenuName(tab.route) || "").trim();
}

export function canViewModuleTab(tab) {
  const menuName = getModuleTabMenuName(tab);
  return Boolean(menuName) && canViewMenu(menuName);
}

export function filterModuleTabsByViewPermission(tabs) {
  return (Array.isArray(tabs) ? tabs : []).filter((tab) => canViewModuleTab(tab));
}

export function usePermittedModuleTabs(defaultTabs, tabsOverride) {
  return useMemo(() => {
    const source = tabsOverride?.length ? tabsOverride : defaultTabs;
    return filterModuleTabsByViewPermission(source);
  }, [defaultTabs, tabsOverride]);
}

export function resolveModuleTabIndex(pathname, tabList, options = {}) {
  const tabs = Array.isArray(tabList) ? tabList : [];
  const path = (pathname || "").replace(/\/$/, "") || "/";
  const rootRoute = options.rootRoute;

  const exact = tabs.findIndex((tab) => path === tab.route);
  if (exact >= 0) return exact;

  const prefixMatch = [...tabs]
    .sort((a, b) => b.route.length - a.route.length)
    .find((tab) => {
      if (rootRoute && tab.route === rootRoute) return false;
      return path.startsWith(`${tab.route}/`);
    });

  if (prefixMatch) {
    return tabs.findIndex((tab) => tab.route === prefixMatch.route);
  }

  if (rootRoute && path === rootRoute) {
    return tabs.findIndex((tab) => tab.route === rootRoute);
  }

  return false;
}
