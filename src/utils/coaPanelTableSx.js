/**
 * Split-panel Chart of Accounts / Income Statement grid layout.
 * Constrains nested DataTable scroll regions so vertical scrollbars appear when rows overflow.
 */
export const coaPanelColumnSx = {
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
  flexDirection: "row",
  gap: 2,
  flex: "1 1 0",
  minHeight: 0,
  overflow: "hidden",
  width: "100%",
  maxWidth: "100%",
  alignItems: "stretch",
  "& > *": {
    flex: "1 1 0",
    minHeight: 0,
    minWidth: 0,
    height: "100%",
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
  },
  "& .MuiTableContainer-root": {
    flex: "1 1 0",
    minHeight: 0,
    height: "100%",
    overflow: "hidden",
    width: "100%",
    display: "flex",
    flexDirection: "column",
  },
  "& .saas-settings-table-scroll": {
    flex: "1 1 0",
    minHeight: 0,
    width: "100% !important",
    maxWidth: "100% !important",
    overflowY: "auto",
    overflowX: "auto",
    scrollbarGutter: "stable",
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
    lineHeight: 1.4,
    maxWidth: "100%",
    verticalAlign: "top",
  },
  "& .MuiTable-root th": {
    fontSize: "10px !important",
    fontWeight: "700 !important",
    padding: "12px 8px !important",
    borderBottom: "1px solid #d0d0d0",
    whiteSpace: "normal !important",
    overflow: "visible !important",
    wordBreak: "normal !important",
    overflowWrap: "normal !important",
    lineHeight: 1.25,
    verticalAlign: "middle",
    "& *": {
      whiteSpace: "normal !important",
      overflow: "visible !important",
      textOverflow: "clip !important",
      wordBreak: "normal !important",
      overflowWrap: "normal !important",
    },
  },
  "& .MuiTable-root td": {
    padding: "10px 10px !important",
    borderBottom: "1px solid #e0e0e0",
  },
};
