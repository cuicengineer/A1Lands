/**
 * KPI Overview — data extraction & aggregation (same API as summary dashboard).
 */

import { coerceChartDataValue, roundChartBarNumber } from "utils/chartBarDataUtils";

const DATA_SET_PROPERTY_SUMMARY = "PropertySummary";
const DATA_SET_PROPERTY_GROUP_SUMMARY = "PropertyGroupSummary";
const DATA_SET_GROUP_SUMMARY = "GroupSummary";
const DATA_SET_CONTRACTS_SUMMARY = "ContractsSummary";
const DATA_SET_GOVT_PAF_SHARE = "GovtPAFShare";

const GROUPED_PROPERTY_COUNT_FIELDS = [
  "GroupedPropertyCount",
  "groupedPropertyCount",
  "PropertyGroupCount",
  "propertyGroupCount",
  "GroupCount",
  "groupCount",
  "PropertyCount",
  "propertyCount",
];

function isGroupSummaryDataRow(row) {
  return (
    isDataSetRow(row, DATA_SET_GROUP_SUMMARY) || isDataSetRow(row, DATA_SET_PROPERTY_GROUP_SUMMARY)
  );
}

export const PROPERTY_CLASS_STICKERS = {
  lands: { classIds: [1], label: "Lands" },
  categoryA: { classIds: [2], label: "CAT A" },
  categoryB: { classIds: [3], label: "CAT B" },
  categoryC: { classIds: [4], label: "CAT C" },
  bts: { classIds: [6], label: "BTS" },
  hb: { classIds: [9], label: "HB" },
};

const ASSET_CARD_FIXED_ORDER = ["total", "categoryA", "categoryB", "categoryC", "bts", "hb"];

/** Row 1 (groups) card label text — bold via dashboard-redesign.css */
const GROUPED_ASSET_ROW_LABELS = {
  total: "Total Groups",
  categoryA: "Cat A",
  categoryB: "Cat B",
  categoryC: "Cat C",
  hb: "HB",
  bts: "BTS",
};

function groupedAssetRowLabel(key) {
  return GROUPED_ASSET_ROW_LABELS[key] || null;
}

/** Values from API are in millions; display with M or B suffix. */
export const KPI_MIL_KEYS = ["incomePA", "govt", "paf", "ahq", "rac", "base"];

/** Annual totals are divided by these to show per-period amounts. */
export const KPI_TENURE_DIVISORS = {
  Annual: 1,
  Biannual: 2,
  Quarterly: 4,
  Monthly: 12,
};

export function getKpiTenureDivisor(tenure) {
  return KPI_TENURE_DIVISORS[tenure] ?? 1;
}

export function scaleKpiAmountByTenure(value, tenure) {
  const n = coerceChartDataValue(value);
  if (n == null) return 0;
  const divisor = getKpiTenureDivisor(tenure);
  return divisor > 0 ? n / divisor : n;
}

export function scaleKpiMilByTenure(mil, tenure) {
  if (!mil || typeof mil !== "object") return mil;
  if (getKpiTenureDivisor(tenure) === 1) return mil;
  const scaled = { ...mil };
  KPI_MIL_KEYS.forEach((key) => {
    if (mil[key] != null && mil[key] !== "") {
      scaled[key] = scaleKpiAmountByTenure(mil[key], tenure);
    }
  });
  return scaled;
}

export function applyTenureToAssetCards(cards, tenure) {
  if (getKpiTenureDivisor(tenure) === 1) return cards || [];
  return (cards || []).map((card) => ({
    ...card,
    mil: card.mil ? scaleKpiMilByTenure(card.mil, tenure) : card.mil,
  }));
}

export function scaleKpiCellsByTenure(cells, tenure) {
  if (!cells?.length || getKpiTenureDivisor(tenure) === 1) return cells || [];
  return cells.map((cell) => ({
    ...cell,
    mil: cell.mil ? scaleKpiMilByTenure(cell.mil, tenure) : cell.mil,
  }));
}

export function applyTenureToFinancialShares(shares, tenure) {
  if (getKpiTenureDivisor(tenure) === 1) return shares || [];
  return (shares || []).map((share) => ({
    ...share,
    value: scaleKpiAmountByTenure(share.value, tenure),
  }));
}

export function applyTenureToChartData(data, tenure) {
  if (!Array.isArray(data) || getKpiTenureDivisor(tenure) === 1) return data || [];
  return data.map((value) => scaleKpiAmountByTenure(value, tenure));
}

export function formatKpiMoneyAmount(valueInMillions, options = {}) {
  const { fixedDecimals } = options;
  const fractionDigits =
    fixedDecimals != null
      ? { minimumFractionDigits: fixedDecimals, maximumFractionDigits: fixedDecimals }
      : { minimumFractionDigits: 0, maximumFractionDigits: 2 };

  const raw = coerceChartDataValue(valueInMillions);
  const n = raw == null ? null : roundChartBarNumber(raw, fixedDecimals ?? 2);
  if (n == null) {
    const zeroText =
      fixedDecimals != null ? Number(0).toLocaleString(undefined, fractionDigits) : "0";
    return { text: zeroText, suffix: "M" };
  }
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return {
      text: roundChartBarNumber(n / 1000, fixedDecimals ?? 2).toLocaleString(
        undefined,
        fractionDigits
      ),
      suffix: "B",
    };
  }
  return {
    text: n.toLocaleString(undefined, fractionDigits),
    suffix: "M",
  };
}

/** Y-axis tick labels for KPI bar charts (millions scale, max 2 decimals). */
export function formatKpiBarAxisTick(value) {
  const n = roundChartBarNumber(value);
  if (n == null) return "";
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

/** Y-axis tick labels — whole numbers only (no decimals). */
export function formatKpiBarAxisTickRounded(value) {
  const n = roundChartBarNumber(value);
  if (n == null) return "";
  return Math.round(n).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

export function formatKpiMoneyLabel(valueInMillions, options) {
  const { text, suffix } = formatKpiMoneyAmount(valueInMillions, options);
  return `${text} ${suffix}`;
}

/** Bar/crosshair labels — always includes M or B unit. */
export function formatKpiBarMoneyLabel(valueInMillions) {
  const { text, suffix } = formatKpiMoneyAmount(valueInMillions, { fixedDecimals: 2 });
  return `${text} ${suffix}`;
}

/** Crosshair Y-axis readout — rounds to 2 decimals before M/B formatting. */
export function formatKpiCrosshairBarValue(value) {
  const numeric = roundChartBarNumber(coerceChartDataValue(value) ?? value, 2);
  return formatKpiBarMoneyLabel(numeric ?? 0);
}

function getKnownPropertyClassIds() {
  const ids = new Set();
  Object.values(PROPERTY_CLASS_STICKERS).forEach((meta) => {
    meta.classIds.forEach((id) => ids.add(Number(id)));
  });
  return ids;
}

function collectPropertySummaryClassIds(propertyRows) {
  const ids = new Set();
  for (const r of propertyRows) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    const cid = Number(r.ClassId ?? r.classId);
    if (Number.isFinite(cid)) ids.add(cid);
  }
  return [...ids];
}

function aggregateAllPropertySummary(propertyRows) {
  let count = 0;
  let worth = 0;
  const areasByUom = {};

  for (const r of propertyRows) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    const pc = readNumber(r, ["PropertyCount", "propertyCount"]);
    const rev = readNumber(r, ["ClassRevenue_Million", "classRevenue_Million"]);
    if (Number.isFinite(pc)) count += pc;
    if (Number.isFinite(rev)) worth += rev;
    const area = readPropertySummaryArea(r);
    if (Number.isFinite(area)) {
      const uom = readPropertySummaryUom(r) || "—";
      areasByUom[uom] = (areasByUom[uom] || 0) + area;
    }
  }

  return { count, worth, areaLine: formatAreasByUomLine(areasByUom), areasByUom };
}

function buildExtraPropertyClassCards(propertyRows, shareRows, knownClassIds, contractRows = []) {
  const labelByClassId = new Map();

  for (const r of propertyRows) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    const cid = Number(r.ClassId ?? r.classId);
    if (!Number.isFinite(cid) || knownClassIds.has(cid)) continue;
    if (!labelByClassId.has(cid)) {
      const name = readString(r, [
        "ClassName",
        "className",
        "PropertyClassName",
        "propertyClassName",
        "Class",
        "class",
      ]);
      labelByClassId.set(cid, name || `Class ${cid}`);
    }
  }

  return [...labelByClassId.entries()]
    .sort(([a], [b]) => a - b)
    .map(([classId, label]) => {
      const agg = aggregateByClassIds(propertyRows, [classId]);
      const hasArea = agg.areasByUom && Object.keys(agg.areasByUom).length > 0;
      const isActive = agg.count > 0 || agg.worth > 0 || hasArea;
      if (!isActive) return null;

      return {
        key: `class-${classId}`,
        label,
        classId,
        count: agg.count,
        worth: agg.worth,
        areaLine: agg.areaLine,
        mil: buildMilForCategory(shareRows, propertyRows, [classId], contractRows),
        isExtraClass: true,
      };
    })
    .filter(Boolean);
}

function readNumber(row, keys) {
  if (!row || typeof row !== "object") return null;
  for (const k of keys) {
    if (row[k] === undefined || row[k] === null || row[k] === "") continue;
    const coerced = coerceChartDataValue(row[k]);
    if (coerced != null) return coerced;
    if (typeof row[k] === "number" && Number.isFinite(row[k])) return row[k];
    if (typeof row[k] === "string") {
      const n = Number(row[k]);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function readString(row, keys) {
  if (!row || typeof row !== "object") return "";
  for (const k of keys) {
    const v = row[k];
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s) return s;
  }
  return "";
}

export function readPropertySummaryArea(row) {
  return readNumber(row, ["Area", "area", "TotalArea", "totalArea"]);
}

export function readPropertySummaryUom(row) {
  return readString(row, [
    "UoM",
    "uom",
    "UOM",
    "Uom",
    "UnitName",
    "unitName",
    "UnitOfMeasure",
    "unitOfMeasure",
  ]);
}

function formatAreaValue(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value ?? "");
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function formatAreasByUomLine(areasByUom) {
  if (!areasByUom || typeof areasByUom !== "object") return "—";
  const parts = Object.entries(areasByUom)
    .filter(([, area]) => Number.isFinite(area))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([uom, area]) => `${formatAreaValue(area)} (${uom})`);
  return parts.length ? parts.join(", ") : "—";
}

function normalizeDataSetName(name) {
  return String(name ?? "")
    .trim()
    .toLowerCase();
}

function isDataSetRow(row, dataSetName) {
  if (!row || typeof row !== "object") return false;
  const n = row.DataSetName ?? row.dataSetName;
  if (n == null || n === "") return false;
  return normalizeDataSetName(n) === normalizeDataSetName(dataSetName);
}

function extractRowsByDataSet(payload, dataSetName, isRow) {
  if (payload == null || typeof payload !== "object") return [];
  const root = payload.data ?? payload.Data ?? payload.result ?? payload.Result ?? payload;
  const resultSets = root.resultSets ?? root.ResultSets ?? payload.resultSets ?? payload.ResultSets;
  const collected = [];

  if (Array.isArray(resultSets)) {
    for (const inner of resultSets) {
      if (!Array.isArray(inner)) continue;
      for (const row of inner) {
        if (row && typeof row === "object" && isRow(row)) {
          collected.push(row);
        }
      }
    }
  }

  if (collected.length > 0) return collected;

  if (dataSetName === DATA_SET_PROPERTY_SUMMARY) {
    const ps = root.PropertySummary ?? root.propertySummary;
    if (Array.isArray(ps)) {
      return ps.filter(
        (r) => isRow(r) || readNumber(r, ["PropertyCount", "propertyCount"]) != null
      );
    }
  }
  return [];
}

export function extractPropertySummaryRows(payload) {
  return extractRowsByDataSet(payload, DATA_SET_PROPERTY_SUMMARY, (r) =>
    isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)
  );
}

export function extractPropertyGroupSummaryRows(payload) {
  if (payload == null || typeof payload !== "object") return [];
  const root = payload.data ?? payload.Data ?? payload.result ?? payload.Result ?? payload;
  const resultSets = root.resultSets ?? root.ResultSets ?? payload.resultSets ?? payload.ResultSets;
  const collected = [];

  if (Array.isArray(resultSets)) {
    for (const inner of resultSets) {
      if (!Array.isArray(inner)) continue;
      for (const row of inner) {
        if (row && typeof row === "object" && isGroupSummaryDataRow(row)) {
          collected.push(row);
        }
      }
    }
  }

  return collected;
}

/** Alias for GroupSummary rows from property-summary API. */
export function extractGroupSummaryRows(payload) {
  return extractPropertyGroupSummaryRows(payload);
}

export function extractContractsSummaryRows(payload) {
  return extractRowsByDataSet(payload, DATA_SET_CONTRACTS_SUMMARY, (r) =>
    isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)
  );
}

export function extractGovtPafShareRows(payload) {
  const tagged = extractRowsByDataSet(payload, DATA_SET_GOVT_PAF_SHARE, (r) =>
    isGovtPafShareDataRow(r)
  );
  if (tagged.length > 0) return tagged;
  return extractUntaggedGovtPafShareRows(payload);
}

const KPI_CMD_ID_KEYS = [
  "CmdId",
  "cmdId",
  "RAC",
  "rac",
  "RacId",
  "racId",
  "CommandId",
  "commandId",
];
const KPI_BASE_ID_KEYS = ["BaseId", "baseId", "FormationId", "formationId"];

function readKpiRowId(row, keys) {
  if (!row || typeof row !== "object") return "";
  for (const key of keys) {
    const raw = row[key];
    if (raw === undefined || raw === null || raw === "") continue;
    return String(raw).trim();
  }
  return "";
}

function rowHasTaggedDataSet(row) {
  const n = row?.DataSetName ?? row?.dataSetName;
  return n != null && String(n).trim() !== "";
}

function rowHasShareMetricFields(row) {
  if (!row || typeof row !== "object") return false;
  const groups = [
    ["GovtShare", "govtShare", "GovtShare_Million", "govtShare_Million"],
    ["PAFShare", "pafShare", "PAFShare_Million", "pafShare_Million"],
    ["AHQShare", "ahqShare", "AHQShare_Million", "ahqShare_Million"],
    ["RACShare", "racShare", "RACShare_Million", "racShare_Million"],
    ["BaseShare", "baseShare", "BaseShare_Million", "baseShare_Million"],
    ["IncomePA_Million", "incomePA_Million", "IncomePA", "incomePA"],
  ];
  return groups.some((keys) => readNumber(row, keys) != null);
}

function isUntaggedGovtPafShareRow(row) {
  if (!row || typeof row !== "object") return false;
  if (rowHasTaggedDataSet(row)) return false;
  if (isDataSetRow(row, DATA_SET_PROPERTY_SUMMARY)) return false;
  if (isDataSetRow(row, DATA_SET_CONTRACTS_SUMMARY)) return false;
  return rowHasShareMetricFields(row);
}

export function isGovtPafShareDataRow(row) {
  return isDataSetRow(row, DATA_SET_GOVT_PAF_SHARE) || isUntaggedGovtPafShareRow(row);
}

function extractUntaggedGovtPafShareRows(payload) {
  if (payload == null || typeof payload !== "object") return [];
  const root = payload.data ?? payload.Data ?? payload.result ?? payload.Result ?? payload;
  const resultSets = root.resultSets ?? root.ResultSets ?? payload.resultSets ?? payload.ResultSets;
  if (!Array.isArray(resultSets)) return [];

  for (const inner of resultSets) {
    if (!Array.isArray(inner) || inner.length === 0) continue;
    const shareLike = inner.filter(isUntaggedGovtPafShareRow);
    if (shareLike.length > 0) return shareLike;
  }
  return [];
}

