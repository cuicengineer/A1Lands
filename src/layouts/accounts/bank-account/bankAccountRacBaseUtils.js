/**
 * Bank account RAC / Unit dropdown helpers — merges AccRacBase custom list with Command/Base catalog (KPI-style).
 */

import {
  canSeeAllBankAccountRacBaseOptions,
  getLoggedInUserBaseId,
  getLoggedInUserCmdId,
  getLoggedInUserLevelId,
} from "services/api.service";
import { getBaseDropdownLabel } from "layouts/dashboard/kpi-overview/kpiOverviewNavigation";

function getCatalogOptionName(option) {
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

export function mapCommandToRacOption(command) {
  const id = String(command?.id ?? command?.Id ?? "").trim();
  const name = getCatalogOptionName(command);
  if (!id || !name) return null;
  return { id, name, source: "catalog" };
}

export function mapBaseToUnitOption(base) {
  const id = String(base?.id ?? base?.Id ?? "").trim();
  const name = getBaseDropdownLabel(base) || getCatalogOptionName(base);
  const cmdId = base?.cmd ?? base?.Cmd ?? base?.cmdId ?? base?.CmdId ?? "";
  if (!id || !name) return null;
  return {
    id,
    name,
    source: "catalog",
    cmdId: cmdId === "" || cmdId == null ? "" : String(cmdId),
  };
}

export function mapAccRacBaseToRacOption(row, fallbackId = "") {
  const id = String(row?.id ?? row?.Id ?? fallbackId ?? "").trim();
  const name = String(row?.name ?? row?.Name ?? "").trim();
  if (!id || !name) return null;
  return { id, name, source: "custom" };
}

export function mapAccRacBaseToUnitOption(row, fallbackId = "") {
  const id = String(row?.id ?? row?.Id ?? fallbackId ?? "").trim();
  const name = String(row?.name ?? row?.Name ?? "").trim();
  const parentId = row?.parentId ?? row?.ParentId;
  if (!id || !name) return null;
  return {
    id,
    name,
    source: "custom",
    parentId: parentId == null || parentId === "" ? "" : String(parentId),
  };
}

function mergeOptionsById(options, preferredSource = "catalog") {
  const byId = new Map();
  (options || []).forEach((raw) => {
    if (!raw?.id || !raw?.name) return;
    const id = String(raw.id);
    const next = { ...raw, id, name: String(raw.name).trim() };
    const existing = byId.get(id);
    if (!existing) {
      byId.set(id, next);
      return;
    }
    if (existing.source !== preferredSource && next.source === preferredSource) {
      byId.set(id, { ...existing, ...next, name: next.name || existing.name });
    }
  });
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function mergeRacDropdownOptions({
  catalogCommands = [],
  customRacRows = [],
  savedOption = null,
} = {}) {
  const mapped = [
    ...(catalogCommands || []).map(mapCommandToRacOption).filter(Boolean),
    ...(customRacRows || []).map((row) => mapAccRacBaseToRacOption(row)).filter(Boolean),
  ];
  if (savedOption?.id && savedOption?.name) {
    mapped.push({
      id: String(savedOption.id),
      name: String(savedOption.name).trim(),
      source: savedOption.source || "custom",
    });
  }
  return mergeOptionsById(mapped);
}

export function mergeBaseDropdownOptions({
  catalogBases = [],
  customBaseRows = [],
  selectedRacId = "",
  savedOption = null,
} = {}) {
  const racKey = selectedRacId == null || selectedRacId === "" ? "" : String(selectedRacId);
  const mapped = [];

  (catalogBases || []).forEach((base) => {
    const option = mapBaseToUnitOption(base);
    if (!option) return;
    if (!racKey || option.cmdId === racKey) mapped.push(option);
  });

  (customBaseRows || []).forEach((row) => {
    const option = mapAccRacBaseToUnitOption(row);
    if (!option) return;
    if (!racKey || option.parentId === racKey) mapped.push(option);
  });

  if (savedOption?.id && savedOption?.name) {
    mapped.push({
      id: String(savedOption.id),
      name: String(savedOption.name).trim(),
      source: savedOption.source || "custom",
      parentId: savedOption.parentId != null ? String(savedOption.parentId) : racKey,
      cmdId: savedOption.cmdId != null ? String(savedOption.cmdId) : racKey,
    });
  }

  return mergeOptionsById(mapped);
}

export function getBankAccountRacBaseUserScope() {
  return {
    canSeeAll: canSeeAllBankAccountRacBaseOptions(),
    userCmdId: getLoggedInUserCmdId(),
    userBaseId: getLoggedInUserBaseId(),
    userLevelId: getLoggedInUserLevelId(),
  };
}

export function filterRacOptionsForUserScope(options, scope = getBankAccountRacBaseUserScope()) {
  if (scope?.canSeeAll) return options || [];
  const cmdKey = scope?.userCmdId != null && scope.userCmdId !== "" ? String(scope.userCmdId) : "";
  if (!cmdKey) return [];
  return (options || []).filter((option) => String(option.id) === cmdKey);
}

export function filterBaseOptionsForUserScope(
  options,
  selectedRacId,
  scope = getBankAccountRacBaseUserScope()
) {
  if (scope?.canSeeAll) return options || [];
  const racKey = selectedRacId == null || selectedRacId === "" ? "" : String(selectedRacId);
  if (!racKey) return [];

  const userCmdKey =
    scope?.userCmdId != null && scope.userCmdId !== "" ? String(scope.userCmdId) : "";
  if (userCmdKey && racKey !== userCmdKey) return [];

  let filtered = (options || []).filter((option) => {
    if (option.source === "catalog") {
      return String(option.cmdId ?? "") === racKey || String(option.cmdId ?? "") === "";
    }
    if (option.source === "custom") {
      return String(option.parentId ?? "") === racKey;
    }
    return true;
  });

  if (Number(scope?.userLevelId) === 3 && scope?.userBaseId != null) {
    const baseKey = String(scope.userBaseId);
    filtered = filtered.filter((option) => String(option.id) === baseKey);
  }

  return filtered;
}

export function buildScopedRacDropdownOptions(params) {
  const merged = mergeRacDropdownOptions(params);
  return filterRacOptionsForUserScope(merged);
}

export function buildScopedBaseDropdownOptions(params) {
  const merged = mergeBaseDropdownOptions(params);
  return filterBaseOptionsForUserScope(merged, params?.selectedRacId);
}

/** User-added AccRacBase rows may be renamed; catalog Command/Base options may not. */
export function isCustomAccRacBaseDropdownOption(option) {
  return option?.source === "custom";
}
