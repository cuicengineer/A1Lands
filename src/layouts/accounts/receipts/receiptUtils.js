import { COA_GROUP_OPTIONS } from "services/api.chartofaccounts.service";
import {
  getCashAndBankLedgerDropdownLabel,
  isCashAndBankCoaOption,
} from "layouts/cash-fund-flow/cash-and-bank/cashAndBankUtils";
import {
  buildCollectionEntryPayload,
  buildInvoiceKey,
  formatAgreementPeriodLabel,
  formatContractNoLabel,
  isFinalizedContract,
  normalizeCatalogRow,
  normalizeTinTrn,
} from "layouts/income-agreements/collections/collectionsUtils";
import { deriveCollectionEntryStatus } from "layouts/income-agreements/collections/collectionReceiptUtils";
import { productGoodApi, productServiceApi } from "services/api.product.service";
import {
  isCollectionAccountCoaOption,
  isCustomersControlAccount,
  isSupplierOrSuppliersControlAccount,
  isTenantOrTenantsControlAccount,
  mergePartyCoaOption,
  normalizePartyCoaOption,
} from "utils/partyCoaUtils";
import {
  normalizeGoodRecord,
  normalizeServiceRecord,
  parseAccountRef,
} from "layouts/products/shared/productUtils";

export const PAID_FROM_ACCOUNTS = [
  "Main Operating Account",
  "Petty Cash",
  "Suspense",
  "Bank Clearing",
];

export const PAYEE_CONTACT_TYPES = ["Other", "Customer", "Supplier", "Tenant"];

export const RAC_OPTIONS = [
  { id: 1, name: "AHQ" },
  { id: 2, name: "Northern Command" },
  { id: 3, name: "Southern Command" },
];

export const BASE_OPTIONS = [
  { id: 1, name: "Base Alpha", racId: 1 },
  { id: 2, name: "Base Bravo", racId: 2 },
  { id: 3, name: "Base Charlie", racId: 3 },
];

export const ITEM_OPTIONS = [
  "Office Supplies",
  "Utilities",
  "Professional Services",
  "Equipment",
  "Maintenance",
];

export const MAX_ATTACHMENT_FILES = 5;

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function formatLineAccountLabel(acctId, acctName, controlAccount) {
  const id = String(acctId || "").trim();
  const name = String(acctName || "").trim();
  const control = String(controlAccount || "").trim();
  const base = id && name ? `${id} - ${name}` : id || name;
  if (!base) return control;
  return control ? `${base} - ${control}` : base;
}

/** Cash & Bank style label: AcctId - Name (no control account suffix). */
export function formatLineAccountDropdownLabel(option) {
  if (option == null) return "";
  const acctId = String(option.acctId ?? "").trim();
  const acctName = String(option.acctName ?? "").trim();
  if (acctId && acctName) return `${acctId} - ${acctName}`;
  return String(option.label ?? "").trim() || acctId || acctName || "";
}

export function formatTenantPartyContractDropdownLabel(party, contract) {
  const baseLabel = String(party?.label || "").trim();
  const contractNo = formatContractNoLabel(contract);
  const period = formatAgreementPeriodLabel(
    pickField(contract, "contractStartDate", "ContractStartDate"),
    pickField(contract, "contractEndDate", "ContractEndDate")
  );
  return [baseLabel, contractNo, period].filter(Boolean).join(" - ");
}

export const partyDropdownOneLineSx = {
  fontSize: "0.6875rem",
  lineHeight: 1.15,
  whiteSpace: "nowrap",
  overflow: "hidden",
  textOverflow: "ellipsis",
  display: "block",
  maxWidth: "100%",
};

export function enrichTenantPartyOptionsWithContracts(parties, contracts) {
  const contractRows = (contracts || []).map(normalizeCatalogRow).filter(isFinalizedContract);
  const contractsByTenantNo = new Map();

  contractRows.forEach((contract) => {
    const tenantNo = pickField(contract, "tenantNo", "TenantNo");
    if (!tenantNo) return;
    const key = tenantNo.toLowerCase();
    if (!contractsByTenantNo.has(key)) contractsByTenantNo.set(key, []);
    contractsByTenantNo.get(key).push(contract);
  });

  const result = [];
  (parties || []).forEach((party) => {
    if (party?.type !== "Tenant") {
      result.push(party);
      return;
    }
    const tenantNo = String(party.code || "")
      .trim()
      .toLowerCase();
    const tenantContracts = contractsByTenantNo.get(tenantNo) || [];
    if (!tenantContracts.length) {
      result.push(party);
      return;
    }
    tenantContracts.forEach((contract) => {
      const contractNo = formatContractNoLabel(contract);
      const contractId = contract?.id ?? contract?.Id;
      const period = formatAgreementPeriodLabel(
        pickField(contract, "contractStartDate", "ContractStartDate"),
        pickField(contract, "contractEndDate", "ContractEndDate")
      );
      result.push({
        ...party,
        value: contractNo ? `${party.value}|${contractNo}` : party.value,
        label: formatTenantPartyContractDropdownLabel(party, contract),
        contractNo,
        contractPeriod: period,
        contractId: contractId != null ? String(contractId) : "",
      });
    });
  });

  return result.sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" })
  );
}

const GROUP_COLOR_PALETTE = [
  { bg: "rgba(25, 118, 210, 0.14)", accent: "#1976d2" },
  { bg: "rgba(211, 47, 47, 0.14)", accent: "#d32f2f" },
  { bg: "rgba(46, 125, 50, 0.14)", accent: "#2e7d32" },
  { bg: "rgba(156, 39, 176, 0.14)", accent: "#9c27b0" },
  { bg: "rgba(245, 124, 0, 0.14)", accent: "#f57c00" },
  { bg: "rgba(0, 151, 167, 0.14)", accent: "#0097a7" },
  { bg: "rgba(94, 53, 177, 0.14)", accent: "#5e35b1" },
  { bg: "rgba(0, 105, 92, 0.14)", accent: "#00695c" },
];

const KNOWN_GROUP_COLORS = COA_GROUP_OPTIONS.reduce((acc, name, index) => {
  acc[name.toLowerCase()] = GROUP_COLOR_PALETTE[index % GROUP_COLOR_PALETTE.length];
  return acc;
}, {});

const assignedGroupColors = new Map();

function hashGroupColorIndex(groupName) {
  const key = String(groupName || "")
    .trim()
    .toLowerCase();
  let hash = 0;
  for (let i = 0; i < key.length; i += 1) {
    hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  }
  return hash % GROUP_COLOR_PALETTE.length;
}

export function getCoaGroupColor(groupName) {
  const key = String(groupName || "").trim();
  if (!key) {
    return { bg: "rgba(158, 158, 158, 0.1)", accent: "#9e9e9e" };
  }
  const knownKey = key.toLowerCase();
  if (knownKey in KNOWN_GROUP_COLORS) return KNOWN_GROUP_COLORS[knownKey];
  if (!assignedGroupColors.has(knownKey)) {
    assignedGroupColors.set(knownKey, GROUP_COLOR_PALETTE[hashGroupColorIndex(key)]);
  }
  return assignedGroupColors.get(knownKey);
}

const COA_GROUP_SORT_RANK = COA_GROUP_OPTIONS.reduce((acc, name, index) => {
  acc[name.toLowerCase()] = index;
  return acc;
}, {});

