import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Checkbox from "@mui/material/Checkbox";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DataTable from "examples/Tables/DataTable";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import CompactGroupBySelect from "components/CompactGroupBySelect";
import AgreementProvPdfPreviewDialog from "components/AgreementProvPdfPreviewDialog";
import IncomeAgreementsModuleTabs from "layouts/income-agreements/components/IncomeAgreementsModuleTabs";
import contractApi from "services/api.contract.service";
import { GRID_DISPLAY_DEFAULT_PAGE_SIZE } from "utils/gridDisplayPageSize";
import { ServerGridPagination } from "components/CompactGridPagination";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { buildCollectionsGridTableBodySx } from "utils/collectionsGridTableSx";
import {
  loadShareDistributionWorkbookPdfMargins,
  saveShareDistributionWorkbookPdfMargins,
  SHARE_DIST_WORKBOOK_PDF_DEFAULT_MARGINS,
} from "utils/agreementProvPdfMargins";
import { GRID_DARK_ARROW_ICON_SX } from "utils/gridDarkArrowIconSx";
import {
  buildShareDistributionRows,
  buildShareDistributionGroupedRows,
  buildShareDistributionGridTotalRow,
  filterShareDistributionRowsByWorkbook,
  getShareDistributionContractId,
  getShareDistributionCollectionEntryId,
  getShareDistributionRowKey,
  isShareDistributionWorkbookAssigned,
  SHARE_DIST_DEFAULT_GROUP_BY_COLUMNS,
  SHARE_DIST_GROUPING_COLUMN_OPTIONS,
  SHARE_DIST_UNASSIGNED_ROW_BG,
  SHARE_DIST_WORKBOOK_FILTER,
  SHARE_DIST_WORKBOOK_ROW_BG,
  sumShareDistributionGridRows,
  unwrapContractsResponse,
} from "./shareDistributionUtils";
import { generateShareDistributionWorkbookPdf } from "./shareDistributionWorkbookPdf";

function ShareDistributionSelectCell({
  row,
  selectedRowIds,
  onToggle,
  expandedGroups,
  onToggleGroup,
}) {
  const rowOriginal = row.original ?? row;

  if (rowOriginal?.isGroupRow) {
    const groupKey = rowOriginal.groupKey;
    const isExpanded = expandedGroups.has(groupKey);
    return (
      <MDBox
        className="share-dist-select-checkbox-host"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "100%",
          m: 0,
          p: 0,
        }}
      >
        <IconButton
          size="small"
          onClick={() => onToggleGroup?.(groupKey)}
          title={isExpanded ? "Collapse group" : "Expand group"}
          sx={{ p: 0, m: 0, ...GRID_DARK_ARROW_ICON_SX }}
        >
          <Icon sx={{ fontSize: "1.1rem" }}>{isExpanded ? "expand_less" : "expand_more"}</Icon>
        </IconButton>
      </MDBox>
    );
  }

  if (rowOriginal?.__isTotalRow) {
    return null;
  }

  const rowKey = getShareDistributionRowKey(rowOriginal);
  const hasWorkbook = isShareDistributionWorkbookAssigned(rowOriginal);
  return (
    <MDBox
      className="share-dist-select-checkbox-host"
      sx={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "100%",
        m: 0,
        p: 0,
      }}
    >
      <Checkbox
        size="small"
        checked={!hasWorkbook && selectedRowIds.has(rowKey)}
        disabled={hasWorkbook}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => {
          event.stopPropagation();
          if (!hasWorkbook) onToggle(rowKey);
        }}
        inputProps={{
          "aria-label": hasWorkbook
            ? `Row ${rowKey} already assigned to a workbook`
            : `Select row ${rowKey}`,
        }}
        sx={{ p: 0, m: 0 }}
      />
    </MDBox>
  );
}

