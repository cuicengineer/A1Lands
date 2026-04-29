import { useState, useEffect, useCallback, useMemo, useRef } from "react";
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
import FormHelperText from "@mui/material/FormHelperText";
import Box from "@mui/material/Box";
import Typography from "@mui/material/Typography";
import CircularProgress from "@mui/material/CircularProgress";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Chip from "@mui/material/Chip";
import InputAdornment from "@mui/material/InputAdornment";
import CurrencyLoading from "components/CurrencyLoading";
import { format, parseISO, isValid } from "date-fns";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDButton from "components/MDButton";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import uploadApi from "services/api.upload.service";
import { fetchBankListsForDropdown, UPLOAD_TABLE_NAME } from "services/api.bankAccount.service";

const FUNDING_SOURCES = ["Public Fund", "Non-Public Fund"];
const CURRENCIES = ["PKR", "USD", "EUR", "CNY", "SAR", "INR", "Other"];
const ACCOUNT_TYPES = ["DPA", "Current", "PLS", "Saving", "Special Saving", "Investment", "Other"];
const STATUS_OPTIONS = ["Active", "Dormant", "Closed"];
const AUTHORITY_OPTIONS = ["Air HQs", "RAC", "Local"];

const MAX_ATTACHMENT_FILES = 5;
const MAX_REMARKS_CHARS = 500;
const MAX_REFERENCE_WORDS = 130;

/** Limits text to at most `maxWords` words (split on whitespace); used for Reference field. */
function limitReferenceWords(text, maxWords) {
  const s = String(text ?? "");
  const t = s.trim();
  if (!t) return "";
  const words = t.split(/\s+/);
  if (words.length <= maxWords) return s;
  return words.slice(0, maxWords).join(" ");
}

function countWords(text) {
  const t = String(text ?? "").trim();
  if (!t) return 0;
  return t.split(/\s+/).length;
}

