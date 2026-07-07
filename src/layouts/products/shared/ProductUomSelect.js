import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import FormHelperText from "@mui/material/FormHelperText";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import {
  PRODUCT_STATUS_OPTIONS,
  createProductUom,
  fetchProductUomOptions,
  updateProductUom,
  validateProductUomForm,
} from "./productUtils";

const textFieldSx = { "& .MuiInputBase-root": { minHeight: 40 } };

const emptyDialogForm = () => ({
  id: null,
  code: "",
  name: "",
  status: "Active",
});

export default function ProductUomSelect({
  value,
  onChange,
  disabled,
  error,
  helperText,
  label,
  sx,
}) {
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState("create");
  const [dialogForm, setDialogForm] = useState(emptyDialogForm);
  const [dialogErrors, setDialogErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const loadOptions = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchProductUomOptions();
      setOptions(rows);
    } catch (loadError) {
      console.error("Error loading UoM options:", loadError);
      setOptions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadOptions();
  }, [loadOptions]);

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value) || null,
    [options, value]
  );

  const openCreateDialog = () => {
    setDialogMode("create");
    setDialogForm(emptyDialogForm());
    setDialogErrors({});
    setDialogOpen(true);
  };

  const openEditDialog = () => {
    if (!selectedOption) return;
    setDialogMode("edit");
    setDialogForm({
      id: selectedOption.id,
      code: selectedOption.code,
      name: selectedOption.name || "",
      status: selectedOption.status || "Active",
    });
    setDialogErrors({});
    setDialogOpen(true);
  };

  const handleDialogChange = (field, nextValue) => {
    setDialogForm((prev) => ({ ...prev, [field]: nextValue }));
    if (dialogErrors?.[field]) {
      setDialogErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleDialogSave = async () => {
    const nextErrors = validateProductUomForm(dialogForm);
    setDialogErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      if (dialogMode === "create") {
        const created = await createProductUom(dialogForm);
        await loadOptions();
        if (created?.value) onChange(created.value);
      } else {
        await updateProductUom(dialogForm.id, dialogForm);
        await loadOptions();
        onChange(
          String(dialogForm.code || "")
            .trim()
            .toUpperCase()
        );
      }
      setDialogOpen(false);
    } catch (saveError) {
      window.alert(saveError?.message || "Failed to save UoM.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <MDBox display="flex" alignItems="flex-start" gap={0.5} sx={sx}>
        <FormControl fullWidth size="small" error={Boolean(error)} sx={textFieldSx}>
          <InputLabel id="product-uom-label" shrink>
            {label}
          </InputLabel>
          <SearchableSelect
            labelId="product-uom-label"
            label={label}
            value={value || ""}
            displayEmpty
            disabled={disabled || loading}
            onChange={(e) => onChange(e.target.value)}
          >
            <MenuItem value="">
              <em>Select UoM</em>
            </MenuItem>
            {options.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.code || option.value}
              </MenuItem>
            ))}
          </SearchableSelect>
          {error || helperText ? <FormHelperText>{error || helperText}</FormHelperText> : null}
        </FormControl>
        <Tooltip title="Add UoM">
          <span>
            <IconButton
              size="small"
              color="info"
              onClick={openCreateDialog}
              disabled={disabled || loading}
              sx={{ mt: 0.5 }}
            >
              <Icon fontSize="small">add</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Edit UoM">
          <span>
            <IconButton
              size="small"
              color="secondary"
              onClick={openEditDialog}
              disabled={disabled || loading || !selectedOption}
              sx={{ mt: 0.5 }}
            >
              <Icon fontSize="small">edit</Icon>
            </IconButton>
          </span>
        </Tooltip>
      </MDBox>

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>{dialogMode === "create" ? "Add UoM" : "Edit UoM"}</DialogTitle>
        <DialogContent dividers>
          <MDBox display="flex" flexDirection="column" gap={2} pt={0.5}>
            <MDInput
              label="Code *"
              value={dialogForm.code}
              onChange={(e) => handleDialogChange("code", e.target.value.toUpperCase())}
              error={Boolean(dialogErrors.code)}
              helperText={dialogErrors.code}
              fullWidth
              sx={textFieldSx}
            />
            <MDInput
              label="Name"
              value={dialogForm.name}
              onChange={(e) => handleDialogChange("name", e.target.value)}
              fullWidth
              sx={textFieldSx}
            />
            <FormControl fullWidth size="small" sx={textFieldSx}>
              <InputLabel id="uom-status-label">Status</InputLabel>
              <SearchableSelect
                labelId="uom-status-label"
                label="Status"
                value={dialogForm.status || "Active"}
                onChange={(e) => handleDialogChange("status", e.target.value)}
              >
                {PRODUCT_STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
          </MDBox>
        </DialogContent>
        <DialogActions>
          <MDButton color="secondary" onClick={() => setDialogOpen(false)} disabled={saving}>
            Cancel
          </MDButton>
          <MDButton color="info" onClick={handleDialogSave} disabled={saving}>
            {saving ? "Saving..." : "Save"}
          </MDButton>
        </DialogActions>
      </Dialog>
    </>
  );
}

ProductUomSelect.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  error: PropTypes.bool,
  helperText: PropTypes.string,
  label: PropTypes.string,
  sx: PropTypes.object,
};

ProductUomSelect.defaultProps = {
  value: "",
  disabled: false,
  error: false,
  helperText: "",
  label: "UoM",
  sx: undefined,
};