/** GovtPAFShare rows are class-scoped; keep them when RAC/Base filters only apply to Cmd/Base-scoped datasets. */
export function filterKpiRowsByRacBase(rows, racIds, baseIds) {
  const racSet = new Set((racIds || []).map(String));
  const baseSet = new Set((baseIds || []).map(String));
  const hasRacFilter = racSet.size > 0;
  const hasBaseFilter = baseSet.size > 0;
  if (!hasRacFilter && !hasBaseFilter) return rows || [];

  return (rows || []).filter((row) => {
    if (isGovtPafShareDataRow(row)) {
      const rowCmdId = readKpiRowId(row, KPI_CMD_ID_KEYS);
      const rowBaseId = readKpiRowId(row, KPI_BASE_ID_KEYS);
      if (!rowCmdId && !rowBaseId) return true;
    }

    const rowCmdId = readKpiRowId(row, KPI_CMD_ID_KEYS);
    const rowBaseId = readKpiRowId(row, KPI_BASE_ID_KEYS);
    if (hasRacFilter && (!rowCmdId || !racSet.has(rowCmdId))) return false;
    if (hasBaseFilter && (!rowBaseId || !baseSet.has(rowBaseId))) return false;
    return true;
  });
}

function aggregateByClassIds(rows, classIds) {
  const idSet = new Set(classIds.map(Number));
  let count = 0;
  let worth = 0;
  const areasByUom = {};

  for (const r of rows) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    const cid = Number(r.ClassId ?? r.classId);
    if (!idSet.has(cid)) continue;
    const pc = readNumber(r, ["PropertyCount", "propertyCount"]);
    const rev = readNumber(r, ["ClassRevenue_Million", "classRevenue_Million"]);
    if (Number.isFinite(pc)) count += pc;
    if (Number.isFinite(rev)) worth += rev;
    const area = readPropertySummaryArea(r);
    if (Number.isFinite(area)) {
      const uom = readPropertySummaryUom(r) || "—";
      areasByUom[uom] = (areasByUom[uom] || 0) + area;
    }
  }

  return { count, worth, areaLine: formatAreasByUomLine(areasByUom), areasByUom };
}

const MIL_FIELDS = {
  incomePAShare: [
    "IncomePA_Million",
    "incomePA_Million",
    "IncomePA",
    "incomePA",
    "PAIncome_Million",
    "paIncome_Million",
    "PAIncome",
    "paIncome",
  ],
  incomePAProperty: [
    "IncomePA_Million",
    "incomePA_Million",
    "IncomePA",
    "incomePA",
    "PAIncome_Mil",
    "paIncomeMil",
    "PAIncome",
    "paIncome",
  ],
  govt: ["GovtShare", "govtShare", "GovtShare_Million", "govtShare_Million"],
  paf: ["PAFShare", "pafShare", "PAFShare_Million", "pafShare_Million"],
  ahq: [
    "AHQShare",
    "ahqShare",
    "AHQShare_Million",
    "ahqShare_Million",
    "AhqShare",
    "AHQRaw",
    "ahqRaw",
    "AHQRaw_Million",
    "ahqRaw_Million",
  ],
  rac: [
    "RACShare",
    "racShare",
    "RACShare_Million",
    "racShare_Million",
    "RacShare",
    "RACRaw",
    "racRaw",
    "RACRaw_Million",
    "racRaw_Million",
  ],
  base: [
    "BaseShare",
    "baseShare",
    "BaseShare_Million",
    "baseShare_Million",
    "BaseRaw",
    "baseRaw",
    "BaseRaw_Million",
    "baseRaw_Million",
  ],
};

const SHARE_SPLIT_RATE_FIELDS = {
  ahq: ["AHQRate", "ahqRate", "AHQ_Share_Rate", "ahqShareRate"],
  rac: ["RACRate", "racRate", "RAC_Share_Rate", "racShareRate"],
  base: ["BaseRate", "baseRate", "Base_Share_Rate", "baseShareRate"],
};

const SHARE_CLASS_ID_KEYS = ["ClassId", "classId", "ClassID", "PropertyClassId", "propertyClassId"];

/** Property-summary class ids → GovtPAFShare class ids (summary dashboard uses 1–5). */
const PROPERTY_CLASS_TO_SHARE_CLASS = {
  1: 1,
  2: 1,
  3: 2,
  4: 3,
  6: 4,
  9: 5,
};

/** GovtPAFShare class ids → property-summary class ids used on category cards. */
const SHARE_CLASS_TO_PROPERTY_CLASSES = {
  1: [1, 2],
  2: [3],
  3: [4],
  4: [6],
  5: [9],
};

function expandShareClassIds(classIds) {
  const expanded = new Set();
  for (const raw of classIds || []) {
    const cid = Number(raw);
    if (!Number.isFinite(cid)) continue;
    expanded.add(cid);
    const shareClass = PROPERTY_CLASS_TO_SHARE_CLASS[cid];
    if (shareClass != null) expanded.add(shareClass);
    const propertyClasses = SHARE_CLASS_TO_PROPERTY_CLASSES[cid];
    if (propertyClasses) propertyClasses.forEach((id) => expanded.add(id));
  }
  return [...expanded];
}

function readShareMilValue(row, directKeys, rateKeys, pafMil) {
  const direct = readNumber(row, directKeys);
  if (Number.isFinite(direct) && direct !== 0) return direct;
  const rate = readNumber(row, rateKeys);
  if (Number.isFinite(pafMil) && Number.isFinite(rate)) {
    return (pafMil * rate) / 100;
  }
  return 0;
}

function readShareMilFromRow(row, shareKey) {
  const pafMil = readNumber(row, MIL_FIELDS.paf) || 0;
  if (shareKey === "ahq") {
    return readShareMilValue(row, MIL_FIELDS.ahq, SHARE_SPLIT_RATE_FIELDS.ahq, pafMil);
  }
  if (shareKey === "rac") {
    return readShareMilValue(row, MIL_FIELDS.rac, SHARE_SPLIT_RATE_FIELDS.rac, pafMil);
  }
  if (shareKey === "base") {
    const direct = readShareMilValue(row, MIL_FIELDS.base, SHARE_SPLIT_RATE_FIELDS.base, pafMil);
    if (direct > 0) return direct;
    const ahq = readShareMilValue(row, MIL_FIELDS.ahq, SHARE_SPLIT_RATE_FIELDS.ahq, pafMil);
    const rac = readShareMilValue(row, MIL_FIELDS.rac, SHARE_SPLIT_RATE_FIELDS.rac, pafMil);
    if (pafMil > 0 && ahq + rac < pafMil) return pafMil - ahq - rac;
    return direct;
  }
  return readNumber(row, MIL_FIELDS[shareKey]) || 0;
}

/** Canonical accumulator key → API field name understood by MIL_FIELDS / readShareMilFromRow. */
const CANONICAL_MIL_KEY_TO_SHARE_FIELD = {
  incomePA: "IncomePA",
  govt: "GovtShare",
  paf: "PAFShare",
  ahq: "AHQShare",
  rac: "RACShare",
  base: "BaseShare",
};

/**
 * Callers pass either API rows (GovtShare, PAFShare, …) or aggregation accumulators keyed by
 * canonical names (govt, paf, …). Expose both shapes so share reads never silently resolve to 0.
 */
function withShareFieldAliases(mil) {
  const row = { ...mil };
  for (const [canonicalKey, fieldName] of Object.entries(CANONICAL_MIL_KEY_TO_SHARE_FIELD)) {
    const existing = row[fieldName];
    if (existing !== undefined && existing !== null && existing !== "") continue;
    const value = coerceChartDataValue(mil[canonicalKey]);
    if (value != null) row[fieldName] = value;
  }
  return row;
}

/**
 * Enforce dashboard share hierarchy on card/chart totals:
 *   Income (Total) = Govt + PAF
 *   PAF = AHQ + RAC + Base (Base is residual)
 */
export function normalizeBalancedShareMil(mil) {
  if (!mil || typeof mil !== "object") {
    return { incomePA: 0, govt: 0, paf: 0, ahq: 0, rac: 0, base: 0 };
  }

  const row = withShareFieldAliases(mil);

  let govt = readNumber(row, MIL_FIELDS.govt) || 0;
  let paf = readNumber(row, MIL_FIELDS.paf) || 0;
  let ahq = readShareMilFromRow(row, "ahq");
  let rac = readShareMilFromRow(row, "rac");
  let base = readShareMilFromRow(row, "base");
  let incomePA =
    readNumber(row, MIL_FIELDS.incomePAShare) ||
    readNumber(row, MIL_FIELDS.incomePAProperty) ||
    readNumber(row, ["incomePA"]) ||
    0;

  if (govt + paf > 0) {
    incomePA = govt + paf;
  } else if (incomePA > 0) {
    paf = Math.max(0, incomePA - govt);
  }

  if (paf > 0) {
    base = roundChartBarNumber(paf - ahq - rac, 6) ?? Math.max(0, paf - ahq - rac);
  } else {
    const splitTotal = ahq + rac + base;
    if (splitTotal > 0) {
      paf = splitTotal;
      if (govt + paf > 0) incomePA = govt + paf;
    }
  }

  return { incomePA, govt, paf, ahq, rac, base };
}

function readShareClassId(row) {
  for (const key of SHARE_CLASS_ID_KEYS) {
    const raw = row?.[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function isPropertySummaryClassId(classId) {
  const n = Number(classId);
  if (!Number.isFinite(n)) return false;
  for (const meta of Object.values(PROPERTY_CLASS_STICKERS)) {
    if (meta.classIds.includes(n)) return true;
  }
  return false;
}

function shareRowMatchesClassIds(row, classIds) {
  const cid = readShareClassId(row);
  if (!Number.isFinite(cid)) return false;
  const targetIds = (classIds || []).map(Number).filter(Number.isFinite);
  if (isGovtPafShareDataRow(row) && isPropertySummaryClassId(cid)) {
    return targetIds.includes(cid);
  }
  const expanded = expandShareClassIds(classIds);
  return expanded.includes(cid);
}

/** Sum one share column from GovtPAFShare SP rows by exact property ClassId. */
function sumSpShareMilByPropertyClassIds(shareRows, classIds, metricKey) {
  const idSet = new Set((classIds || []).map(Number).filter(Number.isFinite));
  let sum = 0;

  for (const r of shareRows || []) {
    if (!isGovtPafShareDataRow(r)) continue;
    const cid = Number(r.ClassId ?? r.classId);
    if (!idSet.has(cid)) continue;

    if (metricKey === "incomePA") {
      sum += readNumber(r, MIL_FIELDS.incomePAShare) || 0;
    } else if (metricKey === "govt") {
      sum += readNumber(r, MIL_FIELDS.govt) || 0;
    } else if (metricKey === "paf") {
      sum += readNumber(r, MIL_FIELDS.paf) || 0;
    } else if (metricKey === "ahq" || metricKey === "rac" || metricKey === "base") {
      sum += readShareMilFromRow(r, metricKey);
    }
  }

  return sum;
}

const KPI_CMD_NAME_KEYS = [
  "CmdName",
  "cmdName",
  "RACName",
  "racName",
  "CommandName",
  "commandName",
];
const KPI_BASE_NAME_KEYS = ["BaseName", "baseName", "FormationName", "formationName"];
const KPI_PROPERTY_RENT_FIELDS = [
  ...MIL_FIELDS.incomePAProperty,
  "ClassRevenue_Million",
  "classRevenue_Million",
];

function getKpiOptionName(option) {
  return String(
    option?.name ??
      option?.Name ??
      option?.cmdName ??
      option?.CmdName ??
      option?.baseName ??
      option?.BaseName ??
      ""
  ).trim();
}

function buildKpiOptionLookups(options) {
  const idToLabel = new Map();
  const nameToId = new Map();
  for (const option of options || []) {
    const id = String(option?.id ?? option?.Id ?? "").trim();
    const label = getKpiOptionName(option) || id;
    const nameKey = label.toLowerCase();
    if (id) idToLabel.set(id, label);
    if (nameKey && id) nameToId.set(nameKey, id);
  }
  return { idToLabel, nameToId };
}

function resolveKpiRowGroupKey(row, groupByBase, nameToId) {
  const idKeys = groupByBase ? KPI_BASE_ID_KEYS : KPI_CMD_ID_KEYS;
  const nameKeys = groupByBase ? KPI_BASE_NAME_KEYS : KPI_CMD_NAME_KEYS;
  const rawId = readKpiRowId(row, idKeys);

  if (rawId) {
    if (/^\d+$/.test(rawId)) return rawId;
    const mapped = nameToId.get(rawId.toLowerCase());
    if (mapped) return mapped;
  }

  const rowName = readString(row, nameKeys);
  if (rowName) {
    const mapped = nameToId.get(rowName.toLowerCase());
    if (mapped) return mapped;
  }

  return rawId && /^\d+$/.test(rawId) ? rawId : "";
}

function accumulateKpiGroupTotals(rows, dataSetName, fieldKeys, groupByBase, nameToId, totalsById) {
  for (const row of rows || []) {
    if (dataSetName === DATA_SET_GOVT_PAF_SHARE && !isGovtPafShareDataRow(row)) continue;
    if (dataSetName && dataSetName !== DATA_SET_GOVT_PAF_SHARE && !isDataSetRow(row, dataSetName))
      continue;
    const groupKey = resolveKpiRowGroupKey(row, groupByBase, nameToId);
    if (!groupKey) continue;
    const value = readNumber(row, fieldKeys);
    if (!Number.isFinite(value)) continue;
    totalsById.set(groupKey, (totalsById.get(groupKey) || 0) + value);
  }
}

function mergeShareAndPropertyTotals(shareTotals, propertyTotals) {
  const merged = new Map(shareTotals);
  for (const [key, propertyValue] of propertyTotals.entries()) {
    const shareValue = shareTotals.get(key) || 0;
    merged.set(key, shareValue > 0 ? shareValue : propertyValue);
  }
  return merged;
}

/**
 * Command- or base-wise bar chart for Financials (PAF Annual Rent, Govt Share, etc.).
 * Aggregates GovtPAFShare rows by CmdId; falls back to PropertySummary revenue per command.
 */
export function buildKpiCommandFinancialBarChart({
  shareRows = [],
  propertyRows = [],
  racOptions = [],
  baseOptions = [],
  racIds = [],
  baseIds = [],
  shareFieldKeys = MIL_FIELDS.incomePAShare,
  propertyFieldKeys = KPI_PROPERTY_RENT_FIELDS,
  usePropertyFallback = true,
}) {
  const groupByBase = (racIds || []).length > 0 || (baseIds || []).length > 0;
  const selectedBaseSet = new Set((baseIds || []).map(String));
  const selectedRacSet = new Set((racIds || []).map(String));
  const sourceOptions = groupByBase
    ? (baseOptions || []).filter(
        (option) =>
          selectedBaseSet.size === 0 || selectedBaseSet.has(String(option.id ?? option.Id))
      )
    : (racOptions || []).filter(
        (option) => selectedRacSet.size === 0 || selectedRacSet.has(String(option.id ?? option.Id))
      );

  const { idToLabel, nameToId } = buildKpiOptionLookups(sourceOptions);
  const shareTotals = new Map();
  const propertyTotals = new Map();

  accumulateKpiGroupTotals(
    shareRows,
    DATA_SET_GOVT_PAF_SHARE,
    shareFieldKeys,
    groupByBase,
    nameToId,
    shareTotals
  );

  if (usePropertyFallback) {
    accumulateKpiGroupTotals(
      propertyRows,
      DATA_SET_PROPERTY_SUMMARY,
      propertyFieldKeys,
      groupByBase,
      nameToId,
      propertyTotals
    );
  }

  const totalsById = usePropertyFallback
    ? mergeShareAndPropertyTotals(shareTotals, propertyTotals)
    : shareTotals;

  if (sourceOptions.length > 0) {
    return {
      labels: sourceOptions.map(
        (option) => getKpiOptionName(option) || String(option.id ?? option.Id ?? "")
      ),
      data: sourceOptions.map((option) => {
        const optionId = String(option.id ?? option.Id ?? "");
        return totalsById.get(optionId) || 0;
      }),
    };
  }

  if (totalsById.size > 0) {
    const entries = [...totalsById.entries()].sort((a, b) =>
      (idToLabel.get(a[0]) || a[0]).localeCompare(idToLabel.get(b[0]) || b[0])
    );
    return {
      labels: entries.map(([id]) => idToLabel.get(id) || id),
      data: entries.map(([, value]) => value),
    };
  }

  const allShare = (shareRows || []).reduce((sum, row) => {
    if (!isGovtPafShareDataRow(row)) return sum;
    return sum + (readNumber(row, shareFieldKeys) || 0);
  }, 0);
  const allProperty = usePropertyFallback
    ? (propertyRows || []).reduce((sum, row) => {
        if (!isDataSetRow(row, DATA_SET_PROPERTY_SUMMARY)) return sum;
        return sum + (readNumber(row, propertyFieldKeys) || 0);
      }, 0)
    : 0;

  return {
    labels: ["All"],
    data: [allShare > 0 ? allShare : allProperty],
  };
}

/** Sum Income PA / share amounts (Mil) from GovtPAFShare rows for given ClassIds. */
function aggregateShareMilByClassIds(shareRows, classIds) {
  const out = {
    incomePA: 0,
    govt: 0,
    paf: 0,
    ahq: 0,
    rac: 0,
    base: 0,
  };
  for (const r of shareRows) {
    if (!isGovtPafShareDataRow(r)) continue;
    if (!shareRowMatchesClassIds(r, classIds)) continue;
    out.incomePA += readNumber(r, MIL_FIELDS.incomePAShare) || 0;
    out.govt += readNumber(r, MIL_FIELDS.govt) || 0;
    out.paf += readNumber(r, MIL_FIELDS.paf) || 0;
    out.ahq += readShareMilFromRow(r, "ahq");
    out.rac += readShareMilFromRow(r, "rac");
    out.base += readShareMilFromRow(r, "base");
  }
  return normalizeBalancedShareMil(out);
}

/** Income PA (Mil) from PropertySummary rows when not on share rows. */
function aggregateIncomePAFromPropertyRows(propertyRows, classIds) {
  const idSet = new Set(classIds.map(Number));
  let sum = 0;
  for (const r of propertyRows) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    const cid = Number(r.ClassId ?? r.classId);
    if (!idSet.has(cid)) continue;
    sum += readNumber(r, MIL_FIELDS.incomePAProperty) || 0;
  }
  return sum;
}

function mergeContractShareFallback(out, contractRows, classIds) {
  if (!contractRows?.length) return;
  const needsAhqRacBase = out.ahq === 0 && out.rac === 0 && out.base === 0;
  const needsGovtPaf = out.govt === 0 && out.paf === 0;
  if (!needsAhqRacBase && !needsGovtPaf) return;

  for (const r of contractRows) {
    if (!isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)) continue;
    if (!shareRowMatchesClassIds(r, classIds)) continue;
    if (needsAhqRacBase) {
      out.ahq += readShareMilFromRow(r, "ahq");
      out.rac += readShareMilFromRow(r, "rac");
      out.base += readShareMilFromRow(r, "base");
    }
    if (needsGovtPaf) {
      out.govt += readNumber(r, MIL_FIELDS.govt) || 0;
      out.paf += readNumber(r, MIL_FIELDS.paf) || 0;
    }
  }
}

function buildMilForCategory(shareRows, propertyRows, classIds, contractRows = []) {
  const fromShare = aggregateShareMilByClassIds(shareRows, classIds);
  mergeContractShareFallback(fromShare, contractRows, classIds);
  if (!fromShare.incomePA) {
    fromShare.incomePA = aggregateIncomePAFromPropertyRows(propertyRows, classIds);
  }
  return normalizeBalancedShareMil(fromShare);
}

/** Lands fallback: total minus categorized classes when ClassId 1 has no rows. */
function buildLandsAggregate(propertyRows, categorizedSum) {
  const direct = aggregateByClassIds(propertyRows, PROPERTY_CLASS_STICKERS.lands.classIds);
  if (direct.count > 0 || Object.keys(direct.areasByUom).length > 0) return direct;

  let count = 0;
  let worth = 0;
  const areasByUom = {};
  for (const r of propertyRows) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    const pc = readNumber(r, ["PropertyCount", "propertyCount"]);
    const rev = readNumber(r, ["ClassRevenue_Million", "classRevenue_Million"]);
    if (Number.isFinite(pc)) count += pc;
    if (Number.isFinite(rev)) worth += rev;
    const area = readPropertySummaryArea(r);
    if (Number.isFinite(area)) {
      const uom = readPropertySummaryUom(r) || "—";
      areasByUom[uom] = (areasByUom[uom] || 0) + area;
    }
  }
  const remainderCount = Math.max(0, count - categorizedSum.count);
  const remainderWorth = Math.max(0, worth - categorizedSum.worth);
  return {
    count: remainderCount || count,
    worth: remainderWorth || worth,
    areaLine: formatAreasByUomLine(areasByUom),
    areasByUom,
  };
}

