import MDTypography from "components/MDTypography";

const CELL_PADDING_Y = "3px";
const CELL_PADDING_X = "5px";
const CELL_FONT_SIZE = "0.75rem";
const CELL_LINE_HEIGHT = 1.2;
const HEADER_FONT_SIZE = "0.6875rem";
const COMPACT_CELL_PADDING = "2px 3px";

export const COLLECTIONS_GRID_ICON_BUTTON_SX = {
  padding: "1px",
  "& .MuiSvgIcon-root": { fontSize: "0.95rem !important" },
};

export const COLLECTIONS_GRID_ACTION_BOX_SX = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 0,
};

export const COLLECTIONS_GRID_TEXT_SX = {
  display: "block",
  width: "100%",
  fontSize: CELL_FONT_SIZE,
  lineHeight: 1.3,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
};

export function renderCollectionsGridText(value, fallback = "-") {
  const text = value != null && String(value).trim() !== "" ? String(value) : fallback;
  return (
    <MDTypography variant="caption" sx={COLLECTIONS_GRID_TEXT_SX}>
      {text}
    </MDTypography>
  );
}

export function renderCollectionsGridSno(value) {
  const text = value != null && value !== "" ? value : "-";
  return (
    <MDTypography
      variant="caption"
      sx={{ ...COLLECTIONS_GRID_TEXT_SX, fontWeight: 600, textAlign: "center" }}
    >
      {text}
    </MDTypography>
  );
}

export function renderCollectionsGridAmount(value) {
  return (
    <MDTypography
      variant="caption"
      sx={{
        ...COLLECTIONS_GRID_TEXT_SX,
        textAlign: "right",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value != null && value !== "" ? value : "-"}
    </MDTypography>
  );
}

const COLLECTIONS_GRID_TABLE_BASE_SX = {
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
  position: "relative",
  "& .MuiTableContainer-root": {
    flex: "1 1 0",
    minHeight: 0,
    overflow: "auto",
    border: "1px solid #e0e0e0",
  },
  "& .MuiTable-root": {
    tableLayout: "auto",
    width: "max-content",
    minWidth: "100%",
    borderCollapse: "collapse",
  },
  "& .MuiTable-root th": {
    fontSize: `${HEADER_FONT_SIZE} !important`,
    fontWeight: "700 !important",
    padding: `${CELL_PADDING_Y} ${CELL_PADDING_X} !important`,
    bgcolor: "#c8e6c9 !important",
    color: "#1b5e20 !important",
    borderBottom: "1px solid rgba(0,0,0,0.12) !important",
    borderRight: "1px solid rgba(0,0,0,0.06) !important",
    whiteSpace: "nowrap",
    lineHeight: `${CELL_LINE_HEIGHT} !important`,
    verticalAlign: "middle",
    backgroundImage: "none !important",
    "& *": {
      color: "#1b5e20 !important",
    },
  },
  "& .MuiTable-root td": {
    padding: `${CELL_PADDING_Y} ${CELL_PADDING_X} !important`,
    borderBottom: "1px solid rgba(0,0,0,0.06) !important",
    borderRight: "1px solid rgba(0,0,0,0.04) !important",
    whiteSpace: "nowrap",
    lineHeight: `${CELL_LINE_HEIGHT} !important`,
    verticalAlign: "middle",
    fontSize: CELL_FONT_SIZE,
    overflow: "hidden",
    textOverflow: "ellipsis",
    backgroundColor: "transparent !important",
  },
  "& .MuiTable-root tbody tr:nth-of-type(even) td": {
    backgroundColor: "transparent !important",
  },
  "& .MuiTable-root tbody tr:hover td": {
    bgcolor: "rgba(0,0,0,0.02) !important",
  },
  "& table th > div, & table td > div": {
    display: "block !important",
    width: "100% !important",
    maxWidth: "100% !important",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: CELL_FONT_SIZE,
    lineHeight: CELL_LINE_HEIGHT,
  },
  "& .MuiIconButton-root": {
    padding: "1px",
  },
  "& .MuiTableRow-root": {
    height: "auto",
  },
};

export function buildCollectionsGridTableBodySx({
  leadingCompactColumnCount = 0,
  trailingCompactColumnCount = 0,
  zeroGapBetweenFirstTwoLeadingColumns = false,
} = {}) {
  const compactColumnSx = {
    padding: `${COMPACT_CELL_PADDING} !important`,
    width: "1%",
    maxWidth: "max-content",
    whiteSpace: "nowrap",
    textAlign: "center",
  };

  const sx = { ...COLLECTIONS_GRID_TABLE_BASE_SX };

  if (leadingCompactColumnCount) {
    sx[
      `& .MuiTable-root th:nth-of-type(-n+${leadingCompactColumnCount}), & .MuiTable-root td:nth-of-type(-n+${leadingCompactColumnCount})`
    ] = compactColumnSx;
  }

  if (trailingCompactColumnCount) {
    sx[
      `& .MuiTable-root th:nth-last-of-type(-n+${trailingCompactColumnCount}), & .MuiTable-root td:nth-last-of-type(-n+${trailingCompactColumnCount})`
    ] = compactColumnSx;
  }

  if (zeroGapBetweenFirstTwoLeadingColumns && leadingCompactColumnCount >= 2) {
    sx["& .MuiTable-root th:nth-of-type(1), & .MuiTable-root td:nth-of-type(1)"] = {
      paddingRight: "0 !important",
      borderRight: "none !important",
    };
    sx["& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2)"] = {
      paddingLeft: "0 !important",
    };
  }

  return sx;
}
