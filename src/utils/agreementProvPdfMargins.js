export const AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY = "agreement-prov-invoice-pdf-margins";

export const AGREEMENT_PROV_PDF_DEFAULT_MARGINS = {
  topIn: 0.5,
  bottomIn: 0.5,
  leftIn: 1.3,
  rightIn: 0.5,
  contentScale: 1,
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
  try {
    const raw = localStorage.getItem(AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY);
    if (!raw) return { ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS };
    const parsed = JSON.parse(raw);
    return {
      topIn: Number(parsed?.topIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.topIn,
      bottomIn: Number(parsed?.bottomIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.bottomIn,
      leftIn: Number(parsed?.leftIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.leftIn,
      rightIn: Number(parsed?.rightIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.rightIn,
      contentScale: normalizeAgreementProvPdfContentScale(parsed?.contentScale),
    };
  } catch {
    return { ...AGREEMENT_PROV_PDF_DEFAULT_MARGINS };
  }
}

export function saveAgreementProvPdfMargins(margins) {
  try {
    localStorage.setItem(
      AGREEMENT_PROV_PDF_MARGIN_STORAGE_KEY,
      JSON.stringify({
        topIn: Number(margins?.topIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.topIn,
        bottomIn: Number(margins?.bottomIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.bottomIn,
        leftIn: Number(margins?.leftIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.leftIn,
        rightIn: Number(margins?.rightIn) || AGREEMENT_PROV_PDF_DEFAULT_MARGINS.rightIn,
        contentScale: normalizeAgreementProvPdfContentScale(margins?.contentScale),
      })
    );
  } catch {
    // ignore storage errors
  }
}
