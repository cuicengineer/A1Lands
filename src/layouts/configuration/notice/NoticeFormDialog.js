import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import FormControlLabel from "@mui/material/FormControlLabel";
import Switch from "@mui/material/Switch";
import Autocomplete from "@mui/material/Autocomplete";
import TextField from "@mui/material/TextField";
import Chip from "@mui/material/Chip";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import api from "services/api.service";
import noticeApi from "services/api.notice.service";
import NoticeRichTextEditor, {
  NOTICE_MAX_PLAIN_TEXT,
  stripHtmlToPlainText,
} from "./NoticeRichTextEditor";

export const NOTICE_MAX_EXCLUDED_USERS = 5;

function parseExcludedUserIds(notice) {
  if (!notice) return [];
  if (Array.isArray(notice.excludedUserIds)) {
    return notice.excludedUserIds.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  }
  if (Array.isArray(notice.ExcludedUserIds)) {
    return notice.ExcludedUserIds.map(Number).filter((id) => Number.isFinite(id) && id > 0);
  }
  const raw = notice.excludedUserIdsJson ?? notice.ExcludedUserIdsJson ?? "";
  if (!raw || typeof raw !== "string") return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(Number)
      .filter((id) => Number.isFinite(id) && id > 0)
      .slice(0, NOTICE_MAX_EXCLUDED_USERS);
  } catch {
    return [];
  }
}

function NoticeFormDialog({ open, onClose, initialData, onSaved }) {
  const isEdit = Boolean(initialData && (initialData.id || initialData.Id));
  const [contentHtml, setContentHtml] = useState("");
  const [plainText, setPlainText] = useState("");
  const [status, setStatus] = useState(true);
  const [excludedUsers, setExcludedUsers] = useState([]);
  const [userOptions, setUserOptions] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const html = initialData?.contentHtml ?? initialData?.ContentHtml ?? "";
    setContentHtml(html);
    setPlainText(stripHtmlToPlainText(html));
    const rawStatus = initialData?.status ?? initialData?.Status;
    setStatus(rawStatus === undefined || rawStatus === null ? true : Boolean(rawStatus));
  }, [open, initialData]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    const loadUsers = async () => {
      setLoadingUsers(true);
      try {
        const userData = await api.list("User");
        const userArr = Array.isArray(userData) ? userData : userData?.items || [];
        const active = userArr
          .filter((u) => {
            const deleted = u.isDeleted ?? u.IsDeleted;
            if (deleted === true || deleted === 1 || deleted === "1") return false;
            const s = u.status ?? u.Status;
            return s === 1 || s === true || s === "1";
          })
          .map((u) => {
            const id = Number(u.id ?? u.Id);
            const username = String(u.username ?? u.Username ?? "").trim();
            const name = String(u.name ?? u.Name ?? "").trim();
            return {
              id,
              username,
              name,
              label: name ? `${username} — ${name}` : username || `User #${id}`,
            };
          })
          .filter((u) => Number.isFinite(u.id) && u.id > 0)
          .sort((a, b) => a.label.localeCompare(b.label));

        if (cancelled) return;
        setUserOptions(active);

        const selectedIds = new Set(parseExcludedUserIds(initialData));
        setExcludedUsers(active.filter((u) => selectedIds.has(u.id)));
      } catch (error) {
        console.error("Failed to load users for notice exclude list:", error);
        if (!cancelled) {
          setUserOptions([]);
          setExcludedUsers([]);
        }
      } finally {
        if (!cancelled) setLoadingUsers(false);
      }
    };

    loadUsers();
    return () => {
      cancelled = true;
    };
  }, [open, initialData]);

  const handleChange = (html, plain) => {
    setContentHtml(html);
    setPlainText(plain);
  };

  const handleExcludedChange = (_event, value) => {
    const next = Array.isArray(value) ? value : [];
    if (next.length > NOTICE_MAX_EXCLUDED_USERS) {
      alert(`You can exclude at most ${NOTICE_MAX_EXCLUDED_USERS} users.`);
      setExcludedUsers(next.slice(0, NOTICE_MAX_EXCLUDED_USERS));
      return;
    }
    setExcludedUsers(next);
  };

  const handleSave = async () => {
    const plain = stripHtmlToPlainText(contentHtml);
    if (!plain) {
      alert("Notice text is required.");
      return;
    }
    if (plain.length > NOTICE_MAX_PLAIN_TEXT) {
      alert(`Notice text must be ${NOTICE_MAX_PLAIN_TEXT} characters or fewer.`);
      return;
    }
    if (excludedUsers.length > NOTICE_MAX_EXCLUDED_USERS) {
      alert(`You can exclude at most ${NOTICE_MAX_EXCLUDED_USERS} users.`);
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ContentHtml: contentHtml,
        Status: Boolean(status),
        ExcludedUserIds: excludedUsers.map((u) => u.id),
      };
      if (isEdit) {
        const id = initialData.id ?? initialData.Id;
        await noticeApi.updateNotice(id, { ...payload, Id: id });
      } else {
        await noticeApi.createNotice(payload);
      }
      if (typeof onSaved === "function") await onSaved();
      onClose();
    } catch (error) {
      console.error("Error saving notice:", error);
      alert(error?.message || "Failed to save notice.");
    } finally {
      setSaving(false);
    }
  };

  const helperText = useMemo(
    () =>
      `Select 1–${NOTICE_MAX_EXCLUDED_USERS} active users who will not see this notice on login.`,
    []
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
      <DialogTitle>{isEdit ? "Edit Notice" : "New Notice"}</DialogTitle>
      <DialogContent dividers>
        <MDTypography variant="body2" color="text" sx={{ mb: 1.5 }}>
          Format the message that will appear as an alert after users log in when Active.
        </MDTypography>
        <MDBox mb={1.5}>
          <FormControlLabel
            control={
              <Switch checked={Boolean(status)} onChange={(e) => setStatus(e.target.checked)} />
            }
            label={status ? "Active (shown on login)" : "Inactive (hidden on login)"}
          />
        </MDBox>
        <MDBox mb={2}>
          <Autocomplete
            multiple
            options={userOptions}
            value={excludedUsers}
            onChange={handleExcludedChange}
            loading={loadingUsers}
            getOptionLabel={(option) => option?.label || ""}
            isOptionEqualToValue={(option, value) => Number(option.id) === Number(value.id)}
            renderTags={(value, getTagProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getTagProps({ index });
                return (
                  <Chip
                    key={key}
                    label={option.username || option.label}
                    size="small"
                    {...tagProps}
                  />
                );
              })
            }
            renderInput={(params) => (
              <TextField
                {...params}
                label="Exclude Show"
                placeholder={excludedUsers.length ? "" : "Select users to exclude"}
                helperText={helperText}
              />
            )}
          />
        </MDBox>
        <NoticeRichTextEditor
          value={contentHtml}
          onChange={handleChange}
          maxPlainLength={NOTICE_MAX_PLAIN_TEXT}
        />
        <MDBox mt={1}>
          <MDTypography variant="caption" color="text">
            Plain text length: {plainText.length}/{NOTICE_MAX_PLAIN_TEXT}
          </MDTypography>
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          Cancel
        </MDButton>
        <MDButton variant="gradient" color="info" onClick={handleSave} disabled={saving}>
          {saving ? "Saving..." : "Save"}
        </MDButton>
      </DialogActions>
    </Dialog>
  );
}

NoticeFormDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  initialData: PropTypes.object,
  onSaved: PropTypes.func,
};

NoticeFormDialog.defaultProps = {
  initialData: null,
  onSaved: undefined,
};

export default NoticeFormDialog;
export { parseExcludedUserIds };
