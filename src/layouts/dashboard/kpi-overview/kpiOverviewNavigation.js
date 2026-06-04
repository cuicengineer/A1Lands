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
} = {}) {
  const params = new URLSearchParams();
  appendParam(params, "cmdId", racId);
  appendParam(params, "baseId", baseId);
  appendParam(params, "classId", classId);
  appendParam(params, "kpiContractHealth", kpiContractHealth);
  appendParam(params, "kpiContractStatus", kpiContractStatus);
  appendParam(params, "kpiApproval", kpiApproval);
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
      filters.kpiApproval
  );
}

function catalogEntityId(entity) {
  return Number(
    entity?.id ??
      entity?.Id ??
      entity?.cmdId ??
      entity?.CmdId ??
      entity?.baseId ??
      entity?.BaseId ??
      entity?.classId ??
      entity?.ClassId ??
      entity?.commandId ??
      entity?.CommandId
  );
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
