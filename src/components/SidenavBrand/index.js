/**
 * ERP sidebar branding — AI + Land Management System
 */

import PropTypes from "prop-types";
import MDBox from "components/MDBox";

function SidenavBrand({ mini }) {
  if (mini) {
    return (
      <MDBox
        className="erp-sidenav-brand erp-sidenav-brand--mini"
        aria-label="Land Management System"
      >
        <span className="erp-sidenav-brand__ai">AI</span>
      </MDBox>
    );
  }

  return (
    <MDBox className="erp-sidenav-brand" aria-label="AI Land Management System">
      <span className="erp-sidenav-brand__ai">AI</span>
      <span className="erp-sidenav-brand__subtitle">Land Activities Mgmt. System</span>
    </MDBox>
  );
}

SidenavBrand.propTypes = {
  mini: PropTypes.bool,
};

SidenavBrand.defaultProps = {
  mini: false,
};

export default SidenavBrand;
