import cashAndBankApi from "services/api.cashAndBank.service";
import { pickField } from "layouts/cash-fund-flow/cash-and-bank/cashAndBankUtils";
import { format, parseISO, isValid } from "date-fns";
import {
  formatTransactionLockDateValidationMessage,
  isDateLockedByLockDate,
} from "layouts/income-agreements/collections/collectionsUtils";

export const INTER_ACC_TRANSFER_VR_NO_PREFIX = "TE";
export const INTER_ACC_TRANSFER_DESCRIPTION_MAX_LENGTH = 35;

export function getInterAccTransferYearFromDate(dateValue) {
  const text = String(dateValue ?? "").trim();
  if (!text) return new Date().getFullYear();
  const match = text.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).getFullYear();
  return new Date().getFullYear();
}

export function formatInterAccTransferVrNo(sequence, year) {
  const seq = Math.max(1, Number(sequence) || 1);
  const yr = Number(year) || new Date().getFullYear();
  return `${INTER_ACC_TRANSFER_VR_NO_PREFIX}-${seq}/${yr}`;
}

export function parseInterAccTransferVrNo(vrNo) {
  const match = String(vrNo || "")
    .trim()
    .match(/^TE-(\d+)\/(\d{4})$/i);
  if (!match) return null;
  const sequence = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isFinite(sequence) || !Number.isFinite(year)) return null;
  return { sequence, year };
}

export function computeNextInterAccTransferVrNo(existingRecords, dateValue) {
  const year = getInterAccTransferYearFromDate(dateValue);
  let maxSequence = 0;
  (existingRecords || []).forEach((row) => {
    const vrNo = typeof row === "string" ? row : pickField(row, "vrNo", "VrNo");
    const parsed = parseInterAccTransferVrNo(vrNo);
    if (parsed && parsed.year === year) {
      maxSequence = Math.max(maxSequence, parsed.sequence);
    }
  });
  return formatInterAccTransferVrNo(maxSequence + 1, year);
}

export async function fetchInterAccTransferVrNos(api) {
  const records = await fetchInterAccTransferRecordsForVrNo(api);
  return records.map((row) => pickField(row, "vrNo", "VrNo")).filter(Boolean);
}

export async function fetchInterAccTransferRecordsForVrNo(api) {
  if (!api?.getAll) return [];
  const response =
    typeof api.getAllUnpaged === "function"
      ? await api.getAllUnpaged()
      : await api.getAll(1, 10000);
  const rows = Array.isArray(response) ? response : response?.data ?? [];
  return Array.isArray(rows) ? rows : [];
}

export function toInterAccTransferInputDate(value) {
  if (value == null || value === "") return format(new Date(), "yyyy-MM-dd");
  const raw = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) return format(new Date(ts), "yyyy-MM-dd");
  return format(new Date(), "yyyy-MM-dd");
}

export function formatInterAccTransferDisplayDate(value) {
  if (value == null || value === "") return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  try {
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
    const parsed = parseISO(datePart);
    if (isValid(parsed)) return format(parsed, "dd-MMM-yyyy");
  } catch {
    // ignore invalid parseISO
  }
  const ts = Date.parse(raw);
  if (!Number.isNaN(ts)) return format(new Date(ts), "dd-MMM-yyyy");
  return raw;
}

export const LOCK_STATUS_OPTIONS = [
  { value: "Unlock", label: "Unlock" },
  { value: "Lock", label: "Lock" },
];

export function getCashAndBankAccountLabel(row) {
  const acctId = pickField(row, "acctId", "AcctId");
  const name = pickField(row, "name", "Name");
  if (acctId && name) return `${acctId} | ${name}`;
  return name || acctId || "";
}

export function isTrCashAndBankMode(rowOrOption) {
  const mode = pickField(rowOrOption, "mode", "Mode");
  return mode.toUpperCase() === "TR";
}

export function shouldRequireInterAccTransferParticulars(form, accountById = {}) {
  const paidFrom = accountById[Number(form?.paidFromAccountId)];
  const receivedIn = accountById[Number(form?.receivedInAccountId)];
  return isTrCashAndBankMode(paidFrom) || isTrCashAndBankMode(receivedIn);
}

