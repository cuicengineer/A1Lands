import { useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import {
  buildCollectionGroupParentFields,
  computeCollectionGroupAmounts,
  createEmptyCollectionLineItem,
  formatAgreementLabel,
  formatAmount,
  formatDisplayDate,
  formatCollectionInvoiceDropdownLabel,
  formatTenantBusinessLabel,
  buildInvoiceKey,
  formatCollectionLockDateValidationMessage,
  getCollectionAgreementsForClass,
  getCollectionInvoicesForContract,
  getCollectionTenantOptions,
  getMinCollectionReceiptDateAfterLock,
  isCollectedCollectionInvoiceKey,
  isCollectionReceiptDateAfterLockDate,
  parseAmount,
  formatReceiptLineAmount,
  getValidCollectionReceiptLines,
  normalizeCollectionLineAmount,
  normalizeTinTrn,
  pickActiveLockDateYyyyMmDd,
  resolveCollectionTenantAccount,
  resolveCollectionTenantSelection,
  sanitizeNumericAmountInput,
  TIN_TRN_MAX_LENGTH,
  toDateInputValue,
  unwrapLockDateConfigList,
} from "./collectionsUtils";
import lockDateApi from "services/api.lockdate.service";
import {
  isPersistedCollectionLineId,
  loadCollectionLineAttachmentMeta,
  validateCollectionLineAttachmentFile,
} from "./collectionAttachmentUtils";
import uploadApi from "services/api.upload.service";

const inputSx = {
  "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 34 },
  "& .MuiInputBase-input": { py: 0.6, px: 0.75 },
  "& .MuiSelect-select": {
    py: 0.6,
    px: 0.75,
    minHeight: "34px !important",
    display: "flex",
    alignItems: "center",
  },
};

const readOnlySx = {
  fontSize: "0.8125rem",
  lineHeight: 1.35,
  color: "#344767",
};

const amountReadOnlySx = {
  fontSize: "1.125rem",
  fontWeight: 600,
  lineHeight: 1.4,
};

const parentFieldsRowSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "minmax(180px, 1.5fr) minmax(120px, 1fr)",
  },
  gap: 2,
};

const selectionRowSx = {
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: "minmax(72px, 0.3fr) minmax(100px, 0.85fr) minmax(140px, 1.2fr) minmax(72px, 0.55fr) minmax(72px, 0.55fr)",
  },
  gap: 2,
  alignItems: "start",
};

function CollectionAmountFields({ amounts, hasInvoiceSelected }) {
  return (
    <>
      <ReadOnlyField
        label="Due"
        value={hasInvoiceSelected ? formatAmount(amounts.due) : "—"}
        valueSx={amountReadOnlySx}
      />
      <ReadOnlyField
        label="Balance"
        value={hasInvoiceSelected ? formatAmount(amounts.balance) : "—"}
        valueSx={amountReadOnlySx}
      />
    </>
  );
}

CollectionAmountFields.propTypes = {
  amounts: PropTypes.shape({
    due: PropTypes.number,
    balance: PropTypes.number,
    totalPaid: PropTypes.number,
  }).isRequired,
  hasInvoiceSelected: PropTypes.bool.isRequired,
};

function ReadOnlyField({ label, value, valueSx }) {
  return (
    <MDBox>
      <MDTypography variant="caption" color="text" fontWeight="medium" display="block" mb={0.25}>
        {label}
      </MDTypography>
      <MDTypography variant="body2" sx={{ ...readOnlySx, ...valueSx }}>
        {value || "—"}
      </MDTypography>
    </MDBox>
  );
}

ReadOnlyField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  valueSx: PropTypes.object,
};

ReadOnlyField.defaultProps = {
  valueSx: undefined,
};

