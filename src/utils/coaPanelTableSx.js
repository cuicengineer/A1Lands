/**
 * Split-panel Chart of Accounts / Income Statement grid layout.
 * Constrains nested DataTable scroll regions so vertical scrollbars appear when rows overflow.
 */
export const coaPanelColumnSx = {
  flex: "0 0 calc(50% - 0.5px)",
  minWidth: 0,
  width: "calc(50% - 0.5px)",
  maxWidth: "calc(50% - 0.5px)",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  height: "100%",
};

export const coaPanelInnerSx = {
  flex: "1 1 0",
  minWidth: 0,
  width: "100%",
  maxWidth: "100%",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  height: "100%",
};

export const coaSplitBodySx = {
  display: "flex",
  flexDirection: "row !important",
  flexWrap: "nowrap",
  gap: "5px",
  flex: "1 1 0",
  minHeight: 0,
  overflow: "hidden !important",
  width: "100%",
  maxWidth: "100%",
  alignItems: "stretch",
  "& > *": {
    flex: "0 0 calc(50% - 0.5px) !important",
    minHeight: 0,
    minWidth: 0,
    width: "calc(50% - 0.5px) !important",
    maxWidth: "calc(50% - 0.5px) !important",
    height: "100%",
  },
};

export const coaWorkspaceSx = {
  "&.saas-settings-page": {
    width: "100%",
    maxWidth: "100%",
    padding: "0 !important",
    margin: "0 !important",
  },
  "& .saas-workspace-page-header, & .saas-workspace-tabs": {
    paddingLeft: "0 !important",
    paddingRight: "0 !important",
    marginLeft: "0 !important",
    marginRight: "0 !important",
  },
  "& .saas-workspace-card": {
    padding: "0 !important",
    margin: "0 !important",
    width: "100%",
    maxWidth: "100%",
  },
  "& .saas-workspace-grid-host": {
    padding: "0 !important",
    margin: "0 !important",
    width: "100%",
    maxWidth: "100%",
  },
};

