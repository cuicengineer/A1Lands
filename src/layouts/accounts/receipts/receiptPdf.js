import jsPDF from "jspdf";
import accountingSysApi from "services/api.accountingsys.service";
import cashAndBankApi from "services/api.cashAndBank.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  agreementProvPdfMarginsInchesToMm,
  createAgreementProvPdfScaleHelpers,
  loadReceiptPdfMargins,
} from "utils/agreementProvPdfMargins";
import { getCashAndBankLedgerDropdownLabel } from "layouts/cash-fund-flow/cash-and-bank/cashAndBankUtils";
import { computeGrandTotal, computeLineTotal } from "./receiptUtils";

const PDF_FONT_TITLE = 18;
const PDF_FONT_BODY = 10;
const PDF_FONT_PARTICULARS_MIN = 5;
const PDF_FONT_PARTICULARS_CONTENT_START = 10.5;
const PDF_FONT_PARTICULARS_CONTENT_MIN = 7;
const PDF_MODE_MAX_LINES = 2;
const PDF_LINE_HEIGHT_MM = 5;
const PDF_VALUE_UNDERLINE_GAP_MM = 0.75;
const RECEIPT_PDF_SIGNATURE_BLOCKS = ["Prepared By", "Checked By", "Approved By"];
const RECEIPT_PDF_SIGNATURE_BLANK_LINES = 7;

function formatPdfDate(dateString) {
  const formatted = formatDateDDMMMYYYY(dateString);
  return formatted || "—";
}

