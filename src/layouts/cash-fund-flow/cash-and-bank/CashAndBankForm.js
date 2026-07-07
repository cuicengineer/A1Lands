import { useEffect, useState } from "react";
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
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import CurrencyLoading from "components/CurrencyLoading";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import { fetchBankListsForDropdown } from "services/api.bankAccount.service";
import { fetchCurrenciesForDropdown } from "services/api.currency.service";
import {
  DEFAULT_CASH_AND_BANK_CURRENCY,
  MODE_OPTIONS,
  STATUS_OPTIONS,
  buildCashAndBankFormState,
  getCashAndBankCoaDropdownLabel,
  getCashAndBankCurrencyDropdownLabel,
  isCashAndBankCoaOption,
  mergeCashAndBankCurrencyOptions,
  normalizeCashAndBankCoaOption,
  normalizeCashAndBankRecord,
  pickField,
  validateCashAndBankForm,
} from "./cashAndBankUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
};

export default function CashAndBankForm({ open, onClose, onSubmit, initialData }) {
  const [form, setForm] = useState(() => buildCashAndBankFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [coaOptions, setCoaOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [currencyOptions, setCurrencyOptions] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      ...normalizeCashAndBankRecord(initialData),
      currency: DEFAULT_CASH_AND_BANK_CURRENCY,
    });
    setErrors({});
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    (async () => {
      setLoadingOptions(true);
      try {
        const [coaResponse, banks, currencies] = await Promise.all([
          chartOfAccountsApi.getAll(COA_SECTION_TYPE),
          fetchBankListsForDropdown().catch(() => []),
          fetchCurrenciesForDropdown().catch(() => []),
        ]);
        if (!alive) return;
        const coaRows = (chartOfAccountsApi.unwrapList(coaResponse) || [])
          .filter(isCashAndBankCoaOption)
          .map(normalizeCashAndBankCoaOption)
          .filter((row) => row.id != null);
        const savedCurrencyCode = pickField(initialData, "currency", "Currency");
        setCoaOptions(coaRows);
        setBankOptions(Array.isArray(banks) ? banks : []);
        setCurrencyOptions(
          mergeCashAndBankCurrencyOptions(
            Array.isArray(currencies) ? currencies : [],
            savedCurrencyCode
          )
        );
      } catch (error) {
        console.error("Error loading Cash & Bank form options:", error);
        if (alive) {
          setCoaOptions([]);
          setBankOptions([]);
          setCurrencyOptions([]);
        }
      } finally {
        if (alive) setLoadingOptions(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, initialData]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors?.[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSubmit = async () => {
    const nextErrors = validateCashAndBankForm(form);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      await onSubmit(form);
    } catch (error) {
      console.error("Error saving Cash & Bank record:", error);
      window.alert(error?.message || "Failed to save record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>
        {initialData?.id || initialData?.Id ? "Edit Cash & Bank" : "Add Cash & Bank"}
      </DialogTitle>
      <DialogContent dividers>
        {loadingOptions ? (
          <MDBox display="flex" justifyContent="center" py={4}>
            <CurrencyLoading size={32} />
          </MDBox>
        ) : (
          <Grid container spacing={2} sx={{ pt: 0.5 }}>
            <Grid item xs={12} md={6}>
              <MDInput
                label="Acct ID"
                value={form.acctId}
                onChange={(e) => handleChange("acctId", e.target.value)}
                fullWidth
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <MDInput
                label="Name *"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                error={Boolean(errors.name)}
                helperText={errors.name}
                fullWidth
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" error={Boolean(errors.coaId)} sx={textFieldSx}>
                <InputLabel id="cash-bank-coa-label">Control Account *</InputLabel>
                <SearchableSelect
                  labelId="cash-bank-coa-label"
                  label="Control Account *"
                  value={form.coaId === "" || form.coaId == null ? "" : Number(form.coaId)}
                  onChange={(e) => handleChange("coaId", e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select control account</em>
                  </MenuItem>
                  {coaOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {getCashAndBankCoaDropdownLabel(option)}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.coaId ? <FormHelperText>{errors.coaId}</FormHelperText> : null}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" error={Boolean(errors.currency)} sx={textFieldSx}>
                <InputLabel id="cash-bank-currency-label">Currency *</InputLabel>
                <SearchableSelect
                  labelId="cash-bank-currency-label"
                  label="Currency *"
                  value={form.currency || DEFAULT_CASH_AND_BANK_CURRENCY}
                  disabled
                >
                  {currencyOptions.map((option) => (
                    <MenuItem key={option.id ?? option.code} value={option.code}>
                      {getCashAndBankCurrencyDropdownLabel(option)}
                    </MenuItem>
                  ))}
                  {!currencyOptions.some(
                    (option) => String(option.code).toUpperCase() === DEFAULT_CASH_AND_BANK_CURRENCY
                  ) ? (
                    <MenuItem value={DEFAULT_CASH_AND_BANK_CURRENCY}>
                      {DEFAULT_CASH_AND_BANK_CURRENCY}
                    </MenuItem>
                  ) : null}
                </SearchableSelect>
                {errors.currency ? <FormHelperText>{errors.currency}</FormHelperText> : null}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" error={Boolean(errors.mode)} sx={textFieldSx}>
                <InputLabel id="cash-bank-mode-label">Mode *</InputLabel>
                <SearchableSelect
                  labelId="cash-bank-mode-label"
                  label="Mode *"
                  value={form.mode || ""}
                  onChange={(e) => handleChange("mode", e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select mode</em>
                  </MenuItem>
                  {MODE_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.mode ? <FormHelperText>{errors.mode}</FormHelperText> : null}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <MDInput
                label="IBAN"
                value={form.iban}
                onChange={(e) => handleChange("iban", e.target.value)}
                fullWidth
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" sx={textFieldSx}>
                <InputLabel id="cash-bank-bank-label">Bank</InputLabel>
                <SearchableSelect
                  labelId="cash-bank-bank-label"
                  label="Bank"
                  value={
                    form.bankListsId === "" || form.bankListsId == null
                      ? ""
                      : Number(form.bankListsId)
                  }
                  onChange={(e) => handleChange("bankListsId", e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select bank</em>
                  </MenuItem>
                  {bankOptions.map((bank) => (
                    <MenuItem key={bank.id} value={bank.id}>
                      {bank.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth size="small" sx={textFieldSx}>
                <InputLabel id="cash-bank-status-label">Status</InputLabel>
                <SearchableSelect
                  labelId="cash-bank-status-label"
                  label="Status"
                  value={form.status || "Active"}
                  onChange={(e) => handleChange("status", e.target.value)}
                >
                  {STATUS_OPTIONS.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
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
          Cancel
        </MDButton>
        <MDButton color="info" onClick={handleSubmit} disabled={saving || loadingOptions}>
          {saving ? "Saving..." : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

CashAndBankForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
};

CashAndBankForm.defaultProps = {
  initialData: null,
};
