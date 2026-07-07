import { formatPartyStatusLabel, normalizePartyStatus } from "utils/partyStatusUtils";
import {
  findPartyCoaOption,
  getPartyCoaDropdownLabel,
  isCustomerPartyCoaOption,
  isCustomerPayableCoaOption,
  isCustomerReceiptCoaOption,
  mergePartyCoaOption,
  normalizePartyCoaOption,
} from "utils/partyCoaUtils";

export function pickCoaField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function normalizeCustomerCoaOption(row) {
  return normalizePartyCoaOption(row);
}

export { isCustomersControlAccount } from "utils/partyCoaUtils";

export function getCustomerCoaDropdownLabel(option) {
  return getPartyCoaDropdownLabel(option);
}

export function findCustomerCoaOption(options, coaId) {
  return findPartyCoaOption(options, coaId);
}

export function mergeCustomerCoaOption(options, option) {
  return mergePartyCoaOption(options, option);
}

export { isCustomerPartyCoaOption, isCustomerPayableCoaOption, isCustomerReceiptCoaOption };

export const PREFIX_OPTIONS = [
  { value: "M/s", label: "M/s" },

  { value: "Mr", label: "Mr" },

  { value: "Ms", label: "Ms" },

  { value: "Miss", label: "Miss" },
];

export const PROVINCE_OPTIONS = [
  { value: "Capital", label: "Federal" },

  { value: "Punjab", label: "Punjab" },

  { value: "Sindh", label: "Sindh" },

  { value: "KPK", label: "KPK" },

  { value: "Balochistan", label: "Balochistan" },

  { value: "GB", label: "GB" },

  { value: "AJK", label: "AJK" },
];

export function getProvinceLabel(value) {
  const match = PROVINCE_OPTIONS.find((item) => item.value === value);

  return match?.label || value || "-";
}

export function normalizeCodePrefixRow(row) {
  const id = row?.id ?? row?.Id;

  const prefixAlpha = String(row?.prefixAlpha ?? row?.PrefixAlpha ?? "")
    .trim()

    .toUpperCase();

  const description = String(row?.description ?? row?.Description ?? "").trim();

  return { id, prefixAlpha, description };
}

export function buildCustomerCode(codeAlpha, codeNumeric) {
  const alpha = String(codeAlpha || "")
    .trim()

    .toUpperCase();

  const numeric = String(codeNumeric || "").replace(/\D/g, "");

  if (!alpha || !numeric) return "";

  return `${alpha}/${numeric}`;
}

function stripCodeNumericSuffix(rawSuffix) {
  return String(rawSuffix || "")
    .replace(/^\/+/, "")
    .replace(/\D/g, "");
}

export function parseCustomerCode(code, prefixOptions = []) {
  const raw = String(code || "")
    .trim()
    .toUpperCase();

  if (!raw) return { codeAlpha: "", codeNumeric: "" };

  const options = (prefixOptions || [])

    .map((row) => normalizeCodePrefixRow(row).prefixAlpha)

    .filter(Boolean)

    .sort((a, b) => b.length - a.length);

  for (let i = 0; i < options.length; i += 1) {
    const alpha = options[i];

    if (raw.startsWith(alpha)) {
      return {
        codeAlpha: alpha,
        codeNumeric: stripCodeNumericSuffix(raw.slice(alpha.length)),
      };
    }
  }

  const match = raw.match(/^([A-Z]+)\/?(\d*)$/);

  if (match) {
    return { codeAlpha: match[1], codeNumeric: match[2] || "" };
  }

  return { codeAlpha: "", codeNumeric: "" };
}

export function buildCustomerFormState(overrides = {}) {
  return {
    dealerId: "",
    dealerName: "",
    code: "",

    codeAlpha: "",

    codeNumeric: "",

    prefix: "",

    rank: "",

    name: "",

    address: "",

    province: "",

    city: "",

    ntnCnic: "",

    gstNo: "",

    telNo: "",

    mobileNo: "",

    coaId: "",

    coaId2: "",

    representative: "",

    bankListsId: "",

    iban: "",

    status: true,

    ...overrides,
  };
}

export function normalizeCustomerRecord(row, prefixOptions = []) {
  if (!row || typeof row !== "object") return buildCustomerFormState();

  const code = row.code ?? row.Code ?? "";

  const parsed = parseCustomerCode(code, prefixOptions);

  const normalizedCode = buildCustomerCode(parsed.codeAlpha, parsed.codeNumeric) || code;

  return buildCustomerFormState({
    id: row.id ?? row.Id,
    dealerId: row.dealerId ?? row.DealerId ?? "",
    dealerName: row.dealerName ?? row.DealerName ?? row.name ?? row.Name ?? "",

    code: normalizedCode,

    codeAlpha: parsed.codeAlpha,

    codeNumeric: parsed.codeNumeric,

    prefix: row.prefix ?? row.Prefix ?? "",

    rank: row.rank ?? row.Rank ?? "",

    name: row.name ?? row.Name ?? "",

    address: row.address ?? row.Address ?? "",

    province: row.province ?? row.Province ?? "",

    city: row.city ?? row.City ?? "",

    ntnCnic: row.ntnCnic ?? row.NtnCnic ?? "",

    gstNo: row.gstNo ?? row.GSTNo ?? "",

    telNo: row.telNo ?? row.TelNo ?? "",

    mobileNo: row.mobileNo ?? row.MobileNo ?? "",

    coaId: row.coaId ?? row.CoaId ?? "",

    coaId2: row.coaId2 ?? row.CoaId2 ?? "",

    representative: row.representative ?? row.Representative ?? "",

    bankListsId: row.bankListsId ?? row.BankListsId ?? "",

    iban: row.iban ?? row.IBAN ?? "",

    status: normalizePartyStatus(row.status ?? row.Status),
  });
}

