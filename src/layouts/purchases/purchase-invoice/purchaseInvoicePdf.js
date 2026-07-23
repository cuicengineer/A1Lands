import jsPDF from "jspdf";
import accountingSysApi from "services/api.accountingsys.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  agreementProvPdfMarginsInchesToMm,
  createAgreementProvPdfScaleHelpers,
  loadPurchaseInvoicePdfMargins,
} from "utils/agreementProvPdfMargins";
import { addContractPdfWatermarks } from "layouts/contracts/contracts/contractPdfWatermark";
import {
  computePurchaseInvoiceGrandTotal,
  getPurchaseInvoiceLineComputedTotal,
  normalizePurchaseInvoiceLine,
} from "./purchaseInvoiceUtils";

export const PURCHASE_INVOICE_PDF_SELECTABLE_COLUMNS = [
  { key: "itemCode", label: "Item" },
  { key: "particular", label: "Particular" },
  { key: "accHead", label: "Acc Head" },
  { key: "qty", label: "Qty" },
  { key: "unitPrice", label: "Unit Price" },
  { key: "disc", label: "Disc" },
];

export const PURCHASE_INVOICE_PDF_DEFAULT_COLUMN_KEYS = [
  "itemCode",
  "particular",
  "accHead",
  "qty",
  "unitPrice",
  "disc",
];

export function createDefaultPurchaseInvoicePdfColumnKeys() {
  return new Set(PURCHASE_INVOICE_PDF_DEFAULT_COLUMN_KEYS);
}

function resolvePurchaseInvoicePdfColumnKeys(columnKeys) {
  if (columnKeys instanceof Set) return columnKeys;
  if (Array.isArray(columnKeys)) return new Set(columnKeys);
  return createDefaultPurchaseInvoicePdfColumnKeys();
}

const PDF_FONT_TITLE = 18;
const PDF_FONT_BODY = 9;
const PDF_FONT_PARTICULARS_MIN = 5;
const PDF_FONT_CELL_START = 8;
const PDF_FONT_CELL_MIN = 5.5;
const PDF_TEXT_MAX_LINES = 2;
const PDF_TEXT_LINE_STEP_RATIO = 0.9;
const PDF_LINE_HEIGHT_MM = 5;
const PDF_VALUE_UNDERLINE_GAP_MM = 0.75;
const VOUCHER_PDF_SIGNATURE_BLOCKS = [
  "Prepared By",
  "Checked By",
  "Authorized By",
  "Counter Signed",
];
const VOUCHER_PDF_SIGNATURE_BLANK_LINES = 7;

function formatPdfDate(dateString) {
  const formatted = formatDateDDMMMYYYY(dateString);
  return formatted || "—";
}

function formatPdfCurrency(value) {
  if (value === null || value === undefined || value === "") return "0";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
}

function formatPdfQty(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

function getPdfRowCenteredBaselineY(rowTop, rowBandHeight, textHeight) {
  return rowTop + (rowBandHeight + textHeight) / 2 - textHeight * 0.12;
}

function getPdfValueUnderlineY(baselineY, textHeight, scaleLength = (mm) => mm) {
  return baselineY + textHeight * 0.32 + scaleLength(PDF_VALUE_UNDERLINE_GAP_MM);
}

function resolveSingleLinePdfFontSize(
  doc,
  text,
  maxWidth,
  startSize,
  minSize,
  fontStyle = "normal"
) {
  let size = startSize;
  const value = String(text ?? "");
  doc.setFont("helvetica", fontStyle);
  while (size > minSize) {
    doc.setFontSize(size);
    if (doc.getTextWidth(value) <= maxWidth) return size;
    size -= 0.5;
  }
  doc.setFontSize(minSize);
  return minSize;
}

function resolveWrappedPdfFontSize(
  doc,
  text,
  maxWidth,
  maxLines,
  startSize,
  minSize,
  fontStyle = "normal"
) {
  const value = String(text ?? "");
  if (!value) {
    return { fontSize: startSize, lines: [""] };
  }

  let size = startSize;
  doc.setFont("helvetica", fontStyle);
  while (size >= minSize) {
    doc.setFontSize(size);
    const lines = doc.splitTextToSize(value, maxWidth);
    if (lines.length <= maxLines) {
      return { fontSize: size, lines };
    }
    size -= 0.5;
  }

  doc.setFontSize(minSize);
  return { fontSize: minSize, lines: doc.splitTextToSize(value, maxWidth) };
}

function unwrapAccountingSysList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.items)) return response.items;
  if (response?.data && typeof response.data === "object" && !Array.isArray(response.data)) {
    return [response.data];
  }
  if (response && typeof response === "object") return [response];
  return [];
}