export function buildAssetCards(propertyRows, shareRows = [], contractRows = []) {
  const cardsByKey = {};

  for (const [key, meta] of Object.entries(PROPERTY_CLASS_STICKERS)) {
    if (key === "lands") continue;
    const agg = aggregateByClassIds(propertyRows, meta.classIds);
    const mil = buildMilForCategory(shareRows, propertyRows, meta.classIds, contractRows);
    cardsByKey[key] = {
      key,
      label: meta.label,
      count: agg.count,
      worth: agg.worth,
      areaLine: agg.areaLine,
      mil,
    };
  }

  const totalAgg = aggregateAllPropertySummary(propertyRows);
  const allClassIds = collectPropertySummaryClassIds(propertyRows);
  cardsByKey.total = {
    key: "total",
    label: "Total",
    count: totalAgg.count,
    worth: totalAgg.worth,
    areaLine: totalAgg.areaLine,
    mil: buildMilForCategory(shareRows, propertyRows, allClassIds, contractRows),
    chartInclude: false,
  };

  const fixedCards = ASSET_CARD_FIXED_ORDER.map((key) => cardsByKey[key]).filter(Boolean);
  const extraCards = buildExtraPropertyClassCards(
    propertyRows,
    shareRows,
    getKnownPropertyClassIds(),
    contractRows
  );

  return [...fixedCards, ...extraCards].map(zeroAssetCardStatsIfNoCount);
}

function isActiveNotDeletedPropertyGroup(group) {
  if (!group || typeof group !== "object") return false;
  const status = group.Status ?? group.status;
  const isDeleted = group.IsDeleted ?? group.isDeleted;
  const isActive = status === true || status === 1 || status === "1";
  const notDeleted = !(isDeleted === true || isDeleted === 1 || isDeleted === "1");
  return isActive && notDeleted;
}

function filterPropertyGroupsByRacBase(groups, racIds, baseIds) {
  const racSet = new Set((racIds || []).map(String));
  const baseSet = new Set((baseIds || []).map(String));
  const hasRacFilter = racSet.size > 0;
  const hasBaseFilter = baseSet.size > 0;
  if (!hasRacFilter && !hasBaseFilter) return groups || [];

  return (groups || []).filter((group) => {
    const cmdId = String(group.CmdId ?? group.cmdId ?? "");
    const baseId = String(group.BaseId ?? group.baseId ?? "");
    if (hasRacFilter && (!cmdId || !racSet.has(cmdId))) return false;
    if (hasBaseFilter && (!baseId || !baseSet.has(baseId))) return false;
    return true;
  });
}

function aggregatePropertyGroupsByClassIds(groups, classIds) {
  const idSet = new Set(classIds.map(Number));
  let count = 0;
  const areasByUom = {};

  for (const group of groups) {
    const classId = Number(group.ClassId ?? group.classId);
    if (!idSet.has(classId)) continue;
    count += 1;
    const area = readPropertySummaryArea(group);
    if (Number.isFinite(area)) {
      const uom = readPropertySummaryUom(group) || "—";
      areasByUom[uom] = (areasByUom[uom] || 0) + area;
    }
  }

  return { count, areaLine: formatAreasByUomLine(areasByUom), areasByUom };
}

function aggregateGroupedSummaryByClassIds(rows, classIds) {
  const idSet = new Set(classIds.map(Number));
  let count = 0;
  const areasByUom = {};

  for (const r of rows) {
    if (!isGroupSummaryDataRow(r)) continue;
    const classId = Number(r.ClassId ?? r.classId);
    if (!idSet.has(classId)) continue;
    const pc = readNumber(r, GROUPED_PROPERTY_COUNT_FIELDS);
    if (Number.isFinite(pc)) count += pc;
    const area = readPropertySummaryArea(r);
    if (Number.isFinite(area)) {
      const uom = readPropertySummaryUom(r) || "—";
      areasByUom[uom] = (areasByUom[uom] || 0) + area;
    }
  }

  return { count, areaLine: formatAreasByUomLine(areasByUom), areasByUom };
}

function mergeGroupedAreasByUom(target, source) {
  if (!source || typeof source !== "object") return;
  for (const [uom, area] of Object.entries(source)) {
    if (!Number.isFinite(area)) continue;
    target[uom] = (target[uom] || 0) + area;
  }
}

/** Total Groups = sum of all category sticker counts/areas (excludes the total key itself). */
function sumGroupedCategoryStats(groupedStatsByKey) {
  let count = 0;
  const areasByUom = {};

  for (const [key, agg] of Object.entries(groupedStatsByKey || {})) {
    if (key === "total" || !agg || typeof agg !== "object") continue;
    if (Number.isFinite(agg.count)) count += agg.count;
    mergeGroupedAreasByUom(areasByUom, agg.areasByUom);
  }

  return { count, areaLine: formatAreasByUomLine(areasByUom), areasByUom };
}

function filterGroupedSummaryRowsByRacBase(rows, racIds, baseIds) {
  return filterKpiRowsByRacBase(rows, racIds, baseIds);
}

function resolveGroupedAggregateForCard(card, groupedStatsByKey, totalGroupedAgg) {
  if (card.key === "total") return totalGroupedAgg;
  if (groupedStatsByKey[card.key]) return groupedStatsByKey[card.key];
  if (card.isExtraClass && Number.isFinite(Number(card.classId))) {
    return groupedStatsByKey[`class-${card.classId}`] || null;
  }
  return null;
}

function buildGroupedStatsByKeyFromGroups(groups) {
  const groupedStatsByKey = {};

  for (const [key, meta] of Object.entries(PROPERTY_CLASS_STICKERS)) {
    if (key === "lands") continue;
    groupedStatsByKey[key] = aggregatePropertyGroupsByClassIds(groups, meta.classIds);
  }

  const knownClassIds = getKnownPropertyClassIds();
  for (const group of groups) {
    const classId = Number(group.ClassId ?? group.classId);
    if (!Number.isFinite(classId) || knownClassIds.has(classId)) continue;
    const mapKey = `class-${classId}`;
    if (!groupedStatsByKey[mapKey]) {
      groupedStatsByKey[mapKey] = aggregatePropertyGroupsByClassIds(groups, [classId]);
    }
  }

  groupedStatsByKey.total = sumGroupedCategoryStats(groupedStatsByKey);
  return groupedStatsByKey;
}

function buildGroupedStatsByKeyFromSummaryRows(rows) {
  const groupedStatsByKey = {};

  for (const [key, meta] of Object.entries(PROPERTY_CLASS_STICKERS)) {
    if (key === "lands") continue;
    groupedStatsByKey[key] = aggregateGroupedSummaryByClassIds(rows, meta.classIds);
  }

  const knownClassIds = getKnownPropertyClassIds();
  for (const r of rows) {
    if (!isGroupSummaryDataRow(r)) continue;
    const classId = Number(r.ClassId ?? r.classId);
    if (!Number.isFinite(classId) || knownClassIds.has(classId)) continue;
    const mapKey = `class-${classId}`;
    if (!groupedStatsByKey[mapKey]) {
      groupedStatsByKey[mapKey] = aggregateGroupedSummaryByClassIds(rows, [classId]);
    }
  }

  groupedStatsByKey.total = sumGroupedCategoryStats(groupedStatsByKey);
  return groupedStatsByKey;
}

/**
 * Row 1 asset cards: counts/area from active, not-deleted property groupings per category.
 * Income/shares stay on property-summary aggregation from buildAssetCards.
 */
export function buildGroupedAssetCards(
  propertyRows,
  shareRows = [],
  contractRows = [],
  { propertyGroupSummaryRows = [], propertyGroups = [], racIds = [], baseIds = [] } = {}
) {
  const baseCards = buildAssetCards(propertyRows, shareRows, contractRows);
  const filteredSummaryRows = filterGroupedSummaryRowsByRacBase(
    propertyGroupSummaryRows,
    racIds,
    baseIds
  );
  let groupedStatsByKey = null;
  if (filteredSummaryRows.length > 0) {
    groupedStatsByKey = buildGroupedStatsByKeyFromSummaryRows(filteredSummaryRows);
  } else {
    const scopedGroups = filterPropertyGroupsByRacBase(
      (propertyGroups || []).filter(isActiveNotDeletedPropertyGroup),
      racIds,
      baseIds
    );
    groupedStatsByKey = buildGroupedStatsByKeyFromGroups(scopedGroups);
  }

  const totalGroupedAgg = groupedStatsByKey.total || {
    count: 0,
    areaLine: formatAreasByUomLine({}),
  };

  return baseCards
    .map((card) => {
      const groupedAgg = resolveGroupedAggregateForCard(card, groupedStatsByKey, totalGroupedAgg);
      const displayLabel = groupedAssetRowLabel(card.key);
      if (!groupedAgg) {
        return {
          ...card,
          count: 0,
          areaLine: formatAreasByUomLine({}),
          ...(displayLabel ? { label: displayLabel } : {}),
        };
      }
      return {
        ...card,
        count: groupedAgg.count,
        areaLine: groupedAgg.areaLine,
        ...(displayLabel ? { label: displayLabel } : {}),
      };
    })
    .map(zeroAssetCardStatsIfNoCount);
}

const EMPTY_ASSET_CARD_MIL = {
  incomePA: 0,
  govt: 0,
  paf: 0,
  ahq: 0,
  rac: 0,
  base: 0,
};

/** When a category has no properties, card stats (worth, area, shares) should read as zero. */
function zeroAssetCardStatsIfNoCount(card) {
  if (!card || Number(card.count) > 0) return card;
  return {
    ...card,
    count: 0,
    worth: 0,
    areaLine: formatAreasByUomLine({}),
    mil: { ...EMPTY_ASSET_CARD_MIL },
  };
}

export function buildExecutiveKpis(propertyRows, contractRows, shareRows) {
  let totalProperties = 0;
  const totalAreasByUom = {};

  for (const r of propertyRows) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    const pc = readNumber(r, ["PropertyCount", "propertyCount"]);
    if (Number.isFinite(pc)) totalProperties += pc;
    const area = readPropertySummaryArea(r);
    if (Number.isFinite(area)) {
      const uom = readPropertySummaryUom(r) || "—";
      totalAreasByUom[uom] = (totalAreasByUom[uom] || 0) + area;
    }
  }

  let activeContracts = 0;
  let activeProjects = 0;
  for (const r of contractRows) {
    if (!isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)) continue;
    const a = readNumber(r, ["ActiveContracts", "activeContracts"]);
    if (Number.isFinite(a)) activeContracts += a;
    const p = readNumber(r, ["ActiveProjects", "activeProjects", "ProjectCount", "projectCount"]);
    if (Number.isFinite(p)) activeProjects += p;
  }

  for (const r of propertyRows) {
    const p = readNumber(r, ["ActiveProjects", "activeProjects", "ProjectCount", "projectCount"]);
    if (Number.isFinite(p)) activeProjects += p;
  }

  let totalPafShare = 0;
  for (const r of shareRows) {
    if (!isGovtPafShareDataRow(r)) continue;
    const p = readNumber(r, MIL_FIELDS.paf);
    if (Number.isFinite(p)) totalPafShare += p;
  }

  const health = buildContractHealth(contractRows);
  const totalHealth =
    health.active.count + health.expiring.count + health.terminated.count + health.vacant.count ||
    1;
  const contractHealthPct = Math.round((health.active.count / totalHealth) * 100);

  return {
    totalProperties,
    totalAreaLine: formatAreasByUomLine(totalAreasByUom),
    activeProjects,
    activeContracts,
    totalPafShare,
    contractHealthPct,
  };
}

function emptyContractStickerMetrics() {
  return { count: 0, worth: 0, amount: 0 };
}

function addContractStickerMetrics(target, row, countKeys, worthKeys, amountKeys) {
  const count = readNumber(row, countKeys);
  const worth = readNumber(row, worthKeys);
  const amount = readNumber(row, amountKeys);
  if (Number.isFinite(count)) target.count += count;
  if (Number.isFinite(worth)) target.worth += worth;
  if (Number.isFinite(amount)) target.amount += amount;
}

