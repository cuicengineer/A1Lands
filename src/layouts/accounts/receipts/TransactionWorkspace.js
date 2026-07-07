import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Tabs from "@mui/material/Tabs";
import Tab from "@mui/material/Tab";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Checkbox from "@mui/material/Checkbox";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import CurrencyLoading from "components/CurrencyLoading";
import uploadApi from "services/api.upload.service";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import IncomeAgreementsModuleTabs from "layouts/income-agreements/components/IncomeAgreementsModuleTabs";
import CashFundFlowModuleTabs from "layouts/cash-fund-flow/components/CashFundFlowModuleTabs";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { GRID_DISPLAY_DEFAULT_PAGE_SIZE } from "utils/gridDisplayPageSize";
import { ServerGridPagination } from "components/CompactGridPagination";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import AgreementProvPdfPreviewDialog from "components/AgreementProvPdfPreviewDialog";
import {
  loadReceiptPdfMargins,
  RECEIPT_PDF_DEFAULT_MARGINS,
  saveReceiptPdfMargins,
} from "utils/agreementProvPdfMargins";
import ReceiptForm from "./ReceiptForm";
import {
  computeGrandTotal,
  flattenReceiptForGrid,
  formatAmount,
  isReceiptFinalizedByAhq,
  RECEIPT_AHQ_TAB,
} from "./receiptUtils";
import { flattenPaymentForGrid, mapPaymentForVoucherPdf } from "./paymentUtils";
import {
  fetchTransactionAttachmentCount,
  fetchTransactionUploadedFiles,
  PAYMENT_UPLOAD_FORM_NAME,
  RECEIPT_UPLOAD_FORM_NAME,
} from "./receiptAttachmentUtils";
import { generateReceiptPdf } from "./receiptPdf";
import receiptsApi from "services/api.receipts.service";
import paymentsApi from "services/api.payments.service";
import { isSuperuserOrAhqSupervisorUser } from "services/api.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridAmount,
  renderCollectionsGridSno,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";
import {
  formatTransactionLockDateValidationMessage,
  isDateLockedByLockDate,
  pickActiveLockDateYyyyMmDd,
  unwrapLockDateConfigList,
} from "layouts/income-agreements/collections/collectionsUtils";
import lockDateApi from "services/api.lockdate.service";

function readReceiptRouteFilters() {
  if (typeof window === "undefined") {
    return { contractNo: "", tab: "", view: "", vrNo: "", receiptId: "" };
  }
  const readFromSearch = (searchText) => {
    const params = new URLSearchParams(String(searchText || ""));
    return {
      contractNo: String(params.get("contractNo") || "").trim(),
      tab: String(params.get("tab") || "")
        .trim()
        .toLowerCase(),
      view: String(params.get("view") || "")
        .trim()
        .toLowerCase(),
      vrNo: String(params.get("vrNo") || params.get("reference") || "").trim(),
      receiptId: String(params.get("receiptId") || "").trim(),
    };
  };
  const fromSearch = readFromSearch(window.location.search);
  if (
    fromSearch.contractNo ||
    fromSearch.tab ||
    fromSearch.view ||
    fromSearch.vrNo ||
    fromSearch.receiptId
  ) {
    return fromSearch;
  }
  const hash = String(window.location.hash || "");
  const queryIndex = hash.indexOf("?");
  return queryIndex >= 0
    ? readFromSearch(hash.slice(queryIndex))
    : { contractNo: "", tab: "", view: "", vrNo: "", receiptId: "" };
}

function receiptLineMatchesContract(line, contractNo) {
  const target = String(contractNo || "")
    .trim()
    .toLowerCase();
  if (!target) return true;

  const directContract = String(line?.contractNo ?? line?.ContractNo ?? "")
    .trim()
    .toLowerCase();
  if (directContract === target) return true;

  const invoiceKey = String(line?.invoiceKey ?? line?.InvoiceKey ?? "").trim();
  if (!invoiceKey.includes("|")) return false;
  const [keyContractNo] = invoiceKey.split("|");
  return (
    String(keyContractNo || "")
      .trim()
      .toLowerCase() === target
  );
}

function receiptMatchesContract(receipt, contractNo) {
  if (!contractNo) return true;
  return (receipt?.lines || []).some((line) => receiptLineMatchesContract(line, contractNo));
}

function receiptMatchesVrNo(receipt, vrNo, receiptId) {
  const targetReceiptId = String(receiptId || "").trim();
  if (targetReceiptId) {
    return String(receipt?.id ?? "") === targetReceiptId;
  }
  const target = String(vrNo || "")
    .trim()
    .toLowerCase();
  if (!target) return true;
  const reference = String(receipt?.reference ?? receipt?.Reference ?? "")
    .trim()
    .toLowerCase();
  return reference === target;
}

function formatDateDisplay(value) {
  if (!value) return "-";
  return formatDateDDMMMYYYY(value) || "-";
}

