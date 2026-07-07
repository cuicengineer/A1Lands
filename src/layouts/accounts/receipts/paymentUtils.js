import {
  formatTransactionLockDateValidationMessage,
  isDateLockedByLockDate,
} from "layouts/income-agreements/collections/collectionsUtils";
import {
  buildReceiptFormState,
  computeGrandTotal,
  createLineRow,
  findLineAccountOption,
  formatAmount,
  getRacName,
  getBaseName,
  getReceiptLineMode,
  getReceiptLineModeFromAccountOption,
  getReceiptPartyTypeLabel,
  isReceiptInvoiceMode,
  normalizeReceiptLineNumericDefaults,
  parseAmount,
  RECEIPT_LINE_MODES,
} from "layouts/accounts/receipts/receiptUtils";
import { productGoodApi, productServiceApi } from "services/api.product.service";
import {
  accountRefFromRecord,
  normalizeGoodRecord,
  normalizeServiceRecord,
  parseAccountRef,
  pickField,
} from "layouts/products/shared/productUtils";

export { RECEIPT_PARTY_TYPES as PAYMENT_PARTY_TYPES } from "layouts/accounts/receipts/receiptUtils";

export const PAYMENT_LINE_MODES = {
  TENANT_INVOICE: RECEIPT_LINE_MODES.TENANT_INVOICE,
  PARTY_INVOICE: RECEIPT_LINE_MODES.PARTY_INVOICE,
  ACCOUNT_QTY: RECEIPT_LINE_MODES.ACCOUNT_QTY,
  ITEM_BASED: RECEIPT_LINE_MODES.ITEM_BASED,
};

/** Map legacy payment party type values to receipt party type values. */
export function normalizePaymentPartyType(partyType) {
  const type = String(partyType || "").trim();
  if (type === "Customer" || type === "Supplier") return "CustomerSupplier";
  if (type === "ItemBased") return "ItemBasedRevenueExpense";
  if (type === "Other") return "RevenueExpense";
  return type;
}

export function getPaymentLineMode(partyType) {
  return getReceiptLineMode(normalizePaymentPartyType(partyType));
}

export function getPaymentPartyTypeLabel(partyType) {
  return getReceiptPartyTypeLabel(normalizePaymentPartyType(partyType));
}

export function getPaymentPartyColumnLabel(partyType) {
  const type = normalizePaymentPartyType(partyType);
  if (type === "Tenant") return "Tenant";
  if (type === "CustomerSupplier") return "Customer";
  return "Party";
}

export function isPaymentInvoiceMode(mode) {
  return mode === PAYMENT_LINE_MODES.TENANT_INVOICE || mode === PAYMENT_LINE_MODES.PARTY_INVOICE;
}

export function resolveCashAndBankAccountIdFromCoa(coaId, cashAndBankOptions) {
  if (coaId === "" || coaId == null) return null;
  const match = (cashAndBankOptions || []).find(
    (option) =>
      option?.coaId != null && option.coaId !== "" && Number(option.coaId) === Number(coaId)
  );
  return match?.id != null ? Number(match.id) : null;
}

export function resolveCashAndBankAccountIdFromSelection(value, cashAndBankOptions) {
  if (value === "" || value == null) return null;
  const directMatch = (cashAndBankOptions || []).find(
    (option) => option?.id != null && Number(option.id) === Number(value)
  );
  if (directMatch?.id != null) return Number(directMatch.id);
  return resolveCashAndBankAccountIdFromCoa(value, cashAndBankOptions);
}

export const PAYMENT_VR_NO_PREFIX = "PV";

export function getPaymentYearFromDate(dateValue) {
  const text = String(dateValue || "").trim();
  if (!text) return new Date().getFullYear();
  const match = text.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).getFullYear();
  return new Date().getFullYear();
}

export function parsePaymentVrNo(vrNo) {
  const match = String(vrNo || "")
    .trim()
    .match(/^(?:PV|TE|PY)-(\d+)\/(\d{4})$/i);
  if (!match) return null;
  const sequence = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isFinite(sequence) || !Number.isFinite(year)) return null;
  return { sequence, year };
}

export function formatPaymentVrNo(sequence, year) {
  const seq = Math.max(1, Number(sequence) || 1);
  const yr = Number(year) || new Date().getFullYear();
  return `${PAYMENT_VR_NO_PREFIX}-${seq}/${yr}`;
}

export function computeNextPaymentVrNo(existingVrNos, dateValue) {
  const year = getPaymentYearFromDate(dateValue);
  let maxSequence = 0;
  (existingVrNos || []).forEach((vrNo) => {
    const parsed = parsePaymentVrNo(vrNo);
    if (parsed && parsed.year === year) {
      maxSequence = Math.max(maxSequence, parsed.sequence);
    }
  });
  return formatPaymentVrNo(maxSequence + 1, year);
}

