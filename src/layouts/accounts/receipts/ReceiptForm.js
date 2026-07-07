import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import SearchableSelect from "components/SearchableSelect";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import FormControlLabel from "@mui/material/FormControlLabel";
import Icon from "@mui/material/Icon";
import Chip from "@mui/material/Chip";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDTypography from "components/MDTypography";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import contractApi from "services/api.contract.service";
import api, { canDeleteCurrentMenu } from "services/api.service";
import uploadApi from "services/api.upload.service";
import CurrencyLoading from "components/CurrencyLoading";
import chartOfAccountsApi from "services/api.chartofaccounts.service";
import customerApi from "services/api.customer.service";
import supplierApi from "services/api.supplier.service";
import collectionsApi from "services/api.collections.service";
import receiptsApi from "services/api.receipts.service";
import paymentsApi from "services/api.payments.service";
import {
  buildInvoiceKey,
  computeInvoiceBalance,
  formatTransactionLockDateValidationMessage,
  getMinCollectionReceiptDateAfterLock,
  isDateLockedByLockDate,
  normalizeCollectionEntryRow,
  pickField as pickCollectionField,
} from "layouts/income-agreements/collections/collectionsUtils";
import {
  MAX_ATTACHMENT_FILES,
  PAID_FROM_ACCOUNTS,
  PAYEE_CONTACT_TYPES,
  applyReceiptLineInvoiceSelection,
  applyReceiptLinePartyFromCollectionEntry,
  buildReceiptCollectionEntryOptionValue,
  buildReceiptCollectionEntryUpdatePayload,
  buildReceiptLineCollectionInvoiceOptions,
  buildReceiptLineCollectionTenantOptions,
  buildCollectionStyleLineAccountOptions,
  buildSyntheticPartyFromCollectionEntry,
  collectReceiptLinkedCollectionEntries,
  normalizeReceiptLineForForm,
  parseReceiptCollectionEntryOptionValue,
  buildReceivedInCashAndBankOptions,
  buildReceiptContractOptions,
  buildReceiptFormState,
  computeGrandTotal,
  computeLineTotal,
  computeNextReceiptReference,
  computeReceiptGrandTotal,
  createLineRow,
  enrichTenantPartyOptionsWithContracts,
  fetchReceiptProductOptions,
  fetchReceiptReferences,
  filterReceiptLineAccountOptions,
  filterReceiptLineEntityPartyOptions,
  filterReceiptPartyControlAccountOptions,
  filterPaymentLinePartyOptions,
  findLineAccountOption,
  formatAmount,
  formatLineAccountDropdownLabel,
  getReceiptLineMode,
  getReceiptLineModeFromAccountOption,
  getReceiptPartyTypeFromAccountOption,
  getReceiptYearFromDate,
  getReceivedInSelectValue,
  inputValueToMonthYear,
  isCollectionAccountCoaOption,
  isReceiptCollectionEntryRow,
  isReceiptInvoiceMode,
  isReceiptLayoutLineComplete,
  isReceiptLineComplete,
  isValidMonthYear,
  mergePartyCoaOption,
  monthYearToInputValue,
  normalizePartyCoaOption,
  normalizeReceiptLineNumericDefaults,
  parseAmount,
  RECEIPT_LINE_MODES,
  RECEIPT_PARTY_TYPES,
  RECEIPT_REFERENCE_PREFIX,
  resolveReceiptProductAccountOption,
  syncReceiptLineAmount,
} from "./receiptUtils";
import PaymentLinesGrid from "./PaymentLinesGrid";
import {
  fetchTransactionUploadedFiles,
  PAYMENT_UPLOAD_FORM_NAME,
  RECEIPT_UPLOAD_FORM_NAME,
  TRANSACTION_ATTACHMENT_MAX_BYTES,
  uploadTransactionAttachments,
} from "./receiptAttachmentUtils";
import ReceiptLinesGrid from "./ReceiptLinesGrid";
import {
  buildPaymentFormState,
  computeNextPaymentVrNo,
  computePaymentGrandTotal,
  fetchPaymentProductOptions,
  fetchPaymentVrNos,
  getPaymentYearFromDate,
  isPaymentInvoiceMode,
  isPaymentLineComplete,
  isPaymentSimplifiedLineComplete,
  PAYMENT_VR_NO_PREFIX,
  resolveCashAndBankAccountIdFromSelection,
  resolveProductAccountOption,
  syncPaymentLineAmount,
  normalizePaymentLineFromApi,
  validatePaymentForm,
} from "./paymentUtils";
import { fetchCashAndBankAccountsForDropdown } from "layouts/cash-fund-flow/inter-acc-transfer/interAccTransferUtils";
import { isCashOrBankCashAndBankMode } from "layouts/cash-fund-flow/cash-and-bank/cashAndBankUtils";
import { PAYMENTS_LABELS } from "./transactionLabels";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
  "& .MuiInputLabel-root": { top: 0 },
};

function scaleGridColumns(columns, factor = 0.7) {
  return Math.max(1, Math.round(Number(columns) * factor));
}

const paymentVrNoFieldSx = {
  ...textFieldSx,
  "& .MuiInputBase-input": {
    color: "#000",
    WebkitTextFillColor: "#000",
  },
  "& .MuiInputBase-input.Mui-disabled": {
    color: "#000",
    WebkitTextFillColor: "#000",
    opacity: 1,
  },
};

const readOnlyDarkTextFieldSx = paymentVrNoFieldSx;

function ReceiptDateField({ value, onChange, disabled, readOnly, error, helperText, min }) {
  const inputRef = useRef(null);
  const dateValue = value || "";

  const openPicker = () => {
    if (disabled || readOnly) return;
    if (inputRef.current?.showPicker) {
      inputRef.current.showPicker();
      return;
    }
    inputRef.current?.click();
  };

  if (readOnly) {
    return (
      <TextField
        fullWidth
        label="Date"
        value={dateValue ? formatDateDDMMMYYYY(dateValue) : ""}
        disabled
        size="small"
        InputLabelProps={{ shrink: true }}
        sx={textFieldSx}
      />
    );
  }

  return (
    <MDBox sx={{ position: "relative" }}>
      <input
        type="date"
        ref={inputRef}
        value={dateValue}
        min={min || undefined}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        tabIndex={-1}
        aria-hidden
        style={{
          position: "absolute",
          opacity: 0,
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
          cursor: disabled ? "default" : "pointer",
        }}
      />
      <TextField
        fullWidth
        label="Date"
        value={dateValue ? formatDateDDMMMYYYY(dateValue) : ""}
        onClick={openPicker}
        InputProps={{ readOnly: true }}
        disabled={disabled}
        size="small"
        placeholder="dd-MMM-yyyy"
        InputLabelProps={{ shrink: true }}
        error={Boolean(error)}
        helperText={helperText}
        sx={{
          ...textFieldSx,
          "& .MuiInputBase-input": { cursor: disabled ? "default" : "pointer" },
        }}
      />
    </MDBox>
  );
}

ReceiptDateField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  error: PropTypes.bool,
  helperText: PropTypes.string,
  min: PropTypes.string,
};

ReceiptDateField.defaultProps = {
  value: "",
  disabled: false,
  readOnly: false,
  error: false,
  helperText: "",
  min: "",
};

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.Data)) return response.Data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

function pickField(row, ...keys) {
  for (let i = 0; i < keys.length; i += 1) {
    const value = row?.[keys[i]];
    if (value != null && String(value).trim() !== "") return row[keys[i]];
  }
  return "";
}

function buildPartyKey(type, id, code, name) {
  return [type, id || code || name].map((part) => String(part || "").trim()).join("|");
}

function normalizeReceiptParty(row, type) {
  const id = row?.id ?? row?.Id ?? "";
  const code =
    type === "Tenant"
      ? pickField(row, "tenantNo", "TenantNo")
      : pickField(
          row,
          "code",
          "Code",
          "customerCode",
          "CustomerCode",
          "supplierCode",
          "SupplierCode"
        );
  const name =
    type === "Tenant"
      ? pickField(row, "businessName", "BusinessName", "ownerName", "OwnerName")
      : pickField(row, "name", "Name");
  const label = [code, name].filter(Boolean).join(" - ") || String(id || "").trim();
  if (!label) return null;
  const coaId = row?.coaId ?? row?.CoaId ?? "";
  return {
    value: buildPartyKey(type, id, code, name),
    type,
    id,
    code: String(code || "").trim(),
    name: String(name || "").trim(),
    label,
    coaId: coaId != null && coaId !== "" ? String(coaId) : "",
    tinTrn: pickField(row, "gstNo", "GSTNo", "ntnCnic", "NtnCnic", "ntnNo", "NTNNo"),
    raw: row,
  };
}

function normalizeCollectionEntry(row) {
  const normalized = normalizeCollectionEntryRow(row);
  return {
    ...normalized,
    dueAmount: normalized.due ?? row?.dueAmount ?? row?.DueAmount ?? "",
    balanceAmount: normalized.balance ?? row?.balanceAmount ?? row?.BalanceAmount ?? "",
    invoiceNo: pickCollectionField(row, "invoiceNo", "InvoiceNo"),
  };
}

function isActiveCollectionEntry(row) {
  return isReceiptCollectionEntryRow(row) && Boolean(String(row?.invoiceNo || "").trim());
}

function findByValue(options, value) {
  return (options || []).find((option) => String(option.value) === String(value)) || null;
}

