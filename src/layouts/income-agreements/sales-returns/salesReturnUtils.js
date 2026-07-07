import contractApi from "services/api.contract.service";
import {
  buildInvoiceKey,
  formatAgreementLabel,
  formatCollectionInvoiceDropdownLabel,
  formatTenantBusinessLabel,
  getCollectionInvoicesForContract,
  isFinalizedContract,
  normalizeCatalogRow,
  parseInvoiceKey,
  pickField,
} from "layouts/income-agreements/collections/collectionsUtils";
import {
  createLineRow,
  fetchReceiptProductOptions,
  formatAmount,
  parseAmount,
  resolveReceiptProductAccountOption,
} from "layouts/accounts/receipts/receiptUtils";

export { formatAmount, parseAmount };

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  return [];
}

function pickScheduleField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return String(value).trim();
  }
  return "";
}

export function isMainInvoiceScheduleRow(lineRow) {
  if (!lineRow) return false;
  const sub = pickScheduleField(lineRow, "SubInvoiceNo", "subInvoiceNo");
  if (sub === null || sub === undefined) return true;
  const subText = String(sub).trim();
  return subText === "" || subText === "0";
}

export function createSalesReturnLineRow(overrides = {}) {
  return createLineRow({
    particulars: "",
    quantity: "",
    unitPrice: "",
    amount: "",
    discount: "0",
    total: 0,
    ...overrides,
  });
}

export function computeSalesReturnLineAmount(line) {
  const qty = parseAmount(line?.quantity);
  const unitPrice = parseAmount(line?.unitPrice);
  const gross = qty * unitPrice;
  const discountPercent = Math.max(0, parseAmount(line?.discount));
  if (discountPercent <= 0) return gross;
  return gross - (gross * discountPercent) / 100;
}

export function syncSalesReturnLineAmount(line) {
  const normalized = {
    ...line,
    discount: String(line?.discount ?? "").trim() === "" ? "0" : String(line.discount),
  };
  const amount = computeSalesReturnLineAmount(normalized);
  return {
    ...normalized,
    amount: amount > 0 ? String(amount) : "",
    total: amount,
  };
}

export function computeSalesReturnGrandTotal(lines) {
  return (lines || []).reduce((sum, line) => sum + computeSalesReturnLineAmount(line), 0);
}

export function buildSalesReturnFormState(overrides = {}) {
  const today = new Date().toISOString().slice(0, 10);
  return {
    date: today,
    vrNo: "",
    contractCustomerKey: "",
    contractCustomerLabel: "",
    contractId: "",
    contractNo: "",
    customerId: "",
    invoiceKey: "",
    invoiceNo: "",
    invoiceLabel: "",
    description: "",
    lines: [],
    ...overrides,
  };
}

export const SALES_RETURN_VR_NO_PREFIX = "SR";

export function getSalesReturnYearFromDate(dateValue) {
  const text = String(dateValue || "").trim();
  if (!text) return new Date().getFullYear();
  const match = text.match(/^(\d{4})/);
  if (match) return Number(match[1]);
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return new Date(parsed).getFullYear();
  return new Date().getFullYear();
}

export function parseSalesReturnVrNo(vrNo) {
  const match = String(vrNo || "")
    .trim()
    .match(/^SR-(\d+)\/(\d{4})$/i);
  if (!match) return null;
  const sequence = Number(match[1]);
  const year = Number(match[2]);
  if (!Number.isFinite(sequence) || !Number.isFinite(year)) return null;
  return { sequence, year };
}

export function formatSalesReturnVrNo(sequence, year) {
  const seq = Math.max(1, Number(sequence) || 1);
  const yr = Number(year) || new Date().getFullYear();
  return `${SALES_RETURN_VR_NO_PREFIX}-${seq}/${yr}`;
}

export function computeNextSalesReturnVrNo(existingVrNos, dateValue) {
  const year = getSalesReturnYearFromDate(dateValue);
  let maxSequence = 0;
  (existingVrNos || []).forEach((vrNo) => {
    const parsed = parseSalesReturnVrNo(vrNo);
    if (parsed && parsed.year === year) {
      maxSequence = Math.max(maxSequence, parsed.sequence);
    }
  });
  return formatSalesReturnVrNo(maxSequence + 1, year);
}

