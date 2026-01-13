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
} from "react-table";

// @mui material components
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import Icon from "@mui/material/Icon";
import Autocomplete from "@mui/material/Autocomplete";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDPagination from "components/MDPagination";

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

function DataTable({
  entriesPerPage,
  canSearch,
  showTotalEntries,
  table,
  pagination,
  isSorted,
  noEndBorder,
  page: controlledPageIndex,
  onPageChange,
  onEntriesPerPageChange,
}) {
  const defaultValue = entriesPerPage.defaultValue ? entriesPerPage.defaultValue : 10;
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
  const columns = useMemo(() => {
    if (!isOperatorUser()) return baseColumns;
    // Hide Action(s) column entirely for Operator users
    return (baseColumns || []).filter((c) => {
      const header = typeof c?.Header === "string" ? c.Header.trim().toLowerCase() : "";
      const accessor = typeof c?.accessor === "string" ? c.accessor.trim().toLowerCase() : "";
      return (
        header !== "actions" &&
        header !== "action" &&
        accessor !== "actions" &&
        accessor !== "action"
      );
    });
  }, [baseColumns]);
  const data = useMemo(() => table.rows, [table]);

  // Use controlled state if provided, otherwise use internal state
  const isControlled = controlledPageIndex !== undefined;
  const [internalPageIndex, setInternalPageIndex] = useState(0);
  const [internalPageSize, setInternalPageSize] = useState(defaultValue || 10);

  const currentPageIndex = isControlled ? controlledPageIndex : internalPageIndex;
  const currentPageSize =
    isControlled && onEntriesPerPageChange
      ? entriesPerPage.defaultValue || defaultValue || 10
      : internalPageSize;

  const tableInstance = useTable(
    {
      columns,
      data,
      initialState: { pageIndex: currentPageIndex, pageSize: currentPageSize },
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
          columnIds.some((id) => extractText(row.values?.[id]).toLowerCase().includes(searchValue))
        );
      },
    },
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
    state: { pageIndex, pageSize, globalFilter, columnOrder },
  } = tableInstance;

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
        scrollbarWidth: "auto",
        "&::-webkit-scrollbar": { height: "12px" },
        "&::-webkit-scrollbar-track": { backgroundColor: "#e0e0e0", borderRadius: "6px" },
        "&::-webkit-scrollbar-thumb": { backgroundColor: "#9e9e9e", borderRadius: "6px" },
      }}
    >
      {entriesPerPage || canSearch ? (
        <MDBox display="flex" justifyContent="space-between" alignItems="center" p={3}>
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
                sx={{ width: "5rem" }}
                renderInput={(params) => <MDInput {...params} />}
              />
              <MDTypography variant="caption" color="secondary">
                &nbsp;&nbsp;entries per page
              </MDTypography>
            </MDBox>
          )}
          {canSearch && (
            <MDBox width="12rem" ml="auto">
              <MDInput
                placeholder="Search..."
                value={search}
                size="small"
                fullWidth
                onChange={({ currentTarget }) => {
                  setSearch(currentTarget.value);
                  onSearchChange(currentTarget.value);
                }}
              />
            </MDBox>
          )}
        </MDBox>
      ) : null}
      <Table
        {...getTableProps()}
        sx={{
          tableLayout: "fixed",
          whiteSpace: "nowrap",
          "& th": { padding: "4px 8px", fontSize: "0.875rem" },
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
            return (
              <TableRow
                key={key}
                {...row.getRowProps()}
                sx={{ backgroundColor: key % 2 === 0 ? "#f0f0f0" : "#ffffff" }}
              >
                {row.cells.map((cell, idx) => {
                  const isEvenRow = key % 2 === 0;
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
        justifyContent="space-between"
        alignItems={{ xs: "flex-start", sm: "center" }}
        p={!showTotalEntries && pageOptions.length === 1 ? 0 : 3}
      >
        {showTotalEntries && (
          <MDBox mb={{ xs: 3, sm: 0 }}>
            <MDTypography variant="button" color="secondary" fontWeight="regular">
              Showing {entriesStart} to {entriesEnd} of {rows.length} entries
            </MDTypography>
          </MDBox>
        )}
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
    </TableContainer>
  );
}

// Setting default values for the props of DataTable
DataTable.defaultProps = {
  entriesPerPage: { defaultValue: 10, entries: [5, 10, 15, 20, 25] },
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
  onPageChange: PropTypes.func,
  onEntriesPerPageChange: PropTypes.func,
};

export default DataTable;
