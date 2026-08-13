import {
  canSeeAllKpiOverviewData,
  getLoggedInUserBaseId,
  getLoggedInUserCmdId,
  getLoggedInUserLevelId,
} from "services/api.service";

export function getCollectionsUserScope() {
  return {
    canSeeAll: canSeeAllKpiOverviewData(),
    userCmdId: getLoggedInUserCmdId(),
    userBaseId: getLoggedInUserBaseId(),
    userLevelId: getLoggedInUserLevelId(),
  };
}

function readContractCmdId(row) {
  return String(row?.cmdId ?? row?.CmdId ?? row?.cmd ?? row?.Cmd ?? "");
}

function readContractBaseId(row) {
  return String(row?.baseId ?? row?.BaseId ?? "");
}

function readRowId(row) {
  return String(row?.id ?? row?.Id ?? "");
}

export function filterContractsForUserScope(contracts, scope = getCollectionsUserScope()) {
  if (scope?.canSeeAll) return contracts || [];
  let filtered = contracts || [];
  const cmdKey = scope?.userCmdId != null && scope.userCmdId !== "" ? String(scope.userCmdId) : "";
  if (cmdKey) {
    filtered = filtered.filter((row) => readContractCmdId(row) === cmdKey);
  }
  if (Number(scope?.userLevelId) === 3 && scope?.userBaseId != null) {
    const baseKey = String(scope.userBaseId);
    filtered = filtered.filter((row) => readContractBaseId(row) === baseKey);
  }
  return filtered;
}

export function filterBasesForUserScope(bases, scope = getCollectionsUserScope()) {
  if (scope?.canSeeAll) return bases || [];
  let filtered = bases || [];
  const cmdKey = scope?.userCmdId != null && scope.userCmdId !== "" ? String(scope.userCmdId) : "";
  if (cmdKey) {
    filtered = filtered.filter(
      (row) => String(row?.cmd ?? row?.Cmd ?? row?.cmdId ?? row?.CmdId ?? "") === cmdKey
    );
  }
  if (Number(scope?.userLevelId) === 3 && scope?.userBaseId != null) {
    const baseKey = String(scope.userBaseId);
    filtered = filtered.filter((row) => readRowId(row) === baseKey);
  }
  return filtered;
}

function buildAllowedContractKeys(contracts) {
  const ids = new Set();
  const nos = new Set();
  (contracts || []).forEach((row) => {
    const id = row?.id ?? row?.Id ?? row?.contractId ?? row?.ContractId;
    if (id != null && id !== "") {
      const n = Number(id);
      if (Number.isFinite(n)) ids.add(n);
    }
    const no = String(row?.contractNo ?? row?.ContractNo ?? "").trim();
    if (no) nos.add(no);
  });
  return { ids, nos };
}

export function filterInvoicesForUserScope(invoices, contracts, scope = getCollectionsUserScope()) {
  if (scope?.canSeeAll) return invoices || [];
  const allowed = buildAllowedContractKeys(filterContractsForUserScope(contracts, scope));
  return (invoices || []).filter((row) => {
    const contractId = row?.contractId ?? row?.ContractId;
    if (contractId != null && contractId !== "" && allowed.ids.has(Number(contractId))) {
      return true;
    }
    const contractNo = String(row?.contractNo ?? row?.ContractNo ?? "").trim();
    return contractNo && allowed.nos.has(contractNo);
  });
}

export function filterCollectionEntriesForUserScope(
  entries,
  contracts,
  scope = getCollectionsUserScope()
) {
  if (scope?.canSeeAll) return entries || [];
  const allowed = buildAllowedContractKeys(filterContractsForUserScope(contracts, scope));
  return (entries || []).filter((row) => {
    const contractId = row?.contractId ?? row?.ContractId;
    if (contractId != null && contractId !== "" && allowed.ids.has(Number(contractId))) {
      return true;
    }
    const contractNo = String(row?.contractNo ?? row?.ContractNo ?? "").trim();
    return contractNo && allowed.nos.has(contractNo);
  });
}
