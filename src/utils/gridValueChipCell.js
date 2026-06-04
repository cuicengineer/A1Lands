import React from "react";
import GridValueChip from "components/GridValueChip";

export function isGridGroupHeaderRow(row) {
  const orig = row?.original ?? row;
  return Boolean(orig?.IsGroupRow || orig?.isGroupRow);
}

export function renderGridValueChip(value, variant = "neutral") {
  const text = value == null ? "" : String(value).trim();
  if (!text || text === "-") return "-";
  return <GridValueChip value={text} variant={variant} />;
}

/** Wrap a resolved cell value in a soft grid chip; skips group header rows and empty values. */
export function withGridValueChip(content, variant, { row, forcePlain = false } = {}) {
  if (content == null) return null;
  if (forcePlain || isGridGroupHeaderRow(row)) {
    const text = String(content).trim();
    return text || "-";
  }
  if (React.isValidElement(content)) return content;
  return renderGridValueChip(content, variant);
}

/** Simple Cell renderer for accessor-only RAC / Base / Class columns. */
export function gridValueChipCell(variant) {
  // eslint-disable-next-line react/prop-types
  return ({ value, row }) => withGridValueChip(value, variant, { row });
}
