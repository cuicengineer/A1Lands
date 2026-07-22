import { useMemo } from "react";
import PropTypes from "prop-types";
import Checkbox from "@mui/material/Checkbox";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import {
  applyReceiptVoucherSelection,
  buildCollectionReceiptVoucherOptions,
  collectionGridRowAllowsEditDelete,
  deriveCollectionEntryStatus,
  findReceiptVoucherOption,
} from "./collectionReceiptUtils";
import {
  COLLECTION_GRID_ACTION_ICON_SX,
  COLLECTION_GRID_LINK_ICON_SX,
  inputSx,
  mergeBodyCellSx,
  readOnlySx,
  oneLineMenuItemSx,
} from "./collectionGridShared";
import {
  buildAgreementProvInvoiceDeepLink,
  buildInvoiceKey,
  buildReceiptDeepLink,
  buildTenantConfigDeepLink,
  computeCollectionRowBalance,
  computeInvoiceDue,
  enrichCollectionGridRow,
  findCoaById,
  formatAgreementLabel,
  formatAmount,
  formatAccountLabel,
  formatCollectionInvoiceDropdownLabel,
  formatCollectionPartyDropdownLabel,
  formatDisplayDate,
  formatTenantBusinessLabel,
  getCollectionAgreementsForClass,
  getCollectionInvoicesForContract,
  getCollectionTenantOptions,
  getCollectionTenantOptionsForAccount,
  isCollectionRowLockedByVrDate,
  normalizeCollectionLineAmount,
  normalizeTinTrn,
  openAppRouteInNewTab,
  resolveCollectionInvoiceContext,
  resolveCollectionTenantAccount,
  resolveCollectionTenantNo,
  resolveCollectionTenantSelection,
  sanitizeNumericAmountInput,
  TIN_TRN_MAX_LENGTH,
} from "./collectionsUtils";

function GridSelect({ value, onChange, disabled, placeholder, options, sx }) {
  return (
    <MDInput
      select
      value={value ?? ""}
      onChange={onChange}
      fullWidth
      size="small"
      displayEmpty
      disabled={disabled}
      sx={{ ...inputSx, ...sx }}
    >
      <MenuItem value="">
        <em>{placeholder}</em>
      </MenuItem>
      {options}
    </MDInput>
  );
}

GridSelect.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  placeholder: PropTypes.string.isRequired,
  options: PropTypes.node.isRequired,
  sx: PropTypes.object,
};

GridSelect.defaultProps = {
  value: "",
  disabled: false,
  sx: undefined,
};

function ReadOnlyCell({ value, align = "left", showFull = false }) {
  return (
    <MDTypography
      variant="caption"
      sx={{
        ...readOnlySx,
        display: "block",
        width: "100%",
        textAlign: align,
        whiteSpace: "nowrap",
        overflow: showFull ? "visible" : "hidden",
        textOverflow: showFull ? "clip" : "ellipsis",
        fontVariantNumeric: align === "right" ? "tabular-nums" : undefined,
        color: `${readOnlySx.color} !important`,
      }}
    >
      {value != null && String(value).trim() !== "" ? value : "—"}
    </MDTypography>
  );
}

ReadOnlyCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  align: PropTypes.string,
  showFull: PropTypes.bool,
};

ReadOnlyCell.defaultProps = {
  align: "left",
  showFull: false,
};

function GridCell({ align = "left", compact = false, bodyCellSx, sx, children }) {
  return (
    <MDBox sx={{ ...mergeBodyCellSx(bodyCellSx, { align, compact }), ...sx }}>
      {compact ? <MDBox sx={{ width: "100%", minWidth: 0 }}>{children}</MDBox> : children}
    </MDBox>
  );
}

GridCell.propTypes = {
  align: PropTypes.string,
  compact: PropTypes.bool,
  bodyCellSx: PropTypes.object.isRequired,
  sx: PropTypes.object,
  children: PropTypes.node,
};

GridCell.defaultProps = {
  align: "left",
  compact: false,
  sx: undefined,
  children: null,
};

function Col({
  columnKey,
  hiddenColumnKeys,
  align = "left",
  compact = false,
  bodyCellSx,
  sx,
  children,
}) {
  const hidden = hiddenColumnKeys?.has?.(columnKey);
  return (
    <GridCell
      align={align}
      compact={compact}
      bodyCellSx={bodyCellSx}
      sx={{
        ...(hidden ? { display: "none", minWidth: 0, width: 0, p: 0, border: "none" } : {}),
        ...sx,
      }}
    >
      {!hidden ? children : null}
    </GridCell>
  );
}

