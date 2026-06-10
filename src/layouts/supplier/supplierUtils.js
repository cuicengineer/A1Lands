import {
  BASE_OPTIONS,
  MAX_ATTACHMENT_FILES,
  RAC_OPTIONS,
} from "layouts/accounts/receipts/receiptUtils";

export { RAC_OPTIONS, BASE_OPTIONS, MAX_ATTACHMENT_FILES };

export const CURRENCY_OPTIONS = ["PKR", "USD", "EUR", "GBP", "SAR", "AED", "CNY"];

export function buildSupplierFormState(overrides = {}) {
  return {
    racId: "",
    baseId: "",
    name: "",
    code: "",
    creditLimit: "",
    currency: "PKR",
    address: "",
    email: "",
    division: "",
    iban: "",
    attachments: [],
    ...overrides,
  };
}

export function getRacName(racId) {
  const row = RAC_OPTIONS.find((o) => Number(o.id) === Number(racId));
  return row?.name || "";
}

export function getBaseName(baseId) {
  const row = BASE_OPTIONS.find((o) => Number(o.id) === Number(baseId));
  return row?.name || "";
}

export function flattenSupplierForGrid(record, index) {
  return {
    id: record.id,
    sno: index + 1,
    racDisplay: getRacName(record.racId) || "-",
    baseDisplay: getBaseName(record.baseId) || "-",
    name: record.name || "-",
    code: record.code || "-",
    creditLimit: record.creditLimit ?? "-",
    currency: record.currency || "-",
    address: record.address || "-",
    email: record.email || "-",
    division: record.division || "-",
    iban: record.iban || "-",
    attachmentCount: Array.isArray(record.attachments) ? record.attachments.length : 0,
    _record: record,
  };
}
