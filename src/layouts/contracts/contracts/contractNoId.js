export function sanitizeContractNumberInput(value) {
  return String(value ?? "")
    .replace(/\D/g, "")
    .slice(0, 3);
}

export function isValidContractNumber(value) {
  const digits = sanitizeContractNumberInput(value);
  if (!digits) return false;
  const numeric = Number(digits);
  return Number.isFinite(numeric) && numeric >= 0 && numeric <= 999;
}

export function formatContractNumber(value) {
  if (!isValidContractNumber(value)) return "";
  return sanitizeContractNumberInput(value);
}

/**
 * Build Contract No as GROUP_ID + -P + NUMBER (e.g. A001PSH-P005).
 */
export function buildContractNo({ contractNumber, groupGId }) {
  const contractNumberText = formatContractNumber(contractNumber);
  if (!contractNumberText) return "";

  const groupId = String(groupGId || "").trim();
  if (!groupId) return "";

  return `${groupId}-P${contractNumberText}`;
}

/** Extract contract sequence from stored Contract No (e.g. A001PSH-P5 -> 5). */
export function parseContractNumberFromContractNo(contractNo) {
  const text = String(contractNo || "").trim();
  if (!text) return "";

  const suffixMatch = text.match(/-P(\d{1,3})$/i);
  if (suffixMatch && isValidContractNumber(suffixMatch[1])) {
    return suffixMatch[1];
  }

  // Legacy: CLASS + NUMBER + BASE + -P1 (number was in the group-id segment)
  if (/-P1$/i.test(text)) {
    const body = text.replace(/-P1$/i, "");
    const legacyMatch = body.match(/^([A-Za-z]+)(\d{1,3})([A-Za-z]+)$/);
    if (legacyMatch && isValidContractNumber(legacyMatch[2])) {
      return legacyMatch[2];
    }
  }

  return "";
}
