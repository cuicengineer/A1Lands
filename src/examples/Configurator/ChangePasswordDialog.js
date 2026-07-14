import { useEffect, useState } from "react";
import PropTypes from "prop-types";

import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Icon from "@mui/material/Icon";
import InputAdornment from "@mui/material/InputAdornment";
import IconButton from "@mui/material/IconButton";

import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import api from "services/api.service";

const PASSWORD_POLICY_TEXT =
  "Password must be 6-12 characters long and contain at least 1 special character.";

function validatePasswordPolicy(value) {
  const s = String(value || "");
  if (!s.trim()) return "Password is required";
  if (s.length < 6 || s.length > 12) return PASSWORD_POLICY_TEXT;
  if (!/[^a-zA-Z0-9]/.test(s)) return PASSWORD_POLICY_TEXT;
  return null;
}

function ChangePasswordDialog({ open, onClose }) {
  const [step, setStep] = useState(1);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError("");
    setFieldErrors({});
    setSubmitting(false);
  }, [open]);

  const handleClose = () => {
    if (submitting) return;
    onClose();
  };

  const handleVerifyCurrent = async () => {
    const password = String(currentPassword || "");
    if (!password.trim()) {
      setFieldErrors({ currentPassword: "Current password is required" });
      return;
    }
    setFieldErrors({});
    setError("");
    setSubmitting(true);
    try {
      await api.request("POST", "/api/Login/verify-password", {
        CurrentPassword: password,
        currentPassword: password,
      });
      setStep(2);
    } catch (e) {
      const msg = String(e?.message || "");
      if (msg.includes("401") || /incorrect|invalid/i.test(msg)) {
        setError("Current password is incorrect.");
      } else {
        setError(msg.replace(/^HTTP \d+ [^:]+:\s*/i, "") || "Unable to verify password.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveNewPassword = async () => {
    const nextErrors = {};
    const newMsg = validatePasswordPolicy(newPassword);
    if (newMsg) nextErrors.newPassword = newMsg;
    if (!String(confirmPassword || "").trim()) {
      nextErrors.confirmPassword = "Confirm password is required";
    } else if (String(newPassword) !== String(confirmPassword)) {
      nextErrors.confirmPassword = "Passwords do not match";
    }
    if (String(currentPassword) === String(newPassword)) {
      nextErrors.newPassword = "New password must be different from the current password.";
    }
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      if (newMsg) alert(PASSWORD_POLICY_TEXT);
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await api.request("POST", "/api/Login/change-password", {
        CurrentPassword: currentPassword,
        currentPassword,
        NewPassword: newPassword,
        newPassword,
      });
      alert("Password updated successfully.");
      onClose();
    } catch (e) {
      const msg = String(e?.message || "");
      setError(msg.replace(/^HTTP \d+ [^:]+:\s*/i, "") || "Failed to update password.");
    } finally {
      setSubmitting(false);
    }
  };

  const renderPasswordInput = ({
    label,
    value,
    onChange,
    show,
    setShow,
    errorText,
    autoFocus = false,
  }) => (
    <MDBox mb={2}>
      <MDTypography variant="caption" fontWeight="bold">
        {label}
      </MDTypography>
      <MDInput
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        size="small"
        fullWidth
        autoFocus={autoFocus}
        error={Boolean(errorText)}
        helperText={errorText}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => setShow((prev) => !prev)} edge="end">
                <Icon fontSize="small">{show ? "visibility_off" : "visibility"}</Icon>
              </IconButton>
            </InputAdornment>
          ),
        }}
      />
    </MDBox>
  );

  return (
    <Dialog open={open} onClose={handleClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ fontSize: "1.1rem", fontWeight: 600 }}>Change Password</DialogTitle>
      <DialogContent dividers>
        {step === 1 ? (
          <>
            <MDTypography variant="body2" color="text" mb={2}>
              Enter your current system password to continue.
            </MDTypography>
            {renderPasswordInput({
              label: "Current Password",
              value: currentPassword,
              onChange: (v) => {
                setCurrentPassword(v);
                if (fieldErrors.currentPassword) {
                  setFieldErrors((prev) => ({ ...prev, currentPassword: undefined }));
                }
                if (error) setError("");
              },
              show: showCurrent,
              setShow: setShowCurrent,
              errorText: fieldErrors.currentPassword,
              autoFocus: true,
            })}
          </>
        ) : (
          <>
            <MDTypography variant="body2" color="text" mb={1}>
              Enter a new password.
            </MDTypography>
            <MDTypography variant="caption" color="text" display="block" mb={2}>
              {PASSWORD_POLICY_TEXT}
            </MDTypography>
            {renderPasswordInput({
              label: "New Password",
              value: newPassword,
              onChange: (v) => {
                setNewPassword(v);
                if (fieldErrors.newPassword) {
                  setFieldErrors((prev) => ({ ...prev, newPassword: undefined }));
                }
              },
              show: showNew,
              setShow: setShowNew,
              errorText: fieldErrors.newPassword,
              autoFocus: true,
            })}
            {renderPasswordInput({
              label: "Confirm New Password",
              value: confirmPassword,
              onChange: (v) => {
                setConfirmPassword(v);
                if (fieldErrors.confirmPassword) {
                  setFieldErrors((prev) => ({ ...prev, confirmPassword: undefined }));
                }
              },
              show: showConfirm,
              setShow: setShowConfirm,
              errorText: fieldErrors.confirmPassword,
            })}
          </>
        )}
        {error ? (
          <MDTypography variant="caption" color="error">
            {error}
          </MDTypography>
        ) : null}
      </DialogContent>
      <DialogActions>
        <MDButton color="secondary" onClick={handleClose} disabled={submitting}>
          Cancel
        </MDButton>
        {step === 1 ? (
          <MDButton color="info" onClick={handleVerifyCurrent} disabled={submitting}>
            {submitting ? "Checking..." : "Continue"}
          </MDButton>
        ) : (
          <MDButton color="info" onClick={handleSaveNewPassword} disabled={submitting}>
            {submitting ? "Saving..." : "Save"}
          </MDButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

ChangePasswordDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
};

export default ChangePasswordDialog;
