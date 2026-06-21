export function pickCoaField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function normalizeCustomerCoaOption(row) {
  const id = row?.Id ?? row?.id;
  return {
    id: id != null ? Number(id) : null,
    acctId: pickCoaField(row, "acctId", "AcctId"),
    acctName: pickCoaField(row, "acctName", "AcctName"),
    controlAccount: pickCoaField(row, "controlAccount", "ControlAccount"),
  };
}

export function isCustomersControlAccount(controlAccount) {
  return /^customers$/i.test(String(controlAccount || "").trim());
}

export function getCustomerCoaDropdownLabel(option) {
  if (option == null) return "";
  const acctId = String(option.acctId ?? "").trim();
  const acctName = String(option.acctName ?? "").trim();
  if (acctId && acctName) return `${acctId} - ${acctName}`;
  return acctId || acctName || "";
}

export function findCustomerCoaOption(options, coaId) {
  if (coaId === "" || coaId == null) return null;
  return (options || []).find((option) => Number(option.id) === Number(coaId)) ?? null;
}

export function mergeCustomerCoaOption(options, option) {
  if (option?.id == null) return options || [];
  const list = [...(options || [])];
  if (!list.some((row) => Number(row.id) === Number(option.id))) {
    list.push(option);
  }
  return list.sort((a, b) => {
    const idDiff = String(a.acctId).localeCompare(String(b.acctId), undefined, {
      numeric: true,
      sensitivity: "base",
    });
    if (idDiff !== 0) return idDiff;
    return String(a.acctName).localeCompare(String(b.acctName), undefined, {
      sensitivity: "base",
    });
  });
}

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

    representative: "",

    bankListsId: "",

    iban: "",

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

    representative: row.representative ?? row.Representative ?? "",

    bankListsId: row.bankListsId ?? row.BankListsId ?? "",

    iban: row.iban ?? row.IBAN ?? "",
  });
}

export function stripCustomerForClone(record, prefixOptions = []) {
  const normalized = normalizeCustomerRecord(record, prefixOptions);

  const { id, ...rest } = normalized;

  return rest;
}

export function validateCustomerForm(form) {
  const errors = {};

  const codeAlpha = String(form.codeAlpha || "").trim();

  const codeNumeric = String(form.codeNumeric || "").replace(/\D/g, "");

  if (!codeAlpha) errors.codeAlpha = "Code prefix is required";

  if (!codeNumeric) errors.codeNumeric = "Code number is required";
  else if (!/^\d{1,6}$/.test(codeNumeric)) {
    errors.codeNumeric = "Code number must be 1 to 6 digits";
  }

  const combinedCode = buildCustomerCode(codeAlpha, codeNumeric);

  if (!combinedCode) errors.code = "Code is required";

  if (!form.name?.trim()) errors.name = "Name is required";

  if (!form.address?.trim()) errors.address = "Address is required";

  if (!form.province) errors.province = "Province is required";

  if (!form.city?.trim()) errors.city = "City is required";

  if (!form.ntnCnic?.trim()) errors.ntnCnic = "NTN / CNIC is required";

  if (form.coaId === "" || form.coaId == null) {
    errors.coaId = "Control Account is required";
  }

  return errors;
}

export function buildCustomerPayload(form) {
  const code = buildCustomerCode(form.codeAlpha, form.codeNumeric);

  return {
    Code: code,

    code,

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

    Representative: form.representative || null,

    representative: form.representative || null,

    BankListsId:
      form.bankListsId !== "" && form.bankListsId != null ? Number(form.bankListsId) : null,

    bankListsId:
      form.bankListsId !== "" && form.bankListsId != null ? Number(form.bankListsId) : null,

    IBAN: String(form.iban || "").trim() || null,

    iban: String(form.iban || "").trim() || null,
  };
}

export function flattenCustomerForGrid(record, index, coaLabelById = {}) {
  const normalized = normalizeCustomerRecord(record);

  const coaId = normalized.coaId;

  const coaLabel = coaId !== "" && coaId != null ? coaLabelById[Number(coaId)] || "-" : "-";

  return {
    id: normalized.id,

    sno: index + 1,

    code: normalized.code || "-",

    prefix: normalized.prefix || "-",

    rank: normalized.rank || "-",

    name: normalized.name || "-",

    address: normalized.address || "-",

    province: getProvinceLabel(normalized.province),

    city: normalized.city || "-",

    ntnCnic: normalized.ntnCnic || "-",

    gstNo: normalized.gstNo || "-",

    telNo: normalized.telNo || "-",

    mobileNo: normalized.mobileNo || "-",

    controlAccount: coaLabel,

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
