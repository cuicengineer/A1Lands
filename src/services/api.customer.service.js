import api, { getActionBy } from "services/api.service";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

function normalizeRankRow(row) {
  const id = row?.id ?? row?.Id;
  const rankName = String(row?.rankName ?? row?.RankName ?? "").trim();
  return { id, rankName };
}

function getRanks() {
  return api.request("GET", "/api/CustomerRanks");
}

async function createRank(rankName) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/CustomerRanks", {
    RankName: rankName,
    rankName,
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function updateRank(id, rankName) {
  const actionBy = await getActionBy();
  return api.request("PUT", `/api/CustomerRanks/${id}`, {
    Id: id,
    id,
    RankName: rankName,
    rankName,
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  });
}

function deleteRank(id) {
  return api.remove("CustomerRanks", id);
}

function listCustomers() {
  return api.request("GET", "/api/Customer");
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

const customerApi = {
  unwrapList,
  normalizeRankRow,
  getRanks,
  createRank,
  updateRank,
  deleteRank,
  listCustomers,
  createCustomer,
  updateCustomer,
  removeCustomer,
};

export default customerApi;
