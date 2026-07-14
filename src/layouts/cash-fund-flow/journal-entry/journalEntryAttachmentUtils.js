import uploadApi from "services/api.upload.service";

export const JOURNAL_ENTRY_UPLOAD_FORM_NAME = "JournalEntries";
export const JOURNAL_ENTRY_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_FILES = 5;

export {
  normalizeTransactionUploadedFiles,
  fetchTransactionUploadedFiles,
  uploadTransactionAttachments,
} from "layouts/accounts/receipts/receiptAttachmentUtils";

export async function fetchJournalEntryAttachmentCount(recordId) {
  try {
    const { fetchTransactionUploadedFiles } = await import(
      "layouts/accounts/receipts/receiptAttachmentUtils"
    );
    const files = await fetchTransactionUploadedFiles(recordId, JOURNAL_ENTRY_UPLOAD_FORM_NAME);
    return files.length;
  } catch (error) {
    console.error("Failed to load journal entry attachment count:", error);
    return 0;
  }
}

export async function fetchJournalEntryUploadedFiles(recordId) {
  const { fetchTransactionUploadedFiles } = await import(
    "layouts/accounts/receipts/receiptAttachmentUtils"
  );
  return fetchTransactionUploadedFiles(recordId, JOURNAL_ENTRY_UPLOAD_FORM_NAME);
}

export async function uploadJournalEntryAttachments(recordId, files) {
  const { uploadTransactionAttachments } = await import(
    "layouts/accounts/receipts/receiptAttachmentUtils"
  );
  return uploadTransactionAttachments(recordId, JOURNAL_ENTRY_UPLOAD_FORM_NAME, files);
}

export async function deleteJournalEntryUploadedFile(fileId) {
  return uploadApi.deleteUploadedFile(fileId);
}
