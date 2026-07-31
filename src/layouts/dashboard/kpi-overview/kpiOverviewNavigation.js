/**
 * Deep links from KPI Overview → rental-properties / contracts grids.
 */

import { PROPERTY_CLASS_STICKERS } from "./kpiDataUtils";

function readUrlSearchParams() {
  if (typeof window === "undefined") return new URLSearchParams();

  const readFrom = (searchText) => {
    try {
      return new URLSearchParams(String(searchText || ""));
    } catch {
      return new URLSearchParams();
    }
  };

  const fromSearch = readFrom(window.location?.search || "");
  if ([...fromSearch.keys()].length > 0) return fromSearch;

  const hash = String(window.location?.hash || "");
  const queryIndex = hash.indexOf("?");
  if (queryIndex >= 0) return readFrom(hash.slice(queryIndex));

  return new URLSearchParams();
}

function appendParam(params, key, value) {
  if (value === undefined || value === null || value === "") return;
  params.set(key, String(value));
}

export function openKpiTargetInNewTab(pathWithQuery) {
  const target = String(pathWithQuery || "").trim();
  if (!target) return;
  try {
    window.open(target, "_blank");
  } catch {
    window.open(target);
  }
}

export function buildRentalPropertiesUrlFromKpi({ racId, baseId, classId } = {}) {
  const params = new URLSearchParams();
  appendParam(params, "cmdId", racId);
  appendParam(params, "baseId", baseId);
  appendParam(params, "classId", classId);
  const qs = params.toString();
  return `/contracts/rental-properties${qs ? `?${qs}` : ""}`;
}

export function buildContractsUrlFromKpi({
  racId,
  baseId,
  classId,
  kpiContractHealth,
  kpiContractStatus,
  kpiApproval,
  asOfDate,
} = {}) {
  const params = new URLSearchParams();
  appendParam(params, "cmdId", racId);
  appendParam(params, "baseId", baseId);
  appendParam(params, "classId", classId);
  appendParam(params, "kpiContractHealth", kpiContractHealth);
  appendParam(params, "kpiContractStatus", kpiContractStatus);
  appendParam(params, "kpiApproval", kpiApproval);
  appendParam(params, "asOfDate", asOfDate);
  const qs = params.toString();
  return `/contracts${qs ? `?${qs}` : ""}`;
}

/** Primary ClassId for an asset sticker (empty for Total = no class filter). */
export function resolveAssetCardClassId(card) {
  if (!card || typeof card !== "object") return "";
  if (card.key === "total") return "";
  if (card.isExtraClass && card.classId != null) return String(card.classId);
  const meta = PROPERTY_CLASS_STICKERS[card.key];
  if (meta?.classIds?.length) return String(meta.classIds[0]);
  return "";
}

export function readRentalPropertiesUrlFilters() {
  const params = readUrlSearchParams();
  return {
    cmdId: String(params.get("cmdId") || "").trim(),
    baseId: String(params.get("baseId") || "").trim(),
    classId: String(params.get("classId") || "").trim(),
  };
}

export function readContractsUrlKpiFilters() {
  const params = readUrlSearchParams();
  return {
    contractNo: String(params.get("contractNo") || "").trim(),
    cmdId: String(params.get("cmdId") || "").trim(),
    baseId: String(params.get("baseId") || "").trim(),
    classId: String(params.get("classId") || "").trim(),
    kpiContractHealth: String(params.get("kpiContractHealth") || "")
      .trim()
      .toLowerCase(),
    kpiContractStatus: String(params.get("kpiContractStatus") || "")
      .trim()
      .toLowerCase(),
    kpiApproval: String(params.get("kpiApproval") || "")
      .trim()
      .toLowerCase(),
    asOfDate: String(params.get("asOfDate") || "").trim(),
  };
}

export function hasRentalPropertiesUrlFilters(filters) {
  return Boolean(filters?.cmdId || filters?.baseId || filters?.classId);
}

