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
const PDF_TABLE_FONT = 9.5;
const PDF_TABLE_FONT_MIN = 7;
const PDF_TABLE_FONT_STEP = 0.5;
const PDF_TABLE_CELL_PAD_X = 0.55;
const PDF_TABLE_CELL_PAD_Y = 0.35;
const PDF_TABLE_HEADER_LINE_GAP = 0.5;
const PDF_TABLE_FLEX_GROW_COLUMN_KEYS = new Set([
  "tenantAndBusiness",
  "agreement",
  "base",
  "className",
]);
const SIGNATURE_BLOCKS = ["Prepared By", "Checked By", "Authorized By", "Counter Signed"];
const SIGNATURE_BOTTOM_RATIO = 0.2;

function formatPdfCurrency(value) {
  if (value === null || value === undefined || value === "") return "0";
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n)
    ? n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })
    : String(value);
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

function setTablePdfFont(doc, sf, bold = false, fontSize = PDF_TABLE_FONT) {
  doc.setFont("helvetica", bold ? "bold" : "normal");
  doc.setFontSize(sf(fontSize));
}

function measurePdfTextWidth(doc, sf, text, bold = false, fontSize = PDF_TABLE_FONT) {
  setTablePdfFont(doc, sf, bold, fontSize);
  return doc.getTextWidth(String(text ?? "").trim() || "—");
}

function getPdfTableCellText(col, row, numericColumnKeys) {
  if (!row || typeof row !== "object") return "—";
  if (col.key === "ratio") {
    return textValue(row[col.key]);
  }
  if (numericColumnKeys.has(col.key)) {
    return formatPdfCurrency(row[col.key]);
  }
  return textValue(row[col.key]);
}

function getPdfHeaderLines(col) {
  if (Array.isArray(col.headerLines) && col.headerLines.length > 0) {
    return col.headerLines.map((line) => String(line ?? "").trim()).filter(Boolean);
  }
  return [String(col.label ?? "").trim()].filter(Boolean);
}

function getPdfTableTextLineHeight(doc, sf, fontSize = PDF_TABLE_FONT) {
  setTablePdfFont(doc, sf, false, fontSize);
  return doc.getTextDimensions("Xy").h;
}

function getPdfTableCellLines(
  doc,
  sf,
  text,
  maxInnerWidth,
  bold = false,
  allowWrap = true,
  fontSize = PDF_TABLE_FONT
) {
  setTablePdfFont(doc, sf, bold, fontSize);
  const value = String(text ?? "").trim() || "—";
  if (!allowWrap || maxInnerWidth <= 0 || doc.getTextWidth(value) <= maxInnerWidth) {
    return [value];
  }
  const wrapped = doc.splitTextToSize(value, maxInnerWidth);
  return wrapped.length > 0 ? wrapped : [value];
}

function distributePdfTableColumnWidths(rawWidths, columnDefs, contentWidth) {
  const totalRawWidth = rawWidths.reduce((sum, width) => sum + width, 0);
  if (totalRawWidth <= 0) return { widths: rawWidths, totalWidth: 0 };

  if (totalRawWidth >= contentWidth - 0.01) {
    return { widths: rawWidths, totalWidth: totalRawWidth };
  }

  const extra = contentWidth - totalRawWidth;
  const flexIndexes = columnDefs
    .map((col, index) => (PDF_TABLE_FLEX_GROW_COLUMN_KEYS.has(col.key) ? index : -1))
    .filter((index) => index >= 0);
  const flexTotal = flexIndexes.reduce((sum, index) => sum + rawWidths[index], 0);

  if (flexTotal > 0) {
    const widths = rawWidths.map((width, index) => {
      if (!flexIndexes.includes(index)) return width;
      return width + extra * (width / flexTotal);
    });
    return { widths, totalWidth: contentWidth };
  }

  const widths = rawWidths.map((width) => width + extra * (width / totalRawWidth));
  return { widths, totalWidth: contentWidth };
}

function measurePdfTableBlockHeight(lineCount, lineHeight) {
  if (lineCount <= 0) return lineHeight;
  return lineCount * lineHeight + (lineCount - 1) * PDF_TABLE_HEADER_LINE_GAP;
}

