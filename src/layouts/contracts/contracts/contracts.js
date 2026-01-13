import React, { useState, useEffect } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import Chip from "@mui/material/Chip";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDPagination from "components/MDPagination";
import CurrencyLoading from "components/CurrencyLoading";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import api from "services/api.service";
import contractApi from "services/api.contract.service";
import uploadApi from "services/api.upload.service";
import StatusBadge from "components/StatusBadge";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import PropTypes from "prop-types";

function ContractsForm({
  open,
  onClose,
  onSubmit,
  initialData,
  commands,
  bases,
  classes,
  propertyGroups,
  tenants,
}) {
  const [form, setForm] = useState({
    contractNo: "",
    cmdId: "",
    baseId: "",
    classId: "",
    grpId: "",
    tenantNo: "",
    businessName: "",
    natureOfBusiness: "",
    contractStartDate: "",
    contractEndDate: "",
    commercialOperationDate: "",
    initialRentPM: "",
    initialRentPA: "",
    paymentTermMonths: "",
    increaseRatePercent: "",
    increaseIntervalMonths: "",
    sdRateMonths: "",
    securityDepositAmount: "",
    rentalValue: "",
    govtShareCondition: "",
    pafShare: "",
    status: true,
    remarks: "",
  });
  const [errors, setErrors] = useState({});
  const [filteredBases, setFilteredBases] = useState([]);
  const [filteredClasses, setFilteredClasses] = useState([]);
  const [filteredPropertyGroups, setFilteredPropertyGroups] = useState([]);

  useEffect(() => {
    if (initialData) {
      setForm({
        contractNo: initialData.contractNo || "",
        cmdId: initialData.cmdId || "",
        baseId: initialData.baseId || "",
        classId: initialData.classId || "",
        grpId: initialData.grpId || "",
        tenantNo: initialData.tenantNo || "",
        businessName: initialData.businessName || "",
        natureOfBusiness: initialData.natureOfBusiness || "",
        contractStartDate: initialData.contractStartDate
          ? initialData.contractStartDate.split("T")[0]
          : "",
        contractEndDate: initialData.contractEndDate
          ? initialData.contractEndDate.split("T")[0]
          : "",
        commercialOperationDate: initialData.commercialOperationDate
          ? initialData.commercialOperationDate.split("T")[0]
          : "",
        initialRentPM: initialData.initialRentPM || "",
        initialRentPA: initialData.initialRentPA || "",
        paymentTermMonths: initialData.paymentTermMonths || "",
        increaseRatePercent: initialData.increaseRatePercent || "",
        increaseIntervalMonths: initialData.increaseIntervalMonths || "",
        sdRateMonths: initialData.sdRateMonths || "",
        securityDepositAmount: initialData.securityDepositAmount || "",
        rentalValue: initialData.rentalValue || "",
        govtShareCondition: initialData.govtShareCondition || "",
        pafShare: initialData.pafShare || "",
        status: initialData.status !== undefined ? initialData.status : true,
        remarks: initialData.remarks || "",
      });
    } else {
      setForm({
        contractNo: "",
        cmdId: "",
        baseId: "",
        classId: "",
        grpId: "",
        tenantNo: "",
        businessName: "",
        natureOfBusiness: "",
        contractStartDate: "",
        contractEndDate: "",
        commercialOperationDate: "",
        initialRentPM: "",
        initialRentPA: "",
        paymentTermMonths: "",
        increaseRatePercent: "",
        increaseIntervalMonths: "",
        sdRateMonths: "",
        securityDepositAmount: "",
        rentalValue: "",
        govtShareCondition: "",
        status: true,
        remarks: "",
      });
    }
    setErrors({});
  }, [initialData, open]);

  // Filter bases based on selected command
  useEffect(() => {
    if (form.cmdId && bases.length > 0) {
      const filtered = bases.filter((base) => Number(base.cmd) === Number(form.cmdId));
      setFilteredBases(filtered);
      if (form.baseId && !filtered.find((b) => b.id === form.baseId)) {
        setForm((prev) => ({ ...prev, baseId: "" }));
      }
    } else {
      setFilteredBases([]);
    }
  }, [form.cmdId, bases]);

  // Show all classes (not filtered by base)
  useEffect(() => {
    if (classes.length > 0) {
      setFilteredClasses(classes);
    } else {
      setFilteredClasses([]);
    }
  }, [classes]);

  // Filter property groups based on selected command, base, and class
  useEffect(() => {
    if (form.cmdId && form.baseId && form.classId && propertyGroups.length > 0) {
      const filtered = propertyGroups.filter(
        (pg) =>
          Number(pg.cmdId) === Number(form.cmdId) &&
          Number(pg.baseId) === Number(form.baseId) &&
          Number(pg.classId) === Number(form.classId)
      );
      setFilteredPropertyGroups(filtered);
      if (form.grpId && !filtered.find((pg) => pg.id === form.grpId)) {
        setForm((prev) => ({ ...prev, grpId: "" }));
      }
    } else {
      setFilteredPropertyGroups([]);
    }
  }, [form.cmdId, form.baseId, form.classId, propertyGroups]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!form.contractNo?.trim()) newErrors.contractNo = "Contract No is required";
    if (!form.cmdId) newErrors.cmdId = "Command is required";
    if (!form.baseId) newErrors.baseId = "Base is required";
    if (!form.classId) newErrors.classId = "Class is required";
    if (!form.grpId) newErrors.grpId = "Group is required";
    if (!form.tenantNo?.trim()) newErrors.tenantNo = "Tenant No is required";
    if (!form.businessName?.trim()) newErrors.businessName = "Business Name is required";
    if (!form.natureOfBusiness?.trim())
      newErrors.natureOfBusiness = "Nature of Business is required";
    if (!form.contractStartDate) newErrors.contractStartDate = "Contract Start Date is required";
    if (!form.contractEndDate) newErrors.contractEndDate = "Contract End Date is required";
    if (!form.initialRentPM) newErrors.initialRentPM = "Initial Rent PM is required";
    if (!form.initialRentPA) newErrors.initialRentPA = "Initial Rent PA is required";
    if (!form.paymentTermMonths) newErrors.paymentTermMonths = "Payment Term Months is required";
    if (!form.govtShareCondition) newErrors.govtShareCondition = "Govt Share Condition is required";

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      contractNo: form.contractNo.trim(),
      cmdId: Number(form.cmdId),
      baseId: Number(form.baseId),
      classId: Number(form.classId),
      grpId: Number(form.grpId),
      tenantNo: form.tenantNo.trim(),
      businessName: form.businessName.trim(),
      natureOfBusiness: form.natureOfBusiness.trim(),
      contractStartDate: form.contractStartDate,
      contractEndDate: form.contractEndDate,
      commercialOperationDate: form.commercialOperationDate || null,
      initialRentPM: form.initialRentPM ? Number(form.initialRentPM) : null,
      initialRentPA: form.initialRentPA ? Number(form.initialRentPA) : null,
      paymentTermMonths: form.paymentTermMonths ? Number(form.paymentTermMonths) : null,
      increaseRatePercent: form.increaseRatePercent ? Number(form.increaseRatePercent) : null,
      increaseIntervalMonths: form.increaseIntervalMonths
        ? Number(form.increaseIntervalMonths)
        : null,
      sdRateMonths: form.sdRateMonths ? Number(form.sdRateMonths) : null,
      securityDepositAmount: form.securityDepositAmount ? Number(form.securityDepositAmount) : null,
      rentalValue: form.rentalValue ? Number(form.rentalValue) : null,
      govtShareCondition: form.govtShareCondition,
      pafShare: form.pafShare ? Number(form.pafShare) : null,
      status: form.status,
      remarks: form.remarks?.trim() || null,
    };

    await onSubmit(payload);
  };

  const paymentTermOptions = [1, 2, 3, 4, 6, 12];
  const increaseIntervalOptions = [1, 2, 3, 4, 6, 12, 15, 24];
  const govtShareOptions = ["A", "C", "NA"];

  // Shared compact styling to keep all inputs/lookups consistent and simple
  const labelSx = { fontSize: "1rem" };
  const inputSx = {
    "& .MuiInputBase-input": { fontSize: "1rem", padding: "10px 12px" },
    "& .MuiInputLabel-root": { fontSize: "1rem" },
  };
  const selectSx = {
    fontSize: "1rem",
    // Keep a fixed control height whether empty or filled
    "& .MuiOutlinedInput-root": {
      minHeight: "45px",
    },
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "12px 32px 12px 12px",
      minHeight: "45px",
      display: "flex",
      alignItems: "center",
      boxSizing: "border-box",
    },
  };
  const menuItemSx = { fontSize: "1rem" };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 700 }}>
        {initialData ? "Edit Contract" : "New Contract"}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={1}>
          {/* ContractNo */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Contract No"
              type="text"
              value={form.contractNo}
              onChange={(e) => handleChange("contractNo", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.contractNo}
              helperText={errors.contractNo}
              sx={inputSx}
            />
          </Grid>

          {/* Command, Base, Class - First Row */}
          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth error={!!errors.cmdId}>
              <InputLabel id="cmd-label" sx={labelSx}>
                Command
              </InputLabel>
              <Select
                labelId="cmd-label"
                value={form.cmdId || ""}
                label="Command"
                onChange={(e) => handleChange("cmdId", e.target.value)}
                sx={selectSx}
              >
                {commands.map((cmd) => (
                  <MenuItem key={cmd.id} value={cmd.id} sx={menuItemSx}>
                    {cmd.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth error={!!errors.baseId}>
              <InputLabel id="base-label" sx={labelSx}>
                Base
              </InputLabel>
              <Select
                labelId="base-label"
                value={form.baseId || ""}
                label="Base"
                onChange={(e) => handleChange("baseId", e.target.value)}
                disabled={!form.cmdId}
                sx={selectSx}
              >
                {filteredBases.map((base) => (
                  <MenuItem key={base.id} value={base.id} sx={menuItemSx}>
                    {base.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth error={!!errors.classId}>
              <InputLabel id="class-label" sx={labelSx}>
                Class
              </InputLabel>
              <Select
                labelId="class-label"
                value={form.classId || ""}
                label="Class"
                onChange={(e) => handleChange("classId", e.target.value)}
                disabled={!form.cmdId || !form.baseId}
                sx={selectSx}
              >
                {filteredClasses.map((cls) => (
                  <MenuItem key={cls.id} value={cls.id} sx={menuItemSx}>
                    {cls.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Group ID */}
          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth error={!!errors.grpId}>
              <InputLabel id="grp-label" sx={labelSx}>
                Group ID
              </InputLabel>
              <Select
                labelId="grp-label"
                value={form.grpId || ""}
                label="Group ID"
                onChange={(e) => handleChange("grpId", e.target.value)}
                disabled={!form.cmdId || !form.baseId || !form.classId}
                sx={selectSx}
              >
                {filteredPropertyGroups.map((pg) => (
                  <MenuItem key={pg.id} value={pg.id} sx={menuItemSx}>
                    {pg.gId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* TenantNo */}
          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth error={!!errors.tenantNo}>
              <InputLabel id="tenant-label" sx={labelSx}>
                Tenant No
              </InputLabel>
              <Select
                labelId="tenant-label"
                value={form.tenantNo || ""}
                label="Tenant No"
                onChange={(e) => handleChange("tenantNo", e.target.value)}
                sx={selectSx}
              >
                {tenants.map((tenant) => (
                  <MenuItem key={tenant.id} value={tenant.tenantNo} sx={menuItemSx}>
                    {tenant.tenantNo} - {tenant.ownerName}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* BusinessName */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Business Name"
              type="text"
              value={form.businessName}
              onChange={(e) => handleChange("businessName", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.businessName}
              helperText={errors.businessName}
              sx={inputSx}
            />
          </Grid>

          {/* NatureOfBusiness */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Nature of Business"
              type="text"
              value={form.natureOfBusiness}
              onChange={(e) => handleChange("natureOfBusiness", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.natureOfBusiness}
              helperText={errors.natureOfBusiness}
              sx={inputSx}
            />
          </Grid>

          {/* ContractStartDate */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Contract Start Date"
              type="date"
              value={form.contractStartDate}
              onChange={(e) => handleChange("contractStartDate", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.contractStartDate}
              helperText={errors.contractStartDate}
              InputLabelProps={{ shrink: true }}
              sx={inputSx}
            />
          </Grid>

          {/* ContractEndDate */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Contract End Date"
              type="date"
              value={form.contractEndDate}
              onChange={(e) => handleChange("contractEndDate", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.contractEndDate}
              helperText={errors.contractEndDate}
              InputLabelProps={{ shrink: true }}
              sx={inputSx}
            />
          </Grid>

          {/* CommercialOperationDate */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Commercial Operation Date"
              type="date"
              value={form.commercialOperationDate}
              onChange={(e) => handleChange("commercialOperationDate", e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{ shrink: true }}
              sx={inputSx}
            />
          </Grid>

          {/* InitialRentPM */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Initial Rent PM"
              type="number"
              value={form.initialRentPM}
              onChange={(e) => handleChange("initialRentPM", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.initialRentPM}
              helperText={errors.initialRentPM}
              sx={inputSx}
            />
          </Grid>

          {/* InitialRentPA */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Initial Rent PA"
              type="number"
              value={form.initialRentPA}
              onChange={(e) => handleChange("initialRentPA", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.initialRentPA}
              helperText={errors.initialRentPA}
              sx={inputSx}
            />
          </Grid>

          {/* PaymentTermMonths */}
          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth error={!!errors.paymentTermMonths}>
              <InputLabel id="payment-term-label" sx={labelSx}>
                Payment Term Months
              </InputLabel>
              <Select
                labelId="payment-term-label"
                value={form.paymentTermMonths || ""}
                label="Payment Term Months"
                onChange={(e) => handleChange("paymentTermMonths", e.target.value)}
                sx={selectSx}
              >
                {paymentTermOptions.map((option) => (
                  <MenuItem key={option} value={option} sx={menuItemSx}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* IncreaseRatePercent */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Increase Rate Percent"
              type="number"
              value={form.increaseRatePercent}
              onChange={(e) => handleChange("increaseRatePercent", e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          {/* IncreaseIntervalMonths */}
          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth>
              <InputLabel id="increase-interval-label" sx={labelSx}>
                Increase Interval Months
              </InputLabel>
              <Select
                labelId="increase-interval-label"
                value={form.increaseIntervalMonths || ""}
                label="Increase Interval Months"
                onChange={(e) => handleChange("increaseIntervalMonths", e.target.value)}
                sx={selectSx}
              >
                {increaseIntervalOptions.map((option) => (
                  <MenuItem key={option} value={option} sx={menuItemSx}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* SDRateMonths */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="SD Rate Months"
              type="number"
              value={form.sdRateMonths}
              onChange={(e) => handleChange("sdRateMonths", e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          {/* SecurityDepositAmount */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Security Deposit Amount"
              type="number"
              value={form.securityDepositAmount}
              onChange={(e) => handleChange("securityDepositAmount", e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          {/* RentalValue */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="Rental Value"
              type="number"
              value={form.rentalValue}
              onChange={(e) => handleChange("rentalValue", e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          {/* GovtShareCondition */}
          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth error={!!errors.govtShareCondition}>
              <InputLabel id="govt-share-label" sx={labelSx}>
                Govt Share Condition
              </InputLabel>
              <Select
                labelId="govt-share-label"
                value={form.govtShareCondition || ""}
                label="Govt Share Condition"
                onChange={(e) => handleChange("govtShareCondition", e.target.value)}
                sx={selectSx}
              >
                {govtShareOptions.map((option) => (
                  <MenuItem key={option} value={option} sx={menuItemSx}>
                    {option}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* PAFShare */}
          <Grid item xs={12} sm={6} md={4}>
            <MDInput
              label="PAF Share (%)"
              type="number"
              value={form.pafShare || ""}
              onChange={(e) => handleChange("pafShare", e.target.value)}
              fullWidth
              size="small"
              sx={inputSx}
            />
          </Grid>

          {/* Status */}
          <Grid item xs={12} sm={6} md={4}>
            <FormControl size="small" fullWidth>
              <InputLabel id="status-label" sx={labelSx}>
                Status
              </InputLabel>
              <Select
                labelId="status-label"
                value={form.status !== undefined ? form.status : true}
                label="Status"
                onChange={(e) => handleChange("status", e.target.value)}
                sx={selectSx}
              >
                <MenuItem value={true} sx={menuItemSx}>
                  Active
                </MenuItem>
                <MenuItem value={false} sx={menuItemSx}>
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
              multiline
              rows={3}
              size="small"
              sx={inputSx}
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

ContractsForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  commands: PropTypes.array.isRequired,
  bases: PropTypes.array.isRequired,
  classes: PropTypes.array.isRequired,
  propertyGroups: PropTypes.array.isRequired,
  tenants: PropTypes.array.isRequired,
};

export default function Contracts() {
  const [openForm, setOpenForm] = useState(false);
  const [currentContract, setCurrentContract] = useState(null);
  const [rows, setRows] = useState([]);

  // Server-side pagination state (backend now paginates)
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [classes, setClasses] = useState([]);
  const [propertyGroups, setPropertyGroups] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentList, setAttachmentList] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentLoadingId, setAttachmentLoadingId] = useState(null);
  const [currentViewingRecord, setCurrentViewingRecord] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);

  const fetchContracts = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await contractApi.getAll(page, size);
      if (response && response.pagination) {
        setRows(response.data || []);
        setTotalCount(response.pagination.totalCount || 0);
        setPageNumber(response.pagination.pageNumber || page);
        setPageSize(response.pagination.pageSize || size);
      } else {
        // Fallback (non-paginated)
        const arr = Array.isArray(response) ? response : [];
        setRows(arr);
        setTotalCount(arr.length);
      }
    } catch (error) {
      console.error("Error fetching contracts:", error);
      setRows([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  const fetchCommands = async () => {
    try {
      const response = await api.list("command");
      setCommands(response);
    } catch (error) {
      console.error("Error fetching commands:", error);
    }
  };

  const fetchBases = async () => {
    try {
      const response = await api.list("base");
      setBases(response);
    } catch (error) {
      console.error("Error fetching bases:", error);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.list("class");
      setClasses(response);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchPropertyGroups = async () => {
    try {
      const response = await api.list("propertygroup");
      setPropertyGroups(response);
    } catch (error) {
      console.error("Error fetching property groups:", error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await api.list("tenant");
      setTenants(response);
    } catch (error) {
      console.error("Error fetching tenants:", error);
    }
  };

  // Lazy-load dropdown lists only when form opens (Add New / Edit)
  useEffect(() => {
    if (!openForm) return;

    if (commands.length === 0) fetchCommands();
    if (bases.length === 0) fetchBases();
    if (classes.length === 0) fetchClasses();
    if (propertyGroups.length === 0) fetchPropertyGroups();
    if (tenants.length === 0) fetchTenants();
  }, [
    openForm,
    commands.length,
    bases.length,
    classes.length,
    propertyGroups.length,
    tenants.length,
  ]);

  // Load current page from backend
  useEffect(() => {
    fetchContracts(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  const handleOpenForm = () => {
    setCurrentContract(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditContract = (id) => {
    const contract = rows.find((row) => row.id === id);
    setCurrentContract(contract);
    setOpenForm(true);
  };

  const handleDeleteContract = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete) {
      try {
        await api.remove("contract", recordToDelete);
        await fetchContracts(pageNumber, pageSize);
        setDeleteDialogOpen(false);
        setRecordToDelete(null);
      } catch (error) {
        console.error("Error deleting contract:", error);
        alert("Failed to delete contract. Please try again.");
      }
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleSubmit = async (data) => {
    try {
      if (currentContract && currentContract.id) {
        await api.update("contract", currentContract.id, data);
      } else {
        await api.create("contract", data);
      }
      await fetchContracts(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving contract:", error);
      alert("Failed to save contract. Please try again.");
    }
  };

  const normalizeFiles = (filesArray) =>
    filesArray.map((f) => {
      if (typeof f === "string") {
        return { fileName: f.split(/[\\/]/).pop(), downloadUrl: f };
      }
      const fileName =
        f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
      const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
      return { ...f, fileName, downloadUrl };
    });

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / Math.pow(k, i)) * 100) / 100} ${sizes[i]}`;
  };

  const handleViewAttachments = async (record) => {
    if (!record?.id) return;
    setAttachmentLoading(true);
    setAttachmentLoadingId(record.id);
    setCurrentViewingRecord(record);
    setSelectedFiles([]);
    try {
      const response = await uploadApi.getUploadedFiles(record.id, "Contracts");
      const filesArray = response?.files || (Array.isArray(response) ? response : []);
      setAttachmentList(normalizeFiles(filesArray));
      setAttachmentDialogOpen(true);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      alert("Unable to load attachments.");
    } finally {
      setAttachmentLoading(false);
      setAttachmentLoadingId(null);
    }
  };

  const handleCloseAttachmentDialog = () => {
    setAttachmentDialogOpen(false);
    setAttachmentList([]);
    setCurrentViewingRecord(null);
    setSelectedFiles([]);
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const totalExisting = attachmentList.length;
    const totalSelected = selectedFiles.length;
    const totalFiles = totalExisting + totalSelected;
    const remainingSlots = 5 - totalFiles;

    if (totalFiles >= 5) {
      alert(
        "Maximum 5 files allowed. Please delete some existing files before uploading new ones."
      );
      event.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      alert(`You can only upload ${remainingSlots} more file(s). Maximum 5 files allowed.`);
      event.target.value = "";
      return;
    }

    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });

    if (totalFiles + validFiles.length > 5) {
      alert(`You can only upload ${5 - totalFiles} more file(s). Maximum 5 files allowed.`);
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const refreshAttachments = async (recordId) => {
    const response = await uploadApi.getUploadedFiles(recordId, "Contracts");
    const filesArray = response?.files || (Array.isArray(response) ? response : []);
    setAttachmentList(normalizeFiles(filesArray));
  };

  const handleUploadSelected = async () => {
    if (!currentViewingRecord?.id) {
      alert("Record ID not found. Please reopen attachments and try again.");
      return;
    }
    if (selectedFiles.length === 0) {
      alert("Select at least one file to upload.");
      return;
    }
    setIsUploading(true);
    try {
      await uploadApi.uploadFiles(currentViewingRecord.id, "Contracts", selectedFiles);
      await refreshAttachments(currentViewingRecord.id);
      setSelectedFiles([]);
      alert("Files uploaded successfully.");
    } catch (error) {
      console.error("Error uploading files:", error);
      alert(`Failed to upload files: ${error.message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDownloadAttachment = (file) => {
    const downloadUrl =
      file?.downloadUrl || file?.fileUrl || file?.url || file?.filePath || file?.path;
    if (downloadUrl) {
      const fullUrl = downloadUrl.startsWith("http")
        ? downloadUrl
        : `${process.env.REACT_APP_API_BASE_URL || ""}${
            downloadUrl.startsWith("/") ? "" : "/"
          }${downloadUrl}`;
      window.open(fullUrl, "_blank");
    } else {
      alert("Download URL is not available for this file.");
    }
  };

  const handleDeleteAttachment = async (file) => {
    if (!file?.id) {
      alert("File ID is not available. Cannot delete this file.");
      return;
    }
    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file.fileName || file.name || "this file"}"?`
    );
    if (!confirmDelete) return;

    try {
      await uploadApi.deleteUploadedFile(file.id);
      if (currentViewingRecord?.id) {
        await refreshAttachments(currentViewingRecord.id);
      } else {
        setAttachmentList((prev) => prev.filter((f) => f.id !== file.id));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  const columns = [
    { Header: "Actions", accessor: "actions", align: "center", width: "72px" },
    { Header: "ID", accessor: "id", align: "center", width: "56px" },
    { Header: "Contract No", accessor: "contractNo", align: "left" },
    // Backend now sends names directly (no mapping)
    { Header: "Command", accessor: "cmdName", align: "left" },
    { Header: "Base", accessor: "baseName", align: "left" },
    { Header: "Class", accessor: "className", align: "left" },
    { Header: "Group", accessor: "grpName", align: "left" },
    { Header: "Unit", accessor: "unitName", align: "left" },
    { Header: "Tenant No", accessor: "tenantNo", align: "left" },
    { Header: "Business Name", accessor: "businessName", align: "left" },
    { Header: "Nature of Business", accessor: "natureOfBusiness", align: "left" },
    {
      Header: "Contract Start Date",
      accessor: "contractStartDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? value.split("T")[0] : ""),
    },
    {
      Header: "Contract End Date",
      accessor: "contractEndDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? value.split("T")[0] : ""),
    },
    {
      Header: "Commercial Operation Date",
      accessor: "commercialOperationDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? value.split("T")[0] : "-"),
    },
    {
      Header: "Initial Rent PM",
      accessor: "initialRentPM",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Initial Rent PA",
      accessor: "initialRentPA",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    { Header: "Payment Term Months", accessor: "paymentTermMonths", align: "right" },
    {
      Header: "Increase Rate %",
      accessor: "increaseRatePercent",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? `${value}%` : "-"),
    },
    {
      Header: "Increase Interval Months",
      accessor: "increaseIntervalMonths",
      align: "right",
    },
    { Header: "SD Rate Months", accessor: "sdRateMonths", align: "right" },
    {
      Header: "Security Deposit Amount",
      accessor: "securityDepositAmount",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    {
      Header: "Rental Value",
      accessor: "rentalValue",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? Number(value).toLocaleString() : "-"),
    },
    { Header: "Govt Share Condition", accessor: "govtShareCondition", align: "left" },
    {
      Header: "PAF Share %",
      accessor: "pafShare",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? `${value}%` : "-"),
    },
    {
      Header: "Attachments",
      accessor: "attachments",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const hasId = row?.original?.id;
        return hasId ? (
          <IconButton
            size="small"
            color="primary"
            // eslint-disable-next-line react/prop-types
            onClick={() => handleViewAttachments(row.original)}
            // eslint-disable-next-line react/prop-types
            disabled={attachmentLoading && attachmentLoadingId === row?.original?.id}
            title="View attachments"
          >
            <Icon>visibility</Icon>
          </IconButton>
        ) : (
          <span>-</span>
        );
      },
    },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => <StatusBadge value={value} />,
    },
    { Header: "Remarks", accessor: "remarks", align: "left" },
  ];

  const computedRows = rows.map((row) => ({
    ...row,
    // Be tolerant to backend field naming variations
    cmdName: row.cmdName || row.cmdname || row.commandName || "",
    baseName: row.baseName || row.basename || row.baseNameText || "",
    className: row.className || row.classname || row.classNameText || "",
    grpName: row.grpName || row.grpname || row.groupName || row.gId || "",
    unitName: row.unitName || row.unitname || row.uomName || row.uoM || row.uoMName || "",
    actions: (
      <MDBox
        alignItems="left"
        justifyContent="left"
        sx={{
          backgroundColor: "#f8f9fa", // Light grey background (same as rental-properties)
          gap: "2px",
          padding: "2px 2px",
          borderRadius: "2px",
        }}
      >
        <IconButton
          size="small"
          color="info"
          onClick={() => handleEditContract(row.id)}
          title="Edit"
          sx={{ padding: "1px" }}
        >
          <Icon>edit</Icon>
        </IconButton>
        <IconButton
          size="small"
          color="error"
          onClick={() => handleDeleteContract(row.id)}
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
                  Contracts
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              </MDBox>
              <MDBox
                pt={3}
                position="relative"
                sx={{
                  // Match property-grouping style: tight grid + multi-line headers/cells (no overflow)
                  overflowX: "auto",
                  "& .MuiTable-root": {
                    tableLayout: "fixed",
                    width: "100%",
                  },
                  // DataTable uses custom <td> cells (MDBox), not MUI TableCell.
                  // Force wrapping + constrain inner "max-content" wrapper so text never overlaps.
                  "& table th, & table td": {
                    whiteSpace: "normal !important",
                    wordBreak: "break-word !important",
                    overflowWrap: "anywhere !important",
                    lineHeight: 1.3,
                    verticalAlign: "top",
                  },
                  // DataTableBodyCell renders: <td><div style="display:inline-block;width:max-content">...</div></td>
                  "& table td > div": {
                    display: "block !important",
                    width: "100% !important",
                    maxWidth: "100% !important",
                    whiteSpace: "normal !important",
                    wordBreak: "break-word !important",
                    overflowWrap: "anywhere !important",
                  },
                  "& table td > div > *": {
                    maxWidth: "100% !important",
                    whiteSpace: "normal !important",
                    wordBreak: "break-word !important",
                    overflowWrap: "anywhere !important",
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
                  // Keep Actions + ID columns compact and stable (avoid wrap/overlap)
                  "& .MuiTable-root th:nth-of-type(1), & .MuiTable-root td:nth-of-type(1)": {
                    width: "72px",
                    minWidth: "72px",
                    maxWidth: "72px",
                    whiteSpace: "nowrap !important",
                    paddingLeft: "4px !important",
                    paddingRight: "4px !important",
                  },
                  "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2)": {
                    width: "56px",
                    minWidth: "56px",
                    maxWidth: "56px",
                    whiteSpace: "nowrap !important",
                    paddingLeft: "4px !important",
                    paddingRight: "4px !important",
                  },
                  // ID is an integer field; keep it tight against the next column (Contract No)
                  "& .MuiTable-root th:nth-of-type(2), & .MuiTable-root td:nth-of-type(2)": {
                    paddingRight: "1px !important",
                  },
                  "& .MuiTable-root th:nth-of-type(3), & .MuiTable-root td:nth-of-type(3)": {
                    paddingLeft: "1px !important",
                  },
                }}
              >
                {/* Loading Overlay */}
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

                {/* Server-side Pagination Controls + Search */}
                <MDBox
                  display="flex"
                  justifyContent="space-between"
                  alignItems="center"
                  p={3}
                  pb={2}
                >
                  <MDBox display="flex" alignItems="center">
                    <Autocomplete
                      disableClearable
                      value={pageSize.toString()}
                      options={["10", "25", "50", "100"]}
                      onChange={(event, newValue) => {
                        setPageSize(parseInt(newValue, 10));
                        setPageNumber(1);
                      }}
                      size="small"
                      sx={{
                        width: "5rem",
                        "& .MuiInputBase-root": { minHeight: "45px" },
                        "& .MuiInputBase-input": { paddingTop: 0, paddingBottom: 0 },
                      }}
                      renderInput={(params) => <MDInput {...params} />}
                    />
                    <MDTypography variant="caption" color="secondary">
                      &nbsp;&nbsp;entries per page
                    </MDTypography>
                  </MDBox>

                  <MDBox width="14rem">
                    <MDInput
                      placeholder="Search..."
                      size="small"
                      fullWidth
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </MDBox>
                </MDBox>

                <DataTable
                  table={{
                    columns,
                    rows: computedRows.filter((r) => {
                      if (!searchQuery.trim()) return true;
                      const q = searchQuery.toLowerCase();
                      return (
                        String(r.contractNo || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(r.cmdName || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(r.baseName || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(r.className || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(r.grpName || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(r.unitName || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(r.tenantNo || "")
                          .toLowerCase()
                          .includes(q) ||
                        String(r.businessName || "")
                          .toLowerCase()
                          .includes(q)
                      );
                    }),
                  }}
                  isSorted={false}
                  entriesPerPage={false}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch={false}
                />

                {/* Server-side Pagination Footer */}
                {totalCount > 0 && (
                  <MDBox
                    display="flex"
                    flexDirection={{ xs: "column", sm: "row" }}
                    justifyContent="space-between"
                    alignItems={{ xs: "flex-start", sm: "center" }}
                    p={3}
                  >
                    <MDBox mb={{ xs: 3, sm: 0 }}>
                      <MDTypography variant="button" color="secondary" fontWeight="regular">
                        Showing {(pageNumber - 1) * pageSize + 1} to{" "}
                        {Math.min(pageNumber * pageSize, totalCount)} of {totalCount} entries
                      </MDTypography>
                    </MDBox>

                    {Math.ceil(totalCount / pageSize) > 1 && (
                      <MDPagination variant="gradient" color="info">
                        {pageNumber > 1 && (
                          <MDPagination item onClick={() => setPageNumber(pageNumber - 1)}>
                            <Icon sx={{ fontWeight: "bold" }}>chevron_left</Icon>
                          </MDPagination>
                        )}

                        {Array.from({ length: Math.ceil(totalCount / pageSize) }, (_, i) => i + 1)
                          .filter((p) => {
                            const totalPages = Math.ceil(totalCount / pageSize);
                            return (
                              p === 1 ||
                              p === totalPages ||
                              (p >= pageNumber - 2 && p <= pageNumber + 2)
                            );
                          })
                          .map((p, idx, arr) => {
                            const prev = arr[idx - 1];
                            const showEllipsis = prev && p - prev > 1;
                            return (
                              <React.Fragment key={p}>
                                {showEllipsis && (
                                  <MDPagination item disabled>
                                    <Icon>more_horiz</Icon>
                                  </MDPagination>
                                )}
                                <MDPagination
                                  item
                                  onClick={() => setPageNumber(p)}
                                  active={p === pageNumber}
                                >
                                  {p}
                                </MDPagination>
                              </React.Fragment>
                            );
                          })}

                        {pageNumber < Math.ceil(totalCount / pageSize) && (
                          <MDPagination item onClick={() => setPageNumber(pageNumber + 1)}>
                            <Icon sx={{ fontWeight: "bold" }}>chevron_right</Icon>
                          </MDPagination>
                        )}
                      </MDPagination>
                    )}
                  </MDBox>
                )}
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>
      <Footer />
      <ContractsForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentContract}
        commands={commands}
        bases={bases}
        classes={classes}
        propertyGroups={propertyGroups}
        tenants={tenants}
      />
      <Dialog
        open={attachmentDialogOpen}
        onClose={handleCloseAttachmentDialog}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>Attachments</DialogTitle>
        <DialogContent>
          {attachmentLoading ? (
            <MDBox display="flex" justifyContent="center" py={3}>
              <CurrencyLoading size={40} />
            </MDBox>
          ) : (
            <>
              {attachmentList.length === 0 ? (
                <MDTypography variant="body2" color="text">
                  No attachments uploaded for this contract.
                </MDTypography>
              ) : (
                <List disablePadding>
                  {attachmentList.map((file, index) => (
                    <MDBox key={file.id || file.fileName || index}>
                      <ListItem
                        disableGutters
                        sx={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          px: 0,
                        }}
                      >
                        <ListItemText
                          primary={file.fileName || file.name || `Attachment ${index + 1}`}
                        />
                        <MDBox display="flex" gap={1} alignItems="center">
                          <MDButton
                            size="small"
                            variant="outlined"
                            color="info"
                            onClick={() => handleDownloadAttachment(file)}
                            disabled={!file.downloadUrl}
                          >
                            <Icon>download</Icon>&nbsp;Download
                          </MDButton>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleDeleteAttachment(file)}
                            sx={{ ml: 1 }}
                          >
                            <Icon>delete</Icon>
                          </IconButton>
                        </MDBox>
                      </ListItem>
                      {index < attachmentList.length - 1 && <Divider />}
                    </MDBox>
                  ))}
                </List>
              )}

              {currentViewingRecord?.id && (
                <MDBox
                  mt={3}
                  p={2}
                  sx={{
                    border: "1px dashed",
                    borderColor: "#b0b0b0",
                    borderRadius: 2,
                    bgcolor: "background.paper",
                  }}
                >
                  <MDTypography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
                    Upload Attachments (Max 5 total)
                  </MDTypography>

                  <input
                    accept="*/*"
                    style={{ display: "none" }}
                    id="contract-file-upload"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={attachmentList.length + selectedFiles.length >= 5 || isUploading}
                  />
                  <label htmlFor="contract-file-upload">
                    <MDButton
                      variant="gradient"
                      color="info"
                      component="span"
                      disabled={attachmentList.length + selectedFiles.length >= 5 || isUploading}
                      sx={{
                        mb: 2,
                        minHeight: "48px",
                        fontSize: "1rem",
                        fontWeight: 600,
                        px: 3,
                        "& .MuiSvgIcon-root": { fontSize: "1.4rem", mr: 1 },
                      }}
                    >
                      <Icon>cloud_upload</Icon>
                      Select Files ({attachmentList.length + selectedFiles.length}/5)
                    </MDButton>
                  </label>

                  {attachmentList.length + selectedFiles.length < 5 && (
                    <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                      You can upload {5 - (attachmentList.length + selectedFiles.length)} more
                      file(s).
                    </MDTypography>
                  )}

                  {selectedFiles.length > 0 && (
                    <MDBox mt={1} display="flex" flexWrap="wrap" gap={1}>
                      {selectedFiles.map((file, index) => (
                        <Chip
                          key={index}
                          label={`${file.name} (${formatFileSize(file.size)})`}
                          onDelete={() => handleRemoveFile(index)}
                          deleteIcon={<Icon>cancel</Icon>}
                          sx={{ fontSize: "0.95rem" }}
                          color="primary"
                          variant="outlined"
                        />
                      ))}
                    </MDBox>
                  )}

                  <MDBox mt={2} display="flex" justifyContent="flex-end">
                    <MDButton
                      variant="gradient"
                      color="info"
                      onClick={handleUploadSelected}
                      disabled={selectedFiles.length === 0 || isUploading}
                    >
                      <Icon>upload</Icon>&nbsp;{isUploading ? "Uploading..." : "Upload Selected"}
                    </MDButton>
                  </MDBox>
                </MDBox>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseAttachmentDialog}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1">
            Are you sure you want to delete this contract? This action cannot be undone.
          </MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete} color="secondary">
            Cancel
          </MDButton>
          <MDButton onClick={handleConfirmDelete} color="error">
            <Icon>delete</Icon>&nbsp;Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
