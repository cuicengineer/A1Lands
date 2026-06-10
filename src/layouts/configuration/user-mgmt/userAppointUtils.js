export const USER_APPOINT_ENTITY = "UserAppoint";

export function mapUserAppointRows(raw) {
  const arr = Array.isArray(raw) ? raw : raw?.items || [];
  return arr
    .map((row) => ({
      id: Number(row?.id ?? row?.Id),
      name: String(row?.name ?? row?.Name ?? "").trim(),
    }))
    .filter((o) => o.name && Number.isFinite(o.id));
}

export function buildAppointNameOptions(appointOptions, currentValue) {
  const names = (appointOptions || []).map((o) => o.name).filter(Boolean);
  const cur = String(currentValue ?? "").trim();
  if (cur && !names.some((n) => n.toLowerCase() === cur.toLowerCase())) {
    names.push(cur);
  }
  return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
}
