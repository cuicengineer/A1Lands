import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import CurrencyLoading from "components/CurrencyLoading";
import contractApi from "services/api.contract.service";
import customerApi from "services/api.customer.service";
import supplierApi from "services/api.supplier.service";
import journalEntryApi from "services/api.journalEntry.service";
import api from "services/api.service";
import uploadApi from "services/api.upload.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  formatTransactionLockDateValidationMessage,
  getMinCollectionReceiptDateAfterLock,
  isDateLockedByLockDate,
} from "layouts/income-agreements/collections/collectionsUtils";
import JournalEntryLinesGrid from "./JournalEntryLinesGrid";
import {
  MAX_ATTACHMENT_FILES,
  JOURNAL_ENTRY_ATTACHMENT_MAX_BYTES,
  deleteJournalEntryUploadedFile,
  fetchJournalEntryUploadedFiles,
  uploadJournalEntryAttachments,
} from "./journalEntryAttachmentUtils";
import {
  JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH,
  JOURNAL_ENTRY_VR_NO_PREFIX,
  buildJournalEntryContractOptions,
  buildJournalEntryFormState,
  buildJournalEntryInvoiceOptions,
  computeNextJournalEntryVrNo,
  createJournalEntryLineRow,
  fetchJournalEntryAccountOptions,
  fetchJournalEntryVrNos,
  getJournalEntryYearFromDate,
  normalizeJournalEntryRecord,
  toJournalEntryInputDate,
  validateJournalEntryForm,
} from "./journalEntryUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
  "& .MuiInputLabel-root": { top: 0 },
};

const readOnlyVrNoFieldSx = {
  ...textFieldSx,
  "& .MuiInputBase-input": {
    color: "#000",
    WebkitTextFillColor: "#000",
  },
  "& .MuiInputBase-input.Mui-disabled": {
    color: "#000",
    WebkitTextFillColor: "#000",
    opacity: 1,
  },
};

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB"];
  let size = bytes;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

