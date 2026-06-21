import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import IncomeAgreementsModuleTabs from "layouts/income-agreements/components/IncomeAgreementsModuleTabs";
import contractApi from "services/api.contract.service";
import chartOfAccountsApi from "services/api.chartofaccounts.service";
import collectionsApi from "services/api.collections.service";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import CollectionEntryDialog from "./CollectionEntryDialog";
import CollectionsGrid from "./CollectionsGrid";
import {
  buildCollectionGroupKey,
  buildCollectionGroupParentFields,
  buildCollectionLinePayload,
  buildCollectedInvoiceKeys,
  computeCollectionGroupAmounts,
  createEmptyCollectionGroup,
  findCoaById,
  formatAccountLabel,
  formatTenantBusinessLabel,
  getActiveClassOptions,
  getValidCollectionReceiptLines,
  groupCollectionEntries,
  isTenantsControlAccount,
  mergeCollectionGroups,
  normalizeCatalogRow,
  normalizeCollectionEntryRow,
  parseInvoiceKey,
} from "./collectionsUtils";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

export default function Collections() {
  const { search } = useLocation();
  const [entries, setEntries] = useState([]);
  const [draftGroups, setDraftGroups] = useState([]);
  const [classes, setClasses] = useState([]);
  const [bases, setBases] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [coaOptions, setCoaOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dialogState, setDialogState] = useState({
    open: false,
    mode: "edit",
    groupKey: "",
    group: null,
  });

  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();
  const canCreate = canCreateCurrentMenu();

  const deepLinkFilters = useMemo(() => {
    const params = new URLSearchParams(search || "");
    return {
      invoiceNo: String(params.get("invoiceNo") || "")
        .trim()
        .toLowerCase(),
      contractNo: String(params.get("contractNo") || "")
        .trim()
        .toLowerCase(),
    };
  }, [search]);

  const loadCatalogs = useCallback(async () => {
    setLoading(true);
    try {
      const [classRes, baseRes, contractRes, invoiceRes, tenantRes, coaRes, collectionRes] =
        await Promise.all([
          api.list("class"),
          api.list("base"),
          contractApi.getAllRecords(),
          contractApi.getAllInvoiceScheduleRecords(),
          api.list("tenant"),
          chartOfAccountsApi.getAll(),
          collectionsApi.listCollections(),
        ]);

      const classRows = unwrapList(classRes).map(normalizeCatalogRow);
      const baseRows = unwrapList(baseRes).map(normalizeCatalogRow);
      const contractRows = unwrapList(contractRes?.data ?? contractRes).map(normalizeCatalogRow);
      const invoiceRows = unwrapList(invoiceRes?.data ?? invoiceRes).map(normalizeCatalogRow);
      const tenantRows = unwrapList(tenantRes).map(normalizeCatalogRow);
      const coaRows = unwrapList(coaRes)
        .map(normalizeCatalogRow)
        .filter((row) => row.id != null && isTenantsControlAccount(row.controlAccount));
      const persistedRows = collectionsApi
        .unwrapList(collectionRes)
        .map(normalizeCollectionEntryRow)
        .map((row) => {
          const tenant = tenantRows.find(
            (item) => String(item.tenantNo || "").trim() === String(row.tenantNo || "").trim()
          );
          const account = findCoaById(coaRows, row.coaId ?? tenant?.coaId ?? tenant?.CoaId);
          return {
            ...row,
            tenantBusiness: row.tenantBusiness || formatTenantBusinessLabel(row, tenant),
            accountLabel: formatAccountLabel(account),
          };
        });

      setClasses(classRows);
      setBases(baseRows);
      setContracts(contractRows);
      setInvoices(invoiceRows);
      setTenants(tenantRows);
      setCoaOptions(coaRows);
      setEntries(persistedRows);
      setDraftGroups([]);
    } catch (error) {
      console.error("Failed to load collections catalogs", error);
      setClasses([]);
      setBases([]);
      setContracts([]);
      setInvoices([]);
      setTenants([]);
      setCoaOptions([]);
      setEntries([]);
      setDraftGroups([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  const classOptions = useMemo(
    () => getActiveClassOptions(classes, bases, contracts),
    [classes, bases, contracts]
  );

  const coaById = useMemo(() => {
    const map = new Map();
    coaOptions.forEach((row) => {
      if (row.id != null) map.set(Number(row.id), row);
    });
    return map;
  }, [coaOptions]);

  const collectedInvoiceKeys = useMemo(
    () => buildCollectedInvoiceKeys(entries.filter((entry) => !entry.isLocalOnly)),
    [entries]
  );

  const groupedRows = useMemo(() => {
    const groups = groupCollectionEntries(entries);
    return mergeCollectionGroups(groups, draftGroups).map((group) =>
      buildCollectionGroupParentFields(group, {
        contracts,
        tenants,
        coaOptions,
        invoices,
        classes: classOptions,
        collectedInvoiceKeys,
      })
    );
  }, [
    entries,
    draftGroups,
    contracts,
    tenants,
    coaOptions,
    invoices,
    classOptions,
    collectedInvoiceKeys,
  ]);

  const filteredGroups = useMemo(() => {
    if (!deepLinkFilters.invoiceNo) return groupedRows;
    return groupedRows.filter((group) => {
      const { invoiceNo, contractNo } = parseInvoiceKey(group.invoiceKey);
      if (
        String(invoiceNo || "")
          .trim()
          .toLowerCase() !== deepLinkFilters.invoiceNo
      ) {
        return false;
      }
      if (!deepLinkFilters.contractNo) return true;
      return (
        String(contractNo || "")
          .trim()
          .toLowerCase() === deepLinkFilters.contractNo
      );
    });
  }, [groupedRows, deepLinkFilters]);

  const handleAddGroup = useCallback(() => {
    if (!canCreate && !canEdit) return;
    if (dialogState.open && dialogState.mode === "create") return;
    setDialogState({
      open: true,
      mode: "create",
      groupKey: "",
      group: createEmptyCollectionGroup(),
    });
  }, [canCreate, canEdit, dialogState.mode, dialogState.open]);

  const handleOpenDialog = useCallback((mode, group) => {
    setDialogState({
      open: true,
      mode,
      groupKey: group?.groupKey || "",
      group,
    });
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogState({ open: false, mode: "edit", groupKey: "", group: null });
  }, []);

  const findGroupByKey = useCallback(
    (groupKey) => filteredGroups.find((group) => group.groupKey === groupKey) || null,
    [filteredGroups]
  );

  const handleDeleteGroup = useCallback(
    async (groupKey) => {
      if (!canDelete) return;
      const group = findGroupByKey(groupKey);
      if (!group) return;
      if (!window.confirm("Delete all receipt lines for this collection?")) return;

      setSaving(true);
      try {
        const persistedIds = (group.items || [])
          .filter((item) => !item.isLocalOnly && item.id != null)
          .map((item) => item.id);
        await Promise.all(persistedIds.map((id) => collectionsApi.removeCollection(id)));
        setEntries((prev) => prev.filter((entry) => buildCollectionGroupKey(entry) !== groupKey));
        setDraftGroups((prev) => prev.filter((draft) => draft.groupKey !== groupKey));
      } catch (error) {
        console.error("Failed to delete collection group", error);
        window.alert(error?.message || "Failed to delete collection.");
      } finally {
        setSaving(false);
      }
    },
    [canDelete, findGroupByKey]
  );

  const handleSaveDialog = useCallback(
    async (savedGroup) => {
      if (!canEdit && !canCreate) return;
      const nextItems = getValidCollectionReceiptLines(savedGroup.items || []);
      const amounts = computeCollectionGroupAmounts(savedGroup.invoiceReceivable, nextItems);
      const existingGroup = findGroupByKey(savedGroup.groupKey);
      const existingItems = existingGroup?.items || [];

      const existingById = new Map(
        existingItems
          .filter((item) => !item.isLocalOnly && item.id != null)
          .map((item) => [Number(item.id), item])
      );
      const nextIds = new Set(
        nextItems
          .filter((item) => !item.isLocalOnly && item.id != null)
          .map((item) => Number(item.id))
      );
      const toDelete = [...existingById.keys()].filter((id) => !nextIds.has(id));

      setSaving(true);
      try {
        await Promise.all(toDelete.map((id) => collectionsApi.removeCollection(id)));

        for (const item of nextItems) {
          const payload = buildCollectionLinePayload(savedGroup, item, amounts);
          if (item.isLocalOnly || item.id == null || String(item.id).startsWith("line-")) {
            await collectionsApi.createCollection(payload);
          } else {
            await collectionsApi.updateCollection(item.id, payload);
          }
        }

        setDraftGroups((prev) => prev.filter((draft) => draft.groupKey !== savedGroup.groupKey));
        handleCloseDialog();
        await loadCatalogs();
      } catch (error) {
        console.error("Failed to save collection entries", error);
        window.alert(error?.message || "Failed to save collection entries.");
      } finally {
        setSaving(false);
      }
    },
    [canCreate, canEdit, findGroupByKey, handleCloseDialog, loadCatalogs]
  );

  const handleAllLinesDeleted = useCallback(async () => {
    if (dialogState.mode === "view") return;

    const group =
      dialogState.group ||
      filteredGroups.find((item) => item.groupKey === dialogState.groupKey) ||
      null;
    const persistedIds = (group?.items || [])
      .filter((item) => !item.isLocalOnly && item.id != null)
      .map((item) => item.id);

    setSaving(true);
    try {
      if (persistedIds.length > 0) {
        await Promise.all(persistedIds.map((id) => collectionsApi.removeCollection(id)));
      }
      if (group?.groupKey) {
        setEntries((prev) =>
          prev.filter((entry) => buildCollectionGroupKey(entry) !== group.groupKey)
        );
        setDraftGroups((prev) => prev.filter((draft) => draft.groupKey !== group.groupKey));
      }
      handleCloseDialog();
      await loadCatalogs();
    } catch (error) {
      console.error("Failed to delete collection after removing all receipt lines", error);
      window.alert(error?.message || "Failed to delete collection.");
    } finally {
      setSaving(false);
    }
  }, [dialogState, filteredGroups, handleCloseDialog, loadCatalogs]);

  const dialogGroup = useMemo(() => {
    if (!dialogState.open) return null;
    if (dialogState.group) return dialogState.group;
    return findGroupByKey(dialogState.groupKey);
  }, [dialogState, findGroupByKey]);

  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: filteredGroups.length,
      }),
    [filteredGroups.length]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Collections"
        subtitle="Record collections against agreement invoices"
        metadata={workspaceMetadata}
        tabs={<IncomeAgreementsModuleTabs />}
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          minHeight: 0,
        }}
      >
        <MDBox
          px={3}
          pb={3}
          sx={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <WorkspaceLoadingOverlay open={loading} />
          <CollectionsGrid
            groups={filteredGroups}
            classOptions={classOptions}
            contracts={contracts}
            invoices={invoices}
            tenants={tenants}
            coaById={coaById}
            canEdit={canEdit || canCreate}
            canDelete={canDelete}
            saving={saving}
            addDisabled={dialogState.open && dialogState.mode === "create"}
            onOpenDialog={handleOpenDialog}
            onDeleteGroup={handleDeleteGroup}
            onAddGroup={handleAddGroup}
          />
          <CollectionEntryDialog
            open={dialogState.open}
            mode={dialogState.mode}
            group={dialogGroup}
            classOptions={classOptions}
            contracts={contracts}
            tenants={tenants}
            coaOptions={coaOptions}
            invoices={invoices}
            collectedInvoiceKeys={collectedInvoiceKeys}
            saving={saving}
            onClose={handleCloseDialog}
            onSave={handleSaveDialog}
            onAllLinesDeleted={handleAllLinesDeleted}
          />
        </MDBox>
      </EnterpriseWorkspace>
    </DashboardLayout>
  );
}
