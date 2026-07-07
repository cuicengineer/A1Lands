import * as XLSX from "xlsx";
import { deriveCollectionEntryStatus } from "./collectionReceiptUtils";
import {
  enrichCollectionGridRow,
  formatAgreementLabel,
  formatAmount,
  formatDisplayDate,
  resolveCollectionInvoiceContext,
} from "./collectionsUtils";

export const COLLECTION_EXPORT_COLUMNS = [
  { header: "S.No", key: "sno", gridKey: "sno" },
  { header: "Class", key: "class", gridKey: "class" },
  { header: "Agreement", key: "agreement", gridKey: "agreement" },
  { header: "Account", key: "account", gridKey: "account" },
  { header: "Tenant and Business", key: "tenantBusiness", gridKey: "tenantBusiness" },
  { header: "Invoice", key: "invoice", gridKey: "invoice" },
  { header: "Receivable", key: "receivable", gridKey: "receivable" },
  { header: "Balance", key: "balance", gridKey: "balance" },
  { header: "Amount", key: "amount", gridKey: "amount" },
  { header: "TIN-TRN", key: "tinTrn", gridKey: "tinTrn" },
  { header: "Status", key: "status", gridKey: "status" },
  { header: "Vr No", key: "vrNo", gridKey: "vrNo" },
  { header: "Vr Date", key: "vrDate", gridKey: "vrDate" },
];

export function getCollectionExportColumns(hiddenColumnKeys = []) {
  const hidden = new Set(hiddenColumnKeys || []);
  return COLLECTION_EXPORT_COLUMNS.filter((col) => !hidden.has(col.gridKey));
}

export function buildCollectionGridExportSheetRows(
  rows,
  { contracts, tenants, customers = [], suppliers = [], coaOptions, invoices, classOptions } = {},
  { canEditStatus = false } = {}
) {
  const allRows = rows || [];
  return allRows.map((row, index) => {
    const enriched = enrichCollectionGridRow(row, {
      contracts,
      tenants,
      customers,
      suppliers,
      coaOptions,
      invoices,
      classes: classOptions,
      allRows,
    });
    const invoiceContext = resolveCollectionInvoiceContext(
      enriched,
      enriched.selectedContract,
      invoices
    );
    const status = deriveCollectionEntryStatus(enriched, { allowManualOverride: canEditStatus });

    return {
      sno: index + 1,
      class: enriched.className || enriched.classId || "",
      agreement: enriched.selectedContract ? formatAgreementLabel(enriched.selectedContract) : "",
      tenantBusiness: enriched.tenantBusiness || "",
      account: enriched.accountLabel || "",
      invoice: invoiceContext.label || "",
      receivable: formatAmount(enriched.receivable),
      balance: formatAmount(enriched.balance),
      amount: formatAmount(enriched.amount),
      tinTrn: enriched.tinTrn || "",
      status,
      vrNo: enriched.vrNo || "",
      vrDate: enriched.vrDate ? formatDisplayDate(enriched.vrDate) : "",
    };
  });
}

export function exportCollectionsGridToExcel(
  rows,
  context,
  { fileName = "Collections", canEditStatus = false, hiddenColumnKeys = [] } = {}
) {
  const exportColumns = getCollectionExportColumns(hiddenColumnKeys);
  const sheetRows = buildCollectionGridExportSheetRows(rows, context, { canEditStatus });
  const headerRow = exportColumns.map((col) => col.header);
  const bodyRows = sheetRows.map((row) => exportColumns.map((col) => row[col.key] ?? ""));
  const ws = XLSX.utils.aoa_to_sheet([headerRow, ...bodyRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Collections");
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  XLSX.writeFile(wb, `${fileName}-${ts}.xlsx`);
}
