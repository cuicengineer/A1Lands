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
import api from "services/api.service";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import customerApi from "services/api.customer.service";
import supplierApi from "services/api.supplier.service";
import collectionsApi from "services/api.collections.service";
import contractApi from "services/api.contract.service";
import {
  buildInvoiceKey,
  computeInvoiceBalance,
  formatInvoiceLabel,
  normalizeCollectionEntryRow,
  pickField as pickCollectionField,
} from "layouts/income-agreements/collections/collectionsUtils";
import {
  MAX_ATTACHMENT_FILES,
  PAID_FROM_ACCOUNTS,
  PAYEE_CONTACT_TYPES,
  applyReceiptLineInvoiceSelection,
  buildLineAccountOptions,
  buildReceiptContractOptions,
  buildReceiptFormState,
  computeGrandTotal,
  computeLineTotal,
  createLineRow,
  findLineAccountOption,
  formatAmount,
  isReceiptLineComplete,
  inputValueToMonthYear,
  isValidMonthYear,
  monthYearToInputValue,
  normalizeReceiptInvoiceKey,
  normalizeReceiptLineNumericDefaults,
  parseAmount,
} from "./receiptUtils";
import ReceiptLinesGrid from "./ReceiptLinesGrid";
import { PAYMENTS_LABELS } from "./transactionLabels";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
  "& .MuiInputLabel-root": { top: 0 },
};

function ReceiptDateField({ value, onChange, disabled, readOnly, error, helperText }) {
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
};

ReceiptDateField.defaultProps = {
  value: "",
  disabled: false,
  readOnly: false,
  error: false,
  helperText: "",
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
  const deleted = row?.isDeleted;
  if (deleted === true || deleted === 1 || deleted === "1") return false;
  if (typeof deleted === "string" && deleted.trim().toLowerCase() === "true") return false;
  return Boolean(String(row?.invoiceNo || "").trim());
}

function partyMatchesCollectionEntry(party, entry) {
  if (!party || !entry) return false;
  if (party.coaId && entry.coaId && Number(party.coaId) === Number(entry.coaId)) return true;
  const haystack = String(entry.tenantBusiness || "").toLowerCase();
  return [party.code, party.name]
    .filter(Boolean)
    .some((value) => haystack.includes(String(value).trim().toLowerCase()));
}