export function buildContractHealth(contractRows) {
  const active = emptyContractStickerMetrics();
  const premature = emptyContractStickerMetrics();
  const expiring = emptyContractStickerMetrics();
  const terminated = emptyContractStickerMetrics();
  const vacant = emptyContractStickerMetrics();

  for (const r of contractRows) {
    if (!isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)) continue;

    addContractStickerMetrics(
      active,
      r,
      ["ActiveContracts", "activeContracts"],
      [
        "ActiveContracts_Million",
        "activeContracts_Million",
        "ActiveContractsWorth",
        "activeContractsWorth",
        "ActiveContractWorth",
        "activeContractWorth",
        "ActiveWorth",
        "activeWorth",
      ],
      [
        "ActiveAmount",
        "activeAmount",
        "ActiveContractsAmount",
        "activeContractsAmount",
        "ActiveContractAmount",
        "activeContractAmount",
      ]
    );

    addContractStickerMetrics(
      premature,
      r,
      ["PrematureContracts", "prematureContracts", "Premature", "premature"],
      [
        "PrematureContracts_Million",
        "prematureContracts_Million",
        "PrematureWorth",
        "prematureWorth",
        "PrematureContractWorth",
        "prematureContractWorth",
      ],
      ["PrematureAmount", "prematureAmount", "PrematureContractsAmount", "prematureContractsAmount"]
    );

    const expDirect = readNumber(r, ["ExpiringContracts", "expiringContracts"]);
    if (Number.isFinite(expDirect)) {
      expiring.count += expDirect;
    } else {
      expiring.count +=
        (readNumber(r, ["ExpiredContracts", "expiredContracts"]) || 0) +
        (readNumber(r, ["BorderLineContracts", "borderLineContracts"]) || 0);
    }
    addContractStickerMetrics(
      expiring,
      r,
      [],
      [
        "ExpiringContracts_Million",
        "expiringContracts_Million",
        "ExpiringWorth",
        "expiringWorth",
        "ExpiredContracts_Million",
        "expiredContracts_Million",
        "BorderLineContracts_Million",
        "borderLineContracts_Million",
      ],
      [
        "ExpiringAmount",
        "expiringAmount",
        "ExpiredAmount",
        "expiredAmount",
        "BorderLineAmount",
        "borderLineAmount",
      ]
    );

    terminated.count +=
      (readNumber(r, ["TerminatedContracts", "terminatedContracts"]) || 0) +
      (readNumber(r, ["ClosedContracts", "closedContracts"]) || 0);
    addContractStickerMetrics(
      terminated,
      r,
      [],
      [
        "TerminatedContracts_Million",
        "terminatedContracts_Million",
        "ClosedContracts_Million",
        "closedContracts_Million",
        "TerminatedWorth",
        "terminatedWorth",
        "ClosedWorth",
        "closedWorth",
      ],
      [
        "TerminatedAmount",
        "terminatedAmount",
        "ClosedAmount",
        "closedAmount",
        "TerminatedContractsAmount",
        "terminatedContractsAmount",
      ]
    );

    addContractStickerMetrics(
      vacant,
      r,
      ["VacantContracts", "vacantContracts"],
      [
        "VacantContracts_Million",
        "vacantContracts_Million",
        "VacantWorth",
        "vacantWorth",
        "VacantContractWorth",
        "vacantContractWorth",
      ],
      ["VacantAmount", "vacantAmount", "VacantContractsAmount", "vacantContractsAmount"]
    );
  }

  return { active, premature, expiring, terminated, vacant };
}

/** Contract Status aggregates from ContractsSummary rows (API: Viable, UnViable, Active, Inactive). */
export function buildContractStatus(contractRows) {
  const viable = emptyContractStickerMetrics();
  const unviable = emptyContractStickerMetrics();
  const active = emptyContractStickerMetrics();
  const inactive = emptyContractStickerMetrics();

  for (const r of contractRows) {
    if (!isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)) continue;

    addContractStickerMetrics(
      viable,
      r,
      ["Viable", "viable", "ViableContracts", "viableContracts", "ViableCount", "viableCount"],
      [
        "Viable_Million",
        "viable_Million",
        "ViableWorth",
        "viableWorth",
        "ViableRevenue_Million",
        "viableRevenue_Million",
      ],
      ["ViableAmount", "viableAmount", "ViableContractsAmount", "viableContractsAmount"]
    );

    addContractStickerMetrics(
      unviable,
      r,
      [
        "UnViable",
        "unViable",
        "Unviable",
        "unviable",
        "UnviableContracts",
        "unviableContracts",
        "UnviableCount",
        "unviableCount",
      ],
      [
        "UnViable_Million",
        "unViable_Million",
        "UnViableWorth",
        "unViableWorth",
        "UnviableWorth",
        "unviableWorth",
        "UnViableRevenue_Million",
        "unViableRevenue_Million",
      ],
      [
        "UnViableAmount",
        "unViableAmount",
        "UnviableAmount",
        "unviableAmount",
        "UnviableContractsAmount",
        "unviableContractsAmount",
      ]
    );

    addContractStickerMetrics(
      active,
      r,
      [
        "Active",
        "active",
        "StatusActiveContracts",
        "statusActiveContracts",
        "ActiveStatusCount",
        "activeStatusCount",
        "ContractStatusActive",
        "contractStatusActive",
      ],
      [
        "Active_Million",
        "active_Million",
        "ActiveWorth",
        "activeWorth",
        "StatusActiveWorth",
        "statusActiveWorth",
        "ActiveRevenue_Million",
        "activeRevenue_Million",
      ],
      [
        "ActiveAmount",
        "activeAmount",
        "StatusActiveAmount",
        "statusActiveAmount",
        "ActiveStatusAmount",
        "activeStatusAmount",
      ]
    );

    addContractStickerMetrics(
      inactive,
      r,
      [
        "Inactive",
        "inactive",
        "InactiveContracts",
        "inactiveContracts",
        "InactiveCount",
        "inactiveCount",
        "StatusInactiveContracts",
        "statusInactiveContracts",
      ],
      [
        "Inactive_Million",
        "inactive_Million",
        "InactiveWorth",
        "inactiveWorth",
        "InactiveRevenue_Million",
        "inactiveRevenue_Million",
      ],
      [
        "InactiveAmount",
        "inactiveAmount",
        "InactiveContractsAmount",
        "inactiveContractsAmount",
        "StatusInactiveAmount",
        "statusInactiveAmount",
      ]
    );
  }

  return { viable, unviable, active, inactive };
}

/** AHQ Approval aggregates from ContractsSummary rows (API: AHQPending, AHQApprvd). */
export function buildAhqApproval(contractRows) {
  const approved = emptyContractStickerMetrics();
  const pending = emptyContractStickerMetrics();

  for (const r of contractRows) {
    if (!isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)) continue;

    addContractStickerMetrics(
      approved,
      r,
      [
        "AHQApprvd",
        "ahqApprvd",
        "AHQApproved",
        "ahqApproved",
        "ApprovedContracts",
        "approvedContracts",
        "ApprovedCount",
        "approvedCount",
      ],
      [
        "AHQApprvd_Million",
        "ahqApprvd_Million",
        "AHQApprvdWorth",
        "ahqApprvdWorth",
        "AHQApproved_Million",
        "ahqApproved_Million",
        "ApprovedWorth",
        "approvedWorth",
      ],
      [
        "AHQApprvdAmount",
        "ahqApprvdAmount",
        "AHQApprovedAmount",
        "ahqApprovedAmount",
        "ApprovedAmount",
        "approvedAmount",
      ]
    );

    addContractStickerMetrics(
      pending,
      r,
      [
        "AHQPending",
        "ahqPending",
        "PendingContracts",
        "pendingContracts",
        "PendingApproval",
        "pendingApproval",
        "PendingCount",
        "pendingCount",
      ],
      [
        "AHQPending_Million",
        "ahqPending_Million",
        "AHQPendingWorth",
        "ahqPendingWorth",
        "PendingWorth",
        "pendingWorth",
        "PendingApproval_Million",
        "pendingApproval_Million",
      ],
      [
        "AHQPendingAmount",
        "ahqPendingAmount",
        "PendingAmount",
        "pendingAmount",
        "PendingApprovalAmount",
        "pendingApprovalAmount",
      ]
    );
  }

  return { approved, pending };
}

export function buildFinancialShares(
  shareRows,
  classIdFilter = "all",
  contractRows = [],
  { preferSpGovtPafShare = false } = {}
) {
  const keys = [
    { id: "govt", label: "Govt Share", fields: MIL_FIELDS.govt },
    { id: "paf", label: "PAF Share", fields: MIL_FIELDS.paf },
    { id: "ahq", label: "AHQ Share", fields: MIL_FIELDS.ahq },
    { id: "rac", label: "RAC Share", fields: MIL_FIELDS.rac },
    { id: "base", label: "Base Share", fields: MIL_FIELDS.base },
  ];

  const totals = {};
  keys.forEach((k) => {
    totals[k.id] = 0;
  });

  let rows = Array.isArray(shareRows) ? shareRows.filter((r) => isGovtPafShareDataRow(r)) : [];
  if (
    classIdFilter != null &&
    classIdFilter !== "" &&
    String(classIdFilter).toLowerCase() !== "all"
  ) {
    const cid = Number(classIdFilter);
    if (Number.isFinite(cid)) {
      rows = rows.filter((r) => shareRowMatchesClassIds(r, [cid]));
    }
  }

  for (const r of rows) {
    keys.forEach((k) => {
      let v;
      if (k.id === "ahq" || k.id === "rac" || k.id === "base") {
        v = readShareMilFromRow(r, k.id);
      } else {
        v = readNumber(r, k.fields);
      }
      if (Number.isFinite(v)) totals[k.id] += v;
    });
  }

  const contractScoped =
    classIdFilter != null && classIdFilter !== "" && String(classIdFilter).toLowerCase() !== "all"
      ? [Number(classIdFilter)]
      : null;

  if (!preferSpGovtPafShare) {
    for (const r of contractRows || []) {
      if (!isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)) continue;
      if (contractScoped && !shareRowMatchesClassIds(r, contractScoped)) continue;
      keys.forEach((k) => {
        const shareTotal = totals[k.id] || 0;
        if (k.id === "ahq" || k.id === "rac" || k.id === "base") {
          if (shareTotal !== 0) return;
          const v = readShareMilFromRow(r, k.id);
          if (Number.isFinite(v)) totals[k.id] += v;
          return;
        }
        if (shareTotal !== 0) return;
        const v = readNumber(r, k.fields);
        if (Number.isFinite(v)) totals[k.id] += v;
      });
    }
  }

  if (preferSpGovtPafShare) {
    const balanced = normalizeBalancedShareMil({
      govt: totals.govt,
      paf: totals.paf,
      ahq: totals.ahq,
      rac: totals.rac,
      base: totals.base,
    });
    return keys.map((k) => ({
      id: k.id,
      label: k.label,
      value: balanced[k.id] || 0,
    }));
  }

  return keys.map((k) => ({
    id: k.id,
    label: k.label,
    value: totals[k.id],
  }));
}

export const KPI_ASSET_CHART_CATEGORY_KEYS = ["categoryA", "categoryB", "categoryC", "bts", "hb"];

function resolveKpiRacChartOptions(racOptions, racIds = []) {
  const list = Array.isArray(racOptions) ? racOptions : [];
  const selected = new Set((racIds || []).map(String));
  if (selected.size === 0) return list;
  return list.filter((option) => selected.has(String(option.id ?? option.Id ?? "")));
}

function filterKpiRowsByCmdId(rows, cmdId) {
  const id = String(cmdId ?? "");
  if (!id) return rows || [];
  return (rows || []).filter((row) => readKpiRowId(row, KPI_CMD_ID_KEYS) === id);
}

/** Limit asset chart categories when Share Distribution class filter is active. */
export function resolveKpiChartCategoryKeys(shareClassFilter = "all") {
  if (!shareClassFilter || shareClassFilter === "all") {
    return [...KPI_ASSET_CHART_CATEGORY_KEYS];
  }
  const shareClassId = Number(shareClassFilter);
  const propertyClassIds = SHARE_CLASS_TO_PROPERTY_CLASSES[shareClassId];
  if (!propertyClassIds?.length) return [...KPI_ASSET_CHART_CATEGORY_KEYS];
  const idSet = new Set(propertyClassIds);
  return KPI_ASSET_CHART_CATEGORY_KEYS.filter((key) => {
    const meta = PROPERTY_CLASS_STICKERS[key];
    return meta?.classIds?.some((classId) => idSet.has(classId));
  });
}

/**
 * Financial mil values for each property category × RAC (CmdId) combination.
 * Used by Assets tab bar/donut charts.
 */
export function buildKpiCategoryRacMilMatrix({
  shareRows = [],
  propertyRows = [],
  contractRows = [],
  racOptions = [],
  racIds = [],
  categoryKeys,
}) {
  const keys =
    Array.isArray(categoryKeys) && categoryKeys.length
      ? categoryKeys
      : KPI_ASSET_CHART_CATEGORY_KEYS;
  const racs = resolveKpiRacChartOptions(racOptions, racIds);
  const racList = racs.length > 0 ? racs : [{ id: "", name: "All" }];
  const cells = [];

  for (const rac of racList) {
    const cmdId = String(rac.id ?? rac.Id ?? "");
    const racLabel = getKpiOptionName(rac) || cmdId || "All";
    const racShare = cmdId ? filterKpiRowsByCmdId(shareRows, cmdId) : shareRows;
    const racProperty = cmdId ? filterKpiRowsByCmdId(propertyRows, cmdId) : propertyRows;
    const racContract = cmdId ? filterKpiRowsByCmdId(contractRows, cmdId) : contractRows;

    for (const key of keys) {
      const meta = PROPERTY_CLASS_STICKERS[key];
      if (!meta) continue;
      const catLabel = groupedAssetRowLabel(key) || meta.label;
      const mil = buildMilForCategory(racShare, racProperty, meta.classIds, racContract);
      cells.push({
        key: `${cmdId || "all"}-${key}`,
        racLabel,
        catLabel,
        chartLabel: `${catLabel} — ${racLabel}`,
        mil,
      });
    }
  }

  return cells;
}

export const KPI_GOVT_PAF_UNASSIGNED_BASE_KEY = "__unassigned__";

function sumGovtPafMilFromShareRows(rows) {
  let govt = 0;
  let paf = 0;
  for (const row of rows || []) {
    if (!isGovtPafShareDataRow(row)) continue;
    govt += readNumber(row, MIL_FIELDS.govt) || 0;
    paf += readNumber(row, MIL_FIELDS.paf) || 0;
  }
  return { govt, paf };
}

function sumGovtPafMilFromContractRows(rows) {
  let govt = 0;
  let paf = 0;
  for (const row of rows || []) {
    if (!isDataSetRow(row, DATA_SET_CONTRACTS_SUMMARY)) continue;
    govt += readNumber(row, MIL_FIELDS.govt) || 0;
    paf += readNumber(row, MIL_FIELDS.paf) || 0;
  }
  return { govt, paf };
}

/** Prefer SP GovtPAFShare rows over /contracts agreement rows for Financials charts. */
export function shouldUseAgreementFinancialSource(
  agreementContractRows,
  { preferSpGovtPafShare = false } = {}
) {
  if (preferSpGovtPafShare) return false;
  return (agreementContractRows || []).length > 0;
}

/** Mirrors buildFinancialShares govt/paf source selection (share first, else contract). */
function resolveGovtPafMilSources(shareRows, contractRows, { shareOnly = false } = {}) {
  const fromShare = sumGovtPafMilFromShareRows(shareRows);
  if (shareOnly) {
    return {
      govt: fromShare.govt,
      paf: fromShare.paf,
      govtSource: "share",
      pafSource: "share",
    };
  }
  const fromContract = sumGovtPafMilFromContractRows(contractRows);
  const govtSource = fromShare.govt !== 0 ? "share" : "contract";
  const pafSource = fromShare.paf !== 0 ? "share" : "contract";

  return {
    govt: govtSource === "share" ? fromShare.govt : fromContract.govt,
    paf: pafSource === "share" ? fromShare.paf : fromContract.paf,
    govtSource,
    pafSource,
  };
}

function buildGovtPafMilForScopedRows(shareRows, contractRows, sources) {
  const govtRows = sources.govtSource === "share" ? shareRows : contractRows;
  const pafRows = sources.pafSource === "share" ? shareRows : contractRows;
  const govt =
    sources.govtSource === "share"
      ? sumGovtPafMilFromShareRows(govtRows).govt
      : sumGovtPafMilFromContractRows(govtRows).govt;
  const paf =
    sources.pafSource === "share"
      ? sumGovtPafMilFromShareRows(pafRows).paf
      : sumGovtPafMilFromContractRows(pafRows).paf;
  return { govt, paf };
}

