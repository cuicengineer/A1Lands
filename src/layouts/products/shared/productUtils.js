import api, { getActionBy } from "services/api.service";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import incomeStatementApi, { IS_GROUP_OPTIONS } from "services/api.incomestatement.service";

export const PRODUCT_STATUS_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Inactive", label: "Inactive" },
];

export function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function formatCoaLabel(row) {
  const acctId = pickField(row, "acctId", "AcctId");
  const acctName = pickField(row, "acctName", "AcctName");
  if (acctId && acctName) return `${acctId}-${acctName}`;
  return acctName || acctId || "";
}

export function formatIncomeStatementLabel(row) {
  const acctId = pickField(row, "acctId", "AcctId");
  const acctName = pickField(row, "acctName", "AcctName");
  const group = pickField(row, "groupName", "GroupName");
  const base = acctId && acctName ? `${acctId}-${acctName}` : acctName || acctId;
  return group ? `${base} (${group})` : base;
}

export function buildAccountRef(source, id) {
  if (id == null || id === "") return "";
  return `${source}:${id}`;
}

export function parseAccountRef(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { coaId: null, incomeStatementId: null };
  if (raw.startsWith("coa:")) return { coaId: Number(raw.slice(4)), incomeStatementId: null };
  if (raw.startsWith("is:")) return { coaId: null, incomeStatementId: Number(raw.slice(3)) };
  return { coaId: null, incomeStatementId: null };
}

export function accountRefFromRecord(coaId, incomeStatementId) {
  if (incomeStatementId != null && incomeStatementId !== "" && Number(incomeStatementId) > 0) {
    return buildAccountRef("is", incomeStatementId);
  }
  if (coaId != null && coaId !== "" && Number(coaId) > 0) {
    return buildAccountRef("coa", coaId);
  }
  return "";
}

export function resolveAccountRefFromRow(row, coaKeys, incomeStatementKeys, refKeys = []) {
  const coaId = coaKeys.reduce((value, key) => value ?? row?.[key], undefined);
  const incomeStatementId = incomeStatementKeys.reduce(
    (value, key) => value ?? row?.[key],
    undefined
  );
  const fromIds = accountRefFromRecord(coaId, incomeStatementId);
  if (fromIds) return fromIds;
  for (let i = 0; i < refKeys.length; i += 1) {
    const ref = pickField(row, refKeys[i]);
    if (ref) return ref;
  }
  return "";
}

export function normalizeItemCode(value) {
  return String(value ?? "").trim();
}

export function formatProductItemCode(value) {
  return normalizeItemCode(value).toUpperCase();
}

export const PRODUCT_GOOD_ITEM_CODE_PREFIX = "VGI";
export const PRODUCT_SERVICE_ITEM_CODE_PREFIX = "MR";
export const PRODUCT_ITEM_CODE_NUM_WIDTH = 9;

export function parseProductItemCodeNumber(itemCode, prefix) {
  const raw = normalizeItemCode(itemCode).toUpperCase();
  const normalizedPrefix = String(prefix ?? "")
    .trim()
    .toUpperCase();
  if (!normalizedPrefix || !raw.startsWith(normalizedPrefix)) return null;
  const numPart = raw.slice(normalizedPrefix.length);
  if (!/^\d+$/.test(numPart)) return null;
  const num = parseInt(numPart, 10);
  if (!Number.isFinite(num)) return null;
  return { num, width: numPart.length };
}

export function generateNextProductItemCode(
  existingItemCodes,
  prefix,
  defaultWidth = PRODUCT_ITEM_CODE_NUM_WIDTH
) {
  const normalizedPrefix = String(prefix ?? "")
    .trim()
    .toUpperCase();
  let maxNum = 0;
  let width = defaultWidth;
  (existingItemCodes || []).forEach((row) => {
    const code = pickField(row, "itemCode", "ItemCode");
    const parsed = parseProductItemCodeNumber(code, normalizedPrefix);
    if (!parsed) return;
    if (parsed.num >= maxNum) {
      maxNum = parsed.num;
      width = Math.max(width, parsed.width);
    }
  });
  return `${normalizedPrefix}${String(maxNum + 1).padStart(width, "0")}`;
}

