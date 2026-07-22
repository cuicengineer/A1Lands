import { useCallback, useEffect, useState, useMemo } from "react";

// @mui material components
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import FormControl from "@mui/material/FormControl";
import FormHelperText from "@mui/material/FormHelperText";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import SearchableSelect from "components/SearchableSelect";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import ConfigurationModuleTabs from "layouts/configuration/components/ConfigurationModuleTabs";
import DataTable from "examples/Tables/DataTable";

import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import StatusBadge from "components/StatusBadge";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { ServerGridPagination } from "components/CompactGridPagination";
import { useMaterialUIController } from "context";

function BanksList() {
  const [controller] = useMaterialUIController();
  const { darkMode } = controller;
  const statusOptions = [
    { value: true, label: "Active" },
    { value: false, label: "Inactive" },
  ];
  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();

  const [tableRows, setTableRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [newErrors, setNewErrors] = useState({});

  const fetchBanks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.requestRaw("GET", "/api/BankLists");
      const contentType = res.headers.get("content-type");
      const payload =
        contentType && contentType.includes("application/json") ? await res.json() : [];
      const data = Array.isArray(payload) ? payload : payload?.data ?? [];

      // Normalize status: convert byte (0/1) to boolean for UI
      const normalizedData = Array.isArray(data)
        ? data.map((item) => ({
            ...item,
            status: item.status === 1 || item.status === true,
          }))
        : [];

      setTableRows(normalizedData);
      setTotalCount(normalizedData.length);
    } catch (error) {
      console.error("Error fetching banks:", error);
      setTableRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanks();
  }, [fetchBanks]);

  const handleAddBank = () => {
    if (!canCreate) return;
    if (editingRowId) return;
    setEditingRowId("__new__");
    setNewErrors({});
    setNewRowDraft({
      id: tableRows.length > 0 ? Math.max(...tableRows.map((r) => r.id)) + 1 : 1,
      name: "",
      code: "",
      address: "",
      status: statusOptions[0].value,
    });
  };

  const handleEditBank = (id) => {
    if (!canEdit) return;
    if (editingRowId) return;
    const row = tableRows.find((r) => r.id === id);
    if (!row) return;
    setEditingRowId(id);
    setEditDraft({ ...row });
  };

  const handleChange = (field, value) => {
    if (editingRowId === "__new__") {
      setNewRowDraft((draft) => ({ ...draft, [field]: value }));
      if (newErrors?.[field]) setNewErrors((prev) => ({ ...prev, [field]: undefined }));
    } else if (editingRowId) {
      setEditDraft((draft) => ({ ...draft, [field]: value }));
    }
  };

  const isEmpty = (val) => {
    if (val === null || val === undefined) return true;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "string") return val.trim().length === 0;
    return false;
  };

  const validateNewRow = () => {
    const next = {};
    const required = [
      { key: "name", label: "Name" },
      { key: "code", label: "Code" },
    ];
    required.forEach(({ key, label }) => {
      if (isEmpty(newRowDraft?.[key])) next[key] = `${label} is required`;
    });
    setNewErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = async () => {
    if (editingRowId === "__new__" && !canCreate) return;
    if (editingRowId && editingRowId !== "__new__" && !canEdit) return;
    if (editingRowId === "__new__" && newRowDraft) {
      // Mandatory validation only for Create New (as requested)
      const ok = validateNewRow();
      if (!ok) return;
      try {
        const { id, ...createPayload } = newRowDraft;
        // Convert boolean status to byte (0 or 1) as API expects System.Nullable`1[System.Byte]
        const payload = {
          name: createPayload.name?.trim() || "",
          code: createPayload.code?.trim() || "",
          address: createPayload.address?.trim() || "",
          status: createPayload.status === true || createPayload.status === 1 ? 1 : 0,
        };
        console.log("Creating BankList with payload:", payload);
        await api.create("BankLists", payload);
        fetchBanks();
        setEditingRowId(null);
        setNewRowDraft(null);
      } catch (error) {
        console.error("Error creating bank:", error);
        alert("Failed to create bank. Please try again.");
      }
    } else if (editingRowId && editDraft) {
      if (!editDraft.name) {
        alert("Name is mandatory.");
        return;
      }
      try {
        // Convert boolean status to byte (0 or 1) as API expects System.Nullable`1[System.Byte]
        const payload = {
          name: editDraft.name?.trim() || "",
          code: editDraft.code?.trim() || "",
          address: editDraft.address?.trim() || "",
          status: editDraft.status === true || editDraft.status === 1 ? 1 : 0,
        };
        console.log("Updating BankList with payload:", payload);
        await api.update("BankLists", editingRowId, payload);
        fetchBanks();
        setEditingRowId(null);
        setEditDraft(null);
      } catch (error) {
        console.error("Error updating bank:", error);
        alert("Failed to update bank. Please try again.");
      }
    }
  };

  const handleCancel = () => {
    setEditingRowId(null);
    setNewRowDraft(null);
    setEditDraft(null);
    setNewErrors({});
  };

  const handleDeleteBank = (id) => {
    if (!canDelete) return;
    if (editingRowId) return;
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!canDelete) return;
    if (!recordToDelete) return;
    try {
      await api.remove("BankLists", recordToDelete);
      fetchBanks();
    } catch (error) {
      console.error("Error deleting bank:", error);
      alert("Failed to delete bank. Please try again.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "8%" },
    { Header: "S.No", accessor: "sno", align: "center", width: "6%" },
    { Header: "Name", accessor: "name", align: "left", width: "18%" },
    { Header: "Code", accessor: "code", align: "left", width: "10%" },
    { Header: "Address", accessor: "address", align: "left", width: "24%" },
    { Header: "Status", accessor: "status", align: "center", width: "8%" },
  ];

  const renderInput = (field, value, type = "text", mandatory = false) => (
    <MDInput
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      type={type}
      required={mandatory}
      error={Boolean(newErrors[field])}
      helperText={newErrors[field]}
      multiline={field === "address"}
      rows={field === "address" ? 2 : 1}
      sx={
        darkMode
          ? {
              "& .MuiInputBase-input": {
                color: "#000000 !important",
              },
              "& .MuiInputLabel-root": {
                color: "#000000 !important",
              },
              "& .MuiFormHelperText-root": {
                color: "#000000 !important",
              },
            }
          : {}
      }
    />
  );

  const renderStatusSelect = (value, mandatory = false) => (
    <FormControl size="small" fullWidth required={mandatory} error={Boolean(newErrors.status)}>
      <InputLabel id="bank-status-label" sx={darkMode ? { color: "#000000 !important" } : {}}>
        Status
      </InputLabel>
      <SearchableSelect
        labelId="bank-status-label"
        value={value}
        label="Status"
        onChange={(e) => handleChange("status", e.target.value)}
        sx={
          darkMode
            ? {
                "& .MuiSelect-select": {
                  color: "#000000 !important",
                },
                "& .MuiSvgIcon-root": {
                  color: "#000000 !important",
                },
              }
            : {}
        }
      >
        {statusOptions.map((opt) => (
          <MenuItem key={String(opt.value)} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </SearchableSelect>
      {newErrors.status && (
        <FormHelperText sx={darkMode ? { color: "#000000 !important" } : {}}>
          {newErrors.status}
        </FormHelperText>
      )}
    </FormControl>
  );

  const computedRows = useMemo(() => {
    const filteredRows = tableRows.filter((row) =>
      Object.values(row || {}).some(
        (value) =>
          value !== null &&
          value !== undefined &&
          String(value).toLowerCase().includes(searchQuery.toLowerCase())
      )
    );

    const rows = [];
    if (editingRowId === "__new__" && newRowDraft) {
      rows.push({
        id: newRowDraft.id,
        sno: "New",
        name: renderInput("name", newRowDraft.name, "text", true),
        code: renderInput("code", newRowDraft.code, "text", true),
        address: renderInput("address", newRowDraft.address, "text", false),
        status: renderStatusSelect(newRowDraft.status, false),
        actions: (
          <MDBox display="flex" gap={1}>
            <IconButton size="small" color="success" onClick={handleSave} title="Save">
              <Icon>check</Icon>
            </IconButton>
            <IconButton size="small" color="error" onClick={handleCancel} title="Cancel">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        ),
      });
    }

    filteredRows.forEach((r, index) => {
      const isEditing = editingRowId === r.id;
      const draft = isEditing ? editDraft : r;
      rows.push({
        id: r.id,
        sno: index + 1,
        name: isEditing ? (
          renderInput("name", draft.name, "text", true)
        ) : (
          <MDBox
            component="span"
            sx={{
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {r.name}
          </MDBox>
        ),
        code: isEditing ? (
          renderInput("code", draft.code, "text", true)
        ) : (
          <MDBox
            component="span"
            sx={{
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {r.code}
          </MDBox>
        ),
        address: isEditing ? (
          renderInput("address", draft.address, "text", false)
        ) : (
          <MDBox
            component="span"
            sx={{
              display: "block",
              whiteSpace: "normal",
              wordBreak: "break-word",
              overflowWrap: "anywhere",
              maxWidth: "100%",
            }}
          >
            {r.address || "-"}
          </MDBox>
        ),
        status: isEditing ? (
          renderStatusSelect(draft.status)
        ) : (
          <StatusBadge value={r.status} inactiveLabel="Inactive" inactiveColor="error" />
        ),
        actions: isEditing ? (
          <MDBox display="flex" gap={1}>
            <IconButton size="small" color="success" onClick={handleSave} title="Save">
              <Icon>check</Icon>
            </IconButton>
            <IconButton size="small" color="error" onClick={handleCancel} title="Cancel">
              <Icon>close</Icon>
            </IconButton>
          </MDBox>
        ) : (
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
            <IconButton
              size="small"
              color="info"
              onClick={() => handleEditBank(r.id)}
              title="Edit"
              sx={{ padding: "1px" }}
              disabled={!canEdit}
            >
              <Icon>edit</Icon>
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteBank(r.id)}
              title="Delete"
              sx={{ padding: "1px" }}
              disabled={!canDelete}
            >
              <Icon>delete</Icon>
            </IconButton>
          </MDBox>
        ),
      });
    });

    return rows;
  }, [tableRows, searchQuery, editingRowId, editDraft, newRowDraft]);

  // Memoize the table object to prevent DataTable from resetting pagination
  const tableData = useMemo(() => ({ columns, rows: computedRows }), [columns, computedRows]);

  const displayTotal = totalCount > 0 ? totalCount : tableRows.length;

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
        title="Banks List"
        subtitle="Manage bank configuration"
        tabs={<ConfigurationModuleTabs />}
        actions={
          canCreate ? (
            <MDButton variant="outlined" color="dark" onClick={handleAddBank}>
              Add Bank
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
            overflow: "hidden",
          },
          overflowX: "auto",
          "& .MuiTable-root": {
            tableLayout: "fixed",
            width: "100%",
          },
          "& .MuiTableCell-root": {
            whiteSpace: "normal !important",
            wordBreak: "break-word !important",
            overflowWrap: "anywhere !important",
            lineHeight: 1.4,
            maxWidth: "100%",
            verticalAlign: "top",
          },
          "& .MuiTableCell-root *": {
            whiteSpace: "normal !important",
            wordBreak: "break-word !important",
            overflowWrap: "anywhere !important",
            maxWidth: "100%",
          },
          "& .MuiTable-root th": {
            fontSize: "10px !important",
            fontWeight: "700 !important",
            padding: "12px 10px !important",
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            borderBottom: "1px solid #d0d0d0",
          },
          "& .MuiTable-root td": {
            padding: "10px 10px !important",
            whiteSpace: "normal",
            wordBreak: "break-word",
            overflowWrap: "anywhere",
            hyphens: "auto",
            maxWidth: "100%",
            borderBottom: "1px solid #e0e0e0",
          },
        }}
      >
        <DataTable
          table={tableData}
          isSorted={false}
          stickyToolbarAndHeader
          canSearch={true}
          page={pageNumber - 1}
          entriesPerPage={{
            defaultValue: 20,
            entries: [10, 25, 50, 100],
          }}
          pageSize={pageSize}
          onPageChange={(page) => {
            setPageNumber(page + 1);
          }}
          onEntriesPerPageChange={(value) => {
            setPageSize(value);
            setPageNumber(1);
          }}
          showTotalEntries
          exportFileName="Banks-List"
          noEndBorder
          paginationFooter={serverPaginationFooter}
        />
        <WorkspaceLoadingOverlay active={loading} />
      </EnterpriseWorkspace>
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1" sx={{ fontSize: "1.1rem" }}>
            Are you sure you want to delete this bank? This action cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary" variant="outlined">
            <Icon>close</Icon>&nbsp;Cancel
          </MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" variant="gradient">
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

export default BanksList;
