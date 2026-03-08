import React, { useState, useEffect, useRef } from "react";
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
import MDPagination from "components/MDPagination";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
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
import { format, parseISO, isValid } from "date-fns";

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
    deactiveDate: "",
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
      // Handle both camelCase and PascalCase for all fields
      const applicableDateValue =
        initialData.applicableDate ||
        initialData.ApplicableDate ||
        initialData.applicationDate ||
        initialData.ApplicationDate ||
        "";
      const dateValue = applicableDateValue
        ? typeof applicableDateValue === "string"
          ? applicableDateValue.split("T")[0]
          : applicableDateValue
        : "";

      const deactiveDateValue = initialData.deactiveDate ?? initialData.DeactiveDate ?? "";
      const deactiveStr = deactiveDateValue
        ? typeof deactiveDateValue === "string"
          ? deactiveDateValue.split("T")[0]
          : String(deactiveDateValue).split("T")[0]
        : "";

      setForm({
        applicableDate: dateValue,
        deactiveDate: deactiveStr,
        cmdId: initialData.cmdId || initialData.CmdId || "",
        baseId: initialData.baseId || initialData.BaseId || "",
        classId: initialData.classId || initialData.ClassId || "",
        rate: initialData.rate || initialData.Rate || "",
        description: initialData.description || initialData.Description || "",
        status:
          initialData.status !== undefined
            ? initialData.status
            : initialData.Status !== undefined
            ? initialData.Status
            : true,
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
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "applicableDate" && next.deactiveDate && value) {
        const appTs = new Date(value).getTime();
        const deactTs = new Date(next.deactiveDate).getTime();
        if (deactTs <= appTs) next.deactiveDate = "";
      }
      return next;
    });
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
    if (!form.deactiveDate) newErrors.deactiveDate = "Deactive Date is required";
    if (form.applicableDate && form.deactiveDate && form.deactiveDate <= form.applicableDate) {
      newErrors.deactiveDate = "Deactive Date must be after Application Date";
    }
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
      deactiveDate: form.deactiveDate,
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

  const applicableDateInputRef = useRef(null);
  const deactiveDateInputRef = useRef(null);

  const toDisplayDate = (isoStr) => {
    if (!isoStr || typeof isoStr !== "string") return "";
    const trimmed = isoStr.trim();
    if (!trimmed) return "";
    try {
      const d = parseISO(trimmed);
      return isValid(d) ? format(d, "dd-MMM-yyyy") : trimmed;
    } catch {
      return trimmed;
    }
  };

  const openDatePicker = (ref) => {
    if (ref?.current) {
      if (ref.current.showPicker) ref.current.showPicker();
      else ref.current.click();
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
            <MDBox sx={{ position: "relative" }}>
              <input
                type="date"
                ref={applicableDateInputRef}
                value={form.applicableDate || ""}
                onChange={(e) => handleChange("applicableDate", e.target.value)}
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  top: 0,
                  left: 0,
                  cursor: "pointer",
                }}
                aria-hidden
              />
              <MDInput
                label="Application Date"
                type="text"
                value={toDisplayDate(form.applicableDate)}
                readOnly
                fullWidth
                size="small"
                required
                error={!!errors.applicableDate}
                helperText={errors.applicableDate}
                onClick={() => openDatePicker(applicableDateInputRef)}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                    </InputAdornment>
                  ),
                }}
                sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
              />
            </MDBox>
          </Grid>

          <Grid item xs={12} sm={6}>
            <MDBox sx={{ position: "relative" }}>
              <input
                type="date"
                ref={deactiveDateInputRef}
                value={form.deactiveDate || ""}
                onChange={(e) => handleChange("deactiveDate", e.target.value)}
                min={
                  form.applicableDate
                    ? (() => {
                        const d = new Date(form.applicableDate);
                        d.setDate(d.getDate() + 1);
                        return d.toISOString().split("T")[0];
                      })()
                    : undefined
                }
                style={{
                  position: "absolute",
                  opacity: 0,
                  width: "100%",
                  height: "100%",
                  top: 0,
                  left: 0,
                  cursor: "pointer",
                }}
                aria-hidden
              />
              <MDInput
                label="Deactive Date *"
                type="text"
                value={toDisplayDate(form.deactiveDate)}
                readOnly
                fullWidth
                size="small"
                required
                error={!!errors.deactiveDate}
                helperText={errors.deactiveDate}
                disabled={!form.applicableDate || !String(form.applicableDate).trim()}
                onClick={() => openDatePicker(deactiveDateInputRef)}
                InputProps={{
                  readOnly: true,
                  endAdornment: (
                    <InputAdornment position="end">
                      <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                    </InputAdornment>
                  ),
                }}
                sx={{ ...inputSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
              />
            </MDBox>
          </Grid>

          <Grid item xs={12} sm={6}>
            <FormControl size="small" fullWidth required error={!!errors.cmdId}>
              <InputLabel id="cmd-label">RAC</InputLabel>
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
    // Handle both camelCase and PascalCase for id lookup
    const record = tableRows.find(
      (row) => (row.id ?? row.Id) === id || Number(row.id ?? row.Id) === Number(id)
    );
    if (!record) {
      console.error("Record not found for id:", id);
      return;
    }
    // Handle both camelCase and PascalCase for all fields
    const applicableDate = record.applicableDate ?? record.ApplicableDate ?? null;
    const applicationDate = record.applicationDate ?? record.ApplicationDate ?? null;
    const deactiveDate = record.deactiveDate ?? record.DeactiveDate ?? null;
    const cmdId = record.cmdId ?? record.CmdId ?? "";
    const baseId = record.baseId ?? record.BaseId ?? "";
    const classId = record.classId ?? record.ClassId ?? "";
    const rate = record.rate ?? record.Rate ?? "";
    const description = record.description ?? record.Description ?? "";
    const status = record.status ?? record.Status ?? true;

    setCurrentRecord({
      ...record,
      id: record.id ?? record.Id,
      applicableDate: applicableDate
        ? typeof applicableDate === "string"
          ? applicableDate.split("T")[0]
          : applicableDate
        : applicationDate
        ? typeof applicationDate === "string"
          ? applicationDate.split("T")[0]
          : applicationDate
        : "",
      deactiveDate: deactiveDate
        ? typeof deactiveDate === "string"
          ? deactiveDate.split("T")[0]
          : String(deactiveDate).split("T")[0]
        : "",
      cmdId: cmdId || "",
      baseId: baseId || "",
      classId: classId || "",
      rate: rate || "",
      description: description || "",
      status: status !== undefined ? Boolean(status) : true,
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

  // Format date for display as dd-MMM-yyyy (e.g., 10-Feb-2026)
  const formatDateDDMMMYYYY = (dateString) => {
    if (!dateString) return "";
    const raw = String(dateString).trim();
    if (!raw) return "";

    const monthShort = [
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    try {
      const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
      let day = "";
      let month = "";
      let year = "";

      // yyyy-mm-dd
      if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
        [year, month, day] = datePart.split("-");
      }
      // dd-mm-yyyy
      else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
        [day, month, year] = datePart.split("-");
      } else {
        const parsed = new Date(raw);
        if (!Number.isFinite(parsed.getTime())) return raw;
        day = String(parsed.getDate()).padStart(2, "0");
        month = String(parsed.getMonth() + 1).padStart(2, "0");
        year = String(parsed.getFullYear());
      }

      const monthIndex = Number(month) - 1;
      const monthText = monthShort[monthIndex] || month;
      return `${String(day).padStart(2, "0")}-${monthText}-${year}`;
    } catch (e) {
      return dateString;
    }
  };

  // Excel export cell formatter to format dates as dd-mmm-yyyy
  const exportCellFormatter = ({ value, column }) => {
    const colId = String(column?.id || "").toLowerCase();
    if (colId === "applicabledate" || colId === "applicationdate" || colId === "deactivedate") {
      return formatDateDDMMMYYYY(value);
    }
    return value;
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
      Header: "S.No",
      accessor: "sno",
      align: "center",
      width: "60px",
      // eslint-disable-next-line react/prop-types
      Cell: ({ row }) => {
        // eslint-disable-next-line react/prop-types
        const rowId = row.original.id ?? row.original.Id;
        const index = tableRows.findIndex((r) => (r.id ?? r.Id) === rowId);
        return (pageNumber - 1) * pageSize + index + 1;
      },
    },
    {
      Header: "Application Date",
      accessor: "applicableDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        // Support both camelCase and PascalCase field names
        const rowData = row?.original || {};
        const dateValue =
          value ||
          rowData.applicableDate ||
          rowData.ApplicableDate ||
          rowData.applicationDate ||
          rowData.ApplicationDate ||
          "";
        return formatDateDDMMMYYYY(dateValue);
      },
    },
    {
      Header: "Deactive Date",
      accessor: "deactiveDate",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const rowData = row?.original || {};
        const dateValue = value || rowData.deactiveDate || rowData.DeactiveDate || "";
        return formatDateDDMMMYYYY(dateValue) || "-";
      },
    },
    {
      Header: "RAC",
      accessor: "cmdName",
      align: "left",
      // eslint-disable-next-line react/prop-types
      Cell: ({ value, row }) => {
        const cmdId = row?.original?.cmdId ?? row?.original?.CmdId ?? null;
        if (!cmdId) return value || "-";
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
        const baseId = row?.original?.baseId ?? row?.original?.BaseId ?? null;
        if (!baseId) return value || "-";
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
        const classId = row?.original?.classId ?? row?.original?.ClassId ?? null;
        if (!classId) return value || "-";
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

  const computedRows = tableRows.map((row, index) => {
    // Normalize id and foreign keys (handle both camelCase and PascalCase)
    const normalizedId = row?.id ?? row?.Id;
    const sno = (pageNumber - 1) * pageSize + index + 1;
    const classId = row.classId ?? row.ClassId;
    const cmdId = row.cmdId ?? row.CmdId;
    const baseId = row.baseId ?? row.BaseId;

    const classItem = classes.find((c) => Number(c.id) === Number(classId));
    const cmdItem = commands.find((c) => Number(c.id) === Number(cmdId));
    const baseItem = bases.find((b) => Number(b.id) === Number(baseId));

    // Check IsAttachment field (handle both camelCase and PascalCase)
    const rawIsAttachment = row?.IsAttachment ?? row?.isAttachment;
    const countValue =
      row?.attachmentCount ??
      row?.attachmentsCount ??
      row?.filesCount ??
      row?.AttachmentCount ??
      row?.AttachmentsCount ??
      row?.FilesCount;

    // Determine if attachments exist
    const hasAttachmentData =
      rawIsAttachment === true ||
      rawIsAttachment === 1 ||
      rawIsAttachment === "1" ||
      String(rawIsAttachment || "")
        .trim()
        .toLowerCase() === "true" ||
      Number(countValue || 0) > 0;

    return {
      ...row,
      id: normalizedId,
      sno: sno,
      cmdId: cmdId,
      baseId: baseId,
      classId: classId,
      cmdName: cmdItem?.name ?? row.cmdName ?? row.CmdName ?? row.cmdname ?? "",
      baseName: baseItem?.name ?? row.baseName ?? row.BaseName ?? row.basename ?? "",
      className: classItem?.name ?? row.className ?? row.ClassName ?? row.classname ?? "",
      rate: row.rate ?? row.Rate ?? 0,
      description: row.description ?? row.Description ?? "",
      status: row.status ?? row.Status ?? true,
      applicableDate:
        row.applicableDate ??
        row.ApplicableDate ??
        row.applicationDate ??
        row.ApplicationDate ??
        "",
      attachments: (
        <IconButton
          size="small"
          color={hasAttachmentData ? "success" : "error"}
          onClick={() => handleOpenAttachments(normalizedId)}
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
            onClick={() => handleEditRecord(normalizedId)}
            title="Edit"
            sx={{ padding: "1px" }}
          >
            <Icon>edit</Icon>
          </IconButton>
          <IconButton
            size="small"
            color="error"
            onClick={() => handleDeleteRecord(normalizedId)}
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
                    defaultValue: 20,
                    entries: [10, 25, 50, 100],
                  }}
                  pageSize={pageSize}
                  onEntriesPerPageChange={(value) => {
                    setPageSize(value);
                    setPageNumber(1);
                    fetchRentalValueRates(1, value);
                  }}
                  showTotalEntries={false}
                  noEndBorder
                  canSearch
                  exportFileName="Rental-Value-Rate"
                  exportCellFormatter={exportCellFormatter}
                />

                {/* Server-side Pagination Footer */}
                <MDBox
                  display="flex"
                  flexDirection={{ xs: "column", sm: "row" }}
                  justifyContent="flex-start"
                  alignItems={{ xs: "flex-start", sm: "center" }}
                  p={3}
                  gap={2}
                >
                  <MDBox mb={{ xs: 3, sm: 0 }} display="flex" alignItems="center" gap={2}>
                    <MDTypography variant="button" color="secondary" fontWeight="regular">
                      {(() => {
                        const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
                        return displayTotal === 0
                          ? "0 of 0 entries"
                          : `${Math.min(
                              pageNumber * pageSize,
                              displayTotal
                            )} of ${displayTotal} entries`;
                      })()}
                    </MDTypography>
                    {(() => {
                      const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
                      return displayTotal > 0 && Math.ceil(displayTotal / pageSize) > 1;
                    })() && (
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
                </MDBox>
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
