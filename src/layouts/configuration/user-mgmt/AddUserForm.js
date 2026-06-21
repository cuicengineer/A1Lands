import React, { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import IconButton from "@mui/material/IconButton";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemText from "@mui/material/ListItemText";
import FormHelperText from "@mui/material/FormHelperText";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDBox from "components/MDBox";
import MenuItem from "@mui/material/MenuItem";
import Icon from "@mui/material/Icon";
import InputAdornment from "@mui/material/InputAdornment";
import MDTypography from "components/MDTypography";
import api, { isSuperuserOrAhqSupervisorUser } from "services/api.service";
import {
  USER_APPOINT_ENTITY,
  buildAppointNameOptions,
  mapUserAppointRows,
} from "./userAppointUtils";
import { isSuperuserUsername } from "./userMgmtUtils";

function normalizeCategoryArr(value) {
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  return String(value || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

/** Role names matching these patterns cannot be combined (Add New User only). */
function categoryTokenIsSupervisor(token) {
  return /\bsupervisor\b/i.test(String(token || ""));
}

function categoryTokenIsOperator(token) {
  return /\boperator\b/i.test(String(token || ""));
}

function categoryHasSupervisorOperatorConflict(selection) {
  const arr = normalizeCategoryArr(selection);
  return arr.some(categoryTokenIsSupervisor) && arr.some(categoryTokenIsOperator);
}

/**
 * Keeps Supervisor- and Operator-type roles mutually exclusive by dropping conflicting tokens,
 * preferably the one added in this change.
 */
function resolveCategorySupervisorOperatorExclusivity(prevSelection, proposedSelection) {
  let arr = normalizeCategoryArr(proposedSelection);
  const prevArr = normalizeCategoryArr(prevSelection);
  if (!categoryHasSupervisorOperatorConflict(arr)) return arr;

  const addedInOrder = arr.filter((x) => !prevArr.includes(x));
  while (categoryHasSupervisorOperatorConflict(arr) && addedInOrder.length > 0) {
    const token = addedInOrder.pop();
    arr = arr.filter((x) => x !== token);
  }
  while (categoryHasSupervisorOperatorConflict(arr)) {
    const opIdx = arr.findIndex(categoryTokenIsOperator);
    if (opIdx >= 0) {
      arr = arr.slice(0, opIdx).concat(arr.slice(opIdx + 1));
      continue;
    }
    const sIdx = arr.findIndex(categoryTokenIsSupervisor);
    if (sIdx >= 0) arr = arr.slice(0, sIdx).concat(arr.slice(sIdx + 1));
    else break;
  }
  return arr;
}

function AddUserForm({
  open,
  handleClose,
  newRowDraft,
  setNewRowDraft,
  commandOptions,
  baseOptions,
  roleOptions,
  handleAddSave,
  errors,
  setErrors,
  appointOptions = [],
  onAppointOptionsChange,
}) {
  const LEVEL_OPTIONS = [
    { id: 1, label: "AHQ" },
    { id: 2, label: "Command" },
    { id: 3, label: "Base" },
  ];

  const [showPassword, setShowPassword] = useState(false);
  const [getInfoLoading, setGetInfoLoading] = useState(false);
  const [appointManageOpen, setAppointManageOpen] = useState(false);
  const [appointAddName, setAppointAddName] = useState("");
  const [appointManageError, setAppointManageError] = useState("");
  const [appointManageSubmitting, setAppointManageSubmitting] = useState(false);
  const [appointRemovingId, setAppointRemovingId] = useState(null);
  const canEditAppoint = isSuperuserOrAhqSupervisorUser();

  const PASSWORD_POLICY_TEXT =
    "Password must be 6-12 characters long and contain at least 1 special character.";

  const validatePasswordPolicy = (value) => {
    const s = String(value || "");
    if (!s.trim()) return "Password is required";
    if (s.length < 6 || s.length > 12) return PASSWORD_POLICY_TEXT;
    if (!/[^a-zA-Z0-9]/.test(s)) return PASSWORD_POLICY_TEXT;
    return null;
  };

  useEffect(() => {
    if (!open) {
      setShowPassword(false);
      setAppointManageOpen(false);
      setAppointAddName("");
      setAppointManageError("");
    }
  }, [open]);

  const appointSelectOptions = useMemo(
    () => buildAppointNameOptions(appointOptions, newRowDraft?.appoint),
    [appointOptions, newRowDraft?.appoint]
  );

  const refreshAppointOptions = async () => {
    const raw = await api.list(USER_APPOINT_ENTITY);
    const next = mapUserAppointRows(raw);
    if (onAppointOptionsChange) onAppointOptionsChange(next);
    return next;
  };

  const handleOpenAppointManage = () => {
    setAppointAddName("");
    setAppointManageError("");
    setAppointManageOpen(true);
  };

  const handleCloseAppointManage = () => {
    if (appointManageSubmitting || appointRemovingId) return;
    setAppointManageOpen(false);
    setAppointAddName("");
    setAppointManageError("");
  };

  const handleAddAppointOption = async () => {
    const name = String(appointAddName || "").trim();
    if (!name) {
      setAppointManageError("Appointment name is required");
      return;
    }
    setAppointManageSubmitting(true);
    setAppointManageError("");
    try {
      await api.create(USER_APPOINT_ENTITY, { Name: name, Status: 1 });
      await refreshAppointOptions();
      setNewRowDraft((prev) => ({ ...prev, appoint: name }));
      setAppointAddName("");
    } catch (e) {
      setAppointManageError(e?.message || "Failed to add appointment");
    } finally {
      setAppointManageSubmitting(false);
    }
  };

  const handleRemoveAppointOption = async (option) => {
    if (!option?.id) return;
    const confirmed = window.confirm(`Remove "${option.name}" from the appointment list?`);
    if (!confirmed) return;
    setAppointRemovingId(option.id);
    setAppointManageError("");
    try {
      await api.remove(USER_APPOINT_ENTITY, option.id);
      const next = await refreshAppointOptions();
      const selected = String(newRowDraft?.appoint || "").trim();
      if (selected && selected.toLowerCase() === String(option.name).toLowerCase()) {
        setNewRowDraft((prev) => ({ ...prev, appoint: "" }));
      }
      if (!next.length) {
        setNewRowDraft((prev) => ({ ...prev, appoint: "" }));
      }
    } catch (e) {
      setAppointManageError(e?.message || "Failed to remove appointment");
    } finally {
      setAppointRemovingId(null);
    }
  };

  const isAhqCommand = (cmdId) => {
    const command = (commandOptions || []).find((c) => Number(c.id) === Number(cmdId));
    const name = String(command?.name || "")
      .trim()
      .toLowerCase();
    return name === "ahq";
  };

  const getAutoLevelId = (cmdId, baseId) => {
    if (isAhqCommand(cmdId)) return 1;
    if (baseId === "" || baseId === null || baseId === undefined) return 2;
    return 3;
  };

  const handleChange = (field, value) => {
    let nextValue =
      field === "status" || field === "cmdId"
        ? Number(value)
        : field === "baseId"
        ? value === "" || value === null || value === undefined
          ? ""
          : Number(value)
        : field === "category"
        ? Array.isArray(value)
          ? value
          : String(value || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
        : value;

    if (field === "category") {
      nextValue = resolveCategorySupervisorOperatorExclusivity(newRowDraft?.category, nextValue);
    }

    setNewRowDraft((draft) => {
      const updatedDraft = { ...draft, [field]: nextValue };
      if (field === "cmdId") {
        const ahqSelected = isAhqCommand(nextValue);
        const filteredBases = (baseOptions || []).filter(
          (base) => base.cmdId === Number(nextValue)
        );
        const firstBaseId = filteredBases.length > 0 ? filteredBases[0].id : "";
        if (ahqSelected) {
          updatedDraft.baseId = firstBaseId;
          updatedDraft.levelId = 1;
        } else {
          // Base is optional for non-AHQ in Add New User.
          updatedDraft.baseId = "";
          updatedDraft.levelId = 2;
        }
      }
      if (field === "baseId") {
        updatedDraft.levelId = getAutoLevelId(updatedDraft.cmdId, nextValue);
      }
      return updatedDraft;
    });

    if (field === "username") {
      const trimmed = String(nextValue || "").trim();
      let msg = null;
      if (!trimmed) msg = "Username is required";
      else if (isSuperuserUsername(trimmed))
        msg = 'Username "superuser" is reserved and cannot be used';
      setErrors((prev) => ({ ...prev, username: msg }));
    }
    if (field === "name") {
      const msg = nextValue && String(nextValue).trim() ? null : "Name is required";
      setErrors((prev) => ({ ...prev, name: msg }));
    }
    if (field === "password") {
      const msg = validatePasswordPolicy(nextValue);
      setErrors((prev) => ({ ...prev, password: msg }));
    }
    if (field === "pakNo") {
      const msg = nextValue && String(nextValue).trim() ? null : "PakNo is required";
      setErrors((prev) => ({ ...prev, pakNo: msg }));
    }
    if (field === "rank") {
      const msg = nextValue && String(nextValue).trim() ? null : "Rank is required";
      setErrors((prev) => ({ ...prev, rank: msg }));
    }
    if (field === "category") {
      const categoryArr = Array.isArray(nextValue)
        ? nextValue
        : String(nextValue || "")
            .split(",")
            .map((v) => v.trim())
            .filter(Boolean);
      const msg = categoryArr.length > 0 ? null : "Category is required";
      setErrors((prev) => ({ ...prev, category: msg }));
    }
    if (field === "cmdId") {
      const msg =
        nextValue !== "" && nextValue !== null && nextValue !== undefined
          ? null
          : "Command is required";
      setErrors((prev) => ({ ...prev, cmdId: msg }));
    }
    if (field === "baseId") {
      // Base is optional for non-AHQ, so no validation error is needed.
      setErrors((prev) => ({ ...prev, baseId: null, levelId: null }));
    }
    if (field === "status") {
      const msg =
        nextValue !== "" && nextValue !== null && nextValue !== undefined
          ? null
          : "Status is required";
      setErrors((prev) => ({ ...prev, status: msg }));
    }
  };

  const handleGetInfo = async () => {
    const pak = String(newRowDraft?.pakNo || "").trim();
    if (!pak) {
      alert("Please enter Pak No first.");
      return;
    }
    setGetInfoLoading(true);
    try {
      const data = await api.request(
        "GET",
        `/api/UserPermissions/GetInfo?pakNo=${encodeURIComponent(pak)}`
      );
      const d = data && typeof data === "object" ? data : {};
      const p = d.data && typeof d.data === "object" ? d.data : d;
      const toField = (v) => (v == null ? "" : String(v).trim());
      setNewRowDraft((prev) => ({
        ...prev,
        name: toField(p.full_NAME),
        rank: toField(p.currentrank),
        appoint: toField(p.appment),
      }));
    } catch (e) {
      console.error("GetInfo failed", e);
      alert(e?.message || "Failed to get info. Please try again.");
    } finally {
      setGetInfoLoading(false);
    }
  };

  const renderInput = (field, value, isRequired = false) => {
    const isPasswordField = field === "password";
    const inputType = isPasswordField && !showPassword ? "password" : "text";

    return (
      <MDInput
        value={value}
        onChange={(e) => handleChange(field, e.target.value)}
        size="small"
        fullWidth
        required={isRequired}
        error={Boolean(errors[field])}
        helperText={errors[field]}
        type={inputType}
        InputProps={{
          ...(isPasswordField && {
            endAdornment: (
              <InputAdornment position="end">
                <Icon onClick={() => setShowPassword(!showPassword)} style={{ cursor: "pointer" }}>
                  {showPassword ? "visibility" : "visibility_off"}
                </Icon>
              </InputAdornment>
            ),
          }),
        }}
      />
    );
  };

  const renderStatusSelect = (field, value) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required
      error={Boolean(errors[field])}
      helperText={errors[field]}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          minHeight: "45px",
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      <MenuItem value={1}>Active</MenuItem>
      <MenuItem value={0}>Inactive</MenuItem>
    </MDInput>
  );

  const renderCategorySelect = (field, value) => (
    <MDInput
      select
      value={
        Array.isArray(value)
          ? value
          : String(value || "")
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
      }
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required
      error={Boolean(errors[field])}
      helperText={errors[field]}
      SelectProps={{
        multiple: true,
        renderValue: (selected) => (Array.isArray(selected) ? selected.join(", ") : ""),
      }}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          minHeight: "45px",
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      {(roleOptions || []).map((opt) => (
        <MenuItem key={opt.value} value={opt.value}>
          {opt.value}
        </MenuItem>
      ))}
    </MDInput>
  );

  const renderCommandSelect = (field, value) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
      required
      error={Boolean(errors[field])}
      helperText={errors[field]}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
        "& .MuiSelect-select": {
          minHeight: "45px",
          display: "flex",
          alignItems: "center",
          paddingTop: 0,
          paddingBottom: 0,
        },
      }}
    >
      {commandOptions.map((opt) => (
        <MenuItem key={opt.id} value={opt.id}>
          {opt.name}
        </MenuItem>
      ))}
    </MDInput>
  );

  const renderBaseSelect = (field, value, cmdId) => {
    const filteredBases = baseOptions.filter((base) => base.cmdId === cmdId);
    return (
      <MDInput
        select
        value={value}
        onChange={(e) => handleChange(field, e.target.value)}
        size="small"
        fullWidth
        required={false}
        error={Boolean(errors[field])}
        helperText={errors[field]}
        sx={{
          "& .MuiInputBase-root": { minHeight: "45px" },
          "& .MuiSelect-select": {
            minHeight: "45px",
            display: "flex",
            alignItems: "center",
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      >
        <MenuItem value="">None</MenuItem>
        {filteredBases.map((opt) => (
          <MenuItem key={opt.id} value={opt.id}>
            {opt.name}
          </MenuItem>
        ))}
      </MDInput>
    );
  };

  const renderAppointReadOnly = (value) => (
    <MDInput
      value={value || ""}
      size="small"
      fullWidth
      InputProps={{ readOnly: true }}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
      }}
    />
  );

  const renderAppointSelect = (field, value) => (
    <MDBox display="flex" alignItems="flex-start" gap={0.5}>
      <MDInput
        select
        value={value || ""}
        onChange={(e) => handleChange(field, e.target.value)}
        size="small"
        fullWidth
        error={Boolean(errors[field])}
        helperText={errors[field]}
        sx={{
          flex: 1,
          "& .MuiInputBase-root": { minHeight: "45px" },
          "& .MuiSelect-select": {
            minHeight: "45px",
            display: "flex",
            alignItems: "center",
            paddingTop: 0,
            paddingBottom: 0,
          },
        }}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {appointSelectOptions.map((name) => (
          <MenuItem key={name} value={name}>
            {name}
          </MenuItem>
        ))}
      </MDInput>
      <IconButton
        size="small"
        title="Manage Appointments"
        aria-label="Manage Appointments"
        onClick={handleOpenAppointManage}
        sx={{ mt: 0.5 }}
      >
        <Icon fontSize="small">add</Icon>
      </IconButton>
    </MDBox>
  );

  const renderAppointField = (field, value) =>
    canEditAppoint ? renderAppointSelect(field, value) : renderAppointReadOnly(value);

  const renderLevelReadOnly = (value) => (
    <MDInput
      value={value || ""}
      size="small"
      fullWidth
      InputProps={{ readOnly: true }}
      sx={{
        "& .MuiInputBase-root": { minHeight: "45px" },
      }}
    />
  );

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Add New User</DialogTitle>
      <DialogContent dividers>
        <MDBox display="grid" gridTemplateColumns="1fr 1fr" gap={2}>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Username
            </MDTypography>
            {renderInput("username", newRowDraft?.username, true)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Password
            </MDTypography>
            {renderInput("password", newRowDraft?.password, true)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              PakNo
            </MDTypography>
            <MDBox display="flex" alignItems="center" gap={1}>
              {renderInput("pakNo", newRowDraft?.pakNo, true)}
              <MDButton
                variant="gradient"
                color="info"
                size="small"
                onClick={handleGetInfo}
                disabled={getInfoLoading}
              >
                {getInfoLoading ? "Loading..." : "Get Info"}
              </MDButton>
            </MDBox>
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Name
            </MDTypography>
            {renderInput("name", newRowDraft?.name, true)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Rank
            </MDTypography>
            {renderInput("rank", newRowDraft?.rank, true)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Category
            </MDTypography>
            {renderCategorySelect("category", newRowDraft?.category)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              RAC
            </MDTypography>
            {renderCommandSelect("cmdId", newRowDraft?.cmdId)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Base
            </MDTypography>
            {renderBaseSelect("baseId", newRowDraft?.baseId, newRowDraft?.cmdId)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Level ID
            </MDTypography>
            {renderLevelReadOnly(
              (() => {
                const levelId = Number(
                  newRowDraft?.levelId || getAutoLevelId(newRowDraft?.cmdId, newRowDraft?.baseId)
                );
                const levelLabel = LEVEL_OPTIONS.find((opt) => opt.id === levelId)?.label || "";
                return levelLabel ? `${levelId} - ${levelLabel}` : `${levelId || ""}`;
              })()
            )}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Status
            </MDTypography>
            {renderStatusSelect("status", newRowDraft?.status)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Appoint
            </MDTypography>
            {renderAppointField("appoint", newRowDraft?.appoint)}
          </MDBox>
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton onClick={handleClose} color="secondary">
          Cancel
        </MDButton>
        <MDButton
          onClick={() => {
            const msg = validatePasswordPolicy(newRowDraft?.password);
            if (msg) {
              alert(PASSWORD_POLICY_TEXT);
              setErrors((prev) => ({ ...prev, password: msg }));
              return;
            }
            handleAddSave();
          }}
          color="info"
        >
          Save
        </MDButton>
      </DialogActions>

      <Dialog
        open={appointManageOpen}
        onClose={handleCloseAppointManage}
        fullWidth
        maxWidth="sm"
        scroll="paper"
      >
        <DialogTitle sx={{ fontSize: "1.1rem", fontWeight: 600 }}>Manage Appointments</DialogTitle>
        <DialogContent>
          <MDTypography variant="caption" color="text" sx={{ display: "block", mb: 1 }}>
            Add or remove appointment values used in the Add New User dropdown.
          </MDTypography>
          <MDBox display="flex" alignItems="flex-start" gap={1} mb={2}>
            <MDInput
              label="New appointment"
              value={appointAddName}
              onChange={(e) => {
                setAppointAddName(e.target.value);
                if (appointManageError) setAppointManageError("");
              }}
              size="small"
              fullWidth
              disabled={appointManageSubmitting || Boolean(appointRemovingId)}
            />
            <MDButton
              variant="gradient"
              color="info"
              size="small"
              onClick={handleAddAppointOption}
              disabled={appointManageSubmitting || Boolean(appointRemovingId)}
              sx={{ mt: 0.25, whiteSpace: "nowrap" }}
            >
              {appointManageSubmitting ? "Adding…" : "Add"}
            </MDButton>
          </MDBox>
          {appointManageError ? (
            <FormHelperText error sx={{ mx: 0, mb: 1 }}>
              {appointManageError}
            </FormHelperText>
          ) : null}
          <List dense disablePadding>
            {(appointOptions || []).length === 0 ? (
              <MDTypography variant="body2" color="text">
                No appointments yet. Add one above.
              </MDTypography>
            ) : (
              appointOptions.map((option) => (
                <ListItem
                  key={option.id}
                  disableGutters
                  secondaryAction={
                    <IconButton
                      edge="end"
                      size="small"
                      color="error"
                      aria-label={`Remove ${option.name}`}
                      title="Remove"
                      disabled={appointManageSubmitting || appointRemovingId === option.id}
                      onClick={() => handleRemoveAppointOption(option)}
                    >
                      <Icon fontSize="small">delete</Icon>
                    </IconButton>
                  }
                >
                  <ListItemText primary={option.name} />
                </ListItem>
              ))
            )}
          </List>
        </DialogContent>
        <DialogActions>
          <MDButton
            variant="outlined"
            color="secondary"
            onClick={handleCloseAppointManage}
            disabled={appointManageSubmitting || Boolean(appointRemovingId)}
          >
            Close
          </MDButton>
        </DialogActions>
      </Dialog>
    </Dialog>
  );
}

AddUserForm.propTypes = {
  open: PropTypes.bool.isRequired,
  handleClose: PropTypes.func.isRequired,
  newRowDraft: PropTypes.object,
  setNewRowDraft: PropTypes.func.isRequired,
  commandOptions: PropTypes.array.isRequired,
  baseOptions: PropTypes.array.isRequired,
  roleOptions: PropTypes.array.isRequired,
  handleAddSave: PropTypes.func.isRequired,
  errors: PropTypes.object.isRequired,
  setErrors: PropTypes.func.isRequired,
  appointOptions: PropTypes.array,
  onAppointOptionsChange: PropTypes.func,
};

export default AddUserForm;
