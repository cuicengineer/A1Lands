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
  const [showPassword, setShowPassword] = useState(false);

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

  const handleChange = (field, value) => {
    const nextValue =
      field === "status" || field === "cmdId" || field === "baseId" ? Number(value) : value;

    setNewRowDraft((draft) => {
      const updatedDraft = { ...draft, [field]: nextValue };
      if (field === "cmdId") {
        const filteredBases = baseOptions.filter((base) => base.cmdId === nextValue);
        updatedDraft.baseId = filteredBases.length > 0 ? filteredBases[0].id : "";
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
      const msg = nextValue && String(nextValue).trim() ? null : "Category is required";
      setErrors((prev) => ({ ...prev, category: msg }));
    }
    if (field === "unitId") {
      const msg = nextValue && String(nextValue).trim() ? null : "Unit ID is required";
      setErrors((prev) => ({ ...prev, unitId: msg }));
    }
    if (field === "cmdId") {
      const msg =
        nextValue !== "" && nextValue !== null && nextValue !== undefined
          ? null
          : "Command is required";
      setErrors((prev) => ({ ...prev, cmdId: msg }));
    }
    if (field === "baseId") {
      const msg =
        nextValue !== "" && nextValue !== null && nextValue !== undefined
          ? null
          : "Base is required";
      setErrors((prev) => ({ ...prev, baseId: msg }));
    }
    if (field === "status") {
      const msg =
        nextValue !== "" && nextValue !== null && nextValue !== undefined
          ? null
          : "Status is required";
      setErrors((prev) => ({ ...prev, status: msg }));
    }
  };

  const handleGetInfo = () => {
    if (newRowDraft?.pakNo) {
      // Mock API call or data retrieval based on PakNo
      const userInfo = {
        name: "Fetched Name",
        rank: "Fetched Rank",
        // category is now bound to user-role dropdown; don't auto-fill unknown role
      };
      setNewRowDraft((prev) => ({ ...prev, ...userInfo }));
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
      value={value || ""}
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
        {filteredBases.map((opt) => (
          <MenuItem key={opt.id} value={opt.id}>
            {opt.name}
          </MenuItem>
        ))}
      </MDInput>
    );
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="md" fullWidth>
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
              <MDButton variant="gradient" color="info" size="small" onClick={handleGetInfo}>
                Get Info
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
              Command
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
              Unit ID
            </MDTypography>
            {renderInput("unitId", newRowDraft?.unitId, true)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Status
            </MDTypography>
            {renderStatusSelect("status", newRowDraft?.status)}
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
