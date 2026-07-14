import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import incomeStatementApi from "services/api.incomestatement.service";
import {
  buildInvoiceKey,
  computeInvoiceBalance,
  formatAgreementPeriodLabel,
  formatContractNoLabel,
  getCollectionInvoicesForContract,
  isFinalizedContract,
  isNotArchivedRecord,
  normalizeCatalogRow,
  parseAmount,
  pickField,
} from "layouts/income-agreements/collections/collectionsUtils";
import {
  createLineRow,
  formatAmount,
  formatLineAccountLabel,
  parseReceiptReference,
  RECEIPT_REFERENCE_PREFIX,
} from "layouts/accounts/receipts/receiptUtils";
import {
  isCoaGroupAssets,
  isCustomersControlAccount,
  isSupplierOrSuppliersControlAccount,
  isTenantOrTenantsControlAccount,
  normalizePartyCoaOption,
} from "utils/partyCoaUtils";
import { IS_GROUP_OPTIONS } from "services/api.incomestatement.service";

export { formatAmount, parseAmount };

export const JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH = 50;
export const JOURNAL_ENTRY_VR_NO_PREFIX = RECEIPT_REFERENCE_PREFIX;

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

export function getJournalEntryYearFromDate(dateValue) {
  const text = String(dateValue || "").trim();
  if (!text) return new Date().getFullYear();
  const match = text.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).getFullYear();
  return new Date().getFullYear();
}

export function formatJournalEntryVrNo(sequence, year) {
  const seq = Math.max(1, Number(sequence) || 1);
  const yr = Number(year) || new Date().getFullYear();
  return `${JOURNAL_ENTRY_VR_NO_PREFIX}-${seq}/${yr}`;
}

export function computeNextJournalEntryVrNo(existingVrNos, dateValue) {
  const year = getJournalEntryYearFromDate(dateValue);
  let maxSequence = 0;
  (existingVrNos || []).forEach((vrNo) => {
    const parsed = parseReceiptReference(vrNo);
    if (parsed && parsed.year === year) {
      maxSequence = Math.max(maxSequence, parsed.sequence);
    }
  });
  return formatJournalEntryVrNo(maxSequence + 1, year);
}

export async function fetchJournalEntryVrNos(api) {
  if (!api?.listJournalEntries) return [];
  const response = await api.listJournalEntries();
  const rows = unwrapList(response);
  return rows.map((row) => String(row?.vrNo ?? row?.VrNo ?? "").trim()).filter(Boolean);
}

export function createJournalEntryLineRow(overrides = {}) {
  return createLineRow({
    accountSource: "",
    accountCoaId: "",
    accountLabel: "",
    contractId: "",
    contractNo: "",
    invoiceKey: "",
    invoiceNo: "",
    invoiceLabel: "",
    quantity: "",
    unitPrice: "",
    debit: "",
    credit: "",
    ...overrides,
  });
}

export function buildJournalEntryFormState(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    vrNo: "",
    description: "",
    isLock: false,
    lines: [],
    ...overrides,
  };
}

function isBalanceSheetAssetsControlAccount(row) {
  const option = normalizePartyCoaOption(row);
  if (!isCoaGroupAssets(option.groupName)) return false;
  return Boolean(String(option.controlAccount || "").trim());
}

function normalizeIncomeStatementAccountOption(row) {
  const id = row?.id ?? row?.Id;
  if (id == null || id === "") return null;
  const acctId = pickField(row, "acctId", "AcctId");
  const acctName = pickField(row, "acctName", "AcctName");
  const groupName = pickField(row, "groupName", "GroupName") || "Income Statement";
  const subGroup = pickField(row, "subGroup", "SubGroup");
  const controlAccount = subGroup || groupName;
  const label = formatLineAccountLabel(acctId, acctName, controlAccount);
  if (!label) return null;
  return {
    id,
    coaId: String(id),
    accountSource: "is",
    acctId,
    acctName,
    controlAccount,
    groupName,
    subGroup,
    groupColor: { bg: "rgba(46, 125, 50, 0.14)", accent: "#2e7d32" },
    value: `is:${id}`,
    label,
  };
}

