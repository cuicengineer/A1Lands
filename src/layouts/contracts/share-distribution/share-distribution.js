import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import Checkbox from "@mui/material/Checkbox";
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
import { ServerGridPagination } from "components/CompactGridPagination";
import IncomeAgreementsModuleTabs from "layouts/income-agreements/components/IncomeAgreementsModuleTabs";
import contractApi from "services/api.contract.service";
import { GRID_DISPLAY_DEFAULT_PAGE_SIZE } from "utils/gridDisplayPageSize";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import {
  buildShareDistributionRows,
  generateNextWorkbookNumber,
  unwrapContractsResponse,
} from "./shareDistributionUtils";

function ShareDistributionSelectCell({ row, selectedRowIds, onToggle }) {
  const rowId = String(row.original?.id ?? row.id);
  return (
    <Checkbox
      size="small"
      checked={selectedRowIds.has(rowId)}
      onChange={() => onToggle(rowId)}
      inputProps={{ "aria-label": `Select row ${rowId}` }}
      sx={{ p: 0 }}
    />
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
};

const SHARE_DISTRIBUTION_COLUMNS = [
  { id: "base", Header: "Base", accessor: "base", align: "left" },
  {
    id: "caId",
    Header: "CA ID",
    accessor: "caId",
    align: "left",
  },
  {
    id: "tenantAndBusiness",
    Header: "Tenant and Business",
    accessor: "tenantAndBusiness",
    align: "left",
  },
  {
    id: "caArea1",
    Header: "CA Area",
    accessor: "caArea1",
    align: "right",
  },
  {
    id: "caArea2",
    Header: "CA Area",
    accessor: "caArea2",
    align: "right",
  },
  {
    id: "revenueRate",
    Header: "Revenue Rate",
    accessor: "revenueRate",
    align: "right",
  },
  { id: "rrFy", Header: "RR FY", accessor: "rrFy", align: "left" },
  {
    id: "rentalValue",
    Header: "Rental Value",
    accessor: "rentalValue",
    align: "right",
  },
  {
    id: "annualRent",
    Header: "Annual Rent",
    accessor: "annualRent",
    align: "right",
  },
  {
    id: "currentRentPA",
    Header: "Current Rent PA",
    accessor: "currentRentPA",
    align: "right",
  },
  {
    id: "govtSharePA",
    Header: "Govt Share-PA",
    accessor: "govtSharePA",
    align: "right",
  },
  {
    id: "receiptDate",
    Header: "Receipt Date",
    accessor: "receiptDate",
    align: "left",
  },
  {
    id: "receiptAmount",
    Header: "Receipt Amount",
    accessor: "receiptAmount",
    align: "right",
  },
  { id: "ratio", Header: "Ratio", accessor: "ratio", align: "right" },
  { id: "govt", Header: "Govt", accessor: "govt", align: "right" },
  { id: "paf", Header: "PAF", accessor: "paf", align: "right" },
  { id: "ahq", Header: "AHQ", accessor: "ahq", align: "right" },
  { id: "rac", Header: "RAC", accessor: "rac", align: "right" },
  {
    id: "baseShare",
    Header: "Base",
    accessor: "baseShare",
    align: "right",
  },
  {
    id: "workbook",
    Header: "Workbook",
    accessor: "workbook",
    align: "left",
  },
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

  const selectedCount = selectedRowIds.size;

  const paginatedRows = useMemo(() => {
    const start = (gridPageNumber - 1) * gridPageSize;
    return rows.slice(start, start + gridPageSize);
  }, [rows, gridPageNumber, gridPageSize]);

  const pageRowIds = useMemo(() => paginatedRows.map((row) => String(row.id)), [paginatedRows]);

  const allPageRowsSelected =
    pageRowIds.length > 0 && pageRowIds.every((id) => selectedRowIds.has(id));
  const somePageRowsSelected =
    pageRowIds.some((id) => selectedRowIds.has(id)) && !allPageRowsSelected;

  const toggleRowSelection = useCallback((rowId) => {
    const key = String(rowId);
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

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

  const handleCreateWorkbook = useCallback(() => {
    if (selectedCount === 0) return;

    const workbookNumber = generateNextWorkbookNumber();
    const selectedIds = new Set(selectedRowIds);
    const assignedRows = rows.filter((row) => selectedIds.has(String(row.id)));

    setRows((prev) =>
      prev.map((row) =>
        selectedIds.has(String(row.id)) ? { ...row, workbook: workbookNumber } : row
      )
    );
    setLastCreatedWorkbook({
      number: workbookNumber,
      rowCount: assignedRows.length,
      caIds: assignedRows.map((row) => row.caId).filter(Boolean),
    });
    setWorkbookDialogOpen(true);
    setSelectedRowIds(new Set());
  }, [rows, selectedCount, selectedRowIds]);

  const tableColumns = useMemo(() => {
    const selectColumn = {
      id: "select",
      Header: () => (
        <Checkbox
          size="small"
          checked={allPageRowsSelected}
          indeterminate={somePageRowsSelected}
          onChange={togglePageSelection}
          inputProps={{ "aria-label": "Select all rows on this page" }}
          sx={{ p: 0 }}
        />
      ),
      accessor: "select",
      disableSortBy: true,
      align: "center",
      width: 48,
      Cell: (cellProps) => (
        <ShareDistributionSelectCell
          row={cellProps.row}
          selectedRowIds={selectedRowIds}
          onToggle={toggleRowSelection}
        />
      ),
    };

    return [selectColumn, ...SHARE_DISTRIBUTION_COLUMNS];
  }, [
    allPageRowsSelected,
    somePageRowsSelected,
    selectedRowIds,
    togglePageSelection,
    toggleRowSelection,
  ]);

  const totalCount = rows.length;
  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: totalCount }),
    [totalCount]
  );

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

  const tableData = useMemo(() => ({ columns: tableColumns, rows }), [tableColumns, rows]);

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
      <MDButton
        variant="gradient"
        color="info"
        size="small"
        disabled={selectedCount === 0 || loading}
        onClick={handleCreateWorkbook}
        sx={{ minHeight: 32, height: 32, px: 1.5 }}
      >
        <Icon sx={{ mr: 0.5, fontSize: "1rem" }}>book</Icon>
        Create Workbook
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
        bodySx={{
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
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "auto",
          },
          "& .MuiTable-root": {
            tableLayout: "auto",
            width: "max-content",
            minWidth: "100%",
            borderCollapse: "collapse",
          },
          "& .MuiTable-root th": {
            fontSize: "0.75rem !important",
            fontWeight: "700 !important",
            padding: "8px 6px !important",
            backgroundColor: "#c8e6c9",
            color: "#1b5e20 !important",
            borderBottom: "1px solid rgba(0,0,0,0.12)",
            borderRight: "1px solid rgba(0,0,0,0.06)",
            whiteSpace: "nowrap",
            verticalAlign: "middle",
          },
          "& .MuiTable-root td": {
            padding: "6px 6px !important",
            borderBottom: "1px solid #e0e0e0",
            whiteSpace: "nowrap",
            lineHeight: 1.3,
            verticalAlign: "top",
            fontSize: "0.8125rem",
          },
        }}
      >
        <WorkspaceLoadingOverlay open={loading} />
        <DataTable
          table={tableData}
          isSorted={false}
          stickyToolbarAndHeader
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
          paginationFooter={serverPaginationFooter}
          showTotalEntries
          totalEntriesText={`${totalCount} records`}
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
          <MDTypography variant="body2" color="text" sx={{ mb: 1.5 }}>
            A workbook number has been assigned to the selected rows (UI preview only — not saved to
            the server).
          </MDTypography>
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
    </DashboardLayout>
  );
}
