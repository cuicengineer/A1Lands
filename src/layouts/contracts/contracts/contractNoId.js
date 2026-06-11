import {
  sanitizePropertyNumberInput,
  isValidPropertyNumber,
  formatPropertyNumber,
  getBasePrefix,
  getClassSuffix,
} from "layouts/configuration/rental-properties/rentalPropertyId";

export const sanitizeContractNumberInput = sanitizePropertyNumberInput;
export const isValidContractNumber = isValidPropertyNumber;
export const formatContractNumber = formatPropertyNumber;

/**
 * Build Contract No as CLASS + NUMBER + BASE + -P1 (e.g. A001PSH-P1).
 */
export function buildContractNo({ contractNumber, baseRow, classRow }) {
  const paddedNumber = formatContractNumber(contractNumber);
  if (!paddedNumber) return "";

  const classPrefix = getClassSuffix(classRow);
  const baseSuffix = getBasePrefix(baseRow);
  if (!classPrefix || !baseSuffix) return "";

  return `${classPrefix}${paddedNumber}${baseSuffix}-P1`;
}

/** Extract numeric contract sequence from stored Contract No (e.g. A001PSH-P1 → 1). */
export function parseContractNumberFromContractNo(contractNo) {
  const text = String(contractNo || "").trim();
  if (!text || !/-P1$/i.test(text)) return "";

  const body = text.replace(/-P1$/i, "");
  const match = body.match(/^([A-Za-z]+)(\d{1,3})([A-Za-z]+)$/);
  if (!match || !isValidPropertyNumber(match[2])) return "";

  return String(Number(match[2]));
}
