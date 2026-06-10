/** Sidenav color presets — shared by navbar, buttons, and MUI theme. */

export const VALID_SIDENAV_COLORS = ["default", "grey", "blue"];

export const SIDENAV_COLOR_PALETTES = {
  default: {
    main: "#025B64",
    focus: "#024A52",
    active: "#013A41",
    navActiveBg: "#e7f6f7",
  },
  grey: {
    main: "#4B5563",
    focus: "#374151",
    active: "#1F2937",
    navActiveBg: "#f3f4f6",
  },
  blue: {
    main: "#2563EB",
    focus: "#1D4ED8",
    active: "#1E40AF",
    navActiveBg: "#eff6ff",
  },
};

export const SIDENAV_COLOR_OPTIONS = VALID_SIDENAV_COLORS.map((value) => ({
  value,
  color: SIDENAV_COLOR_PALETTES[value].main,
}));

export function normalizeSidenavColor(color) {
  return VALID_SIDENAV_COLORS.includes(color) ? color : "default";
}

export function getSidenavPalette(sidenavColor) {
  return SIDENAV_COLOR_PALETTES[normalizeSidenavColor(sidenavColor)];
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

/** Apply brand CSS variables used by buttons, tabs, charts, and accents. */
export function applySidenavColorTheme(sidenavColor) {
  const palette = getSidenavPalette(sidenavColor);
  const { r, g, b } = hexToRgb(palette.main);
  const root = document.documentElement;

  root.style.setProperty("--erp-primary", palette.main);
  root.style.setProperty("--erp-btn-bg", palette.main);
  root.style.setProperty("--erp-btn-bg-hover", palette.focus);
  root.style.setProperty("--erp-btn-bg-active", palette.active);
  root.style.setProperty("--erp-btn-bg-disabled", `rgba(${r}, ${g}, ${b}, 0.4)`);
  root.style.setProperty("--ent-primary-dark", palette.focus);
  root.style.setProperty("--erp-nav-active-bg", palette.navActiveBg);
  root.style.setProperty("--dash-chart-primary", palette.main);

  if (document.body) {
    document.body.setAttribute("data-sidenav-color", normalizeSidenavColor(sidenavColor));
  }
}

/** MUI palette overrides so MDButton / contained-info pick up the sidenav color. */
export function getSidenavMuiThemeOverrides(sidenavColor) {
  const palette = getSidenavPalette(sidenavColor);
  return {
    palette: {
      primary: { main: palette.main, focus: palette.focus },
      info: { main: palette.main, focus: palette.focus },
      gradients: {
        primary: { main: palette.main, state: palette.focus },
        info: { main: palette.main, state: palette.focus },
      },
    },
  };
}
