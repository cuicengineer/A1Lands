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

import { useMemo, useEffect, useState, useCallback, isValidElement, useRef } from "react";

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
import MDPagination from "components/MDPagination";

// Material Dashboard 2 React contexts
import { useMaterialUIController } from "context";

// Material Dashboard 2 React example components
import DataTableHeadCell from "examples/Tables/DataTable/DataTableHeadCell";
import DataTableBodyCell from "examples/Tables/DataTable/DataTableBodyCell";

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

const BLANK_VALUE_TOKEN = "__BLANK__";
const STATUS_ACTIVE_KEY = 1;
const STATUS_INACTIVE_KEY = 0;

function isStatusColumn(column) {
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
            // Reduce filter icon size (~50%) for all grid columns
            fontSize: "12px",
            padding: "1px",
            color: hasActiveFilter ? "#1A73E8" : darkMode ? "#ffffff" : "#111111",
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
  exportAllColumns,
  initialHiddenColumns,
}) {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  // Ref to store pagination info for S.No column calculation
  const pageInfoRef = useRef({ pageIndex: 0, pageSize: 20 });
  const defaultValue = entriesPerPage.defaultValue ? entriesPerPage.defaultValue : 20;
  const entries = entriesPerPage.entries
    ? entriesPerPage.entries.map((el) => el.toString())
    : ["5", "10", "15", "20", "25"];
  const isOperatorUser = () => {
    try {
      const raw = localStorage.getItem("auth");
      if (!raw) return false;
      const obj = JSON.parse(raw);
      const role = String(
        obj?.role ||
          obj?.Role ||
          obj?.roleName ||
          obj?.RoleName ||
          obj?.category ||
          obj?.Category ||
          obj?.userRole ||
          obj?.UserRole ||
          ""
      )
        .trim()
        .toLowerCase();
      return role === "operator";
    } catch (e) {
      return false;
    }
  };

  const baseColumns = useMemo(() => table.columns, [table]);

  // Function to check if a column is Actions column
  const isActionsColumn = useCallback((column) => {
    const header = typeof column?.Header === "string" ? column.Header.trim().toLowerCase() : "";
    const accessor =
      typeof column?.accessor === "string" ? column.accessor.trim().toLowerCase() : "";
    return (
      header === "actions" || header === "action" || accessor === "actions" || accessor === "action"
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

  const columns = useMemo(() => {
    if (!isOperatorUser()) return columnsWithSNo;
    // Hide Action(s) column entirely for Operator users
    return (columnsWithSNo || []).filter((c) => !isActionsColumn(c));
  }, [columnsWithSNo, isActionsColumn, isOperatorUser]);
  const data = useMemo(() => table.rows, [table]);

  // Function to detect if a column is an "Id" column
  const isIdColumn = useCallback((column) => {
    const header = typeof column?.Header === "string" ? column.Header.trim().toLowerCase() : "";
    const accessor =
      typeof column?.accessor === "string" ? column.accessor.trim().toLowerCase() : "";
    const id = typeof column?.id === "string" ? column.id.trim().toLowerCase() : "";
    // Match "id", "Id", "ID" exactly (case-insensitive after conversion)
    return header === "id" || accessor === "id" || id === "id";
  }, []);

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
      includesOneOf: (rowsToFilter, id, filterValue) => {
        if (!Array.isArray(filterValue) || filterValue.length === 0) return rowsToFilter;
        const allowed = new Set(filterValue);
        const colId = Array.isArray(id) ? id[0] : id;
        return rowsToFilter.filter((row) => {
          // eslint-disable-next-line react/prop-types
          const token = normalizeValueToken(row.values?.[colId], { id: colId });
          return allowed.has(token);
        });
      },
    }),
    []
  );

  const defaultColumn = useMemo(
    () => ({
      filter: "includesOneOf",
    }),
    []
  );

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledPageIndex !== undefined;
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const [internalPageSize, setInternalPageSize] = useState(defaultValue || 20);

  const currentPageIndex = isControlled ? controlledPageIndex : internalPageIndex;
  const currentPageSize =
    isControlled && onEntriesPerPageChange
      ? controlledPageSize !== undefined && controlledPageSize !== null
        ? controlledPageSize
        : entriesPerPage.defaultValue || defaultValue || 20
      : internalPageSize;

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
      state: isControlled
        ? {
            pageIndex: currentPageIndex,
            pageSize: currentPageSize,
          }
        : undefined,
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

  const exportToExcel = async () => {
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
      if (exportExcludeGroupParentsWhenExpanded) {
        const hasExpandedRows = exportRows.some((r) => Boolean(r?.original?.isExpandedRow));
        if (hasExpandedRows) {
          exportRows = exportRows.filter((r) => !Boolean(r?.original?.isGroupRow));
        }
      }

      const dataForSheet = exportRows.map((r, index) => {
        // Ensure row values are computed
        try {
          prepareRow(r);
        } catch (e) {
          // ignore
        }

        const obj = {};
        finalColsToExport.forEach((c) => {
          const headerLabel =
            typeof c.Header === "string"
              ? c.Header === "Actions"
                ? "Action"
                : c.Header
              : String(c.id || "");

          // Calculate S.No value for export
          let rawValue;
          const cHeader = typeof c?.Header === "string" ? c.Header.trim().toLowerCase() : "";
          const cAccessor = typeof c?.accessor === "string" ? c.accessor.trim().toLowerCase() : "";
          const cId = typeof c?.id === "string" ? c.id.trim().toLowerCase() : "";
          const isSNoColumn =
            snoColumn &&
            (cHeader === "s.no" || cAccessor === "sno" || cId === "sno" || c.id === snoColumn.id);

          if (isSNoColumn) {
            // Calculate serial number: index + 1 (since we're exporting all rows, not paginated)
            rawValue = index + 1;
          } else {
            rawValue = extractText(r.values?.[c.id]);
          }

          obj[headerLabel] =
            typeof exportCellFormatter === "function"
              ? exportCellFormatter({
                  value: rawValue,
                  column: c,
                  headerLabel,
                  row: r?.original || null,
                })
              : rawValue;
        });
        return obj;
      });

      const ws = XLSX.utils.json_to_sheet(dataForSheet);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Export");

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const fileName = exportFileName ? `${exportFileName}-${ts}.xlsx` : `Export-${ts}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (e) {
      console.error("Export failed", e);
      alert("Export failed. Please try again.");
    }
  };

  const isFilterableColumn = useCallback((column) => {
    if (!column || column.disableFilters) return false;
    const header = typeof column?.Header === "string" ? column.Header.trim().toLowerCase() : "";
    const accessor =
      typeof column?.accessor === "string" ? column.accessor.trim().toLowerCase() : "";
    if (
      header === "actions" ||
      header === "action" ||
      accessor === "actions" ||
      accessor === "action"
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

  // Sync controlled state with table instance when it changes externally
  useEffect(() => {
    if (isControlled) {
      if (pageIndex !== currentPageIndex) {
        gotoPage(currentPageIndex);
      }
      if (pageSize !== currentPageSize && onEntriesPerPageChange) {
        setPageSize(currentPageSize);
      }
    }
  }, [
    isControlled,
    currentPageIndex,
    currentPageSize,
    pageIndex,
    pageSize,
    gotoPage,
    setPageSize,
    onEntriesPerPageChange,
  ]);

  // Set default page size on mount if not controlled
  useEffect(() => {
    if (!isControlled) {
      setPageSize(defaultValue || 10);
    }
  }, [defaultValue, isControlled, setPageSize]);

  // Override gotoPage to call onPageChange if controlled
  const handleGotoPage = useCallback(
    (page) => {
      if (isControlled && onPageChange) {
        onPageChange(page);
      } else {
        gotoPage(page);
        setInternalPageIndex(page);
      }
    },
    [isControlled, onPageChange, gotoPage]
  );

  // Override setPageSize to call onEntriesPerPageChange if controlled
  const handleSetPageSize = useCallback(
    (size) => {
      const numSize = Number(size);
      if (isControlled && onEntriesPerPageChange) {
        onEntriesPerPageChange(numSize);
      } else {
        setPageSize(numSize);
        setInternalPageSize(numSize);
      }
    },
    [isControlled, onEntriesPerPageChange, setPageSize]
  );

  // Set the entries per page value based on the select value
  const setEntriesPerPage = (value) => handleSetPageSize(Number(value));

  // Render the paginations
  const renderPagination = pageOptions.map((option) => (
    <MDPagination
      item
      key={option}
      onClick={() => handleGotoPage(Number(option))}
      active={pageIndex === option}
    >
      {option + 1}
    </MDPagination>
  ));

  // Handler for the input to set the pagination index
  const handleInputPagination = ({ target: { value } }) =>
    value > pageOptions.length || value < 0 ? handleGotoPage(0) : handleGotoPage(Number(value));

  // Customized page options starting from 1
  const customizedPageOptions = pageOptions.map((option) => option + 1);

  // Setting value for the pagination input
  const handleInputPaginationValue = ({ target: value }) => handleGotoPage(Number(value.value - 1));

  // Search input value state
  const [search, setSearch] = useState(globalFilter ?? "");

  // Search input state handle
  const onSearchChange = useAsyncDebounce((value) => {
    setGlobalFilter(value || undefined);
  }, 100);

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

  return (
    <TableContainer
      sx={{
        boxShadow: "none",
        overflowX: "auto",
        overflowY: "auto",
        // Firefox - transparent track
        scrollbarWidth: "thin",
        scrollbarColor: "#333333 transparent",
        // Chrome/Safari/Edge - transparent track, visible thumb only
        "&::-webkit-scrollbar": {
          width: "8px",
          height: "8px",
        },
        "&::-webkit-scrollbar-track": {
          backgroundColor: "transparent",
        },
        "&::-webkit-scrollbar-thumb": {
          backgroundColor: "#333333",
          borderRadius: "10px",
          border: "none",
          "&:hover": {
            backgroundColor: "#1a1a1a",
          },
        },
        "&::-webkit-scrollbar-button": {
          display: "none",
          width: 0,
          height: 0,
        },
      }}
    >
      {/* Top toolbar should always be visible so Columns + Export are available on every grid */}
      {true ? (
        <MDBox display="flex" justifyContent="space-between" alignItems="center" p={3} gap={2}>
          {entriesPerPage && (
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
          )}
          <MDBox display="flex" alignItems="center" gap={1} ml="auto">
            {/* Search bar is always visible so toolbar tools can sit beside it on every grid */}
            <MDBox width="12rem">
              <MDInput
                placeholder="Search..."
                value={search}
                size="small"
                fullWidth
                onChange={({ currentTarget }) => {
                  setSearch(currentTarget.value);
                  onSearchChange(currentTarget.value);
                }}
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

            {/* Tools beside Search (right side) */}
            <Tooltip title="Columns">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.preventDefault();
                  setColumnsAnchorEl(e.currentTarget);
                }}
                sx={{
                  border: "1px solid #d0d0d0",
                  borderRadius: "6px",
                  ...(darkMode
                    ? {
                        borderColor: "rgba(255, 255, 255, 0.3) !important",
                        "& .MuiSvgIcon-root": {
                          color: "#ffffff !important",
                        },
                        "&:hover": {
                          borderColor: "rgba(255, 255, 255, 0.5) !important",
                          backgroundColor: "rgba(255, 255, 255, 0.1) !important",
                        },
                      }
                    : {}),
                }}
              >
                <Icon fontSize="small" sx={darkMode ? { color: "#ffffff !important" } : {}}>
                  view_column
                </Icon>
              </IconButton>
            </Tooltip>
            <Tooltip title="Export to Excel">
              <IconButton
                size="small"
                onClick={exportToExcel}
                sx={{
                  border: "1px solid #d0d0d0",
                  borderRadius: "6px",
                  ...(darkMode
                    ? {
                        borderColor: "rgba(255, 255, 255, 0.3) !important",
                        "& .MuiSvgIcon-root": {
                          color: "#ffffff !important",
                        },
                        "&:hover": {
                          borderColor: "rgba(255, 255, 255, 0.5) !important",
                          backgroundColor: "rgba(255, 255, 255, 0.1) !important",
                        },
                      }
                    : {}),
                }}
              >
                <Icon fontSize="small" sx={darkMode ? { color: "#ffffff !important" } : {}}>
                  file_download
                </Icon>
              </IconButton>
            </Tooltip>
          </MDBox>
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
      <Table
        {...getTableProps()}
        sx={{
          tableLayout: "fixed",
          whiteSpace: "nowrap",
          "& th": { padding: "4px 8px", fontSize: "14px !important" },
          "& td": { padding: "4px 8px", fontSize: "0.875rem" },
        }}
      >
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
                    isFilterableColumn(column) ? <ColumnValueFilter column={column} /> : null
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
          {page.map((row, key) => {
            prepareRow(row);
            // Check for custom row styling
            // eslint-disable-next-line react/prop-types
            const customRowStyle = row?.original?.__rowStyle || {};
            // eslint-disable-next-line react/prop-types
            const customRowClassName = row?.original?.__rowClassName || "";
            const defaultBgColor = key % 2 === 0 ? "#f0f0f0" : "#ffffff";
            const rowBgColor = customRowStyle.backgroundColor || defaultBgColor;

            return (
              <TableRow
                key={key}
                // eslint-disable-next-line react/prop-types
                {...row.getRowProps()}
                className={customRowClassName}
                sx={{
                  backgroundColor: rowBgColor,
                  ...customRowStyle,
                }}
              >
                {/* eslint-disable-next-line react/prop-types */}
                {row.cells.map((cell, idx) => {
                  const isEvenRow = key % 2 === 0;
                  // eslint-disable-next-line react/prop-types
                  const isDisabledRow = Boolean(row?.original?.__disabledRow);
                  return (
                    <DataTableBodyCell
                      key={idx}
                      noBorder={noEndBorder && rows.length - 1 === key}
                      align={cell.column.align ? cell.column.align : "left"}
                      disabledRow={isDisabledRow}
                      {...cell.getCellProps()}
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

      <MDBox
        display="flex"
        flexDirection={{ xs: "column", sm: "row" }}
        justifyContent="flex-start"
        alignItems={{ xs: "flex-start", sm: "center" }}
        p={!showTotalEntries && pageOptions.length === 1 ? 0 : 3}
        gap={2}
      >
        {showTotalEntries && (
          <MDBox mb={{ xs: 3, sm: 0 }} display="flex" alignItems="center" gap={2}>
            <MDTypography variant="button" color="secondary" fontWeight="regular">
              {rows.length === 0
                ? "0 of 0 entries"
                : `${Math.min(entriesEnd, rows.length)} of ${rows.length} entries`}
            </MDTypography>
            {pageOptions.length > 1 && (
              <MDPagination
                variant={pagination.variant ? pagination.variant : "gradient"}
                color={pagination.color ? pagination.color : "info"}
              >
                {canPreviousPage && (
                  <MDPagination item onClick={() => handleGotoPage(pageIndex - 1)}>
                    <Icon sx={{ fontWeight: "bold" }}>chevron_left</Icon>
                  </MDPagination>
                )}
                {renderPagination.length > 6 ? (
                  <MDBox width="5rem" mx={1}>
                    <MDInput
                      inputProps={{ type: "number", min: 1, max: customizedPageOptions.length }}
                      value={customizedPageOptions[pageIndex]}
                      onChange={(handleInputPagination, handleInputPaginationValue)}
                    />
                  </MDBox>
                ) : (
                  renderPagination
                )}
                {canNextPage && (
                  <MDPagination item onClick={() => handleGotoPage(pageIndex + 1)}>
                    <Icon sx={{ fontWeight: "bold" }}>chevron_right</Icon>
                  </MDPagination>
                )}
              </MDPagination>
            )}
          </MDBox>
        )}
      </MDBox>
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
  exportAllColumns: PropTypes.bool,
  initialHiddenColumns: PropTypes.arrayOf(PropTypes.string),
};

export default DataTable;
