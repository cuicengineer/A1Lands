import api from "services/api.service";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

function listNotices() {
  return api.request("GET", "/api/Notices");
}

function getActiveNotice() {
  return api.request("GET", "/api/Notices/active");
}

function createNotice(data) {
  return api.create("Notices", data);
}

function updateNotice(id, data) {
  return api.update("Notices", id, data);
}

const noticeApi = {
  unwrapList,
  listNotices,
  getActiveNotice,
  createNotice,
  updateNotice,
};

export default noticeApi;
