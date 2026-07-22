import accountingSysApi from "services/api.accountingsys.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  agreementProvPdfMarginsInchesToMm,
  createAgreementProvPdfScaleHelpers,
  loadAgreementProvPdfMargins,
} from "utils/agreementProvPdfMargins";

const PDF_FONT_TITLE = 18;
const PDF_FONT_BODY = 10;
const PDF_LINE_HEIGHT_MM = 5;
const PDF_VALUE_UNDERLINE_GAP_MM = 0.75;
const PDF_TABLE_FONT = 8;
const PDF_TABLE_CELL_PAD_X = 1.5;
const PDF_TABLE_CELL_PAD_Y = 1.25;
const STATEMENT_PDF_SIGNATURE_BLOCKS = [
  "Prepared By",
  "Checked By",
  "Authorized By",
  "Counter Signed",
];
const STATEMENT_PDF_SIGNATURE_BLANK_LINES = 7;

function pickRowField(rowData, pascalKey, camelKey) {
  if (!rowData) return "";
  const value = rowData[pascalKey] ?? rowData[camelKey];
  return value === null || value === undefined ? "" : value;
}

function pickInvoiceIssueDate(rowData) {
  const dateType = String(pickRowField(rowData, "InvoiceDateType", "invoiceDateType"))
    .trim()
    .toLowerCase();
  if (dateType.includes("end")) return pickRowField(rowData, "PeriodEnd", "periodEnd");
  return pickRowField(rowData, "PeriodStart", "periodStart");
}

function formatStatementPdfDate(raw) {
  const formatted = formatDateDDMMMYYYY(raw);
  if (!formatted || formatted === "—") return "";
  const parts = formatted.split("-");
  if (parts.length !== 3) return formatted;
  return `${parts[0]}-${parts[1]}-${parts[2].slice(-2)}`;
}

function formatPdfContractDateShort(dateString) {
  const formatted = formatDateDDMMMYYYY(dateString);
  if (formatted === "—") return "";
  const parts = formatted.split("-");
  if (parts.length !== 3) return formatted;
  return `${parts[0]} ${parts[1]} ${parts[2].slice(-2)}`;
}

function formatPdfCurrency(value) {
  if (value === null || value === undefined || value === "") return "";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
}

function unwrapAccountingSysList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.items)) return response.items;
  if (Array.isArray(response?.Items)) return response.Items;
  if (Array.isArray(response?.result)) return response.result;
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
        console.error("Error adding logo to PDF:", error);
        resolve(0);
      }
    };
    img.onerror = () => resolve(0);
    img.src = logoPath;
  });
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

function formatCustomerDisplay(contractRow, tenants = []) {
  const tenantNo = String(
    pickRowField(contractRow, "TenantNo", "tenantNo") ||
      pickRowField(contractRow, "PrefixNo", "prefixNo") ||
      ""
  ).trim();
  let ownerName = String(pickRowField(contractRow, "OwnerName", "ownerName") || "").trim();
  if (!ownerName && tenantNo) {
    const tenant = (tenants || []).find(
      (t) => String(t.tenantNo || t.TenantNo || "").trim() === tenantNo
    );
    ownerName = String(tenant?.ownerName || tenant?.OwnerName || "").trim();
  }
  return [tenantNo, ownerName].filter(Boolean).join(" ").trim() || "—";
}

function formatContractDisplay(contractRow) {
  const contractNo = String(pickRowField(contractRow, "ContractNo", "contractNo") || "").trim();
  const contractStartDate = pickRowField(contractRow, "ContractStartDate", "contractStartDate");
  const contractEndDate = pickRowField(contractRow, "ContractEndDate", "contractEndDate");
  const businessName = String(
    pickRowField(contractRow, "BusinessName", "businessName") || ""
  ).trim();
  const contractPeriodStart = formatPdfContractDateShort(contractStartDate);
  const contractPeriodEnd = formatPdfContractDateShort(contractEndDate);
  let contractDisplay =
    contractPeriodStart && contractPeriodEnd
      ? `${contractNo} (${contractPeriodStart} To ${contractPeriodEnd})`
      : contractNo || "—";
  if (businessName) {
    contractDisplay =
      contractDisplay && contractDisplay !== "—"
        ? `${contractDisplay} — ${businessName}`
        : businessName;
  }
  return contractDisplay;
}

