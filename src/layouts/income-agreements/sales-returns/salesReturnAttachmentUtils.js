import uploadApi from "services/api.upload.service";

/** FormName / tableName for FileUploads (SalesReturns header attachments). */
export const SALES_RETURN_UPLOAD_FORM_NAME = "SalesReturns";

export const SALES_RETURN_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export function normalizeSalesReturnUploadedFiles(response) {
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

export async function fetchSalesReturnUploadedFiles(recordId) {
  const id = Number(recordId);
  if (!Number.isFinite(id)) return [];
  const response = await uploadApi.getUploadedFiles(id, SALES_RETURN_UPLOAD_FORM_NAME);
  return normalizeSalesReturnUploadedFiles(response);
}

export async function fetchSalesReturnAttachmentCount(recordId) {
  try {
    const files = await fetchSalesReturnUploadedFiles(recordId);
    return files.length;
  } catch (error) {
    console.error("Failed to load sales return attachment count:", error);
    return 0;
  }
}

export async function uploadSalesReturnAttachments(recordId, files) {
  const id = Number(recordId);
  if (!Number.isFinite(id)) {
    throw new Error("Sales return must be saved before uploading files.");
  }
  if (!files?.length) return;
  await uploadApi.uploadFiles(id, SALES_RETURN_UPLOAD_FORM_NAME, files);
}
