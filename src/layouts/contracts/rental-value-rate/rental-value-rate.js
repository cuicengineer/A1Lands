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
import Chip from "@mui/material/Chip";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import StatusBadge from "components/StatusBadge";
import CurrencyLoading from "components/CurrencyLoading";
import PropTypes from "prop-types";
import api from "services/api.service";
import uploadApi from "services/api.upload.service";
import rentalValueRateApi from "services/api.rentalvaluerate.service";

function RentalValueRateForm({
  open,
  onClose,
  onSubmit,
  initialData,
  classes,
  commands,
  bases,
  onUploadSuccess,
}) {
  const [form, setForm] = useState({
    applicableDate: "",
    cmdId: "",
    baseId: "",
    classId: "",
    rate: "",
    description: "",
    status: true,
  });
  const [errors, setErrors] = useState({});
  const [filteredBases, setFilteredBases] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);

  // Filter bases based on selected command
  useEffect(() => {
    if (form.cmdId && bases.length > 0) {
      const filtered = bases.filter((base) => Number(base.cmd) === Number(form.cmdId));
      setFilteredBases(filtered);
      // Clear base if it's no longer valid
      if (form.baseId && !filtered.find((b) => b.id === form.baseId)) {
        setForm((prev) => ({ ...prev, baseId: "" }));
      }
    } else {
      setFilteredBases([]);
      if (form.baseId) {
        setForm((prev) => ({ ...prev, baseId: "" }));
      }
    }
  }, [form.cmdId, bases]);

  useEffect(() => {
    if (initialData) {
      setForm({
        applicableDate: initialData.applicableDate
          ? initialData.applicableDate.split("T")[0]
          : initialData.applicationDate
          ? initialData.applicationDate.split("T")[0]
          : "",
        cmdId: initialData.cmdId || "",
        baseId: initialData.baseId || "",
        classId: initialData.classId || "",
        rate: initialData.rate || "",
        description: initialData.description || "",
        status: initialData.status !== undefined ? initialData.status : true,
      });
    } else {
      setForm({
        applicableDate: "",
        cmdId: "",
        baseId: "",
        classId: "",
        rate: "",
        description: "",
        status: true,
      });
    }
    setErrors({});
    // Reset new files when dialog opens
    setSelectedFiles([]);
    // Fetch existing uploaded files if editing
    if (initialData && initialData.id) {
      fetchExistingFiles(initialData.id);
    } else {
      setExistingFiles([]);
    }
  }, [initialData, open]);

  const fetchExistingFiles = async (id) => {
    setLoadingExistingFiles(true);
    try {
      const response = await uploadApi.getUploadedFiles(id, "RentalValueRate");
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
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files);
    const totalExistingFiles = existingFiles.length;
    const totalSelectedFiles = selectedFiles.length;
    const totalFiles = totalExistingFiles + totalSelectedFiles;
    const remainingSlots = 2 - totalFiles;

    if (totalFiles >= 2) {
      alert(
        "Maximum 2 files allowed. Please delete some existing files before uploading new ones."
      );
      event.target.value = "";
      return;
    }

    if (files.length > remainingSlots) {
      alert(
        `You can only upload ${remainingSlots} more file(s). Maximum 2 files allowed (${totalExistingFiles} already uploaded).`
      );
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

    if (totalFiles + validFiles.length > 2) {
      const allowedCount = 2 - totalFiles;
      alert(
        `You can only upload ${allowedCount} more file(s). Maximum 2 files allowed (${totalExistingFiles} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
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

  const validate = () => {
    const newErrors = {};
    if (!form.applicableDate) newErrors.applicableDate = "Application Date is required";
    if (!form.cmdId) newErrors.cmdId = "Command is required";
    if (!form.baseId) newErrors.baseId = "Base is required";
    if (!form.classId) newErrors.classId = "Class is required";
    if (!form.rate) newErrors.rate = "Rate is required";
    if (!form.description?.trim()) newErrors.description = "Description is required";
    if (form.description && form.description.length > 250) {
      newErrors.description = "Description must not exceed 250 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    const payload = {
      applicableDate: form.applicableDate,
      cmdId: Number(form.cmdId),
      baseId: Number(form.baseId),
      classId: Number(form.classId),
      rate: form.rate ? Number(form.rate) : null,
      description: form.description.trim(),
      status: form.status,
      category: "RentalValue", // Static value, not displayed to user
      type: 1, // Static value, not displayed to user
    };

    const result = await onSubmit(payload);

    // Get the record ID (either from existing or newly created)
    const recordId = initialData?.id || result?.id;

    // If files are selected, upload them
    if (recordId && selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        await uploadApi.uploadFiles(recordId, "RentalValueRate", selectedFiles);
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

  const inputSx = {
    "& .MuiInputBase-input": {
      fontSize: "1rem",
      padding: "10px 12px",
      minHeight: "45px",
    },
    "& .MuiInputLabel-root": {
      fontSize: "1rem",
    },
  };

  const selectSx = {
    fontSize: "1rem",
    "& .MuiSelect-select": {
      fontSize: "1rem",
      padding: "10px 12px",
      minHeight: "45px",
    },
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {initialData ? "Edit Rental Value Rate" : "New Rental Value Rate"}
      </DialogTitle>
      <DialogContent>
        <Grid container spacing={3} mt={1}>
          <Grid item xs={12} sm={6}>
            <MDInput
              label="Application Date"
              type="date"
              value={form.applicableDate}
              onChange={(e) => handleChange("applicableDate", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.applicableDate}
              helperText={errors.applicableDate}
              InputLabelProps={{ shrink: true }}
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth required error={!!errors.cmdId}>
              <InputLabel id="cmd-label">Command</InputLabel>
              <Select
                labelId="cmd-label"
                value={form.cmdId}
                label="Command"
                onChange={(e) => handleChange("cmdId", e.target.value)}
                sx={selectSx}
              >
                {commands.map((cmd) => (
                  <MenuItem key={cmd.id} value={cmd.id}>
                    {cmd.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.cmdId && (
                <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.cmdId}
                </MDTypography>
              )}
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl
              size="small"
              fullWidth
              required
              error={!!errors.baseId}
              disabled={!form.cmdId}
            >
              <InputLabel id="base-label">Base</InputLabel>
              <Select
                labelId="base-label"
                value={form.baseId}
                label="Base"
                onChange={(e) => handleChange("baseId", e.target.value)}
                sx={selectSx}
              >
                {filteredBases.map((base) => (
                  <MenuItem key={base.id} value={base.id}>
                    {base.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.baseId && (
                <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.baseId}
                </MDTypography>
              )}
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth required error={!!errors.classId}>
              <InputLabel id="class-label">Class</InputLabel>
              <Select
                labelId="class-label"
                value={form.classId}
                label="Class"
                onChange={(e) => handleChange("classId", e.target.value)}
                sx={selectSx}
              >
                {classes.map((cls) => (
                  <MenuItem key={cls.id} value={cls.id}>
                    {cls.name}
                  </MenuItem>
                ))}
              </Select>
              {errors.classId && (
                <MDTypography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                  {errors.classId}
                </MDTypography>
              )}
            </FormControl>
          </Grid>

          <Grid item xs={12} sm={6}>
            <MDInput
              label="% Rate"
              type="number"
              value={form.rate}
              onChange={(e) => handleChange("rate", e.target.value)}
              fullWidth
              size="small"
              required
              error={!!errors.rate}
              helperText={errors.rate}
              sx={inputSx}
            />
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth>
              <InputLabel id="status-label">Status</InputLabel>
              <Select
                labelId="status-label"
                value={form.status !== undefined ? form.status : true}
                label="Status"
                onChange={(e) => handleChange("status", e.target.value)}
                sx={selectSx}
              >
                <MenuItem value={true}>Active</MenuItem>
                <MenuItem value={false}>Inactive</MenuItem>
              </Select>
            </FormControl>
          </Grid>

          <Grid item xs={12}>
            <MDInput
              label="Description"
              type="text"
              value={form.description}
              onChange={(e) => handleChange("description", e.target.value)}
              fullWidth
              size="small"
              required
              multiline
              rows={3}
              error={!!errors.description}
              helperText={errors.description || `${form.description.length}/250 characters`}
              inputProps={{ maxLength: 250 }}
              sx={inputSx}
            />
          </Grid>

          {/* Attachments - File Upload */}
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
                Attachments (Max 2 files total)
              </MDTypography>

              {/* Existing uploaded files (read-only) */}
              {initialData && initialData.id && (
                <>
                  {loadingExistingFiles ? (
                    <MDBox display="flex" justifyContent="center" py={1}>
                      <CurrencyLoading size={20} />
                    </MDBox>
                  ) : (
                    existingFiles.length > 0 && (
                      <MDBox mb={2}>
                        <MDTypography
                          variant="caption"
                          color="text"
                          sx={{ display: "block", mb: 1 }}
                        >
                          Already uploaded files ({existingFiles.length}/2):
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
                </>
              )}

              {/* New files to upload */}
              {existingFiles.length >= 2 ? (
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
                    Maximum 2 files already uploaded. Please delete existing files to upload new
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
                    disabled={existingFiles.length + selectedFiles.length >= 2 || isUploading}
                  />
                  <label htmlFor="file-upload-input">
                    <MDButton
                      variant="gradient"
                      color="info"
                      component="span"
                      disabled={existingFiles.length + selectedFiles.length >= 2 || isUploading}
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
                      Upload Files ({existingFiles.length + selectedFiles.length}/2)
                    </MDButton>
                  </label>
                  {existingFiles.length + selectedFiles.length < 2 && (
                    <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
                      You can upload {2 - (existingFiles.length + selectedFiles.length)} more
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
                  No files selected. Click &quot;Upload Files&quot; to add attachments.
                </MDTypography>
              )}
            </MDBox>
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

RentalValueRateForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  classes: PropTypes.array.isRequired,
  commands: PropTypes.array.isRequired,
  bases: PropTypes.array.isRequired,
  onUploadSuccess: PropTypes.func,
};

export default function RentalValueRate() {
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [tableRows, setTableRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);
  const [attachmentsForId, setAttachmentsForId] = useState(null);

  const getAttachmentPath = (file) =>
    file?.Path ||
    file?.path ||
    file?.filePath ||
    file?.file_path ||
    file?.downloadUrl ||
    file?.fileUrl ||
    file?.url ||
    "";

  const refreshAttachments = async (recordId) => {
    const response = await uploadApi.getUploadedFiles(recordId, "RentalValueRate");
    const filesArray = response?.files || (Array.isArray(response) ? response : []);
    const normalized = filesArray
      .map((f) => {
        if (typeof f === "string") {
          return {
            fileName: f.split(/[\\/]/).pop(),
            downloadUrl: f,
          };
        }
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl =
          f?.Path || f?.path || f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || "";
        return { ...f, fileName, downloadUrl };
      })
      .filter((f) => getAttachmentPath(f));
    setAttachmentsFiles(normalized);
  };

  const fetchRentalValueRates = async (page = pageNumber, size = pageSize) => {
    setLoading(true);
    try {
      const response = await rentalValueRateApi.getAll(page, size);
      const data = response?.data ?? (Array.isArray(response) ? response : []);
      const pagination = response?.pagination;

      setTableRows(Array.isArray(data) ? data : []);
      setTotalCount(Number(pagination?.totalCount || 0));
    } catch (error) {
      console.error("Error fetching rental value rates:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const response = await api.list("class");
      setClasses(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching classes:", error);
    }
  };

  const fetchCommands = async () => {
    try {
      const response = await api.list("command");
      setCommands(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching commands:", error);
    }
  };

  const fetchBases = async () => {
    try {
      const response = await api.list("base");
      setBases(Array.isArray(response) ? response : []);
    } catch (error) {
      console.error("Error fetching bases:", error);
    }
  };

  useEffect(() => {
    fetchClasses();
    fetchCommands();
    fetchBases();
  }, []);

  useEffect(() => {
    fetchRentalValueRates(pageNumber, pageSize);
  }, [pageNumber, pageSize]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => setOpenForm(false);

  const handleEditRecord = (id) => {
    const record = tableRows.find((row) => row.id === id);
    setCurrentRecord({
      ...record,
      applicableDate: record.applicableDate
        ? record.applicableDate.split("T")[0]
        : record.applicationDate
        ? record.applicationDate.split("T")[0]
        : "",
      cmdId: record.cmdId || "",
      baseId: record.baseId || "",
      classId: record.classId || "",
      rate: record.rate || "",
      description: record.description || "",
      status: record.status !== undefined ? record.status : true,
    });
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;

    try {
      await rentalValueRateApi.remove(recordToDelete);
      fetchRentalValueRates(pageNumber, pageSize);
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    } catch (error) {
      console.error("Error deleting rental value rate:", error);
      alert("Failed to delete rental value rate. Please try again.");
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleOpenAttachments = async (recordId) => {
    if (!recordId) return;
    setAttachmentsForId(recordId);
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    try {
      await refreshAttachments(recordId);
    } catch (error) {
      console.error("Error fetching attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleDeleteAttachment = async (file) => {
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      alert("File ID is not available. Cannot delete this file.");
      return;
    }

    const confirmDelete = window.confirm(
      `Are you sure you want to delete "${file.fileName || file.name || "this file"}"?`
    );
    if (!confirmDelete) return;

    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (attachmentsForId) {
        setAttachmentsLoading(true);
        await refreshAttachments(attachmentsForId);
      } else {
        setAttachmentsFiles((prev) => prev.filter((f) => (f?.id || f?.fileId) !== fileId));
      }
    } catch (error) {
      console.error("Error deleting attachment:", error);
      alert(`Failed to delete file: ${error.message}`);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsFiles([]);
    setAttachmentsForId(null);
  };

  const handleSubmit = async (data) => {
    try {
      if (currentRecord && currentRecord.id) {
        await rentalValueRateApi.update(currentRecord.id, data);
      } else {
        await rentalValueRateApi.create(data);
      }
      fetchRentalValueRates(pageNumber, pageSize);
      handleCloseForm();
    } catch (error) {
      console.error("Error saving rental value rate:", error);
      alert("Failed to save rental value rate. Please try again.");
    }
  };

  // Format date for display
  const formatDateDDMMYYYY = (dateString) => {
    if (!dateString) return "-";
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, "0");
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch (e) {
      return dateString;
    }
  };

  const columns = [
    {
      Header: "Action",
      accessor: "actions",
      align: "center",
      width: "72px",
    },
    {
      Header: "Attach",
      accessor: "attachments",
      align: "center",
      width: "60px",
    },
    {
      Header: "Sno",
      accessor: "sno",
      align: "center",
      width: "60px",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const index = tableRows.findIndex((r) => r.id === row.original.id);
        return (pageNumber - 1) * pageSize + index + 1;
      },
    },
    {
      Header: "Application Date",
      accessor: "applicableDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Support both field names for backward compatibility
        const dateValue = value || row.original.applicationDate;
        return formatDateDDMMYYYY(dateValue);
      },
    },
    {
      Header: "Command",
      accessor: "cmdName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const cmdId = row.original.cmdId;
        const cmdItem = commands.find((c) => Number(c.id) === Number(cmdId));
        return cmdItem ? cmdItem.name : value || "-";
      },
    },
    {
      Header: "Base",
      accessor: "baseName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const baseId = row.original.baseId;
        const baseItem = bases.find((b) => Number(b.id) === Number(baseId));
        return baseItem ? baseItem.name : value || "-";
      },
    },
    {
      Header: "Class",
      accessor: "className",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const classId = row.original.classId;
        const classItem = classes.find((c) => Number(c.id) === Number(classId));
        return classItem ? classItem.name : value || "-";
      },
    },
    {
      Header: "% Rate",
      accessor: "rate",
      align: "right",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => (value ? `${Number(value).toLocaleString()}%` : "-"),
    },
    { Header: "Description", accessor: "description", align: "left" },
    {
      Header: "Status",
      accessor: "status",
      align: "center",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value }) => <StatusBadge value={value} />,
    },
  ];

  const computedRows = tableRows.map((row) => {
    const classItem = classes.find((c) => Number(c.id) === Number(row.classId));
    const cmdItem = commands.find((c) => Number(c.id) === Number(row.cmdId));
    const baseItem = bases.find((b) => Number(b.id) === Number(row.baseId));

    return {
      ...row,
      cmdName: cmdItem?.name || row.cmdName || row.cmdname || "",
      baseName: baseItem?.name || row.baseName || row.basename || "",
      className: classItem?.name || row.className || row.classname || "",
      attachments: (
        <IconButton
          size="small"
          color="info"
          onClick={() => handleOpenAttachments(row.id)}
          title="View Attachments"
          sx={{ padding: "1px" }}
        >
          <Icon>visibility</Icon>
        </IconButton>
      ),
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
            onClick={() => handleEditRecord(row.id)}
            title="Edit"
            sx={{ padding: "1px" }}
          >
            <Icon>edit</Icon>
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteRecord(row.id)}
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
                  Rental Value Rate
                </MDTypography>
                <MDButton variant="contained" color="white" onClick={handleOpenForm}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              </MDBox>
              <MDBox
                pt={3}
                position="relative"
                sx={{
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
                    fetchRentalValueRates(1, value);
                  }}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch
                  exportFileName="Rental-Value-Rate"
                />
              </MDBox>
            </Card>
          </Grid>
        </Grid>
      </MDBox>

      <RentalValueRateForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        classes={classes}
        commands={commands}
        bases={bases}
        onUploadSuccess={() => {
          fetchRentalValueRates(pageNumber, pageSize);
        }}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this record?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error">
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog open={attachmentsDialogOpen} onClose={handleCloseAttachments} fullWidth maxWidth="sm">
        <DialogTitle>Attachments {attachmentsForId ? `(#${attachmentsForId})` : ""}</DialogTitle>
        <DialogContent dividers>
          {attachmentsLoading ? (
            <MDBox display="flex" justifyContent="center" py={2}>
              <CurrencyLoading size={28} />
            </MDBox>
          ) : attachmentsFiles.length > 0 ? (
            <MDBox display="flex" flexDirection="column" gap={1}>
              {attachmentsFiles.map((f, idx) => (
                <MDBox
                  key={`${f.fileName || "file"}-${idx}`}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={() => {
                      const path = getAttachmentPath(f);
                      if (!path) {
                        alert("File path is not available for this attachment.");
                        return;
                      }
                      uploadApi
                        .downloadFileByPath(path, f.fileName || `File-${idx + 1}`)
                        .catch((e) => alert(`Download failed: ${e.message}`));
                    }}
                    sx={{ justifyContent: "flex-start", flex: 1 }}
                  >
                    <Icon sx={{ mr: 1 }}>attach_file</Icon>
                    {f.fileName || `File ${idx + 1}`}
                  </MDButton>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleDeleteAttachment(f)}
                    title="Delete Attachment"
                    sx={{ border: "1px solid", borderColor: "error.main", borderRadius: 1 }}
                  >
                    <Icon>delete</Icon>
                  </IconButton>
                </MDBox>
              ))}
            </MDBox>
          ) : (
            <MDTypography variant="body2" color="text">
              No attachments found for this record.
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseAttachments} variant="gradient" color="info">
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
