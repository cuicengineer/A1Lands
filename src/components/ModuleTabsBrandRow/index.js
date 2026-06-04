/**
 * Tabs row shell — module tabs on the left, A1 Lands brand on the right.
 */

import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

function ModuleTabsBrandRow({ children }) {
  return (
    <MDBox
      className="saas-module-tabs-bar"
      display="flex"
      alignItems="center"
      justifyContent="space-between"
      width="100%"
      gap={1}
    >
      <MDBox className="saas-module-tabs-bar__tabs" sx={{ flex: "1 1 auto", minWidth: 0 }}>
        {children}
      </MDBox>
      <MDTypography component="span" className="saas-module-tabs-brand"></MDTypography>
    </MDBox>
  );
}

ModuleTabsBrandRow.propTypes = {
  children: PropTypes.node.isRequired,
};

export default ModuleTabsBrandRow;