function formatLegacyDateDisplay(value) {
  if (!value) return "-";
  const raw = String(value).trim();
  if (!raw) return "-";
  const [year, month, day] = raw.split("-");
  if (year && month && day) return `${day}-${month}-${year}`;
  return raw;
}

function TransactionWorkspace({
  labels,
  incomeAgreementsModule,
  useReceiptApi = false,
  usePaymentApi = false,
}) {
  const [records, setRecords] = useState([]);
  const [paginationHost, setPaginationHost] = useState(null);
  const [gridPageNumber, setGridPageNumber] = useState(1);
  const [gridPageSize, setGridPageSize] = useState(GRID_DISPLAY_DEFAULT_PAGE_SIZE);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [readOnlyForm, setReadOnlyForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [attachmentsDialogOpen, setAttachmentsDialogOpen] = useState(false);
  const [attachmentsRecord, setAttachmentsRecord] = useState(null);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsFiles, setAttachmentsFiles] = useState([]);
  const [attachmentCountsById, setAttachmentCountsById] = useState({});
  const [ahqTab, setAhqTab] = useState(RECEIPT_AHQ_TAB.PENDING);
  const [receiptFinalizedDraft, setReceiptFinalizedDraft] = useState({});
  const [savingReceiptAhq, setSavingReceiptAhq] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewRecord, setPdfPreviewRecord] = useState(null);
  const [activeLockDate, setActiveLockDate] = useState("");
  const routeFilters = useMemo(() => readReceiptRouteFilters(), []);
  const routeContractNoFilter = useReceiptApi ? routeFilters.contractNo : "";
  const routeVrNoFilter = useReceiptApi ? routeFilters.vrNo : "";
  const routeReceiptIdFilter = useReceiptApi ? routeFilters.receiptId : "";
  const isGridOnlyView =
    useReceiptApi &&
    routeFilters.view === "grid" &&
    Boolean(routeVrNoFilter || routeReceiptIdFilter);
  const hasVrNoRouteFilter = Boolean(routeVrNoFilter || routeReceiptIdFilter);

  const showAhqTabs = useReceiptApi && !hasVrNoRouteFilter;
  const showMonthField = Boolean(labels.gridMonth);
  const canManageReceiptAhq = useReceiptApi && isSuperuserOrAhqSupervisorUser();

  const vrFilteredRecords = useMemo(() => {
    if (!hasVrNoRouteFilter) return records;
    return records.filter((record) =>
      receiptMatchesVrNo(record, routeVrNoFilter, routeReceiptIdFilter)
    );
  }, [hasVrNoRouteFilter, records, routeReceiptIdFilter, routeVrNoFilter]);

  const pendingRecords = useMemo(
    () => vrFilteredRecords.filter((record) => !isReceiptFinalizedByAhq(record)),
    [vrFilteredRecords]
  );
  const finalizedRecords = useMemo(
    () => vrFilteredRecords.filter((record) => isReceiptFinalizedByAhq(record)),
    [vrFilteredRecords]
  );
  const routeFilteredPendingRecords = useMemo(
    () =>
      routeContractNoFilter
        ? pendingRecords.filter((record) => receiptMatchesContract(record, routeContractNoFilter))
        : pendingRecords,
    [pendingRecords, routeContractNoFilter]
  );
  const routeFilteredFinalizedRecords = useMemo(
    () =>
      routeContractNoFilter
        ? finalizedRecords.filter((record) => receiptMatchesContract(record, routeContractNoFilter))
        : finalizedRecords,
    [finalizedRecords, routeContractNoFilter]
  );
  const visibleRecords = useMemo(() => {
    if (hasVrNoRouteFilter) return vrFilteredRecords;
    if (!showAhqTabs) return records;
    return ahqTab === RECEIPT_AHQ_TAB.FINALIZED
      ? routeFilteredFinalizedRecords
      : routeFilteredPendingRecords;
  }, [
    ahqTab,
    hasVrNoRouteFilter,
    records,
    routeFilteredFinalizedRecords,
    routeFilteredPendingRecords,
    showAhqTabs,
    vrFilteredRecords,
  ]);

  const paginatedVisibleRecords = useMemo(() => {
    const start = (gridPageNumber - 1) * gridPageSize;
    return visibleRecords.slice(start, start + gridPageSize);
  }, [visibleRecords, gridPageNumber, gridPageSize]);

  const totalPages = Math.ceil(visibleRecords.length / gridPageSize) || 0;

  useEffect(() => {
    setGridPageNumber(1);
  }, [ahqTab, routeContractNoFilter, hasVrNoRouteFilter]);

  useEffect(() => {
    const maxPages = Math.max(1, Math.ceil(visibleRecords.length / gridPageSize) || 1);
    if (gridPageNumber > maxPages) {
      setGridPageNumber(maxPages);
    }
  }, [visibleRecords.length, gridPageNumber, gridPageSize]);
  const recordPendingDelete = useMemo(
    () => records.find((row) => Number(row.id) === Number(recordToDelete)) || null,
    [recordToDelete, records]
  );
  const receiptAhqChangedRecords = useMemo(
    () =>
      records.filter((record) => {
        const id = String(record?.id ?? "");
        if (!id || !(id in receiptFinalizedDraft)) return false;
        return Boolean(receiptFinalizedDraft[id]) !== isReceiptFinalizedByAhq(record);
      }),
    [receiptFinalizedDraft, records]
  );

  const useTransactionApi = useReceiptApi || usePaymentApi;
  const uploadFormName = usePaymentApi ? PAYMENT_UPLOAD_FORM_NAME : RECEIPT_UPLOAD_FORM_NAME;

  const loadAttachmentCounts = useCallback(
    async (rows) => {
      if (!rows?.length) {
        setAttachmentCountsById({});
        return;
      }
      const results = await Promise.allSettled(
        rows.map(async (row) => {
          const count = await fetchTransactionAttachmentCount(row.id, uploadFormName);
          return [row.id, count];
        })
      );
      const next = {};
      results.forEach((result) => {
        if (result.status === "fulfilled") {
          const [id, count] = result.value;
          next[id] = count;
        }
      });
      setAttachmentCountsById(next);
    },
    [uploadFormName]
  );

  const refreshAttachmentCount = useCallback(
    async (recordId) => {
      if (recordId == null) return;
      const count = await fetchTransactionAttachmentCount(recordId, uploadFormName);
      setAttachmentCountsById((prev) => ({ ...prev, [recordId]: count }));
    },
    [uploadFormName]
  );

  useEffect(() => {
    if (!useTransactionApi) return undefined;

    let cancelled = false;
    lockDateApi
      .getAll()
      .then((response) => {
        if (!cancelled) {
          setActiveLockDate(pickActiveLockDateYyyyMmDd(unwrapLockDateConfigList(response)));
        }
      })
      .catch((error) => {
        console.error("Error fetching lock date for transaction validation:", error);
        if (!cancelled) setActiveLockDate("");
      });

    return () => {
      cancelled = true;
    };
  }, [useTransactionApi]);

  useEffect(() => {
    if (!useTransactionApi) return undefined;

    let mounted = true;
    const loadRecords = async () => {
      try {
        const response = usePaymentApi
          ? await paymentsApi.listPayments()
          : await receiptsApi.listReceipts();
        if (!mounted) return;
        const normalize = usePaymentApi
          ? paymentsApi.normalizePaymentRow
          : receiptsApi.normalizeReceiptRow;
        const apiClient = usePaymentApi ? paymentsApi : receiptsApi;
        const rows = apiClient.unwrapList(response).map(normalize);
        setRecords(rows);
        await loadAttachmentCounts(rows);
      } catch (error) {
        console.error(`Failed to load ${usePaymentApi ? "payments" : "receipts"}:`, error);
        if (mounted) {
          window.alert(`Failed to load ${usePaymentApi ? "payments" : "receipts"}.`);
          setAttachmentCountsById({});
        }
      }
    };

    loadRecords();
    return () => {
      mounted = false;
    };
  }, [loadAttachmentCounts, usePaymentApi, useReceiptApi, useTransactionApi]);

  useEffect(() => {
    if (!useReceiptApi) return;
    if (routeFilters.tab === RECEIPT_AHQ_TAB.FINALIZED || routeContractNoFilter) {
      setAhqTab(RECEIPT_AHQ_TAB.FINALIZED);
    }
  }, [routeContractNoFilter, routeFilters.tab, useReceiptApi]);

  const txt = (v) => renderCollectionsGridText(v);
  const canDeleteReceiptRecord = (record) =>
    canDeleteCurrentMenu() &&
    (!useReceiptApi || !isReceiptFinalizedByAhq(record) || isSuperuserOrAhqSupervisorUser());

  const isRecordLockedByDate = useCallback(
    (record) => isDateLockedByLockDate(record?.date, activeLockDate),
    [activeLockDate]
  );

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setReadOnlyForm(false);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
    setReadOnlyForm(false);
  };

  const handleEditRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    if (isRecordLockedByDate(record)) {
      window.alert(formatTransactionLockDateValidationMessage(activeLockDate));
      return;
    }
    setCurrentRecord(record);
    setReadOnlyForm(false);
    setOpenForm(true);
  };

  const handleViewRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    setCurrentRecord(record);
    setReadOnlyForm(true);
    setOpenForm(true);
  };

  const handleOpenReceiptPdfPreview = (record) => {
    if (!record) return;
    setPdfPreviewRecord(record);
    setPdfPreviewOpen(true);
  };

  const handleCloseReceiptPdfPreview = () => {
    setPdfPreviewOpen(false);
    setPdfPreviewRecord(null);
  };

  const generateReceiptPdfBlob = useCallback(
    (record, marginsIn) => {
      const pdfRecord = usePaymentApi ? mapPaymentForVoucherPdf(record) : record;
      return generateReceiptPdf(pdfRecord, marginsIn, {
        openNewTab: false,
        documentTitle: usePaymentApi ? "Payment Voucher" : "Receipt Voucher",
      });
    },
    [usePaymentApi]
  );

  const handleDeleteRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!canDeleteReceiptRecord(record)) return;
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    if (!canDeleteReceiptRecord(recordPendingDelete)) {
      window.alert("Only superuser or AHQ supervisor users can delete finalized receipts.");
      return;
    }
    if (useTransactionApi) {
      try {
        if (usePaymentApi) {
          await paymentsApi.removePayment(recordToDelete);
        } else {
          await receiptsApi.removeReceipt(recordToDelete);
        }
      } catch (error) {
        console.error(`Failed to delete ${usePaymentApi ? "payment" : "receipt"}:`, error);
        window.alert(`Failed to delete ${usePaymentApi ? "payment" : "receipt"}.`);
        return;
      }
    }
    setRecords((prev) => prev.filter((row) => Number(row.id) !== Number(recordToDelete)));
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleOpenAttachments = async (record) => {
    if (!record?.id) return;
    setAttachmentsRecord(record);
    setAttachmentsDialogOpen(true);
    setAttachmentsLoading(true);
    try {
      const files = await fetchTransactionUploadedFiles(record.id, uploadFormName);
      setAttachmentsFiles(files);
    } catch (error) {
      console.error("Failed to load attachments:", error);
      setAttachmentsFiles([]);
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleDeleteAttachment = async (file) => {
    if (!canDeleteCurrentMenu()) return;
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      window.alert("File ID is not available. Cannot delete this file.");
      return;
    }
    if (!window.confirm(`Delete "${file.fileName || file.name || "this file"}"?`)) return;
    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (attachmentsRecord?.id) {
        setAttachmentsLoading(true);
        const files = await fetchTransactionUploadedFiles(attachmentsRecord.id, uploadFormName);
        setAttachmentsFiles(files);
        setAttachmentCountsById((prev) => ({
          ...prev,
          [attachmentsRecord.id]: files.length,
        }));
      }
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      window.alert(error?.message || "Failed to delete file.");
    } finally {
      setAttachmentsLoading(false);
    }
  };

  const handleCloseAttachments = () => {
    setAttachmentsDialogOpen(false);
    setAttachmentsRecord(null);
    setAttachmentsFiles([]);
  };

  const getReceiptFinalizedDraftValue = (record) => {
    const id = String(record?.id ?? "");
    if (id && id in receiptFinalizedDraft) return Boolean(receiptFinalizedDraft[id]);
    return isReceiptFinalizedByAhq(record);
  };

  const handleReceiptFinalizedDraftChange = (record, checked) => {
    if (!record?.id || !canManageReceiptAhq) return;
    const id = String(record.id);
    const originalValue = isReceiptFinalizedByAhq(record);
    setReceiptFinalizedDraft((prev) => {
      const next = { ...prev };
      if (checked === originalValue) {
        delete next[id];
      } else {
        next[id] = checked;
      }
      return next;
    });
  };

  const handleSaveReceiptAhqChanges = async () => {
    if (!canManageReceiptAhq || !receiptAhqChangedRecords.length) return;
    setSavingReceiptAhq(true);
    try {
      const updates = await Promise.all(
        receiptAhqChangedRecords.map(async (record) => {
          const finalizedByAhq = Boolean(receiptFinalizedDraft[String(record.id)]);
          const payload = receiptsApi.buildReceiptFinalizePayload(record, finalizedByAhq);
          await receiptsApi.updateReceipt(record.id, payload);
          return receiptsApi.normalizeReceiptRow({
            ...payload,
            Id: record.id,
          });
        })
      );
      const byId = new Map(updates.map((row) => [Number(row.id), row]));
      setRecords((prev) => prev.map((row) => byId.get(Number(row.id)) || row));
      setReceiptFinalizedDraft({});
    } catch (error) {
      console.error("Failed to save receipt AHQ finalization:", error);
      window.alert("Failed to save receipt AHQ finalization.");
    } finally {
      setSavingReceiptAhq(false);
    }
  };

  const handleSubmit = async (payload) => {
    if (isDateLockedByLockDate(payload?.date, activeLockDate)) {
      window.alert(formatTransactionLockDateValidationMessage(activeLockDate));
      return undefined;
    }
    const existingId = currentRecord?.id;
    const grandTotal = computeGrandTotal(payload.lines);

    if (useTransactionApi) {
      const canFinalizeByAhq = Boolean(existingId) && isSuperuserOrAhqSupervisorUser();
      try {
        if (usePaymentApi) {
          const apiPayload = paymentsApi.buildPaymentApiPayload(payload, grandTotal);
          if (existingId) {
            await paymentsApi.updatePayment(existingId, apiPayload);
            const normalized = paymentsApi.normalizePaymentRow({
              ...apiPayload,
              Id: existingId,
            });
            setRecords((prev) =>
              prev.map((row) => (Number(row.id) === Number(existingId) ? normalized : row))
            );
            return { id: existingId };
          }
          const created = await paymentsApi.createPayment(apiPayload);
          const createdId = created?.id ?? created?.Id;
          const normalized = paymentsApi.normalizePaymentRow({
            ...apiPayload,
            ...(created || {}),
            Id: createdId,
          });
          setRecords((prev) => [normalized, ...prev]);
          if (createdId) await refreshAttachmentCount(createdId);
          return { id: createdId };
        }

        const apiPayload = receiptsApi.buildReceiptApiPayload(payload, grandTotal, {
          includeFinalizedByAhq: canFinalizeByAhq,
        });
        if (existingId) {
          await receiptsApi.updateReceipt(existingId, apiPayload);
          const normalized = receiptsApi.normalizeReceiptRow({
            ...apiPayload,
            ...(canFinalizeByAhq ? {} : { FinalizedByAhq: currentRecord?.finalizedByAhq }),
            Id: existingId,
          });
          setRecords((prev) =>
            prev.map((row) => (Number(row.id) === Number(existingId) ? normalized : row))
          );
          return { id: existingId };
        }

        const created = await receiptsApi.createReceipt(apiPayload);
        const createdId = created?.id ?? created?.Id;
        const normalized = receiptsApi.normalizeReceiptRow({
          ...apiPayload,
          ...(created || {}),
          Id: createdId,
        });
        setRecords((prev) => [normalized, ...prev]);
        if (createdId) await refreshAttachmentCount(createdId);
        return { id: createdId };
      } catch (error) {
        console.error(`Failed to save ${usePaymentApi ? "payment" : "receipt"}:`, error);
        window.alert(`Failed to save ${usePaymentApi ? "payment" : "receipt"}.`);
        throw error;
      }
    }

    if (existingId) {
      setRecords((prev) =>
        prev.map((row) =>
          Number(row.id) === Number(existingId) ? { ...payload, id: existingId } : row
        )
      );
      return { id: existingId };
    }
    const nextId = records.length ? Math.max(...records.map((r) => Number(r.id) || 0)) + 1 : 1;
    setRecords((prev) => [{ ...payload, id: nextId }, ...prev]);
    return { id: nextId };
  };

  const columns = useMemo(() => {
    if (usePaymentApi) {
      return [
        {
          id: "pdfView",
          Header: "View",
          accessor: "pdfView",
          align: "center",
          width: "32px",
          Cell: ({ row }) => row?.original?.pdfView,
        },
        {
          id: "actions",
          Header: "Action",
          accessor: "actions",
          align: "center",
          width: "68px",
          Cell: ({ row }) => row?.original?.actions,
        },
        {
          id: "sno",
          Header: "S.No",
          accessor: "sno",
          align: "center",
          width: "36px",
          Cell: ({ value }) => renderCollectionsGridSno(value),
        },
        {
          id: "date",
          Header: "Date",
          accessor: "date",
          align: "left",
          Cell: ({ value }) => renderCollectionsGridText(formatDateDisplay(value)),
        },
        {
          id: "vrNo",
          Header: labels.gridVrNo || "Vr No",
          accessor: "vrNo",
          align: "left",
          Cell: ({ value }) => txt(value),
        },
        {
          id: "paidTo",
          Header: labels.gridPayee,
          accessor: "paidTo",
          align: "left",
          Cell: ({ value }) => txt(value),
        },
        {
          id: "receivedFrom",
          Header: labels.gridPaidFrom,
          accessor: "receivedFrom",
          align: "left",
          Cell: ({ value }) => txt(value),
        },
        {
          id: "partyType",
          Header: labels.gridPartyType || "Party Type",
          accessor: "partyType",
          align: "left",
          Cell: ({ value }) => txt(value),
        },
        {
          id: "description",
          Header: "Description",
          accessor: "description",
          align: "left",
          Cell: ({ value }) => txt(value),
        },
        {
          id: "total",
          Header: "Total",
          accessor: "total",
          align: "right",
          Cell: ({ value }) => renderCollectionsGridAmount(formatAmount(value)),
        },
        {
          id: "attachments",
          Header: "Attach",
          accessor: "attachments",
          align: "center",
          width: "32px",
          Cell: ({ row }) => row?.original?.attachments,
        },
      ];
    }

    return [
      ...(useReceiptApi
        ? [
            {
              id: "pdfView",
              Header: "View",
              accessor: "pdfView",
              align: "center",
              width: "32px",
              Cell: ({ row }) => row?.original?.pdfView,
            },
          ]
        : []),
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        width: "68px",
        Cell: ({ row }) => row?.original?.actions,
      },
      ...(!useReceiptApi
        ? [
            {
              id: "sno",
              Header: "S.No",
              accessor: "sno",
              align: "center",
              width: "36px",
              Cell: ({ value }) => renderCollectionsGridSno(value),
            },
          ]
        : []),
      {
        id: "item",
        Header: "Item",
        accessor: "item",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "account",
        Header: "Account",
        accessor: "account",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "tinTrn",
        Header: "TIN-TRN",
        accessor: "tinTrn",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "amount",
        Header: "Amount",
        accessor: "amount",
        align: "right",
        Cell: ({ value }) => renderCollectionsGridAmount(formatAmount(value)),
      },
      {
        id: "total",
        Header: "Total",
        accessor: "total",
        align: "right",
        Cell: ({ value }) => renderCollectionsGridAmount(formatAmount(value)),
      },
      {
        id: "date",
        Header: "Date",
        accessor: "date",
        align: "left",
        Cell: ({ value }) =>
          renderCollectionsGridText(
            useReceiptApi ? formatDateDisplay(value) : formatLegacyDateDisplay(value)
          ),
      },
      {
        id: "reference",
        Header: "Reference",
        accessor: "reference",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      ...(useReceiptApi
        ? [
            {
              id: "payee",
              Header: labels.gridPayee,
              accessor: "payee",
              align: "left",
              Cell: ({ value }) => txt(value),
            },
            {
              id: "paidFrom",
              Header: labels.gridPaidFrom,
              accessor: "paidFrom",
              align: "left",
              Cell: ({ value }) => txt(value),
            },
          ]
        : [
            {
              id: "paidFrom",
              Header: labels.gridPaidFrom,
              accessor: "paidFrom",
              align: "left",
              Cell: ({ value }) => txt(value),
            },
            {
              id: "payee",
              Header: labels.gridPayee,
              accessor: "payee",
              align: "left",
              Cell: ({ value }) => txt(value),
            },
          ]),
      {
        id: "attachments",
        Header: "Attach",
        accessor: "attachments",
        align: "center",
        width: "32px",
        Cell: ({ row }) => row?.original?.attachments,
      },
      ...(useReceiptApi
        ? [
            {
              id: "finalizedByAhq",
              Header: "Fin.",
              accessor: "finalizedByAhq",
              align: "center",
              width: "36px",
              Cell: ({ row }) => row?.original?.finalizedByAhqControl,
            },
          ]
        : []),
    ];
  }, [
    labels.gridPaidFrom,
    labels.gridPayee,
    labels.gridPartyType,
    labels.gridVrNo,
    usePaymentApi,
    useReceiptApi,
  ]);

  const computedRows = useMemo(
    () =>
      paginatedVisibleRecords.map((record, index) => {
        const rowIndex = (gridPageNumber - 1) * gridPageSize + index;
        const attachmentCount = attachmentCountsById[record.id] ?? 0;
        const flat = usePaymentApi
          ? flattenPaymentForGrid(record, rowIndex, { attachmentCount })
          : flattenReceiptForGrid(record, rowIndex, { attachmentCount });
        const hasAttachments = attachmentCount > 0;
        const canDeleteRecord = canDeleteReceiptRecord(record);
        const isLockedByDate = isRecordLockedByDate(record);
        return {
          ...flat,
          finalizedByAhqControl: useReceiptApi ? (
            <Checkbox
              size="small"
              checked={getReceiptFinalizedDraftValue(record)}
              onChange={(event) => handleReceiptFinalizedDraftChange(record, event.target.checked)}
              disabled={!canManageReceiptAhq || savingReceiptAhq}
              title={
                canManageReceiptAhq
                  ? "Select and save to update AHQ finalization"
                  : "Only superuser or AHQ supervisor can update finalization"
              }
              sx={{ p: 0, m: 0, "& .MuiSvgIcon-root": { fontSize: "0.95rem" } }}
            />
          ) : null,
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              <IconButton
                size="small"
                color="secondary"
                onClick={() => handleViewRecord(record.id)}
                title="View"
                sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
              >
                <Icon fontSize="small">visibility</Icon>
              </IconButton>
              {canEditCurrentMenu() && !isLockedByDate && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(record.id)}
                  title="Edit"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">edit</Icon>
                </IconButton>
              )}
              {canDeleteRecord && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(record.id)}
                  title="Delete"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">delete</Icon>
                </IconButton>
              )}
            </MDBox>
          ),
          pdfView:
            useReceiptApi || usePaymentApi ? (
              <Tooltip title="View as PDF">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleOpenReceiptPdfPreview(record)}
                    title="View as PDF"
                    sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                  >
                    <Icon fontSize="small">picture_as_pdf</Icon>
                  </IconButton>
                </span>
              </Tooltip>
            ) : null,
          attachments: (
            <IconButton
              size="small"
              color={hasAttachments ? "success" : "error"}
              onClick={() => handleOpenAttachments(record)}
              title="View Attachments"
              sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
            >
              <Icon fontSize="small">visibility</Icon>
            </IconButton>
          ),
        };
      }),
    [
      attachmentCountsById,
      canManageReceiptAhq,
      isRecordLockedByDate,
      receiptFinalizedDraft,
      savingReceiptAhq,
      usePaymentApi,
      useReceiptApi,
      gridPageNumber,
      gridPageSize,
      paginatedVisibleRecords,
    ]
  );

  const serverPaginationFooter = useMemo(
    () => (
      <ServerGridPagination
        page={gridPageNumber}
        totalCount={visibleRecords.length}
        pageSize={gridPageSize}
        onPageChange={setGridPageNumber}
      />
    ),
    [visibleRecords.length, gridPageNumber, gridPageSize]
  );

  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: visibleRecords.length }),
    [visibleRecords.length]
  );

  const exportFileName = useMemo(() => {
    if (!showAhqTabs) return labels.exportFileName;
    return ahqTab === RECEIPT_AHQ_TAB.FINALIZED
      ? `${labels.exportFileName}-Finalized`
      : `${labels.exportFileName}-Pending`;
  }, [ahqTab, labels.exportFileName, showAhqTabs]);

  const gridBodySx = useMemo(
    () =>
      buildCollectionsGridTableBodySx({
        leadingCompactColumnCount: 2,
        trailingCompactColumnCount: useReceiptApi ? 2 : 1,
        zeroGapBetweenFirstTwoLeadingColumns: useReceiptApi || usePaymentApi,
      }),
    [usePaymentApi, useReceiptApi]
  );

  return (
    <DashboardLayout>
      {!isGridOnlyView ? <DashboardNavbar /> : null}
      <EnterpriseWorkspace
        title={isGridOnlyView ? null : labels.pageTitle}
        subtitle={isGridOnlyView ? null : labels.pageSubtitle}
        metadata={isGridOnlyView ? null : workspaceMetadata}
        tabs={
          incomeAgreementsModule ? (
            <IncomeAgreementsModuleTabs />
          ) : isGridOnlyView ? null : (
            <>
              <CashFundFlowModuleTabs />
              {showAhqTabs ? (
                <MDBox px={3} sx={{ flexShrink: 0, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                  <Tabs
                    value={ahqTab}
                    onChange={(_, value) => setAhqTab(value)}
                    aria-label="Receipt AHQ approval tabs"
                    sx={{
                      minHeight: 40,
                      "& .MuiTab-root": {
                        minHeight: 40,
                        textTransform: "none",
                        fontSize: "0.8125rem",
                        fontWeight: 600,
                      },
                    }}
                  >
                    <Tab
                      value={RECEIPT_AHQ_TAB.PENDING}
                      label={`${labels.tabPendingAhq || "Pending AHQ approval"} (${
                        routeFilteredPendingRecords.length
                      })`}
                    />
                    <Tab
                      value={RECEIPT_AHQ_TAB.FINALIZED}
                      label={`${labels.tabFinalizedAhq || "Finalized by AHQ"} (${
                        routeFilteredFinalizedRecords.length
                      })`}
                    />
                  </Tabs>
                </MDBox>
              ) : null}
            </>
          )
        }
        filters={
          incomeAgreementsModule ? (
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
          ) : null
        }
        actions={
          isGridOnlyView ? null : (
            <MDBox display="flex" gap={1} alignItems="center">
              {useReceiptApi && canManageReceiptAhq ? (
                <MDButton
                  variant="gradient"
                  color="info"
                  onClick={handleSaveReceiptAhqChanges}
                  disabled={!receiptAhqChangedRecords.length || savingReceiptAhq}
                >
                  <Icon>save</Icon>&nbsp;
                  {savingReceiptAhq
                    ? "Saving..."
                    : `Save Finalized (${receiptAhqChangedRecords.length})`}
                </MDButton>
              ) : null}
              {canCreateCurrentMenu() ? (
                <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
                  <Icon>add</Icon>&nbsp;Add New
                </MDButton>
              ) : null}
            </MDBox>
          )
        }
        bodySx={gridBodySx}
      >
        {!incomeAgreementsModule ? (
          <MDBox
            ref={setPaginationHost}
            className="saas-settings-table-pagination-top"
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexShrink: 0,
              width: "100%",
              minHeight: totalPages > 1 ? 28 : 0,
            }}
          />
        ) : null}
        <DataTable
          table={{ columns, rows: computedRows }}
          isSorted={false}
          stickyToolbarAndHeader
          entriesPerPage={
            incomeAgreementsModule
              ? false
              : {
                  defaultValue: GRID_DISPLAY_DEFAULT_PAGE_SIZE,
                  entries: [10, 25, 50, 100],
                }
          }
          page={gridPageNumber - 1}
          pageSize={gridPageSize}
          onPageChange={(newPage) => setGridPageNumber(newPage + 1)}
          onEntriesPerPageChange={(value) => {
            setGridPageSize(Number(value));
            setGridPageNumber(1);
          }}
          showTotalEntries={false}
          noEndBorder
          canSearch
          exportFileName={exportFileName}
          contentFitTable
          pagination={{ variant: "gradient", color: "info" }}
          paginationFooter={serverPaginationFooter}
          paginationHost={paginationHost}
        />
      </EnterpriseWorkspace>

      <ReceiptForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        labels={labels}
        showMonthField={showMonthField}
        receiptLayout={useReceiptApi}
        paymentLayout={usePaymentApi}
        readOnly={readOnlyForm}
        onUploadSuccess={(recordId) => {
          const id = recordId ?? currentRecord?.id;
          if (id) refreshAttachmentCount(id);
        }}
        activeLockDate={activeLockDate}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>{labels.deleteConfirm}</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton
            onClick={handleConfirmDelete}
            color="error"
            disabled={!canDeleteReceiptRecord(recordPendingDelete)}
          >
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>

      <AgreementProvPdfPreviewDialog
        open={pdfPreviewOpen}
        onClose={handleCloseReceiptPdfPreview}
        data={pdfPreviewRecord}
        generatePdfBlob={generateReceiptPdfBlob}
        title="PDF Preview"
        previewTitle={usePaymentApi ? "Payment PDF" : "Receipt PDF"}
        defaultMargins={RECEIPT_PDF_DEFAULT_MARGINS}
        loadMargins={loadReceiptPdfMargins}
        saveMargins={saveReceiptPdfMargins}
      />

      <Dialog open={attachmentsDialogOpen} onClose={handleCloseAttachments} fullWidth maxWidth="sm">
        <DialogTitle>
          Attachments
          {attachmentsRecord?.id ? ` (#${attachmentsRecord.id})` : ""}
        </DialogTitle>
        <DialogContent dividers>
          {attachmentsLoading ? (
            <MDBox display="flex" justifyContent="center" py={2}>
              <CurrencyLoading size={28} />
            </MDBox>
          ) : attachmentsFiles.length > 0 ? (
            <MDBox display="flex" flexDirection="column" gap={1}>
              {attachmentsFiles.map((file, idx) => (
                <MDBox
                  key={file.id || `${file.fileName}-${idx}`}
                  display="flex"
                  alignItems="center"
                  gap={1}
                >
                  <MDButton
                    variant="outlined"
                    color="info"
                    onClick={() => {
                      uploadApi
                        .downloadFile(file, file.fileName || `File-${idx + 1}`)
                        .catch((e) => window.alert(`Download failed: ${e.message}`));
                    }}
                    sx={{ justifyContent: "flex-start", flex: 1 }}
                  >
                    <Icon sx={{ mr: 1 }}>attach_file</Icon>
                    {file.fileName || `File ${idx + 1}`}
                  </MDButton>
                  {canDeleteCurrentMenu() ? (
                    <IconButton
                      size="small"
                      color="error"
                      onClick={() => handleDeleteAttachment(file)}
                      title="Delete"
                    >
                      <Icon fontSize="small">delete</Icon>
                    </IconButton>
                  ) : null}
                </MDBox>
              ))}
            </MDBox>
          ) : (
            <MDTypography variant="body2" color="text">
              {labels.noAttachments}
            </MDTypography>
          )}
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCloseAttachments}>Close</MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

