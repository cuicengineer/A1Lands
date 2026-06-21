/**
 * KPI Overview — data extraction & aggregation (same API as summary dashboard).
 */

import { coerceChartDataValue } from "utils/chartBarDataUtils";

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
  bts: { classIds: [9], label: "BTS" },
  hb: { classIds: [6], label: "HB" },
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
export function formatKpiMoneyAmount(valueInMillions) {
  const n = coerceChartDataValue(valueInMillions);
  if (n == null) {
    return { text: "0.00", suffix: "M" };
  }
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return {
      text: (n / 1000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      suffix: "B",
    };
  }
  return {
    text: n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
    suffix: "M",
  };
}

export function formatKpiMoneyLabel(valueInMillions) {
  const { text, suffix } = formatKpiMoneyAmount(valueInMillions);
  return `${text} ${suffix}`;
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
  9: 4,
  6: 5,
};

/** GovtPAFShare class ids → property-summary class ids used on category cards. */
const SHARE_CLASS_TO_PROPERTY_CLASSES = {
  1: [1, 2],
  2: [3],
  3: [4],
  4: [9],
  5: [6],
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

function readShareClassId(row) {
  for (const key of SHARE_CLASS_ID_KEYS) {
    const raw = row?.[key];
    if (raw === undefined || raw === null || raw === "") continue;
    const n = Number(raw);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function shareRowMatchesClassIds(row, classIds) {
  const cid = readShareClassId(row);
  if (!Number.isFinite(cid)) return false;
  const expanded = expandShareClassIds(classIds);
  return expanded.includes(cid);
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
  return out;
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
  return fromShare;
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

export function buildFinancialShares(shareRows, classIdFilter = "all", contractRows = []) {
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

/**
 * Govt / PAF mil per RAC (CmdId), consolidated across all property classes.
 * Used by Govt & PAF bar charts without class-wise breakdown.
 */
export function buildKpiRacGovtPafCells({
  shareRows = [],
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
    const racShare = cmdId ? filterKpiRowsByCmdId(shareRows, cmdId) : shareRows;
    const racContract = cmdId ? filterKpiRowsByCmdId(contractRows, cmdId) : contractRows;
    const shares = buildFinancialShares(racShare, "all", racContract);
    const govt = shares.find((s) => s.id === "govt")?.value ?? 0;
    const paf = shares.find((s) => s.id === "paf")?.value ?? 0;
    cells.push({
      key: cmdId || "all",
      chartLabel: racLabel,
      mil: { govt, paf },
    });
  }

  return cells;
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
