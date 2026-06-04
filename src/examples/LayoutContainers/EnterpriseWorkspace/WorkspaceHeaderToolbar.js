import { useEffect, useLayoutEffect, useRef } from "react";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import { useWorkspaceGridToolbarState } from "context/WorkspaceGridToolbarContext";

function WorkspaceHeaderToolbar() {
  const state = useWorkspaceGridToolbarState();
  const toolbar = state?.toolbar;
  const primaryAction = state?.primaryAction;
  const searchHostRef = useRef(null);
  const allowSearchFocusRef = useRef(false);
  const blockAutoFocusUntilRef = useRef(0);

  const hasControls =
    Boolean(toolbar?.toolbarStart) ||
    toolbar?.canSearch ||
    toolbar?.showColumns ||
    toolbar?.showExport ||
    Boolean(primaryAction);

  const blurSearchIfAutoFocused = () => {
    if (allowSearchFocusRef.current || !searchHostRef.current) return;
    const input = searchHostRef.current.querySelector("input");
    if (input && document.activeElement === input) {
      input.blur();
    }
  };

  useLayoutEffect(() => {
    allowSearchFocusRef.current = false;
    blockAutoFocusUntilRef.current = Date.now() + 300;
    blurSearchIfAutoFocused();
    const rafId = requestAnimationFrame(blurSearchIfAutoFocused);
    const timeoutId = window.setTimeout(blurSearchIfAutoFocused, 0);
    return () => {
      cancelAnimationFrame(rafId);
      window.clearTimeout(timeoutId);
    };
  }, [toolbar?.canSearch]);

  useEffect(() => {
    if (!toolbar?.canSearch) return undefined;
    const timeoutIds = [50, 150].map((delay) => window.setTimeout(blurSearchIfAutoFocused, delay));
    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [toolbar?.canSearch]);

  if (!hasControls) return null;

  return (
    <MDBox
      className="saas-workspace-header-toolbar"
      display="flex"
      alignItems="center"
      gap={0.75}
      flexWrap="nowrap"
      sx={{ flexShrink: 0, minWidth: 0 }}
    >
      {toolbar?.toolbarStart ? (
        <MDBox
          className="saas-toolbar-start saas-header-toolbar-start"
          display="flex"
          alignItems="center"
          gap={0.75}
          flexWrap="nowrap"
          sx={{ minWidth: 0, flexShrink: 1 }}
        >
          {toolbar.toolbarStart}
        </MDBox>
      ) : null}
      {toolbar?.canSearch ? (
        <MDBox
          ref={searchHostRef}
          className="saas-header-search"
          sx={{ width: "11rem", minWidth: 0 }}
        >
          <MDInput
            placeholder="Search..."
            value={toolbar.search ?? ""}
            size="small"
            fullWidth
            onChange={({ currentTarget }) => {
              toolbar.onSearchInput?.(currentTarget.value);
            }}
            onMouseDown={() => {
              allowSearchFocusRef.current = true;
              blockAutoFocusUntilRef.current = 0;
            }}
            onFocus={({ currentTarget, relatedTarget }) => {
              if (allowSearchFocusRef.current) return;
              if (relatedTarget instanceof HTMLElement) return;
              if (Date.now() < blockAutoFocusUntilRef.current) {
                currentTarget.blur();
              }
            }}
            inputProps={{
              autoComplete: "off",
              "aria-label": "Search table",
            }}
            InputProps={{
              startAdornment: (
                <Icon sx={{ fontSize: "1.125rem", color: "#a3a3a3", mr: 0.5 }}>search</Icon>
              ),
            }}
          />
        </MDBox>
      ) : null}
      {toolbar?.showColumns ? (
        <Tooltip title="Columns">
          <IconButton
            size="small"
            aria-label="Choose visible columns"
            className="saas-header-icon-btn"
            onClick={(event) => {
              event.preventDefault();
              toolbar.openColumnsMenu?.(event.currentTarget);
            }}
          >
            <Icon fontSize="small">view_column</Icon>
          </IconButton>
        </Tooltip>
      ) : null}
      {toolbar?.showExport ? (
        <Tooltip title="Export to Excel">
          <IconButton
            size="small"
            aria-label="Export to Excel"
            className="saas-header-icon-btn"
            onClick={(event) => {
              event.preventDefault();
              toolbar.exportToExcel?.();
            }}
          >
            <Icon fontSize="small">file_download</Icon>
          </IconButton>
        </Tooltip>
      ) : null}
      {primaryAction ? (
        <MDBox className="saas-header-primary-action" sx={{ flexShrink: 0 }}>
          {primaryAction}
        </MDBox>
      ) : null}
    </MDBox>
  );
}

export default WorkspaceHeaderToolbar;
