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
import { addContractPdfWatermarks } from "layouts/contracts/contracts/contractPdfWatermark";
import { computeGrandTotal, computeLineTotal } from "./receiptUtils";

export const RECEIPT_PDF_SELECTABLE_COLUMNS = [
  { key: "particulars", label: "Particulars" },
  { key: "tinFtn", label: "TIN-FTN" },
];

export const PAYMENT_PDF_SELECTABLE_COLUMNS = [
  { key: "particulars", label: "Particulars" },
  { key: "tinFtn", label: "TIN-TRN" },
];

export const RECEIPT_PDF_DEFAULT_COLUMN_KEYS = ["particulars", "tinFtn"];

export function createDefaultReceiptPdfColumnKeys() {
  return new Set(RECEIPT_PDF_DEFAULT_COLUMN_KEYS);
}

function resolveReceiptPdfColumnKeys(columnKeys) {
  if (columnKeys instanceof Set) return columnKeys;
  if (Array.isArray(columnKeys)) return new Set(columnKeys);
  return createDefaultReceiptPdfColumnKeys();
}

const PDF_FONT_TITLE = 18;
const PDF_FONT_BODY = 10;
const PDF_FONT_PARTICULARS_MIN = 5;
const PDF_FONT_PARTICULARS_CONTENT_START = 9.5;
const PDF_FONT_PARTICULARS_CONTENT_MIN = 6.5;
const PDF_PARTICULARS_COLUMN_GAP_MM = 1;
const PDF_MODE_MAX_LINES = 2;
const PDF_PARTICULARS_MAX_LINES = 2;
const PDF_PARTICULARS_LINE_STEP_RATIO = 0.9;
const PDF_LINE_HEIGHT_MM = 5;
const PDF_VALUE_UNDERLINE_GAP_MM = 0.75;
const RECEIPT_PDF_SIGNATURE_BLOCKS = [
  "Prepared By",
  "Checked By",
  "Authorized By",
  "Counter Signed",
];
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

