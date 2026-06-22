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
  buildInvoiceKey,
  getCollectionAgreementsForClass,
  getCollectionInvoicesForContract,
  isCollectedCollectionInvoiceKey,
  parseAmount,
  formatReceiptLineAmount,
  getValidCollectionReceiptLines,
  normalizeCollectionLineAmount,
  normalizeTinTrn,
  resolveCollectionTenantAccount,
  sanitizeNumericAmountInput,
  TIN_TRN_MAX_LENGTH,
  toDateInputValue,
} from "./collectionsUtils";

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

const selectionRowSx = (showCurrentDue = false) => ({
  display: "grid",
  gridTemplateColumns: {
    xs: "1fr",
    sm: showCurrentDue
      ? "minmax(72px, 0.3fr) minmax(100px, 0.85fr) minmax(140px, 1.2fr) minmax(72px, 0.55fr) minmax(72px, 0.55fr) minmax(72px, 0.55fr)"
      : "minmax(72px, 0.3fr) minmax(100px, 0.85fr) minmax(140px, 1.2fr) minmax(72px, 0.55fr) minmax(72px, 0.55fr)",
  },
  gap: 2,
  alignItems: "start",
});

function CollectionAmountFields({ amounts, hasInvoiceSelected, showCurrentDue }) {
  return (
    <>
      <ReadOnlyField
        label="Due"
        value={hasInvoiceSelected ? formatAmount(amounts.due) : "—"}
        valueSx={amountReadOnlySx}
      />
      {showCurrentDue ? (
        <ReadOnlyField
          label="Current Due"
          value={formatAmount(amounts.currentDue)}
          valueSx={amountReadOnlySx}
        />
      ) : null}
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
    currentDue: PropTypes.number,
    balance: PropTypes.number,
    totalPaid: PropTypes.number,
  }).isRequired,
  hasInvoiceSelected: PropTypes.bool.isRequired,
  showCurrentDue: PropTypes.bool.isRequired,
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

function ReceiptLineDateCell({ value, onChange, disabled, readOnly }) {
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
};

