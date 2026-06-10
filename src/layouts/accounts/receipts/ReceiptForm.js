import { useEffect, useMemo, useRef, useState } from "react";
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
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Icon from "@mui/material/Icon";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import {
  BASE_OPTIONS,
  MAX_ATTACHMENT_FILES,
  PAID_FROM_ACCOUNTS,
  PAYEE_CONTACT_TYPES,
  buildReceiptFormState,
  computeGrandTotal,
  computeLineTotal,
  createLineRow,
  parseAmount,
} from "./receiptUtils";
import ReceiptLinesGrid from "./ReceiptLinesGrid";
import { PAYMENTS_LABELS } from "./transactionLabels";

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

function validateReceiptForm(form, labels) {
  const errors = {};
  if (!form.date) errors.date = "Date is required";
  if (!form.paidFrom) errors.paidFrom = labels.paidFromRequired;
  if (!form.payeeName?.trim()) errors.payeeName = labels.payeeRequired;
  const lines = form.lines || [];
  if (!lines.length) errors.lines = "At least one line item is required";
  lines.forEach((line, idx) => {
    if (!line.racId) errors[`line-${idx}-rac`] = "RAC is required";
    if (!line.item) errors[`line-${idx}-item`] = "Item is required";
    if (!line.account) errors[`line-${idx}-account`] = "Account is required";
    if (parseAmount(line.amount) <= 0) errors[`line-${idx}-amount`] = "Amount is required";
  });
  return errors;
}