function splitAccountingSysAddressForPdf(address) {
  const trimmed = String(address ?? "").trim();
  if (!trimmed) return { line1: "—", line2: "" };
  const commaIndex = trimmed.indexOf(",");
  if (commaIndex === -1) return { line1: trimmed, line2: "" };
  return {
    line1: trimmed.slice(0, commaIndex).trim() || "—",
    line2: trimmed.slice(commaIndex + 1).trim(),
  };
}

function loadPafLogoIntoPdf(doc, x, y, widthMm = 18) {
  return new Promise((resolve) => {
    const logoPath = `${process.env.PUBLIC_URL || ""}/login_page/assets/img/PAF-Logo.gif`;
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const logoHeight = (img.height / img.width) * widthMm;
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const imgData = canvas.toDataURL("image/png");
        doc.addImage(imgData, "PNG", x, y, widthMm, logoHeight);
        resolve(logoHeight);
      } catch (error) {
        console.error("Error adding logo to purchase invoice PDF:", error);
        resolve(0);
      }
    };
    img.onerror = () => resolve(0);
    img.src = logoPath;
  });
}

function textValue(value) {
  const text = String(value ?? "").trim();
  return text || "—";
}

function mapPurchaseInvoiceForPdf(record) {
  if (!record) return null;
  const lines = (record.lines || []).map(normalizePurchaseInvoiceLine);
  return {
    id: record.id,
    date: record.date,
    piNo: String(record.piNo || "").trim(),
    description: String(record.description || "").trim(),
    grandTotal:
      record.grandTotal != null && Number.isFinite(Number(record.grandTotal))
        ? Number(record.grandTotal)
        : computePurchaseInvoiceGrandTotal(lines),
    lines,
  };
}

/**
 * Generate a Purchase Invoice PDF using the same voucher layout as receipts / journal entries.
 */