export function isDuplicateProductItemCode(itemCode, existingItemCodes, excludeId) {
  const code = formatProductItemCode(itemCode);
  if (!code) return false;
  const exclude = excludeId != null && excludeId !== "" ? Number(excludeId) : null;
  return (existingItemCodes || []).some((row) => {
    const rowId = row?.id ?? row?.Id;
    if (exclude != null && Number(rowId) === exclude) return false;
    const rowCode = formatProductItemCode(row?.itemCode ?? row?.ItemCode);
    return rowCode === code;
  });
}

export function withSelectedAccountOption(options, selectedRef, fallbackLabel) {
  const list = Array.isArray(options) ? options : [];
  if (!selectedRef || list.some((opt) => opt.ref === selectedRef)) return list;
  return [{ ref: selectedRef, label: fallbackLabel || selectedRef }, ...list];
}

export function isCoaExcludeAssets(row) {
  const group = pickField(row, "groupName", "GroupName").toLowerCase();
  return group !== "assets";
}

export function isCoaInventoryAsset(row) {
  const group = pickField(row, "groupName", "GroupName").toLowerCase();
  const control = pickField(row, "controlAccount", "ControlAccount").toLowerCase();
  return group === "assets" && (control === "inventory" || control.includes("inventory"));
}

export function isIncomeStatementRevenueOrExpense(row) {
  const group = pickField(row, "groupName", "GroupName").toLowerCase();
  return IS_GROUP_OPTIONS.some((g) => g.toLowerCase() === group);
}

