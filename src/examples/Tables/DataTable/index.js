/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import {
  useMemo,
  useEffect,
  useLayoutEffect,
  useState,
  useCallback,
  isValidElement,
  useRef,
} from "react";
import { createPortal } from "react-dom";

// prop-types is a library for typechecking of props
import PropTypes from "prop-types";

// react-table components
import {
  useTable,
  usePagination,
  useGlobalFilter,
  useAsyncDebounce,
  useSortBy,
  useColumnOrder,
  useFilters,
} from "react-table";

// @mui material components
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Icon from "@mui/material/Icon";
import Autocomplete from "@mui/material/Autocomplete";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import IconButton from "@mui/material/IconButton";
import Divider from "@mui/material/Divider";
import Tooltip from "@mui/material/Tooltip";

import * as XLSX from "xlsx";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import CompactGridPagination from "components/CompactGridPagination";

// Material Dashboard 2 React contexts
import { useMaterialUIController } from "context";

// Material Dashboard 2 React example components
import DataTableHeadCell from "examples/Tables/DataTable/DataTableHeadCell";
import DataTableBodyCell from "examples/Tables/DataTable/DataTableBodyCell";
import GridStatusChip from "components/GridStatusChip";
import { canDeleteCurrentMenu, canEditCurrentMenu } from "services/api.service";
import { isEnterpriseSettingsUI } from "utils/enterpriseSettingsUI";
import { useWorkspaceShellDispatch } from "context/WorkspaceShellContext";
import { useWorkspaceGridToolbarRegister } from "context/WorkspaceGridToolbarContext";

/** Resolve primitive field value from react-table row for Excel export. */
function getExportRawRowValue(tableRow, column) {
  const orig = tableRow?.original ?? tableRow;
  if (!orig || !column) return undefined;
  if (typeof column.accessor === "function") {
    try {
      return column.accessor(orig, 0, { original: orig });
    } catch {
      return undefined;
    }
  }
  const keys = [];
  if (column.accessor && typeof column.accessor === "string") keys.push(column.accessor);
  if (column.id && typeof column.id === "string") keys.push(column.id);
  for (const key of keys) {
    if (
      Object.prototype.hasOwnProperty.call(orig, key) &&
      orig[key] !== undefined &&
      orig[key] !== null
    ) {
      return orig[key];
    }
    const pascal = key.length ? `${key.charAt(0).toUpperCase()}${key.slice(1)}` : "";
    if (
      pascal &&
      Object.prototype.hasOwnProperty.call(orig, pascal) &&
      orig[pascal] !== undefined &&
      orig[pascal] !== null
    ) {
      return orig[pascal];
    }
  }
  return undefined;
}

function getGroupChildRowsForExport(orig) {
  if (!orig) return [];
  const children = orig.groupRows ?? orig.GroupRows;
  return Array.isArray(children) ? children : [];
}

function isGroupParentRowForExport(orig) {
  return Boolean(orig?.isGroupRow || orig?.IsGroupRow);
}

function isExpandedChildRowForExport(orig) {
  return Boolean(orig?.isExpandedRow || orig?.IsExpandedRow);
}

function getGroupKeyForExport(orig) {
  const key = orig?.groupKey ?? orig?.GroupKey;
  return key != null ? key : null;
}

/** Append collapsed group children so Excel export matches fully expanded grid view. */
function expandGroupChildrenForExport(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;

  const result = [];
  const childrenAddedForGroup = new Set();

  rows.forEach((r) => {
    result.push(r);
    const orig = r?.original;
    if (!isGroupParentRowForExport(orig)) return;

    const groupKey = getGroupKeyForExport(orig);
    const children = getGroupChildRowsForExport(orig);
    if (children.length === 0) return;

    const hasChildrenAlready = rows.some((other) => {
      const otherOrig = other?.original;
      return isExpandedChildRowForExport(otherOrig) && getGroupKeyForExport(otherOrig) === groupKey;
    });
    if (hasChildrenAlready) return;
    if (groupKey != null && childrenAddedForGroup.has(groupKey)) return;
    if (groupKey != null) childrenAddedForGroup.add(groupKey);

    children.forEach((child) => {
      const resolvedGroupKey = groupKey ?? getGroupKeyForExport(child);
      result.push({
        original: {
          ...child,
          isGroupRow: false,
          IsGroupRow: false,
          isExpandedRow: true,
          IsExpandedRow: true,
          groupKey: resolvedGroupKey,
          GroupKey: resolvedGroupKey,
        },
      });
    });
  });

  return result;
}

function isExportActionColumn(column) {
  const header = typeof column?.Header === "string" ? column.Header.trim().toLowerCase() : "";
  const accessor = typeof column?.accessor === "string" ? column.accessor.trim().toLowerCase() : "";
  const id = typeof column?.id === "string" ? column.id.trim().toLowerCase() : "";
  return (
    header === "actions" ||
    header === "action" ||
    accessor === "actions" ||
    accessor === "action" ||
    id === "actions"
  );
}

const EXPORT_DATE_COLUMN_TOKENS = new Set([
  "periodstart",
  "periodend",
  "risedate",
  "applicabledate",
  "applicationdate",
  "deactivedate",
  "commercialoperationdate",
  "contractstartdate",
  "contractenddate",
  "invoicedate",
  "duedate",
  "lockdate",
  "cod",
  "csd",
  "ced",
]);

function looksLikeExportDateDisplay(value) {
  const s = String(value ?? "").trim();
  return /^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(s) || /^\d{4}-\d{2}-\d{2}/.test(s);
}

function isLikelyDateExportColumn(column) {
  const parts = [
    column?.id,
    column?.accessor,
    typeof column?.Header === "string" ? column.Header : "",
  ]
    .filter(Boolean)
    .map((p) => String(p).toLowerCase());
  return parts.some((p) => p.includes("date") || EXPORT_DATE_COLUMN_TOKENS.has(p));
}

const EXPORT_MONTH_ABBR = {
  jan: 0,
  feb: 1,
  mar: 2,
  apr: 3,
  may: 4,
  jun: 5,
  jul: 6,
  aug: 7,
  sep: 8,
  oct: 9,
  nov: 10,
  dec: 11,
};

function excelDateSerialFromLocalDate(d) {
  const utcMidnight = Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  const epoch = Date.UTC(1899, 11, 30);
  return (utcMidnight - epoch) / 86400000;
}

function parseExportDateValue(value) {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return excelDateSerialFromLocalDate(value);
  }
  if (typeof value === "number" && Number.isFinite(value) && value > 20000 && value < 120000) {
    return value;
  }
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const datePart = s.split("T")[0];
    const [y, m, d] = datePart.split("-").map(Number);
    if (y && m && d) return excelDateSerialFromLocalDate(new Date(y, m - 1, d));
  }
  const dmMatch = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (dmMatch) {
    const day = Number(dmMatch[1]);
    const mon = EXPORT_MONTH_ABBR[dmMatch[2].toLowerCase().slice(0, 3)];
    const year = Number(dmMatch[3]);
    if (mon !== undefined && day && year) {
      return excelDateSerialFromLocalDate(new Date(year, mon, day));
    }
  }
  const parsed = Date.parse(s);
  if (Number.isFinite(parsed)) {
    return excelDateSerialFromLocalDate(new Date(parsed));
  }
  return null;
}

function parseExportNumericValue(raw, formatted) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof formatted === "number" && Number.isFinite(formatted)) return formatted;
  if (typeof raw === "boolean") return raw ? 1 : 0;

  const tryParse = (val) => {
    if (val === null || val === undefined || val === "") return null;
    if (typeof val === "number" && Number.isFinite(val)) return val;
    const s = String(val).trim();
    if (!s) return null;
    const withoutPct = s.replace(/%$/, "").replace(/,/g, "").trim();
    if (/[a-zA-Z]/.test(withoutPct)) return null;
    const n = Number(withoutPct);
    return Number.isFinite(n) ? n : null;
  };

  return tryParse(raw) ?? tryParse(formatted);
}

function coerceExportSheetCell(formatted, raw, column) {
  if (
    formatted &&
    typeof formatted === "object" &&
    formatted !== null &&
    Object.prototype.hasOwnProperty.call(formatted, "v")
  ) {
    return formatted;
  }

  const display =
    formatted !== undefined && formatted !== null
      ? formatted
      : raw !== undefined && raw !== null
      ? raw
      : "";

  if (display === "") return "";

  const dateSerial = parseExportDateValue(raw) ?? parseExportDateValue(display);
  if (
    dateSerial !== null &&
    (isLikelyDateExportColumn(column) ||
      looksLikeExportDateDisplay(display) ||
      looksLikeExportDateDisplay(raw))
  ) {
    return { v: dateSerial, t: "n", z: "dd-mmm-yyyy" };
  }

  if (typeof raw === "number" && Number.isFinite(raw)) {
    return { v: raw, t: "n" };
  }
  if (typeof formatted === "number" && Number.isFinite(formatted)) {
    return { v: formatted, t: "n" };
  }
  if (typeof raw === "boolean") {
    return { v: raw ? 1 : 0, t: "n" };
  }

  const num = parseExportNumericValue(raw, formatted);
  if (num !== null) return { v: num, t: "n" };

  return String(display);
}

