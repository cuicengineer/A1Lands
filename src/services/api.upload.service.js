import api, { getActionBy } from "services/api.service";

/**
 * Upload files to the server
 * @param {number} id - The record ID
 * @param {string} tableName - The table name (e.g., "RevenueRates")
 * @param {File[]} files - Array of File objects to upload
 * @returns {Promise<Response>} The response from the server
 */
async function uploadFiles(id, tableName, files) {
  if (!files || files.length === 0) {
    throw new Error("No files provided for upload");
  }

  // Get ActionBy with username and IP address
  const actionBy = await getActionBy();

  // Create FormData for multipart/form-data
  const formData = new FormData();
  formData.append("id", id.toString());
  formData.append("tableName", tableName);
  formData.append("Action", "Create");
  formData.append("ActionBy", actionBy);
  formData.append("ActionDate", new Date().toISOString());

  // Append each file to FormData ,
  //   03075832477.
  // Using a loop to handle files efficiently and avoid memory issues
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file instanceof File) {
      formData.append("files", file);
    } else {
      console.warn(`Skipping invalid file at index ${i}`);
    }
  }

  // Use shared API client so Authorization header + refresh cookie are included.
  const res = await api.requestRaw("POST", "/api/Upload", formData);
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) return await res.json();
  return await res.text();
}

async function getUploadedFiles(id, formName) {
  const queryParams = new URLSearchParams({
    id: id.toString(),
    formName,
  }).toString();
  const res = await api.requestRaw("GET", `/api/Upload?${queryParams}`);
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) return await res.json();
  return await res.text();
}

async function deleteUploadedFile(fileId) {
  const actionBy = await getActionBy();
  const payload = {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  };
  const res = await api.requestRaw("DELETE", `/api/Upload/${fileId}`, payload);
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) return await res.json();
  return await res.text();
}

/**
 * Get file ID from attachment object (backend may use different property names).
 */
function getFileIdFromObject(file) {
  if (!file || typeof file !== "object") return null;
  const keys = [
    "id",
    "Id",
    "fileId",
    "FileId",
    "uploadId",
    "UploadId",
    "attachmentId",
    "AttachmentId",
    "documentId",
    "DocumentId",
  ];
  for (const k of keys) {
    const v = file[k];
    if (v != null && String(v).trim() !== "") return v;
  }
  return null;
}

/**
 * Download a file by file ID (backend requires a valid file ID).
 * Tries path-style URL first (same pattern as Delete: /api/Upload/{id}), then query param.
 * @param {string|number} fileId - The attachment/file ID from the server
 * @param {string} suggestedFileName - Suggested filename for the download
 */
async function downloadFileById(fileId, suggestedFileName) {
  const id = fileId != null ? String(fileId).trim() : "";
  if (!id) {
    throw new Error("Valid file ID is required.");
  }
  // Backend requires a valid file ID. Try path-style then query (?fileId= then ?id=).
  const pathUrl = `/api/Upload/Download/${encodeURIComponent(id)}`;
  const queryFileIdUrl = `/api/Upload/Download?fileId=${encodeURIComponent(id)}`;
  const queryIdUrl = `/api/Upload/Download?id=${encodeURIComponent(id)}`;
  let res;
  try {
    res = await api.requestRaw("GET", pathUrl);
  } catch (e1) {
    try {
      res = await api.requestRaw("GET", queryFileIdUrl);
    } catch (e2) {
      res = await api.requestRaw("GET", queryIdUrl);
    }
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedFileName || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download a file by ID or by path. Prefers file ID when present (backend requires ID).
 * @param {object} file - Attachment object with id/fileId/Id/FileId etc. and optionally path/Path/downloadUrl
 * @param {string} suggestedFileName - Suggested filename for the download
 */
async function downloadFile(file, suggestedFileName) {
  const fileId = getFileIdFromObject(file);
  if (fileId != null && String(fileId).trim() !== "") {
    return downloadFileById(fileId, suggestedFileName || file?.fileName || "download");
  }
  const path =
    file?.Path ||
    file?.path ||
    file?.filePath ||
    file?.downloadUrl ||
    file?.fileUrl ||
    file?.url ||
    "";
  if (!path || typeof path !== "string") {
    throw new Error("File ID or file path is required for download.");
  }
  const trimmed = path.trim();
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    window.open(trimmed, "_blank", "noopener,noreferrer");
    return;
  }
  const encodedPath = encodeURIComponent(trimmed);
  const res = await api.requestRaw("GET", `/api/Upload/Download?path=${encodedPath}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = suggestedFileName || file?.fileName || "download";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

const uploadApi = {
  uploadFiles,
  getUploadedFiles,
  deleteUploadedFile,
  downloadFileById,
  downloadFile,
};

export default uploadApi;
