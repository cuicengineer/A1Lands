import { useEffect, useRef, useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";

export const NOTICE_MAX_PLAIN_TEXT = 1000;

export function stripHtmlToPlainText(html) {
  if (!html) return "";
  const el = document.createElement("div");
  el.innerHTML = String(html);
  return String(el.textContent || el.innerText || "")
    .replace(/\s+/g, " ")
    .trim();
}

function NoticeRichTextEditor({ value, onChange, disabled, maxPlainLength }) {
  const editorRef = useRef(null);
  const [plainLength, setPlainLength] = useState(0);
  const [foreColor, setForeColor] = useState("#111111");
  const [backColor, setBackColor] = useState("#ffff00");

  useEffect(() => {
    if (!editorRef.current) return;
    if (editorRef.current.innerHTML !== (value || "")) {
      editorRef.current.innerHTML = value || "";
    }
    setPlainLength(stripHtmlToPlainText(value).length);
  }, [value]);

  const emitChange = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    const plain = stripHtmlToPlainText(html);
    setPlainLength(plain.length);
    if (typeof onChange === "function") onChange(html, plain);
  };

  const runCommand = (command, arg = null) => {
    if (disabled) return;
    editorRef.current?.focus();
    try {
      document.execCommand(command, false, arg);
    } catch (error) {
      console.error("Rich text command failed:", error);
    }
    emitChange();
  };

  const handleInput = () => {
    if (!editorRef.current) return;
    const plain = stripHtmlToPlainText(editorRef.current.innerHTML);
    if (plain.length > maxPlainLength) {
      // Soft clamp: restore last accepted value when over limit
      editorRef.current.innerHTML = value || "";
      setPlainLength(stripHtmlToPlainText(value).length);
      return;
    }
    emitChange();
  };

  const handlePaste = (event) => {
    event.preventDefault();
    const text = event.clipboardData?.getData("text/plain") || "";
    const currentPlain = stripHtmlToPlainText(editorRef.current?.innerHTML);
    const remaining = Math.max(0, maxPlainLength - currentPlain.length);
    const clipped = text.slice(0, remaining);
    try {
      document.execCommand("insertText", false, clipped);
    } catch {
      // ignore
    }
    emitChange();
  };

  return (
    <MDBox>
      <MDBox
        display="flex"
        alignItems="center"
        flexWrap="wrap"
        gap={0.5}
        mb={1}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "8px 8px 0 0",
          px: 1,
          py: 0.5,
          bgcolor: "grey.100",
        }}
      >
        <Tooltip title="Bold">
          <span>
            <IconButton size="small" disabled={disabled} onClick={() => runCommand("bold")}>
              <Icon fontSize="small">format_bold</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Italic">
          <span>
            <IconButton size="small" disabled={disabled} onClick={() => runCommand("italic")}>
              <Icon fontSize="small">format_italic</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Underline">
          <span>
            <IconButton size="small" disabled={disabled} onClick={() => runCommand("underline")}>
              <Icon fontSize="small">format_underlined</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Text color">
          <span>
            <MDBox display="inline-flex" alignItems="center" ml={0.5}>
              <Icon fontSize="small" sx={{ mr: 0.5, opacity: disabled ? 0.4 : 1 }}>
                format_color_text
              </Icon>
              <input
                type="color"
                value={foreColor}
                disabled={disabled}
                onChange={(e) => {
                  setForeColor(e.target.value);
                  runCommand("foreColor", e.target.value);
                }}
                style={{
                  width: 28,
                  height: 28,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
                aria-label="Text color"
              />
            </MDBox>
          </span>
        </Tooltip>
        <Tooltip title="Highlight / background color">
          <span>
            <MDBox display="inline-flex" alignItems="center" ml={0.5}>
              <Icon fontSize="small" sx={{ mr: 0.5, opacity: disabled ? 0.4 : 1 }}>
                format_color_fill
              </Icon>
              <input
                type="color"
                value={backColor}
                disabled={disabled}
                onChange={(e) => {
                  setBackColor(e.target.value);
                  // hiliteColor works in most browsers; backColor as fallback
                  runCommand("hiliteColor", e.target.value);
                  runCommand("backColor", e.target.value);
                }}
                style={{
                  width: 28,
                  height: 28,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
                aria-label="Background color"
              />
            </MDBox>
          </span>
        </Tooltip>
        <MDTypography variant="caption" color="text" sx={{ ml: "auto" }}>
          {plainLength}/{maxPlainLength}
        </MDTypography>
      </MDBox>
      <MDBox
        ref={editorRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onBlur={emitChange}
        onPaste={handlePaste}
        sx={{
          minHeight: 160,
          maxHeight: 320,
          overflowY: "auto",
          border: "1px solid",
          borderColor: "divider",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
          px: 1.5,
          py: 1.25,
          fontSize: "0.95rem",
          lineHeight: 1.5,
          outline: "none",
          bgcolor: disabled ? "grey.50" : "background.paper",
          "&:focus": {
            boxShadow: disabled ? "none" : "inset 0 0 0 1px rgba(26, 115, 232, 0.45)",
          },
        }}
      />
    </MDBox>
  );
}

NoticeRichTextEditor.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func,
  disabled: PropTypes.bool,
  maxPlainLength: PropTypes.number,
};

NoticeRichTextEditor.defaultProps = {
  value: "",
  onChange: undefined,
  disabled: false,
  maxPlainLength: NOTICE_MAX_PLAIN_TEXT,
};

export default NoticeRichTextEditor;
