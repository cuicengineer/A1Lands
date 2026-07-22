import contractApi from "services/api.contract.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";

const PDF_FONT_TITLE = 16;
const PDF_FONT_SECTION = 11;
const PDF_FONT_BODY = 10;
const PDF_LINE_HEIGHT = 5;
const PDF_LABEL_VALUE_GAP = 1.5;

const RISE_INTERVAL_LABELS = {
  1: "Monthly",
  3: "Quarterly",
  6: "Sixmonthly",
  12: "Annual",
};

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return "";
}

function formatPdfAgreementDate(raw) {
  const formatted = formatDateDDMMMYYYY(raw);
  if (!formatted || formatted === "—") return "—";
  const parts = formatted.split("-");
  if (parts.length !== 3) return formatted;
  return `${parts[0]}-${parts[1]}-${parts[2].slice(-2)}`;
}

function formatPdfAmount(value) {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return `${n.toLocaleString("en-US")}/-`;
}

function formatPdfPercent(value) {
  if (value === null || value === undefined || value === "") return "—";
  const text = String(value).trim();
  if (!text) return "—";
  return text.endsWith("%") ? text : `${text}%`;
}

function formatPaymentTermLabel(months) {
  if (months === "" || months === null || months === undefined) return "—";
  const n = Number(months);
  const options = [
    { value: 1, label: "Monthly" },
    { value: 3, label: "Quarterly" },
    { value: 6, label: "Sixmonthly" },
    { value: 12, label: "Annual" },
  ];
  const match = options.find((o) => o.value === n);
  if (match) return match.label;
  return String(months);
}

function formatRiseIntervalLabel(months) {
  if (months === "" || months === null || months === undefined) return "—";
  const n = Number(months);
  if (RISE_INTERVAL_LABELS[n]) return RISE_INTERVAL_LABELS[n];
  if (Number.isFinite(n) && n > 0) return `${n} Months`;
  return String(months);
}

function findTenant(contractRow, tenants = []) {
  const tenantNo = String(pickField(contractRow, "tenantNo", "TenantNo") || "").trim();
  if (!tenantNo) return null;
  return (tenants || []).find(
    (tenant) => String(tenant?.tenantNo || tenant?.TenantNo || "").trim() === tenantNo
  );
}

function formatTenantDisplayName(contractRow, tenant) {
  const tenantNo = String(pickField(contractRow, "tenantNo", "TenantNo") || "").trim();
  const prefix = String(tenant?.prefix || tenant?.Prefix || "").trim();
  const ownerName = String(
    tenant?.ownerName || tenant?.OwnerName || pickField(contractRow, "ownerName", "OwnerName") || ""
  ).trim();
  const displayName = [prefix, ownerName].filter(Boolean).join(" ").trim() || ownerName;
  if (tenantNo && displayName) return `${tenantNo}- ${displayName}`;
  return tenantNo || displayName || "—";
}

function formatTenantAddress(contractRow, tenant) {
  return (
    String(
      tenant?.address || tenant?.Address || pickField(contractRow, "address", "Address") || ""
    ).trim() || "—"
  );
}

function formatTenantContact(tenant) {
  const parts = [tenant?.telephoneNo, tenant?.TelephoneNo, tenant?.cellNo, tenant?.CellNo]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const unique = [...new Set(parts)];
  return unique.length > 0 ? unique.join(", ") : "—";
}

function resolveUnitName(contractRow) {
  return String(pickField(contractRow, "uoM", "UoM", "unitName", "UnitName") || "").trim();
}

function formatAreaWithUnit(areaValue, unitName) {
  if (areaValue === null || areaValue === undefined || areaValue === "") return "—";
  const n = Number(areaValue);
  const areaText = Number.isFinite(n) ? String(n) : String(areaValue);
  return unitName ? `${areaText} ${unitName}` : areaText;
}

