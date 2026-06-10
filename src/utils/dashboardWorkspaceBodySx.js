/**
 * Full-viewport body styles for Dashboard EnterpriseWorkspace pages.
 * Uses flex (not height:100%) so Firefox resolves layout on SPA navigation.
 */
export const dashboardWorkspaceBodySx = {
  display: "flex",
  flexDirection: "column",
  flex: "1 1 0",
  minHeight: 0,
  overflow: "auto",
  position: "relative",
};