function getGroupSortRank(groupName) {
  const key = String(groupName || "")
    .trim()
    .toLowerCase();
  if (key in COA_GROUP_SORT_RANK) return COA_GROUP_SORT_RANK[key];
  return COA_GROUP_OPTIONS.length;
}

function compareLineAccountOptions(a, b) {
  const groupDiff = getGroupSortRank(a.groupName) - getGroupSortRank(b.groupName);
  if (groupDiff !== 0) return groupDiff;
  const groupNameDiff = String(a.groupName).localeCompare(String(b.groupName), undefined, {
    sensitivity: "base",
  });
  if (groupNameDiff !== 0) return groupNameDiff;
  const idDiff = String(a.acctId).localeCompare(String(b.acctId), undefined, {
    numeric: true,
    sensitivity: "base",
  });
  if (idDiff !== 0) return idDiff;
  return String(a.acctName).localeCompare(String(b.acctName), undefined, {
    sensitivity: "base",
  });
}

export function findLineAccountOption(options, ref) {
  if (ref == null) return null;
  if (typeof ref !== "object") {
    const directValue = String(ref);
    return (
      (options || []).find(
        (option) =>
          String(option.value) === directValue ||
          String(option.label) === directValue ||
          String(option.coaId ?? option.id) === directValue
      ) || null
    );
  }
  const coaId = ref?.accountCoaId ?? ref?.coaId;
  if (coaId != null && coaId !== "") {
    const byCoaId = (options || []).find(
      (option) => Number(option.coaId ?? option.id) === Number(coaId)
    );
    if (byCoaId) return byCoaId;
  }
  if (ref?.account) {
    return (
      (options || []).find(
        (option) =>
          String(option.label) === String(ref.account) ||
          String(option.value) === String(ref.account)
      ) || null
    );
  }
  return null;
}

export function normalizeLineAccountOption(row) {
  const id = row?.id ?? row?.Id ?? "";
  const controlAccount = pickField(row, "controlAccount", "ControlAccount");
  const groupName = pickField(row, "groupName", "GroupName");
  const acctId = pickField(row, "acctId", "AcctId");
  const acctName = pickField(row, "acctName", "AcctName");
  const label = formatLineAccountLabel(acctId, acctName, controlAccount);
  if (!label) return null;

  const groupColor = getCoaGroupColor(groupName);
  const coaId = id != null && id !== "" ? String(id) : "";
  return {
    id,
    coaId,
    acctId,
    acctName,
    controlAccount,
    groupName,
    groupColor,
    value: coaId || label,
    label,
  };
}

export function buildLineAccountOptions(coaRows, savedAccounts = []) {
  const byKey = new Map();

  (coaRows || []).forEach((row) => {
    const option = normalizeLineAccountOption(row);
    if (!option?.value) return;
    byKey.set(option.value, option);
  });

  (savedAccounts || []).forEach((saved) => {
    const trimmed = String(saved || "").trim();
    if (!trimmed) return;
    const existing = [...byKey.values()].find(
      (option) => option.label === trimmed || option.value === trimmed
    );
    if (existing) return;
    byKey.set(`legacy:${trimmed}`, {
      controlAccount: trimmed.split(" - ").pop()?.trim() || trimmed,
      groupName: "",
      groupColor: getCoaGroupColor(""),
      value: trimmed,
      label: trimmed,
    });
  });

  return [...byKey.values()].sort(compareLineAccountOptions);
}

/** Same Assets + party control-account filter used on collections grid. */
export function buildCollectionStyleLineAccountOptions(coaRows, savedAccounts = []) {
  const normalizedRows = (coaRows || [])
    .map((row) => {
      const partyOption = normalizePartyCoaOption(row);
      if (!partyOption.id || !isCollectionAccountCoaOption(partyOption)) return null;
      return {
        ...row,
        id: partyOption.id,
        Id: partyOption.id,
        acctId: partyOption.acctId,
        acctName: partyOption.acctName,
        controlAccount: partyOption.controlAccount,
        groupName: partyOption.groupName,
      };
    })
    .filter(Boolean);
  return buildLineAccountOptions(normalizedRows, savedAccounts);
}

export { mergePartyCoaOption, normalizePartyCoaOption, isCollectionAccountCoaOption };

export function formatReceiptContractDropdownLabel(contract) {
  const contractNo = formatContractNoLabel(contract);
  const period = formatAgreementPeriodLabel(
    pickField(contract, "contractStartDate", "ContractStartDate"),
    pickField(contract, "contractEndDate", "ContractEndDate")
  );
  if (!contractNo) return "";
  return period ? `${contractNo} - ${period}` : contractNo;
}

export function buildReceiptContractOptions(contracts) {
  return (contracts || [])
    .map(normalizeCatalogRow)
    .filter(isFinalizedContract)
    .map((row) => ({
      value: String(row.id),
      label: formatReceiptContractDropdownLabel(row),
      contractNo: formatContractNoLabel(row),
      contractId: row.id,
    }))
    .filter((option) => option.label)
    .sort((a, b) =>
      String(a.contractNo).localeCompare(String(b.contractNo), undefined, {
        numeric: true,
        sensitivity: "base",
      })
    );
}

export function getReceiptLineContractSelectValue(line, contractOptions) {
  if (line?.contractId != null && String(line.contractId).trim() !== "") {
    return String(line.contractId);
  }
  const contractNo = String(line?.contractNo || "").trim();
  if (!contractNo) return "";
  const match = (contractOptions || []).find(
    (option) => String(option.contractNo || "").trim() === contractNo
  );
  return match?.value || "";
}

function isActiveCollectionEntryRow(row) {
  const deleted = row?.isDeleted ?? row?.IsDeleted;
  if (deleted === true || deleted === 1 || deleted === "1") return false;
  if (typeof deleted === "string" && deleted.trim().toLowerCase() === "true") return false;
  const invoiceNo = String(pickField(row, "invoiceNo", "InvoiceNo") || "").trim();
  if (invoiceNo) return true;
  const { invoiceNo: parsedInvoiceNo } = (() => {
    const key = String(row?.invoiceKey || "").trim();
    if (!key) return { invoiceNo: "" };
    const [contractNo, inv] = key.split("|");
    return { invoiceNo: (inv || contractNo || "").trim() };
  })();
  return Boolean(parsedInvoiceNo);
}

export function isReceiptCollectionEntryRow(row) {
  const deleted = row?.isDeleted ?? row?.IsDeleted;
  if (deleted === true || deleted === 1 || deleted === "1") return false;
  if (typeof deleted === "string" && deleted.trim().toLowerCase() === "true") return false;
  return true;
}

export function isPendingReceiptCollectionEntry(row, { selectedCollectionEntryId = "" } = {}) {
  if (!isReceiptCollectionEntryRow(row)) return false;
  const entryId = String(row?.id ?? row?.Id ?? "").trim();
  const isSelected =
    selectedCollectionEntryId && entryId === String(selectedCollectionEntryId).trim();
  return deriveCollectionEntryStatus(row) === "Pending" || isSelected;
}

export function entryMatchesReceiptLineAccount(entry, lineAccount) {
  if (!entry || !lineAccount) return false;
  const entryCoaId = entry?.coaId ?? entry?.CoaId;
  const accountCoaId = lineAccount?.coaId ?? lineAccount?.id;
  if (
    entryCoaId !== "" &&
    entryCoaId != null &&
    accountCoaId !== "" &&
    accountCoaId != null &&
    Number(entryCoaId) === Number(accountCoaId)
  ) {
    return true;
  }
  return false;
}

