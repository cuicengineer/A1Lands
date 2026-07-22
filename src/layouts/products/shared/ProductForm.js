import { useEffect, useMemo, useState } from "react";
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
import {
  PRODUCT_STATUS_OPTIONS,
  PRODUCT_GOOD_ITEM_CODE_PREFIX,
  PRODUCT_SERVICE_ITEM_CODE_PREFIX,
  buildGoodPayload,
  buildServicePayload,
  fetchGoodsControlAccountOptions,
  fetchGoodsRevenueExpenseOptions,
  fetchServiceAccountOptions,
  fetchTaxCodeOptions,
  fetchProductItemCodes,
  generateNextProductItemCode,
  normalizeGoodRecord,
  normalizeServiceRecord,
  validateGoodForm,
  validateServiceForm,
  withSelectedAccountOption,
} from "./productUtils";
import ProductUomSelect from "./ProductUomSelect";

const textFieldSx = { "& .MuiInputBase-root": { minHeight: 40 } };

function emptyForm(mode) {
  return {
    itemCode: "",
    itemName: "",
    uom: "",
    controlAccountCoaId: "",
    saleAccountRef: "",
    purchaseAccountRef: "",
    defaultParticulars: "",
    defaultUnitPriceSales: "",
    defaultUnitPricePurchase: "",
    taxCodeId: "",
    status: "Active",
  };
}