export const coaPanelTableBodySx = {
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  position: "relative",
  width: "100%",
  maxWidth: "100%",
  flex: "1 1 0",
  minHeight: 0,
  height: "100%",
  "& .coa-panel-grid-host": {
    flex: "1 1 0",
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    width: "100%",
    maxWidth: "100%",
    padding: "0 !important",
    margin: "0 !important",
  },
  "& .MuiTableContainer-root": {
    flex: "1 1 0",
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
    width: "100%",
    maxWidth: "100%",
    display: "flex",
    flexDirection: "column",
    padding: "0 !important",
    margin: "0 !important",
  },
  "& .MuiTableContainer-root > .saas-settings-table-toolbar, & .MuiTableContainer-root > .saas-settings-filter-toolbar":
    {
      paddingLeft: "2px !important",
      paddingRight: "2px !important",
      marginLeft: "0 !important",
      marginRight: "0 !important",
    },
  "& .MuiTableContainer-root > .MuiBox-root": {
    marginLeft: "0 !important",
    marginRight: "0 !important",
  },
  "& .saas-settings-table-scroll": {
    flex: "1 1 0",
    minHeight: 0,
    width: "100% !important",
    maxWidth: "100% !important",
    padding: "0 !important",
    margin: "0 !important",
    overflowY: "auto",
    overflowX: "auto",
    scrollbarGutter: "auto",
  },
  "& .MuiTable-root": {
    tableLayout: "fixed",
    width: "100% !important",
    minWidth: "100% !important",
  },
  "& .MuiTableCell-root": {
    whiteSpace: "normal !important",
    wordBreak: "break-word !important",
    overflowWrap: "anywhere !important",
    lineHeight: 1,
    maxWidth: "100%",
    verticalAlign: "top",
    fontSize: "0.6875rem",
  },
  "& .MuiTableRow-root": {
    height: "auto",
  },
  "& .MuiTable-root th": {
    backgroundColor: "#c8e6c9 !important",
    backgroundImage: "none !important",
    color: "#1b5e20 !important",
    fontSize: "8px !important",
    fontWeight: "700 !important",
    padding: "1px 1px !important",
    borderBottom: "1px solid rgba(0,0,0,0.12) !important",
    borderRight: "1px solid rgba(0,0,0,0.06) !important",
    whiteSpace: "normal !important",
    overflow: "visible !important",
    wordBreak: "normal !important",
    overflowWrap: "normal !important",
    lineHeight: 1,
    verticalAlign: "top",
    "& *": {
      whiteSpace: "normal !important",
      overflow: "visible !important",
      textOverflow: "clip !important",
      wordBreak: "normal !important",
      overflowWrap: "normal !important",
    },
  },
  "& .MuiTable-root td": {
    padding: "0 1px !important",
    borderBottom: "1px solid #e0e0e0",
    fontSize: "0.6875rem",
    lineHeight: 1,
    verticalAlign: "top",
    whiteSpace: "normal !important",
    wordBreak: "break-word !important",
    overflowWrap: "anywhere !important",
    overflow: "visible !important",
  },
  "& .MuiTable-root td *": {
    whiteSpace: "normal !important",
    wordBreak: "break-word !important",
    overflowWrap: "anywhere !important",
    textOverflow: "clip !important",
    lineHeight: 1,
  },
  "& .MuiTable-root .MuiIconButton-root:not(.coa-grid-action-icon)": {
    padding: "0 !important",
    width: "12px !important",
    height: "12px !important",
    minWidth: "12px !important",
  },
  "& .MuiTable-root .MuiIconButton-root .MuiSvgIcon-root": {
    fontSize: "0.65rem !important",
  },
  "& .MuiTable-root th:nth-of-type(1)": {
    width: "36px !important",
    minWidth: "36px !important",
    maxWidth: "36px !important",
    textAlign: "right !important",
    padding: "1px 2px 1px 1px !important",
    whiteSpace: "nowrap !important",
    overflow: "visible !important",
    fontSize: "6.5px !important",
    "& > div": {
      justifyContent: "flex-end !important",
      overflow: "visible !important",
      textOverflow: "clip !important",
      fontSize: "6.5px !important",
    },
    "& > div > div:first-of-type": {
      flex: "0 0 auto !important",
      minWidth: "auto !important",
      overflow: "visible !important",
      textOverflow: "clip !important",
      whiteSpace: "nowrap !important",
      fontSize: "6.5px !important",
    },
    "& button, & .MuiIcon-root": {
      display: "none !important",
    },
  },
  "& .MuiTable-root td:nth-of-type(1)": {
    overflow: "hidden !important",
    padding: "0 !important",
    verticalAlign: "middle !important",
    "& > div": {
      overflow: "hidden !important",
      maxWidth: "100% !important",
    },
    "& *": {
      overflow: "hidden !important",
      maxWidth: "100%",
    },
    "& .MuiIconButton-root": {
      padding: "0 !important",
      margin: "0 !important",
      width: "12px !important",
      height: "12px !important",
      minWidth: "12px !important",
      flexShrink: 0,
    },
    "& .MuiIcon-root, & .MuiSvgIcon-root": {
      fontSize: "0.65rem !important",
      width: "0.65rem !important",
      height: "0.65rem !important",
      lineHeight: 1,
    },
  },
  "& .MuiTable-root td:nth-of-type(2)": {
    overflow: "visible !important",
    padding: "0 2px !important",
    verticalAlign: "middle !important",
    "& > div": {
      overflow: "visible !important",
      maxWidth: "100% !important",
    },
    "& .coa-grid-action-icon": {
      padding: "1px !important",
      margin: "0 !important",
      width: "20px !important",
      height: "20px !important",
      minWidth: "20px !important",
      flexShrink: 0,
      overflow: "visible !important",
      opacity: "1 !important",
    },
    "& .coa-grid-action-icon .MuiIcon-root, & .coa-grid-action-icon .MuiSvgIcon-root": {
      fontSize: "0.95rem !important",
      width: "0.95rem !important",
      height: "0.95rem !important",
      lineHeight: 1,
      overflow: "visible !important",
      opacity: "1 !important",
    },
  },
};

const COA_COMPACT_ICON_BUTTON_SX = {
  padding: "0 !important",
  margin: "0 !important",
  width: "12px !important",
  height: "12px !important",
  minWidth: "12px !important",
  flexShrink: 0,
  borderRadius: "2px",
};

/** Sort column: up/down arrows side by side with no gap between icons. */
export const coaSortControlsSx = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 0,
  columnGap: 0,
  width: "100%",
  maxWidth: "100%",
  overflow: "hidden",
  mx: "auto",
  lineHeight: 0,
  "& > span": {
    display: "inline-flex",
    margin: 0,
    padding: 0,
    lineHeight: 0,
    flexShrink: 0,
  },
  "& > span + span": {
    marginLeft: 0,
  },
  "& > span .MuiIconButton-root": {
    ...COA_COMPACT_ICON_BUTTON_SX,
  },
  "& .MuiSvgIcon-root, & .MuiIcon-root": {
    fontSize: "0.65rem !important",
    width: "0.65rem !important",
    height: "0.65rem !important",
    margin: 0,
    lineHeight: 1,
  },
};

