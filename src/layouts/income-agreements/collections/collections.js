import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import MDBox from "components/MDBox";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import CollectionGridToolbarRegistrar from "./CollectionGridToolbarRegistrar";
import IncomeAgreementsModuleTabs from "layouts/income-agreements/components/IncomeAgreementsModuleTabs";
import { COLLECTIONS_LABELS } from "layouts/income-agreements/transactionLabels";
import contractApi from "services/api.contract.service";
import chartOfAccountsApi from "services/api.chartofaccounts.service";
import collectionsApi from "services/api.collections.service";
import customerApi from "services/api.customer.service";
import receiptsApi from "services/api.receipts.service";
import supplierApi from "services/api.supplier.service";
import uploadApi from "services/api.upload.service";
import api, {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
  isSuperuserUser,
} from "services/api.service";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { GRID_DISPLAY_DEFAULT_PAGE_SIZE } from "utils/gridDisplayPageSize";
import { ServerGridPagination } from "components/CompactGridPagination";
import CollectionsGrid from "./CollectionsGrid";
import CollectionGridColumnsMenu from "./CollectionGridColumnsMenu";
import CollectionRecordViewDialogs from "./CollectionRecordViewDialogs";
import { exportCollectionsGridToExcel } from "./collectionGridExcelExport";
import { buildCollectionsGridTemplate } from "./collectionGridShared";
import {
  deleteCollectionEntryAttachments,
  extractCreatedCollectionId,
  isPersistedCollectionLineId,
  loadCollectionLineAttachmentMeta,
  uploadCollectionLineAttachment,
  validateCollectionLineAttachmentFile,
} from "./collectionAttachmentUtils";
import {
  collectionGridRowAllowsEditDelete,
  deriveCollectionEntryStatus,
  matchesCollectionStatusFilter,
} from "./collectionReceiptUtils";
import {
  buildCollectionEntryPayload,
  createEmptyCollectionRow,
  enrichCollectionGridRow,
  findCollectionPartyOption,
  findCoaById,
  formatAccountLabel,
  formatCollectionPartyDropdownLabel,
  formatCollectionVrDateLockMessage,
  formatTenantBusinessLabel,
  getActiveClassOptions,
  isCollectionRowLockedByVrDate,
  normalizeCatalogRow,
  normalizeCollectionEntryRow,
  parseAmount,
  parseInvoiceKey,
  pickActiveLockDateYyyyMmDd,
  resolveCollectionTenantNo,
  unwrapLockDateConfigList,
} from "./collectionsUtils";
import {
  isCollectionAccountCoaOption,
  mergePartyCoaOption,
  normalizePartyCoaOption,
} from "utils/partyCoaUtils";
import lockDateApi from "services/api.lockdate.service";
import { enrichAgreementProvRowWithContractHeaderFields } from "layouts/contracts/agreement-prov-invoice/agreement-prov-invoice";

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function rowKey(row) {
  return row?.localKey || row?.id;
}

