/**
 * Compact pagination — small page numbers with first/prev/next controls.
 */

import React, { useMemo } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDPagination from "components/MDPagination";

function buildVisiblePages(page, totalPages, window = 2) {
  const pages = [];
  for (let p = 1; p <= totalPages; p += 1) {
    if (p === 1 || p === totalPages || (p >= page - window && p <= page + window)) {
      pages.push(p);
    }
  }
  return pages;
}

function CompactGridPagination({ page, totalPages, onPageChange, variant, color, className }) {
  const visiblePages = useMemo(
    () => (totalPages > 1 ? buildVisiblePages(page, totalPages) : []),
    [page, totalPages]
  );

  if (!totalPages || totalPages <= 1) return null;

  return (
    <MDBox
      className={className}
      display="flex"
      alignItems="center"
      gap={0.25}
      sx={{
        "& .MuiPaginationItem-root": {
          fontSize: "0.7rem",
          minWidth: "1.5rem",
          height: "1.5rem",
        },
        "& .MuiPaginationItem-icon": { fontSize: "1rem" },
      }}
    >
      <MDPagination variant={variant} color={color} size="small">
        {page > 1 && (
          <>
            <MDPagination item onClick={() => onPageChange(1)}>
              <Icon sx={{ fontWeight: "bold", fontSize: "0.95rem" }}>first_page</Icon>
            </MDPagination>
            <MDPagination item onClick={() => onPageChange(page - 1)}>
              <Icon sx={{ fontWeight: "bold", fontSize: "0.95rem" }}>chevron_left</Icon>
            </MDPagination>
          </>
        )}
        {visiblePages.map((p, idx, arr) => {
          const prev = arr[idx - 1];
          const showEllipsis = prev && p - prev > 1;
          return (
            <React.Fragment key={p}>
              {showEllipsis && (
                <MDPagination item disabled>
                  <Icon sx={{ fontSize: "0.85rem" }}>more_horiz</Icon>
                </MDPagination>
              )}
              <MDPagination item active={p === page} onClick={() => onPageChange(p)}>
                {p}
              </MDPagination>
            </React.Fragment>
          );
        })}
        {page < totalPages && (
          <MDPagination item onClick={() => onPageChange(page + 1)}>
            <Icon sx={{ fontWeight: "bold", fontSize: "0.95rem" }}>chevron_right</Icon>
          </MDPagination>
        )}
      </MDPagination>
    </MDBox>
  );
}

CompactGridPagination.defaultProps = {
  variant: "gradient",
  color: "info",
  className: "compact-grid-pagination",
};

CompactGridPagination.propTypes = {
  page: PropTypes.number.isRequired,
  totalPages: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(["gradient", "contained"]),
  color: PropTypes.string,
  className: PropTypes.string,
};

/** Server-side grid helper — returns null when a single page or no rows. */
export function ServerGridPagination({ page, totalCount, pageSize, onPageChange, variant, color }) {
  const totalPages = Math.ceil(Number(totalCount) / Number(pageSize)) || 0;
  if (totalCount <= 0 || totalPages <= 1) return null;

  return (
    <CompactGridPagination
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      variant={variant}
      color={color}
    />
  );
}

ServerGridPagination.defaultProps = {
  variant: "gradient",
  color: "info",
};

ServerGridPagination.propTypes = {
  page: PropTypes.number.isRequired,
  totalCount: PropTypes.number.isRequired,
  pageSize: PropTypes.number.isRequired,
  onPageChange: PropTypes.func.isRequired,
  variant: PropTypes.oneOf(["gradient", "contained"]),
  color: PropTypes.string,
};

export default CompactGridPagination;
