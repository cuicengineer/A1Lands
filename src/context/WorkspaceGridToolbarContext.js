/**
 * Registers DataTable toolbar handlers so EnterpriseWorkspace can render
 * search / columns / export in the page header (same DOM tree, fully interactive).
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import PropTypes from "prop-types";

const WorkspaceGridToolbarStateContext = createContext(null);
const WorkspaceGridToolbarRegisterContext = createContext(null);

export function WorkspaceGridToolbarProvider({ primaryAction, children }) {
  const [toolbar, setToolbarState] = useState(null);

  const registerToolbar = useCallback((next) => {
    setToolbarState(next);
  }, []);

  const stateValue = useMemo(
    () => ({
      toolbar,
      primaryAction: primaryAction || null,
    }),
    [toolbar, primaryAction]
  );

  return (
    <WorkspaceGridToolbarRegisterContext.Provider value={registerToolbar}>
      <WorkspaceGridToolbarStateContext.Provider value={stateValue}>
        {children}
      </WorkspaceGridToolbarStateContext.Provider>
    </WorkspaceGridToolbarRegisterContext.Provider>
  );
}

WorkspaceGridToolbarProvider.propTypes = {
  primaryAction: PropTypes.node,
  children: PropTypes.node.isRequired,
};

WorkspaceGridToolbarProvider.defaultProps = {
  primaryAction: null,
};

export function useWorkspaceGridToolbarState() {
  return useContext(WorkspaceGridToolbarStateContext);
}

export function useWorkspaceGridToolbarRegister() {
  return useContext(WorkspaceGridToolbarRegisterContext);
}