function extractText(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean")
    return String(value);

  // Arrays of nodes/values
  if (Array.isArray(value)) return value.map(extractText).join(" ");

  // React elements (e.g., MDBox wrapping strings, MDInput with value prop)
  if (isValidElement(value)) {
    const props = value.props || {};
    if (props.value !== undefined) return extractText(props.value);
    // Common UI props that contain the visible text (e.g., MDBadge)
    if (props.badgeContent !== undefined) return extractText(props.badgeContent);
    if (props.badgecontent !== undefined) return extractText(props.badgecontent);
    if (props.label !== undefined) return extractText(props.label);
    if (props.title !== undefined) return extractText(props.title);
    if (props.children !== undefined) return extractText(props.children);
    return "";
  }

  // Plain objects (best-effort)
  try {
    return String(value);
  } catch (e) {
    return "";
  }
}

/**
 * Zebra + nested-group row tinting (e.g. Govt Share Rate: RAC → rate subgroup → details).
 * Govt sets `nestedExpandedGroupDetail` on rows under an expanded rate subgroup.
 */
function groupedRowBodyStyle(darkMode, rowIndex, original) {
  const settingsUI = isEnterpriseSettingsUI();
  const orig = original || {};
  const isNestedExpandedDetail = Boolean(orig.nestedExpandedGroupDetail);
  const isExpandedTier1 = Boolean(orig.isExpandedRow) && !isNestedExpandedDetail;
  const isRateSubgroupParent = Boolean(orig.isGroupRow && orig.isRateSubGroupRow);
  const even = rowIndex % 2 === 0;
  const zebraBgColor = settingsUI ? "transparent" : even ? "#f0f0f0" : "#ffffff";

  const tier1Bg = settingsUI
    ? "transparent"
    : darkMode
    ? even
      ? "rgb(48, 82, 126)"
      : "rgb(42, 71, 112)"
    : even
    ? "#e3f2fd"
    : "#f0f7fc";

  /** Rate subgroup header + its expanded detail rows (same fill). */
  const subgroupRowBg = settingsUI ? "transparent" : "#b4c7cc";

  let defaultBgColor = zebraBgColor;
  let stripeSx = {};
  let rowHighlight = null;

  if (isNestedExpandedDetail) {
    defaultBgColor = subgroupRowBg;
    rowHighlight = "nestedExpanded";
    stripeSx = settingsUI
      ? {
          boxShadow: "inset 2px 0 0 #22c55e",
          "& td:first-of-type": { paddingLeft: "28px !important" },
        }
      : {
          boxShadow: darkMode
            ? "inset 5px 0 0 rgb(129,199,132), inset 0 0 0 1px rgba(165,214,167,0.32)"
            : "inset 3px 0 0 rgba(46,125,50,0.5)",
          "& td:first-of-type": { paddingLeft: "28px !important" },
        };
  } else if (isRateSubgroupParent) {
    defaultBgColor = subgroupRowBg;
    rowHighlight = "rateSubgroup";
    stripeSx = settingsUI
      ? {
          boxShadow: "inset 2px 0 0 #a855f7",
          "& td:first-of-type": { paddingLeft: "22px !important" },
        }
      : {
          boxShadow: darkMode
            ? "inset 5px 0 0rgba(239, 255, 11, 0.16), inset 0 0 0 1px rgba(186,104,255,0.22)"
            : "inset 3px 0 0 rgba(236, 212, 250, 0.48)",
          "& td:first-of-type": { paddingLeft: "22px !important" },
        };
  } else if (isExpandedTier1) {
    defaultBgColor = tier1Bg;
    rowHighlight = "expanded";
    stripeSx = settingsUI
      ? {
          boxShadow: "inset 2px 0 0 #2563eb",
          "& td:first-of-type": { paddingLeft: "24px !important" },
        }
      : {
          boxShadow: darkMode
            ? "inset 5px 0 0 rgb(144,202,249), inset 0 0 0 1px rgba(144,202,249,0.45)"
            : "inset 3px 0 0 rgba(25,118,210,0.35)",
          "& td:first-of-type": { paddingLeft: "24px !important" },
        };
  }

  const inheritRowBackground = isExpandedTier1 || isNestedExpandedDetail || isRateSubgroupParent;

  return { defaultBgColor, stripeSx, inheritRowBackground, rowHighlight };
}

const BLANK_VALUE_TOKEN = "__BLANK__";
const STATUS_ACTIVE_KEY = 1;
const STATUS_INACTIVE_KEY = 0;

function isStatusColumn(column) {
  if (column?.skipStatusNormalization) return false;
  const header = typeof column?.Header === "string" ? column.Header.trim().toLowerCase() : "";
  const accessor = typeof column?.accessor === "string" ? column.accessor.trim().toLowerCase() : "";
  const id = typeof column?.id === "string" ? column.id.trim().toLowerCase() : "";
  return (
    header === "status" || accessor === "status" || id === "status" || header.includes("status")
  );
}

function normalizeValueToken(value, column) {
  const s = extractText(value).trim();
  if (!s) return BLANK_VALUE_TOKEN;

  if (isStatusColumn(column)) {
    const lower = s.toLowerCase();
    // Active variants
    if (lower === "1" || lower === "true" || lower === "active") return STATUS_ACTIVE_KEY;
    // Inactive variants (some APIs send strings like Disabled/Not Active)
    if (
      lower === "0" ||
      lower === "false" ||
      lower === "inactive" ||
      lower === "in active" ||
      lower === "not active" ||
      lower === "disabled" ||
      lower === "deactive" ||
      lower === "de-active"
    )
      return STATUS_INACTIVE_KEY;
    // Requirement: only two labels in grids => everything else becomes Inactive (except blank)
    return STATUS_INACTIVE_KEY;
  }

  return s;
}

function displayValueFromToken(token, column) {
  if (token === BLANK_VALUE_TOKEN) return "(Blank)";
  if (isStatusColumn(column)) {
    if (token === STATUS_ACTIVE_KEY) return "Active";
    if (token === STATUS_INACTIVE_KEY) return "Inactive";
  }
  return token;
}

/** Default status renderer for grids without a custom Cell (enterprise soft pills). */
function enhanceStatusColumn(column) {
  if (!column || column.Cell || column.skipStatusNormalization) return column;
  if (!isStatusColumn(column)) return column;
  return {
    ...column,
    // eslint-disable-next-line react/prop-types -- react-table cell props
    Cell: ({ value }) => {
      if (value == null || value === "") return null;
      if (isValidElement(value)) return value;
      return <GridStatusChip value={value} />;
    },
  };
}

