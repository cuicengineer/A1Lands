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
  return api.request("GET", "/api/SupplierRanks");
}

async function createRank(rankName) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/SupplierRanks", {
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
  return api.request("PUT", `/api/SupplierRanks/${id}`, {
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
  return api.remove("SupplierRanks", id);
}

const partyRankApi = {
  unwrapList,
  normalizeRankRow,
  getRanks,
  createRank,
  updateRank,
  deleteRank,
};

export default partyRankApi;
