import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import CurrencyLoading from "components/CurrencyLoading";
import uploadApi from "services/api.upload.service";
import guidelinesApi from "services/api.guidelines.service";
import {
  GUIDELINES_FILE_ACCEPT,
  GUIDELINES_MAX_ATTACHMENTS,
  deleteGuidelinesUploadedFile,
  fetchGuidelinesUploadedFiles,
  formatGuidelinesFileSize,
  uploadGuidelinesAttachments,
  validateGuidelinesAttachmentFile,
} from "./guidelinesAttachmentUtils";

function GuidelineForm({ open, onClose, initialData, readOnly, onSaved }) {
  const isEditMode = Boolean(initialData && (initialData.id || initialData.Id));
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState(true);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setTitle(String(initialData.title ?? initialData.Title ?? "").trim());
      setDescription(String(initialData.description ?? initialData.Description ?? "").trim());
      const rawStatus = initialData.status ?? initialData.Status;
      setStatus(rawStatus === undefined || rawStatus === null ? true : Boolean(rawStatus));
      setSelectedFiles([]);
      const id = initialData.id ?? initialData.Id;
      if (id) {
        loadExistingFiles(id);
      } else {
        setExistingFiles([]);
      }
    } else {
      setTitle("");
      setDescription("");
      setStatus(true);
      setSelectedFiles([]);
      setExistingFiles([]);
    }
  }, [open, initialData]);

  const loadExistingFiles = async (id) => {
    setLoadingExistingFiles(true);
    try {
      const files = await fetchGuidelinesUploadedFiles(id);
      setExistingFiles(files);
    } catch (error) {
      console.error("Error loading guideline attachments:", error);
      setExistingFiles([]);
    } finally {
      setLoadingExistingFiles(false);
    }
  };

  const totalAttachmentSlots = existingFiles.length + selectedFiles.length;

  const handleFileSelect = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length || readOnly) return;

    const remaining = GUIDELINES_MAX_ATTACHMENTS - totalAttachmentSlots;
    if (remaining <= 0) {
      alert(`Maximum ${GUIDELINES_MAX_ATTACHMENTS} attachments allowed.`);
      return;
    }

    const accepted = [];
    for (const file of files) {
      if (accepted.length >= remaining) break;
      const error = validateGuidelinesAttachmentFile(file);
      if (error) {
        alert(error);
        continue;
      }
      accepted.push(file);
    }

    if (accepted.length) {
      setSelectedFiles((prev) => [...prev, ...accepted]);
    }
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDeleteExistingFile = async (file) => {
    if (readOnly) return;
    const fileId = file?.id ?? file?.fileId;
    if (fileId == null) {
      alert("Unable to delete this file.");
      return;
    }
    if (!window.confirm(`Delete "${file.fileName || "this file"}"?`)) return;
    try {
      await deleteGuidelinesUploadedFile(fileId);
      setExistingFiles((prev) => prev.filter((f) => (f.id ?? f.fileId) !== fileId));
    } catch (error) {
      console.error("Error deleting guideline attachment:", error);
      alert(error?.message || "Failed to delete attachment.");
    }
  };

  const handleDownloadFile = async (file, index) => {
    try {
      await uploadApi.downloadFile(file, file.fileName || `File-${index + 1}`);
    } catch (error) {
      console.error("Error downloading guideline attachment:", error);
      alert(error?.message || "Failed to download file.");
    }
  };

  const handleSave = async () => {
    if (readOnly || saving) return;
    const trimmedTitle = String(title ?? "").trim();
    if (!trimmedTitle) {
      alert("Title is required.");
      return;
    }
    if (trimmedTitle.length > 200) {
      alert("Title must be 200 characters or fewer.");
      return;
    }
    const trimmedDescription = String(description ?? "").trim();
    if (trimmedDescription.length > 500) {
      alert("Description must be 500 characters or fewer.");
      return;
    }
    if (!isEditMode && selectedFiles.length < 1) {
      alert("At least 1 attachment is required.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        Title: trimmedTitle,
        Description: trimmedDescription || null,
        Status: Boolean(status),
      };

      let savedId = initialData?.id ?? initialData?.Id ?? null;
      if (isEditMode && savedId) {
        await guidelinesApi.updateGuideline(savedId, { ...payload, Id: savedId });
      } else {
        const created = await guidelinesApi.createGuideline(payload);
        savedId = created?.id ?? created?.Id ?? null;
      }

      if (savedId && selectedFiles.length) {
        setIsUploading(true);
        try {
          await uploadGuidelinesAttachments(savedId, selectedFiles);
        } finally {
          setIsUploading(false);
        }
      }

      if (typeof onSaved === "function") await onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving guideline:", error);
      alert(error?.message || "Failed to save guideline.");
    } finally {
      setSaving(false);
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>
        {readOnly ? "View Guideline" : isEditMode ? "Edit Guideline" : "New Guideline"}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <MDInput
              label="Title *"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
              disabled={readOnly}
              inputProps={{ maxLength: 200 }}
            />
          </Grid>
          <Grid item xs={12}>
            <MDInput
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={3}
              disabled={readOnly}
              inputProps={{ maxLength: 500 }}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControlLabel
              control={
                <Switch
                  checked={Boolean(status)}
                  onChange={(e) => setStatus(e.target.checked)}
                  disabled={readOnly}
                />
              }
              label={status ? "Active" : "Inactive"}
            />
          </Grid>
          <Grid item xs={12}>
            <MDBox
              sx={{
                border: "1px dashed",
                borderColor: "#b0b0b0",
                borderRadius: 2,
                p: 2,
              }}
            >
              <MDTypography variant="button" fontWeight="medium" sx={{ display: "block", mb: 1 }}>
                Attachments{!isEditMode && !readOnly ? " *" : ""} (max {GUIDELINES_MAX_ATTACHMENTS},
                5 MB each — PDF / Word / Excel)
                {!isEditMode && !readOnly ? " — at least 1 required" : ""}
              </MDTypography>

              {loadingExistingFiles ? (
                <MDBox display="flex" justifyContent="center" py={1}>
                  <CurrencyLoading size={20} />
                </MDBox>
              ) : existingFiles.length > 0 ? (
                <MDBox mb={1.5}>
                  {existingFiles.map((file, index) => (
                    <Chip
                      key={file.id ?? file.fileId ?? `${file.fileName}-${index}`}
                      label={file.fileName || `File ${index + 1}`}
                      sx={{ mr: 1, mb: 1 }}
                      color="default"
                      variant="outlined"
                      onClick={() => handleDownloadFile(file, index)}
                      onDelete={readOnly ? undefined : () => handleDeleteExistingFile(file)}
                      deleteIcon={readOnly ? undefined : <Icon>delete</Icon>}
                    />
                  ))}
                </MDBox>
              ) : null}

              {!readOnly && (
                <>
                  <input
                    accept={GUIDELINES_FILE_ACCEPT}
                    style={{ display: "none" }}
                    id="guidelines-file-upload"
                    type="file"
                    multiple
                    onChange={handleFileSelect}
                    disabled={totalAttachmentSlots >= GUIDELINES_MAX_ATTACHMENTS || isUploading}
                  />
                  <label htmlFor="guidelines-file-upload">
                    <MDButton
                      variant="gradient"
                      color="info"
                      component="span"
                      disabled={totalAttachmentSlots >= GUIDELINES_MAX_ATTACHMENTS || isUploading}
                      size="small"
                    >
                      <Icon>cloud_upload</Icon>&nbsp;Upload ({totalAttachmentSlots}/
                      {GUIDELINES_MAX_ATTACHMENTS})
                    </MDButton>
                  </label>
                </>
              )}

              {selectedFiles.length > 0 && (
                <MDBox mt={1.5}>
                  {selectedFiles.map((file, index) => (
                    <Chip
                      key={`${file.name}-${index}`}
                      label={`${file.name} (${formatGuidelinesFileSize(file.size)})`}
                      onDelete={readOnly ? undefined : () => handleRemoveSelectedFile(index)}
                      deleteIcon={<Icon>cancel</Icon>}
                      sx={{ mr: 1, mb: 1 }}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </MDBox>
              )}

              {readOnly && existingFiles.length === 0 && (
                <MDTypography variant="caption" color="text">
                  No attachments.
                </MDTypography>
              )}
            </MDBox>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          {readOnly ? "Close" : "Cancel"}
        </MDButton>
        {!readOnly && (
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            disabled={saving || isUploading}
          >
            {saving || isUploading ? "Saving..." : "Save"}
          </MDButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

GuidelineForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  readOnly: PropTypes.bool,
  onSaved: PropTypes.func,
};

GuidelineForm.defaultProps = {
  initialData: null,
  readOnly: false,
  onSaved: undefined,
};

export default GuidelineForm;
