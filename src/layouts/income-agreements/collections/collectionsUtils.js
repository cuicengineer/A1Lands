export function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return row[keys[i]];
  }
  return "";
}

export function isActiveRecord(row) {
  const status = pickField(row, "status", "Status");
  if (status === true || status === 1 || status === "1") return true;
  return (
    String(status || "")
      .trim()
      .toLowerCase() === "active"
  );
}

export function isNotDeletedRecord(row) {
  const deleted = pickField(row, "isDeleted", "IsDeleted");
  if (deleted === true || deleted === 1 || deleted === "1") return false;
  return (
    String(deleted || "")
      .trim()
      .toLowerCase() !== "true"
  );
}

export function isNotArchivedRecord(row) {
  const archived = row?.isArchive ?? row?.IsArchive;
  if (archived === true || archived === 1 || archived === "1") return false;
  if (typeof archived === "string" && archived.trim().toLowerCase() === "true") {
    return false;
  }
  return true;
}

export function parseAmount(value) {
  const n = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
}

export function formatAmount(value) {
  const n = parseAmount(value);
  if (!n && n !== 0) return "-";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function sanitizeNumericAmountInput(value) {
  const text = String(value ?? "")
    .replace(/,/g, "")
    .trim();
  if (!text) return "";
  let hasDot = false;
  let result = "";
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch >= "0" && ch <= "9") {
      result += ch;
    } else if (ch === "." && !hasDot) {
      hasDot = true;
      result += ch;
    }
  }
  return result;
}

