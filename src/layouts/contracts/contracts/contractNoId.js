import {
  sanitizePropertyNumberInput,
  isValidPropertyNumber,
  formatPropertyNumber,
} from "layouts/configuration/rental-properties/rentalPropertyId";

export const sanitizeContractNumberInput = sanitizePropertyNumberInput;
export const isValidContractNumber = isValidPropertyNumber;
export const formatContractNumber = formatPropertyNumber;

/**
 * Build Contract No as GROUP_ID + -P + NUMBER (e.g. A001PSH-P005).
 */
export function buildContractNo({ contractNumber, groupGId }) {
  const paddedNumber = formatContractNumber(contractNumber);
  if (!paddedNumber) return "";

  const groupId = String(groupGId || "").trim();
  if (!groupId) return "";

  return `${groupId}-P${paddedNumber}`;
}

/** Extract numeric contract sequence from stored Contract No (e.g. A001PSH-P005 → 5). */
export function parseContractNumberFromContractNo(contractNo) {
  const text = String(contractNo || "").trim();
  if (!text) return "";

  const suffixMatch = text.match(/-P(\d{1,3})$/i);
  if (suffixMatch && isValidPropertyNumber(suffixMatch[1])) {
    return String(Number(suffixMatch[1]));
  }

  // Legacy: CLASS + NUMBER + BASE + -P1 (number was in the group-id segment)
  if (/-P1$/i.test(text)) {
    const body = text.replace(/-P1$/i, "");
    const legacyMatch = body.match(/^([A-Za-z]+)(\d{1,3})([A-Za-z]+)$/);
    if (legacyMatch && isValidPropertyNumber(legacyMatch[2])) {
      return String(Number(legacyMatch[2]));
    }
  }

  return "";
}