ShareDistributionSelectCell.propTypes = {
  row: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    original: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    }),
  }).isRequired,
  selectedRowIds: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
  expandedGroups: PropTypes.instanceOf(Set).isRequired,
  onToggleGroup: PropTypes.func.isRequired,
};

function ShareDistributionWorkbookCell({ value, row, onOpenWorkbookPdf }) {
  const rowOriginal = row?.original ?? row;
  if (rowOriginal?.__isTotalRow) {
    return null;
  }
  if (rowOriginal?.isGroupRow) {
    const text = String(value || "").trim();
    return (
      <MDTypography
        variant="caption"
        fontWeight="bold"
        color="text"
        sx={{ lineHeight: 1, whiteSpace: "nowrap", verticalAlign: "middle" }}
      >
        {text || "-"}
      </MDTypography>
    );
  }

  const text = String(value || "").trim();
  if (text) {
    return (
      <MDButton
        variant="text"
        color="success"
        onClick={() => onOpenWorkbookPdf?.(text, rowOriginal)}
        sx={{
          p: 0,
          minWidth: "auto",
          minHeight: 0,
          fontSize: "0.75rem",
          fontWeight: 700,
          lineHeight: 1,
          textDecoration: "underline",
          display: "inline-flex",
          alignItems: "center",
          verticalAlign: "middle",
          whiteSpace: "nowrap",
        }}
      >
        {text}
      </MDButton>
    );
  }
  return (
    <MDTypography
      variant="caption"
      fontWeight="regular"
      color="text"
      sx={{ lineHeight: 1, whiteSpace: "nowrap", verticalAlign: "middle" }}
    >
      {text}
    </MDTypography>
  );
}

ShareDistributionWorkbookCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  row: PropTypes.object,
  onOpenWorkbookPdf: PropTypes.func,
};

ShareDistributionWorkbookCell.defaultProps = {
  value: "",
  row: null,
  onOpenWorkbookPdf: undefined,
};

const SHARE_DIST_NUM_HEADER_CLASS = "share-dist-num-header";
const SHARE_DIST_NUM_CELL_CLASS = "share-dist-num-cell";
const SHARE_DIST_SELECT_HEADER_CLASS = "share-dist-select-header";
const SHARE_DIST_SELECT_CELL_CLASS = "share-dist-select-cell";

function numericColumn(definition) {
  return {
    ...definition,
    align: "center",
    disableFilters: true,
    disableSortBy: true,
    className: SHARE_DIST_NUM_CELL_CLASS,
    headerClassName: SHARE_DIST_NUM_HEADER_CLASS,
  };
}

function textColumn(definition) {
  return {
    ...definition,
    disableFilters: true,
    disableSortBy: true,
  };
}

const SHARE_DISTRIBUTION_COLUMNS = [
  textColumn({
    id: "workbook",
    Header: "Workbook",
    accessor: "workbook",
    align: "left",
    Cell: ShareDistributionWorkbookCell,
  }),
  numericColumn({ id: "sn", Header: "SN", accessor: "sn", width: 48 }),
  textColumn({ id: "racName", Header: "RAC Name", accessor: "racName", align: "left" }),
  textColumn({ id: "base", Header: "Base", accessor: "base", align: "left" }),
  textColumn({ id: "className", Header: "Class", accessor: "className", align: "left" }),
  textColumn({ id: "agreement", Header: "Agreement", accessor: "agreement", align: "left" }),
  textColumn({
    id: "tenantAndBusiness",
    Header: "Tenant and Business",
    accessor: "tenantAndBusiness",
    align: "left",
  }),
  numericColumn({ id: "booArea", Header: "BoO Area", accessor: "booArea" }),
  textColumn({ id: "rrFy", Header: "RR FY", accessor: "rrFy", align: "left" }),
  numericColumn({ id: "revenueRate", Header: "Revenue Rate", accessor: "revenueRate" }),
  numericColumn({ id: "govtSharePA", Header: "Govt Share-PA", accessor: "govtSharePA" }),
  numericColumn({ id: "currentRentPA", Header: "Current Rent-PA", accessor: "currentRentPA" }),
  textColumn({
    id: "receiptDate",
    Header: "Receipt Date",
    accessor: "receiptDate",
    align: "left",
  }),
  numericColumn({ id: "receiptAmount", Header: "Receipt Amount", accessor: "receiptAmount" }),
  numericColumn({ id: "ratio", Header: "Ratio", accessor: "ratio" }),
  numericColumn({ id: "govt", Header: "Govt", accessor: "govt" }),
  numericColumn({ id: "paf", Header: "PAF", accessor: "paf" }),
  numericColumn({ id: "ahq", Header: "AHQ", accessor: "ahq" }),
  numericColumn({ id: "rac", Header: "RAC", accessor: "rac" }),
  numericColumn({ id: "baseShare", Header: "Base", accessor: "baseShare" }),
];

