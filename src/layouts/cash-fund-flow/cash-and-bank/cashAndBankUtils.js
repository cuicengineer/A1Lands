export const DEFAULT_CASH_AND_BANK_CURRENCY = "PKR";

export const STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

export const MODE_OPTIONS = [
  { value: "Cash", label: "Cash" },
  { value: "TR", label: "TR" },
  { value: "Bank", label: "Bank" },
];

export function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function pickNumericField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && value !== "") return Number(value);
  }
  return null;
}

export function isCashOrBankCashAndBankMode(row) {
  const mode = pickField(row, "mode", "Mode").toLowerCase();
  return mode === "cash" || mode === "bank";
}

export function isCashAndBankCoaOption(row) {
  const groupName = pickField(row, "groupName", "GroupName").toLowerCase();
  const controlAccount = pickField(row, "controlAccount", "ControlAccount").toLowerCase();
  return (
    groupName === "assets" &&
    (controlAccount === "cash and bank" || controlAccount === "cash & bank")
  );
}

export function normalizeCashAndBankCoaOption(row) {
  const id = row?.Id ?? row?.id;
  return {
    id: id != null ? Number(id) : null,
    acctId: pickField(row, "acctId", "AcctId"),
    acctName: pickField(row, "acctName", "AcctName"),
    controlAccount: pickField(row, "controlAccount", "ControlAccount"),
  };
}

export function getCashAndBankCoaDropdownLabel(option) {
  if (option == null) return "";
  const acctId = String(option.acctId ?? "").trim();
  const acctName = String(option.acctName ?? "").trim();
  if (acctId && acctName) return `${acctId} - ${acctName}`;
  return acctId || acctName || "";
}

export function getCashAndBankLedgerDropdownLabel(option) {
  if (option == null) return "";
  const acctId = String(option.acctId ?? option.AcctId ?? "").trim();
  const name = String(option.name ?? option.Name ?? "").trim();
  if (acctId && name) return `${acctId} - ${name}`;
  return name || acctId || "";
}

export function mergeCashAndBankCurrencyOptions(options, savedCode) {
  const trimmed = String(savedCode ?? "").trim();
  const list = Array.isArray(options) ? [...options] : [];
  if (!trimmed) return list;
  const exists = list.some((c) => String(c.code).toUpperCase() === trimmed.toUpperCase());
  if (exists) return list;
  return [{ code: trimmed, name: trimmed, label: trimmed }, ...list];
}

export function getCashAndBankCurrencyDropdownLabel(option) {
  if (option == null) return "";
  return (
    option.label ||
    (option.code && option.name
      ? `${option.code} - ${option.name}`
      : option.code || option.name || "")
  );
}

export function buildCashAndBankFormState(overrides = {}) {
  return {
    acctId: "",
    name: "",
    coaId: "",
    currency: DEFAULT_CASH_AND_BANK_CURRENCY,
    mode: "",
    iban: "",
    bankListsId: "",
    status: "Active",
    ...overrides,
  };
}

export function normalizeCashAndBankRecord(row) {
  if (!row) return buildCashAndBankFormState();
  return buildCashAndBankFormState({
    acctId: pickField(row, "acctId", "AcctId"),
    name: pickField(row, "name", "Name"),
    coaId: row?.coaId ?? row?.CoaId ?? "",
    currency: pickField(row, "currency", "Currency") || DEFAULT_CASH_AND_BANK_CURRENCY,
    mode: pickField(row, "mode", "Mode"),
    iban: pickField(row, "iban", "IBAN"),
    bankListsId: row?.bankListsId ?? row?.BankListsId ?? "",
    status: pickField(row, "status", "Status") || "Active",
  });
}

export function validateCashAndBankForm(form) {
  const errors = {};
  if (!String(form?.name ?? "").trim()) errors.name = "Name is required";
  if (form?.coaId === "" || form?.coaId == null) errors.coaId = "Control Account is required";
  if (!String(form?.currency ?? "").trim()) errors.currency = "Currency is required";
  if (!String(form?.mode ?? "").trim()) errors.mode = "Mode is required";
  return errors;
}

export function buildCashAndBankPayload(form) {
  return {
    AcctId: String(form?.acctId ?? "").trim() || null,
    Name: String(form?.name ?? "").trim(),
    CoaId: form?.coaId === "" || form?.coaId == null ? null : Number(form.coaId),
    Currency: String(form?.currency ?? DEFAULT_CASH_AND_BANK_CURRENCY).trim(),
    Mode: String(form?.mode ?? "").trim(),
    IBAN: String(form?.iban ?? "").trim() || null,
    BankListsId:
      form?.bankListsId === "" || form?.bankListsId == null ? null : Number(form.bankListsId),
    Status: String(form?.status ?? "Active").trim() || "Active",
  };
}

export function flattenCashAndBankForGrid(row, index, coaLabelById, bankLabelById) {
  const id = row?.id ?? row?.Id;
  const coaId = row?.coaId ?? row?.CoaId;
  const bankListsId = row?.bankListsId ?? row?.BankListsId;
  const parentCashAndBankId = pickNumericField(row, "parentCashAndBankId", "ParentCashAndBankId");
  const childCount = Number(row?.childCount ?? row?.ChildCount ?? 0);
  const coaDisplay =
    pickField(row, "coaDisplay", "CoaDisplay") ||
    (coaId != null ? coaLabelById[Number(coaId)] : "") ||
    "-";
  const bankDisplay =
    pickField(row, "bankDisplay", "BankDisplay") ||
    (bankListsId != null ? bankLabelById[Number(bankListsId)] : "") ||
    "-";
  const parentName = pickField(row, "name", "Name") || "-";

  return {
    id,
    sno: index + 1,
    acctId: pickField(row, "acctId", "AcctId") || "-",
    name: parentName,
    parentName,
    controlAccount: coaDisplay,
    currency: pickField(row, "currency", "Currency") || "-",
    mode: pickField(row, "mode", "Mode") || "-",
    iban: pickField(row, "iban", "IBAN") || "-",
    bank: bankDisplay,
    status: pickField(row, "status", "Status") || "Active",
    balance: 0,
    parentCashAndBankId,
    childCount,
  };
}