export async function fetchPaymentVrNos(api) {
  if (!api?.listPayments) return [];
  const response = await api.listPayments();
  const rows = Array.isArray(response) ? response : response?.data ?? [];
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.vrNo ?? row?.VrNo ?? row?.reference ?? row?.Reference ?? "").trim())
    .filter(Boolean);
}

export function buildPaymentFormState(overrides = {}) {
  return buildReceiptFormState({
    referenceAutomatic: false,
    reference: "",
    paidFrom: "",
    vrNo: "",
    cashAndBankAccountId: "",
    payeeContactType: "",
    payeePartyKey: "",
    payeePartyId: "",
    payeePartyCode: "",
    payeeName: "",
    lines: [],
    ...overrides,
  });
}

export function computePaymentLineTotal(line, mode) {
  if (mode === PAYMENT_LINE_MODES.ACCOUNT_QTY || mode === PAYMENT_LINE_MODES.ITEM_BASED) {
    const qty = parseAmount(line?.quantity);
    const unitPrice = parseAmount(line?.unitPrice);
    return qty * unitPrice;
  }
  return parseAmount(line?.amount);
}

export function syncPaymentLineAmount(line, mode) {
  if (mode === PAYMENT_LINE_MODES.ACCOUNT_QTY || mode === PAYMENT_LINE_MODES.ITEM_BASED) {
    const total = computePaymentLineTotal(line, mode);
    return {
      ...line,
      amount: total > 0 ? String(total) : "",
      total,
    };
  }
  const total = computePaymentLineTotal(line, mode);
  return { ...line, total };
}

export function computePaymentGrandTotal(lines, mode) {
  return (lines || []).reduce((sum, line) => sum + computePaymentLineTotal(line, mode), 0);
}

export function isPaymentLineComplete(line, mode) {
  if (!line) return false;
  if (mode === PAYMENT_LINE_MODES.ITEM_BASED) {
    return (
      Boolean(String(line.productKey || line.item || "").trim()) &&
      Boolean(String(line.account || "").trim()) &&
      parseAmount(line.quantity) > 0 &&
      parseAmount(line.unitPrice) > 0
    );
  }
  if (mode === PAYMENT_LINE_MODES.ACCOUNT_QTY) {
    return (
      Boolean(String(line.account || "").trim()) &&
      parseAmount(line.quantity) > 0 &&
      parseAmount(line.unitPrice) > 0
    );
  }
  return (
    Boolean(String(line.account || "").trim()) &&
    Boolean(String(line.partyKey || "").trim()) &&
    parseAmount(line.amount) > 0
  );
}

export function isPaymentSimplifiedLineComplete(line) {
  if (!line) return false;
  return Boolean(String(line.account || "").trim()) && parseAmount(line.amount) > 0;
}

export function validatePaymentForm(
  form,
  labels = {},
  lineAccountOptions = [],
  activeLockDate = ""
) {
  const errors = {};
  if (!form.date) errors.date = "Date is required";
  else if (isDateLockedByLockDate(form.date, activeLockDate)) {
    errors.date = formatTransactionLockDateValidationMessage(activeLockDate);
  }
  if (!String(form.vrNo || "").trim()) errors.vrNo = labels.vrNoRequired || "Vr No is required";
  if (!String(form.payeeName || "").trim()) {
    errors.payeeName = labels.payeeRequired || "Paid To is required";
  }
  const receivedInSelection = form.cashAndBankAccountId || form.receivedInCoaId;
  if (receivedInSelection === "" || receivedInSelection == null) {
    errors.receivedInCoaId = labels.receivedFromRequired || "Received In is required";
  } else {
    const ledgerId = resolveCashAndBankAccountIdFromSelection(
      receivedInSelection,
      form.cashAndBankOptions
    );
    if (!ledgerId) {
      errors.receivedInCoaId = "Selected account must have an active Cash & Bank ledger record.";
    }
  }

  const lines = form.lines || [];
  if (!lines.length) errors.lines = "At least one line item is required";

  lines.forEach((line, idx) => {
    if (!String(line.account || "").trim()) {
      errors[`line-${idx}-account`] = "Account is required";
      return;
    }

    const account = findLineAccountOption(lineAccountOptions, line);
    const mode = getReceiptLineModeFromAccountOption(account);

    if (mode === PAYMENT_LINE_MODES.ITEM_BASED) {
      if (!line.productKey && !line.item) errors[`line-${idx}-item`] = "Item is required";
    } else if (mode === PAYMENT_LINE_MODES.ACCOUNT_QTY) {
      if (parseAmount(line.quantity) <= 0) errors[`line-${idx}-quantity`] = "Qty is required";
      if (parseAmount(line.unitPrice) <= 0) {
        errors[`line-${idx}-unitPrice`] = "Unit Price is required";
      }
      return;
    }

    if (mode && (isPaymentInvoiceMode(mode) || isReceiptInvoiceMode(mode))) {
      if (!line.partyKey) errors[`line-${idx}-party`] = "Tenant is required";
    }

    if (parseAmount(line.amount) <= 0) {
      errors[`line-${idx}-amount`] = "Amount is required";
    }
  });

  return errors;
}

