import { getUserIPAddress } from "services/api.service";
import { addPdfAuditBarcodes, buildPdfAuditBarcodePayload } from "utils/pdfAuditBarcode";

const WATERMARK_OPACITY = 0.16;
const WATERMARK_MIN_FONT_SIZE = 8;
const WATERMARK_MAX_FONT_SIZE = 18;
const WATERMARK_CORNER_INSET_RATIO = 0.08;
const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function getPdfUsername() {
  try {
    const raw = localStorage.getItem("auth");
    if (!raw) return "Unknown";
    const obj = JSON.parse(raw);
    return (
      obj?.username ||
      obj?.Username ||
      obj?.userName ||
      obj?.userId ||
      obj?.UserId ||
      obj?.unique_name ||
      obj?.UniqueName ||
      "Unknown"
    );
  } catch {
    return "Unknown";
  }
}

function formatWatermarkDateTime(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mmm = MONTH_ABBREVIATIONS[date.getMonth()];
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${dd}-${mmm}-${yy} ${hh}:${mm}`;
}

function fitWatermarkFontSize(doc, text, maxWidth) {
  let fontSize = WATERMARK_MAX_FONT_SIZE;
  doc.setFont("helvetica", "bold");
  while (fontSize > WATERMARK_MIN_FONT_SIZE) {
    doc.setFontSize(fontSize);
    if (doc.getTextWidth(text) <= maxWidth) {
      return fontSize;
    }
    fontSize -= 0.5;
  }
  doc.setFontSize(WATERMARK_MIN_FONT_SIZE);
  return WATERMARK_MIN_FONT_SIZE;
}

/**
 * Add diagonal watermark (username + IP + datetime) and a top-right audit QR code.
 * QR payload binds the same username, IP, and datetime for offline scanning.
 */
export function addContractPdfWatermarks(doc) {
  if (!doc) return;

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const username = getPdfUsername();
  const ip = getUserIPAddress() || "session";
  const generatedAt = formatWatermarkDateTime();
  const watermarkText = `${username}   ${ip}   ${generatedAt}`;
  const barcodePayload = buildPdfAuditBarcodePayload({
    username,
    ip,
    generatedAt,
  });
  const totalPages = doc.internal.getNumberOfPages();
  const centerX = pageWidth / 2;
  const centerY = pageHeight / 2;
  // Match the page diagonal so text runs corner-to-corner.
  const angleDeg = (Math.atan2(pageHeight, pageWidth) * 180) / Math.PI;
  const diagonalLength = Math.sqrt(pageWidth * pageWidth + pageHeight * pageHeight);
  const cornerInset = Math.min(pageWidth, pageHeight) * WATERMARK_CORNER_INSET_RATIO;
  const maxTextWidth = Math.max(diagonalLength - cornerInset * 2, 40);

  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    doc.saveGraphicsState();
    try {
      if (typeof doc.GState === "function") {
        doc.setGState(new doc.GState({ opacity: WATERMARK_OPACITY }));
      }
    } catch {
      // GState may be unavailable in some environments.
    }

    doc.setFont("helvetica", "bold");
    doc.setTextColor(170, 170, 170);
    const fontSize = fitWatermarkFontSize(doc, watermarkText, maxTextWidth);
    doc.setFontSize(fontSize);
    doc.text(watermarkText, centerX, centerY, {
      align: "center",
      baseline: "middle",
      angle: angleDeg,
    });

    doc.restoreGraphicsState();
  }

  // Top-right audit QR code on every page (offline; no external service).
  addPdfAuditBarcodes(doc, { payload: barcodePayload });

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
}