export function hasContractsKpiGridFilters(filters) {
  if (!filters) return false;
  return Boolean(
    filters.cmdId ||
      filters.baseId ||
      filters.classId ||
      filters.kpiContractHealth ||
      filters.kpiContractStatus ||
      filters.kpiApproval ||
      filters.asOfDate
  );
}

/** Contract state for KPI stickers and /contracts grid filters (matches contracts screen). */
export function getKpiContractRowStateNormalized(row) {
  const fromPayload =
    row?.ContractState ?? row?.contractState ?? row?.ContractStatus ?? row?.contractStatus ?? "";
  const n = String(fromPayload || "")
    .trim()
    .toLowerCase();
  if (n) {
    if (n === "upcoming" || n === "not started") return "upcoming";
    return n;
  }
  const startRaw = row?.contractStartDate ?? row?.ContractStartDate ?? "";
  const endRaw = row?.contractEndDate ?? row?.ContractEndDate ?? "";
  const start = String(startRaw || "")
    .split("T")[0]
    .slice(0, 10);
  const end = String(endRaw || "")
    .split("T")[0]
    .slice(0, 10);
  const today = new Date().toISOString().split("T")[0];
  if (start && today < start) return "upcoming";
  if (end && today > end) return "terminated";
  if (start && end && today >= start && today <= end) return "active";
  return "";
}

export function rowMatchesKpiContractHealthFilter(row, filterKey) {
  if (!filterKey) return true;
  const st = getKpiContractRowStateNormalized(row);
  const payload = String(
    row?.ContractState ?? row?.contractState ?? row?.ContractStatus ?? row?.contractStatus ?? ""
  )
    .trim()
    .toLowerCase();
  switch (filterKey) {
    case "active":
      return (
        st === "active" || st === "valid" || payload.includes("active") || payload.includes("valid")
      );
    case "premature":
      return (
        st === "premature" ||
        st === "pre-mature" ||
        payload.includes("premature") ||
        payload.includes("pre-mature")
      );
    case "expiring":
      return st === "expiring" || payload.includes("expir") || payload.includes("border");
    case "terminated":
      return (
        st === "terminated" ||
        st === "expired" ||
        payload.includes("terminat") ||
        payload.includes("closed") ||
        payload.includes("expired")
      );
    case "vacant":
      return st === "vacant" || payload.includes("vacant");
    default:
      return true;
  }
}

export function rowMatchesKpiContractStatusFilter(row, filterKey) {
  if (!filterKey) return true;
  if (filterKey === "viable" || filterKey === "unviable") {
    const v = String(
      row?.feasible ?? row?.Viability ?? row?.viability ?? row?.Feasible ?? row?.feasible ?? ""
    )
      .trim()
      .toLowerCase();
    if (filterKey === "viable") return v === "viable";
    return v === "unviable";
  }
  const isActive =
    row?.Status === true ||
    row?.Status === 1 ||
    row?.Status === "1" ||
    (typeof row?.Status === "string" && String(row.Status).toLowerCase() === "active");
  if (filterKey === "active") return isActive;
  if (filterKey === "inactive") return !isActive;
  return true;
}

export function rowMatchesKpiContractApprovalFilter(row, filterKey) {
  if (!filterKey) return true;
  const approvalRaw =
    row?.ApprovalStatus ?? row?.approvalStatus ?? row?.ApprovedStatus ?? row?.approvedStatus;
  const isApproved =
    approvalRaw === true ||
    approvalRaw === 1 ||
    approvalRaw === "1" ||
    String(approvalRaw ?? "")
      .trim()
      .toLowerCase() === "approved";
  if (filterKey === "approved") return isApproved;
  if (filterKey === "pending") return !isApproved;
  return true;
}

export function resolveKpiContractsArchiveFilterForSticker({
  kpiContractHealth,
  kpiContractStatus,
} = {}) {
  if (kpiContractHealth && kpiContractHealth !== "active") return "all";
  if (kpiContractStatus === "inactive" || kpiContractStatus === "unviable") return "all";
  return "valid";
}

