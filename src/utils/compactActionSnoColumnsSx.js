/** Tighter spacing between Action and auto-inserted S.No columns in config grids. */
export const compactActionSnoColumnsSx = {
  "& .MuiTable-root th:first-of-type, & .MuiTable-root td:first-of-type": {
    width: "56px !important",
    maxWidth: "56px !important",
    minWidth: "56px !important",
    paddingLeft: "4px !important",
    paddingRight: "2px !important",
  },
  "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2)": {
    width: "36px !important",
    maxWidth: "36px !important",
    minWidth: "36px !important",
    paddingLeft: "2px !important",
    paddingRight: "6px !important",
    whiteSpace: "nowrap !important",
    textAlign: "center",
  },
};