function buildStatementTableRows(scheduleRows) {
  return (scheduleRows || []).map((row) => ({
    invoiceNo: String(pickRowField(row, "InvoiceNo", "invoiceNo") || "").trim() || "—",
    issueDate: formatStatementPdfDate(pickInvoiceIssueDate(row)) || "—",
    dueDate: formatStatementPdfDate(pickRowField(row, "DueDate", "dueDate")) || "—",
    amount: formatPdfCurrency(pickRowField(row, "TotalRent", "totalRent")),
    receive: formatPdfCurrency(pickRowField(row, "AmountReceived", "amountReceived")),
    balance: formatPdfCurrency(pickRowField(row, "AmountPending", "amountPending")),
    remarks: String(pickRowField(row, "Remarks", "remarks") || "").trim(),
    amountNum: Number(pickRowField(row, "TotalRent", "totalRent")) || 0,
    receiveNum: Number(pickRowField(row, "AmountReceived", "amountReceived")) || 0,
    balanceNum: Number(pickRowField(row, "AmountPending", "amountPending")) || 0,
  }));
}

function sumStatementTableTotals(tableRows) {
  return (tableRows || []).reduce(
    (acc, row) => {
      acc.amount += Number(row?.amountNum) || 0;
      acc.receive += Number(row?.receiveNum) || 0;
      acc.balance += Number(row?.balanceNum) || 0;
      return acc;
    },
    { amount: 0, receive: 0, balance: 0 }
  );
}

function resolveStatementTableColumns(contentWidth, marginLeft) {
  const ratios = [1.35, 1, 1, 1, 1, 1, 1.4];
  const ratioSum = ratios.reduce((sum, ratio) => sum + ratio, 0);
  let leftX = marginLeft;
  return ratios.map((ratio, index) => {
    const width = (contentWidth * ratio) / ratioSum;
    const col = {
      key: ["invoiceNo", "issueDate", "dueDate", "amount", "receive", "balance", "remarks"][index],
      label: ["Invoice No", "Issue date", "Due Date", "Amount", "Receive", "Balance", "Remarks"][
        index
      ],
      align: index >= 3 && index <= 5 ? "right" : "left",
      leftX,
      width,
      rightX: leftX + width,
    };
    leftX += width;
    return col;
  });
}

function setTablePdfFont(doc, sf, bold = false, fontSize = PDF_TABLE_FONT) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(sf(fontSize));
}

function getPdfTableTextLineHeight(doc, sf, fontSize = PDF_TABLE_FONT) {
  setTablePdfFont(doc, sf, false, fontSize);
  return doc.getTextDimensions("Xy").h;
}

/**
 * Append a Provisional Account Statement page to an existing jsPDF document.
 */
