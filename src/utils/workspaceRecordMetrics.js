import PropTypes from "prop-types";

/** Build KPI chips for EnterpriseWorkspace header from server/client pagination state. */
export function buildWorkspaceRecordMetrics({
  total = 0,
  page = null,
  pageSize = null,
  visible = null,
  totalEntriesText = null,
}) {
  if (totalEntriesText) {
    return [{ key: "records", label: "records", value: totalEntriesText }];
  }

  const hasServerPagination =
    page != null && pageSize != null && Number(pageSize) > 0 && Number(page) > 0;
  const totalPages = hasServerPagination ? Math.max(1, Math.ceil(total / pageSize)) : 1;
  const showingStart = hasServerPagination && total > 0 ? (page - 1) * pageSize + 1 : 0;
  const showingEnd = hasServerPagination && total > 0 ? Math.min(page * pageSize, total) : 0;

  const chips = [{ key: "total", label: "records", value: total }];

  if (total > 0) {
    if (visible != null && visible !== total) {
      chips.push({ key: "visible", label: "visible", value: visible });
    } else if (hasServerPagination && (total > pageSize || page > 1)) {
      chips.push({ key: "showing", label: "showing", value: `${showingStart}–${showingEnd}` });
    }
    if (hasServerPagination && totalPages > 1) {
      chips.push({ key: "page", label: "page", value: `${page}/${totalPages}` });
    }
  }

  return chips;
}

const STATIC_METRIC_KEYS = new Set(["total", "visible", "records"]);
const LIVE_METRIC_KEYS = new Set(["page", "showing"]);

/** Merge page-level totals with live DataTable pagination chips. */
export function mergeWorkspaceMetricChips(staticMetadata, liveMetrics) {
  if (!staticMetadata?.length) return liveMetrics ?? null;
  if (!liveMetrics?.length) return staticMetadata;
  const staticChips = staticMetadata.filter((c) => STATIC_METRIC_KEYS.has(c.key));
  const liveChips = liveMetrics.filter((c) => LIVE_METRIC_KEYS.has(c.key));
  return [...staticChips, ...liveChips];
}

buildWorkspaceRecordMetrics.propTypes = {
  total: PropTypes.number,
  page: PropTypes.number,
  pageSize: PropTypes.number,
  visible: PropTypes.number,
  totalEntriesText: PropTypes.string,
};
