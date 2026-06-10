import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import Select from "@mui/material/Select";
import MenuItem from "@mui/material/MenuItem";
import Icon from "@mui/material/Icon";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import {
  BASE_OPTIONS,
  CURRENCY_OPTIONS,
  MAX_ATTACHMENT_FILES,
  RAC_OPTIONS,
  buildSupplierFormState,
} from "./supplierUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
};

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function validateSupplierForm(form) {
  const errors = {};
  if (!form.racId) errors.racId = "RAC is required";
  if (!form.name?.trim()) errors.name = "Name is required";
  if (!form.code?.trim()) errors.code = "Code is required";
  if (!form.currency) errors.currency = "Currency is required";
  return errors;
}

export default function SupplierForm({ open, onClose, onSubmit, initialData }) {
  const [form, setForm] = useState(() => buildSupplierFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const isEditMode = Boolean(initialData?.id);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm(
        buildSupplierFormState({
          ...initialData,
          attachments: Array.isArray(initialData.attachments) ? [...initialData.attachments] : [],
        })
      );
    } else {
      setForm(buildSupplierFormState());
    }
    setErrors({});
  }, [open, initialData]);

  const filteredBases = BASE_OPTIONS.filter(
    (base) => !form.racId || Number(base.racId) === Number(form.racId)
  );

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "racId") {
        const bases = BASE_OPTIONS.filter((base) => !value || Number(base.racId) === Number(value));
        next.baseId = bases.some((b) => Number(b.id) === Number(prev.baseId)) ? prev.baseId : "";
      }
      return next;
    });
  };

  const handleFileSelect = (event) => {
    const list = event.target?.files ? Array.from(event.target.files) : [];
    if (!list.length) return;
    setForm((prev) => {
      const existing = prev.attachments || [];
      const remaining = MAX_ATTACHMENT_FILES - existing.length;
      if (remaining <= 0) {
        window.alert(`Maximum ${MAX_ATTACHMENT_FILES} files allowed.`);
        return prev;
      }
      const accepted = list.slice(0, remaining).map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        file,
      }));
      return { ...prev, attachments: [...existing, ...accepted] };
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (fileId) => {
    setForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((f) => f.id !== fileId),
    }));
  };

  const handleSave = async () => {
    const validationErrors = validateSupplierForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      window.alert("Please complete all required fields before saving.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit?.({ ...form });
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
      <DialogTitle sx={{ color: "#344767", pb: 1 }}>
        {isEditMode ? "Edit Supplier" : "Add New Supplier"}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small" error={Boolean(errors.racId)} sx={textFieldSx}>
              <InputLabel>RAC</InputLabel>
              <Select
                label="RAC"
                value={form.racId}
                onChange={(e) => updateField("racId", e.target.value)}
              >
                <MenuItem value="">
                  <em>Select RAC</em>
                </MenuItem>
                {RAC_OPTIONS.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small" sx={textFieldSx}>
              <InputLabel>Base</InputLabel>
              <Select
                label="Base"
                value={form.baseId}
                onChange={(e) => updateField("baseId", e.target.value)}
              >
                <MenuItem value="">
                  <em>Select Base</em>
                </MenuItem>
                {filteredBases.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Name"
              value={form.name}
              onChange={(e) => updateField("name", e.target.value)}
              size="small"
              required
              error={Boolean(errors.name)}
              helperText={errors.name}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Code"
              value={form.code}
              onChange={(e) => updateField("code", e.target.value)}
              size="small"
              required
              error={Boolean(errors.code)}
              helperText={errors.code}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Credit Limit"
              value={form.creditLimit}
              onChange={(e) => updateField("creditLimit", e.target.value)}
              size="small"
              inputProps={{ inputMode: "decimal" }}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <FormControl fullWidth size="small" error={Boolean(errors.currency)} sx={textFieldSx}>
              <InputLabel>Currency</InputLabel>
              <Select
                label="Currency"
                value={form.currency}
                onChange={(e) => updateField("currency", e.target.value)}
              >
                {CURRENCY_OPTIONS.map((cur) => (
                  <MenuItem key={cur} value={cur}>
                    {cur}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Address"
              value={form.address}
              onChange={(e) => updateField("address", e.target.value)}
              size="small"
              multiline
              minRows={2}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Email"
              type="email"
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
              size="small"
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="Division"
              value={form.division}
              onChange={(e) => updateField("division", e.target.value)}
              size="small"
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <TextField
              fullWidth
              label="IBAN"
              value={form.iban}
              onChange={(e) => updateField("iban", e.target.value)}
              size="small"
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12}>
            <MDBox
              sx={{
                border: "1px dashed",
                borderColor: "grey.400",
                borderRadius: 2,
                p: 2,
                bgcolor: "background.paper",
              }}
            >
              <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
                Attachments (max {MAX_ATTACHMENT_FILES} files)
              </Typography>
              <input
                ref={fileInputRef}
                accept="*/*"
                style={{ display: "none" }}
                id="supplier-attachment-file-input"
                type="file"
                multiple
                onChange={handleFileSelect}
                disabled={(form.attachments || []).length >= MAX_ATTACHMENT_FILES}
              />
              <label htmlFor="supplier-attachment-file-input">
                <MDButton
                  variant="gradient"
                  color="info"
                  component="span"
                  size="small"
                  disabled={(form.attachments || []).length >= MAX_ATTACHMENT_FILES}
                  sx={{ mb: 1 }}
                >
                  <Icon>folder_open</Icon>&nbsp; Browse
                </MDButton>
              </label>
              {(form.attachments || []).length > 0 && (
                <Box mt={1}>
                  {(form.attachments || []).map((file) => (
                    <Chip
                      key={file.id}
                      label={`${file.name} (${formatFileSize(file.size)})`}
                      onDelete={() => handleRemoveAttachment(file.id)}
                      deleteIcon={<Icon fontSize="small">cancel</Icon>}
                      size="small"
                      sx={{ mr: 0.5, mb: 0.5 }}
                      color="primary"
                      variant="outlined"
                    />
                  ))}
                </Box>
              )}
            </MDBox>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave} disabled={saving}>
          <Icon>save</Icon>&nbsp;{saving ? "Saving…" : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

SupplierForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
};

SupplierForm.defaultProps = {
  onSubmit: undefined,
  initialData: undefined,
};