function normalizeBalanceSheetAccountOption(row) {
  const id = row?.id ?? row?.Id;
  if (id == null || id === "") return null;
  const option = normalizePartyCoaOption(row);
  const label = formatLineAccountLabel(option.acctId, option.acctName, option.controlAccount);
  if (!label) return null;
  return {
    id,
    coaId: String(id),
    accountSource: "coa",
    acctId: option.acctId,
    acctName: option.acctName,
    controlAccount: option.controlAccount,
    groupName: option.groupName,
    groupColor: { bg: "rgba(25, 118, 210, 0.14)", accent: "#1976d2" },
    value: `coa:${id}`,
    label,
  };
}

export async function fetchJournalEntryAccountOptions() {
  const [coaResponse, incomeResponse] = await Promise.all([
    chartOfAccountsApi.getAll(COA_SECTION_TYPE),
    incomeStatementApi.getAll(),
  ]);

  const balanceSheetOptions = (chartOfAccountsApi.unwrapList(coaResponse) || [])
    .filter(isBalanceSheetAssetsControlAccount)
    .map(normalizeBalanceSheetAccountOption)
    .filter(Boolean);

  const incomeOptions = (incomeStatementApi.unwrapList(incomeResponse) || [])
    .map(normalizeIncomeStatementAccountOption)
    .filter(Boolean);

  return [...balanceSheetOptions, ...incomeOptions].sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" })
  );
}

export function findJournalEntryAccountOption(options, line) {
  const accountValue = String(
    line?.accountSource && line?.accountCoaId
      ? `${line.accountSource}:${line.accountCoaId}`
      : line?.accountCoaId || line?.account || ""
  ).trim();
  if (!accountValue) return null;
  return (
    (options || []).find(
      (option) =>
        String(option.value) === accountValue ||
        String(option.coaId) === accountValue ||
        String(option.label) === accountValue
    ) || null
  );
}

export function getJournalEntryPartyType(accountOption) {
  const control = String(accountOption?.controlAccount || "").trim();
  if (isTenantOrTenantsControlAccount(control)) return "Tenant";
  if (isCustomersControlAccount(control)) return "Customer";
  if (isSupplierOrSuppliersControlAccount(control)) return "Supplier";
  return "";
}

export function isJournalEntryPartyControlAccount(accountOption) {
  return Boolean(getJournalEntryPartyType(accountOption));
}

export function isJournalEntryRevenueOrExpenseAccount(accountOption) {
  if (!accountOption || accountOption.accountSource !== "is") return false;
  const group = String(accountOption.groupName || "")
    .trim()
    .toLowerCase();
  return IS_GROUP_OPTIONS.some((name) => name.toLowerCase() === group);
}

export function getJournalEntryLineMode(accountOption) {
  if (!accountOption) return "simple";
  if (isJournalEntryPartyControlAccount(accountOption)) return "party";
  if (isJournalEntryRevenueOrExpenseAccount(accountOption)) return "revenueExpense";
  return "simple";
}

function formatJournalEntryContractLabel(contract, tenants) {
  const contractNo = formatContractNoLabel(contract);
  const period = formatAgreementPeriodLabel(
    pickField(contract, "contractStartDate", "ContractStartDate"),
    pickField(contract, "contractEndDate", "ContractEndDate")
  );
  const tenant = (tenants || []).find(
    (row) =>
      String(pickField(row, "tenantNo", "TenantNo")).trim() ===
      String(pickField(contract, "tenantNo", "TenantNo")).trim()
  );
  const tenantName =
    pickField(contract, "businessName", "BusinessName") ||
    pickField(tenant, "businessName", "BusinessName") ||
    pickField(tenant, "ownerName", "OwnerName");
  const parts = [tenantName, contractNo, period].filter(Boolean);
  return parts.join(" — ");
}