export const RECEIPT_COLLECTION_ENTRY_OPTION_PREFIX = "ce:";

export function buildReceiptCollectionEntryOptionValue(entryId) {
  const id = String(entryId ?? "").trim();
  return id ? `${RECEIPT_COLLECTION_ENTRY_OPTION_PREFIX}${id}` : "";
}

export function parseReceiptCollectionEntryOptionValue(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith(RECEIPT_COLLECTION_ENTRY_OPTION_PREFIX)) return "";
  return raw.slice(RECEIPT_COLLECTION_ENTRY_OPTION_PREFIX.length).trim();
}

export function isReceiptCollectionEntryOptionValue(value) {
  return String(value || "")
    .trim()
    .startsWith(RECEIPT_COLLECTION_ENTRY_OPTION_PREFIX);
}

export function getCollectionEntryBalanceAmount(entry) {
  const balance = parseAmount(
    entry?.balanceAmount ?? entry?.balance ?? entry?.BalanceAmount ?? entry?.Balance
  );
  const amount = parseAmount(entry?.amount ?? entry?.Amount);
  return { balance, amount };
}

export function formatReceiptCollectionInvoiceOptionLabel(
  entry,
  { duplicateInvoiceNo = false } = {}
) {
  const invoiceNo = String(pickField(entry, "invoiceNo", "InvoiceNo") || "").trim();
  if (!invoiceNo) return "";
  const { balance, amount } = getCollectionEntryBalanceAmount(entry);
  if (!duplicateInvoiceNo && balance === 0 && amount === 0) return invoiceNo;
  return `${invoiceNo} - Balance ${formatAmount(balance)} - Amount ${formatAmount(amount)}`;
}

export function formatReceiptCollectionTenantBusinessOptionLabel(
  entry,
  { duplicateTenantBusiness = false } = {}
) {
  const tenantBusiness = String(entry?.tenantBusiness || entry?.TenantBusiness || "").trim();
  if (!tenantBusiness) return "";
  const { balance, amount } = getCollectionEntryBalanceAmount(entry);
  if (!duplicateTenantBusiness && balance === 0 && amount === 0) return tenantBusiness;
  return `${tenantBusiness} - Balance ${formatAmount(balance)} - Amount ${formatAmount(amount)}`;
}

export function buildSyntheticPartyFromCollectionEntry(entry) {
  if (!entry) return null;
  return {
    type: "Tenant",
    coaId: entry?.coaId ?? entry?.CoaId ?? "",
    code: pickField(entry, "tenantNo", "TenantNo"),
    name: String(entry?.tenantBusiness || entry?.TenantBusiness || "").trim(),
    label: String(entry?.tenantBusiness || entry?.TenantBusiness || "").trim(),
  };
}

export function buildReceiptLineCollectionTenantOptions(
  collectionRows,
  lineAccount,
  { selectedCollectionEntryId = "", unavailableCollectionEntryIds = new Set() } = {}
) {
  if (!lineAccount || !isCollectionAccountCoaOption(lineAccount)) return [];

  const selectedId = String(selectedCollectionEntryId || "").trim();
  const pendingEntries = (collectionRows || []).filter((entry) => {
    if (!isPendingReceiptCollectionEntry(entry, { selectedCollectionEntryId: selectedId })) {
      return false;
    }
    if (!entryMatchesReceiptLineAccount(entry, lineAccount)) return false;
    return Boolean(String(entry?.tenantBusiness || entry?.TenantBusiness || "").trim());
  });

  const countByTenantBusiness = new Map();
  pendingEntries.forEach((entry) => {
    const name = String(entry?.tenantBusiness || entry?.TenantBusiness || "")
      .trim()
      .toLowerCase();
    if (name) countByTenantBusiness.set(name, (countByTenantBusiness.get(name) || 0) + 1);
  });

  return pendingEntries
    .filter((entry) => {
      const entryId = String(entry?.id ?? entry?.Id ?? "").trim();
      if (!entryId) return false;
      if (selectedId && entryId === selectedId) return true;
      if (unavailableCollectionEntryIds.has(entryId)) return false;
      return true;
    })
    .map((entry) => {
      const entryId = entry?.id ?? entry?.Id;
      const tenantBusiness = String(entry?.tenantBusiness || entry?.TenantBusiness || "").trim();
      const duplicate = (countByTenantBusiness.get(tenantBusiness.toLowerCase()) || 0) > 1;
      return {
        value: buildReceiptCollectionEntryOptionValue(entryId),
        label: formatReceiptCollectionTenantBusinessOptionLabel(entry, {
          duplicateTenantBusiness: duplicate,
        }),
        collectionEntryId: String(entryId),
        entry,
        type: "Tenant",
      };
    })
    .filter((option) => option.label);
}

export function applyReceiptLinePartyFromCollectionEntry(
  line,
  entry,
  { duplicateTenantBusiness = false } = {}
) {
  const entryId = String(entry?.id ?? entry?.Id ?? "").trim();
  const amount = parseAmount(entry?.amount ?? entry?.Amount);
  const entryTinTrn = normalizeTinTrn(entry?.tinTrn ?? entry?.TinTrn ?? "");
  const invoiceNo = pickField(entry, "invoiceNo", "InvoiceNo");
  const contractNo = pickField(entry, "contractNo", "ContractNo");
  const partyKey = buildReceiptCollectionEntryOptionValue(entryId);
  const tenantBusiness = String(entry?.tenantBusiness || entry?.TenantBusiness || "").trim();
  const updated = {
    ...line,
    partyKey,
    partyType: "Tenant",
    partyId: entryId,
    partyCode: pickField(entry, "tenantNo", "TenantNo"),
    partyName: tenantBusiness,
    partyLabel: formatReceiptCollectionTenantBusinessOptionLabel(entry, {
      duplicateTenantBusiness,
    }),
    collectionEntryId: entryId,
    contractNo,
    invoiceNo,
    invoiceKey: invoiceNo ? partyKey : "",
    amount: amount !== "" && amount != null ? String(amount) : "",
    tinTrn: entryTinTrn,
  };
  updated.total = computeLineTotal(updated);
  return updated;
}

export function partyMatchesReceiptCollectionEntry(party, entry) {
  if (!party || !entry) return false;
  if (party.coaId && entry.coaId && Number(party.coaId) === Number(entry.coaId)) return true;
  const haystack = String(entry.tenantBusiness || entry?.TenantBusiness || "").toLowerCase();
  return [party.code, party.name]
    .filter(Boolean)
    .some((value) => haystack.includes(String(value).trim().toLowerCase()));
}

export function getPendingCollectionEntriesForReceiptTenant(
  collectionRows,
  party,
  { selectedCollectionEntryId = "" } = {}
) {
  const selectedId = String(selectedCollectionEntryId || "").trim();
  return (collectionRows || []).filter((entry) => {
    if (!partyMatchesReceiptCollectionEntry(party, entry)) return false;
    if (!isActiveCollectionEntryRow(entry)) return false;
    const entryId = String(entry?.id ?? entry?.Id ?? "").trim();
    const isSelected = selectedId && entryId === selectedId;
    return deriveCollectionEntryStatus(entry) === "Pending" || isSelected;
  });
}

