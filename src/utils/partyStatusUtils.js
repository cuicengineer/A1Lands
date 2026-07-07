export const PARTY_STATUS_OPTIONS = [
  { value: true, label: "Active" },
  { value: false, label: "Inactive" },
];

export function normalizePartyStatus(value) {
  if (value === true || value === false) return value;
  if (value === "true" || value === 1 || value === "1") return true;
  if (value === "false" || value === 0 || value === "0") return false;
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (text === "active") return true;
  if (text === "inactive") return false;
  return true;
}

export function formatPartyStatusLabel(status) {
  return normalizePartyStatus(status) ? "Active" : "Inactive";
}

export function coercePartyStatusValue(value) {
  return value === true || value === "true";
}
