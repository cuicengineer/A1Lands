import React, { useState, useEffect } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import MDButton from "components/MDButton";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import Icon from "@mui/material/Icon";
import Autocomplete from "@mui/material/Autocomplete";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import FormHelperText from "@mui/material/FormHelperText";
import Chip from "@mui/material/Chip";
import api from "../../../../src/services/api.service";
import uploadApi from "services/api.upload.service";
import CurrencyLoading from "components/CurrencyLoading";

function getClassUoM(classRow) {
  if (!classRow) return "";
  return String(classRow.uoM ?? classRow.UoM ?? classRow.uom ?? "").trim();
}

function RentalPropertyForm({
  open,
  onClose,
  onSubmit,
  initialData,
  onUploadSuccess,
  lockedBaseId,
}) {
  // Match "New Property Grouping" form styling (compact, simple, consistent)
  const MENU_PROPS = {
    PaperProps: {
      style: { maxHeight: 300 },
    },
  };
  const labelSx = { fontSize: "1rem" };
  const formControlSx = { minWidth: "140px" };
  const selectSx = {
    fontSize: "1rem",
    "& .MuiSelect-select": {
      fontSize: "1rem",
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
      right: "8px",
    },
  };
  const menuItemSx = { fontSize: "1rem", padding: "8px 14px" };
  const inputSx = {
    "& .MuiInputBase-input": { fontSize: "1rem" },
    "& .MuiInputLabel-root": { fontSize: "1rem" },
  };
  const dialogFooterButtonSx = {
    color: "#ffffff !important",
    "& .MuiSvgIcon-root": {
      color: "#ffffff !important",
    },
    "& *": {
      color: "#ffffff !important",
    },
  };

  const [form, setForm] = useState({
    cmdId: "",
    baseId: "",
    classId: "",
    pId: "",
    uoM: "",
    area: 0,
    location: "",
    remarks: "",
    status: false,
  });
  const [errors, setErrors] = useState({});

  const [commands, setCommands] = useState([]);
  const [bases, setBases] = useState([]);
  const [allBases, setAllBases] = useState([]); // New state to store all bases
  const [classes, setClasses] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);

  useEffect(() => {
    const fetchCommands = async () => {
      try {
        const response = await api.list("command");
        setCommands(response);
      } catch (error) {
        console.error("Error fetching commands:", error);
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

    const fetchAllBases = async () => {
      try {
        const response = await api.list("base");
        setAllBases(response);
      } catch (error) {
        console.error("Error fetching all bases:", error);
      }
    };

    // Only fetch dropdown lists when the dialog is opened (Add/Edit)
    if (!open) return;

    // Avoid refetching if already loaded
    if (commands.length === 0) fetchCommands();
    if (classes.length === 0) fetchClasses();
    if (allBases.length === 0) fetchAllBases();
    if (allBases.length === 0) fetchAllBases();
  }, [open, commands.length, classes.length, allBases.length]);

  useEffect(() => {
    if (form.cmdId && allBases.length > 0) {
      const filteredBases = allBases.filter((base) => Number(base.cmd) === Number(form.cmdId));
      setBases(filteredBases);
    } else {
      setBases([]);
    }
  }, [form.cmdId, allBases]);

  useEffect(() => {
    setErrors({});
    if (initialData) {
      const classId = initialData.classId || "";
      const newForm = {
        cmdId: initialData.cmdId || "",
        baseId: initialData.baseId || "",
        classId,
        pId: initialData.pId || "",
        uoM: initialData.uoM || "",
        area: initialData.area || 0,
        location: initialData.location || "",
        remarks: initialData.remarks || "",
        status:
          initialData.status === true || initialData.status === 1 || initialData.status === "1",
      };
      let currentFilteredBases = [];
      if (newForm.cmdId && allBases.length > 0) {
        currentFilteredBases = allBases.filter(
          (base) => Number(base.cmd) === Number(newForm.cmdId)
        );
        setBases(currentFilteredBases);
      } else {
        setBases([]);
      }

      // Validate baseId against filtered bases
      if (
        newForm.baseId &&
        !currentFilteredBases.some((base) => Number(base.id) === Number(newForm.baseId))
      ) {
        newForm.baseId = ""; // Reset if not found in filtered bases
      }
      if (classId && classes.length > 0) {
        const classUoM = getClassUoM(classes.find((c) => Number(c.id) === Number(classId)));
        if (classUoM) newForm.uoM = classUoM;
      }
      setForm(newForm);
    } else if (lockedBaseId != null) {
      const base = allBases.length
        ? allBases.find((b) => Number(b.id) === Number(lockedBaseId))
        : null;
      if (base) {
        setForm({
          cmdId: base.cmd != null ? Number(base.cmd) : "",
          baseId: base.id != null ? Number(base.id) : "",
          classId: "",
          pId: "",
          uoM: "",
          area: 0,
          location: "",
          remarks: "",
          status: false,
        });
        setBases(allBases.filter((b) => Number(b.cmd) === Number(base.cmd)));
      } else {
        setForm({
          cmdId: "",
          baseId: "",
          classId: "",
          pId: "",
          uoM: "",
          area: 0,
          location: "",
          remarks: "",
          status: false,
        });
        setBases([]);
      }
    } else {
      setForm({
        cmdId: "",
        baseId: "",
        classId: "",
        pId: "",
        uoM: "",
        area: 0,
        location: "",
        remarks: "",
        status: false,
      });
      setBases([]); // Clear bases when adding new property
    }
    // Reset files when form opens/closes
    if (open) {
      if (initialData && initialData.id) {
        fetchExistingFiles(initialData.id);
      } else {
        setExistingFiles([]);
        setSelectedFiles([]);
      }
    } else {
      setExistingFiles([]);
      setSelectedFiles([]);
    }
  }, [initialData, allBases, classes, open, lockedBaseId]);

  const fetchExistingFiles = async (id) => {
    setLoadingExistingFiles(true);
    try {
      const response = await uploadApi.getUploadedFiles(id, "RentalProperties");
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

  const resolveUoMForClassId = (classId) => {
    const selectedClass = classes.find((c) => Number(c.id) === Number(classId));
    return getClassUoM(selectedClass);
  };

  useEffect(() => {
    if (!form.classId || classes.length === 0) return;
    const classUoM = resolveUoMForClassId(form.classId);
    if (classUoM && (form.uoM || "") !== classUoM) {
      setForm((prev) => ({ ...prev, uoM: classUoM }));
    }
  }, [form.classId, classes]);

  const handleChange = (field, value) => {
    const normalizedValue =
      field === "status"
        ? value === true || value === "true" || value === 1 || value === "1"
        : value;

    setForm((prevForm) => ({
      ...prevForm,
      [field]: field === "area" ? Number(normalizedValue) : normalizedValue,
      ...(field === "cmdId" && lockedBaseId == null && { baseId: "", classId: "", uoM: "" }),
      ...(field === "baseId" && { classId: "", uoM: "" }),
      ...(field === "classId" && { uoM: resolveUoMForClassId(normalizedValue) }),
    }));
    if (errors?.[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === "classId" && errors?.uoM) {
      setErrors((prev) => ({ ...prev, uoM: undefined }));
    }
  };

  const isAddMode = !initialData;

  const isEmpty = (val) => {
    if (val === null || val === undefined) return true;
    if (Array.isArray(val)) return val.length === 0;
    if (typeof val === "string") return val.trim().length === 0;
    // numbers (including 0) and booleans are treated as filled
    return false;
  };

  const validateAddNew = () => {
    const next = {};
    const required = [
      { key: "cmdId", label: "Command" },
      { key: "baseId", label: "Base" },
      { key: "classId", label: "Class" },
      { key: "pId", label: "Property ID" },
      { key: "uoM", label: "UoM" },
      { key: "area", label: "Area" },
      { key: "location", label: "Location" },
      { key: "remarks", label: "Remarks" },
      { key: "status", label: "Status" },
    ];

    required.forEach(({ key, label }) => {
      if (isEmpty(form?.[key])) next[key] = `${label} is required`;
    });

    setErrors(next);
    return Object.keys(next).length === 0;
  };

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

    const maxFileSize = 10 * 1024 * 1024; // 10MB
    const validFiles = files.filter((file) => {
      if (file.size > maxFileSize) {
        alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });

    if (totalFiles + validFiles.length > 5) {
      const allowedCount = 5 - totalFiles;
      alert(
        `You can only upload ${allowedCount} more file(s). Maximum 5 files allowed (${totalExistingFiles} already uploaded).`
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

  const handleSave = async () => {
    // Enforce "all fields mandatory" only for Add New (as requested)
    if (isAddMode) {
      const ok = validateAddNew();
      if (!ok) return;
    }

    let recordId = initialData?.id;

    try {
      console.log("Form data before submit:", form);
      // For new records, onSubmit returns the created ID
      const result = await onSubmit(form);
      if (result && !recordId) {
        recordId = result;
      }
    } catch (error) {
      console.error("Error saving form:", error);
      const rawErrorText = [
        error?.response?.data,
        error?.response?.data?.message,
        error?.response?.data?.title,
        error?.message,
      ]
        .map((part) => (typeof part === "string" ? part : ""))
        .join(" ")
        .trim();
      if (/Cannot insert duplicate key in obj(?:ect)?/i.test(rawErrorText)) {
        alert("Cannot insert Duplocate Property ID");
      }
      return;
    }

    // Upload files if any are selected (for both new and existing records)
    if (recordId && selectedFiles.length > 0) {
      setIsUploading(true);
      try {
        await uploadApi.uploadFiles(recordId, "RentalProperties", selectedFiles);
        if (onUploadSuccess) {
          onUploadSuccess();
        }
        setSelectedFiles([]);
        // Refresh existing files list
        await fetchExistingFiles(recordId);
      } catch (error) {
        console.error("Error uploading files:", error);
        alert(`Failed to upload files: ${error.message}`);
      } finally {
        setIsUploading(false);
      }
    }
  };

  const fields = [
    { label: "RAC", key: "cmdId", type: "select", options: commands, mandatory: true },
    { label: "Base", key: "baseId", type: "select", options: bases, mandatory: true },
    { label: "Class", key: "classId", type: "select", options: classes, mandatory: true },
    { label: "Property ID", key: "pId", mandatory: isAddMode },
    { label: "UoM", key: "uoM", type: "readonly", mandatory: isAddMode },
    { label: "Area", key: "area", type: "number", mandatory: isAddMode },
    { label: "Location", key: "location", grid: { xs: 12, sm: 8 }, mandatory: isAddMode },
    { label: "Remarks", key: "remarks", grid: { xs: 12, sm: 12 }, mandatory: isAddMode },
    {
      label: "Status",
      key: "status",
      type: "select",
      options: [
        { id: true, name: "Active" },
        { id: false, name: "Inactive" },
      ],
      mandatory: isAddMode,
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>{initialData ? "Edit Rental Property" : "Add Rental Property"}</DialogTitle>
      <DialogContent>
        <Grid container spacing={2} mt={0.5}>
          {fields.map((f) => (
            <Grid item {...(f.grid || { xs: 12, sm: 4 })} key={f.key}>
              {f.type === "select" ? (
                f.key === "cmdId" || f.key === "baseId" ? (
                  <Autocomplete
                    size="small"
                    fullWidth
                    disableClearable
                    disabled={lockedBaseId != null}
                    options={f.key === "cmdId" ? commands : bases}
                    getOptionLabel={(option) => option?.name ?? ""}
                    isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                    value={
                      f.key === "cmdId"
                        ? commands.find((c) => Number(c.id) === Number(form.cmdId)) ?? null
                        : bases.find((b) => Number(b.id) === Number(form.baseId)) ?? null
                    }
                    onChange={(_, newValue) =>
                      handleChange(f.key, newValue != null ? newValue.id : "")
                    }
                    ListboxProps={{ style: { maxHeight: 300 } }}
                    sx={{
                      ...formControlSx,
                      fontSize: "1rem",
                      "& .MuiInputBase-root": { minHeight: "45px" },
                      "& .MuiAutocomplete-inputRoot": { paddingTop: 0, paddingBottom: 0 },
                      "& .MuiInputBase-input": {
                        fontSize: "1rem",
                        paddingTop: 0,
                        paddingBottom: 0,
                      },
                    }}
                    renderInput={(params) => (
                      <MDInput
                        {...params}
                        label={f.label}
                        required={Boolean(f.mandatory)}
                        error={Boolean(errors[f.key])}
                        helperText={errors[f.key]}
                      />
                    )}
                  />
                ) : (
                  <FormControl
                    fullWidth
                    size="small"
                    required={Boolean(f.mandatory)}
                    error={Boolean(errors[f.key])}
                    sx={formControlSx}
                  >
                    <InputLabel sx={labelSx}>{f.label}</InputLabel>
                    <Select
                      value={form[f.key] ?? ""}
                      label={f.label}
                      onChange={(e) => handleChange(f.key, e.target.value)}
                      MenuProps={MENU_PROPS}
                      sx={selectSx}
                    >
                      {f.options.map((option) => {
                        const optionValue = option.value ?? option.id;
                        const optionLabel =
                          option.label ?? option.name ?? String(optionValue ?? "");
                        const optionKey = option.key ?? option.id ?? option.value ?? optionLabel;
                        return (
                          <MenuItem key={optionKey} value={optionValue} sx={menuItemSx}>
                            {optionLabel}
                          </MenuItem>
                        );
                      })}
                    </Select>
                    {errors[f.key] && <FormHelperText>{errors[f.key]}</FormHelperText>}
                  </FormControl>
                )
              ) : f.type === "readonly" ? (
                <MDInput
                  label={f.label}
                  type="text"
                  value={form[f.key] || ""}
                  fullWidth
                  size="small"
                  required={Boolean(f.mandatory)}
                  error={Boolean(errors[f.key])}
                  helperText={errors[f.key]}
                  InputProps={{ readOnly: true }}
                  sx={inputSx}
                />
              ) : (
                <MDInput
                  label={f.label}
                  type={f.type || "text"}
                  value={form[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  fullWidth
                  size="small"
                  required={Boolean(f.mandatory)}
                  error={Boolean(errors[f.key])}
                  helperText={errors[f.key]}
                  sx={inputSx}
                  {...(f.key === "location" && {
                    multiline: true,
                    rows: 3,
                    inputProps: { maxLength: 400 },
                  })}
                />
              )}
            </Grid>
          ))}

          {/* Attachments - File Upload (when record has an ID) */}
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
                    No files selected. Click &quot;Upload Files&quot; to upload attachments.
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
                  bgcolor: "info.main",
                  borderRadius: 1,
                  border: "1px solid",
                  borderColor: "info.dark",
                }}
              >
                <MDBox display="flex" alignItems="center">
                  <Icon sx={{ color: "#ffffff", mr: 1, fontSize: "1.5rem" }}>info</Icon>
                  <MDTypography variant="body2" sx={{ fontSize: "1rem", color: "#ffffff" }}>
                    <strong>Note:</strong> Attachment files will be uploaded after saving this form.
                  </MDTypography>
                </MDBox>
              </MDBox>
            </Grid>
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton
          variant="gradient"
          color="secondary"
          onClick={onClose}
          disabled={isUploading}
          sx={dialogFooterButtonSx}
        >
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          disabled={isUploading}
          sx={dialogFooterButtonSx}
        >
          <Icon>save</Icon>&nbsp;{isUploading ? "Uploading..." : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

RentalPropertyForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  onUploadSuccess: PropTypes.func,
  /** When set, RAC and Base are fixed to this base (Base-Read users on /contracts/rental-properties). */
  lockedBaseId: PropTypes.number,
};

export default RentalPropertyForm;
