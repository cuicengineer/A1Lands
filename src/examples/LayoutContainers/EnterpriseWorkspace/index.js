/**
 * EnterpriseWorkspace — dense SaaS settings shell.
 * Page header: title + metadata (left), grid toolbar controls (right).
 */

import { useMemo } from "react";
import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import { WorkspaceShellProvider, useWorkspaceShellState } from "context/WorkspaceShellContext";
import { mergeWorkspaceMetricChips } from "utils/workspaceRecordMetrics";
import { WorkspaceGridToolbarProvider } from "context/WorkspaceGridToolbarContext";
import WorkspaceMetadataBar from "./WorkspaceMetadataBar";
import WorkspaceHeaderToolbar from "./WorkspaceHeaderToolbar";

/** @deprecated Prefer EnterpriseWorkspace title/actions props. Kept for toolbar extras. */
export function WorkspacePageHeader({ title, actions }) {
  return (
    <MDBox
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      gap={2}
      flexWrap="wrap"
      sx={{ minWidth: 0, flex: "1 1 auto" }}
    >
      {title ? (
        <MDTypography
          variant="button"
          fontWeight="medium"
          sx={{
            fontSize: "0.875rem",
            color: "#6b7280",
            letterSpacing: "0.01em",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </MDTypography>
      ) : null}
      {actions ? (
        <MDBox display="flex" alignItems="center" gap={1} flexWrap="wrap">
          {actions}
        </MDBox>
      ) : null}
    </MDBox>
  );
}

WorkspacePageHeader.propTypes = {
  title: PropTypes.string,
  actions: PropTypes.node,
};

WorkspacePageHeader.defaultProps = {
  title: null,
  actions: null,
};

function EnterpriseWorkspaceInner({
  title,
  subtitle,
  actions,
  metadata,
  tabs,
  filters,
  cardToolbar,
  children,
  bodySx,
  sx,
  pageClassName,
}) {
  const { metrics: shellMetrics } = useWorkspaceShellState() || {};
  const metricChips = useMemo(
    () => mergeWorkspaceMetricChips(metadata, shellMetrics),
    [metadata, shellMetrics]
  );

  const hasHeader = title || subtitle || actions || (metricChips && metricChips.length > 0);

  return (
    <MDBox
      className={[
        "saas-workspace-page",
        "enterprise-workspace",
        "saas-settings-page",
        pageClassName,
      ]
        .filter(Boolean)
        .join(" ")}
      sx={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        flex: "1 1 0",
        minHeight: 0,
        overflow: "hidden",
        ...sx,
      }}
    >
      {hasHeader ? (
        <MDBox className="saas-workspace-page-header">
          <MDBox className="saas-workspace-page-heading">
            {title || (metricChips && metricChips.length > 0) ? (
              <MDBox className="saas-workspace-title-row">
                {title ? (
                  <MDTypography
                    component="h1"
                    className="saas-workspace-title"
                    sx={{ userSelect: "none", cursor: "default" }}
                  >
                    {title}
                  </MDTypography>
                ) : null}
                <WorkspaceMetadataBar chips={metricChips} inline />
              </MDBox>
            ) : null}
            {subtitle ? (
              <MDTypography component="p" className="saas-workspace-subtitle">
                {subtitle}
              </MDTypography>
            ) : null}
          </MDBox>
          <WorkspaceHeaderToolbar />
        </MDBox>
      ) : null}

      {tabs ? <MDBox className="saas-workspace-tabs">{tabs}</MDBox> : null}

      <MDBox
        className="saas-workspace-card"
        sx={{
          flex: "1 1 0",
          minHeight: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {filters ? <MDBox className="saas-workspace-filters">{filters}</MDBox> : null}
        {cardToolbar ? <MDBox className="saas-workspace-card-toolbar">{cardToolbar}</MDBox> : null}
        <MDBox
          className="enterprise-workspace-grid-host saas-workspace-grid-host"
          sx={{
            flex: "1 1 0",
            minHeight: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            position: "relative",
            ...bodySx,
          }}
        >
          {children}
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

EnterpriseWorkspaceInner.propTypes = {
  title: PropTypes.string,
  subtitle: PropTypes.string,
  actions: PropTypes.node,
  metadata: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ),
  tabs: PropTypes.node,
  filters: PropTypes.node,
  cardToolbar: PropTypes.node,
  children: PropTypes.node.isRequired,
  bodySx: PropTypes.object,
  sx: PropTypes.object,
  pageClassName: PropTypes.string,
};

EnterpriseWorkspaceInner.defaultProps = {
  title: null,
  subtitle: null,
  actions: null,
  metadata: null,
  tabs: null,
  filters: null,
  cardToolbar: null,
  bodySx: {},
  sx: {},
  pageClassName: null,
};

function EnterpriseWorkspace(props) {
  const { actions, ...rest } = props;
  return (
    <WorkspaceShellProvider>
      <WorkspaceGridToolbarProvider primaryAction={actions || null}>
        <EnterpriseWorkspaceInner actions={actions} {...rest} />
      </WorkspaceGridToolbarProvider>
    </WorkspaceShellProvider>
  );
}

EnterpriseWorkspace.propTypes = EnterpriseWorkspaceInner.propTypes;
EnterpriseWorkspace.defaultProps = EnterpriseWorkspaceInner.defaultProps;

export default EnterpriseWorkspace;