function formatRateOrDate(contractRow) {
  const riseTermType = String(pickField(contractRow, "riseTermType", "RiseTermType") || "").trim();
  const rate = pickField(contractRow, "increaseRatePercent", "IncreaseRatePercent");
  const riseDate = pickField(contractRow, "risedate", "RiseDate", "riseDate");
  const rateText = rate !== "" && rate !== null && rate !== undefined ? formatPdfPercent(rate) : "";
  const dateText = riseDate ? formatPdfAgreementDate(riseDate) : "";

  if (riseTermType === "Fixed Date") {
    if (rateText && dateText && dateText !== "—") return `${rateText} or ${dateText}`;
    return rateText || dateText || "—";
  }
  if (rateText) return rateText;
  return "—";
}

function normalizeAnnotationRows(response) {
  const items = Array.isArray(response)
    ? response
    : Array.isArray(response?.data)
    ? response.data
    : [];
  return items.map((item) => ({
    remarks: String(item?.remarks ?? item?.Remarks ?? "").trim(),
    remarksBy: String(item?.remarksBy ?? item?.RemarksBy ?? "").trim(),
  }));
}

function buildVariableIntervalCells(riseTerms = []) {
  return (riseTerms || [])
    .map((term) => {
      const months = term?.monthsInterval ?? term?.MonthsInterval;
      const percent = term?.risePercent ?? term?.RisePercent;
      if (months === null || months === undefined || months === "") return "";
      const percentText =
        percent === null || percent === undefined || percent === "" ? "" : ` (${percent}%)`;
      return `${months} Months${percentText}`;
    })
    .filter(Boolean);
}

function createPdfDrawer(doc, pageWidth, margin) {
  const contentRight = pageWidth - margin;

  const drawRule = (y) => {
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.35);
    doc.line(margin, y, contentRight, y);
  };

  const drawSectionTitle = (title, y) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_FONT_SECTION);
    doc.text(title, margin, y);
    const titleHeight = doc.getTextDimensions(title).h;
    const underlineY = y + titleHeight * 0.32 + 0.9;
    drawRule(underlineY);
    return underlineY + PDF_LINE_HEIGHT + 0.5;
  };

  const measureLabel = (label) => {
    const labelText = `${label} :`;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_FONT_BODY);
    return { labelText, width: doc.getTextWidth(labelText) };
  };

  const drawLabel = (label, x, y) => {
    const { labelText, width } = measureLabel(label);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(PDF_FONT_BODY);
    doc.text(labelText, x, y);
    return width;
  };

  const wrapValueLines = (value, maxWidth) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_FONT_BODY);
    const valueText = String(value ?? "—");
    const width = Math.max(8, maxWidth);
    return doc.splitTextToSize(valueText, width);
  };

  const drawWrappedLines = (lines, x, y, options = {}) => {
    doc.setFont("helvetica", options.bold ? "bold" : "normal");
    doc.setFontSize(PDF_FONT_BODY);
    lines.forEach((line, index) => {
      if (options.align === "center") {
        doc.text(line, x, y + index * PDF_LINE_HEIGHT, { align: "center" });
      } else {
        doc.text(line, x, y + index * PDF_LINE_HEIGHT);
      }
    });
    return y + Math.max(1, lines.length) * PDF_LINE_HEIGHT;
  };

  const drawLabelValue = (label, value, x, y, options = {}) => {
    const labelWidth = drawLabel(label, x, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_FONT_BODY);
    const valueText = String(value ?? "—");

    if (options.alignValue === "center") {
      const centerX = options.valueCenterX ?? (margin + contentRight) / 2;
      const maxWidth = options.maxValueWidth ?? Math.max(8, contentRight - centerX);
      const lines = wrapValueLines(valueText, maxWidth);
      return drawWrappedLines(lines, centerX, y, { align: "center" });
    }

    const valueX = options.valueX ?? x + labelWidth + PDF_LABEL_VALUE_GAP;
    const maxWidth = options.maxValueWidth ?? contentRight - valueX;
    const lines = wrapValueLines(valueText, maxWidth);
    return drawWrappedLines(lines, valueX, y);
  };

  const drawTwoColumnLabelValue = (left, right, y, layout) => {
    const leftMaxWidth = Math.max(8, layout.leftValueMaxX - layout.leftValueX);
    const rightMaxWidth = Math.max(8, layout.rightValueMaxX - layout.rightValueX);
    const leftLines = left?.label ? wrapValueLines(left.value, leftMaxWidth) : [];
    const rightLines = right?.label ? wrapValueLines(right.value, rightMaxWidth) : [];
    const lineCount = Math.max(leftLines.length, rightLines.length, 1);

    if (left?.label) {
      drawLabel(left.label, layout.leftLabelX, y);
      drawWrappedLines(leftLines, layout.leftValueX, y);
    }
    if (right?.label) {
      drawLabel(right.label, layout.rightLabelX, y);
      drawWrappedLines(rightLines, layout.rightValueX, y);
    }
    return y + lineCount * PDF_LINE_HEIGHT;
  };

  const drawVariableIntervalGrid = (cells, y, layout) => {
    const cols = 4;
    const colWidth = layout.gridWidth / cols;
    let gridY = y;
    for (let index = 0; index < cells.length; index += cols) {
      let rowLineCount = 1;
      const rowCells = [];
      for (let col = 0; col < cols; col += 1) {
        const cell = cells[index + col];
        if (!cell) continue;
        const lines = wrapValueLines(cell, colWidth - 2);
        rowLineCount = Math.max(rowLineCount, lines.length);
        rowCells.push({ lines, x: layout.gridX + col * colWidth });
      }
      rowCells.forEach((cell) => {
        drawWrappedLines(cell.lines, cell.x, gridY);
      });
      gridY += rowLineCount * PDF_LINE_HEIGHT;
    }
    return gridY;
  };

  return {
    contentRight,
    drawRule,
    drawSectionTitle,
    drawLabelValue,
    drawTwoColumnLabelValue,
    drawLabel,
    drawVariableIntervalGrid,
    measureLabel,
  };
}

