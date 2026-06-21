/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

/**
  This file is used for controlling the global states of the components,
  you can customize the states for the different components here.
*/

import { createContext, useContext, useReducer, useMemo, useEffect } from "react";

// prop-types is a library for typechecking of props
import PropTypes from "prop-types";
import { normalizeSidenavColor } from "utils/sidenavColorTheme";

// Material Dashboard 2 React main context
const MaterialUI = createContext();

// Setting custom name for the context which is visible on react dev tools
MaterialUI.displayName = "MaterialUIContext";

// Helper function to get user ID from localStorage
const getUserId = () => {
  try {
    const auth = localStorage.getItem("auth");
    if (auth) {
      const authData = JSON.parse(auth);
      return authData?.userId || authData?.id || authData?.userID || null;
    }
  } catch (e) {
    // ignore
  }
  return null;
};

// Helper function to get storage key for user preferences
const getStorageKey = () => {
  const userId = getUserId();
  return userId ? `ui_preferences_${userId}` : "ui_preferences_guest";
};

// Helper function to load preferences from localStorage
const loadPreferencesFromStorage = (defaultState) => {
  try {
    const storageKey = getStorageKey();
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed.sidenavColor) {
        parsed.sidenavColor = normalizeSidenavColor(parsed.sidenavColor);
      }
      // Merge saved preferences with defaults (saved takes precedence)
      return { ...defaultState, ...parsed };
    }
  } catch (e) {
    // ignore errors, use defaults
  }
  return defaultState;
};

// Helper function to save preferences to localStorage
const savePreferencesToStorage = (state) => {
  try {
    const storageKey = getStorageKey();
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (e) {
    // ignore storage errors
  }
};

// Material Dashboard 2 React reducer
function reducer(state, action) {
  let newState;
  switch (action.type) {
    case "MINI_SIDENAV": {
      newState = { ...state, miniSidenav: action.value };
      break;
    }
    case "TRANSPARENT_SIDENAV": {
      newState = { ...state, transparentSidenav: action.value };
      break;
    }
    case "WHITE_SIDENAV": {
      newState = { ...state, whiteSidenav: action.value };
      break;
    }
    case "SIDENAV_COLOR": {
      newState = { ...state, sidenavColor: normalizeSidenavColor(action.value) };
      break;
    }
    case "TRANSPARENT_NAVBAR": {
      newState = { ...state, transparentNavbar: action.value };
      break;
    }
    case "FIXED_NAVBAR": {
      newState = { ...state, fixedNavbar: action.value };
      break;
    }
    case "OPEN_CONFIGURATOR": {
      newState = { ...state, openConfigurator: action.value };
      break;
    }
    case "DIRECTION": {
      newState = { ...state, direction: action.value };
      break;
    }
    case "LAYOUT": {
      newState = { ...state, layout: action.value };
      break;
    }
    case "DARKMODE": {
      newState = { ...state, darkMode: action.value };
      break;
    }
    case "SET_HAS_USER_MANUALLY_TOGGLED_SIDENAV": {
      newState = { ...state, hasUserManuallyToggledSidenav: action.value };
      break;
    }
    case "LOAD_PREFERENCES": {
      // Load preferences from storage
      newState = action.value;
      break;
    }
    default: {
      throw new Error(`Unhandled action type: ${action.type}`);
    }
  }

  // Save to localStorage whenever state changes (except for initial load)
  if (action.type !== "LOAD_PREFERENCES") {
    savePreferencesToStorage(newState);
  }

  return newState;
}

// Material Dashboard 2 React context provider
function MaterialUIControllerProvider({ children }) {
  const defaultState = {
    miniSidenav: false,
    transparentSidenav: false,
    whiteSidenav: false,
    sidenavColor: "default",
    transparentNavbar: true,
    fixedNavbar: true,
    openConfigurator: false,
    direction: "ltr",
    layout: "dashboard",
    darkMode: false,
    hasUserManuallyToggledSidenav: false,
  };

  // Load preferences from localStorage on initialization
  const initialState = loadPreferencesFromStorage(defaultState);

  const [controller, dispatch] = useReducer(reducer, initialState);

  // Load preferences when user logs in (when auth changes)
  useEffect(() => {
    const checkAuthAndLoadPreferences = () => {
      const userId = getUserId();
      if (userId) {
        const loaded = loadPreferencesFromStorage(defaultState);
        // Dispatch to load preferences (this won't trigger save since it's LOAD_PREFERENCES)
        dispatch({ type: "LOAD_PREFERENCES", value: loaded });
      }
    };

    // Listen for storage changes (in case user logs in another tab or auth changes)
    const handleStorageChange = (e) => {
      if (e.key === "auth") {
        // User logged in/out, reload preferences
        setTimeout(checkAuthAndLoadPreferences, 100);
      } else if (e.key?.startsWith("ui_preferences_")) {
        // Preferences changed in another tab
        setTimeout(checkAuthAndLoadPreferences, 100);
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => {
      window.removeEventListener("storage", handleStorageChange);
    };
  }, [defaultState]); // Include defaultState to avoid stale closure

  const value = useMemo(() => [controller, dispatch], [controller, dispatch]);

  return <MaterialUI.Provider value={value}>{children}</MaterialUI.Provider>;
}

// Material Dashboard 2 React custom hook for using context
function useMaterialUIController() {
  const context = useContext(MaterialUI);

  if (!context) {
    throw new Error(
      "useMaterialUIController should be used inside the MaterialUIControllerProvider."
    );
  }

  return context;
}

// Typechecking props for the MaterialUIControllerProvider
MaterialUIControllerProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

// Context module functions
const setMiniSidenav = (dispatch, value) => dispatch({ type: "MINI_SIDENAV", value });
const setTransparentSidenav = (dispatch, value) => dispatch({ type: "TRANSPARENT_SIDENAV", value });
const setWhiteSidenav = (dispatch, value) => dispatch({ type: "WHITE_SIDENAV", value });
const setSidenavColor = (dispatch, value) => dispatch({ type: "SIDENAV_COLOR", value });
const setTransparentNavbar = (dispatch, value) => dispatch({ type: "TRANSPARENT_NAVBAR", value });
const setFixedNavbar = (dispatch, value) => dispatch({ type: "FIXED_NAVBAR", value });
const setOpenConfigurator = (dispatch, value) => dispatch({ type: "OPEN_CONFIGURATOR", value });
const setDirection = (dispatch, value) => dispatch({ type: "DIRECTION", value });
const setLayout = (dispatch, value) => dispatch({ type: "LAYOUT", value });
const setDarkMode = (dispatch, value) => dispatch({ type: "DARKMODE", value });
const setHasUserManuallyToggledSidenav = (dispatch, value) =>
  dispatch({ type: "SET_HAS_USER_MANUALLY_TOGGLED_SIDENAV", value });

export {
  MaterialUIControllerProvider,
  useMaterialUIController,
  setMiniSidenav,
  setTransparentSidenav,
  setWhiteSidenav,
  setSidenavColor,
  setTransparentNavbar,
  setFixedNavbar,
  setOpenConfigurator,
  setDirection,
  setLayout,
  setDarkMode,
  setHasUserManuallyToggledSidenav,
};
