export function pickCoaField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function isCoaGroupAssets(groupName) {
  return /^assets$/i.test(String(groupName || "").trim());
}

export function isCoaGroupLiabilities(groupName) {
  return /^liabilities$/i.test(String(groupName || "").trim());
}

export function isTenantOrTenantsControlAccount(controlAccount) {
  return /^(tenant|tenants)$/i.test(String(controlAccount || "").trim());
}

export function isTenantsControlAccount(controlAccount) {
  return /^tenants$/i.test(String(controlAccount || "").trim());
}

export function isCustomersControlAccount(controlAccount) {
  return /^customers?$/i.test(String(controlAccount || "").trim());
}

export function isSupplierOrSuppliersControlAccount(controlAccount) {
  return /^(supplier|suppliers)$/i.test(String(controlAccount || "").trim());
}

export function normalizePartyCoaOption(row) {
  const id = row?.Id ?? row?.id;
  return {
    id: id != null ? Number(id) : null,
    acctId: pickCoaField(row, "acctId", "AcctId"),
    acctName: pickCoaField(row, "acctName", "AcctName"),
    controlAccount: pickCoaField(row, "controlAccount", "ControlAccount"),
    groupName: pickCoaField(row, "groupName", "GroupName"),
  };
}

export function isTenantReceiptCoaOption(option) {
  return (
    isTenantOrTenantsControlAccount(option?.controlAccount) && isCoaGroupAssets(option?.groupName)
  );
}

export function isTenantPayableCoaOption(option) {
  return (
    isTenantsControlAccount(option?.controlAccount) && isCoaGroupLiabilities(option?.groupName)
  );
}

export function isTenantPartyCoaOption(option) {
  return isTenantReceiptCoaOption(option) || isTenantPayableCoaOption(option);
}

export function isCustomerReceiptCoaOption(option) {
  return isCustomersControlAccount(option?.controlAccount) && isCoaGroupAssets(option?.groupName);
}

export function isCustomerPayableCoaOption(option) {
  return (
    isCustomersControlAccount(option?.controlAccount) && isCoaGroupLiabilities(option?.groupName)
  );
}

export function isCustomerPartyCoaOption(option) {
  return isCustomerReceiptCoaOption(option) || isCustomerPayableCoaOption(option);
}

export function isSupplierPayableCoaOption(option) {
  return (
    isSupplierOrSuppliersControlAccount(option?.controlAccount) &&
    isCoaGroupLiabilities(option?.groupName)
  );
}

export function isSupplierReceiptCoaOption(option) {
  return (
    isSupplierOrSuppliersControlAccount(option?.controlAccount) &&
    isCoaGroupAssets(option?.groupName)
  );
}

export function isSupplierPartyCoaOption(option) {
  return isSupplierPayableCoaOption(option) || isSupplierReceiptCoaOption(option);
}

/** Assets-group receipt accounts for tenant, customer, and supplier parties (collections grid). */
export function isCollectionAccountCoaOption(option) {
  if (!isCoaGroupAssets(option?.groupName)) return false;
  return (
    isTenantOrTenantsControlAccount(option?.controlAccount) ||
    isCustomersControlAccount(option?.controlAccount) ||
    isSupplierOrSuppliersControlAccount(option?.controlAccount)
  );
}

export function getPartyCoaDropdownLabel(option) {
  if (option == null) return "";
  const acctId = String(option.acctId ?? "").trim();
  const acctName = String(option.acctName ?? "").trim();
  if (acctId && acctName) return `${acctId} - ${acctName}`;
  return acctId || acctName || "";
}

export function findPartyCoaOption(options, coaId) {
  if (coaId === "" || coaId == null) return null;
  return (options || []).find((option) => Number(option.id) === Number(coaId)) ?? null;
}

export function mergePartyCoaOption(options, option) {
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
