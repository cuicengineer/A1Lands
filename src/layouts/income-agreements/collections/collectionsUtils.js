import {
  isCustomersControlAccount,
  isSupplierOrSuppliersControlAccount,
  isTenantOrTenantsControlAccount,
} from "utils/partyCoaUtils";

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
  if (n !== 0 && !n) return "-";
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

export function unwrapLockDateConfigList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (response && typeof response === "object") return [response];
  return [];
}

export function pickActiveLockDateYyyyMmDd(lockDateRows) {
  const rows = lockDateRows || [];
  const active =
    rows.find((r) => r?.IsActive === true || r?.IsActive === 1 || r?.isActive === true) || rows[0];
  if (!active) return "";
  const raw =
    active?.LockingDate ?? active?.lockingDate ?? active?.LockDate ?? active?.lockDate ?? "";
  return toDateInputValue(raw);
}

/** Receipt line date must be strictly after the configured lock date. */
export function isCollectionReceiptDateAfterLockDate(receiptDate, lockDateYyyyMmDd) {
  const lockStr = String(lockDateYyyyMmDd || "").trim();
  if (!lockStr) return true;
  const lineStr = toDateInputValue(receiptDate);
  if (!lineStr) return false;
  const lockTs = Date.parse(lockStr);
  const lineTs = Date.parse(lineStr);
  if (!Number.isFinite(lockTs) || !Number.isFinite(lineTs)) return true;
  return lineTs > lockTs;
}

/** True when date is on or before the configured lock date. */
export function isDateLockedByLockDate(date, lockDateYyyyMmDd) {
  const dateStr = toDateInputValue(date);
  if (!dateStr) return false;
  const lockStr = String(lockDateYyyyMmDd || "").trim();
  if (!lockStr) return false;
  return !isCollectionReceiptDateAfterLockDate(date, lockDateYyyyMmDd);
}

export function formatCollectionLockDateValidationMessage(lockDateYyyyMmDd) {
  const formatted = formatDisplayDate(lockDateYyyyMmDd);
  return formatted
    ? `Receipt date must be after the lock date (${formatted}).`
    : "Receipt date must be after the lock date.";
}

export function formatTransactionLockDateValidationMessage(lockDateYyyyMmDd) {
  const formatted = formatDisplayDate(lockDateYyyyMmDd);
  return formatted
    ? `Date must be after the lock date (${formatted}).`
    : "Date must be after the lock date.";
}

export function isCollectionRowLockedByVrDate(row, lockDateYyyyMmDd) {
  const vrDate = pickField(row, "vrDate", "VrDate");
  if (!String(vrDate || "").trim()) return false;
  return isDateLockedByLockDate(vrDate, lockDateYyyyMmDd);
}

export function formatCollectionVrDateLockMessage(lockDateYyyyMmDd) {
  const formatted = formatDisplayDate(lockDateYyyyMmDd);
  return formatted
    ? `This record cannot be edited because Vr Date is on or before the lock date (${formatted}).`
    : "This record cannot be edited because Vr Date is on or before the lock date.";
}