function partyMatchesAccountCoa(party, accountOption) {
  const accountCoaId = Number(accountOption?.coaId ?? accountOption?.id);
  if (!Number.isFinite(accountCoaId)) return false;
  const partyCoaId = Number(party?.coaId ?? party?.CoaId);
  return Number.isFinite(partyCoaId) && partyCoaId === accountCoaId;
}

export function buildJournalEntryContractOptions({
  contracts = [],
  tenants = [],
  customers = [],
  suppliers = [],
  lineAccount,
}) {
  if (!lineAccount || !isJournalEntryPartyControlAccount(lineAccount)) return [];

  const partyType = getJournalEntryPartyType(lineAccount);
  const activeContracts = (contracts || [])
    .map(normalizeCatalogRow)
    .filter(isFinalizedContract)
    .filter(isNotArchivedRecord);

  if (partyType === "Tenant") {
    const matchingTenants = (tenants || []).filter((tenant) =>
      partyMatchesAccountCoa(tenant, lineAccount)
    );
    const tenantNos = new Set(
      matchingTenants
        .map((tenant) => String(pickField(tenant, "tenantNo", "TenantNo")).trim().toLowerCase())
        .filter(Boolean)
    );
    return activeContracts
      .filter((contract) =>
        tenantNos.has(String(pickField(contract, "tenantNo", "TenantNo")).trim().toLowerCase())
      )
      .map((contract) => ({
        value: String(contract.id),
        label: formatJournalEntryContractLabel(contract, tenants),
        contractId: contract.id,
        contractNo: formatContractNoLabel(contract),
      }))
      .filter((option) => option.label)
      .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
  }

  const parties =
    partyType === "Customer" ? customers || [] : partyType === "Supplier" ? suppliers || [] : [];

  const matchingParties = parties.filter((party) => partyMatchesAccountCoa(party, lineAccount));
  if (!matchingParties.length) return [];

  const partyCodes = new Set(
    matchingParties
      .map((party) =>
        String(
          pickField(
            party,
            "code",
            "Code",
            "customerCode",
            "CustomerCode",
            "supplierCode",
            "SupplierCode"
          )
        )
          .trim()
          .toLowerCase()
      )
      .filter(Boolean)
  );

  return activeContracts
    .filter((contract) => {
      const tenantNo = String(pickField(contract, "tenantNo", "TenantNo")).trim().toLowerCase();
      const businessName = String(pickField(contract, "businessName", "BusinessName"))
        .trim()
        .toLowerCase();
      return (
        partyCodes.has(tenantNo) || [...partyCodes].some((code) => businessName.includes(code))
      );
    })
    .map((contract) => ({
      value: String(contract.id),
      label: formatJournalEntryContractLabel(contract, tenants),
      contractId: contract.id,
      contractNo: formatContractNoLabel(contract),
    }))
    .filter((option) => option.label)
    .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
}

export function formatJournalEntryInvoiceDropdownLabel(invoice) {
  const invoiceNo = String(pickField(invoice, "invoiceNo", "InvoiceNo") || "").trim();
  if (!invoiceNo) return "";
  const dueDate = pickField(invoice, "dueDate", "DueDate");
  const amount = parseAmount(
    pickField(
      invoice,
      "invoiceAmount",
      "InvoiceAmount",
      "amount",
      "Amount",
      "dueAmount",
      "DueAmount"
    )
  );
  const balance = computeInvoiceBalance(invoice);
  const parts = [];
  if (dueDate) parts.push(`Due: ${dueDate}`);
  if (amount > 0) parts.push(`Amt: ${formatAmount(amount)}`);
  parts.push(`Bal: ${formatAmount(balance)}`);
  return `${invoiceNo} — ${parts.join(", ")}`;
}