function partitionKpiRowsByBaseId(rows) {
  const byBase = new Map();
  const unassigned = [];

  for (const row of rows || []) {
    const baseId = readKpiRowId(row, KPI_BASE_ID_KEYS);
    if (!baseId) {
      unassigned.push(row);
      continue;
    }
    if (!byBase.has(baseId)) byBase.set(baseId, []);
    byBase.get(baseId).push(row);
  }

  return { byBase, unassigned };
}

function resolveKpiBaseLabel(baseId, catalogBases, labelLookups) {
  const match = (catalogBases || []).find((base) => String(base.id ?? base.Id ?? "") === baseId);
  if (match) return getKpiOptionName(match) || baseId;
  return labelLookups?.idToLabel?.get(baseId) || baseId;
}

function buildKpiBaseGovtPafCell(baseId, chartLabel, shareRows, contractRows, sources) {
  const baseShare = baseId ? filterKpiRowsByBaseId(shareRows, baseId) : shareRows;
  const baseContract = baseId ? filterKpiRowsByBaseId(contractRows, baseId) : contractRows;
  return {
    key: baseId || "all",
    chartLabel,
    mil: buildGovtPafMilForScopedRows(baseShare, baseContract, sources),
  };
}

/**
 * Govt / PAF mil per RAC (CmdId), consolidated across all property classes.
 * Used by Govt & PAF bar charts without class-wise breakdown.
 */
export function buildKpiRacGovtPafCells({
  shareRows = [],
  contractRows = [],
  agreementContractRows = [],
  useAsOfContracts = false,
  contractMetaById = new Map(),
  racOptions = [],
  racIds = [],
  preferSpGovtPafShare = false,
}) {
  const racs = resolveKpiRacChartOptions(racOptions, racIds);
  const racList = racs.length > 0 ? racs : [{ id: "", name: "All" }];
  const cells = [];
  const agreementOptions = { useAsOf: useAsOfContracts, contractMetaById };
  const useAgreements = shouldUseAgreementFinancialSource(agreementContractRows, {
    preferSpGovtPafShare,
  });

  for (const rac of racList) {
    const cmdId = String(rac.id ?? rac.Id ?? "");
    const racLabel = getKpiOptionName(rac) || cmdId || "All";
    if (useAgreements) {
      const racAgreement = cmdId
        ? filterKpiRowsByCmdId(agreementContractRows, cmdId)
        : agreementContractRows;
      const mil = sumGovtPafMilFromAgreementContractRows(racAgreement, agreementOptions);
      cells.push({
        key: cmdId || "all",
        chartLabel: racLabel,
        mil: { govt: mil.govt, paf: mil.paf },
      });
      continue;
    }

    const racShare = cmdId ? filterKpiRowsByCmdId(shareRows, cmdId) : shareRows;
    const racContract = cmdId ? filterKpiRowsByCmdId(contractRows, cmdId) : contractRows;
    const mil = resolveGovtPafMilSources(racShare, racContract, {
      shareOnly: preferSpGovtPafShare,
    });
    cells.push({
      key: cmdId || "all",
      chartLabel: racLabel,
      mil: { govt: mil.govt, paf: mil.paf },
    });
  }

  return cells;
}

function sumScopedIncomePA(shareRows, propertyRows) {
  const fromShare = sumIncomePAFromAllShareRows(shareRows);
  if (fromShare) return fromShare;
  return sumIncomePAFromAllPropertyRows(propertyRows);
}

function sumScopedClassRevenueMil(propertyRows) {
  let sum = 0;
  for (const r of propertyRows || []) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    sum += readNumber(r, ["ClassRevenue_Million", "classRevenue_Million"]) || 0;
  }
  return sum;
}

function sumScopedCollectionsMil(contractRows) {
  let sum = 0;
  for (const r of contractRows || []) {
    if (!isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)) continue;
    const raw =
      readNumber(r, [
        "Receipts",
        "receipts",
        "TotalReceipts",
        "totalReceipts",
        "ReceiptsAmount",
        "receiptsAmount",
        "Collections",
        "collections",
        "TotalCollections",
        "totalCollections",
      ]) || 0;
    if (Number.isFinite(raw)) sum += asOfAmountToMillions(raw);
  }
  return sum;
}

function racCellHasTurnoverData(cell) {
  const govt = coerceChartDataValue(cell?.mil?.govt);
  const paf = coerceChartDataValue(cell?.mil?.paf);
  return (govt != null && govt !== 0) || (paf != null && paf !== 0);
}

function racCellHasDueCollectionsData(cell) {
  const due = coerceChartDataValue(cell?.mil?.incomeDue);
  const collections = coerceChartDataValue(cell?.mil?.collections);
  return (due != null && due !== 0) || (collections != null && collections !== 0);
}

/**
 * Govt and PAF Share per RAC (CmdId).
 * Used by Fiscal Year Shares — Income Turnover RAC Wise chart (stacked bar).
 */
export function buildKpiRacIncomeTurnoverCells({
  shareRows = [],
  contractRows = [],
  racOptions = [],
  racIds = [],
}) {
  return buildKpiRacGovtPafCells({
    shareRows,
    contractRows,
    racOptions,
    racIds,
  }).filter(racCellHasTurnoverData);
}

/**
 * Income due (ClassRevenue) and collections (receipts) per RAC (CmdId).
 * Used by Fiscal Year Shares — Income Due vs Collections RAC Wise chart.
 */
export function buildKpiRacIncomeDueCollectionsCells({
  propertyRows = [],
  contractRows = [],
  racOptions = [],
  racIds = [],
}) {
  const racs = resolveKpiRacChartOptions(racOptions, racIds);
  const racList = racs.length > 0 ? racs : [{ id: "", name: "All" }];
  const cells = [];

  for (const rac of racList) {
    const cmdId = String(rac.id ?? rac.Id ?? "");
    const racLabel = getKpiOptionName(rac) || cmdId || "All";
    const racProperty = cmdId ? filterKpiRowsByCmdId(propertyRows, cmdId) : propertyRows;
    const racContract = cmdId ? filterKpiRowsByCmdId(contractRows, cmdId) : contractRows;
    cells.push({
      key: cmdId || "all",
      chartLabel: racLabel,
      mil: {
        incomeDue: sumScopedClassRevenueMil(racProperty),
        collections: sumScopedCollectionsMil(racContract),
      },
    });
  }

  return cells.filter(racCellHasDueCollectionsData);
}

function racCellHasOutstandingIncomeData(cell) {
  for (const key of KPI_ASSET_CHART_CATEGORY_KEYS) {
    const value = coerceChartDataValue(cell?.mil?.[key]);
    if (value != null && value !== 0) return true;
  }
  return false;
}

/**
 * Outstanding income (ClassRevenue) per RAC with class-wise breakdown.
 * Used by Fiscal Year Shares — Outstanding Income Formation Wise chart.
 */
export function buildKpiRacOutstandingIncomeCells({
  propertyRows = [],
  racOptions = [],
  racIds = [],
}) {
  const racs = resolveKpiRacChartOptions(racOptions, racIds);
  const racList = racs.length > 0 ? racs : [{ id: "", name: "All" }];
  const cells = [];

  for (const rac of racList) {
    const cmdId = String(rac.id ?? rac.Id ?? "");
    const racLabel = getKpiOptionName(rac) || cmdId || "All";
    const racProperty = cmdId ? filterKpiRowsByCmdId(propertyRows, cmdId) : propertyRows;
    const classMil = {};
    let total = 0;

    for (const key of KPI_ASSET_CHART_CATEGORY_KEYS) {
      const meta = PROPERTY_CLASS_STICKERS[key];
      const worth = aggregateByClassIds(racProperty, meta.classIds).worth;
      classMil[key] = worth;
      total += worth;
    }

    cells.push({
      key: cmdId || "all",
      chartLabel: racLabel,
      mil: {
        total,
        ...classMil,
      },
    });
  }

  return cells.filter(racCellHasOutstandingIncomeData);
}

function resolveContractNatureOfBusiness(row, contractMetaById = new Map()) {
  const fromRow = readString(row, ["NatureOfBusiness", "natureOfBusiness"]);
  if (fromRow) return fromRow;

  const id = Number(row?.Id ?? row?.id);
  const meta = Number.isFinite(id) ? contractMetaById?.get?.(id) : null;
  const fromMeta = String(meta?.natureOfBusiness ?? "").trim();
  return fromMeta || "Unspecified";
}

const KPI_GRP_ID_KEYS = ["GrpId", "grpId", "GId", "gId"];

function readContractGrpId(row) {
  return readKpiRowId(row, KPI_GRP_ID_KEYS);
}

function extractPropertyKeysFromGroup(group) {
  const grpId = String(group?.Id ?? group?.id ?? "").trim();
  if (!grpId) return [];

  const linkings = group?.PropertyGroupLinkings ?? group?.propertyGroupLinkings;
  if (Array.isArray(linkings) && linkings.length) {
    const keys = [];
    for (const link of linkings) {
      if (link == null) continue;
      if (typeof link === "number" || typeof link === "string") {
        const n = Number(link);
        if (Number.isFinite(n) && n > 0) keys.push(`prop:${n}`);
        continue;
      }
      const propId = Number(
        link.PropId ?? link.propId ?? link.PropertyId ?? link.propertyId ?? link.Id ?? link.id
      );
      if (Number.isFinite(propId) && propId > 0) keys.push(`prop:${propId}`);
    }
    if (keys.length) return keys;
  }

  const attached = readString(group, [
    "attachedproperties",
    "attachedProperties",
    "AttachedProperties",
    "Property",
    "property",
  ]);
  if (!attached) return [];

  return attached
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((name) => `grp:${grpId}:name:${name}`);
}

/** GrpId → unique property keys linked to that property group. */
export function buildPropertyGroupPropertyKeyLookup(propertyGroups = []) {
  const lookup = new Map();
  for (const group of propertyGroups || []) {
    if (!isActiveNotDeletedPropertyGroup(group)) continue;
    const grpId = readKpiRowId(group, ["Id", "id"]);
    if (!grpId) continue;
    lookup.set(grpId, new Set(extractPropertyKeysFromGroup(group)));
  }
  return lookup;
}

export function formatNatureActivityChartLabel(cell) {
  const base = String(cell?.chartLabel ?? "").trim() || "Unspecified";
  const count = Number(cell?.propertyCount) || 0;
  if (count <= 0) return base;
  const propertyLabel = count === 1 ? "1 property" : `${count.toLocaleString()} properties`;
  return `${base} (${propertyLabel})`;
}

function readContractIncomeMil(row) {
  return (
    asOfAmountToMillions(readNumber(row, MIL_FIELDS.incomePAShare)) ||
    asOfAmountToMillions(readNumber(row, MIL_FIELDS.incomePAProperty)) ||
    asOfAmountToMillions(
      readNumber(row, [
        "RentalValue",
        "rentalValue",
        "CurrRentPA",
        "currRentPA",
        "CurrentRentPA",
        "currentRentPA",
        "InitialRentPA",
        "initialRentPA",
      ])
    )
  );
}

/** Current Rent PA (Mil) — matches /contracts grid "Current Rent PA" (CurrRentPA). */
function readContractCurrentRentPAMil(row) {
  const direct = asOfAmountToMillions(
    readNumber(row, ["CurrRentPA", "currRentPA", "CurrentRentPA", "currentRentPA"])
  );
  if (direct) return direct;
  return 0;
}

/**
 * Overlay as-of calculated fields onto catalog rows (same source as /contracts grid).
 */
function shouldApplyAsOfShareValue(asOfValue, baseValue) {
  if (asOfValue === undefined) return false;
  const asOfNum = Number(asOfValue);
  if (!Number.isFinite(asOfNum)) return asOfValue !== null && asOfValue !== "";
  if (asOfNum !== 0) return true;
  const baseNum = Number(baseValue);
  return !(Number.isFinite(baseNum) && baseNum !== 0);
}

function readFirstDefinedOwn(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  }
  return undefined;
}

/** Share columns sp_GetActiveContractsAsOfDate already expresses in millions. */
const AS_OF_MILLION_SHARE_FIELDS = [
  ["IncomePA_Million", "incomePA_Million"],
  ["GovtShare_Million", "govtShare_Million"],
  ["PAFShare_Million", "pafShare_Million"],
  ["AHQShare_Million", "ahqShare_Million"],
  ["RACShare_Million", "racShare_Million"],
  ["BaseShare_Million", "baseShare_Million"],
];

function assignShareField(next, asOfRow, baseRow, fieldKeys, ...propNames) {
  const asOfValue = readFirstDefinedOwn(asOfRow, fieldKeys);
  if (asOfValue === undefined) return;
  const baseValue = readFirstDefinedOwn(baseRow, fieldKeys);
  if (!shouldApplyAsOfShareValue(asOfValue, baseValue)) return;
  propNames.forEach((name) => {
    next[name] = asOfValue;
  });
}

export function mergeAgreementCatalogWithAsOfOverrides(catalogRows, asOfRows) {
  if (!Array.isArray(catalogRows) || catalogRows.length === 0) return [];
  if (!Array.isArray(asOfRows) || asOfRows.length === 0) return catalogRows;

  const byId = new Map();
  const byContractNo = new Map();
  for (const row of asOfRows) {
    const id = Number(row?.Id ?? row?.id);
    if (Number.isFinite(id)) byId.set(id, row);
    const contractNo = row?.ContractNo ?? row?.contractNo;
    if (contractNo) byContractNo.set(String(contractNo), row);
  }

  return catalogRows.map((row) => {
    const id = Number(row?.Id ?? row?.id);
    const contractNo = row?.ContractNo ?? row?.contractNo;
    const asOfRow =
      (Number.isFinite(id) ? byId.get(id) : null) ||
      (contractNo ? byContractNo.get(String(contractNo)) : null);
    if (!asOfRow) return row;

    const next = { ...row };
    const currRentPA = readNumber(asOfRow, [
      "CurrRentPA",
      "currRentPA",
      "CurrentRentPA",
      "currentRentPA",
    ]);
    if (currRentPA != null) {
      next.CurrRentPA = currRentPA;
      next.currRentPA = currRentPA;
      next.CurrentRentPA = currRentPA;
      next.currentRentPA = currRentPA;
    }

    assignShareField(next, asOfRow, row, MIL_FIELDS.govt, "GovtShare", "govtShare");
    assignShareField(next, asOfRow, row, MIL_FIELDS.paf, "PAFShare", "pafShare");
    assignShareField(next, asOfRow, row, MIL_FIELDS.ahq, "AHQShare", "ahqShare");
    assignShareField(next, asOfRow, row, MIL_FIELDS.rac, "RACShare", "racShare");
    assignShareField(next, asOfRow, row, MIL_FIELDS.base, "BaseShare", "baseShare");

    // The as-of SP converts every share to millions itself; the catalog has no such
    // columns, so carry them across rather than re-deriving them from the raw amounts.
    for (const [pascal, camel] of AS_OF_MILLION_SHARE_FIELDS) {
      const converted = readNumber(asOfRow, [pascal, camel]);
      if (converted != null) {
        next[pascal] = converted;
        next[camel] = converted;
      }
    }

    // Contract state / viability are computed by the as-of SP only; the catalog has no such
    // columns, so downstream active-as-of checks need them carried across.
    const contractState = readString(asOfRow, ["ContractState", "contractState"]);
    if (contractState) {
      next.ContractState = contractState;
      next.contractState = contractState;
    }
    const viability = readString(asOfRow, ["Viability", "viability"]);
    if (viability) {
      next.Viability = viability;
      next.viability = viability;
    }

    return next;
  });
}

/** @deprecated Use mergeAgreementCatalogWithAsOfOverrides */
export function mergeAgreementCatalogWithAsOfCurrentRent(catalogRows, asOfRows) {
  return mergeAgreementCatalogWithAsOfOverrides(catalogRows, asOfRows);
}