export function buildReceiptLineCollectionInvoiceOptions(
  collectionRows,
  party,
  { selectedCollectionEntryId = "", unavailableCollectionEntryIds = new Set() } = {}
) {
  if (!party) return [];

  const selectedId = String(selectedCollectionEntryId || "").trim();
  const partyCoaId = party?.coaId ?? party?.CoaId;
  const pendingEntries = (collectionRows || []).filter((entry) => {
    if (!isPendingReceiptCollectionEntry(entry, { selectedCollectionEntryId: selectedId })) {
      return false;
    }
    const invoiceNo = String(pickField(entry, "invoiceNo", "InvoiceNo") || "").trim();
    if (!invoiceNo) return false;
    if (
      partyCoaId !== "" &&
      partyCoaId != null &&
      entry?.coaId != null &&
      Number(partyCoaId) === Number(entry.coaId)
    ) {
      return true;
    }
    if (String(party?.type || "").trim() !== "Tenant") return false;
    return partyMatchesReceiptCollectionEntry(party, entry);
  });

  const countByInvoiceNo = new Map();
  pendingEntries.forEach((entry) => {
    const invoiceNo = String(pickField(entry, "invoiceNo", "InvoiceNo") || "")
      .trim()
      .toLowerCase();
    if (invoiceNo) countByInvoiceNo.set(invoiceNo, (countByInvoiceNo.get(invoiceNo) || 0) + 1);
  });

  return pendingEntries
    .filter((entry) => {
      const entryId = String(entry?.id ?? entry?.Id ?? "").trim();
      if (!entryId) return false;
      if (selectedId && entryId === selectedId) return true;
      if (unavailableCollectionEntryIds.has(entryId)) return false;
      return true;
    })
    .map((entry) => {
      const entryId = entry?.id ?? entry?.Id;
      const invoiceNo = String(pickField(entry, "invoiceNo", "InvoiceNo") || "").trim();
      const duplicate = (countByInvoiceNo.get(invoiceNo.toLowerCase()) || 0) > 1;
      return {
        value: buildReceiptCollectionEntryOptionValue(entryId),
        label: formatReceiptCollectionInvoiceOptionLabel(entry, { duplicateInvoiceNo: duplicate }),
        collectionEntryId: String(entryId),
        invoiceNo,
        entry,
      };
    })
    .filter((option) => option.label);
}

export function normalizeReceiptLineForForm(line) {
  const normalized = normalizeReceiptLineNumericDefaults({
    ...createLineRow(),
    ...line,
  });
  const collectionEntryId = String(normalized.collectionEntryId || "").trim();
  if (collectionEntryId && !isReceiptCollectionEntryOptionValue(normalized.invoiceKey)) {
    normalized.invoiceKey = buildReceiptCollectionEntryOptionValue(collectionEntryId);
  }
  return normalized;
}

export function collectReceiptLinkedCollectionEntries(lines, collectionRows) {
  const byId = new Map();
  (lines || []).forEach((line) => {
    const directId =
      String(line?.collectionEntryId || "").trim() ||
      parseReceiptCollectionEntryOptionValue(line?.invoiceKey);
    if (directId) {
      const entry = (collectionRows || []).find((row) => String(row?.id ?? row?.Id) === directId);
      if (entry) byId.set(directId, entry);
      return;
    }
    const invoiceKey = normalizeReceiptInvoiceKey(line);
    if (!invoiceKey) return;
    (collectionRows || [])
      .filter((row) => buildInvoiceKey(row) === invoiceKey)
      .forEach((row) => {
        const id = String(row?.id ?? row?.Id ?? "").trim();
        if (id) byId.set(id, row);
      });
  });
  return Array.from(byId.values());
}

export function buildReceiptCollectionEntryUpdatePayload(entry, { receiptId, reference, date }) {
  return buildCollectionEntryPayload({
    ...entry,
    vrNo: reference,
    vrDate: date,
    status: "Received",
    receiptId,
  });
}

export function getCollectionEntriesForInvoiceKey(collectionRows, invoiceKey) {
  const key = String(invoiceKey || "").trim();
  if (!key) return [];
  return (collectionRows || [])
    .filter(isActiveCollectionEntryRow)
    .filter((row) => buildInvoiceKey(row) === key)
    .filter((row) => parseAmount(row?.amount ?? row?.Amount) > 0)
    .sort((a, b) => Number(a?.id ?? a?.Id ?? 0) - Number(b?.id ?? b?.Id ?? 0));
}

export function buildReceiptLineFromCollectionEntry(sourceLine, collectionEntry, invoiceMeta = {}) {
  const amount = parseAmount(collectionEntry?.amount ?? collectionEntry?.Amount);
  const entryTinTrn = normalizeTinTrn(collectionEntry?.tinTrn ?? collectionEntry?.TinTrn ?? "");
  const entryId =
    collectionEntry?.id != null && collectionEntry?.id !== ""
      ? String(collectionEntry.id)
      : collectionEntry?.Id != null && collectionEntry?.Id !== ""
      ? String(collectionEntry.Id)
      : "";
  const invoiceKeyValue = entryId
    ? buildReceiptCollectionEntryOptionValue(entryId)
    : invoiceMeta.invoiceKey || sourceLine?.invoiceKey || "";
  const line = {
    ...createLineRow(),
    ...sourceLine,
    id: createLineRow().id,
    invoiceKey: invoiceKeyValue,
    contractNo: invoiceMeta.contractNo || sourceLine?.contractNo || "",
    invoiceNo: invoiceMeta.invoiceNo || sourceLine?.invoiceNo || "",
    collectionEntryId: entryId,
    amount: amount > 0 ? String(amount) : "",
    tinTrn: entryTinTrn,
  };
  line.total = computeLineTotal(line);
  return normalizeReceiptLineNumericDefaults(line);
}

