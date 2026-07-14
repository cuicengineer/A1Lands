import { useEffect, useState } from "react";
import noticeApi from "services/api.notice.service";
import { stripHtmlToPlainText } from "layouts/configuration/notice/NoticeRichTextEditor";
import NoticeLoginPopup from "./NoticeLoginPopup";

export const LOGIN_NOTICE_SESSION_KEY = "a1-show-login-notice";

export function markLoginNoticePending() {
  try {
    sessionStorage.setItem(LOGIN_NOTICE_SESSION_KEY, "1");
  } catch {
    // ignore
  }
}

/**
 * Shows the system Notice as a formatted notification once after successful login.
 * Excluded users and inactive notices are filtered by the /api/Notices/active endpoint.
 */
export default function LoginNoticeAlert() {
  const [open, setOpen] = useState(false);
  const [contentHtml, setContentHtml] = useState("");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      let pending = false;
      try {
        pending = sessionStorage.getItem(LOGIN_NOTICE_SESSION_KEY) === "1";
      } catch {
        pending = false;
      }
      if (!pending) return;

      try {
        sessionStorage.removeItem(LOGIN_NOTICE_SESSION_KEY);
      } catch {
        // ignore
      }

      try {
        const response = await noticeApi.getActiveNotice();
        const html =
          response?.contentHtml ??
          response?.ContentHtml ??
          response?.data?.contentHtml ??
          response?.data?.ContentHtml ??
          "";
        const plain = stripHtmlToPlainText(html);
        if (!cancelled && plain) {
          setContentHtml(html);
          setOpen(true);
        }
      } catch (error) {
        console.error("Failed to load login notice:", error);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, []);

  return <NoticeLoginPopup open={open} onClose={() => setOpen(false)} contentHtml={contentHtml} />;
}
