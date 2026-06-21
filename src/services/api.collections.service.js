import api, { getActionBy } from "services/api.service";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function listCollections() {
  return api.request("GET", "/api/Collections");
}

function getCollectionById(id) {
  return api.request("GET", `/api/Collections/${id}`);
}

async function createCollection(data) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/Collections", {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function updateCollection(id, data) {
  const actionBy = await getActionBy();
  return api.request("PUT", `/api/Collections/${id}`, {
    ...(data || {}),
    Id: Number(id),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function removeCollection(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/Collections/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: true,
  });
}

const collectionsApi = {
  unwrapList,
  listCollections,
  getCollectionById,
  createCollection,
  updateCollection,
  removeCollection,
};

export default collectionsApi;