function JournalEntryDateField({ value, onChange, disabled, readOnly, error, helperText, min }) {
  const inputRef = useRef(null);
  const dateValue = value || "";

  const openPicker = () => {
    if (disabled || readOnly) return;
    if (inputRef.current?.showPicker) inputRef.current.showPicker();
    else inputRef.current?.click();
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
        type="date"
        ref={inputRef}
        value={dateValue}
        min={min || undefined}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
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

JournalEntryDateField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  error: PropTypes.bool,
  helperText: PropTypes.string,
  min: PropTypes.string,
};

JournalEntryDateField.defaultProps = {
  value: "",
  disabled: false,
  readOnly: false,
  error: false,
  helperText: "",
  min: "",
};

export default function JournalEntryForm({
  open,
  onClose,
  onSubmit,
  initialData,
  readOnly = false,
  activeLockDate = "",
}) {
  const [form, setForm] = useState(() => buildJournalEntryFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [contractRows, setContractRows] = useState([]);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [tenantRows, setTenantRows] = useState([]);
  const [customerRows, setCustomerRows] = useState([]);
  const [supplierRows, setSupplierRows] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [existingVrNos, setExistingVrNos] = useState([]);
  const [vrNosLoaded, setVrNosLoaded] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);

  const recordId = initialData?.id ?? initialData?.Id ?? null;
  const isPersistedRecord = recordId != null && recordId !== "";
  const isEditMode = isPersistedRecord && !readOnly;
  const isAddMode = !isPersistedRecord && !readOnly;
  const minDateAfterLock = useMemo(
    () => getMinCollectionReceiptDateAfterLock(activeLockDate),
    [activeLockDate]
  );
  const isFormLockedByDate = useMemo(
    () => Boolean(form.date) && isDateLockedByLockDate(form.date, activeLockDate),
    [activeLockDate, form.date]
  );
  const formReadOnly =
    readOnly || isFormLockedByDate || Boolean(form?.isLock) || Boolean(initialData?.isLock);

  const fetchExistingFiles = useCallback(async (id) => {
    if (id == null || id === "") return [];
    setLoadingExistingFiles(true);
    try {
      const files = await fetchJournalEntryUploadedFiles(id);
      setExistingFiles(files);
      return files;
    } catch (error) {
      console.error("Error fetching journal entry attachments:", error);
      setExistingFiles([]);
      return [];
    } finally {
      setLoadingExistingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    const loadOptions = async () => {
      setLoadingOptions(true);
      try {
        const [accounts, contractsRes, invoicesRes, tenantsRes, customersRes, suppliersRes] =
          await Promise.all([
            fetchJournalEntryAccountOptions(),
            contractApi.getAllRecords(),
            contractApi.getAllInvoiceScheduleRecords(),
            api.list("tenant"),
            customerApi.listCustomers(),
            supplierApi.listSuppliers(),
          ]);
        if (cancelled) return;
        setAccountOptions(accounts);
        setContractRows(unwrapList(contractsRes?.data ?? contractsRes));
        setInvoiceRows(unwrapList(invoicesRes?.data ?? invoicesRes));
        setTenantRows(unwrapList(tenantsRes));
        setCustomerRows(unwrapList(customersRes));
        setSupplierRows(unwrapList(suppliersRes));
      } catch (error) {
        console.error("Error loading journal entry options:", error);
        if (!cancelled) {
          setAccountOptions([]);
          setContractRows([]);
          setInvoiceRows([]);
        }
      } finally {
        if (!cancelled) setLoadingOptions(false);
      }
    };

    loadOptions();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) {
      setExistingVrNos([]);
      setVrNosLoaded(false);
      return undefined;
    }
    // Only generate next Vr No for brand-new entries (not view/edit of existing).
    if (isPersistedRecord) return undefined;
    let cancelled = false;

    const loadVrNos = async () => {
      try {
        const vrNos = await fetchJournalEntryVrNos(journalEntryApi);
        if (!cancelled) {
          setExistingVrNos(vrNos);
          setVrNosLoaded(true);
        }
      } catch (error) {
        console.error("Error loading journal entry Vr Nos:", error);
        if (!cancelled) {
          setExistingVrNos([]);
          setVrNosLoaded(true);
        }
      }
    };

    loadVrNos();
    return () => {
      cancelled = true;
    };
  }, [open, isPersistedRecord]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      const normalized = normalizeJournalEntryRecord(initialData);
      setForm({
        ...normalized,
        date: toJournalEntryInputDate(normalized.date),
        lines: normalized.lines?.length > 0 ? normalized.lines : [],
      });
    } else {
      setForm(buildJournalEntryFormState());
    }
    setErrors({});
    setSelectedFiles([]);
  }, [open, initialData]);

  // Load attachments whenever View/Edit opens for a saved journal entry.
  useEffect(() => {
    if (!open) {
      setExistingFiles([]);
      setLoadingExistingFiles(false);
      return undefined;
    }
    if (!isPersistedRecord) {
      setExistingFiles([]);
      setLoadingExistingFiles(false);
      return undefined;
    }

    let cancelled = false;
    const loadFiles = async () => {
      setLoadingExistingFiles(true);
      try {
        const files = await fetchJournalEntryUploadedFiles(recordId);
        if (!cancelled) setExistingFiles(files);
      } catch (error) {
        console.error("Error fetching journal entry attachments:", error);
        if (!cancelled) setExistingFiles([]);
      } finally {
        if (!cancelled) setLoadingExistingFiles(false);
      }
    };

    loadFiles();
    return () => {
      cancelled = true;
    };
  }, [open, isPersistedRecord, recordId]);

  useEffect(() => {
    if (!open || isPersistedRecord || !vrNosLoaded) return;
    const nextVrNo = computeNextJournalEntryVrNo(existingVrNos, form.date);
    setForm((prev) => (prev.vrNo === nextVrNo ? prev : { ...prev, vrNo: nextVrNo }));
  }, [form.date, open, isPersistedRecord, vrNosLoaded, existingVrNos]);

  const updateHeader = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateLine = (lineId, patch) => {
    setForm((prev) => ({
      ...prev,
      lines: (prev.lines || []).map((line) =>
        line.id === lineId
          ? { ...line, ...(typeof patch === "function" ? patch(line) : patch) }
          : line
      ),
    }));
  };

  const handleAddLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...(prev.lines || []), createJournalEntryLineRow()],
    }));
  };

  const handleDuplicateLine = (lineId) => {
    const source = (form.lines || []).find((line) => line.id === lineId);
    if (!source) return;
    setForm((prev) => ({
      ...prev,
      lines: [
        ...(prev.lines || []),
        createJournalEntryLineRow({
          ...source,
          id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        }),
      ],
    }));
  };

  const handleDeleteLine = (lineId) => {
    setForm((prev) => ({
      ...prev,
      lines: (prev.lines || []).filter((line) => line.id !== lineId),
    }));
  };

  const getLineContractOptions = useCallback(
    (line, account) =>
      buildJournalEntryContractOptions({
        contracts: contractRows,
        tenants: tenantRows,
        customers: customerRows,
        suppliers: supplierRows,
        lineAccount: account,
      }),
    [contractRows, tenantRows, customerRows, supplierRows]
  );

  const getLineInvoiceOptions = useCallback(
    (line, account) => {
      if (!line?.contractId && !line?.contractNo) return [];
      return buildJournalEntryInvoiceOptions(
        invoiceRows,
        { contractId: line.contractId, contractNo: line.contractNo },
        { includeInvoiceKey: line.invoiceKey || "" }
      );
    },
    [invoiceRows]
  );

  const totalAttachmentSlots = existingFiles.length + selectedFiles.length;

  const handleAttachmentSelect = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) return;

    const remaining = MAX_ATTACHMENT_FILES - totalAttachmentSlots;
    if (remaining <= 0) {
      window.alert(
        `Maximum ${MAX_ATTACHMENT_FILES} files allowed. Please delete some existing files before uploading new ones.`
      );
      return;
    }

    const validFiles = files.filter((file) => {
      if (file.size > JOURNAL_ENTRY_ATTACHMENT_MAX_BYTES) {
        window.alert(`File "${file.name}" exceeds 10 MB limit.`);
        return false;
      }
      return true;
    });

    if (!validFiles.length) return;
    setSelectedFiles((prev) => [...prev, ...validFiles.slice(0, remaining)]);
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleDeleteExistingFile = async (file) => {
    const fileId = file?.id ?? file?.fileId;
    if (!fileId) return;
    try {
      await deleteJournalEntryUploadedFile(fileId);
      await fetchExistingFiles(recordId);
    } catch (error) {
      console.error("Failed to delete journal entry attachment:", error);
      window.alert(`Failed to delete file: ${error.message}`);
    }
  };

  const handleDownloadExistingFile = async (file, index) => {
    try {
      await uploadApi.downloadFile(file, file.fileName || `File-${index + 1}`);
    } catch (error) {
      console.error("Failed to download journal entry attachment:", error);
      window.alert(`Download failed: ${error?.message || "Unknown error"}`);
    }
  };

  const persistForm = async (formToSave) => {
    if (isDateLockedByLockDate(formToSave.date, activeLockDate)) {
      window.alert(formatTransactionLockDateValidationMessage(activeLockDate));
      return null;
    }

    const validationErrors = validateJournalEntryForm(formToSave, accountOptions);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
      return null;
    }

    setSaving(true);
    try {
      const result = await onSubmit?.(formToSave);
      const savedId = result?.id ?? result?.Id;
      if (savedId && selectedFiles.length) {
        setIsUploading(true);
        try {
          await uploadJournalEntryAttachments(savedId, selectedFiles);
          setSelectedFiles([]);
          await fetchExistingFiles(savedId);
        } catch (error) {
          console.error("Error uploading journal entry files:", error);
          window.alert(`Saved but failed to upload files: ${error.message}`);
        } finally {
          setIsUploading(false);
        }
      }
      return result;
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    await persistForm(form);
  };

  const dialogTitle = formReadOnly
    ? "View Journal Entry"
    : isEditMode
    ? "Edit Journal Entry"
    : "Add Journal Entry";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xl" scroll="paper">
      <DialogTitle sx={{ color: "#344767", pb: 1 }}>{dialogTitle}</DialogTitle>
      <DialogContent dividers>
        {loadingOptions ? <CurrencyLoading /> : null}
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={4}>
            <JournalEntryDateField
              value={form.date}
              onChange={(value) => updateHeader("date", value)}
              disabled={formReadOnly || saving}
              readOnly={formReadOnly}
              min={minDateAfterLock}
              error={Boolean(errors.date)}
              helperText={errors.date}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Vr No"
              value={form.vrNo || ""}
              disabled={formReadOnly || saving || isAddMode}
              InputLabelProps={{ shrink: true }}
              size="small"
              placeholder={`${JOURNAL_ENTRY_VR_NO_PREFIX}-1/${getJournalEntryYearFromDate(
                form.date
              )}`}
              InputProps={{ readOnly: isAddMode }}
              error={Boolean(errors.vrNo)}
              helperText={errors.vrNo}
              sx={isAddMode ? readOnlyVrNoFieldSx : textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth
              label="Description"
              value={form.description || ""}
              onChange={(e) =>
                updateHeader(
                  "description",
                  e.target.value.slice(0, JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH)
                )
              }
              disabled={formReadOnly || saving}
              InputLabelProps={{ shrink: true }}
              size="small"
              inputProps={{ maxLength: JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH }}
              helperText={
                errors.description ||
                `${String(form.description || "").length}/${JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH}`
              }
              error={Boolean(errors.description)}
              sx={textFieldSx}
            />
          </Grid>
        </Grid>

        <JournalEntryLinesGrid
          lines={form.lines || []}
          accountOptions={accountOptions}
          getLineContractOptions={getLineContractOptions}
          getLineInvoiceOptions={getLineInvoiceOptions}
          errors={errors}
          saving={saving}
          readOnly={formReadOnly}
          onLineChange={updateLine}
          onAddLine={handleAddLine}
          onDuplicateLine={handleDuplicateLine}
          onDeleteLine={handleDeleteLine}
        />

        <MDBox mt={3}>
          <Typography variant="subtitle2" color="text" sx={{ mb: 1 }}>
            Attachments
            {isPersistedRecord
              ? ` (${existingFiles.length}/${MAX_ATTACHMENT_FILES})`
              : ` (max ${MAX_ATTACHMENT_FILES} files total)`}
          </Typography>
          {loadingExistingFiles ? (
            <MDBox display="flex" justifyContent="center" py={1}>
              <CurrencyLoading size={20} />
            </MDBox>
          ) : existingFiles.length > 0 ? (
            <Box mb={1}>
              <Typography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
                {formReadOnly ? "Uploaded files:" : "Already uploaded files:"}
              </Typography>
              <MDBox display="flex" flexDirection="column" gap={0.75}>
                {existingFiles.map((file, index) => (
                  <MDBox
                    key={file.id || file.fileName || index}
                    display="flex"
                    alignItems="center"
                    gap={1}
                  >
                    <MDButton
                      variant="outlined"
                      color="info"
                      size="small"
                      onClick={() => handleDownloadExistingFile(file, index)}
                      sx={{ justifyContent: "flex-start", flex: 1, textTransform: "none" }}
                    >
                      <Icon sx={{ mr: 1 }}>attach_file</Icon>
                      {file.fileName || `File ${index + 1}`}
                      {file.sizeFormatted || file.size
                        ? ` (${file.sizeFormatted || formatFileSize(file.size)})`
                        : ""}
                    </MDButton>
                    {!formReadOnly ? (
                      <MDButton
                        variant="text"
                        color="error"
                        size="small"
                        onClick={() => handleDeleteExistingFile(file)}
                        sx={{ minWidth: 0, px: 1 }}
                      >
                        <Icon fontSize="small">delete</Icon>
                      </MDButton>
                    ) : null}
                  </MDBox>
                ))}
              </MDBox>
            </Box>
          ) : isPersistedRecord && !loadingExistingFiles ? (
            <Typography variant="caption" color="text" display="block" sx={{ mb: 1 }}>
              No attachments uploaded.
            </Typography>
          ) : null}

          {!formReadOnly ? (
            totalAttachmentSlots >= MAX_ATTACHMENT_FILES ? (
              <Typography variant="caption" color="warning.main" display="block">
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
                  <Icon>cloud_upload</Icon>&nbsp; Upload Files ({totalAttachmentSlots}/
                  {MAX_ATTACHMENT_FILES})
                </MDButton>
              </>
            )
          ) : null}

          {selectedFiles.length > 0 ? (
            <Box mt={1}>
              <Typography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
                New files to upload:
              </Typography>
              {selectedFiles.map((file, index) => (
                <Chip
                  key={`${file.name}-${index}`}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  onDelete={formReadOnly ? undefined : () => handleRemoveSelectedFile(index)}
                  deleteIcon={<Icon fontSize="small">cancel</Icon>}
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          ) : null}
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton
          variant="outlined"
          color="secondary"
          onClick={onClose}
          disabled={saving || isUploading}
        >
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        {!formReadOnly ? (
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            disabled={saving || isUploading}
          >
            <Icon>save</Icon>&nbsp;{saving || isUploading ? "Saving…" : "Save"}
          </MDButton>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

JournalEntryForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
  readOnly: PropTypes.bool,
  activeLockDate: PropTypes.string,
};

JournalEntryForm.defaultProps = {
  onSubmit: undefined,
  initialData: undefined,
  readOnly: false,
  activeLockDate: "",
};
