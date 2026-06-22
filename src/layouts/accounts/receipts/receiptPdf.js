import jsPDF from "jspdf";
import accountingSysApi from "services/api.accountingsys.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  agreementProvPdfMarginsInchesToMm,
  createAgreementProvPdfScaleHelpers,
  loadAgreementProvPdfMargins,
} from "utils/agreementProvPdfMargins";
import { computeGrandTotal, computeLineTotal } from "./receiptUtils";

const PDF_FONT_TITLE = 18;
const PDF_FONT_BODY = 10;
const PDF_LINE_HEIGHT_MM = 5;
const PDF_VALUE_UNDERLINE_GAP_MM = 0.75;

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

function buildReceivedInLabel(receipt) {
  return [receipt?.payeeName, receipt?.payeePartyCode].filter(Boolean).join(" - ") || "—";
}

function buildPartyLabel(line) {
  const display = line?.partyLabel || line?.partyName || line?.partyCode || "";
  const type = line?.partyType || "";
  if (display && type) return `${type} - ${display}`;
  return display || type || "";
}

function buildReceiptLineDescription(line) {
  const parts = [
    line?.item,
    line?.account,
    buildPartyLabel(line),
    line?.contractNo || line?.contractId,
    line?.invoiceNo || line?.invoiceKey,
    line?.tinTrn ? `TIN-TRN ${line.tinTrn}` : "",
  ]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);
  return parts.join(" — ") || "—";
}

function pickReceiptContractDisplay(receipt) {
  const lines = Array.isArray(receipt?.lines) ? receipt.lines : [];
  const contracts = [
    ...new Set(
      lines.map((line) => String(line?.contractNo || line?.contractId || "").trim()).filter(Boolean)
    ),
  ];
  if (contracts.length === 0) return "—";
  if (contracts.length === 1) return contracts[0];
  return contracts.join(", ");
}

function pickReceiptReference(receipt) {
  if (receipt?.referenceAutomatic) {
    return textValue(receipt?.reference || "Automatic");
  }
  return textValue(receipt?.reference);
}

/**
 * Generate a Receipt PDF using the same layout as Agreement Prov Invoice.
 */
