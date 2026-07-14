import api from "services/api.service";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

function listDealers() {
  return api.request("GET", "/api/Parties");
}

function listActiveDealers() {
  return api.request("GET", "/api/Parties/active");
}

function createDealer(data) {
  return api.create("Parties", data);
}

function updateDealer(id, data) {
  return api.update("Parties", id, data);
}

function removeDealer(id) {
  return api.remove("Parties", id);
}

function bulkUpdateStatus(ids, status) {
  return api.request("PATCH", "/api/Parties/bulkStatus", {
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
