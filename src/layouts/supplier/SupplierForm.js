import { useEffect, useState } from "react";
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
import Autocomplete from "@mui/material/Autocomplete";
import InputAdornment from "@mui/material/InputAdornment";
import Icon from "@mui/material/Icon";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import { fetchBankListsForDropdown } from "services/api.bankAccount.service";
import dealerApi from "services/api.dealer.service";
import { getDealerCodeOptionLabel, normalizeDealerFormOption } from "utils/dealerOptionUtils";
import { partyDealerBiodataFieldSx } from "utils/partyDealerBiodataFieldSx";
import { normalizePartyStatus } from "utils/partyStatusUtils";
import api from "services/api.service";
import {
  findPartyCoaOption,
  getPartyCoaDropdownLabel,
  isSupplierPartyCoaOption,
  isSupplierPayableCoaOption,
  isSupplierReceiptCoaOption,
  mergePartyCoaOption,
  normalizePartyCoaOption,
} from "utils/partyCoaUtils";
import {
  PROVINCE_OPTIONS,
  buildSupplierCode,
  buildSupplierFormState,
  normalizeSupplierRecord,
  validateSupplierForm,
} from "./supplierUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
};

const dealerFieldSx = partyDealerBiodataFieldSx;

function normalizeSupplierCoaOption(row) {
  return normalizePartyCoaOption(row);
}

function getSupplierCoaDropdownLabel(option) {
  return getPartyCoaDropdownLabel(option);
}

function findSupplierCoaOption(options, coaId) {
  return findPartyCoaOption(options, coaId);
}

function mergeSupplierCoaOption(options, option) {
  return mergePartyCoaOption(options, option);
}