export async function fetchSalesReturnVrNos(api) {
  if (!api?.listSalesReturns) return [];
  const response = await api.listSalesReturns();
  const rows = Array.isArray(response) ? response : response?.data ?? [];
  return (Array.isArray(rows) ? rows : [])
    .map((row) => String(row?.vrNo ?? row?.VrNo ?? "").trim())
    .filter(Boolean);
}

function formatCustomerLabel(customer) {
  const code = pickField(customer, "code", "Code", "customerCode", "CustomerCode");
  const name = pickField(customer, "name", "Name", "customerName", "CustomerName");
  if (code && name) return `${code} - ${name}`;
  return name || code || "";
}

export function buildSalesReturnContractCustomerOptions(contracts, tenants, customers) {
  const contractOptions = (contracts || [])
    .map(normalizeCatalogRow)
    .filter(isFinalizedContract)
    .map((contract) => {
      const tenant = (tenants || []).find(
        (row) =>
          String(pickField(row, "tenantNo", "TenantNo")).trim() ===
          String(pickField(contract, "tenantNo", "TenantNo")).trim()
      );
      const agreement = formatAgreementLabel(contract);
      const tenantBusiness = formatTenantBusinessLabel(contract, tenant);
      const label = tenantBusiness ? `${agreement} — ${tenantBusiness}` : agreement;
      return {
        value: `contract:${contract.id}`,
        label,
        type: "contract",
        contractId: contract.id,
        contractNo: pickField(contract, "contractNo", "ContractNo"),
      };
    })
    .filter((option) => option.label);

  const customerOptions = (customers || [])
    .map(normalizeCatalogRow)
    .map((customer) => ({
      value: `customer:${customer.id}`,
      label: formatCustomerLabel(customer),
      type: "customer",
      customerId: customer.id,
    }))
    .filter((option) => option.label);

  return [...contractOptions, ...customerOptions].sort((a, b) =>
    a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
  );
}

export function findSalesReturnContractCustomerOption(options, key) {
  const value = String(key || "").trim();
  if (!value) return null;
  return (options || []).find((option) => String(option.value) === value) || null;
}

export function getSalesReturnInvoicesForSelection(
  invoices,
  contractCustomerOption,
  { includeInvoiceKey = "" } = {}
) {
  if (!contractCustomerOption) return [];
  if (contractCustomerOption.type === "contract") {
    return getCollectionInvoicesForContract(invoices, contractCustomerOption, {
      includeInvoiceKey,
    });
  }
  return [];
}

export function formatSalesReturnInvoiceOption(invoice) {
  return {
    value: buildInvoiceKey(invoice),
    label: formatCollectionInvoiceDropdownLabel(invoice),
    invoiceNo: pickField(invoice, "invoiceNo", "InvoiceNo"),
    contractNo: pickField(invoice, "contractNo", "ContractNo"),
  };
}

export function findSalesReturnInvoiceRowByKey(invoiceRows, invoiceKey) {
  const key = String(invoiceKey || "").trim();
  if (!key) return null;
  const parsed = parseInvoiceKey(key);
  return (
    (invoiceRows || []).find((row) => buildInvoiceKey(row) === key) ||
    (invoiceRows || []).find((row) => {
      const contractNo = String(pickField(row, "contractNo", "ContractNo") || "").trim();
      const invoiceNo = String(pickField(row, "invoiceNo", "InvoiceNo") || "").trim();
      return (
        invoiceNo === parsed.invoiceNo &&
        (!parsed.contractNo || contractNo.toLowerCase() === parsed.contractNo.toLowerCase())
      );
    }) ||
    null
  );
}

function findProductByItemCode(productOptions, itemCode) {
  const code = String(itemCode || "")
    .trim()
    .toLowerCase();
  if (!code) return null;
  return (
    (productOptions || []).find((product) => {
      const label = String(product.label || "").toLowerCase();
      return label.startsWith(`${code} -`) || label === code || label.includes(` - ${code}`);
    }) || null
  );
}