export async function generateReceiptPdf(
  receipt,
  marginsInParam = null,
  { openNewTab = false } = {}
) {
  if (!receipt) {
    throw new Error("No receipt data available for PDF.");
  }

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginsIn = marginsInParam ?? loadAgreementProvPdfMargins();
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

  const receiptNo = textValue(receipt?.id ?? receipt?.Id);
  const receiptDateDisplay = formatPdfDate(receipt?.date);
  const referenceDisplay = pickReceiptReference(receipt);
  const customerDisplay = textValue(receipt?.paidFrom);
  const receivedInDisplay = buildReceivedInLabel(receipt);
  const contractDisplay = pickReceiptContractDisplay(receipt);
  const descriptionText = textValue(receipt?.description);
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
  const INVOICE_BOX_WIDTH_MM = 54;
  const INVOICE_LABEL_COL_MM = 24;
  const invoiceBoxLeft = contentRight - INVOICE_BOX_WIDTH_MM;
  const invoiceValueX = invoiceBoxLeft + INVOICE_LABEL_COL_MM + 2;
  const customerValueX = textStartX;

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
  doc.text("Receipt", sx(textStartX), sy(marginTop + 5));

  let headerY = marginTop + 11;
  drawBodyText(particularName, textStartX, headerY, { bold: true });
  headerY += lineHeight;
  drawBodyText(accountingAddressLine1, textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingAddressLine2 || " ", textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingTelNo ? `Tel No ${accountingTelNo}` : "Tel No", textStartX, headerY);

  let invoiceMetaY = marginTop + 5 + lineHeight;
  const invoiceMetaRows = [
    ["Receipt No", receiptNo],
    ["Receipt Date", receiptDateDisplay || "—"],
    ["Reference", referenceDisplay || "—"],
  ];
  invoiceMetaRows.forEach(([label, value]) => {
    drawBodyText(label, invoiceBoxLeft + 2, invoiceMetaY, { bold: true });
    drawBodyText(value, invoiceValueX, invoiceMetaY);
    invoiceMetaY += lineHeight;
  });

  let yPos = Math.max(headerY, invoiceMetaY) + lineHeight + 3;

  const drawUnderlinedCustomerRow = (label, value, withColon = true, options = {}) => {
    const { singleLine = false, shrinkFont = false, minFontSize = 6 } = options;
    const rowTop = yPos;
    const labelText = withColon ? `${label} :` : label;
    const maxValueWidth = contentRight - customerValueX - 1;
    const valueText = String(value || "—");
    const rowBandHeight = lineHeight;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const labelHeight = doc.getTextDimensions(labelText).h;
    const labelBaselineY = getPdfRowCenteredBaselineY(rowTop, rowBandHeight, labelHeight);
    doc.text(labelText, sx(marginLeft + 1), sy(labelBaselineY));

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

    if (singleLine) {
      const valueHeight = doc.getTextDimensions(valueText).h;
      const valueBaselineY = getPdfRowCenteredBaselineY(rowTop, rowBandHeight, valueHeight);
      doc.text(valueText, sx(customerValueX), sy(valueBaselineY));
      const underlineY = getPdfValueUnderlineY(valueBaselineY, valueHeight, sc);
      drawPdfLine(customerValueX, underlineY, contentRight, underlineY);
      yPos = underlineY + 1.75;
      return;
    }

    const valueLines = doc.splitTextToSize(valueText, maxValueWidth);
    let lastLineBaselineY = rowTop;
    let lastLineHeight = 0;
    valueLines.forEach((line, index) => {
      const lineHeightDim = doc.getTextDimensions(line).h;
      const lineBaselineY = getPdfRowCenteredBaselineY(
        rowTop + index * lineHeight,
        lineHeight,
        lineHeightDim
      );
      doc.text(line, sx(customerValueX), sy(lineBaselineY));
      lastLineBaselineY = lineBaselineY;
      lastLineHeight = lineHeightDim;
    });
    const underlineY = getPdfValueUnderlineY(lastLineBaselineY, lastLineHeight, sc);
    drawPdfLine(customerValueX, underlineY, contentRight, underlineY);
    yPos = underlineY + 1.75;
  };

  drawUnderlinedCustomerRow("Paid By", customerDisplay, true, { singleLine: true });
  drawUnderlinedCustomerRow("Received In", receivedInDisplay, true, {
    singleLine: true,
    shrinkFont: true,
  });
  drawUnderlinedCustomerRow("Contract", contractDisplay, true, {
    singleLine: true,
    shrinkFont: true,
  });
  drawUnderlinedCustomerRow("Description", descriptionText, false);

  yPos += lineHeight;

  const pdfBodyColQtyX = marginLeft + contentWidth * 0.58;
  const pdfBodyColUnitPriceX = marginLeft + contentWidth * 0.72;
  const pdfBodyDescWidth = pdfBodyColQtyX - marginLeft - 2;

  const drawBodyTableHeader = () => {
    const rowTop = yPos;
    drawBodyText("Detail", marginLeft, rowTop, { bold: true });
    drawBodyText("Qty", pdfBodyColQtyX, rowTop, { bold: true });
    drawBodyText("Unit price", pdfBodyColUnitPriceX, rowTop, { bold: true });
    drawBodyText("Total", contentRight, rowTop, { bold: true, textOptions: { align: "right" } });

    doc.setFont("helvetica", "bold");
    doc.setFontSize(sf(bodyFont));
    const headerTextHeight = doc.getTextDimensions("Detail").h;
    const underlineY = rowTop + headerTextHeight * 0.28 + sc(0.4);
    drawPdfLine(marginLeft, underlineY, contentRight, underlineY);
    yPos = underlineY + lineHeight;
  };

  const drawBodyTableRow = (description, qty, unitPrice, lineTotal) => {
    yPos = ensurePageSpace(yPos, lineHeight + 2);
    if (yPos === marginTop) {
      drawBodyTableHeader();
    }

    const descLines = doc.splitTextToSize(String(description || "—"), pdfBodyDescWidth);
    doc.setFontSize(sf(bodyFont));
    descLines.forEach((line, index) => {
      if (index > 0) {
        yPos = ensurePageSpace(yPos, lineHeight);
        if (yPos === marginTop) {
          drawBodyTableHeader();
        }
      }
      drawBodyText(line, marginLeft, yPos);
      if (index === 0) {
        drawBodyText(String(qty ?? "—"), pdfBodyColQtyX, yPos);
        drawBodyText(formatPdfCurrency(unitPrice), pdfBodyColUnitPriceX, yPos);
        drawBodyText(formatPdfCurrency(lineTotal), contentRight, yPos, {
          textOptions: { align: "right" },
        });
      }
      yPos += lineHeight;
    });
  };

  drawBodyTableHeader();

  const lines = Array.isArray(receipt?.lines) ? receipt.lines : [];
  if (lines.length > 0) {
    lines.forEach((line) => {
      const qty = textValue(line?.quantity || "1");
      const unitPrice = Number(line?.amount) || 0;
      const lineTotal = Number(line?.total) || computeLineTotal(line) || unitPrice;
      drawBodyTableRow(buildReceiptLineDescription(line), qty, unitPrice, lineTotal);
    });
  } else {
    drawBodyTableRow("No receipt lines recorded", "—", "0", "0");
  }

  yPos = ensurePageSpace(yPos + 4, lineHeight * 3);
  yPos += 4;

  const totalText = `Total: ${formatPdfCurrency(total)}`;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(bodyFont));
  const totalDims = doc.getTextDimensions(totalText);
  const totalRowY = yPos;
  const totalOverlineY = totalRowY - totalDims.h * 0.75 - sc(0.5);
  drawPdfLine(marginLeft, totalOverlineY, contentRight, totalOverlineY);
  drawBodyText(totalText, contentRight, totalRowY, {
    bold: true,
    textOptions: { align: "right" },
  });

  yPos += lineHeight + 8;
  if (yPos > logicalPageBottomY - logicalPageBottomReserve) {
    doc.addPage();
    yPos = marginTop;
  }
  const signatureY = Math.max(yPos + 10, logicalPageBottomY - sc(18));
  drawPdfLine(marginLeft, signatureY, contentRight, signatureY);

  const pdfBlob = doc.output("blob");
  if (openNewTab) {
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, "_blank", "noopener,noreferrer");
    setTimeout(() => URL.revokeObjectURL(pdfUrl), 60000);
  }
  return pdfBlob;
}
