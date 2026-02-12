import { useEffect, useState, useMemo } from "react";

// @mui material components
import Card from "@mui/material/Card";
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
import Select from "@mui/material/Select";

// Material Dashboard 2 React components
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";

// Material Dashboard 2 React example components
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";

import api from "services/api.service";
import StatusBadge from "components/StatusBadge";
import CurrencyLoading from "components/CurrencyLoading";

function BanksList() {
  const statusOptions = [
    { value: true, label: "Active" },
    { value: false, label: "Inactive" },
  ];

  const [tableRows, setTableRows] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingRowId, setEditingRowId] = useState(null);
  const [newRowDraft, setNewRowDraft] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [newErrors, setNewErrors] = useState({});

  useEffect(() => {
    fetchBanks(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  const fetchBanks = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        pageNumber: page.toString(),
        pageSize: size.toString(),
      }).toString();
      const response = await api.request("GET", `/api/BankLists?${params}`);
      const data = response?.data ?? (Array.isArray(response) ? response : []);
      const pagination = response?.pagination;

      // Normalize status: convert byte (0/1) to boolean for UI
      const normalizedData = Array.isArray(data)
        ? data.map((item) => ({
            ...item,
            status: item.status === 1 || item.status === true,
          }))
        : [];

      setTableRows(normalizedData);
      setTotalCount(Number(pagination?.totalCount || 0));
    } catch (error) {
      console.error("Error fetching banks:", error);
      setTableRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBank = () => {
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
        fetchBanks(pageNumber, pageSize);
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
        fetchBanks(pageNumber, pageSize);
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
    if (editingRowId) return;
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await api.remove("BankLists", recordToDelete);
      fetchBanks(pageNumber, pageSize);
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
    { Header: "Sno", accessor: "sno", align: "center", width: "6%" },
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
    />
  );

  const renderStatusSelect = (value, mandatory = false) => (
    <FormControl size="small" fullWidth required={mandatory} error={Boolean(newErrors.status)}>
      <InputLabel id="bank-status-label">Status</InputLabel>
      <Select
        labelId="bank-status-label"
        value={value}
        label="Status"
        onChange={(e) => handleChange("status", e.target.value)}
      >
        {statusOptions.map((opt) => (
          <MenuItem key={String(opt.value)} value={opt.value}>
            {opt.label}
          </MenuItem>
        ))}
      </Select>
      {newErrors.status && <FormHelperText>{newErrors.status}</FormHelperText>}
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
        sno: (pageNumber - 1) * pageSize + index + 1,
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
            >
              <Icon>edit</Icon>
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={() => handleDeleteBank(r.id)}
              title="Delete"
              sx={{ padding: "1px" }}
            >
              <Icon>delete</Icon>
            </IconButton>
          </MDBox>
        ),
      });
    });

    return rows;
  }, [tableRows, searchQuery, editingRowId, editDraft, newRowDraft, pageNumber, pageSize]);

  // Memoize the table object to prevent DataTable from resetting pagination
  const tableData = useMemo(() => ({ columns, rows: computedRows }), [columns, computedRows]);

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Card>
          <MDBox
            mx={2}
            mt={-3}
            py={3}
            px={2}
            variant="gradient"
            bgColor="info"
            borderRadius="lg"
            coloredShadow="info"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
          >
            <MDTypography variant="h6" color="white">
              Banks List
            </MDTypography>
            <MDBox display="flex" alignItems="center" gap={2}>
              <MDButton variant="gradient" color="info" onClick={handleAddBank}>
                Add Bank
              </MDButton>
            </MDBox>
          </MDBox>
          <MDBox pt={3} position="relative">
            {loading && (
              <MDBox
                position="absolute"
                top={0}
                left={0}
                right={0}
                bottom={0}
                display="flex"
                justifyContent="center"
                alignItems="center"
                zIndex={10}
                sx={{
                  backgroundColor: "rgba(255, 255, 255, 0.8)",
                  backdropFilter: "blur(2px)",
                }}
              >
                <CurrencyLoading size={50} />
              </MDBox>
            )}
            <MDBox
              sx={{
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
                  fontSize: "12px !important",
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
                canSearch={true}
                page={pageNumber - 1}
                entriesPerPage={{
                  defaultValue: pageSize,
                  entries: [10, 25, 50, 100],
                }}
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
              />
            </MDBox>
          </MDBox>
        </Card>
      </MDBox>
      <Footer />
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