function toInputDate(v) {
  if (v == null || v === "") return "";
  if (v instanceof Date && !Number.isNaN(v.getTime())) {
    return v.toISOString().slice(0, 10);
  }
  const s = String(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return "";
}

function buildFormState(overrides = {}) {
  const base = {
    openingDate: "",
    racId: "",
    baseId: "",
    fundingSource: "Public Fund",
    fundName: "",
    titleOfAccount: "",
    bankId: "",
    branchCode: "",
    branchAddress: "",
    accountNoIban: "",
    currency: "PKR",
    currencyOther: "",
    accountType: "Current",
    accountTypeOther: "",
    signatoryDate: "",
    signatory1: "",
    signatory2: "",
    signatory3: "",
    status: "Active",
    statusDate: "",
    remarks: "",
    authority: "Air HQs",
    reference: "",
  };
  const merged = { ...base, ...overrides };
  return {
    ...merged,
    openingDate: toInputDate(merged.openingDate),
    signatoryDate: toInputDate(merged.signatoryDate),
    statusDate: toInputDate(merged.statusDate),
  };
}

function normalizeIban(s) {
  return String(s || "")
    .replace(/\s+/g, "")
    .toUpperCase();
}

function validateForm(form) {
  const e = {};
  if (!form.openingDate) e.openingDate = "Opening Date is required";
  if (!form.signatory1 || !String(form.signatory1).trim()) e.signatory1 = "Signatory-1 is required";
  if (!form.signatory2 || !String(form.signatory2).trim()) e.signatory2 = "Signatory-2 is required";
  if (form.currency === "Other" && !String(form.currencyOther || "").trim()) {
    e.currencyOther = "Currency is required (max 20 characters)";
  }
  if (form.accountType === "Other" && !String(form.accountTypeOther || "").trim()) {
    e.accountTypeOther = "Type is required (max 20 characters)";
  }

  const rawBranch = String(form.branchCode || "").trim();
  if (rawBranch && !/^\d+$/.test(rawBranch)) e.branchCode = "Branch code must be numeric";

  const iban = normalizeIban(form.accountNoIban);
  if (iban) {
    if (iban.length < 24) e.accountNoIban = "IBAN must be at least 24 characters";
    else if (!/^[A-Z0-9]+$/i.test(iban))
      e.accountNoIban = "IBAN must be alphanumeric (spaces allowed)";
  }

  return e;
}

function toPayload(form, bankOptions = []) {
  const cmdId = form.racId === "" || form.racId == null ? null : Number(form.racId) || form.racId;
  const ibanNormalized = normalizeIban(form.accountNoIban);
  const currencyStored =
    form.currency === "Other"
      ? String(form.currencyOther || "")
          .trim()
          .slice(0, 20)
      : String(form.currency ?? "").trim();
  const accountTypeStored =
    form.accountType === "Other"
      ? String(form.accountTypeOther || "")
          .trim()
          .slice(0, 20)
      : String(form.accountType ?? "").trim();
  const bid = form.bankId === "" ? null : Number(form.bankId);
  const bankRow =
    bid != null && !Number.isNaN(bid)
      ? bankOptions.find((b) => Number(b?.id) === Number(bid))
      : null;
  const bankNameStored = bankRow ? String(bankRow.label ?? bankRow.name ?? "").trim() : "";
  return {
    openingDate: form.openingDate,
    racId: cmdId,
    cmdId,
    baseId: form.baseId === "" ? null : Number(form.baseId) || form.baseId,
    fundingSource: form.fundingSource,
    fundName: form.fundName,
    titleOfAccount: form.titleOfAccount,
    bankId: form.bankId === "" ? null : Number(form.bankId) || form.bankId,
    BankName: bankNameStored || null,
    bankName: bankNameStored || null,
    branchCode: form.branchCode === "" ? null : String(form.branchCode).trim(),
    branchAddress: form.branchAddress,
    accountNoIban: ibanNormalized || null,
    AccountNoIban: ibanNormalized || null,
    IBAN: ibanNormalized || null,
    currency: currencyStored,
    type: accountTypeStored || null,
    AccountType: accountTypeStored || null,
    accountType: accountTypeStored || null,
    signatoryDate: form.signatoryDate || null,
    signatory1: form.signatory1?.trim() || "",
    signatory2: form.signatory2?.trim() || "",
    signatory3: form.signatory3?.trim() || "",
    status: form.status,
    statusDate: form.statusDate || null,
    remarks: String(form.remarks ?? "").slice(0, MAX_REMARKS_CHARS),
    authority: form.authority,
    reference: limitReferenceWords(form.reference ?? "", MAX_REFERENCE_WORDS),
  };
}

function initialDataToFormOverrides(data) {
  if (!data) return {};
  const rawCur = data.currency ?? data.Currency ?? "";
  const curStr = String(rawCur ?? "").trim();
  let currencyResolved = "PKR";
  let currencyOtherResolved = "";
  if (curStr) {
    if (CURRENCIES.includes(curStr)) {
      currencyResolved = curStr;
      currencyOtherResolved = "";
    } else {
      currencyResolved = "Other";
      currencyOtherResolved = curStr.slice(0, 20);
    }
  }
  const rawAcct = data.accountType ?? data.AccountType ?? data.type ?? data.Type ?? "";
  const acctStr = String(rawAcct ?? "").trim();
  let accountTypeResolved = "Current";
  let accountTypeOtherResolved = "";
  const otherFields = String(
    data.typeOther ?? data.TypeOther ?? data.accountTypeOther ?? data.AccountTypeOther ?? ""
  )
    .trim()
    .slice(0, 20);
  if (acctStr) {
    if (ACCOUNT_TYPES.includes(acctStr)) {
      accountTypeResolved = acctStr;
      accountTypeOtherResolved = acctStr === "Other" ? otherFields : "";
    } else {
      accountTypeResolved = "Other";
      accountTypeOtherResolved = acctStr.slice(0, 20);
    }
  } else if (otherFields) {
    accountTypeResolved = "Other";
    accountTypeOtherResolved = otherFields;
  }
  return {
    openingDate: data.openingDate ?? data.OpeningDate ?? "",
    racId: data.racId ?? data.RacId ?? "",
    baseId: data.baseId ?? data.BaseId ?? data.formationId ?? data.FormationId ?? "",
    fundingSource: data.fundingSource ?? data.FundingSource ?? "Public Fund",
    fundName: data.fundName ?? data.FundName ?? "",
    titleOfAccount: data.titleOfAccount ?? data.TitleOfAccount ?? "",
    bankId: data.bankId ?? data.BankId ?? "",
    branchCode: data.branchCode ?? data.BranchCode ?? "",
    branchAddress: data.branchAddress ?? data.BranchAddress ?? "",
    accountNoIban:
      data.accountNoIban ??
      data.AccountNoIban ??
      data.accountNoIBAN ??
      data.IBAN ??
      data.Iban ??
      "",
    currency: currencyResolved,
    currencyOther: currencyOtherResolved,
    accountType: accountTypeResolved,
    accountTypeOther: accountTypeOtherResolved,
    signatoryDate: data.signatoryDate ?? data.SignatoryDate ?? "",
    signatory1: data.signatory1 ?? data.Signatory1 ?? "",
    signatory2: data.signatory2 ?? data.Signatory2 ?? "",
    signatory3: data.signatory3 ?? data.Signatory3 ?? "",
    status: data.status ?? data.Status ?? "Active",
    statusDate: data.statusDate ?? data.StatusDate ?? "",
    remarks: String(data.remarks ?? data.Remarks ?? "").slice(0, MAX_REMARKS_CHARS),
    authority: data.authority ?? data.Authority ?? "Air HQs",
    reference: limitReferenceWords(data.reference ?? data.Reference ?? "", MAX_REFERENCE_WORDS),
  };
}

/**
 * @param {object} props
 * @param {boolean} props.open
 * @param {function} props.onClose
 * @param {function} props.onSubmit — async (payload) => { id?, ids? }
 * @param {object} [props.initialData]
 * @param {function} [props.onUploadSuccess] — e.g. refresh grid after upload/delete
 */
export default function BankAccountForm({ open, onClose, onSubmit, initialData, onUploadSuccess }) {
  const isEditMode = Boolean(initialData && (initialData.id ?? initialData.Id));
  const recordId = initialData?.id ?? initialData?.Id;
  const canSave = isEditMode ? canEditCurrentMenu() : canCreateCurrentMenu();
  const [form, setForm] = useState(() => buildFormState(initialDataToFormOverrides(initialData)));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);
  const [commandOptions, setCommandOptions] = useState([]);
  const [baseOptions, setBaseOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [loadingLists, setLoadingLists] = useState(true);

  const openingDateInputRef = useRef(null);
  const signatoryDateInputRef = useRef(null);
  const statusDateInputRef = useRef(null);

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

  const mergedInitialKey = useMemo(() => JSON.stringify(initialData || {}), [initialData]);

  const fetchExistingFiles = useCallback(async (id) => {
    if (id == null) return;
    setLoadingExistingFiles(true);
    try {
      const response = await uploadApi.getUploadedFiles(id, UPLOAD_TABLE_NAME);
      const filesArray = response?.files || (Array.isArray(response) ? response : []);
      const normalized = filesArray.map((f) => {
        if (typeof f === "string") {
          return {
            fileName: f.split(/[\\/]/).pop(),
            downloadUrl: f,
            id: null,
            fileId: null,
          };
        }
        const fileName =
          f?.fileName || f?.name || f?.filePath?.split(/[\\/]/).pop() || "Unknown File";
        const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
        return {
          ...f,
          fileName,
          downloadUrl,
          id: f?.id ?? f?.fileId,
          fileId: f?.fileId ?? f?.id,
        };
      });
      setExistingFiles(normalized);
    } catch (err) {
      console.error("Bank account attachments:", err);
      setExistingFiles([]);
    } finally {
      setLoadingExistingFiles(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setForm(buildFormState(initialDataToFormOverrides(initialData)));
      setErrors({});
    }
  }, [open, mergedInitialKey]);

  useEffect(() => {
    if (open && isEditMode && recordId) {
      setSelectedFiles([]);
      fetchExistingFiles(recordId);
    } else if (!open || !isEditMode) {
      setExistingFiles([]);
      setSelectedFiles([]);
    }
  }, [open, isEditMode, recordId, mergedInitialKey, fetchExistingFiles]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoadingLists(true);
      try {
        const [cmdRes, baseRes, banks] = await Promise.all([
          api.list("command").catch(() => []),
          api.list("base").catch(() => []),
          fetchBankListsForDropdown().catch(() => []),
        ]);
        if (!alive) return;
        const cmdArr = Array.isArray(cmdRes) ? cmdRes : [];
        setCommandOptions(
          cmdArr.map((cmd) => ({
            id: Number(cmd?.id),
            name: String(cmd?.name ?? cmd?.value ?? cmd?.label ?? cmd?.Name ?? cmd?.Value ?? ""),
          }))
        );
        const baseArr = Array.isArray(baseRes) ? baseRes : [];
        setBaseOptions(
          baseArr.map((b) => ({
            id: Number(b?.id),
            name: String(b?.name ?? b?.value ?? b?.label ?? b?.Name ?? b?.Value ?? ""),
            cmdId: Number(b?.cmdId ?? b?.cmd ?? b?.commandId ?? 0),
          }))
        );
        setBankOptions(banks);
      } catch (err) {
        console.error("Bank form dropdowns:", err);
      } finally {
        if (alive) setLoadingLists(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const onChange = useCallback(
    (field) => (event) => {
      const v = event.target.value;
      setForm((prev) => ({ ...prev, [field]: v }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const onRacChange = useCallback((event) => {
    const v = event.target.value;
    setForm((prev) => ({ ...prev, racId: v, baseId: "" }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.racId;
      delete next.baseId;
      return next;
    });
  }, []);

  const onAccountTypeChange = useCallback((event) => {
    const v = event.target.value;
    setForm((prev) => ({
      ...prev,
      accountType: v,
      accountTypeOther: v === "Other" ? prev.accountTypeOther : "",
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.accountType;
      delete next.accountTypeOther;
      return next;
    });
  }, []);

  const onCurrencyChange = useCallback((event) => {
    const v = event.target.value;
    setForm((prev) => ({
      ...prev,
      currency: v,
      currencyOther: v === "Other" ? prev.currencyOther : "",
    }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next.currency;
      delete next.currencyOther;
      return next;
    });
  }, []);

  const onReferenceChange = useCallback((event) => {
    const limited = limitReferenceWords(event.target.value, MAX_REFERENCE_WORDS);
    setForm((prev) => ({ ...prev, reference: limited }));
  }, []);

  const filteredBaseOptions = useMemo(() => {
    if (form.racId === "" || form.racId == null || form.racId === 0 || form.racId === "0")
      return [];
    const numRac = Number(form.racId);
    return baseOptions.filter((b) => Number(b.cmdId) === numRac);
  }, [baseOptions, form.racId]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const handleFileSelect = (event) => {
    const list = event.target?.files ? Array.from(event.target.files) : [];
    const totalExisting = existingFiles.length;
    const totalSelected = selectedFiles.length;
    const currentTotal = totalExisting + totalSelected;
    const remaining = MAX_ATTACHMENT_FILES - currentTotal;
    if (currentTotal >= MAX_ATTACHMENT_FILES) {
      window.alert(
        "Maximum 5 files allowed. Please delete some existing files before uploading new ones."
      );
      event.target.value = "";
      return;
    }
    if (list.length > remaining) {
      window.alert(
        `You can only upload ${remaining} more file(s). Maximum 5 files allowed (${totalExisting} already uploaded).`
      );
      event.target.value = "";
      return;
    }
    const maxFileSize = 10 * 1024 * 1024;
    const validFiles = list.filter((file) => {
      if (file.size > maxFileSize) {
        window.alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });
    if (currentTotal + validFiles.length > MAX_ATTACHMENT_FILES) {
      const allowedCount = MAX_ATTACHMENT_FILES - currentTotal;
      window.alert(
        `You can only upload ${allowedCount} more file(s). Maximum 5 files allowed (${totalExisting} already uploaded).`
      );
      event.target.value = "";
      return;
    }
    setSelectedFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleRemoveNewFile = (index) => {
    setSelectedFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const openAttachmentDownload = (file) => {
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
      window.alert("Download URL is not available for this file.");
    }
  };

  const handleDeleteExistingFile = async (file) => {
    if (!canDeleteCurrentMenu()) return;
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      window.alert("File ID is not available. Cannot delete this file.");
      return;
    }
    if (!window.confirm(`Delete "${file.fileName || file.name || "this file"}"?`)) return;
    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (recordId) await fetchExistingFiles(recordId);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Failed to delete file");
    }
  };

  const handleSave = async () => {
    const v = validateForm(form);
    if (Object.keys(v).length) {
      setErrors(v);
      window.alert("Please fix the validation errors before saving.");
      return;
    }
    if (!canSave) {
      window.alert("You are not allowed to save in this module.");
      return;
    }
    setSubmitting(true);
    setErrors({});
    try {
      const payload = toPayload(form, bankOptions);
      await onSubmit(payload);
      const id = initialData?.id ?? initialData?.Id;
      if (isEditMode && id && selectedFiles.length > 0) {
        setIsUploading(true);
        try {
          await uploadApi.uploadFiles(id, UPLOAD_TABLE_NAME, selectedFiles);
          setSelectedFiles([]);
          if (onUploadSuccess) onUploadSuccess();
        } catch (uploadErr) {
          console.error(uploadErr);
          window.alert(
            `Saved, but file upload failed: ${
              uploadErr?.message || String(uploadErr) || "Unknown error"
            }`
          );
        } finally {
          setIsUploading(false);
        }
      }
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Failed to save bank account");
    } finally {
      setSubmitting(false);
    }
  };

  const gridItem = (children) => (
    <Grid item xs={12} md={4}>
      {children}
    </Grid>
  );

  const gridItemFull = (children) => (
    <Grid item xs={12}>
      {children}
    </Grid>
  );

  const setDateField = (field) => (e) => {
    const v = e.target.value;
    setForm((prev) => ({ ...prev, [field]: v }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {isEditMode ? "Edit Bank Account" : "New Bank Account"}
      </DialogTitle>
      <DialogContent>
        {loadingLists && (
          <Box display="flex" alignItems="center" gap={1} mb={2}>
            <CircularProgress size={20} />
            <Typography variant="body2" color="text.secondary">
              Loading options…
            </Typography>
          </Box>
        )}

        <Grid container spacing={2} mt={0.5}>
          {gridItem(
            <MDBox sx={{ position: "relative" }}>
              <input
                type="date"
                ref={openingDateInputRef}
                value={form.openingDate || ""}
                onChange={setDateField("openingDate")}
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
                label="Opening Date"
                type="text"
                value={toDisplayDate(form.openingDate)}
                readOnly
                fullWidth
                size="small"
                required
                error={!!errors.openingDate}
                helperText={errors.openingDate}
                onClick={() => openDatePicker(openingDateInputRef)}
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
          )}

          {gridItem(
            <FormControl fullWidth size="small">
              <InputLabel id="bank-form-rac">RAC</InputLabel>
              <Select
                labelId="bank-form-rac"
                label="RAC"
                value={form.racId === null || form.racId === undefined ? "" : String(form.racId)}
                onChange={onRacChange}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {commandOptions.map((o) => (
                  <MenuItem key={o.id} value={String(o.id)}>
                    {o.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {gridItem(
            <FormControl
              fullWidth
              size="small"
              disabled={
                form.racId === "" || form.racId == null || form.racId === 0 || form.racId === "0"
              }
            >
              <InputLabel id="bank-form-base">Base</InputLabel>
              <Select
                labelId="bank-form-base"
                label="Base"
                value={form.baseId === null || form.baseId === undefined ? "" : String(form.baseId)}
                onChange={onChange("baseId")}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {filteredBaseOptions.map((o) => (
                  <MenuItem key={o.id} value={String(o.id)}>
                    {o.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {gridItem(
            <FormControl fullWidth size="small" required>
              <InputLabel id="bank-funding">Funding Source</InputLabel>
              <Select
                labelId="bank-funding"
                label="Funding Source"
                value={form.fundingSource}
                onChange={onChange("fundingSource")}
              >
                {FUNDING_SOURCES.map((f) => (
                  <MenuItem key={f} value={f}>
                    {f}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {gridItem(
            <TextField
              fullWidth
              label="Fund Name"
              value={form.fundName}
              onChange={onChange("fundName")}
              size="small"
            />
          )}

          {gridItem(
            <TextField
              fullWidth
              label="Title of Account"
              value={form.titleOfAccount}
              onChange={onChange("titleOfAccount")}
              size="small"
            />
          )}

          {gridItem(
            <FormControl fullWidth size="small">
              <InputLabel id="bank-name">Bank Name</InputLabel>
              <Select
                labelId="bank-name"
                label="Bank Name"
                value={form.bankId === null || form.bankId === undefined ? "" : String(form.bankId)}
                onChange={onChange("bankId")}
              >
                <MenuItem value="">
                  <em>None</em>
                </MenuItem>
                {bankOptions.map((o) => (
                  <MenuItem key={o.id} value={String(o.id)}>
                    {o.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {gridItem(
            <TextField
              fullWidth
              label="Branch Code"
              value={form.branchCode}
              onChange={onChange("branchCode")}
              error={!!errors.branchCode}
              helperText={errors.branchCode || ""}
              placeholder="Numeric only"
              size="small"
              inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            />
          )}

          {gridItemFull(
            <TextField
              fullWidth
              label="Branch Address"
              value={form.branchAddress}
              onChange={onChange("branchAddress")}
              size="small"
            />
          )}

          {gridItem(
            <TextField
              fullWidth
              label="Account No (IBAN)"
              value={form.accountNoIban}
              onChange={onChange("accountNoIban")}
              error={!!errors.accountNoIban}
              helperText={errors.accountNoIban || ""}
              placeholder="Min 24 alphanumeric characters"
              size="small"
              inputProps={{ maxLength: 64 }}
            />
          )}

          {gridItem(
            form.currency === "Other" ? (
              <TextField
                fullWidth
                required
                label="Currency"
                value={form.currencyOther}
                onChange={(e) => {
                  const v = String(e.target.value).slice(0, 20);
                  setForm((prev) => ({ ...prev, currencyOther: v }));
                  setErrors((prev) => {
                    if (!prev.currencyOther) return prev;
                    const next = { ...prev };
                    delete next.currencyOther;
                    return next;
                  });
                }}
                error={!!errors.currencyOther}
                helperText={errors.currencyOther || `${String(form.currencyOther || "").length}/20`}
                size="small"
                inputProps={{ maxLength: 20 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        title="Choose from list"
                        onClick={() => {
                          setForm((prev) => ({ ...prev, currency: "PKR", currencyOther: "" }));
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.currencyOther;
                            return next;
                          });
                        }}
                        edge="end"
                      >
                        <Icon fontSize="small">list</Icon>
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            ) : (
              <FormControl fullWidth size="small" required>
                <InputLabel id="cur">Currency</InputLabel>
                <Select
                  labelId="cur"
                  label="Currency"
                  value={form.currency}
                  onChange={onCurrencyChange}
                >
                  {CURRENCIES.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )
          )}

          {gridItem(
            form.accountType === "Other" ? (
              <TextField
                fullWidth
                required
                label="Type"
                value={form.accountTypeOther}
                onChange={(e) => {
                  const v = String(e.target.value).slice(0, 20);
                  setForm((prev) => ({ ...prev, accountTypeOther: v }));
                  setErrors((prev) => {
                    if (!prev.accountTypeOther) return prev;
                    const next = { ...prev };
                    delete next.accountTypeOther;
                    return next;
                  });
                }}
                error={!!errors.accountTypeOther}
                helperText={
                  errors.accountTypeOther || `${String(form.accountTypeOther || "").length}/20`
                }
                size="small"
                inputProps={{ maxLength: 20 }}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton
                        size="small"
                        title="Choose from list"
                        onClick={() => {
                          setForm((prev) => ({
                            ...prev,
                            accountType: "Current",
                            accountTypeOther: "",
                          }));
                          setErrors((prev) => {
                            const next = { ...prev };
                            delete next.accountTypeOther;
                            return next;
                          });
                        }}
                        edge="end"
                      >
                        <Icon fontSize="small">list</Icon>
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            ) : (
              <FormControl fullWidth size="small" required>
                <InputLabel id="acc-type">Type</InputLabel>
                <Select
                  labelId="acc-type"
                  label="Type"
                  value={form.accountType}
                  onChange={onAccountTypeChange}
                >
                  {ACCOUNT_TYPES.map((c) => (
                    <MenuItem key={c} value={c}>
                      {c}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )
          )}

          {gridItemFull(
            <MDBox sx={{ position: "relative" }}>
              <input
                type="date"
                ref={signatoryDateInputRef}
                value={form.signatoryDate || ""}
                onChange={setDateField("signatoryDate")}
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
                label="Signatory Date"
                type="text"
                value={toDisplayDate(form.signatoryDate)}
                readOnly
                fullWidth
                size="small"
                onClick={() => openDatePicker(signatoryDateInputRef)}
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
          )}

          {gridItemFull(
            <TextField
              fullWidth
              required
              label="Signatory-1 (Rank Name Appointment Service#)"
              value={form.signatory1}
              onChange={onChange("signatory1")}
              error={!!errors.signatory1}
              helperText={errors.signatory1}
              size="small"
            />
          )}

          {gridItemFull(
            <TextField
              fullWidth
              required
              label="Signatory-2 (Rank Name Appointment Service#)"
              value={form.signatory2}
              onChange={onChange("signatory2")}
              error={!!errors.signatory2}
              helperText={errors.signatory2}
              size="small"
            />
          )}

          {gridItemFull(
            <TextField
              fullWidth
              label="Signatory-3 (optional)"
              value={form.signatory3}
              onChange={onChange("signatory3")}
              size="small"
            />
          )}

          {gridItem(
            <FormControl fullWidth size="small" required>
              <InputLabel id="st">Status</InputLabel>
              <Select labelId="st" label="Status" value={form.status} onChange={onChange("status")}>
                {STATUS_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {gridItem(
            <MDBox sx={{ position: "relative" }}>
              <input
                type="date"
                ref={statusDateInputRef}
                value={form.statusDate || ""}
                onChange={setDateField("statusDate")}
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
                label="Status Date"
                type="text"
                value={toDisplayDate(form.statusDate)}
                readOnly
                fullWidth
                size="small"
                onClick={() => openDatePicker(statusDateInputRef)}
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
          )}

          {gridItemFull(
            <TextField
              fullWidth
              multiline
              minRows={3}
              label="Remarks"
              value={form.remarks}
              onChange={onChange("remarks")}
              size="small"
              inputProps={{ maxLength: MAX_REMARKS_CHARS }}
              helperText={`${String(form.remarks || "").length}/${MAX_REMARKS_CHARS}`}
            />
          )}

          {gridItem(
            <FormControl fullWidth size="small" required>
              <InputLabel id="auth">Authority</InputLabel>
              <Select
                labelId="auth"
                label="Authority"
                value={form.authority}
                onChange={onChange("authority")}
              >
                {AUTHORITY_OPTIONS.map((c) => (
                  <MenuItem key={c} value={c}>
                    {c}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {gridItemFull(
            <TextField
              fullWidth
              label="Reference"
              value={form.reference}
              onChange={onReferenceChange}
              size="small"
              helperText={`${countWords(form.reference)}/${MAX_REFERENCE_WORDS} words`}
            />
          )}

          {isEditMode && recordId && (
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
                  Attachments (max {MAX_ATTACHMENT_FILES} files total)
                </Typography>

                {loadingExistingFiles ? (
                  <Box display="flex" justifyContent="center" py={1}>
                    <CurrencyLoading size={20} />
                  </Box>
                ) : (
                  existingFiles.length > 0 && (
                    <Box mb={2}>
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        Uploaded files ({existingFiles.length}/{MAX_ATTACHMENT_FILES}):
                      </Typography>
                      {existingFiles.map((file, index) => (
                        <Box
                          key={file.id || file.fileId || `${file.fileName}-${index}`}
                          display="flex"
                          alignItems="center"
                          flexWrap="wrap"
                          gap={0.5}
                          mb={0.5}
                        >
                          <Chip
                            label={file.fileName || `File ${index + 1}`}
                            size="small"
                            variant="outlined"
                            sx={{ maxWidth: "100%" }}
                          />
                          <IconButton
                            size="small"
                            onClick={() => openAttachmentDownload(file)}
                            title="Open / download"
                            sx={{ padding: "2px" }}
                          >
                            <Icon fontSize="small">download</Icon>
                          </IconButton>
                          {canDeleteCurrentMenu() && (
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => handleDeleteExistingFile(file)}
                              title="Delete file"
                              sx={{ padding: "2px" }}
                            >
                              <Icon fontSize="small">delete</Icon>
                            </IconButton>
                          )}
                        </Box>
                      ))}
                    </Box>
                  )
                )}

                {existingFiles.length >= MAX_ATTACHMENT_FILES ? (
                  <Box
                    sx={{
                      p: 1.5,
                      bgcolor: "warning.light",
                      borderRadius: 1,
                      border: "1px solid",
                      borderColor: "warning.main",
                    }}
                  >
                    <Typography variant="body2" color="warning.dark">
                      Maximum {MAX_ATTACHMENT_FILES} files already uploaded. Delete a file to add
                      new ones.
                    </Typography>
                  </Box>
                ) : (
                  <>
                    <input
                      accept="*/*"
                      style={{ display: "none" }}
                      id="bank-acct-attachment-file-input"
                      type="file"
                      multiple
                      onChange={handleFileSelect}
                      disabled={
                        existingFiles.length + selectedFiles.length >= MAX_ATTACHMENT_FILES ||
                        isUploading
                      }
                    />
                    <label htmlFor="bank-acct-attachment-file-input">
                      <MDButton
                        variant="gradient"
                        color="info"
                        component="span"
                        size="small"
                        disabled={
                          existingFiles.length + selectedFiles.length >= MAX_ATTACHMENT_FILES ||
                          isUploading
                        }
                        sx={{ mb: 1 }}
                      >
                        <Icon>cloud_upload</Icon>&nbsp; Add files (
                        {existingFiles.length + selectedFiles.length}/{MAX_ATTACHMENT_FILES})
                      </MDButton>
                    </label>
                    {existingFiles.length + selectedFiles.length < MAX_ATTACHMENT_FILES && (
                      <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                        You can add{" "}
                        {MAX_ATTACHMENT_FILES - existingFiles.length - selectedFiles.length} more
                        file(s). New files upload after you click Save.
                      </Typography>
                    )}
                  </>
                )}

                {selectedFiles.length > 0 && (
                  <Box mt={1}>
                    <Typography variant="caption" color="text.secondary" display="block" mb={0.5}>
                      New files (uploaded when you save):
                    </Typography>
                    {selectedFiles.map((file, index) => (
                      <Chip
                        key={`${file.name}-${index}`}
                        label={`${file.name} (${formatFileSize(file.size)})`}
                        onDelete={() => handleRemoveNewFile(index)}
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
          )}
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton
          variant="outlined"
          color="secondary"
          onClick={onClose}
          disabled={submitting || isUploading}
        >
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          disabled={submitting || isUploading || !canSave}
        >
          <Icon>save</Icon>&nbsp;
          {isUploading ? "Uploading…" : submitting ? "Saving…" : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

BankAccountForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  onUploadSuccess: PropTypes.func,
};

BankAccountForm.defaultProps = {
  initialData: undefined,
  onUploadSuccess: undefined,
};
