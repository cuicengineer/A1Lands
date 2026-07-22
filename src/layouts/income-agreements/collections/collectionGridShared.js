export const COLLECTIONS_COLUMNS = [
  { label: "", key: "select", align: "center", width: "40px" },
  { label: "S.No", key: "sno", align: "center", width: "48px" },
  { label: "Class", key: "class", align: "left", width: "minmax(100px, 1fr)" },
  { label: "Agreement", key: "agreement", align: "left", width: "minmax(160px, 1.3fr)" },
  { label: "Account", key: "account", align: "left", width: "minmax(130px, 1.1fr)" },
  {
    label: "Tenant and Business",
    key: "tenantBusiness",
    align: "left",
    width: "minmax(180px, 1.5fr)",
  },
  { label: "Invoice", key: "invoice", align: "left", width: "minmax(160px, 1.3fr)" },
  // Six-figure amounts with grouping separators (e.g. 1,234,567.89) need a firm min width.
  { label: "Receivable", key: "receivable", align: "right", width: "minmax(132px, 1.05fr)" },
  { label: "Balance", key: "balance", align: "right", width: "minmax(132px, 1.05fr)" },
  { label: "Amount", key: "amount", align: "right", width: "minmax(132px, 1.05fr)" },
  { label: "TIN-TRN", key: "tinTrn", align: "left", width: "minmax(110px, 1fr)" },
  { label: "Remarks", key: "remarks", align: "left", width: "minmax(140px, 1.2fr)" },
  { label: "Attach", key: "attach", align: "center", width: "108px" },
  { label: "Status", key: "status", align: "left", width: "minmax(96px, 0.85fr)" },
  { label: "Vr No", key: "vrNo", align: "left", width: "minmax(180px, 1.5fr)" },
  { label: "Vr Date", key: "vrDate", align: "left", width: "minmax(100px, 0.9fr)" },
  { label: "Action", key: "actions", align: "center", width: "118px" },
];

export const COLLECTIONS_PINNED_COLUMN_KEYS = new Set(["select", "actions"]);

export const COLLECTIONS_TOGGLEABLE_COLUMNS = COLLECTIONS_COLUMNS.filter(
  (col) => !COLLECTIONS_PINNED_COLUMN_KEYS.has(col.key)
);

export function buildCollectionsGridTemplate(hiddenColumnKeys = []) {
  const hidden = new Set(hiddenColumnKeys || []);
  return COLLECTIONS_COLUMNS.map((col) => {
    if (hidden.has(col.key) && !COLLECTIONS_PINNED_COLUMN_KEYS.has(col.key)) {
      return "0px";
    }
    return col.width;
  }).join(" ");
}

export function isCollectionGridColumnVisible(columnKey, hiddenColumnKeys = []) {
  if (COLLECTIONS_PINNED_COLUMN_KEYS.has(columnKey)) return true;
  return !new Set(hiddenColumnKeys || []).has(columnKey);
}

export const GRID_TEMPLATE = COLLECTIONS_COLUMNS.map((col) => col.width).join(" ");

export const COLLECTION_GRID_CELL_MIN_HEIGHT = 30;

export const COLLECTION_GRID_CELL_TEXT_COLOR = "#111111";

export const COLLECTION_GRID_LINK_ICON_SX = {
  p: "1px",
  minWidth: 18,
  width: 18,
  height: 18,
  flexShrink: 0,
  "& .MuiSvgIcon-root": { fontSize: "0.75rem !important" },
};

export function mergeBodyCellSx(bodyCellSx, { align = "left", compact = false } = {}) {
  const justifyContent =
    align === "right" ? "flex-end" : align === "center" ? "center" : "flex-start";

  return {
    ...bodyCellSx,
    display: "flex",
    alignItems: "center",
    justifyContent,
    textAlign: align,
    minHeight: COLLECTION_GRID_CELL_MIN_HEIGHT,
    ...(compact ? { p: "0.35rem 0.5rem" } : {}),
  };
}

export const COLLECTION_GRID_ACTION_ICON_SX = {
  p: "1px",
  minWidth: 20,
  width: 20,
  height: 20,
  "& .MuiSvgIcon-root": { fontSize: "0.78rem !important" },
};

export const inputSx = {
  "& .MuiInputBase-root": {
    fontSize: "0.75rem",
    minHeight: 30,
    color: COLLECTION_GRID_CELL_TEXT_COLOR,
  },
  "& .MuiInputBase-input": { py: 0.45, px: 0.5, color: COLLECTION_GRID_CELL_TEXT_COLOR },
  "& .MuiSelect-select": {
    py: 0.45,
    px: 0.5,
    minHeight: "30px !important",
    display: "flex",
    alignItems: "center",
    color: COLLECTION_GRID_CELL_TEXT_COLOR,
  },
};

export const readOnlySx = {
  fontSize: "0.75rem",
  lineHeight: 1.3,
  color: COLLECTION_GRID_CELL_TEXT_COLOR,
};

export const oneLineMenuItemSx = {
  fontSize: "0.6875rem",
  lineHeight: 1.15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block",
  maxWidth: "100%",
};
