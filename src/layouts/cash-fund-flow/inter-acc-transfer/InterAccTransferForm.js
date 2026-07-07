import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import CurrencyLoading from "components/CurrencyLoading";
import interAccTransferApi from "services/api.interAccTransfer.service";
import { getMinCollectionReceiptDateAfterLock } from "layouts/income-agreements/collections/collectionsUtils";
import {
  LOCK_STATUS_OPTIONS,
  applyInterAccTransferAccountFieldChange,
  buildInterAccTransferFormState,
  computeNextInterAccTransferVrNo,
  fetchCashAndBankAccountsForDropdown,
  fetchInterAccTransferVrNos,
  filterInterAccTransferAccountOptions,
  formatInterAccTransferDisplayDate,
  getInterAccTransferAccountPairErrors,
  getInterAccTransferYearFromDate,
  INTER_ACC_TRANSFER_VR_NO_PREFIX,
  normalizeInterAccTransferRecord,
  shouldRequireInterAccTransferParticulars,
  shouldShowInterAccTransferSettlementVrNo,
  syncInterAccTransferReceivedInAmount,
  toInterAccTransferInputDate,
  validateInterAccTransferForm,
} from "./interAccTransferUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
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

function openDatePicker(ref) {
  if (ref?.current) {
    if (ref.current.showPicker) ref.current.showPicker();
    else ref.current.click();
  }
}

