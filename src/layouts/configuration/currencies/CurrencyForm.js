import { useState, useEffect, useMemo, useCallback } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import FormHelperText from "@mui/material/FormHelperText";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import { canCreateCurrentMenu, canEditCurrentMenu } from "services/api.service";

const TYPE_OPTIONS = ["Base", "Foreign"];
const STATUS_OPTIONS = [
  { value: 1, label: "Active" },
  { value: 0, label: "Inactive" },
];

function normalizeFormStatus(raw) {
  if (raw === true || raw === 1 || raw === "1") return 1;
  if (raw === false || raw === 0 || raw === "0") return 0;
  if (typeof raw === "string" && raw.trim().toLowerCase() === "active") return 1;
  if (typeof raw === "string" && raw.trim().toLowerCase() === "inactive") return 0;
  return 1;
}

function buildFormState(overrides = {}) {
  return {
    code: "",
    name: "",
    currencyType: "Base",
    decimalPlaces: "",
    status: 1,
    ...overrides,
  };
}

function initialDataToFormOverrides(data) {
  if (!data) return {};
  const decimalRaw = data.decimalPlaces ?? data.DecimalPlaces ?? data.decimal ?? data.Decimal;
  return {
    code: data.code ?? data.Code ?? "",
    name: data.name ?? data.Name ?? "",
    currencyType: data.currencyType ?? data.CurrencyType ?? data.type ?? data.Type ?? "Base",
    decimalPlaces: decimalRaw != null && decimalRaw !== "" ? String(decimalRaw) : "",
    status: normalizeFormStatus(data.status ?? data.Status),
  };
}

function validateForm(form) {
  const errors = {};
  if (!String(form.code ?? "").trim()) errors.code = "Code is required";
  if (!String(form.name ?? "").trim()) errors.name = "Name is required";
  if (!String(form.currencyType ?? "").trim()) errors.currencyType = "Type is required";
  const decimalStr = String(form.decimalPlaces ?? "").trim();
  if (!decimalStr) errors.decimalPlaces = "Decimal is required";
  if (!/^\d+$/.test(decimalStr)) errors.decimalPlaces = "Decimal must be a whole number";
  if (form.status !== 0 && form.status !== 1 && form.status !== "0" && form.status !== "1") {
    errors.status = "Status is required";
  }
  return errors;
}

function toPayload(form) {
  const statusValue = form.status === 0 || form.status === "0" || form.status === false ? 0 : 1;
  return {
    Code: String(form.code ?? "")
      .trim()
      .toUpperCase(),
    Name: String(form.name ?? "").trim(),
    CurrencyType: String(form.currencyType ?? "").trim(),
    DecimalPlaces: Number.parseInt(String(form.decimalPlaces ?? "0"), 10),
    Status: statusValue,
  };
}

export default function CurrencyForm({ open, onClose, onSubmit, initialData }) {
  const isEditMode = Boolean(initialData && (initialData.id ?? initialData.Id));
  const canSave = isEditMode ? canEditCurrentMenu() : canCreateCurrentMenu();
  const mergedInitialKey = useMemo(() => JSON.stringify(initialData || {}), [initialData]);
  const [form, setForm] = useState(() => buildFormState(initialDataToFormOverrides(initialData)));
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fieldFont = {
    fontFamily: "inherit",
    fontSize: "1rem",
    fontWeight: 400,
    lineHeight: 1.5,
  };

  const textFieldSx = {
    "& .MuiInputBase-input": {
      ...fieldFont,
      padding: "10px 14px",
      minHeight: "45px",
    },
    "& .MuiInputLabel-root": { ...fieldFont },
    "& .MuiOutlinedInput-root": { borderRadius: 1.5 },
  };

  const selectFormControlSx = {
    "& .MuiInputLabel-root": { ...fieldFont },
    "& .MuiSelect-select": {
      ...fieldFont,
      minHeight: "45px !important",
      display: "flex",
      alignItems: "center",
      paddingTop: "10px",
      paddingBottom: "10px",
    },
    "& .MuiOutlinedInput-root": { borderRadius: 1.5 },
  };

  useEffect(() => {
    if (open) {
      setForm(buildFormState(initialDataToFormOverrides(initialData)));
      setErrors({});
    }
  }, [open, mergedInitialKey]);

  const onChange = useCallback(
    (field) => (event) => {
      let value = event.target.value;
      if (field === "status") {
        value = value === 0 || value === "0" ? 0 : 1;
      }
      setForm((prev) => ({ ...prev, [field]: value }));
      setErrors((prev) => {
        if (!prev[field]) return prev;
        const next = { ...prev };
        delete next[field];
        return next;
      });
    },
    []
  );

  const handleSave = async () => {
    const validationErrors = validateForm(form);
    if (Object.keys(validationErrors).length) {
      setErrors(validationErrors);
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
      await onSubmit(toPayload(form));
    } catch (err) {
      console.error(err);
      window.alert(err?.message || "Failed to save currency");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm" scroll="paper">
      <DialogTitle sx={{ fontSize: "1.25rem", fontWeight: 600 }}>
        {isEditMode ? "Edit Currency" : "New Currency"}
      </DialogTitle>
      <DialogContent sx={{ pt: 1 }}>
        <Grid container spacing={2.25} mt={0.25}>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="Code"
              value={form.code}
              onChange={onChange("code")}
              error={Boolean(errors.code)}
              helperText={errors.code}
              size="small"
              inputProps={{ maxLength: 10 }}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="Name"
              value={form.name}
              onChange={onChange("name")}
              error={Boolean(errors.name)}
              helperText={errors.name}
              size="small"
              inputProps={{ maxLength: 100 }}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <FormControl
              fullWidth
              size="small"
              required
              error={Boolean(errors.currencyType)}
              sx={selectFormControlSx}
            >
              <InputLabel id="currency-form-type">Type</InputLabel>
              <SearchableSelect
                labelId="currency-form-type"
                label="Type"
                value={form.currencyType}
                onChange={onChange("currencyType")}
              >
                {TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option} value={option}>
                    {option}
                  </MenuItem>
                ))}
              </SearchableSelect>
              {errors.currencyType && <FormHelperText>{errors.currencyType}</FormHelperText>}
            </FormControl>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              fullWidth
              required
              label="Decimal"
              value={form.decimalPlaces}
              onChange={onChange("decimalPlaces")}
              error={Boolean(errors.decimalPlaces)}
              helperText={errors.decimalPlaces}
              size="small"
              type="number"
              inputProps={{ min: 0, step: 1 }}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12}>
            <FormControl
              fullWidth
              size="small"
              required
              error={Boolean(errors.status)}
              sx={selectFormControlSx}
            >
              <InputLabel id="currency-form-status">Status</InputLabel>
              <SearchableSelect
                labelId="currency-form-status"
                label="Status"
                value={form.status}
                onChange={onChange("status")}
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={String(option.value)} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
              {errors.status && <FormHelperText>{errors.status}</FormHelperText>}
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={submitting}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        <MDButton
          variant="gradient"
          color="info"
          onClick={handleSave}
          disabled={submitting || !canSave}
        >
          <Icon>save</Icon>&nbsp;{submitting ? "Saving…" : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

CurrencyForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
};

CurrencyForm.defaultProps = {
  initialData: undefined,
};
