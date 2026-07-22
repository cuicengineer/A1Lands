import jsPDF from "jspdf";
import {
  computeCollectionGroupAmounts,
  computeCollectionRowBalance,
  formatAgreementLabel,
  formatAmount,
  formatCollectionInvoiceDropdownLabel,
  formatDisplayDate,
  formatReceiptLineAmount,
  parseAmount,
  parseInvoiceKey,
} from "./collectionsUtils";
import {
  isPersistedCollectionLineId,
  loadCollectionLineAttachmentMeta,
} from "./collectionAttachmentUtils";

const PDF_MARGIN_MM = 10;
const PDF_TITLE_FONT = 14;
const PDF_SECTION_FONT = 11;
const PDF_BODY_FONT = 8;
const PDF_ROW_HEIGHT_MM = 6.5;
const PDF_HEADER_FILL = [200, 230, 201];
const PDF_BORDER = [180, 180, 180];

const COMBINED_TABLE_COLUMNS = [
  { label: "S.No", key: "sno", width: 0.04 },
  { label: "Class", key: "className", width: 0.06 },
  { label: "Agreement", key: "agreement", width: 0.11 },
  { label: "Account", key: "account", width: 0.09 },
  { label: "Tenant and Business", key: "tenantBusiness", width: 0.12 },
  { label: "Invoice", key: "invoice", width: 0.11 },
  { label: "Due", key: "due", width: 0.06 },
  { label: "Balance", key: "balance", width: 0.06 },
  { label: "Date", key: "date", width: 0.07 },
  { label: "TIN-TRN", key: "tinTrn", width: 0.08 },
  { label: "Remarks", key: "remarks", width: 0.09 },
  { label: "Amount", key: "amount", width: 0.06 },
  { label: "Receipt", key: "receipt", width: 0.08 },
];

