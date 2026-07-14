import {
  canSeeAllKpiOverviewData,
  getLoggedInUserBaseId,
  getLoggedInUserCmdId,
  getLoggedInUserLevelId,
} from "services/api.service";

export function getKpiOverviewUserScope() {
  return {
    canSeeAll: canSeeAllKpiOverviewData(),
    userCmdId: getLoggedInUserCmdId(),
    userBaseId: getLoggedInUserBaseId(),
    userLevelId: getLoggedInUserLevelId(),
  };
}

function readBaseCmdId(base) {
  return String(base?.cmd ?? base?.CmdId ?? base?.cmdId ?? "");
}

function readOptionId(option) {
  return String(option?.id ?? option?.Id ?? "");
}

export function filterKpiRacOptionsForUser(options, scope = getKpiOverviewUserScope()) {
  if (scope?.canSeeAll) return options || [];
  const cmdKey = scope?.userCmdId != null && scope.userCmdId !== "" ? String(scope.userCmdId) : "";
  if (!cmdKey) return [];
  return (options || []).filter((option) => readOptionId(option) === cmdKey);
}

export function filterKpiBaseCatalogForUser(bases, scope = getKpiOverviewUserScope()) {
  if (scope?.canSeeAll) return bases || [];
  let filtered = bases || [];
  const cmdKey = scope?.userCmdId != null && scope.userCmdId !== "" ? String(scope.userCmdId) : "";
  if (cmdKey) {
    filtered = filtered.filter((base) => readBaseCmdId(base) === cmdKey);
  }
  if (Number(scope?.userLevelId) === 3 && scope?.userBaseId != null) {
    const baseKey = String(scope.userBaseId);
    filtered = filtered.filter((base) => readOptionId(base) === baseKey);
  }
  return filtered;
}

export function resolveKpiEffectiveRacBaseFilters(
  racIds = [],
  baseIds = [],
  scope = getKpiOverviewUserScope()
) {
  if (scope?.canSeeAll) {
    return {
      racIds: (racIds || []).map(String),
      baseIds: (baseIds || []).map(String),
    };
  }

  const allowedRacIds =
    scope?.userCmdId != null && scope.userCmdId !== "" ? [String(scope.userCmdId)] : [];
  const allowedBaseIds =
    Number(scope?.userLevelId) === 3 && scope?.userBaseId != null
      ? [String(scope.userBaseId)]
      : null;

  const selectedRac = (racIds || []).map(String).filter(Boolean);
  const selectedBase = (baseIds || []).map(String).filter(Boolean);

  let racIdsOut = selectedRac.length > 0 ? selectedRac : allowedRacIds;
  if (!racIdsOut.length) {
    racIdsOut = ["__kpi_no_access__"];
  }

  let baseIdsOut = selectedBase;
  if (allowedBaseIds) {
    baseIdsOut =
      selectedBase.length > 0
        ? selectedBase.filter((id) => allowedBaseIds.includes(id))
        : allowedBaseIds;
  }

  return { racIds: racIdsOut, baseIds: baseIdsOut };
}

export function isKpiRacFilterLocked(scope = getKpiOverviewUserScope()) {
  return Boolean(!scope?.canSeeAll && scope?.userCmdId != null);
}

export function isKpiBaseFilterLocked(scope = getKpiOverviewUserScope()) {
  return Boolean(
    !scope?.canSeeAll && Number(scope?.userLevelId) === 3 && scope?.userBaseId != null
  );
}