function pickInvoiceLineSortOrder(row) {
  const raw =
    pickScheduleField(row, "SortOrder", "sortOrder") ||
    pickScheduleField(row, "InvoiceOrder", "invoiceOrder");
  if (raw === "" || raw == null) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function pickInvoiceLineSubInvoiceNo(lineRow) {
  return pickScheduleField(lineRow, "SubInvoiceNo", "subInvoiceNo");
}

function sortInvoiceScheduleItemRows(rows) {
  return [...(rows || [])].sort((a, b) => {
    const oa = pickInvoiceLineSortOrder(a);
    const ob = pickInvoiceLineSortOrder(b);
    const na = oa !== null ? oa : Number.MAX_SAFE_INTEGER;
    const nb = ob !== null ? ob : Number.MAX_SAFE_INTEGER;
    if (na !== nb) return na - nb;
    const subA = pickInvoiceLineSubInvoiceNo(a);
    const subB = pickInvoiceLineSubInvoiceNo(b);
    return String(subA).localeCompare(String(subB), undefined, { numeric: true });
  });
}

function sortSalesReturnInvoiceScheduleRows(rows) {
  const mainRows = (rows || []).filter((row) => isMainInvoiceScheduleRow(row));
  const itemRows = sortInvoiceScheduleItemRows(
    (rows || []).filter((row) => !isMainInvoiceScheduleRow(row))
  );
  return [...mainRows, ...itemRows];
}

function computeScheduleRowLineAmount(row) {
  const totalRaw =
    pickScheduleField(row, "Total", "total") || pickScheduleField(row, "TotalRent", "totalRent");
  if (totalRaw !== "") {
    const total = parseAmount(totalRaw);
    if (total > 0) return total;
  }

  const qty = parseAmount(
    pickScheduleField(row, "Months", "months") ||
      pickScheduleField(row, "Quantity", "quantity") ||
      "1"
  );
  const unitPrice = parseAmount(
    pickScheduleField(row, "CalculatedRentPM", "calculatedRentPM") ||
      pickScheduleField(row, "UnitPrice", "unitPrice") ||
      pickScheduleField(row, "InitialRentPM", "initialRentPM")
  );
  if (qty <= 0 || unitPrice <= 0) return 0;

  const discount = parseAmount(
    pickScheduleField(row, "Discount", "discount") ||
      pickScheduleField(row, "DiscountPercent", "discountPercent")
  );
  const gross = qty * unitPrice;
  if (discount > 0) return gross - (gross * discount) / 100;
  return gross;
}

function mapInvoiceScheduleRowToSalesReturnLine(row, productOptions, accountOptions) {
  const isMainRow = isMainInvoiceScheduleRow(row);
  const itemCode =
    pickScheduleField(row, "ItemwithCode", "itemwithCode") ||
    pickScheduleField(row, "ItemCode", "itemCode");
  const product = findProductByItemCode(productOptions, itemCode);
  const accountOption = product
    ? resolveReceiptProductAccountOption(product, accountOptions)
    : null;
  const accHead = pickScheduleField(row, "AccHead", "accHead");
  const particulars =
    pickScheduleField(row, "Description", "description") || pickScheduleField(row, "Desc", "desc");
  const qtyRaw =
    pickScheduleField(row, "Months", "months") ||
    pickScheduleField(row, "Quantity", "quantity") ||
    (isMainRow ? "1" : "1");
  const unitPriceRaw =
    pickScheduleField(row, "CalculatedRentPM", "calculatedRentPM") ||
    pickScheduleField(row, "UnitPrice", "unitPrice") ||
    pickScheduleField(row, "InitialRentPM", "initialRentPM");
  const discountRaw =
    pickScheduleField(row, "Discount", "discount") ||
    pickScheduleField(row, "DiscountPercent", "discountPercent");
  const computedAmount = computeScheduleRowLineAmount(row);
  const itemLabel =
    product?.label ||
    itemCode ||
    (isMainRow && particulars ? particulars : "") ||
    (isMainRow ? "Main Invoice" : "");

  const line = createSalesReturnLineRow({
    productKey: product?.value || "",
    productType: product?.productType || "",
    productId: product?.productId || "",
    item: itemLabel,
    account: accountOption?.label || accHead,
    accountCoaId: accountOption?.coaId || accountOption?.value || "",
    particulars,
    quantity: qtyRaw,
    unitPrice: unitPriceRaw,
    discount: discountRaw !== "" ? discountRaw : "0",
    subInvoiceNo: pickInvoiceLineSubInvoiceNo(row),
    sortOrder: pickInvoiceLineSortOrder(row),
    isMainScheduleRow: isMainRow,
  });

  let synced = syncSalesReturnLineAmount(line);

  if (computedAmount > 0 && parseAmount(qtyRaw) <= 0 && !unitPriceRaw) {
    synced = syncSalesReturnLineAmount({
      ...line,
      quantity: "1",
      unitPrice: String(computedAmount),
    });
  } else if (
    computedAmount > 0 &&
    Math.abs(computeSalesReturnLineAmount(synced) - computedAmount) > 0.009
  ) {
    synced = {
      ...synced,
      amount: String(computedAmount),
      total: computedAmount,
    };
  }

  return synced;
}

export async function fetchSalesReturnLinesFromInvoice(invoiceNo, productOptions, accountOptions) {
  const trimmed = String(invoiceNo || "").trim();
  if (!trimmed) return [];
  const response = await contractApi.getInvoiceScheduleByInvoiceNo(trimmed);
  const rows = sortSalesReturnInvoiceScheduleRows(unwrapList(response));
  return rows.map((row) =>
    mapInvoiceScheduleRowToSalesReturnLine(row, productOptions, accountOptions)
  );
}

export function applySalesReturnProductSelection(line, productKey, productOptions, accountOptions) {
  const product = (productOptions || []).find((option) => option.value === productKey);
  if (!product) {
    return syncSalesReturnLineAmount({
      ...line,
      productKey: "",
      productType: "",
      productId: "",
      item: "",
      account: "",
      accountCoaId: "",
    });
  }
  const accountOption = resolveReceiptProductAccountOption(product, accountOptions);
  return syncSalesReturnLineAmount({
    ...line,
    productKey: product.value,
    productType: product.productType || "",
    productId: product.productId || "",
    item: product.label || "",
    account: accountOption?.label || product.saleAccountDisplay || "",
    accountCoaId: accountOption?.coaId || accountOption?.value || "",
    unitPrice:
      line.unitPrice !== "" && line.unitPrice != null
        ? line.unitPrice
        : product.defaultUnitPrice != null && product.defaultUnitPrice !== ""
        ? String(product.defaultUnitPrice)
        : "",
  });
}

export function isSalesReturnLineComplete(line) {
  if (!line) return false;
  return (
    Boolean(String(line.item || "").trim()) &&
    Boolean(String(line.account || "").trim()) &&
    parseAmount(line.quantity) > 0 &&
    parseAmount(line.unitPrice) > 0
  );
}

export function validateSalesReturnForm(form) {
  const errors = {};
  if (!form.date) errors.date = "Date is required";
  if (!String(form.vrNo || "").trim()) errors.vrNo = "Vr No is required";
  if (!String(form.contractCustomerKey || "").trim()) {
    errors.contractCustomerKey = "Contract / Customer is required";
  }
  if (!String(form.invoiceKey || "").trim()) {
    errors.invoiceKey = "Sales Invoice is required";
  }

  const lines = form.lines || [];
  if (!lines.length) errors.lines = "At least one line item is required";

  lines.forEach((line, idx) => {
    if (!line.item) errors[`line-${idx}-item`] = "Item is required";
    if (!line.account) errors[`line-${idx}-account`] = "Account is required";
    if (parseAmount(line.quantity) <= 0) errors[`line-${idx}-quantity`] = "Qty is required";
    if (parseAmount(line.unitPrice) <= 0) {
      errors[`line-${idx}-unitPrice`] = "Unit Price is required";
    }
  });

  return errors;
}

export function flattenSalesReturnForGrid(record, index, { attachmentCount = 0 } = {}) {
  const firstLine = record?.lines?.[0] || {};
  const grandTotal = computeSalesReturnGrandTotal(record?.lines);
  return {
    id: record.id,
    sno: index + 1,
    date: record.date || "",
    vrNo: record.vrNo || "-",
    contractCustomer: record.contractCustomerLabel || "-",
    salesInvoice: record.invoiceLabel || record.invoiceNo || "-",
    description: record.description || "-",
    item: firstLine.item || (record.lines?.length > 1 ? `${record.lines.length} items` : "-"),
    account: firstLine.account || "-",
    total: grandTotal,
    attachmentCount,
    _record: record,
  };
}

export function buildSalesReturnTotalsByInvoiceKey(salesReturns) {
  const totals = {};
  (salesReturns || []).forEach((record) => {
    const key =
      String(record?.invoiceKey || "").trim() ||
      buildInvoiceKey({
        contractNo: record?.contractNo,
        invoiceNo: record?.invoiceNo,
      });
    if (!key) return;
    const amount =
      Number(record?.grandTotal) > 0
        ? Number(record.grandTotal)
        : computeSalesReturnGrandTotal(record?.lines);
    totals[key] = (totals[key] || 0) + (Number.isFinite(amount) ? amount : 0);
  });
  return totals;
}

export function readSalesReturnUrlParams() {
  const empty = { add: false, contractNo: "", invoiceNo: "", contractId: "" };
  if (typeof window === "undefined") return empty;
  try {
    const params = new URLSearchParams(String(window.location?.search || ""));
    return {
      add: params.get("add") === "1" || String(params.get("action") || "").toLowerCase() === "add",
      contractNo: String(params.get("contractNo") || "").trim(),
      invoiceNo: String(params.get("invoiceNo") || "").trim(),
      contractId: String(params.get("contractId") || "").trim(),
    };
  } catch {
    return empty;
  }
}

export function buildSalesReturnAddDeepLink({ contractNo, invoiceNo, contractId } = {}) {
  const params = new URLSearchParams({ add: "1" });
  const cn = String(contractNo || "").trim();
  const inv = String(invoiceNo || "").trim();
  const cid = String(contractId || "").trim();
  if (cn) params.set("contractNo", cn);
  if (inv) params.set("invoiceNo", inv);
  if (cid) params.set("contractId", cid);
  return `/income-agreements/sales-returns?${params.toString()}`;
}

export function buildSalesReturnPrefillFromParams(params = {}) {
  const cn = String(params.contractNo || "").trim();
  const inv = String(params.invoiceNo || "").trim();
  const cid = String(params.contractId || "").trim();
  const invoiceKey = buildInvoiceKey({ contractNo: cn, invoiceNo: inv });
  const contractCustomerLabel = String(params.contractCustomerLabel || "").trim();
  const invoiceLabel =
    String(params.invoiceLabel || "").trim() || (inv && cn ? `${inv}-${cn}` : inv);
  const state = buildSalesReturnFormState({
    contractCustomerKey: cid ? `contract:${cid}` : "",
    contractId: cid,
    contractNo: cn,
    contractCustomerLabel,
    invoiceKey,
    invoiceNo: inv,
    invoiceLabel,
  });
  if (params.lockContractAndInvoice) {
    return { ...state, lockContractAndInvoice: true };
  }
  return state;
}

export function buildSalesReturnPrefillFromAgreementProvInvoiceRow(row = {}) {
  const contractNo = String(pickField(row, "contractNo", "ContractNo") || "").trim();
  const invoiceNo = String(pickField(row, "invoiceNo", "InvoiceNo") || "").trim();
  const contractId = String(pickField(row, "contractId", "ContractId") || "").trim();
  const businessName = String(pickField(row, "businessName", "BusinessName") || "").trim();
  const tenantName = String(pickField(row, "tenantName", "TenantName") || "").trim();
  const tenantPart = businessName || tenantName;
  const contractCustomerLabel = tenantPart ? `${contractNo} — ${tenantPart}` : contractNo;
  return buildSalesReturnPrefillFromParams({
    contractNo,
    invoiceNo,
    contractId,
    contractCustomerLabel,
    lockContractAndInvoice: true,
  });
}

export { fetchReceiptProductOptions as fetchSalesReturnProductOptions };