export function shouldShowInterAccTransferSettlementVrNo(form, accountById = {}) {
  const paidFrom = accountById[Number(form?.paidFromAccountId)];
  return isTrCashAndBankMode(paidFrom);
}

export function normalizeCashAndBankAccountOption(row) {
  const id = row?.id ?? row?.Id;
  const currency = pickField(row, "currency", "Currency");
  const coaId = row?.coaId ?? row?.CoaId ?? null;
  return {
    id: id != null ? Number(id) : null,
    coaId: coaId != null && coaId !== "" ? Number(coaId) : null,
    acctId: pickField(row, "acctId", "AcctId"),
    name: pickField(row, "name", "Name"),
    mode: pickField(row, "mode", "Mode"),
    currency,
    label: getCashAndBankAccountLabel(row),
    status: pickField(row, "status", "Status") || "Active",
  };
}

export function isActiveCashAndBankAccount(row) {
  const status = pickField(row, "status", "Status").toLowerCase();
  return !status || status === "active";
}

export async function fetchCashAndBankAccountsForDropdown() {
  const response = await cashAndBankApi.getAllUnpaged();
  const data = Array.isArray(response) ? response : response?.data ?? [];
  return (Array.isArray(data) ? data : [])
    .map(normalizeCashAndBankAccountOption)
    .filter((row) => row.id != null && isActiveCashAndBankAccount(row));
}

export function formatCurrencyAmount(currency, amount) {
  if (amount == null || amount === "") return "-";
  const n = Number(amount);
  if (!Number.isFinite(n)) return "-";
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  const code = String(currency || "").trim();
  return code ? `${code} ${formatted}` : formatted;
}

export function buildInterAccTransferFormState(overrides = {}) {
  return {
    transferDate: "",
    vrNo: "",
    description: "",
    particulars: "",
    paidFromAccountId: "",
    paidFromAmount: "",
    receivedInAccountId: "",
    receivedInAmount: "",
    settlementVrNo: "",
    tinFtn: "",
    status: "Unlock",
    ...overrides,
  };
}

export function normalizeInterAccTransferRecord(row) {
  if (!row) return buildInterAccTransferFormState();
  return buildInterAccTransferFormState({
    transferDate: row?.transferDate ?? row?.TransferDate ?? "",
    vrNo: pickField(row, "vrNo", "VrNo"),
    description: pickField(row, "description", "Description"),
    particulars: pickField(row, "particulars", "Particulars"),
    paidFromAccountId: row?.paidFromAccountId ?? row?.PaidFromAccountId ?? "",
    paidFromAmount: row?.paidFromAmount ?? row?.PaidFromAmount ?? "",
    receivedInAccountId: row?.receivedInAccountId ?? row?.ReceivedInAccountId ?? "",
    receivedInAmount: row?.receivedInAmount ?? row?.ReceivedInAmount ?? "",
    settlementVrNo: pickField(row, "settlementVrNo", "SettlementVrNo"),
    tinFtn: pickField(row, "tinFtn", "TinFtn"),
    status: pickField(row, "status", "Status") || "Unlock",
  });
}

export function normalizeInterAccTransferCurrency(currency) {
  return String(currency ?? "")
    .trim()
    .toUpperCase();
}

export function currenciesMatchInterAccTransfer(currencyA, currencyB) {
  const a = normalizeInterAccTransferCurrency(currencyA);
  const b = normalizeInterAccTransferCurrency(currencyB);
  if (!a || !b) return true;
  return a === b;
}

export function accountsAreSameInterAccTransfer(paidFromAccountId, receivedInAccountId) {
  if (paidFromAccountId === "" || paidFromAccountId == null) return false;
  if (receivedInAccountId === "" || receivedInAccountId == null) return false;
  return Number(paidFromAccountId) === Number(receivedInAccountId);
}

