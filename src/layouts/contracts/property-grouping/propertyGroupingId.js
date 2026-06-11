import {
  sanitizePropertyNumberInput,
  isValidPropertyNumber,
  formatPropertyNumber,
  getBasePrefix,
  getClassSuffix,
} from "layouts/configuration/rental-properties/rentalPropertyId";

export const sanitizeGroupNumberInput = sanitizePropertyNumberInput;
export const isValidGroupNumber = isValidPropertyNumber;
export const formatGroupNumber = formatPropertyNumber;

/**
 * Build Group ID as CLASS + NUMBER + -BASE (e.g. A001-PSH).
 */
export function buildPropertyGroupingGId({ groupNumber, baseRow, classRow }) {
  const paddedNumber = formatGroupNumber(groupNumber);
  if (!paddedNumber) return "";

  const classPrefix = getClassSuffix(classRow);
  const baseSuffix = getBasePrefix(baseRow);
  if (!classPrefix || !baseSuffix) return "";

  return `${classPrefix}${paddedNumber}-${baseSuffix}`;
}

/** Extract numeric group sequence from stored Group ID (e.g. A001-PSH → 1). */
export function parseGroupNumberFromGId(gId) {
  const text = String(gId || "").trim();
  if (!text) return "";

  const dashIdx = text.lastIndexOf("-");
  if (dashIdx < 0) return "";

  const prefixPart = text.slice(0, dashIdx);
  const digitsMatch = prefixPart.match(/(\d{1,3})$/);
  if (!digitsMatch || !isValidPropertyNumber(digitsMatch[1])) return "";

  return String(Number(digitsMatch[1]));
}