Col.propTypes = {
  columnKey: PropTypes.string.isRequired,
  hiddenColumnKeys: PropTypes.instanceOf(Set),
  align: PropTypes.string,
  compact: PropTypes.bool,
  bodyCellSx: PropTypes.object.isRequired,
  sx: PropTypes.object,
  children: PropTypes.node,
};

Col.defaultProps = {
  hiddenColumnKeys: undefined,
  align: "left",
  compact: false,
  sx: undefined,
  children: null,
};

function LinkedReadOnlyCell({ value, href, onOpen, tooltip, icon = "open_in_new" }) {
  const display = value != null && String(value).trim() !== "" ? String(value).trim() : "";
  const canOpen = Boolean(display && (onOpen || href));

  const handleOpen = () => {
    if (!canOpen) return;
    if (onOpen) {
      onOpen();
      return;
    }
    openAppRouteInNewTab(href);
  };

  if (!display) {
    return <ReadOnlyCell value="" />;
  }

  return (
    <MDBox
      sx={{
        display: "flex",
        alignItems: "center",
        width: "100%",
        minWidth: 0,
        gap: 0.25,
      }}
    >
      <MDTypography
        variant="caption"
        onClick={canOpen ? handleOpen : undefined}
        sx={{
          ...readOnlySx,
          flex: "1 1 auto",
          minWidth: 0,
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          cursor: canOpen ? "pointer" : "default",
          color: canOpen ? "info.main" : readOnlySx.color,
          textDecoration: canOpen ? "underline" : "none",
          "&:hover": canOpen ? { color: "info.dark" } : undefined,
        }}
      >
        {display}
      </MDTypography>
      {canOpen ? (
        <Tooltip title={tooltip}>
          <span>
            <IconButton
              size="small"
              color="info"
              onClick={handleOpen}
              sx={COLLECTION_GRID_LINK_ICON_SX}
            >
              <Icon fontSize="inherit">{icon}</Icon>
            </IconButton>
          </span>
        </Tooltip>
      ) : null}
    </MDBox>
  );
}

LinkedReadOnlyCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  href: PropTypes.string,
  onOpen: PropTypes.func,
  tooltip: PropTypes.string.isRequired,
  icon: PropTypes.string,
};

LinkedReadOnlyCell.defaultProps = {
  value: "",
  href: "",
  onOpen: undefined,
  icon: "open_in_new",
};

