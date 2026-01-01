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
import IconButton from "@mui/material/IconButton";
import api from "services/api.service";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import PropTypes from "prop-types";
import StatusBadge from "components/StatusBadge";

function TenantsForm({ open, onClose, onSubmit, initialData }) {
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

  useEffect(() => {
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
  };

  const handleSave = () => onSubmit(form);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {initialData ? "Edit Tenant" : "New Tenant"}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} mt={1}>
          {/* TenantNo */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Tenant No"
              type="text"
              value={form.tenantNo}
              onChange={(e) => handleChange("tenantNo", e.target.value)}
              fullWidth
              size="small"
              required
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

          {/* OwnerName */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Owner Name"
              type="text"
              value={form.ownerName}
              onChange={(e) => handleChange("ownerName", e.target.value)}
              fullWidth
              size="small"
              required
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

          {/* Prefix */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Prefix"
              type="text"
              value={form.prefix}
              onChange={(e) => handleChange("prefix", e.target.value)}
              fullWidth
              size="small"
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

          {/* BusinessName */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Business Name"
              type="text"
              value={form.businessName}
              onChange={(e) => handleChange("businessName", e.target.value)}
              fullWidth
              size="small"
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
            <MDInput
              label="Province"
              type="text"
              value={form.province}
              onChange={(e) => handleChange("province", e.target.value)}
              fullWidth
              size="small"
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

          {/* City */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="City"
              type="text"
              value={form.city}
              onChange={(e) => handleChange("city", e.target.value)}
              fullWidth
              size="small"
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

          {/* Status */}
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
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
            </FormControl>
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
        <MDButton variant="gradient" color="info" onClick={handleSave}>
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
  const [openForm, setOpenForm] = useState(false);
  const [currentTenant, setCurrentTenant] = useState(null);
  const [rows, setRows] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [contactViewDialog, setContactViewDialog] = useState(false);
  const [contactData, setContactData] = useState({ type: "", value: "" });

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
    setCurrentTenant(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditTenant = (id) => {
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
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
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
        await api.update("tenant", currentTenant.id, formattedData);
      } else {
        await api.create("tenant", formattedData);
      }
      fetchTenants();
      handleCloseForm();
    } catch (error) {
      console.error("Error saving tenant:", error);
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
    { Header: "Owner Name", accessor: "ownerName", align: "left" },
    { Header: "Prefix", accessor: "prefix", align: "left" },
    { Header: "Business Name", accessor: "businessName", align: "left" },
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
        <IconButton
          size="small"
          color="info"
          onClick={() => handleEditTenant(row.id)}
          title="Edit"
          sx={{ padding: "1px" }}
        >
          <Icon>edit</Icon>
        </IconButton>
        <IconButton
          size="small"
          color="error"
          onClick={() => handleDeleteTenant(row.id)}
          title="Delete"
          sx={{ padding: "1px" }}
        >
          <Icon>delete</Icon>
        </IconButton>
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
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              </MDBox>
              <MDBox
                pt={3}
                sx={{
                  // Match contracts.js table grid fonts/spacing/styling (compact + readable)
                  overflowX: "auto",
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
                  entriesPerPage={true}
                  showTotalEntries={true}
                  noEndBorder
                  canSearch={true}
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
          <MDButton onClick={handleConfirmDelete} color="error" variant="gradient">
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
    </DashboardLayout>
  );
}
