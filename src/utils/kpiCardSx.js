/** ERP design guide primary brand color for featured KPI cards */
export const ERP_PRIMARY_COLOR = "#025B64";

export function mergeKpiCardSx(cardSx = {}, { primary = false, onClick = false, ...extraSx } = {}) {
  return {
    ...cardSx,
    ...extraSx,
    ...(onClick ? { cursor: "pointer" } : {}),
    ...(primary
      ? {
          background: `${ERP_PRIMARY_COLOR} !important`,
          backgroundColor: `${ERP_PRIMARY_COLOR} !important`,
          color: "#ffffff !important",
          border: "none",
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.04)",
        }
      : {}),
  };
}
