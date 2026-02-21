import React, { useState, useEffect, useMemo } from "react";
import Grid from "@mui/material/Grid";
import Card from "@mui/material/Card";
import Icon from "@mui/material/Icon";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import Divider from "@mui/material/Divider";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDPagination from "components/MDPagination";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import Autocomplete from "@mui/material/Autocomplete";
import MDSnackbar from "components/MDSnackbar";
import api from "services/api.service";
import uploadApi from "services/api.upload.service";
import revenueRatesApi from "services/api.revenuerates.service";
import CurrencyLoading from "components/CurrencyLoading";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import Footer from "examples/Footer";
import DataTable from "examples/Tables/DataTable";
import PropTypes from "prop-types";
import StatusBadge from "components/StatusBadge";

function RevenueRatesForm({
  open,
  onClose,
  onSubmit,
  initialData,
  rentalProperties,
  commandOptions,
  baseOptions,
  onUploadSuccess,
}) {
  const [form, setForm] = useState({
    cmdId: "",
    baseId: "",
    propertyId: "",
    applicableDate: "",
    rate: "",
    attachments: "",
    status: true,
  });
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);

  useEffect(() => {
    if (initialData) {
      const selectedProp = (rentalProperties || []).find(
        (p) => Number(p.id) === Number(initialData.propertyId)
      );
      const resolvedCmdId =
        initialData.cmdId ?? initialData.cmdid ?? selectedProp?.cmdId ?? selectedProp?.cmdid ?? "";
      const resolvedBaseId =
        initialData.baseId ??
        initialData.baseid ??
        selectedProp?.baseId ??
        selectedProp?.baseid ??
        "";

      setForm({
        cmdId: resolvedCmdId ? Number(resolvedCmdId) : "",
        baseId: resolvedBaseId ? Number(resolvedBaseId) : "",
        propertyId: initialData.propertyId || "",
        applicableDate: initialData.applicableDate || "",
        rate: initialData.rate || "",
        attachments: initialData.attachments || "",
        status: initialData.status !== undefined ? initialData.status : true,
      });
      // Reset new files when editing
      setSelectedFiles([]);
      // Fetch existing uploaded files
      if (initialData.id) {
        fetchExistingFiles(initialData.id);
      } else {
        setExistingFiles([]);
      }
    } else {
      setForm({
        cmdId: "",
        baseId: "",
        propertyId: "",
        applicableDate: "",
        rate: "",
        attachments: "",
        status: true,
      });
      setSelectedFiles([]);
      setExistingFiles([]);
    }
  }, [initialData, open, rentalProperties]);

  const fetchExistingFiles = async (id) => {
    setLoadingExistingFiles(true);
    try {
      const response = await uploadApi.getUploadedFiles(id, "RevenueRates");
      // Handle response format: { files: [...] } or direct array
      const filesArray = response?.files || (Array.isArray(response) ? response : []);

      // Normalize the response to ensure we have fileName and downloadUrl
      const normalized = filesArray.map((f) => {
        // Handle different response formats
        if (typeof f === "string") {
          return {
            fileName: f.split(/[\\/]/).pop(),
            downloadUrl: f,
          };
        }
        // Extract fileName and downloadUrl from various possible field names
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
        return {
          ...f,
          fileName,
          downloadUrl,
        };
      });

      setExistingFiles(normalized);
    } catch (error) {
      console.error("Error fetching existing files:", error);
      setExistingFiles([]);
    } finally {
      setLoadingExistingFiles(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next = {
        ...prev,
        [field]: field === "rate" ? (value ? Number(value) : "") : value,
      };

      if (field === "cmdId") {
        next.baseId = "";
        next.propertyId = "";
      } else if (field === "baseId") {
        next.propertyId = "";
      }

      return next;
    });
  };

  const getOptionLabel = (opt) =>
    String(
      opt?.name ??
        opt?.value ??
        opt?.label ??
        opt?.Name ??
        opt?.Value ??
        opt?.Label ??
        opt?.id ??
        ""
    );

  const filteredBaseOptions = useMemo(() => {
    const selectedCmdId = Number(form.cmdId || 0);
    if (!selectedCmdId) return [];
    return (baseOptions || []).filter((b) => Number(b?.cmdId) === selectedCmdId);
  }, [baseOptions, form.cmdId]);

  const filteredRentalProperties = useMemo(() => {
    const selectedCmdId = Number(form.cmdId || 0);
    const selectedBaseId = Number(form.baseId || 0);
    return (rentalProperties || []).filter((p) => {
      const cmdId = Number(p?.cmdId ?? p?.cmdid ?? p?.commandId ?? 0);
      const baseId = Number(p?.baseId ?? p?.baseid ?? 0);
      if (selectedCmdId && cmdId !== selectedCmdId) return false;
      if (selectedBaseId && baseId !== selectedBaseId) return false;
      return true;
    });
  }, [rentalProperties, form.cmdId, form.baseId]);

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const totalExistingFiles = existingFiles.length;
    const totalSelectedFiles = selectedFiles.length;
    const totalFiles = totalExistingFiles + totalSelectedFiles;
    const remainingSlots = 5 - totalFiles;

    if (totalFiles >= 5) {
      alert(
        "Maximum 5 files allowed. Please delete some existing files before uploading new ones."
      );
      event.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      alert(
        `You can only upload ${remainingSlots} more file(s). Maximum 5 files allowed (${totalExistingFiles} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    // Validate file sizes (optional: limit to 10MB per file for memory efficiency)
    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });

    // Check again after filtering valid files
    if (totalFiles + validFiles.length > 5) {
      const allowedCount = 5 - totalFiles;
      alert(
        `You can only upload ${allowedCount} more file(s). Maximum 5 files allowed (${totalExistingFiles} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    // Reset input
    event.target.value = "";
  };

  const handleRemoveFile = (index) => {
    setSelectedFiles((prev) => {
      const newFiles = [...prev];
      newFiles.splice(index, 1);
      return newFiles;
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const handleSave = async () => {
    // First save the form data
    await onSubmit(form);

    // If editing and files are selected, upload them
    if (initialData && initialData.id && selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        await uploadApi.uploadFiles(initialData.id, "RevenueRates", selectedFiles);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
        setSelectedFiles([]);
      } catch (error) {
        console.error("Error uploading files:", error);
        alert(`Failed to upload files: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {initialData ? "Edit Revenue Rate" : "New Revenue Rate"}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} mt={1}>
          {/* Command Dropdown */}
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="cmd-label" sx={{ fontSize: "1.1rem" }}>
                Command
              </InputLabel>
              <Select
                labelId="cmd-label"
                value={form.cmdId || ""}
                label="Command"
                onChange={(e) => handleChange("cmdId", e.target.value)}
                sx={{
                  fontSize: "1.1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1.1rem",
                    padding: "0 32px 0 14px",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
                  },
                }}
              >
                {commandOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id} sx={{ fontSize: "1.1rem" }}>
                    {getOptionLabel(option)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* Base Dropdown */}
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="base-label" sx={{ fontSize: "1.1rem" }}>
                Base
              </InputLabel>
              <Select
                labelId="base-label"
                value={form.baseId || ""}
                label="Base"
                onChange={(e) => handleChange("baseId", e.target.value)}
                disabled={!form.cmdId}
                sx={{
                  fontSize: "1.1rem",
                  "& .MuiSelect-select": {
                    fontSize: "1.1rem",
                    padding: "0 32px 0 14px",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
                  },
                }}
              >
                {filteredBaseOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id} sx={{ fontSize: "1.1rem" }}>
                    {getOptionLabel(option)}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* PropertyId Dropdown */}
          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="property-label" sx={{ fontSize: "1.1rem" }}>
                Property
              </InputLabel>
              <Select
                labelId="property-label"
                value={form.propertyId || ""}
                label="Property"
                onChange={(e) => handleChange("propertyId", e.target.value)}
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
                    padding: "0 32px 0 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
                  },
                  "& .MuiSelect-icon": {
                    display: "block !important",
                    right: "10px",
                  },
                }}
              >
                {filteredRentalProperties.map((option) => (
                  <MenuItem
                    key={option.id}
                    value={option.id}
                    sx={{ fontSize: "1.1rem", padding: "10px 14px" }}
                  >
                    {option.pId}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>

          {/* ApplicableDate */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Applicable Date"
              type="date"
              value={form.applicableDate}
              onChange={(e) => handleChange("applicableDate", e.target.value)}
              fullWidth
              size="small"
              InputLabelProps={{
                shrink: true,
              }}
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

          {/* RevenueRate */}
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Revenue Rate"
              type="number"
              value={form.rate}
              onChange={(e) => handleChange("rate", e.target.value)}
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

          {/* Attachments - File Upload (only when editing) */}
          {initialData && initialData.id && (
            <Grid item xs={12}>
              <MDBox
                sx={{
                  border: "1px dashed",
                  borderColor: "#b0b0b0",
                  borderRadius: 2,
                  p: 2,
                  bgcolor: "background.paper",
                }}
              >
                <MDTypography variant="h6" sx={{ fontSize: "1rem", mb: 1 }}>
                  Attachments (Max 5 files total)
                </MDTypography>

                {/* Existing uploaded files (read-only) */}
                {loadingExistingFiles ? (
                  <MDBox display="flex" justifyContent="center" py={1}>
                    <CurrencyLoading size={20} />
                  </MDBox>
                ) : (
                  existingFiles.length > 0 && (
                    <MDBox mb={2}>
                      <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                        Already uploaded files ({existingFiles.length}/5):
                      </MDTypography>
                      {existingFiles.map((file, index) => (
                        <Chip
                          key={index}
                          label={file.fileName || `File ${index + 1}`}
                          sx={{ mr: 1, mb: 1, fontSize: "0.95rem" }}
                          color="default"
                          variant="outlined"
                          disabled
                        />
                      ))}
                    </MDBox>
                  )
                )}

                {/* New files to upload */}
                {existingFiles.length >= 5 ? (
                  <MDBox
                    sx={{
                      p: 2,
                      bgcolor: "warning.light",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "warning.main",
                    }}
                  >
                    <MDTypography variant="body2" color="warning.dark">
                      Maximum 5 files already uploaded. Please delete existing files to upload new
                      ones.
                    </MDTypography>
                  </MDBox>
                ) : (
                  <>
                    <input
                      accept="*/*"
                      style={{ display: "none" }}
                      id="file-upload-input"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      disabled={existingFiles.length + selectedFiles.length >= 5 || isUploading}
                    />
                    <label htmlFor="file-upload-input">
                      <MDButton
                        variant="gradient"
                        color="info"
                        component="span"
                        disabled={existingFiles.length + selectedFiles.length >= 5 || isUploading}
                        sx={{
                          mb: 2,
                          minHeight: "56px",
                          fontSize: "1.1rem",
                          fontWeight: 600,
                          px: 4,
                          py: 1.5,
                          "& .MuiSvgIcon-root": {
                            fontSize: "1.5rem",
                            mr: 1,
                          },
                        }}
                      >
                        <Icon>cloud_upload</Icon>
                        Upload Files ({existingFiles.length + selectedFiles.length}/5)
                      </MDButton>
                    </label>
                    {existingFiles.length + selectedFiles.length < 5 && (
                      <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                        You can upload {5 - (existingFiles.length + selectedFiles.length)} more
                        file(s).
                      </MDTypography>
                    )}
                  </>
                )}
                {selectedFiles.length > 0 && (
                  <MDBox mt={2}>
                    <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                      New files to upload:
                    </MDTypography>
                    {selectedFiles.map((file, index) => (
                      <Chip
                        key={index}
                        label={`${file.name} (${formatFileSize(file.size)})`}
                        onDelete={() => handleRemoveFile(index)}
                        deleteIcon={<Icon>cancel</Icon>}
                        sx={{ mr: 1, mb: 1, fontSize: "0.95rem" }}
                        color="primary"
                        variant="outlined"
                      />
                    ))}
                  </MDBox>
                )}
                {selectedFiles.length === 0 && existingFiles.length === 0 && (
                  <MDTypography variant="caption" color="text" sx={{ display: "block", mt: 1 }}>
                    No files selected. Click &quot;Select New Files&quot; to upload attachments.
                  </MDTypography>
                )}
              </MDBox>
            </Grid>
          )}

          {/* Attachments - Note for new records */}
          {(!initialData || !initialData.id) && (
            <Grid item xs={12}>
              <MDBox
                sx={{
                  p: 2,
                  bgcolor: "info.light",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "info.main",
                }}
              >
                <MDBox display="flex" alignItems="center">
                  <Icon sx={{ color: "info.main", mr: 1, fontSize: "1.5rem" }}>info</Icon>
                  <MDTypography variant="body2" color="info.dark" sx={{ fontSize: "1rem" }}>
                    <strong>Note:</strong> Attachment files will be uploaded after saving this form.
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Grid>
          )}

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
                    padding: "0 32px 0 14px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    minHeight: "45px",
                    display: "flex",
                    alignItems: "center",
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
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={isUploading}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave} disabled={isUploading}>
          <Icon>save</Icon>&nbsp;{isUploading ? "Uploading..." : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

RevenueRatesForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  rentalProperties: PropTypes.array.isRequired,
  commandOptions: PropTypes.array.isRequired,
  baseOptions: PropTypes.array.isRequired,
  onUploadSuccess: PropTypes.func,
};

export default function RevenueRates() {
  const [openForm, setOpenForm] = useState(false);
  const [currentRevenueRate, setCurrentRevenueRate] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [rentalProperties, setRentalProperties] = useState([]);
  const [commandOptions, setCommandOptions] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  // Search is handled by shared DataTable (canSearch)
  const [successSB, setSuccessSB] = useState(false);
  const [attachmentDialogOpen, setAttachmentDialogOpen] = useState(false);
  const [attachmentList, setAttachmentList] = useState([]);
  const [attachmentLoading, setAttachmentLoading] = useState(false);
  const [attachmentLoadingId, setAttachmentLoadingId] = useState(null);
  const [currentViewingRecord, setCurrentViewingRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);

  const openSuccessSB = () => setSuccessSB(true);
  const closeSuccessSB = () => setSuccessSB(false);

  const fetchRevenueRates = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await revenueRatesApi.getAll(page, size);
      const data = response?.data ?? (Array.isArray(response) ? response : []);
      const pagination = response?.pagination;

      setTableRows(Array.isArray(data) ? data : []);
      setTotalCount(Number(pagination?.totalCount || 0));
    } catch (error) {
      console.error("Error fetching revenue rates:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRentalProperties = async () => {
    try {
      const response = await api.list("rentalproperty");
      setRentalProperties(response);
    } catch (error) {
      console.error("Error fetching rental properties:", error);
    }
  };

  const fetchCommands = async () => {
    try {
      const response = await api.list("command");
      const arr = Array.isArray(response) ? response : [];
      setCommandOptions(
        arr.map((cmd) => ({
          id: Number(cmd?.id),
          name: String(cmd?.name ?? cmd?.value ?? cmd?.label ?? cmd?.Name ?? cmd?.Value ?? ""),
        }))
      );
    } catch (error) {
      console.error("Error fetching commands:", error);
      setCommandOptions([]);
    }
  };

  const fetchBases = async () => {
    try {
      const response = await api.list("base");
      const arr = Array.isArray(response) ? response : [];
      setBaseOptions(
        arr.map((base) => ({
          id: Number(base?.id),
          name: String(base?.name ?? base?.value ?? base?.label ?? base?.Name ?? base?.Value ?? ""),
          cmdId: Number(base?.cmdId ?? base?.cmd ?? base?.commandId ?? 0),
        }))
      );
    } catch (error) {
      console.error("Error fetching bases:", error);
      setBaseOptions([]);
    }
  };

  useEffect(() => {
    fetchRentalProperties();
    fetchCommands();
    fetchBases();
  }, []);

  useEffect(() => {
    fetchRevenueRates(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  const handleOpenForm = () => {
    setCurrentRevenueRate(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditRevenueRate = (id) => {
    // Handle both camelCase and PascalCase for id lookup
    const revenueRate = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!revenueRate) {
      console.error("Revenue rate not found for id:", id);
      return;
    }
    // Handle both camelCase and PascalCase for all fields
    const propertyId = revenueRate.propertyId ?? revenueRate.PropertyId ?? null;
    const applicableDate = revenueRate.applicableDate ?? revenueRate.ApplicableDate ?? null;
    const rate = revenueRate.rate ?? revenueRate.Rate ?? "";
    const attachments = revenueRate.attachments ?? revenueRate.Attachments ?? "";
    const status = revenueRate.status ?? revenueRate.Status ?? true;

    setCurrentRevenueRate({
      ...revenueRate,
      id: revenueRate.id ?? revenueRate.Id,
      propertyId: propertyId,
      applicableDate: applicableDate
        ? typeof applicableDate === "string"
          ? applicableDate.split("T")[0]
          : applicableDate
        : "",
      rate: rate || "",
      attachments: attachments || "",
      status: status !== undefined ? Boolean(status) : true,
    });
    setOpenForm(true);
  };

  const handleDeleteRevenueRate = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      await revenueRatesApi.remove(recordToDelete);
      fetchRevenueRates(pageNumber, pageSize);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting revenue rate:", error);
      alert("Failed to delete revenue rate. Please try again.");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };
  const handleViewAttachments = async (record) => {
    if (!record?.id) return;

    setAttachmentLoading(true);
    setAttachmentLoadingId(record.id);
    setCurrentViewingRecord(record);
    try {
      const response = await uploadApi.getUploadedFiles(record.id, "RevenueRates");
      // Handle response format: { files: [...] } or direct array
      const filesArray = response?.files || (Array.isArray(response) ? response : []);

      // Normalize the response to ensure we have fileName and downloadUrl
      const normalized = filesArray.map((f) => {
        // Handle different response formats
        if (typeof f === "string") {
          return {
            fileName: f.split(/[\\/]/).pop(),
            downloadUrl: f,
          };
        }
        // Extract fileName and downloadUrl from various possible field names
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
        return {
          ...f,
          fileName,
          downloadUrl,
        };
      });

      setAttachmentList(normalized);
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
  };

  const handleDownloadAttachment = (file) => {
    const downloadUrl =
      file?.downloadUrl || file?.fileUrl || file?.url || file?.filePath || file?.path;
    if (downloadUrl) {
      // If it's a relative path, prepend the API base URL
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

    if (!confirmDelete) {
      return;
    }

    try {
      await uploadApi.deleteUploadedFile(file.id);
      // Refresh the attachment list from the server
      const recordId = currentViewingRecord?.id;
      if (recordId) {
        const response = await uploadApi.getUploadedFiles(recordId, "RevenueRates");
        const filesArray = response?.files || (Array.isArray(response) ? response : []);
        const normalized = filesArray.map((f) => {
          if (typeof f === "string") {
            return {
              fileName: f.split(/[\\/]/).pop(),
              downloadUrl: f,
            };
          }
          const fileName =
            f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
          const downloadUrl =
            f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
          return {
            ...f,
            fileName,
            downloadUrl,
          };
        });
        setAttachmentList(normalized);
      } else {
        // If no record ID, just remove from list
        setAttachmentList((prev) => prev.filter((f) => f.id !== file.id));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(`Failed to delete file: ${error.message}`);
    }
  };

  const handleSubmit = async (data) => {
    try {
      const formattedData = {
        propertyId: Number(data.propertyId),
        applicableDate: data.applicableDate || null,
        rate: data.rate ? Number(data.rate) : null,
        attachments: data.attachments || null,
        status: data.status !== undefined ? Boolean(data.status) : true,
      };
      if (currentRevenueRate) {
        await revenueRatesApi.update(currentRevenueRate.id, formattedData);
      } else {
        await revenueRatesApi.create(formattedData);
      }
      fetchRevenueRates(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving revenue rate:", error);
    }
  };

  // Status cell renderer with PropTypes
  const StatusCell = ({ value }) => <StatusBadge value={value} />;
  StatusCell.propTypes = {
    value: PropTypes.oneOfType([PropTypes.bool, PropTypes.number, PropTypes.string]),
  };

  const columns = [
    {
      Header: "Actions",
      accessor: "actions",
      align: "center",
      width: "72px",
    },
    { Header: "ID", accessor: "id", align: "center", width: "56px" },
    {
      Header: "Property",
      accessor: "propertyId",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Handle both camelCase and PascalCase - use value from accessor first, then fallback
        const propId = value ?? row?.original?.propertyId ?? row?.original?.PropertyId ?? null;
        if (!propId) return "-";
        const property = rentalProperties.find((p) => Number(p.id) === Number(propId));
        return property ? property.pId ?? property.pid ?? property.PId ?? "" : String(propId);
      },
    },
    {
      Header: "Command",
      accessor: "cmdName",
      align: "left",
    },
    {
      Header: "Base",
      accessor: "baseName",
      align: "left",
    },
    {
      Header: "Class",
      accessor: "className",
      align: "left",
    },
    {
      Header: "Applicable Date",
      accessor: "applicableDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Handle both camelCase and PascalCase - use value from accessor first, then fallback
        const dateValue =
          value ?? row?.original?.applicableDate ?? row?.original?.ApplicableDate ?? null;
        return dateValue ? new Date(dateValue).toLocaleDateString() : "";
      },
    },
    {
      Header: "Revenue Rate",
      accessor: "rate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Handle both camelCase and PascalCase - use value from accessor first, then fallback
        const rateValue = value ?? row?.original?.rate ?? row?.original?.Rate ?? 0;
        return rateValue ? Number(rateValue).toLocaleString() : "";
      },
    },
    {
      Header: "Attachments",
      accessor: "attachments",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // Show view icon if record has been saved (has an id)
        // Files are uploaded separately, so we show the icon for any saved record
        // eslint-disable-next-line react/prop-types
        const rowData = row?.original || {};
        const hasAttachments = rowData?.id;
        const rawIsAttachment = rowData?.IsAttachment ?? rowData?.isAttachment;
        const countValue =
          rowData?.attachmentCount ??
          rowData?.attachmentsCount ??
          rowData?.filesCount ??
          rowData?.AttachmentCount ??
          rowData?.AttachmentsCount ??
          rowData?.FilesCount;
        const hasAttachmentData =
          rawIsAttachment === true ||
          rawIsAttachment === 1 ||
          rawIsAttachment === "1" ||
          String(rawIsAttachment || "")
            .trim()
            .toLowerCase() === "true" ||
          Number(countValue || 0) > 0;
        return hasAttachments ? (
          <IconButton
            size="small"
            color={hasAttachmentData ? "success" : "error"}
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
      align: "left",
      Cell: StatusCell,
    },
  ];

  const computedRows = tableRows.map((row) => {
    // Normalize id and propertyId (handle both camelCase and PascalCase)
    const normalizedId = row?.id ?? row?.Id;
    const propertyId = row.propertyId ?? row.PropertyId;
    const prop = rentalProperties.find((p) => Number(p.id) === Number(propertyId));

    return {
      ...row,
      id: normalizedId,
      propertyId: propertyId,
      rate: row.rate ?? row.Rate ?? 0,
      applicableDate: row.applicableDate ?? row.ApplicableDate ?? null,
      status: row.status ?? row.Status ?? true,
      cmdName:
        row.cmdName ??
        row.CmdName ??
        row.cmdname ??
        prop?.cmdName ??
        prop?.cmdname ??
        row.cmdId ??
        row.CmdId ??
        prop?.cmdId ??
        "",
      baseName:
        row.baseName ??
        row.BaseName ??
        row.basename ??
        prop?.baseName ??
        prop?.basename ??
        row.baseId ??
        row.BaseId ??
        prop?.baseId ??
        "",
      className:
        row.className ??
        row.ClassName ??
        row.classname ??
        prop?.className ??
        prop?.classname ??
        row.classId ??
        row.ClassId ??
        prop?.classId ??
        "",
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
            onClick={() => handleEditRevenueRate(normalizedId)}
            title="Edit"
            sx={{ padding: "1px" }}
          >
            <Icon>edit</Icon>
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteRevenueRate(normalizedId)}
            title="Delete"
            sx={{ padding: "1px" }}
          >
            <Icon>delete</Icon>
          </IconButton>
        </MDBox>
      ),
    };
  });

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
                  Revenue Rates
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              </MDBox>
              <MDBox
                pt={3}
                position="relative"
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

                <DataTable
                  table={{
                    columns,
                    rows: computedRows,
                  }}
                  isSorted={false}
                  entriesPerPage={{
                    defaultValue: pageSize,
                    entries: [10, 25, 50, 100],
                  }}
                  onEntriesPerPageChange={(value) => {
                    setPageSize(value);
                    setPageNumber(1);
                    fetchRevenueRates(1, value);
                  }}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch
                  exportFileName="Revenue-Rates"
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
                          .filter((page) => {
                            const totalPages = Math.ceil(totalCount / pageSize);
                            return (
                              page === 1 ||
                              page === totalPages ||
                              (page >= pageNumber - 2 && page <= pageNumber + 2)
                            );
                          })
                          .map((page, index, array) => {
                            const prevPage = array[index - 1];
                            const showEllipsis = prevPage && page - prevPage > 1;
                            return (
                              <React.Fragment key={page}>
                                {showEllipsis && (
                                  <MDPagination item disabled>
                                    ...
                                  </MDPagination>
                                )}
                                <MDPagination
                                  item
                                  active={page === pageNumber}
                                  onClick={() => setPageNumber(page)}
                                >
                                  {page}
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
      <RevenueRatesForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRevenueRate}
        rentalProperties={rentalProperties}
        commandOptions={commandOptions}
        baseOptions={baseOptions}
        onUploadSuccess={openSuccessSB}
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
          ) : attachmentList.length === 0 ? (
            <MDTypography variant="body2" color="text">
              No attachments uploaded for this record.
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
        </DialogContent>
        <DialogActions>
          <MDButton variant="outlined" color="secondary" onClick={handleCloseAttachmentDialog}>
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
      <MDSnackbar
        color="success"
        icon="check"
        title="Success"
        content="Files uploaded successfully!"
        open={successSB}
        onClose={closeSuccessSB}
        close={closeSuccessSB}
        bgWhite
      />
      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography variant="body1" sx={{ fontSize: "1.1rem" }}>
            Are you sure you want to delete this revenue rate? This action cannot be undone.
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