export async function generatePurchaseInvoicePdf(
  record,
  marginsInParam = null,
  { openNewTab = false, columnKeys = null } = {}
) {
  const mapped = mapPurchaseInvoiceForPdf(record);
  if (!mapped) {
    throw new Error("No purchase invoice data available for PDF.");
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginsIn = marginsInParam ?? loadPurchaseInvoicePdfMargins();
  const { marginLeft, marginRight, marginTop, marginBottom } =
    agreementProvPdfMarginsInchesToMm(marginsIn);
  const { sx, sy, sf, sc, logicalPageBottomY, logicalPageBottomReserve } =
    createAgreementProvPdfScaleHelpers({
      contentScale: marginsIn?.contentScale,
      marginLeft,
      marginTop,
      pageHeight,
      marginBottom,
    });
  const contentRight = pageWidth - marginRight;
  const contentWidth = contentRight - marginLeft;
  const lineHeight = PDF_LINE_HEIGHT_MM;
  const bodyFont = PDF_FONT_BODY;

  const piNoDisplay = textValue(mapped.piNo);
  const piDateDisplay = formatPdfDate(mapped.date);
  const descriptionText = String(mapped.description ?? "").trim();

  let particularName = "—";
  let accountingAddressLine1 = "—";
  let accountingAddressLine2 = "";
  let accountingTelNo = "";

  try {
    const accountingResponse = await accountingSysApi.getAll();
    const accountingConfig = unwrapAccountingSysList(accountingResponse)[0];
    if (accountingConfig) {
      particularName =
        String(accountingConfig?.ParticularName ?? accountingConfig?.particularName ?? "").trim() ||
        "—";
      const addressParts = splitAccountingSysAddressForPdf(
        accountingConfig?.Address ?? accountingConfig?.address
      );
      accountingAddressLine1 = addressParts.line1;
      accountingAddressLine2 = addressParts.line2;
      accountingTelNo = String(accountingConfig?.TelNo ?? accountingConfig?.telNo ?? "").trim();
    }
  } catch (error) {
    console.error("Error fetching accounting system config for purchase invoice PDF:", error);
  }

  const LOGO_WIDTH_MM = 18;
  const LOGO_GAP_MM = 3;
  const textStartX = marginLeft + LOGO_WIDTH_MM + LOGO_GAP_MM;
  const VOUCHER_BOX_WIDTH_MM = 54;
  const VOUCHER_LABEL_VALUE_GAP_MM = 1.5;
  const voucherBoxLeft = contentRight - VOUCHER_BOX_WIDTH_MM;
  const valueStartX = textStartX;

  await loadPafLogoIntoPdf(doc, sx(marginLeft), sy(marginTop), sc(LOGO_WIDTH_MM));

  const drawBodyText = (text, x, y, options = {}) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(sf(options.fontSize || bodyFont));
    doc.text(String(text ?? ""), sx(x), sy(y), options.textOptions);
  };

  const drawPdfLine = (x1, y1, x2, y2) => {
    doc.line(sx(x1), sy(y1), sx(x2), sy(y2));
  };

  const ensurePageSpace = (y, needed = lineHeight) => {
    if (y + needed <= logicalPageBottomY - logicalPageBottomReserve) return y;
    doc.addPage();
    return marginTop;
  };

  doc.setLineWidth(sc(0.15));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(PDF_FONT_TITLE));
  doc.text("Purchase Invoice", sx(textStartX), sy(marginTop + 5));

  let headerY = marginTop + 11;
  const particularNameMaxWidth = Math.max(12, voucherBoxLeft - textStartX - 2);
  const particularNameFontSize = resolveSingleLinePdfFontSize(
    doc,
    particularName,
    particularNameMaxWidth,
    sf(bodyFont),
    sf(PDF_FONT_PARTICULARS_MIN),
    "bold"
  );
  doc.setFont("helvetica", "bold");
  doc.setFontSize(particularNameFontSize);
  doc.text(particularName, sx(textStartX), sy(headerY));
  headerY += lineHeight;
  drawBodyText(accountingAddressLine1, textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingAddressLine2 || " ", textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingTelNo ? `Tel No ${accountingTelNo}` : "Tel No", textStartX, headerY);

  const voucherMetaStartY = marginTop + 5 + lineHeight;
  let voucherMetaY = voucherMetaStartY;

  const resolveVoucherMetaValueX = (label) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const labelTextWidth = doc.getTextWidth(String(label ?? ""));
    return voucherBoxLeft + 2 + labelTextWidth + VOUCHER_LABEL_VALUE_GAP_MM;
  };

  const drawVoucherMetaRow = (label, value) => {
    const rowTop = voucherMetaY;
    const valueX = resolveVoucherMetaValueX(label);
    const valueMaxWidth = Math.max(8, contentRight - valueX - 1);

    drawBodyText(label, voucherBoxLeft + 2, rowTop, { bold: true });

    const valueFontSize = resolveSingleLinePdfFontSize(
      doc,
      value,
      valueMaxWidth,
      sf(bodyFont),
      sf(PDF_FONT_BODY),
      "normal"
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(valueFontSize);
    doc.text(String(value ?? ""), sx(valueX), sy(rowTop));
    voucherMetaY += lineHeight;
  };

  drawVoucherMetaRow("PI No", piNoDisplay);
  drawVoucherMetaRow("PI Date", piDateDisplay);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(bodyFont));
  const voucherMetaTextHeight = doc.getTextDimensions("PI No").h;
  const voucherLineTopY = voucherMetaStartY - voucherMetaTextHeight * 0.72;
  const voucherLineBottomY = voucherMetaY - lineHeight + voucherMetaTextHeight * 0.28;
  drawPdfLine(voucherBoxLeft, voucherLineTopY, voucherBoxLeft, voucherLineBottomY);

  const headerBottomY = Math.max(headerY, voucherMetaY);
  let yPos = headerBottomY + lineHeight + 3;

  const drawUnderlinedRow = (label, value, options = {}) => {
    const {
      shrinkFont = false,
      hideEmptyPlaceholder = false,
      underlineFromMargin = false,
    } = options;
    const rowTop = yPos;
    const labelText = `${label} :`;
    const maxValueWidth = contentRight - valueStartX - 1;
    const rawValue = String(value ?? "").trim();
    const valueText = rawValue || (hideEmptyPlaceholder ? "" : "—");
    const rowBandHeight = lineHeight;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const labelHeight = doc.getTextDimensions(labelText).h;
    const labelBaselineY = getPdfRowCenteredBaselineY(rowTop, rowBandHeight, labelHeight);
    doc.text(labelText, sx(marginLeft + 1), sy(labelBaselineY));

    let underlineY;
    if (valueText) {
      let valueFontSize = sf(bodyFont);
      if (shrinkFont) {
        valueFontSize = resolveSingleLinePdfFontSize(
          doc,
          valueText,
          maxValueWidth,
          sf(bodyFont),
          sf(6),
          "normal"
        );
      }

      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueFontSize);

      const valueHeight = doc.getTextDimensions(valueText).h;
      const valueBaselineY = getPdfRowCenteredBaselineY(rowTop, rowBandHeight, valueHeight);
      doc.text(valueText, sx(valueStartX), sy(valueBaselineY));
      underlineY = getPdfValueUnderlineY(valueBaselineY, valueHeight, sc);
    } else {
      underlineY = getPdfValueUnderlineY(labelBaselineY, labelHeight, sc);
    }

    const underlineStartX = underlineFromMargin ? marginLeft : valueStartX;
    drawPdfLine(underlineStartX, underlineY, contentRight, underlineY);
    yPos = underlineY + 1.75;
  };

  drawUnderlinedRow("Description", descriptionText, {
    shrinkFont: true,
    hideEmptyPlaceholder: true,
    underlineFromMargin: true,
  });

  yPos += lineHeight * 0.5;

  const selectedColumns = resolvePurchaseInvoicePdfColumnKeys(columnKeys);
  const showItem = selectedColumns.has("itemCode");
  const showParticular = selectedColumns.has("particular");
  const showAccHead = selectedColumns.has("accHead");
  const showQty = selectedColumns.has("qty");
  const showUnitPrice = selectedColumns.has("unitPrice");
  const showDisc = selectedColumns.has("disc");

  const colTotalRightX = contentRight;
  const totalShare = 0.14;
  const discShare = showDisc ? 0.07 : 0;
  const unitPriceShare = showUnitPrice ? 0.12 : 0;
  const qtyShare = showQty ? 0.07 : 0;
  const gapShare = 0.008;

  const colTotalLeftX = colTotalRightX - contentWidth * totalShare;
  let cursorX = colTotalLeftX;

  const colDiscRightX = showDisc ? cursorX - contentWidth * gapShare : cursorX;
  const colDiscLeftX = showDisc ? colDiscRightX - contentWidth * discShare : cursorX;
  cursorX = showDisc ? colDiscLeftX : cursorX;

  const colUnitPriceRightX = showUnitPrice ? cursorX - contentWidth * gapShare : cursorX;
  const colUnitPriceLeftX = showUnitPrice
    ? colUnitPriceRightX - contentWidth * unitPriceShare
    : cursorX;
  cursorX = showUnitPrice ? colUnitPriceLeftX : cursorX;

  const colQtyRightX = showQty ? cursorX - contentWidth * gapShare : cursorX;
  const colQtyLeftX = showQty ? colQtyRightX - contentWidth * qtyShare : cursorX;
  cursorX = showQty ? colQtyLeftX : cursorX;

  const textBlockWidth = Math.max(24, cursorX - marginLeft - contentWidth * gapShare);
  const textParts = [showItem, showParticular, showAccHead].filter(Boolean).length || 1;
  const itemShare = showItem ? (showParticular || showAccHead ? 0.28 : 1) : 0;
  const accHeadShare = showAccHead ? (showItem || showParticular ? 0.28 : 1) : 0;
  const particularShare = showParticular ? Math.max(0.2, 1 - itemShare - accHeadShare) : 0;
  const shareSum = itemShare + particularShare + accHeadShare || 1;

  const colItemX = marginLeft;
  const itemWidth = showItem ? (textBlockWidth * itemShare) / shareSum : 0;
  const colParticularX = showItem ? colItemX + itemWidth + 1.5 : marginLeft;
  const particularWidth = showParticular ? (textBlockWidth * particularShare) / shareSum : 0;
  const colAccHeadX = showParticular
    ? colParticularX + particularWidth + 1.5
    : showItem
    ? colItemX + itemWidth + 1.5
    : marginLeft;
  const accHeadWidth = showAccHead ? (textBlockWidth * accHeadShare) / shareSum : 0;

  const totalMaxWidth = Math.max(10, colTotalRightX - colTotalLeftX);
  const discMaxWidth = Math.max(8, colDiscRightX - colDiscLeftX);
  const unitPriceMaxWidth = Math.max(10, colUnitPriceRightX - colUnitPriceLeftX);
  const qtyMaxWidth = Math.max(8, colQtyRightX - colQtyLeftX);

  const drawWrappedCell = (text, x, maxWidth, y) => {
    if (maxWidth <= 0) return 1;
    const value = String(text ?? "");
    const { fontSize, lines } = resolveWrappedPdfFontSize(
      doc,
      value,
      sc(maxWidth),
      PDF_TEXT_MAX_LINES,
      sf(PDF_FONT_CELL_START),
      sf(PDF_FONT_CELL_MIN),
      "normal"
    );
    const lineStep = lineHeight * PDF_TEXT_LINE_STEP_RATIO;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    lines.forEach((line, index) => {
      doc.text(line, sx(x), sy(y + index * lineStep), { maxWidth: sc(maxWidth) });
    });
    return Math.max(1, lines.length);
  };

  const drawAmountCell = (text, x, y, maxWidth, options = {}) => {
    drawBodyText(text, x, y, {
      ...options,
      textOptions: {
        align: "right",
        maxWidth: sc(maxWidth),
        ...(options.textOptions || {}),
      },
    });
  };

  const drawSingleLineAmountHeader = (text, x, y, maxWidth) => {
    const value = String(text ?? "");
    const fontSize = resolveSingleLinePdfFontSize(
      doc,
      value,
      sc(maxWidth),
      sf(bodyFont),
      sf(PDF_FONT_PARTICULARS_MIN),
      "bold"
    );
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fontSize);
    doc.text(value, sx(x), sy(y), { align: "right" });
  };

  const drawTableHeader = () => {
    const rowTop = yPos;
    if (showItem) drawBodyText("Item", colItemX, rowTop, { bold: true });
    if (showParticular) drawBodyText("Particular", colParticularX, rowTop, { bold: true });
    if (showAccHead) drawBodyText("Acc Head", colAccHeadX, rowTop, { bold: true });
    if (showQty) drawSingleLineAmountHeader("Qty", colQtyRightX, rowTop, qtyMaxWidth);
    if (showUnitPrice) {
      drawSingleLineAmountHeader("Unit Price", colUnitPriceRightX, rowTop, unitPriceMaxWidth);
    }
    if (showDisc) drawSingleLineAmountHeader("Disc", colDiscRightX, rowTop, discMaxWidth);
    drawSingleLineAmountHeader("Total", colTotalRightX, rowTop, totalMaxWidth);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const headerTextHeight = doc.getTextDimensions("Total").h;
    const underlineY = rowTop + headerTextHeight * 0.28 + sc(0.4);
    drawPdfLine(marginLeft, underlineY, contentRight, underlineY);
    yPos = underlineY + lineHeight;
  };

  const drawTableRow = (line) => {
    yPos = ensurePageSpace(yPos, lineHeight * PDF_TEXT_MAX_LINES * PDF_TEXT_LINE_STEP_RATIO + 2);
    if (yPos === marginTop) {
      drawTableHeader();
    }

    const rowTop = yPos;
    const lineHeights = [];
    if (showItem) {
      lineHeights.push(drawWrappedCell(textValue(line.itemCode), colItemX, itemWidth - 1, rowTop));
    }
    if (showParticular) {
      lineHeights.push(
        drawWrappedCell(textValue(line.desc), colParticularX, particularWidth - 1, rowTop)
      );
    }
    if (showAccHead) {
      lineHeights.push(
        drawWrappedCell(textValue(line.accHead), colAccHeadX, accHeadWidth - 1, rowTop)
      );
    }

    const rowHeight = Math.max(
      lineHeight,
      ...(lineHeights.length
        ? lineHeights.map((n) => n * lineHeight * PDF_TEXT_LINE_STEP_RATIO)
        : [lineHeight])
    );

    if (showQty) drawAmountCell(formatPdfQty(line.months), colQtyRightX, rowTop, qtyMaxWidth);
    if (showUnitPrice) {
      drawAmountCell(
        formatPdfCurrency(line.calculatedRentPM),
        colUnitPriceRightX,
        rowTop,
        unitPriceMaxWidth
      );
    }
    if (showDisc) {
      drawAmountCell(formatPdfQty(line.discountPercent), colDiscRightX, rowTop, discMaxWidth);
    }
    drawAmountCell(
      formatPdfCurrency(getPurchaseInvoiceLineComputedTotal(line)),
      colTotalRightX,
      rowTop,
      totalMaxWidth
    );
    yPos += rowHeight;
  };

  drawTableHeader();
  (mapped.lines || []).forEach((line) => drawTableRow(line));

  yPos = ensurePageSpace(yPos + 4, lineHeight * 3);
  yPos += 4;

  const totalRowY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(bodyFont));
  const totalLabelHeight = doc.getTextDimensions("Total").h;
  const totalOverlineY = totalRowY - totalLabelHeight * 0.75 - sc(0.5);
  drawPdfLine(marginLeft, totalOverlineY, contentRight, totalOverlineY);

  const grandTotalText = formatPdfCurrency(mapped.grandTotal);
  const totalLabelGapMm = 4;
  const totalTextWidth = doc.getTextWidth(grandTotalText);
  const totalLabelAnchorX = colTotalRightX - totalTextWidth - totalLabelGapMm;
  drawBodyText("Total", totalLabelAnchorX, totalRowY, {
    bold: true,
    textOptions: { align: "right" },
  });
  drawAmountCell(grandTotalText, colTotalRightX, totalRowY, totalMaxWidth, { bold: true });

  const totalUnderlineY = totalRowY + totalLabelHeight * 0.35 + sc(0.5);
  drawPdfLine(marginLeft, totalUnderlineY, contentRight, totalUnderlineY);

  const signatureBlockHeight = lineHeight * 2;
  let signatureLineY = totalUnderlineY + VOUCHER_PDF_SIGNATURE_BLANK_LINES * lineHeight;
  if (signatureLineY + signatureBlockHeight > logicalPageBottomY - logicalPageBottomReserve) {
    doc.addPage();
    signatureLineY = marginTop + VOUCHER_PDF_SIGNATURE_BLANK_LINES * lineHeight;
  }
  const signatureLabelY = signatureLineY + lineHeight;

  const drawSignatureBlocks = () => {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setPage(pageCount);

    const blockWidth = contentWidth / VOUCHER_PDF_SIGNATURE_BLOCKS.length;

    VOUCHER_PDF_SIGNATURE_BLOCKS.forEach((label, index) => {
      const blockLeft = marginLeft + index * blockWidth + 2;
      const blockRight = marginLeft + (index + 1) * blockWidth - 6;
      drawPdfLine(blockLeft, signatureLineY, blockRight, signatureLineY);
      drawBodyText(label, (blockLeft + blockRight) / 2, signatureLabelY, {
        fontSize: PDF_FONT_BODY - 1,
        textOptions: { align: "center" },
      });
    });
  };

  drawSignatureBlocks();
  addContractPdfWatermarks(doc);

  const pdfBlob = doc.output("blob");
  if (openNewTab) {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  }
  return pdfBlob;
}