export function applyReceiptLineInvoiceSelection(
  lines,
  lineId,
  invoiceKey,
  { collectionRows, invoiceRowsByKey, pickField: pickRowField, getCollectionEntryOpenAmount }
) {
  const lineIndex = (lines || []).findIndex((line) => line.id === lineId);
  if (lineIndex < 0) return lines;

  const sourceLine = lines[lineIndex];
  const key = String(invoiceKey || "").trim();

  if (!key) {
    return lines.map((line) => {
      if (line.id !== lineId) return line;
      const cleared = {
        ...line,
        invoiceKey: "",
        invoiceNo: "",
        collectionEntryId: "",
        amount: "",
        tinTrn: "",
      };
      cleared.total = computeLineTotal(cleared);
      return cleared;
    });
  }

  const collectionEntryId = parseReceiptCollectionEntryOptionValue(key);
  if (collectionEntryId) {
    const entry = (collectionRows || []).find(
      (row) => String(row?.id ?? row?.Id) === collectionEntryId
    );
    if (entry) {
      const updated = buildReceiptLineFromCollectionEntry(sourceLine, entry, {
        contractNo: pickRowField(entry, "contractNo", "ContractNo"),
        invoiceNo: pickRowField(entry, "invoiceNo", "InvoiceNo"),
      });
      return lines.map((line) => (line.id === lineId ? { ...updated, id: line.id } : line));
    }
  }

  const invoice = invoiceRowsByKey?.get?.(key);
  const contractNo =
    pickRowField(invoice, "contractNo", "ContractNo") ||
    pickRowField(sourceLine, "contractNo", "ContractNo") ||
    "";
  const invoiceNo =
    pickRowField(invoice, "invoiceNo", "InvoiceNo") ||
    pickRowField(sourceLine, "invoiceNo", "InvoiceNo") ||
    "";
  const template = {
    ...sourceLine,
    invoiceKey: key,
    contractNo,
    invoiceNo,
  };
  const collectionEntries = getCollectionEntriesForInvoiceKey(collectionRows, key);

  if (collectionEntries.length === 1) {
    const updated = buildReceiptLineFromCollectionEntry(template, collectionEntries[0], {
      invoiceKey: key,
      contractNo,
      invoiceNo,
    });
    return lines.map((line) => (line.id === lineId ? { ...updated, id: line.id } : line));
  }

  const fallbackEntry = (collectionRows || []).find((row) => buildInvoiceKey(row) === key);
  const updated = {
    ...template,
    collectionEntryId: "",
    amount: "",
    tinTrn: "",
  };
  if (fallbackEntry) {
    const entryAmount = parseAmount(fallbackEntry?.amount ?? fallbackEntry?.Amount);
    const entryTinTrn = normalizeTinTrn(fallbackEntry?.tinTrn ?? fallbackEntry?.TinTrn ?? "");
    if (entryAmount > 0) updated.amount = String(entryAmount);
    if (entryTinTrn) updated.tinTrn = entryTinTrn;
  } else if (!String(updated.amount || "").trim()) {
    const balance = getCollectionEntryOpenAmount?.(fallbackEntry, invoice) ?? 0;
    if (balance > 0) updated.amount = String(balance);
  }
  updated.total = computeLineTotal(updated);
  return lines.map((line) => (line.id === lineId ? updated : line));
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

const MONTH_YEAR_PATTERN = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\/\d{4}$/;

export function currentMonthYear() {
  const now = new Date();
  return `${MONTH_SHORT[now.getMonth()]}/${now.getFullYear()}`;
}

export function monthYearToInputValue(mmmYyyy) {
  const match = String(mmmYyyy || "")
    .trim()
    .match(/^([A-Za-z]{3})\/(\d{4})$/);
  if (!match) return "";
  const monthIndex = MONTH_SHORT.findIndex((name) => name.toLowerCase() === match[1].toLowerCase());
  if (monthIndex < 0) return "";
  return `${match[2]}-${String(monthIndex + 1).padStart(2, "0")}`;
}

export function inputValueToMonthYear(yyyyMm) {
  if (!yyyyMm || !/^\d{4}-\d{2}$/.test(yyyyMm)) return "";
  const [year, month] = yyyyMm.split("-");
  const monthLabel = MONTH_SHORT[Number(month) - 1];
  return monthLabel ? `${monthLabel}/${year}` : "";
}

export function isValidMonthYear(value) {
  return MONTH_YEAR_PATTERN.test(String(value || "").trim());
}

export function createLineRow(overrides = {}) {
  return normalizeReceiptLineNumericDefaults({
    id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    racId: "",
    baseId: "",
    item: "",
    account: "",
    accountCoaId: "",
    partyKey: "",
    partyType: "",
    partyId: "",
    partyCode: "",
    partyName: "",
    partyLabel: "",
    contractId: "",
    invoiceKey: "",
    contractNo: "",
    invoiceNo: "",
    collectionEntryId: "",
    tinTrn: "",
    tinFtn: "",
    amount: "",
    unitPrice: "",
    quantity: "",
    productKey: "",
    productType: "",
    productId: "",
    discount: "0",
    tax: "0",
    total: 0,
    ...overrides,
  });
}

/** Ensures discount/tax default to 0 when left empty on line items. */
export function normalizeReceiptLineNumericDefaults(line) {
  if (!line) return line;
  const normalized = { ...line };
  if (String(normalized.discount ?? "").trim() === "") normalized.discount = "0";
  if (String(normalized.tax ?? "").trim() === "") normalized.tax = "0";
  normalized.total = computeLineTotal(normalized);
  return normalized;
}

export function isReceiptLineComplete(line, { requireItem = true, requireAccount = true } = {}) {
  if (!line) return false;
  return (
    (!requireItem ||
      Boolean(String(line.item || "").trim()) ||
      Boolean(String(line.productKey || "").trim())) &&
    (!requireAccount || Boolean(String(line.account || "").trim())) &&
    parseAmount(line.amount) > 0
  );
}

export function clearReceiptLinePartyFields(line) {
  if (!line) return line;
  return {
    ...line,
    partyKey: "",
    partyType: "",
    partyId: "",
    partyCode: "",
    partyName: "",
    partyLabel: "",
    contractId: "",
    invoiceKey: "",
    contractNo: "",
    invoiceNo: "",
    collectionEntryId: "",
  };
}

/** Apply header Received In account to a receipt line and reset party/invoice fields. */
export function applyHeaderAccountToReceiptLine(line, account) {
  const base = clearReceiptLinePartyFields(line || createLineRow());
  if (!account) {
    return normalizeReceiptLineNumericDefaults({
      ...base,
      account: "",
      accountCoaId: "",
    });
  }
  return normalizeReceiptLineNumericDefaults({
    ...base,
    account: account.label || "",
    accountCoaId: String(account.coaId || account.id || ""),
  });
}

export function getReceivedInSelectValue(form) {
  if (form?.cashAndBankAccountId !== "" && form?.cashAndBankAccountId != null) {
    return String(form.cashAndBankAccountId);
  }
  if (form?.receivedInCoaId !== "" && form?.receivedInCoaId != null) {
    return String(form.receivedInCoaId);
  }
  if (form?.payeePartyId !== "" && form?.payeePartyId != null) {
    return String(form.payeePartyId);
  }
  return "";
}

function isReceiptPartyCoaOption(option) {
  if (!option) return false;
  return !isCashAndBankCoaOption({
    groupName: option.groupName,
    controlAccount: option.controlAccount,
  });
}

function buildCoaReceiptPartyKey(coaId) {
  return `coa|${String(coaId || "").trim()}`;
}

function normalizeEntityReceiptPartyOption(party) {
  const groupName = String(party?.coaGroupName || "").trim();
  const controlAccount = String(party?.coaControlAccount || "").trim();
  return {
    ...party,
    groupName,
    controlAccount,
    groupColor: getCoaGroupColor(groupName),
  };
}

function normalizeCoaReceiptPartyOption(option) {
  const coaId = option?.coaId ?? option?.id;
  if (coaId == null || coaId === "") return null;
  const groupName = String(option?.groupName || "").trim();
  const controlAccount = String(option?.controlAccount || "").trim();
  return {
    value: buildCoaReceiptPartyKey(coaId),
    type: "Account",
    id: String(coaId),
    code: String(option?.acctId || "").trim(),
    name: String(option?.acctName || "").trim(),
    label: option?.label || "",
    coaId: String(coaId),
    coaControlAccount: controlAccount,
    coaGroupName: groupName,
    groupName,
    controlAccount,
    groupColor: option?.groupColor || getCoaGroupColor(groupName),
  };
}

function compareReceiptPartyOptions(a, b) {
  const typeRank = { Tenant: 0, Customer: 1, Supplier: 2, Account: 3 };
  const aType = typeRank[a?.type] ?? 4;
  const bType = typeRank[b?.type] ?? 4;
  if (aType !== bType) return aType - bType;
  const groupDiff =
    getGroupSortRank(a?.groupName || a?.coaGroupName) -
    getGroupSortRank(b?.groupName || b?.coaGroupName);
  if (groupDiff !== 0) return groupDiff;
  const controlDiff = String(a?.controlAccount || a?.coaControlAccount || "").localeCompare(
    String(b?.controlAccount || b?.coaControlAccount || ""),
    undefined,
    { sensitivity: "base" }
  );
  if (controlDiff !== 0) return controlDiff;
  return String(a?.label || "").localeCompare(String(b?.label || ""), undefined, {
    sensitivity: "base",
  });
}

export const RECEIPT_PARTY_TYPES = [
  { value: "Tenant", label: "Tenant Invoices" },
  { value: "CustomerSupplier", label: "Customer / Supplier Invoices" },
  { value: "RevenueExpense", label: "Revenue / Expense Account Without Invoices" },
  {
    value: "ItemBasedRevenueExpense",
    label: "Item Based Revenue / Expense Account Without Invoices",
  },
];

export const RECEIPT_LINE_MODES = {
  TENANT_INVOICE: "tenant-invoice",
  PARTY_INVOICE: "party-invoice",
  ACCOUNT_QTY: "account-qty",
  ITEM_BASED: "item-based",
  LEGACY: "legacy",
};

export function getReceiptPartyTypeLabel(receiptPartyType) {
  const type = String(receiptPartyType || "").trim();
  const match = RECEIPT_PARTY_TYPES.find((option) => option.value === type);
  return match?.label || type || "";
}

export function getReceiptLineMode(receiptPartyType) {
  const type = String(receiptPartyType || "").trim();
  if (type === "Tenant") return RECEIPT_LINE_MODES.TENANT_INVOICE;
  if (type === "CustomerSupplier") return RECEIPT_LINE_MODES.PARTY_INVOICE;
  if (type === "RevenueExpense") return RECEIPT_LINE_MODES.ACCOUNT_QTY;
  if (type === "ItemBasedRevenueExpense") return RECEIPT_LINE_MODES.ITEM_BASED;
  return RECEIPT_LINE_MODES.LEGACY;
}

export function isReceiptInvoiceMode(mode) {
  return mode === RECEIPT_LINE_MODES.TENANT_INVOICE || mode === RECEIPT_LINE_MODES.PARTY_INVOICE;
}

export function isReceiptQtyMode(mode) {
  return mode === RECEIPT_LINE_MODES.ACCOUNT_QTY || mode === RECEIPT_LINE_MODES.ITEM_BASED;
}

function isRevenueExpenseReceiptPartyType(receiptPartyType) {
  const type = String(receiptPartyType || "").trim();
  return type === "RevenueExpense" || type === "ItemBasedRevenueExpense";
}

export function getReceiptPartyColumnLabel(receiptPartyType) {
  if (receiptPartyType === "Tenant") return "Tenant";
  if (receiptPartyType === "CustomerSupplier") return "Customer";
  return "Party";
}

function isReceiptPartyGroupLabel(value) {
  const label = String(value || "").trim();
  return (
    isTenantOrTenantsControlAccount(label) ||
    isCustomersControlAccount(label) ||
    isSupplierOrSuppliersControlAccount(label)
  );
}

export function isReceiptPartyControlAccountOption(option) {
  return (
    isReceiptPartyGroupLabel(option?.controlAccount) ||
    isReceiptPartyGroupLabel(option?.groupName) ||
    isReceiptPartyGroupLabel(option?.subGroup)
  );
}

export function filterReceiptPartyControlAccountOptions(options) {
  return (options || []).filter(isCollectionAccountCoaOption);
}

export function filterPaymentTenantPartyOptions(partyOptions) {
  return (partyOptions || []).filter((party) => party?.type === "Tenant");
}

/** Payment/receipt simplified lines: party dropdown driven by the line account control group. */
export function filterPaymentLinePartyOptions(partyOptions, line, lineAccountOptions) {
  const account = findLineAccountOption(lineAccountOptions, line);
  if (!account) return [];
  const partyType = getReceiptPartyTypeFromAccountOption(account);
  if (!partyType || isRevenueExpenseReceiptPartyType(partyType)) return [];
  return filterReceiptLineEntityPartyOptions(partyOptions, partyType, account);
}

function isCashAndBankControlAccountLabel(value) {
  const label = String(value || "")
    .trim()
    .toLowerCase();
  return label === "cash and bank" || label === "cash & bank";
}

export function isCashAndBankLineAccountOption(option) {
  return isCashAndBankControlAccountLabel(option?.controlAccount);
}

export function filterCashAndBankLineAccountOptions(options) {
  return (options || []).filter(isCashAndBankLineAccountOption);
}

function getReceiptPartyTypeFromGroupLabel(value) {
  const label = String(value || "").trim();
  if (isTenantOrTenantsControlAccount(label)) return "Tenant";
  if (isCustomersControlAccount(label) || isSupplierOrSuppliersControlAccount(label))
    return "CustomerSupplier";
  return "";
}

export function getReceiptPartyTypeFromAccountOption(option) {
  if (!option) return "";
  for (const field of [option.controlAccount, option.groupName, option.subGroup]) {
    const type = getReceiptPartyTypeFromGroupLabel(field);
    if (type) return type;
  }
  return "";
}

export function getReceiptLineModeFromAccountOption(option) {
  const partyType = getReceiptPartyTypeFromAccountOption(option);
  if (!partyType) return null;
  return getReceiptLineMode(partyType);
}

export function resolveReceiptLineContextFromLine(line, accountOptions) {
  const account = findLineAccountOption(accountOptions, line);
  const partyType = getReceiptPartyTypeFromAccountOption(account);
  const mode = partyType ? getReceiptLineMode(partyType) : null;
  return { account, partyType, mode };
}

export function getSimplifiedReceiptPartyHeaderLabel(lines, accountOptions) {
  const labels = new Set();
  (lines || []).forEach((line) => {
    const { partyType } = resolveReceiptLineContextFromLine(line, accountOptions);
    if (partyType === "Tenant") labels.add("Tenant");
    if (partyType === "CustomerSupplier") labels.add("Customer");
  });
  if (labels.size === 1) {
    return labels.has("Tenant") ? "Tenant" : "Customer";
  }
  if (labels.size > 1) return "Tenant / Customer";
  return "Party";
}

export function filterReceiptLineAccountOptions(options, receiptPartyType) {
  const type = String(receiptPartyType || "").trim();
  if (!type) return [];
  return (options || []).filter((option) => {
    if (!isCollectionAccountCoaOption(option)) return false;
    const control = String(option?.controlAccount || "").trim();
    if (type === "Tenant") return isTenantOrTenantsControlAccount(control);
    if (type === "CustomerSupplier") {
      return isCustomersControlAccount(control) || isSupplierOrSuppliersControlAccount(control);
    }
    if (type === "RevenueExpense" || type === "ItemBasedRevenueExpense") {
      if (!isReceiptPartyCoaOption(option)) return false;
      return (
        !isTenantOrTenantsControlAccount(control) &&
        !isCustomersControlAccount(control) &&
        !isSupplierOrSuppliersControlAccount(control)
      );
    }
    return true;
  });
}

export function filterReceiptLineEntityPartyOptions(partyOptions, receiptPartyType, lineAccount) {
  const type = String(receiptPartyType || "").trim();
  if (!type || isRevenueExpenseReceiptPartyType(type)) return [];
  let filtered = (partyOptions || []).filter((party) => {
    if (type === "Tenant") return party.type === "Tenant";
    if (type === "CustomerSupplier") return party.type === "Customer" || party.type === "Supplier";
    return false;
  });
  const selectedControlAccount = String(lineAccount?.controlAccount || "")
    .trim()
    .toLowerCase();
  if (selectedControlAccount) {
    filtered = filtered.filter(
      (party) =>
        String(party.coaControlAccount || "")
          .trim()
          .toLowerCase() === selectedControlAccount
    );
  }
  if (lineAccount?.coaId && type === "Tenant") {
    filtered = filtered.filter(
      (party) => party?.coaId && Number(party.coaId) === Number(lineAccount.coaId)
    );
  }
  return filtered;
}

export function computeReceiptLineTotal(line, mode) {
  if (isReceiptQtyMode(mode)) {
    const amount = parseAmount(line?.amount);
    const discountPercent = Math.max(0, parseAmount(line?.discount));
    const taxPercent = Math.max(0, parseAmount(line?.tax));
    const discounted = amount - (amount * discountPercent) / 100;
    return Math.max(0, discounted + (discounted * taxPercent) / 100);
  }
  return computeLineTotal(line);
}

export function syncReceiptLineAmount(line, mode) {
  if (isReceiptQtyMode(mode)) {
    const qty = parseAmount(line?.quantity);
    const unitPrice = parseAmount(line?.unitPrice);
    const base = qty * unitPrice;
    const updated = {
      ...line,
      amount: base > 0 ? String(base) : "",
    };
    updated.total = computeReceiptLineTotal(updated, mode);
    return updated;
  }
  const updated = { ...line };
  updated.total = computeReceiptLineTotal(updated, mode);
  return updated;
}

export function computeReceiptGrandTotal(lines, mode) {
  return (lines || []).reduce((sum, line) => sum + computeReceiptLineTotal(line, mode), 0);
}

export function isReceiptLayoutLineComplete(line, mode) {
  if (!line) return false;
  if (mode === RECEIPT_LINE_MODES.ITEM_BASED) {
    return (
      Boolean(String(line.productKey || line.item || "").trim()) &&
      Boolean(String(line.account || "").trim()) &&
      parseAmount(line.quantity) > 0 &&
      parseAmount(line.unitPrice) > 0
    );
  }
  if (mode === RECEIPT_LINE_MODES.ACCOUNT_QTY) {
    return (
      Boolean(String(line.account || "").trim()) &&
      parseAmount(line.quantity) > 0 &&
      parseAmount(line.unitPrice) > 0
    );
  }
  if (isReceiptInvoiceMode(mode)) {
    return Boolean(String(line.account || "").trim()) && parseAmount(line.amount) > 0;
  }
  return isReceiptLineComplete(line, { requireItem: false, requireAccount: true });
}

function unwrapProductList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

/** Active services and goods from products/services and products/goods modules. */
export async function fetchReceiptProductOptions() {
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
      saleAccountRef: row.saleAccountRef,
      saleAccountDisplay: row.saleAccountDisplay,
      defaultUnitPrice: row.defaultUnitPriceSales,
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
      saleAccountRef: row.saleAccountRef,
      saleAccountDisplay: row.saleAccountDisplay,
      defaultUnitPrice: row.defaultUnitPriceSales,
      uom: row.uom,
    }))
    .filter((row) => row.value && row.label);

  return [...services, ...goods].sort((a, b) => a.label.localeCompare(b.label));
}