export function getInterAccTransferAccountPairErrors(form, accountById = {}) {
  const errors = {};
  const paidFromId = form?.paidFromAccountId;
  const receivedInId = form?.receivedInAccountId;

  if (accountsAreSameInterAccTransfer(paidFromId, receivedInId)) {
    errors.paidFromAccountId = "Paid From Account must differ from Received in Account";
    errors.receivedInAccountId = "Received in Account must differ from Paid From Account";
    return errors;
  }

  const paidFrom = accountById[Number(paidFromId)];
  const receivedIn = accountById[Number(receivedInId)];
  if (
    paidFrom?.currency &&
    receivedIn?.currency &&
    !currenciesMatchInterAccTransfer(paidFrom.currency, receivedIn.currency)
  ) {
    const message = "Both accounts must use the same currency for inter-account transfer";
    errors.paidFromAccountId = message;
    errors.receivedInAccountId = message;
  }

  return errors;
}

export function getInterAccTransferAccountConflictErrors(form, accountById = {}) {
  return getInterAccTransferAccountPairErrors(form, accountById);
}

export function filterInterAccTransferAccountOptions(
  accountOptions,
  { excludeAccountId = "", matchCurrency = "" } = {}
) {
  return (accountOptions || []).filter((opt) => {
    if (accountsAreSameInterAccTransfer(opt.id, excludeAccountId)) return false;
    if (matchCurrency && !currenciesMatchInterAccTransfer(opt.currency, matchCurrency))
      return false;
    return true;
  });
}

export function applyInterAccTransferAccountFieldChange(form, field, value, accountById = {}) {
  const next = { ...form, [field]: value };

  if (field === "paidFromAccountId") {
    const paidFrom = accountById[Number(value)];
    const receivedIn = accountById[Number(next.receivedInAccountId)];
    if (
      receivedIn?.currency &&
      paidFrom?.currency &&
      !currenciesMatchInterAccTransfer(paidFrom.currency, receivedIn.currency)
    ) {
      next.receivedInAccountId = "";
    }
    if (!isTrCashAndBankMode(paidFrom)) {
      next.settlementVrNo = "";
    }
  }

  if (field === "receivedInAccountId") {
    const receivedIn = accountById[Number(value)];
    const paidFrom = accountById[Number(next.paidFromAccountId)];
    if (
      paidFrom?.currency &&
      receivedIn?.currency &&
      !currenciesMatchInterAccTransfer(paidFrom.currency, receivedIn.currency)
    ) {
      next.paidFromAccountId = "";
    }
  }

  return next;
}

export function shouldSyncInterAccTransferReceivedInAmount(form) {
  const hasPaidFromAccount = form?.paidFromAccountId !== "" && form?.paidFromAccountId != null;
  const paidFromAmount = String(form?.paidFromAmount ?? "").trim();
  return hasPaidFromAccount && paidFromAmount !== "";
}

export function syncInterAccTransferReceivedInAmount(form) {
  if (!shouldSyncInterAccTransferReceivedInAmount(form)) return form;
  return { ...form, receivedInAmount: form.paidFromAmount };
}

