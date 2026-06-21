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

function normalizeCodePrefixRow(row) {
  const id = row?.id ?? row?.Id;
  const prefixAlpha = String(row?.prefixAlpha ?? row?.PrefixAlpha ?? "")
    .trim()
    .toUpperCase();
  const description = String(row?.description ?? row?.Description ?? "").trim();
  return { id, prefixAlpha, description };
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

function getCodePrefixes() {
  return api.request("GET", "/api/SupplierCodePrefixes");
}

async function createCodePrefix(prefixAlpha, description) {
  const actionBy = await getActionBy();
  return api.request("POST", "/api/SupplierCodePrefixes", {
    PrefixAlpha: prefixAlpha,
    prefixAlpha,
    Description: description,
    description,
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
}

async function updateCodePrefix(id, prefixAlpha, description) {
  const actionBy = await getActionBy();
  return api.request("PUT", `/api/SupplierCodePrefixes/${id}`, {
    Id: id,
    id,
    PrefixAlpha: prefixAlpha,
    prefixAlpha,
    Description: description,
    description,
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  });
}

function deleteCodePrefix(id) {
  return api.remove("SupplierCodePrefixes", id);
}

function listSuppliers() {
  return api.request("GET", "/api/Supplier");
}

async function createSupplier(data) {
  return api.create("Supplier", data);
}

async function updateSupplier(id, data) {
  return api.update("Supplier", id, data);
}

function removeSupplier(id) {
  return api.remove("Supplier", id);
}

const supplierApi = {
  unwrapList,
  normalizeRankRow,
  normalizeCodePrefixRow,
  getRanks,
  createRank,
  getCodePrefixes,
  createCodePrefix,
  updateCodePrefix,
  deleteCodePrefix,
  listSuppliers,
  createSupplier,
  updateSupplier,
  removeSupplier,
};

export default supplierApi;
