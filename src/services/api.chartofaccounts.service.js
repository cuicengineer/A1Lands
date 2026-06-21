import api, { getActionBy } from "services/api.service";

export const COA_SECTION_TYPE = "(A) Balance Sheet";
export const COA_ATTACHMENT_HEADER_ID = 1;
export const UPLOAD_TABLE_NAME = "ChartOfAccounts";

export const COA_GROUP_OPTIONS = ["Assets", "Liabilities", "Capital", "Suspense"];

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.results)) return response.results;
  if (Array.isArray(response?.value)) return response.value;
  return [];
}

async function withAudit(payload, action) {
  const actionBy = await getActionBy();
  return {
    ...(payload || {}),
    Action: action,
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
}

function getAll(section = COA_SECTION_TYPE) {
  const params = new URLSearchParams({ section }).toString();
  return api.request("GET", `/api/ChartOfAccounts?${params}`);
}

function getSubGroups(groupName) {
  const params = groupName ? `?groupName=${encodeURIComponent(groupName)}` : "";
  return api.request("GET", `/api/ChartOfAccountSubGroups${params}`);
}

async function createSubGroup(groupName, subGroupName) {
  const payload = await withAudit(
    {
      GroupName: groupName,
      groupName,
      SubGroupName: subGroupName,
      subGroupName,
    },
    "Create"
  );
  return api.request("POST", "/api/ChartOfAccountSubGroups", payload);
}

async function updateSubGroup(id, groupName, subGroupName) {
  const payload = await withAudit(
    {
      Id: Number(id),
      GroupName: groupName,
      groupName,
      SubGroupName: subGroupName,
      subGroupName,
    },
    "Update"
  );
  return api.request("PUT", `/api/ChartOfAccountSubGroups/${id}`, payload);
}

async function deleteSubGroup(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/ChartOfAccountSubGroups/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  });
}

function getControlAccounts() {
  return api.request("GET", "/api/ChartOfAccountControlAccounts");
}

async function createControlAccount(controlAccountName) {
  const payload = await withAudit(
    {
      ControlAccountName: controlAccountName,
      controlAccountName,
    },
    "Create"
  );
  return api.request("POST", "/api/ChartOfAccountControlAccounts", payload);
}

async function reorder(id, direction, section = COA_SECTION_TYPE) {
  const actionBy = await getActionBy();
  const payload = {
    Id: Number(id),
    Direction: direction,
    SectionType: section,
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  };
  return api.request("POST", "/api/ChartOfAccounts/reorder", payload);
}

async function batchSave({ creates = [], updates = [], deleteIds = [] }) {
  const actionBy = await getActionBy();
  const payload = {
    Creates: creates,
    Updates: updates,
    DeleteIds: deleteIds,
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  };
  return api.request("POST", "/api/ChartOfAccounts/batch", payload);
}

async function create(data) {
  const payload = await withAudit(data, "Create");
  return api.request("POST", "/api/ChartOfAccounts", payload);
}

async function update(id, data) {
  const payload = await withAudit({ ...data, Id: id }, "Update");
  return api.request("PUT", `/api/ChartOfAccounts/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/ChartOfAccounts/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  });
}

const chartOfAccountsApi = {
  getAll,
  getSubGroups,
  createSubGroup,
  updateSubGroup,
  deleteSubGroup,
  getControlAccounts,
  createControlAccount,
  create,
  update,
  remove,
  reorder,
  batchSave,
  unwrapList,
};

export default chartOfAccountsApi;
