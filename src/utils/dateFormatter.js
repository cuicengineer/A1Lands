/**
 * Format date to dd-mmm-yyyy format (e.g., 10-feb-2026)
 * This is used for display purposes only in table grids, forms, and popups
 * @param {string|Date} dateValue - Date value to format
 * @returns {string} Formatted date string or empty string if invalid
 */
export const formatDateDDMMMYYYY = (dateValue) => {
  if (!dateValue) return "";
  const raw = String(dateValue).trim();
  if (!raw) return "";

  const monthShort = [
    "jan",
    "feb",
    "mar",
    "apr",
    "may",
    "jun",
    "jul",
    "aug",
    "sep",
    "oct",
    "nov",
    "dec",
  ];

  try {
    const datePart = raw.includes("T") ? raw.split("T")[0] : raw;
    let day = "";
    let month = "";
    let year = "";

    // yyyy-mm-dd
    if (/^\d{4}-\d{2}-\d{2}$/.test(datePart)) {
      [year, month, day] = datePart.split("-");
    }
    // dd-mm-yyyy
    else if (/^\d{2}-\d{2}-\d{4}$/.test(datePart)) {
      [day, month, year] = datePart.split("-");
    } else {
      const parsed = new Date(raw);
      if (!Number.isFinite(parsed.getTime())) return raw;
      day = String(parsed.getDate()).padStart(2, "0");
      month = String(parsed.getMonth() + 1).padStart(2, "0");
      year = String(parsed.getFullYear());
    }

    const monthIndex = Number(month) - 1;
    const monthText = monthShort[monthIndex] || month;
    return `${String(day).padStart(2, "0")}-${monthText}-${year}`;
  } catch {
    return raw;
  }
};

