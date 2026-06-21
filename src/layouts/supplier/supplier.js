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
import supplierApi from "services/api.supplier.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import SupplierForm from "./SupplierForm";
import {
  buildSupplierPayload,
  flattenSupplierForGrid,
  getSupplierDuplicateWarnings,
  normalizeSupplierRecord,
  stripSupplierForClone,
} from "./supplierUtils";

function pickCoaField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function isSupplierControlAccount(controlAccount) {
  return /^supplier$/i.test(String(controlAccount || "").trim());
}

function getCoaLabel(row) {
  const acctId = pickCoaField(row, "acctId", "AcctId");
  const acctName = pickCoaField(row, "acctName", "AcctName");
  if (acctId && acctName) return `${acctId} - ${acctName}`;
  return acctId || acctName || "";
}

export default function Supplier() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [coaLabelById, setCoaLabelById] = useState({});
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [isClone, setIsClone] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const txt = (v) => (v != null && String(v).trim() !== "" ? String(v) : "-");

  const fetchCoaLabels = useCallback(async () => {
    try {
      const response = await chartOfAccountsApi.getAll(COA_SECTION_TYPE);
      const rows = chartOfAccountsApi.unwrapList(response) || [];
      const lookup = {};
      rows.forEach((row) => {
        const id = row?.id ?? row?.Id;
        if (id == null) return;
        if (!isSupplierControlAccount(pickCoaField(row, "controlAccount", "ControlAccount")))
          return;
        lookup[Number(id)] = getCoaLabel(row);
      });
      setCoaLabelById(lookup);
    } catch (error) {
      console.error("Error fetching supplier control accounts:", error);
      setCoaLabelById({});
    }
  }, []);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const response = await supplierApi.listSuppliers();
      const rows = supplierApi.unwrapList(response);
      setRecords(Array.isArray(rows) ? rows : []);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSuppliers();
    fetchCoaLabels();
  }, [fetchSuppliers, fetchCoaLabels]);

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
    setCurrentRecord(normalizeSupplierRecord(record));
    setIsClone(false);
    setOpenForm(true);
  };

  const handleCloneRecord = (id) => {
    const record = records.find((row) => Number(row.id ?? row.Id) === Number(id));
    if (!record) return;
    setCurrentRecord(stripSupplierForClone(record));
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
      await supplierApi.removeSupplier(recordToDelete);
      await fetchSuppliers();
    } catch (error) {
      console.error("Error deleting supplier:", error);
      window.alert(error?.message || "Failed to delete supplier.");
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
    const duplicateWarnings = getSupplierDuplicateWarnings(form, records, existingId);
    if (duplicateWarnings.length > 0) {
      window.alert(duplicateWarnings.join("\n"));
    }

    const payload = buildSupplierPayload(form);
    if (existingId) {
      await supplierApi.updateSupplier(existingId, payload);
    } else {
      await supplierApi.createSupplier(payload);
    }
    await fetchSuppliers();
    return { id: existingId };
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
        Cell: ({ value }) => (value != null && value !== "" ? value : "-"),
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
        const flat = flattenSupplierForGrid(record, index, coaLabelById);
        const recordId = flat.id;
        return {
          ...flat,
          actions: (
            <MDBox
              display="flex"
              alignItems="center"
              justifyContent="center"
              sx={{
                backgroundColor: "#f8f9fa",
                gap: "2px",
                padding: "2px",
                borderRadius: "2px",
              }}
            >
              {canCreateCurrentMenu() && (
                <IconButton
                  size="small"
                  color="success"
                  onClick={() => handleCloneRecord(recordId)}
                  title="Clone"
                  sx={{ padding: "1px" }}
                >
                  <Icon>content_copy</Icon>
                </IconButton>
              )}
              {canEditCurrentMenu() && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(recordId)}
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
                  onClick={() => handleDeleteRecord(recordId)}
                  title="Delete"
                  sx={{ padding: "1px" }}
                >
                  <Icon>delete</Icon>
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
        title="Supplier"
        subtitle="Manage supplier records"
        metadata={workspaceMetadata}
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          "& .MuiTableContainer-root": {
            flex: "1 1 0",
            minHeight: 0,
            overflow: "auto",
          },
          "& .MuiTable-root": {
            tableLayout: "auto",
            width: "max-content",
            borderCollapse: "collapse",
          },
          "& .MuiTable-root th": {
            fontSize: "0.875rem !important",
            fontWeight: "700 !important",
            padding: "1px 4px !important",
            borderBottom: "1px solid #d0d0d0",
            whiteSpace: "nowrap",
          },
          "& .MuiTable-root td": {
            padding: "1px 4px !important",
            borderBottom: "1px solid #e0e0e0",
            whiteSpace: "nowrap",
          },
        }}
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
            exportFileName="Supplier"
            contentFitTable
            disableHeaderMetrics
          />
        )}
      </EnterpriseWorkspace>

      <SupplierForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        isClone={isClone}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this supplier?</MDTypography>
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
