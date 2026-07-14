import jsPDF from "jspdf";
import accountingSysApi from "services/api.accountingsys.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  agreementProvPdfMarginsInchesToMm,
  createAgreementProvPdfScaleHelpers,
  loadReceiptPdfMargins,
} from "utils/agreementProvPdfMargins";
import { mapJournalEntryForVoucherPdf } from "./journalEntryUtils";

const PDF_FONT_TITLE = 18;
const PDF_FONT_BODY = 10;
const PDF_FONT_PARTICULARS_MIN = 5;
const PDF_FONT_PARTICULARS_CONTENT_START = 8;
const PDF_FONT_PARTICULARS_CONTENT_MIN = 5.5;
const PDF_PARTICULARS_MAX_LINES = 2;
const PDF_PARTICULARS_LINE_STEP_RATIO = 0.9;
const PDF_PARTICULARS_DEBIT_GAP_MM = 3;
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

function formatPdfScaledUnit(value) {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toLocaleString("en-US", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0,
  });
}

/** Debit/Credit: suffix M or B only at million/billion; otherwise plain number. */
function formatPdfDebitCreditAmount(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  if (!Number.isFinite(n) || n === 0) return "";

  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    return `${formatPdfScaledUnit(n / 1_000_000_000)}B`;
  }
  if (abs >= 1_000_000) {
    return `${formatPdfScaledUnit(n / 1_000_000)}M`;
  }
  return n.toLocaleString("en-US");
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
        console.error("Error adding logo to journal entry PDF:", error);
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

/**
 * Generate a Journal Entry PDF using the same voucher layout as receipts.
 */
export async function generateJournalEntryPdf(
  record,
  marginsInParam = null,
  { openNewTab = false } = {}
) {
  const mapped = mapJournalEntryForVoucherPdf(record);
  if (!mapped) {
    throw new Error("No journal entry data available for PDF.");
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginsIn = marginsInParam ?? loadReceiptPdfMargins();
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

  const vrNoDisplay = textValue(mapped.vrNo);
  const vrDateDisplay = formatPdfDate(mapped.date);
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
    console.error("Error fetching accounting system config for journal entry PDF:", error);
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
  doc.text("Journal Entry", sx(textStartX), sy(marginTop + 5));

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

  drawVoucherMetaRow("Vr No", vrNoDisplay);
  drawVoucherMetaRow("Vr Date", vrDateDisplay);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(bodyFont));
  const voucherMetaTextHeight = doc.getTextDimensions("Vr No").h;
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

  const colParticularsX = marginLeft;
  const colCreditRightX = contentRight;
  const colCreditLeftX = colCreditRightX - contentWidth * 0.14;
  const colDebitRightX = colCreditLeftX - contentWidth * 0.015;
  const colDebitLeftX = colDebitRightX - contentWidth * 0.14;
  const particularsMaxWidth = Math.max(
    24,
    colDebitLeftX - colParticularsX - PDF_PARTICULARS_DEBIT_GAP_MM
  );
  const debitMaxWidth = Math.max(10, colDebitRightX - colDebitLeftX);
  const creditMaxWidth = Math.max(10, colCreditRightX - colCreditLeftX);

  const drawParticularsCell = (text, y) => {
    const value = String(text ?? "");
    const { fontSize, lines } = resolveWrappedPdfFontSize(
      doc,
      value,
      sc(particularsMaxWidth),
      PDF_PARTICULARS_MAX_LINES,
      sf(PDF_FONT_PARTICULARS_CONTENT_START),
      sf(PDF_FONT_PARTICULARS_CONTENT_MIN),
      "normal"
    );
    const lineStep = lineHeight * PDF_PARTICULARS_LINE_STEP_RATIO;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    lines.forEach((line, index) => {
      doc.text(line, sx(colParticularsX), sy(y + index * lineStep), {
        maxWidth: sc(particularsMaxWidth),
      });
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

  const drawJournalTableHeader = () => {
    const rowTop = yPos;
    drawBodyText("Particulars", colParticularsX, rowTop, { bold: true });
    drawBodyText("Debit", colDebitRightX, rowTop, {
      bold: true,
      textOptions: { align: "right", maxWidth: sc(debitMaxWidth) },
    });
    drawBodyText("Credit", colCreditRightX, rowTop, {
      bold: true,
      textOptions: { align: "right", maxWidth: sc(creditMaxWidth) },
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const headerTextHeight = doc.getTextDimensions("Particulars").h;
    const underlineY = rowTop + headerTextHeight * 0.28 + sc(0.4);
    drawPdfLine(marginLeft, underlineY, contentRight, underlineY);
    yPos = underlineY + lineHeight;
  };

  const drawJournalTableRow = (line) => {
    yPos = ensurePageSpace(
      yPos,
      lineHeight * PDF_PARTICULARS_MAX_LINES * PDF_PARTICULARS_LINE_STEP_RATIO + 2
    );
    if (yPos === marginTop) {
      drawJournalTableHeader();
    }

    const rowTop = yPos;
    const particularsLines = drawParticularsCell(line.particulars, rowTop);
    const rowHeight = Math.max(
      lineHeight,
      particularsLines * lineHeight * PDF_PARTICULARS_LINE_STEP_RATIO
    );

    drawAmountCell(formatPdfDebitCreditAmount(line.debit), colDebitRightX, rowTop, debitMaxWidth);
    drawAmountCell(
      formatPdfDebitCreditAmount(line.credit),
      colCreditRightX,
      rowTop,
      creditMaxWidth
    );
    yPos += rowHeight;
  };

  drawJournalTableHeader();
  (mapped.lines || []).forEach((line) => drawJournalTableRow(line));

  yPos = ensurePageSpace(yPos + 4, lineHeight * 3);
  yPos += 4;

  const totalRowY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(bodyFont));
  const totalLabelHeight = doc.getTextDimensions("Total").h;
  const totalOverlineY = totalRowY - totalLabelHeight * 0.75 - sc(0.5);
  drawPdfLine(marginLeft, totalOverlineY, contentRight, totalOverlineY);

  const debitTotalText = formatPdfDebitCreditAmount(mapped.totalDebit) || "0";
  const debitTextWidth = doc.getTextWidth(debitTotalText);
  const totalLabelGapMm = 4;
  const totalLabelAnchorX = colDebitRightX - debitTextWidth - totalLabelGapMm;

  drawBodyText("Total", totalLabelAnchorX, totalRowY, {
    bold: true,
    textOptions: { align: "right" },
  });
  drawAmountCell(debitTotalText, colDebitRightX, totalRowY, debitMaxWidth, { bold: true });
  drawAmountCell(
    formatPdfDebitCreditAmount(mapped.totalCredit) || "0",
    colCreditRightX,
    totalRowY,
    creditMaxWidth,
    {
      bold: true,
    }
  );

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
        textOptions: { align: "center" },
      });
    });
  };

  drawSignatureBlocks();

  const pdfBlob = doc.output("blob");
  if (openNewTab) {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  }
  return pdfBlob;
}