TransactionWorkspace.propTypes = {
  labels: PropTypes.shape({
    paidFrom: PropTypes.string.isRequired,
    paidFromRequired: PropTypes.string.isRequired,
    payeeSection: PropTypes.string.isRequired,
    payeeRequired: PropTypes.string.isRequired,
    payeePlaceholder: PropTypes.string.isRequired,
    gridPaidFrom: PropTypes.string.isRequired,
    gridPayee: PropTypes.string.isRequired,
    gridVrNo: PropTypes.string,
    gridPartyType: PropTypes.string,
    gridMonth: PropTypes.string,
    month: PropTypes.string,
    monthRequired: PropTypes.string,
    pageTitle: PropTypes.string.isRequired,
    pageSubtitle: PropTypes.string.isRequired,
    exportFileName: PropTypes.string.isRequired,
    addFormTitle: PropTypes.string.isRequired,
    editFormTitle: PropTypes.string.isRequired,
    deleteConfirm: PropTypes.string.isRequired,
    noAttachments: PropTypes.string.isRequired,
    tabPendingAhq: PropTypes.string,
    tabFinalizedAhq: PropTypes.string,
  }).isRequired,
  incomeAgreementsModule: PropTypes.bool,
  useReceiptApi: PropTypes.bool,
  usePaymentApi: PropTypes.bool,
};

TransactionWorkspace.defaultProps = {
  incomeAgreementsModule: false,
  useReceiptApi: false,
  usePaymentApi: false,
};

export default TransactionWorkspace;