export default function ShareDistribution() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const asOfDate = useMemo(() => new Date().toISOString().split("T")[0], []);
  const [gridPageSize, setGridPageSize] = useState(GRID_DISPLAY_DEFAULT_PAGE_SIZE);
  const [gridPageNumber, setGridPageNumber] = useState(1);
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [workbookDialogOpen, setWorkbookDialogOpen] = useState(false);
  const [lastCreatedWorkbook, setLastCreatedWorkbook] = useState(null);
  const [creatingWorkbook, setCreatingWorkbook] = useState(false);
  const [workbookError, setWorkbookError] = useState("");
  const [paginationHost, setPaginationHost] = useState(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewData, setPdfPreviewData] = useState(null);
  const [workbookFilter, setWorkbookFilter] = useState(SHARE_DIST_WORKBOOK_FILTER.ALL);
  const [groupByColumns, setGroupByColumns] = useState(SHARE_DIST_DEFAULT_GROUP_BY_COLUMNS);
  const [expandedGroups, setExpandedGroups] = useState(() => new Set());

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const shareDistributionRes = asOfDate
        ? await contractApi.getShareDistributionByAsOfDate(asOfDate)
        : [];
      const asOfRows = unwrapContractsResponse(shareDistributionRes);

      setRows(
        buildShareDistributionRows({
          asOfRows,
          contractRows: [],
          tenants: [],
          bases: [],
        })
      );
      setGridPageNumber(1);
    } catch (error) {
      console.error("Failed to load share distribution data:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [asOfDate]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  useEffect(() => {
    setSelectedRowIds((prev) => {
      if (prev.size === 0) return prev;
      const assignedKeys = new Set(
        rows
          .filter(isShareDistributionWorkbookAssigned)
          .map((row) => getShareDistributionRowKey(row))
      );
      if (![...prev].some((id) => assignedKeys.has(id))) return prev;
      const next = new Set(prev);
      assignedKeys.forEach((id) => next.delete(id));
      return next;
    });
  }, [rows]);

  const selectedCount = selectedRowIds.size;

  const handleToggleGroup = useCallback((groupKey) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  }, []);

  useEffect(() => {
    setExpandedGroups(new Set());
  }, [groupByColumns]);

  useEffect(() => {
    setGridPageNumber(1);
  }, [workbookFilter, groupByColumns]);

  const filteredRows = useMemo(
    () => filterShareDistributionRowsByWorkbook(rows, workbookFilter),
    [rows, workbookFilter]
  );

  const displayRows = useMemo(
    () => buildShareDistributionGroupedRows(filteredRows, groupByColumns, expandedGroups),
    [filteredRows, groupByColumns, expandedGroups]
  );

  useEffect(() => {
    const maxPages = Math.max(1, Math.ceil(displayRows.length / gridPageSize) || 1);
    if (gridPageNumber > maxPages) {
      setGridPageNumber(maxPages);
    }
  }, [displayRows.length, gridPageNumber, gridPageSize]);

  const paginatedRows = useMemo(() => {
    const start = (gridPageNumber - 1) * gridPageSize;
    return displayRows.slice(start, start + gridPageSize);
  }, [displayRows, gridPageNumber, gridPageSize]);

  const selectablePaginatedRows = useMemo(
    () =>
      paginatedRows.filter(
        (row) => !row?.isGroupRow && !row?.__isTotalRow && !isShareDistributionWorkbookAssigned(row)
      ),
    [paginatedRows]
  );

  const pageRowIds = useMemo(
    () => selectablePaginatedRows.map((row) => getShareDistributionRowKey(row)),
    [selectablePaginatedRows]
  );

  const allPageRowsSelected =
    pageRowIds.length > 0 && pageRowIds.every((id) => selectedRowIds.has(id));
  const somePageRowsSelected =
    pageRowIds.some((id) => selectedRowIds.has(id)) && !allPageRowsSelected;

  const toggleRowSelection = useCallback(
    (rowKey) => {
      const key = String(rowKey);
      const row = rows.find((item) => getShareDistributionRowKey(item) === key);
      if (row && isShareDistributionWorkbookAssigned(row)) return;

      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
    },
    [rows]
  );

  const togglePageSelection = useCallback(() => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (allPageRowsSelected) {
        pageRowIds.forEach((id) => next.delete(id));
      } else {
        pageRowIds.forEach((id) => next.add(id));
      }
      return next;
    });
  }, [allPageRowsSelected, pageRowIds]);

  const handleCreateWorkbook = useCallback(async () => {
    if (selectedCount === 0 || creatingWorkbook) return;

    // Resolve only the explicitly checked rows (never the full grid / page).
    const rowByKey = new Map(
      rows.map((row) => [getShareDistributionRowKey(row), row]).filter(([key]) => Boolean(key))
    );
    const selectedRows = [...selectedRowIds]
      .map((key) => rowByKey.get(String(key)))
      .filter(Boolean);
    const eligibleRows = selectedRows.filter((row) => !isShareDistributionWorkbookAssigned(row));

    if (eligibleRows.length === 0) {
      setWorkbookError("Selected records already have a workbook and cannot be reassigned.");
      return;
    }

    // Preserve selection order; one workbook assignment per selected collection entry only.
    const collectionEntryIds = [];
    const seenEntryIds = new Set();
    eligibleRows.forEach((row) => {
      const entryId = getShareDistributionCollectionEntryId(row);
      if (entryId == null || seenEntryIds.has(entryId)) return;
      seenEntryIds.add(entryId);
      collectionEntryIds.push(entryId);
    });

    if (collectionEntryIds.length === 0) {
      setWorkbookError("Selected rows do not have valid collection entry IDs.");
      return;
    }

    setWorkbookError("");
    setCreatingWorkbook(true);
    try {
      const response = await contractApi.createShareDistributionWorkbook({ collectionEntryIds });
      const result = response?.data && !response?.workbookNo ? response.data : response;
      const workbookNumber = result?.workbookNo || result?.WorkbookNo || "";
      const assignedEntryIds = new Set(
        (result?.collectionEntryIds || result?.CollectionEntryIds || collectionEntryIds).map((id) =>
          Number(id)
        )
      );

      setLastCreatedWorkbook({
        number: workbookNumber,
        rowCount: assignedEntryIds.size || collectionEntryIds.length,
        caIds: eligibleRows
          .filter((row) => assignedEntryIds.has(getShareDistributionCollectionEntryId(row)))
          .map((row) => row.caId)
          .filter(Boolean),
      });
      setWorkbookDialogOpen(true);
      setSelectedRowIds(new Set());
      await fetchRows();
    } catch (error) {
      console.error("Failed to create share distribution workbook:", error);
      setWorkbookError(
        error?.message || "Failed to create workbook. Please try again or contact support."
      );
    } finally {
      setCreatingWorkbook(false);
    }
  }, [rows, selectedCount, selectedRowIds, creatingWorkbook, fetchRows]);

  const handleOpenWorkbookPdf = useCallback(
    (workbookNo) => {
      const normalizedWorkbookNo = String(workbookNo || "").trim();
      if (!normalizedWorkbookNo) return;
      const workbookRows = rows.filter(
        (row) => String(row?.workbook || "").trim() === normalizedWorkbookNo
      );
      if (workbookRows.length === 0) return;
      setPdfPreviewData({
        workbookNo: normalizedWorkbookNo,
        rows: workbookRows,
      });
      setPdfPreviewOpen(true);
    },
    [rows]
  );

  const handleCloseWorkbookPdf = useCallback(() => {
    setPdfPreviewOpen(false);
    setPdfPreviewData(null);
  }, []);

  const generateWorkbookPdfBlob = useCallback(
    (data, marginsIn) =>
      generateShareDistributionWorkbookPdf(data, marginsIn, {
        openNewTab: false,
        documentTitle: "Workbook",
      }),
    []
  );

  const tableColumns = useMemo(() => {
    const hasSelectableRowsOnPage = pageRowIds.length > 0;
    const selectColumn = {
      id: "select",
      Header: () => (
        <MDBox
          className="share-dist-select-checkbox-host"
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            m: 0,
            p: 0,
          }}
        >
          <Checkbox
            size="small"
            checked={hasSelectableRowsOnPage && allPageRowsSelected}
            indeterminate={somePageRowsSelected}
            disabled={!hasSelectableRowsOnPage}
            onClick={(event) => event.stopPropagation()}
            onChange={(event) => {
              event.stopPropagation();
              togglePageSelection();
            }}
            inputProps={{ "aria-label": "Select all unassigned rows on this page" }}
            sx={{ p: 0, m: 0 }}
          />
        </MDBox>
      ),
      accessor: "select",
      disableSortBy: true,
      disableFilters: true,
      align: "center",
      className: SHARE_DIST_SELECT_CELL_CLASS,
      headerClassName: SHARE_DIST_SELECT_HEADER_CLASS,
      width: 48,
      minWidth: 48,
      maxWidth: 48,
      Cell: (cellProps) => (
        <ShareDistributionSelectCell
          row={cellProps.row}
          selectedRowIds={selectedRowIds}
          onToggle={toggleRowSelection}
          expandedGroups={expandedGroups}
          onToggleGroup={handleToggleGroup}
        />
      ),
    };

    return [
      selectColumn,
      ...SHARE_DISTRIBUTION_COLUMNS.map((column) =>
        column.id === "workbook"
          ? {
              ...column,
              Cell: (cellProps) => (
                <ShareDistributionWorkbookCell
                  value={cellProps?.value}
                  row={cellProps?.row}
                  onOpenWorkbookPdf={handleOpenWorkbookPdf}
                />
              ),
            }
          : column
      ),
    ];
  }, [
    allPageRowsSelected,
    handleOpenWorkbookPdf,
    handleToggleGroup,
    expandedGroups,
    somePageRowsSelected,
    selectedRowIds,
    togglePageSelection,
    toggleRowSelection,
    pageRowIds.length,
  ]);

  const totalCount = displayRows.length;
  const totalPages = Math.ceil(totalCount / gridPageSize) || 0;

  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: filteredRows.length }),
    [filteredRows.length]
  );

  const tableData = useMemo(() => {
    const pageDataRows = paginatedRows.filter((row) => !row?.isGroupRow && !row?.__isTotalRow);
    if (pageDataRows.length === 0) {
      return { columns: tableColumns, rows: paginatedRows };
    }
    const totalRow = buildShareDistributionGridTotalRow(sumShareDistributionGridRows(pageDataRows));
    return { columns: tableColumns, rows: [...paginatedRows, totalRow] };
  }, [tableColumns, paginatedRows]);

  const serverPaginationFooter = useMemo(
    () => (
      <ServerGridPagination
        page={gridPageNumber}
        totalCount={totalCount}
        pageSize={gridPageSize}
        onPageChange={setGridPageNumber}
      />
    ),
    [totalCount, gridPageNumber, gridPageSize]
  );

  const shareDistributionTableSx = useMemo(
    () => ({
      ...buildCollectionsGridTableBodySx({ leadingCompactColumnCount: 3 }),
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      position: "relative",
      flex: "1 1 0",
      minHeight: 0,
      "& > .contracts-workspace-context-bar": {
        flexShrink: 0,
      },
      "& > .saas-settings-table": {
        flex: "1 1 0",
        minHeight: 0,
        height: "100%",
        alignSelf: "stretch",
      },
      "& .saas-settings-table-scroll": {
        flex: "1 1 0",
        minHeight: 0,
      },
      "& .MuiTable-root thead th > div > div:nth-of-type(2)": {
        display: "none !important",
      },
      "& .MuiTable-root thead th > div > div:first-of-type": {
        flex: "1 1 100% !important",
        width: "100%",
        maxWidth: "100%",
      },
      [`& .MuiTable-root th.${SHARE_DIST_NUM_HEADER_CLASS} > div`]: {
        justifyContent: "center !important",
      },
      [`& .MuiTable-root th.${SHARE_DIST_NUM_HEADER_CLASS}, & .MuiTable-root td.${SHARE_DIST_NUM_CELL_CLASS}`]:
        {
          textAlign: "center !important",
        },
      [`& .MuiTable-root th.${SHARE_DIST_SELECT_HEADER_CLASS} > div`]: {
        justifyContent: "center !important",
      },
      "& tr.share-dist-workbook-row td": {
        backgroundColor: `${SHARE_DIST_WORKBOOK_ROW_BG} !important`,
      },
      "& tr.share-dist-unassigned-row td": {
        backgroundColor: `${SHARE_DIST_UNASSIGNED_ROW_BG} !important`,
      },
      "& tr.share-dist-group-row td": {
        backgroundColor: "#f8f9fa !important",
        fontWeight: "600 !important",
      },
      "& tr.share-dist-total-row td": {
        backgroundColor: "#f5f5f5 !important",
        fontWeight: "700 !important",
        borderTop: "2px solid #bdbdbd !important",
      },
    }),
    []
  );

  const contextFilters = (
    <MDBox
      className="contracts-workspace-context-bar"
      display="flex"
      alignItems="center"
      justifyContent="flex-end"
      gap={1}
      px={2}
      pb={2}
      flexWrap="wrap"
    >
      {selectedCount > 0 ? (
        <MDTypography variant="caption" color="text" sx={{ whiteSpace: "nowrap" }}>
          {selectedCount} row{selectedCount === 1 ? "" : "s"} selected
        </MDTypography>
      ) : null}
      {workbookError ? (
        <MDTypography variant="caption" color="error" sx={{ whiteSpace: "nowrap" }}>
          {workbookError}
        </MDTypography>
      ) : null}
      <CompactGroupBySelect
        options={SHARE_DIST_GROUPING_COLUMN_OPTIONS}
        value={groupByColumns}
        onChange={setGroupByColumns}
      />
      <ToggleButtonGroup
        exclusive
        value={workbookFilter}
        onChange={(_, value) => {
          if (value !== null) setWorkbookFilter(value);
        }}
        size="small"
        color="info"
        aria-label="Filter share distribution by workbook assignment"
        className="contracts-context-segmented contracts-context-toggle"
      >
        <ToggleButton value={SHARE_DIST_WORKBOOK_FILTER.ALL}>ALL</ToggleButton>
        <ToggleButton value={SHARE_DIST_WORKBOOK_FILTER.ASSIGNED}>ASSIGNED</ToggleButton>
        <ToggleButton value={SHARE_DIST_WORKBOOK_FILTER.UNASSIGNED}>NOT ASSIGNED</ToggleButton>
      </ToggleButtonGroup>
      <MDButton
        variant="gradient"
        color="info"
        size="small"
        disabled={selectedCount === 0 || loading || creatingWorkbook}
        onClick={handleCreateWorkbook}
        sx={{ minHeight: 32, height: 32, px: 1.5 }}
      >
        <Icon sx={{ mr: 0.5, fontSize: "1rem" }}>book</Icon>
        {creatingWorkbook ? "Creating..." : "Create Workbook"}
      </MDButton>
    </MDBox>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Share Distribution"
        subtitle="Contract share distribution"
        tabs={<IncomeAgreementsModuleTabs />}
        metadata={workspaceMetadata}
        filters={contextFilters}
        bodySx={shareDistributionTableSx}
      >
        <WorkspaceLoadingOverlay open={loading} />
        <MDBox
          ref={setPaginationHost}
          className="saas-settings-table-pagination-top"
          sx={{
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            flexShrink: 0,
            width: "100%",
            minHeight: totalPages > 1 ? 28 : 0,
          }}
        />
        <DataTable
          table={tableData}
          isSorted={false}
          stickyToolbarAndHeader
          contentFitTable
          entriesPerPage={{
            defaultValue: GRID_DISPLAY_DEFAULT_PAGE_SIZE,
            entries: [10, 25, 50, 100],
          }}
          page={gridPageNumber - 1}
          pageSize={gridPageSize}
          onPageChange={(newPage) => setGridPageNumber(newPage + 1)}
          onEntriesPerPageChange={(n) => {
            setGridPageSize(Number(n));
            setGridPageNumber(1);
          }}
          paginationHost={paginationHost}
          paginationFooter={serverPaginationFooter}
          showTotalEntries
          totalEntriesText={`${filteredRows.length} records`}
          pagination={{ variant: "gradient", color: "info" }}
          noEndBorder
          canSearch={false}
          exportFileName="Share Distribution"
        />
      </EnterpriseWorkspace>

      <Dialog
        open={workbookDialogOpen}
        onClose={() => setWorkbookDialogOpen(false)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontSize: "1.1rem", fontWeight: 700 }}>Workbook Created</DialogTitle>
        <DialogContent dividers>
          <MDBox
            sx={{
              px: 2,
              py: 1.5,
              borderRadius: 1,
              backgroundColor: "#e8f5e9",
              border: "1px solid #c8e6c9",
              textAlign: "center",
            }}
          >
            <MDTypography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
              Workbook Number
            </MDTypography>
            <MDTypography variant="h5" fontWeight="bold" color="success">
              {lastCreatedWorkbook?.number || "-"}
            </MDTypography>
          </MDBox>
          {lastCreatedWorkbook?.rowCount ? (
            <MDTypography variant="caption" color="text" sx={{ display: "block", mt: 1.5 }}>
              Assigned to {lastCreatedWorkbook.rowCount} row
              {lastCreatedWorkbook.rowCount === 1 ? "" : "s"}.
            </MDTypography>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 2, py: 1.5 }}>
          <MDButton variant="gradient" color="info" onClick={() => setWorkbookDialogOpen(false)}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>

      <AgreementProvPdfPreviewDialog
        open={pdfPreviewOpen}
        onClose={handleCloseWorkbookPdf}
        data={pdfPreviewData}
        generatePdfBlob={generateWorkbookPdfBlob}
        title="PDF Preview"
        previewTitle="Workbook PDF"
        defaultMargins={SHARE_DIST_WORKBOOK_PDF_DEFAULT_MARGINS}
        loadMargins={loadShareDistributionWorkbookPdfMargins}
        saveMargins={saveShareDistributionWorkbookPdfMargins}
      />
    </DashboardLayout>
  );
}