function filterCatalogToAsOfActiveScope(catalogRows, asOfRows) {
  if (!Array.isArray(catalogRows) || catalogRows.length === 0) return [];
  if (!Array.isArray(asOfRows) || asOfRows.length === 0) return catalogRows;

  const byId = new Set();
  const byContractNo = new Set();
  for (const row of asOfRows) {
    const id = Number(row?.Id ?? row?.id);
    if (Number.isFinite(id)) byId.add(id);
    const contractNo = row?.ContractNo ?? row?.contractNo;
    if (contractNo) byContractNo.add(String(contractNo));
  }

  return catalogRows.filter((row) => {
    const id = Number(row?.Id ?? row?.id);
    const contractNo = row?.ContractNo ?? row?.contractNo;
    return (
      (Number.isFinite(id) && byId.has(id)) || (contractNo && byContractNo.has(String(contractNo)))
    );
  });
}

/**
 * Agreement rows for PAF Annual Rent — catalog currentRentPA with optional as-of overlay
 * (matches /contracts grid: base catalog + ActiveByAsOfDate merge).
 */
export function buildAgreementContractRowsForCharts({
  catalogRows = [],
  asOfRows = [],
  hasAsOfContext = false,
  contractMetaById = new Map(),
}) {
  const hasAsOfRows = Array.isArray(asOfRows) && asOfRows.length > 0;
  const useAsOfScope = hasAsOfContext || hasAsOfRows;
  const scopedCatalog = useAsOfScope
    ? filterCatalogToAsOfActiveScope(catalogRows, asOfRows)
    : catalogRows;
  const merged = mergeAgreementCatalogWithAsOfOverrides(scopedCatalog, asOfRows);
  const enriched = enrichAsOfContractRowsWithMeta(merged, contractMetaById);
  const rows = enriched.filter((row) => isAgreementChartContractRow(row, { useAsOfScope }));
  return {
    rows,
    useAsOf: useAsOfScope,
  };
}

function isTerminatedOrVacantAgreementRow(row) {
  const st = String(
    row?.ContractState ?? row?.contractState ?? row?.ContractStatus ?? row?.contractStatus ?? ""
  )
    .trim()
    .toLowerCase();
  if (!st) return false;
  return (
    st.includes("terminat") || st.includes("expired") || st.includes("vacant") || st === "closed"
  );
}

/** Active agreement rows for financial charts — matches /contracts grid active + as-of scope. */
function isAgreementChartContractRow(row, { useAsOfScope = false } = {}) {
  if (!isActiveCatalogContractRow(row)) return false;
  if (useAsOfScope && isTerminatedOrVacantAgreementRow(row)) return false;
  return true;
}

function isActiveCatalogContractRow(row) {
  const deleted = row?.IsDeleted ?? row?.isDeleted;
  if (deleted === true || deleted === 1 || deleted === "1") return false;
  const archived = row?.IsArchive ?? row?.isArchive;
  if (archived === true || archived === 1 || archived === "1") return false;
  const status = row?.Status ?? row?.status;
  if (status === 0 || status === false || status === "0") return false;
  return true;
}

function natureCellHasIncomeData(cell) {
  const income = coerceChartDataValue(cell?.mil?.income);
  return income != null && income !== 0;
}

/**
 * Income per Nature of Business from active as-of contracts (preferred) or catalog contracts.
 * Used by Fiscal Year Shares — Nature of Activity Wise Income chart.
 */
export function buildKpiNatureOfBusinessIncomeCells({
  asOfContractRows = [],
  contractCatalogRows = [],
  contractMetaById = new Map(),
  propertyGroups = [],
  racIds = [],
  baseIds = [],
}) {
  const useAsOf = Array.isArray(asOfContractRows) && asOfContractRows.length > 0;
  const sourceRows = useAsOf ? asOfContractRows : contractCatalogRows;
  const filtered = filterKpiRowsByRacBase(sourceRows || [], racIds, baseIds);
  const groupPropertyLookup = buildPropertyGroupPropertyKeyLookup(propertyGroups);
  const byNature = new Map();

  for (const row of filtered) {
    if (!useAsOf && !isActiveCatalogContractRow(row)) continue;

    const nature = resolveContractNatureOfBusiness(row, contractMetaById);
    const income = readContractIncomeMil(row);
    if (!income) continue;

    const entry = byNature.get(nature) || {
      key: nature,
      chartLabel: nature,
      mil: { income: 0 },
      contractCount: 0,
      propertyKeys: new Set(),
    };
    entry.mil.income += income;
    entry.contractCount += 1;

    const grpId = readContractGrpId(row);
    const propertyKeys = grpId ? groupPropertyLookup.get(String(grpId)) : null;
    if (propertyKeys?.size) {
      propertyKeys.forEach((key) => entry.propertyKeys.add(key));
    }

    byNature.set(nature, entry);
  }

  return [...byNature.values()]
    .filter(natureCellHasIncomeData)
    .map(({ propertyKeys, ...entry }) => ({
      ...entry,
      propertyCount: propertyKeys?.size ?? 0,
    }))
    .sort((a, b) => (b.mil?.income || 0) - (a.mil?.income || 0));
}

function filterKpiRowsByBaseId(rows, baseId) {
  const id = String(baseId ?? "");
  if (!id) return rows || [];
  return (rows || []).filter((row) => readKpiRowId(row, KPI_BASE_ID_KEYS) === id);
}

function resolveKpiBaseChartOptions(baseOptions, allBases, racCmdId) {
  const source = (Array.isArray(allBases) && allBases.length ? allBases : baseOptions) || [];
  const racId = String(racCmdId ?? "");
  if (!racId) return source;
  return source.filter((base) => String(base.cmd ?? base.CmdId ?? base.cmdId) === racId);
}

/**
 * Govt / PAF mil per Base within a RAC (CmdId).
 * Used when drilling from RAC-level Govt & PAF bar chart.
 */
export function buildKpiBaseGovtPafCells({
  shareRows = [],
  contractRows = [],
  agreementContractRows = [],
  useAsOfContracts = false,
  contractMetaById = new Map(),
  baseOptions = [],
  allBases = [],
  racCmdId,
  preferSpGovtPafShare = false,
}) {
  const catalogBases = resolveKpiBaseChartOptions(baseOptions, allBases, racCmdId);
  const labelLookups = buildKpiOptionLookups([
    ...(allBases || []),
    ...(baseOptions || []),
    ...catalogBases,
  ]);
  const agreementOptions = { useAsOf: useAsOfContracts, contractMetaById };
  const useAgreements = shouldUseAgreementFinancialSource(agreementContractRows, {
    preferSpGovtPafShare,
  });
  const racAgreement = racCmdId
    ? filterKpiRowsByCmdId(agreementContractRows, racCmdId)
    : agreementContractRows;

  if (useAgreements) {
    const agreementPartition = partitionKpiRowsByBaseId(racAgreement);
    const orderedBaseIds = [];
    const seenBaseIds = new Set();
    const pushBaseId = (baseId) => {
      const id = String(baseId ?? "").trim();
      if (!id || seenBaseIds.has(id)) return;
      seenBaseIds.add(id);
      orderedBaseIds.push(id);
    };

    catalogBases.forEach((base) => pushBaseId(base.id ?? base.Id));
    agreementPartition.byBase.forEach((_, baseId) => pushBaseId(baseId));

    const cells = orderedBaseIds.map((baseId) => {
      const baseRows = filterKpiRowsByBaseId(racAgreement, baseId);
      const mil = sumGovtPafMilFromAgreementContractRows(baseRows, agreementOptions);
      return {
        key: baseId,
        chartLabel: resolveKpiBaseLabel(baseId, catalogBases, labelLookups),
        mil,
      };
    });

    if (cells.length === 0) {
      cells.push({
        key: "all",
        chartLabel: "All",
        mil: sumGovtPafMilFromAgreementContractRows(racAgreement, agreementOptions),
      });
    }

    const unassignedMil = sumGovtPafMilFromAgreementContractRows(
      agreementPartition.unassigned,
      agreementOptions
    );
    if (unassignedMil.govt !== 0 || unassignedMil.paf !== 0) {
      cells.push({
        key: KPI_GOVT_PAF_UNASSIGNED_BASE_KEY,
        chartLabel: "Unassigned",
        mil: unassignedMil,
      });
    }

    return cells;
  }

  const racShare = racCmdId ? filterKpiRowsByCmdId(shareRows, racCmdId) : shareRows;
  const racContract = racCmdId ? filterKpiRowsByCmdId(contractRows, racCmdId) : contractRows;
  const sources = resolveGovtPafMilSources(racShare, racContract, {
    shareOnly: preferSpGovtPafShare,
  });

  const govtPartitionRows = sources.govtSource === "share" ? racShare : racContract;
  const pafPartitionRows = sources.pafSource === "share" ? racShare : racContract;
  const govtPartition = partitionKpiRowsByBaseId(govtPartitionRows);
  const pafPartition = partitionKpiRowsByBaseId(pafPartitionRows);

  const orderedBaseIds = [];
  const seenBaseIds = new Set();
  const pushBaseId = (baseId) => {
    const id = String(baseId ?? "").trim();
    if (!id || seenBaseIds.has(id)) return;
    seenBaseIds.add(id);
    orderedBaseIds.push(id);
  };

  catalogBases.forEach((base) => pushBaseId(base.id ?? base.Id));
  govtPartition.byBase.forEach((_, baseId) => pushBaseId(baseId));
  pafPartition.byBase.forEach((_, baseId) => pushBaseId(baseId));

  const cells = orderedBaseIds.map((baseId) =>
    buildKpiBaseGovtPafCell(
      baseId,
      resolveKpiBaseLabel(baseId, catalogBases, labelLookups),
      racShare,
      racContract,
      sources
    )
  );

  if (cells.length === 0) {
    cells.push({
      key: "all",
      chartLabel: "All",
      mil: { govt: sources.govt, paf: sources.paf },
    });
  }

  const unassignedMil = buildGovtPafMilForScopedRows(
    partitionKpiRowsByBaseId(racShare).unassigned,
    partitionKpiRowsByBaseId(racContract).unassigned,
    sources
  );

  if (unassignedMil.govt !== 0 || unassignedMil.paf !== 0) {
    cells.push({
      key: KPI_GOVT_PAF_UNASSIGNED_BASE_KEY,
      chartLabel: "Unassigned",
      mil: unassignedMil,
    });
  }

  return cells;
}

/**
 * Govt / PAF mil per land category within a Base (and RAC).
 * Used when drilling from Base-level Govt & PAF bar chart.
 */
export function buildKpiBaseCategoryGovtPafCells({
  shareRows = [],
  propertyRows = [],
  contractRows = [],
  agreementContractRows = [],
  useAsOfContracts = false,
  contractMetaById = new Map(),
  racCmdId,
  baseId,
  categoryKeys,
  preferSpGovtPafShare = false,
}) {
  const keys =
    Array.isArray(categoryKeys) && categoryKeys.length
      ? categoryKeys
      : KPI_ASSET_CHART_CATEGORY_KEYS;
  let scopedShare = shareRows || [];
  let scopedProperty = propertyRows || [];
  let scopedContract = contractRows || [];
  let scopedAgreement = agreementContractRows || [];

  if (racCmdId) {
    scopedShare = filterKpiRowsByCmdId(scopedShare, racCmdId);
    scopedProperty = filterKpiRowsByCmdId(scopedProperty, racCmdId);
    scopedContract = filterKpiRowsByCmdId(scopedContract, racCmdId);
    scopedAgreement = filterKpiRowsByCmdId(scopedAgreement, racCmdId);
  }
  if (baseId) {
    scopedShare = filterKpiRowsByBaseId(scopedShare, baseId);
    scopedProperty = filterKpiRowsByBaseId(scopedProperty, baseId);
    scopedContract = filterKpiRowsByBaseId(scopedContract, baseId);
    scopedAgreement = filterKpiRowsByBaseId(scopedAgreement, baseId);
  }

  const agreementOptions = { useAsOf: useAsOfContracts, contractMetaById };
  const useAgreements = shouldUseAgreementFinancialSource(agreementContractRows, {
    preferSpGovtPafShare,
  });

  const cells = [];
  for (const key of keys) {
    const meta = PROPERTY_CLASS_STICKERS[key];
    if (!meta) continue;
    const catLabel = groupedAssetRowLabel(key) || meta.label;
    const mil = useAgreements
      ? buildMilFromContractRows(scopedAgreement, meta.classIds, contractMetaById, {
          activeOnly: !useAsOfContracts,
        })
      : preferSpGovtPafShare
      ? normalizeBalancedShareMil({
          govt: sumSpShareMilByPropertyClassIds(scopedShare, meta.classIds, "govt"),
          paf: sumSpShareMilByPropertyClassIds(scopedShare, meta.classIds, "paf"),
        })
      : buildMilForCategory(scopedShare, scopedProperty, meta.classIds, scopedContract);
    cells.push({
      key,
      chartLabel: catLabel,
      mil: { govt: mil.govt, paf: mil.paf },
    });
  }

  return cells;
}

export const KPI_FINANCIAL_DRILL_RAC = "rac";
export const KPI_FINANCIAL_DRILL_BASE = "base";
export const KPI_FINANCIAL_DRILL_CATEGORY = "category";
export const KPI_FINANCIAL_DRILL_INITIAL = { level: KPI_FINANCIAL_DRILL_RAC };

export const KPI_PAF_ANNUAL_RENT_METRIC = {
  id: "pafAnnualRent",
  datasetLabel: "Current Rent PA",
};

export const KPI_GOVT_SHARE_METRIC = {
  id: "govtShare",
  datasetLabel: "Govt Share",
};

function sumFinancialMetricForScope(
  metricId,
  shareRows,
  propertyRows,
  contractRows,
  agreementContractRows,
  agreementOptions,
  useAgreementContracts = false,
  preferSpGovtPafShare = false
) {
  if (metricId === KPI_PAF_ANNUAL_RENT_METRIC.id) {
    if (useAgreementContracts) {
      return sumIncomeFromAgreementContractRows(agreementContractRows, agreementOptions);
    }
    return sumScopedIncomePA(shareRows, propertyRows);
  }
  if (metricId === KPI_GOVT_SHARE_METRIC.id) {
    if (useAgreementContracts) {
      return sumGovtShareFromAgreementContractRows(agreementContractRows, agreementOptions);
    }
    return resolveGovtPafMilSources(shareRows, contractRows, { shareOnly: preferSpGovtPafShare })
      .govt;
  }
  return 0;
}

function sumFinancialMetricForBaseScope(
  metricId,
  baseShare,
  baseProperty,
  baseContract,
  govtPafSources,
  agreementContractRows,
  agreementOptions,
  useAgreementContracts = false,
  preferSpGovtPafShare = false
) {
  if (metricId === KPI_PAF_ANNUAL_RENT_METRIC.id) {
    if (useAgreementContracts) {
      return sumIncomeFromAgreementContractRows(agreementContractRows, agreementOptions);
    }
    return sumScopedIncomePA(baseShare, baseProperty);
  }
  if (metricId === KPI_GOVT_SHARE_METRIC.id) {
    if (useAgreementContracts) {
      return sumGovtShareFromAgreementContractRows(agreementContractRows, agreementOptions);
    }
    if (!govtPafSources) return 0;
    return buildGovtPafMilForScopedRows(baseShare, baseContract, govtPafSources).govt;
  }
  return 0;
}

function extractFinancialMetricFromMil(metricId, mil) {
  if (metricId === KPI_PAF_ANNUAL_RENT_METRIC.id) {
    return mil?.incomePA || 0;
  }
  if (metricId === KPI_GOVT_SHARE_METRIC.id) {
    return mil?.govt || 0;
  }
  return 0;
}

export function scaleFinancialMetricCellsByTenure(cells, tenure) {
  return (cells || []).map((cell) => ({
    ...cell,
    value: scaleKpiAmountByTenure(cell.value, tenure),
  }));
}

