import { normalizePartyStatus } from "utils/partyStatusUtils";
import { buildDealerCode, parseDealerCode } from "utils/dealerOptionUtils";

export function buildDealerFormState(overrides = {}) {
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
    representative: "",
    bankListsId: "",
    iban: "",
    status: true,
    ...overrides,
  };
}

export function normalizeDealerRecord(row, codePrefixOptions = []) {
  if (!row || typeof row !== "object") return buildDealerFormState();

  const code = row.code ?? row.Code ?? "";
  const parsed = parseDealerCode(code, codePrefixOptions);
  const normalizedCode = buildDealerCode(parsed.codeAlpha, parsed.codeNumeric) || code;

  return buildDealerFormState({
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
    representative: row.representative ?? row.Representative ?? "",
    bankListsId: row.bankListsId ?? row.BankListsId ?? "",
    iban: row.iban ?? row.IBAN ?? "",
    status: normalizePartyStatus(row.status ?? row.Status),
  });
}

export function validateDealerForm(form) {
  const errors = {};
  const codeAlpha = String(form.codeAlpha || "").trim();
  const codeNumeric = String(form.codeNumeric || "").replace(/\D/g, "");

  if (!codeAlpha) errors.codeAlpha = "Code prefix is required";
  if (!codeNumeric) errors.codeNumeric = "Code number is required";
  else if (!/^\d{1,6}$/.test(codeNumeric)) {
    errors.codeNumeric = "Code number must be 1 to 6 digits";
  }

  const combinedCode = buildDealerCode(codeAlpha, codeNumeric);
  if (!combinedCode) errors.code = "Code is required";

  if (!String(form.name || "").trim()) errors.name = "Name is required";
  if (!String(form.address || "").trim()) errors.address = "Address is required";
  if (!String(form.province || "").trim()) errors.province = "Province is required";
  if (!String(form.city || "").trim()) errors.city = "City is required";
  if (!String(form.ntnCnic || "").trim()) errors.ntnCnic = "NTN / CNIC is required";
  return errors;
}

export function buildDealerPayload(form) {
  const code = buildDealerCode(form.codeAlpha, form.codeNumeric);

  return {
    Code: code,
    code,
    Prefix: form.prefix || null,
    prefix: form.prefix || null,
    Rank: form.rank || null,
    rank: form.rank || null,
    Name: String(form.name || "").trim(),
    name: String(form.name || "").trim(),
    Address: String(form.address || "").trim() || null,
    address: String(form.address || "").trim() || null,
    Province: form.province || null,
    province: form.province || null,
    City: String(form.city || "").trim() || null,
    city: String(form.city || "").trim() || null,
    NtnCnic: String(form.ntnCnic || "").trim() || null,
    ntnCnic: String(form.ntnCnic || "").trim() || null,
    GSTNo: String(form.gstNo || "").trim() || null,
    gstNo: String(form.gstNo || "").trim() || null,
    TelNo: String(form.telNo || "").trim() || null,
    telNo: String(form.telNo || "").trim() || null,
    MobileNo: String(form.mobileNo || "").trim() || null,
    mobileNo: String(form.mobileNo || "").trim() || null,
    Representative: String(form.representative || "").trim() || null,
    representative: String(form.representative || "").trim() || null,
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