export function validateInterAccTransferForm(form, accountById = {}, activeLockDate = "") {
  const errors = {};
  if (!String(form?.transferDate ?? "").trim()) errors.transferDate = "Date is required";
  else if (isDateLockedByLockDate(form?.transferDate, activeLockDate)) {
    errors.transferDate = formatTransactionLockDateValidationMessage(activeLockDate);
  }
  if (!String(form?.vrNo ?? "").trim()) errors.vrNo = "Vr No is required";
  if (form?.paidFromAccountId === "" || form?.paidFromAccountId == null) {
    errors.paidFromAccountId = "Paid From Account is required";
  }
  if (form?.receivedInAccountId === "" || form?.receivedInAccountId == null) {
    errors.receivedInAccountId = "Received in Account is required";
  }
  Object.assign(errors, getInterAccTransferAccountPairErrors(form, accountById));
  if (form?.paidFromAmount === "" || Number(form.paidFromAmount) <= 0) {
    errors.paidFromAmount = "Paid From Amount must be greater than zero";
  }
  if (form?.receivedInAmount === "" || Number(form.receivedInAmount) <= 0) {
    errors.receivedInAmount = "Received in Amount must be greater than zero";
  }
  if (shouldRequireInterAccTransferParticulars(form, accountById)) {
    if (!String(form?.particulars ?? "").trim()) {
      errors.particulars = "Particulars is required for TR mode accounts";
    }
  }
  const description = String(form?.description ?? "").trim();
  if (description.length > INTER_ACC_TRANSFER_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description cannot exceed ${INTER_ACC_TRANSFER_DESCRIPTION_MAX_LENGTH} characters`;
  }
  return errors;
}

export function buildInterAccTransferPayload(form) {
  return {
    TransferDate: form.transferDate,
    VrNo: String(form?.vrNo ?? "").trim(),
    Description: String(form?.description ?? "").trim() || null,
    Particulars: String(form?.particulars ?? "").trim() || null,
    PaidFromAccountId: Number(form.paidFromAccountId),
    SettlementVrNo: String(form?.settlementVrNo ?? "").trim() || null,
    PaidFromAmount: Number(form.paidFromAmount),
    ReceivedInAccountId: Number(form.receivedInAccountId),
    ReceivedInAmount: Number(form.receivedInAmount),
    TinFtn: String(form?.tinFtn ?? "").trim() || null,
    Status: String(form?.status ?? "Unlock").trim() || "Unlock",
  };
}

export function isTransferLocked(row) {
  return String(pickField(row, "status", "Status")).toLowerCase() === "lock";
}

export function flattenInterAccTransferForGrid(row, index) {
  const id = row?.id ?? row?.Id;
  return {
    id,
    sno: index + 1,
    transferDate: row?.transferDate ?? row?.TransferDate ?? "",
    vrNo: pickField(row, "vrNo", "VrNo") || "-",
    description: pickField(row, "description", "Description") || "-",
    particulars: pickField(row, "particulars", "Particulars") || "-",
    paidFromAccount: pickField(row, "paidFromAccountDisplay", "PaidFromAccountDisplay") || "-",
    paidFromAmount: row?.paidFromAmount ?? row?.PaidFromAmount ?? "",
    paidFromCurrency: pickField(row, "paidFromCurrency", "PaidFromCurrency"),
    settlementVrNo: pickField(row, "settlementVrNo", "SettlementVrNo") || "-",
    receivedInAccount:
      pickField(row, "receivedInAccountDisplay", "ReceivedInAccountDisplay") || "-",
    receivedInAmount: row?.receivedInAmount ?? row?.ReceivedInAmount ?? "",
    receivedInCurrency: pickField(row, "receivedInCurrency", "ReceivedInCurrency"),
    tinFtn: pickField(row, "tinFtn", "TinFtn") || "-",
    status: pickField(row, "status", "Status") || "Unlock",
  };
}

/** Map transfer record fields for the voucher PDF layout. */
export function mapInterAccTransferForVoucherPdf(transfer) {
  if (!transfer) return transfer;
  return {
    date: transfer?.transferDate ?? transfer?.TransferDate ?? "",
    vrNo: pickField(transfer, "vrNo", "VrNo"),
    paidFrom:
      pickField(transfer, "paidFromAccountDisplay", "PaidFromAccountDisplay") ||
      transfer?.paidFromAccount ||
      "",
    receivedFromAccountLabel:
      pickField(transfer, "receivedInAccountDisplay", "ReceivedInAccountDisplay") ||
      transfer?.receivedInAccount ||
      "",
    receivedInAccount:
      pickField(transfer, "receivedInAccountDisplay", "ReceivedInAccountDisplay") ||
      transfer?.receivedInAccount ||
      "",
    description: pickField(transfer, "description", "Description"),
    particulars: pickField(transfer, "particulars", "Particulars"),
    paidFromAmount: transfer?.paidFromAmount ?? transfer?.PaidFromAmount ?? 0,
    receivedInAmount: transfer?.receivedInAmount ?? transfer?.ReceivedInAmount ?? 0,
    tinFtn: pickField(transfer, "tinFtn", "TinFtn"),
  };
}
