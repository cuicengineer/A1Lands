import api from "services/api.service";

/**
 * Fire-and-forget client audit log (never blocks UI / exports).
 * ActionBy is set server-side from the authenticated user.
 */
export function logClientAudit({
  entityName,
  entityId = null,
  action = "Web",
  oldValues = null,
  newValues = null,
} = {}) {
  if (!entityName) return Promise.resolve();

  const payload = {
    entityName: String(entityName).trim(),
    entityId: entityId == null || entityId === "" ? null : Number(entityId),
    action: String(action || "Web")
      .trim()
      .slice(0, 50),
    oldValuesJson:
      oldValues == null
        ? null
        : typeof oldValues === "string"
        ? oldValues
        : JSON.stringify(oldValues),
    newValuesJson:
      newValues == null
        ? null
        : typeof newValues === "string"
        ? newValues
        : JSON.stringify(newValues),
  };

  return api.post("/api/AuditLog", payload).catch(() => null);
}

/** Log an Excel export to the shared AuditLog table. */
export function logExcelExport({
  moduleName,
  fileName,
  rowCount = null,
  exportType = "excel",
  extra = null,
} = {}) {
  const name = String(moduleName || fileName || "ExcelExport").trim() || "ExcelExport";
  return logClientAudit({
    entityName: "ExcelExport",
    action: "Web",
    newValues: {
      exportType,
      module: name,
      fileName: fileName || null,
      rowCount: rowCount == null ? null : Number(rowCount),
      exportedAt: new Date().toISOString(),
      ...(extra && typeof extra === "object" ? extra : {}),
    },
  });
}

const auditLogService = {
  logClientAudit,
  logExcelExport,
};

export default auditLogService;
