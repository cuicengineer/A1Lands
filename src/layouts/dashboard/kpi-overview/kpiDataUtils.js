/**
 * KPI Overview — data extraction & aggregation (same API as summary dashboard).
 */

const DATA_SET_PROPERTY_SUMMARY = "PropertySummary";
const DATA_SET_CONTRACTS_SUMMARY = "ContractsSummary";
const DATA_SET_GOVT_PAF_SHARE = "GovtPAFShare";

export const PROPERTY_CLASS_STICKERS = {
  lands: { classIds: [1], label: "Lands" },
  categoryA: { classIds: [2], label: "CAT A" },
  categoryB: { classIds: [3], label: "CAT B" },
  categoryC: { classIds: [4], label: "CAT C" },
  bts: { classIds: [9], label: "BTS" },
  hb: { classIds: [6], label: "HB" },
};

const ASSET_CARD_FIXED_ORDER = ["categoryA", "categoryB", "categoryC", "bts", "hb", "total"];

/** Values from API are in millions; display with M. or B. suffix. */
export function formatKpiMoneyAmount(valueInMillions) {
  const n = Number(valueInMillions);
  if (!Number.isFinite(n)) {
    return { text: "0.00", suffix: "M" };
  }
  const abs = Math.abs(n);
  if (abs >= 1000) {
    return {
      text: (n / 1000).toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
      suffix: "B.",
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

function buildExtraPropertyClassCards(propertyRows, shareRows, knownClassIds) {
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
        mil: buildMilForCategory(shareRows, propertyRows, [classId]),
        isExtraClass: true,
      };
    })
    .filter(Boolean);
}

function readNumber(row, keys) {
  if (!row || typeof row !== "object") return null;
  for (const k of keys) {
    if (row[k] === undefined || row[k] === null || row[k] === "") continue;
    const n = Number(row[k]);
    if (Number.isFinite(n)) return n;
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

function isDataSetRow(row, dataSetName) {
  if (!row || typeof row !== "object") return false;
  const n = row.DataSetName ?? row.dataSetName;
  return String(n) === dataSetName;
}

function extractRowsByDataSet(payload, dataSetName, isRow) {
  if (payload == null || typeof payload !== "object") return [];
  const root = payload.data ?? payload.Data ?? payload.result ?? payload.Result ?? payload;
  const resultSets = root.resultSets ?? root.ResultSets ?? payload.resultSets ?? payload.ResultSets;
  if (Array.isArray(resultSets)) {
    for (const inner of resultSets) {
      if (!Array.isArray(inner) || inner.length === 0) continue;
      const first = inner[0];
      if (first && typeof first === "object" && isRow(first)) {
        return inner.filter(isRow);
      }
    }
  }
  if (dataSetName === DATA_SET_PROPERTY_SUMMARY) {
    const ps = root.PropertySummary ?? root.propertySummary;
    if (Array.isArray(ps))
      return ps.filter(
        (r) => isRow(r) || readNumber(r, ["PropertyCount", "propertyCount"]) != null
      );
  }
  return [];
}

export function extractPropertySummaryRows(payload) {
  return extractRowsByDataSet(payload, DATA_SET_PROPERTY_SUMMARY, (r) =>
    isDataSetRow(r, DATA_SET_PROPERTY_SUMMARY)
  );
}

export function extractContractsSummaryRows(payload) {
  return extractRowsByDataSet(payload, DATA_SET_CONTRACTS_SUMMARY, (r) =>
    isDataSetRow(r, DATA_SET_CONTRACTS_SUMMARY)
  );
}

export function extractGovtPafShareRows(payload) {
  return extractRowsByDataSet(payload, DATA_SET_GOVT_PAF_SHARE, (r) =>
    isDataSetRow(r, DATA_SET_GOVT_PAF_SHARE)
  );
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
  govt: ["GovtShare", "govtShare"],
  paf: ["PAFShare", "pafShare"],
  ahq: ["AHQShare", "ahqShare"],
  rac: ["RACShare", "racShare"],
  base: ["BaseShare", "baseShare"],
};

/** Sum Income PA / share amounts (Mil) from GovtPAFShare rows for given ClassIds. */
function aggregateShareMilByClassIds(shareRows, classIds) {
  const idSet = new Set(classIds.map(Number));
  const out = {
    incomePA: 0,
    govt: 0,
    paf: 0,
    ahq: 0,
    rac: 0,
    base: 0,
  };
  for (const r of shareRows) {
    if (!isDataSetRow(r, DATA_SET_GOVT_PAF_SHARE)) continue;
    const cid = Number(r.ClassId ?? r.classId);
    if (!idSet.has(cid)) continue;
    out.incomePA += readNumber(r, MIL_FIELDS.incomePAShare) || 0;
    out.govt += readNumber(r, MIL_FIELDS.govt) || 0;
    out.paf += readNumber(r, MIL_FIELDS.paf) || 0;
    out.ahq += readNumber(r, MIL_FIELDS.ahq) || 0;
    out.rac += readNumber(r, MIL_FIELDS.rac) || 0;
    out.base += readNumber(r, MIL_FIELDS.base) || 0;
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

function buildMilForCategory(shareRows, propertyRows, classIds) {
  const fromShare = aggregateShareMilByClassIds(shareRows, classIds);
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

export function buildAssetCards(propertyRows, shareRows = []) {
  const cardsByKey = {};

  for (const [key, meta] of Object.entries(PROPERTY_CLASS_STICKERS)) {
    if (key === "lands") continue;
    const agg = aggregateByClassIds(propertyRows, meta.classIds);
    const mil = buildMilForCategory(shareRows, propertyRows, meta.classIds);
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
    mil: buildMilForCategory(shareRows, propertyRows, allClassIds),
    chartInclude: false,
  };

  const fixedCards = ASSET_CARD_FIXED_ORDER.map((key) => cardsByKey[key]).filter(Boolean);
  const extraCards = buildExtraPropertyClassCards(
    propertyRows,
    shareRows,
    getKnownPropertyClassIds()
  );

  return [...fixedCards, ...extraCards];
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
    if (!isDataSetRow(r, DATA_SET_GOVT_PAF_SHARE)) continue;
    const p = readNumber(r, ["PAFShare", "pafShare"]);
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

export function buildFinancialShares(shareRows, classIdFilter = "all") {
  const keys = [
    { id: "govt", label: "Govt Share", fields: ["GovtShare", "govtShare"] },
    { id: "paf", label: "PAF Share", fields: ["PAFShare", "pafShare"] },
    { id: "ahq", label: "AHQ Share", fields: ["AHQShare", "ahqShare"] },
    { id: "rac", label: "RAC Share", fields: ["RACShare", "racShare"] },
    { id: "base", label: "Base Share", fields: ["BaseShare", "baseShare"] },
  ];

  const totals = {};
  keys.forEach((k) => {
    totals[k.id] = 0;
  });

  let rows = Array.isArray(shareRows)
    ? shareRows.filter((r) => isDataSetRow(r, DATA_SET_GOVT_PAF_SHARE))
    : [];
  if (
    classIdFilter != null &&
    classIdFilter !== "" &&
    String(classIdFilter).toLowerCase() !== "all"
  ) {
    const cid = Number(classIdFilter);
    if (Number.isFinite(cid)) {
      rows = rows.filter((r) => Number(r.ClassId ?? r.classId) === cid);
    }
  }

  for (const r of rows) {
    keys.forEach((k) => {
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
    if (!isDataSetRow(r, DATA_SET_GOVT_PAF_SHARE)) continue;
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