export default function Collections() {
  const { search } = useLocation();
  const [entries, setEntries] = useState([]);
  const [draftRows, setDraftRows] = useState([]);
  const [classes, setClasses] = useState([]);
  const [bases, setBases] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [coaOptions, setCoaOptions] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [statusFilter, setStatusFilter] = useState("Pending");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [hiddenColumnKeys, setHiddenColumnKeys] = useState([]);
  const [columnsAnchorEl, setColumnsAnchorEl] = useState(null);
  const [columnsSearch, setColumnsSearch] = useState("");
  const [paginationHost, setPaginationHost] = useState(null);
  const [gridPageNumber, setGridPageNumber] = useState(1);
  const [gridPageSize] = useState(GRID_DISPLAY_DEFAULT_PAGE_SIZE);
  const [activeLockDate, setActiveLockDate] = useState("");
  const [invoiceViewRow, setInvoiceViewRow] = useState(null);
  const [tenantViewData, setTenantViewData] = useState(null);

  const canEdit = canEditCurrentMenu();
  const canDelete = canDeleteCurrentMenu();
  const canCreate = canCreateCurrentMenu();
  const canEditRow = canEdit || canCreate;
  const canDeleteRow = canDelete;
  const canAddRow = canCreate || canEdit;
  const canEditStatus = isSuperuserUser();

  const rowAllowsEditDelete = useCallback(
    (row) =>
      collectionGridRowAllowsEditDelete(row, {
        isSuperuser: canEditStatus,
        allowManualOverride: canEditStatus,
      }),
    [canEditStatus]
  );

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

  const loadCatalogs = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const [
        classRes,
        baseRes,
        contractRes,
        invoiceRes,
        tenantRes,
        customerRes,
        supplierRes,
        coaRes,
        collectionRes,
        receiptRes,
      ] = await Promise.all([
        api.list("class"),
        api.list("base"),
        contractApi.getAllRecords(),
        contractApi.getAllInvoiceScheduleRecords(),
        api.list("tenant"),
        customerApi.listCustomers(),
        supplierApi.listSuppliers(),
        chartOfAccountsApi.getAll(),
        collectionsApi.listCollections(),
        receiptsApi.listReceipts(),
      ]);

      const classRows = unwrapList(classRes).map(normalizeCatalogRow);
      const baseRows = unwrapList(baseRes).map(normalizeCatalogRow);
      const contractRows = unwrapList(contractRes?.data ?? contractRes).map(normalizeCatalogRow);
      const invoiceRows = unwrapList(invoiceRes?.data ?? invoiceRes).map(normalizeCatalogRow);
      const tenantRows = unwrapList(tenantRes).map(normalizeCatalogRow);
      const customerRows = unwrapList(customerRes).map(normalizeCatalogRow);
      const supplierRows = unwrapList(supplierRes).map(normalizeCatalogRow);
      const collectionList = collectionsApi.unwrapList(collectionRes);
      let coaRows = unwrapList(coaRes)
        .map(normalizePartyCoaOption)
        .filter((row) => row.id != null && isCollectionAccountCoaOption(row));

      const savedCoaIds = [
        ...new Set(
          collectionList
            .map((row) => row?.coaId ?? row?.CoaId)
            .filter((id) => id !== "" && id != null)
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
        ),
      ];

      for (const coaId of savedCoaIds) {
        if (findCoaById(coaRows, coaId)) continue;
        try {
          const savedRow = await api.get("ChartOfAccounts", coaId);
          const option = normalizePartyCoaOption(savedRow);
          if (option.id != null) {
            coaRows = mergePartyCoaOption(coaRows, option);
          }
        } catch (error) {
          console.error("Error fetching saved collection account:", error);
        }
      }

      const persistedRows = await Promise.all(
        collectionList.map(normalizeCollectionEntryRow).map(async (row) => {
          const party = findCollectionPartyOption(
            { tenants: tenantRows, customers: customerRows, suppliers: supplierRows },
            row.tenantNo,
            row.coaId,
            coaRows
          );
          const account = findCoaById(coaRows, row.coaId ?? party?.coaId);
          const attachmentMeta = isPersistedCollectionLineId(row.id)
            ? await loadCollectionLineAttachmentMeta(row.id)
            : { hasAttachment: false, attachmentFileId: null, attachmentFileName: "" };
          return {
            ...row,
            tenantBusiness:
              row.tenantBusiness ||
              formatCollectionPartyDropdownLabel(party) ||
              formatTenantBusinessLabel(row, party),
            accountLabel: formatAccountLabel(account),
            ...attachmentMeta,
            pendingAttachmentFile: null,
          };
        })
      );

      setClasses(classRows);
      setBases(baseRows);
      setContracts(contractRows);
      setInvoices(invoiceRows);
      setTenants(tenantRows);
      setCustomers(customerRows);
      setSuppliers(supplierRows);
      setCoaOptions(coaRows);
      setReceipts(receiptsApi.unwrapList(receiptRes));
      setEntries(persistedRows);
      setDraftRows([]);
    } catch (error) {
      console.error("Failed to load collections catalogs", error);
      setClasses([]);
      setBases([]);
      setContracts([]);
      setInvoices([]);
      setTenants([]);
      setCustomers([]);
      setSuppliers([]);
      setCoaOptions([]);
      setReceipts([]);
      setEntries([]);
      setDraftRows([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCatalogs();
  }, [loadCatalogs]);

  useEffect(() => {
    let cancelled = false;
    lockDateApi
      .getAll()
      .then((response) => {
        if (!cancelled) {
          setActiveLockDate(pickActiveLockDateYyyyMmDd(unwrapLockDateConfigList(response)));
        }
      })
      .catch((error) => {
        console.error("Error fetching lock date for collections validation:", error);
        if (!cancelled) setActiveLockDate("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const classOptions = useMemo(
    () => getActiveClassOptions(classes, bases, contracts),
    [classes, bases, contracts]
  );

  const allRows = useMemo(() => {
    const editingEntryIds = new Set(
      draftRows
        .map((row) => row.editingEntryId)
        .filter((id) => id != null && id !== "")
        .map((id) => Number(id))
        .filter((id) => Number.isFinite(id))
    );
    const visibleEntries = entries.filter((row) => !editingEntryIds.has(Number(row.id)));
    return [...draftRows, ...visibleEntries];
  }, [draftRows, entries]);

  const filteredRows = useMemo(() => {
    let rows = allRows;
    if (deepLinkFilters.invoiceNo) {
      rows = rows.filter((row) => {
        const { invoiceNo, contractNo } = parseInvoiceKey(row.invoiceKey);
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
    }
    return rows.filter((row) =>
      matchesCollectionStatusFilter(row, statusFilter, {
        allowManualOverride: canEditStatus,
      })
    );
  }, [allRows, deepLinkFilters, statusFilter, canEditStatus]);

  const getRowKey = useCallback((row) => String(row?.localKey || row?.id), []);

  const filteredRowKeys = useMemo(
    () => filteredRows.map((row) => getRowKey(row)),
    [filteredRows, getRowKey]
  );

  const paginatedRows = useMemo(() => {
    const start = (gridPageNumber - 1) * gridPageSize;
    return filteredRows.slice(start, start + gridPageSize);
  }, [filteredRows, gridPageNumber, gridPageSize]);

  const totalPages = Math.ceil(filteredRows.length / gridPageSize) || 0;

  const serverPaginationNode = useMemo(
    () => (
      <ServerGridPagination
        page={gridPageNumber}
        totalCount={filteredRows.length}
        pageSize={gridPageSize}
        onPageChange={setGridPageNumber}
      />
    ),
    [filteredRows.length, gridPageNumber, gridPageSize]
  );

  const pageRowKeys = useMemo(
    () => paginatedRows.map((row) => getRowKey(row)),
    [paginatedRows, getRowKey]
  );

  const gridTemplate = useMemo(
    () => buildCollectionsGridTemplate(hiddenColumnKeys),
    [hiddenColumnKeys]
  );

  useEffect(() => {
    setGridPageNumber(1);
  }, [statusFilter, deepLinkFilters.invoiceNo, deepLinkFilters.contractNo]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / gridPageSize) || 1);
    if (gridPageNumber > totalPages) {
      setGridPageNumber(totalPages);
    }
  }, [filteredRows.length, gridPageNumber, gridPageSize]);

  const allFilteredRowsSelected =
    pageRowKeys.length > 0 && pageRowKeys.every((key) => selectedRowIds.has(key));
  const someFilteredRowsSelected =
    pageRowKeys.some((key) => selectedRowIds.has(key)) && !allFilteredRowsSelected;

  useEffect(() => {
    setSelectedRowIds((prev) => {
      const visible = new Set(filteredRowKeys);
      const next = new Set([...prev].filter((key) => visible.has(key)));
      return next.size === prev.size ? prev : next;
    });
  }, [filteredRowKeys]);

  const toggleRowSelection = useCallback((key) => {
    const id = String(key);
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const toggleAllRowSelection = useCallback(() => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (allFilteredRowsSelected) {
        pageRowKeys.forEach((key) => next.delete(key));
      } else {
        pageRowKeys.forEach((key) => next.add(key));
      }
      return next;
    });
  }, [allFilteredRowsSelected, pageRowKeys]);

  const toggleColumnVisibility = useCallback((columnKey) => {
    const key = String(columnKey || "").trim();
    if (!key) return;
    setHiddenColumnKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return Array.from(next);
    });
  }, []);

  const showAllColumns = useCallback(() => {
    setHiddenColumnKeys([]);
  }, []);

  const exportContext = useMemo(
    () => ({
      contracts,
      tenants,
      customers,
      suppliers,
      coaOptions,
      invoices,
      classOptions,
    }),
    [contracts, tenants, customers, suppliers, coaOptions, invoices, classOptions]
  );

  const handleExportToExcel = useCallback(() => {
    try {
      const rowsToExport =
        selectedRowIds.size > 0
          ? filteredRows.filter((row) => selectedRowIds.has(getRowKey(row)))
          : filteredRows;
      if (!rowsToExport.length) {
        window.alert("No collection records to export.");
        return;
      }
      exportCollectionsGridToExcel(rowsToExport, exportContext, {
        fileName: COLLECTIONS_LABELS.exportFileName,
        canEditStatus,
        hiddenColumnKeys,
      });
    } catch (error) {
      console.error("Collections export failed:", error);
      window.alert("Export failed. Please try again.");
    }
  }, [selectedRowIds, filteredRows, getRowKey, exportContext, canEditStatus, hiddenColumnKeys]);

  const handleOpenColumnsMenu = useCallback((anchorEl) => {
    setColumnsAnchorEl(anchorEl);
  }, []);

  const updateRowState = useCallback((key, updates) => {
    const apply = (row) => (rowKey(row) === key ? { ...row, ...updates } : row);
    setDraftRows((prev) => {
      if (!prev.some((row) => rowKey(row) === key)) return prev;
      return prev.map(apply);
    });
    setEntries((prev) => {
      if (!prev.some((row) => rowKey(row) === key)) return prev;
      return prev.map(apply);
    });
  }, []);

  const findRowByKey = useCallback(
    (key) => allRows.find((row) => rowKey(row) === key) || null,
    [allRows]
  );

  const clearOtherEditingRows = useCallback((activeKey) => {
    setDraftRows((prev) => prev.filter((row) => activeKey && rowKey(row) === activeKey));
  }, []);

  const handleEditRow = useCallback(
    (key) => {
      const row = allRows.find((item) => rowKey(item) === key);
      if (!row) return;

      if (row.isLocalOnly) {
        if (!canAddRow) return;
        if (isCollectionRowLockedByVrDate(row, activeLockDate)) {
          window.alert(formatCollectionVrDateLockMessage(activeLockDate));
          return;
        }
        clearOtherEditingRows(key);
        updateRowState(key, { isEditing: true });
        return;
      }

      if (!canEditRow) return;
      if (!rowAllowsEditDelete(row)) return;

      if (isCollectionRowLockedByVrDate(row, activeLockDate)) {
        window.alert(formatCollectionVrDateLockMessage(activeLockDate));
        return;
      }

      clearOtherEditingRows("");
      const draftKey = `edit-${row.id}`;
      setDraftRows([
        {
          ...row,
          localKey: draftKey,
          isEditing: true,
          isLocalOnly: false,
          editingEntryId: row.id,
          pendingAttachmentFile: null,
        },
      ]);
    },
    [
      allRows,
      activeLockDate,
      canAddRow,
      canEditRow,
      clearOtherEditingRows,
      rowAllowsEditDelete,
      updateRowState,
    ]
  );

  const handleCancelEditRow = useCallback((key) => {
    setDraftRows((prev) => prev.filter((item) => rowKey(item) !== key));
  }, []);

  const handleAddRow = useCallback(() => {
    if (!canAddRow) return;
    clearOtherEditingRows("");
    setDraftRows((prev) => [createEmptyCollectionRow(), ...prev]);
  }, [canAddRow, clearOtherEditingRows]);

  const handleDuplicateRow = useCallback(
    (key) => {
      const source = findRowByKey(key);
      if (!source) return;
      const duplicate = createEmptyCollectionRow({
        classId: source.classId,
        contractId: source.contractId,
        tenantNo: source.tenantNo,
        tenantBusiness: source.tenantBusiness,
        accountLabel: source.accountLabel,
        coaId: source.coaId,
        invoiceKey: source.invoiceKey,
        amount: source.amount,
        tinTrn: source.tinTrn,
        remarks: source.remarks,
        status: source.status,
        vrNo: source.vrNo,
        vrDate: source.vrDate,
        receiptId: source.receiptId,
      });
      setDraftRows((prev) => [duplicate, ...prev]);
    },
    [findRowByKey]
  );

  const handleAttachmentSelect = useCallback(
    (key, file) => {
      const validationError = validateCollectionLineAttachmentFile(file);
      if (validationError) {
        window.alert(validationError);
        return;
      }
      updateRowState(key, {
        pendingAttachmentFile: file,
        attachmentFileName: file.name,
      });
    },
    [updateRowState]
  );

  const handleClearPendingAttachment = useCallback(
    (key) => {
      const row = findRowByKey(key);
      updateRowState(key, {
        pendingAttachmentFile: null,
        attachmentFileName: row?.hasAttachment ? row.attachmentFileName : "",
      });
    },
    [findRowByKey, updateRowState]
  );

  const handleDownloadAttachment = useCallback(async (row) => {
    if (!row?.attachmentFileId) return;
    try {
      await uploadApi.downloadFileById(row.attachmentFileId, row.attachmentFileName || "image");
    } catch (error) {
      console.error("Failed to download collection attachment:", error);
      window.alert(error?.message || "Failed to download image.");
    }
  }, []);

  const handleDeleteRow = useCallback(
    async (key) => {
      if (!canDeleteRow) return;
      const row = findRowByKey(key);
      if (!row) return;
      if (!rowAllowsEditDelete(row)) return;
      if (!window.confirm("Delete this collection entry?")) return;

      const deleteId = row.editingEntryId ?? row.id;

      if (row.isLocalOnly && !row.editingEntryId) {
        setDraftRows((prev) => prev.filter((item) => rowKey(item) !== key));
        setSelectedRowIds((prev) => {
          const id = String(key);
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      if (!isPersistedCollectionLineId(deleteId)) {
        setDraftRows((prev) => prev.filter((item) => rowKey(item) !== key));
        setSelectedRowIds((prev) => {
          const id = String(key);
          if (!prev.has(id)) return prev;
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
        return;
      }

      setSaving(true);
      try {
        await deleteCollectionEntryAttachments(deleteId);
        await collectionsApi.removeCollection(deleteId);
        setDraftRows((prev) => prev.filter((item) => rowKey(item) !== key));
        setEntries((prev) => prev.filter((item) => Number(item.id) !== Number(deleteId)));
        setSelectedRowIds((prev) => {
          const next = new Set(prev);
          next.delete(String(key));
          next.delete(String(deleteId));
          return next;
        });
      } catch (error) {
        console.error("Failed to delete collection entry", error);
        window.alert(error?.message || "Failed to delete collection entry.");
      } finally {
        setSaving(false);
      }
    },
    [canDeleteRow, findRowByKey, rowAllowsEditDelete]
  );

  const handleSaveRow = useCallback(
    async (key) => {
      if (!canEdit && !canCreate) return;
      const row = findRowByKey(key);
      if (!row) return;

      if (isCollectionRowLockedByVrDate(row, activeLockDate)) {
        window.alert(formatCollectionVrDateLockMessage(activeLockDate));
        return;
      }

      const enriched = enrichCollectionGridRow(row, {
        contracts,
        tenants,
        customers,
        suppliers,
        coaOptions,
        invoices,
        classes: classOptions,
        allRows,
      });
      const resolvedStatus = deriveCollectionEntryStatus(enriched, {
        allowManualOverride: canEditStatus,
      });
      const payload = buildCollectionEntryPayload({
        ...enriched,
        status: resolvedStatus,
        receivable: enriched.invoiceReceivable,
      });

      if (!String(enriched.tenantNo || enriched.tenantBusiness || "").trim()) {
        window.alert("Please select Tenant and Business.");
        return;
      }
      if (!String(enriched.coaId || "").trim()) {
        window.alert("Please select Account.");
        return;
      }
      if (parseAmount(enriched.amount) < 0) {
        window.alert("Amount must be greater than or equal to 0.");
        return;
      }

      setSaving(true);
      try {
        let entryId = null;
        const persistedId = row.editingEntryId ?? row.id;
        if (row.isLocalOnly && !row.editingEntryId) {
          const created = await collectionsApi.createCollection(payload);
          entryId = extractCreatedCollectionId(created);
        } else if (isPersistedCollectionLineId(persistedId)) {
          entryId = Number(persistedId);
          await collectionsApi.updateCollection(persistedId, payload);
        } else {
          throw new Error("Unable to determine collection entry to save.");
        }

        if (row.pendingAttachmentFile) {
          if (!entryId) {
            throw new Error("Failed to save collection before uploading receipt image.");
          }
          await uploadCollectionLineAttachment(entryId, row.pendingAttachmentFile, {
            replaceExisting: true,
          });
        }

        setDraftRows((prev) => prev.filter((item) => rowKey(item) !== key));
        setSelectedRowIds((prev) => {
          const next = new Set(prev);
          next.delete(String(key));
          if (entryId != null) next.delete(String(entryId));
          return next;
        });

        await loadCatalogs({ silent: true });

        if (resolvedStatus === "Received") {
          setStatusFilter("Received");
        } else if (resolvedStatus === "Pending" && statusFilter === "Received") {
          setStatusFilter("Pending");
        }
        setGridPageNumber(1);
      } catch (error) {
        console.error("Failed to save collection entry", error);
        window.alert(error?.message || "Failed to save collection entry.");
      } finally {
        setSaving(false);
      }
    },
    [
      activeLockDate,
      allRows,
      canCreate,
      canEdit,
      canEditStatus,
      classOptions,
      coaOptions,
      contracts,
      findRowByKey,
      invoices,
      loadCatalogs,
      statusFilter,
      tenants,
      customers,
      suppliers,
    ]
  );

  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: filteredRows.length,
      }),
    [filteredRows.length]
  );

  const buildCollectionViewContext = useCallback(
    (row) =>
      enrichCollectionGridRow(row, {
        contracts,
        tenants,
        customers,
        suppliers,
        coaOptions,
        invoices,
        classes: classOptions,
        allRows,
      }),
    [allRows, classOptions, coaOptions, contracts, customers, invoices, suppliers, tenants]
  );

  const handleViewInvoiceFromGrid = useCallback(
    (row) => {
      const enriched = buildCollectionViewContext(row);
      const invoice = enriched.selectedInvoice;
      if (!invoice) return;
      setInvoiceViewRow(enrichAgreementProvRowWithContractHeaderFields(invoice, invoices));
    },
    [buildCollectionViewContext, invoices]
  );

  const handleViewTenantFromGrid = useCallback(
    (row) => {
      const enriched = buildCollectionViewContext(row);
      const tenantNo = resolveCollectionTenantNo(enriched, enriched.selectedContract, tenants);
      const party = findCollectionPartyOption(
        { tenants, customers, suppliers },
        tenantNo,
        enriched.coaId,
        coaOptions
      );
      if (!party) return;
      setTenantViewData(party);
    },
    [buildCollectionViewContext, coaOptions, customers, suppliers, tenants]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title="Collections"
        subtitle="Record collections against agreement invoices"
        metadata={workspaceMetadata}
        tabs={<IncomeAgreementsModuleTabs />}
        filters={
          <MDBox
            ref={setPaginationHost}
            className="income-agreements-filter-pagination saas-settings-table-pagination-top"
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexShrink: 0,
              width: "100%",
              px: 1,
              minHeight: totalPages > 1 ? 28 : 0,
              "& .MuiPaginationItem-root": {
                fontSize: "0.6rem",
                minWidth: "1.2rem",
                height: "1.2rem",
                padding: "0 2px",
              },
              "& .MuiPaginationItem-icon": {
                fontSize: "0.8rem",
              },
              "& .compact-grid-pagination": {
                gap: 0,
              },
            }}
          />
        }
        bodySx={{
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          position: "relative",
          minHeight: 0,
        }}
      >
        <CollectionGridToolbarRegistrar
          onExportToExcel={handleExportToExcel}
          onOpenColumnsMenu={handleOpenColumnsMenu}
        />
        <MDBox
          px={3}
          pb={3}
          sx={{ flex: "1 1 0", minHeight: 0, display: "flex", flexDirection: "column" }}
        >
          <WorkspaceLoadingOverlay open={loading} />
          <CollectionsGrid
            rows={paginatedRows}
            totalRowCount={filteredRows.length}
            rowIndexOffset={(gridPageNumber - 1) * gridPageSize}
            gridTemplate={gridTemplate}
            hiddenColumnKeys={hiddenColumnKeys}
            statusFilter={statusFilter}
            onStatusFilterChange={setStatusFilter}
            classOptions={classOptions}
            contracts={contracts}
            invoices={invoices}
            tenants={tenants}
            customers={customers}
            suppliers={suppliers}
            coaOptions={coaOptions}
            receipts={receipts}
            canCreate={canAddRow}
            canEditRow={canEditRow}
            canDeleteRow={canDeleteRow}
            canEditStatus={canEditStatus}
            activeLockDate={activeLockDate}
            saving={saving}
            onRowChange={updateRowState}
            onSaveRow={handleSaveRow}
            onEditRow={handleEditRow}
            onCancelEditRow={handleCancelEditRow}
            onDeleteRow={handleDeleteRow}
            onDuplicateRow={handleDuplicateRow}
            onAddRow={handleAddRow}
            onAttachmentSelect={handleAttachmentSelect}
            onClearPendingAttachment={handleClearPendingAttachment}
            onDownloadAttachment={handleDownloadAttachment}
            onViewTenant={handleViewTenantFromGrid}
            onViewInvoice={handleViewInvoiceFromGrid}
            selectedRowIds={selectedRowIds}
            allRowsSelected={allFilteredRowsSelected}
            someRowsSelected={someFilteredRowsSelected}
            onToggleRowSelection={toggleRowSelection}
            onToggleAllRowSelection={toggleAllRowSelection}
            getRowKey={getRowKey}
          />
          {paginationHost && totalPages > 1
            ? createPortal(serverPaginationNode, paginationHost)
            : null}
          <CollectionGridColumnsMenu
            anchorEl={columnsAnchorEl}
            open={Boolean(columnsAnchorEl)}
            onClose={() => {
              setColumnsAnchorEl(null);
              setColumnsSearch("");
            }}
            hiddenColumnKeys={hiddenColumnKeys}
            onToggleColumn={toggleColumnVisibility}
            onShowAllColumns={showAllColumns}
            search={columnsSearch}
            onSearchChange={setColumnsSearch}
          />
        </MDBox>
      </EnterpriseWorkspace>
      <CollectionRecordViewDialogs
        invoiceRowData={invoiceViewRow}
        onCloseInvoice={() => setInvoiceViewRow(null)}
        tenantData={tenantViewData}
        onCloseTenant={() => setTenantViewData(null)}
      />
    </DashboardLayout>
  );
}
