import api, { getActionBy } from "services/api.service";
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

function normalizeCodePrefixRow(row) {
  const id = row?.id ?? row?.Id;
  const prefixAlpha = String(row?.prefixAlpha ?? row?.PrefixAlpha ?? "")
    .trim()
    .toUpperCase();
  const description = String(row?.description ?? row?.Description ?? "").trim();
  return { id, prefixAlpha, description };
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

function getByCode(code, excludeId) {
  const params = new URLSearchParams({ code: String(code || "").trim() });
  if (excludeId != null && excludeId !== "") {
    params.set("excludeId", String(excludeId));
  }
  return api.request("GET", `/api/Supplier/byCode?${params.toString()}`);
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

async function bulkUpdateStatus(ids, status) {
  return api.request("PATCH", "/api/Supplier/bulkStatus", {
    Ids: ids,
    ids,
    Status: status,
    status,
  });
}

const supplierApi = {
  unwrapList,
  normalizeRankRow,
  normalizeCodePrefixRow,
  getRanks,
  createRank,
  updateRank,
  deleteRank,
  getCodePrefixes,
  createCodePrefix,
  updateCodePrefix,
  deleteCodePrefix,
  listSuppliers,
  getByCode,
  createSupplier,
  updateSupplier,
  removeSupplier,
  bulkUpdateStatus,
};

export default supplierApi;