export function getMinCollectionReceiptDateAfterLock(lockDateYyyyMmDd) {
  const lockStr = String(lockDateYyyyMmDd || "").trim();
  if (!lockStr) return "";
  const lockTs = Date.parse(lockStr);
  if (!Number.isFinite(lockTs)) return "";
  const next = new Date(lockTs);
  next.setDate(next.getDate() + 1);
  const y = next.getFullYear();
  const m = String(next.getMonth() + 1).padStart(2, "0");
  const day = String(next.getDate()).padStart(2, "0");
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

/** Collection entry invoice dropdown: invoice no and Due date (no Gen date). */
export function formatCollectionInvoiceDropdownLabel(invoice) {
  const invoiceNo = String(pickField(invoice, "invoiceNo", "InvoiceNo") || "").trim();
  if (!invoiceNo) return "";
  const dueDate = formatDisplayDateLong(pickField(invoice, "dueDate", "DueDate"));
  return dueDate ? `${invoiceNo} (Due: ${dueDate})` : invoiceNo;
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
    coaId2: row?.coaId2 ?? row?.CoaId2 ?? "",
    contractId: row?.contractId ?? row?.ContractId ?? null,
    contractNo: pickField(row, "contractNo", "ContractNo"),
    contractStartDate: pickField(row, "contractStartDate", "ContractStartDate"),
    contractEndDate: pickField(row, "contractEndDate", "ContractEndDate"),
    subInvoiceNo: pickField(row, "subInvoiceNo", "SubInvoiceNo"),
    invoiceNo: pickField(row, "invoiceNo", "InvoiceNo"),
    invoiceDate: pickField(row, "invoiceDate", "InvoiceDate", "Cod", "cod"),
    dueDate: pickField(row, "dueDate", "DueDate"),
    periodStart: pickField(row, "periodStart", "PeriodStart"),
    createdAt: pickField(row, "createdAt", "CreatedAt"),
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
  const sourceRows = classId
    ? getAgreementsForClass(contracts, classId)
    : (contracts || [])
        .map(normalizeCatalogRow)
        .filter((row) => isActiveRecord(row) && isNotDeletedRecord(row));
  return sourceRows.filter(isNotArchivedRecord).filter((row) => formatContractNoLabel(row));
}

/** Unlocked finalized invoice headers available for collection entry (all contracts). */
export function getCollectionInvoiceOptions(invoices, { includeInvoiceKey = "" } = {}) {
  const includeKey = String(includeInvoiceKey || "").trim();
  const byInvoiceKey = new Map();

  (invoices || [])
    .map(normalizeCatalogRow)
    .filter((row) => isNotDeletedRecord(row))
    .filter((row) => !pickInvoiceIsLocked(row))
    .filter((row) => {
      const invoiceKey = buildInvoiceKey(row);
      if (includeKey && invoiceKey === includeKey) return true;
      return pickInvoiceIsExplicitlyFinalized(row);
    })
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

/** Active tenants for collection entry, optionally filtered by receipt account (coaId). */
function getCollectionPartyTypeForAccount(coa) {
  if (isCustomersControlAccount(coa?.controlAccount)) return "Customer";
  if (isSupplierOrSuppliersControlAccount(coa?.controlAccount)) return "Supplier";
  if (isTenantOrTenantsControlAccount(coa?.controlAccount)) return "Tenant";
  return "Tenant";
}

function getCollectionPartyReceiptCoaId(row, partyType) {
  if (partyType === "Supplier") {
    return row?.coaId2 ?? row?.CoaId2 ?? row?.coaId ?? row?.CoaId ?? "";
  }
  return row?.coaId ?? row?.CoaId ?? "";
}

export function normalizeCollectionPartyOption(row, partyType = "Tenant") {
  const normalized = normalizeCatalogRow(row);
  const isTenant = partyType === "Tenant";
  const tenantNo = isTenant ? normalized.tenantNo : normalized.code;
  return {
    ...normalized,
    tenantNo,
    partyType,
    coaId: getCollectionPartyReceiptCoaId(normalized, partyType),
    coaId2: normalized.coaId2 ?? normalized.CoaId2 ?? "",
  };
}

export function formatCollectionPartyDropdownLabel(party) {
  if (!party) return "";
  if (party.partyType === "Tenant" || (!party.partyType && party.tenantNo)) {
    return formatTenantBusinessLabel(null, party);
  }
  const code = String(party.tenantNo || party.code || "").trim();
  const name = String(party.name || "").trim();
  if (code && name) return `${code} - ${name}`;
  return code || name || "";
}

export function getCollectionTenantOptionsForAccount(
  tenants,
  coaId,
  { includeTenantNo = "", customers = [], suppliers = [], coaOptions = [] } = {}
) {
  const accountId = coaId !== "" && coaId != null ? Number(coaId) : null;
  if (!Number.isFinite(accountId)) return [];

  const coa = findCoaById(coaOptions, accountId);
  const partyType = getCollectionPartyTypeForAccount(coa);
  const catalog =
    partyType === "Customer" ? customers : partyType === "Supplier" ? suppliers : tenants;

  const includeTn = String(includeTenantNo || "")
    .trim()
    .toLowerCase();

  return (catalog || [])
    .map((row) => normalizeCollectionPartyOption(row, partyType))
    .filter((row) => isActiveRecord(row) && isNotDeletedRecord(row))
    .filter((row) => String(row.tenantNo || "").trim())
    .filter((row) => {
      const receiptCoaId = row?.coaId;
      const payableCoaId = row?.coaId2 ?? row?.CoaId2;
      const matchesAccount =
        (receiptCoaId !== "" && receiptCoaId != null && Number(receiptCoaId) === accountId) ||
        (payableCoaId !== "" && payableCoaId != null && Number(payableCoaId) === accountId);
      const isIncluded =
        includeTn &&
        String(row.tenantNo || "")
          .trim()
          .toLowerCase() === includeTn;
      return matchesAccount || isIncluded;
    })
    .map((row) => {
      const payableCoaId = row?.coaId2 ?? row?.CoaId2;
      if (
        payableCoaId !== "" &&
        payableCoaId != null &&
        Number(payableCoaId) === accountId &&
        Number(row.coaId) !== accountId
      ) {
        return { ...row, coaId: payableCoaId };
      }
      return row;
    })
    .sort((a, b) =>
      formatCollectionPartyDropdownLabel(a).localeCompare(formatCollectionPartyDropdownLabel(b))
    );
}

/** All active tenants for collection entry tenant dropdown. */
export function getCollectionTenantOptions(tenants) {
  return (tenants || [])
    .map(normalizeCatalogRow)
    .filter((row) => isActiveRecord(row) && isNotDeletedRecord(row))
    .filter((row) => String(row.tenantNo || "").trim())
    .sort((a, b) =>
      formatTenantBusinessLabel(null, a).localeCompare(formatTenantBusinessLabel(null, b))
    );
}

export function resolveCollectionTenantSelection(tenantRow, coaOptions) {
  if (!tenantRow) {
    return { tenantNo: "", tenantBusiness: "", coaId: "", accountLabel: "" };
  }
  const tenant = normalizeCollectionPartyOption(tenantRow, tenantRow.partyType || "Tenant");
  const coa = findCoaById(coaOptions, tenant.coaId);
  return {
    tenantNo: String(tenant.tenantNo || "").trim(),
    tenantBusiness: formatCollectionPartyDropdownLabel(tenant),
    coaId: coa?.id ?? tenant.coaId ?? "",
    accountLabel: formatAccountLabel(coa),
  };
}

export function findCollectionPartyOption(
  { tenants = [], customers = [], suppliers = [] } = {},
  partyNo,
  coaId,
  coaOptions = []
) {
  const tn = String(partyNo || "").trim();
  if (!tn) return null;

  if (coaId !== "" && coaId != null) {
    const match = getCollectionTenantOptionsForAccount(tenants, coaId, {
      includeTenantNo: tn,
      customers,
      suppliers,
      coaOptions,
    }).find(
      (row) =>
        String(row.tenantNo || "")
          .trim()
          .toLowerCase() === tn.toLowerCase()
    );
    if (match) return match;
  }

  const catalogs = [
    [tenants, "Tenant"],
    [customers, "Customer"],
    [suppliers, "Supplier"],
  ];
  for (let i = 0; i < catalogs.length; i += 1) {
    const [catalog, partyType] = catalogs[i];
    const match = (catalog || [])
      .map((row) => normalizeCollectionPartyOption(row, partyType))
      .find(
        (row) =>
          String(row.tenantNo || "")
            .trim()
            .toLowerCase() === tn.toLowerCase()
      );
    if (match) return match;
  }

  return findCollectionTenantOption(tenants, partyNo);
}

export function findCollectionTenantOption(tenants, tenantNo) {
  const tn = String(tenantNo || "").trim();
  if (!tn) return null;
  return (
    getCollectionTenantOptions(tenants).find(
      (row) =>
        String(row.tenantNo || "")
          .trim()
          .toLowerCase() === tn.toLowerCase()
    ) || null
  );
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

/** Strict finalized check for collection invoice dropdowns (full schedule catalog). */
export function pickInvoiceIsExplicitlyFinalized(row) {
  if (!row) return false;
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

/** Unlocked finalized invoice headers for a contract (for new collection entry). */
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
    .filter((row) => {
      const invoiceKey = buildInvoiceKey(row);
      if (includeKey && invoiceKey === includeKey) return true;
      return pickInvoiceIsExplicitlyFinalized(row);
    })
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

/** Unlocked finalized invoices for any contract belonging to the tenant (when no agreement is selected). */
export function getCollectionInvoicesForTenant(
  invoices,
  contracts,
  tenantNo,
  { includeInvoiceKey = "" } = {}
) {
  const tn = String(tenantNo || "").trim();
  if (!tn) return [];
  const tenantContractNos = new Set(
    (contracts || [])
      .map(normalizeCatalogRow)
      .filter((row) => isActiveRecord(row) && isNotDeletedRecord(row))
      .filter((row) => String(pickField(row, "tenantNo", "TenantNo") || "").trim() === tn)
      .map((row) => String(pickField(row, "contractNo", "ContractNo") || "").trim())
      .filter(Boolean)
  );
  const includeKey = String(includeInvoiceKey || "").trim();
  const byInvoiceKey = new Map();

  (invoices || [])
    .map(normalizeCatalogRow)
    .filter((row) => isNotDeletedRecord(row))
    .filter((row) => !pickInvoiceIsLocked(row))
    .filter((row) => tenantContractNos.has(String(row.contractNo || "").trim()))
    .filter((row) => {
      const invoiceKey = buildInvoiceKey(row);
      if (includeKey && invoiceKey === includeKey) return true;
      return pickInvoiceIsExplicitlyFinalized(row);
    })
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
  const exact =
    (tenants || []).find(
      (row) => String(pickField(row, "tenantNo", "TenantNo")).trim() === tenantNo
    ) || null;
  if (exact) return exact;

  const matchKey = normalizeTenantNoMatchKey(tenantNo);
  if (!matchKey) return null;
  return (
    (tenants || []).find(
      (row) => normalizeTenantNoMatchKey(pickField(row, "tenantNo", "TenantNo")) === matchKey
    ) || null
  );
}

function normalizeTenantNoMatchKey(value) {
  const digits = String(value || "")
    .trim()
    .replace(/^T-?/i, "")
    .replace(/\D/g, "");
  if (!digits) return "";
  return digits.replace(/^0+/, "") || digits;
}

export function resolveContractTenantNo(contract) {
  const raw = String(pickField(contract, "tenantNo", "TenantNo") || "").trim();
  if (!raw) return "";
  const match = raw.match(/^([A-Za-z0-9-]+)/);
  return match ? match[1] : raw;
}

export function findCoaById(coaOptions, coaId) {
  if (coaId === "" || coaId == null) return null;
  return (coaOptions || []).find((row) => Number(row?.id ?? row?.Id) === Number(coaId)) ?? null;
}

/** @deprecated Use findCoaById — kept for callers outside collections. */
export function findCustomerCoa(coaOptions, coaId) {
  return findCoaById(coaOptions, coaId);
}

export function resolveCollectionTenantAccount(contract, tenants, coaOptions) {
  const empty = { tenantNo: "", tenantBusiness: "", coaId: "", accountLabel: "" };
  if (!contract) return empty;

  const tenant = findTenantByContract(tenants, contract);
  const tenantNo = tenant
    ? String(pickField(tenant, "tenantNo", "TenantNo") || "").trim()
    : resolveContractTenantNo(contract);
  const coaId = tenant?.coaId ?? tenant?.CoaId ?? "";
  const coa =
    findCoaById(coaOptions, coaId) ||
    (coaOptions || []).find((row) => Number(row?.id ?? row?.Id) === Number(coaId)) ||
    null;

  return {
    tenantNo,
    tenantBusiness: formatTenantBusinessLabel(contract, tenant),
    coaId: coa?.id ?? coa?.Id ?? coaId ?? "",
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
  const tenantNo = String(row?.tenantNo ?? row?.TenantNo ?? "").trim();
  if (invoiceKey && classId && contractId) return `${classId}|${contractId}|${invoiceKey}`;
  if (invoiceKey && tenantNo) return `tenant|${tenantNo}|${invoiceKey}`;
  if (row?.id != null && !String(row.id).startsWith("line-")) return `entry|${row.id}`;
  return String(row?.localKey || row?.groupKey || "").trim();
}

export function computeCollectionGroupAmounts(invoiceReceivable, items = []) {
  const receivable = parseAmount(invoiceReceivable);
  const totalPaid = sumCollectionReceiptLineAmounts(items);
  const remaining = receivable - totalPaid;
  const due = remaining < 0 ? 0 : remaining;
  const balance = remaining < 0 ? remaining : 0;
  return {
    due,
    currentDue: due,
    balance,
    totalPaid,
  };
}

/** Per-row balance for the collections grid: Receivable minus Amount (may be negative). */
export function computeCollectionRowBalance(receivable, amount) {
  return parseAmount(receivable) - parseAmount(amount);
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
    localKey: id,
    date: today,
    amount: "",
    tinTrn: "",
    remarks: "",
    status: "Pending",
    vrNo: "",
    vrDate: "",
    receiptId: "",
    isLocalOnly: true,
    pendingAttachmentFile: null,
    attachmentFileName: "",
    attachmentFileId: null,
    hasAttachment: false,
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
      remarks: entry.remarks,
      status: entry.status,
      vrNo: entry.vrNo,
      vrDate: entry.vrDate,
      receiptId: entry.receiptId,
      isLocalOnly: entry.isLocalOnly,
      pendingAttachmentFile: null,
      attachmentFileName: "",
      attachmentFileId: null,
      hasAttachment: false,
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
  const { due, currentDue, balance, totalPaid } = computeCollectionGroupAmounts(
    invoiceReceivable,
    group.items
  );

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
    currentDue,
    balance,
    totalPaid,
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
    remarks: item.remarks,
    isLocalOnly: item.isLocalOnly,
    isEditing: false,
  }));
}

export function buildCollectionLinePayload(group, item, amounts) {
  return buildCollectionEntryPayload({
    ...group,
    ...item,
    due: amounts?.due ?? group?.due ?? 0,
    balance: amounts?.balance ?? group?.balance ?? 0,
    receivable: amounts?.receivable ?? group?.invoiceReceivable ?? group?.receivable ?? 0,
    amount: normalizeCollectionLineAmount(item.amount),
    date: item.date,
    tinTrn: item.tinTrn,
    remarks: item.remarks,
    status: item.status,
    vrNo: item.vrNo,
    vrDate: item.vrDate,
    receiptId: item.receiptId,
  });
}

let nextRowId = 1;

export function createEmptyCollectionRow(overrides = {}) {
  const localKey = `draft-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const today = new Date().toISOString().slice(0, 10);
  return {
    id: localKey,
    localKey,
    classId: "",
    contractId: "",
    tenantNo: "",
    tenantBusiness: "",
    accountLabel: "",
    coaId: "",
    invoiceKey: "",
    receivable: "",
    due: "",
    balance: "",
    date: today,
    amount: "",
    tinTrn: "",
    remarks: "",
    status: "Pending",
    vrNo: "",
    vrDate: "",
    receiptId: "",
    isLocalOnly: true,
    isEditing: true,
    pendingAttachmentFile: null,
    attachmentFileName: "",
    attachmentFileId: null,
    hasAttachment: false,
    ...overrides,
  };
}

export function computeCollectionRowAmounts(entry, siblings = [], invoiceReceivable = 0) {
  const receivable = parseAmount(invoiceReceivable || entry?.receivable);
  const balance = computeCollectionRowBalance(receivable, entry?.amount);
  const due = balance > 0 ? balance : 0;
  return {
    due,
    currentDue: due,
    balance,
    totalPaid: parseAmount(entry?.amount),
    receivable,
  };
}

export function enrichCollectionGridRow(
  row,
  {
    contracts,
    tenants,
    customers = [],
    suppliers = [],
    coaOptions,
    invoices,
    classes,
    allRows = [],
  } = {}
) {
  const classRow = (classes || []).find((item) => Number(item.id) === Number(row.classId));
  const className = classRow?.name || classRow?.code || "";
  const contract =
    row.contractId != null && row.contractId !== ""
      ? (contracts || [])
          .map(normalizeCatalogRow)
          .find((item) => Number(item.id) === Number(row.contractId))
      : null;
  const tenantFromNo = findCollectionPartyOption(
    { tenants, customers, suppliers },
    row.tenantNo,
    row.coaId,
    coaOptions
  );
  const tenant = tenantFromNo || findTenantByContract(tenants, contract);
  const tenantAccount = row.tenantNo
    ? resolveCollectionTenantSelection(tenant, coaOptions)
    : resolveCollectionTenantAccount(contract, tenants, coaOptions);
  const coa = findCoaById(
    coaOptions,
    row.coaId || tenantAccount.coaId || tenant?.coaId || tenant?.CoaId
  );
  const selectedInvoice =
    findInvoiceByKey(invoices, row.invoiceKey) ||
    (row.invoiceKey
      ? (invoices || [])
          .map(normalizeCatalogRow)
          .find((item) => buildInvoiceKey(item) === String(row.invoiceKey || "").trim())
      : null);
  const invoiceReceivable = selectedInvoice
    ? computeInvoiceDue(selectedInvoice)
    : parseAmount(row.receivable);
  const amounts = computeCollectionRowAmounts(row, [], invoiceReceivable);

  return {
    ...row,
    className,
    tenantNo: row.tenantNo || tenantAccount.tenantNo || resolveContractTenantNo(contract),
    tenantBusiness:
      row.tenantBusiness ||
      tenantAccount.tenantBusiness ||
      (contract ? formatTenantBusinessLabel(contract, tenant) : ""),
    accountLabel: row.accountLabel || tenantAccount.accountLabel || formatAccountLabel(coa),
    coaId: row.coaId || tenantAccount.coaId || coa?.id || "",
    receivable: invoiceReceivable,
    invoiceReceivable,
    due: amounts.due,
    currentDue: amounts.currentDue,
    balance: amounts.balance,
    totalPaid: amounts.totalPaid,
    selectedContract: contract || null,
    selectedInvoice: selectedInvoice || null,
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
  params.set("view", "grid");
  if (cn) params.set("contractNo", cn);
  if (inv) params.set("invoiceNo", inv);
  const qs = params.toString();
  return qs ? `/contracts/agreement-prov-invoice?${qs}` : "/contracts/agreement-prov-invoice";
}

export function buildTenantConfigDeepLink(tenantNo) {
  const tn = String(tenantNo || "").trim();
  if (!tn) return "/configuration/tenants?view=grid";
  const params = new URLSearchParams({ view: "grid", tenantNo: tn });
  return `/configuration/tenants?${params.toString()}`;
}

export function buildReceiptDeepLink(vrNo, receiptId) {
  const vr = String(vrNo || "").trim();
  if (!vr) return "";
  const params = new URLSearchParams({ vrNo: vr });
  const rid = String(receiptId || "").trim();
  if (rid) params.set("receiptId", rid);
  return `/receipts?${params.toString()}`;
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
  const statusRaw = row?.status ?? row?.Status ?? "";
  const statusText = String(statusRaw || "")
    .trim()
    .toLowerCase();
  const normalizedStatus =
    statusText === "received" ? "Received" : statusText === "pending" ? "Pending" : "";
  return {
    ...normalized,
    id: row?.id ?? row?.Id ?? null,
    localKey: row?.localKey || row?.id || "",
    classId: row?.classId ?? row?.ClassId ?? "",
    contractId: row?.contractId ?? row?.ContractId ?? "",
    tenantNo: pickField(row, "tenantNo", "TenantNo"),
    tenantBusiness: row?.tenantBusiness ?? row?.TenantBusiness ?? "",
    coaId: row?.coaId ?? row?.CoaId ?? "",
    receivable: row?.receivableAmount ?? row?.ReceivableAmount ?? "",
    due: row?.dueAmount ?? row?.DueAmount ?? "",
    balance: row?.balanceAmount ?? row?.BalanceAmount ?? "",
    date: toDateInputValue(row?.collectionDate ?? row?.CollectionDate),
    amount: row?.amount ?? row?.Amount ?? "",
    tinTrn: normalizeTinTrn(row?.tinTrn ?? row?.TinTrn ?? ""),
    remarks: String(row?.remarks ?? row?.Remarks ?? "").trim(),
    status: normalizedStatus || String(statusRaw || "").trim(),
    vrNo: pickField(row, "vrNo", "VrNo"),
    vrDate: toDateInputValue(row?.vrDate ?? row?.VrDate),
    receiptId: row?.receiptId ?? row?.ReceiptId ?? "",
    invoiceKey: buildInvoiceKey({
      contractNo: row?.contractNo ?? row?.ContractNo ?? "",
      invoiceNo: row?.invoiceNo ?? row?.InvoiceNo ?? "",
    }),
    isLocalOnly: false,
    isEditing: false,
    pendingAttachmentFile: null,
    attachmentFileName: "",
    attachmentFileId: null,
    hasAttachment: false,
  };
}

export function buildCollectionEntryPayload(row) {
  const contractId =
    row?.contractId !== "" && row?.contractId != null ? Number(row.contractId) : null;
  const classId = row?.classId !== "" && row?.classId != null ? Number(row.classId) : null;
  const coaId = row?.coaId !== "" && row?.coaId != null ? Number(row.coaId) : null;
  const receiptId = row?.receiptId !== "" && row?.receiptId != null ? Number(row.receiptId) : null;
  const { contractNo, invoiceNo } = parseInvoiceKey(row?.invoiceKey);
  const status = String(row?.status || "").trim() || (row?.vrNo ? "Received" : "Pending");
  const receivable = parseAmount(row?.receivable ?? row?.invoiceReceivable);
  const balance = computeCollectionRowBalance(receivable, row?.amount);
  const due = balance > 0 ? balance : 0;
  return {
    ClassId: classId,
    classId,
    ContractId: contractId,
    contractId,
    ContractNo: contractNo || null,
    contractNo: contractNo || null,
    TenantNo: String(row?.tenantNo || "").trim() || null,
    tenantNo: String(row?.tenantNo || "").trim() || null,
    TenantBusiness: String(row?.tenantBusiness || "").trim() || null,
    tenantBusiness: String(row?.tenantBusiness || "").trim() || null,
    CoaId: coaId,
    coaId,
    InvoiceNo: invoiceNo || null,
    invoiceNo: invoiceNo || null,
    ReceivableAmount: receivable,
    receivableAmount: receivable,
    DueAmount: due,
    dueAmount: due,
    BalanceAmount: balance,
    balanceAmount: balance,
    CollectionDate: toDateInputValue(row?.date) || null,
    collectionDate: toDateInputValue(row?.date) || null,
    Amount: parseAmount(row?.amount),
    amount: parseAmount(row?.amount),
    TinTrn: normalizeTinTrn(row?.tinTrn).trim() || null,
    tinTrn: normalizeTinTrn(row?.tinTrn).trim() || null,
    Remarks:
      String(row?.remarks || "")
        .trim()
        .slice(0, 500) || null,
    remarks:
      String(row?.remarks || "")
        .trim()
        .slice(0, 500) || null,
    Status: status,
    status,
    VrNo: String(row?.vrNo || "").trim() || null,
    vrNo: String(row?.vrNo || "").trim() || null,
    VrDate: toDateInputValue(row?.vrDate) || null,
    vrDate: toDateInputValue(row?.vrDate) || null,
    ReceiptId: receiptId,
    receiptId,
  };
}