/** Prefer one full-width line (shrinking font) before wrapping particulars. */
function resolveParticularsPdfTextLayout(
  doc,
  text,
  maxWidthLogical,
  { maxLines = 2, startSize, minSize, scaleLength = (mm) => mm, scaleFont = (pt) => pt } = {}
) {
  const value = String(text ?? "").trim();
  const maxWidth = scaleLength(maxWidthLogical);
  if (!value) {
    return { fontSize: startSize, lines: [""] };
  }

  doc.setFont("helvetica", "normal");

  let singleLineSize = startSize;
  while (singleLineSize >= minSize) {
    doc.setFontSize(scaleFont(singleLineSize));
    if (doc.getTextWidth(value) <= maxWidth) {
      return { fontSize: singleLineSize, lines: [value] };
    }
    singleLineSize -= 0.5;
  }

  doc.setFontSize(scaleFont(minSize));
  const wrappedLines = doc.splitTextToSize(value, maxWidth);
  if (wrappedLines.length <= maxLines) {
    return { fontSize: minSize, lines: wrappedLines };
  }

  return { fontSize: minSize, lines: wrappedLines.slice(0, maxLines) };
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

function stripLedgerCodePrefix(label, acctId = "") {
  const text = String(label || "").trim();
  if (!text) return "";

  const code = String(acctId || "").trim();
  if (code) {
    const prefix = `${code} - `;
    if (text.startsWith(prefix)) return text.slice(prefix.length).trim();
  }

  return text;
}

function getCashAndBankLedgerPdfName(option) {
  if (option == null) return "";
  const name = String(option.name ?? option.Name ?? "").trim();
  if (name) return name;

  const acctId = String(option.acctId ?? option.AcctId ?? "").trim();
  const label = getCashAndBankLedgerDropdownLabel(option);
  return stripLedgerCodePrefix(label, acctId);
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

function buildPaymentVoucherParticulars(line) {
  const partyType = String(line?.partyType || "").trim();
  const party =
    String(line?.partyLabel || "").trim() ||
    [line?.partyCode, line?.partyName]
      .map((part) => String(part || "").trim())
      .filter(Boolean)
      .join(" ");
  const reference = formatReceiptLineReference(line);
  const referenceSuffix = reference ? ` - (${reference})` : "";
  const item = String(line?.item || "").trim();

  if (partyType && party) return `${partyType} – ${party}${referenceSuffix}`;
  if (party) return `${party}${referenceSuffix}`;
  if (item && reference) return `${item}${referenceSuffix}`;
  if (item) return item;
  if (reference) return `(${reference})`;
  return "—";
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
      const label = getCashAndBankLedgerPdfName(match);
      if (label) return label;
    } catch (error) {
      console.error("Error fetching cash and bank ledger for receipt PDF:", error);
    }
  }

  const receivedFromLabel = String(
    receipt?.paidFromAccountDisplay ||
      receipt?.paidFromAccountLabel ||
      receipt?.receivedFromAccountLabel ||
      receipt?.receivedFromAccountDisplay ||
      ""
  ).trim();
  if (receivedFromLabel) return stripLedgerCodePrefix(receivedFromLabel);

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
  {
    openNewTab = false,
    documentTitle = "Receipt Voucher",
    isPaymentVoucher = false,
    columnKeys = null,
  } = {}
) {
  if (!receipt) {
    throw new Error("No receipt data available for PDF.");
  }

  const paymentVoucher =
    isPaymentVoucher ||
    String(documentTitle || "")
      .trim()
      .toLowerCase() === "payment voucher";

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
  let voucherMetaY = voucherMetaStartY;

  const resolveVoucherMetaValueX = (label) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const labelTextWidth = doc.getTextWidth(String(label ?? ""));
    return voucherBoxLeft + 2 + labelTextWidth + VOUCHER_LABEL_VALUE_GAP_MM;
  };

  const drawVoucherMetaRow = (label, value, options = {}) => {
    const { maxLines = 1, minFontSize = PDF_FONT_BODY } = options;
    const rowTop = voucherMetaY;
    const valueX = resolveVoucherMetaValueX(label);

    drawBodyText(label, voucherBoxLeft + 2, rowTop, { bold: true });

    if (maxLines <= 1) {
      const valueMaxWidth = Math.max(8, contentRight - valueX - 1);
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
      doc.text(String(value ?? ""), sx(valueX), sy(rowTop));
      voucherMetaY += lineHeight;
      return;
    }

    const valueMaxWidth = Math.max(8, contentRight - valueX - 1);
    const { fontSize: valueFontSize, lines: valueLines } = resolveWrappedPdfFontSize(
      doc,
      value,
      sc(valueMaxWidth),
      maxLines,
      sf(bodyFont),
      sf(minFontSize),
      "normal"
    );
    const wrappedLineStep = lineHeight * 0.9;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(valueFontSize);
    valueLines.forEach((line, index) => {
      doc.text(line, sx(valueX), sy(rowTop + index * wrappedLineStep));
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

  const selectedColumns = resolveReceiptPdfColumnKeys(columnKeys);
  const showParticulars = selectedColumns.has("particulars");
  const showTinFtn = selectedColumns.has("tinFtn");
  // Amount / Total always shown (same pattern as agreement-prov Total).
  const showAmount = true;

  const colParticularsX = marginLeft;
  const colAmountRightX = contentRight;
  const amountShare = showAmount ? 0.1 : 0;
  const tinFtnShare = showTinFtn ? 0.26 : 0;
  const colAmountLeftX = colAmountRightX - contentWidth * amountShare;
  const colTinFtnRightX = colAmountLeftX - (showTinFtn ? contentWidth * 0.01 : 0);
  const colTinFtnLeftX = colTinFtnRightX - contentWidth * tinFtnShare;
  const particularsRightEdge = showTinFtn
    ? colTinFtnLeftX
    : showAmount
    ? colAmountLeftX
    : contentRight;
  const particularsMaxWidth = showParticulars
    ? Math.max(12, particularsRightEdge - colParticularsX - PDF_PARTICULARS_COLUMN_GAP_MM)
    : 0;
  const amountMaxWidth = Math.max(10, colAmountRightX - colAmountLeftX);
  const tinFtnMaxWidth = Math.max(10, colTinFtnRightX - colTinFtnLeftX);
  const tinFtnHeaderLabel = paymentVoucher ? "TIN-TRN" : "TIN-FTN";

  const drawAmountCell = (text, y, options = {}) => {
    if (!showAmount) return;
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

  const drawParticularsText = (text, y) => {
    if (!showParticulars) return 1;
    const value = String(text ?? "");
    const { fontSize, lines } = resolveParticularsPdfTextLayout(doc, value, particularsMaxWidth, {
      maxLines: PDF_PARTICULARS_MAX_LINES,
      startSize: PDF_FONT_PARTICULARS_CONTENT_START,
      minSize: PDF_FONT_PARTICULARS_CONTENT_MIN,
      scaleLength: sc,
      scaleFont: sf,
    });
    const lineStep = lineHeight * PDF_PARTICULARS_LINE_STEP_RATIO;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(sf(fontSize));
    lines.forEach((line, index) => {
      doc.text(line, sx(colParticularsX), sy(y + index * lineStep));
    });
    return Math.max(1, lines.length);
  };

  const drawVoucherTableHeader = () => {
    const rowTop = yPos;
    if (showParticulars) {
      drawBodyText("Particulars", colParticularsX, rowTop, { bold: true });
    }
    if (showTinFtn) {
      drawBodyText(tinFtnHeaderLabel, colTinFtnRightX, rowTop, {
        bold: true,
        textOptions: { align: "right", maxWidth: sc(tinFtnMaxWidth) },
      });
    }
    drawBodyText("Amount", colAmountRightX, rowTop, {
      bold: true,
      textOptions: { align: "right", maxWidth: sc(amountMaxWidth) },
    });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const headerTextHeight = doc.getTextDimensions(showParticulars ? "Particulars" : "Amount").h;
    const underlineY = rowTop + headerTextHeight * 0.28 + sc(0.4);
    drawPdfLine(marginLeft, underlineY, contentRight, underlineY);
    yPos = underlineY + lineHeight;
  };

  const drawVoucherTableRow = (particulars, amount, tinFtn) => {
    yPos = ensurePageSpace(
      yPos,
      lineHeight * PDF_PARTICULARS_MAX_LINES * PDF_PARTICULARS_LINE_STEP_RATIO + 2
    );
    if (yPos === marginTop) {
      drawVoucherTableHeader();
    }

    const rowTop = yPos;
    const drawnParticularsLines = drawParticularsText(particulars || "—", rowTop);
    const rowHeight = Math.max(
      lineHeight,
      drawnParticularsLines * lineHeight * PDF_PARTICULARS_LINE_STEP_RATIO
    );
    drawTinFtnCell(tinFtn, rowTop);
    drawAmountCell(formatPdfCurrency(amount), rowTop);
    yPos += rowHeight;
  };

  drawVoucherTableHeader();

  const buildLineParticulars = paymentVoucher
    ? buildPaymentVoucherParticulars
    : buildReceiptVoucherParticulars;
  const emptyLinesMessage = paymentVoucher
    ? "No payment lines recorded"
    : "No receipt lines recorded";

  const lines = Array.isArray(receipt?.lines) ? receipt.lines : [];
  if (lines.length > 0) {
    lines.forEach((line) => {
      drawVoucherTableRow(
        buildLineParticulars(line),
        pickReceiptLineAmount(line),
        pickReceiptLineTinFtn(line)
      );
    });
  } else {
    drawVoucherTableRow(emptyLinesMessage, 0, "—");
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
        fontSize: PDF_FONT_BODY - 2,
        textOptions: { align: "center" },
      });
    });
  };

  drawReceiptSignatureBlocks();
  addContractPdfWatermarks(doc);

  const pdfBlob = doc.output("blob");
  if (openNewTab) {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  }
  return pdfBlob;
}