export default function ReceiptForm({
  open,
  onClose,
  onSubmit,
  initialData,
  labels = PAYMENTS_LABELS,
}) {
  const [form, setForm] = useState(() => buildReceiptFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef(null);

  const isEditMode = Boolean(initialData?.id);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm(
        buildReceiptFormState({
          ...initialData,
          lines:
            Array.isArray(initialData.lines) && initialData.lines.length
              ? initialData.lines.map((line) => ({
                  ...createLineRow(),
                  ...line,
                  total: computeLineTotal(line),
                }))
              : [createLineRow()],
          attachments: Array.isArray(initialData.attachments) ? [...initialData.attachments] : [],
        })
      );
    } else {
      setForm(buildReceiptFormState());
    }
    setErrors({});
  }, [open, initialData]);

  const grandTotal = useMemo(() => computeGrandTotal(form.lines), [form.lines]);

  const updateHeader = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "referenceAutomatic") {
        next.reference = value ? "Automatic" : "";
      }
      return next;
    });
  };

  const updateLine = (lineId, field, value) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== lineId) return line;
        const updated = { ...line, [field]: value };
        if (field === "racId") {
          const bases = BASE_OPTIONS.filter(
            (base) => !value || Number(base.racId) === Number(value)
          );
          updated.baseId = bases.some((b) => Number(b.id) === Number(line.baseId))
            ? line.baseId
            : "";
        }
        if (field === "amount") {
          updated.total = computeLineTotal(updated);
        }
        return updated;
      }),
    }));
  };

  const handleAddLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, createLineRow()],
    }));
  };

  const handleDuplicateLine = (lineId) => {
    setForm((prev) => {
      const source = prev.lines.find((line) => line.id === lineId);
      if (!source) return prev;
      const duplicate = {
        ...source,
        id: createLineRow().id,
        total: computeLineTotal(source),
      };
      const idx = prev.lines.findIndex((line) => line.id === lineId);
      const lines = [...prev.lines];
      lines.splice(idx + 1, 0, duplicate);
      return { ...prev, lines };
    });
  };

  const handleDeleteLine = (lineId) => {
    setForm((prev) => {
      if (prev.lines.length <= 1) return prev;
      return { ...prev, lines: prev.lines.filter((line) => line.id !== lineId) };
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
    const validationErrors = validateReceiptForm(form, labels);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      window.alert("Please complete all required fields before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        grandTotal,
        lines: form.lines.map((line) => ({
          ...line,
          total: computeLineTotal(line),
        })),
      };
      await onSubmit?.(payload);
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" scroll="paper">
      <DialogTitle sx={{ color: "#344767", pb: 1 }}>
        {isEditMode ? labels.editFormTitle : labels.addFormTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              type="date"
              label="Date"
              value={form.date}
              onChange={(e) => updateHeader("date", e.target.value)}
              InputLabelProps={{ shrink: true }}
              size="small"
              error={Boolean(errors.date)}
              helperText={errors.date}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={4}>
            <MDBox display="flex" alignItems="center" gap={1}>
              <FormControlLabel
                control={
                  <Checkbox
                    checked={Boolean(form.referenceAutomatic)}
                    onChange={(e) => updateHeader("referenceAutomatic", e.target.checked)}
                    size="small"
                  />
                }
                label="Reference"
                sx={{ mr: 0, whiteSpace: "nowrap" }}
              />
              <TextField
                fullWidth
                value={form.reference}
                onChange={(e) => updateHeader("reference", e.target.value)}
                disabled={form.referenceAutomatic}
                size="small"
                placeholder="Reference"
                sx={textFieldSx}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small" error={Boolean(errors.paidFrom)}>
              <InputLabel>{labels.paidFrom}</InputLabel>
              <Select
                label={labels.paidFrom}
                value={form.paidFrom}
                onChange={(e) => updateHeader("paidFrom", e.target.value)}
                sx={textFieldSx}
              >
                <MenuItem value="">
                  <em>Account</em>
                </MenuItem>
                {PAID_FROM_ACCOUNTS.map((name) => (
                  <MenuItem key={name} value={name}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={8}>
            <MDTypography variant="caption" fontWeight="bold" display="block" mb={0.5}>
              {labels.payeeSection}
            </MDTypography>
            <MDBox display="flex" gap={1} flexWrap="wrap">
              <FormControl size="small" sx={{ minWidth: 140, ...textFieldSx }}>
                <InputLabel>Contact</InputLabel>
                <Select
                  label="Contact"
                  value={form.payeeContactType}
                  onChange={(e) => updateHeader("payeeContactType", e.target.value)}
                >
                  {PAYEE_CONTACT_TYPES.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              <TextField
                fullWidth
                value={form.payeeName}
                onChange={(e) => updateHeader("payeeName", e.target.value)}
                size="small"
                placeholder={labels.payeePlaceholder}
                error={Boolean(errors.payeeName)}
                helperText={errors.payeeName}
                sx={{ flex: 1, minWidth: 200, ...textFieldSx }}
              />
            </MDBox>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={form.description}
              onChange={(e) => updateHeader("description", e.target.value)}
              size="small"
              placeholder="Optional"
              sx={textFieldSx}
            />
          </Grid>
        </Grid>

        <MDBox sx={{ mb: 2 }}>
          <ReceiptLinesGrid
            lines={form.lines}
            errors={errors}
            saving={saving}
            grandTotal={grandTotal}
            onLineChange={updateLine}
            onAddLine={handleAddLine}
            onDuplicateLine={handleDuplicateLine}
            onDeleteLine={handleDeleteLine}
          />
        </MDBox>

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
            id="receipt-attachment-file-input"
            type="file"
            multiple
            onChange={handleFileSelect}
            disabled={(form.attachments || []).length >= MAX_ATTACHMENT_FILES}
          />
          <label htmlFor="receipt-attachment-file-input">
            <MDButton
              variant="gradient"
              color="info"
              component="span"
              size="small"
              disabled={(form.attachments || []).length >= MAX_ATTACHMENT_FILES}
              sx={{ mb: 1 }}
            >
              <Icon>cloud_upload</Icon>&nbsp; Add files ({(form.attachments || []).length}/
              {MAX_ATTACHMENT_FILES})
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

ReceiptForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
  labels: PropTypes.object,
};

ReceiptForm.defaultProps = {
  onSubmit: undefined,
  initialData: undefined,
  labels: PAYMENTS_LABELS,
};
