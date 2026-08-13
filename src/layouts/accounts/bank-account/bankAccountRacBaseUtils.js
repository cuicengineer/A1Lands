/**
 * Bank account RAC / Unit dropdown helpers.
 * RAC options → AccRac; Unit options → AccRacBase where ParentId = AccRac.Id.
 */

import {
  canSeeAllBankAccountRacBaseOptions,
  getLoggedInUserBaseId,
  getLoggedInUserCmdId,
  getLoggedInUserLevelId,
} from "services/api.service";

export function mapAccRacToRacOption(row, fallbackId = "") {
  const id = String(row?.id ?? row?.Id ?? fallbackId ?? "").trim();
  const name = String(row?.name ?? row?.Name ?? "").trim();
  if (!id || !name) return null;
  return { id, name, source: "custom" };
}

/** @deprecated use mapAccRacToRacOption — kept for saved-row fallback shapes */
export function mapAccRacBaseToRacOption(row, fallbackId = "") {
  return mapAccRacToRacOption(row, fallbackId);
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

function mergeOptionsById(options) {
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
    if (!existing.name && next.name) {
      byId.set(id, { ...existing, ...next });
    }
  });
  return [...byId.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );
}

export function mergeRacDropdownOptions({ customRacRows = [], savedOption = null } = {}) {
  const mapped = [...(customRacRows || []).map((row) => mapAccRacToRacOption(row)).filter(Boolean)];
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
  customBaseRows = [],
  selectedRacId = "",
  savedOption = null,
} = {}) {
  const racKey = selectedRacId == null || selectedRacId === "" ? "" : String(selectedRacId);
  const mapped = [];

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

  let filtered = (options || []).filter((option) => String(option.parentId ?? "") === racKey);

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

export function isBankAccountRacFilterLocked(scope = getBankAccountRacBaseUserScope()) {
  return Boolean(!scope?.canSeeAll && scope?.userCmdId != null);
}

export function isBankAccountBaseFilterLocked(scope = getBankAccountRacBaseUserScope()) {
  return Boolean(
    !scope?.canSeeAll && Number(scope?.userLevelId) === 3 && scope?.userBaseId != null
  );
}

function readBankAccountRowCmdId(row) {
  return String(row?.cmdId ?? row?.CmdId ?? row?.racId ?? row?.RacId ?? "");
}

function readBankAccountRowBaseId(row) {
  return String(row?.baseId ?? row?.BaseId ?? row?.unitId ?? row?.UnitId ?? "");
}

/** Client-side grid filter (defense-in-depth; API also scopes by RAC/Base). */
export function filterBankAccountRowsForUserScope(rows, scope = getBankAccountRacBaseUserScope()) {
  if (scope?.canSeeAll) return rows || [];
  const cmdKey = scope?.userCmdId != null && scope.userCmdId !== "" ? String(scope.userCmdId) : "";
  if (!cmdKey) return [];
  let filtered = (rows || []).filter((row) => readBankAccountRowCmdId(row) === cmdKey);
  if (Number(scope?.userLevelId) === 3 && scope?.userBaseId != null) {
    const baseKey = String(scope.userBaseId);
    filtered = filtered.filter((row) => readBankAccountRowBaseId(row) === baseKey);
  }
  return filtered;
}

/** Default RAC/Base for new bank account forms when user is scoped. */
export function resolveBankAccountDefaultRacBase(scope = getBankAccountRacBaseUserScope()) {
  if (scope?.canSeeAll) {
    return { racId: "", baseId: "" };
  }
  const racId = scope?.userCmdId != null && scope.userCmdId !== "" ? String(scope.userCmdId) : "";
  const baseId =
    Number(scope?.userLevelId) === 3 && scope?.userBaseId != null ? String(scope.userBaseId) : "";
  return { racId, baseId };
}

/** AccRac / AccRacBase rows may be renamed from the form. */
export function isCustomAccRacBaseDropdownOption(option) {
  return option?.source === "custom";
}
