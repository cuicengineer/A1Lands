/**
 * Lifts DataTable record metrics into EnterpriseWorkspace header KPI chips.
 */

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import PropTypes from "prop-types";

const WorkspaceShellStateContext = createContext(null);
const WorkspaceShellDispatchContext = createContext(null);

export function WorkspaceShellProvider({ children }) {
  const [metrics, setMetricsState] = useState(null);

  const setGridMetrics = useCallback((next) => {
    setMetricsState((prev) => {
      if (prev === next) return prev;
      if (
        prev &&
        next &&
        prev.length === next.length &&
        prev.every((chip, i) => chip.key === next[i].key && chip.value === next[i].value)
      ) {
        return prev;
      }
      return next;
    });
  }, []);

  const clearGridShell = useCallback(() => {
    setMetricsState(null);
  }, []);

  const stateValue = useMemo(() => ({ metrics }), [metrics]);

  const dispatchValue = useMemo(
    () => ({
      setGridMetrics,
      clearGridShell,
    }),
    [setGridMetrics, clearGridShell]
  );

  return (
    <WorkspaceShellDispatchContext.Provider value={dispatchValue}>
      <WorkspaceShellStateContext.Provider value={stateValue}>
        {children}
      </WorkspaceShellStateContext.Provider>
    </WorkspaceShellDispatchContext.Provider>
  );
}

WorkspaceShellProvider.propTypes = {
  children: PropTypes.node.isRequired,
};

export function useWorkspaceShellState() {
  return useContext(WorkspaceShellStateContext);
}

export function useWorkspaceShellDispatch() {
  return useContext(WorkspaceShellDispatchContext);
}

/** @deprecated Prefer useWorkspaceShellState / useWorkspaceShellDispatch */
export function useWorkspaceShell() {
  const state = useWorkspaceShellState();
  const dispatch = useWorkspaceShellDispatch();
  if (!state && !dispatch) return null;
  return { ...state, ...dispatch };
}