export function rowMatchesKpiContractsArchiveFilter(row, archiveFilter) {
  if (!archiveFilter || archiveFilter === "all") return true;
  if (archiveFilter === "valid") {
    const st = getKpiContractRowStateNormalized(row);
    return st === "active" || st === "valid";
  }
  if (archiveFilter === "archive") {
    const archived = row?.IsArchive ?? row?.isArchive;
    return (
      archived === true ||
      archived === 1 ||
      archived === "1" ||
      String(archived || "")
        .trim()
        .toLowerCase() === "true"
    );
  }
  return true;
}

export function contractRowMatchesKpiStickerFilters(
  row,
  { kpiContractHealth, kpiContractStatus, kpiApproval } = {}
) {
  const archive = resolveKpiContractsArchiveFilterForSticker({
    kpiContractHealth,
    kpiContractStatus,
  });
  if (!rowMatchesKpiContractsArchiveFilter(row, archive)) return false;
  if (kpiContractHealth && !rowMatchesKpiContractHealthFilter(row, kpiContractHealth)) return false;
  if (kpiContractStatus && !rowMatchesKpiContractStatusFilter(row, kpiContractStatus)) return false;
  if (kpiApproval && !rowMatchesKpiContractApprovalFilter(row, kpiApproval)) return false;
  return true;
}

export function rowIsInKpiAsOfActiveScope(row, overrideState) {
  if (!overrideState?.asOfDate) return true;
  const byId = overrideState?.byId instanceof Map ? overrideState.byId : new Map();
  const byContractNo =
    overrideState?.byContractNo instanceof Map ? overrideState.byContractNo : new Map();
  if (byId.size === 0 && byContractNo.size === 0) return false;
  const id = Number(row?.Id ?? row?.id);
  if (Number.isFinite(id) && byId.has(id)) return true;
  const contractNo = row?.ContractNo ?? row?.contractNo;
  if (contractNo && byContractNo.has(String(contractNo))) return true;
  return false;
}

function emptyKpiContractStickerMetrics() {
  return { count: 0, worth: 0 };
}

function readKpiContractStickerWorth(row) {
  const raw =
    row?.RentalValue ??
    row?.rentalValue ??
    row?.CurrRentPA ??
    row?.currRentPA ??
    row?.CurrentRentPA ??
    row?.currentRentPA ??
    row?.InitialRentPA ??
    row?.initialRentPA;
  const n = Number(raw);
  if (!Number.isFinite(n)) return 0;
  if (Math.abs(n) < 1000) return n;
  return n / 1_000_000;
}

function isCountableKpiCatalogContractRow(row) {
  const deleted = row?.IsDeleted ?? row?.isDeleted;
  return !(deleted === true || deleted === 1 || deleted === "1");
}

function accumulateKpiContractStickerMetrics(bucket, row) {
  bucket.count += 1;
  bucket.worth += readKpiContractStickerWorth(row);
}

/**
 * Contract Health / Status / AHQ stickers from catalog or as-of contract rows.
 * Counts use the same filters as /contracts when opened via buildContractsUrlFromKpi.
 */