/**
 * Render the Contract Agreement first page to match the standard agreement layout.
 */
export function renderContractAgreementPdfFirstPage(
  doc,
  contractRow,
  { riseTerms = [], tenants = [], annotations = [] } = {}
) {
  if (!doc || !contractRow) return;

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const contentWidth = pageWidth - 2 * margin;
  const tenant = findTenant(contractRow, tenants);
  const unitName = resolveUnitName(contractRow);
  const riseTermType = String(pickField(contractRow, "riseTermType", "RiseTermType") || "").trim();
  const variableCells = buildVariableIntervalCells(riseTerms);

  const drawer = createPdfDrawer(doc, pageWidth, margin);

  const measureMaxLabelWidth = (labels) =>
    Math.max(...labels.map((label) => drawer.measureLabel(label).width), 20);

  const midX = margin + contentWidth * 0.52;
  const colGap = 4;
  const leftLabelWidth = measureMaxLabelWidth([
    "Name",
    "Address",
    "Contact No",
    "Group ID",
    "Area (BoO)",
    "Initial Rent PM",
    "Term",
    "Payment Term",
    "Rise Term",
    "Rise Interval/ Rate",
    "Variable Interval",
    "Current Rent PA",
    "AHQ Share",
    "Base Share",
  ]);
  const rightLabelWidth = measureMaxLabelWidth([
    "Business",
    "Location",
    "Area (CA)",
    "Initial Rent PA",
    "Rate of Profit",
    "Security Deposit",
    "Rate",
    "DPC (Per Day)",
    "Govt Share PA",
    "RAC Share",
  ]);

  const layout = {
    leftLabelX: margin,
    leftValueX: margin + leftLabelWidth + PDF_LABEL_VALUE_GAP,
    leftValueMaxX: midX - colGap,
    rightLabelX: midX,
    rightValueX: midX + rightLabelWidth + PDF_LABEL_VALUE_GAP,
    rightValueMaxX: pageWidth - margin,
    gridX: margin + leftLabelWidth + PDF_LABEL_VALUE_GAP,
    gridWidth: contentWidth - leftLabelWidth - PDF_LABEL_VALUE_GAP,
  };

  let yPos = margin + 2;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(PDF_FONT_TITLE);
  doc.text("Contract Agreement", pageWidth / 2, yPos, { align: "center" });
  yPos += PDF_LINE_HEIGHT + 4;

  yPos = drawer.drawSectionTitle("Tenant Particulars", yPos);
  yPos = drawer.drawLabelValue("Name", formatTenantDisplayName(contractRow, tenant), margin, yPos, {
    valueX: layout.leftValueX,
    maxValueWidth: contentWidth - (layout.leftValueX - margin),
  });
  yPos = drawer.drawLabelValue("Address", formatTenantAddress(contractRow, tenant), margin, yPos, {
    valueX: layout.leftValueX,
    maxValueWidth: contentWidth - (layout.leftValueX - margin),
  });
  yPos = drawer.drawTwoColumnLabelValue(
    {
      label: "Contact No",
      value: formatTenantContact(tenant),
    },
    {
      label: "Business",
      value: pickField(contractRow, "natureOfBusiness", "NatureOfBusiness") || "—",
    },
    yPos,
    layout
  );
  yPos += 3;

  yPos = drawer.drawSectionTitle("Property", yPos);
  yPos = drawer.drawTwoColumnLabelValue(
    {
      label: "Group ID",
      value: pickField(contractRow, "grpId", "GrpId", "GId") || "—",
    },
    {
      label: "Location",
      value: pickField(contractRow, "location", "Location") || "—",
    },
    yPos,
    layout
  );
  yPos += 3;

  yPos = drawer.drawSectionTitle("Term of Agreement", yPos);
  const dateValueOpts = {
    valueX: layout.rightLabelX,
    maxValueWidth: pageWidth - margin - layout.rightLabelX,
  };
  yPos = drawer.drawLabelValue(
    "Contract Start Date (CSD)",
    formatPdfAgreementDate(pickField(contractRow, "contractStartDate", "ContractStartDate")),
    margin,
    yPos,
    dateValueOpts
  );
  yPos = drawer.drawLabelValue(
    "Commercial Operation Date (COD)",
    formatPdfAgreementDate(
      pickField(contractRow, "commercialOperationDate", "CommercialOperationDate")
    ),
    margin,
    yPos,
    dateValueOpts
  );
  yPos = drawer.drawLabelValue(
    "Contract End Date (CED)",
    formatPdfAgreementDate(pickField(contractRow, "contractEndDate", "ContractEndDate")),
    margin,
    yPos,
    dateValueOpts
  );
  yPos += 1;

  const termLeftRows = [
    {
      label: "Area (BoO)",
      value: formatAreaWithUnit(pickField(contractRow, "totalArea", "TotalArea"), unitName),
    },
    {
      label: "Initial Rent PM",
      value: formatPdfAmount(pickField(contractRow, "initialRentPM", "InitialRentPM")),
    },
    {
      label: "Term",
      value: pickField(contractRow, "term", "Term") || "—",
    },
    {
      label: "Payment Term",
      value: formatPaymentTermLabel(
        pickField(contractRow, "paymentTermMonths", "PaymentTermMonths")
      ),
    },
    {
      label: "Rise Term",
      value: riseTermType || "—",
    },
    {
      label: "Rise Interval/ Rate",
      value: formatRiseIntervalLabel(
        pickField(contractRow, "increaseIntervalMonths", "IncreaseIntervalMonths")
      ),
    },
  ];

  const termRightRows = [
    {
      label: "Area (CA)",
      value: formatAreaWithUnit(pickField(contractRow, "vaArea", "VaArea"), unitName),
    },
    {
      label: "Initial Rent PA",
      value: formatPdfAmount(pickField(contractRow, "initialRentPA", "InitialRentPA")),
    },
    {
      label: "Rate of Profit",
      value: formatPdfPercent(pickField(contractRow, "profitRate", "ProfitRate")),
    },
    {
      label: "Security Deposit",
      value: formatPdfAmount(
        pickField(contractRow, "securityDepositAmount", "SecurityDepositAmount")
      ),
    },
    {
      label: "Rate",
      value: formatRateOrDate(contractRow),
    },
    {
      label: "DPC (Per Day)",
      value: formatPdfPercent(pickField(contractRow, "dpc", "Dpc", "DPC")),
    },
  ];

  const rowCount = Math.max(termLeftRows.length, termRightRows.length);
  for (let index = 0; index < rowCount; index += 1) {
    const left = termLeftRows[index];
    const right = termRightRows[index];
    yPos = drawer.drawTwoColumnLabelValue(
      left ? { label: left.label, value: left.value } : null,
      right ? { label: right.label, value: right.value } : null,
      yPos,
      layout
    );
  }

  yPos += 1;
  drawer.drawLabel("Variable Interval", margin, yPos);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(PDF_FONT_BODY);
  const variablePrefixWidth = drawer.measureLabel("Variable Interval").width;
  doc.text("—", margin + variablePrefixWidth + PDF_LABEL_VALUE_GAP, yPos);
  yPos += PDF_LINE_HEIGHT;
  if (riseTermType === "Variable" && variableCells.length > 0) {
    yPos = drawer.drawVariableIntervalGrid(variableCells, yPos, layout);
  }

  yPos += 1;
  const financialLeftRows = [
    {
      label: "Current Rent PA",
      value: formatPdfAmount(
        pickField(
          contractRow,
          "currentRentPA",
          "CurrentRentPA",
          "CurrRentPA",
          "initialRentPA",
          "InitialRentPA"
        )
      ),
    },
    {
      label: "AHQ Share",
      value: formatPdfAmount(
        pickField(contractRow, "ahqShare", "AHQShare", "pafShare", "PAFShare")
      ),
    },
    {
      label: "Base Share",
      value: formatPdfAmount(pickField(contractRow, "baseShare", "BaseShare")),
    },
  ];
  const financialRightRows = [
    {
      label: "Govt Share PA",
      value: formatPdfAmount(pickField(contractRow, "govtShare", "GovtShare")),
    },
    {
      label: "RAC Share",
      value: formatPdfAmount(pickField(contractRow, "racShare", "RACShare")),
    },
  ];
  const financialRowCount = Math.max(financialLeftRows.length, financialRightRows.length);
  for (let index = 0; index < financialRowCount; index += 1) {
    const left = financialLeftRows[index];
    const right = financialRightRows[index];
    yPos = drawer.drawTwoColumnLabelValue(
      left ? { label: left.label, value: left.value } : null,
      right ? { label: right.label, value: right.value } : null,
      yPos,
      layout
    );
  }

  yPos += 3;

  yPos = drawer.drawSectionTitle("Annotations", yPos);
  const annotationLines = (annotations || [])
    .map((item) => {
      const remarks = String(item?.remarks || "").trim();
      if (!remarks) return "";
      const by = String(item?.remarksBy || "").trim();
      return by ? `${remarks} (${by})` : remarks;
    })
    .filter(Boolean);

  if (annotationLines.length > 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_FONT_BODY);
    const arrowText = ">";
    const arrowWidth = doc.getTextWidth(`${arrowText} `);
    const annotationTextWidth = Math.max(8, contentWidth - arrowWidth);
    annotationLines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, annotationTextWidth);
      wrapped.forEach((textLine, lineIndex) => {
        if (lineIndex === 0) {
          doc.text(`${arrowText} ${textLine}`, margin, yPos);
        } else {
          doc.text(textLine, margin + arrowWidth, yPos);
        }
        yPos += PDF_LINE_HEIGHT;
      });
    });
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(PDF_FONT_BODY);
    doc.text(">", margin, yPos);
    yPos += PDF_LINE_HEIGHT;
  }
}

export async function fetchContractAnnotationsForPdf(contractRow) {
  const contractId = contractRow?.id ?? contractRow?.Id;
  if (!contractId) return [];
  try {
    const response = await contractApi.getContractAnnotationsByContractId(contractId);
    return normalizeAnnotationRows(response);
  } catch (error) {
    console.error("Error fetching contract annotations for PDF:", error);
    return [];
  }
}
