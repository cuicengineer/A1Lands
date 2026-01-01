const RAW_API_BASE = (process.env.REACT_APP_API_BASE_URL || "").trim();
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");
if (!RAW_API_BASE) {
  console.warn("REACT_APP_API_BASE_URL is empty or missing; using relative API paths.");
}

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

  const pathWithLeadingSlash = "/api/Upload";
  const url = `${API_BASE}${pathWithLeadingSlash}`;

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

  // Make the request without setting Content-Type header
  // Browser will set it automatically with the correct boundary for multipart/form-data
  const response = await fetch(url, {
    method: "POST",
    body: formData,
    // Don't set Content-Type header - let browser set it with boundary
  });

  if (!response.ok) {
    let errText = "";
    try {
      errText = await response.text();
    } catch (e) {
      errText = response.statusText;
    }
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${errText}`);
  }

  // Try to parse JSON response if available
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  }

  return await response.text();
}

async function getUploadedFiles(id, formName) {
  const pathWithLeadingSlash = "/api/Upload";
  const queryParams = new URLSearchParams({
    id: id.toString(),
    formName,
  }).toString();
  const url = `${API_BASE}${pathWithLeadingSlash}?${queryParams}`;

  const response = await fetch(url, {
    method: "GET",
  });

  if (!response.ok) {
    let errText = "";
    try {
      errText = await response.text();
    } catch (e) {
      errText = response.statusText;
    }
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${errText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  }

  return await response.text();
}

async function deleteUploadedFile(fileId) {
  const pathWithLeadingSlash = `/api/Upload/${fileId}`;
  const url = `${API_BASE}${pathWithLeadingSlash}`;

  const response = await fetch(url, {
    method: "DELETE",
  });

  if (!response.ok) {
    let errText = "";
    try {
      errText = await response.text();
    } catch (e) {
      errText = response.statusText;
    }
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${errText}`);
  }

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    return await response.json();
  }

  return await response.text();
}

const uploadApi = {
  uploadFiles,
  getUploadedFiles,
  deleteUploadedFile,
};

export default uploadApi;
