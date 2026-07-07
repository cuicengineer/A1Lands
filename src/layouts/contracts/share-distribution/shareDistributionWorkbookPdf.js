import jsPDF from "jspdf";
import accountingSysApi from "services/api.accountingsys.service";
import {
  agreementProvPdfMarginsInchesToMm,
  createAgreementProvPdfScaleHelpers,
  loadShareDistributionWorkbookPdfMargins,
} from "utils/agreementProvPdfMargins";

const PDF_FONT_TITLE = 18;
const PDF_FONT_BODY = 10;
const PDF_LINE_HEIGHT_MM = 5;
const PDF_VALUE_UNDERLINE_GAP_MM = 0.75;
const SIGNATURE_BLOCKS = ["Prepared By", "Checked By", "Approved By"];
const SIGNATURE_BOTTOM_RATIO = 0.2;

function formatPdfCurrency(value) {
  if (value === null || value === undefined || value === "") return "0";
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n.toLocaleString("en-US") : String(value);
}

function textValue(value) {
  const text = String(value ?? "").trim();
  return text || "—";
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
        console.error("Error adding logo to workbook PDF:", error);
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

function buildWorkbookRows(workbookData) {
  return Array.isArray(workbookData?.rows) ? workbookData.rows : [];
}

function parsePdfNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Generate workbook PDF using the same preview utility pattern as payment.
 */
export async function generateShareDistributionWorkbookPdf(
  workbookData,
  marginsInParam = null,
  { openNewTab = false, documentTitle = "Workbook" } = {}
) {
  if (!workbookData) {
    throw new Error("No workbook data available for PDF.");
  }

  const rows = buildWorkbookRows(workbookData);
  const workbookNo = textValue(workbookData?.workbookNo || workbookData?.workbook);

  const doc = new jsPDF({ orientation: "landscape" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginsIn = marginsInParam ?? loadShareDistributionWorkbookPdfMargins();
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
    console.error("Error fetching accounting system config for workbook PDF:", error);
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
  const metaBoxWidth = 62;
  const metaLabelColWidth = 22;
  const metaBoxLeft = contentRight - metaBoxWidth;
  const metaValueX = metaBoxLeft + metaLabelColWidth + 2;

  await loadPafLogoIntoPdf(doc, sx(marginLeft), sy(marginTop), sc(LOGO_WIDTH_MM));

  doc.setFont("helvetica", "bold");
  doc.setFontSize(sf(PDF_FONT_TITLE));
  doc.text(documentTitle, sx(textStartX), sy(marginTop + 5));

  let headerY = marginTop + 11;
  drawBodyText(particularName, textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingAddressLine1, textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingAddressLine2 || " ", textStartX, headerY);
  headerY += lineHeight;
  drawBodyText(accountingTelNo ? `Tel No ${accountingTelNo}` : "Tel No", textStartX, headerY);

  const metaStartY = marginTop + 10;
  drawBodyText("Workbook", metaBoxLeft + 2, metaStartY, { bold: true });
  drawBodyText(workbookNo, metaValueX, metaStartY);
  const metaTextHeight = doc.getTextDimensions("Workbook").h;
  const metaLineTopY = metaStartY - metaTextHeight * 0.72;
  const metaLineBottomY = metaStartY + metaTextHeight * 0.28;
  drawPdfLine(metaBoxLeft, metaLineTopY, metaBoxLeft, metaLineBottomY);

  let yPos = Math.max(headerY, metaStartY + lineHeight) + lineHeight + 2;

  const columnDefs = [
    { key: "base", label: "Base", width: 0.07, align: "left" },
    { key: "className", label: "Class", width: 0.07, align: "left" },
    { key: "agreement", label: "Agreement", width: 0.15, align: "left" },
    { key: "tenantAndBusiness", label: "Tenant and Business", width: 0.2, align: "left" },
    {
      key: "govtSharePA",
      headerLines: ["Govt Share", "PA"],
      label: "Govt Share-PA",
      width: 0.1,
      align: "right",
    },
    {
      key: "currentRentPA",
      headerLines: ["Current Rent", "PA"],
      label: "Current Rent-PA",
      width: 0.1,
      align: "right",
    },
    { key: "receiptDate", label: "Receipt Date", width: 0.08, align: "center" },
    { key: "receiptAmount", label: "Receipt Amount", width: 0.1, align: "right" },
    { key: "ratio", label: "Ratio", width: 0.06, align: "right" },
    { key: "govt", label: "Govt", width: 0.06, align: "right" },
    { key: "paf", label: "PAF", width: 0.06, align: "right" },
    { key: "ahq", label: "AHQ", width: 0.06, align: "right" },
    { key: "rac", label: "RAC", width: 0.05, align: "right" },
    { key: "baseShare", label: "Base", width: 0.05, align: "right" },
  ];

  const totalRatio = columnDefs.reduce((sum, col) => sum + col.width, 0);
  const normalizedColumns = columnDefs.map((col) => ({ ...col, width: col.width / totalRatio }));

  let runningX = marginLeft;
  const columns = normalizedColumns.map((col) => {
    const width = contentWidth * col.width;
    const current = {
      ...col,
      leftX: runningX,
      rightX: runningX + width,
      width,
    };
    runningX += width;
    return current;
  });

  const numericColumnKeys = new Set(
    columnDefs.filter((col) => col.align === "right").map((col) => col.key)
  );

  const totalsRow = rows.reduce((acc, row) => {
    numericColumnKeys.forEach((key) => {
      const value = parsePdfNumber(row?.[key]);
      if (value != null) acc[key] = (acc[key] || 0) + value;
    });
    return acc;
  }, {});

  const drawTableHeader = () => {
    const rowTop = yPos;
    const rowHeight = lineHeight * 2;

    columns.forEach((col) => {
      doc.setDrawColor(0, 0, 0);
      doc.rect(sx(col.leftX), sy(rowTop - 3.5), sc(col.width), sc(rowHeight));
      doc.setFont("helvetica", "bold");
      doc.setFontSize(sf(7.5));
      const headerLines = Array.isArray(col.headerLines)
        ? col.headerLines
        : doc.splitTextToSize(String(col.label), sc(col.width - 2));
      const line1 = headerLines[0] || "";
      const line2 = headerLines[1] || "";
      doc.text(line1, sx((col.leftX + col.rightX) / 2), sy(rowTop + 1), { align: "center" });
      if (line2) {
        doc.text(line2, sx((col.leftX + col.rightX) / 2), sy(rowTop + 5), { align: "center" });
      }
    });

    yPos += rowHeight + 1;
  };

  const drawCellValue = (col, text, y, options = {}) => {
    const value = textValue(text);
    drawBodyText(
      value,
      col.align === "right"
        ? col.rightX - 1.2
        : col.align === "center"
        ? (col.leftX + col.rightX) / 2
        : col.leftX + 1.2,
      y,
      {
        fontSize: 7.5,
        bold: Boolean(options.bold),
        textOptions:
          col.align === "right"
            ? { align: "right", maxWidth: sc(col.width - 2) }
            : col.align === "center"
            ? { align: "center", maxWidth: sc(col.width - 2) }
            : { align: "left", maxWidth: sc(col.width - 2) },
      }
    );
  };

  const drawTableRow = (row) => {
    yPos = ensurePageSpace(yPos, lineHeight + 4);
    if (yPos === marginTop) {
      drawTableHeader();
    }
    const rowTop = yPos;
    const rowHeight = lineHeight + 2;
    columns.forEach((col) => {
      doc.rect(sx(col.leftX), sy(rowTop - 3), sc(col.width), sc(rowHeight));
      drawCellValue(col, row?.[col.key], rowTop + 1);
    });
    yPos += rowHeight;
  };

  const drawTotalsRow = () => {
    yPos = ensurePageSpace(yPos, lineHeight + 4);
    if (yPos === marginTop) {
      drawTableHeader();
    }

    const rowTop = yPos;
    const rowHeight = lineHeight + 2;
    const totalLabelSpan = Math.min(4, columns.length);

    columns.forEach((col, index) => {
      if (index < totalLabelSpan) {
        if (index === 0) {
          const spanRightX = columns[totalLabelSpan - 1].rightX;
          doc.rect(sx(col.leftX), sy(rowTop - 3), sc(spanRightX - col.leftX), sc(rowHeight));
          drawBodyText("Total", col.leftX + 1.2, rowTop + 1, {
            bold: true,
            fontSize: 7.5,
            textOptions: { align: "left", maxWidth: sc(spanRightX - col.leftX - 2) },
          });
        }
        return;
      }

      doc.rect(sx(col.leftX), sy(rowTop - 3), sc(col.width), sc(rowHeight));
      if (numericColumnKeys.has(col.key)) {
        drawCellValue(col, formatPdfCurrency(totalsRow[col.key] ?? 0), rowTop + 1, { bold: true });
      }
    });

    yPos += rowHeight;
  };

  drawTableHeader();
  if (rows.length > 0) {
    rows.forEach((row) => drawTableRow(row));
    drawTotalsRow();
  } else {
    drawTableRow({});
  }

  yPos = ensurePageSpace(yPos + 6, lineHeight * 3);
  const signatureLabelY = pageHeight * (1 - SIGNATURE_BOTTOM_RATIO);
  const signatureLineY = signatureLabelY - lineHeight;
  const signatureReservedTopY = signatureLineY - lineHeight * 1.5;
  if (yPos > signatureReservedTopY) {
    doc.addPage();
  }

  const drawSignatureBlocks = () => {
    const pageCount = doc.internal.getNumberOfPages();
    doc.setPage(pageCount);
    const blockWidth = contentWidth / SIGNATURE_BLOCKS.length;
    SIGNATURE_BLOCKS.forEach((label, index) => {
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