function cellText(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function buildCollectionDetailFields(parent) {
  const selectedContract = parent?.selectedContract || null;
  const selectedInvoice = parent?.selectedInvoice || null;
  const { invoiceNo } = parseInvoiceKey(parent?.invoiceKey);
  const agreementLabel = selectedContract
    ? formatAgreementLabel(selectedContract)
    : parent?.contractNo || "";
  const invoiceLabel = selectedInvoice
    ? formatCollectionInvoiceDropdownLabel(selectedInvoice)
    : invoiceNo || "";
  const receivable = parseAmount(parent?.invoiceReceivable ?? parent?.receivable);
  const items = Array.isArray(parent?.items) ? parent.items : [];
  const amounts =
    items.length > 0
      ? computeCollectionGroupAmounts(receivable, items)
      : {
          due: Math.max(0, computeCollectionRowBalance(receivable, parent?.amount)),
          balance: computeCollectionRowBalance(receivable, parent?.amount),
        };

  return {
    className: cellText(parent?.className || parent?.classId),
    agreement: cellText(agreementLabel),
    tenantBusiness: cellText(parent?.tenantBusiness),
    account: cellText(parent?.accountLabel),
    invoice: cellText(invoiceLabel),
    due: formatAmount(amounts.due),
    balance: formatAmount(amounts.balance),
  };
}

function formatReceiptAttachmentLabel(line) {
  if (line?.pendingAttachmentFile?.name) return cellText(line.pendingAttachmentFile.name);
  if (line?.hasAttachment || line?.attachmentFileId) {
    return cellText(line?.attachmentFileName || "Attached");
  }
  return "—";
}

function buildCombinedCollectionPdfRows(parent) {
  const collectionFields = buildCollectionDetailFields(parent);
  const lines = Array.isArray(parent?.items) ? parent.items : [];

  if (lines.length === 0) {
    return [
      {
        sno: "—",
        ...collectionFields,
        date: "—",
        tinTrn: "—",
        remarks: "—",
        amount: "—",
        receipt: "—",
      },
    ];
  }

  return lines.map((line, index) => ({
    sno: index + 1,
    ...collectionFields,
    date: formatDisplayDate(line?.date) || cellText(line?.date),
    tinTrn: cellText(line?.tinTrn),
    remarks: cellText(line?.remarks),
    amount: formatReceiptLineAmount(line?.amount),
    receipt: formatReceiptAttachmentLabel(line),
  }));
}

function drawTable(doc, { title, columns, rows, startY, pageHeight }) {
  let y = startY;
  const pageWidth = doc.internal.pageSize.getWidth();
  const contentWidth = pageWidth - PDF_MARGIN_MM * 2;
  const colWidths = columns.map((col) => contentWidth * col.width);

  if (title) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_SECTION_FONT);
    doc.setTextColor(0, 0, 0);
    doc.text(title, PDF_MARGIN_MM, y);
    y += 6;
  }

  const drawHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_BODY_FONT);
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(...PDF_HEADER_FILL);
    doc.setDrawColor(...PDF_BORDER);

    let x = PDF_MARGIN_MM;
    columns.forEach((col, index) => {
      doc.rect(x, y, colWidths[index], PDF_ROW_HEIGHT_MM, "F");
      x += colWidths[index];
    });

    x = PDF_MARGIN_MM;
    columns.forEach((col, index) => {
      doc.rect(x, y, colWidths[index], PDF_ROW_HEIGHT_MM, "S");
      doc.text(col.label, x + 1.5, y + 4.2, { maxWidth: colWidths[index] - 3 });
      x += colWidths[index];
    });
    y += PDF_ROW_HEIGHT_MM;
  };

  drawHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_BODY_FONT);
  doc.setTextColor(0, 0, 0);

  rows.forEach((row) => {
    const values = columns.map((col) => cellText(row[col.key]));
    const wrapped = values.map((text, index) => doc.splitTextToSize(text, colWidths[index] - 3));
    const lineCount = Math.max(1, ...wrapped.map((lines) => lines.length));
    const rowHeight = PDF_ROW_HEIGHT_MM + (lineCount - 1) * 3.2;

    if (y + rowHeight > pageHeight - PDF_MARGIN_MM) {
      doc.addPage();
      y = PDF_MARGIN_MM;
      drawHeader();
    }

    let x = PDF_MARGIN_MM;
    columns.forEach((col, index) => {
      doc.setDrawColor(...PDF_BORDER);
      doc.rect(x, y, colWidths[index], rowHeight);
      doc.text(wrapped[index], x + 1.5, y + 4.2, { maxWidth: colWidths[index] - 3 });
      x += colWidths[index];
    });
    y += rowHeight;
  });

  return y + 6;
}

/**
 * Collection PDF — one table row per receipt line with full collection detail columns.
 */
export async function generateCollectionInvoicePdf(
  parent,
  _marginsInParam = null,
  { openNewTab = true } = {}
) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_TITLE_FONT);
  doc.text("Collection — Draft View", PDF_MARGIN_MM, PDF_MARGIN_MM);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_BODY_FONT + 1);
  doc.setTextColor(80, 80, 80);
  doc.text("", PDF_MARGIN_MM, PDF_MARGIN_MM + 6);

  const y = PDF_MARGIN_MM + 12;

  drawTable(doc, {
    title: null,
    columns: COMBINED_TABLE_COLUMNS,
    rows: buildCombinedCollectionPdfRows(parent),
    startY: y,
    pageHeight,
  });

  const pdfBlob = doc.output("blob");
  if (!openNewTab) return pdfBlob;
  const pdfUrl = URL.createObjectURL(pdfBlob);
  window.open(pdfUrl, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  return pdfBlob;
}

export async function openCollectionInvoicePdf(parent) {
  if (!parent) {
    throw new Error("No collection data available for PDF.");
  }

  const items = Array.isArray(parent.items) ? parent.items : [];
  const itemsWithAttachments = await Promise.all(
    items.map(async (item) => {
      if (!isPersistedCollectionLineId(item?.id)) return item;
      const meta = await loadCollectionLineAttachmentMeta(item.id);
      return { ...item, ...meta };
    })
  );

  await generateCollectionInvoicePdf({ ...parent, items: itemsWithAttachments }, null, {
    openNewTab: true,
  });
}