export function buildContractStickersFromContractRows(contractRows, { useAsOf = false } = {}) {
  const health = {
    active: emptyKpiContractStickerMetrics(),
    premature: emptyKpiContractStickerMetrics(),
    expiring: emptyKpiContractStickerMetrics(),
    terminated: emptyKpiContractStickerMetrics(),
    vacant: emptyKpiContractStickerMetrics(),
  };
  const contractStatus = {
    viable: emptyKpiContractStickerMetrics(),
    unviable: emptyKpiContractStickerMetrics(),
    active: emptyKpiContractStickerMetrics(),
    inactive: emptyKpiContractStickerMetrics(),
  };
  const ahqApproval = {
    approved: emptyKpiContractStickerMetrics(),
    pending: emptyKpiContractStickerMetrics(),
  };

  for (const row of contractRows || []) {
    if (!useAsOf && !isCountableKpiCatalogContractRow(row)) continue;

    if (contractRowMatchesKpiStickerFilters(row, { kpiContractHealth: "active" })) {
      accumulateKpiContractStickerMetrics(health.active, row);
    }
    if (contractRowMatchesKpiStickerFilters(row, { kpiContractHealth: "premature" })) {
      accumulateKpiContractStickerMetrics(health.premature, row);
    }
    if (contractRowMatchesKpiStickerFilters(row, { kpiContractHealth: "expiring" })) {
      accumulateKpiContractStickerMetrics(health.expiring, row);
    }
    if (contractRowMatchesKpiStickerFilters(row, { kpiContractHealth: "terminated" })) {
      accumulateKpiContractStickerMetrics(health.terminated, row);
    }
    if (contractRowMatchesKpiStickerFilters(row, { kpiContractHealth: "vacant" })) {
      accumulateKpiContractStickerMetrics(health.vacant, row);
    }

    if (contractRowMatchesKpiStickerFilters(row, { kpiContractStatus: "viable" })) {
      accumulateKpiContractStickerMetrics(contractStatus.viable, row);
    }
    if (contractRowMatchesKpiStickerFilters(row, { kpiContractStatus: "unviable" })) {
      accumulateKpiContractStickerMetrics(contractStatus.unviable, row);
    }
    if (contractRowMatchesKpiStickerFilters(row, { kpiContractStatus: "active" })) {
      accumulateKpiContractStickerMetrics(contractStatus.active, row);
    }
    if (contractRowMatchesKpiStickerFilters(row, { kpiContractStatus: "inactive" })) {
      accumulateKpiContractStickerMetrics(contractStatus.inactive, row);
    }

    if (contractRowMatchesKpiStickerFilters(row, { kpiApproval: "approved" })) {
      accumulateKpiContractStickerMetrics(ahqApproval.approved, row);
    }
    if (contractRowMatchesKpiStickerFilters(row, { kpiApproval: "pending" })) {
      accumulateKpiContractStickerMetrics(ahqApproval.pending, row);
    }
  }

  return { health, contractStatus, ahqApproval };
}

function catalogEntityId(entity) {
  const raw =
    entity?.id ??
    entity?.Id ??
    entity?.cmdId ??
    entity?.CmdId ??
    entity?.baseId ??
    entity?.BaseId ??
    entity?.classId ??
    entity?.ClassId ??
    entity?.commandId ??
    entity?.CommandId;
  if (raw == null || raw === "") return NaN;
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") {
    const n = Number(raw);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

export function resolveCommandNameById(commands, cmdId) {
  const id = Number(cmdId);
  if (!Number.isFinite(id) || id === 0) return "";
  const match = (commands || []).find((c) => catalogEntityId(c) === id);
  return String(
    match?.name ??
      match?.Name ??
      match?.value ??
      match?.Value ??
      match?.label ??
      match?.Label ??
      match?.cmdName ??
      match?.CmdName ??
      ""
  ).trim();
}

export function resolveBaseNameById(bases, baseId) {
  const id = Number(baseId);
  if (!Number.isFinite(id) || id === 0) return "";
  const match = (bases || []).find((b) => catalogEntityId(b) === id);
  return String(
    match?.name ??
      match?.Name ??
      match?.value ??
      match?.Value ??
      match?.label ??
      match?.Label ??
      match?.baseName ??
      match?.BaseName ??
      ""
  ).trim();
}

/** Display label for Base autocomplete options (name + full name). */
export function getBaseDropdownLabel(base) {
  if (base == null) return "";
  const toText = (value) => {
    if (value == null) return "";
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value).trim();
    }
    return "";
  };
  const name = toText(
    base?.name ?? base?.Name ?? base?.value ?? base?.Value ?? base?.label ?? base?.Label
  );
  const fullName = toText(base?.fullName ?? base?.FullName);
  if (fullName && fullName !== name) {
    return `${name} - ${fullName}`;
  }
  return name;
}

export function resolveClassNameById(classes, classId) {
  const id = Number(classId);
  if (!Number.isFinite(id) || id === 0) return "";
  const match = (classes || []).find((c) => catalogEntityId(c) === id);
  return String(
    match?.name ??
      match?.Name ??
      match?.value ??
      match?.Value ??
      match?.label ??
      match?.Label ??
      match?.className ??
      match?.ClassName ??
      ""
  ).trim();
}
