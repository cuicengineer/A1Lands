import { useLayoutEffect } from "react";
import PropTypes from "prop-types";
import { useWorkspaceGridToolbarRegister } from "context/WorkspaceGridToolbarContext";

/**
 * Registers grid toolbar actions with EnterpriseWorkspace header.
 * Must render inside EnterpriseWorkspace (within WorkspaceGridToolbarProvider).
 */
function CollectionGridToolbarRegistrar({ onExportToExcel, onOpenColumnsMenu }) {
  const registerGridToolbar = useWorkspaceGridToolbarRegister();

  useLayoutEffect(() => {
    if (!registerGridToolbar) return undefined;
    registerGridToolbar({
      canSearch: false,
      showColumns: true,
      showExport: true,
      openColumnsMenu: onOpenColumnsMenu,
      exportToExcel: onExportToExcel,
    });
    return () => registerGridToolbar(null);
  }, [registerGridToolbar, onExportToExcel, onOpenColumnsMenu]);

  return null;
}

CollectionGridToolbarRegistrar.propTypes = {
  onExportToExcel: PropTypes.func.isRequired,
  onOpenColumnsMenu: PropTypes.func.isRequired,
};

export default CollectionGridToolbarRegistrar;