export function formatReceiptLineAmount(value) {
  if (value === "" || value == null || String(value).trim() === "") return "—";
  const n = parseAmount(value);
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export const TIN_TRN_MAX_LENGTH = 100;

export function normalizeTinTrn(value) {
  return String(value ?? "").slice(0, TIN_TRN_MAX_LENGTH);
}

const MONTH_SHORT = [
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

export function toDateInputValue(raw) {
  if (!raw) return "";
  const text = String(raw).trim();
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const parsed = Date.parse(text);
  if (!Number.isFinite(parsed)) return "";
  const d = new Date(parsed);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatDisplayDate(raw, { shortYear = false } = {}) {
  const datePart = toDateInputValue(raw);
  if (!datePart) return "";
  const [y, m, d] = datePart.split("-").map(Number);
  const month = MONTH_SHORT[m - 1];
  if (!month) return "";
  const year = shortYear ? String(y).slice(-2) : y;
  return `${String(d).padStart(2, "0")}-${month}-${year}`;
}

export function formatDisplayDateLong(raw) {
  const datePart = toDateInputValue(raw);
  if (!datePart) return "";
  const [y, m, d] = datePart.split("-").map(Number);
  const month = MONTH_SHORT[m - 1];
  if (!month) return "";
  return `${String(d).padStart(2, "0")} ${month} ${y}`;
}

export function formatAgreementPeriodLabel(startRaw, endRaw) {
  const start = formatDisplayDate(startRaw, { shortYear: true });
  const end = formatDisplayDate(endRaw, { shortYear: true });
  if (!start && !end) return "";
  if (start && end) return `${start} To ${end}`;
  return start || end;
}

export function formatContractNoLabel(contract) {
  return String(pickField(contract, "contractNo", "ContractNo") || "").trim();
}

export function formatAgreementLabel(contract) {
  const contractNo = formatContractNoLabel(contract);
  const period = formatAgreementPeriodLabel(
    pickField(contract, "contractStartDate", "ContractStartDate"),
    pickField(contract, "contractEndDate", "ContractEndDate")
  );
  if (!contractNo) return "";
  return period ? `${contractNo}(${period})` : contractNo;
}

export function formatInvoiceLabel(invoice) {
  const invoiceNo = String(pickField(invoice, "invoiceNo", "InvoiceNo") || "").trim();
  const contractNo = String(pickField(invoice, "contractNo", "ContractNo") || "").trim();
  const invoiceDate = formatDisplayDateLong(
    pickField(invoice, "invoiceDate", "InvoiceDate", "Cod", "cod")
  );
  if (!invoiceNo) return "";
  const head = contractNo ? `${invoiceNo}-${contractNo}` : invoiceNo;
  return invoiceDate ? `${head}(${invoiceDate})` : head;
}

export function formatTenantBusinessLabel(contract, tenant) {
  const tenantNo = String(
    pickField(contract, "tenantNo", "TenantNo") || pickField(tenant, "tenantNo", "TenantNo") || ""
  ).trim();
  const prefix = String(pickField(tenant, "prefix", "Prefix") || "").trim();
  const businessName = String(
    pickField(contract, "businessName", "BusinessName") ||
      pickField(tenant, "businessName", "BusinessName") ||
      ""
  ).trim();
  const nature = String(
    pickField(contract, "natureOfBusiness", "NatureOfBusiness") ||
      pickField(tenant, "natureOfBusiness", "NatureOfBusiness") ||
      ""
  ).trim();

  const tenantPart = [tenantNo, prefix].filter(Boolean).join("-");
  const namePart = [tenantPart, businessName].filter(Boolean).join(" ");
  if (!namePart) return "";
  return nature ? `${namePart} (${nature})` : namePart;
}

export function formatAccountLabel(coa) {
  if (!coa) return "";
  const acctId = String(pickField(coa, "acctId", "AcctId") || "").trim();
  const acctName = String(pickField(coa, "acctName", "AcctName") || "").trim();
  if (acctId && acctName) return `${acctId}-${acctName}`;
  return acctId || acctName || "";
}

export function normalizeCatalogRow(row) {
  const id = row?.id ?? row?.Id ?? row?.contractId ?? row?.ContractId;
  return {
    ...row,
    id: id != null ? Number(id) : null,
    name: pickField(row, "name", "Name", "code", "Code"),
    code: pickField(row, "code", "Code", "name", "Name"),
    status: row?.status ?? row?.Status,
    isDeleted: row?.isDeleted ?? row?.IsDeleted,
    isArchive: row?.isArchive ?? row?.IsArchive ?? false,
    cmd: row?.cmd ?? row?.Cmd,
    baseId: row?.baseId ?? row?.BaseId,
    classId: row?.classId ?? row?.ClassId,
    tenantNo: pickField(row, "tenantNo", "TenantNo"),
    prefix: pickField(row, "prefix", "Prefix"),
    businessName: pickField(row, "businessName", "BusinessName"),
    natureOfBusiness: pickField(row, "natureOfBusiness", "NatureOfBusiness"),
    coaId: row?.coaId ?? row?.CoaId ?? "",
    contractId: row?.contractId ?? row?.ContractId ?? null,
    contractNo: pickField(row, "contractNo", "ContractNo"),
    contractStartDate: pickField(row, "contractStartDate", "ContractStartDate"),
    contractEndDate: pickField(row, "contractEndDate", "ContractEndDate"),
    subInvoiceNo: pickField(row, "subInvoiceNo", "SubInvoiceNo"),
    invoiceNo: pickField(row, "invoiceNo", "InvoiceNo"),
    invoiceDate: pickField(row, "invoiceDate", "InvoiceDate", "Cod", "cod"),
    totalRent: row?.totalRent ?? row?.TotalRent ?? row?.amountReceivable ?? row?.AmountReceivable,
    amountReceivable:
      row?.amountReceivable ?? row?.AmountReceivable ?? row?.totalRent ?? row?.TotalRent,
    amountPending: row?.amountPending ?? row?.AmountPending,
    amountReceived: row?.amountReceived ?? row?.AmountReceived,
    invoiceStatus: pickField(row, "invoiceStatus", "InvoiceStatus"),
    acctId: pickField(row, "acctId", "AcctId"),
    acctName: pickField(row, "acctName", "AcctName"),
    controlAccount: pickField(row, "controlAccount", "ControlAccount"),
  };
}

export function getActiveBaseIds(bases) {
  return new Set(
    (bases || [])
      .filter((row) => isActiveRecord(row) && isNotDeletedRecord(row))
      .map((row) => Number(row.id))
      .filter((id) => Number.isFinite(id))
  );
}

export function getActiveClassOptions(classes, bases, contracts) {
  const activeBaseIds = getActiveBaseIds(bases);
  const activeClassIdsFromContracts = new Set(
    (contracts || [])
      .filter((row) => isActiveRecord(row) && isNotDeletedRecord(row))
      .filter((row) => activeBaseIds.has(Number(row.baseId ?? row.BaseId)))
      .map((row) => Number(row.classId ?? row.ClassId))
      .filter((id) => Number.isFinite(id))
  );

  return (classes || [])
    .map(normalizeCatalogRow)
    .filter((row) => row.id != null && isActiveRecord(row) && isNotDeletedRecord(row))
    .filter(
      (row) => activeClassIdsFromContracts.size === 0 || activeClassIdsFromContracts.has(row.id)
    )
    .sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

export function getAgreementsForClass(contracts, classId) {
  if (!classId) return [];
  return (contracts || [])
    .map(normalizeCatalogRow)
    .filter((row) => isActiveRecord(row) && isNotDeletedRecord(row))
    .filter((row) => Number(row.classId) === Number(classId))
    .sort((a, b) => String(a.contractNo).localeCompare(String(b.contractNo)));
}

export function isFinalizedContract(row) {
  if (!row || !isActiveRecord(row) || !isNotDeletedRecord(row)) return false;
  const approval = pickField(
    row,
    "approvalStatus",
    "ApprovalStatus",
    "ApprovedStatus",
    "approvedStatus"
  );
  return approval === true || approval === 1 || approval === "1";
}

/** Active, non-archived agreements for new collection entry. */
export function getCollectionAgreementsForClass(contracts, classId) {
  if (!classId) return [];
  return getAgreementsForClass(contracts, classId)
    .filter(isNotArchivedRecord)
    .filter((row) => formatContractNoLabel(row));
}

export function pickInvoiceIsFinalized(row) {
  if (!row) return false;
  const hasExplicitFinalizedField =
    row?.IsFinalized !== undefined ||
    row?.isFinalized !== undefined ||
    row?.IsFinalize !== undefined ||
    row?.isFinalize !== undefined;
  if (!hasExplicitFinalizedField) {
    // Catalog loaded via ContractInvoiceSchedule?isFinalized=true may omit the flag on some rows.
    return true;
  }
  const value = row?.IsFinalized ?? row?.isFinalized ?? row?.IsFinalize ?? row?.isFinalize;
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string" && value.trim().toLowerCase() === "true") return true;
  return false;
}

export function pickInvoiceIsLocked(row) {
  if (!row) return false;
  const value = row?.IsLocked ?? row?.isLocked;
  if (value === null || value === undefined || value === "" || value === false || value === 0) {
    return false;
  }
  if (value === "0") return false;
  if (value === true || value === 1 || value === "1") return true;
  if (typeof value === "string" && value.trim().toLowerCase() === "true") return true;
  const n = Number(value);
  return Number.isFinite(n) && n === 1;
}

export function isInvoiceScheduleHeaderRow(row) {
  return !String(pickField(row, "subInvoiceNo", "SubInvoiceNo") || "").trim();
}

export function resolveCollectionContractRef(contractRef) {
  if (contractRef == null) return { contractId: null, contractNo: "" };
  if (typeof contractRef === "object") {
    return {
      contractId: contractRef.id ?? contractRef.contractId ?? contractRef.ContractId ?? null,
      contractNo: String(pickField(contractRef, "contractNo", "ContractNo") || "").trim(),
    };
  }
  return { contractId: null, contractNo: String(contractRef || "").trim() };
}

export function invoiceMatchesCollectionContract(row, { contractId, contractNo }) {
  const rowContractId = row?.contractId ?? row?.ContractId;
  if (contractId != null && contractId !== "" && rowContractId != null && rowContractId !== "") {
    return Number(rowContractId) === Number(contractId);
  }
  const rowContractNo = String(pickField(row, "contractNo", "ContractNo") || "").trim();
  if (contractNo && rowContractNo) {
    return rowContractNo.toLowerCase() === contractNo.toLowerCase();
  }
  return false;
}

export function buildCollectedInvoiceKeys(entries = []) {
  const keys = new Set();
  (entries || []).forEach((entry) => {
    const directKey = String(entry?.invoiceKey || "").trim();
    if (directKey) {
      keys.add(directKey);
      return;
    }
    const key = buildInvoiceKey(entry);
    if (key) keys.add(key);
  });
  return keys;
}

export function isCollectedCollectionInvoiceKey(invoiceKey, collectedInvoiceKeys) {
  const key = String(invoiceKey || "").trim();
  if (!key) return false;
  const collected =
    collectedInvoiceKeys instanceof Set
      ? collectedInvoiceKeys
      : new Set(collectedInvoiceKeys || []);
  return collected.has(key);
}

export function findInvoiceByKey(invoices, invoiceKey) {
  const { contractNo, invoiceNo } = parseInvoiceKey(invoiceKey);
  if (!invoiceNo) return null;
  return (
    (invoices || [])
      .map(normalizeCatalogRow)
      .find(
        (row) =>
          String(row.contractNo || "").trim() === contractNo &&
          String(row.invoiceNo || "").trim() === invoiceNo
      ) || null
  );
}

/** Unlocked invoice headers for a contract (for new collection entry). */
export function getCollectionInvoicesForContract(
  invoices,
  contractRef,
  { includeInvoiceKey = "" } = {}
) {
  const { contractId, contractNo } = resolveCollectionContractRef(contractRef);
  if (contractId == null && !contractNo) return [];
  const includeKey = String(includeInvoiceKey || "").trim();
  const contractMatch = { contractId, contractNo };
  const byInvoiceKey = new Map();

  (invoices || [])
    .map(normalizeCatalogRow)
    .filter((row) => isNotDeletedRecord(row))
    .filter((row) => invoiceMatchesCollectionContract(row, contractMatch))
    .filter((row) => !pickInvoiceIsLocked(row))
    .forEach((row) => {
      const invoiceKey = buildInvoiceKey(row);
      if (!invoiceKey) return;
      if (includeKey && invoiceKey === includeKey) {
        byInvoiceKey.set(invoiceKey, row);
        return;
      }
      const existing = byInvoiceKey.get(invoiceKey);
      if (!existing) {
        byInvoiceKey.set(invoiceKey, row);
        return;
      }
      if (isInvoiceScheduleHeaderRow(row) && !isInvoiceScheduleHeaderRow(existing)) {
        byInvoiceKey.set(invoiceKey, row);
      }
    });

  return Array.from(byInvoiceKey.values()).sort((a, b) =>
    String(a.invoiceNo).localeCompare(String(b.invoiceNo))
  );
}

export function findTenantByContract(tenants, contract) {
  const tenantNo = resolveContractTenantNo(contract);
  if (!tenantNo) return null;
  return (
    (tenants || []).find(
      (row) => String(pickField(row, "tenantNo", "TenantNo")).trim() === tenantNo
    ) || null
  );
}

export function resolveContractTenantNo(contract) {
  const raw = String(pickField(contract, "tenantNo", "TenantNo") || "").trim();
  if (!raw) return "";
  const match = raw.match(/^([A-Za-z0-9-]+)/);
  return match ? match[1] : raw;
}

export function findCoaById(coaOptions, coaId) {
  if (coaId === "" || coaId == null) return null;
  return (coaOptions || []).find((row) => Number(row.id) === Number(coaId)) ?? null;
}

/** @deprecated Use findCoaById — kept for callers outside collections. */
export function findCustomerCoa(coaOptions, coaId) {
  return findCoaById(coaOptions, coaId);
}

export function isTenantsControlAccount(controlAccount) {
  return /^tenants$/i.test(String(controlAccount || "").trim());
}

export function isCustomersControlAccount(controlAccount) {
  return /^customers$/i.test(String(controlAccount || "").trim());
}

export function resolveCollectionTenantAccount(contract, tenants, coaOptions) {
  const empty = { tenantNo: "", tenantBusiness: "", coaId: "", accountLabel: "" };
  if (!contract) return empty;

  const tenant = findTenantByContract(tenants, contract);
  const tenantNo = tenant
    ? String(pickField(tenant, "tenantNo", "TenantNo") || "").trim()
    : resolveContractTenantNo(contract);
  const coaId = tenant?.coaId ?? tenant?.CoaId ?? "";
  const coa = findCoaById(coaOptions, coaId);

  return {
    tenantNo,
    tenantBusiness: formatTenantBusinessLabel(contract, tenant),
    coaId: coa?.id ?? coaId ?? "",
    accountLabel: formatAccountLabel(coa),
  };
}

export function computeInvoiceDue(invoice) {
  const receivable = parseAmount(invoice?.amountReceivable ?? invoice?.totalRent);
  return receivable;
}

export function computeInvoiceBalance(invoice) {
  const pending = invoice?.amountPending;
  if (pending != null && pending !== "") return parseAmount(pending);
  const receivable = computeInvoiceDue(invoice);
  const received = parseAmount(invoice?.amountReceived);
  return Math.max(0, receivable - received);
}

export function buildCollectionGroupKey(row) {
  const classId = row?.classId ?? row?.ClassId ?? "";
  const contractId = row?.contractId ?? row?.ContractId ?? "";
  const invoiceKey = String(row?.invoiceKey || "").trim();
  if (!classId || !contractId || !invoiceKey) return "";
  return `${classId}|${contractId}|${invoiceKey}`;
}

export function computeCollectionGroupAmounts(invoiceReceivable, items = []) {
  const receivable = parseAmount(invoiceReceivable);
  const totalPaid = sumCollectionReceiptLineAmounts(items);
  if (totalPaid < receivable) {
    return { due: receivable - totalPaid, balance: 0 };
  }
  return { due: 0, balance: totalPaid - receivable };
}

export function getValidCollectionReceiptLines(items = []) {
  return (items || []).filter((item) => {
    const date = toDateInputValue(item?.date);
    return Boolean(date) && parseAmount(item?.amount) > 0;
  });
}

export function sumCollectionReceiptLineAmounts(items = []) {
  return getValidCollectionReceiptLines(items).reduce(
    (sum, item) => sum + parseAmount(item?.amount),
    0
  );
}

export function normalizeCollectionLineAmount(value) {
  const sanitized = sanitizeNumericAmountInput(value);
  if (!sanitized) return "";
  return String(parseAmount(sanitized));
}

export function createEmptyCollectionLineItem(overrides = {}) {
  const id = `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    date: today,
    amount: "",
    tinTrn: "",
    isLocalOnly: true,
    ...overrides,
  };
}

export function createEmptyCollectionGroup(overrides = {}) {
  const groupKey = `draft-${Date.now()}`;
  return {
    groupKey,
    classId: "",
    contractId: "",
    tenantNo: "",
    tenantBusiness: "",
    accountLabel: "",
    coaId: "",
    invoiceKey: "",
    items: [],
    isDraftParent: true,
    ...overrides,
  };
}

export function groupCollectionEntries(entries = []) {
  const groups = new Map();
  (entries || []).forEach((entry) => {
    const key = buildCollectionGroupKey(entry);
    if (!key) return;
    if (!groups.has(key)) {
      groups.set(key, {
        groupKey: key,
        classId: entry.classId,
        contractId: entry.contractId,
        invoiceKey: entry.invoiceKey,
        tenantBusiness: entry.tenantBusiness,
        accountLabel: entry.accountLabel,
        coaId: entry.coaId,
        items: [],
        isDraftParent: false,
      });
    }
    const group = groups.get(key);
    group.items.push({
      id: entry.id,
      date: entry.date,
      amount: entry.amount,
      tinTrn: entry.tinTrn,
      isLocalOnly: entry.isLocalOnly,
    });
  });
  return Array.from(groups.values());
}

export function mergeCollectionGroups(groups = [], draftGroups = []) {
  const byKey = new Map();
  groups.forEach((group) => {
    if (group?.groupKey) byKey.set(group.groupKey, group);
  });
  draftGroups.forEach((group) => {
    if (group?.groupKey && !byKey.has(group.groupKey)) {
      byKey.set(group.groupKey, group);
    }
  });
  return Array.from(byKey.values());
}

export function hasUnsavedCollectionWork(draftGroups = [], entries = []) {
  if ((draftGroups || []).some((group) => group?.isDraftParent)) return true;
  if ((entries || []).some((entry) => entry?.isLocalOnly)) return true;
  return false;
}

export function buildCollectionGroupParentFields(
  group,
  { contracts, tenants, coaOptions, invoices, classes, collectedInvoiceKeys } = {}
) {
  const classRow = (classes || []).find((item) => Number(item.id) === Number(group.classId));
  const className = classRow?.name || classRow?.code || "";
  const allAgreements = getAgreementsForClass(contracts, group.classId);
  const contract = allAgreements.find((item) => Number(item.id) === Number(group.contractId));
  const tenant = findTenantByContract(tenants, contract);
  const tenantAccount = resolveCollectionTenantAccount(contract, tenants, coaOptions);
  const coa = findCoaById(
    coaOptions,
    group.coaId || tenant?.coaId || tenant?.CoaId || tenantAccount.coaId
  );
  const selectedInvoice =
    findInvoiceByKey(invoices, group.invoiceKey) ||
    (group.isDraftParent
      ? getCollectionInvoicesForContract(invoices, contract, {
          includeInvoiceKey: group.invoiceKey,
        }).find((item) => buildInvoiceKey(item) === String(group.invoiceKey || "").trim())
      : null);
  const invoiceReceivable = selectedInvoice ? computeInvoiceDue(selectedInvoice) : 0;
  const { due, balance } = computeCollectionGroupAmounts(invoiceReceivable, group.items);

  return {
    ...group,
    className,
    tenantNo: group.tenantNo || tenantAccount.tenantNo || resolveContractTenantNo(contract),
    tenantBusiness:
      group.tenantBusiness ||
      tenantAccount.tenantBusiness ||
      (contract ? formatTenantBusinessLabel(contract, tenant) : ""),
    accountLabel: group.accountLabel || tenantAccount.accountLabel || formatAccountLabel(coa),
    coaId: group.coaId || tenantAccount.coaId || coa?.id || "",
    invoiceReceivable,
    due,
    balance,
    selectedContract: contract || null,
    selectedInvoice: selectedInvoice || null,
  };
}

export function flattenCollectionGroupItems(group, amounts) {
  const { contractNo, invoiceNo } = parseInvoiceKey(group?.invoiceKey);
  return (group?.items || []).map((item) => ({
    id: item.id,
    classId: group.classId,
    contractId: group.contractId,
    tenantBusiness: group.tenantBusiness,
    accountLabel: group.accountLabel,
    coaId: group.coaId,
    invoiceKey: group.invoiceKey,
    contractNo,
    invoiceNo,
    due: amounts?.due ?? group.due ?? "",
    balance: amounts?.balance ?? group.balance ?? "",
    date: item.date,
    amount: item.amount,
    tinTrn: item.tinTrn,
    isLocalOnly: item.isLocalOnly,
    isEditing: false,
  }));
}

export function buildCollectionLinePayload(group, item, amounts) {
  const parentPayload = buildCollectionEntryPayload({
    ...group,
    date: item.date,
    amount: normalizeCollectionLineAmount(item.amount),
    tinTrn: item.tinTrn,
    due: amounts?.due ?? 0,
    balance: amounts?.balance ?? 0,
  });
  return parentPayload;
}

let nextRowId = 1;

export function createEmptyCollectionRow(overrides = {}) {
  const id = nextRowId;
  nextRowId += 1;
  const today = new Date().toISOString().slice(0, 10);
  return {
    id,
    classId: "",
    contractId: "",
    tenantBusiness: "",
    accountLabel: "",
    coaId: "",
    invoiceKey: "",
    due: "",
    balance: "",
    date: today,
    amount: "",
    tinTrn: "",
    isEditing: true,
    ...overrides,
  };
}

export function buildInvoiceKey(invoice) {
  const contractNo = String(pickField(invoice, "contractNo", "ContractNo") || "").trim();
  const invoiceNo = String(pickField(invoice, "invoiceNo", "InvoiceNo") || "").trim();
  return contractNo && invoiceNo ? `${contractNo}|${invoiceNo}` : invoiceNo;
}

export function parseInvoiceKey(invoiceKey) {
  const raw = String(invoiceKey || "").trim();
  if (!raw) return { contractNo: "", invoiceNo: "" };
  const [contractNo, invoiceNo] = raw.split("|");
  if (invoiceNo) return { contractNo: contractNo.trim(), invoiceNo: invoiceNo.trim() };
  return { contractNo: "", invoiceNo: raw };
}

export function buildAgreementProvInvoiceDeepLink(contractNo, invoiceNo) {
  const params = new URLSearchParams();
  const cn = String(contractNo || "").trim();
  const inv = String(invoiceNo || "").trim();
  if (cn) params.set("contractNo", cn);
  if (inv) params.set("invoiceNo", inv);
  const qs = params.toString();
  return qs ? `/contracts/agreement-prov-invoice?${qs}` : "/contracts/agreement-prov-invoice";
}

export function buildTenantConfigDeepLink(tenantNo) {
  const tn = String(tenantNo || "").trim();
  if (!tn) return "/configuration/tenants";
  return `/configuration/tenants?tenantNo=${encodeURIComponent(tn)}`;
}

export function openAppRouteInNewTab(path) {
  if (!path || typeof window === "undefined") return;
  const normalized = String(path).startsWith("/") ? path : `/${path}`;
  const url = `${window.location.origin}${normalized}`;
  window.open(url, "_blank", "noopener,noreferrer");
}

export function resolveCollectionInvoiceContext(row, selectedContract, invoices) {
  const parsed = parseInvoiceKey(row?.invoiceKey);
  const contractNo =
    parsed.contractNo ||
    String(pickField(selectedContract, "contractNo", "ContractNo") || "").trim() ||
    String(pickField(row, "contractNo", "ContractNo") || "").trim();
  const invoiceNo =
    parsed.invoiceNo || String(pickField(row, "invoiceNo", "InvoiceNo") || "").trim();
  const invoice =
    (invoices || []).find(
      (item) =>
        String(pickField(item, "contractNo", "ContractNo") || "").trim() === contractNo &&
        String(pickField(item, "invoiceNo", "InvoiceNo") || "").trim() === invoiceNo
    ) || null;
  return {
    contractNo,
    invoiceNo,
    label: invoice ? formatInvoiceLabel(invoice) : invoiceNo,
  };
}

export function resolveCollectionTenantNo(row, selectedContract, tenants) {
  const fromContract = String(pickField(selectedContract, "tenantNo", "TenantNo") || "").trim();
  if (fromContract) return fromContract;
  const fromRow = String(pickField(row, "tenantNo", "TenantNo") || "").trim();
  if (fromRow) return fromRow;
  const label = String(row?.tenantBusiness || "").trim();
  const match = label.match(/^([A-Za-z0-9]+)/);
  if (!match) return "";
  const candidate = match[1];
  const tenant = (tenants || []).find(
    (item) => String(pickField(item, "tenantNo", "TenantNo") || "").trim() === candidate
  );
  return tenant ? String(pickField(tenant, "tenantNo", "TenantNo") || "").trim() : candidate;
}

export function normalizeCollectionEntryRow(row) {
  const normalized = normalizeCatalogRow(row);
  return {
    ...normalized,
    id: row?.id ?? row?.Id ?? null,
    classId: row?.classId ?? row?.ClassId ?? "",
    contractId: row?.contractId ?? row?.ContractId ?? "",
    tenantBusiness: row?.tenantBusiness ?? row?.TenantBusiness ?? "",
    coaId: row?.coaId ?? row?.CoaId ?? "",
    due: row?.dueAmount ?? row?.DueAmount ?? "",
    balance: row?.balanceAmount ?? row?.BalanceAmount ?? "",
    date: toDateInputValue(row?.collectionDate ?? row?.CollectionDate),
    amount: row?.amount ?? row?.Amount ?? "",
    tinTrn: normalizeTinTrn(row?.tinTrn ?? row?.TinTrn ?? ""),
    invoiceKey: buildInvoiceKey({
      contractNo: row?.contractNo ?? row?.ContractNo ?? "",
      invoiceNo: row?.invoiceNo ?? row?.InvoiceNo ?? "",
    }),
    isEditing: false,
  };
}

export function buildCollectionEntryPayload(row) {
  const contractId =
    row?.contractId !== "" && row?.contractId != null ? Number(row.contractId) : null;
  const classId = row?.classId !== "" && row?.classId != null ? Number(row.classId) : null;
  const coaId = row?.coaId !== "" && row?.coaId != null ? Number(row.coaId) : null;
  const { contractNo, invoiceNo } = parseInvoiceKey(row?.invoiceKey);
  return {
    ClassId: classId,
    classId,
    ContractId: contractId,
    contractId,
    ContractNo: contractNo || null,
    contractNo: contractNo || null,
    TenantBusiness: String(row?.tenantBusiness || "").trim() || null,
    tenantBusiness: String(row?.tenantBusiness || "").trim() || null,
    CoaId: coaId,
    coaId,
    InvoiceNo: invoiceNo || null,
    invoiceNo: invoiceNo || null,
    DueAmount: parseAmount(row?.due),
    dueAmount: parseAmount(row?.due),
    BalanceAmount: parseAmount(row?.balance),
    balanceAmount: parseAmount(row?.balance),
    CollectionDate: toDateInputValue(row?.date) || null,
    collectionDate: toDateInputValue(row?.date) || null,
    Amount: parseAmount(row?.amount),
    amount: parseAmount(row?.amount),
    TinTrn: normalizeTinTrn(row?.tinTrn).trim() || null,
    tinTrn: normalizeTinTrn(row?.tinTrn).trim() || null,
  };
}