function EditableSelectField({ label, value, onChange, disabled, placeholder, options, note }) {
  return (
    <MDBox>
      <MDTypography variant="caption" color="text" fontWeight="medium" display="block" mb={0.25}>
        {label}
      </MDTypography>
      <MDInput
        select
        value={value || ""}
        onChange={onChange}
        fullWidth
        size="small"
        displayEmpty
        disabled={disabled}
        sx={inputSx}
      >
        <MenuItem value="">
          <em>{placeholder}</em>
        </MenuItem>
        {options}
      </MDInput>
      {note ? (
        <MDTypography
          variant="caption"
          color="text"
          sx={{ display: "block", mt: 0.5, fontStyle: "italic" }}
        >
          {note}
        </MDTypography>
      ) : null}
    </MDBox>
  );
}

EditableSelectField.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string.isRequired,
  options: PropTypes.node.isRequired,
  note: PropTypes.string,
};

EditableSelectField.defaultProps = {
  disabled: false,
  note: "",
};

function ReceiptLineDateCell({ value, onChange, disabled, readOnly, error, helperText, minDate }) {
  const inputRef = useRef(null);
  const dateValue = toDateInputValue(value);

  if (readOnly) {
    return (
      <MDTypography variant="caption" sx={readOnlySx}>
        {dateValue ? formatDisplayDate(dateValue) : "—"}
      </MDTypography>
    );
  }

  const openPicker = () => {
    if (disabled) return;
    if (inputRef.current?.showPicker) {
      inputRef.current.showPicker();
      return;
    }
    inputRef.current?.click();
  };

  return (
    <MDBox sx={{ position: "relative" }}>
      <input
        type="date"
        ref={inputRef}
        value={dateValue}
        min={minDate || undefined}
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
      <MDInput
        value={dateValue ? formatDisplayDate(dateValue) : ""}
        onClick={openPicker}
        readOnly
        fullWidth
        size="small"
        disabled={disabled}
        placeholder="dd-MMM-yyyy"
        error={Boolean(error)}
        helperText={helperText}
        sx={{
          ...inputSx,
          "& .MuiInputBase-input": { cursor: disabled ? "default" : "pointer" },
        }}
      />
    </MDBox>
  );
}

ReceiptLineDateCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  error: PropTypes.bool,
  helperText: PropTypes.string,
  minDate: PropTypes.string,
};

ReceiptLineDateCell.defaultProps = {
  value: "",
  disabled: false,
  readOnly: false,
  error: false,
  helperText: "",
  minDate: "",
};

function ReceiptLineAmountCell({ value, onChange, disabled, readOnly }) {
  const [focused, setFocused] = useState(false);
  const numericValue = sanitizeNumericAmountInput(value);

  if (readOnly) {
    return (
      <MDTypography variant="caption" sx={{ ...readOnlySx, textAlign: "right", display: "block" }}>
        {formatReceiptLineAmount(value)}
      </MDTypography>
    );
  }

  return (
    <MDInput
      value={
        focused ? numericValue : numericValue === "" ? "" : formatReceiptLineAmount(numericValue)
      }
      onChange={(e) => onChange(sanitizeNumericAmountInput(e.target.value))}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        setFocused(false);
        onChange(sanitizeNumericAmountInput(e.target.value));
      }}
      fullWidth
      size="small"
      placeholder="0"
      disabled={disabled}
      inputProps={{ inputMode: "decimal", style: { textAlign: "right" } }}
      sx={inputSx}
    />
  );
}

ReceiptLineAmountCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
};

ReceiptLineAmountCell.defaultProps = {
  value: "",
  disabled: false,
  readOnly: false,
};

const receiptLineGridColumns =
  "minmax(120px, 0.9fr) minmax(100px, 0.85fr) minmax(140px, 1.2fr) minmax(100px, 0.75fr) 72px 96px";