export function buildJournalEntryInvoiceOptions(
  invoices,
  contractRef,
  { includeInvoiceKey = "" } = {}
) {
  return getCollectionInvoicesForContract(invoices, contractRef, { includeInvoiceKey })
    .map((invoice) => {
      const invoiceKey = buildInvoiceKey(invoice);
      const invoiceNo = pickField(invoice, "invoiceNo", "InvoiceNo");
      return {
        value: invoiceKey || invoiceNo,
        label: formatJournalEntryInvoiceDropdownLabel(invoice),
        invoiceKey,
        invoiceNo,
      };
    })
    .filter((option) => option.value && option.label);
}

export function computeJournalEntryLineTotals(lines) {
  let totalDebit = 0;
  let totalCredit = 0;
  (lines || []).forEach((line) => {
    totalDebit += parseAmount(line?.debit);
    totalCredit += parseAmount(line?.credit);
  });
  return { totalDebit, totalCredit };
}

export function isJournalEntryLineComplete(line, accountOptions) {
  const account = findJournalEntryAccountOption(accountOptions, line);
  if (!account) return false;
  const mode = getJournalEntryLineMode(account);
  const debit = parseAmount(line?.debit);
  const credit = parseAmount(line?.credit);
  if (debit <= 0 && credit <= 0) return false;
  if (debit > 0 && credit > 0) return false;
  if (mode === "party") {
    if (!String(line?.contractId || line?.contractNo || "").trim()) return false;
    if (!String(line?.invoiceKey || line?.invoiceNo || "").trim()) return false;
  }
  if (mode === "revenueExpense") {
    if (parseAmount(line?.quantity) <= 0) return false;
    if (parseAmount(line?.unitPrice) <= 0) return false;
  }
  return true;
}

export function validateJournalEntryForm(form, accountOptions) {
  const errors = {};
  if (!String(form?.date || "").trim()) errors.date = "Date is required";
  if (!String(form?.vrNo || "").trim()) errors.vrNo = "Vr No is required";
  if (String(form?.description || "").trim().length > JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH) {
    errors.description = `Description cannot exceed ${JOURNAL_ENTRY_DESCRIPTION_MAX_LENGTH} characters`;
  }

  const lines = Array.isArray(form?.lines) ? form.lines : [];
  if (!lines.length) {
    errors.lines = "At least one line item is required";
    return errors;
  }

  lines.forEach((line, index) => {
    const account = findJournalEntryAccountOption(accountOptions, line);
    if (!account) {
      errors[`line-${index}-account`] = "Account is required";
      return;
    }
    const mode = getJournalEntryLineMode(account);
    const debit = parseAmount(line?.debit);
    const credit = parseAmount(line?.credit);
    if (debit <= 0 && credit <= 0) {
      errors[`line-${index}-amount`] = "Enter debit or credit";
    } else if (debit > 0 && credit > 0) {
      errors[`line-${index}-amount`] = "Enter either debit or credit, not both";
    }
    if (mode === "party") {
      if (!String(line?.contractId || "").trim()) {
        errors[`line-${index}-contract`] = "Contract is required";
      }
      if (!String(line?.invoiceKey || line?.invoiceNo || "").trim()) {
        errors[`line-${index}-invoice`] = "Invoice is required";
      }
    }
    if (mode === "revenueExpense") {
      if (parseAmount(line?.quantity) <= 0) {
        errors[`line-${index}-quantity`] = "Qty must be greater than 0";
      }
      if (parseAmount(line?.unitPrice) <= 0) {
        errors[`line-${index}-unitPrice`] = "Unit price is required";
      }
    }
  });

  const { totalDebit, totalCredit } = computeJournalEntryLineTotals(lines);
  if (totalDebit <= 0) {
    errors.totals = "Total debit must be greater than zero";
  } else if (Math.round(totalDebit * 100) !== Math.round(totalCredit * 100)) {
    errors.totals = "Total debit must equal total credit";
  }

  return errors;
}