ReceiptLineDateCell.defaultProps = {
  value: "",
  disabled: false,
  readOnly: false,
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

  useEffect(() => {
    if (!open) return;
    const items =
      Array.isArray(group?.items) && group.items.length > 0
        ? group.items.map((item) => ({ ...item }))
        : [];
    setDraftItems(items);
    setDraftParent({
      classId: group?.classId || "",
      contractId: group?.contractId || "",
      invoiceKey: group?.invoiceKey || "",
      tenantNo: group?.tenantNo || "",
      tenantBusiness: group?.tenantBusiness || "",
      coaId: group?.coaId || "",
      accountLabel: group?.accountLabel || "",
    });
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
    if (!isCreateMode || !selectedAgreement) return [];
    return getCollectionInvoicesForContract(invoices, selectedAgreement, {
      includeInvoiceKey: draftParent.invoiceKey,
    }).map((option) => {
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
  }, [isCreateMode, invoices, selectedAgreement, draftParent.invoiceKey, collectedInvoiceKeys]);

  const readOnly = mode === "view";
  const title =
    mode === "create" ? "New Collection" : mode === "view" ? "View Collection" : "Edit Collection";
  const agreementLabel = parent.selectedContract
    ? formatAgreementLabel(parent.selectedContract)
    : "";
  const hasInvoiceSelected = Boolean(isCreateMode ? draftParent.invoiceKey : parent.invoiceKey);
  const showCurrentDue = !readOnly && hasInvoiceSelected && parseAmount(amounts.totalPaid) > 0;

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
          next.tenantNo = "";
          next.tenantBusiness = "";
          next.coaId = "";
          next.accountLabel = "";
        } else {
          const contract =
            getCollectionAgreementsForClass(contracts, prev.classId).find(
              (option) => Number(option.id) === Number(value)
            ) || null;
          const tenantAccount = resolveCollectionTenantAccount(contract, tenants, coaOptions);
          next.tenantNo = tenantAccount.tenantNo;
          next.tenantBusiness = tenantAccount.tenantBusiness;
          next.coaId = tenantAccount.coaId;
          next.accountLabel = tenantAccount.accountLabel;
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
  };

  const handleAddLine = () => {
    if (!hasInvoiceSelected) return;
    setDraftItems((prev) => [...prev, createEmptyCollectionLineItem()]);
  };

  const handleDuplicateLine = (lineId) => {
    setDraftItems((prev) => {
      const source = prev.find((line) => line.id === lineId);
      if (!source) return prev;
      const duplicate = createEmptyCollectionLineItem({
        date: source.date,
        amount: source.amount,
        tinTrn: source.tinTrn,
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

  const handleSave = () => {
    const validItems = getValidCollectionReceiptLines(draftItems);
    const saveAmounts = computeCollectionGroupAmounts(parent.invoiceReceivable, validItems);
    if (!parent.classId || !parent.contractId || !parent.invoiceKey) {
      window.alert("Please select Class, CA No, and Invoice.");
      return;
    }
    if (validItems.length === 0) {
      window.alert("Add at least one receipt line with Date and Amount.");
      return;
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
              <MDBox sx={selectionRowSx(showCurrentDue)}>
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
                  placeholder="Select CA No"
                  options={agreementOptions}
                />
                <EditableSelectField
                  label="Invoice"
                  value={draftParent.invoiceKey}
                  onChange={(e) => handleParentChange("invoiceKey", e.target.value)}
                  disabled={saving || !draftParent.contractId}
                  placeholder="Select Invoice"
                  options={invoiceOptions}
                  note="Unlocked invoices for the selected CA No are listed. Invoices already in collections appear dimmed and cannot be selected."
                />
                <CollectionAmountFields
                  amounts={amounts}
                  hasInvoiceSelected={hasInvoiceSelected}
                  showCurrentDue={showCurrentDue}
                />
              </MDBox>
              <MDBox sx={parentFieldsRowSx}>
                <ReadOnlyField label="Tenant and Business" value={parent.tenantBusiness} />
                <ReadOnlyField label="Account" value={parent.accountLabel} />
              </MDBox>
            </>
          ) : (
            <>
              <MDBox sx={selectionRowSx(showCurrentDue)}>
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
                <CollectionAmountFields
                  amounts={amounts}
                  hasInvoiceSelected={hasInvoiceSelected}
                  showCurrentDue={showCurrentDue}
                />
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
            <Tooltip title={hasInvoiceSelected ? "Add line" : "Select an Invoice first"}>
              <span>
                <IconButton
                  size="small"
                  color="info"
                  disabled={saving || !hasInvoiceSelected}
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
            gridTemplateColumns="minmax(130px, 1fr) minmax(120px, 1fr) minmax(110px, 0.8fr) 96px"
            sx={{
              bgcolor: "#c8e6c9",
              color: "#1b5e20",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            <MDBox sx={{ px: 1, py: 0.75 }}>Date</MDBox>
            <MDBox sx={{ px: 1, py: 0.75 }}>TIN-TRN</MDBox>
            <MDBox sx={{ px: 1, py: 0.75, textAlign: "right" }}>Amount</MDBox>
            <MDBox sx={{ px: 1, py: 0.75, textAlign: "center" }}>Action</MDBox>
          </MDBox>

          {draftItems.length === 0 ? (
            <MDBox py={2} textAlign="center" sx={{ borderTop: "1px solid #e0e0e0" }}>
              <MDTypography variant="caption" color="text">
                {hasInvoiceSelected
                  ? "No receipt lines yet. Use Add to create one."
                  : "Select an Invoice to add receipt lines."}
              </MDTypography>
            </MDBox>
          ) : (
            draftItems.map((line) => (
              <MDBox
                key={line.id}
                display="grid"
                gridTemplateColumns="minmax(130px, 1fr) minmax(120px, 1fr) minmax(110px, 0.8fr) 96px"
                alignItems="center"
                sx={{ borderTop: "1px solid #e0e0e0" }}
              >
                <MDBox sx={{ p: 0.5 }}>
                  <ReceiptLineDateCell
                    value={line.date}
                    onChange={(nextValue) => updateLine(line.id, "date", nextValue)}
                    disabled={saving}
                    readOnly={readOnly}
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
                  <ReceiptLineAmountCell
                    value={line.amount}
                    onChange={(nextValue) => updateLine(line.id, "amount", nextValue)}
                    disabled={saving}
                    readOnly={readOnly}
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
