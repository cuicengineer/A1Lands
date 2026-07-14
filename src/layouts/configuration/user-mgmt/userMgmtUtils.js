export const DEFAULT_NEW_USER_VIEW_MENUS = ["Dashboard", "KPI Overview", "Guidelines"];

export function isMandatoryViewRightsMenu(menuName) {
  const key = String(menuName || "")
    .trim()
    .toLowerCase();
  return DEFAULT_NEW_USER_VIEW_MENUS.some((menu) => menu.toLowerCase() === key);
}

export async function seedDefaultViewPermissionsForUser(apiClient, userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id <= 0) return;

  await Promise.all(
    DEFAULT_NEW_USER_VIEW_MENUS.map((menuName) =>
      apiClient.post("/api/UserPermissions", {
        userId: id,
        menuName,
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      })
    )
  );
}

export function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function isSuperuserUsername(username) {
  return normalizeUsername(username) === "superuser";
}

export function normalizeCategoryArr(category) {
  if (Array.isArray(category)) {
    return category.map((value) => String(value || "").trim()).filter(Boolean);
  }
  return String(category || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isOperatorCategoryUser(category) {
  return normalizeCategoryArr(category).some((token) => /\boperator\b/i.test(token));
}

function normalizeAssignRightsMenuKey(menuName) {
  return String(menuName || "")
    .trim()
    .toLowerCase();
}

const ASSIGN_RIGHTS_EXCLUDED_MENU_KEYS = new Set(["contracts mgmt"]);

/** Same visibility rule as Sidenav: hidden routes are omitted with their subtree. */
function isSidenavVisibleRoute(route) {
  if (!route || typeof route !== "object") return false;
  return !route.hideFromSidenav;
}

/**
 * Assign Rights rows mirror navbar menus. Only legacy alias pages marked
 * `excludeFromAssignRights` (e.g. Supplier under Purchases) are skipped.
 */
function shouldIncludeAssignRightsRoute(route) {
  if (!isSidenavVisibleRoute(route)) return false;
  if (route.excludeFromAssignRights) return false;
  const menuName = String(route.name || "").trim();
  if (!menuName) return false;
  if (ASSIGN_RIGHTS_EXCLUDED_MENU_KEYS.has(normalizeAssignRightsMenuKey(menuName))) return false;
  return route.type === "collapse";
}

/**
 * Navbar-order menu catalog for Assign Rights: each main menu followed by its visible sub menus.
 */
export function buildAssignRightsMenuCatalog(appRoutes = []) {
  const rows = [];
  let groupIndex = 0;

  const walk = (items, parentGroupIndex = null) => {
    if (!Array.isArray(items)) return;

    items.forEach((route) => {
      if (!isSidenavVisibleRoute(route)) return;

      const hasSubmenu = Array.isArray(route.collapse) && route.collapse.length > 0;
      const includeRoute = shouldIncludeAssignRightsRoute(route);

      if (includeRoute) {
        const group = parentGroupIndex ?? groupIndex;
        rows.push({
          menuName: String(route.name).trim(),
          menuKey: String(route.key || route.name || "").trim(),
          isMainMenu: parentGroupIndex == null,
          groupIndex: group,
        });

        if (hasSubmenu) {
          walk(route.collapse, group);
          if (parentGroupIndex == null) groupIndex += 1;
        } else if (parentGroupIndex == null) {
          groupIndex += 1;
        }
        return;
      }

      if (hasSubmenu) {
        walk(route.collapse, parentGroupIndex);
      }
    });
  };

  walk(appRoutes);
  return rows;
}

const ASSIGN_RIGHTS_MENU_LEGACY_ALIASES = {
  "sales agreements": ["contracts mgmt"],
  "contracts mgmt": ["sales agreements"],
  agreements: ["contracts"],
  contracts: ["agreements"],
};

/** Load saved rights for one Assign Rights row — exact menu match only (no parent inheritance). */
export function resolveAssignRightsExistingPermission(menuName, rightsLookup = {}) {
  const key = normalizeAssignRightsMenuKey(menuName);
  if (!key) return {};
  if (rightsLookup[key]) return rightsLookup[key];

  const aliases = ASSIGN_RIGHTS_MENU_LEGACY_ALIASES[key] || [];
  for (const alias of aliases) {
    if (rightsLookup[alias]) return rightsLookup[alias];
  }

  return {};
}

const ASSIGN_RIGHTS_FIELDS = ["view", "create", "edit", "delete"];

export function applyAssignRightsRowDerivedFlags(row) {
  const next = { ...row };
  if (next.create || next.edit || next.delete) {
    next.view = true;
  }
  return next;
}

/** Ensure View follows action rights and parent rows inherit enabled child rights. */
export function normalizeAssignRightsDraftRows(rows = []) {
  let next = rows.map((row) => {
    const derived = applyAssignRightsRowDerivedFlags(row);
    if (isMandatoryViewRightsMenu(derived.menuName)) {
      derived.view = true;
    }
    return derived;
  });

  next = next.map((row) => {
    if (!row.isMainMenu) return row;
    const children = next.filter(
      (child) => child.groupIndex === row.groupIndex && !child.isMainMenu
    );
    const updated = { ...row };
    ASSIGN_RIGHTS_FIELDS.forEach((field) => {
      if (children.some((child) => child[field])) {
        updated[field] = true;
      }
    });
    return applyAssignRightsRowDerivedFlags(updated);
  });

  return next;
}

export function applyAssignRightsToggle(rows, menuName, field) {
  const target = rows.find((row) => row.menuName === menuName);
  if (!target) return rows;

  const enabling = !target[field];
  let next = rows.map((row) => {
    if (row.menuName !== menuName) return row;

    if (field === "view" && !enabling && (row.create || row.edit || row.delete)) {
      return row;
    }

    let updated = { ...row, [field]: enabling };
    if (enabling && field !== "view") {
      updated.view = true;
    }
    return updated;
  });

  const changedRow = next.find((row) => row.menuName === menuName);
  if (changedRow && !changedRow.isMainMenu && enabling) {
    next = next.map((row) => {
      if (row.groupIndex !== changedRow.groupIndex || !row.isMainMenu) return row;
      const updated = { ...row, [field]: true };
      if (field !== "view") {
        updated.view = true;
      }
      return updated;
    });
  }

  return normalizeAssignRightsDraftRows(next);
}

/** Keep saved permission rows that are not present in the current route catalog. */
export function mergeAssignRightsPermissionMenus(catalog = [], permissionRows = [], getMenuName) {
  if (!Array.isArray(catalog) || catalog.length === 0) return catalog;
  if (!Array.isArray(permissionRows) || permissionRows.length === 0) return catalog;

  const seen = new Set(catalog.map((row) => normalizeAssignRightsMenuKey(row.menuName)));
  const extras = [];
  let legacyGroupIndex =
    catalog.reduce((max, row) => Math.max(max, Number(row.groupIndex) || 0), 0) + 1;

  permissionRows.forEach((item) => {
    const menuName = getMenuName(item);
    const menuKey = normalizeAssignRightsMenuKey(menuName);
    if (!menuName || seen.has(menuKey)) return;
    seen.add(menuKey);
    extras.push({
      menuName,
      menuKey: menuKey,
      isMainMenu: true,
      groupIndex: legacyGroupIndex,
      isLegacyPermission: true,
    });
    legacyGroupIndex += 1;
  });

  return extras.length > 0 ? [...catalog, ...extras] : catalog;
}

export async function loadAssignRightsMenuCatalog() {
  try {
    const routesModule = await import("routes");
    const appRoutes = routesModule?.default || [];
    return buildAssignRightsMenuCatalog(appRoutes);
  } catch (e) {
    console.error("Failed to load assign rights menu catalog", e);
    return [];
  }
}

const ASSIGN_RIGHTS_MAIN_ROW_BG = {
  light: "#f1f8ff",
  dark: "rgba(33, 150, 243, 0.22)",
};

const ASSIGN_RIGHTS_SUB_ROW_BG = {
  light: "#fffde7",
  dark: "rgba(255, 235, 59, 0.18)",
};

export function getAssignRightsRowBgColors(darkMode) {
  return {
    main: darkMode ? ASSIGN_RIGHTS_MAIN_ROW_BG.dark : ASSIGN_RIGHTS_MAIN_ROW_BG.light,
    sub: darkMode ? ASSIGN_RIGHTS_SUB_ROW_BG.dark : ASSIGN_RIGHTS_SUB_ROW_BG.light,
  };
}

export function getAssignRightsRowBackground(_groupIndex, darkMode, isMainMenu = false) {
  const palette = getAssignRightsRowBgColors(darkMode);
  return isMainMenu ? palette.main : palette.sub;
}
