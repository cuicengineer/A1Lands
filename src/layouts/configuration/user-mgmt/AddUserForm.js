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
  handleAddSave,
  errors,
  setErrors,
}) {
  const [showPassword, setShowPassword] = useState(false);

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
      const msg = nextValue && String(nextValue).trim() ? null : "Password is required";
      setErrors((prev) => ({ ...prev, password: msg }));
    }
  };

  const handleGetInfo = () => {
    if (newRowDraft?.pakNo) {
      // Mock API call or data retrieval based on PakNo
      const userInfo = {
        name: "Fetched Name",
        rank: "Fetched Rank",
        category: "Fetched Category",
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
    >
      <MenuItem value={1}>Active</MenuItem>
      <MenuItem value={0}>Inactive</MenuItem>
    </MDInput>
  );

  const renderCommandSelect = (field, value) => (
    <MDInput
      select
      value={value}
      onChange={(e) => handleChange(field, e.target.value)}
      size="small"
      fullWidth
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
              {renderInput("pakNo", newRowDraft?.pakNo)}
              <MDButton variant="gradient" color="info" size="small" onClick={handleGetInfo}>
                Get Info
              </MDButton>
            </MDBox>
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Name
            </MDTypography>
            {renderInput("name", newRowDraft?.name)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Rank
            </MDTypography>
            {renderInput("rank", newRowDraft?.rank)}
          </MDBox>
          <MDBox>
            <MDTypography variant="caption" fontWeight="bold">
              Category
            </MDTypography>
            {renderInput("category", newRowDraft?.category)}
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
            {renderInput("unitId", newRowDraft?.unitId)}
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
        <MDButton onClick={handleAddSave} color="info">
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
  handleAddSave: PropTypes.func.isRequired,
  errors: PropTypes.object.isRequired,
  setErrors: PropTypes.func.isRequired,
};

export default AddUserForm;
