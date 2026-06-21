import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import Icon from "@mui/material/Icon";
import InputAdornment from "@mui/material/InputAdornment";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DataTable from "examples/Tables/DataTable";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { ServerGridPagination } from "components/CompactGridPagination";
import IncomeAgreementsModuleTabs from "layouts/income-agreements/components/IncomeAgreementsModuleTabs";
import contractApi from "services/api.contract.service";
import api from "services/api.service";
import { GRID_DISPLAY_DEFAULT_PAGE_SIZE } from "utils/gridDisplayPageSize";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { buildShareDistributionRows, unwrapContractsResponse } from "./shareDistributionUtils";

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
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [draftAsOfDate, setDraftAsOfDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [gridPageSize, setGridPageSize] = useState(GRID_DISPLAY_DEFAULT_PAGE_SIZE);
  const [gridPageNumber, setGridPageNumber] = useState(1);
  const asOfDateInputRef = useRef(null);

  const openDatePicker = (ref) => {
    const el = ref?.current;
    if (!el) return;
    try {
      el.focus({ preventScroll: true });
      if (typeof el.showPicker === "function") {
        el.showPicker();
      } else {
        el.click();
      }
    } catch (_) {
      try {
        el.click();
      } catch (_e) {
        // ignore
      }
    }
  };

  const toDisplayDate = (isoDateStr) => {
    if (!isoDateStr || typeof isoDateStr !== "string") return "";
    try {
      const d = parseISO(isoDateStr.trim());
      return isValid(d) ? format(d, "dd-MMM-yyyy") : isoDateStr;
    } catch {
      return isoDateStr;
    }
  };

  const fetchRows = useCallback(async () => {
    setLoading(true);
    try {
      const [contractRes, asOfRes, tenantRes, baseRes] = await Promise.all([
        contractApi.getAllRecords(),
        asOfDate ? contractApi.getActiveByAsOfDate(asOfDate) : Promise.resolve([]),
        api.list("tenant"),
        api.list("base"),
      ]);

      const contractRows = unwrapContractsResponse(contractRes);
      const asOfRows = unwrapContractsResponse(asOfRes);
      const tenants = unwrapContractsResponse(tenantRes);
      const bases = unwrapContractsResponse(baseRes);

      setRows(
        buildShareDistributionRows({
          asOfRows,
          contractRows,
          tenants,
          bases,
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

  const tableData = useMemo(() => ({ columns: SHARE_DISTRIBUTION_COLUMNS, rows }), [rows]);

  const contextFilters = (
    <MDBox
      className="contracts-workspace-context-bar"
      display="flex"
      alignItems="center"
      gap={1}
      px={2}
      pb={2}
    >
      <MDBox width="9.5rem" sx={{ position: "relative", flexShrink: 0 }}>
        <input
          type="date"
          ref={asOfDateInputRef}
          value={draftAsOfDate || ""}
          onChange={(e) => setDraftAsOfDate(e.target.value)}
          tabIndex={-1}
          style={{
            position: "absolute",
            opacity: 0,
            width: 0,
            height: 0,
            top: 0,
            left: 0,
            pointerEvents: "none",
          }}
          aria-hidden="true"
        />
        <MDInput
          placeholder="As of Date"
          value={toDisplayDate(draftAsOfDate)}
          onClick={() => openDatePicker(asOfDateInputRef)}
          size="small"
          InputProps={{
            readOnly: true,
            endAdornment: (
              <InputAdornment position="end">
                <Icon
                  sx={{ cursor: "pointer", fontSize: "1rem" }}
                  onClick={(e) => {
                    e.stopPropagation();
                    openDatePicker(asOfDateInputRef);
                  }}
                >
                  calendar_today
                </Icon>
              </InputAdornment>
            ),
          }}
          fullWidth
          sx={{
            "& .MuiInputBase-root": { minHeight: 32, maxHeight: 32, fontSize: "0.8125rem" },
          }}
        />
      </MDBox>
      {draftAsOfDate !== asOfDate ? (
        <MDButton
          variant="outlined"
          color="info"
          size="small"
          onClick={() => setAsOfDate(draftAsOfDate)}
          disabled={loading || !draftAsOfDate}
          sx={{ minHeight: 32, height: 32, px: 1.5 }}
        >
          Submit
        </MDButton>
      ) : null}
    </MDBox>
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Share Distribution"
        subtitle="Contract share distribution as of selected date"
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
    </DashboardLayout>
  );
}
