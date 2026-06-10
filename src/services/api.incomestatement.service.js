import api, { getActionBy } from "services/api.service";

export const UPLOAD_TABLE_NAME = "IncomeStatements";

export const IS_GROUP_OPTIONS = ["Revenue", "Expenses"];

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

function getAll() {
  return api.request("GET", "/api/IncomeStatements");
}

function getSubGroups(groupName) {
  const params = groupName ? `?groupName=${encodeURIComponent(groupName)}` : "";
  return api.request("GET", `/api/IncomeStatementSubGroups${params}`);
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
  return api.request("POST", "/api/IncomeStatementSubGroups", payload);
}

async function create(data) {
  const payload = await withAudit(data, "Create");
  return api.request("POST", "/api/IncomeStatements", payload);
}

async function update(id, data) {
  const payload = await withAudit({ ...data, Id: id }, "Update");
  return api.request("PUT", `/api/IncomeStatements/${id}`, payload);
}

async function remove(id) {
  const actionBy = await getActionBy();
  return api.request("DELETE", `/api/IncomeStatements/${id}`, {
    Action: "Delete",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
  });
}

const incomeStatementApi = {
  getAll,
  getSubGroups,
  createSubGroup,
  create,
  update,
  remove,
  unwrapList,
};

export default incomeStatementApi;