export default function InterAccTransferForm({
  open,
  onClose,
  onSubmit,
  initialData,
  readOnly = false,
  activeLockDate = "",
}) {
  const [form, setForm] = useState(() => buildInterAccTransferFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [accountOptions, setAccountOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [existingRecords, setExistingRecords] = useState([]);
  const [recordsLoaded, setRecordsLoaded] = useState(false);
  const transferDateInputRef = useRef(null);

  const isEditMode = Boolean(initialData?.id || initialData?.Id);
  const isAddMode = !isEditMode && !readOnly;
  const minTransferDate = useMemo(
    () => getMinCollectionReceiptDateAfterLock(activeLockDate),
    [activeLockDate]
  );

  const accountById = useMemo(() => {
    const map = {};
    accountOptions.forEach((opt) => {
      if (opt.id != null) map[Number(opt.id)] = opt;
    });
    return map;
  }, [accountOptions]);

  const paidFromAccountOptions = useMemo(() => {
    const matchCurrency = accountById[Number(form.receivedInAccountId)]?.currency || "";
    return filterInterAccTransferAccountOptions(accountOptions, {
      excludeAccountId: form.receivedInAccountId,
      matchCurrency,
    });
  }, [accountOptions, form.receivedInAccountId, accountById]);

  const receivedInAccountOptions = useMemo(() => {
    const matchCurrency = accountById[Number(form.paidFromAccountId)]?.currency || "";
    return filterInterAccTransferAccountOptions(accountOptions, {
      excludeAccountId: form.paidFromAccountId,
      matchCurrency,
    });
  }, [accountOptions, form.paidFromAccountId, accountById]);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeInterAccTransferRecord(initialData);
    setForm(
      syncInterAccTransferReceivedInAmount({
        ...normalized,
        transferDate: toInterAccTransferInputDate(normalized.transferDate),
      })
    );
    setErrors({});
  }, [open, initialData]);

  useEffect(() => {
    if (!open) {
      setRecordsLoaded(false);
      return undefined;
    }
    if (isEditMode) return undefined;
    let cancelled = false;

    const loadExistingRecords = async () => {
      try {
        const vrNos = await fetchInterAccTransferVrNos(interAccTransferApi);
        if (!cancelled) {
          setExistingRecords(vrNos);
          setRecordsLoaded(true);
        }
      } catch (error) {
        console.error("Error loading inter account transfer records for Vr No:", error);
        if (!cancelled) {
          setExistingRecords([]);
          setRecordsLoaded(true);
        }
      }
    };

    loadExistingRecords();
    return () => {
      cancelled = true;
    };
  }, [open, isEditMode]);

  useEffect(() => {
    if (!open || isEditMode || !recordsLoaded) return;
    setForm((prev) => {
      const nextVrNo = computeNextInterAccTransferVrNo(existingRecords, prev.transferDate);
      if (prev.vrNo === nextVrNo) return prev;
      return { ...prev, vrNo: nextVrNo };
    });
  }, [open, isEditMode, recordsLoaded, existingRecords, form.transferDate]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    (async () => {
      setLoadingOptions(true);
      try {
        const options = await fetchCashAndBankAccountsForDropdown();
        if (alive) setAccountOptions(options);
      } catch (error) {
        console.error("Error loading Cash & Bank accounts:", error);
        if (alive) setAccountOptions([]);
      } finally {
        if (alive) setLoadingOptions(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  const handleChange = (field, value) => {
    if (isAddMode && field === "vrNo") return;

    setForm((prev) => {
      if (field === "receivedInAmount") {
        return prev;
      }

      let next =
        field === "paidFromAccountId" || field === "receivedInAccountId"
          ? applyInterAccTransferAccountFieldChange(prev, field, value, accountById)
          : { ...prev, [field]: value };

      next = syncInterAccTransferReceivedInAmount(next);

      setErrors((prevErrors) => {
        const cleared = { ...prevErrors, [field]: undefined };
        if (field === "paidFromAccountId" || field === "receivedInAccountId") {
          delete cleared.paidFromAccountId;
          delete cleared.receivedInAccountId;
          return { ...cleared, ...getInterAccTransferAccountPairErrors(next, accountById) };
        }
        if (field === "paidFromAmount" || field === "receivedInAmount") {
          delete cleared.paidFromAmount;
          delete cleared.receivedInAmount;
        }
        return cleared;
      });

      return next;
    });
  };

  const particularsRequired = shouldRequireInterAccTransferParticulars(form, accountById);
  const showSettlementVrNo = shouldShowInterAccTransferSettlementVrNo(form, accountById);

  const getCurrencyPrefix = (accountId) => {
    const account = accountById[Number(accountId)];
    return account?.currency ? `${account.currency} ` : "";
  };

  const handleSubmit = async () => {
    let formToSave = form;
    if (isAddMode) {
      try {
        const freshVrNos = await fetchInterAccTransferVrNos(interAccTransferApi);
        const nextVrNo = computeNextInterAccTransferVrNo(freshVrNos, form.transferDate);
        formToSave = { ...form, vrNo: nextVrNo };
        setExistingRecords(freshVrNos);
        setForm(formToSave);
      } catch (error) {
        console.error("Error refreshing inter account transfer Vr Nos:", error);
      }
    }

    const nextErrors = validateInterAccTransferForm(formToSave, accountById, activeLockDate);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.alert("Please fix the validation errors before saving.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(formToSave);
    } catch (error) {
      console.error("Error saving inter account transfer:", error);
      window.alert(error?.message || "Failed to save transfer.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {readOnly
          ? "View Inter Acc Transfer"
          : initialData?.id || initialData?.Id
          ? "Edit Inter Acc Transfer"
          : "Add Inter Acc Transfer"}
      </DialogTitle>
      <DialogContent dividers>
        {loadingOptions ? (
          <MDBox display="flex" justifyContent="center" py={4}>
            <CurrencyLoading size={32} />
          </MDBox>
        ) : (
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <MDBox sx={{ position: "relative" }}>
                {!readOnly && (
                  <input
                    type="date"
                    ref={transferDateInputRef}
                    value={form.transferDate || ""}
                    min={minTransferDate || undefined}
                    onChange={(e) => handleChange("transferDate", e.target.value)}
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
                )}
                <MDInput
                  label="Date *"
                  type="text"
                  value={formatInterAccTransferDisplayDate(form.transferDate)}
                  readOnly
                  fullWidth
                  required
                  error={Boolean(errors.transferDate)}
                  helperText={errors.transferDate}
                  disabled={readOnly}
                  onClick={() => !readOnly && openDatePicker(transferDateInputRef)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: !readOnly ? (
                      <InputAdornment position="end">
                        <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                      </InputAdornment>
                    ) : undefined,
                  }}
                  sx={{
                    ...textFieldSx,
                    "& .MuiInputBase-input": readOnly ? undefined : { cursor: "pointer" },
                  }}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6}>
              <MDInput
                label="Vr No *"
                value={form.vrNo}
                onChange={(e) => handleChange("vrNo", e.target.value)}
                error={Boolean(errors.vrNo)}
                helperText={errors.vrNo}
                fullWidth
                disabled={readOnly || isAddMode}
                placeholder={`${INTER_ACC_TRANSFER_VR_NO_PREFIX}-1/${getInterAccTransferYearFromDate(
                  form.transferDate
                )}`}
                InputProps={{ readOnly: isAddMode }}
                sx={isAddMode ? readOnlyVrNoFieldSx : textFieldSx}
              />
            </Grid>
            <Grid item xs={12}>
              <MDInput
                label="Description"
                value={form.description}
                onChange={(e) => handleChange("description", e.target.value.slice(0, 15))}
                error={Boolean(errors.description)}
                helperText={errors.description || `${String(form.description || "").length}/15`}
                fullWidth
                disabled={readOnly}
                inputProps={{ maxLength: 15 }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} md={showSettlementVrNo ? 5 : 6}>
              <FormControl
                fullWidth
                size="small"
                error={Boolean(errors.paidFromAccountId)}
                sx={textFieldSx}
              >
                <InputLabel id="paid-from-account-label">Paid From *</InputLabel>
                <SearchableSelect
                  labelId="paid-from-account-label"
                  label="Paid From *"
                  value={
                    form.paidFromAccountId === "" || form.paidFromAccountId == null
                      ? ""
                      : Number(form.paidFromAccountId)
                  }
                  onChange={(e) => handleChange("paidFromAccountId", e.target.value)}
                  disabled={readOnly}
                >
                  <MenuItem value="">
                    <em>Select account</em>
                  </MenuItem>
                  {paidFromAccountOptions.map((opt) => (
                    <MenuItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.paidFromAccountId ? (
                  <FormHelperText>{errors.paidFromAccountId}</FormHelperText>
                ) : null}
              </FormControl>
            </Grid>
            {showSettlementVrNo ? (
              <Grid item xs={12} md={4}>
                <MDInput
                  label="Settlement Vr#"
                  value={form.settlementVrNo}
                  onChange={(e) => handleChange("settlementVrNo", e.target.value)}
                  fullWidth
                  disabled={readOnly}
                  sx={textFieldSx}
                />
              </Grid>
            ) : null}
            <Grid item xs={12} md={showSettlementVrNo ? 3 : 6}>
              <MDInput
                label="Amount *"
                type="number"
                value={form.paidFromAmount}
                onChange={(e) => handleChange("paidFromAmount", e.target.value)}
                error={Boolean(errors.paidFromAmount)}
                helperText={errors.paidFromAmount}
                fullWidth
                disabled={readOnly}
                inputProps={{ min: 0, step: "any" }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      {getCurrencyPrefix(form.paidFromAccountId)}
                    </InputAdornment>
                  ),
                }}
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl
                fullWidth
                size="small"
                error={Boolean(errors.receivedInAccountId)}
                sx={textFieldSx}
              >
                <InputLabel id="received-in-account-label">Received in *</InputLabel>
                <SearchableSelect
                  labelId="received-in-account-label"
                  label="Received in *"
                  value={
                    form.receivedInAccountId === "" || form.receivedInAccountId == null
                      ? ""
                      : Number(form.receivedInAccountId)
                  }
                  onChange={(e) => handleChange("receivedInAccountId", e.target.value)}
                  disabled={readOnly}
                >
                  <MenuItem value="">
                    <em>Select account</em>
                  </MenuItem>
                  {receivedInAccountOptions.map((opt) => (
                    <MenuItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.receivedInAccountId ? (
                  <FormHelperText>{errors.receivedInAccountId}</FormHelperText>
                ) : null}
              </FormControl>
            </Grid>
            {particularsRequired ? (
              <Grid item xs={12}>
                <MDInput
                  label="Particulars *"
                  value={form.particulars}
                  onChange={(e) => handleChange("particulars", e.target.value)}
                  error={Boolean(errors.particulars)}
                  helperText={errors.particulars}
                  fullWidth
                  multiline
                  rows={2}
                  required
                  disabled={readOnly}
                  sx={textFieldSx}
                />
              </Grid>
            ) : null}
            <Grid item xs={12} md={6}>
              <MDInput
                label="TIN-FTN"
                value={form.tinFtn}
                onChange={(e) => handleChange("tinFtn", e.target.value)}
                fullWidth
                disabled={readOnly}
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" sx={textFieldSx}>
                <InputLabel id="transfer-status-label">Status</InputLabel>
                <SearchableSelect
                  labelId="transfer-status-label"
                  label="Status"
                  value={form.status || "Unlock"}
                  onChange={(e) => handleChange("status", e.target.value)}
                  disabled
                >
                  {LOCK_STATUS_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
              </FormControl>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <MDButton color="secondary" onClick={onClose} disabled={saving}>
          {readOnly ? "Close" : "Cancel"}
        </MDButton>
        {!readOnly && (
          <MDButton color="info" onClick={handleSubmit} disabled={saving || loadingOptions}>
            {saving ? "Saving..." : "Save"}
          </MDButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

InterAccTransferForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
  readOnly: PropTypes.bool,
  activeLockDate: PropTypes.string,
};

InterAccTransferForm.defaultProps = {
  onSubmit: () => {},
  initialData: null,
  readOnly: false,
  activeLockDate: "",
};
