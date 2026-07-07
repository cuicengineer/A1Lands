import { useMemo } from "react";
import PropTypes from "prop-types";
import Checkbox from "@mui/material/Checkbox";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { COLLECTION_STATUS_OPTIONS } from "./collectionReceiptUtils";
import CollectionEntryGridRow from "./CollectionEntryGridRow";
import {
  COLLECTIONS_COLUMNS,
  GRID_TEMPLATE,
  buildCollectionsGridTemplate,
  COLLECTION_GRID_CELL_TEXT_COLOR,
  inputSx,
  isCollectionGridColumnVisible,
  mergeBodyCellSx,
} from "./collectionGridShared";

function CollectionsGrid({
  rows,
  totalRowCount,
  rowIndexOffset,
  gridTemplate,
  hiddenColumnKeys,
  statusFilter,
  onStatusFilterChange,
  classOptions,
  contracts,
  invoices,
  tenants,
  customers,
  suppliers,
  coaOptions,
  receipts,
  canCreate,
  canEditRow,
  canDeleteRow,
  canEditStatus,
  activeLockDate,
  saving,
  onRowChange,
  onSaveRow,
  onEditRow,
  onCancelEditRow,
  onDeleteRow,
  onDuplicateRow,
  onAddRow,
  onAttachmentSelect,
  onClearPendingAttachment,
  onDownloadAttachment,
  onViewTenant,
  onViewInvoice,
  selectedRowIds,
  allRowsSelected,
  someRowsSelected,
  onToggleRowSelection,
  onToggleAllRowSelection,
  getRowKey,
}) {
  const resolvedGridTemplate = useMemo(
    () => gridTemplate || buildCollectionsGridTemplate(hiddenColumnKeys) || GRID_TEMPLATE,
    [gridTemplate, hiddenColumnKeys]
  );

  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: resolvedGridTemplate,
    width: "100%",
    alignItems: "center",
    columnGap: 0,
    minWidth: "1720px",
  };

  const hiddenColumns = useMemo(() => new Set(hiddenColumnKeys || []), [hiddenColumnKeys]);

  const cellBaseSx = {
    fontSize: "0.75rem",
    lineHeight: 1.25,
    py: 0.65,
    px: 0.75,
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const headerCellSx = (align = "left") => ({
    ...mergeBodyCellSx(cellBaseSx, { align }),
    fontWeight: 700,
    fontSize: "0.6875rem",
    bgcolor: "#c8e6c9",
    color: "#1b5e20",
    borderBottom: "1px solid rgba(0,0,0,0.12)",
    borderRight: "1px solid rgba(0,0,0,0.06)",
    whiteSpace: "nowrap",
  });

  const bodyCellSx = {
    ...cellBaseSx,
    color: COLLECTION_GRID_CELL_TEXT_COLOR,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    borderRight: "1px solid rgba(0,0,0,0.04)",
    "& .MuiTypography-root": {
      color: `${COLLECTION_GRID_CELL_TEXT_COLOR} !important`,
    },
    "& .MuiInputBase-input, & .MuiSelect-select": {
      color: `${COLLECTION_GRID_CELL_TEXT_COLOR} !important`,
    },
  };

  const displayRows = useMemo(() => rows || [], [rows]);

  return (
    <MDBox sx={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        mb={1}
        sx={{ flexShrink: 0, flexWrap: "wrap" }}
      >
        <MDTypography variant="button" fontWeight="bold">
          Collection entries
          {selectedRowIds?.size > 0 ? ` (${selectedRowIds.size} selected)` : ""}
        </MDTypography>
        <MDBox display="flex" alignItems="center" gap={1}>
          <MDBox sx={{ minWidth: 140 }}>
            <MDInput
              select
              value={statusFilter || "Pending"}
              onChange={(e) => onStatusFilterChange?.(e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            >
              {COLLECTION_STATUS_OPTIONS.map((option) => (
                <MenuItem key={option} value={option}>
                  {option === "All" ? "All records" : option}
                </MenuItem>
              ))}
            </MDInput>
          </MDBox>
          {canCreate ? (
            <Tooltip title="Add collection row">
              <span>
                <IconButton
                  color="info"
                  size="small"
                  disabled={saving}
                  onClick={onAddRow}
                  sx={{ border: "1px solid", borderColor: "info.main", borderRadius: 1, p: 0.35 }}
                >
                  <Icon fontSize="small">add</Icon>
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
        </MDBox>
      </MDBox>

      <MDBox sx={{ flex: "1 1 0", minHeight: 0, overflow: "auto", border: "1px solid #e0e0e0" }}>
        <MDBox sx={gridRowSx}>
          {COLLECTIONS_COLUMNS.map((col) => {
            const hidden = !isCollectionGridColumnVisible(col.key, hiddenColumnKeys);
            return (
              <MDBox
                key={col.key}
                sx={{
                  ...headerCellSx(col.align),
                  ...(hidden
                    ? { display: "none", minWidth: 0, width: 0, p: 0, border: "none" }
                    : {}),
                }}
              >
                {col.key === "select" ? (
                  <Checkbox
                    size="small"
                    checked={Boolean(allRowsSelected)}
                    indeterminate={Boolean(someRowsSelected)}
                    onChange={onToggleAllRowSelection}
                    disabled={displayRows.length === 0 || saving}
                    inputProps={{ "aria-label": "Select all collection rows on this page" }}
                    sx={{ p: 0 }}
                  />
                ) : (
                  col.label
                )}
              </MDBox>
            );
          })}
        </MDBox>

        {displayRows.length === 0 ? (
          <MDBox py={3} textAlign="center">
            <MDTypography variant="caption" color="text">
              {statusFilter && statusFilter !== "All"
                ? `No ${statusFilter.toLowerCase()} collection entries found.`
                : "No collection entries yet. Use Add to create one."}
            </MDTypography>
          </MDBox>
        ) : (
          displayRows.map((row, index) => (
            <CollectionEntryGridRow
              key={row.localKey || row.id}
              row={row}
              index={index}
              rowNumber={rowIndexOffset + index + 1}
              allRows={displayRows}
              classOptions={classOptions}
              contracts={contracts}
              invoices={invoices}
              tenants={tenants}
              customers={customers}
              suppliers={suppliers}
              coaOptions={coaOptions}
              receipts={receipts}
              canCreate={canCreate}
              canEditRow={canEditRow}
              canDeleteRow={canDeleteRow}
              canEditStatus={canEditStatus}
              activeLockDate={activeLockDate}
              saving={saving}
              onRowChange={onRowChange}
              onSaveRow={onSaveRow}
              onEditRow={onEditRow}
              onCancelEditRow={onCancelEditRow}
              onDeleteRow={onDeleteRow}
              onDuplicateRow={onDuplicateRow}
              onAttachmentSelect={onAttachmentSelect}
              onClearPendingAttachment={onClearPendingAttachment}
              onDownloadAttachment={onDownloadAttachment}
              onViewTenant={onViewTenant}
              onViewInvoice={onViewInvoice}
              selectedRowIds={selectedRowIds}
              onToggleRowSelection={onToggleRowSelection}
              getRowKey={getRowKey}
              hiddenColumnKeys={hiddenColumns}
              gridRowSx={gridRowSx}
              bodyCellSx={bodyCellSx}
            />
          ))
        )}
      </MDBox>
    </MDBox>
  );
}

CollectionsGrid.propTypes = {
  rows: PropTypes.array.isRequired,
  totalRowCount: PropTypes.number,
  rowIndexOffset: PropTypes.number,
  gridTemplate: PropTypes.string,
  hiddenColumnKeys: PropTypes.arrayOf(PropTypes.string),
  statusFilter: PropTypes.string,
  onStatusFilterChange: PropTypes.func,
  classOptions: PropTypes.array.isRequired,
  contracts: PropTypes.array.isRequired,
  invoices: PropTypes.array.isRequired,
  tenants: PropTypes.array.isRequired,
  customers: PropTypes.array,
  suppliers: PropTypes.array,
  coaOptions: PropTypes.array.isRequired,
  receipts: PropTypes.array.isRequired,
  canCreate: PropTypes.bool,
  canEditRow: PropTypes.bool,
  canDeleteRow: PropTypes.bool,
  canEditStatus: PropTypes.bool,
  activeLockDate: PropTypes.string,
  saving: PropTypes.bool,
  onRowChange: PropTypes.func.isRequired,
  onSaveRow: PropTypes.func.isRequired,
  onEditRow: PropTypes.func.isRequired,
  onCancelEditRow: PropTypes.func.isRequired,
  onDeleteRow: PropTypes.func.isRequired,
  onDuplicateRow: PropTypes.func,
  onAddRow: PropTypes.func.isRequired,
  onAttachmentSelect: PropTypes.func,
  onClearPendingAttachment: PropTypes.func,
  onDownloadAttachment: PropTypes.func,
  onViewTenant: PropTypes.func,
  onViewInvoice: PropTypes.func,
  selectedRowIds: PropTypes.instanceOf(Set),
  allRowsSelected: PropTypes.bool,
  someRowsSelected: PropTypes.bool,
  onToggleRowSelection: PropTypes.func,
  onToggleAllRowSelection: PropTypes.func,
  getRowKey: PropTypes.func,
};

CollectionsGrid.defaultProps = {
  totalRowCount: 0,
  rowIndexOffset: 0,
  gridTemplate: undefined,
  hiddenColumnKeys: [],
  statusFilter: "Pending",
  onStatusFilterChange: undefined,
  customers: [],
  suppliers: [],
  canCreate: false,
  canEditRow: false,
  canDeleteRow: false,
  canEditStatus: false,
  activeLockDate: "",
  saving: false,
  onDuplicateRow: undefined,
  onAttachmentSelect: undefined,
  onClearPendingAttachment: undefined,
  onDownloadAttachment: undefined,
  onViewTenant: undefined,
  onViewInvoice: undefined,
  selectedRowIds: undefined,
  allRowsSelected: false,
  someRowsSelected: false,
  onToggleRowSelection: undefined,
  onToggleAllRowSelection: undefined,
  getRowKey: undefined,
};

export default CollectionsGrid;