export async function appendProvisionalAccountStatementPdfPage(
  doc,
  contractRow,
  scheduleRows,
  { marginsInParam = null, tenants = [] } = {}
) {
  if (!doc || !contractRow) return;

  doc.addPage();

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
  const customerDisplay = formatCustomerDisplay(contractRow, tenants);
  const contractDisplay = formatContractDisplay(contractRow);
  const tableRows = buildStatementTableRows(scheduleRows);
  const columns = resolveStatementTableColumns(contentWidth, marginLeft);
  const tableTextLineHeight = getPdfTableTextLineHeight(doc, sf);
  const rowHeight = tableTextLineHeight + 2 * PDF_TABLE_CELL_PAD_Y;

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
    console.error("Error fetching accounting system config for statement PDF:", error);
  }

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

  const LOGO_WIDTH_MM = 18;
  const LOGO_GAP_MM = 3;
  const textStartX = marginLeft + LOGO_WIDTH_MM + LOGO_GAP_MM;
  const customerValueX = textStartX;

  await loadPafLogoIntoPdf(doc, sx(marginLeft), sy(marginTop), sc(LOGO_WIDTH_MM));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(PDF_FONT_TITLE));
  doc.text("Provisional Account Statement", sx(textStartX), sy(marginTop + 5));

  let headerY = marginTop + 11;
  drawBodyText(particularName, textStartX, headerY, { bold: true });
  headerY += lineHeight;
  drawBodyText(accountingAddressLine1, textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingAddressLine2 || " ", textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingTelNo ? `Tel No ${accountingTelNo}` : "Tel No", textStartX, headerY);

  let yPos = headerY + lineHeight + 3;

  const drawUnderlinedCustomerRow = (label, value, options = {}) => {
    const { singleLine = false, shrinkFont = false, minFontSize = 6 } = options;
    const rowTop = yPos;
    const labelText = `${label} :`;
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

  drawUnderlinedCustomerRow("Customer", customerDisplay, { singleLine: true });
  drawUnderlinedCustomerRow("Contract", contractDisplay, { singleLine: true, shrinkFont: true });

  yPos += lineHeight;

  const drawTableCellBorder = (leftX, rowTop, width, height) => {
    doc.rect(sx(leftX), sy(rowTop), sc(width), sc(height));
  };

  const drawTableHeader = () => {
    const rowTop = yPos;
    columns.forEach((col) => {
      drawTableCellBorder(col.leftX, rowTop, col.width, rowHeight);
      setTablePdfFont(doc, sf, true);
      const textX =
        col.align === "right"
          ? col.rightX - PDF_TABLE_CELL_PAD_X
          : col.leftX + PDF_TABLE_CELL_PAD_X;
      doc.text(
        col.label,
        sx(textX),
        sy(rowTop + PDF_TABLE_CELL_PAD_Y + tableTextLineHeight * 0.82),
        {
          align: col.align === "right" ? "right" : "left",
        }
      );
    });
    yPos += rowHeight;
  };

  const drawTableDataRow = (row) => {
    yPos = ensurePageSpace(yPos, rowHeight);
    if (yPos === marginTop) {
      drawTableHeader();
    }
    const rowTop = yPos;
    columns.forEach((col) => {
      drawTableCellBorder(col.leftX, rowTop, col.width, rowHeight);
      const text = String(row?.[col.key] ?? "").trim();
      setTablePdfFont(doc, sf, false);
      const textX =
        col.align === "right"
          ? col.rightX - PDF_TABLE_CELL_PAD_X
          : col.leftX + PDF_TABLE_CELL_PAD_X;
      doc.text(text, sx(textX), sy(rowTop + PDF_TABLE_CELL_PAD_Y + tableTextLineHeight * 0.82), {
        align: col.align === "right" ? "right" : "left",
      });
    });
    yPos += rowHeight;
  };

  drawTableHeader();
  if (tableRows.length > 0) {
    tableRows.forEach((row) => drawTableDataRow(row));
  } else {
    drawTableDataRow({
      invoiceNo: "",
      issueDate: "",
      dueDate: "",
      amount: "",
      receive: "",
      balance: "",
      remarks: "",
    });
  }

  const totals = sumStatementTableTotals(tableRows);
  const drawTableTotalRow = () => {
    yPos = ensurePageSpace(yPos, rowHeight);
    if (yPos === marginTop) {
      drawTableHeader();
    }
    const rowTop = yPos;
    const totalRow = {
      invoiceNo: "Total",
      issueDate: "",
      dueDate: "",
      amount: formatPdfCurrency(totals.amount),
      receive: formatPdfCurrency(totals.receive),
      balance: formatPdfCurrency(totals.balance),
      remarks: "",
    };
    columns.forEach((col) => {
      drawTableCellBorder(col.leftX, rowTop, col.width, rowHeight);
      const text = String(totalRow?.[col.key] ?? "").trim();
      setTablePdfFont(doc, sf, true);
      const textX =
        col.align === "right"
          ? col.rightX - PDF_TABLE_CELL_PAD_X
          : col.leftX + PDF_TABLE_CELL_PAD_X;
      doc.text(text, sx(textX), sy(rowTop + PDF_TABLE_CELL_PAD_Y + tableTextLineHeight * 0.82), {
        align: col.align === "right" ? "right" : "left",
      });
    });
    yPos += rowHeight;
  };
  drawTableTotalRow();

  const signatureBlockHeight = lineHeight * 2;
  let signatureLineY = yPos + STATEMENT_PDF_SIGNATURE_BLANK_LINES * lineHeight;
  if (signatureLineY + signatureBlockHeight > logicalPageBottomY - logicalPageBottomReserve) {
    doc.addPage();
    signatureLineY = marginTop + STATEMENT_PDF_SIGNATURE_BLANK_LINES * lineHeight;
  }
  const signatureLabelY = signatureLineY + lineHeight;

  const blockWidth = contentWidth / STATEMENT_PDF_SIGNATURE_BLOCKS.length;
  STATEMENT_PDF_SIGNATURE_BLOCKS.forEach((label, index) => {
    const blockLeft = marginLeft + index * blockWidth + 2;
    const blockRight = marginLeft + (index + 1) * blockWidth - 6;
    drawPdfLine(blockLeft, signatureLineY, blockRight, signatureLineY);
    drawBodyText(label, (blockLeft + blockRight) / 2, signatureLabelY, {
      fontSize: PDF_FONT_BODY - 2,
      textOptions: { align: "center" },
    });
  });
}