/** RAC-level cells for PAF Annual Rent / Govt Share drill-down charts. */
export function buildKpiRacFinancialMetricCells({
  metricId,
  shareRows = [],
  propertyRows = [],
  contractRows = [],
  agreementContractRows = [],
  useAsOfContracts = false,
  contractMetaById = new Map(),
  racOptions = [],
  racIds = [],
  preferSpGovtPafShare = false,
}) {
  const racs = resolveKpiRacChartOptions(racOptions, racIds);
  const racList = racs.length > 0 ? racs : [{ id: "", name: "All" }];
  const cells = [];
  const useAgreementContracts = shouldUseAgreementFinancialSource(agreementContractRows, {
    preferSpGovtPafShare,
  });
  const agreementOptions = {
    useAsOf: useAsOfContracts,
    contractMetaById,
    ahqApprovedOnly: metricId === KPI_GOVT_SHARE_METRIC.id,
  };

  for (const rac of racList) {
    const cmdId = String(rac.id ?? rac.Id ?? "");
    const racLabel = getKpiOptionName(rac) || cmdId || "All";
    const racShare = cmdId ? filterKpiRowsByCmdId(shareRows, cmdId) : shareRows;
    const racProperty = cmdId ? filterKpiRowsByCmdId(propertyRows, cmdId) : propertyRows;
    const racContract = cmdId ? filterKpiRowsByCmdId(contractRows, cmdId) : contractRows;
    const racAgreement = cmdId
      ? filterKpiRowsByCmdId(agreementContractRows, cmdId)
      : agreementContractRows;
    cells.push({
      key: cmdId || "all",
      chartLabel: racLabel,
      value: sumFinancialMetricForScope(
        metricId,
        racShare,
        racProperty,
        racContract,
        useAgreementContracts ? racAgreement : [],
        agreementOptions,
        useAgreementContracts,
        preferSpGovtPafShare
      ),
    });
  }

  return cells;
}

/** Base-level cells within a RAC for financial metric drill-down. */
export function buildKpiBaseFinancialMetricCells({
  metricId,
  shareRows = [],
  propertyRows = [],
  contractRows = [],
  agreementContractRows = [],
  useAsOfContracts = false,
  contractMetaById = new Map(),
  baseOptions = [],
  allBases = [],
  racCmdId,
  preferSpGovtPafShare = false,
}) {
  const catalogBases = resolveKpiBaseChartOptions(baseOptions, allBases, racCmdId);
  const labelLookups = buildKpiOptionLookups([
    ...(allBases || []),
    ...(baseOptions || []),
    ...catalogBases,
  ]);
  const racShare = racCmdId ? filterKpiRowsByCmdId(shareRows, racCmdId) : shareRows;
  const racProperty = racCmdId ? filterKpiRowsByCmdId(propertyRows, racCmdId) : propertyRows;
  const racContract = racCmdId ? filterKpiRowsByCmdId(contractRows, racCmdId) : contractRows;
  const racAgreement = racCmdId
    ? filterKpiRowsByCmdId(agreementContractRows, racCmdId)
    : agreementContractRows;
  const useAgreementContracts = shouldUseAgreementFinancialSource(agreementContractRows, {
    preferSpGovtPafShare,
  });
  const agreementOptions = {
    useAsOf: useAsOfContracts,
    contractMetaById,
    ahqApprovedOnly: metricId === KPI_GOVT_SHARE_METRIC.id,
  };
  const govtPafSources =
    metricId === KPI_GOVT_SHARE_METRIC.id && !useAgreementContracts
      ? resolveGovtPafMilSources(racShare, racContract, { shareOnly: preferSpGovtPafShare })
      : null;

  const orderedBaseIds = [];
  const seenBaseIds = new Set();
  const pushBaseId = (baseId) => {
    const id = String(baseId ?? "").trim();
    if (!id || seenBaseIds.has(id)) return;
    seenBaseIds.add(id);
    orderedBaseIds.push(id);
  };

  catalogBases.forEach((base) => pushBaseId(base.id ?? base.Id));
  partitionKpiRowsByBaseId(racShare).byBase.forEach((_, baseId) => pushBaseId(baseId));
  partitionKpiRowsByBaseId(racProperty).byBase.forEach((_, baseId) => pushBaseId(baseId));
  if (useAgreementContracts) {
    partitionKpiRowsByBaseId(racAgreement).byBase.forEach((_, baseId) => pushBaseId(baseId));
  }
  if (govtPafSources) {
    const partitionRows =
      govtPafSources.govtSource === "share"
        ? partitionKpiRowsByBaseId(racShare).byBase
        : partitionKpiRowsByBaseId(racContract).byBase;
    partitionRows.forEach((_, baseId) => pushBaseId(baseId));
  }

  const cells = orderedBaseIds.map((baseId) => {
    const baseShare = filterKpiRowsByBaseId(racShare, baseId);
    const baseProperty = filterKpiRowsByBaseId(racProperty, baseId);
    const baseContract = filterKpiRowsByBaseId(racContract, baseId);
    const baseAgreement = filterKpiRowsByBaseId(racAgreement, baseId);
    return {
      key: baseId,
      chartLabel: resolveKpiBaseLabel(baseId, catalogBases, labelLookups),
      value: sumFinancialMetricForBaseScope(
        metricId,
        baseShare,
        baseProperty,
        baseContract,
        govtPafSources,
        useAgreementContracts ? baseAgreement : [],
        agreementOptions,
        useAgreementContracts,
        preferSpGovtPafShare
      ),
    };
  });

  if (cells.length === 0) {
    cells.push({
      key: "all",
      chartLabel: "All",
      value: sumFinancialMetricForScope(
        metricId,
        racShare,
        racProperty,
        racContract,
        useAgreementContracts ? racAgreement : [],
        agreementOptions,
        useAgreementContracts,
        preferSpGovtPafShare
      ),
    });
  }

  const unassignedShare = partitionKpiRowsByBaseId(racShare).unassigned;
  const unassignedProperty = partitionKpiRowsByBaseId(racProperty).unassigned;
  const unassignedContract = partitionKpiRowsByBaseId(racContract).unassigned;
  const unassignedAgreement = partitionKpiRowsByBaseId(racAgreement).unassigned;
  const unassignedValue = sumFinancialMetricForBaseScope(
    metricId,
    unassignedShare,
    unassignedProperty,
    unassignedContract,
    govtPafSources,
    useAgreementContracts ? unassignedAgreement : [],
    agreementOptions,
    useAgreementContracts,
    preferSpGovtPafShare
  );

  if (unassignedValue !== 0) {
    cells.push({
      key: KPI_GOVT_PAF_UNASSIGNED_BASE_KEY,
      chartLabel: "Unassigned",
      value: unassignedValue,
    });
  }

  return cells;
}

/** Land-category cells within a base for financial metric drill-down. */
export function buildKpiBaseCategoryFinancialMetricCells({
  metricId,
  shareRows = [],
  propertyRows = [],
  contractRows = [],
  agreementContractRows = [],
  useAsOfContracts = false,
  contractMetaById = new Map(),
  racCmdId,
  baseId,
  categoryKeys,
  preferSpGovtPafShare = false,
}) {
  const keys =
    Array.isArray(categoryKeys) && categoryKeys.length
      ? categoryKeys
      : KPI_ASSET_CHART_CATEGORY_KEYS;
  let scopedShare = shareRows || [];
  let scopedProperty = propertyRows || [];
  let scopedContract = contractRows || [];
  let scopedAgreement = agreementContractRows || [];

  if (racCmdId) {
    scopedShare = filterKpiRowsByCmdId(scopedShare, racCmdId);
    scopedProperty = filterKpiRowsByCmdId(scopedProperty, racCmdId);
    scopedContract = filterKpiRowsByCmdId(scopedContract, racCmdId);
    scopedAgreement = filterKpiRowsByCmdId(scopedAgreement, racCmdId);
  }
  if (baseId) {
    scopedShare = filterKpiRowsByBaseId(scopedShare, baseId);
    scopedProperty = filterKpiRowsByBaseId(scopedProperty, baseId);
    scopedContract = filterKpiRowsByBaseId(scopedContract, baseId);
    scopedAgreement = filterKpiRowsByBaseId(scopedAgreement, baseId);
  }

  const useAgreementContracts = shouldUseAgreementFinancialSource(agreementContractRows, {
    preferSpGovtPafShare,
  });
  const agreementOptions = {
    useAsOf: useAsOfContracts,
    contractMetaById,
    ahqApprovedOnly: metricId === KPI_GOVT_SHARE_METRIC.id,
  };

  const cells = [];
  for (const key of keys) {
    const meta = PROPERTY_CLASS_STICKERS[key];
    if (!meta) continue;
    const catLabel = groupedAssetRowLabel(key) || meta.label;
    let value;
    if (useAgreementContracts) {
      if (metricId === KPI_PAF_ANNUAL_RENT_METRIC.id) {
        value = sumIncomeFromAgreementContractRows(scopedAgreement, {
          ...agreementOptions,
          classIds: meta.classIds,
        });
      } else {
        value = sumGovtShareFromAgreementContractRows(scopedAgreement, {
          ...agreementOptions,
          classIds: meta.classIds,
        });
      }
    } else if (preferSpGovtPafShare) {
      if (metricId === KPI_PAF_ANNUAL_RENT_METRIC.id) {
        value = sumSpShareMilByPropertyClassIds(scopedShare, meta.classIds, "incomePA");
      } else if (metricId === KPI_GOVT_SHARE_METRIC.id) {
        value = sumSpShareMilByPropertyClassIds(scopedShare, meta.classIds, "govt");
      } else {
        value = 0;
      }
    } else {
      const mil = buildMilForCategory(scopedShare, scopedProperty, meta.classIds, scopedContract);
      value = extractFinancialMetricFromMil(metricId, mil);
    }
    cells.push({
      key,
      chartLabel: catLabel,
      value,
    });
  }

  return cells;
}

export function buildFinancialMetricBarChart(cells, datasetLabel) {
  return {
    labels: (cells || []).map((cell) => cell.chartLabel),
    datasets: {
      label: datasetLabel,
      data: (cells || []).map((cell) => cell.value),
    },
  };
}

const OUTSTANDING_RENTS_STICKER_ORDER = ["categoryA", "categoryB", "categoryC", "bts", "hb"];

/** Outstanding rent (ClassRevenue_Million) per property category for Contracts tab stickers. */
export function buildOutstandingRentsStickers(propertyRows) {
  return OUTSTANDING_RENTS_STICKER_ORDER.map((key) => {
    const meta = PROPERTY_CLASS_STICKERS[key];
    const agg = aggregateByClassIds(propertyRows, meta.classIds);
    return {
      id: key,
      label: groupedAssetRowLabel(key) || meta.label,
      value: agg.worth,
    };
  });
}

/** GovtPAFShare ClassId values (aligned with summary dashboard). */
export const SHARE_DISTRIBUTION_CLASS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "1", label: "A" },
  { value: "2", label: "B" },
  { value: "3", label: "C" },
  { value: "5", label: "HB" },
  { value: "4", label: "BTS" },
];

export function getFiscalYears(count = 4) {
  const y = new Date().getFullYear();
  return Array.from({ length: count }, (_, i) => y - (count - 1 - i));
}

/** April–March FY: FY starts in April of `startYear` (e.g. 2026 → FY 2026-27). */
export function getCurrentFiscalStartYear(d = new Date()) {
  const calY = d.getFullYear();
  const m = d.getMonth();
  return m >= 3 ? calY : calY - 1;
}

/**
 * Current fiscal year plus prior (count - 1) years, oldest → newest.
 * Each item: { startYear, fieldKey: "fy2026", headerLabel: "FY 2026-27" }.
 */
export function getFiscalYearPeriods(count = 6) {
  const currentStart = getCurrentFiscalStartYear();
  const periods = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const startYear = currentStart - i;
    const endShort = String(startYear + 1).slice(-2);
    periods.push({
      startYear,
      fieldKey: `fy${startYear}`,
      headerLabel: `FY ${startYear}-${endShort}`,
    });
  }
  return periods;
}

function sumIncomePAFromAllShareRows(shareRows) {
  if (!Array.isArray(shareRows)) return 0;
  let sum = 0;
  for (const r of shareRows) {
    if (!isGovtPafShareDataRow(r)) continue;
    sum += readNumber(r, MIL_FIELDS.incomePAShare) || 0;
  }
  return sum;
}

function sumIncomePAFromAllPropertyRows(propertyRows) {
  if (!Array.isArray(propertyRows)) return 0;
  let sum = 0;
  for (const r of propertyRows) {
    if (!isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)) continue;
    sum += readNumber(r, MIL_FIELDS.incomePAProperty) || 0;
  }
  return sum;
}

function sumContractsField(contractRows, fieldKeys) {
  if (!Array.isArray(contractRows)) return 0;
  let sum = 0;
  for (const r of contractRows) {
    if (!isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)) continue;
    sum += readNumber(r, fieldKeys) || 0;
  }
  return sum;
}

/** Fiscal KPI grid: static revenue/share/receipts rows only (FY columns). */
export function buildFiscalKpiGridRows(propertyRows, contractRows, shareRows, fiscalPeriods) {
  const periods =
    Array.isArray(fiscalPeriods) && fiscalPeriods.length ? fiscalPeriods : getFiscalYearPeriods(6);
  const shares = buildFinancialShares(shareRows);
  const shareMap = Object.fromEntries(shares.map((s) => [s.id, s.value]));

  const incomeBase =
    sumIncomePAFromAllShareRows(shareRows) || sumIncomePAFromAllPropertyRows(propertyRows);

  const receiptsBase = sumContractsField(contractRows, [
    "Receipts",
    "receipts",
    "TotalReceipts",
    "totalReceipts",
    "ReceiptsAmount",
    "receiptsAmount",
  ]);
  const paymentsBase = sumContractsField(contractRows, [
    "Payments",
    "payments",
    "TotalPayments",
    "totalPayments",
    "PaymentsAmount",
    "paymentsAmount",
  ]);

  const fmtMil = (v) => Math.round(v * 100) / 100;
  const fmtInt = (v) => Math.round(v);

  const makeRow = (id, kpiName, baseValue, formatter = fmtMil) => {
    const row = { id, kpiName };
    periods.forEach((p, idx) => {
      const factor = 0.82 + idx * 0.03;
      const raw = Number(baseValue) * factor;
      row[p.fieldKey] = formatter(Number.isFinite(raw) ? raw : 0);
    });
    return row;
  };

  const makeDashRow = (id, kpiName) => {
    const row = { id, kpiName };
    periods.forEach((p) => {
      row[p.fieldKey] = "—";
    });
    return row;
  };

  return [
    makeDashRow("rev-rates-fy", "Revenue Rates FY"),
    makeRow("fiscal-income", "Income", incomeBase, fmtMil),
    makeRow("fiscal-govt", "Govt Share", shareMap.govt || 0, fmtMil),
    makeRow("fiscal-paf", "PAF Share", shareMap.paf || 0, fmtMil),
    makeRow("fiscal-ahq", "AHQ Share", shareMap.ahq || 0, fmtMil),
    makeRow("fiscal-rac", "RAC Share", shareMap.rac || 0, fmtMil),
    makeRow("fiscal-base", "Base Share", shareMap.base || 0, fmtMil),
    makeRow("fiscal-receipts", "Receipts", receiptsBase, fmtInt),
    makeRow("fiscal-payments", "Payments", paymentsBase, fmtInt),
  ];
}

export function buildPropertySummaryApiPath(asOfDate) {
  const trimmed = String(asOfDate ?? "").trim();
  if (!trimmed) return "/api/Dashboards/property-summary";
  const params = new URLSearchParams({ asOfDate: trimmed });
  return `/api/Dashboards/property-summary?${params.toString()}`;
}

/** Convert as-of contract amounts (often raw PKR) to dashboard millions. */
export function asOfAmountToMillions(value) {
  const n = coerceChartDataValue(value);
  if (n == null) return 0;
  if (Math.abs(n) < 1000) return n;
  return n / 1_000_000;
}

function readAsOfContractState(row) {
  return String(readString(row, ["ContractState", "contractState"]) || "")
    .trim()
    .toLowerCase();
}

function readAsOfViability(row) {
  return String(readString(row, ["Viability", "viability", "Feasible", "feasible"]) || "")
    .trim()
    .toLowerCase();
}

function accumulateAsOfStickerMetrics(bucket, row) {
  const worth =
    asOfAmountToMillions(readNumber(row, ["RentalValue", "rentalValue"])) ||
    asOfAmountToMillions(
      readNumber(row, ["CurrRentPA", "currRentPA", "CurrentRentPA", "currentRentPA"])
    ) ||
    asOfAmountToMillions(readNumber(row, MIL_FIELDS.paf));
  bucket.count += 1;
  if (Number.isFinite(worth)) bucket.worth += worth;
}

