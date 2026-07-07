import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Icon from "@mui/material/Icon";
import Chip from "@mui/material/Chip";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import SearchableSelect from "components/SearchableSelect";
import CurrencyLoading from "components/CurrencyLoading";
import uploadApi from "services/api.upload.service";
import purchaseReturnsApi from "services/api.purchaseReturns.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import { MAX_ATTACHMENT_FILES } from "layouts/accounts/receipts/receiptUtils";
import { PURCHASE_RETURNS_LABELS } from "layouts/purchases/transactionLabels";
import PurchaseReturnLinesGrid from "./PurchaseReturnLinesGrid";
import {
  fetchPurchaseReturnUploadedFiles,
  PURCHASE_RETURN_ATTACHMENT_MAX_BYTES,
  uploadPurchaseReturnAttachments,
} from "./purchaseReturnAttachmentUtils";
import {
  applyPurchaseReturnProductSelection,
  buildPurchaseReturnFormState,
  computeNextPurchaseReturnVrNo,
  computePurchaseReturnGrandTotal,
  createPurchaseReturnLineRow,
  fetchPurchaseReturnVrNos,
  findPurchaseReturnSupplierOption,
  getPurchaseReturnYearFromDate,
  loadPurchaseReturnFormCatalogs,
  PURCHASE_RETURN_VR_NO_PREFIX,
  syncPurchaseReturnLineAmount,
  validatePurchaseReturnForm,
} from "./purchaseReturnUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
  "& .MuiInputLabel-root": { top: 0 },
};

function PurchaseReturnDateField({ value, onChange, disabled, readOnly, error, helperText }) {
  const inputRef = useRef(null);
  const dateValue = value || "";

  const openPicker = () => {
    if (disabled || readOnly) return;
    if (inputRef.current?.showPicker) {
      inputRef.current.showPicker();
      return;
    }
    inputRef.current?.click();
  };

  if (readOnly) {
    return (
      <TextField
        fullWidth
        label="Date"
        value={dateValue ? formatDateDDMMMYYYY(dateValue) : ""}
        disabled
        size="small"
        InputLabelProps={{ shrink: true }}
        sx={textFieldSx}
      />
    );
  }

  return (
    <MDBox sx={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="date"
        value={dateValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          position: "absolute",
          opacity: 0,
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
          cursor: disabled ? "default" : "pointer",
        }}
      />
      <TextField
        fullWidth
        label="Date"
        value={dateValue ? formatDateDDMMMYYYY(dateValue) : ""}
        onClick={openPicker}
        InputProps={{ readOnly: true }}
        disabled={disabled}
        size="small"
        placeholder="dd-MMM-yyyy"
        InputLabelProps={{ shrink: true }}
        error={Boolean(error)}
        helperText={helperText}
        sx={{
          ...textFieldSx,
          "& .MuiInputBase-input": { cursor: disabled ? "default" : "pointer" },
        }}
      />
    </MDBox>
  );
}

PurchaseReturnDateField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  error: PropTypes.bool,
  helperText: PropTypes.string,
};

PurchaseReturnDateField.defaultProps = {
  value: "",
  disabled: false,
  readOnly: false,
  error: false,
  helperText: "",
};

