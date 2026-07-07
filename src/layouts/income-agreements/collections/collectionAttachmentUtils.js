import uploadApi from "services/api.upload.service";

/** FormName / tableName for FileUploads (CollectionEntries line items). */
export const COLLECTION_ENTRY_UPLOAD_FORM_NAME = "CollectionEntries";

export const COLLECTION_LINE_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

export function isCollectionLineImageFile(file) {
  if (!file) return false;
  const mime = String(file.type || "").toLowerCase();
  if (mime.startsWith("image/")) return true;
  const name = String(file.name || "").toLowerCase();
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "svg",
    "heic",
    "heif",
    "tif",
    "tiff",
  ].includes(ext);
}

export function validateCollectionLineAttachmentFile(file) {
  if (!file) return "No file selected.";
  if (!isCollectionLineImageFile(file)) return "Only image files are allowed.";
  if (file.size > COLLECTION_LINE_ATTACHMENT_MAX_BYTES) {
    return "File must be 5 MB or smaller.";
  }
  return null;
}

export function normalizeUploadedFiles(response) {
  const filesArray = response?.files || (Array.isArray(response) ? response : []);
  return filesArray.map((f) => {
    if (typeof f === "string") {
      return { fileName: f.split(/[\\/]/).pop(), downloadUrl: f };
    }
    const fileName =
      f?.fileName ||
      f?.name ||
      f?.filePath?.split(/[\\/]/).pop() ||
      f?.path?.split(/[\\/]/).pop() ||
      "Image";
    const downloadUrl = f?.downloadUrl || f?.fileUrl || f?.url || f?.filePath || f?.path || "";
    const id = f?.id ?? f?.Id ?? f?.fileId ?? f?.FileId ?? null;
    return { ...f, id, fileName, downloadUrl };
  });
}

export function extractCreatedCollectionId(response) {
  if (!response) return null;
  const id =
    response?.id ??
    response?.Id ??
    response?.data?.id ??
    response?.data?.Id ??
    response?.entry?.id ??
    response?.entry?.Id;
  return id != null && Number.isFinite(Number(id)) ? Number(id) : null;
}

export function isPersistedCollectionLineId(lineId) {
  if (lineId == null || lineId === "") return false;
  if (String(lineId).startsWith("line-")) return false;
  return Number.isFinite(Number(lineId));
}

export async function loadCollectionLineAttachmentMeta(lineId) {
  const id = Number(lineId);
  if (!Number.isFinite(id)) {
    return { hasAttachment: false, attachmentFileId: null, attachmentFileName: "" };
  }
  try {
    const response = await uploadApi.getUploadedFiles(id, COLLECTION_ENTRY_UPLOAD_FORM_NAME);
    const files = normalizeUploadedFiles(response);
    const file = files[0];
    if (!file) {
      return { hasAttachment: false, attachmentFileId: null, attachmentFileName: "" };
    }
    return {
      hasAttachment: true,
      attachmentFileId: file.id,
      attachmentFileName: file.fileName || "Image",
    };
  } catch (error) {
    console.error("Failed to load collection line attachment:", error);
    return { hasAttachment: false, attachmentFileId: null, attachmentFileName: "" };
  }
}

export async function deleteCollectionEntryAttachments(entryId) {
  const id = Number(entryId);
  if (!Number.isFinite(id)) return;
  try {
    const response = await uploadApi.getUploadedFiles(id, COLLECTION_ENTRY_UPLOAD_FORM_NAME);
    const files = normalizeUploadedFiles(response);
    await Promise.all(
      files.map((file) => {
        const fileId = file?.id;
        return fileId ? uploadApi.deleteUploadedFile(fileId) : Promise.resolve();
      })
    );
  } catch (error) {
    console.error("Failed to delete collection entry attachments:", error);
  }
}

export async function uploadCollectionLineAttachment(
  entryId,
  file,
  { replaceExisting = true } = {}
) {
  const id = Number(entryId);
  if (!Number.isFinite(id)) {
    throw new Error("Collection line must be saved before uploading a file.");
  }
  const validationError = validateCollectionLineAttachmentFile(file);
  if (validationError) {
    throw new Error(validationError);
  }
  if (replaceExisting) {
    await deleteCollectionEntryAttachments(id);
  }
  await uploadApi.uploadFiles(id, COLLECTION_ENTRY_UPLOAD_FORM_NAME, [file]);
}