async function syncReceiptLinkedCollectionEntries({
  receiptId,
  reference,
  date,
  lines,
  collectionRows,
}) {
  const entries = collectReceiptLinkedCollectionEntries(lines, collectionRows);
  if (!entries.length) return;

  await Promise.all(
    entries.map(async (entry) => {
      const id = entry?.id ?? entry?.Id;
      if (!id) return;
      const payload = buildReceiptCollectionEntryUpdatePayload(entry, {
        receiptId,
        reference,
        date,
      });
      await collectionsApi.updateCollection(id, payload);
    })
  );
}

function getCollectionEntryOpenAmount(entry, invoice) {
  const collectionBalance = parseAmount(entry?.balanceAmount);
  if (collectionBalance > 0) return collectionBalance;
  const collectionDue = parseAmount(entry?.dueAmount);
  if (collectionDue > 0) return collectionDue;
  const invoiceBalance = computeInvoiceBalance(invoice);
  if (invoiceBalance > 0) return invoiceBalance;
  return parseAmount(entry?.amount);
}

function normalizeContactType(type) {
  return type === "Tenants" ? "Tenant" : type;
}

function formatContactTypeLabel(type) {
  return normalizeContactType(type) === "Tenant" ? "Tenants" : type;
}

function formatFileSize(bytes) {
  if (!bytes) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function validateReceiptForm(
  form,
  labels,
  showMonthField,
  receiptLayout = false,
  lineAccountOptions = [],
  activeLockDate = ""
) {
  const errors = {};
  if (!form.date) errors.date = "Date is required";
  else if (isDateLockedByLockDate(form.date, activeLockDate)) {
    errors.date = formatTransactionLockDateValidationMessage(activeLockDate);
  }
  if (showMonthField && !isValidMonthYear(form.month)) {
    errors.month = labels.monthRequired || "Month is required";
  }
  if (!String(form.paidFrom || "").trim()) errors.paidFrom = labels.paidFromRequired;
  if (receiptLayout) {
    if (!form.receivedInCoaId && form.receivedInCoaId !== 0 && !form.payeePartyId) {
      errors.receivedInCoaId = labels.payeeRequired;
    }
  } else if (!form.payeeName?.trim()) {
    errors.payeeName = labels.payeeRequired;
  }
  const lines = form.lines || [];
  if (!lines.length) errors.lines = "At least one line item is required";
  lines.forEach((line, idx) => {
    if (!receiptLayout && !line.item) errors[`line-${idx}-item`] = "Item is required";
    if (!receiptLayout && !line.account) errors[`line-${idx}-account`] = "Account is required";
    if (receiptLayout && !String(line.account || "").trim()) {
      errors[`line-${idx}-account`] = "Account is required";
    }
    if (receiptLayout) {
      const account = findLineAccountOption(lineAccountOptions, line);
      const partyType = getReceiptPartyTypeFromAccountOption(account);
      const lineMode = partyType ? getReceiptLineMode(partyType) : null;
      if (lineMode && isReceiptInvoiceMode(lineMode)) {
        if (parseAmount(line.amount) <= 0) {
          errors[`line-${idx}-amount`] = "Amount is required";
        }
      }
    } else if (parseAmount(line.amount) <= 0) {
      errors[`line-${idx}-amount`] = "Amount is required";
    }
  });
  return errors;
}

export default function ReceiptForm({
  open,
  onClose,
  onSubmit,
  initialData,
  labels = PAYMENTS_LABELS,
  showMonthField = false,
  receiptLayout = false,
  paymentLayout = false,
  readOnly = false,
  onUploadSuccess,
  activeLockDate = "",
}) {
  const [form, setForm] = useState(() =>
    paymentLayout ? buildPaymentFormState() : buildReceiptFormState()
  );
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [lineAccountOptions, setLineAccountOptions] = useState([]);
  const [receivedInAccountOptions, setReceivedInAccountOptions] = useState([]);
  const [partyOptions, setPartyOptions] = useState([]);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [collectionRows, setCollectionRows] = useState([]);
  const [contractRows, setContractRows] = useState([]);
  const [cashAndBankOptions, setCashAndBankOptions] = useState([]);
  const [coaById, setCoaById] = useState(() => new Map());
  const [productOptions, setProductOptions] = useState([]);
  const [existingReferences, setExistingReferences] = useState([]);
  const [referencesLoaded, setReferencesLoaded] = useState(false);
  const [existingPaymentVrNos, setExistingPaymentVrNos] = useState([]);
  const [paymentVrNosLoaded, setPaymentVrNosLoaded] = useState(false);
  const fileInputRef = useRef(null);

  const paymentLineMode = useMemo(
    () => (paymentLayout ? getReceiptLineMode(form.receiptPartyType) : null),
    [paymentLayout, form.receiptPartyType]
  );

  const paymentSimplifiedLines = paymentLayout;

  const showPaymentLinesGrid = Boolean(paymentLayout && getReceivedInSelectValue(form));

  const selectedPaymentReceivedFromAccount = useMemo(() => {
    if (!paymentLayout) return null;
    const selectedValue = getReceivedInSelectValue(form);
    if (!selectedValue) return null;
    return findLineAccountOption(receivedInAccountOptions, selectedValue);
  }, [paymentLayout, receivedInAccountOptions, form.receivedInCoaId]);

  const selectedReceivedInAccount = useMemo(() => {
    if (!receiptLayout) return null;
    const selectedValue = getReceivedInSelectValue(form);
    if (!selectedValue) return null;
    return findLineAccountOption(receivedInAccountOptions, selectedValue);
  }, [receiptLayout, receivedInAccountOptions, form.receivedInCoaId, form.payeePartyId]);

  const isEditMode = Boolean(initialData?.id);
  const receiptSimplifiedLines = receiptLayout;
  const minDateAfterLock = useMemo(
    () => getMinCollectionReceiptDateAfterLock(activeLockDate),
    [activeLockDate]
  );
  const isFormLockedByDate = useMemo(
    () => Boolean(form.date) && isDateLockedByLockDate(form.date, activeLockDate),
    [activeLockDate, form.date]
  );
  const formReadOnly = readOnly || isFormLockedByDate;

  const receiptLineMode = useMemo(() => {
    if (!receiptLayout) return null;
    if (receiptSimplifiedLines) return RECEIPT_LINE_MODES.TENANT_INVOICE;
    return getReceiptLineMode(form.receiptPartyType);
  }, [receiptLayout, receiptSimplifiedLines, form.receiptPartyType]);

  const showReceiptLinesGrid =
    !receiptLayout ||
    (receiptSimplifiedLines
      ? Boolean(selectedReceivedInAccount)
      : Boolean(selectedReceivedInAccount) && Boolean(String(form.receiptPartyType || "").trim()));

  const uploadFormName = paymentLayout ? PAYMENT_UPLOAD_FORM_NAME : RECEIPT_UPLOAD_FORM_NAME;
  const fetchExistingFiles = useCallback(
    async (id) => {
      if (id == null) return;
      setLoadingExistingFiles(true);
      try {
        const files = await fetchTransactionUploadedFiles(id, uploadFormName);
        setExistingFiles(files);
      } catch (error) {
        console.error("Error fetching transaction attachments:", error);
        setExistingFiles([]);
      } finally {
        setLoadingExistingFiles(false);
      }
    },
    [uploadFormName]
  );

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    const fetchFormCatalogs = async () => {
      const [
        coaResult,
        customerResult,
        supplierResult,
        tenantResult,
        invoiceResult,
        collectionResult,
      ] = await Promise.allSettled([
        chartOfAccountsApi.getAll(),
        customerApi.listCustomers(),
        supplierApi.listSuppliers(),
        api.list("tenant"),
        contractApi.getAllInvoiceScheduleRecords(),
        collectionsApi.listCollections(),
      ]);

      if (cancelled) return;

      [coaResult, customerResult, supplierResult, tenantResult, invoiceResult, collectionResult]
        .filter((result) => result.status === "rejected")
        .forEach((result) => console.error("Error fetching receipt form catalog:", result.reason));

      try {
        const coaResponse = coaResult.status === "fulfilled" ? coaResult.value : [];
        const customerResponse = customerResult.status === "fulfilled" ? customerResult.value : [];
        const supplierResponse = supplierResult.status === "fulfilled" ? supplierResult.value : [];
        const tenantResponse = tenantResult.status === "fulfilled" ? tenantResult.value : [];
        const invoiceResponse = invoiceResult.status === "fulfilled" ? invoiceResult.value : [];
        const collectionResponse =
          collectionResult.status === "fulfilled" ? collectionResult.value : [];

        const coaRows = chartOfAccountsApi.unwrapList(coaResponse);
        const coaByIdMap = new Map(
          coaRows
            .map((row) => [Number(row?.id ?? row?.Id), row])
            .filter(([id]) => Number.isFinite(id))
        );
        const coaByIdLocal = coaByIdMap;
        setCoaById(coaByIdMap);
        const savedAccounts = (initialData?.lines || [])
          .map((line) => line?.account)
          .filter(Boolean);
        const savedCoaIds = new Set(
          [
            ...(initialData?.lines || []).map((line) => line?.accountCoaId),
            ...(collectionsApi.unwrapList(collectionResponse) || []).map(
              (row) => row?.coaId ?? row?.CoaId
            ),
          ]
            .filter((id) => id !== "" && id != null)
            .map((id) => Number(id))
            .filter((id) => Number.isFinite(id))
        );

        let filteredCoaRows = coaRows
          .map(normalizePartyCoaOption)
          .filter((row) => row.id != null && isCollectionAccountCoaOption(row));

        for (const coaId of savedCoaIds) {
          if (filteredCoaRows.some((row) => Number(row.id) === Number(coaId))) continue;
          const savedRow = coaByIdMap.get(coaId) || (await api.get("ChartOfAccounts", coaId));
          const option = normalizePartyCoaOption(savedRow);
          if (option.id != null) {
            filteredCoaRows = mergePartyCoaOption(filteredCoaRows, option);
          }
        }

        const options = buildCollectionStyleLineAccountOptions(
          filteredCoaRows.map((row) => ({
            id: row.id,
            Id: row.id,
            acctId: row.acctId,
            acctName: row.acctName,
            controlAccount: row.controlAccount,
            groupName: row.groupName,
          })),
          savedAccounts
        );
        if (!receiptLayout && !paymentLayout) {
          setReceivedInAccountOptions([]);
        }
        const parties = [
          ...customerApi
            .unwrapList(customerResponse)
            .map((row) => normalizeReceiptParty(row, "Customer"))
            .filter(Boolean),
          ...supplierApi
            .unwrapList(supplierResponse)
            .map((row) => normalizeReceiptParty(row, "Supplier"))
            .filter(Boolean),
          ...unwrapList(tenantResponse)
            .map((row) => normalizeReceiptParty(row, "Tenant"))
            .filter(Boolean),
        ]
          .map((party) => {
            const coa = coaByIdLocal.get(Number(party.coaId));
            return {
              ...party,
              coaControlAccount: pickField(coa, "controlAccount", "ControlAccount"),
              coaGroupName: pickField(coa, "groupName", "GroupName"),
            };
          })
          .sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
        const invoices = unwrapList(invoiceResponse);
        const collections = collectionsApi
          .unwrapList(collectionResponse)
          .map(normalizeCollectionEntry)
          .filter(isReceiptCollectionEntryRow);
        setLineAccountOptions(options);
        setPartyOptions(parties);
        setInvoiceRows(invoices);
        setCollectionRows(collections);
      } catch (error) {
        console.error("Error fetching receipt form catalogs:", error);
        setLineAccountOptions([]);
        setReceivedInAccountOptions([]);
        setPartyOptions([]);
        setCoaById(new Map());
        setInvoiceRows([]);
        setCollectionRows([]);
      }
    };

    fetchFormCatalogs();

    if (paymentLayout || receiptLayout) {
      fetchCashAndBankAccountsForDropdown()
        .then((options) => {
          if (cancelled) return;
          const ledgerOptions = options.filter(isCashOrBankCashAndBankMode);
          setCashAndBankOptions(ledgerOptions);
          const savedCoaId = initialData?.receivedInCoaId ?? initialData?.payeePartyId;
          const savedLedgerId = initialData?.cashAndBankAccountId;
          const savedLabel = [initialData?.payeePartyCode, initialData?.payeeName]
            .map((part) => String(part || "").trim())
            .filter(Boolean)
            .join(" - ");
          if (receiptLayout || paymentLayout) {
            setReceivedInAccountOptions(
              buildReceivedInCashAndBankOptions(options, {
                includeCoaIds: [savedCoaId],
                includeLedgerIds: [savedLedgerId],
                savedLabelByCoaId:
                  savedCoaId != null && savedCoaId !== "" && savedLabel
                    ? { [Number(savedCoaId)]: savedLabel }
                    : {},
                modeFilter: isCashOrBankCashAndBankMode,
              })
            );
          }
        })
        .catch((error) => {
          console.error("Error fetching cash and bank accounts:", error);
          if (!cancelled) {
            setCashAndBankOptions([]);
            if (receiptLayout || paymentLayout) setReceivedInAccountOptions([]);
          }
        });
    }

    if (paymentLayout || receiptLayout) {
      const fetchProducts = paymentLayout ? fetchPaymentProductOptions : fetchReceiptProductOptions;
      fetchProducts()
        .then((options) => {
          if (!cancelled) setProductOptions(options);
        })
        .catch((error) => {
          console.error("Error fetching product options:", error);
          if (!cancelled) setProductOptions([]);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [open, initialData, paymentLayout, receiptLayout]);

  useEffect(() => {
    if (!open || (!receiptLayout && !paymentLayout)) {
      setContractRows([]);
      return undefined;
    }

    let cancelled = false;

    const fetchContracts = async () => {
      try {
        const response = await contractApi.getAllRecords();
        if (!cancelled) {
          setContractRows(unwrapList(response?.data ?? response));
        }
      } catch (error) {
        console.error("Error fetching receipt contract options:", error);
        if (!cancelled) setContractRows([]);
      }
    };

    fetchContracts();

    return () => {
      cancelled = true;
    };
  }, [open, receiptLayout, paymentLayout]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      const buildState = paymentLayout ? buildPaymentFormState : buildReceiptFormState;
      setForm(
        buildState({
          ...initialData,
          lines:
            Array.isArray(initialData.lines) && initialData.lines.length
              ? initialData.lines.map((line) =>
                  paymentLayout
                    ? normalizePaymentLineFromApi(line)
                    : normalizeReceiptLineForForm(line)
                )
              : [],
        })
      );
    } else {
      setForm(paymentLayout ? buildPaymentFormState() : buildReceiptFormState());
    }
    setErrors({});
    setSelectedFiles([]);
    if (initialData?.id) {
      fetchExistingFiles(initialData.id);
    } else {
      setExistingFiles([]);
    }
  }, [open, initialData, paymentLayout, receiptLayout, fetchExistingFiles]);

  useEffect(() => {
    if (!open) {
      setExistingReferences([]);
      setReferencesLoaded(false);
      return undefined;
    }
    if (!receiptLayout || isEditMode) return undefined;

    let cancelled = false;

    const loadExistingReferences = async () => {
      try {
        const references = await fetchReceiptReferences(receiptsApi);
        if (!cancelled) {
          setExistingReferences(references);
          setReferencesLoaded(true);
        }
      } catch (error) {
        console.error("Error loading receipt references:", error);
        if (!cancelled) {
          setExistingReferences([]);
          setReferencesLoaded(true);
        }
      }
    };

    loadExistingReferences();
    return () => {
      cancelled = true;
    };
  }, [open, receiptLayout, isEditMode]);

  useEffect(() => {
    if (!open || !receiptLayout || isEditMode || !referencesLoaded || !form.referenceAutomatic) {
      return;
    }
    setForm((prev) => {
      const nextReference = computeNextReceiptReference(existingReferences, prev.date);
      if (prev.reference === nextReference) return prev;
      return { ...prev, reference: nextReference };
    });
  }, [
    open,
    receiptLayout,
    isEditMode,
    referencesLoaded,
    existingReferences,
    form.referenceAutomatic,
    form.date,
  ]);

  useEffect(() => {
    if (!open) {
      setExistingPaymentVrNos([]);
      setPaymentVrNosLoaded(false);
      return undefined;
    }
    if (!paymentLayout || isEditMode) return undefined;

    let cancelled = false;

    const loadExistingPaymentVrNos = async () => {
      try {
        const vrNos = await fetchPaymentVrNos(paymentsApi);
        if (!cancelled) {
          setExistingPaymentVrNos(vrNos);
          setPaymentVrNosLoaded(true);
        }
      } catch (error) {
        console.error("Error loading payment Vr Nos:", error);
        if (!cancelled) {
          setExistingPaymentVrNos([]);
          setPaymentVrNosLoaded(true);
        }
      }
    };

    loadExistingPaymentVrNos();
    return () => {
      cancelled = true;
    };
  }, [open, paymentLayout, isEditMode]);

  useEffect(() => {
    if (!open || !paymentLayout || isEditMode || !paymentVrNosLoaded) return;
    setForm((prev) => {
      const nextVrNo = computeNextPaymentVrNo(existingPaymentVrNos, prev.date);
      if (prev.vrNo === nextVrNo) return prev;
      return { ...prev, vrNo: nextVrNo };
    });
  }, [open, paymentLayout, isEditMode, paymentVrNosLoaded, existingPaymentVrNos, form.date]);

  useEffect(() => {
    if (!open || !paymentLayout || !initialData) return;
    if (form.receivedInCoaId !== "" && form.receivedInCoaId != null) return;
    const ledgerId = form.cashAndBankAccountId || initialData.cashAndBankAccountId;
    if (ledgerId === "" || ledgerId == null) return;
    const ledger = cashAndBankOptions.find((option) => Number(option.id) === Number(ledgerId));
    if (!ledger) return;
    const coaId = ledger?.coaId ?? ledger?.CoaId;
    if (coaId == null || coaId === "") return;
    setForm((prev) => ({
      ...prev,
      cashAndBankAccountId: String(ledgerId),
      receivedInCoaId: String(coaId),
    }));
  }, [
    open,
    paymentLayout,
    initialData,
    cashAndBankOptions,
    form.cashAndBankAccountId,
    form.receivedInCoaId,
  ]);

  useEffect(() => {
    if (!open || !receiptLayout || !initialData) return;
    if (form.cashAndBankAccountId !== "" && form.cashAndBankAccountId != null) return;
    const savedCoaId = initialData.receivedInCoaId ?? initialData.payeePartyId;
    if (savedCoaId === "" || savedCoaId == null) return;
    const ledger = cashAndBankOptions.find((option) => Number(option.coaId) === Number(savedCoaId));
    if (!ledger?.id) return;
    setForm((prev) => ({
      ...prev,
      cashAndBankAccountId: String(ledger.id),
      receivedInCoaId: String(savedCoaId),
    }));
  }, [open, receiptLayout, initialData, cashAndBankOptions, form.cashAndBankAccountId]);

  const grandTotal = useMemo(() => {
    if (paymentLayout && paymentSimplifiedLines) {
      return (form.lines || []).reduce((sum, line) => {
        const account = findLineAccountOption(lineAccountOptions, line);
        const mode = getReceiptLineModeFromAccountOption(account) || RECEIPT_LINE_MODES.ACCOUNT_QTY;
        return sum + computePaymentGrandTotal([line], mode);
      }, 0);
    }
    if (paymentLayout) return computePaymentGrandTotal(form.lines, paymentLineMode);
    if (receiptLayout && receiptSimplifiedLines) {
      return (form.lines || []).reduce((sum, line) => {
        const account = findLineAccountOption(lineAccountOptions, line);
        const mode = getReceiptLineModeFromAccountOption(account) || RECEIPT_LINE_MODES.ACCOUNT_QTY;
        return sum + computeReceiptGrandTotal([line], mode);
      }, 0);
    }
    if (receiptLayout && receiptLineMode && receiptLineMode !== RECEIPT_LINE_MODES.LEGACY) {
      return computeReceiptGrandTotal(form.lines, receiptLineMode);
    }
    return computeGrandTotal(form.lines);
  }, [
    form.lines,
    paymentLayout,
    paymentSimplifiedLines,
    paymentLineMode,
    receiptLayout,
    receiptSimplifiedLines,
    receiptLineMode,
    lineAccountOptions,
  ]);

  const receiptContractOptions = useMemo(
    () => buildReceiptContractOptions(contractRows),
    [contractRows]
  );

  const displayPartyOptions = useMemo(
    () => enrichTenantPartyOptionsWithContracts(partyOptions, contractRows),
    [partyOptions, contractRows]
  );

  const selectedPayeeOptions = useMemo(() => {
    if (receiptLayout) return [];
    const contactType = normalizeContactType(form.payeeContactType);
    return partyOptions.filter((option) => option.type === contactType || contactType === "Other");
  }, [partyOptions, form.payeeContactType, receiptLayout]);

  const allPartyOptionsByKey = useMemo(() => {
    const map = new Map();
    displayPartyOptions.forEach((option) => map.set(option.value, option));
    partyOptions.forEach((option) => {
      if (!map.has(option.value)) map.set(option.value, option);
    });
    return map;
  }, [displayPartyOptions, partyOptions]);

  const invoiceRowsByKey = useMemo(() => {
    const map = new Map();
    invoiceRows.forEach((invoice) => {
      const key = buildInvoiceKey(invoice);
      if (key && !map.has(key)) map.set(key, invoice);
    });
    return map;
  }, [invoiceRows]);

  const collectionRowsByKey = useMemo(() => {
    const map = new Map();
    collectionRows.forEach((entry) => {
      const key = buildInvoiceKey(entry);
      if (key && !map.has(key)) map.set(key, entry);
    });
    return map;
  }, [collectionRows]);

  const collectionEntriesById = useMemo(() => {
    const map = new Map();
    collectionRows.forEach((entry) => {
      const id = String(entry?.id ?? entry?.Id ?? "").trim();
      if (!id) return;
      map.set(id, entry);
      map.set(buildReceiptCollectionEntryOptionValue(id), entry);
    });
    return map;
  }, [collectionRows]);

  const selectedPayeeParty = useMemo(
    () => allPartyOptionsByKey.get(form.payeePartyKey) || null,
    [allPartyOptionsByKey, form.payeePartyKey]
  );

  const selectedPayeeAccount = useMemo(() => {
    if (!selectedPayeeParty?.coaId) return null;
    return (
      lineAccountOptions.find(
        (option) =>
          option?.coaId != null &&
          option.coaId !== "" &&
          Number(option.coaId) === Number(selectedPayeeParty.coaId)
      ) || null
    );
  }, [lineAccountOptions, selectedPayeeParty]);

  const applyPayeeAccountToLines = useCallback(
    (party, account, prevLines, { resetInvoice = false } = {}) => {
      if (!party || !account) return prevLines;
      const applyToLine = (line) => ({
        ...line,
        account: account.label || account.value,
        accountCoaId: String(account.coaId || account.id || ""),
        partyKey: party.value,
        partyType: party.type || "",
        partyId: party.id || "",
        partyCode: party.code || "",
        partyName: party.name || "",
        partyLabel: party.label || "",
        invoiceKey: resetInvoice ? "" : line.invoiceKey || "",
        contractId: resetInvoice ? "" : line.contractId || "",
        contractNo: resetInvoice ? "" : line.contractNo || "",
        invoiceNo: resetInvoice ? "" : line.invoiceNo || "",
        collectionEntryId: resetInvoice ? "" : line.collectionEntryId || "",
        tinTrn: line.tinTrn || party.tinTrn || "",
        total: computeLineTotal(line),
      });
      if (!prevLines?.length) return [applyToLine(createLineRow())];
      return prevLines.map(applyToLine);
    },
    []
  );

  useEffect(() => {
    if (!open || paymentLayout || receiptLayout || !selectedPayeeParty || !selectedPayeeAccount)
      return;
    setForm((prev) => ({
      ...prev,
      lines: applyPayeeAccountToLines(selectedPayeeParty, selectedPayeeAccount, prev.lines),
    }));
  }, [
    open,
    paymentLayout,
    receiptLayout,
    selectedPayeeParty,
    selectedPayeeAccount,
    applyPayeeAccountToLines,
  ]);

  const getLineAccountOptions = useCallback(
    (line) => {
      if (paymentSimplifiedLines) {
        return filterReceiptPartyControlAccountOptions(lineAccountOptions);
      }
      if (receiptSimplifiedLines) {
        return filterReceiptPartyControlAccountOptions(lineAccountOptions);
      }
      if ((!receiptLayout && !paymentLayout) || !form.receiptPartyType) return lineAccountOptions;
      return filterReceiptLineAccountOptions(lineAccountOptions, form.receiptPartyType);
    },
    [
      receiptSimplifiedLines,
      paymentSimplifiedLines,
      receiptLayout,
      paymentLayout,
      form.receiptPartyType,
      lineAccountOptions,
    ]
  );

  const unavailableCollectionEntryIds = useMemo(() => new Set(), []);

  const buildCollectionPartyOptions = useCallback(
    (line) => {
      const account = findLineAccountOption(lineAccountOptions, line);
      if (!account || !isCollectionAccountCoaOption(account)) return null;

      const selectedCollectionEntryId =
        parseReceiptCollectionEntryOptionValue(line.partyKey) ||
        String(line.collectionEntryId || "").trim();

      const selectedOnOtherLines = new Set(
        (form.lines || [])
          .filter((row) => row.id !== line.id)
          .map(
            (row) =>
              parseReceiptCollectionEntryOptionValue(row.partyKey) ||
              String(row.collectionEntryId || "").trim()
          )
          .filter(Boolean)
          .map(String)
      );

      return buildReceiptLineCollectionTenantOptions(collectionRows, account, {
        selectedCollectionEntryId,
        unavailableCollectionEntryIds: new Set([
          ...unavailableCollectionEntryIds,
          ...selectedOnOtherLines,
        ]),
      });
    },
    [collectionRows, form.lines, lineAccountOptions, unavailableCollectionEntryIds]
  );

  const getLinePartyOptions = useCallback(
    (line) => {
      if (!String(line?.account || "").trim() && !String(line?.accountCoaId || "").trim()) {
        return [];
      }

      const collectionPartyOptions = buildCollectionPartyOptions(line);
      if (collectionPartyOptions) return collectionPartyOptions;

      if (paymentSimplifiedLines || receiptSimplifiedLines) {
        return filterPaymentLinePartyOptions(displayPartyOptions, line, lineAccountOptions);
      }

      const account = findLineAccountOption(lineAccountOptions, line);
      const partyType = form.receiptPartyType;

      if (receiptLayout || paymentLayout) {
        if (!partyType) return [];
        const mode = getReceiptLineMode(partyType);
        if (!isReceiptInvoiceMode(mode)) return [];
        return filterReceiptLineEntityPartyOptions(displayPartyOptions, partyType, account);
      }
      const selectedControlAccount = String(account?.controlAccount || "")
        .trim()
        .toLowerCase();
      let linked = partyOptions.filter(
        (party) =>
          selectedControlAccount &&
          String(party.coaControlAccount || "")
            .trim()
            .toLowerCase() === selectedControlAccount
      );
      return linked.length ? linked : [];
    },
    [
      buildCollectionPartyOptions,
      receiptSimplifiedLines,
      paymentSimplifiedLines,
      receiptLayout,
      paymentLayout,
      form.receiptPartyType,
      lineAccountOptions,
      displayPartyOptions,
      partyOptions,
    ]
  );

  const getLineInvoiceOptions = useCallback(
    (line) => {
      if (!String(line?.account || "").trim() && !String(line?.accountCoaId || "").trim()) {
        return [];
      }
      if (!line?.partyKey) return [];

      const selectedCollectionEntryId =
        parseReceiptCollectionEntryOptionValue(line.partyKey) ||
        parseReceiptCollectionEntryOptionValue(line.invoiceKey) ||
        String(line.collectionEntryId || "").trim();

      const selectedOnOtherLines = new Set(
        (form.lines || [])
          .filter((row) => row.id !== line.id)
          .map(
            (row) =>
              parseReceiptCollectionEntryOptionValue(row.invoiceKey) ||
              parseReceiptCollectionEntryOptionValue(row.partyKey) ||
              String(row.collectionEntryId || "").trim()
          )
          .filter(Boolean)
          .map(String)
      );

      const collectionPartyEntry = collectionEntriesById.get(line.partyKey);
      if (collectionPartyEntry) {
        const party = buildSyntheticPartyFromCollectionEntry(collectionPartyEntry);
        return buildReceiptLineCollectionInvoiceOptions(collectionRows, party, {
          selectedCollectionEntryId,
          unavailableCollectionEntryIds: new Set([
            ...unavailableCollectionEntryIds,
            ...selectedOnOtherLines,
          ]),
        }).map(({ value, label }) => ({ value, label }));
      }

      const party = allPartyOptionsByKey.get(line.partyKey);
      if (!party || String(party?.type || line?.partyType || "").trim() !== "Tenant") return [];

      return buildReceiptLineCollectionInvoiceOptions(collectionRows, party, {
        selectedCollectionEntryId,
        unavailableCollectionEntryIds: new Set([
          ...unavailableCollectionEntryIds,
          ...selectedOnOtherLines,
        ]),
      }).map(({ value, label }) => ({ value, label }));
    },
    [
      allPartyOptionsByKey,
      collectionEntriesById,
      collectionRows,
      form.lines,
      unavailableCollectionEntryIds,
    ]
  );

  const updateHeader = (field, value) => {
    if (paymentLayout && !isEditMode && field === "vrNo") return;
    if (receiptLayout && field === "reference") {
      setForm((prev) => {
        if (prev.referenceAutomatic) return prev;
        return { ...prev, reference: value };
      });
      return;
    }
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "referenceAutomatic") {
        if (receiptLayout) {
          next.reference = value ? computeNextReceiptReference(existingReferences, prev.date) : "";
        } else {
          next.reference = value ? "Automatic" : "";
        }
      }
      if (field === "payeeContactType") {
        if (paymentLayout) {
          next.lines = [];
        } else if (!receiptLayout) {
          next.payeePartyKey = "";
          next.payeePartyId = "";
          next.payeePartyCode = "";
          next.payeeName = "";
        }
      }
      if (field === "receivedInCoaId") {
        const account = findLineAccountOption(receivedInAccountOptions, value);
        const ledgerId = account?.cashAndBankAccountId ?? account?.id ?? value;
        const coaId = account?.coaId ?? value;
        next.cashAndBankAccountId = ledgerId !== "" && ledgerId != null ? String(ledgerId) : "";
        next.receivedInCoaId = coaId !== "" && coaId != null ? String(coaId) : "";
        if (receiptLayout) {
          next.payeePartyId = coaId !== "" && coaId != null ? String(coaId) : "";
          next.payeePartyCode = account?.acctId ?? "";
          next.payeeName = account?.label || account?.acctName || "";
          next.payeeContactType = "";
          next.payeePartyKey = "";
          next.lines = [];
        }
        if (paymentLayout) {
          next.receivedFromAccountLabel = account?.label || "";
          next.paidFrom = account?.label || "";
          next.cashAndBankAccountId =
            ledgerId !== "" && ledgerId != null
              ? String(ledgerId)
              : String(resolveCashAndBankAccountIdFromSelection(value, cashAndBankOptions) ?? "");
          next.lines = [];
        }
      }
      if (field === "receiptPartyType") {
        next.receiptPartyType = value;
        next.lines = [];
      }
      if (field === "payeePartyKey") {
        const party = allPartyOptionsByKey.get(value);
        const account =
          party?.coaId != null && party.coaId !== ""
            ? lineAccountOptions.find(
                (option) =>
                  option?.coaId != null &&
                  option.coaId !== "" &&
                  Number(option.coaId) === Number(party.coaId)
              )
            : null;
        next.payeePartyId = party?.id || "";
        next.payeePartyCode = party?.code || "";
        next.payeeName = party?.name || party?.label || "";
        if (!receiptLayout) {
          next.payeeContactType = party?.type || normalizeContactType(next.payeeContactType);
        }
        next.lines = applyPayeeAccountToLines(party, account, prev.lines, { resetInvoice: true });
      }
      return next;
    });
  };

  const updateLine = (lineId, field, value) => {
    setForm((prev) => {
      const targetLine = prev.lines.find((line) => line.id === lineId);
      const resolvePaymentMode = (line, accountValue) => {
        if (!paymentLayout) return null;
        if (paymentSimplifiedLines) {
          const lookupLine =
            field === "account" ? { accountCoaId: accountValue, account: accountValue } : line;
          return getReceiptLineModeFromAccountOption(
            findLineAccountOption(lineAccountOptions, lookupLine)
          );
        }
        return getReceiptLineMode(prev.receiptPartyType);
      };
      const mode = resolvePaymentMode(targetLine, value);

      if (
        field === "invoiceKey" &&
        (receiptLayout || (paymentLayout && isPaymentInvoiceMode(mode)))
      ) {
        return {
          ...prev,
          lines: applyReceiptLineInvoiceSelection(prev.lines, lineId, value, {
            collectionRows,
            invoiceRowsByKey,
            pickField: pickCollectionField,
            getCollectionEntryOpenAmount,
          }),
        };
      }

      return {
        ...prev,
        lines: prev.lines.map((line) => {
          if (line.id !== lineId) return line;
          let updated = { ...line, [field]: value };
          if (field === "account") {
            const account = findLineAccountOption(lineAccountOptions, value);
            updated.accountCoaId = String(account?.coaId || account?.id || "");
            updated.account = formatLineAccountDropdownLabel(account) || account?.label || "";
            updated.partyKey = "";
            updated.partyType = "";
            updated.partyId = "";
            updated.partyCode = "";
            updated.partyName = "";
            updated.partyLabel = "";
            updated.contractId = "";
            updated.invoiceKey = "";
            updated.contractNo = "";
            updated.invoiceNo = "";
            updated.collectionEntryId = "";
            updated.amount = "";
            updated.tinTrn = "";
          }
          if (field === "partyKey") {
            const collectionEntryId = parseReceiptCollectionEntryOptionValue(value);
            if (collectionEntryId) {
              const entry = collectionEntriesById.get(collectionEntryId);
              if (entry) {
                return applyReceiptLinePartyFromCollectionEntry(updated, entry, {
                  duplicateTenantBusiness: true,
                });
              }
            }
            const party = allPartyOptionsByKey.get(value);
            updated.partyType = party?.type || "";
            updated.partyId = party?.id || "";
            updated.partyCode = party?.code || "";
            updated.partyName = party?.name || "";
            updated.partyLabel = party?.label || "";
            if (party?.type === "Account" && party?.coaId) {
              updated.partyId = String(party.coaId);
            }
            if (!updated.tinTrn && party?.tinTrn) updated.tinTrn = party.tinTrn;
            updated.contractId = party?.contractId || "";
            updated.contractNo = party?.contractNo || "";
            updated.invoiceKey = "";
            updated.invoiceNo = "";
            updated.collectionEntryId = "";
            updated.amount = "";
            updated.tinTrn = "";
          }
          if (field === "contractId") {
            const contract = receiptContractOptions.find(
              (option) => String(option.value) === String(value)
            );
            updated.contractId = contract ? String(contract.contractId ?? contract.value) : "";
            updated.contractNo = contract?.contractNo || "";
            updated.invoiceKey = "";
            updated.invoiceNo = "";
            updated.collectionEntryId = "";
          }
          if (field === "invoiceKey") {
            const invoice = invoiceRowsByKey.get(value);
            const collectionEntry =
              collectionEntriesById.get(value) || collectionRowsByKey.get(value);
            updated.contractNo =
              pickCollectionField(invoice, "contractNo", "ContractNo") ||
              pickCollectionField(collectionEntry, "contractNo", "ContractNo");
            updated.invoiceNo =
              pickCollectionField(invoice, "invoiceNo", "InvoiceNo") ||
              pickCollectionField(collectionEntry, "invoiceNo", "InvoiceNo");
            if (!String(updated.amount || "").trim()) {
              const balance = getCollectionEntryOpenAmount(collectionEntry, invoice);
              updated.amount = balance > 0 ? String(balance) : updated.amount;
            }
          }
          if (field === "productKey" && (paymentLayout || receiptLayout)) {
            const product = productOptions.find((option) => option.value === value);
            updated.productKey = value;
            updated.productType = product?.productType || "";
            updated.productId = product?.productId || "";
            updated.item = product?.label || "";
            const defaultPrice =
              product?.defaultUnitPrice != null && product.defaultUnitPrice !== ""
                ? String(product.defaultUnitPrice)
                : "";
            if (defaultPrice) {
              if (
                receiptLayout &&
                (receiptLineMode === RECEIPT_LINE_MODES.ACCOUNT_QTY ||
                  receiptLineMode === RECEIPT_LINE_MODES.ITEM_BASED)
              ) {
                updated.unitPrice = defaultPrice;
              } else if (!String(updated.amount || "").trim()) {
                updated.amount = defaultPrice;
              }
            }
            const resolveAccount = paymentLayout
              ? resolveProductAccountOption
              : resolveReceiptProductAccountOption;
            const account = resolveAccount(product, lineAccountOptions);
            if (account) {
              updated.account = account.label || "";
              updated.accountCoaId = String(account.coaId || account.id || "");
            }
          }
          if (paymentLayout && mode) {
            const lineMode =
              paymentSimplifiedLines && field === "account"
                ? getReceiptLineModeFromAccountOption(
                    findLineAccountOption(lineAccountOptions, updated)
                  ) || mode
                : mode;
            if (
              ["quantity", "unitPrice", "productKey", "amount", "invoiceKey", "account"].includes(
                field
              )
            ) {
              updated = syncPaymentLineAmount(updated, lineMode);
            }
          } else if (
            receiptLayout &&
            receiptLineMode &&
            receiptLineMode !== RECEIPT_LINE_MODES.LEGACY
          ) {
            const lineMode = receiptSimplifiedLines
              ? getReceiptLineModeFromAccountOption(
                  findLineAccountOption(lineAccountOptions, updated)
                )
              : receiptLineMode;
            if (
              lineMode &&
              [
                "quantity",
                "unitPrice",
                "amount",
                "discount",
                "tax",
                "invoiceKey",
                "productKey",
                "account",
              ].includes(field)
            ) {
              updated = syncReceiptLineAmount(updated, lineMode);
            }
          } else if (["amount", "quantity", "discount", "tax", "invoiceKey"].includes(field)) {
            updated.total = computeLineTotal(updated);
          }
          return updated;
        }),
      };
    });
  };

  const isPaymentFormLineComplete = useCallback(
    (line) => {
      if (paymentSimplifiedLines) {
        return isPaymentSimplifiedLineComplete(line);
      }
      return isPaymentLineComplete(line, paymentLineMode);
    },
    [paymentSimplifiedLines, lineAccountOptions, paymentLineMode]
  );

  const isReceiptFormLineComplete = useCallback(
    (line) => {
      if (receiptSimplifiedLines) {
        const account = findLineAccountOption(lineAccountOptions, line);
        const mode = getReceiptLineModeFromAccountOption(account);
        if (!mode) return Boolean(String(line.account || "").trim());
        return isReceiptLayoutLineComplete(line, mode);
      }
      if (receiptLayout && receiptLineMode && receiptLineMode !== RECEIPT_LINE_MODES.LEGACY) {
        return isReceiptLayoutLineComplete(line, receiptLineMode);
      }
      return isReceiptLineComplete(line, {
        requireItem: !receiptLayout,
        requireAccount: !receiptLayout,
      });
    },
    [receiptSimplifiedLines, lineAccountOptions, receiptLayout, receiptLineMode]
  );

  const handleAddLine = () => {
    setForm((prev) => {
      const { lines } = prev;
      const lineCompleteCheck = paymentLayout
        ? (line) => isPaymentFormLineComplete(line)
        : (line) => isReceiptFormLineComplete(line);
      if (lines.length > 0 && !lines.every(lineCompleteCheck)) {
        return prev;
      }
      const nextLine =
        !paymentLayout && selectedPayeeParty && selectedPayeeAccount
          ? applyPayeeAccountToLines(selectedPayeeParty, selectedPayeeAccount, [createLineRow()])[0]
          : createLineRow();
      return { ...prev, lines: [...lines, nextLine] };
    });
  };

  const handleDuplicateLine = (lineId) => {
    setForm((prev) => {
      const source = prev.lines.find((line) => line.id === lineId);
      const lineCompleteCheck = paymentLayout
        ? (line) => isPaymentFormLineComplete(line)
        : (line) => isReceiptFormLineComplete(line);
      if (!source || !lineCompleteCheck(source)) return prev;
      const duplicate = normalizeReceiptLineNumericDefaults({
        ...source,
        id: createLineRow().id,
      });
      const idx = prev.lines.findIndex((line) => line.id === lineId);
      const lines = [...prev.lines];
      lines.splice(idx + 1, 0, duplicate);
      return { ...prev, lines };
    });
  };

  const handleDeleteLine = (lineId) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((line) => line.id !== lineId),
    }));
  };

  const totalAttachmentSlots = existingFiles.length + selectedFiles.length;

  const handleFileSelect = (event) => {
    const list = event.target?.files ? Array.from(event.target.files) : [];
    if (!list.length) return;

    const remaining = MAX_ATTACHMENT_FILES - totalAttachmentSlots;
    if (remaining <= 0) {
      window.alert(
        `Maximum ${MAX_ATTACHMENT_FILES} files allowed. Please delete some existing files before uploading new ones.`
      );
      event.target.value = "";
      return;
    }

    if (list.length > remaining) {
      window.alert(
        `You can only upload ${remaining} more file(s). Maximum ${MAX_ATTACHMENT_FILES} files allowed (${existingFiles.length} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    const validFiles = list.filter((file) => {
      if (file.size > TRANSACTION_ATTACHMENT_MAX_BYTES) {
        window.alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });

    if (totalAttachmentSlots + validFiles.length > MAX_ATTACHMENT_FILES) {
      const allowedCount = MAX_ATTACHMENT_FILES - totalAttachmentSlots;
      window.alert(
        `You can only upload ${allowedCount} more file(s). Maximum ${MAX_ATTACHMENT_FILES} files allowed (${existingFiles.length} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleDeleteExistingFile = async (file) => {
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      window.alert("File ID is not available. Cannot delete this file.");
      return;
    }
    if (!window.confirm(`Delete "${file.fileName || file.name || "this file"}"?`)) return;
    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (initialData?.id) await fetchExistingFiles(initialData.id);
      onUploadSuccess?.(initialData?.id);
    } catch (error) {
      console.error("Failed to delete attachment:", error);
      window.alert(error?.message || "Failed to delete file.");
    }
  };

  const handleSave = async () => {
    let formForSave = form;
    if (receiptLayout && !isEditMode && form.referenceAutomatic) {
      try {
        const freshReferences = await fetchReceiptReferences(receiptsApi);
        const nextReference = computeNextReceiptReference(freshReferences, form.date);
        formForSave = { ...form, reference: nextReference };
        setExistingReferences(freshReferences);
        setForm(formForSave);
      } catch (error) {
        console.error("Error refreshing receipt references:", error);
      }
    }
    if (paymentLayout && !isEditMode) {
      try {
        const freshVrNos = await fetchPaymentVrNos(paymentsApi);
        const nextVrNo = computeNextPaymentVrNo(freshVrNos, form.date);
        formForSave = { ...form, vrNo: nextVrNo };
        setExistingPaymentVrNos(freshVrNos);
        setForm(formForSave);
      } catch (error) {
        console.error("Error refreshing payment Vr Nos:", error);
      }
    }

    const formForValidation = paymentLayout
      ? {
          ...formForSave,
          cashAndBankOptions,
          cashAndBankAccountId:
            resolveCashAndBankAccountIdFromSelection(
              formForSave.cashAndBankAccountId || formForSave.receivedInCoaId,
              cashAndBankOptions
            ) ?? formForSave.cashAndBankAccountId,
        }
      : formForSave;
    const validationErrors = paymentLayout
      ? validatePaymentForm(formForValidation, labels, lineAccountOptions, activeLockDate)
      : validateReceiptForm(
          formForSave,
          labels,
          showMonthField,
          receiptLayout,
          lineAccountOptions,
          activeLockDate
        );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      window.alert("Please complete all required fields before saving.");
      return;
    }
    setSaving(true);
    try {
      const payload = paymentLayout
        ? {
            ...formForValidation,
            grandTotal,
            lines: form.lines.map((line) => normalizeReceiptLineNumericDefaults(line)),
          }
        : {
            ...formForSave,
            grandTotal,
            lines: formForSave.lines.map((line) => normalizeReceiptLineNumericDefaults(line)),
          };
      const result = await onSubmit?.(payload);
      const savedId = initialData?.id ?? result?.id;
      if (receiptLayout && savedId) {
        try {
          await syncReceiptLinkedCollectionEntries({
            receiptId: savedId,
            reference: formForSave.reference,
            date: formForSave.date,
            lines: formForSave.lines,
            collectionRows,
          });
        } catch (error) {
          console.error("Failed to update linked collection entries:", error);
          window.alert(
            "Receipt saved, but failed to update linked collection invoice records (Vr No / Vr Date / Status)."
          );
        }
      }
      if (savedId && selectedFiles.length > 0) {
        setIsUploading(true);
        try {
          await uploadTransactionAttachments(savedId, uploadFormName, selectedFiles);
          setSelectedFiles([]);
          onUploadSuccess?.(savedId);
        } catch (error) {
          console.error("Error uploading files:", error);
          window.alert(`Failed to upload files: ${error.message}`);
          return;
        } finally {
          setIsUploading(false);
        }
      }
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const payeeNameField =
    !receiptLayout && form.payeeContactType === "Other" ? (
      <TextField
        fullWidth
        label={labels.payeePlaceholder || "Name"}
        value={form.payeeName}
        onChange={(e) => updateHeader("payeeName", e.target.value)}
        disabled={readOnly}
        size="small"
        placeholder={labels.payeePlaceholder}
        InputLabelProps={{ shrink: true }}
        error={Boolean(errors.payeeName)}
        helperText={errors.payeeName}
        sx={{ flex: 1, minWidth: 200, ...textFieldSx }}
      />
    ) : !receiptLayout ? (
      <FormControl
        size="small"
        error={Boolean(errors.payeeName)}
        sx={{ flex: 1, minWidth: 240, ...textFieldSx }}
      >
        <InputLabel id="receipt-payee-name-label" shrink>
          {labels.payeePlaceholder || "Name"}
        </InputLabel>
        <SearchableSelect
          labelId="receipt-payee-name-label"
          label={labels.payeePlaceholder || "Name"}
          value={form.payeePartyKey || ""}
          displayEmpty
          onChange={(e) => updateHeader("payeePartyKey", e.target.value)}
          disabled={readOnly}
        >
          <MenuItem value="">
            <em>Select {formatContactTypeLabel(form.payeeContactType)}</em>
          </MenuItem>
          {selectedPayeeOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </SearchableSelect>
        {errors.payeeName ? (
          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
            {errors.payeeName}
          </Typography>
        ) : null}
      </FormControl>
    ) : null;

  const contactTypeField = !receiptLayout ? (
    <FormControl size="small" sx={{ minWidth: 140, ...textFieldSx }}>
      <InputLabel id="receipt-contact-label">Contact</InputLabel>
      <SearchableSelect
        labelId="receipt-contact-label"
        label="Contact"
        value={form.payeeContactType}
        onChange={(e) => updateHeader("payeeContactType", e.target.value)}
        disabled={readOnly}
      >
        {PAYEE_CONTACT_TYPES.map((type) => (
          <MenuItem key={type} value={type}>
            {formatContactTypeLabel(type)}
          </MenuItem>
        ))}
      </SearchableSelect>
    </FormControl>
  ) : null;

  const receiptReferenceMd = receiptLayout
    ? 4
    : receiptSimplifiedLines
    ? scaleGridColumns(4)
    : scaleGridColumns(3);
  const receiptReceivedInMd = receiptLayout
    ? 4
    : receiptSimplifiedLines
    ? scaleGridColumns(4)
    : scaleGridColumns(3);

  const referenceSection = (mdCol = 4) => (
    <Grid item xs={12} sm={receiptLayout ? 4 : 6} md={mdCol}>
      <MDBox display="flex" alignItems="center" gap={1}>
        <FormControlLabel
          control={
            <Checkbox
              checked={Boolean(form.referenceAutomatic)}
              onChange={(e) => updateHeader("referenceAutomatic", e.target.checked)}
              size="small"
              disabled={readOnly}
            />
          }
          label="Reference"
          sx={{
            mr: 0,
            whiteSpace: "nowrap",
            ...(receiptLayout ? { "& .MuiFormControlLabel-label": { fontSize: "0.8125rem" } } : {}),
          }}
        />
        <TextField
          fullWidth
          value={form.reference}
          onChange={
            receiptLayout && form.referenceAutomatic
              ? undefined
              : (e) => updateHeader("reference", e.target.value)
          }
          disabled={readOnly || saving || form.referenceAutomatic}
          InputProps={{ readOnly: receiptLayout && form.referenceAutomatic }}
          size="small"
          placeholder={
            receiptLayout
              ? `${RECEIPT_REFERENCE_PREFIX}-1/${getReceiptYearFromDate(form.date)}`
              : "Reference"
          }
          sx={receiptLayout && form.referenceAutomatic ? readOnlyDarkTextFieldSx : textFieldSx}
        />
      </MDBox>
    </Grid>
  );

  const partyTypeDropdownSection = (
    <Grid item xs={12} sm={6} md={paymentLayout ? 3 : receiptLayout ? 2 : 4}>
      <FormControl fullWidth size="small" error={Boolean(errors.receiptPartyType)}>
        <InputLabel id="party-type-label" shrink>
          Party
        </InputLabel>
        <SearchableSelect
          labelId="party-type-label"
          label="Party"
          value={form.receiptPartyType || ""}
          displayEmpty
          onChange={(e) => updateHeader("receiptPartyType", e.target.value)}
          disabled={
            readOnly ||
            !(paymentLayout ? selectedPaymentReceivedFromAccount : selectedReceivedInAccount)
          }
          sx={textFieldSx}
        >
          <MenuItem value="">
            <em>Select party type</em>
          </MenuItem>
          {RECEIPT_PARTY_TYPES.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </SearchableSelect>
        {errors.receiptPartyType ? (
          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
            {errors.receiptPartyType}
          </Typography>
        ) : null}
      </FormControl>
    </Grid>
  );

  const receiptReceivedInSection = (
    <Grid
      item
      xs={12}
      sm={receiptLayout ? 4 : 6}
      md={receiptLayout ? receiptReceivedInMd : receiptSimplifiedLines ? 4 : 3}
    >
      <FormControl
        fullWidth
        size="small"
        error={Boolean(errors.receivedInCoaId || errors.payeeName)}
      >
        <InputLabel id="receipt-received-in-label" shrink>
          {labels.payeeSection || "Received In"}
        </InputLabel>
        <SearchableSelect
          labelId="receipt-received-in-label"
          label={labels.payeeSection || "Received In"}
          value={getReceivedInSelectValue(form)}
          displayEmpty
          onChange={(e) => updateHeader("receivedInCoaId", e.target.value)}
          disabled={readOnly}
          renderValue={(selected) => {
            const selectedValue = String(selected ?? "");
            if (!selectedValue) return "";
            const option = findLineAccountOption(receivedInAccountOptions, selectedValue);
            return option?.label || selectedValue;
          }}
          sx={textFieldSx}
        >
          <MenuItem value="">
            <em>Select account</em>
          </MenuItem>
          {receivedInAccountOptions.map((option) => (
            <MenuItem key={option.value} value={String(option.value)}>
              {option.label}
            </MenuItem>
          ))}
        </SearchableSelect>
        {errors.receivedInCoaId || errors.payeeName ? (
          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
            {errors.receivedInCoaId || errors.payeeName}
          </Typography>
        ) : null}
      </FormControl>
    </Grid>
  );

  const paymentReceivedFromSection = (
    <Grid item xs={12} sm={6} md={3}>
      <FormControl fullWidth size="small" error={Boolean(errors.receivedInCoaId)}>
        <InputLabel id="payment-received-from-label" shrink>
          {labels.paidFrom}
        </InputLabel>
        <SearchableSelect
          labelId="payment-received-from-label"
          label={labels.paidFrom}
          value={getReceivedInSelectValue(form)}
          displayEmpty
          onChange={(e) => updateHeader("receivedInCoaId", e.target.value)}
          disabled={readOnly}
          renderValue={(selected) => {
            const selectedValue = String(selected ?? "");
            if (!selectedValue) return "";
            const option = findLineAccountOption(receivedInAccountOptions, selectedValue);
            return option?.label || selectedValue;
          }}
          sx={textFieldSx}
        >
          <MenuItem value="">
            <em>Select account</em>
          </MenuItem>
          {receivedInAccountOptions.map((option) => (
            <MenuItem key={option.value} value={String(option.value)}>
              {option.label}
            </MenuItem>
          ))}
        </SearchableSelect>
        {errors.receivedInCoaId ? (
          <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
            {errors.receivedInCoaId}
          </Typography>
        ) : null}
      </FormControl>
    </Grid>
  );

  const payeeSection = !receiptLayout ? (
    <Grid item xs={12} md={8}>
      <MDTypography variant="caption" fontWeight="bold" display="block" mb={0.5}>
        {labels.payeeSection}
      </MDTypography>
      <MDBox display="flex" gap={1} flexWrap="wrap">
        {contactTypeField}
        {payeeNameField}
      </MDBox>
    </Grid>
  ) : null;

  const paidFromSection = (mdCol = receiptLayout ? 2 : 3) =>
    receiptLayout ? (
      <Grid item xs={12} sm={6} md={mdCol}>
        <TextField
          fullWidth
          label={labels.paidFrom}
          value={form.paidFrom}
          onChange={(e) => updateHeader("paidFrom", e.target.value)}
          disabled={readOnly}
          size="small"
          placeholder={labels.paidFrom}
          InputLabelProps={{ shrink: true }}
          error={Boolean(errors.paidFrom)}
          helperText={errors.paidFrom}
          sx={textFieldSx}
        />
      </Grid>
    ) : (
      <Grid item xs={12} sm={6} md={mdCol}>
        <FormControl fullWidth size="small" error={Boolean(errors.paidFrom)}>
          <InputLabel id="receipt-paid-by-label" shrink>
            {labels.paidFrom}
          </InputLabel>
          <SearchableSelect
            labelId="receipt-paid-by-label"
            label={labels.paidFrom}
            value={form.paidFrom}
            displayEmpty
            onChange={(e) => updateHeader("paidFrom", e.target.value)}
            disabled={readOnly}
            sx={textFieldSx}
          >
            <MenuItem value="">
              <em>Account</em>
            </MenuItem>
            {PAID_FROM_ACCOUNTS.map((name) => (
              <MenuItem key={name} value={name}>
                {name}
              </MenuItem>
            ))}
          </SearchableSelect>
        </FormControl>
      </Grid>
    );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xl"
      scroll="paper"
      disableRestoreFocus
      disableEnforceFocus
    >
      <DialogTitle sx={{ color: "#344767", pb: 1 }}>
        {readOnly
          ? labels.viewFormTitle || "View Receipt"
          : isFormLockedByDate
          ? labels.viewFormTitle || "View Receipt"
          : isEditMode
          ? labels.editFormTitle
          : labels.addFormTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={receiptLayout ? 4 : 6} md={receiptLayout ? 4 : 3}>
            {receiptLayout || paymentLayout ? (
              <ReceiptDateField
                value={form.date}
                onChange={(nextValue) => updateHeader("date", nextValue)}
                disabled={formReadOnly}
                readOnly={formReadOnly}
                min={minDateAfterLock}
                error={Boolean(errors.date)}
                helperText={errors.date}
              />
            ) : (
              <TextField
                fullWidth
                type="date"
                label="Date"
                value={form.date}
                onChange={(e) => updateHeader("date", e.target.value)}
                disabled={readOnly}
                InputLabelProps={{ shrink: true }}
                size="small"
                error={Boolean(errors.date)}
                helperText={errors.date}
                sx={textFieldSx}
              />
            )}
          </Grid>
          {showMonthField ? (
            <Grid item xs={12} sm={6} md={3}>
              <TextField
                fullWidth
                type="month"
                label={labels.month || "Month"}
                value={monthYearToInputValue(form.month)}
                onChange={(e) => updateHeader("month", inputValueToMonthYear(e.target.value))}
                disabled={readOnly}
                InputLabelProps={{ shrink: true }}
                size="small"
                error={Boolean(errors.month)}
                helperText={errors.month || "MMM/YYYY"}
                sx={textFieldSx}
              />
            </Grid>
          ) : null}
          {paymentLayout ? (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label={labels.vrNo || "Vr No"}
                  value={form.vrNo || ""}
                  onChange={
                    paymentLayout && !isEditMode
                      ? undefined
                      : (e) => updateHeader("vrNo", e.target.value)
                  }
                  disabled={readOnly || saving || (paymentLayout && !isEditMode)}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  placeholder={`${PAYMENT_VR_NO_PREFIX}-1/${getPaymentYearFromDate(form.date)}`}
                  InputProps={{ readOnly: paymentLayout && !isEditMode }}
                  error={Boolean(errors.vrNo)}
                  helperText={errors.vrNo}
                  sx={paymentLayout && !isEditMode ? paymentVrNoFieldSx : textFieldSx}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label={labels.payeePlaceholder || "Paid To"}
                  value={form.payeeName}
                  onChange={(e) => updateHeader("payeeName", e.target.value)}
                  disabled={readOnly}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  error={Boolean(errors.payeeName)}
                  helperText={errors.payeeName}
                  sx={textFieldSx}
                />
              </Grid>
              {paymentReceivedFromSection}
            </>
          ) : (
            <>
              {receiptLayout ? (
                <>
                  {referenceSection(receiptReferenceMd)}
                  {receiptReceivedInSection}
                  {!receiptSimplifiedLines ? partyTypeDropdownSection : null}
                </>
              ) : (
                <>
                  {referenceSection(4)}
                  {paidFromSection()}
                  {payeeSection}
                </>
              )}
            </>
          )}
          {receiptLayout ? (
            <>
              {paidFromSection(6)}
              <Grid item xs={12} sm={6} md={6}>
                <TextField
                  fullWidth
                  label="Description"
                  value={form.description}
                  onChange={(e) => updateHeader("description", e.target.value)}
                  disabled={readOnly}
                  size="small"
                  placeholder="Optional"
                  sx={textFieldSx}
                />
              </Grid>
            </>
          ) : (
            <Grid item xs={12} md={12}>
              <TextField
                fullWidth
                label="Description"
                value={form.description}
                onChange={(e) => updateHeader("description", e.target.value)}
                disabled={readOnly}
                size="small"
                placeholder="Optional"
                sx={textFieldSx}
              />
            </Grid>
          )}
        </Grid>

        <MDBox sx={{ mb: 2 }}>
          {paymentLayout ? (
            showPaymentLinesGrid ? (
              <PaymentLinesGrid
                lines={form.lines}
                paymentLineMode={paymentLineMode}
                partyType={form.receiptPartyType}
                simplified={paymentSimplifiedLines}
                accountOptions={lineAccountOptions}
                getLineAccountOptions={getLineAccountOptions}
                getLinePartyOptions={getLinePartyOptions}
                getLineInvoiceOptions={getLineInvoiceOptions}
                productOptions={productOptions}
                errors={errors}
                saving={saving}
                grandTotal={grandTotal}
                readOnly={readOnly}
                onLineChange={updateLine}
                onAddLine={handleAddLine}
                onDuplicateLine={handleDuplicateLine}
                onDeleteLine={handleDeleteLine}
              />
            ) : (
              <MDTypography variant="caption" color="text">
                Select Received In to load line items.
              </MDTypography>
            )
          ) : showReceiptLinesGrid ? (
            <ReceiptLinesGrid
              lines={form.lines}
              receiptLineMode={
                receiptLayout && receiptLineMode !== RECEIPT_LINE_MODES.LEGACY
                  ? receiptLineMode
                  : undefined
              }
              receiptPartyType={form.receiptPartyType}
              receiptSimplifiedLines={receiptSimplifiedLines}
              accountOptions={lineAccountOptions}
              getLineAccountOptions={getLineAccountOptions}
              getLinePartyOptions={getLinePartyOptions}
              contractOptions={receiptContractOptions}
              getLineInvoiceOptions={getLineInvoiceOptions}
              productOptions={productOptions}
              errors={errors}
              saving={saving}
              grandTotal={grandTotal}
              accountReadOnly={!receiptLayout && Boolean(selectedPayeeAccount)}
              readOnly={readOnly}
              showContractColumn={!receiptLayout}
              hideAccountColumn={false}
              requireLineAccount
              requireLineItem={receiptLayout ? false : undefined}
              onLineChange={updateLine}
              onAddLine={handleAddLine}
              onDuplicateLine={handleDuplicateLine}
              onDeleteLine={handleDeleteLine}
            />
          ) : (
            <MDTypography variant="caption" color="text">
              {receiptSimplifiedLines
                ? "Select Received In to load line items."
                : "Select Received In and Party to load line items."}
            </MDTypography>
          )}
        </MDBox>

        <MDBox
          sx={{
            border: "1px dashed",
            borderColor: "grey.400",
            borderRadius: 2,
            p: 2,
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Attachments (max {MAX_ATTACHMENT_FILES} files total)
          </Typography>

          {isEditMode ? (
            loadingExistingFiles ? (
              <MDBox display="flex" justifyContent="center" py={1}>
                <CurrencyLoading size={20} />
              </MDBox>
            ) : existingFiles.length > 0 ? (
              <MDBox mb={2}>
                <Typography variant="caption" color="text" display="block" sx={{ mb: 1 }}>
                  Already uploaded files ({existingFiles.length}/{MAX_ATTACHMENT_FILES}):
                </Typography>
                {existingFiles.map((file, index) => (
                  <Chip
                    key={file.id || file.fileName || index}
                    label={file.fileName || `File ${index + 1}`}
                    onDelete={
                      readOnly || !canDeleteCurrentMenu()
                        ? undefined
                        : () => handleDeleteExistingFile(file)
                    }
                    size="small"
                    sx={{ mr: 0.5, mb: 0.5 }}
                    variant="outlined"
                  />
                ))}
              </MDBox>
            ) : null
          ) : null}

          {!readOnly ? (
            totalAttachmentSlots >= MAX_ATTACHMENT_FILES ? (
              <Typography variant="caption" color="warning.main" display="block" sx={{ mb: 1 }}>
                Maximum {MAX_ATTACHMENT_FILES} files already uploaded. Delete existing files to
                upload new ones.
              </Typography>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  accept="*/*"
                  style={{ display: "none" }}
                  id="receipt-attachment-file-input"
                  type="file"
                  multiple
                  onChange={handleFileSelect}
                  disabled={saving || isUploading || totalAttachmentSlots >= MAX_ATTACHMENT_FILES}
                />
                <label htmlFor="receipt-attachment-file-input">
                  <MDButton
                    variant="gradient"
                    color="info"
                    component="span"
                    size="small"
                    disabled={saving || isUploading || totalAttachmentSlots >= MAX_ATTACHMENT_FILES}
                    sx={{ mb: 1 }}
                  >
                    <Icon>cloud_upload</Icon>&nbsp; Upload Files ({totalAttachmentSlots}/
                    {MAX_ATTACHMENT_FILES})
                  </MDButton>
                </label>
                {totalAttachmentSlots < MAX_ATTACHMENT_FILES ? (
                  <Typography variant="caption" color="text" display="block">
                    You can upload {MAX_ATTACHMENT_FILES - totalAttachmentSlots} more file(s).
                  </Typography>
                ) : null}
              </>
            )
          ) : null}

          {selectedFiles.length > 0 ? (
            <Box mt={1}>
              <Typography variant="caption" color="text" display="block" sx={{ mb: 0.5 }}>
                New files to upload:
              </Typography>
              {selectedFiles.map((file, index) => (
                <Chip
                  key={`${file.name}-${index}`}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  onDelete={readOnly ? undefined : () => handleRemoveSelectedFile(index)}
                  deleteIcon={<Icon fontSize="small">cancel</Icon>}
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          ) : selectedFiles.length === 0 && existingFiles.length === 0 ? (
            <Typography variant="caption" color="text" display="block" sx={{ mt: 1 }}>
              No files selected. Click &quot;Upload Files&quot; to add attachments.
            </Typography>
          ) : null}
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton
          variant="outlined"
          color="secondary"
          onClick={onClose}
          disabled={saving || isUploading}
        >
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        {!formReadOnly ? (
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            disabled={saving || isUploading}
          >
            <Icon>save</Icon>&nbsp;{saving || isUploading ? "Saving…" : "Save"}
          </MDButton>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

ReceiptForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
  labels: PropTypes.object,
  showMonthField: PropTypes.bool,
  receiptLayout: PropTypes.bool,
  paymentLayout: PropTypes.bool,
  readOnly: PropTypes.bool,
  onUploadSuccess: PropTypes.func,
  activeLockDate: PropTypes.string,
};

ReceiptForm.defaultProps = {
  onSubmit: undefined,
  initialData: undefined,
  labels: PAYMENTS_LABELS,
  showMonthField: false,
  receiptLayout: false,
  paymentLayout: false,
  readOnly: false,
  onUploadSuccess: undefined,
  activeLockDate: "",
};
