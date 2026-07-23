import jsPDF from "jspdf";
import accountingSysApi from "services/api.accountingsys.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  agreementProvPdfMarginsInchesToMm,
  createAgreementProvPdfScaleHelpers,
  loadInterAccTransferPdfMargins,
} from "utils/agreementProvPdfMargins";
import { addContractPdfWatermarks } from "layouts/contracts/contracts/contractPdfWatermark";
import { mapInterAccTransferForVoucherPdf } from "./interAccTransferUtils";

export const INTER_ACC_TRANSFER_PDF_SELECTABLE_COLUMNS = [
  { key: "accounts", label: "Accounts" },
  { key: "tinFtn", label: "TIN-FTN" },
  { key: "amountOutflow", label: "Amount Outflow" },
  { key: "amountInflow", label: "Amount Inflow" },
];

export const INTER_ACC_TRANSFER_PDF_DEFAULT_COLUMN_KEYS = [
  "accounts",
  "tinFtn",
  "amountOutflow",
  "amountInflow",
];

export function createDefaultInterAccTransferPdfColumnKeys() {
  return new Set(INTER_ACC_TRANSFER_PDF_DEFAULT_COLUMN_KEYS);
}

function resolveInterAccTransferPdfColumnKeys(columnKeys) {
  if (columnKeys instanceof Set) return columnKeys;
  if (Array.isArray(columnKeys)) return new Set(columnKeys);
  return createDefaultInterAccTransferPdfColumnKeys();
}

const PDF_FONT_TITLE = 18;
const PDF_FONT_BODY = 10;
const PDF_FONT_PARTICULARS_MIN = 5;
const PDF_FONT_ACCOUNTS_MIN = 7;
const PDF_PARTICULARS_MAX_LINES = 2;
const PDF_PARTICULARS_LINE_STEP_RATIO = 0.9;
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
        console.error("Error adding logo to transfer PDF:", error);
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

function pickTransferVrNo(transfer) {
  return textValue(transfer?.vrNo);
}