export function resolveReceiptProductAccountOption(product, accountOptions) {
  if (!product) return null;
  const { coaId, incomeStatementId } = parseAccountRef(product.saleAccountRef);
  if (coaId != null && coaId > 0) {
    const match = (accountOptions || []).find(
      (option) => Number(option.coaId ?? option.id) === Number(coaId)
    );
    if (match) return match;
  }
  const display = String(product.saleAccountDisplay || "")
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
      label: product.saleAccountDisplay || `IS Account ${incomeStatementId}`,
      value: `is:${incomeStatementId}`,
      coaId: "",
    };
  }
  return product.saleAccountDisplay
    ? { label: product.saleAccountDisplay, value: product.saleAccountDisplay, coaId: "" }
    : null;
}

export function shouldShowReceiptItemColumn(receiptLineMode) {
  if (!receiptLineMode) return true;
  return receiptLineMode !== RECEIPT_LINE_MODES.ACCOUNT_QTY;
}
export function buildReceiptLinePartyOptions(partyOptions, lineAccountOptions) {
  const byKey = new Map();

  (partyOptions || []).forEach((party) => {
    if (!party?.value) return;
    byKey.set(party.value, normalizeEntityReceiptPartyOption(party));
  });

  const partyCoaIds = new Set(
    (partyOptions || [])
      .map((party) => Number(party?.coaId))
      .filter((id) => Number.isFinite(id) && id > 0)
  );

  (lineAccountOptions || []).forEach((option) => {
    if (!isReceiptPartyCoaOption(option)) return;
    const coaId = Number(option?.coaId ?? option?.id);
    if (partyCoaIds.has(coaId)) return;
    const normalized = normalizeCoaReceiptPartyOption(option);
    if (normalized?.value) byKey.set(normalized.value, normalized);
  });

  return [...byKey.values()].sort(compareReceiptPartyOptions);
}

