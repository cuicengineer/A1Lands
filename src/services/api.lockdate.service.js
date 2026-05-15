import api, { getActionBy } from "services/api.service";

/**
 * GET /api/LockDate
 */
function getAll() {
  return api.request("GET", "/api/LockDate");
}

/**
 * PUT /api/LockDate/{id}
 */
async function update(id, data) {
  const actionBy = await getActionBy();
  const payload = {
    ...(data || {}),
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  };
  return api.request("PUT", `/api/LockDate/${id}`, payload);
}

const lockDateApi = { getAll, update };
export default lockDateApi;