const COA_GRID_ACTION_ICON_BASE_SX = {
  padding: "1px !important",
  margin: "0 !important",
  width: "20px !important",
  height: "20px !important",
  minWidth: "20px !important",
  opacity: "1 !important",
  overflow: "visible !important",
  transform: "none !important",
  filter: "none !important",
  WebkitTextFillColor: "currentColor",
  "& .MuiIcon-root": {
    fontSize: "0.95rem !important",
    width: "0.95rem !important",
    height: "0.95rem !important",
    opacity: "1 !important",
    lineHeight: 1,
    WebkitTextFillColor: "currentColor",
  },
  "&.Mui-disabled": {
    opacity: "1 !important",
    filter: "none !important",
    pointerEvents: "none",
  },
};

export const coaCloneIconSx = {
  color: "#7b809a !important",
  opacity: "1 !important",
};

export const coaEditIconSx = {
  color: "#1A73E8 !important",
  opacity: "1 !important",
};

export const coaDeleteIconSx = {
  color: "#F44335 !important",
  opacity: "1 !important",
};

/** Per-icon styles applied directly on IconButton (beats global grid ghost opacity). */
export const coaCloneIconButtonSx = {
  ...COA_GRID_ACTION_ICON_BASE_SX,
  color: "#7b809a !important",
  "& .MuiIcon-root": {
    ...COA_GRID_ACTION_ICON_BASE_SX["& .MuiIcon-root"],
    color: "#7b809a !important",
  },
  "&.Mui-disabled .MuiIcon-root": {
    color: "rgba(123, 128, 154, 0.75) !important",
  },
};

export const coaEditIconButtonSx = {
  ...COA_GRID_ACTION_ICON_BASE_SX,
  color: "#1A73E8 !important",
  "& .MuiIcon-root": {
    ...COA_GRID_ACTION_ICON_BASE_SX["& .MuiIcon-root"],
    color: "#1A73E8 !important",
  },
  "&.Mui-disabled .MuiIcon-root": {
    color: "rgba(26, 115, 232, 0.75) !important",
  },
};

export const coaDeleteIconButtonSx = {
  ...COA_GRID_ACTION_ICON_BASE_SX,
  color: "#F44335 !important",
  "& .MuiIcon-root": {
    ...COA_GRID_ACTION_ICON_BASE_SX["& .MuiIcon-root"],
    color: "#F44335 !important",
  },
  "&.Mui-disabled .MuiIcon-root": {
    color: "rgba(244, 67, 53, 0.75) !important",
  },
};

/** Actions column: clone / edit / delete icons in a single compact row. */
export const coaActionControlsSx = {
  display: "flex",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  flexWrap: "nowrap",
  gap: "2px",
  width: "100%",
  maxWidth: "100%",
  overflow: "visible",
  "& .MuiIconButton-root": {
    ...COA_COMPACT_ICON_BUTTON_SX,
    width: "18px !important",
    height: "18px !important",
    minWidth: "18px !important",
    opacity: "1 !important",
    overflow: "visible !important",
  },
  "& .MuiIcon-root, & .MuiSvgIcon-root": {
    fontSize: "0.875rem !important",
    width: "0.875rem !important",
    height: "0.875rem !important",
    lineHeight: 1,
    opacity: "1 !important",
  },
  "& .MuiIconButton-root.MuiIconButton-colorSecondary, & .MuiIconButton-root.MuiIconButton-colorSecondary .MuiIcon-root":
    {
      color: "#7b809a !important",
    },
  "& .MuiIconButton-root.MuiIconButton-colorInfo, & .MuiIconButton-root.MuiIconButton-colorInfo .MuiIcon-root":
    {
      color: "#1A73E8 !important",
    },
  "& .MuiIconButton-root.MuiIconButton-colorError, & .MuiIconButton-root.MuiIconButton-colorError .MuiIcon-root":
    {
      color: "#F44335 !important",
    },
  "& .MuiIconButton-root.Mui-disabled": {
    opacity: "0.5 !important",
  },
  "& .MuiIconButton-root.Mui-disabled.MuiIconButton-colorSecondary .MuiIcon-root": {
    color: "rgba(123, 128, 154, 0.55) !important",
  },
  "& .MuiIconButton-root.Mui-disabled.MuiIconButton-colorInfo .MuiIcon-root": {
    color: "rgba(26, 115, 232, 0.55) !important",
  },
  "& .MuiIconButton-root.Mui-disabled.MuiIconButton-colorError .MuiIcon-root": {
    color: "rgba(244, 67, 53, 0.55) !important",
  },
};
