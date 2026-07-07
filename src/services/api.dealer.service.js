import api from "services/api.service";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

function listDealers() {
  return api.request("GET", "/api/Dealers");
}

function listActiveDealers() {
  return api.request("GET", "/api/Dealers/active");
}

function createDealer(data) {
  return api.create("Dealers", data);
}

function updateDealer(id, data) {
  return api.update("Dealers", id, data);
}

function removeDealer(id) {
  return api.remove("Dealers", id);
}

function bulkUpdateStatus(ids, status) {
  return api.request("PATCH", "/api/Dealers/bulkStatus", {
    Ids: ids,
    ids,
    Status: status,
    status,
  });
}

const dealerApi = {
  unwrapList,
  listDealers,
  listActiveDealers,
  createDealer,
  updateDealer,
  removeDealer,
  bulkUpdateStatus,
};

export default dealerApi;