function findByValue(options, value) {
  return (options || []).find((option) => String(option.value) === String(value)) || null;
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
  unavailableInvoiceKeySet = new Set()
) {
  const errors = {};
  if (!form.date) errors.date = "Date is required";
  if (showMonthField && !isValidMonthYear(form.month)) {
    errors.month = labels.monthRequired || "Month is required";
  }
  if (!form.paidFrom) errors.paidFrom = labels.paidFromRequired;
  if (!form.payeeName?.trim()) errors.payeeName = labels.payeeRequired;
  const lines = form.lines || [];
  if (!lines.length) errors.lines = "At least one line item is required";
  lines.forEach((line, idx) => {
    if (!receiptLayout && !line.item) errors[`line-${idx}-item`] = "Item is required";
    if (!line.account) errors[`line-${idx}-account`] = "Account is required";
    const invoiceKey = normalizeReceiptInvoiceKey(line).toLowerCase();
    if (receiptLayout && invoiceKey && unavailableInvoiceKeySet.has(invoiceKey)) {
      errors[`line-${idx}-invoice`] = "This invoice already has an active receipt";
    }
    if (parseAmount(line.amount) <= 0) errors[`line-${idx}-amount`] = "Amount is required";
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
  readOnly = false,
  unavailableInvoiceKeys = [],
}) {
  const [form, setForm] = useState(() => buildReceiptFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [lineAccountOptions, setLineAccountOptions] = useState([]);
  const [partyOptions, setPartyOptions] = useState([]);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [collectionRows, setCollectionRows] = useState([]);
  const [contractRows, setContractRows] = useState([]);
  const fileInputRef = useRef(null);

  const isEditMode = Boolean(initialData?.id);
  const unavailableInvoiceKeySet = useMemo(
    () => new Set((unavailableInvoiceKeys || []).map((key) => String(key || "").toLowerCase())),
    [unavailableInvoiceKeys]
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
        chartOfAccountsApi.getAll(COA_SECTION_TYPE),
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
        const coaById = new Map(
          coaRows
            .map((row) => [Number(row?.id ?? row?.Id), row])
            .filter(([id]) => Number.isFinite(id))
        );
        const savedAccounts = (initialData?.lines || [])
          .map((line) => line?.account)
          .filter(Boolean);
        const options = buildLineAccountOptions(coaRows, savedAccounts);
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
            const coa = coaById.get(Number(party.coaId));
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
          .filter(isActiveCollectionEntry);
        setLineAccountOptions(options);
        setPartyOptions(parties);
        setInvoiceRows(invoices);
        setCollectionRows(collections);
      } catch (error) {
        console.error("Error fetching receipt form catalogs:", error);
        setLineAccountOptions([]);
        setPartyOptions([]);
        setInvoiceRows([]);
        setCollectionRows([]);
      }
    };

    fetchFormCatalogs();

    return () => {
      cancelled = true;
    };
  }, [open, initialData]);

  useEffect(() => {
    if (!open || !receiptLayout) {
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
  }, [open, receiptLayout]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      setForm(
        buildReceiptFormState({
          ...initialData,
          lines:
            Array.isArray(initialData.lines) && initialData.lines.length
              ? initialData.lines.map((line) =>
                  normalizeReceiptLineNumericDefaults({
                    ...createLineRow(),
                    ...line,
                  })
                )
              : [],
          attachments: Array.isArray(initialData.attachments) ? [...initialData.attachments] : [],
        })
      );
    } else {
      setForm(buildReceiptFormState());
    }
    setErrors({});
  }, [open, initialData]);

  const grandTotal = useMemo(() => computeGrandTotal(form.lines), [form.lines]);

  const receiptContractOptions = useMemo(
    () => buildReceiptContractOptions(contractRows),
    [contractRows]
  );

  const selectedPayeeOptions = useMemo(() => {
    if (receiptLayout) return partyOptions;
    const contactType = normalizeContactType(form.payeeContactType);
    return partyOptions.filter((option) => option.type === contactType || contactType === "Other");
  }, [partyOptions, form.payeeContactType, receiptLayout]);

  const allPartyOptionsByKey = useMemo(() => {
    const map = new Map();
    partyOptions.forEach((option) => map.set(option.value, option));
    return map;
  }, [partyOptions]);

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
    if (!open || !selectedPayeeParty || !selectedPayeeAccount) return;
    setForm((prev) => ({
      ...prev,
      lines: applyPayeeAccountToLines(selectedPayeeParty, selectedPayeeAccount, prev.lines),
    }));
  }, [open, selectedPayeeParty, selectedPayeeAccount, applyPayeeAccountToLines]);

  const getLinePartyOptions = (line) => {
    const account = findLineAccountOption(lineAccountOptions, line);
    const selectedControlAccount = String(account?.controlAccount || "")
      .trim()
      .toLowerCase();
    const linked = partyOptions.filter(
      (party) =>
        selectedControlAccount &&
        String(party.coaControlAccount || "")
          .trim()
          .toLowerCase() === selectedControlAccount
    );
    return linked.length ? linked : [];
  };

  const getLineInvoiceOptions = (line) => {
    const party = allPartyOptionsByKey.get(line?.partyKey);
    if (!party) return [];
    const selectedInvoiceKey = normalizeReceiptInvoiceKey(line).toLowerCase();
    const byKey = new Map();
    collectionRows.forEach((entry) => {
      if (!partyMatchesCollectionEntry(party, entry)) return;
      const key = buildInvoiceKey(entry);
      if (key && !byKey.has(key)) byKey.set(key, entry);
    });
    return Array.from(byKey.values())
      .filter((entry) => {
        const lineContractNo = String(line?.contractNo || "").trim();
        if (!lineContractNo) return true;
        const entryContractNo = String(
          pickCollectionField(entry, "contractNo", "ContractNo") || ""
        ).trim();
        return entryContractNo.toLowerCase() === lineContractNo.toLowerCase();
      })
      .filter((entry) => {
        const key = buildInvoiceKey(entry);
        const normalizedKey = String(key || "").toLowerCase();
        return (
          !normalizedKey ||
          normalizedKey === selectedInvoiceKey ||
          !unavailableInvoiceKeySet.has(normalizedKey)
        );
      })
      .map((entry) => {
        const key = buildInvoiceKey(entry);
        const invoice = invoiceRowsByKey.get(key);
        const openAmount = getCollectionEntryOpenAmount(entry, invoice);
        const label = invoice
          ? formatInvoiceLabel(invoice)
          : [entry.invoiceNo, entry.contractNo].filter(Boolean).join("-");
        return {
          value: key,
          label: openAmount > 0 ? `${label} - Balance ${formatAmount(openAmount)}` : label,
        };
      });
  };

  const updateHeader = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "referenceAutomatic") {
        next.reference = value ? "Automatic" : "";
      }
      if (field === "payeeContactType" && !receiptLayout) {
        next.payeePartyKey = "";
        next.payeePartyId = "";
        next.payeePartyCode = "";
        next.payeeName = "";
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
      if (field === "invoiceKey" && receiptLayout) {
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
          const updated = { ...line, [field]: value };
          if (field === "account") {
            const account = findLineAccountOption(lineAccountOptions, value);
            updated.accountCoaId = String(account?.coaId || account?.id || "");
            updated.account = account?.label || "";
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
          }
          if (field === "partyKey") {
            const party = allPartyOptionsByKey.get(value);
            updated.partyType = party?.type || "";
            updated.partyId = party?.id || "";
            updated.partyCode = party?.code || "";
            updated.partyName = party?.name || "";
            updated.partyLabel = party?.label || "";
            if (!updated.tinTrn && party?.tinTrn) updated.tinTrn = party.tinTrn;
            updated.contractId = "";
            updated.invoiceKey = "";
            updated.contractNo = "";
            updated.invoiceNo = "";
            updated.collectionEntryId = "";
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
            const collectionEntry = collectionRowsByKey.get(value);
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
          if (["amount", "quantity", "discount", "tax", "invoiceKey"].includes(field)) {
            updated.total = computeLineTotal(updated);
          }
          return updated;
        }),
      };
    });
  };

  const handleAddLine = () => {
    setForm((prev) => {
      const { lines } = prev;
      if (
        lines.length > 0 &&
        !lines.every((line) => isReceiptLineComplete(line, { requireItem: !receiptLayout }))
      ) {
        return prev;
      }
      const nextLine =
        selectedPayeeParty && selectedPayeeAccount
          ? applyPayeeAccountToLines(selectedPayeeParty, selectedPayeeAccount, [createLineRow()])[0]
          : createLineRow();
      return { ...prev, lines: [...lines, nextLine] };
    });
  };

  const handleDuplicateLine = (lineId) => {
    setForm((prev) => {
      const source = prev.lines.find((line) => line.id === lineId);
      if (!source || !isReceiptLineComplete(source, { requireItem: !receiptLayout })) return prev;
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

  const handleFileSelect = (event) => {
    const list = event.target?.files ? Array.from(event.target.files) : [];
    if (!list.length) return;
    setForm((prev) => {
      const existing = prev.attachments || [];
      const remaining = MAX_ATTACHMENT_FILES - existing.length;
      if (remaining <= 0) {
        window.alert(`Maximum ${MAX_ATTACHMENT_FILES} files allowed.`);
        return prev;
      }
      const accepted = list.slice(0, remaining).map((file) => ({
        id: `file-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        name: file.name,
        size: file.size,
        file,
      }));
      return { ...prev, attachments: [...existing, ...accepted] };
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveAttachment = (fileId) => {
    setForm((prev) => ({
      ...prev,
      attachments: (prev.attachments || []).filter((f) => f.id !== fileId),
    }));
  };

  const handleSave = async () => {
    const validationErrors = validateReceiptForm(
      form,
      labels,
      showMonthField,
      receiptLayout,
      unavailableInvoiceKeySet
    );
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      const hasDuplicateInvoice = Object.keys(validationErrors).some((key) =>
        key.endsWith("-invoice")
      );
      window.alert(
        hasDuplicateInvoice
          ? "One or more selected invoices already have an active receipt."
          : "Please complete all required fields before saving."
      );
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        grandTotal,
        lines: form.lines.map((line) => normalizeReceiptLineNumericDefaults(line)),
      };
      await onSubmit?.(payload);
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
    ) : (
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
            <em>
              Select {receiptLayout ? "party" : formatContactTypeLabel(form.payeeContactType)}
            </em>
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
    );

  const contactTypeField = receiptLayout ? (
    <TextField
      label="Contact"
      value={form.payeeContactType}
      onChange={(e) => updateHeader("payeeContactType", e.target.value)}
      disabled={readOnly}
      size="small"
      placeholder="Contact"
      InputLabelProps={{ shrink: true }}
      sx={{ flex: 1, minWidth: 160, ...textFieldSx }}
    />
  ) : (
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
  );

  const payeeSection = (
    <Grid item xs={12} md={8}>
      <MDTypography variant="caption" fontWeight="bold" display="block" mb={0.5}>
        {labels.payeeSection}
      </MDTypography>
      <MDBox display="flex" gap={1} flexWrap="wrap">
        {receiptLayout ? (
          <>
            {payeeNameField}
            {contactTypeField}
          </>
        ) : (
          <>
            {contactTypeField}
            {payeeNameField}
          </>
        )}
      </MDBox>
    </Grid>
  );

  const paidFromSection = (
    <Grid item xs={12} sm={6} md={3}>
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
          : isEditMode
          ? labels.editFormTitle
          : labels.addFormTitle}
      </DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            {receiptLayout ? (
              <ReceiptDateField
                value={form.date}
                onChange={(nextValue) => updateHeader("date", nextValue)}
                disabled={readOnly}
                readOnly={readOnly}
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
          <Grid item xs={12} sm={6} md={4}>
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
                sx={{ mr: 0, whiteSpace: "nowrap" }}
              />
              <TextField
                fullWidth
                value={form.reference}
                onChange={(e) => updateHeader("reference", e.target.value)}
                disabled={readOnly || form.referenceAutomatic}
                size="small"
                placeholder="Reference"
                sx={textFieldSx}
              />
            </MDBox>
          </Grid>
          {receiptLayout ? (
            <>
              {payeeSection}
              {paidFromSection}
            </>
          ) : (
            <>
              {paidFromSection}
              {payeeSection}
            </>
          )}
          <Grid item xs={12}>
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
        </Grid>

        <MDBox sx={{ mb: 2 }}>
          <ReceiptLinesGrid
            lines={form.lines}
            accountOptions={lineAccountOptions}
            getLinePartyOptions={getLinePartyOptions}
            contractOptions={receiptContractOptions}
            getLineInvoiceOptions={getLineInvoiceOptions}
            errors={errors}
            saving={saving}
            grandTotal={grandTotal}
            accountReadOnly={Boolean(selectedPayeeAccount)}
            readOnly={readOnly}
            showContractColumn={receiptLayout}
            onLineChange={updateLine}
            onAddLine={handleAddLine}
            onDuplicateLine={handleDuplicateLine}
            onDeleteLine={handleDeleteLine}
          />
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
            Attachments (max {MAX_ATTACHMENT_FILES} files)
          </Typography>
          <input
            ref={fileInputRef}
            accept="*/*"
            style={{ display: "none" }}
            id="receipt-attachment-file-input"
            type="file"
            multiple
            onChange={handleFileSelect}
            disabled={readOnly || (form.attachments || []).length >= MAX_ATTACHMENT_FILES}
          />
          {!readOnly ? (
            <label htmlFor="receipt-attachment-file-input">
              <MDButton
                variant="gradient"
                color="info"
                component="span"
                size="small"
                disabled={(form.attachments || []).length >= MAX_ATTACHMENT_FILES}
                sx={{ mb: 1 }}
              >
                <Icon>cloud_upload</Icon>&nbsp; Add files ({(form.attachments || []).length}/
                {MAX_ATTACHMENT_FILES})
              </MDButton>
            </label>
          ) : null}
          {(form.attachments || []).length > 0 && (
            <Box mt={1}>
              {(form.attachments || []).map((file) => (
                <Chip
                  key={file.id}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  onDelete={readOnly ? undefined : () => handleRemoveAttachment(file.id)}
                  deleteIcon={<Icon fontSize="small">cancel</Icon>}
                  size="small"
                  sx={{ mr: 0.5, mb: 0.5 }}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </Box>
          )}
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          <Icon>close</Icon>&nbsp;Cancel
        </MDButton>
        {!readOnly ? (
          <MDButton variant="gradient" color="info" onClick={handleSave} disabled={saving}>
            <Icon>save</Icon>&nbsp;{saving ? "Saving…" : "Save"}
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
  readOnly: PropTypes.bool,
  unavailableInvoiceKeys: PropTypes.arrayOf(PropTypes.string),
};

ReceiptForm.defaultProps = {
  onSubmit: undefined,
  initialData: undefined,
  labels: PAYMENTS_LABELS,
  showMonthField: false,
  receiptLayout: false,
  readOnly: false,
  unavailableInvoiceKeys: [],
};