function buildTightPdfTableColumns({
  doc,
  sf,
  columnDefs,
  rows,
  totalsRow,
  numericColumnKeys,
  contentWidth,
  marginLeft,
  tableFontSize = PDF_TABLE_FONT,
}) {
  const rawWidths = columnDefs.map((col) => {
    const headerLines = getPdfHeaderLines(col);
    let maxContentWidth = 0;
    const isNumericCol = numericColumnKeys.has(col.key);

    headerLines.forEach((line) => {
      maxContentWidth = Math.max(
        maxContentWidth,
        measurePdfTextWidth(doc, sf, line, true, tableFontSize)
      );
    });

    rows.forEach((row) => {
      const cellText = getPdfTableCellText(col, row, numericColumnKeys);
      maxContentWidth = Math.max(
        maxContentWidth,
        measurePdfTextWidth(doc, sf, cellText, false, tableFontSize)
      );
      if (isNumericCol) {
        maxContentWidth = Math.max(
          maxContentWidth,
          measurePdfTextWidth(doc, sf, cellText, true, tableFontSize)
        );
      }
    });

    if (isNumericCol) {
      maxContentWidth = Math.max(
        maxContentWidth,
        measurePdfTextWidth(
          doc,
          sf,
          formatPdfCurrency(totalsRow[col.key] ?? 0),
          true,
          tableFontSize
        )
      );
    }

    if (col.key === columnDefs[0]?.key) {
      maxContentWidth = Math.max(
        maxContentWidth,
        measurePdfTextWidth(doc, sf, "Total", true, tableFontSize)
      );
    }

    return maxContentWidth + 2 * PDF_TABLE_CELL_PAD_X;
  });

  const { widths, totalWidth } = distributePdfTableColumnWidths(
    rawWidths,
    columnDefs,
    contentWidth
  );

  let runningX = marginLeft;
  const columns = columnDefs.map((col, index) => {
    const width = widths[index];
    const column = {
      ...col,
      width,
      leftX: runningX,
      rightX: runningX + width,
      innerWidth: Math.max(width - 2 * PDF_TABLE_CELL_PAD_X, 1),
      minWidth: rawWidths[index],
    };
    runningX += width;
    return column;
  });

  return { columns, totalWidth, tableFontSize };
}

function resolveShareDistributionPdfTableLayout(options) {
  for (
    let tableFontSize = PDF_TABLE_FONT;
    tableFontSize >= PDF_TABLE_FONT_MIN;
    tableFontSize -= PDF_TABLE_FONT_STEP
  ) {
    const layout = buildTightPdfTableColumns({ ...options, tableFontSize });
    if (layout.totalWidth <= options.contentWidth + 0.01) {
      return layout;
    }
  }

  return buildTightPdfTableColumns({
    ...options,
    tableFontSize: PDF_TABLE_FONT_MIN,
  });
}

function getPdfTableTextX(col) {
  if (col.align === "right") return col.rightX - PDF_TABLE_CELL_PAD_X;
  if (col.align === "center") return (col.leftX + col.rightX) / 2;
  return col.leftX + PDF_TABLE_CELL_PAD_X;
}