function ColumnValueFilter({ column }) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchText, setSearchText] = useState("");
  const open = Boolean(anchorEl);

  const uniqueTokens = useMemo(() => {
    const values = new Set();
    const pre = column?.preFilteredRows || [];
    for (let i = 0; i < pre.length; i += 1) {
      const row = pre[i];
      values.add(normalizeValueToken(row.values?.[column.id], column));
    }

    return Array.from(values).sort((a, b) =>
      displayValueFromToken(a, column).localeCompare(displayValueFromToken(b, column))
    );
  }, [column?.id, column?.preFilteredRows]);

  const selected = Array.isArray(column.filterValue) ? column.filterValue : [];
  const allSelected = uniqueTokens.length > 0 && selected.length === uniqueTokens.length;
  const someSelected = selected.length > 0 && selected.length < uniqueTokens.length;

  const visibleTokens = useMemo(() => {
    const q = String(searchText || "")
      .trim()
      .toLowerCase();
    if (!q) return uniqueTokens;
    return uniqueTokens.filter((t) => displayValueFromToken(t, column).toLowerCase().includes(q));
  }, [uniqueTokens, searchText]);

  const applyFilter = (nextSelected) => {
    if (!nextSelected || nextSelected.length === 0) {
      column.setFilter(undefined);
    } else {
      column.setFilter(nextSelected);
    }
  };

  const toggleToken = (token) => {
    const exists = selected.includes(token);
    const next = exists ? selected.filter((t) => t !== token) : [...selected, token];
    applyFilter(next);
  };

  const handleOpen = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setAnchorEl(e.currentTarget);
  };

  const handleClose = (e) => {
    if (e) {
      e.preventDefault?.();
      e.stopPropagation?.();
    }
    setAnchorEl(null);
    setSearchText("");
  };

  const hasActiveFilter = Array.isArray(column.filterValue) && column.filterValue.length > 0;

  return (
    <>
      <Tooltip title="Filter">
        <IconButton
          size="small"
          onClick={handleOpen}
          onMouseDown={(e) => e.stopPropagation()}
          sx={{
            // Keep filter icon compact so it fits below sort controls in all grids
            fontSize: "11px",
            padding: "0px",
            minWidth: "12px",
            minHeight: "12px",
            color: hasActiveFilter ? "#1A73E8" : "#111111",
          }}
        >
          <Icon fontSize="inherit">filter_alt</Icon>
        </IconButton>
      </Tooltip>
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        PaperProps={{
          sx: {
            width: 260,
            maxHeight: 360,
            ...(darkMode
              ? {
                  backgroundColor: "#202940 !important",
                  "& .MuiMenuItem-root": {
                    color: "#ffffff !important",
                  },
                  "& .MuiTypography-root": {
                    color: "#ffffff !important",
                  },
                  "& .MuiDivider-root": {
                    borderColor: "rgba(255, 255, 255, 0.12) !important",
                  },
                }
              : {}),
          },
        }}
        MenuListProps={{
          dense: true,
          onClick: (e) => e.stopPropagation(),
        }}
      >
        <MDBox px={1.5} py={1} onClick={(e) => e.stopPropagation()}>
          <MDInput
            placeholder="Search..."
            size="small"
            fullWidth
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            sx={
              darkMode
                ? {
                    "& .MuiInputBase-input": {
                      color: "#ffffff !important",
                      "&::placeholder": {
                        color: "#ffffff !important",
                        opacity: 0.7,
                      },
                    },
                    "& .MuiInputLabel-root": {
                      color: "#ffffff !important",
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255, 255, 255, 0.3) !important",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255, 255, 255, 0.5) !important",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255, 255, 255, 0.7) !important",
                    },
                  }
                : {}
            }
          />
        </MDBox>
        <Divider />
        <MenuItem
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (allSelected) {
              // No "(None)" option requested; clicking Select All when already all-selected will clear filter
              applyFilter([]);
            } else {
              applyFilter(uniqueTokens);
            }
          }}
        >
          <Checkbox size="small" checked={allSelected} indeterminate={someSelected} />
          <MDTypography
            variant="button"
            sx={{
              fontSize: "0.85rem",
              ...(darkMode ? { color: "#ffffff !important" } : {}),
            }}
          >
            (Select All)
          </MDTypography>
        </MenuItem>
        <Divider />
        {(visibleTokens.length ? visibleTokens : uniqueTokens).slice(0, 200).map((token) => (
          <MenuItem
            key={token}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              toggleToken(token);
            }}
          >
            <Checkbox size="small" checked={selected.includes(token)} />
            <MDTypography
              variant="button"
              sx={{
                fontSize: "0.85rem",
                ...(darkMode ? { color: "#ffffff !important" } : {}),
              }}
            >
              {displayValueFromToken(token, column)}
            </MDTypography>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

ColumnValueFilter.propTypes = {
  column: PropTypes.object.isRequired, // react-table column instance
};

function DataTable({
  entriesPerPage,
  canSearch,
  showTotalEntries,
  table,
  pagination,
  isSorted,
  noEndBorder,
  page: controlledPageIndex,
  pageSize: controlledPageSize,
  onPageChange,
  onEntriesPerPageChange,
  exportFileName,
  exportCellFormatter,
  exportExcludeGroupParentsWhenExpanded,
  exportIncludeAllGroupChildren,
  exportAllColumns,
  initialHiddenColumns,
  stickyToolbarAndHeader,
  stickyBodyMinHeight,
  stickyBodyMaxHeight,
  /** When true with stickyToolbarAndHeader, table body grows with row count (no inner flex clip). Parent should use a fixed height + overflow auto for scrolling. */
  autoHeight,
  contentFitTable,
  onVisibleRowCountChange,
  autoResetFilters,
  toolbarStart,
  /** When true in enterprise mode, renders toolbarStart in the page header beside search. */
  toolbarStartInHeader,
  toolbarEnd,
  /** Optional extra react-table filter types merged with defaults (column.filter must reference a key). */
  extraFilterTypes,
  /** Override entries label (e.g. server-side "12 of 500 entries"). Used when showTotalEntries is true. */
  totalEntriesText,
  /** When true, page-level metadata prop owns header KPI chips (server-side grids). */
  disableHeaderMetrics,
  /** Extra footer content beside entries (e.g. server-side pagination controls). */
  paginationFooter,
  /** When set, client pagination is portaled into this element instead of the table footer. */
  paginationHost,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const settingsUI = isEnterpriseSettingsUI();
  const shellDispatch = useWorkspaceShellDispatch();
  const registerGridToolbar = useWorkspaceGridToolbarRegister();
  const effectiveEntriesPerPage = entriesPerPage === false ? false : entriesPerPage;
  const effectiveShowTotalEntries = settingsUI ? false : showTotalEntries;
  const publishHeaderMetrics = settingsUI && shellDispatch && !disableHeaderMetrics;
  // Ref to store pagination info for S.No column calculation
  const pageInfoRef = useRef({ pageIndex: 0, pageSize: 20 });
  const entriesPerPageConfig =
    entriesPerPage && typeof entriesPerPage === "object" ? entriesPerPage : {};
  const defaultValue = entriesPerPageConfig.defaultValue ? entriesPerPageConfig.defaultValue : 20;
  const entries = entriesPerPageConfig.entries
    ? entriesPerPageConfig.entries.map((el) => el.toString())
    : ["5", "10", "15", "20", "50", "100", "500", "1000"];
  const allowedPageSizes = useMemo(
    () => entries.map((el) => Number(el)).filter((n) => Number.isFinite(n) && n > 0),
    [entries]
  );
  const resolveDisplayPageSize = useCallback(
    (size) => {
      const fallback = Number(defaultValue) || 20;
      const n = Number(size);
      if (!Number.isFinite(n) || n <= 0) return fallback;
      if (allowedPageSizes.length > 0 && !allowedPageSizes.includes(n)) return fallback;
      return n;
    },
    [allowedPageSizes, defaultValue]
  );
  const baseColumns = useMemo(() => table.columns, [table.columns]);

  // Function to check if a column is Actions column
  const isActionsColumn = useCallback((column) => {
    const header = typeof column?.Header === "string" ? column.Header.trim().toLowerCase() : "";
    const accessor =
      typeof column?.accessor === "string" ? column.accessor.trim().toLowerCase() : "";
    const id = typeof column?.id === "string" ? column.id.trim().toLowerCase() : "";
    return (
      header === "actions" ||
      header === "action" ||
      accessor === "actions" ||
      accessor === "action" ||
      id === "actions" ||
      id === "action"
    );
  }, []);

  // Function to check if S.No column already exists
  const hasSNoColumn = useCallback((cols) => {
    return (cols || []).some((c) => {
      const header = typeof c?.Header === "string" ? c.Header.trim().toLowerCase() : "";
      const accessor = typeof c?.accessor === "string" ? c.accessor.trim().toLowerCase() : "";
      return header === "s.no" || header === "sno" || accessor === "sno" || accessor === "s.no";
    });
  }, []);

  // List of excluded files that should NOT have S.No column (based on exportFileName)
  const excludedFiles = [
    "Property-Type",
    "Banks-List",
    "Rental-Value-Rate",
    "Govt-Share-Rate",
    "Sharing-Formula",
    "Chart-of-Accounts",
    "Income-Statement",
    "Receipts",
    "Receipts-Finalized",
    "Receipts-Pending",
  ];
  const shouldExcludeSNo = useMemo(() => {
    if (!exportFileName) return false;
    const fileName = String(exportFileName);
    return excludedFiles.includes(fileName);
  }, [exportFileName]);

  // Add S.No column after Actions column (if Actions exists and S.No doesn't)
  const columnsWithSNo = useMemo(() => {
    if (!baseColumns || baseColumns.length === 0) return baseColumns;

    // Skip S.No for excluded files
    if (shouldExcludeSNo) return baseColumns;

    // Check if Actions column exists and S.No doesn't
    const hasActions = baseColumns.some(isActionsColumn);
    const hasSNo = hasSNoColumn(baseColumns);

    if (!hasActions || hasSNo) return baseColumns;

    // Find Actions column index
    const actionsIndex = baseColumns.findIndex(isActionsColumn);
    if (actionsIndex === -1) return baseColumns;

    // Create S.No column - will calculate serial number in Cell function
    const snoColumn = {
      Header: "S.No",
      accessor: "sno",
      align: "center",
      width: "60px",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // Use ref to get current pagination state (updated after table instance is created)
        const { pageIndex, pageSize } = pageInfoRef.current;
        // eslint-disable-next-line react/prop-types
        const serialNumber = pageIndex * pageSize + row.index + 1;
        return <MDBox sx={{ textAlign: "center", fontSize: "0.875rem" }}>{serialNumber}</MDBox>;
      },
    };

    // Insert S.No after Actions
    const newColumns = [...baseColumns];
    newColumns.splice(actionsIndex + 1, 0, snoColumn);
    return newColumns;
  }, [baseColumns, isActionsColumn, hasSNoColumn, shouldExcludeSNo]);

  const columnsWithStatusCells = useMemo(
    () => (columnsWithSNo || []).map(enhanceStatusColumn),
    [columnsWithSNo]
  );

  const columns = useMemo(() => {
    if (canEditCurrentMenu() || canDeleteCurrentMenu()) return columnsWithStatusCells;
    // Hide Action(s) column when both edit/delete are not allowed
    return (columnsWithStatusCells || []).filter((c) => !isActionsColumn(c));
  }, [columnsWithStatusCells, isActionsColumn]);
  const data = useMemo(() => table.rows, [table.rows]);

  // Function to detect if a column is an "Id" column
  const isIdColumn = useCallback(
    (column) => {
      if (isActionsColumn(column)) return false;
      const header = typeof column?.Header === "string" ? column.Header.trim().toLowerCase() : "";
      const accessor =
        typeof column?.accessor === "string" ? column.accessor.trim().toLowerCase() : "";
      const id = typeof column?.id === "string" ? column.id.trim().toLowerCase() : "";
      // Match "id", "Id", "ID" exactly (case-insensitive after conversion)
      return header === "id" || accessor === "id" || id === "id";
    },
    [isActionsColumn]
  );

  // Automatically hide Id columns by default
  const autoHiddenColumns = useMemo(() => {
    const idColumnIds = [];
    (baseColumns || []).forEach((col) => {
      if (isIdColumn(col)) {
        // Use column.id if available, otherwise try to generate from accessor or Header
        const colId = col.id || col.accessor || (typeof col.Header === "string" ? col.Header : "");
        if (colId) {
          idColumnIds.push(String(colId));
        }
      }
    });
    return idColumnIds;
  }, [baseColumns, isIdColumn]);

  // Merge auto-hidden Id columns with initialHiddenColumns
  const mergedHiddenColumns = useMemo(() => {
    const initial = Array.isArray(initialHiddenColumns) ? initialHiddenColumns : [];
    // Combine and deduplicate
    return [...new Set([...initial, ...autoHiddenColumns])];
  }, [initialHiddenColumns, autoHiddenColumns]);

  const filterTypes = useMemo(
    () => ({
      // Multi-select filter: include rows where the cell value matches any selected token.
      // Group header rows may show comma-aggregated values (e.g. Base "KBH, NRK"); match if any
      // segment matches any selected token. If the user selects the aggregate token itself, detail
      // rows (single-base tokens) still match via segment expansion.
      includesOneOf: (rowsToFilter, id, filterValue) => {
        if (!Array.isArray(filterValue) || filterValue.length === 0) return rowsToFilter;
        const allowed = new Set(filterValue);
        const colId = Array.isArray(id) ? id[0] : id;
        // When the filter list contains an aggregate like "KBH, NRK", detail rows still have
        // single-base tokens; match those rows if their token is any segment of a selected aggregate.
        const tokenMatchesAllowed = (token) => {
          if (allowed.has(token)) return true;
          for (const sel of allowed) {
            const agg = extractText(sel).trim();
            if (agg.includes(",")) {
              const seg = agg
                .split(",")
                .map((p) => normalizeValueToken(p.trim(), { id: colId }))
                .filter((p) => p && p !== BLANK_VALUE_TOKEN);
              if (seg.includes(token)) return true;
            }
          }
          return false;
        };
        return rowsToFilter.filter((row) => {
          /* eslint-disable react/prop-types -- react-table Row shape (original, values) */
          const token = normalizeValueToken(row.values?.[colId], { id: colId });
          if (tokenMatchesAllowed(token)) return true;
          const orig = row.original;
          if (orig?.isGroupRow) {
            const raw = row.values?.[colId];
            const fullText = extractText(raw).trim();
            if (fullText.includes(",")) {
              const parts = fullText
                .split(",")
                .map((p) => normalizeValueToken(p.trim(), { id: colId }))
                .filter((p) => p && p !== BLANK_VALUE_TOKEN);
              return parts.some((p) => tokenMatchesAllowed(p));
            }
          }
          return false;
          /* eslint-enable react/prop-types */
        });
      },
      ...(extraFilterTypes && typeof extraFilterTypes === "object" ? extraFilterTypes : {}),
    }),
    [extraFilterTypes]
  );

  const defaultColumn = useMemo(
    () => ({
      filter: "includesOneOf",
    }),
    []
  );

  // Controlled page index only when parent supplies onPageChange (not a no-op stub).
  const isControlled =
    controlledPageIndex !== undefined &&
    controlledPageIndex !== null &&
    typeof onPageChange === "function";
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const [internalPageSize, setInternalPageSize] = useState(defaultValue || 20);

  const currentPageIndex = isControlled ? controlledPageIndex : internalPageIndex;
  const hasControlledPageSize = controlledPageSize !== undefined && controlledPageSize !== null;
  const currentPageSize = hasControlledPageSize
    ? resolveDisplayPageSize(controlledPageSize)
    : internalPageSize;

  const paginationState = useMemo(
    () => ({
      pageIndex: currentPageIndex,
      pageSize: currentPageSize,
    }),
    [currentPageIndex, currentPageSize]
  );

  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: {
        pageIndex: currentPageIndex,
        pageSize: currentPageSize,
        hiddenColumns: mergedHiddenColumns,
      },
      defaultColumn,
      filterTypes,
      autoResetFilters,
      autoResetPage: false,
      state: paginationState,
      globalFilter: (rows, columnIds, filterValue) => {
        const searchValue = extractText(filterValue).trim().toLowerCase();
        if (!searchValue) return rows;

        return rows.filter((row) =>
          // eslint-disable-next-line react/prop-types
          columnIds.some((id) => extractText(row.values?.[id]).toLowerCase().includes(searchValue))
        );
      },
    },
    useFilters,
    useGlobalFilter,
    useSortBy,
    useColumnOrder,
    usePagination
  );

  const {
    getTableProps,
    getTableBodyProps,
    headerGroups,
    prepareRow,
    rows,
    page,
    pageOptions,
    canPreviousPage,
    canNextPage,
    gotoPage,
    nextPage,
    previousPage,
    setPageSize,
    setGlobalFilter,
    setColumnOrder,
    allColumns,
    state,
  } = tableInstance;

  const hiddenColumns = Array.isArray(state?.hiddenColumns) ? state.hiddenColumns : [];
  const setHiddenColumns =
    typeof tableInstance?.setHiddenColumns === "function"
      ? tableInstance.setHiddenColumns
      : () => {};
  const pageIndex = state?.pageIndex ?? 0;
  const pageSize = state?.pageSize ?? defaultValue ?? 10;
  const globalFilter = state?.globalFilter ?? "";
  const columnOrder = state?.columnOrder ?? [];

  // Update page info ref for S.No column calculation
  pageInfoRef.current = { pageIndex, pageSize };

  // Column selector dropdown
  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const [columnsSearch, setColumnsSearch] = useState("");
  const columnsMenuOpen = Boolean(columnsAnchorEl);

  const selectableColumns = useMemo(() => {
    return (allColumns || []).filter((c) => {
      const header = typeof c?.Header === "string" ? c.Header.trim().toLowerCase() : "";
      const accessor = typeof c?.accessor === "string" ? c.accessor.trim().toLowerCase() : "";
      // don't allow toggling actions column (keeps grids usable)
      if (
        header === "actions" ||
        header === "action" ||
        accessor === "actions" ||
        accessor === "action"
      )
        return false;
      // Include S.No column in selectable columns for export
      if (header === "s.no" || accessor === "sno") return true;
      return Boolean(c?.id);
    });
  }, [allColumns]);

  const visibleSelectableColumns = useMemo(() => {
    const q = String(columnsSearch || "")
      .trim()
      .toLowerCase();
    if (!q) return selectableColumns;
    return selectableColumns.filter((c) => {
      const name = typeof c?.Header === "string" ? c.Header : typeof c?.id === "string" ? c.id : "";
      return String(name).toLowerCase().includes(q);
    });
  }, [selectableColumns, columnsSearch]);

  const toggleColumnVisibility = (colId) => {
    const currentHidden = Array.isArray(hiddenColumns) ? hiddenColumns : [];
    const isHidden = currentHidden.includes(colId);
    const currentlyVisibleCount = selectableColumns.filter(
      (c) => !currentHidden.includes(c.id)
    ).length;

    // Prevent hiding all columns
    if (!isHidden && currentlyVisibleCount <= 1) return;

    const nextHidden = isHidden
      ? currentHidden.filter((x) => x !== colId)
      : [...currentHidden, colId];
    setHiddenColumns(nextHidden);
  };

  const showAllColumns = () => setHiddenColumns([]);

  const exportToExcel = useCallback(async () => {
    try {
      // Find S.No column if it exists
      const snoColumn = allColumns.find((c) => {
        const header = typeof c?.Header === "string" ? c.Header.trim().toLowerCase() : "";
        const accessor = typeof c?.accessor === "string" ? c.accessor.trim().toLowerCase() : "";
        const id = typeof c?.id === "string" ? c.id.trim().toLowerCase() : "";
        return header === "s.no" || accessor === "sno" || id === "sno";
      });

      // If exportAllColumns is true, export all columns regardless of visibility
      // Otherwise, only export visible columns
      const colsToExport = exportAllColumns
        ? selectableColumns
        : (() => {
            const currentHidden = Array.isArray(hiddenColumns) ? hiddenColumns : [];
            return selectableColumns.filter((c) => !currentHidden.includes(c.id));
          })();

      // Always include S.No column in export if it exists (even if hidden)
      const finalColsToExport =
        snoColumn &&
        !colsToExport.find((c) => {
          const cHeader = typeof c?.Header === "string" ? c.Header.trim().toLowerCase() : "";
          const cAccessor = typeof c?.accessor === "string" ? c.accessor.trim().toLowerCase() : "";
          const cId = typeof c?.id === "string" ? c.id.trim().toLowerCase() : "";
          return cHeader === "s.no" || cAccessor === "sno" || cId === "sno";
        })
          ? [snoColumn, ...colsToExport]
          : colsToExport;

      // Export filtered/sorted rows (not just current page)
      let exportRows = (rows || []).slice();
      if (exportIncludeAllGroupChildren) {
        exportRows = expandGroupChildrenForExport(exportRows);
      }
      if (exportExcludeGroupParentsWhenExpanded) {
        const hasExpandedRows = exportRows.some((r) => Boolean(r?.original?.isExpandedRow));
        if (hasExpandedRows) {
          exportRows = exportRows.filter((r) => !Boolean(r?.original?.isGroupRow));
        }
      }

      const headerRow = finalColsToExport.map((c) =>
        typeof c.Header === "string"
          ? c.Header === "Actions"
            ? "Action"
            : c.Header
          : String(c.id || "")
      );

      const bodyRows = exportRows.map((r, index) => {
        try {
          prepareRow(r);
        } catch (e) {
          // ignore
        }

        return finalColsToExport.map((c) => {
          if (isExportActionColumn(c)) return "";

          const cHeader = typeof c?.Header === "string" ? c.Header.trim().toLowerCase() : "";
          const cAccessor = typeof c?.accessor === "string" ? c.accessor.trim().toLowerCase() : "";
          const cId = typeof c?.id === "string" ? c.id.trim().toLowerCase() : "";
          const isSNoColumn =
            snoColumn &&
            (cHeader === "s.no" || cAccessor === "sno" || cId === "sno" || c.id === snoColumn.id);

          const rawFromRow = isSNoColumn ? index + 1 : getExportRawRowValue(r, c);
          const tableText = isSNoColumn ? rawFromRow : extractText(r.values?.[c.id]);
          const valueForFormatter =
            rawFromRow !== undefined && rawFromRow !== null && rawFromRow !== ""
              ? rawFromRow
              : tableText;

          const formatted =
            typeof exportCellFormatter === "function"
              ? exportCellFormatter({
                  value: valueForFormatter,
                  column: c,
                  headerLabel:
                    typeof c.Header === "string"
                      ? c.Header === "Actions"
                        ? "Action"
                        : c.Header
                      : String(c.id || ""),
                  row: r?.original || null,
                })
              : valueForFormatter;

          return coerceExportSheetCell(formatted, rawFromRow, c);
        });
      });

      const ws = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Export");

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = exportFileName ? `${exportFileName}-${ts}.xlsx` : `Export-${ts}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error("Export failed", e);
      alert("Export failed. Please try again.");
    }
  }, [
    allColumns,
    exportAllColumns,
    selectableColumns,
    hiddenColumns,
    rows,
    exportExcludeGroupParentsWhenExpanded,
    exportIncludeAllGroupChildren,
    prepareRow,
    exportCellFormatter,
    exportFileName,
    isExportActionColumn,
    getExportRawRowValue,
  ]);

  const isFilterableColumn = useCallback((column) => {
    if (!column || column.disableFilters) return false;
    const header = typeof column?.Header === "string" ? column.Header.trim().toLowerCase() : "";
    const accessor =
      typeof column?.accessor === "string" ? column.accessor.trim().toLowerCase() : "";
    if (
      header === "actions" ||
      header === "action" ||
      header === "sort" ||
      accessor === "actions" ||
      accessor === "action" ||
      accessor === "sortordercontrols"
    )
      return false;
    // Skip columns without an id (should be rare)
    if (!column.id) return false;
    return true;
  }, []);

  // Column drag & drop (native HTML drag events)
  const dragColumnIdRef = useRef(null);

  const moveColumn = useCallback(
    (fromId, toId) => {
      if (!fromId || !toId || fromId === toId) return;

      const currentOrder =
        Array.isArray(columnOrder) && columnOrder.length > 0
          ? columnOrder
          : (allColumns || []).map((c) => c.id);

      const fromIndex = currentOrder.indexOf(fromId);
      const toIndex = currentOrder.indexOf(toId);
      if (fromIndex === -1 || toIndex === -1) return;

      const next = [...currentOrder];
      next.splice(fromIndex, 1);
      next.splice(toIndex, 0, fromId);
      setColumnOrder(next);
    },
    [allColumns, columnOrder, setColumnOrder]
  );

  // Correct parent when API pageSize (e.g. 1 from probe) was bound to display pageSize
  useEffect(() => {
    if (!hasControlledPageSize || !onEntriesPerPageChange) return;
    const resolved = resolveDisplayPageSize(controlledPageSize);
    if (Number(controlledPageSize) !== resolved) {
      onEntriesPerPageChange(resolved);
    }
  }, [controlledPageSize, hasControlledPageSize, onEntriesPerPageChange, resolveDisplayPageSize]);

  // Sync table pagination when parent-controlled page index / page size changes
  useEffect(() => {
    if (pageIndex !== currentPageIndex) {
      gotoPage(currentPageIndex);
      if (!isControlled) {
        setInternalPageIndex(currentPageIndex);
      }
    }
    if (pageSize !== currentPageSize) {
      setPageSize(currentPageSize);
      if (!hasControlledPageSize) {
        setInternalPageSize(currentPageSize);
      }
    }
  }, [
    isControlled,
    hasControlledPageSize,
    currentPageIndex,
    currentPageSize,
    pageIndex,
    pageSize,
    gotoPage,
    setPageSize,
  ]);

  // Default page size on mount when page size is not parent-controlled
  useEffect(() => {
    if (!isControlled && !hasControlledPageSize && effectiveEntriesPerPage !== false) {
      setPageSize(defaultValue || 10);
    }
  }, [defaultValue, isControlled, hasControlledPageSize, effectiveEntriesPerPage, setPageSize]);

  // When entries-per-page UI is disabled, show all rows on one page.
  useEffect(() => {
    if (effectiveEntriesPerPage !== false || hasControlledPageSize) return;
    const targetSize = Math.max(rows.length, 1);
    if (currentPageSize !== targetSize) {
      setPageSize(targetSize);
      setInternalPageSize(targetSize);
    }
  }, [effectiveEntriesPerPage, hasControlledPageSize, rows.length, currentPageSize, setPageSize]);

  const dataLength = data?.length ?? 0;
  const prevDataLengthRef = useRef(dataLength);
  const prevPageSizeRef = useRef(currentPageSize);
  useEffect(() => {
    const dataChanged = prevDataLengthRef.current !== dataLength;
    const pageSizeChanged = prevPageSizeRef.current !== currentPageSize;
    prevDataLengthRef.current = dataLength;
    prevPageSizeRef.current = currentPageSize;
    if (!dataChanged && !pageSizeChanged) return;
    if (pageIndex === 0) return;
    gotoPage(0);
    if (!isControlled) {
      setInternalPageIndex(0);
    } else if (onPageChange) {
      onPageChange(0);
    }
  }, [dataLength, currentPageSize, pageIndex, gotoPage, isControlled, onPageChange]);

  // Override gotoPage to call onPageChange if controlled
  const handleGotoPage = useCallback(
    (nextPageIndex) => {
      gotoPage(nextPageIndex);
      if (isControlled && onPageChange) {
        onPageChange(nextPageIndex);
      } else {
        setInternalPageIndex(nextPageIndex);
      }
    },
    [isControlled, onPageChange, gotoPage]
  );

  // Override setPageSize to call onEntriesPerPageChange when pageSize is controlled
  const handleSetPageSize = useCallback(
    (size) => {
      const resolved = resolveDisplayPageSize(size);
      setPageSize(resolved);
      setInternalPageSize(resolved);
      gotoPage(0);
      setInternalPageIndex(0);
      if (isControlled && onPageChange) {
        onPageChange(0);
      }
      if (hasControlledPageSize && onEntriesPerPageChange) {
        onEntriesPerPageChange(resolved);
      }
    },
    [
      hasControlledPageSize,
      isControlled,
      onEntriesPerPageChange,
      onPageChange,
      resolveDisplayPageSize,
      setPageSize,
      gotoPage,
    ]
  );

  // Set the entries per page value based on the select value
  const setEntriesPerPage = (value) => handleSetPageSize(Number(value));

  const paginationTotalPages = pageSize > 0 ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;
  const showClientPagination = paginationTotalPages > 1;

  const clientPaginationNode = showClientPagination ? (
    <CompactGridPagination
      page={pageIndex + 1}
      totalPages={paginationTotalPages}
      onPageChange={(p) => handleGotoPage(p - 1)}
      variant={pagination.variant ? pagination.variant : "gradient"}
      color={pagination.color ? pagination.color : "info"}
    />
  ) : null;

  // Top-right above header: server paginationFooter and/or client-side pages.
  const paginationTopContent = paginationFooter ?? clientPaginationNode;
  const topPaginationNode = paginationHost ? null : paginationTopContent;
  const footerPaginationNode = paginationHost
    ? null
    : settingsUI
    ? null
    : paginationFooter ?? clientPaginationNode;
  const relocatedPaginationNode =
    paginationHost && paginationTopContent
      ? createPortal(paginationTopContent, paginationHost)
      : null;

  // Search input value state
  const [search, setSearch] = useState(globalFilter ?? "");

  // Search input state handle
  const onSearchChange = useAsyncDebounce((value) => {
    setGlobalFilter(value || undefined);
  }, 100);

  useEffect(() => {
    if (typeof onVisibleRowCountChange === "function") {
      onVisibleRowCountChange(rows.length);
    }
  }, [rows.length, onVisibleRowCountChange]);

  // A function that sets the sorted value for the table
  const setSortedValue = (column) => {
    let sortedValue;

    if (column.isSorted) {
      sortedValue = column.isSortedDesc ? "desc" : "asce";
    } else {
      sortedValue = "none";
    }

    return sortedValue;
  };

  // Setting the entries starting point
  const entriesStart = pageIndex === 0 ? pageIndex + 1 : pageIndex * pageSize + 1;

  // Setting the entries ending point
  let entriesEnd;

  if (pageIndex === 0) {
    entriesEnd = pageSize;
  } else if (pageIndex === pageOptions.length - 1) {
    entriesEnd = rows.length;
  } else {
    entriesEnd = pageSize * (pageIndex + 1);
  }

  const hideHorizontalScrollbarSx = {
    "&::-webkit-scrollbar:horizontal": {
      height: 0,
      display: "none",
    },
  };

  const settingsScrollSx = {
    scrollbarWidth: "thin",
    scrollbarColor: "rgba(0,0,0,0.18) transparent",
    ...hideHorizontalScrollbarSx,
    "&::-webkit-scrollbar": { width: "6px", height: "0px" },
    "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: "rgba(0,0,0,0.18)",
      borderRadius: "999px",
      "&:hover": { backgroundColor: "rgba(0,0,0,0.28)" },
    },
    "&::-webkit-scrollbar-button": { display: "none", width: 0, height: 0 },
  };

  const tableContainerSx = {
    boxShadow: "none",
    overflowX: settingsUI ? "hidden" : "scroll",
    overflowY: settingsUI ? "hidden" : "scroll",
    scrollbarWidth: "thin",
    scrollbarColor: settingsUI ? "rgba(0,0,0,0.18) transparent" : "#333333 transparent",
    "&::-webkit-scrollbar": {
      width: settingsUI ? "6px" : "8px",
      height: settingsUI ? "6px" : "8px",
    },
    "&::-webkit-scrollbar-track": {
      backgroundColor: "transparent",
    },
    "&::-webkit-scrollbar-thumb": {
      backgroundColor: settingsUI ? "rgba(0,0,0,0.18)" : "#333333",
      borderRadius: settingsUI ? "999px" : "10px",
      border: "none",
      "&:hover": {
        backgroundColor: settingsUI ? "rgba(0,0,0,0.28)" : "#1a1a1a",
      },
    },
    "&::-webkit-scrollbar-button": {
      display: "none",
      width: 0,
      height: 0,
    },
  };

  if (stickyToolbarAndHeader) {
    tableContainerSx.display = "flex";
    tableContainerSx.flexDirection = "column";
    if (autoHeight) {
      tableContainerSx.height = "auto";
      tableContainerSx.minHeight = 0;
      tableContainerSx.overflow = "visible";
      tableContainerSx.flexShrink = 0;
    } else {
      tableContainerSx.height = "100%";
      tableContainerSx.overflow = "hidden";
    }
  }

  const settingsTableSx = {
    tableLayout: contentFitTable ? "auto" : "fixed",
    minWidth: contentFitTable ? "max-content" : "100%",
    width: contentFitTable ? "max-content" : "100%",
    whiteSpace: settingsUI ? "normal" : "nowrap",
    "& th": {
      padding: settingsUI ? "6px 8px" : "4px 8px",
      fontSize: settingsUI ? "0.875rem !important" : "14px !important",
    },
    "& td": {
      padding: settingsUI ? "6px 8px" : "4px 8px",
      fontSize: settingsUI ? "0.8125rem" : "0.875rem",
    },
    "& thead": {
      position: "sticky",
      top: 0,
      zIndex: settingsUI ? 10 : 2,
      backgroundColor: settingsUI ? undefined : "#fff",
      boxShadow: settingsUI ? undefined : "0 1px 0 0 #d0d0d0",
    },
    "& thead th": {
      backgroundColor: settingsUI ? undefined : "#fff",
      whiteSpace: "nowrap !important",
      wordBreak: "normal !important",
      overflowWrap: "normal !important",
      overflow: "hidden",
      textOverflow: "ellipsis",
      verticalAlign: "middle",
    },
  };

  const toolbarIconSx = settingsUI
    ? {
        border: "none",
        borderRadius: "6px",
        ...(darkMode
          ? {
              "& .MuiSvgIcon-root": { color: "#ffffff !important" },
              "&:hover": { backgroundColor: "rgba(255, 255, 255, 0.1) !important" },
            }
          : {}),
      }
    : {
        border: "1px solid #d0d0d0",
        borderRadius: "6px",
        ...(darkMode
          ? {
              borderColor: "rgba(255, 255, 255, 0.3) !important",
              "& .MuiSvgIcon-root": { color: "#ffffff !important" },
              "&:hover": {
                borderColor: "rgba(255, 255, 255, 0.5) !important",
                backgroundColor: "rgba(255, 255, 255, 0.1) !important",
              },
            }
          : {}),
      };

  const searchFieldSx = darkMode
    ? {
        "& .MuiInputBase-input": {
          color: "#ffffff !important",
          "&::placeholder": { color: "#ffffff !important", opacity: 0.7 },
        },
        "& .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.3) !important",
        },
        "&:hover .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.5) !important",
        },
        "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
          borderColor: "rgba(255, 255, 255, 0.7) !important",
        },
      }
    : {};

  const hoistToolbarStartToHeader = settingsUI && toolbarStartInHeader && Boolean(toolbarStart);

  const gridToolbarNode = useMemo(() => {
    if (settingsUI) {
      if (!toolbarStart || hoistToolbarStartToHeader) return null;
      return (
        <MDBox
          className="saas-settings-table-toolbar saas-settings-filter-toolbar"
          display="flex"
          flexDirection="row"
          alignItems="center"
          gap={0.75}
          flexWrap="nowrap"
          sx={{
            minWidth: 0,
            height: 40,
            maxHeight: 40,
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          <MDBox
            className="saas-toolbar-start"
            sx={{
              minWidth: 0,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 0.75,
            }}
          >
            {toolbarStart}
          </MDBox>
        </MDBox>
      );
    }

    return (
      <MDBox
        className="saas-settings-table-toolbar"
        display="flex"
        flexDirection="row"
        alignItems="center"
        gap={1}
        flexWrap="nowrap"
        sx={{
          minWidth: 0,
          height: 32,
          maxHeight: 32,
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {toolbarStart ? (
          <MDBox
            className="saas-toolbar-start"
            sx={{
              minWidth: 0,
              flexShrink: 0,
              display: "flex",
              alignItems: "center",
              gap: 0.75,
            }}
          >
            {toolbarStart}
          </MDBox>
        ) : null}
        {effectiveEntriesPerPage ? (
          <MDBox display="flex" alignItems="center">
            <Autocomplete
              disableClearable
              value={pageSize.toString()}
              options={entries}
              onChange={(event, newValue) => {
                setEntriesPerPage(parseInt(newValue, 10));
              }}
              size="small"
              sx={{
                width: "5rem",
                ...(darkMode
                  ? {
                      "& .MuiInputBase-input": {
                        color: "#ffffff !important",
                      },
                      "& .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255, 255, 255, 0.3) !important",
                      },
                      "&:hover .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255, 255, 255, 0.5) !important",
                      },
                      "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                        borderColor: "rgba(255, 255, 255, 0.7) !important",
                      },
                      "& .MuiSvgIcon-root": {
                        color: "#ffffff !important",
                      },
                    }
                  : {}),
              }}
              renderInput={(params) => <MDInput {...params} />}
            />
            <MDTypography
              variant="caption"
              color="secondary"
              sx={darkMode ? { color: "#ffffff !important" } : {}}
            >
              &nbsp;&nbsp;entries per page
            </MDTypography>
          </MDBox>
        ) : null}
        <MDBox
          display="flex"
          alignItems="center"
          gap={0.75}
          flexWrap="nowrap"
          sx={{ minWidth: 0, marginLeft: "auto", flexShrink: 1, overflow: "hidden" }}
        >
          {canSearch ? (
            <MDBox width="12rem" sx={{ minWidth: 0 }}>
              <MDInput
                placeholder="Search..."
                value={search}
                size="small"
                fullWidth
                onChange={({ currentTarget }) => {
                  setSearch(currentTarget.value);
                  onSearchChange(currentTarget.value);
                }}
                sx={searchFieldSx}
              />
            </MDBox>
          ) : null}
          <Tooltip title="Columns">
            <IconButton
              size="small"
              onClick={(e) => {
                e.preventDefault();
                setColumnsAnchorEl(e.currentTarget);
              }}
              sx={toolbarIconSx}
            >
              <Icon fontSize="small" sx={darkMode ? { color: "#ffffff !important" } : {}}>
                view_column
              </Icon>
            </IconButton>
          </Tooltip>
          <Tooltip title="Export to Excel">
            <IconButton size="small" onClick={exportToExcel} sx={toolbarIconSx}>
              <Icon fontSize="small" sx={darkMode ? { color: "#ffffff !important" } : {}}>
                file_download
              </Icon>
            </IconButton>
          </Tooltip>
        </MDBox>
        {toolbarEnd ? (
          <MDBox
            className="saas-toolbar-end"
            sx={{ flexShrink: 0, display: "flex", alignItems: "center" }}
          >
            {toolbarEnd}
          </MDBox>
        ) : null}
      </MDBox>
    );
  }, [
    settingsUI,
    hoistToolbarStartToHeader,
    toolbarStart,
    effectiveEntriesPerPage,
    pageSize,
    entries,
    darkMode,
    canSearch,
    search,
    toolbarIconSx,
    exportToExcel,
    setEntriesPerPage,
    onSearchChange,
    searchFieldSx,
    toolbarEnd,
  ]);

  const settingsMetricsChips = useMemo(() => {
    if (!settingsUI) return null;
    if (totalEntriesText) {
      return [{ key: "records", label: "records", value: totalEntriesText }];
    }
    const total = rows.length;
    const showingEnd = total === 0 ? 0 : Math.min(entriesEnd, total);
    const chips = [{ key: "total", label: "records", value: total }];
    if (total > 0 && (pageOptions.length > 1 || showingEnd !== total)) {
      chips.push({ key: "showing", label: "showing", value: `${entriesStart}–${showingEnd}` });
    }
    if (pageOptions.length > 1) {
      chips.push({
        key: "page",
        label: "page",
        value: `${pageIndex + 1}/${pageOptions.length}`,
      });
    }
    return chips;
  }, [
    settingsUI,
    totalEntriesText,
    rows.length,
    entriesEnd,
    entriesStart,
    pageOptions.length,
    pageIndex,
  ]);

  useLayoutEffect(() => {
    if (!publishHeaderMetrics) return undefined;
    shellDispatch.setGridMetrics(settingsMetricsChips);
    return undefined;
  }, [publishHeaderMetrics, shellDispatch, settingsMetricsChips]);

  useLayoutEffect(() => {
    if (!settingsUI || !registerGridToolbar) return undefined;
    registerGridToolbar({
      canSearch,
      search,
      onSearchInput: (value) => {
        setSearch(value);
        onSearchChange(value);
      },
      openColumnsMenu: (anchorEl) => setColumnsAnchorEl(anchorEl),
      exportToExcel,
      showColumns: true,
      showExport: true,
      toolbarStart: hoistToolbarStartToHeader ? toolbarStart : null,
    });
    return () => registerGridToolbar(null);
  }, [
    settingsUI,
    registerGridToolbar,
    hoistToolbarStartToHeader,
    toolbarStart,
    canSearch,
    search,
    exportToExcel,
    onSearchChange,
    setSearch,
  ]);

  useEffect(() => {
    if (!settingsUI || !shellDispatch) return undefined;
    return () => shellDispatch.clearGridShell();
  }, [settingsUI, shellDispatch]);

  const showCompactFooter =
    Boolean(footerPaginationNode) || (!settingsUI && effectiveShowTotalEntries);

  const tableScrollRef = useRef(null);
  const [headerScrollState, setHeaderScrollState] = useState({
    active: false,
    left: false,
    right: false,
  });

  const updateHeaderScrollState = useCallback(() => {
    const el = tableScrollRef.current;
    const next = !el
      ? { active: false, left: false, right: false }
      : (() => {
          const { scrollLeft, scrollWidth, clientWidth } = el;
          const active = scrollWidth > clientWidth + 2;
          return {
            active,
            left: scrollLeft > 2,
            right: scrollLeft + clientWidth < scrollWidth - 2,
          };
        })();
    setHeaderScrollState((prev) =>
      prev.active === next.active && prev.left === next.left && prev.right === next.right
        ? prev
        : next
    );
  }, []);

  useLayoutEffect(() => {
    if (!stickyToolbarAndHeader) return undefined;
    updateHeaderScrollState();
    const el = tableScrollRef.current;
    if (!el) return undefined;

    const onScroll = () => updateHeaderScrollState();
    el.addEventListener("scroll", onScroll, { passive: true });
    let resizeObserver;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver(() => updateHeaderScrollState());
      resizeObserver.observe(el);
    }
    window.addEventListener("resize", updateHeaderScrollState);

    return () => {
      el.removeEventListener("scroll", onScroll);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updateHeaderScrollState);
    };
  }, [
    stickyToolbarAndHeader,
    updateHeaderScrollState,
    columns,
    data,
    page.length,
    pageIndex,
    hiddenColumns,
    state.columnOrder,
  ]);

  const scrollTableHorizontally = useCallback((direction) => {
    const el = tableScrollRef.current;
    if (!el) return;
    const step = Math.max(140, Math.round(el.clientWidth * 0.35));
    el.scrollBy({ left: direction * step, behavior: "smooth" });
  }, []);

  const headerScrollControls =
    stickyToolbarAndHeader && headerScrollState.active ? (
      <MDBox className="saas-settings-table-header-scroll" aria-hidden={false}>
        <Tooltip title="Scroll columns left">
          <span>
            <IconButton
              size="small"
              className="saas-settings-table-header-scroll-btn"
              disabled={!headerScrollState.left}
              aria-label="Scroll table header left"
              onClick={() => scrollTableHorizontally(-1)}
            >
              <Icon sx={{ fontSize: "1rem !important" }}>chevron_left</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Scroll columns right">
          <span>
            <IconButton
              size="small"
              className="saas-settings-table-header-scroll-btn"
              disabled={!headerScrollState.right}
              aria-label="Scroll table header right"
              onClick={() => scrollTableHorizontally(1)}
            >
              <Icon sx={{ fontSize: "1rem !important" }}>chevron_right</Icon>
            </IconButton>
          </span>
        </Tooltip>
      </MDBox>
    ) : null;

  return (
    <TableContainer
      className={`saas-settings-table${autoHeight ? " saas-settings-table--auto-height" : ""}`}
      sx={tableContainerSx}
    >
      {gridToolbarNode}

      {topPaginationNode ? (
        <MDBox
          className="saas-settings-table-pagination-top"
          display="flex"
          justifyContent="flex-end"
          alignItems="center"
          px={settingsUI ? 1 : 1.5}
          py={0.25}
          sx={{
            flexShrink: 0,
            minHeight: 28,
            maxHeight: 32,
            borderBottom: settingsUI ? "1px solid var(--layer-controls-border)" : "none",
            background: settingsUI ? "var(--layer-controls)" : "transparent",
          }}
        >
          {topPaginationNode}
        </MDBox>
      ) : null}

      <Menu
        anchorEl={columnsAnchorEl}
        open={columnsMenuOpen}
        onClose={() => {
          setColumnsAnchorEl(null);
          setColumnsSearch("");
        }}
        PaperProps={{
          sx: {
            width: 260,
            maxHeight: 360,
            ...(darkMode
              ? {
                  backgroundColor: "#202940 !important",
                  "& .MuiMenuItem-root": {
                    color: "#ffffff !important",
                  },
                  "& .MuiTypography-root": {
                    color: "#ffffff !important",
                  },
                  "& .MuiDivider-root": {
                    borderColor: "rgba(255, 255, 255, 0.12) !important",
                  },
                }
              : {}),
          },
        }}
        MenuListProps={{
          dense: true,
          onClick: (e) => e.stopPropagation(),
        }}
      >
        <MDBox px={1.5} py={1} onClick={(e) => e.stopPropagation()}>
          <MDInput
            placeholder="Search columns..."
            size="small"
            fullWidth
            value={columnsSearch}
            onChange={(e) => setColumnsSearch(e.target.value)}
            sx={
              darkMode
                ? {
                    "& .MuiInputBase-input": {
                      color: "#ffffff !important",
                      "&::placeholder": {
                        color: "#ffffff !important",
                        opacity: 0.7,
                      },
                    },
                    "& .MuiInputLabel-root": {
                      color: "#ffffff !important",
                    },
                    "& .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255, 255, 255, 0.3) !important",
                    },
                    "&:hover .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255, 255, 255, 0.5) !important",
                    },
                    "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
                      borderColor: "rgba(255, 255, 255, 0.7) !important",
                    },
                  }
                : {}
            }
          />
        </MDBox>
        <Divider />
        <MenuItem
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            showAllColumns();
          }}
        >
          <Checkbox
            size="small"
            checked={(hiddenColumns || []).length === 0}
            indeterminate={false}
          />
          <MDTypography
            variant="button"
            sx={{
              fontSize: "0.85rem",
              ...(darkMode ? { color: "#ffffff !important" } : {}),
            }}
          >
            (Show All)
          </MDTypography>
        </MenuItem>
        <Divider />
        {visibleSelectableColumns.slice(0, 200).map((c) => {
          const currentHidden = Array.isArray(hiddenColumns) ? hiddenColumns : [];
          const checked = !currentHidden.includes(c.id);
          const label =
            typeof c.Header === "string"
              ? c.Header === "Actions"
                ? "Action"
                : c.Header
              : String(c.id || "");
          return (
            <MenuItem
              key={c.id}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                toggleColumnVisibility(c.id);
              }}
            >
              <Checkbox size="small" checked={checked} />
              <MDTypography
                variant="button"
                sx={{
                  fontSize: "0.85rem",
                  ...(darkMode ? { color: "#ffffff !important" } : {}),
                }}
              >
                {label}
              </MDTypography>
            </MenuItem>
          );
        })}
      </Menu>
      {stickyToolbarAndHeader ? (
        <MDBox
          sx={{
            position: "relative",
            flex: autoHeight ? "0 0 auto" : "1 1 0",
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <MDBox
            ref={tableScrollRef}
            className="saas-settings-table-scroll"
            sx={
              autoHeight
                ? {
                    flex: "0 0 auto",
                    width: "100%",
                    minHeight: 0,
                    overflow: "visible",
                  }
                : {
                    flex: "1 1 0",
                    minHeight: stickyBodyMinHeight || "300px",
                    maxHeight: stickyBodyMaxHeight || "none",
                    overflowX: "auto",
                    overflowY: "auto",
                    scrollbarGutter: "stable",
                    ...(settingsUI
                      ? settingsScrollSx
                      : {
                          scrollbarWidth: "thin",
                          scrollbarColor: "#333333 transparent",
                          ...hideHorizontalScrollbarSx,
                          "&::-webkit-scrollbar": { width: "8px", height: "0px" },
                          "&::-webkit-scrollbar-track": { backgroundColor: "transparent" },
                          "&::-webkit-scrollbar-thumb": {
                            backgroundColor: "#333333",
                            borderRadius: "10px",
                            "&:hover": { backgroundColor: "#1a1a1a" },
                          },
                          "&::-webkit-scrollbar-button": { display: "none", width: 0, height: 0 },
                        }),
                  }
            }
          >
            <Table {...getTableProps()} sx={settingsTableSx}>
              <MDBox component="thead">
                {headerGroups.map((headerGroup, key) => (
                  <TableRow key={key} {...headerGroup.getHeaderGroupProps()}>
                    {headerGroup.headers.map((column, idx) => (
                      <DataTableHeadCell
                        key={idx}
                        {...column.getHeaderProps(column.getSortByToggleProps())}
                        width={column.width ? column.width : "auto"}
                        align={column.align ? column.align : "left"}
                        sorted={setSortedValue(column)}
                        filterNode={
                          isFilterableColumn(column) ? (
                            typeof column.Filter === "function" ? (
                              <column.Filter column={column} />
                            ) : (
                              <ColumnValueFilter column={column} />
                            )
                          ) : null
                        }
                        draggable
                        onDragStart={() => {
                          dragColumnIdRef.current = column.id;
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          moveColumn(dragColumnIdRef.current, column.id);
                          dragColumnIdRef.current = null;
                        }}
                      >
                        {typeof column.Header === "string" && column.Header === "Actions"
                          ? "Action"
                          : column.render("Header")}
                      </DataTableHeadCell>
                    ))}
                  </TableRow>
                ))}
              </MDBox>
              <TableBody {...getTableBodyProps()}>
                {page.map((rtBodyRow, key) => {
                  prepareRow(rtBodyRow);
                  const rowOriginal = rtBodyRow.original;
                  const customRowStyle = rowOriginal?.__rowStyle || {};
                  const customRowClassName = rowOriginal?.__rowClassName || "";
                  const { defaultBgColor, stripeSx, inheritRowBackground, rowHighlight } =
                    groupedRowBodyStyle(darkMode, key, rowOriginal);
                  const rowBgColor = customRowStyle.backgroundColor || defaultBgColor;

                  return (
                    <TableRow
                      key={key}
                      // eslint-disable-next-line react/prop-types
                      {...rtBodyRow.getRowProps()}
                      className={customRowClassName}
                      data-settings-row={
                        rowHighlight === "expanded"
                          ? "expanded"
                          : rowHighlight === "nestedExpanded"
                          ? "nested"
                          : rowHighlight === "rateSubgroup"
                          ? "subgroup"
                          : undefined
                      }
                      sx={{
                        backgroundColor:
                          settingsUI && !inheritRowBackground ? "transparent" : rowBgColor,
                        ...stripeSx,
                        ...customRowStyle,
                      }}
                    >
                      {/* eslint-disable-next-line react/prop-types */}
                      {rtBodyRow.cells.map((cell, idx) => {
                        const isEvenRow = key % 2 === 0;
                        const isDisabledRow = Boolean(rowOriginal?.__disabledRow);
                        return (
                          <DataTableBodyCell
                            {...cell.getCellProps()}
                            key={idx}
                            noBorder={noEndBorder && rows.length - 1 === key}
                            align={cell.column.align ? cell.column.align : "left"}
                            isEvenRow={isEvenRow}
                            disabledRow={isDisabledRow}
                            tintBackground={inheritRowBackground ? rowBgColor : ""}
                            rowHighlight={rowHighlight ?? undefined}
                          >
                            {cell.render("Cell")}
                          </DataTableBodyCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </MDBox>
          {headerScrollControls}
        </MDBox>
      ) : (
        <Table {...getTableProps()} sx={settingsTableSx}>
          <MDBox component="thead">
            {headerGroups.map((headerGroup, key) => (
              <TableRow key={key} {...headerGroup.getHeaderGroupProps()}>
                {headerGroup.headers.map((column, idx) => (
                  <DataTableHeadCell
                    key={idx}
                    {...column.getHeaderProps(column.getSortByToggleProps())}
                    width={column.width ? column.width : "auto"}
                    align={column.align ? column.align : "left"}
                    sorted={setSortedValue(column)}
                    filterNode={
                      isFilterableColumn(column) ? (
                        typeof column.Filter === "function" ? (
                          <column.Filter column={column} />
                        ) : (
                          <ColumnValueFilter column={column} />
                        )
                      ) : null
                    }
                    draggable
                    onDragStart={() => {
                      dragColumnIdRef.current = column.id;
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      moveColumn(dragColumnIdRef.current, column.id);
                      dragColumnIdRef.current = null;
                    }}
                  >
                    {typeof column.Header === "string" && column.Header === "Actions"
                      ? "Action"
                      : column.render("Header")}
                  </DataTableHeadCell>
                ))}
              </TableRow>
            ))}
          </MDBox>
          <TableBody {...getTableBodyProps()}>
            {page.map((rtBodyRow, key) => {
              prepareRow(rtBodyRow);
              const rowOriginal = rtBodyRow.original;
              const customRowStyle = rowOriginal?.__rowStyle || {};
              const customRowClassName = rowOriginal?.__rowClassName || "";
              const { defaultBgColor, stripeSx, inheritRowBackground, rowHighlight } =
                groupedRowBodyStyle(darkMode, key, rowOriginal);
              const rowBgColor = customRowStyle.backgroundColor || defaultBgColor;
              return (
                <TableRow
                  key={key}
                  // eslint-disable-next-line react/prop-types
                  {...rtBodyRow.getRowProps()}
                  className={customRowClassName}
                  data-settings-row={
                    rowHighlight === "expanded"
                      ? "expanded"
                      : rowHighlight === "nestedExpanded"
                      ? "nested"
                      : rowHighlight === "rateSubgroup"
                      ? "subgroup"
                      : undefined
                  }
                  sx={{
                    backgroundColor:
                      settingsUI && !inheritRowBackground ? "transparent" : rowBgColor,
                    ...stripeSx,
                    ...customRowStyle,
                  }}
                >
                  {/* eslint-disable-next-line react/prop-types */}
                  {rtBodyRow.cells.map((cell, idx) => {
                    const isEvenRow = key % 2 === 0;
                    const isDisabledRow = Boolean(rowOriginal?.__disabledRow);
                    return (
                      <DataTableBodyCell
                        {...cell.getCellProps()}
                        key={idx}
                        noBorder={noEndBorder && rows.length - 1 === key}
                        align={cell.column.align ? cell.column.align : "left"}
                        isEvenRow={isEvenRow}
                        disabledRow={isDisabledRow}
                        tintBackground={inheritRowBackground ? rowBgColor : ""}
                        rowHighlight={rowHighlight ?? undefined}
                      >
                        {cell.render("Cell")}
                      </DataTableBodyCell>
                    );
                  })}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}

      {showCompactFooter ? (
        <MDBox
          className="saas-settings-table-footer"
          display="flex"
          flexDirection="row"
          justifyContent="flex-end"
          alignItems="center"
          py={settingsUI ? 0.5 : 1}
          px={settingsUI ? 1.5 : 2}
          gap={1}
          sx={{ flexShrink: 0 }}
        >
          {footerPaginationNode}
          {!settingsUI && effectiveShowTotalEntries && (
            <MDTypography variant="button" color="secondary" fontWeight="regular">
              {totalEntriesText ??
                (rows.length === 0
                  ? "0 of 0 entries"
                  : `${Math.min(entriesEnd, rows.length)} of ${rows.length} entries`)}
            </MDTypography>
          )}
        </MDBox>
      ) : null}
      {relocatedPaginationNode}
    </TableContainer>
  );
}

// Setting default values for the props of DataTable
DataTable.defaultProps = {
  entriesPerPage: { defaultValue: 20, entries: [5, 10, 15, 20, 25] },
  canSearch: false,
  showTotalEntries: true,
  pagination: { variant: "gradient", color: "info" },
  isSorted: true,
  noEndBorder: false,
  stickyToolbarAndHeader: false,
  stickyBodyMinHeight: undefined,
  stickyBodyMaxHeight: undefined,
  autoHeight: false,
  contentFitTable: false,
  onVisibleRowCountChange: undefined,
  autoResetFilters: true,
  toolbarStart: null,
  toolbarStartInHeader: false,
  toolbarEnd: null,
  extraFilterTypes: null,
  totalEntriesText: undefined,
  paginationFooter: null,
  paginationHost: null,
  disableHeaderMetrics: false,
  exportExcludeGroupParentsWhenExpanded: false,
  exportIncludeAllGroupChildren: false,
};

// Typechecking props for the DataTable
DataTable.propTypes = {
  entriesPerPage: PropTypes.oneOfType([
    PropTypes.shape({
      defaultValue: PropTypes.number,
      entries: PropTypes.arrayOf(PropTypes.number),
    }),
    PropTypes.bool,
  ]),
  canSearch: PropTypes.bool,
  showTotalEntries: PropTypes.bool,
  totalEntriesText: PropTypes.string,
  paginationFooter: PropTypes.node,
  paginationHost: PropTypes.object,
  disableHeaderMetrics: PropTypes.bool,
  table: PropTypes.objectOf(PropTypes.array).isRequired,
  pagination: PropTypes.shape({
    variant: PropTypes.oneOf(["contained", "gradient"]),
    color: PropTypes.oneOf([
      "primary",
      "secondary",
      "info",
      "success",
      "warning",
      "error",
      "dark",
      "light",
    ]),
  }),
  isSorted: PropTypes.bool,
  noEndBorder: PropTypes.bool,
  page: PropTypes.number,
  pageSize: PropTypes.number,
  onPageChange: PropTypes.func,
  onEntriesPerPageChange: PropTypes.func,
  exportFileName: PropTypes.string,
  exportCellFormatter: PropTypes.func,
  exportExcludeGroupParentsWhenExpanded: PropTypes.bool,
  exportIncludeAllGroupChildren: PropTypes.bool,
  exportAllColumns: PropTypes.bool,
  initialHiddenColumns: PropTypes.arrayOf(PropTypes.string),
  stickyToolbarAndHeader: PropTypes.bool,
  stickyBodyMinHeight: PropTypes.string,
  stickyBodyMaxHeight: PropTypes.string,
  autoHeight: PropTypes.bool,
  contentFitTable: PropTypes.bool,
  onVisibleRowCountChange: PropTypes.func,
  autoResetFilters: PropTypes.bool,
  toolbarStart: PropTypes.node,
  toolbarStartInHeader: PropTypes.bool,
  toolbarEnd: PropTypes.node,
  extraFilterTypes: PropTypes.object,
};

export default DataTable;
