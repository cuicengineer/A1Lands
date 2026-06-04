/**
 * Unified ERP dashboard page shell — workspace header, module tabs, scrollable body.
 */

import PropTypes from "prop-types";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import Footer from "examples/Footer";
import DashboardModuleTabs from "layouts/dashboard/components/DashboardModuleTabs";

function DashboardPageShell({
  title,
  subtitle,
  children,
  actions,
  filters,
  metadata,
  bodySx,
  pageClassName,
}) {
  const workspacePageClassName = ["dashboard-redesign-page", pageClassName]
    .filter(Boolean)
    .join(" ");

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title={title}
        subtitle={subtitle}
        metadata={metadata}
        tabs={<DashboardModuleTabs />}
        filters={filters}
        actions={actions}
        pageClassName={workspacePageClassName}
        bodySx={{
          overflow: "auto",
          ...bodySx,
        }}
      >
        {children}
      </EnterpriseWorkspace>
      <Footer />
    </DashboardLayout>
  );
}

DashboardPageShell.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  children: PropTypes.node.isRequired,
  actions: PropTypes.node,
  filters: PropTypes.node,
  metadata: PropTypes.arrayOf(
    PropTypes.shape({
      key: PropTypes.string,
      label: PropTypes.string.isRequired,
      value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    })
  ),
  bodySx: PropTypes.object,
  pageClassName: PropTypes.string,
};

DashboardPageShell.defaultProps = {
  subtitle: null,
  actions: null,
  filters: null,
  metadata: null,
  bodySx: {},
  pageClassName: null,
};

export default DashboardPageShell;
