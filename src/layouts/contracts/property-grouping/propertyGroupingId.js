import {
  sanitizePropertyNumberInput,
  isValidPropertyNumber,
  formatPropertyNumber,
  getClassSuffix,
  parsePropertyNumberFromPId,
} from "layouts/configuration/rental-properties/rentalPropertyId";

export const sanitizeGroupNumberInput = sanitizePropertyNumberInput;
export const isValidGroupNumber = isValidPropertyNumber;
export const formatGroupNumber = formatPropertyNumber;

/** Prefer Base Name (not Code) for Group ID on this page only. */
function getBaseNameSuffix(baseRow) {
  const name = String(baseRow?.name ?? baseRow?.Name ?? "").trim();
  if (name) return name.toUpperCase();
  return "";
}

/**
 * Lowest numeric sequence from selected property PIds (e.g. NRK-032A → 32).
 * Used as the Group ID number when one or more properties are selected.
 */
export function getLowestGroupNumberFromPropertyPIds(pIdList) {
  let lowest = null;
  (pIdList || []).forEach((pId) => {
    const numStr = parsePropertyNumberFromPId(pId);
    if (!numStr) return;
    const n = Number(numStr);
    if (!Number.isFinite(n)) return;
    if (lowest === null || n < lowest) lowest = n;
  });
  return lowest === null ? "" : String(lowest);
}

/**
 * Build Group ID as CLASS + NUMBER + BASE NAME (e.g. A001PSH).
 */
export function buildPropertyGroupingGId({ groupNumber, baseRow, classRow }) {
  const paddedNumber = formatGroupNumber(groupNumber);
  if (!paddedNumber) return "";

  const classPrefix = getClassSuffix(classRow);
  const baseSuffix = getBaseNameSuffix(baseRow);
  if (!classPrefix || !baseSuffix) return "";

  return `${classPrefix}${paddedNumber}${baseSuffix}`;
}

/** Extract numeric group sequence from stored Group ID (e.g. A001PSH → 1). */
export function parseGroupNumberFromGId(gId) {
  const text = String(gId || "").trim();
  if (!text) return "";

  const dashIdx = text.lastIndexOf("-");
  if (dashIdx >= 0) {
    const prefixPart = text.slice(0, dashIdx);
    const legacyDigitsMatch = prefixPart.match(/(\d{1,3})$/);
    if (legacyDigitsMatch && isValidPropertyNumber(legacyDigitsMatch[1])) {
      return String(Number(legacyDigitsMatch[1]));
    }
  }

  const digitsMatch = text.match(/^[A-Z]+(\d{1,3})/i);
  if (!digitsMatch || !isValidPropertyNumber(digitsMatch[1])) return "";

  return String(Number(digitsMatch[1]));
}
