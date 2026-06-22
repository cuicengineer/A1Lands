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
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import customerApi from "services/api.customer.service";
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
import CustomerForm from "./CustomerForm";
import {
  buildCustomerPayload,
  flattenCustomerForGrid,
  getCustomerCoaDropdownLabel,
  getCustomerDuplicateWarnings,
  isCustomersControlAccount,
  normalizeCustomerCoaOption,
  normalizeCustomerRecord,
  pickCoaField,
  stripCustomerForClone,
} from "./customerUtils";

export default function Customer() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coaLabelById, setCoaLabelById] = useState({});
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [isClone, setIsClone] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const txt = (v) => renderCollectionsGridText(v);

  const fetchCoaLabels = useCallback(async () => {
    try {
      const response = await chartOfAccountsApi.getAll(COA_SECTION_TYPE);
      const rows = chartOfAccountsApi.unwrapList(response) || [];
      const lookup = {};
      rows.forEach((row) => {
        const id = row?.id ?? row?.Id;
        if (id == null) return;
        if (!isCustomersControlAccount(pickCoaField(row, "controlAccount", "ControlAccount")))
          return;
        lookup[Number(id)] = getCustomerCoaDropdownLabel(normalizeCustomerCoaOption(row));
      });
      setCoaLabelById(lookup);
    } catch (error) {
      console.error("Error fetching customer control accounts:", error);
      setCoaLabelById({});
    }
  }, []);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await customerApi.listCustomers();
      const rows = customerApi.unwrapList(response);
      setRecords(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Error fetching customers:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
    fetchCoaLabels();
  }, [fetchCustomers, fetchCoaLabels]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setIsClone(false);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
    setIsClone(false);
  };

  const handleEditRecord = (id) => {
    const record = records.find((row) => Number(row.id ?? row.Id) === Number(id));
    if (!record) return;
    setCurrentRecord(normalizeCustomerRecord(record));
    setIsClone(false);
    setOpenForm(true);
  };

  const handleCloneRecord = (id) => {
    const record = records.find((row) => Number(row.id ?? row.Id) === Number(id));
    if (!record) return;
    setCurrentRecord(stripCustomerForClone(record));
    setIsClone(true);
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    try {
      await customerApi.removeCustomer(recordToDelete);
      await fetchCustomers();
    } catch (error) {
      console.error("Error deleting customer:", error);
      window.alert(error?.message || "Failed to delete customer.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleSubmit = async (form) => {
    const existingId = !isClone ? currentRecord?.id : null;
    const duplicateWarnings = getCustomerDuplicateWarnings(form, records, existingId);
    if (duplicateWarnings.length > 0) {
      window.alert(duplicateWarnings.join("\n"));
    }

    const payload = buildCustomerPayload(form);
    if (existingId) {
      await customerApi.updateCustomer(existingId, payload);
    } else {
      await customerApi.createCustomer(payload);
    }
    await fetchCustomers();
    return { id: existingId };
  };

  const columns = useMemo(
    () => [
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
        id: "prefix",
        Header: "Prefix",
        accessor: "prefix",
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
      {
        id: "name",
        Header: "Name",
        accessor: "name",
        align: "left",
        Cell: ({ value }) => txt(value),
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
        id: "controlAccount",
        Header: "Control Account",
        accessor: "controlAccount",
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
    ],
    []
  );

  const computedRows = useMemo(
    () =>
      records.map((record, index) => {
        const flat = flattenCustomerForGrid(record, index, coaLabelById);
        const recordId = flat.id;
        return {
          ...flat,
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              {canCreateCurrentMenu() && (
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleCloneRecord(recordId)}
                  title="Clone"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">content_copy</Icon>
                </IconButton>
              )}
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
    [records, coaLabelById]
  );

  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: records.length }),
    [records.length]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Customer"
        subtitle="Manage customer records"
        metadata={workspaceMetadata}
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
          <DataTable
            table={{ columns, rows: computedRows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={{
              defaultValue: 20,
              entries: [10, 25, 50, 100],
            }}
            pagination={{ variant: "gradient", color: "info" }}
            showTotalEntries
            noEndBorder
            canSearch
            exportFileName="Customer"
            contentFitTable
            disableHeaderMetrics
          />
        )}
      </EnterpriseWorkspace>

      <CustomerForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        isClone={isClone}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this customer?</MDTypography>
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
