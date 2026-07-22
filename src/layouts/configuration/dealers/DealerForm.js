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
import MenuItem from "@mui/material/MenuItem";
import FormHelperText from "@mui/material/FormHelperText";
import InputAdornment from "@mui/material/InputAdornment";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import SearchableSelect from "components/SearchableSelect";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import { fetchBankListsForDropdown } from "services/api.bankAccount.service";
import partyRankApi from "services/api.partyRank.service";
import supplierApi from "services/api.supplier.service";
import {
  canCreateCurrentMenu,
  canEditCurrentMenu,
  isSuperuserOrAhqSupervisorUser,
} from "services/api.service";
import { reloadPartyRankOptions } from "utils/partyRankUtils";
import { normalizePartyStatus } from "utils/partyStatusUtils";
import {
  PREFIX_OPTIONS,
  PROVINCE_OPTIONS,
  getProvinceLabel,
  normalizeCodePrefixRow,
} from "layouts/customer/customerUtils";
import { validateCodePrefixDescription } from "layouts/supplier/supplierUtils";
import CodePrefixDropdownLabel from "layouts/supplier/CodePrefixDropdownLabel";
import {
  buildDealerFormState,
  buildDealerPayload,
  normalizeDealerRecord,
  validateDealerForm,
} from "./dealerUtils";
import { buildDealerCode } from "utils/dealerOptionUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
};

async function reloadCodePrefixOptions() {
  const response = await supplierApi.getCodePrefixes();
  return (supplierApi.unwrapList(response) || [])
    .map(normalizeCodePrefixRow)
    .filter((row) => row.prefixAlpha);
}

export function formatDealerDisplayName(prefix, name) {
  return [prefix, name]
    .map((value) => String(value ?? "").trim())
    .filter((value) => value && value !== "-")
    .join(" ")
    .trim();
}

export { getProvinceLabel };

export default function DealerForm({ open, onClose, onSubmit, initialData }) {
  const [form, setForm] = useState(() => buildDealerFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [rankOptions, setRankOptions] = useState([]);
  const [codePrefixOptions, setCodePrefixOptions] = useState([]);
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
  const showCodePrefixActions = canManageCodePrefixes || canDeleteCodePrefixes;
  const canManageRanks = isSuperuserOrAhqSupervisorUser();
  const canDeleteRanks = isSuperuserOrAhqSupervisorUser();
  const showRankActions = canManageRanks || canDeleteRanks;
  const isEditMode = Boolean(initialData?.id ?? initialData?.Id);
  const canSave = isEditMode ? canEditCurrentMenu() : canCreateCurrentMenu();

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    const fetchLookups = async () => {
      try {
        const [ranks, prefixes, banks] = await Promise.all([
          reloadPartyRankOptions(),
          reloadCodePrefixOptions(),
          fetchBankListsForDropdown(),
        ]);
        if (!cancelled) {
          setRankOptions(Array.isArray(ranks) ? ranks : []);
          setCodePrefixOptions(Array.isArray(prefixes) ? prefixes : []);
          setBankOptions(Array.isArray(banks) ? banks : []);
        }
      } catch (error) {
        console.error("Error fetching dealer form lookups:", error);
        if (!cancelled) {
          setRankOptions([]);
          setCodePrefixOptions([]);
          setBankOptions([]);
        }
      }
    };

    fetchLookups();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setForm(
      initialData ? normalizeDealerRecord(initialData, codePrefixOptions) : buildDealerFormState()
    );
    setErrors({});
  }, [open, initialData, codePrefixOptions]);

  const updateField = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "codeAlpha" || field === "codeNumeric") {
        next.code = buildDealerCode(
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
      if (editingRank?.id) await partyRankApi.updateRank(editingRank.id, rankName);
      else await partyRankApi.createRank(rankName);
      const options = await reloadPartyRankOptions();
      setRankOptions(options);
      updateField("rank", rankName);
      setAddRankOpen(false);
      setEditRankOpen(false);
      setEditingRank(null);
      setAddRankName("");
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
    if (!window.confirm(`Delete code prefix "${item.prefixAlpha || "this prefix"}"?`)) return;
    try {
      await supplierApi.deleteCodePrefix(item.id);
      const options = await reloadCodePrefixOptions();
      setCodePrefixOptions(options);
      if (String(form.codeAlpha) === String(item.prefixAlpha)) {
        updateField("codeAlpha", "");
      }
    } catch (error) {
      window.alert(error?.message || "Failed to delete code prefix.");
    }
  };

  const handleDeleteRank = async (item, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    if (!canDeleteRanks || !item?.id) return;
    if (!window.confirm(`Delete rank "${item.rankName || "this rank"}"?`)) return;
    try {
      await partyRankApi.deleteRank(item.id);
      const options = await reloadPartyRankOptions();
      setRankOptions(options);
      if (String(form.rank) === String(item.rankName)) updateField("rank", "");
    } catch (error) {
      window.alert(error?.message || "Failed to delete rank.");
    }
  };

  const handleSave = async () => {
    const validationErrors = validateDealerForm(form);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      window.alert("Please complete all required fields before saving.");
      return;
    }
    if (!canSave) {
      window.alert("You are not allowed to save in this module.");
      return;
    }

    setSaving(true);
    try {
      await onSubmit?.(buildDealerPayload(form));
      onClose?.();
    } catch (error) {
      window.alert(error?.message || "Failed to save dealer.");
    } finally {
      setSaving(false);
    }
  };

  const codeHasError = Boolean(errors.codeAlpha || errors.codeNumeric || errors.code);

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="lg" scroll="paper">
        <DialogTitle sx={{ color: "#344767", pb: 1 }}>
          {isEditMode ? "Edit Party" : "Add New Party"}
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
                disabled={isEditMode}
                error={codeHasError}
                helperText={
                  errors.codeNumeric ||
                  errors.codeAlpha ||
                  errors.code ||
                  (form.code ? "" : "Select prefix and enter up to 6 digits (PREFIX/123)")
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
                          disabled={isEditMode}
                          renderValue={(selected) => {
                            const value = String(selected || "").trim();
                            return value || "Prefix";
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

            <Grid item xs={12} sm={4} md={3}>
              <FormControl fullWidth size="small" sx={textFieldSx}>
                <InputLabel>Status</InputLabel>
                <SearchableSelect
                  label="Status"
                  value={form.status}
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
              <FormControl fullWidth size="small">
                <InputLabel id="dealer-bank-label">Bank</InputLabel>
                <SearchableSelect
                  labelId="dealer-bank-label"
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

            <Grid item xs={12} sm={6} md={4}>
              <TextField
                fullWidth
                label="Title of Acc"
                value={form.titleAccount}
                onChange={(e) => updateField("titleAccount", e.target.value)}
                inputProps={{ maxLength: 100 }}
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
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            disabled={saving || !canSave}
          >
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
            label="Description"
            fullWidth
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

DealerForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
};

DealerForm.defaultProps = {
  onSubmit: undefined,
  initialData: undefined,
};
