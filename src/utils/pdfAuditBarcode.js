/**
 * Offline PDF audit QR code.
 * Encodes username, user IP, and generated datetime so a scan binds those values.
 * Uses a vendored QR encoder + browser canvas — no network calls (offline production safe).
 */

import qrcodeFactory from "utils/offlineQrCodeLib";
import { getLoggedInUsername, getUserIPAddress } from "services/api.service";

const qrcode = typeof qrcodeFactory === "function" ? qrcodeFactory : qrcodeFactory?.default;

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

function formatAuditDateTime(date = new Date()) {
  const dd = String(date.getDate()).padStart(2, "0");
  const mmm = MONTH_ABBREVIATIONS[date.getMonth()];
  const yy = String(date.getFullYear()).slice(-2);
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  return `${dd}-${mmm}-${yy} ${hh}:${mm}:${ss}`;
}

function sanitizeQrField(value, fallback) {
  const text = String(value ?? "")
    .replace(/[|\r\n\t]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text || fallback;
}

/**
 * Compact scannable payload. Scan result example:
 * USER=jdoe|IP=10.0.0.12|DT=16-Jul-26 15:45:01
 */
export function buildPdfAuditBarcodePayload({ username, ip, generatedAt } = {}) {
  const user = sanitizeQrField(username ?? getLoggedInUsername(), "Unknown");
  const address = sanitizeQrField(ip ?? getUserIPAddress(), "session");
  const when = sanitizeQrField(generatedAt ?? formatAuditDateTime(), formatAuditDateTime());
  return `USER=${user}|IP=${address}|DT=${when}`;
}

/**
 * Render QR code to a PNG data URL via offscreen canvas (offline).
 */
export function createPdfAuditBarcodeDataUrl(payload, options = {}) {
  if (typeof document === "undefined") return null;
  if (typeof qrcode !== "function") return null;

  const text = String(payload || "").trim();
  if (!text) return null;

  const cellSize = Math.max(2, Number(options.cellSize) || 4);
  const marginModules = Math.max(1, Number(options.marginModules) || 2);
  // typeNumber 0 = auto-select version for payload length
  const typeNumber = Number.isFinite(Number(options.typeNumber)) ? Number(options.typeNumber) : 0;
  const errorCorrectionLevel = options.errorCorrectionLevel || "M";

  try {
    const qr = qrcode(typeNumber, errorCorrectionLevel);
    qr.addData(text);
    qr.make();

    const moduleCount = qr.getModuleCount();
    const size = (moduleCount + marginModules * 2) * cellSize;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, size, size);
    ctx.fillStyle = "#000000";

    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (!qr.isDark(row, col)) continue;
        ctx.fillRect(
          (col + marginModules) * cellSize,
          (row + marginModules) * cellSize,
          cellSize,
          cellSize
        );
      }
    }

    return canvas.toDataURL("image/png");
  } catch (error) {
    console.error("Failed to create PDF audit QR code:", error);
    return null;
  }
}

/**
 * Draw audit QR code at the top-right of the current jsPDF page.
 * Returns reserved height (mm) used at the top of the page, or 0 if skipped.
 */
export function drawPdfAuditBarcode(doc, options = {}) {
  if (!doc) return 0;

  const pageWidth = doc.internal.pageSize.getWidth();
  const payload =
    options.payload ||
    buildPdfAuditBarcodePayload({
      username: options.username,
      ip: options.ip,
      generatedAt: options.generatedAt,
    });

  const dataUrl = createPdfAuditBarcodeDataUrl(payload, {
    cellSize: options.cellSize,
    marginModules: options.marginModules,
    typeNumber: options.typeNumber,
    errorCorrectionLevel: options.errorCorrectionLevel,
  });
  if (!dataUrl) return 0;

  const sizeMm =
    Number(options.sizeMm) || Number(options.widthMm) || Number(options.heightMm) || 18;
  const insetRightMm = Number(options.insetRightMm) || 3;
  const insetTopMm = Number(options.insetTopMm) || 1.5;
  const x = pageWidth - sizeMm - insetRightMm;
  const y = insetTopMm;

  try {
    // White backing keeps the QR readable if it sits near header text.
    doc.setFillColor(255, 255, 255);
    doc.rect(x - 0.6, y - 0.6, sizeMm + 1.2, sizeMm + 1.2, "F");
    doc.addImage(dataUrl, "PNG", x, y, sizeMm, sizeMm);
  } catch (error) {
    console.error("Failed to draw PDF audit QR code:", error);
    return 0;
  }

  return sizeMm + insetTopMm;
}

/**
 * Stamp the audit QR code on every page (top-right). Call after content is built.
 */
export function addPdfAuditBarcodes(doc, options = {}) {
  if (!doc) return;

  const payload =
    options.payload ||
    buildPdfAuditBarcodePayload({
      username: options.username,
      ip: options.ip,
      generatedAt: options.generatedAt,
    });

  const totalPages = doc.internal.getNumberOfPages();
  for (let page = 1; page <= totalPages; page += 1) {
    doc.setPage(page);
    drawPdfAuditBarcode(doc, { ...options, payload });
  }
}
