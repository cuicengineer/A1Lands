import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";

import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDBox from "components/MDBox";
import MenuItem from "@mui/material/MenuItem";
import Icon from "@mui/material/Icon";
import InputAdornment from "@mui/material/InputAdornment";
import MDTypography from "components/MDTypography";
import api from "services/api.service";

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
}) {
  const LEVEL_OPTIONS = [
    { id: 1, label: "AHQ" },
    { id: 2, label: "Command" },
    { id: 3, label: "Base" },
  ];

  const [showPassword, setShowPassword] = useState(false);
  const [getInfoLoading, setGetInfoLoading] = useState(false);

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
    }
  }, [open]);

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
      const msg = nextValue && String(nextValue).trim() ? null : "Username is required";
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
            {renderInput("appoint", newRowDraft?.appoint, false)}
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
};

export default AddUserForm;
