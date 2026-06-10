export function normalizeUsername(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");
}

export function isSuperuserUsername(username) {
  return normalizeUsername(username) === "superuser";
}
