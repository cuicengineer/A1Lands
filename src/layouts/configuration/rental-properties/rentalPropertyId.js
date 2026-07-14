function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function sanitizePropertyNumberInput(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 3);
}

export function isValidPropertyNumber(value) {
  const digits = sanitizePropertyNumberInput(value);
  if (!digits) return false;
  const numeric = Number(digits);
  return Number.isFinite(numeric) && numeric >= 1 && numeric <= 999;
}

export function formatPropertyNumber(value) {
  if (!isValidPropertyNumber(value)) return "";
  return String(Number(sanitizePropertyNumberInput(value))).padStart(3, "0");
}

export function getBasePrefix(baseRow) {
  return pickField(baseRow, "code", "Code", "name", "Name").toUpperCase();
}

export function getRacPrefix(commandRow) {
  const abb = pickField(commandRow, "abb", "Abb");
  const name = pickField(commandRow, "name", "Name");
  return (abb || name).toUpperCase();
}

export function getClassSuffix(classRow) {
  return pickField(classRow, "code", "Code", "name", "Name").toUpperCase();
}

/**
 * Build Property ID as BASE-NUMBER-CLASS.
 * - With Base: PREFIX-NUMBERCLASS (e.g. PSH-005A)
 * - With RAC fallback only: PREFIX-NUMBER-CLASS (e.g. NRK-049-H)
 */
/** Extract numeric property sequence from stored Property ID (e.g. PSH-005A → 5, NRK-049-H → 49). */
export function parsePropertyNumberFromPId(pId) {
  const text = String(pId || "").trim();
  if (!text) return "";

  const parts = text.split("-").filter(Boolean);
  if (parts.length < 2) return "";

  if (parts.length >= 3) {
    const digits = parts[1].replace(/\D/g, "");
    if (isValidPropertyNumber(digits)) return String(Number(digits));
  }

  const secondPartMatch = parts[1].match(/^(\d{1,3})/);
  if (secondPartMatch && isValidPropertyNumber(secondPartMatch[1])) {
    return String(Number(secondPartMatch[1]));
  }

  return "";
}

export function buildRentalPropertyPId({ propertyNumber, baseRow, commandRow, classRow }) {
  const paddedNumber = formatPropertyNumber(propertyNumber);
  if (!paddedNumber) return "";

  const basePrefix = getBasePrefix(baseRow);
  const racPrefix = getRacPrefix(commandRow);
  const prefix = basePrefix || racPrefix;
  if (!prefix) return "";

  const classSuffix = getClassSuffix(classRow);
  if (!classSuffix) return "";

  if (basePrefix) return `${prefix}-${paddedNumber}${classSuffix}`;
  return `${prefix}-${paddedNumber}-${classSuffix}`;
}