/** Contract Health stickers from ActiveByAsOfDate rows (Contracts tab). */
export function buildContractHealthFromAsOfContracts(asOfRows) {
  const active = emptyContractStickerMetrics();
  const premature = emptyContractStickerMetrics();
  const expiring = emptyContractStickerMetrics();
  const terminated = emptyContractStickerMetrics();
  const vacant = emptyContractStickerMetrics();

  for (const row of asOfRows || []) {
    const state = readAsOfContractState(row);
    if (state === "valid" || state === "active") accumulateAsOfStickerMetrics(active, row);
    else if (state === "pre-mature" || state === "premature")
      accumulateAsOfStickerMetrics(premature, row);
    else if (state === "expiring") accumulateAsOfStickerMetrics(expiring, row);
    else if (state === "terminated" || state === "expired")
      accumulateAsOfStickerMetrics(terminated, row);
    else if (state === "vacant") accumulateAsOfStickerMetrics(vacant, row);
    else accumulateAsOfStickerMetrics(active, row);
  }

  return { active, premature, expiring, terminated, vacant };
}

/** Contract Status stickers from ActiveByAsOfDate rows. */
export function buildContractStatusFromAsOfContracts(asOfRows) {
  const viable = emptyContractStickerMetrics();
  const unviable = emptyContractStickerMetrics();
  const active = emptyContractStickerMetrics();
  const inactive = emptyContractStickerMetrics();

  for (const row of asOfRows || []) {
    const viability = readAsOfViability(row);
    const state = readAsOfContractState(row);
    const isInactive = state === "terminated" || state === "expired";

    if (viability === "viable" || viability === "yes" || viability === "true") {
      accumulateAsOfStickerMetrics(viable, row);
    } else if (viability === "unviable" || viability === "no" || viability === "false") {
      accumulateAsOfStickerMetrics(unviable, row);
    }

    if (isInactive) accumulateAsOfStickerMetrics(inactive, row);
    else accumulateAsOfStickerMetrics(active, row);
  }

  return { viable, unviable, active, inactive };
}

function resolveAsOfContractClassId(row, contractMetaById) {
  const id = Number(row?.Id ?? row?.id);
  const meta = Number.isFinite(id) ? contractMetaById?.get?.(id) : null;
  const classId = Number(row?.ClassId ?? row?.classId ?? meta?.classId);
  return Number.isFinite(classId) ? classId : null;
}

function resolveAsOfContractCmdId(row, contractMetaById) {
  const id = Number(row?.Id ?? row?.id);
  const meta = Number.isFinite(id) ? contractMetaById?.get?.(id) : null;
  const cmdId = row?.CmdId ?? row?.cmdId ?? meta?.cmdId;
  return cmdId != null && cmdId !== "" ? String(cmdId) : "";
}

function resolveAsOfContractBaseId(row, contractMetaById) {
  const id = Number(row?.Id ?? row?.id);
  const meta = Number.isFinite(id) ? contractMetaById?.get?.(id) : null;
  const baseId = row?.BaseId ?? row?.baseId ?? meta?.baseId;
  return baseId != null && baseId !== "" ? String(baseId) : "";
}

/** Sum Current Rent PA (Mil) from /contracts agreement rows for PAF Annual Rent chart. */
function sumIncomeFromAgreementContractRows(
  contractRows,
  { useAsOf = false, classIds, contractMetaById = new Map() } = {}
) {
  const idSet = Array.isArray(classIds) && classIds.length ? new Set(classIds.map(Number)) : null;
  let sum = 0;

  for (const row of contractRows || []) {
    if (!useAsOf && !isActiveCatalogContractRow(row)) continue;
    if (idSet) {
      const classId = resolveAsOfContractClassId(row, contractMetaById);
      if (classId == null || !idSet.has(classId)) continue;
    }
    sum += readContractCurrentRentPAMil(row);
  }

  return sum;
}

function readContractShareMil(row, fieldKeys) {
  return asOfAmountToMillions(readNumber(row, fieldKeys));
}

/**
 * Share amount in millions, preferring the `*_Million` column that
 * sp_GetActiveContractsAsOfDate already converted. Only rows from an older backend fall
 * back to asOfAmountToMillions, whose per-value magnitude test can pick different units
 * for the Govt/PAF/AHQ/RAC/Base columns of one contract and unbalance the split.
 */
function readAgreementShareMil(row, millionKeys, rawKeys) {
  const converted = readNumber(row, millionKeys);
  if (converted != null) return coerceChartDataValue(converted) ?? 0;
  return asOfAmountToMillions(readNumber(row, rawKeys));
}

/** Govt Share (Mil) — matches /contracts grid GovtShare column. */
function readAgreementGovtShareMil(row) {
  return readAgreementShareMil(
    row,
    ["GovtShare_Million", "govtShare_Million"],
    ["GovtShare", "govtShare"]
  );
}

/** PAF Share (Mil) — matches /contracts grid PAFShare column. */
function readAgreementPafShareMil(row) {
  return readAgreementShareMil(
    row,
    ["PAFShare_Million", "pafShare_Million"],
    ["PAFShare", "pafShare"]
  );
}

/** AHQ Share (Mil) — matches /contracts grid AHQShare column (as-of calculated). */
function readAgreementAhqShareMil(row) {
  return readAgreementShareMil(
    row,
    ["AHQShare_Million", "ahqShare_Million"],
    ["AHQShare", "ahqShare"]
  );
}

/** RAC Share (Mil) — matches /contracts grid RACShare column (as-of calculated). */
function readAgreementRacShareMil(row) {
  return readAgreementShareMil(
    row,
    ["RACShare_Million", "racShare_Million"],
    ["RACShare", "racShare"]
  );
}

/** Base Share (Mil) — matches /contracts grid BaseShare column (as-of calculated). */
function readAgreementBaseShareMil(row) {
  return readAgreementShareMil(
    row,
    ["BaseShare_Million", "baseShare_Million"],
    ["BaseShare", "baseShare"]
  );
}

/**
 * Matches /contracts grid VALID toggle: ContractState Valid/Active as of the applied date.
 * Rows without a state (catalog rows when no as-of payload merged) are kept.
 */
function isValidStateAgreementRow(row) {
  const st = String(
    row?.ContractState ?? row?.contractState ?? row?.ContractStatus ?? row?.contractStatus ?? ""
  )
    .trim()
    .toLowerCase();
  if (!st) return true;
  return st === "valid" || st === "active";
}

/** Matches /contracts grid AHQ approval filter (APPROVED toggle). */
function isAhqApprovedAgreementRow(row) {
  const approvalRaw =
    row?.ApprovalStatus ?? row?.approvalStatus ?? row?.ApprovedStatus ?? row?.approvedStatus;
  return (
    approvalRaw === true ||
    approvalRaw === 1 ||
    approvalRaw === "1" ||
    String(approvalRaw ?? "")
      .trim()
      .toLowerCase() === "approved"
  );
}

/** Sum Govt Share (Mil) from /contracts agreement rows. */
function sumGovtShareFromAgreementContractRows(
  contractRows,
  { useAsOf = false, ahqApprovedOnly = false, classIds, contractMetaById = new Map() } = {}
) {
  const idSet = Array.isArray(classIds) && classIds.length ? new Set(classIds.map(Number)) : null;
  let sum = 0;

  for (const row of contractRows || []) {
    if (!useAsOf && !isActiveCatalogContractRow(row)) continue;
    if (ahqApprovedOnly && !isAhqApprovedAgreementRow(row)) continue;
    if (idSet) {
      const classId = resolveAsOfContractClassId(row, contractMetaById);
      if (classId == null || !idSet.has(classId)) continue;
    }
    sum += readAgreementGovtShareMil(row);
  }

  return sum;
}

/** Sum Income / share amounts (Mil) from contract catalog or as-of rows for given ClassIds. */
export function buildMilFromContractRows(
  contractRows,
  classIds,
  contractMetaById = new Map(),
  { activeOnly = true, ahqApprovedOnly = false, validStateOnly = false } = {}
) {
  const out = {
    incomePA: 0,
    govt: 0,
    paf: 0,
    ahq: 0,
    rac: 0,
    base: 0,
  };
  const idSet =
    Array.isArray(classIds) && classIds.length > 0 ? new Set(classIds.map(Number)) : null;

  for (const row of contractRows || []) {
    if (activeOnly && !isActiveCatalogContractRow(row)) continue;
    if (validStateOnly && !isValidStateAgreementRow(row)) continue;
    if (ahqApprovedOnly && !isAhqApprovedAgreementRow(row)) continue;

    const classId = resolveAsOfContractClassId(row, contractMetaById);
    if (idSet) {
      if (classId == null || !idSet.has(classId)) continue;
    }

    out.incomePA += readContractIncomeMil(row);
    out.govt += readAgreementGovtShareMil(row);
    out.paf += readAgreementPafShareMil(row);
    out.ahq += readAgreementAhqShareMil(row);
    out.rac += readAgreementRacShareMil(row);
    out.base += readAgreementBaseShareMil(row);
  }

  return normalizeBalancedShareMil(out);
}

/** Sum Govt / PAF share (Mil) from /contracts agreement rows. */
export function sumGovtPafMilFromAgreementContractRows(
  contractRows,
  { useAsOf = false, contractMetaById = new Map() } = {}
) {
  return {
    govt: sumGovtShareFromAgreementContractRows(contractRows, { useAsOf, contractMetaById }),
    paf: buildMilFromContractRows(contractRows, null, contractMetaById, { activeOnly: !useAsOf })
      .paf,
  };
}

/** Financial share totals from agreement rows (matches /contracts GovtShare / PAFShare columns). */
export function buildFinancialSharesFromAgreementContracts(
  agreementRows,
  classIdFilter = "all",
  { useAsOf = false, contractMetaById = new Map() } = {}
) {
  const keys = [
    { id: "govt", label: "Govt Share" },
    { id: "paf", label: "PAF Share" },
    { id: "ahq", label: "AHQ Share" },
    { id: "rac", label: "RAC Share" },
    { id: "base", label: "Base Share" },
  ];

  let propertyClassIds = null;
  if (
    classIdFilter != null &&
    classIdFilter !== "" &&
    String(classIdFilter).toLowerCase() !== "all"
  ) {
    const shareClassId = Number(classIdFilter);
    if (Number.isFinite(shareClassId)) {
      propertyClassIds = SHARE_CLASS_TO_PROPERTY_CLASSES[shareClassId] ?? [shareClassId];
    }
  }

  const mil = buildMilFromContractRows(agreementRows, propertyClassIds, contractMetaById, {
    activeOnly: !useAsOf,
  });

  return keys.map((k) => ({
    id: k.id,
    label: k.label,
    value: mil[k.id] || 0,
  }));
}

/** Replace asset card mil stats with sums from contract rows (matches /contracts grid). */
export function applyContractMilToAssetCards(
  cards,
  contractRows,
  contractMetaById = new Map(),
  { activeOnly = true, ahqApprovedOnly = false, validStateOnly = false } = {}
) {
  return (cards || []).map((card) => {
    if (!card || Number(card.count) <= 0) return card;

    let classIds = null;
    if (card.key !== "total") {
      if (card.isExtraClass && card.classId != null) {
        classIds = [card.classId];
      } else {
        const meta = PROPERTY_CLASS_STICKERS[card.key];
        classIds = meta?.classIds ?? null;
      }
    }

    return {
      ...card,
      mil: buildMilFromContractRows(contractRows, classIds, contractMetaById, {
        activeOnly,
        ahqApprovedOnly,
        validStateOnly,
      }),
    };
  });
}

/** AHQ Approval stickers from ActiveByAsOfDate rows. */
export function buildAhqApprovalFromAsOfContracts(asOfRows) {
  const approved = emptyContractStickerMetrics();
  const pending = emptyContractStickerMetrics();

  for (const row of asOfRows || []) {
    const approvalRaw = row?.ApprovalStatus ?? row?.approvalStatus;
    const isApproved =
      approvalRaw === true ||
      approvalRaw === 1 ||
      approvalRaw === "1" ||
      String(approvalRaw ?? "")
        .trim()
        .toLowerCase() === "approved";

    if (isApproved) accumulateAsOfStickerMetrics(approved, row);
    else accumulateAsOfStickerMetrics(pending, row);
  }

  return { approved, pending };
}

export function enrichAsOfContractRowsWithMeta(asOfRows, contractMetaById = new Map()) {
  return (asOfRows || []).map((row) => {
    const id = Number(row?.Id ?? row?.id);
    const meta = Number.isFinite(id) ? contractMetaById?.get?.(id) : null;
    if (!meta) return row;
    return {
      ...row,
      ClassId: row.ClassId ?? row.classId ?? meta.classId,
      CmdId: row.CmdId ?? row.cmdId ?? meta.cmdId,
      BaseId: row.BaseId ?? row.baseId ?? meta.baseId,
    };
  });
}

/** Synthetic GovtPAFShare rows for Assets / Financials when using ActiveByAsOfDate fallback. */
export function buildGovtPafShareRowsFromAsOfContracts(asOfRows, contractMetaById = new Map()) {
  const byKey = new Map();

  for (const row of asOfRows || []) {
    const classId = resolveAsOfContractClassId(row, contractMetaById);
    if (classId == null) continue;

    const cmdId = resolveAsOfContractCmdId(row, contractMetaById);
    const baseId = resolveAsOfContractBaseId(row, contractMetaById);
    const key = `${classId}|${cmdId}|${baseId}`;

    const entry = byKey.get(key) || {
      incomePA: 0,
      govt: 0,
      paf: 0,
      ahq: 0,
      rac: 0,
      base: 0,
      classId,
      cmdId,
      baseId,
    };

    const income =
      asOfAmountToMillions(readNumber(row, MIL_FIELDS.incomePAShare)) ||
      asOfAmountToMillions(readNumber(row, MIL_FIELDS.incomePAProperty)) ||
      asOfAmountToMillions(
        readNumber(row, ["RentalValue", "rentalValue", "CurrRentPA", "currRentPA"])
      );

    entry.incomePA += income;
    entry.govt += asOfAmountToMillions(readNumber(row, MIL_FIELDS.govt));
    entry.paf += asOfAmountToMillions(readNumber(row, MIL_FIELDS.paf));
    entry.ahq += asOfAmountToMillions(readNumber(row, MIL_FIELDS.ahq));
    entry.rac += asOfAmountToMillions(readNumber(row, MIL_FIELDS.rac));
    entry.base += asOfAmountToMillions(readNumber(row, MIL_FIELDS.base));
    byKey.set(key, entry);
  }

  return [...byKey.values()].map((entry) => ({
    DataSetName: DATA_SET_GOVT_PAF_SHARE,
    ClassId: entry.classId,
    CmdId: entry.cmdId || null,
    BaseId: entry.baseId || null,
    IncomePA_Million: entry.incomePA,
    GovtShare_Million: entry.govt,
    PAFShare_Million: entry.paf,
    AHQShare_Million: entry.ahq,
    RACShare_Million: entry.rac,
    BaseShare_Million: entry.base,
  }));
}

/** PropertySummary ClassRevenue overrides for outstanding-rent stickers (fallback). */
export function buildPropertySummaryWorthFromAsOfContracts(asOfRows, contractMetaById = new Map()) {
  const byClass = new Map();

  for (const row of asOfRows || []) {
    const classId = resolveAsOfContractClassId(row, contractMetaById);
    if (classId == null) continue;
    const worth =
      asOfAmountToMillions(readNumber(row, ["RentalValue", "rentalValue"])) ||
      asOfAmountToMillions(readNumber(row, MIL_FIELDS.paf));
    byClass.set(classId, (byClass.get(classId) || 0) + worth);
  }

  return [...byClass.entries()].map(([classId, worth]) => ({
    DataSetName: DATA_SET_PROPERTY_SUMMARY,
    ClassId: classId,
    ClassRevenue_Million: worth,
  }));
}

export function buildContractMetaLookup(contracts) {
  const map = new Map();
  (contracts || []).forEach((row) => {
    const id = Number(row?.Id ?? row?.id);
    if (!Number.isFinite(id)) return;
    map.set(id, {
      classId: row?.ClassId ?? row?.classId ?? "",
      cmdId: row?.CmdId ?? row?.cmdId ?? "",
      baseId: row?.BaseId ?? row?.baseId ?? "",
      natureOfBusiness: readString(row, ["NatureOfBusiness", "natureOfBusiness"]),
    });
  });
  return map;
}

export function unwrapKpiApiList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.resultSets)) return response.resultSets;
  if (Array.isArray(response?.ResultSets)) return response.ResultSets;
  return [];
}
