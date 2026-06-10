import api, { getActionBy } from "services/api.service";

function getAll() {
  return api.request("GET", "/api/AccountingSys");
}

async function create(data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return api.request("POST", "/api/AccountingSys", payload);
}

async function update(id, data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Id: id,
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return api.request("PUT", `/api/AccountingSys/${id}`, payload);
}

const accountingSysApi = { getAll, create, update };
export default accountingSysApi;
