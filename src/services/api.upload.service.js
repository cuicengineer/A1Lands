import api from "services/api.service";

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

  // Create FormData for multipart/form-data
  const formData = new FormData();
  formData.append("id", id.toString());
  formData.append("tableName", tableName);
  formData.append("Action", "Admin");

  // Append each file to FormData
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
  const res = await api.requestRaw("DELETE", `/api/Upload/${fileId}`);
  const contentType = res.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) return await res.json();
  return await res.text();
}

const uploadApi = {
  uploadFiles,
  getUploadedFiles,
  deleteUploadedFile,
};

export default uploadApi;
