import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
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
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import currencyApi from "services/api.currency.service";
import exchangeRateApi from "services/api.exchangeRate.service";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { ServerGridPagination } from "components/CompactGridPagination";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridSno,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";
import AccountsModuleTabs from "layouts/accounts/components/AccountsModuleTabs";
import ExchangeRateForm from "./ExchangeRateForm";
import {
  buildExchangeRatePayload,
  flattenExchangeRateForGrid,
  normalizeExchangeRateRecord,
} from "./exchangeRateUtils";

export default function ExchangeRate() {
  const [tableRows, setTableRows] = useState([]);
  const [currencies, setCurrencies] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [paginationHost, setPaginationHost] = useState(null);

  const currencyById = useMemo(() => {
    const map = {};
    currencies.forEach((c) => {
      if (c.id != null) map[Number(c.id)] = c;
    });
    return map;
  }, [currencies]);

  const txt = (v) => renderCollectionsGridText(v);

  const loadCurrencies = useCallback(async () => {
    try {
      const list = await currencyApi.fetchCurrenciesForDropdown();
      setCurrencies(Array.isArray(list) ? list : []);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      setCurrencies([]);
    }
  }, []);

  const fetchRates = useCallback(
    async (page = pageNumber, size = pageSize) => {
      setLoading(true);
      try {
        const response = await exchangeRateApi.getAll(page, size);
        const data = Array.isArray(response) ? response : response?.data ?? [];
        const pagination = response?.pagination;
        setTableRows(Array.isArray(data) ? data : []);
        setTotalCount(Number(pagination?.totalCount ?? (Array.isArray(data) ? data.length : 0)));
      } catch (error) {
        console.error("Error fetching exchange rates:", error);
        setTableRows([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [pageNumber, pageSize]
  );

  useEffect(() => {
    loadCurrencies();
  }, [loadCurrencies]);

  useEffect(() => {
    fetchRates(pageNumber, pageSize);
  }, [pageNumber, pageSize, fetchRates]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
  };

  const handleEditRecord = (id) => {
    const record = tableRows.find((row) => Number(row.id ?? row.Id) === Number(id));
    if (!record) return;
    setCurrentRecord({
      ...normalizeExchangeRateRecord(record),
      id: record.id ?? record.Id,
    });
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    try {
      await exchangeRateApi.remove(recordToDelete);
      await fetchRates(pageNumber, pageSize);
    } catch (error) {
      console.error("Error deleting exchange rate:", error);
      window.alert("Failed to delete exchange rate.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleSubmit = async (form) => {
    const payload = buildExchangeRatePayload(form);
    const existingId = currentRecord?.id ?? currentRecord?.Id;
    if (existingId) {
      await exchangeRateApi.update(existingId, payload);
    } else {
      await exchangeRateApi.create(payload);
    }
    await fetchRates(pageNumber, pageSize);
    handleCloseForm();
  };

  const columns = useMemo(
    () => [
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "sno",
        Header: "S.No",
        accessor: "sno",
        align: "center",
        Cell: ({ value }) => renderCollectionsGridSno(value),
      },
      {
        id: "rateDateDisplay",
        Header: "Date",
        accessor: "rateDateDisplay",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "baseCurrency",
        Header: "Base Currency",
        accessor: "baseCurrency",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "foreignCurrency",
        Header: "Foreign Currency",
        accessor: "foreignCurrency",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "rateDisplay",
        Header: "Rate",
        accessor: "rateDisplay",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
    ],
    []
  );

  const computedRows = useMemo(
    () =>
      tableRows.map((row, index) => {
        const flat = flattenExchangeRateForGrid(
          row,
          (pageNumber - 1) * pageSize + index,
          currencyById
        );
        const recordId = flat.id;
        return {
          ...flat,
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              {canEditCurrentMenu() && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(recordId)}
                  title="Edit"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">edit</Icon>
                </IconButton>
              )}
              {canDeleteCurrentMenu() && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(recordId)}
                  title="Delete"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">delete</Icon>
                </IconButton>
              )}
            </MDBox>
          ),
        };
      }),
    [tableRows, currencyById, pageNumber, pageSize]
  );

  const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: displayTotal,
        page: pageNumber,
        pageSize,
      }),
    [displayTotal, pageNumber, pageSize]
  );

  const serverPaginationFooter = useMemo(
    () => (
      <ServerGridPagination
        page={pageNumber}
        totalCount={displayTotal}
        pageSize={pageSize}
        onPageChange={setPageNumber}
      />
    ),
    [displayTotal, pageNumber, pageSize]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Exchange Rate"
        subtitle="Manage currency exchange rates"
        metadata={workspaceMetadata}
        tabs={<AccountsModuleTabs />}
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={buildCollectionsGridTableBodySx({ leadingCompactColumnCount: 1 })}
      >
        <MDBox
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          <MDBox
            ref={setPaginationHost}
            className="saas-settings-table-pagination-top"
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexShrink: 0,
              width: "100%",
            }}
          />

          <DataTable
            table={{ columns, rows: computedRows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={{
              defaultValue: 50,
              entries: [10, 25, 50, 100, 500],
            }}
            page={pageNumber - 1}
            pageSize={pageSize}
            onPageChange={(newPage) => {
              setPageNumber(newPage + 1);
            }}
            onEntriesPerPageChange={(value) => {
              setPageSize(value);
              setPageNumber(1);
            }}
            showTotalEntries={false}
            noEndBorder
            canSearch
            exportFileName="Exchange-Rates"
            contentFitTable
            disableHeaderMetrics
            paginationFooter={serverPaginationFooter}
            paginationHost={paginationHost}
          />
          <WorkspaceLoadingOverlay active={loading} />
        </MDBox>
      </EnterpriseWorkspace>

      <ExchangeRateForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this exchange rate?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
