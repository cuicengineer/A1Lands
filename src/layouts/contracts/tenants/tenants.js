import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import IconButton from "@mui/material/IconButton";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import PropTypes from "prop-types";
import StatusBadge from "components/StatusBadge";
import { format, parseISO, isValid } from "date-fns";

function TenantsForm({ open, onClose, onSubmit, initialData }) {
  const isAddMode = !initialData;
  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const [form, setForm] = useState({
    tenantNo: "",
    ownerName: "",
    prefix: "",
    businessName: "",
    address: "",
    province: "",
    city: "",
    telephoneNo: "",
    cellNo: "",
    ntnNo: "",
    gstNo: "",
    status: true,
    remarks: "",
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    setErrors({});
    if (initialData) {
      setForm({
        tenantNo: initialData.tenantNo || "",
        ownerName: initialData.ownerName || "",
        prefix: initialData.prefix || "",
        businessName: initialData.businessName || "",
        address: initialData.address || "",
        province: initialData.province || "",
        city: initialData.city || "",
        telephoneNo: initialData.telephoneNo || "",
        cellNo: initialData.cellNo || "",
        ntnNo: initialData.ntnNo || "",
        gstNo: initialData.gstNo || "",
        status: initialData.status !== undefined ? initialData.status : true,
        remarks: initialData.remarks || "",
      });
    } else {
      setForm({
        tenantNo: "",
        ownerName: "",
        prefix: "",
        businessName: "",
        address: "",
        province: "",
        city: "",
        telephoneNo: "",
        cellNo: "",
        ntnNo: "",
        gstNo: "",
        status: true,
        remarks: "",
      });
    }
  }, [initialData, open]);

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: field === "status" ? Boolean(value) : value,
    }));
    if (errors?.[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const isEmpty = (val) => {
    if (val === null || val === undefined) return true;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "string") return val.trim().length === 0;
    return false;
  };

  const validateAddNew = () => {
    const next = {};
    const required = [
      { key: "tenantNo", label: "Tenant No" },
      { key: "ownerName", label: "Particular Name" },
      { key: "prefix", label: "Prefix" },
      { key: "address", label: "Address" },
      { key: "province", label: "Province" },
      { key: "city", label: "City" },
      { key: "telephoneNo", label: "Telephone No" },
      { key: "cellNo", label: "Cell No" },
      { key: "ntnNo", label: "NTN No" },
      { key: "gstNo", label: "GST No" },
      { key: "remarks", label: "Remarks" },
    ];
    required.forEach(({ key, label }) => {
      if (isEmpty(form?.[key])) next[key] = `${label} is required`;
    });
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSave = () => {
    // Mandatory validation only for Create New (as requested)
    if (isAddMode) {
      const ok = validateAddNew();
      if (!ok) return;
    }
    onSubmit(form);
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle
        component="div"
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 2,
          fontSize: "1.25rem",
          fontWeight: 600,
        }}
      >
        {initialData ? "Edit Tenant" : "New Tenant"}
        <MDInput
          label="Tenant No"
          type="text"
          value={form.tenantNo}
          onChange={(e) => handleChange("tenantNo", e.target.value)}
          size="small"
          required={isAddMode}
          error={Boolean(errors.tenantNo)}
          helperText={errors.tenantNo}
          sx={{
            flex: "1 1 240px",
            maxWidth: 400,
            "& .MuiInputBase-input": {
              fontSize: "1.1rem",
              padding: "12px 14px",
            },
            "& .MuiInputLabel-root": {
              fontSize: "1.1rem",
            },
          }}
        />
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} mt={1}>
          {/* Prefix first, then Owner Name */}
          <Grid item xs={12} sm={2}>
            <FormControl fullWidth size="small" required={isAddMode} error={Boolean(errors.prefix)}>
              <InputLabel>Prefix</InputLabel>
              <Select
                value={form.prefix}
                label="Prefix"
                sx={{
                  "& .MuiInputBase-input": {
                    fontSize: "1.1rem",
                    padding: "12px 14px",
                  },
                  "& .MuiInputLabel-root": {
                    fontSize: "1.1rem",
                  },
                }}
                onChange={(e) => handleChange("prefix", e.target.value)}
              >
                <MenuItem value="">Select</MenuItem>
                <MenuItem value="Mr">Mr</MenuItem>
                <MenuItem value="Mrs">Mrs</MenuItem>
                <MenuItem value="Miss">Miss</MenuItem>
                <MenuItem value="M/S">M/S</MenuItem>
              </Select>
              {errors.prefix && <FormHelperText>{errors.prefix}</FormHelperText>}
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={10}>
            <MDInput
              label="Particular Name"
              type="text"
              value={form.ownerName}
              onChange={(e) => handleChange("ownerName", e.target.value)}
              fullWidth
              size="small"
              required={isAddMode}
              error={Boolean(errors.ownerName)}
              helperText={errors.ownerName}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* Address */}
          <Grid item xs={12}>
            <MDInput
              label="Address"
              type="text"
              value={form.address}
              onChange={(e) => handleChange("address", e.target.value)}
              fullWidth
              size="small"
              required={isAddMode}
              error={Boolean(errors.address)}
              helperText={errors.address}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* Province */}
          <Grid item xs={12} sm={6}>
            <FormControl
              fullWidth
              size="small"
              required={isAddMode}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
              error={Boolean(errors.province)}
            >
              <InputLabel>Province</InputLabel>
              <Select
                value={form.province}
                label="Province"
                onChange={(e) => handleChange("province", e.target.value)}
              >
                <MenuItem value="">Select</MenuItem>
                <MenuItem value="Capital">Federal</MenuItem>
                <MenuItem value="Punjab">Punjab</MenuItem>
                <MenuItem value="Sindh">Sindh</MenuItem>
                <MenuItem value="KPK">KPK</MenuItem>
                <MenuItem value="Balochistan">Balochistan</MenuItem>
                <MenuItem value="GB">GB</MenuItem>
                <MenuItem value="AJK">AJK</MenuItem>
              </Select>
              {errors.province && <FormHelperText>{errors.province}</FormHelperText>}
            </FormControl>
          </Grid>

          {/* City */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="City"
              type="text"
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
              fullWidth
              size="small"
              required={isAddMode}
              error={Boolean(errors.city)}
              helperText={errors.city}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* TelephoneNo */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Telephone No"
              type="text"
              value={form.telephoneNo}
              onChange={(e) => handleChange("telephoneNo", e.target.value)}
              fullWidth
              size="small"
              required={isAddMode}
              error={Boolean(errors.telephoneNo)}
              helperText={errors.telephoneNo}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* CellNo */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Cell No"
              type="text"
              value={form.cellNo}
              onChange={(e) => handleChange("cellNo", e.target.value)}
              fullWidth
              size="small"
              required={isAddMode}
              error={Boolean(errors.cellNo)}
              helperText={errors.cellNo}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* NTNNo */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="NTN No"
              type="text"
              value={form.ntnNo}
              onChange={(e) => handleChange("ntnNo", e.target.value)}
              fullWidth
              size="small"
              required={isAddMode}
              error={Boolean(errors.ntnNo)}
              helperText={errors.ntnNo}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* GSTNo */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="GST No"
              type="text"
              value={form.gstNo}
              onChange={(e) => handleChange("gstNo", e.target.value)}
              fullWidth
              size="small"
              required={isAddMode}
              error={Boolean(errors.gstNo)}
              helperText={errors.gstNo}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* Status and Business Name */}
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth required={isAddMode} error={Boolean(errors.status)}>
              <InputLabel id="status-label" sx={{ fontSize: "1.1rem" }}>
                Status
              </InputLabel>
              <Select
                labelId="status-label"
                value={form.status !== undefined ? form.status : true}
                label="Status"
                onChange={(e) => handleChange("status", e.target.value)}
                MenuProps={{
                  PaperProps: {
                    style: {
                      maxHeight: 300,
                    },
                  },
                }}
                sx={{
                  fontSize: "1.1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1.1rem",
                    padding: "12px 32px 12px 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "10px",
                  },
                }}
              >
                <MenuItem value={true} sx={{ fontSize: "1.1rem", padding: "10px 14px" }}>
                  Active
                </MenuItem>
                <MenuItem value={false} sx={{ fontSize: "1.1rem", padding: "10px 14px" }}>
                  Inactive
                </MenuItem>
              </Select>
              {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Business"
              type="text"
              value={form.businessName}
              onChange={(e) => handleChange("businessName", e.target.value)}
              fullWidth
              size="small"
              error={Boolean(errors.businessName)}
              helperText={errors.businessName}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>

          {/* Remarks */}
          <Grid item xs={12}>
            <MDInput
              label="Remarks"
              type="text"
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              fullWidth
              size="small"
              multiline
              rows={3}
              required={isAddMode}
              error={Boolean(errors.remarks)}
              helperText={errors.remarks}
              sx={{
                "& .MuiInputBase-input": {
                  fontSize: "1.1rem",
                  padding: "12px 14px",
                },
                "& .MuiInputLabel-root": {
                  fontSize: "1.1rem",
                },
              }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          disabled={isAddMode ? !canCreate : !canEdit}
        >
          <Icon>save</Icon>&nbsp;Save
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

TenantsForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
};

export default function Tenants() {
  const canCreate = canCreateCurrentMenu();
  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();
  const [openForm, setOpenForm] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [rows, setRows] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [contactViewDialog, setContactViewDialog] = useState(false);
  const [contactData, setContactData] = useState({ type: "", value: "" });
  const [contractsDialogOpen, setContractsDialogOpen] = useState(false);
  const [contractsDialogLoading, setContractsDialogLoading] = useState(false);
  const [tenantContracts, setTenantContracts] = useState([]);
  const [selectedTenantNo, setSelectedTenantNo] = useState("");

  const fetchTenants = async () => {
    try {
      const response = await api.list("tenant");
      setRows(response);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  useEffect(() => {
    fetchTenants();
  }, []);

  const handleOpenForm = () => {
    if (!canCreate) return;
    setCurrentTenant(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditTenant = (id) => {
    if (!canEdit) return;
    const tenant = rows.find((row) => row.id === id);
    setCurrentTenant({
      ...tenant,
      tenantNo: tenant.tenantNo || "",
      ownerName: tenant.ownerName || "",
      prefix: tenant.prefix || "",
      businessName: tenant.businessName || "",
      address: tenant.address || "",
      province: tenant.province || "",
      city: tenant.city || "",
      telephoneNo: tenant.telephoneNo || "",
      cellNo: tenant.cellNo || "",
      ntnNo: tenant.ntnNo || "",
      gstNo: tenant.gstNo || "",
      status: tenant.status !== undefined ? tenant.status : true,
      remarks: tenant.remarks || "",
    });
    setOpenForm(true);
  };

  const handleDeleteTenant = (id) => {
    if (!canDelete) return;
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!canDelete) return;
    if (!recordToDelete) return;

    try {
      await api.remove("tenant", recordToDelete);
      fetchTenants();
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting tenant:", error);
      alert("Failed to delete tenant. Please try again.");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleViewContact = (type, value) => {
    setContactData({ type, value: value || "N/A" });
    setContactViewDialog(true);
  };

  const handleCloseContactDialog = () => {
    setContactViewDialog(false);
    setContactData({ type: "", value: "" });
  };

  const handleOpenContractsDialog = async (tenantNo) => {
    const normalizedTenantNo = String(tenantNo || "").trim();
    if (!normalizedTenantNo) return;
    setSelectedTenantNo(normalizedTenantNo);
    setContractsDialogOpen(true);
    setContractsDialogLoading(true);
    try {
      const response = await api.request(
        "GET",
        `/api/contracts/by-tenant/${encodeURIComponent(normalizedTenantNo)}`
      );
      const contracts = response?.data || (Array.isArray(response) ? response : []);
      setTenantContracts(Array.isArray(contracts) ? contracts : []);
    } catch (error) {
      console.error("Error fetching contracts by tenant no:", error);
      setTenantContracts([]);
      alert("Failed to fetch contracts. Please try again.");
    } finally {
      setContractsDialogLoading(false);
    }
  };

  const handleCloseContractsDialog = () => {
    setContractsDialogOpen(false);
    setTenantContracts([]);
    setSelectedTenantNo("");
  };

  const handleSubmit = async (data) => {
    try {
      const formattedData = {
        tenantNo: data.tenantNo || "",
        ownerName: data.ownerName || "",
        prefix: data.prefix || null,
        businessName: data.businessName || null,
        address: data.address || null,
        province: data.province || null,
        city: data.city || null,
        telephoneNo: data.telephoneNo || null,
        cellNo: data.cellNo || null,
        ntnNo: data.ntnNo || null,
        gstNo: data.gstNo || null,
        status: data.status !== undefined ? Boolean(data.status) : true,
        remarks: data.remarks || null,
      };
      if (currentTenant) {
        if (!canEdit) return;
        await api.update("tenant", currentTenant.id, formattedData);
      } else {
        if (!canCreate) return;
        await api.create("tenant", formattedData);
      }
      fetchTenants();
      handleCloseForm();
    } catch (error) {
      console.error("Error saving tenant:", error);
      const rawErrorText = [
        error?.response?.data,
        error?.response?.data?.message,
        error?.response?.data?.title,
        error?.message,
      ]
        .map((part) => (typeof part === "string" ? part : ""))
        .join(" ")
        .trim();
      if (/Cannot insert duplicate key in object\s+'dbo\.Tenants'/i.test(rawErrorText)) {
        alert(rawErrorText || "Duplicate tenant found. Please use a unique tenant number.");
      }
    }
  };

  // Status cell renderer with PropTypes
  const StatusCell = ({ value }) => <StatusBadge value={value} />;
  StatusCell.propTypes = {
    value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string]),
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "72px" },
    { Header: "ID", accessor: "id", align: "center", width: "56px" },
    { Header: "Tenant No", accessor: "tenantNo", align: "left" },
    { Header: "Prefix", accessor: "prefix", align: "left" },
    { Header: "Business", accessor: "businessName", align: "left" },
    { Header: "Particular Name", accessor: "ownerName", align: "left" },
    { Header: "Address", accessor: "address", align: "left" },
    { Header: "Province", accessor: "province", align: "left" },
    { Header: "City", accessor: "city", align: "left" },
    {
      Header: "Telephone No",
      accessor: "telephoneNo",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDButton
          size="small"
          variant="text"
          color="info"
          onClick={() => handleViewContact("Telephone No", value)}
          sx={{ minWidth: "auto", p: 0.5 }}
        >
          <Icon>visibility</Icon>
        </MDButton>
      ),
    },
    {
      Header: "Cell No",
      accessor: "cellNo",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDButton
          size="small"
          variant="text"
          color="info"
          onClick={() => handleViewContact("Cell No", value)}
          sx={{ minWidth: "auto", p: 0.5 }}
        >
          <Icon>visibility</Icon>
        </MDButton>
      ),
    },
    { Header: "NTN No", accessor: "ntnNo", align: "left" },
    { Header: "GST No", accessor: "gstNo", align: "left" },
    {
      Header: "Total Contracts",
      accessor: "totalContracts",
      align: "left",
      Cell: (cell) => (
        <MDButton
          size="large"
          variant="text"
          color="info"
          onClick={() => handleOpenContractsDialog(cell?.row?.original?.tenantNo)}
          sx={{ minWidth: "auto", p: 0.5, textDecoration: "underline" }}
        >
          {cell?.value ?? 0}
        </MDButton>
      ),
    },
    {
      Header: "Total Invoices",
      accessor: "totalInvoices",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (
        <MDButton
          size="large"
          variant="text"
          color="info"
          onClick={() => {}}
          sx={{ minWidth: "auto", p: 0.5, textDecoration: "underline" }}
        >
          {value ?? 0}
        </MDButton>
      ),
    },
    {
      Header: "Status",
      accessor: "status",
      align: "left",
      Cell: StatusCell,
    },
    { Header: "Remarks", accessor: "remarks", align: "left" },
  ];

  const computedRows = rows.map((row) => ({
    ...row,
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
        {canEdit && (
          <IconButton
            size="small"
            color="info"
            onClick={() => handleEditTenant(row.id)}
            title="Edit"
            sx={{ padding: "1px" }}
          >
            <Icon>edit</Icon>
          </IconButton>
        )}
        {canDelete && (
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteTenant(row.id)}
            title="Delete"
            sx={{ padding: "1px" }}
          >
            <Icon>delete</Icon>
          </IconButton>
        )}
      </MDBox>
    ),
  }));

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <MDBox pt={6} pb={3}>
        <Grid container spacing={6}>
          <Grid item xs={12}>
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
                  Tenants
                </MDTypography>
                {canCreate && (
                  <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                    <Icon>add</Icon>&nbsp;Add New
                  </MDButton>
                )}
              </MDBox>
              <MDBox
                pt={3}
                sx={{
                  display: "flex",
                  flexDirection: "column",
                  height: "70vh",
                  minHeight: "400px",
                  overflow: "hidden",
                  "& .MuiTableContainer-root": {
                    flex: "1 1 0",
                    minHeight: 0,
                    overflow: "hidden",
                  },
                  "& .MuiTable-root": {
                    tableLayout: "fixed",
                    width: "100%",
                  },
                  "& .MuiTable-root th": {
                    fontSize: "1.0rem !important",
                    fontWeight: "700 !important",
                    padding: "8px 8px !important",
                    borderBottom: "1px solid #d0d0d0",
                  },
                  "& .MuiTable-root td": {
                    padding: "6px 8px !important",
                    borderBottom: "1px solid #e0e0e0",
                  },
                }}
              >
                <DataTable
                  table={{ columns, rows: computedRows }}
                  isSorted={false}
                  stickyToolbarAndHeader
                  entriesPerPage={true}
                  showTotalEntries={true}
                  noEndBorder
                  canSearch={true}
                  exportFileName="Tenants"
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
      <TenantsForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentTenant}
      />
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1" sx={{ fontSize: "1.1rem" }}>
            Are you sure you want to delete this tenant? This action cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary" variant="outlined">
            <Icon>close</Icon>&nbsp;Cancel
          </MDButton>
          <MDButton
            onClick={handleConfirmDelete}
            color="error"
            variant="gradient"
            disabled={!canDelete}
          >
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>
      <Dialog open={contactViewDialog} onClose={handleCloseContactDialog} maxWidth="sm" fullWidth>
        <DialogTitle>{contactData.type}</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1" sx={{ fontSize: "1.2rem", mt: 2 }}>
            {contactData.value}
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseContactDialog} color="secondary" variant="outlined">
            <Icon>close</Icon>&nbsp;Close
          </MDButton>
        </DialogActions>
      </Dialog>
      <Dialog
        open={contractsDialogOpen}
        onClose={handleCloseContractsDialog}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>{`Contracts - Tenant No: ${selectedTenantNo}`}</DialogTitle>
        <DialogContent>
          {contractsDialogLoading ? (
            <MDTypography variant="body2" sx={{ mt: 1 }}>
              Loading...
            </MDTypography>
          ) : tenantContracts.length === 0 ? (
            <MDTypography variant="body2" sx={{ mt: 1 }}>
              No contracts found.
            </MDTypography>
          ) : (
            <MDBox
              sx={{
                maxHeight: "500px",
                overflowY: "auto",
                overflowX: "auto",
                scrollbarWidth: "thin",
                scrollbarColor: "#333333 transparent",
                "&::-webkit-scrollbar": {
                  width: "8px",
                  height: "8px",
                },
                "&::-webkit-scrollbar-track": {
                  background: "transparent",
                  borderRadius: "2px",
                },
                "&::-webkit-scrollbar-thumb": {
                  backgroundColor: "#333333",
                  borderRadius: "10px",
                  border: "2px solid transparent",
                  backgroundClip: "padding-box",
                  "&:hover": {
                    backgroundColor: "#1a1a1a",
                  },
                },
                "&::-webkit-scrollbar-button": {
                  display: "none",
                },
              }}
            >
              <Card>
                <MDBox p={2}>
                  <MDTypography variant="caption" color="black" mb={4}>
                    Total Active Contracts: {tenantContracts.length}
                  </MDTypography>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "3200px" }}>
                    <thead>
                      <tr style={{ borderBottom: "2px solid #e0e0e0", backgroundColor: "#f5f5f5" }}>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Sno
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Class
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Cmd
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Unit
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          CA No
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contractor Name
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contractor Address
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Business Title
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Nature of Business
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Location
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          GP ID
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Area-CA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Area-BOO
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Revenue Rate
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Revenue Rate Date
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Rental Value
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Initial Contractor Name
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Initial Contract Date
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contract From
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Contract To
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          1st Y Rent PM
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          1st Y Rent PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Term of Payment
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Profit Term
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Increase (Rate)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Increase Interval
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Security Deposit Term
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Security Deposit (Rs)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          DPC (Per Day)
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Govt Share-PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          PAF Share-PA
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Status
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Feasible
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          CA Status
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Approving Authority
                        </th>
                        <th
                          style={{
                            padding: "12px",
                            textAlign: "left",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                          }}
                        >
                          Remarks
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tenantContracts.map((contract, index) => {
                        const getField = (camelCase, pascalCase, altNames = []) => {
                          if (contract[camelCase] !== undefined && contract[camelCase] !== null)
                            return contract[camelCase];
                          if (contract[pascalCase] !== undefined && contract[pascalCase] !== null)
                            return contract[pascalCase];
                          for (const alt of altNames) {
                            if (contract[alt] !== undefined && contract[alt] !== null)
                              return contract[alt];
                          }
                          return "-";
                        };
                        const formatDate = (dateValue) => {
                          if (!dateValue) return "-";
                          try {
                            const dateStr = String(dateValue).trim();
                            if (!dateStr) return "-";
                            const datePart = dateStr.includes("T")
                              ? dateStr.split("T")[0]
                              : dateStr;
                            const d = parseISO(datePart);
                            if (!isValid(d)) return "-";
                            return format(d, "dd-MMM-yyyy");
                          } catch {
                            return "-";
                          }
                        };
                        return (
                          <tr
                            key={contract.id || contract.Id || index}
                            style={{ borderBottom: "1px solid #e0e0e0" }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = "#f9f9f9";
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {index + 1}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("class", "Class", ["className", "ClassName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("cmd", "Cmd", ["cmdName", "CmdName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("unit", "Unit", ["unitName", "UnitName"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("caNo", "CANo", ["contractNo", "ContractNo"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("contractorName", "ContractorName", [
                                "businessName",
                                "BusinessName",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("contractorAddress", "ContractorAddress", [
                                "address",
                                "Address",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("businessTitle", "BusinessTitle", ["title", "Title"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("natureOfBusiness", "NatureOfBusiness", [
                                "nature",
                                "Nature",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("location", "Location")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("gpId", "GPId", [
                                "groupId",
                                "GroupId",
                                "gId",
                                "GId",
                                "grpId",
                                "GrpId",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("areaCA", "AreaCA", ["areaCa", "AreaCa"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("areaBOO", "AreaBOO", ["areaBoo", "AreaBoo"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("revenueRate", "RevenueRate")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(getField("revenueRateDate", "RevenueRateDate"))}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("rentalValue", "RentalValue")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("initialContractorName", "InitialContractorName")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(getField("initialContractDate", "InitialContractDate"))}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(
                                getField("contractFrom", "ContractFrom", [
                                  "contractStartDate",
                                  "ContractStartDate",
                                ])
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {formatDate(
                                getField("contractTo", "ContractTo", [
                                  "contractEndDate",
                                  "ContractEndDate",
                                ])
                              )}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("firstYRentPM", "FirstYRentPM", [
                                "initialRentPM",
                                "InitialRentPM",
                                "firstYearRentPM",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("firstYRentPA", "FirstYRentPA", [
                                "initialRentPA",
                                "InitialRentPA",
                                "firstYearRentPA",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("termOfPayment", "TermOfPayment", [
                                "paymentTermMonths",
                                "PaymentTermMonths",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("profitTerm", "ProfitTerm")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("increaseRate", "IncreaseRate", [
                                "increaseRatePercent",
                                "IncreaseRatePercent",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("increaseInterval", "IncreaseInterval", [
                                "increaseIntervalMonths",
                                "IncreaseIntervalMonths",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("securityDepositTerm", "SecurityDepositTerm", [
                                "sdRateMonths",
                                "SdRateMonths",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("securityDepositRs", "SecurityDepositRs", [
                                "securityDepositAmount",
                                "SecurityDepositAmount",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("dpcPerDay", "DPCPerDay", ["dpc", "DPC"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("govtSharePA", "GovtSharePA", [
                                "govtShare",
                                "GovtShare",
                                "govtShareCondition",
                                "GovtShareCondition",
                              ])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("pafSharePA", "PAFSharePA", ["pafShare", "PAFShare"])}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              <StatusBadge value={getField("status", "Status")} />
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("feasible", "Feasible")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("caStatus", "CAStatus")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("approvingAuthority", "ApprovingAuthority")}
                            </td>
                            <td style={{ padding: "10px 12px", fontSize: "0.875rem" }}>
                              {getField("remarks", "Remarks")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </MDBox>
              </Card>
            </MDBox>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseContractsDialog} color="secondary" variant="outlined">
            <Icon>close</Icon>&nbsp;Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