function getPdfTableTextAlign(col) {
  if (col.align === "right") return "right";
  if (col.align === "center") return "center";
  return "left";
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
    { key: "base", label: "Base", align: "left" },
    { key: "className", label: "Class", align: "left" },
    { key: "agreement", label: "Agreement", align: "left" },
    { key: "tenantAndBusiness", label: "Tenant and Business", align: "left" },
    {
      key: "govtSharePA",
      headerLines: ["Govt Share", "PA"],
      label: "Govt Share-PA",
      align: "right",
    },
    {
      key: "currentRentPA",
      headerLines: ["Current Rent", "PA"],
      label: "Current Rent-PA",
      align: "right",
    },
    { key: "receiptDate", label: "Receipt Date", align: "center" },
    { key: "receiptAmount", label: "Receipt Amount", align: "right" },
    { key: "ratio", label: "Ratio", align: "right" },
    { key: "govt", label: "Govt", align: "right" },
    { key: "paf", label: "PAF", align: "right" },
    { key: "ahq", label: "AHQ", align: "right" },
    { key: "rac", label: "RAC", align: "right" },
    { key: "baseShare", label: "Base", align: "right" },
  ];

  const numericColumnKeys = new Set(
    columnDefs.filter((col) => col.align === "right" && col.key !== "ratio").map((col) => col.key)
  );

  const totalsRow = rows.reduce((acc, row) => {
    numericColumnKeys.forEach((key) => {
      const value = parsePdfNumber(row?.[key]);
      if (value != null) acc[key] = (acc[key] || 0) + value;
    });
    return acc;
  }, {});

  const { columns, tableFontSize } = resolveShareDistributionPdfTableLayout({
    doc,
    sf,
    columnDefs,
    rows,
    totalsRow,
    numericColumnKeys,
    contentWidth,
    marginLeft,
  });

  const tableTextLineHeight = getPdfTableTextLineHeight(doc, sf, tableFontSize);
  const singleBodyRowHeight = tableTextLineHeight + 2 * PDF_TABLE_CELL_PAD_Y;

  const measureHeaderRowHeight = () => {
    let maxLines = 1;
    columns.forEach((col) => {
      maxLines = Math.max(maxLines, getPdfHeaderLines(col).length);
    });
    return measurePdfTableBlockHeight(maxLines, tableTextLineHeight) + 2 * PDF_TABLE_CELL_PAD_Y;
  };

  const measureBodyRowHeight = () => singleBodyRowHeight;

  const drawTableCellBorder = (leftX, rowTop, width, rowHeight) => {
    doc.rect(sx(leftX), sy(rowTop), sc(width), sc(rowHeight));
  };

  const drawTableHeaderCellText = (col, rowTop) => {
    const headerLines = getPdfHeaderLines(col);
    let baseline = rowTop + PDF_TABLE_CELL_PAD_Y + tableTextLineHeight * 0.82;

    setTablePdfFont(doc, sf, true, tableFontSize);
    headerLines.forEach((line, index) => {
      doc.text(line, sx((col.leftX + col.rightX) / 2), sy(baseline), { align: "center" });
      if (index < headerLines.length - 1) {
        baseline += tableTextLineHeight + PDF_TABLE_HEADER_LINE_GAP;
      }
    });
  };

  const drawTableBodyCellText = (col, text, rowTop, options = {}) => {
    const lines = getPdfTableCellLines(
      doc,
      sf,
      text,
      col.innerWidth,
      options.bold,
      false,
      tableFontSize
    );
    let baseline = rowTop + PDF_TABLE_CELL_PAD_Y + tableTextLineHeight * 0.82;

    setTablePdfFont(doc, sf, Boolean(options.bold), tableFontSize);
    lines.forEach((line, index) => {
      doc.text(line, sx(getPdfTableTextX(col)), sy(baseline), {
        align: getPdfTableTextAlign(col),
      });
      if (index < lines.length - 1) {
        baseline += tableTextLineHeight + PDF_TABLE_HEADER_LINE_GAP;
      }
    });
  };

  const drawTableHeader = () => {
    const rowTop = yPos;
    const rowHeight = measureHeaderRowHeight();

    columns.forEach((col) => {
      doc.setDrawColor(0, 0, 0);
      drawTableCellBorder(col.leftX, rowTop, col.width, rowHeight);
      drawTableHeaderCellText(col, rowTop);
    });

    yPos = rowTop + rowHeight;
  };

  const drawTableRow = (row) => {
    const rowHeight = measureBodyRowHeight();
    yPos = ensurePageSpace(yPos, rowHeight);
    if (yPos === marginTop) {
      drawTableHeader();
    }

    const rowTop = yPos;
    columns.forEach((col) => {
      drawTableCellBorder(col.leftX, rowTop, col.width, rowHeight);
      drawTableBodyCellText(col, getPdfTableCellText(col, row, numericColumnKeys), rowTop);
    });
    yPos = rowTop + rowHeight;
  };

  const drawTotalsRow = () => {
    const totalLabelSpan = Math.min(4, columns.length);
    const rowHeight = singleBodyRowHeight;

    yPos = ensurePageSpace(yPos, rowHeight);
    if (yPos === marginTop) {
      drawTableHeader();
    }

    const rowTop = yPos;
    columns.forEach((col, index) => {
      if (index < totalLabelSpan) {
        if (index === 0) {
          const spanRightX = columns[totalLabelSpan - 1].rightX;
          drawTableCellBorder(col.leftX, rowTop, spanRightX - col.leftX, rowHeight);
          drawTableBodyCellText(col, "Total", rowTop, { bold: true });
        }
        return;
      }

      drawTableCellBorder(col.leftX, rowTop, col.width, rowHeight);
      if (numericColumnKeys.has(col.key)) {
        drawTableBodyCellText(col, formatPdfCurrency(totalsRow[col.key] ?? 0), rowTop, {
          bold: true,
        });
      }
    });

    yPos = rowTop + rowHeight;
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
