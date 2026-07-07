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
import CurrencyLoading from "components/CurrencyLoading";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import dealerApi from "services/api.dealer.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridSno,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";
import { usePartyGridBulkStatus } from "layouts/shared/partyGridBulkStatus";
import DealerForm, { formatDealerDisplayName, getProvinceLabel } from "./DealerForm";
import { normalizeDealerRecord } from "./dealerUtils";

export default function Dealers() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [paginationHost, setPaginationHost] = useState(null);

  const txt = (v) => renderCollectionsGridText(v);

  const fetchDealers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await dealerApi.listDealers();
      const rows = dealerApi.unwrapList(response);
      setRecords(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Error fetching dealers:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDealers();
  }, [fetchDealers]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
  };

  const handleEditRecord = (id) => {
    const record = records.find((row) => Number(row.id ?? row.Id) === Number(id));
    if (!record) return;
    setCurrentRecord(normalizeDealerRecord(record));
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    try {
      await dealerApi.removeDealer(recordToDelete);
      await fetchDealers();
    } catch (error) {
      console.error("Error deleting dealer:", error);
      window.alert(error?.message || "Failed to delete dealer.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleSubmit = async (payload) => {
    const existingId = currentRecord?.id;
    if (existingId) await dealerApi.updateDealer(existingId, payload);
    else await dealerApi.createDealer(payload);
    await fetchDealers();
  };

  const canEdit = canEditCurrentMenu();
  const { buildStatusColumn, buildSelectColumn } = usePartyGridBulkStatus({
    canEdit,
    bulkUpdateStatus: dealerApi.bulkUpdateStatus,
    onRefresh: fetchDealers,
  });

  const columns = useMemo(() => {
    const allRowIds = records.map((row) => row.id ?? row.Id).filter((id) => id != null);
    const statusColumns = [buildSelectColumn(allRowIds), buildStatusColumn(allRowIds)].filter(
      Boolean
    );

    return [
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        width: "96px",
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "sno",
        Header: "S.No",
        accessor: "sno",
        align: "center",
        width: "48px",
        Cell: ({ value }) => renderCollectionsGridSno(value),
      },
      {
        id: "code",
        Header: "Code",
        accessor: "code",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "rank",
        Header: "Rank",
        accessor: "rank",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      ...statusColumns,
      {
        id: "name",
        Header: "Name",
        accessor: "name",
        align: "left",
        Cell: ({ row }) =>
          txt(formatDealerDisplayName(row?.original?.prefix, row?.original?.name) || "-"),
      },
      {
        id: "address",
        Header: "Address",
        accessor: "address",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "province",
        Header: "Province",
        accessor: "province",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "city",
        Header: "City",
        accessor: "city",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "ntnCnic",
        Header: "NTN / CNIC",
        accessor: "ntnCnic",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "gstNo",
        Header: "GST No",
        accessor: "gstNo",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "telNo",
        Header: "Tel No",
        accessor: "telNo",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "mobileNo",
        Header: "Mobile No",
        accessor: "mobileNo",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "representative",
        Header: "Representative",
        accessor: "representative",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "iban",
        Header: "IBAN",
        accessor: "iban",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
    ];
  }, [buildSelectColumn, buildStatusColumn, records]);

  const computedRows = useMemo(
    () =>
      records.map((record, index) => {
        const row = normalizeDealerRecord(record);
        return {
          ...row,
          sno: index + 1,
          province: getProvinceLabel(row.province),
          statusRaw: row.status,
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              {canEditCurrentMenu() && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(row.id)}
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
                  onClick={() => handleDeleteRecord(row.id)}
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
    [records]
  );

  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: records.length }),
    [records.length]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Dealers"
        subtitle="Manage dealer records"
        metadata={workspaceMetadata}
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={buildCollectionsGridTableBodySx({ leadingCompactColumnCount: 1 })}
      >
        {loading ? (
          <MDBox display="flex" justifyContent="center" alignItems="center" py={6}>
            <CurrencyLoading size={36} />
          </MDBox>
        ) : (
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
                defaultValue: 20,
                entries: [10, 25, 50, 100],
              }}
              pagination={{ variant: "gradient", color: "info" }}
              showTotalEntries={false}
              noEndBorder
              canSearch
              exportFileName="Dealers"
              contentFitTable
              paginationHost={paginationHost}
            />
          </MDBox>
        )}
      </EnterpriseWorkspace>

      <DealerForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this dealer?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={() => setDeleteDialogOpen(false)}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
