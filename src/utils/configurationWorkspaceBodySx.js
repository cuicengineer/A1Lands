/**
 * Full-viewport grid body styles for Configuration EnterpriseWorkspace pages.
 * Keeps the data table area filling available height on first load and tab switches.
 */
export const configurationWorkspaceBodySx = {
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  position: "relative",
  flex: "1 1 0",
  minHeight: 0,
  "& .MuiTableContainer-root": {
    flex: "1 1 0",
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
  },
  "& .MuiTable-root": {
    tableLayout: "fixed",
    width: "100%",
  },
  "& .MuiTable-root th": {
    fontSize: "0.925rem !important",
    fontWeight: "700 !important",
    padding: "10px 10px !important",
    borderBottom: "1px solid #d0d0d0",
  },
  "& .MuiTable-root td": {
    padding: "8px 10px !important",
    borderBottom: "1px solid #e0e0e0",
  },
};