function ReceiptLineAttachmentCell({ line, readOnly, disabled, onSelectFile, onClearPending }) {
  const inputRef = useRef(null);
  const hasPending = Boolean(line.pendingAttachmentFile);
  const hasSaved = Boolean(line.hasAttachment || line.attachmentFileId);
  const displayName = line.pendingAttachmentFile?.name || line.attachmentFileName || "Image";

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const validationError = validateCollectionLineAttachmentFile(file);
    if (validationError) {
      window.alert(validationError);
      return;
    }
    onSelectFile(file);
  };

  const handleDownload = async () => {
    if (!line.attachmentFileId) return;
    try {
      await uploadApi.downloadFileById(line.attachmentFileId, line.attachmentFileName || "image");
    } catch (error) {
      console.error("Failed to download collection line attachment:", error);
      window.alert(error?.message || "Failed to download image.");
    }
  };

  if (readOnly && !hasSaved && !hasPending) {
    return (
      <MDTypography variant="caption" sx={{ ...readOnlySx, textAlign: "center", display: "block" }}>
        —
      </MDTypography>
    );
  }

  return (
    <MDBox display="flex" alignItems="center" justifyContent="center" gap={0.25}>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handleFileChange} />
      {!readOnly ? (
        <Tooltip
          title={
            hasPending || hasSaved
              ? `Replace image: ${displayName} (max 5 MB)`
              : "Upload image (max 5 MB)"
          }
        >
          <span>
            <IconButton
              size="small"
              color={hasPending || hasSaved ? "success" : "info"}
              disabled={disabled}
              onClick={() => inputRef.current?.click()}
              sx={{ padding: "2px" }}
            >
              <Icon fontSize="small">{hasPending || hasSaved ? "image" : "upload"}</Icon>
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
      {(hasSaved || hasPending) && (
        <>
          {hasSaved && !hasPending ? (
            <Tooltip title={`Download ${displayName}`}>
              <span>
                <IconButton
                  size="small"
                  color="secondary"
                  disabled={disabled}
                  onClick={handleDownload}
                  sx={{ padding: "2px" }}
                >
                  <Icon fontSize="small">download</Icon>
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
          {hasPending && !readOnly ? (
            <Tooltip title="Remove selected image">
              <span>
                <IconButton
                  size="small"
                  color="error"
                  disabled={disabled}
                  onClick={onClearPending}
                  sx={{ padding: "2px" }}
                >
                  <Icon fontSize="small">close</Icon>
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
        </>
      )}
    </MDBox>
  );
}

ReceiptLineAttachmentCell.propTypes = {
  line: PropTypes.shape({
    pendingAttachmentFile: PropTypes.object,
    attachmentFileName: PropTypes.string,
    attachmentFileId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    hasAttachment: PropTypes.bool,
  }).isRequired,
  readOnly: PropTypes.bool,
  disabled: PropTypes.bool,
  onSelectFile: PropTypes.func.isRequired,
  onClearPending: PropTypes.func.isRequired,
};

ReceiptLineAttachmentCell.defaultProps = {
  readOnly: false,
  disabled: false,
};

export default function CollectionEntryDialog({
  open,
  mode,
  group,
  classOptions,
  contracts,
  tenants,
  coaOptions,
  invoices,
  collectedInvoiceKeys,
  saving,
  onClose,
  onSave,
  onAllLinesDeleted,
}) {
  const [draftItems, setDraftItems] = useState([]);
  const [lineDateErrors, setLineDateErrors] = useState({});
  const [activeLockDate, setActiveLockDate] = useState("");
  const [draftParent, setDraftParent] = useState({
    classId: "",
    contractId: "",
    invoiceKey: "",
    tenantNo: "",
    tenantBusiness: "",
    coaId: "",
    accountLabel: "",
  });

  const isCreateMode = mode === "create";
  const minReceiptDateAfterLock = useMemo(
    () => getMinCollectionReceiptDateAfterLock(activeLockDate),
    [activeLockDate]
  );
  const lockDateValidationMessage = useMemo(
    () => formatCollectionLockDateValidationMessage(activeLockDate),
    [activeLockDate]
  );

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    lockDateApi
      .getAll()
      .then((response) => {
        if (!cancelled) {
          setActiveLockDate(pickActiveLockDateYyyyMmDd(unwrapLockDateConfigList(response)));
        }
      })
      .catch((error) => {
        console.error("Error fetching lock date for collection validation:", error);
        if (!cancelled) setActiveLockDate("");
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    (async () => {
      const baseItems =
        Array.isArray(group?.items) && group.items.length > 0
          ? group.items.map((item) => ({
              ...item,
              pendingAttachmentFile: null,
            }))
          : [];

      const loadedItems = await Promise.all(
        baseItems.map(async (item) => {
          if (!isPersistedCollectionLineId(item.id)) {
            return item;
          }
          const meta = await loadCollectionLineAttachmentMeta(item.id);
          return { ...item, ...meta, pendingAttachmentFile: null };
        })
      );

      if (cancelled) return;

      setDraftItems(loadedItems);
      setLineDateErrors({});
      setDraftParent({
        classId: group?.classId || "",
        contractId: group?.contractId || "",
        invoiceKey: group?.invoiceKey || "",
        tenantNo: group?.tenantNo || "",
        tenantBusiness: group?.tenantBusiness || "",
        coaId: group?.coaId || "",
        accountLabel: group?.accountLabel || "",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [open, group]);

  const effectiveGroup = useMemo(
    () =>
      isCreateMode
        ? {
            ...(group || {}),
            ...draftParent,
            items: draftItems,
            isDraftParent: true,
          }
        : { ...(group || {}), items: draftItems },
    [isCreateMode, group, draftParent, draftItems]
  );

  const parent = useMemo(
    () =>
      buildCollectionGroupParentFields(effectiveGroup, {
        contracts,
        tenants,
        coaOptions,
        invoices,
        classes: classOptions,
        collectedInvoiceKeys,
      }),
    [effectiveGroup, contracts, tenants, coaOptions, invoices, classOptions, collectedInvoiceKeys]
  );

  const amounts = useMemo(
    () => computeCollectionGroupAmounts(parent.invoiceReceivable, draftItems),
    [parent.invoiceReceivable, draftItems]
  );

  const agreementOptions = useMemo(() => {
    if (!isCreateMode) return [];
    return getCollectionAgreementsForClass(contracts, draftParent.classId).map((option) => (
      <MenuItem key={option.id} value={option.id}>
        {formatAgreementLabel(option)}
      </MenuItem>
    ));
  }, [isCreateMode, contracts, draftParent.classId]);

  const selectedAgreement = useMemo(() => {
    if (!isCreateMode || !draftParent.classId || !draftParent.contractId) return null;
    return (
      getCollectionAgreementsForClass(contracts, draftParent.classId).find(
        (option) => Number(option.id) === Number(draftParent.contractId)
      ) || null
    );
  }, [isCreateMode, contracts, draftParent.classId, draftParent.contractId]);

  const invoiceOptions = useMemo(() => {
    if (!isCreateMode) return [];
    // Invoice list is agreement-scoped; clearing agreement clears the dropdown options.
    const invoiceRows = selectedAgreement
      ? getCollectionInvoicesForContract(invoices, selectedAgreement, {
          includeInvoiceKey: draftParent.invoiceKey,
        })
      : [];
    return invoiceRows.map((option) => {
      const key = buildInvoiceKey(option);
      const isCollected = isCollectedCollectionInvoiceKey(key, collectedInvoiceKeys);
      return (
        <MenuItem
          key={key}
          value={key}
          disabled={isCollected}
          sx={
            isCollected
              ? {
                  opacity: 0.45,
                  color: "text.disabled",
                  fontStyle: "italic",
                  pointerEvents: "none",
                }
              : undefined
          }
        >
          {formatCollectionInvoiceDropdownLabel(option)}
        </MenuItem>
      );
    });
  }, [
    isCreateMode,
    invoices,
    selectedAgreement,
    draftParent.invoiceKey,
    collectedInvoiceKeys,
  ]);

  const tenantOptions = useMemo(() => {
    if (!isCreateMode) return [];
    return getCollectionTenantOptions(tenants).map((tenant) => (
      <MenuItem key={tenant.tenantNo} value={tenant.tenantNo}>
        {formatTenantBusinessLabel(null, tenant)}
      </MenuItem>
    ));
  }, [isCreateMode, tenants]);

  const readOnly = mode === "view";
  const title =
    mode === "create" ? "New Collection" : mode === "view" ? "View Collection" : "Edit Collection";
  const agreementLabel = parent.selectedContract
    ? formatAgreementLabel(parent.selectedContract)
    : "";
  const hasInvoiceSelected = Boolean(isCreateMode ? draftParent.invoiceKey : parent.invoiceKey);

  const getReceiptLineDateError = (dateValue) => {
    if (!isCreateMode || !activeLockDate) return "";
    if (!toDateInputValue(dateValue)) return "";
    if (!isCollectionReceiptDateAfterLockDate(dateValue, activeLockDate)) {
      return lockDateValidationMessage;
    }
    return "";
  };

  const handleParentChange = (field, value) => {
    setDraftParent((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "classId") {
        next.contractId = "";
        next.invoiceKey = "";
        next.tenantNo = "";
        next.tenantBusiness = "";
        next.coaId = "";
        next.accountLabel = "";
      }
      if (field === "contractId") {
        next.invoiceKey = "";
        if (!value) {
          if (!prev.tenantNo) {
            next.tenantBusiness = "";
            next.coaId = "";
            next.accountLabel = "";
          }
        } else {
          const contract =
            getCollectionAgreementsForClass(contracts, prev.classId).find(
              (option) => Number(option.id) === Number(value)
            ) || null;
          // Always refresh linked Account / Tenant from the newly selected agreement.
          const tenantAccount = resolveCollectionTenantAccount(contract, tenants, coaOptions);
          next.tenantNo = tenantAccount.tenantNo || "";
          next.tenantBusiness = tenantAccount.tenantBusiness || "";
          next.coaId = tenantAccount.coaId || "";
          next.accountLabel = tenantAccount.accountLabel || "";
        }
      }
      if (field === "tenantNo") {
        const tenant = getCollectionTenantOptions(tenants).find(
          (option) => String(option.tenantNo) === String(value)
        );
        const tenantAccount = resolveCollectionTenantSelection(tenant, coaOptions);
        next.tenantNo = tenantAccount.tenantNo;
        next.tenantBusiness = tenantAccount.tenantBusiness;
        next.coaId = tenantAccount.coaId;
        next.accountLabel = tenantAccount.accountLabel;
        if (!prev.contractId) {
          next.invoiceKey = "";
        }
      }
      return next;
    });
    if (isCreateMode && (field === "classId" || field === "contractId" || field === "invoiceKey")) {
      setDraftItems([]);
    }
  };

  const updateLine = (lineId, field, value) => {
    setDraftItems((prev) =>
      prev.map((line) => {
        if (line.id !== lineId) return line;
        if (field === "amount") {
          return { ...line, amount: normalizeCollectionLineAmount(value) };
        }
        if (field === "tinTrn") {
          return { ...line, tinTrn: normalizeTinTrn(value) };
        }
        return { ...line, [field]: value };
      })
    );
    if (field === "date" && isCreateMode) {
      const dateError = getReceiptLineDateError(value);
      setLineDateErrors((prev) => {
        const next = { ...prev };
        if (dateError) next[lineId] = dateError;
        else delete next[lineId];
        return next;
      });
    }
  };

  const handleAddLine = () => {
    const today = new Date().toISOString().slice(0, 10);
    const defaultDate =
      minReceiptDateAfterLock && !isCollectionReceiptDateAfterLockDate(today, activeLockDate)
        ? minReceiptDateAfterLock
        : today;
    setDraftItems((prev) => [...prev, createEmptyCollectionLineItem({ date: defaultDate })]);
  };

  const handleDuplicateLine = (lineId) => {
    setDraftItems((prev) => {
      const source = prev.find((line) => line.id === lineId);
      if (!source) return prev;
      const duplicate = createEmptyCollectionLineItem({
        date: source.date,
        amount: source.amount,
        tinTrn: source.tinTrn,
        remarks: source.remarks,
      });
      const index = prev.findIndex((line) => line.id === lineId);
      const next = [...prev];
      next.splice(index + 1, 0, duplicate);
      return next;
    });
  };

  const handleDeleteLine = (lineId) => {
    const nextItems = draftItems.filter((line) => line.id !== lineId);
    setDraftItems(nextItems);
    if (nextItems.length === 0 && draftItems.length > 0) {
      onAllLinesDeleted?.();
    }
  };

  const handleLineAttachmentSelect = (lineId, file) => {
    setDraftItems((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              pendingAttachmentFile: file,
              attachmentFileName: file.name,
            }
          : line
      )
    );
  };

  const handleClearPendingAttachment = (lineId) => {
    setDraftItems((prev) =>
      prev.map((line) =>
        line.id === lineId
          ? {
              ...line,
              pendingAttachmentFile: null,
              attachmentFileName: line.hasAttachment ? line.attachmentFileName : "",
            }
          : line
      )
    );
  };

  const handleSave = () => {
    const validItems = getValidCollectionReceiptLines(draftItems);
    const saveAmounts = computeCollectionGroupAmounts(parent.invoiceReceivable, validItems);
    if (!String(parent.tenantNo || parent.tenantBusiness || "").trim()) {
      window.alert("Please select Tenant and Business.");
      return;
    }
    if (!String(parent.coaId || "").trim()) {
      window.alert("Please select Account.");
      return;
    }
    if (validItems.length === 0) {
      window.alert("Add at least one receipt line with Date and Amount.");
      return;
    }
    if (isCreateMode && activeLockDate) {
      const invalidLine = validItems.find(
        (line) => !isCollectionReceiptDateAfterLockDate(line.date, activeLockDate)
      );
      if (invalidLine) {
        window.alert(lockDateValidationMessage);
        return;
      }
    }
    onSave?.({
      ...parent,
      groupKey: group?.groupKey || parent.groupKey,
      items: validItems,
      due: saveAmounts.due,
      balance: saveAmounts.balance,
      invoiceReceivable: parent.invoiceReceivable,
    });
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth={false}
      scroll="paper"
      PaperProps={{
        sx: { maxWidth: 1440, width: "76.8vw" },
      }}
    >
      <DialogTitle sx={{ color: "#344767", pb: 1 }}>{title}</DialogTitle>
      <DialogContent dividers>
        <MDBox
          display="flex"
          flexDirection="column"
          gap={2}
          mb={2}
          p={1.5}
          sx={{ bgcolor: "rgba(0,0,0,0.02)", borderRadius: 1, border: "1px solid #e0e0e0" }}
        >
          {isCreateMode ? (
            <>
              <MDBox sx={selectionRowSx}>
                <EditableSelectField
                  label="Class"
                  value={draftParent.classId}
                  onChange={(e) => handleParentChange("classId", e.target.value)}
                  disabled={saving}
                  placeholder="Select Class"
                  options={classOptions.map((option) => (
                    <MenuItem key={option.id} value={option.id}>
                      {option.name || option.code}
                    </MenuItem>
                  ))}
                />
                <EditableSelectField
                  label="CA No"
                  value={draftParent.contractId}
                  onChange={(e) => handleParentChange("contractId", e.target.value)}
                  disabled={saving || !draftParent.classId}
                  placeholder="Select CA No (optional)"
                  options={agreementOptions}
                />
                <EditableSelectField
                  label="Tenant and Business"
                  value={draftParent.tenantNo}
                  onChange={(e) => handleParentChange("tenantNo", e.target.value)}
                  disabled={saving}
                  placeholder="Select Tenant"
                  options={tenantOptions}
                />
                <EditableSelectField
                  label="Invoice"
                  value={draftParent.invoiceKey}
                  onChange={(e) => handleParentChange("invoiceKey", e.target.value)}
                  disabled={saving || (!draftParent.contractId && !draftParent.tenantNo)}
                  placeholder="Select Invoice (optional)"
                  options={invoiceOptions}
                  note="Unlocked invoices for the selected agreement or tenant are listed."
                />
                <CollectionAmountFields amounts={amounts} hasInvoiceSelected={hasInvoiceSelected} />
              </MDBox>
              <MDBox sx={parentFieldsRowSx}>
                <ReadOnlyField label="Account" value={parent.accountLabel} />
              </MDBox>
            </>
          ) : (
            <>
              <MDBox sx={selectionRowSx}>
                <ReadOnlyField label="Class" value={parent.className || parent.classId} />
                <ReadOnlyField label="Agreement" value={agreementLabel} />
                <ReadOnlyField
                  label="Invoice"
                  value={
                    parent.selectedInvoice
                      ? formatCollectionInvoiceDropdownLabel(parent.selectedInvoice)
                      : parent.invoiceKey
                  }
                />
                <CollectionAmountFields amounts={amounts} hasInvoiceSelected={hasInvoiceSelected} />
              </MDBox>
              <MDBox sx={parentFieldsRowSx}>
                <ReadOnlyField label="Tenant and Business" value={parent.tenantBusiness} />
                <ReadOnlyField label="Account" value={parent.accountLabel} />
              </MDBox>
            </>
          )}
        </MDBox>

        <MDBox display="flex" alignItems="center" justifyContent="space-between" mb={1}>
          <MDTypography variant="button" fontWeight="bold">
            Receipt Lines
          </MDTypography>
          {!readOnly && (
            <Tooltip title="Add line">
              <span>
                <IconButton
                  size="small"
                  color="info"
                  disabled={saving}
                  onClick={handleAddLine}
                  sx={{ border: "1px solid", borderColor: "info.main", borderRadius: 1, p: 0.35 }}
                >
                  <Icon fontSize="small">add</Icon>
                </IconButton>
              </span>
            </Tooltip>
          )}
        </MDBox>

        <MDBox sx={{ border: "1px solid #e0e0e0", borderRadius: 1, overflow: "hidden" }}>
          <MDBox
            display="grid"
            gridTemplateColumns={receiptLineGridColumns}
            sx={{
              bgcolor: "#c8e6c9",
              color: "#1b5e20",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            <MDBox sx={{ px: 1, py: 0.75 }}>Date</MDBox>
            <MDBox sx={{ px: 1, py: 0.75 }}>TIN-TRN</MDBox>
            <MDBox sx={{ px: 1, py: 0.75 }}>Remarks</MDBox>
            <MDBox sx={{ px: 1, py: 0.75, textAlign: "right" }}>Amount</MDBox>
            <MDBox sx={{ px: 1, py: 0.75, textAlign: "center" }}>Receipt</MDBox>
            <MDBox sx={{ px: 1, py: 0.75, textAlign: "center" }}>Action</MDBox>
          </MDBox>

          {draftItems.length === 0 ? (
            <MDBox py={2} textAlign="center" sx={{ borderTop: "1px solid #e0e0e0" }}>
              <MDTypography variant="caption" color="text">
                {hasInvoiceSelected
                  ? "No receipt lines yet. Use Add to create one."
                  : "No receipt lines yet. Use Add to create one."}
              </MDTypography>
            </MDBox>
          ) : (
            draftItems.map((line) => (
              <MDBox
                key={line.id}
                display="grid"
                gridTemplateColumns={receiptLineGridColumns}
                alignItems="center"
                sx={{ borderTop: "1px solid #e0e0e0" }}
              >
                <MDBox sx={{ p: 0.5 }}>
                  <ReceiptLineDateCell
                    value={line.date}
                    onChange={(nextValue) => updateLine(line.id, "date", nextValue)}
                    disabled={saving}
                    readOnly={readOnly}
                    error={Boolean(isCreateMode && lineDateErrors[line.id])}
                    helperText={isCreateMode ? lineDateErrors[line.id] || "" : ""}
                    minDate={isCreateMode ? minReceiptDateAfterLock : ""}
                  />
                </MDBox>
                <MDBox sx={{ p: 0.5 }}>
                  {readOnly ? (
                    <MDTypography variant="caption" sx={readOnlySx}>
                      {line.tinTrn || "—"}
                    </MDTypography>
                  ) : (
                    <MDInput
                      value={line.tinTrn ?? ""}
                      onChange={(e) =>
                        updateLine(line.id, "tinTrn", normalizeTinTrn(e.target.value))
                      }
                      fullWidth
                      size="small"
                      placeholder="TIN-TRN"
                      disabled={saving}
                      inputProps={{ maxLength: TIN_TRN_MAX_LENGTH }}
                      sx={inputSx}
                    />
                  )}
                </MDBox>
                <MDBox sx={{ p: 0.5 }}>
                  {readOnly ? (
                    <MDTypography
                      variant="caption"
                      sx={{
                        ...readOnlySx,
                        display: "block",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={line.remarks || undefined}
                    >
                      {line.remarks || "—"}
                    </MDTypography>
                  ) : (
                    <MDInput
                      value={line.remarks ?? ""}
                      onChange={(e) => updateLine(line.id, "remarks", e.target.value)}
                      fullWidth
                      size="small"
                      placeholder="Remarks"
                      disabled={saving}
                      inputProps={{ maxLength: 500 }}
                      title={line.remarks || undefined}
                      sx={inputSx}
                    />
                  )}
                </MDBox>
                <MDBox sx={{ p: 0.5 }}>
                  <ReceiptLineAmountCell
                    value={line.amount}
                    onChange={(nextValue) => updateLine(line.id, "amount", nextValue)}
                    disabled={saving}
                    readOnly={readOnly}
                  />
                </MDBox>
                <MDBox sx={{ p: 0.5 }}>
                  <ReceiptLineAttachmentCell
                    line={line}
                    readOnly={readOnly}
                    disabled={saving}
                    onSelectFile={(file) => handleLineAttachmentSelect(line.id, file)}
                    onClearPending={() => handleClearPendingAttachment(line.id)}
                  />
                </MDBox>
                <MDBox
                  sx={{
                    p: 0.5,
                    display: "flex",
                    justifyContent: "center",
                    gap: 0.25,
                  }}
                >
                  {!readOnly && (
                    <>
                      <Tooltip title="Duplicate">
                        <span>
                          <IconButton
                            size="small"
                            color="secondary"
                            disabled={saving}
                            onClick={() => handleDuplicateLine(line.id)}
                            sx={{ padding: "2px" }}
                          >
                            <Icon fontSize="small">content_copy</Icon>
                          </IconButton>
                        </span>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            disabled={saving}
                            onClick={() => handleDeleteLine(line.id)}
                            sx={{ padding: "2px" }}
                          >
                            <Icon fontSize="small">delete</Icon>
                          </IconButton>
                        </span>
                      </Tooltip>
                    </>
                  )}
                </MDBox>
              </MDBox>
            ))
          )}
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton color="secondary" variant="outlined" onClick={onClose} disabled={saving}>
          {readOnly ? "Close" : "Cancel"}
        </MDButton>
        {!readOnly && (
          <MDButton color="info" variant="gradient" onClick={handleSave} disabled={saving}>
            Save
          </MDButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

CollectionEntryDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  mode: PropTypes.oneOf(["create", "edit", "view"]).isRequired,
  group: PropTypes.object,
  classOptions: PropTypes.array.isRequired,
  contracts: PropTypes.array.isRequired,
  tenants: PropTypes.array.isRequired,
  coaOptions: PropTypes.array.isRequired,
  invoices: PropTypes.array.isRequired,
  collectedInvoiceKeys: PropTypes.instanceOf(Set),
  saving: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func,
  onAllLinesDeleted: PropTypes.func,
};

CollectionEntryDialog.defaultProps = {
  group: null,
  collectedInvoiceKeys: new Set(),
  saving: false,
  onSave: undefined,
  onAllLinesDeleted: undefined,
};
