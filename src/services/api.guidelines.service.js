import api from "services/api.service";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

function listGuidelines() {
  return api.request("GET", "/api/Guidelines");
}

function getGuideline(id) {
  return api.request("GET", `/api/Guidelines/${id}`);
}

function createGuideline(data) {
  return api.create("Guidelines", data);
}

function updateGuideline(id, data) {
  return api.update("Guidelines", id, data);
}

function removeGuideline(id) {
  return api.remove("Guidelines", id);
}

const guidelinesApi = {
  unwrapList,
  listGuidelines,
  getGuideline,
  createGuideline,
  updateGuideline,
  removeGuideline,
};

export default guidelinesApi;
