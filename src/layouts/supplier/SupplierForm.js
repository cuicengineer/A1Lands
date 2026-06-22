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
import IconButton from "@mui/material/IconButton";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import { fetchBankListsForDropdown } from "services/api.bankAccount.service";
import supplierApi from "services/api.supplier.service";
import { isSuperuserOrAhqSupervisorUser } from "services/api.service";
import {
  PREFIX_OPTIONS,
  PROVINCE_OPTIONS,
  buildSupplierCode,
  buildSupplierFormState,
  normalizeSupplierRecord,
  validateCodePrefixDescription,
  validateSupplierForm,
} from "./supplierUtils";
import CodePrefixDropdownLabel from "./CodePrefixDropdownLabel";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
};

function pickCoaField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

function normalizeSupplierCoaOption(row) {
  const id = row?.Id ?? row?.id;
  return {
    id: id != null ? Number(id) : null,
    acctId: pickCoaField(row, "acctId", "AcctId"),
    acctName: pickCoaField(row, "acctName", "AcctName"),
    controlAccount: pickCoaField(row, "controlAccount", "ControlAccount"),
  };
}

function isSupplierControlAccount(controlAccount) {
  return /^supplier$/i.test(String(controlAccount || "").trim());
}

function getSupplierCoaDropdownLabel(option) {
  if (option == null) return "";
  const acctId = String(option.acctId ?? "").trim();
  const acctName = String(option.acctName ?? "").trim();
  if (acctId && acctName) return `${acctId} - ${acctName}`;
  return acctId || acctName || "";
}

function findSupplierCoaOption(options, coaId) {
  if (coaId === "" || coaId == null) return null;
  return (options || []).find((option) => Number(option.id) === Number(coaId)) ?? null;
}

async function reloadCodePrefixOptions() {
  const response = await supplierApi.getCodePrefixes();
  return (supplierApi.unwrapList(response) || [])
    .map(supplierApi.normalizeCodePrefixRow)
    .filter((row) => row.prefixAlpha);
}

async function reloadRankOptions() {
  const response = await supplierApi.getRanks();
  return (supplierApi.unwrapList(response) || [])
    .map(supplierApi.normalizeRankRow)
    .filter((row) => row.rankName);
}

