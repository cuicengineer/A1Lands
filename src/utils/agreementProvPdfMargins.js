export const AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY = "agreement-prov-invoice-pdf-margins";
export const RECEIPT_PDF_MARGIN_STORAGE_KEY = "receipt-pdf-margins";
export const SHARE_DIST_WORKBOOK_PDF_MARGIN_STORAGE_KEY = "share-dist-workbook-pdf-margins";

export const AGREEMENT_PROV_PDF_DEFAULT_MARGINS = {
  topIn: 0.5,
  bottomIn: 0.5,
  leftIn: 1.3,
  rightIn: 0.5,
  contentScale: 1,
};

export const RECEIPT_PDF_DEFAULT_MARGINS = {
  ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS,
  leftIn: 0.5,
};

export const SHARE_DIST_WORKBOOK_PDF_DEFAULT_MARGINS = {
  ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS,
  leftIn: 0.5,
};

export const AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN = 0.5;
export const AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX = 1.5;
export const AGREEMENT_PROV_PDF_CONTENT_SCALE_STEP = 0.05;

export function agreementProvInchesToMm(inches) {
  const n = Number(inches);
  return Number.isFinite(n) ? n * 25.4 : 0;
}

export function normalizeAgreementProvPdfContentScale(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return AGREEMENT_PROV_PDF_DEFAULT_MARGINS.contentScale;
  const clamped = Math.min(
    AGREEMENT_PROV_PDF_CONTENT_SCALE_MAX,
    Math.max(AGREEMENT_PROV_PDF_CONTENT_SCALE_MIN, n)
  );
  return Math.round(clamped * 100) / 100;
}

export function formatAgreementProvPdfContentScalePercent(contentScale) {
  return `${Math.round(normalizeAgreementProvPdfContentScale(contentScale) * 100)}%`;
}

export function createAgreementProvPdfScaleHelpers({
  contentScale,
  marginLeft,
  marginTop,
  pageHeight,
  marginBottom,
}) {
  const scale = normalizeAgreementProvPdfContentScale(contentScale);
  const scaleFromOrigin = (value, origin) => origin + (value - origin) * scale;

  return {
    contentScale: scale,
    sx: (x) => scaleFromOrigin(x, marginLeft),
    sy: (y) => scaleFromOrigin(y, marginTop),
    sf: (pt) => pt * scale,
    sc: (mm) => mm * scale,
    logicalPageBottomY: marginTop + (pageHeight - marginBottom - marginTop) / scale,
    logicalPageBottomReserve: 20 / scale,
  };
}

export function agreementProvPdfMarginsInchesToMm(marginsIn) {
  return {
    marginTop: agreementProvInchesToMm(marginsIn.topIn),
    marginBottom: agreementProvInchesToMm(marginsIn.bottomIn),
    marginLeft: agreementProvInchesToMm(marginsIn.leftIn),
    marginRight: agreementProvInchesToMm(marginsIn.rightIn),
  };
}

export function loadAgreementProvPdfMargins() {
  return loadPdfMarginsFromStorage(
    AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY,
    AGREEMENT_PROV_PDF_DEFAULT_MARGINS
  );
}

export function saveAgreementProvPdfMargins(margins) {
  savePdfMarginsToStorage(
    AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY,
    margins,
    AGREEMENT_PROV_PDF_DEFAULT_MARGINS
  );
}

export function loadReceiptPdfMargins() {
  return loadPdfMarginsFromStorage(RECEIPT_PDF_MARGIN_STORAGE_KEY, RECEIPT_PDF_DEFAULT_MARGINS);
}

export function saveReceiptPdfMargins(margins) {
  savePdfMarginsToStorage(RECEIPT_PDF_MARGIN_STORAGE_KEY, margins, RECEIPT_PDF_DEFAULT_MARGINS);
}

export function loadShareDistributionWorkbookPdfMargins() {
  return loadPdfMarginsFromStorage(
    SHARE_DIST_WORKBOOK_PDF_MARGIN_STORAGE_KEY,
    SHARE_DIST_WORKBOOK_PDF_DEFAULT_MARGINS
  );
}

export function saveShareDistributionWorkbookPdfMargins(margins) {
  savePdfMarginsToStorage(
    SHARE_DIST_WORKBOOK_PDF_MARGIN_STORAGE_KEY,
    margins,
    SHARE_DIST_WORKBOOK_PDF_DEFAULT_MARGINS
  );
}

function loadPdfMarginsFromStorage(storageKey, defaultMargins) {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return { ...defaultMargins };
    const parsed = JSON.parse(raw);
    return {
      topIn: Number(parsed?.topIn) || defaultMargins.topIn,
      bottomIn: Number(parsed?.bottomIn) || defaultMargins.bottomIn,
      leftIn: Number(parsed?.leftIn) || defaultMargins.leftIn,
      rightIn: Number(parsed?.rightIn) || defaultMargins.rightIn,
      contentScale: normalizeAgreementProvPdfContentScale(parsed?.contentScale),
    };
  } catch {
    return { ...defaultMargins };
  }
}

function savePdfMarginsToStorage(storageKey, margins, defaultMargins) {
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({
        topIn: Number(margins?.topIn) || defaultMargins.topIn,
        bottomIn: Number(margins?.bottomIn) || defaultMargins.bottomIn,
        leftIn: Number(margins?.leftIn) || defaultMargins.leftIn,
        rightIn: Number(margins?.rightIn) || defaultMargins.rightIn,
        contentScale: normalizeAgreementProvPdfContentScale(margins?.contentScale),
      })
    );
  } catch {
    // ignore storage errors
  }
}