export function buildReceivedInCoaOptions(coaRows, { includeCoaIds = [] } = {}) {
  const includeSet = new Set(
    (includeCoaIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  );

  const byKey = new Map();

  (coaRows || []).forEach((row) => {
    const rowId = Number(row?.id ?? row?.Id);
    if (!isCashAndBankCoaOption(row) && !includeSet.has(rowId)) return;
    const option = normalizeLineAccountOption(row);
    if (!option?.value) return;
    byKey.set(option.value, option);
  });

  return [...byKey.values()].sort(compareLineAccountOptions);
}

export function buildReceivedInCashAndBankOptions(
  cashAndBankRows,
  { includeCoaIds = [], includeLedgerIds = [], savedLabelByCoaId = {}, modeFilter = null } = {}
) {
  const includeCoaSet = new Set(
    (includeCoaIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  );
  const includeLedgerSet = new Set(
    (includeLedgerIds || []).map((id) => Number(id)).filter((id) => Number.isFinite(id) && id > 0)
  );
  const byLedgerId = new Map();

  (cashAndBankRows || []).forEach((row) => {
    if (modeFilter && !modeFilter(row)) return;
    const ledgerId = row?.id ?? row?.Id;
    if (ledgerId == null || ledgerId === "") return;
    const coaId = row?.coaId ?? row?.CoaId;
    if (coaId == null || coaId === "") return;
    const label = getCashAndBankLedgerDropdownLabel(row);
    if (!label) return;
    const numericLedgerId = Number(ledgerId);
    const numericCoaId = Number(coaId);
    byLedgerId.set(String(numericLedgerId), {
      value: String(numericLedgerId),
      coaId: numericCoaId,
      id: numericLedgerId,
      cashAndBankAccountId: numericLedgerId,
      acctId: pickField(row, "acctId", "AcctId"),
      acctName: pickField(row, "name", "Name"),
      mode: pickField(row, "mode", "Mode"),
      label,
    });
  });

  includeLedgerSet.forEach((ledgerId) => {
    const key = String(ledgerId);
    if (byLedgerId.has(key)) return;
    const savedRow = (cashAndBankRows || []).find(
      (row) => Number(row?.id ?? row?.Id) === Number(ledgerId)
    );
    const coaId = savedRow?.coaId ?? savedRow?.CoaId;
    const label =
      getCashAndBankLedgerDropdownLabel(savedRow) ||
      String(savedLabelByCoaId[coaId] ?? savedLabelByCoaId[String(coaId)] ?? "").trim() ||
      String(ledgerId);
    byLedgerId.set(key, {
      value: key,
      coaId: coaId != null && coaId !== "" ? Number(coaId) : "",
      id: Number(ledgerId),
      cashAndBankAccountId: Number(ledgerId),
      acctId: pickField(savedRow, "acctId", "AcctId"),
      acctName: pickField(savedRow, "name", "Name"),
      mode: pickField(savedRow, "mode", "Mode"),
      label,
    });
  });

  includeCoaSet.forEach((coaId) => {
    const hasLedger = [...byLedgerId.values()].some(
      (option) => Number(option.coaId) === Number(coaId)
    );
    if (hasLedger) return;
    const key = String(coaId);
    const savedLabel = String(savedLabelByCoaId[coaId] ?? savedLabelByCoaId[key] ?? "").trim();
    byLedgerId.set(`coa-${key}`, {
      value: key,
      coaId,
      label: savedLabel || key,
      acctId: "",
      acctName: "",
    });
  });

  return [...byLedgerId.values()].sort((a, b) =>
    String(a.label).localeCompare(String(b.label), undefined, { sensitivity: "base" })
  );
}

export function buildReceiptFormState(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    month: currentMonthYear(),
    referenceAutomatic: true,
    reference: "",
    paidFrom: "",
    receivedInCoaId: "",
    cashAndBankAccountId: "",
    receiptPartyType: "",
    payeeContactType: "",
    payeePartyKey: "",
    payeePartyId: "",
    payeePartyCode: "",
    payeeName: "",
    description: "",
    finalizedByAhq: false,
    lines: [],
    ...overrides,
  };
}

export const RECEIPT_REFERENCE_PREFIX = "RV";

export function getReceiptYearFromDate(dateValue) {
  const text = String(dateValue || "").trim();
  if (!text) return new Date().getFullYear();
  const match = text.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).getFullYear();
  return new Date().getFullYear();
}