function unwrapProductList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

export async function fetchPaymentProductOptions() {
  const [serviceResult, goodResult] = await Promise.allSettled([
    productServiceApi.getAll(1, 10000),
    productGoodApi.getAll(1, 10000),
  ]);
  const services = unwrapProductList(
    serviceResult.status === "fulfilled" ? serviceResult.value : []
  )
    .map(normalizeServiceRecord)
    .filter((row) => String(row.status || "").toLowerCase() !== "inactive")
    .map((row) => ({
      value: `service:${row.id}`,
      label: [row.itemCode, row.itemName].filter(Boolean).join(" - "),
      productType: "service",
      productId: row.id,
      purchaseAccountRef: row.purchaseAccountRef,
      purchaseAccountDisplay: row.purchaseAccountDisplay,
      defaultUnitPrice: row.defaultUnitPricePurchase,
      uom: row.uom,
    }))
    .filter((row) => row.value && row.label);

  const goods = unwrapProductList(goodResult.status === "fulfilled" ? goodResult.value : [])
    .map(normalizeGoodRecord)
    .filter((row) => String(row.status || "").toLowerCase() !== "inactive")
    .map((row) => ({
      value: `good:${row.id}`,
      label: [row.itemCode, row.itemName].filter(Boolean).join(" - "),
      productType: "good",
      productId: row.id,
      purchaseAccountRef: row.purchaseAccountRef,
      purchaseAccountDisplay: row.purchaseAccountDisplay,
      defaultUnitPrice: row.defaultUnitPricePurchase,
      uom: row.uom,
    }))
    .filter((row) => row.value && row.label);

  return [...services, ...goods].sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveProductAccountOption(product, accountOptions) {
  if (!product) return null;
  const { coaId, incomeStatementId } = parseAccountRef(product.purchaseAccountRef);
  if (coaId != null && coaId > 0) {
    const match = (accountOptions || []).find(
      (option) => Number(option.coaId ?? option.id) === Number(coaId)
    );
    if (match) return match;
  }
  const display = String(product.purchaseAccountDisplay || "")
    .trim()
    .toLowerCase();
  if (display) {
    const byLabel = (accountOptions || []).find(
      (option) =>
        String(option.label || "")
          .trim()
          .toLowerCase() === display
    );
    if (byLabel) return byLabel;
  }
  if (incomeStatementId != null && incomeStatementId > 0) {
    return {
      label: product.purchaseAccountDisplay || `IS Account ${incomeStatementId}`,
      value: `is:${incomeStatementId}`,
      coaId: "",
    };
  }
  return product.purchaseAccountDisplay
    ? { label: product.purchaseAccountDisplay, value: product.purchaseAccountDisplay, coaId: "" }
    : null;
}

export function flattenPaymentForGrid(payment, index, { attachmentCount = 0 } = {}) {
  const firstLine = payment?.lines?.[0] || {};
  const partyType = payment?.receiptPartyType || payment?.payeeContactType;
  const mode = getPaymentLineMode(partyType);
  const grandTotal = computePaymentGrandTotal(payment?.lines, mode);
  return {
    id: payment.id,
    sno: index + 1,
    date: payment.date || "",
    vrNo: payment.vrNo || payment.reference || "-",
    paidTo: payment.payeeName || "-",
    receivedFrom:
      payment.receivedFromAccountLabel ||
      payment.receivedFromAccountDisplay ||
      payment.paidFrom ||
      "-",
    description: payment.description || "-",
    partyType: getPaymentPartyTypeLabel(partyType) || "-",
    account: firstLine.account || "-",
    tinFtn: firstLine.tinTrn || firstLine.tinFtn || "-",
    amount: grandTotal,
    total: grandTotal,
    racDisplay: getRacName(firstLine.racId) || "-",
    baseDisplay: getBaseName(firstLine.baseId) || "-",
    item: firstLine.item || (payment.lines?.length > 1 ? `${payment.lines.length} items` : "-"),
    attachmentCount,
    _payment: payment,
  };
}

/** Map payment header fields to the receipt voucher PDF layout. */
export function mapPaymentForVoucherPdf(payment) {
  if (!payment) return payment;
  const vrNo = String(payment.vrNo || payment.reference || "").trim();
  return {
    ...payment,
    vrNo,
    reference: vrNo,
    paidFrom: payment.payeeName || payment.paidTo || "",
    receivedFromAccountLabel:
      payment.receivedFromAccountLabel ||
      payment.receivedFromAccountDisplay ||
      payment.paidFrom ||
      "",
  };
}

export function normalizePaymentLineFromApi(line) {
  return normalizeReceiptLineNumericDefaults({
    ...createLineRow(),
    unitPrice: "",
    productKey: "",
    productType: "",
    productId: "",
    ...line,
  });
}

export { formatAmount, pickField, accountRefFromRecord };