export default function PurchaseReturnForm({
  open,
  onClose,
  onSubmit,
  initialData,
  labels = PURCHASE_RETURNS_LABELS,
  readOnly = false,
  onUploadSuccess,
}) {
  const [form, setForm] = useState(() => buildPurchaseReturnFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [supplierOptions, setSupplierOptions] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [accountOptions, setAccountOptions] = useState([]);
  const [existingVrNos, setExistingVrNos] = useState([]);
  const [vrNosLoaded, setVrNosLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const isEditMode = Boolean(initialData?.id);

  const grandTotal = useMemo(() => computePurchaseReturnGrandTotal(form.lines), [form.lines]);

  const fetchExistingFiles = useCallback(async (id) => {
    if (id == null) return;
    setLoadingExistingFiles(true);
    try {
      const files = await fetchPurchaseReturnUploadedFiles(id);
      setExistingFiles(files);
    } catch (error) {
      console.error("Error fetching purchase return attachments:", error);
      setExistingFiles([]);
    } finally {
      setLoadingExistingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const catalogs = await loadPurchaseReturnFormCatalogs();
        if (!cancelled) {
          setSupplierOptions(catalogs.supplierOptions);
          setProductOptions(catalogs.productOptions);
          setAccountOptions(catalogs.accountOptions);
        }
      } catch (error) {
        console.error("Error loading purchase return catalogs:", error);
        if (!cancelled) {
          setSupplierOptions([]);
          setProductOptions([]);
          setAccountOptions([]);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm(
        buildPurchaseReturnFormState({
          ...initialData,
          lines: Array.isArray(initialData.lines)
            ? initialData.lines.map((line) =>
                syncPurchaseReturnLineAmount({ ...createPurchaseReturnLineRow(), ...line })
              )
            : [],
        })
      );
    } else {
      setForm(buildPurchaseReturnFormState());
    }
    setErrors({});
    setSelectedFiles([]);
    if (initialData?.id) {
      fetchExistingFiles(initialData.id);
    } else {
      setExistingFiles([]);
    }
  }, [open, initialData, fetchExistingFiles]);

  useEffect(() => {
    if (!open) {
      setExistingVrNos([]);
      setVrNosLoaded(false);
      return undefined;
    }
    if (isEditMode) return undefined;

    let cancelled = false;

    const loadExistingVrNos = async () => {
      try {
        const vrNos = await fetchPurchaseReturnVrNos(purchaseReturnsApi);
        if (!cancelled) {
          setExistingVrNos(vrNos);
          setVrNosLoaded(true);
        }
      } catch (error) {
        console.error("Error loading purchase return Vr Nos:", error);
        if (!cancelled) {
          setExistingVrNos([]);
          setVrNosLoaded(true);
        }
      }
    };

    loadExistingVrNos();
    return () => {
      cancelled = true;
    };
  }, [open, isEditMode]);

  useEffect(() => {
    if (!open || isEditMode || !vrNosLoaded) return;
    setForm((prev) => {
      const nextVrNo = computeNextPurchaseReturnVrNo(existingVrNos, prev.date);
      if (prev.vrNo === nextVrNo) return prev;
      return { ...prev, vrNo: nextVrNo };
    });
  }, [open, isEditMode, vrNosLoaded, existingVrNos, form.date]);

  const updateHeader = (field, value) => {
    if (field === "vrNo") return;
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "supplierKey") {
        const option = findPurchaseReturnSupplierOption(supplierOptions, value);
        next.supplierLabel = option?.supplierLabel || option?.label || "";
        next.supplierId = option?.supplierId != null ? String(option.supplierId) : "";
        next.supplierCode = option?.supplierCode || "";
      }
      if (field === "purchaseInvoiceNo") {
        next.purchaseInvoiceLabel = String(value || "").trim();
      }
      return next;
    });
  };

  const updateLine = (lineId, field, value) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== lineId) return line;
        let updated = { ...line, [field]: value };
        if (field === "productKey") {
          updated = applyPurchaseReturnProductSelection(
            updated,
            value,
            productOptions,
            accountOptions
          );
        } else if (field === "quantity" || field === "unitPrice" || field === "discount") {
          updated = syncPurchaseReturnLineAmount(updated);
        }
        return updated;
      }),
    }));
  };

  const handleAddLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, createPurchaseReturnLineRow()],
    }));
  };

  const handleDuplicateLine = (lineId) => {
    setForm((prev) => {
      const source = prev.lines.find((line) => line.id === lineId);
      if (!source) return prev;
      const duplicate = createPurchaseReturnLineRow({
        ...source,
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      const index = prev.lines.findIndex((line) => line.id === lineId);
      const lines = [...prev.lines];
      lines.splice(index + 1, 0, duplicate);
      return { ...prev, lines };
    });
  };

  const handleDeleteLine = (lineId) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((line) => line.id !== lineId),
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const totalAttachmentSlots = existingFiles.length + selectedFiles.length;

  const handleAttachmentSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const remaining = MAX_ATTACHMENT_FILES - totalAttachmentSlots;
    if (remaining <= 0) {
      window.alert(
        `Maximum ${MAX_ATTACHMENT_FILES} files allowed. Please delete some existing files before uploading new ones.`
      );
      event.target.value = "";
      return;
    }
    if (files.length > remaining) {
      window.alert(
        `You can only upload ${remaining} more file(s). Maximum ${MAX_ATTACHMENT_FILES} files allowed (${existingFiles.length} already uploaded).`
      );
      event.target.value = "";
      return;
    }
    const validFiles = files.filter((file) => {
      if (file.size > PURCHASE_RETURN_ATTACHMENT_MAX_BYTES) {
        window.alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });
    if (totalAttachmentSlots + validFiles.length > MAX_ATTACHMENT_FILES) {
      const allowedCount = MAX_ATTACHMENT_FILES - totalAttachmentSlots;
      window.alert(
        `You can only upload ${allowedCount} more file(s). Maximum ${MAX_ATTACHMENT_FILES} files allowed (${existingFiles.length} already uploaded).`
      );
      event.target.value = "";
      return;
    }
    setSelectedFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleDeleteExistingFile = async (file) => {
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      window.alert("File ID is not available. Cannot delete this file.");
      return;
    }
    if (!window.confirm(`Delete "${file.fileName || file.name || "this file"}"?`)) return;
    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (initialData?.id) await fetchExistingFiles(initialData.id);
      onUploadSuccess?.(initialData?.id);
    } catch (error) {
      console.error("Failed to delete purchase return attachment:", error);
      window.alert(error?.message || "Failed to delete file.");
    }
  };

  const handleSave = async () => {
    let formToSave = form;
    if (!isEditMode) {
      try {
        const freshVrNos = await fetchPurchaseReturnVrNos(purchaseReturnsApi);
        const nextVrNo = computeNextPurchaseReturnVrNo(freshVrNos, form.date);
        formToSave = { ...form, vrNo: nextVrNo };
        setExistingVrNos(freshVrNos);
        setForm(formToSave);
      } catch (error) {
        console.error("Error refreshing purchase return Vr Nos:", error);
      }
    }

    const validationErrors = validatePurchaseReturnForm(formToSave);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      window.alert("Please complete all required fields before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await onSubmit?.({ ...formToSave, grandTotal });
      const recordId = initialData?.id ?? result?.id;
      if (recordId && selectedFiles.length > 0) {
        setIsUploading(true);
        try {
          await uploadPurchaseReturnAttachments(recordId, selectedFiles);
          setSelectedFiles([]);
          onUploadSuccess?.(recordId);
        } catch (error) {
          console.error("Error uploading purchase return files:", error);
          window.alert(`Failed to upload files: ${error.message}`);
          return;
        } finally {
          setIsUploading(false);
        }
      }
      onClose?.();
    } catch (error) {
      const message = error?.message || "Failed to save purchase return.";
      if (/vr no must be unique/i.test(message)) {
        setErrors((prev) => ({ ...prev, vrNo: "Vr No must be unique" }));
      }
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const formTitle = initialData?.id ? labels.editFormTitle : labels.addFormTitle;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{formTitle}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <PurchaseReturnDateField
              value={form.date}
              onChange={(value) => updateHeader("date", value)}
              disabled={readOnly || saving}
              readOnly={readOnly}
              error={Boolean(errors.date)}
              helperText={errors.date}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Vr No"
              value={form.vrNo}
              disabled
              size="small"
              InputLabelProps={{ shrink: true }}
              InputProps={{ readOnly: true }}
              placeholder={`${PURCHASE_RETURN_VR_NO_PREFIX}-1/${getPurchaseReturnYearFromDate(
                form.date
              )}`}
              error={Boolean(errors.vrNo)}
              helperText={errors.vrNo}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <FormControl fullWidth size="small" error={Boolean(errors.supplierKey)}>
              <InputLabel id="purchase-return-supplier-label" shrink>
                Supplier
              </InputLabel>
              <SearchableSelect
                labelId="purchase-return-supplier-label"
                label="Supplier"
                value={form.supplierKey || ""}
                displayEmpty
                onChange={(e) => updateHeader("supplierKey", e.target.value)}
                disabled={readOnly || saving}
                sx={textFieldSx}
              >
                <MenuItem value="">
                  <em>Select supplier</em>
                </MenuItem>
                {supplierOptions.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
              {errors.supplierKey ? (
                <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                  {errors.supplierKey}
                </Typography>
              ) : null}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Purchase Invoice"
              value={form.purchaseInvoiceNo}
              onChange={(e) => updateHeader("purchaseInvoiceNo", e.target.value)}
              disabled={readOnly || saving}
              size="small"
              InputLabelProps={{ shrink: true }}
              error={Boolean(errors.purchaseInvoiceNo)}
              helperText={errors.purchaseInvoiceNo}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="Description"
              value={form.description}
              onChange={(e) => updateHeader("description", e.target.value)}
              disabled={readOnly || saving}
              size="small"
              placeholder="Optional"
              InputLabelProps={{ shrink: true }}
              sx={textFieldSx}
            />
          </Grid>
        </Grid>

        <MDBox sx={{ mb: 2 }}>
          <PurchaseReturnLinesGrid
            lines={form.lines}
            productOptions={productOptions}
            errors={errors}
            saving={saving}
            grandTotal={grandTotal}
            readOnly={readOnly}
            onLineChange={updateLine}
            onAddLine={handleAddLine}
            onDuplicateLine={handleDuplicateLine}
            onDeleteLine={handleDeleteLine}
          />
          {errors.lines ? (
            <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
              {errors.lines}
            </Typography>
          ) : null}
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
            Attachments (max {MAX_ATTACHMENT_FILES} files total)
          </Typography>

          {isEditMode ? (
            loadingExistingFiles ? (
              <MDBox display="flex" justifyContent="center" py={1}>
                <CurrencyLoading size={20} />
              </MDBox>
            ) : existingFiles.length > 0 ? (
              <MDBox mb={2}>
                <Typography variant="caption" color="text" display="block" sx={{ mb: 1 }}>
                  Already uploaded files ({existingFiles.length}/{MAX_ATTACHMENT_FILES}):
                </Typography>
                {existingFiles.map((file, index) => (
                  <Chip
                    key={file.id || file.fileName || index}
                    label={file.fileName || `File ${index + 1}`}
                    onDelete={readOnly ? undefined : () => handleDeleteExistingFile(file)}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                    variant="outlined"
                  />
                ))}
              </MDBox>
            ) : null
          ) : null}

          {!readOnly ? (
            totalAttachmentSlots >= MAX_ATTACHMENT_FILES ? (
              <Typography variant="caption" color="warning.main" display="block" sx={{ mb: 1 }}>
                Maximum {MAX_ATTACHMENT_FILES} files already uploaded. Delete existing files to
                upload new ones.
              </Typography>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  accept="*/*"
                  onChange={handleAttachmentSelect}
                  disabled={saving || isUploading || totalAttachmentSlots >= MAX_ATTACHMENT_FILES}
                />
                <MDButton
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving || isUploading || totalAttachmentSlots >= MAX_ATTACHMENT_FILES}
                >
                  <Icon>cloud_upload</Icon>&nbsp;Upload Files ({totalAttachmentSlots}/
                  {MAX_ATTACHMENT_FILES})
                </MDButton>
                {totalAttachmentSlots < MAX_ATTACHMENT_FILES ? (
                  <Typography variant="caption" color="text" display="block" sx={{ mt: 1 }}>
                    You can upload {MAX_ATTACHMENT_FILES - totalAttachmentSlots} more file(s).
                  </Typography>
                ) : null}
              </>
            )
          ) : null}

          {selectedFiles.length > 0 ? (
            <MDBox mt={2}>
              <Typography variant="caption" color="text" display="block" sx={{ mb: 1 }}>
                New files to upload:
              </Typography>
              {selectedFiles.map((file, index) => (
                <Chip
                  key={`${file.name}-${index}`}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  onDelete={readOnly ? undefined : () => handleRemoveSelectedFile(index)}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </MDBox>
          ) : selectedFiles.length === 0 && existingFiles.length === 0 ? (
            <Typography variant="caption" color="text" display="block" sx={{ mt: 1 }}>
              No files selected. Click &quot;Upload Files&quot; to add attachments.
            </Typography>
          ) : null}
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton
          variant="text"
          color="secondary"
          onClick={onClose}
          disabled={saving || isUploading}
        >
          Cancel
        </MDButton>
        {!readOnly ? (
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            disabled={saving || isUploading}
          >
            {saving || isUploading ? "Saving..." : "Save"}
          </MDButton>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

PurchaseReturnForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
  labels: PropTypes.object,
  readOnly: PropTypes.bool,
  onUploadSuccess: PropTypes.func,
};

PurchaseReturnForm.defaultProps = {
  onSubmit: undefined,
  initialData: null,
  labels: PURCHASE_RETURNS_LABELS,
  readOnly: false,
  onUploadSuccess: undefined,
};