export default function SupplierForm({ open, onClose, onSubmit, initialData, isClone }) {
  const [form, setForm] = useState(() => buildSupplierFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [rankOptions, setRankOptions] = useState([]);
  const [codePrefixOptions, setCodePrefixOptions] = useState([]);
  const [supplierCoaOptions, setSupplierCoaOptions] = useState([]);
  const [bankOptions, setBankOptions] = useState([]);
  const [addRankOpen, setAddRankOpen] = useState(false);
  const [addRankName, setAddRankName] = useState("");
  const [editRankOpen, setEditRankOpen] = useState(false);
  const [editingRank, setEditingRank] = useState(null);
  const [addCodePrefixOpen, setAddCodePrefixOpen] = useState(false);
  const [addCodePrefixName, setAddCodePrefixName] = useState("");
  const [addCodePrefixDescription, setAddCodePrefixDescription] = useState("");
  const [editCodePrefixOpen, setEditCodePrefixOpen] = useState(false);
  const [editingCodePrefix, setEditingCodePrefix] = useState(null);

  const canManageCodePrefixes = isSuperuserOrAhqSupervisorUser();
  const canDeleteCodePrefixes = isSuperuserOrAhqSupervisorUser();
  const canManageRanks = isSuperuserOrAhqSupervisorUser();
  const canDeleteRanks = isSuperuserOrAhqSupervisorUser();
  const showCodePrefixActions = canManageCodePrefixes || canDeleteCodePrefixes;
  const showRankActions = canManageRanks || canDeleteRanks;
  const isEditMode = Boolean(initialData?.id) && !isClone;

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    const fetchRanks = async () => {
      try {
        const options = await reloadRankOptions();
        if (!cancelled) setRankOptions(options);
      } catch (error) {
        console.error("Error fetching supplier ranks:", error);
        if (!cancelled) setRankOptions([]);
      }
    };

    const fetchCodePrefixes = async () => {
      try {
        const options = await reloadCodePrefixOptions();
        if (!cancelled) setCodePrefixOptions(options);
      } catch (error) {
        console.error("Error fetching supplier code prefixes:", error);
        if (!cancelled) setCodePrefixOptions([]);
      }
    };

    const fetchSupplierCoaOptions = async () => {
      try {
        const response = await chartOfAccountsApi.getAll(COA_SECTION_TYPE);
        const options = (chartOfAccountsApi.unwrapList(response) || [])
          .map(normalizeSupplierCoaOption)
          .filter((row) => row.id != null && isSupplierControlAccount(row.controlAccount))
          .sort((a, b) => {
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

    fetchRanks();
    fetchCodePrefixes();
    fetchSupplierCoaOptions();
    fetchBankOptions();

    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm(normalizeSupplierRecord(initialData, codePrefixOptions));
    } else {
      setForm(buildSupplierFormState());
    }
    setErrors({});
  }, [open, initialData, codePrefixOptions]);

  useEffect(() => {
    if (!open || !initialData || !bankOptions.length) return;
    const savedId = initialData.bankListsId ?? initialData.BankListsId;
    if (savedId === "" || savedId == null) return;
    const idStr = String(savedId);
    if (bankOptions.some((option) => String(option.id) === idStr)) return;
    setBankOptions((options) => [{ id: savedId, label: idStr, name: idStr }, ...options]);
  }, [open, initialData, bankOptions]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "codeAlpha" || field === "codeNumeric") {
        next.code = buildSupplierCode(
          field === "codeAlpha" ? value : prev.codeAlpha,
          field === "codeNumeric" ? value : prev.codeNumeric
        );
      }
      return next;
    });
    if (errors?.[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
    if ((field === "codeAlpha" || field === "codeNumeric") && errors?.code) {
      setErrors((prev) => ({ ...prev, code: undefined }));
    }
  };

  const handleSaveRank = async () => {
    const rankName = String(addRankName || "").trim();
    if (!rankName) {
      window.alert("Enter a rank name.");
      return;
    }
    try {
      if (editingRank?.id) {
        await supplierApi.updateRank(editingRank.id, rankName);
      } else {
        await supplierApi.createRank(rankName);
      }
      const options = await reloadRankOptions();
      setRankOptions(options);
      updateField("rank", rankName);
      setAddRankOpen(false);
      setEditRankOpen(false);
      setAddRankName("");
      setEditingRank(null);
    } catch (error) {
      window.alert(error?.message || "Failed to save rank.");
    }
  };

  const handleEditRank = (item, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!canManageRanks || !item?.id) return;
    setEditingRank(item);
    setAddRankName(item.rankName || "");
    setEditRankOpen(true);
  };

  const handleDeleteRank = async (item, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!canDeleteRanks || !item?.id) return;
    const label = item.rankName || "this rank";
    if (!window.confirm(`Delete rank "${label}"?`)) return;
    try {
      await supplierApi.deleteRank(item.id);
      const options = await reloadRankOptions();
      setRankOptions(options);
      if (String(form.rank) === String(item.rankName)) {
        updateField("rank", "");
      }
    } catch (error) {
      window.alert(error?.message || "Failed to delete rank.");
    }
  };

  const handleSaveCodePrefix = async () => {
    const prefixAlpha = String(addCodePrefixName || "")
      .trim()
      .toUpperCase();
    const description = String(addCodePrefixDescription || "").trim();
    if (!prefixAlpha) {
      window.alert("Enter a code prefix.");
      return;
    }
    if (!/^[A-Z]+$/.test(prefixAlpha)) {
      window.alert("Code prefix must contain letters only.");
      return;
    }
    const descriptionError = validateCodePrefixDescription(description);
    if (descriptionError) {
      window.alert(descriptionError);
      return;
    }
    try {
      if (editingCodePrefix?.id) {
        await supplierApi.updateCodePrefix(editingCodePrefix.id, prefixAlpha, description);
      } else {
        await supplierApi.createCodePrefix(prefixAlpha, description);
      }
      const options = await reloadCodePrefixOptions();
      setCodePrefixOptions(options);
      updateField("codeAlpha", prefixAlpha);
      setAddCodePrefixOpen(false);
      setEditCodePrefixOpen(false);
      setAddCodePrefixName("");
      setAddCodePrefixDescription("");
      setEditingCodePrefix(null);
    } catch (error) {
      window.alert(error?.message || "Failed to save code prefix.");
    }
  };

  const handleEditCodePrefix = (item, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!canManageCodePrefixes || !item?.id) return;
    setEditingCodePrefix(item);
    setAddCodePrefixName(item.prefixAlpha || "");
    setAddCodePrefixDescription(item.description || "");
    setEditCodePrefixOpen(true);
  };

  const handleDeleteCodePrefix = async (item, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!canDeleteCodePrefixes || !item?.id) return;
    const label = item.prefixAlpha || "this code prefix";
    if (!window.confirm(`Delete code prefix "${label}"?`)) return;
    try {
      await supplierApi.deleteCodePrefix(item.id);
      const options = await reloadCodePrefixOptions();
      setCodePrefixOptions(options);
      if (String(form.codeAlpha).toUpperCase() === String(item.prefixAlpha).toUpperCase()) {
        updateField("codeAlpha", "");
      }
    } catch (error) {
      window.alert(error?.message || "Failed to delete code prefix.");
    }
  };

  const handleSave = async () => {
    const validationErrors = validateSupplierForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
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

  const codeHasError = Boolean(errors.codeAlpha || errors.codeNumeric || errors.code);

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
        <DialogTitle sx={{ color: "#344767", pb: 1 }}>
          {isClone ? "Clone Supplier" : isEditMode ? "Edit Supplier" : "Add New Supplier"}
        </DialogTitle>
        <DialogContent dividers>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Code"
                value={form.codeNumeric}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, "").slice(0, 6);
                  updateField("codeNumeric", digits);
                }}
                size="small"
                required
                error={codeHasError}
                helperText={
                  errors.codeNumeric ||
                  errors.codeAlpha ||
                  errors.code ||
                  (form.code
                    ? `Generated: ${form.code}`
                    : "Select prefix and enter up to 6 digits (PREFIX/123)")
                }
                inputProps={{ inputMode: "numeric", maxLength: 6 }}
                sx={textFieldSx}
                InputProps={{
                  startAdornment: (
                    <>
                      <InputAdornment position="start" sx={{ mr: 0 }}>
                        <SearchableSelect
                          value={form.codeAlpha}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === "__add__") {
                              setEditingCodePrefix(null);
                              setAddCodePrefixName("");
                              setAddCodePrefixDescription("");
                              setAddCodePrefixOpen(true);
                              return;
                            }
                            updateField("codeAlpha", value);
                          }}
                          displayEmpty
                          variant="standard"
                          disableUnderline
                          renderValue={(selected) => {
                            const value = String(selected || "").trim();
                            if (!value) return "Prefix";
                            const item = codePrefixOptions.find((row) => row.prefixAlpha === value);
                            if (!item) return value;
                            return <CodePrefixDropdownLabel item={item} compact />;
                          }}
                          sx={{
                            minWidth: 96,
                            maxWidth: 220,
                            fontSize: "0.875rem",
                            "& .MuiSelect-select": { py: 0.25, pr: "24px !important" },
                          }}
                          MenuProps={{ PaperProps: { sx: { maxHeight: 320, minWidth: 320 } } }}
                        >
                          <MenuItem value="">
                            <em>Select</em>
                          </MenuItem>
                          {codePrefixOptions.map((item) => (
                            <MenuItem
                              key={item.id || item.prefixAlpha}
                              value={item.prefixAlpha}
                              sx={showCodePrefixActions ? { pr: 1 } : undefined}
                            >
                              <MDBox
                                display="flex"
                                alignItems="center"
                                justifyContent="space-between"
                                width="100%"
                                gap={0.5}
                              >
                                <CodePrefixDropdownLabel item={item} />
                                {showCodePrefixActions && (
                                  <MDBox
                                    display="flex"
                                    alignItems="center"
                                    onClick={(e) => e.stopPropagation()}
                                    onMouseDown={(e) => e.stopPropagation()}
                                  >
                                    {canManageCodePrefixes && (
                                      <IconButton
                                        size="small"
                                        color="info"
                                        title="Edit code prefix"
                                        onClick={(e) => handleEditCodePrefix(item, e)}
                                        sx={{ padding: "2px" }}
                                      >
                                        <Icon fontSize="small">edit</Icon>
                                      </IconButton>
                                    )}
                                    {canDeleteCodePrefixes && (
                                      <IconButton
                                        size="small"
                                        color="error"
                                        title="Delete code prefix"
                                        onClick={(e) => handleDeleteCodePrefix(item, e)}
                                        sx={{ padding: "2px" }}
                                      >
                                        <Icon fontSize="small">delete</Icon>
                                      </IconButton>
                                    )}
                                  </MDBox>
                                )}
                              </MDBox>
                            </MenuItem>
                          ))}
                          {canManageCodePrefixes && (
                            <MenuItem
                              value="__add__"
                              sx={{ fontStyle: "italic", color: "info.main" }}
                            >
                              + Add code prefix...
                            </MenuItem>
                          )}
                        </SearchableSelect>
                      </InputAdornment>
                      {form.codeAlpha ? (
                        <InputAdornment position="start" sx={{ mx: 0.25, color: "text.secondary" }}>
                          /
                        </InputAdornment>
                      ) : null}
                    </>
                  ),
                }}
              />
              {codeHasError && !errors.codeNumeric && !errors.codeAlpha && !errors.code && (
                <FormHelperText error sx={{ mt: 0.5, ml: 1.75 }}>
                  Code prefix and number are required
                </FormHelperText>
              )}
            </Grid>
            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth size="small" sx={textFieldSx}>
                <InputLabel>Rank</InputLabel>
                <SearchableSelect
                  label="Rank"
                  value={form.rank}
                  onChange={(e) => {
                    if (e.target.value === "__add__") {
                      setEditingRank(null);
                      setAddRankName("");
                      setAddRankOpen(true);
                      return;
                    }
                    updateField("rank", e.target.value);
                  }}
                  MenuProps={{ PaperProps: { sx: { maxHeight: 320, minWidth: 280 } } }}
                >
                  <MenuItem value="">
                    <em>Select</em>
                  </MenuItem>
                  {rankOptions.map((item) => (
                    <MenuItem
                      key={item.id || item.rankName}
                      value={item.rankName}
                      sx={showRankActions ? { pr: 1 } : undefined}
                    >
                      <MDBox
                        display="flex"
                        alignItems="center"
                        justifyContent="space-between"
                        width="100%"
                        gap={0.5}
                      >
                        <span>{item.rankName}</span>
                        {showRankActions && (
                          <MDBox
                            display="flex"
                            alignItems="center"
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            {canManageRanks && (
                              <IconButton
                                size="small"
                                color="info"
                                title="Edit rank"
                                onClick={(e) => handleEditRank(item, e)}
                                sx={{ padding: "2px" }}
                              >
                                <Icon fontSize="small">edit</Icon>
                              </IconButton>
                            )}
                            {canDeleteRanks && (
                              <IconButton
                                size="small"
                                color="error"
                                title="Delete rank"
                                onClick={(e) => handleDeleteRank(item, e)}
                                sx={{ padding: "2px" }}
                              >
                                <Icon fontSize="small">delete</Icon>
                              </IconButton>
                            )}
                          </MDBox>
                        )}
                      </MDBox>
                    </MenuItem>
                  ))}
                  {canManageRanks && (
                    <MenuItem value="__add__" sx={{ fontStyle: "italic", color: "info.main" }}>
                      + Add rank...
                    </MenuItem>
                  )}
                </SearchableSelect>
              </FormControl>
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Name"
                value={form.name}
                onChange={(e) => updateField("name", e.target.value)}
                size="small"
                required
                error={Boolean(errors.name)}
                helperText={errors.name}
                sx={textFieldSx}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start" sx={{ mr: 0 }}>
                      <SearchableSelect
                        value={form.prefix}
                        onChange={(e) => updateField("prefix", e.target.value)}
                        displayEmpty
                        variant="standard"
                        disableUnderline
                        sx={{
                          minWidth: 72,
                          fontSize: "0.875rem",
                          "& .MuiSelect-select": { py: 0.25, pr: "24px !important" },
                        }}
                      >
                        <MenuItem value="">
                          <em>Prefix</em>
                        </MenuItem>
                        {PREFIX_OPTIONS.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </MenuItem>
                        ))}
                      </SearchableSelect>
                    </InputAdornment>
                  ),
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
                error={Boolean(errors.address)}
                helperText={errors.address}
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl
                fullWidth
                size="small"
                required
                error={Boolean(errors.province)}
                sx={textFieldSx}
              >
                <InputLabel>Province</InputLabel>
                <SearchableSelect
                  label="Province"
                  value={form.province}
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
                error={Boolean(errors.city)}
                helperText={errors.city}
                sx={textFieldSx}
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
                error={Boolean(errors.ntnCnic)}
                helperText={errors.ntnCnic}
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="GST No"
                value={form.gstNo}
                onChange={(e) => updateField("gstNo", e.target.value)}
                size="small"
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Tel No"
                value={form.telNo}
                onChange={(e) => updateField("telNo", e.target.value)}
                size="small"
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Mobile No"
                value={form.mobileNo}
                onChange={(e) => updateField("mobileNo", e.target.value)}
                size="small"
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <Autocomplete
                size="small"
                fullWidth
                disableClearable
                options={supplierCoaOptions}
                getOptionLabel={(option) => getSupplierCoaDropdownLabel(option)}
                isOptionEqualToValue={(a, b) => Number(a?.id) === Number(b?.id)}
                value={findSupplierCoaOption(supplierCoaOptions, form.coaId)}
                onChange={(_, newValue) =>
                  updateField("coaId", newValue != null ? newValue.id : "")
                }
                ListboxProps={{ style: { maxHeight: 300 } }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Control Account"
                    required
                    error={Boolean(errors.coaId)}
                    helperText={errors.coaId}
                    sx={textFieldSx}
                  />
                )}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <FormControl fullWidth size="small">
                <InputLabel id="supplier-bank-label">Bank</InputLabel>
                <SearchableSelect
                  labelId="supplier-bank-label"
                  label="Bank"
                  value={
                    form.bankListsId === "" || form.bankListsId == null
                      ? ""
                      : String(form.bankListsId)
                  }
                  onChange={(e) => updateField("bankListsId", e.target.value)}
                  sx={textFieldSx}
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
                sx={textFieldSx}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={8}>
              <TextField
                fullWidth
                label="Representative"
                value={form.representative}
                onChange={(e) => updateField("representative", e.target.value)}
                size="small"
                sx={textFieldSx}
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

      <Dialog
        open={addRankOpen || editRankOpen}
        onClose={() => {
          setAddRankOpen(false);
          setEditRankOpen(false);
          setEditingRank(null);
          setAddRankName("");
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{editingRank ? "Edit Rank" : "Add Rank"}</DialogTitle>
        <DialogContent>
          <MDInput
            autoFocus
            label="Rank name"
            fullWidth
            value={addRankName}
            onChange={(e) => setAddRankName(e.target.value)}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <MDButton
            color="secondary"
            variant="outlined"
            onClick={() => {
              setAddRankOpen(false);
              setEditRankOpen(false);
              setEditingRank(null);
              setAddRankName("");
            }}
          >
            Cancel
          </MDButton>
          <MDButton color="info" variant="gradient" onClick={handleSaveRank}>
            {editingRank ? "Save" : "Add"}
          </MDButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={addCodePrefixOpen || editCodePrefixOpen}
        onClose={() => {
          setAddCodePrefixOpen(false);
          setEditCodePrefixOpen(false);
          setEditingCodePrefix(null);
          setAddCodePrefixName("");
          setAddCodePrefixDescription("");
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>{editingCodePrefix ? "Edit Code Prefix" : "Add Code Prefix"}</DialogTitle>
        <DialogContent>
          <MDInput
            autoFocus
            label="Code prefix (letters only)"
            fullWidth
            value={addCodePrefixName}
            onChange={(e) =>
              setAddCodePrefixName(
                e.target.value
                  .replace(/[^A-Za-z]/g, "")
                  .toUpperCase()
                  .slice(0, 20)
              )
            }
            sx={{ mt: 1 }}
          />
          <MDInput
            label="Description (required, up to 20 words)"
            fullWidth
            multiline
            minRows={3}
            value={addCodePrefixDescription}
            onChange={(e) => setAddCodePrefixDescription(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <MDButton
            color="secondary"
            variant="outlined"
            onClick={() => {
              setAddCodePrefixOpen(false);
              setEditCodePrefixOpen(false);
              setEditingCodePrefix(null);
              setAddCodePrefixName("");
              setAddCodePrefixDescription("");
            }}
          >
            Cancel
          </MDButton>
          <MDButton color="info" variant="gradient" onClick={handleSaveCodePrefix}>
            {editingCodePrefix ? "Save" : "Add"}
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
};

SupplierForm.defaultProps = {
  onSubmit: undefined,
  initialData: undefined,
  isClone: false,
};
