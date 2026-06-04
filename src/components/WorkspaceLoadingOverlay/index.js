/**
 * Full-area loading overlay for EnterpriseWorkspace grid hosts.
 */

import PropTypes from "prop-types";
import MDBox from "components/MDBox";
import CurrencyLoading from "components/CurrencyLoading";

function WorkspaceLoadingOverlay({ active, size = 50, zIndex = 35, sx = {} }) {
  if (!active) return null;

  return (
    <MDBox
      className="workspace-loading-overlay"
      position="absolute"
      top={0}
      left={0}
      right={0}
      bottom={0}
      display="flex"
      justifyContent="center"
      alignItems="center"
      zIndex={zIndex}
      sx={{
        backgroundColor: "rgba(255, 255, 255, 0.8)",
        backdropFilter: "blur(2px)",
        pointerEvents: "auto",
        ...sx,
      }}
    >
      <CurrencyLoading size={size} />
    </MDBox>
  );
}

WorkspaceLoadingOverlay.propTypes = {
  active: PropTypes.bool.isRequired,
  size: PropTypes.number,
  zIndex: PropTypes.number,
  sx: PropTypes.object,
};

WorkspaceLoadingOverlay.defaultProps = {
  size: 50,
  zIndex: 35,
  sx: {},
};

export default WorkspaceLoadingOverlay;
