import uploadApi from "services/api.upload.service";
import {
  fetchTransactionUploadedFiles,
  normalizeTransactionUploadedFiles,
  uploadTransactionAttachments,
} from "layouts/accounts/receipts/receiptAttachmentUtils";

export const GUIDELINES_UPLOAD_FORM_NAME = "Guidelines";
export const GUIDELINES_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
export const GUIDELINES_MAX_ATTACHMENTS = 3;
export const GUIDELINES_MAX_ROWS = 30;

export const GUIDELINES_FILE_ACCEPT =
  ".pdf,.xlsx,.xls,.doc,.docx,application/pdf,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export function isGuidelinesAttachmentFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  if (["pdf", "xlsx", "xls", "doc", "docx"].includes(ext)) return true;
  const t = String(file?.type || "").toLowerCase();
  return (
    t.includes("pdf") ||
    t.includes("spreadsheetml") ||
    t.includes("ms-excel") ||
    t.includes("excel") ||
    t.includes("msword") ||
    t.includes("wordprocessingml")
  );
}

export function validateGuidelinesAttachmentFile(file) {
  if (!file) return "No file selected.";
  if (file.size > GUIDELINES_ATTACHMENT_MAX_BYTES) {
    return `File "${file.name}" exceeds the 5 MB limit.`;
  }
  if (!isGuidelinesAttachmentFile(file)) {
    return `File "${file.name}" is not allowed. Use PDF, Excel (.xls, .xlsx), or Word (.doc, .docx) only.`;
  }
  return null;
}

export function formatGuidelinesFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export { normalizeTransactionUploadedFiles as normalizeGuidelinesUploadedFiles };

export async function fetchGuidelinesUploadedFiles(recordId) {
  return fetchTransactionUploadedFiles(recordId, GUIDELINES_UPLOAD_FORM_NAME);
}

export async function uploadGuidelinesAttachments(recordId, files) {
  return uploadTransactionAttachments(recordId, GUIDELINES_UPLOAD_FORM_NAME, files);
}

export async function deleteGuidelinesUploadedFile(fileId) {
  return uploadApi.deleteUploadedFile(fileId);
}