export default function ProductForm({ open, onClose, onSubmit, initialData, mode, api }) {
  const isGood = mode === "good";
  const [form, setForm] = useState(emptyForm(mode));
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [taxOptions, setTaxOptions] = useState([]);
  const [accountOptions, setAccountOptions] = useState([]);
  const [controlOptions, setControlOptions] = useState([]);
  const [existingItemCodes, setExistingItemCodes] = useState([]);

  const editingId = initialData?.id ?? initialData?.Id ?? null;

  const saleAccountOptions = useMemo(
    () =>
      withSelectedAccountOption(
        accountOptions,
        form.saleAccountRef,
        form.saleAccountDisplay || initialData?.saleAccountDisplay
      ),
    [accountOptions, form.saleAccountRef, form.saleAccountDisplay, initialData?.saleAccountDisplay]
  );

  const purchaseAccountOptions = useMemo(
    () =>
      withSelectedAccountOption(
        accountOptions,
        form.purchaseAccountRef,
        form.purchaseAccountDisplay || initialData?.purchaseAccountDisplay
      ),
    [
      accountOptions,
      form.purchaseAccountRef,
      form.purchaseAccountDisplay,
      initialData?.purchaseAccountDisplay,
    ]
  );

  useEffect(() => {
    if (!open) return;
    const normalized = isGood
      ? normalizeGoodRecord(initialData)
      : normalizeServiceRecord(initialData);
    setForm({ ...emptyForm(mode), ...normalized });
    setErrors({});
  }, [open, initialData, mode, isGood]);

  useEffect(() => {
    if (!open) return undefined;
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const requests = [
          fetchTaxCodeOptions(),
          isGood ? fetchGoodsRevenueExpenseOptions() : fetchServiceAccountOptions(),
          isGood ? fetchGoodsControlAccountOptions() : Promise.resolve([]),
        ];
        if (api?.getAll) {
          requests.push(
            typeof api.getAllUnpaged === "function" ? api.getAllUnpaged() : api.getAll(1, 0)
          );
        }
        const results = await Promise.all(requests);
        if (!alive) return;
        setTaxOptions(results[0]);
        setAccountOptions(results[1]);
        setControlOptions(results[2] || []);
        if (api?.getAll) {
          const response = results[3];
          const rows = Array.isArray(response) ? response : response?.data ?? [];
          const itemCodeRows = Array.isArray(rows) ? rows : [];
          setExistingItemCodes(itemCodeRows);
          if (!editingId) {
            const prefix = isGood
              ? PRODUCT_GOOD_ITEM_CODE_PREFIX
              : PRODUCT_SERVICE_ITEM_CODE_PREFIX;
            const nextItemCode = generateNextProductItemCode(itemCodeRows, prefix);
            setForm((prev) => ({ ...prev, itemCode: nextItemCode }));
          }
        } else {
          setExistingItemCodes([]);
        }
      } catch (error) {
        console.error("Error loading product form options:", error);
        if (alive) {
          setExistingItemCodes([]);
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, isGood, api, editingId]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors?.[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    try {
      let freshItemCodes = existingItemCodes;
      if (api?.getAll) {
        freshItemCodes = await fetchProductItemCodes(api);
        setExistingItemCodes(freshItemCodes);
      }

      const validationOptions = { excludeId: editingId, existingItemCodes: freshItemCodes };
      const nextErrors = isGood
        ? validateGoodForm(form, validationOptions)
        : validateServiceForm(form, validationOptions);
      setErrors(nextErrors);
      if (Object.keys(nextErrors).length > 0) return;

      const payload = isGood ? buildGoodPayload(form) : buildServicePayload(form);
      await onSubmit(payload);
    } catch (error) {
      const message = error?.message || "Failed to save product.";
      if (/item code.*already exists|item code must be unique/i.test(message)) {
        setErrors((prev) => ({ ...prev, itemCode: "Item Code must be unique" }));
      }
      window.alert(message);
    } finally {
      setSaving(false);
    }
  };

  const title = isGood
    ? editingId
      ? "Edit Goods"
      : "Add Goods"
    : editingId
    ? "Edit Service"
    : "Add Service";

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent dividers>
        {loading ? (
          <MDBox display="flex" justifyContent="center" py={1} mb={1}>
            <CurrencyLoading size={24} />
          </MDBox>
        ) : null}
        <Grid container spacing={2} sx={{ pt: 0.5 }}>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Item Code"
              value={form.itemCode}
              onChange={(e) => handleChange("itemCode", e.target.value)}
              error={Boolean(errors.itemCode)}
              helperText={errors.itemCode}
              fullWidth
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Item Name *"
              value={form.itemName}
              onChange={(e) => handleChange("itemName", e.target.value)}
              error={Boolean(errors.itemName)}
              helperText={errors.itemName}
              fullWidth
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <ProductUomSelect
              label="UoM"
              value={form.uom || ""}
              onChange={(nextValue) => handleChange("uom", nextValue)}
              disabled={saving}
              sx={textFieldSx}
            />
          </Grid>
          {isGood && (
            <Grid item xs={12} md={6}>
              <FormControl
                fullWidth
                size="small"
                error={Boolean(errors.controlAccountCoaId)}
                sx={textFieldSx}
              >
                <InputLabel id="control-account-label">Control Account *</InputLabel>
                <SearchableSelect
                  labelId="control-account-label"
                  label="Control Account *"
                  value={
                    form.controlAccountCoaId === "" || form.controlAccountCoaId == null
                      ? ""
                      : Number(form.controlAccountCoaId)
                  }
                  onChange={(e) => handleChange("controlAccountCoaId", e.target.value)}
                  disabled={loading}
                >
                  <MenuItem value="">
                    <em>Select control account</em>
                  </MenuItem>
                  {controlOptions.map((opt) => (
                    <MenuItem key={opt.id} value={opt.id}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.controlAccountCoaId ? (
                  <FormHelperText>{errors.controlAccountCoaId}</FormHelperText>
                ) : null}
              </FormControl>
            </Grid>
          )}
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" sx={textFieldSx}>
              <InputLabel id="sale-account-label">Sale - Account</InputLabel>
              <SearchableSelect
                labelId="sale-account-label"
                label="Sale - Account"
                value={form.saleAccountRef || ""}
                onChange={(e) => handleChange("saleAccountRef", e.target.value)}
                disabled={loading}
              >
                <MenuItem value="">
                  <em>Select account</em>
                </MenuItem>
                {saleAccountOptions.map((opt) => (
                  <MenuItem key={opt.ref} value={opt.ref}>
                    {opt.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" sx={textFieldSx}>
              <InputLabel id="purchase-account-label">Purchase - Account</InputLabel>
              <SearchableSelect
                labelId="purchase-account-label"
                label="Purchase - Account"
                value={form.purchaseAccountRef || ""}
                onChange={(e) => handleChange("purchaseAccountRef", e.target.value)}
                disabled={loading}
              >
                <MenuItem value="">
                  <em>Select account</em>
                </MenuItem>
                {purchaseAccountOptions.map((opt) => (
                  <MenuItem key={`p-${opt.ref}`} value={opt.ref}>
                    {opt.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <MDInput
              label="Default Particulars"
              value={form.defaultParticulars}
              onChange={(e) => handleChange("defaultParticulars", e.target.value)}
              fullWidth
              multiline
              rows={2}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Default Unit Price - Sales"
              type="number"
              value={form.defaultUnitPriceSales}
              onChange={(e) => handleChange("defaultUnitPriceSales", e.target.value)}
              fullWidth
              inputProps={{ min: 0, step: "any" }}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <MDInput
              label="Default Unit Price - Purchase"
              type="number"
              value={form.defaultUnitPricePurchase}
              onChange={(e) => handleChange("defaultUnitPricePurchase", e.target.value)}
              fullWidth
              inputProps={{ min: 0, step: "any" }}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" sx={textFieldSx}>
              <InputLabel id="tax-code-label">Default - Tax Code</InputLabel>
              <SearchableSelect
                labelId="tax-code-label"
                label="Default - Tax Code"
                value={
                  form.taxCodeId === "" || form.taxCodeId == null ? "" : Number(form.taxCodeId)
                }
                onChange={(e) => handleChange("taxCodeId", e.target.value)}
                disabled={loading}
              >
                <MenuItem value="">
                  <em>Select tax code</em>
                </MenuItem>
                {taxOptions.map((opt) => (
                  <MenuItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={6}>
            <FormControl fullWidth size="small" sx={textFieldSx}>
              <InputLabel id="product-status-label">Status</InputLabel>
              <SearchableSelect
                labelId="product-status-label"
                label="Status"
                value={form.status || "Active"}
                onChange={(e) => handleChange("status", e.target.value)}
              >
                {PRODUCT_STATUS_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <MDButton color="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </MDButton>
        <MDButton color="info" onClick={handleSubmit} disabled={saving || loading}>
          {saving ? "Saving..." : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

ProductForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  mode: PropTypes.oneOf(["service", "good"]).isRequired,
  api: PropTypes.shape({
    getAll: PropTypes.func,
    getAllUnpaged: PropTypes.func,
  }),
};

ProductForm.defaultProps = {
  initialData: null,
  api: null,
};