function CollectionEntryGridRow({
  row,
  index,
  rowNumber,
  allRows,
  classOptions,
  contracts,
  invoices,
  tenants,
  customers,
  suppliers,
  coaOptions,
  receipts,
  canCreate,
  canEditRow,
  canDeleteRow,
  canEditStatus,
  activeLockDate,
  saving,
  onRowChange,
  onSaveRow,
  onEditRow,
  onCancelEditRow,
  onDeleteRow,
  onDuplicateRow,
  onAttachmentSelect,
  onClearPendingAttachment,
  onDownloadAttachment,
  onViewTenant,
  onViewInvoice,
  selectedRowIds,
  onToggleRowSelection,
  getRowKey,
  hiddenColumnKeys,
  gridRowSx,
  bodyCellSx,
}) {
  const rowKey = row.localKey || row.id;
  const selectionKey = getRowKey ? getRowKey(row) : String(rowKey);
  const isSelected = Boolean(selectedRowIds?.has(selectionKey));

  const enriched = useMemo(
    () =>
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
    [row, allRows, contracts, tenants, customers, suppliers, coaOptions, invoices, classOptions]
  );

  const agreementOptions = useMemo(() => {
    return getCollectionAgreementsForClass(contracts, enriched.classId).map((option) => (
      <MenuItem key={option.id} value={option.id} sx={oneLineMenuItemSx}>
        {formatAgreementLabel(option)}
      </MenuItem>
    ));
  }, [contracts, enriched.classId]);

  const accountOptions = useMemo(
    () =>
      (coaOptions || []).map((option) => (
        <MenuItem key={option.id} value={option.id} sx={oneLineMenuItemSx}>
          {formatAccountLabel(option)}
        </MenuItem>
      )),
    [coaOptions]
  );

  const invoiceOptions = useMemo(() => {
    const contract =
      enriched.selectedContract ||
      (enriched.contractId
        ? getCollectionAgreementsForClass(contracts, enriched.classId).find(
            (item) => Number(item.id) === Number(enriched.contractId)
          )
        : null);
    // Invoice list is agreement-scoped; clearing agreement clears the dropdown options.
    const invoiceRows = contract
      ? getCollectionInvoicesForContract(invoices, contract, {
          includeInvoiceKey: enriched.invoiceKey,
        })
      : [];
    return invoiceRows.map((option) => {
      const key = buildInvoiceKey(option);
      return (
        <MenuItem key={key} value={key} sx={oneLineMenuItemSx}>
          {formatCollectionInvoiceDropdownLabel(option)}
        </MenuItem>
      );
    });
  }, [contracts, invoices, enriched]);

  const tenantOptions = useMemo(
    () =>
      getCollectionTenantOptionsForAccount(tenants, enriched.coaId, {
        includeTenantNo: enriched.tenantNo,
        customers,
        suppliers,
        coaOptions,
      }).map((tenant) => (
        <MenuItem key={tenant.tenantNo} value={tenant.tenantNo} sx={oneLineMenuItemSx}>
          {formatCollectionPartyDropdownLabel(tenant)}
        </MenuItem>
      )),
    [tenants, customers, suppliers, coaOptions, enriched.coaId, enriched.tenantNo]
  );

  const receiptVoucherOptions = useMemo(
    () =>
      buildCollectionReceiptVoucherOptions(receipts, {
        tenantNo: enriched.tenantNo,
        invoiceKey: enriched.invoiceKey,
      }),
    [receipts, enriched.tenantNo, enriched.invoiceKey]
  );

  const selectedVoucherKey = useMemo(() => {
    const match = findReceiptVoucherOption(receiptVoucherOptions, {
      receiptId: enriched.receiptId,
      vrNo: enriched.vrNo,
    });
    return match?.key || "";
  }, [receiptVoucherOptions, enriched.receiptId, enriched.vrNo]);

  const invoiceContext = resolveCollectionInvoiceContext(
    enriched,
    enriched.selectedContract,
    invoices
  );
  const statusValue = deriveCollectionEntryStatus(enriched, {
    allowManualOverride: canEditStatus,
  });
  const isRowEditing = Boolean(row.isEditing || row.isLocalOnly);
  const isLockedByVrDate = isCollectionRowLockedByVrDate(enriched, activeLockDate);
  const allowsEditDelete = collectionGridRowAllowsEditDelete(enriched, {
    isSuperuser: canEditStatus,
    allowManualOverride: canEditStatus,
  });
  const canEditFields =
    (row.isLocalOnly ? canCreate || canEditRow : canEditRow) && !isLockedByVrDate;
  const readOnly = !canEditFields || saving || !isRowEditing;
  const agreementLabel = enriched.selectedContract
    ? formatAgreementLabel(enriched.selectedContract)
    : "";
  const voucherLabel =
    findReceiptVoucherOption(receiptVoucherOptions, {
      receiptId: enriched.receiptId,
      vrNo: enriched.vrNo,
    })?.label ||
    enriched.vrNo ||
    "";
  const collectionTenantNo = resolveCollectionTenantNo(
    enriched,
    enriched.selectedContract,
    tenants
  );
  const tenantDeepLink = collectionTenantNo ? buildTenantConfigDeepLink(collectionTenantNo) : "";
  const invoiceDeepLink =
    invoiceContext.invoiceNo || invoiceContext.contractNo
      ? buildAgreementProvInvoiceDeepLink(invoiceContext.contractNo, invoiceContext.invoiceNo)
      : "";
  const receiptDeepLink = enriched.vrNo
    ? buildReceiptDeepLink(enriched.vrNo, enriched.receiptId)
    : "";

  const handleViewTenant = () => {
    if (!collectionTenantNo) return;
    onViewTenant?.(row);
  };

  const handleViewInvoice = () => {
    if (!invoiceContext.invoiceNo && !enriched.invoiceKey) return;
    onViewInvoice?.(row);
  };

  const patch = (updates) => onRowChange?.(rowKey, updates);

  const handleClassChange = (classId) => {
    patch({
      classId,
      contractId: "",
      invoiceKey: "",
    });
  };

  const handleAgreementChange = (contractId) => {
    const contract =
      getCollectionAgreementsForClass(contracts, enriched.classId).find(
        (item) => Number(item.id) === Number(contractId)
      ) || null;
    if (!contractId) {
      patch({
        contractId: "",
        invoiceKey: "",
      });
      return;
    }
    const tenantAccount = resolveCollectionTenantAccount(contract, tenants, coaOptions);
    patch({
      classId: contract?.classId ?? enriched.classId ?? "",
      contractId,
      invoiceKey: "",
      tenantNo: tenantAccount.tenantNo,
      tenantBusiness: tenantAccount.tenantBusiness,
      coaId: tenantAccount.coaId || enriched.coaId,
      accountLabel: tenantAccount.accountLabel || enriched.accountLabel,
    });
  };

  const handleAccountChange = (coaId) => {
    const coa = findCoaById(coaOptions, coaId);
    const nextCoaId = coa?.id ?? coaId ?? "";
    const matchingTenants = getCollectionTenantOptionsForAccount(tenants, nextCoaId, {
      includeTenantNo: enriched.tenantNo,
      customers,
      suppliers,
      coaOptions,
    });
    const tenantStillValid = matchingTenants.some(
      (item) => String(item.tenantNo) === String(enriched.tenantNo)
    );
    patch({
      coaId: nextCoaId,
      accountLabel: formatAccountLabel(coa),
      ...(tenantStillValid
        ? {}
        : {
            tenantNo: "",
            tenantBusiness: "",
            invoiceKey: "",
            receivable: 0,
            balance: computeCollectionRowBalance(0, enriched.amount),
          }),
    });
  };

  const handleTenantChange = (tenantNo) => {
    const tenant = getCollectionTenantOptionsForAccount(tenants, enriched.coaId, {
      includeTenantNo: tenantNo,
      customers,
      suppliers,
      coaOptions,
    }).find((item) => String(item.tenantNo) === String(tenantNo));
    const account = resolveCollectionTenantSelection(tenant, coaOptions);
    patch({
      tenantNo: account.tenantNo,
      tenantBusiness: account.tenantBusiness,
      coaId: account.coaId,
      accountLabel: account.accountLabel,
    });
  };

  const handleVoucherChange = (voucherKey) => {
    const option = receiptVoucherOptions.find((item) => item.key === voucherKey) || null;
    patch(applyReceiptVoucherSelection(enriched, option));
  };

  const handleInvoiceChange = (invoiceKey) => {
    const contract =
      enriched.selectedContract ||
      (enriched.contractId
        ? getCollectionAgreementsForClass(contracts, enriched.classId).find(
            (item) => Number(item.id) === Number(enriched.contractId)
          )
        : null);
    const invoiceRows = contract
      ? getCollectionInvoicesForContract(invoices, contract, { includeInvoiceKey: invoiceKey })
      : [];
    const selectedInvoice =
      invoiceRows.find((item) => buildInvoiceKey(item) === String(invoiceKey || "").trim()) || null;
    const receivable = selectedInvoice ? computeInvoiceDue(selectedInvoice) : 0;
    patch({
      invoiceKey,
      receivable,
      balance: computeCollectionRowBalance(receivable, enriched.amount),
    });
  };

  const handleAmountChange = (value) => {
    const amount = sanitizeNumericAmountInput(value);
    patch({
      amount,
      balance: computeCollectionRowBalance(enriched.receivable, amount),
    });
  };

  const handleAmountBlur = (value) => {
    const amount = normalizeCollectionLineAmount(value);
    patch({
      amount,
      balance: computeCollectionRowBalance(enriched.receivable, amount),
    });
  };

  const hasPending = Boolean(enriched.pendingAttachmentFile);
  const hasSaved = Boolean(enriched.hasAttachment || enriched.attachmentFileId);
  const isAgreementSelected =
    enriched.contractId != null && String(enriched.contractId).trim() !== "";

  return (
    <MDBox sx={{ ...gridRowSx, "&:hover": { bgcolor: "rgba(0,0,0,0.02)" } }}>
      <Col
        columnKey="select"
        hiddenColumnKeys={hiddenColumnKeys}
        align="center"
        bodyCellSx={bodyCellSx}
      >
        <Checkbox
          size="small"
          checked={isSelected}
          onChange={() => onToggleRowSelection?.(selectionKey)}
          disabled={saving}
          inputProps={{ "aria-label": `Select collection row ${selectionKey}` }}
          sx={{ p: 0 }}
        />
      </Col>

      <Col
        columnKey="sno"
        hiddenColumnKeys={hiddenColumnKeys}
        align="center"
        bodyCellSx={bodyCellSx}
      >
        <MDTypography variant="caption" sx={{ ...readOnlySx, fontWeight: 600 }}>
          {rowNumber ?? index + 1}
        </MDTypography>
      </Col>

      <Col
        columnKey="class"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing ? (
          <GridSelect
            value={enriched.classId}
            onChange={(e) => handleClassChange(e.target.value)}
            disabled={readOnly}
            placeholder="Class"
            options={classOptions.map((option) => (
              <MenuItem key={option.id} value={option.id} sx={oneLineMenuItemSx}>
                {option.name || option.code}
              </MenuItem>
            ))}
          />
        ) : (
          <ReadOnlyCell value={enriched.className || enriched.classId} />
        )}
      </Col>

      <Col
        columnKey="agreement"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing ? (
          <GridSelect
            value={enriched.contractId}
            onChange={(e) => handleAgreementChange(e.target.value)}
            disabled={readOnly}
            placeholder="Agreement"
            options={agreementOptions}
          />
        ) : (
          <ReadOnlyCell value={agreementLabel} />
        )}
      </Col>

      <Col
        columnKey="account"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing ? (
          <GridSelect
            value={enriched.coaId}
            onChange={(e) => handleAccountChange(e.target.value)}
            disabled={readOnly}
            placeholder="Account"
            options={accountOptions}
          />
        ) : (
          <ReadOnlyCell value={enriched.accountLabel} />
        )}
      </Col>

      <Col
        columnKey="tenantBusiness"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing && !isAgreementSelected ? (
          <GridSelect
            value={enriched.tenantNo}
            onChange={(e) => handleTenantChange(e.target.value)}
            disabled={readOnly || !enriched.coaId}
            placeholder={enriched.coaId ? "Tenant" : "Select account first"}
            options={tenantOptions}
          />
        ) : (
          <LinkedReadOnlyCell
            value={enriched.tenantBusiness}
            onOpen={onViewTenant ? handleViewTenant : undefined}
            href={onViewTenant ? "" : tenantDeepLink}
            tooltip="View tenant"
            icon="visibility"
          />
        )}
      </Col>

      <Col
        columnKey="invoice"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing ? (
          <GridSelect
            value={enriched.invoiceKey}
            onChange={(e) => handleInvoiceChange(e.target.value)}
            disabled={readOnly}
            placeholder="Invoice"
            options={invoiceOptions}
          />
        ) : (
          <LinkedReadOnlyCell
            value={invoiceContext.label}
            onOpen={onViewInvoice ? handleViewInvoice : undefined}
            href={onViewInvoice ? "" : invoiceDeepLink}
            tooltip="View invoice"
            icon="visibility"
          />
        )}
      </Col>

      <Col
        columnKey="receivable"
        hiddenColumnKeys={hiddenColumnKeys}
        align="right"
        bodyCellSx={bodyCellSx}
        sx={{ overflow: "visible" }}
      >
        <ReadOnlyCell value={formatAmount(enriched.receivable)} align="right" showFull />
      </Col>

      <Col
        columnKey="balance"
        hiddenColumnKeys={hiddenColumnKeys}
        align="right"
        bodyCellSx={bodyCellSx}
        sx={{ overflow: "visible" }}
      >
        <ReadOnlyCell value={formatAmount(enriched.balance)} align="right" showFull />
      </Col>

      <Col
        columnKey="amount"
        hiddenColumnKeys={hiddenColumnKeys}
        align="right"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
        sx={{ overflow: "visible" }}
      >
        {isRowEditing ? (
          <MDInput
            value={enriched.amount ?? ""}
            onChange={(e) => handleAmountChange(e.target.value)}
            onBlur={(e) => handleAmountBlur(e.target.value)}
            fullWidth
            size="small"
            placeholder="0"
            disabled={readOnly}
            inputProps={{ inputMode: "decimal", style: { textAlign: "right" } }}
            sx={inputSx}
          />
        ) : (
          <ReadOnlyCell value={formatAmount(enriched.amount)} align="right" showFull />
        )}
      </Col>

      <Col
        columnKey="tinTrn"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing ? (
          <MDInput
            value={enriched.tinTrn ?? ""}
            onChange={(e) => patch({ tinTrn: normalizeTinTrn(e.target.value) })}
            fullWidth
            size="small"
            placeholder="TIN-TRN"
            disabled={readOnly}
            inputProps={{ maxLength: TIN_TRN_MAX_LENGTH }}
            sx={inputSx}
          />
        ) : (
          <ReadOnlyCell value={enriched.tinTrn} />
        )}
      </Col>

      <Col
        columnKey="remarks"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing ? (
          <MDInput
            value={enriched.remarks ?? ""}
            onChange={(e) => patch({ remarks: e.target.value })}
            fullWidth
            size="small"
            placeholder="Remarks"
            disabled={readOnly}
            inputProps={{ maxLength: 500 }}
            title={enriched.remarks || undefined}
            sx={inputSx}
          />
        ) : (
          <ReadOnlyCell value={enriched.remarks} />
        )}
      </Col>

      <Col
        columnKey="attach"
        hiddenColumnKeys={hiddenColumnKeys}
        align="center"
        compact
        bodyCellSx={bodyCellSx}
        sx={{ gap: 0.25 }}
      >
        <input
          id={`collection-attach-${rowKey}`}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onAttachmentSelect?.(rowKey, file);
          }}
        />
        {isRowEditing ? (
          <Tooltip title={hasPending || hasSaved ? "Receipt image" : "Upload receipt"}>
            <span>
              <IconButton
                size="small"
                color={hasPending || hasSaved ? "success" : "info"}
                disabled={readOnly}
                onClick={() => document.getElementById(`collection-attach-${rowKey}`)?.click()}
                sx={{ p: "2px" }}
              >
                <Icon fontSize="small">{hasPending || hasSaved ? "image" : "upload"}</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {hasSaved && !hasPending ? (
          <Tooltip title="Download receipt">
            <span>
              <IconButton
                size="small"
                color="secondary"
                disabled={saving}
                onClick={() => onDownloadAttachment?.(enriched)}
                sx={{ p: "2px" }}
              >
                <Icon fontSize="small">download</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {hasPending ? (
          <Tooltip title="Remove selected image">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={readOnly}
                onClick={() => onClearPendingAttachment?.(rowKey)}
                sx={{ p: "2px" }}
              >
                <Icon fontSize="small">close</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {!isRowEditing && !hasSaved && !hasPending ? (
          <MDTypography variant="caption" sx={{ ...readOnlySx, textAlign: "center" }}>
            —
          </MDTypography>
        ) : null}
      </Col>

      <Col
        columnKey="status"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing && canEditStatus}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing && canEditStatus ? (
          <GridSelect
            value={statusValue}
            onChange={(e) => {
              const status = e.target.value;
              patch({
                status,
                ...(status === "Pending" ? { vrNo: "", vrDate: "", receiptId: "" } : {}),
              });
            }}
            disabled={readOnly}
            placeholder="Status"
            options={["Received", "Pending"].map((option) => (
              <MenuItem key={option} value={option}>
                {option}
              </MenuItem>
            ))}
          />
        ) : (
          <ReadOnlyCell value={statusValue} />
        )}
      </Col>

      <Col
        columnKey="vrNo"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        compact={isRowEditing}
        bodyCellSx={bodyCellSx}
      >
        {isRowEditing ? (
          <GridSelect
            value={selectedVoucherKey}
            onChange={(e) => handleVoucherChange(e.target.value)}
            disabled={readOnly}
            placeholder="Vr No"
            options={receiptVoucherOptions.map((option) => (
              <MenuItem key={option.key} value={option.key} sx={oneLineMenuItemSx}>
                {option.label}
              </MenuItem>
            ))}
          />
        ) : (
          <LinkedReadOnlyCell
            value={voucherLabel}
            href={receiptDeepLink}
            tooltip="Open receipt"
            icon="receipt_long"
          />
        )}
      </Col>

      <Col
        columnKey="vrDate"
        hiddenColumnKeys={hiddenColumnKeys}
        align="left"
        bodyCellSx={bodyCellSx}
      >
        <ReadOnlyCell value={enriched.vrDate ? formatDisplayDate(enriched.vrDate) : ""} />
      </Col>

      <Col
        columnKey="actions"
        hiddenColumnKeys={hiddenColumnKeys}
        align="center"
        bodyCellSx={bodyCellSx}
        sx={{ flexWrap: "nowrap", gap: 0.1, px: 0.25, overflow: "visible" }}
      >
        {isRowEditing ? (
          <>
            {canEditFields ? (
              <Tooltip title="Save row">
                <span>
                  <IconButton
                    size="small"
                    color="info"
                    disabled={saving}
                    onClick={() => onSaveRow?.(rowKey)}
                    sx={COLLECTION_GRID_ACTION_ICON_SX}
                  >
                    <Icon fontSize="inherit">save</Icon>
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
            {canEditFields ? (
              <Tooltip title="Cancel">
                <span>
                  <IconButton
                    size="small"
                    color="secondary"
                    disabled={saving}
                    onClick={() => onCancelEditRow?.(rowKey)}
                    sx={COLLECTION_GRID_ACTION_ICON_SX}
                  >
                    <Icon fontSize="inherit">close</Icon>
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </>
        ) : (
          <>
            {canEditRow && !isLockedByVrDate && allowsEditDelete ? (
              <Tooltip title="Edit row">
                <span>
                  <IconButton
                    size="small"
                    color="info"
                    disabled={saving}
                    onClick={() => onEditRow?.(rowKey)}
                    sx={COLLECTION_GRID_ACTION_ICON_SX}
                  >
                    <Icon fontSize="inherit">edit</Icon>
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </>
        )}
        {canCreate || canEditRow ? (
          <Tooltip title="Duplicate row">
            <span>
              <IconButton
                size="small"
                color="secondary"
                disabled={saving}
                onClick={() => onDuplicateRow?.(rowKey)}
                sx={COLLECTION_GRID_ACTION_ICON_SX}
              >
                <Icon fontSize="inherit">content_copy</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {canDeleteRow && allowsEditDelete ? (
          <Tooltip title="Delete row">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={saving}
                onClick={() => onDeleteRow?.(rowKey)}
                sx={COLLECTION_GRID_ACTION_ICON_SX}
              >
                <Icon fontSize="inherit">delete</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </Col>
    </MDBox>
  );
}

CollectionEntryGridRow.propTypes = {
  row: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  rowNumber: PropTypes.number,
  allRows: PropTypes.array.isRequired,
  classOptions: PropTypes.array.isRequired,
  contracts: PropTypes.array.isRequired,
  invoices: PropTypes.array.isRequired,
  tenants: PropTypes.array.isRequired,
  customers: PropTypes.array,
  suppliers: PropTypes.array,
  coaOptions: PropTypes.array.isRequired,
  receipts: PropTypes.array.isRequired,
  canCreate: PropTypes.bool,
  canEditRow: PropTypes.bool,
  canDeleteRow: PropTypes.bool,
  canEditStatus: PropTypes.bool,
  activeLockDate: PropTypes.string,
  saving: PropTypes.bool,
  onRowChange: PropTypes.func.isRequired,
  onSaveRow: PropTypes.func.isRequired,
  onEditRow: PropTypes.func.isRequired,
  onCancelEditRow: PropTypes.func.isRequired,
  onDeleteRow: PropTypes.func.isRequired,
  onDuplicateRow: PropTypes.func,
  onAttachmentSelect: PropTypes.func,
  onClearPendingAttachment: PropTypes.func,
  onDownloadAttachment: PropTypes.func,
  onViewTenant: PropTypes.func,
  onViewInvoice: PropTypes.func,
  selectedRowIds: PropTypes.instanceOf(Set),
  onToggleRowSelection: PropTypes.func,
  getRowKey: PropTypes.func,
  hiddenColumnKeys: PropTypes.instanceOf(Set),
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
};

CollectionEntryGridRow.defaultProps = {
  canCreate: false,
  canEditRow: false,
  canDeleteRow: false,
  canEditStatus: false,
  activeLockDate: "",
  saving: false,
  customers: [],
  suppliers: [],
  onDuplicateRow: undefined,
  onAttachmentSelect: undefined,
  onClearPendingAttachment: undefined,
  onDownloadAttachment: undefined,
  onViewTenant: undefined,
  onViewInvoice: undefined,
  selectedRowIds: undefined,
  onToggleRowSelection: undefined,
  getRowKey: undefined,
  hiddenColumnKeys: undefined,
};

export default CollectionEntryGridRow;