function parseJsonArray(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function resolveJournalEntryLinesFromRow(row) {
  const embedded =
    row?.lines ??
    row?.Lines ??
    row?.journalEntryLines ??
    row?.JournalEntryLines ??
    row?.journalEntriesLines ??
    row?.JournalEntriesLines;
  if (Array.isArray(embedded) && embedded.length) return embedded;
  return parseJsonArray(row?.linesJson ?? row?.LinesJson);
}

function mapJournalEntryLineToApi(line, index) {
  const debit = parseAmount(line?.debit);
  const credit = parseAmount(line?.credit);
  const quantity = parseAmount(line?.quantity);
  const unitPrice = parseAmount(line?.unitPrice);
  return {
    LineNo: index + 1,
    AccountSource: String(line?.accountSource || "").trim() || null,
    AccountCoaId: String(line?.accountCoaId || "").trim() || null,
    AccountLabel: String(line?.accountLabel || "").trim() || null,
    ContractId: String(line?.contractId || "").trim() || null,
    ContractNo: String(line?.contractNo || "").trim() || null,
    InvoiceKey: String(line?.invoiceKey || "").trim() || null,
    InvoiceNo: String(line?.invoiceNo || "").trim() || null,
    InvoiceLabel: String(line?.invoiceLabel || "").trim() || null,
    Quantity: quantity > 0 ? quantity : null,
    UnitPrice: unitPrice > 0 ? unitPrice : null,
    Debit: debit,
    Credit: credit,
  };
}

export function normalizeJournalEntryLineFromApi(line) {
  if (!line || typeof line !== "object") return createJournalEntryLineRow();
  return createJournalEntryLineRow({
    ...line,
    id:
      line.id ||
      line.Id ||
      `line-${line.lineNo ?? line.LineNo ?? Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    accountSource: line.accountSource || line.AccountSource || "",
    accountCoaId: String(line.accountCoaId ?? line.AccountCoaId ?? ""),
    accountLabel: line.accountLabel || line.AccountLabel || "",
    contractId: String(line.contractId ?? line.ContractId ?? ""),
    contractNo: line.contractNo || line.ContractNo || "",
    invoiceKey: line.invoiceKey || line.InvoiceKey || "",
    invoiceNo: line.invoiceNo || line.InvoiceNo || "",
    invoiceLabel: line.invoiceLabel || line.InvoiceLabel || "",
    quantity: line.quantity ?? line.Quantity ?? "",
    unitPrice: line.unitPrice ?? line.UnitPrice ?? "",
    debit: line.debit ?? line.Debit ?? "",
    credit: line.credit ?? line.Credit ?? "",
  });
}

export function normalizeJournalEntryRecord(row) {
  if (!row) return buildJournalEntryFormState();
  const id = row?.id ?? row?.Id ?? null;
  const dateRaw = row?.date ?? row?.Date ?? row?.entryDate ?? row?.EntryDate ?? "";
  const dateText = String(dateRaw || "").trim();
  const date = /^\d{4}-\d{2}-\d{2}/.test(dateText) ? dateText.slice(0, 10) : dateText;
  return {
    id,
    date,
    vrNo: String(row?.vrNo ?? row?.VrNo ?? "").trim(),
    description: String(row?.description ?? row?.Description ?? "").trim(),
    totalDebit: row?.totalDebit ?? row?.TotalDebit ?? 0,
    totalCredit: row?.totalCredit ?? row?.TotalCredit ?? 0,
    isLock: toBooleanFlag(row?.isLock ?? row?.IsLock),
    lines: resolveJournalEntryLinesFromRow(row).map(normalizeJournalEntryLineFromApi),
  };
}

function toBooleanFlag(value) {
  if (value === true || value === 1 || value === "1") return true;
  const lower = String(value ?? "")
    .trim()
    .toLowerCase();
  return lower === "true" || lower === "yes";
}

export function isJournalEntryLocked(row) {
  return toBooleanFlag(row?.isLock ?? row?.IsLock);
}

export function buildJournalEntryApiPayload(form) {
  const { totalDebit, totalCredit } = computeJournalEntryLineTotals(form.lines);
  return {
    EntryDate: form.date,
    VrNo: form.vrNo,
    Description: String(form.description || "").trim() || null,
    TotalDebit: totalDebit,
    TotalCredit: totalCredit,
    IsLock: Boolean(form?.isLock),
    Lines: (form.lines || []).map(mapJournalEntryLineToApi),
  };
}

export function flattenJournalEntryForGrid(row, index) {
  const normalized = normalizeJournalEntryRecord(row);
  const firstLineAccount = normalized.lines[0]?.accountLabel || normalized.lines[0]?.account || "";
  return {
    id: normalized.id,
    sno: index + 1,
    date: normalized.date,
    vrNo: normalized.vrNo,
    description: normalized.description || "-",
    accountSummary: firstLineAccount || "-",
    totalDebit: normalized.totalDebit,
    totalCredit: normalized.totalCredit,
    totalDebitDisplay: formatAmount(normalized.totalDebit),
    totalCreditDisplay: formatAmount(normalized.totalCredit),
    isLock: normalized.isLock,
  };
}

export function toJournalEntryInputDate(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return "";
  const d = new Date(parsed);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

export function formatJournalEntryDisplayDate(value) {
  const text = toJournalEntryInputDate(value);
  if (!text) return "-";
  const [year, month, day] = text.split("-");
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const monthLabel = months[Number(month) - 1] || month;
  return `${day}-${monthLabel}-${year}`;
}

export function buildJournalEntryCopyState(record) {
  const normalized = normalizeJournalEntryRecord(record);
  return buildJournalEntryFormState({
    date: normalized.date,
    vrNo: "",
    description: normalized.description,
    lines: (normalized.lines || []).map((line) =>
      createJournalEntryLineRow({
        ...line,
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      })
    ),
  });
}

export function formatJournalEntryLineReference(line) {
  const parts = [];
  const contractNo = String(line?.contractNo ?? "").trim();
  const invoice = String(line?.invoiceNo ?? line?.invoiceLabel ?? "").trim();
  const qty = String(line?.quantity ?? "").trim();
  const unitPrice = line?.unitPrice;
  if (contractNo) parts.push(`Contract ${contractNo}`);
  if (invoice) parts.push(`Invoice ${invoice}`);
  if (qty) parts.push(`Qty ${qty}`);
  if (unitPrice !== "" && unitPrice != null) parts.push(`Rate ${formatAmount(unitPrice)}`);
  return parts.join(" · ") || "";
}

/** Concatenate all non-amount line fields for the PDF Particulars column. */
export function formatJournalEntryLineParticulars(line) {
  const account = String(line?.accountLabel || line?.account || "").trim();
  const reference = formatJournalEntryLineReference(line);
  const parts = [account, reference].filter(Boolean);
  return parts.join(" · ") || "—";
}

/** Map journal entry fields for the voucher PDF layout. */
export function mapJournalEntryForVoucherPdf(record) {
  const normalized = normalizeJournalEntryRecord(record);
  if (!normalized?.vrNo && !normalized?.date && !(normalized?.lines || []).length) {
    return null;
  }
  const { totalDebit, totalCredit } = computeJournalEntryLineTotals(normalized.lines);
  return {
    date: normalized.date,
    vrNo: normalized.vrNo,
    description: normalized.description,
    lines: (normalized.lines || []).map((line) => ({
      particulars: formatJournalEntryLineParticulars(line),
      debit: line.debit ?? "",
      credit: line.credit ?? "",
    })),
    totalDebit,
    totalCredit,
  };
}
