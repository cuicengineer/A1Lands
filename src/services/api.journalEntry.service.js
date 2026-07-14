import api, { getActionBy } from "services/api.service";
import {
  buildJournalEntryApiPayload,
  normalizeJournalEntryRecord,
} from "layouts/cash-fund-flow/journal-entry/journalEntryUtils";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

async function listJournalEntries() {
  return api.request("GET", "/api/JournalEntries");
}

async function getJournalEntry(id) {
  return api.request("GET", `/api/JournalEntries/${id}`);
}

async function createJournalEntry(form) {
  const actionBy = await getActionBy();
  const payload = {
    ...buildJournalEntryApiPayload(form),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return api.request("POST", "/api/JournalEntries", payload);
}

async function updateJournalEntry(id, form) {
  const actionBy = await getActionBy();
  const payload = {
    ...buildJournalEntryApiPayload(form),
    Id: id,
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return api.request("PUT", `/api/JournalEntries/${id}`, payload);
}

async function updateJournalEntryLockStatus(ids, isLock) {
  const actionBy = await getActionBy();
  return api.request("PUT", "/api/JournalEntries/lock-status", {
    Ids: (ids || []).map(Number).filter((id) => Number.isFinite(id) && id > 0),
    IsLock: Boolean(isLock),
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  });
}

async function deleteJournalEntry(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/JournalEntries/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  });
}

const journalEntryApi = {
  listJournalEntries,
  getJournalEntry,
  createJournalEntry,
  updateJournalEntry,
  updateJournalEntryLockStatus,
  deleteJournalEntry,
  unwrapList,
  normalizeJournalEntryRow: normalizeJournalEntryRecord,
  buildJournalEntryApiPayload,
};

export default journalEntryApi;