function formatPdfCurrency(value) {
  if (value === null || value === undefined || value === "") return "0";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
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

function unwrapCashAndBankList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
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
        console.error("Error adding logo to receipt PDF:", error);
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

function pickReceiptVrNo(receipt) {
  return textValue(receipt?.vrNo || receipt?.reference);
}

function formatReceiptLineReference(line) {
  const invoiceNo = String(line?.invoiceNo || "").trim();
  const contractNo = String(line?.contractNo || "").trim();
  const invoiceKey = String(line?.invoiceKey || "").trim();
  if (invoiceNo) return invoiceNo;
  if (contractNo) return contractNo;
  if (invoiceKey) return invoiceKey.split("|").pop() || invoiceKey;
  return "";
}

function formatReceiptReceivableCategory(line) {
  const partyType = String(line?.partyType || "").trim();
  if (partyType) return `${partyType} Receivable`;

  const account = String(line?.account || "").trim();
  if (account) {
    const receivablePart = account
      .split(" - ")
      .map((part) => part.trim())
      .find((part) => /receivable/i.test(part));
    if (receivablePart) return receivablePart;
  }
  return account || "Receivable";
}

function buildReceiptVoucherParticulars(line) {
  const category = formatReceiptReceivableCategory(line);
  const party =
    String(line?.partyLabel || "").trim() ||
    [line?.partyCode, line?.partyName]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  const reference = formatReceiptLineReference(line);
  const referenceSuffix = reference ? ` - (${reference})` : "";

  if (party) return `${category} – ${party}${referenceSuffix}`;
  if (reference) return `${category} – (${reference})`;

  const fallback = [line?.item, line?.account]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join(" – ");
  return fallback || "—";
}

function pickReceiptLineAmount(line) {
  const total = Number(line?.total);
  if (Number.isFinite(total) && total > 0) return total;
  return computeLineTotal(line);
}

function pickReceiptLineTinFtn(line) {
  return textValue(line?.tinTrn ?? line?.tinFtn ?? "");
}

async function resolveReceiptModeLabel(receipt) {
  const ledgerId = receipt?.cashAndBankAccountId ?? receipt?.CashAndBankAccountId;
  if (ledgerId != null && ledgerId !== "") {
    try {
      const response = await cashAndBankApi.getAll(1, 1000);
      const rows = unwrapCashAndBankList(response);
      const match = rows.find((row) => Number(row?.id ?? row?.Id) === Number(ledgerId));
      const label = getCashAndBankLedgerDropdownLabel(match);
      if (label) return label;
    } catch (error) {
      console.error("Error fetching cash and bank ledger for receipt PDF:", error);
    }
  }

  const receivedFromLabel = String(
    receipt?.receivedFromAccountLabel || receipt?.receivedFromAccountDisplay || ""
  ).trim();
  if (receivedFromLabel) return receivedFromLabel;

  const payeeName = String(receipt?.payeeName || "").trim();
  if (payeeName) return payeeName;

  const partyCode = String(receipt?.payeePartyCode || "").trim();
  return partyCode || "—";
}

/**
 * Generate a Receipt Voucher PDF matching the configured voucher layout.
 */
export async function generateReceiptPdf(
  receipt,
  marginsInParam = null,
  { openNewTab = false, documentTitle = "Receipt Voucher" } = {}
) {
  if (!receipt) {
    throw new Error("No receipt data available for PDF.");
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

  const vrNoDisplay = pickReceiptVrNo(receipt);
  const vrDateDisplay = formatPdfDate(receipt?.date);
  const paidByDisplay = textValue(receipt?.paidFrom);
  const descriptionText = String(receipt?.description ?? "").trim();
  const modeDisplay = await resolveReceiptModeLabel(receipt);
  const total = Number(receipt?.grandTotal) || computeGrandTotal(receipt?.lines);

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
    console.error("Error fetching accounting system config for receipt PDF:", error);
  }

  const LOGO_WIDTH_MM = 18;
  const LOGO_GAP_MM = 3;
  const textStartX = marginLeft + LOGO_WIDTH_MM + LOGO_GAP_MM;
  const VOUCHER_BOX_WIDTH_MM = 54;
  const VOUCHER_LABEL_COL_MM = 24;
  const voucherBoxLeft = contentRight - VOUCHER_BOX_WIDTH_MM;
  const voucherSepX = voucherBoxLeft + VOUCHER_LABEL_COL_MM;
  const voucherValueX = voucherSepX + 2;
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
  doc.text(documentTitle, sx(textStartX), sy(marginTop + 5));

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
  const voucherValueMaxWidth = Math.max(8, contentRight - voucherValueX - 2);
  let voucherMetaY = voucherMetaStartY;

  const drawVoucherMetaRow = (label, value, options = {}) => {
    const { maxLines = 1, minFontSize = PDF_FONT_BODY } = options;
    const rowTop = voucherMetaY;

    drawBodyText(label, voucherBoxLeft + 2, rowTop, { bold: true });

    if (maxLines <= 1) {
      const valueMaxWidth = Math.max(8, contentRight - voucherValueX - 1);
      const valueFontSize = resolveSingleLinePdfFontSize(
        doc,
        value,
        valueMaxWidth,
        sf(bodyFont),
        sf(minFontSize),
        "normal"
      );
      doc.setFont("helvetica", "normal");
      doc.setFontSize(valueFontSize);
      doc.text(String(value ?? ""), sx(voucherValueX), sy(rowTop));
      voucherMetaY += lineHeight;
      return;
    }

    const { fontSize: valueFontSize, lines: valueLines } = resolveWrappedPdfFontSize(
      doc,
      value,
      sc(voucherValueMaxWidth),
      maxLines,
      sf(bodyFont),
      sf(minFontSize),
      "normal"
    );
    const wrappedLineStep = lineHeight * 0.9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(valueFontSize);
    valueLines.forEach((line, index) => {
      doc.text(line, sx(voucherValueX), sy(rowTop + index * wrappedLineStep));
    });
    voucherMetaY += Math.max(lineHeight, valueLines.length * wrappedLineStep);
  };

  drawVoucherMetaRow("Vr No", vrNoDisplay);
  drawVoucherMetaRow("Vr Date", vrDateDisplay);
  drawVoucherMetaRow("Mode", modeDisplay, {
    maxLines: PDF_MODE_MAX_LINES,
    minFontSize: PDF_FONT_PARTICULARS_MIN,
  });

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
      singleLine = true,
      shrinkFont = false,
      minFontSize = 6,
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
      if (singleLine && shrinkFont) {
        valueFontSize = resolveSingleLinePdfFontSize(
          doc,
          valueText,
          maxValueWidth,
          sf(bodyFont),
          sf(minFontSize),
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

  drawUnderlinedRow("Paid By", paidByDisplay);
  drawUnderlinedRow("Description", descriptionText, {
    shrinkFont: true,
    hideEmptyPlaceholder: true,
    underlineFromMargin: true,
  });

  yPos += lineHeight * 0.5;

  const colSnX = marginLeft;
  const colParticularsX = marginLeft + contentWidth * 0.07;
  const colAmountLeftX = marginLeft + contentWidth * 0.56;
  const colAmountRightX = marginLeft + contentWidth * 0.66;
  const colTinFtnLeftX = marginLeft + contentWidth * 0.72;
  const colTinFtnRightX = contentRight;
  const particularsMaxWidth = Math.max(12, colAmountLeftX - colParticularsX - 3);
  const amountMaxWidth = Math.max(10, colAmountRightX - colAmountLeftX);
  const tinFtnMaxWidth = Math.max(10, colTinFtnRightX - colTinFtnLeftX);

  const drawAmountCell = (text, y, options = {}) => {
    drawBodyText(text, colAmountRightX, y, {
      ...options,
      textOptions: {
        align: "right",
        maxWidth: sc(amountMaxWidth),
        ...(options.textOptions || {}),
      },
    });
  };

  const drawTinFtnCell = (text, y, options = {}) => {
    drawBodyText(text, colTinFtnRightX, y, {
      ...options,
      textOptions: {
        align: "right",
        maxWidth: sc(tinFtnMaxWidth),
        ...(options.textOptions || {}),
      },
    });
  };

  const drawParticularsText = (text, y) => {
    const value = String(text ?? "");
    const fontSize = resolveSingleLinePdfFontSize(
      doc,
      value,
      particularsMaxWidth,
      sf(PDF_FONT_PARTICULARS_CONTENT_START),
      sf(PDF_FONT_PARTICULARS_CONTENT_MIN),
      "normal"
    );
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    doc.text(value, sx(colParticularsX), sy(y));
  };

  const drawVoucherTableHeader = () => {
    const rowTop = yPos;
    drawBodyText("SN", colSnX, rowTop, { bold: true });
    drawBodyText("Particulars", colParticularsX, rowTop, { bold: true });
    drawBodyText("Amount", colAmountRightX, rowTop, {
      bold: true,
      textOptions: { align: "right", maxWidth: sc(amountMaxWidth) },
    });
    drawBodyText("TIN-FTN", colTinFtnRightX, rowTop, {
      bold: true,
      textOptions: { align: "right", maxWidth: sc(tinFtnMaxWidth) },
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const headerTextHeight = doc.getTextDimensions("SN").h;
    const underlineY = rowTop + headerTextHeight * 0.28 + sc(0.4);
    drawPdfLine(marginLeft, underlineY, contentRight, underlineY);
    yPos = underlineY + lineHeight;
  };

  const drawVoucherTableRow = (serialNo, particulars, amount, tinFtn) => {
    yPos = ensurePageSpace(yPos, lineHeight + 2);
    if (yPos === marginTop) {
      drawVoucherTableHeader();
    }

    drawBodyText(`${serialNo}.`, colSnX, yPos);
    drawParticularsText(particulars || "—", yPos);
    drawAmountCell(formatPdfCurrency(amount), yPos);
    drawTinFtnCell(tinFtn, yPos);
    yPos += lineHeight;
  };

  drawVoucherTableHeader();

  const lines = Array.isArray(receipt?.lines) ? receipt.lines : [];
  if (lines.length > 0) {
    lines.forEach((line, index) => {
      drawVoucherTableRow(
        index + 1,
        buildReceiptVoucherParticulars(line),
        pickReceiptLineAmount(line),
        pickReceiptLineTinFtn(line)
      );
    });
  } else {
    drawVoucherTableRow(1, "No receipt lines recorded", 0, "—");
  }

  yPos = ensurePageSpace(yPos + 4, lineHeight * 3);
  yPos += 4;

  const totalRowY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(bodyFont));
  const totalLabelHeight = doc.getTextDimensions("Total").h;
  const totalOverlineY = totalRowY - totalLabelHeight * 0.75 - sc(0.5);
  drawPdfLine(marginLeft, totalOverlineY, contentRight, totalOverlineY);

  const totalAmountText = formatPdfCurrency(total);
  const amountTextWidth = doc.getTextWidth(totalAmountText);
  const totalLabelGapMm = 4;
  const totalLabelAnchorX = colAmountRightX - amountTextWidth - totalLabelGapMm;

  drawBodyText("Total", totalLabelAnchorX, totalRowY, {
    bold: true,
    textOptions: { align: "right" },
  });
  drawAmountCell(totalAmountText, totalRowY, { bold: true });

  const totalUnderlineY = totalRowY + totalLabelHeight * 0.35 + sc(0.5);
  drawPdfLine(marginLeft, totalUnderlineY, contentRight, totalUnderlineY);

  const signatureBlockHeight = lineHeight * 2;
  let signatureLineY = totalUnderlineY + RECEIPT_PDF_SIGNATURE_BLANK_LINES * lineHeight;
  if (signatureLineY + signatureBlockHeight > logicalPageBottomY - logicalPageBottomReserve) {
    doc.addPage();
    signatureLineY = marginTop + RECEIPT_PDF_SIGNATURE_BLANK_LINES * lineHeight;
  }
  const signatureLabelY = signatureLineY + lineHeight;

  const drawReceiptSignatureBlocks = () => {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setPage(pageCount);

    const blockWidth = contentWidth / RECEIPT_PDF_SIGNATURE_BLOCKS.length;

    RECEIPT_PDF_SIGNATURE_BLOCKS.forEach((label, index) => {
      const blockLeft = marginLeft + index * blockWidth + 2;
      const blockRight = marginLeft + (index + 1) * blockWidth - 6;
      drawPdfLine(blockLeft, signatureLineY, blockRight, signatureLineY);
      drawBodyText(label, (blockLeft + blockRight) / 2, signatureLabelY, {
        textOptions: { align: "center" },
      });
    });
  };

  drawReceiptSignatureBlocks();

  const pdfBlob = doc.output("blob");
  if (openNewTab) {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  }
  return pdfBlob;
}