export function parseReceiptReference(reference) {
  const match = String(reference || "")
    .trim()
    .match(/^RV-(\d+)\/(\d{4})$/i);
  if (!match) return null;
  const sequence = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isFinite(sequence) || !Number.isFinite(year)) return null;
  return { sequence, year };
}

export function formatReceiptReference(sequence, year) {
  const seq = Math.max(1, Number(sequence) || 1);
  const yr = Number(year) || new Date().getFullYear();
  return `${RECEIPT_REFERENCE_PREFIX}-${seq}/${yr}`;
}

export function computeNextReceiptReference(existingReferences, dateValue) {
  const year = getReceiptYearFromDate(dateValue);
  let maxSequence = 0;
  (existingReferences || []).forEach((reference) => {
    const parsed = parseReceiptReference(reference);
    if (parsed && parsed.year === year) {
      maxSequence = Math.max(maxSequence, parsed.sequence);
    }
  });
  return formatReceiptReference(maxSequence + 1, year);
}

export async function fetchReceiptReferences(api) {
  if (!api?.listReceipts) return [];
  const response = await api.listReceipts();
  const rows = Array.isArray(response) ? response : response?.data ?? [];
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.reference ?? row?.Reference ?? "").trim())
    .filter(Boolean);
}

export function parseAmount(value) {
  const n = Number(
    String(value ?? "")
      .replace(/,/g, "")
      .trim()
  );
  return Number.isFinite(n) ? n : 0;
}

export function computeLineTotal(line) {
  const amount = parseAmount(line?.amount);
  const rawQuantity = String(line?.quantity ?? "").trim();
  const quantity = rawQuantity === "" ? 1 : parseAmount(rawQuantity);
  const discountPercent = Math.max(0, parseAmount(line?.discount));
  const taxPercent = Math.max(0, parseAmount(line?.tax));
  const gross = amount * Math.max(0, quantity);
  const discounted = gross - (gross * discountPercent) / 100;
  const total = discounted + (discounted * taxPercent) / 100;
  return Number.isFinite(total) ? Math.max(0, total) : 0;
}

export function computeGrandTotal(lines) {
  return (lines || []).reduce((sum, line) => sum + computeLineTotal(line), 0);
}

export function formatAmount(value) {
  const n = parseAmount(value);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function getRacName(racId, options = RAC_OPTIONS) {
  const row = options.find((o) => Number(o.id) === Number(racId));
  return row?.name || "";
}

export function getBaseName(baseId, options = BASE_OPTIONS) {
  const row = options.find((o) => Number(o.id) === Number(baseId));
  return row?.name || "";
}

export function isReceiptFinalizedByAhq(receipt) {
  return Boolean(receipt?.finalizedByAhq);
}

export function normalizeReceiptInvoiceKey(line) {
  const invoiceKey = pickField(line, "invoiceKey", "InvoiceKey");
  const contractNo = pickField(line, "contractNo", "ContractNo");
  const invoiceNo = pickField(line, "invoiceNo", "InvoiceNo");

  if (parseReceiptCollectionEntryOptionValue(invoiceKey)) {
    if (contractNo && invoiceNo) return `${contractNo}|${invoiceNo}`;
    return invoiceNo;
  }

  if (contractNo && invoiceNo) return `${contractNo}|${invoiceNo}`;
  if (!invoiceKey) return invoiceNo;

  if (invoiceKey.includes("|")) {
    const [keyContractNo, keyInvoiceNo] = invoiceKey.split("|");
    const resolvedContractNo = contractNo || String(keyContractNo || "").trim();
    const resolvedInvoiceNo = invoiceNo || String(keyInvoiceNo || "").trim();
    if (resolvedContractNo && resolvedInvoiceNo) {
      return `${resolvedContractNo}|${resolvedInvoiceNo}`;
    }
    return resolvedInvoiceNo || invoiceKey;
  }

  const resolvedInvoiceNo = invoiceNo || invoiceKey;
  return contractNo && resolvedInvoiceNo ? `${contractNo}|${resolvedInvoiceNo}` : resolvedInvoiceNo;
}

export function getReceiptInvoiceKeys(receipt) {
  const keys = new Set();
  (receipt?.lines || []).forEach((line) => {
    const key = normalizeReceiptInvoiceKey(line);
    if (key) keys.add(key);
  });
  return Array.from(keys);
}

export const RECEIPT_AHQ_TAB = {
  PENDING: "pending",
  FINALIZED: "finalized",
};

export function flattenReceiptForGrid(receipt, index, { attachmentCount = 0 } = {}) {
  const firstLine = receipt?.lines?.[0] || {};
  const grandTotal = computeGrandTotal(receipt?.lines);
  return {
    id: receipt.id,
    sno: index + 1,
    date: receipt.date || "",
    month: receipt.month || "",
    reference: receipt.referenceAutomatic ? receipt.reference || "-" : receipt.reference || "",
    paidFrom: receipt.paidFrom || "",
    payee: receipt.payeeName || "-",
    racDisplay: getRacName(firstLine.racId) || "-",
    baseDisplay: getBaseName(firstLine.baseId) || "-",
    item: firstLine.item || (receipt.lines?.length > 1 ? `${receipt.lines.length} items` : "-"),
    account: firstLine.account || "-",
    tinTrn: firstLine.tinTrn || "-",
    amount: grandTotal,
    total: grandTotal,
    attachmentCount,
    _receipt: receipt,
  };
}
