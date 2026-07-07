import { format, parseISO, isValid } from "date-fns";

export function todayInputDate() {
  return format(new Date(), "yyyy-MM-dd");
}

export function toInputDate(value) {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  try {
    const parsed = parseISO(raw);
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
  } catch {
    // ignore invalid parseISO
  }
  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) return format(new Date(ts), "yyyy-MM-dd");
  return "";
}

export function toDisplayDate(value) {
  if (value == null || value === "") return "";
  const input = toInputDate(value);
  if (!input) return "";
  try {
    const parsed = parseISO(input);
    if (isValid(parsed)) return format(parsed, "dd-MMM-yyyy");
  } catch {
    // ignore invalid parseISO
  }
  return input;
}

export function formatDisplayDate(value) {
  const displayed = toDisplayDate(value);
  return displayed || "-";
}

export function buildExchangeRateFormState(overrides = {}) {
  return {
    rateDate: "",
    baseCurrencyId: "",
    foreignCurrencyId: "",
    rate: "",
    baseCurrencyCode: "PKR",
    ...overrides,
  };
}

export function normalizeExchangeRateRecord(row) {
  if (!row) return buildExchangeRateFormState();
  return {
    ...buildExchangeRateFormState({
      rateDate: toInputDate(row?.rateDate ?? row?.RateDate),
      baseCurrencyId: row?.baseCurrencyId ?? row?.BaseCurrencyId ?? "",
      foreignCurrencyId: row?.foreignCurrencyId ?? row?.ForeignCurrencyId ?? "",
      rate: row?.rate ?? row?.Rate ?? "",
      baseCurrencyDisplay: row?.baseCurrencyDisplay ?? row?.BaseCurrencyDisplay ?? "",
      foreignCurrencyDisplay: row?.foreignCurrencyDisplay ?? row?.ForeignCurrencyDisplay ?? "",
      baseCurrencyCode: row?.baseCurrencyCode ?? row?.BaseCurrencyCode ?? "PKR",
    }),
    id: row?.id ?? row?.Id,
  };
}

export function validateExchangeRateForm(form, currencyById = {}) {
  const errors = {};
  const isEmpty = (val) => {
    if (val === null || val === undefined) return true;
    if (typeof val === "string") return val.trim().length === 0;
    return false;
  };

  if (isEmpty(form?.rateDate)) errors.rateDate = "Date is required";
  if (form?.baseCurrencyId === "" || form?.baseCurrencyId == null) {
    errors.baseCurrencyId = "Base Currency is required";
  }
  if (form?.foreignCurrencyId === "" || form?.foreignCurrencyId == null) {
    errors.foreignCurrencyId = "Foreign Currency is required";
  }
  if (isEmpty(form?.rate) || Number(form.rate) <= 0) {
    errors.rate = "Rate must be greater than zero";
  }
  Object.assign(errors, getExchangeRateCurrencyPairErrors(form, currencyById));
  return errors;
}

export function exchangeRateCurrenciesAreSame(form, currencyById = {}) {
  const baseId = form?.baseCurrencyId;
  const foreignId = form?.foreignCurrencyId;
  if (baseId === "" || baseId == null || foreignId === "" || foreignId == null) return false;
  if (Number(baseId) === Number(foreignId)) return true;

  const base = currencyById[Number(baseId)];
  const foreign = currencyById[Number(foreignId)];
  const baseCode = String(base?.code ?? "")
    .trim()
    .toUpperCase();
  const foreignCode = String(foreign?.code ?? "")
    .trim()
    .toUpperCase();
  return Boolean(baseCode && foreignCode && baseCode === foreignCode);
}

export function getExchangeRateCurrencyPairErrors(form, currencyById = {}) {
  const errors = {};
  if (!exchangeRateCurrenciesAreSame(form, currencyById)) return errors;

  const message = "Base Currency and Foreign Currency must be different";
  errors.baseCurrencyId = message;
  errors.foreignCurrencyId = message;
  return errors;
}

export function filterExchangeRateCurrencyOptions(
  currencyOptions,
  { excludeCurrencyId = "" } = {}
) {
  if (excludeCurrencyId === "" || excludeCurrencyId == null) return currencyOptions || [];
  const exclude = Number(excludeCurrencyId);
  return (currencyOptions || []).filter((opt) => Number(opt.id) !== exclude);
}

export function applyExchangeRateCurrencyFieldChange(form, field, value) {
  const next = { ...form, [field]: value };

  if (
    field === "baseCurrencyId" &&
    next.foreignCurrencyId !== "" &&
    next.foreignCurrencyId != null &&
    Number(value) === Number(next.foreignCurrencyId)
  ) {
    next.foreignCurrencyId = "";
  }

  if (
    field === "foreignCurrencyId" &&
    next.baseCurrencyId !== "" &&
    next.baseCurrencyId != null &&
    Number(value) === Number(next.baseCurrencyId)
  ) {
    next.baseCurrencyId = "";
  }

  return next;
}

export function buildExchangeRatePayload(form) {
  return {
    RateDate: form.rateDate,
    BaseCurrencyId: Number(form.baseCurrencyId),
    ForeignCurrencyId: Number(form.foreignCurrencyId),
    Rate: Number(form.rate),
  };
}

export function getBaseCurrencyCode(form, currencyById = {}) {
  const id = form?.baseCurrencyId;
  if (id == null || id === "") return form?.baseCurrencyCode || "PKR";
  return currencyById[Number(id)]?.code || form?.baseCurrencyCode || "PKR";
}

export function formatRateDisplay(row, currencyById = {}) {
  const baseCode = getBaseCurrencyCode(row, currencyById);
  const rateValue = row?.rate ?? row?.Rate;
  const rate = rateValue != null && rateValue !== "" ? Number(rateValue) : null;
  if (rate == null || Number.isNaN(rate)) return "-";
  return `1 ${baseCode} = ${rate}`;
}

export function getCurrencyLabel(currencyId, currencyById = {}, fallback = "-") {
  if (currencyId == null || currencyId === "") return fallback;
  const item = currencyById[Number(currencyId)];
  return item?.label || fallback;
}

export function flattenExchangeRateForGrid(row, index, currencyById = {}) {
  const normalized = normalizeExchangeRateRecord(row);
  return {
    id: normalized.id ?? row?.id ?? row?.Id,
    sno: index + 1,
    rateDate: normalized.rateDate,
    rateDateDisplay: formatDisplayDate(normalized.rateDate),
    baseCurrencyId: normalized.baseCurrencyId,
    foreignCurrencyId: normalized.foreignCurrencyId,
    baseCurrency:
      normalized.baseCurrencyDisplay ||
      getCurrencyLabel(normalized.baseCurrencyId, currencyById, "-"),
    foreignCurrency:
      normalized.foreignCurrencyDisplay ||
      getCurrencyLabel(normalized.foreignCurrencyId, currencyById, "-"),
    rate: normalized.rate,
    rateDisplay: formatRateDisplay(normalized, currencyById),
  };
}