export function formatAccountingNumber(value) {
  if (value == null || value === "") return "-";
  const n = Number(value);
  if (!Number.isFinite(n)) return "-";
  return n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function formatTaxCodeLabel(row) {
  const code = pickField(row, "code", "Code");
  const description = pickField(row, "description", "Description");
  if (code && description) return `${code} ${description}`.trim();
  return code || description || "";
}

export function normalizeProductUomOption(row) {
  const code = pickField(row, "code", "Code");
  if (!code) return null;
  const name = pickField(row, "name", "Name");
  return {
    id: row?.id ?? row?.Id,
    value: code,
    label: code,
    name,
    code,
    status: pickField(row, "status", "Status") || "Active",
  };
}

export function buildProductUomPayload(form) {
  return {
    Code: String(form.code ?? "")
      .trim()
      .toUpperCase(),
    Name: String(form.name ?? "").trim() || null,
    Status: String(form.status ?? "Active").trim() || "Active",
  };
}

export function validateProductUomForm(form) {
  const errors = {};
  if (!String(form?.code ?? "").trim()) errors.code = "Code is required";
  return errors;
}

export async function fetchProductUomOptions() {
  const response = await api.request("GET", "/api/ProductUoms");
  const list = Array.isArray(response) ? response : response?.data ?? [];
  return list.map(normalizeProductUomOption).filter(Boolean);
}

export function buildProductUomLookup(options) {
  const map = {};
  (options || []).forEach((option) => {
    const code = String(option?.value ?? option?.code ?? "").trim();
    if (!code) return;
    map[code.toUpperCase()] = option;
  });
  return map;
}

export function formatProductUomLabel(code, uomLookup = {}) {
  const raw = String(code ?? "").trim();
  if (!raw) return "-";
  const match = uomLookup[raw.toUpperCase()];
  if (match?.code) return match.code;
  if (match?.value) return match.value;
  return raw;
}

export async function createProductUom(form) {
  const actionBy = await getActionBy();
  const response = await api.request("POST", "/api/ProductUoms", {
    ...buildProductUomPayload(form),
    Action: "Create",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
  return normalizeProductUomOption(response);
}

export async function updateProductUom(id, form) {
  const actionBy = await getActionBy();
  const payload = buildProductUomPayload(form);
  await api.request("PUT", `/api/ProductUoms/${id}`, {
    ...payload,
    Id: id,
    Action: "Update",
    ActionBy: actionBy,
    ActionDate: new Date().toISOString(),
    IsDeleted: false,
  });
  return normalizeProductUomOption({
    id,
    Id: id,
    Code: payload.Code,
    Name: payload.Name,
    Status: payload.Status,
  });
}

export async function fetchTaxCodeOptions() {
  const response = await api.request("GET", "/api/TaxCodes");
  const list = Array.isArray(response) ? response : response?.data ?? [];
  return list
    .map((row) => ({
      id: row?.id ?? row?.Id,
      label: formatTaxCodeLabel(row),
    }))
    .filter((row) => row.id != null);
}

export async function fetchServiceAccountOptions() {
  const [coaResponse, isResponse] = await Promise.all([
    chartOfAccountsApi.getAll(COA_SECTION_TYPE),
    incomeStatementApi.getAll(),
  ]);
  const coaRows = (chartOfAccountsApi.unwrapList(coaResponse) || [])
    .filter(isCoaExcludeAssets)
    .map((row) => ({
      ref: buildAccountRef("coa", row?.id ?? row?.Id),
      label: formatCoaLabel(row),
    }))
    .filter((row) => row.ref);
  const isRows = (incomeStatementApi.unwrapList(isResponse) || [])
    .map((row) => ({
      ref: buildAccountRef("is", row?.id ?? row?.Id),
      label: formatIncomeStatementLabel(row),
    }))
    .filter((row) => row.ref);
  return [...isRows, ...coaRows];
}

export async function fetchGoodsControlAccountOptions() {
  const response = await chartOfAccountsApi.getAll(COA_SECTION_TYPE);
  return (chartOfAccountsApi.unwrapList(response) || [])
    .filter(isCoaInventoryAsset)
    .map((row) => ({
      id: row?.id ?? row?.Id,
      label: formatCoaLabel(row),
    }))
    .filter((row) => row.id != null);
}

export async function fetchGoodsRevenueExpenseOptions() {
  const response = await incomeStatementApi.getAll();
  return (incomeStatementApi.unwrapList(response) || [])
    .filter(isIncomeStatementRevenueOrExpense)
    .map((row) => ({
      ref: buildAccountRef("is", row?.id ?? row?.Id),
      label: formatIncomeStatementLabel(row),
    }))
    .filter((row) => row.ref);
}

export async function fetchProductItemCodes(api) {
  if (!api?.getAll) return [];
  const response =
    typeof api.getAllUnpaged === "function" ? await api.getAllUnpaged() : await api.getAll(1, 0);
  const rows = Array.isArray(response) ? response : response?.data ?? [];
  return Array.isArray(rows) ? rows : [];
}

export function buildServicePayload(form) {
  const sale = parseAccountRef(form.saleAccountRef);
  const purchase = parseAccountRef(form.purchaseAccountRef);
  return {
    ItemCode: formatProductItemCode(form.itemCode),
    ItemName: String(form.itemName ?? "").trim(),
    Uom: String(form.uom ?? "").trim() || null,
    SaleAccountCoaId: sale.coaId,
    SaleAccountIncomeStatementId: sale.incomeStatementId,
    PurchaseAccountCoaId: purchase.coaId,
    PurchaseAccountIncomeStatementId: purchase.incomeStatementId,
    DefaultParticulars: String(form.defaultParticulars ?? "").trim() || null,
    DefaultUnitPriceSales: Number(form.defaultUnitPriceSales || 0),
    DefaultUnitPricePurchase: Number(form.defaultUnitPricePurchase || 0),
    TaxCodeId: form.taxCodeId === "" || form.taxCodeId == null ? null : Number(form.taxCodeId),
    Status: String(form.status ?? "Active").trim() || "Active",
  };
}

export function buildGoodPayload(form) {
  const sale = parseAccountRef(form.saleAccountRef);
  const purchase = parseAccountRef(form.purchaseAccountRef);
  return {
    ItemCode: formatProductItemCode(form.itemCode),
    ItemName: String(form.itemName ?? "").trim(),
    Uom: String(form.uom ?? "").trim() || null,
    ControlAccountCoaId:
      form.controlAccountCoaId === "" || form.controlAccountCoaId == null
        ? null
        : Number(form.controlAccountCoaId),
    SaleAccountIncomeStatementId: sale.incomeStatementId,
    PurchaseAccountIncomeStatementId: purchase.incomeStatementId,
    DefaultParticulars: String(form.defaultParticulars ?? "").trim() || null,
    DefaultUnitPriceSales: Number(form.defaultUnitPriceSales || 0),
    DefaultUnitPricePurchase: Number(form.defaultUnitPricePurchase || 0),
    TaxCodeId: form.taxCodeId === "" || form.taxCodeId == null ? null : Number(form.taxCodeId),
    Status: String(form.status ?? "Active").trim() || "Active",
  };
}

export function normalizeServiceRecord(row) {
  return {
    id: row?.id ?? row?.Id,
    itemCode: pickField(row, "itemCode", "ItemCode"),
    itemName: pickField(row, "itemName", "ItemName"),
    uom: pickField(row, "uom", "Uom"),
    saleAccountRef: resolveAccountRefFromRow(
      row,
      ["saleAccountCoaId", "SaleAccountCoaId"],
      ["saleAccountIncomeStatementId", "SaleAccountIncomeStatementId"],
      ["saleAccountRef", "SaleAccountRef"]
    ),
    purchaseAccountRef: resolveAccountRefFromRow(
      row,
      ["purchaseAccountCoaId", "PurchaseAccountCoaId"],
      ["purchaseAccountIncomeStatementId", "PurchaseAccountIncomeStatementId"],
      ["purchaseAccountRef", "PurchaseAccountRef"]
    ),
    defaultParticulars: pickField(row, "defaultParticulars", "DefaultParticulars"),
    defaultUnitPriceSales: row?.defaultUnitPriceSales ?? row?.DefaultUnitPriceSales ?? "",
    defaultUnitPricePurchase: row?.defaultUnitPricePurchase ?? row?.DefaultUnitPricePurchase ?? "",
    taxCodeId: row?.taxCodeId ?? row?.TaxCodeId ?? "",
    status: pickField(row, "status", "Status") || "Active",
    saleAccountDisplay: pickField(row, "saleAccountDisplay", "SaleAccountDisplay"),
    purchaseAccountDisplay: pickField(row, "purchaseAccountDisplay", "PurchaseAccountDisplay"),
    taxCodeDisplay: pickField(row, "taxCodeDisplay", "TaxCodeDisplay"),
  };
}

export function normalizeGoodRecord(row) {
  return {
    id: row?.id ?? row?.Id,
    itemCode: pickField(row, "itemCode", "ItemCode"),
    itemName: pickField(row, "itemName", "ItemName"),
    uom: pickField(row, "uom", "Uom"),
    controlAccountCoaId: row?.controlAccountCoaId ?? row?.ControlAccountCoaId ?? "",
    saleAccountRef: resolveAccountRefFromRow(
      row,
      ["saleAccountCoaId", "SaleAccountCoaId"],
      ["saleAccountIncomeStatementId", "SaleAccountIncomeStatementId"],
      ["saleAccountRef", "SaleAccountRef"]
    ),
    purchaseAccountRef: resolveAccountRefFromRow(
      row,
      ["purchaseAccountCoaId", "PurchaseAccountCoaId"],
      ["purchaseAccountIncomeStatementId", "PurchaseAccountIncomeStatementId"],
      ["purchaseAccountRef", "PurchaseAccountRef"]
    ),
    defaultParticulars: pickField(row, "defaultParticulars", "DefaultParticulars"),
    defaultUnitPriceSales: row?.defaultUnitPriceSales ?? row?.DefaultUnitPriceSales ?? "",
    defaultUnitPricePurchase: row?.defaultUnitPricePurchase ?? row?.DefaultUnitPricePurchase ?? "",
    taxCodeId: row?.taxCodeId ?? row?.TaxCodeId ?? "",
    status: pickField(row, "status", "Status") || "Active",
    controlAccountDisplay: pickField(row, "controlAccountDisplay", "ControlAccountDisplay"),
    saleAccountDisplay: pickField(row, "saleAccountDisplay", "SaleAccountDisplay"),
    purchaseAccountDisplay: pickField(row, "purchaseAccountDisplay", "PurchaseAccountDisplay"),
    taxCodeDisplay: pickField(row, "taxCodeDisplay", "TaxCodeDisplay"),
  };
}

export function validateServiceForm(form, options = {}) {
  const errors = {};
  const { excludeId, existingItemCodes } = options;
  const itemCode = formatProductItemCode(form?.itemCode);
  if (!itemCode) errors.itemCode = "Item Code is required";
  else if (isDuplicateProductItemCode(itemCode, existingItemCodes, excludeId)) {
    errors.itemCode = "Item Code must be unique";
  }
  if (!String(form?.itemName ?? "").trim()) errors.itemName = "Item Name is required";
  return errors;
}

export function validateGoodForm(form, options = {}) {
  const errors = validateServiceForm(form, options);
  if (form?.controlAccountCoaId === "" || form?.controlAccountCoaId == null) {
    errors.controlAccountCoaId = "Control Account is required";
  }
  return errors;
}