function pickTransferAmount(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Generate a Transfer Entry PDF using the same voucher layout as receipts.
 */
export async function generateInterAccTransferPdf(
  transfer,
  marginsInParam = null,
  { openNewTab = false, columnKeys = null } = {}
) {
  const mapped = mapInterAccTransferForVoucherPdf(transfer);
  if (!mapped) {
    throw new Error("No transfer data available for PDF.");
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginsIn = marginsInParam ?? loadInterAccTransferPdfMargins();
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

  const vrNoDisplay = pickTransferVrNo(mapped);
  const vrDateDisplay = formatPdfDate(mapped?.date);
  const descriptionText = String(mapped?.description ?? "").trim();
  const paidFromDisplay = textValue(mapped?.paidFrom);
  const receivedInDisplay = textValue(
    mapped?.receivedInAccount || mapped?.receivedFromAccountLabel
  );
  const outflowTotal = pickTransferAmount(mapped?.paidFromAmount);
  const inflowTotal = pickTransferAmount(mapped?.receivedInAmount);

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
    console.error("Error fetching accounting system config for transfer PDF:", error);
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
  doc.text("Transfer Entry", sx(textStartX), sy(marginTop + 5));

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

  drawUnderlinedRow("Description", descriptionText, {
    shrinkFont: true,
    hideEmptyPlaceholder: true,
    underlineFromMargin: true,
  });

  yPos += lineHeight * 0.5;

  const selectedColumns = resolveInterAccTransferPdfColumnKeys(columnKeys);
  const showAccounts = selectedColumns.has("accounts");
  const showTinFtn = selectedColumns.has("tinFtn");
  const showOutflow = selectedColumns.has("amountOutflow");
  const showInflow = selectedColumns.has("amountInflow");

  const colParticularsX = marginLeft;
  const colInflowRightX = contentRight;
  const inflowShare = showInflow ? 0.17 : 0;
  const outflowShare = showOutflow ? 0.17 : 0;
  const tinFtnShare = showTinFtn ? 0.22 : 0;
  const colInflowLeftX = colInflowRightX - contentWidth * inflowShare;
  const colOutflowRightX = colInflowLeftX - (showOutflow && showInflow ? contentWidth * 0.01 : 0);
  const colOutflowLeftX = colOutflowRightX - contentWidth * outflowShare;
  const amountBlockLeft = showOutflow
    ? colOutflowLeftX
    : showInflow
    ? colInflowLeftX
    : contentRight;
  const colTinFtnRightX = amountBlockLeft - (showTinFtn ? contentWidth * 0.01 : 0);
  const colTinFtnLeftX = colTinFtnRightX - contentWidth * tinFtnShare;
  const accountsRightEdge = showTinFtn ? colTinFtnLeftX : amountBlockLeft;
  const particularsMaxWidth = showAccounts
    ? Math.max(12, accountsRightEdge - colParticularsX - 3)
    : 0;
  const outflowMaxWidth = Math.max(10, colOutflowRightX - colOutflowLeftX);
  const inflowMaxWidth = Math.max(10, colInflowRightX - colInflowLeftX);
  const tinFtnMaxWidth = Math.max(10, colTinFtnRightX - colTinFtnLeftX);

  const drawOutflowCell = (text, y, options = {}) => {
    if (!showOutflow) return;
    drawBodyText(text, colOutflowRightX, y, {
      ...options,
      textOptions: {
        align: "right",
        maxWidth: sc(outflowMaxWidth),
        ...(options.textOptions || {}),
      },
    });
  };

  const drawInflowCell = (text, y, options = {}) => {
    if (!showInflow) return;
    drawBodyText(text, colInflowRightX, y, {
      ...options,
      textOptions: {
        align: "right",
        maxWidth: sc(inflowMaxWidth),
        ...(options.textOptions || {}),
      },
    });
  };

  const drawTinFtnCell = (text, y, options = {}) => {
    if (!showTinFtn) return;
    drawBodyText(text, colTinFtnRightX, y, {
      ...options,
      textOptions: {
        align: "right",
        maxWidth: sc(tinFtnMaxWidth),
        ...(options.textOptions || {}),
      },
    });
  };

  const drawAccountsText = (text, y) => {
    if (!showAccounts) return 1;
    const value = String(text ?? "");
    const { fontSize, lines } = resolveWrappedPdfFontSize(
      doc,
      value,
      sc(particularsMaxWidth),
      PDF_PARTICULARS_MAX_LINES,
      sf(bodyFont),
      sf(PDF_FONT_ACCOUNTS_MIN),
      "normal"
    );
    const lineStep = lineHeight * PDF_PARTICULARS_LINE_STEP_RATIO;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fontSize);
    lines.forEach((line, index) => {
      doc.text(line, sx(colParticularsX), sy(y + index * lineStep));
    });
    return Math.max(1, lines.length);
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

  const drawVoucherTableHeader = () => {
    const rowTop = yPos;
    if (showAccounts) {
      drawBodyText("Accounts", colParticularsX, rowTop, { bold: true });
    }
    if (showTinFtn) {
      drawBodyText("TIN-FTN", colTinFtnRightX, rowTop, {
        bold: true,
        textOptions: { align: "right", maxWidth: sc(tinFtnMaxWidth) },
      });
    }
    if (showOutflow) {
      drawSingleLineAmountHeader("Amount Outflow", colOutflowRightX, rowTop, outflowMaxWidth);
    }
    if (showInflow) {
      drawSingleLineAmountHeader("Amount Inflow", colInflowRightX, rowTop, inflowMaxWidth);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const headerSample = showAccounts
      ? "Accounts"
      : showTinFtn
      ? "TIN-FTN"
      : showOutflow
      ? "Amount Outflow"
      : "Amount Inflow";
    const headerTextHeight = doc.getTextDimensions(headerSample).h;
    const underlineY = rowTop + headerTextHeight * 0.28 + sc(0.4);
    drawPdfLine(marginLeft, underlineY, contentRight, underlineY);
    yPos = underlineY + lineHeight;
  };

  const drawVoucherTableRow = (accounts, outflowAmount, inflowAmount, tinFtn) => {
    yPos = ensurePageSpace(
      yPos,
      lineHeight * PDF_PARTICULARS_MAX_LINES * PDF_PARTICULARS_LINE_STEP_RATIO + 2
    );
    if (yPos === marginTop) {
      drawVoucherTableHeader();
    }

    const rowTop = yPos;
    const drawnAccountsLines = drawAccountsText(accounts || "—", rowTop);
    const rowHeight = Math.max(
      lineHeight,
      drawnAccountsLines * lineHeight * PDF_PARTICULARS_LINE_STEP_RATIO
    );
    drawTinFtnCell(tinFtn, rowTop);
    drawOutflowCell(formatPdfCurrency(outflowAmount), rowTop);
    drawInflowCell(formatPdfCurrency(inflowAmount), rowTop);
    yPos += rowHeight;
  };

  drawVoucherTableHeader();
  drawVoucherTableRow(receivedInDisplay, null, inflowTotal, textValue(mapped?.tinFtn));
  drawVoucherTableRow(paidFromDisplay, outflowTotal, null, textValue(mapped?.tinFtn));

  yPos = ensurePageSpace(yPos + 4, lineHeight * 3);
  yPos += 4;

  const totalRowY = yPos;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(bodyFont));
  const totalLabelHeight = doc.getTextDimensions("Total").h;
  const totalOverlineY = totalRowY - totalLabelHeight * 0.75 - sc(0.5);
  drawPdfLine(marginLeft, totalOverlineY, contentRight, totalOverlineY);

  const outflowAmountText = formatPdfCurrency(outflowTotal);
  const inflowAmountText = formatPdfCurrency(inflowTotal);
  const totalLabelGapMm = 4;

  if (showOutflow) {
    const outflowTextWidth = doc.getTextWidth(outflowAmountText);
    const totalLabelAnchorX = colOutflowRightX - outflowTextWidth - totalLabelGapMm;
    drawBodyText("Total", totalLabelAnchorX, totalRowY, {
      bold: true,
      textOptions: { align: "right" },
    });
    drawOutflowCell(outflowAmountText, totalRowY, { bold: true });
  } else if (showInflow) {
    const inflowTextWidth = doc.getTextWidth(inflowAmountText);
    const totalLabelAnchorX = colInflowRightX - inflowTextWidth - totalLabelGapMm;
    drawBodyText("Total", totalLabelAnchorX, totalRowY, {
      bold: true,
      textOptions: { align: "right" },
    });
  } else {
    drawBodyText("Total", contentRight, totalRowY, {
      bold: true,
      textOptions: { align: "right" },
    });
  }
  if (showInflow) {
    drawInflowCell(inflowAmountText, totalRowY, { bold: true });
  }

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
        fontSize: PDF_FONT_BODY - 2,
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
