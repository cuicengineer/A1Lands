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
import currencyApi, { findDefaultBaseCurrencyId } from "services/api.currency.service";
import {
  applyExchangeRateCurrencyFieldChange,
  buildExchangeRateFormState,
  filterExchangeRateCurrencyOptions,
  getBaseCurrencyCode,
  getExchangeRateCurrencyPairErrors,
  normalizeExchangeRateRecord,
  todayInputDate,
  toDisplayDate,
  toInputDate,
  validateExchangeRateForm,
} from "./exchangeRateUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
};

function openDatePicker(ref) {
  if (ref?.current) {
    if (ref.current.showPicker) ref.current.showPicker();
    else ref.current.click();
  }
}

export default function ExchangeRateForm({ open, onClose, onSubmit, initialData }) {
  const isEditMode = Boolean(initialData && (initialData.id ?? initialData.Id));
  const [form, setForm] = useState(() => buildExchangeRateFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [currencies, setCurrencies] = useState([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const transferDateInputRef = useRef(null);

  const currencyById = useMemo(() => {
    const map = {};
    currencies.forEach((c) => {
      if (c.id != null) map[Number(c.id)] = c;
    });
    return map;
  }, [currencies]);

  const baseCurrencyOptions = useMemo(
    () =>
      currencies.filter(
        (c) =>
          String(c.currencyType).toLowerCase() === "base" || String(c.code).toUpperCase() === "PKR"
      ),
    [currencies]
  );

  const foreignCurrencyOptions = useMemo(
    () => currencies.filter((c) => String(c.currencyType).toLowerCase() === "foreign"),
    [currencies]
  );

  const selectableBaseCurrencies = useMemo(() => {
    const pool = baseCurrencyOptions.length ? baseCurrencyOptions : currencies;
    return filterExchangeRateCurrencyOptions(pool, {
      excludeCurrencyId: form.foreignCurrencyId,
    });
  }, [baseCurrencyOptions, currencies, form.foreignCurrencyId]);

  const selectableForeignCurrencies = useMemo(() => {
    const pool = foreignCurrencyOptions.length ? foreignCurrencyOptions : currencies;
    return filterExchangeRateCurrencyOptions(pool, {
      excludeCurrencyId: form.baseCurrencyId,
    });
  }, [foreignCurrencyOptions, currencies, form.baseCurrencyId]);

  useEffect(() => {
    if (!open) return;
    const normalized = normalizeExchangeRateRecord(initialData);
    setForm({
      ...normalized,
      rateDate: toInputDate(normalized.rateDate) || todayInputDate(),
    });
    setErrors({});
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    (async () => {
      setLoadingOptions(true);
      try {
        const list = await currencyApi.fetchCurrenciesForDropdown();
        if (!alive) return;
        setCurrencies(Array.isArray(list) ? list : []);
        if (!isEditMode) {
          const defaultId = findDefaultBaseCurrencyId(list);
          setForm((prev) => ({
            ...prev,
            rateDate: prev.rateDate || todayInputDate(),
            baseCurrencyId: prev.baseCurrencyId || defaultId || "",
          }));
        }
      } catch (error) {
        console.error("Error loading exchange rate currencies:", error);
        if (alive) setCurrencies([]);
      } finally {
        if (alive) setLoadingOptions(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, isEditMode]);

  const handleChange = (field, value) => {
    setForm((prev) => {
      const next =
        field === "baseCurrencyId" || field === "foreignCurrencyId"
          ? applyExchangeRateCurrencyFieldChange(prev, field, value)
          : { ...prev, [field]: value };

      setErrors((prevErrors) => {
        const cleared = { ...prevErrors, [field]: undefined };
        if (field === "baseCurrencyId" || field === "foreignCurrencyId") {
          delete cleared.baseCurrencyId;
          delete cleared.foreignCurrencyId;
          return { ...cleared, ...getExchangeRateCurrencyPairErrors(next, currencyById) };
        }
        return cleared;
      });

      return next;
    });
  };

  const handleSubmit = async () => {
    const nextErrors = validateExchangeRateForm(form, currencyById);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      window.alert("Please fix the validation errors before saving.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit(form);
    } catch (error) {
      console.error("Error saving exchange rate:", error);
      window.alert(error?.message || "Failed to save exchange rate.");
    } finally {
      setSaving(false);
    }
  };

  const baseCode = getBaseCurrencyCode(form, currencyById);

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {isEditMode ? "Edit Exchange Rate" : "Add Exchange Rate"}
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
                <input
                  type="date"
                  ref={transferDateInputRef}
                  value={form.rateDate || ""}
                  onChange={(e) => handleChange("rateDate", e.target.value)}
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
                  label="Date *"
                  type="text"
                  value={toDisplayDate(form.rateDate)}
                  readOnly
                  fullWidth
                  required
                  error={Boolean(errors.rateDate)}
                  helperText={errors.rateDate}
                  onClick={() => openDatePicker(transferDateInputRef)}
                  InputProps={{
                    readOnly: true,
                    endAdornment: (
                      <InputAdornment position="end">
                        <Icon sx={{ cursor: "pointer" }}>calendar_today</Icon>
                      </InputAdornment>
                    ),
                  }}
                  sx={{ ...textFieldSx, "& .MuiInputBase-input": { cursor: "pointer" } }}
                />
              </MDBox>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl
                fullWidth
                size="small"
                required
                error={Boolean(errors.baseCurrencyId)}
                sx={textFieldSx}
              >
                <InputLabel id="exchange-rate-base-currency">Base Currency *</InputLabel>
                <SearchableSelect
                  labelId="exchange-rate-base-currency"
                  label="Base Currency *"
                  value={
                    form.baseCurrencyId === "" || form.baseCurrencyId == null
                      ? ""
                      : Number(form.baseCurrencyId)
                  }
                  onChange={(e) => handleChange("baseCurrencyId", e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select base currency</em>
                  </MenuItem>
                  {selectableBaseCurrencies.map((opt) => (
                    <MenuItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.baseCurrencyId ? (
                  <FormHelperText>{errors.baseCurrencyId}</FormHelperText>
                ) : null}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <FormControl
                fullWidth
                size="small"
                required
                error={Boolean(errors.foreignCurrencyId)}
                sx={textFieldSx}
              >
                <InputLabel id="exchange-rate-foreign-currency">Foreign Currency *</InputLabel>
                <SearchableSelect
                  labelId="exchange-rate-foreign-currency"
                  label="Foreign Currency *"
                  value={
                    form.foreignCurrencyId === "" || form.foreignCurrencyId == null
                      ? ""
                      : Number(form.foreignCurrencyId)
                  }
                  onChange={(e) => handleChange("foreignCurrencyId", e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select foreign currency</em>
                  </MenuItem>
                  {selectableForeignCurrencies.map((opt) => (
                    <MenuItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.foreignCurrencyId ? (
                  <FormHelperText>{errors.foreignCurrencyId}</FormHelperText>
                ) : null}
              </FormControl>
            </Grid>
            <Grid item xs={12} md={6}>
              <MDInput
                label="Rate *"
                type="number"
                value={form.rate}
                onChange={(e) => handleChange("rate", e.target.value)}
                error={Boolean(errors.rate)}
                helperText={errors.rate}
                fullWidth
                inputProps={{ min: 0, step: "any" }}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">{`1 ${baseCode} =`}</InputAdornment>
                  ),
                }}
                sx={textFieldSx}
              />
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

ExchangeRateForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
};

ExchangeRateForm.defaultProps = {
  initialData: null,
};