export default function SupplierForm({
  open,
  onClose,
  onSubmit,
  initialData,
  isClone,
  existingRecords,
}) {
  const [form, setForm] = useState(() => buildSupplierFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [supplierCoaOptions, setSupplierCoaOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [dealerOptions, setDealerOptions] = useState([]);
  const isEditMode = Boolean(initialData?.id) && !isClone;

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    const fetchSupplierCoaOptions = async () => {
      try {
        const response = await chartOfAccountsApi.getAll(COA_SECTION_TYPE);
        let options = (chartOfAccountsApi.unwrapList(response) || [])
          .map(normalizeSupplierCoaOption)
          .filter((row) => row.id != null && isSupplierPartyCoaOption(row));

        const savedCoaId = initialData?.coaId ?? initialData?.CoaId;
        if (savedCoaId !== "" && savedCoaId != null) {
          const existing = findSupplierCoaOption(options, savedCoaId);
          if (!existing) {
            try {
              const savedRow = await api.get("ChartOfAccounts", savedCoaId);
              const savedOption = normalizeSupplierCoaOption(savedRow);
              if (savedOption.id != null && isSupplierPayableCoaOption(savedOption)) {
                options = mergeSupplierCoaOption(options, savedOption);
              }
            } catch (error) {
              console.error("Error fetching saved supplier payable CA:", error);
            }
          }
        }

        const savedCoaId2 = initialData?.coaId2 ?? initialData?.CoaId2;
        if (savedCoaId2 !== "" && savedCoaId2 != null) {
          const existing2 = findSupplierCoaOption(options, savedCoaId2);
          if (!existing2) {
            try {
              const savedRow2 = await api.get("ChartOfAccounts", savedCoaId2);
              const savedOption2 = normalizeSupplierCoaOption(savedRow2);
              if (savedOption2.id != null && isSupplierReceiptCoaOption(savedOption2)) {
                options = mergeSupplierCoaOption(options, savedOption2);
              }
            } catch (error) {
              console.error("Error fetching saved supplier receipt CA:", error);
            }
          }
        }

        options = options.sort((a, b) => {
          const idDiff = String(a.acctId).localeCompare(String(b.acctId), undefined, {
            numeric: true,
            sensitivity: "base",
          });
          if (idDiff !== 0) return idDiff;
          return String(a.acctName).localeCompare(String(b.acctName), undefined, {
            sensitivity: "base",
          });
        });
        if (!cancelled) setSupplierCoaOptions(options);
      } catch (error) {
        console.error("Error fetching supplier chart of account options:", error);
        if (!cancelled) setSupplierCoaOptions([]);
      }
    };

    const fetchBankOptions = async () => {
      try {
        const banks = await fetchBankListsForDropdown();
        if (!cancelled) setBankOptions(Array.isArray(banks) ? banks : []);
      } catch (error) {
        console.error("Error fetching bank options:", error);
        if (!cancelled) setBankOptions([]);
      }
    };

    const fetchDealerOptions = async () => {
      try {
        const response = await dealerApi.listActiveDealers();
        const options = (dealerApi.unwrapList(response) || []).map((row) =>
          normalizeDealerFormOption(row)
        );
        if (!cancelled) setDealerOptions(options);
      } catch (error) {
        console.error("Error fetching dealer options:", error);
        if (!cancelled) setDealerOptions([]);
      }
    };

    fetchSupplierCoaOptions();
    fetchBankOptions();
    fetchDealerOptions();

    return () => {
      cancelled = true;
    };
  }, [open, initialData?.coaId, initialData?.CoaId, initialData?.coaId2, initialData?.CoaId2]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm(normalizeSupplierRecord(initialData));
    } else {
      setForm(buildSupplierFormState());
    }
    setErrors({});
  }, [open, initialData]);

  useEffect(() => {
    if (!open || !initialData || !bankOptions.length) return;
    const savedId = initialData.bankListsId ?? initialData.BankListsId;
    if (savedId === "" || savedId == null) return;
    const idStr = String(savedId);
    if (bankOptions.some((option) => String(option.id) === idStr)) return;
    setBankOptions((options) => [{ id: savedId, label: idStr, name: idStr }, ...options]);
  }, [open, initialData, bankOptions]);

  useEffect(() => {
    if (!open || !initialData) return;
    const savedDealerId = initialData.dealerId ?? initialData.DealerId;
    if (savedDealerId === "" || savedDealerId == null) return;
    const idStr = String(savedDealerId);
    if (dealerOptions.some((option) => String(option.id) === idStr)) return;
    setDealerOptions((options) => [
      normalizeDealerFormOption({
        id: savedDealerId,
        code: initialData.code ?? initialData.Code,
        prefix: initialData.prefix ?? initialData.Prefix,
        rank: initialData.rank ?? initialData.Rank,
        name: initialData.name ?? initialData.Name,
        address: initialData.address ?? initialData.Address,
        province: initialData.province ?? initialData.Province,
        city: initialData.city ?? initialData.City,
        ntnCnic: initialData.ntnCnic ?? initialData.NtnCnic,
        gstNo: initialData.gstNo ?? initialData.GSTNo,
        telNo: initialData.telNo ?? initialData.TelNo,
        mobileNo: initialData.mobileNo ?? initialData.MobileNo,
        representative: initialData.representative ?? initialData.Representative,
        bankListsId: initialData.bankListsId ?? initialData.BankListsId,
        iban: initialData.iban ?? initialData.IBAN,
        status: initialData.status ?? initialData.Status,
      }),
      ...options,
    ]);
  }, [open, initialData, dealerOptions]);

  const applyDealerSelection = (dealer) => {
    if (!dealer) return;
    const code = dealer.code || buildSupplierCode(dealer.codeAlpha, dealer.codeNumeric);
    setForm((prev) => ({
      ...prev,
      dealerId: dealer.id,
      dealerName: dealer.label,
      code,
      codeAlpha: dealer.codeAlpha || "",
      codeNumeric: dealer.codeNumeric || "",
      prefix: dealer.prefix || "",
      rank: dealer.rank || "",
      name: dealer.name || "",
      address: dealer.address || "",
      province: dealer.province || "",
      city: dealer.city || "",
      ntnCnic: dealer.ntnCnic || "",
      gstNo: dealer.gstNo || "",
      telNo: dealer.telNo || "",
      mobileNo: dealer.mobileNo || "",
      representative: dealer.representative || "",
      bankListsId: dealer.bankListsId ?? "",
      iban: dealer.iban || "",
      status: normalizePartyStatus(dealer.status),
    }));
    if (dealer.bankListsId !== "" && dealer.bankListsId != null) {
      const idStr = String(dealer.bankListsId);
      setBankOptions((options) => {
        if (options.some((option) => String(option.id) === idStr)) return options;
        return [{ id: dealer.bankListsId, label: idStr, name: idStr }, ...options];
      });
    }
    setErrors((prev) => ({
      ...prev,
      dealerId: undefined,
      code: undefined,
      name: undefined,
    }));
  };

  const handleDealerCodeChange = (_, newValue) => {
    if (!newValue) {
      setForm((prev) =>
        buildSupplierFormState({
          coaId: prev.coaId,
          coaId2: prev.coaId2,
        })
      );
      setErrors((prev) => ({ ...prev, dealerId: undefined, code: undefined }));
      return;
    }
    applyDealerSelection(newValue);
  };

  const selectedDealer = dealerOptions.find(
    (option) => String(option.id) === String(form.dealerId ?? "")
  );
  const selectableDealerOptions = dealerOptions
    .filter((option) => {
      const optionId = Number(option?.id);
      if (!Number.isFinite(optionId)) return false;
      const currentDealerId = Number(form?.dealerId);
      if (Number.isFinite(currentDealerId) && optionId === currentDealerId) return true;
      return !(existingRecords || []).some((record) => {
        const recordId = Number(record?.id ?? record?.Id);
        const dealerId = Number(record?.dealerId ?? record?.DealerId);
        if (!Number.isFinite(dealerId) || dealerId !== optionId) return false;
        if (!isClone && form?.id != null && Number(form.id) === recordId) return false;
        return true;
      });
    })
    .filter((option) => Boolean(option.code))
    .sort((a, b) =>
      getDealerCodeOptionLabel(a).localeCompare(getDealerCodeOptionLabel(b), undefined, {
        sensitivity: "base",
      })
    );

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (
        field === "coaId" &&
        value !== "" &&
        value != null &&
        Number(value) === Number(prev.coaId2)
      ) {
        next.coaId2 = "";
      }

      if (
        field === "coaId2" &&
        value !== "" &&
        value != null &&
        Number(value) === Number(prev.coaId)
      ) {
        next.coaId2 = "";
      }

      return next;
    });
    if (errors?.[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleSave = async () => {
    const validationErrors = validateSupplierForm(form);
    const mergedErrors = {
      ...validationErrors,
      ...(errors.code ? { code: errors.code } : {}),
    };
    setErrors(mergedErrors);
    if (mergedErrors.code) {
      window.alert(mergedErrors.code);
      return;
    }
    if (Object.keys(mergedErrors).length > 0) {
      window.alert("Please complete all required fields before saving.");
      return;
    }
    setSaving(true);
    try {
      await onSubmit?.({ ...form, code: buildSupplierCode(form.codeAlpha, form.codeNumeric) });
      onClose?.();
    } catch (error) {
      window.alert(error?.message || "Failed to save supplier.");
    } finally {
      setSaving(false);
    }
  };

  const codeHasError = Boolean(errors.dealerId || errors.code);

  const primaryCoaOptions = supplierCoaOptions.filter(
    (option) =>
      isSupplierPayableCoaOption(option) &&
      (form.coaId2 === "" || form.coaId2 == null || Number(option.id) !== Number(form.coaId2))
  );

  const secondaryCoaOptions = supplierCoaOptions.filter(
    (option) =>
      isSupplierReceiptCoaOption(option) &&
      (form.coaId === "" || form.coaId == null || Number(option.id) !== Number(form.coaId))
  );

  const dealerBiodataReadOnly = true;

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
        <DialogTitle sx={{ color: "#344767", pb: 1 }}>
          {isClone ? "Clone Supplier" : isEditMode ? "Edit Supplier" : "Add New Supplier"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                fullWidth
                options={selectableDealerOptions}
                getOptionLabel={getDealerCodeOptionLabel}
                isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                value={selectedDealer || null}
                onChange={handleDealerCodeChange}
                renderOption={(props, option) => (
                  <li {...props} key={option.id}>
                    {getDealerCodeOptionLabel(option)}
                  </li>
                )}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Code"
                    required
                    error={codeHasError}
                    helperText={
                      errors.dealerId ||
                      errors.code ||
                      "Select an active dealer (Code — Rank — Name) to auto-fill details"
                    }
                    sx={textFieldSx}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <TextField
                fullWidth
                label="Rank"
                value={form.rank}
                size="small"
                disabled={dealerBiodataReadOnly}
                sx={dealerFieldSx}
                InputProps={{ readOnly: dealerBiodataReadOnly }}
              />
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth size="small" sx={dealerFieldSx}>
                <InputLabel>Status</InputLabel>
                <SearchableSelect
                  label="Status"
                  value={form.status}
                  disabled={dealerBiodataReadOnly}
                  onChange={(e) => updateField("status", normalizePartyStatus(e.target.value))}
                >
                  <MenuItem value={true}>Active</MenuItem>
                  <MenuItem value={false}>Inactive</MenuItem>
                </SearchableSelect>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={form.name}
                size="small"
                required
                disabled={dealerBiodataReadOnly}
                error={Boolean(errors.name)}
                helperText={errors.name}
                sx={dealerFieldSx}
                InputProps={{
                  readOnly: dealerBiodataReadOnly,
                  startAdornment: form.prefix ? (
                    <InputAdornment position="start">{form.prefix}</InputAdornment>
                  ) : null,
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Address"
                value={form.address}
                onChange={(e) => updateField("address", e.target.value)}
                size="small"
                required
                multiline
                minRows={2}
                disabled={dealerBiodataReadOnly}
                error={Boolean(errors.address)}
                helperText={errors.address}
                sx={dealerFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl
                fullWidth
                size="small"
                required
                error={Boolean(errors.province)}
                sx={dealerFieldSx}
              >
                <InputLabel>Province</InputLabel>
                <SearchableSelect
                  label="Province"
                  value={form.province}
                  disabled={dealerBiodataReadOnly}
                  onChange={(e) => updateField("province", e.target.value)}
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  {PROVINCE_OPTIONS.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.province && <FormHelperText>{errors.province}</FormHelperText>}
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="City"
                value={form.city}
                onChange={(e) => updateField("city", e.target.value)}
                size="small"
                required
                disabled={dealerBiodataReadOnly}
                error={Boolean(errors.city)}
                helperText={errors.city}
                sx={dealerFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="NTN / CNIC"
                value={form.ntnCnic}
                onChange={(e) => updateField("ntnCnic", e.target.value)}
                size="small"
                required
                disabled={dealerBiodataReadOnly}
                error={Boolean(errors.ntnCnic)}
                helperText={errors.ntnCnic}
                sx={dealerFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="GST No"
                value={form.gstNo}
                onChange={(e) => updateField("gstNo", e.target.value)}
                size="small"
                disabled={dealerBiodataReadOnly}
                sx={dealerFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Tel No"
                value={form.telNo}
                onChange={(e) => updateField("telNo", e.target.value)}
                size="small"
                disabled={dealerBiodataReadOnly}
                sx={dealerFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Mobile No"
                value={form.mobileNo}
                onChange={(e) => updateField("mobileNo", e.target.value)}
                size="small"
                disabled={dealerBiodataReadOnly}
                sx={dealerFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                fullWidth
                disableClearable
                options={primaryCoaOptions}
                getOptionLabel={(option) => getSupplierCoaDropdownLabel(option)}
                isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                value={findSupplierCoaOption(primaryCoaOptions, form.coaId)}
                onChange={(_, newValue) =>
                  updateField("coaId", newValue != null ? newValue.id : "")
                }
                ListboxProps={{ style: { maxHeight: 300 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Payable CA"
                    required
                    error={Boolean(errors.coaId)}
                    helperText={errors.coaId}
                    sx={textFieldSx}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                fullWidth
                disableClearable
                options={secondaryCoaOptions}
                getOptionLabel={(option) => getSupplierCoaDropdownLabel(option)}
                isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                value={findSupplierCoaOption(secondaryCoaOptions, form.coaId2)}
                onChange={(_, newValue) =>
                  updateField("coaId2", newValue != null ? newValue.id : "")
                }
                ListboxProps={{ style: { maxHeight: 300 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Receipt CA"
                    required
                    error={Boolean(errors.coaId2)}
                    helperText={errors.coaId2}
                    sx={textFieldSx}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small" sx={dealerFieldSx}>
                <InputLabel id="supplier-bank-label">Bank</InputLabel>
                <SearchableSelect
                  labelId="supplier-bank-label"
                  label="Bank"
                  disabled={dealerBiodataReadOnly}
                  value={
                    form.bankListsId === "" || form.bankListsId == null
                      ? ""
                      : String(form.bankListsId)
                  }
                  onChange={(e) => updateField("bankListsId", e.target.value)}
                >
                  <MenuItem value="">
                    <em>&nbsp;</em>
                  </MenuItem>
                  {bankOptions.map((option) => (
                    <MenuItem key={option.id} value={String(option.id)}>
                      {option.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
              </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="IBAN"
                value={form.iban}
                onChange={(e) => updateField("iban", e.target.value)}
                size="small"
                disabled={dealerBiodataReadOnly}
                sx={dealerFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={8}>
              <TextField
                fullWidth
                label="Representative"
                value={form.representative}
                onChange={(e) => updateField("representative", e.target.value)}
                size="small"
                disabled={dealerBiodataReadOnly}
                sx={dealerFieldSx}
              />
            </Grid>
          </Grid>
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
    </>
  );
}

SupplierForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
  isClone: PropTypes.bool,
  existingRecords: PropTypes.array,
};

SupplierForm.defaultProps = {
  onSubmit: undefined,
  initialData: undefined,
  isClone: false,
  existingRecords: [],
};
