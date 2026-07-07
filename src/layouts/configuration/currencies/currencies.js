import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import IconButton from "@mui/material/IconButton";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import CurrencyForm from "layouts/configuration/currencies/CurrencyForm";
import currencyApi, { normalizeCurrencyRow } from "services/api.currency.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import StatusBadge from "components/StatusBadge";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { configurationWorkspaceBodySx } from "utils/configurationWorkspaceBodySx";

const gridCellValuePropType = PropTypes.oneOfType([
  PropTypes.string,
  PropTypes.number,
  PropTypes.bool,
  PropTypes.oneOf([null, undefined]),
]);

function CurrencyStatusCell({ value }) {
  return <StatusBadge value={value} inactiveLabel="Inactive" inactiveColor="error" />;
}

CurrencyStatusCell.propTypes = {
  value: gridCellValuePropType,
};

function CurrencyDecimalCell({ value }) {
  return value != null && value !== "" ? String(value) : "-";
}

CurrencyDecimalCell.propTypes = {
  value: gridCellValuePropType,
};

function Currencies() {
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const fetchCurrencies = async () => {
    setLoading(true);
    try {
      const response = await currencyApi.getAll(1, 0);
      if (Array.isArray(response)) {
        setTableRows(response.map(normalizeCurrencyRow));
        return;
      }
      const data = response?.data ?? [];
      setTableRows(Array.isArray(data) ? data.map(normalizeCurrencyRow) : []);
    } catch (error) {
      console.error("Error fetching currencies:", error);
      setTableRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCurrencies();
  }, []);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
  };

  const handleEditRecord = (id) => {
    const record = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!record) {
      console.error("Record not found for id:", id);
      return;
    }
    setCurrentRecord(record);
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await currencyApi.remove(recordToDelete);
      fetchCurrencies();
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting currency:", error);
      window.alert("Failed to delete currency. Please try again.");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleSubmit = async (payload) => {
    const existingId = currentRecord?.id ?? currentRecord?.Id;
    if (existingId) {
      await currencyApi.update(existingId, payload);
    } else {
      await currencyApi.create(payload);
    }
    await fetchCurrencies();
    handleCloseForm();
  };

  const txt = (v) => (v != null && String(v).trim() !== "" ? String(v) : "-");

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
        Cell: ({ row }) => {
          const s = row?.original?.sno;
          return s != null && s !== "" ? s : "-";
        },
      },
      {
        id: "code",
        Header: "Code",
        accessor: "code",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "name",
        Header: "Name",
        accessor: "name",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "currencyType",
        Header: "Type",
        accessor: "currencyType",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "decimalPlaces",
        Header: "Decimal",
        accessor: "decimalPlaces",
        align: "center",
        Cell: CurrencyDecimalCell,
      },
      {
        id: "status",
        Header: "Status",
        accessor: "status",
        align: "center",
        Cell: CurrencyStatusCell,
      },
    ],
    []
  );

  const computedRows = tableRows.map((row, index) => {
    const normalizedId = row?.id ?? row?.Id;
    const sno = index + 1;

    return {
      ...row,
      id: normalizedId,
      sno,
      code: row.code ?? row.Code ?? "",
      name: row.name ?? row.Name ?? "",
      currencyType: row.currencyType ?? row.CurrencyType ?? row.type ?? row.Type ?? "",
      decimalPlaces: row.decimalPlaces ?? row.DecimalPlaces ?? "",
      status: row.status ?? row.Status ?? "",
      actions: (
        <MDBox
          alignItems="left"
          justifyContent="left"
          sx={{
            backgroundColor: "#f8f9fa",
            gap: "2px",
            padding: "2px 2px",
            borderRadius: "2px",
          }}
        >
          {canEditCurrentMenu() && (
            <IconButton
              size="small"
              color="info"
              onClick={() => handleEditRecord(normalizedId)}
              title="Edit"
              sx={{ padding: "1px" }}
            >
              <Icon>edit</Icon>
            </IconButton>
          )}
          {canDeleteCurrentMenu() && (
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteRecord(normalizedId)}
              title="Delete"
              sx={{ padding: "1px" }}
            >
              <Icon>delete</Icon>
            </IconButton>
          )}
        </MDBox>
      ),
    };
  });

  const displayTotal = tableRows.length;
  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: displayTotal,
      }),
    [displayTotal]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Currencies"
        subtitle="Manage currency configuration"
        metadata={workspaceMetadata}
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={configurationWorkspaceBodySx}
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
          <DataTable
            table={{
              columns,
              rows: computedRows,
            }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={{
              defaultValue: 20,
              entries: [10, 25, 50, 100, 500, 1000],
            }}
            page={pageIndex}
            pageSize={pageSize}
            onPageChange={setPageIndex}
            onEntriesPerPageChange={(value) => {
              setPageSize(value);
              setPageIndex(0);
            }}
            showTotalEntries
            noEndBorder
            canSearch
            exportFileName="Currencies"
            contentFitTable
            disableHeaderMetrics
          />
          <WorkspaceLoadingOverlay active={loading} />
        </MDBox>
      </EnterpriseWorkspace>

      <CurrencyForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this currency?</MDTypography>
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

export default Currencies;
