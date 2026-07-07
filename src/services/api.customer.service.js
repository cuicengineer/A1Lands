import api from "services/api.service";
import partyRankApi from "services/api.partyRank.service";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

function normalizeRankRow(row) {
  return partyRankApi.normalizeRankRow(row);
}

function getRanks() {
  return partyRankApi.getRanks();
}

async function createRank(rankName) {
  return partyRankApi.createRank(rankName);
}

async function updateRank(id, rankName) {
  return partyRankApi.updateRank(id, rankName);
}

function deleteRank(id) {
  return partyRankApi.deleteRank(id);
}

function listCustomers() {
  return api.request("GET", "/api/Customer");
}

function getByCode(code, excludeId) {
  const params = new URLSearchParams({ code: String(code || "").trim() });
  if (excludeId != null && excludeId !== "") {
    params.set("excludeId", String(excludeId));
  }
  return api.request("GET", `/api/Customer/byCode?${params.toString()}`);
}

async function createCustomer(data) {
  return api.create("Customer", data);
}

async function updateCustomer(id, data) {
  return api.update("Customer", id, data);
}

function removeCustomer(id) {
  return api.remove("Customer", id);
}

async function bulkUpdateStatus(ids, status) {
  return api.request("PATCH", "/api/Customer/bulkStatus", {
    Ids: ids,
    ids,
    Status: status,
    status,
  });
}

const customerApi = {
  unwrapList,
  normalizeRankRow,
  getRanks,
  createRank,
  updateRank,
  deleteRank,
  listCustomers,
  getByCode,
  createCustomer,
  updateCustomer,
  removeCustomer,
  bulkUpdateStatus,
};

export default customerApi;
