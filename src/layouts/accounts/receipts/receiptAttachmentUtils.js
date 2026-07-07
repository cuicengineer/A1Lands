import uploadApi from "services/api.upload.service";

export const RECEIPT_UPLOAD_FORM_NAME = "Receipts";
export const PAYMENT_UPLOAD_FORM_NAME = "Payments";
export const TRANSACTION_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export function normalizeTransactionUploadedFiles(response) {
  const filesArray = response?.files || (Array.isArray(response) ? response : []);
  return filesArray.map((f) => {
    if (typeof f === "string") {
      return { fileName: f.split(/[\\/]/).pop(), downloadUrl: f, id: null, fileId: null };
    }
    const fileName =
      f?.fileName ||
      f?.name ||
      f?.filePath?.split(/[\\/]/).pop() ||
      f?.path?.split(/[\\/]/).pop() ||
      "Unknown File";
    const downloadUrl =
      f?.Path || f?.path || f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || "";
    const id = f?.id ?? f?.Id ?? f?.fileId ?? f?.FileId ?? null;
    return { ...f, id, fileId: id, fileName, downloadUrl };
  });
}

export async function fetchTransactionUploadedFiles(recordId, formName) {
  const id = Number(recordId);
  if (!Number.isFinite(id)) return [];
  const response = await uploadApi.getUploadedFiles(id, formName);
  return normalizeTransactionUploadedFiles(response);
}

export async function fetchTransactionAttachmentCount(recordId, formName) {
  try {
    const files = await fetchTransactionUploadedFiles(recordId, formName);
    return files.length;
  } catch (error) {
    console.error("Failed to load transaction attachment count:", error);
    return 0;
  }
}

export async function uploadTransactionAttachments(recordId, formName, files) {
  const id = Number(recordId);
  if (!Number.isFinite(id)) {
    throw new Error("Record must be saved before uploading files.");
  }
  if (!files?.length) return;
  await uploadApi.uploadFiles(id, formName, files);
}