export function stripCustomerForClone(record, prefixOptions = []) {
  const normalized = normalizeCustomerRecord(record, prefixOptions);

  const { id, ...rest } = normalized;

  return rest;
}

export function validateCustomerForm(form) {
  const errors = {};

  if (form.dealerId === "" || form.dealerId == null) {
    errors.dealerId = "Dealer is required";
    errors.code = "Select an active dealer";
  }

  const combinedCode = buildCustomerCode(form.codeAlpha, form.codeNumeric);
  if (!combinedCode && !errors.code) {
    errors.code = "Code is required";
  }

  if (!form.name?.trim()) errors.name = "Name is required";

  if (!form.address?.trim()) errors.address = "Address is required";

  if (!form.province) errors.province = "Province is required";

  if (!form.city?.trim()) errors.city = "City is required";

  if (!form.ntnCnic?.trim()) errors.ntnCnic = "NTN / CNIC is required";

  if (form.coaId === "" || form.coaId == null) {
    errors.coaId = "Receipt CA is required";
  }

  if (form.coaId2 === "" || form.coaId2 == null) {
    errors.coaId2 = "Payable CA is required";
  } else if (
    form.coaId !== "" &&
    form.coaId != null &&
    Number(form.coaId) === Number(form.coaId2)
  ) {
    errors.coaId2 = "Payable CA must differ from Receipt CA";
  }

  return errors;
}

export function buildCustomerPayload(form) {
  const code = buildCustomerCode(form.codeAlpha, form.codeNumeric);

  return {
    Code: code,

    code,

    DealerId: form.dealerId !== "" && form.dealerId != null ? Number(form.dealerId) : null,

    dealerId: form.dealerId !== "" && form.dealerId != null ? Number(form.dealerId) : null,

    Prefix: form.prefix || null,

    prefix: form.prefix || null,

    Rank: form.rank || null,

    rank: form.rank || null,

    Name: String(form.name || "").trim(),

    name: String(form.name || "").trim(),

    Address: form.address || null,

    address: form.address || null,

    Province: form.province || null,

    province: form.province || null,

    City: form.city || null,

    city: form.city || null,

    NtnCnic: form.ntnCnic || null,

    ntnCnic: form.ntnCnic || null,

    GSTNo: form.gstNo || null,

    gstNo: form.gstNo || null,

    TelNo: form.telNo || null,

    telNo: form.telNo || null,

    MobileNo: form.mobileNo || null,

    mobileNo: form.mobileNo || null,

    CoaId: form.coaId !== "" && form.coaId != null ? Number(form.coaId) : null,

    coaId: form.coaId !== "" && form.coaId != null ? Number(form.coaId) : null,

    CoaId2: form.coaId2 !== "" && form.coaId2 != null ? Number(form.coaId2) : null,

    coaId2: form.coaId2 !== "" && form.coaId2 != null ? Number(form.coaId2) : null,

    Representative: form.representative || null,

    representative: form.representative || null,

    BankListsId:
      form.bankListsId !== "" && form.bankListsId != null ? Number(form.bankListsId) : null,

    bankListsId:
      form.bankListsId !== "" && form.bankListsId != null ? Number(form.bankListsId) : null,

    IBAN: String(form.iban || "").trim() || null,

    iban: String(form.iban || "").trim() || null,

    Status: normalizePartyStatus(form.status),

    status: normalizePartyStatus(form.status),
  };
}

export function flattenCustomerForGrid(record, index, coaLabelById = {}) {
  const normalized = normalizeCustomerRecord(record);

  const coaId = normalized.coaId;

  const coaLabel = coaId !== "" && coaId != null ? coaLabelById[Number(coaId)] || "-" : "-";

  const coaId2 = normalized.coaId2;

  const coaLabel2 = coaId2 !== "" && coaId2 != null ? coaLabelById[Number(coaId2)] || "-" : "-";

  return {
    id: normalized.id,

    sno: index + 1,

    code: normalized.code || "-",

    prefix: normalized.prefix || "-",

    rank: normalized.rank || "-",

    status: formatPartyStatusLabel(normalized.status),

    statusRaw: normalized.status,

    name: normalized.name || "-",

    address: normalized.address || "-",

    province: getProvinceLabel(normalized.province),

    city: normalized.city || "-",

    ntnCnic: normalized.ntnCnic || "-",

    gstNo: normalized.gstNo || "-",

    telNo: normalized.telNo || "-",

    mobileNo: normalized.mobileNo || "-",

    controlAccount: coaLabel,

    controlAccount2: coaLabel2,

    representative: normalized.representative || "-",

    _record: normalized,
  };
}

export function getCustomerDuplicateWarnings(form, records, excludeId = null) {
  const warnings = [];
  const ntnCnic = String(form?.ntnCnic || "").trim();
  const gstNo = String(form?.gstNo || "").trim();

  if (ntnCnic) {
    const hasDuplicateCnic = (records || []).some((row) => {
      const id = row?.id ?? row?.Id;
      if (excludeId != null && Number(id) === Number(excludeId)) return false;
      const existing = String(row?.ntnCnic ?? row?.NtnCnic ?? "").trim();
      return existing && existing === ntnCnic;
    });
    if (hasDuplicateCnic) warnings.push("Duplicate CNIC");
  }

  if (gstNo) {
    const hasDuplicateGst = (records || []).some((row) => {
      const id = row?.id ?? row?.Id;
      if (excludeId != null && Number(id) === Number(excludeId)) return false;
      const existing = String(row?.gstNo ?? row?.GSTNo ?? "").trim();
      return existing && existing === gstNo;
    });
    if (hasDuplicateGst) warnings.push("Duplicate GST No");
  }

  return warnings;
}
