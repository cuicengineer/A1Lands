import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import SearchableSelect from "components/SearchableSelect";
import {
  formatLineAccountDropdownLabel,
  formatAmount,
  partyDropdownOneLineSx,
  resolveReceiptLineContextFromLine,
} from "./receiptUtils";
import {
  computePaymentLineTotal,
  getPaymentPartyColumnLabel,
  isPaymentInvoiceMode,
  isPaymentLineComplete,
  isPaymentSimplifiedLineComplete,
  PAYMENT_LINE_MODES,
} from "./paymentUtils";

const lineInputSx = {
  "& .MuiInputBase-root": { fontSize: "0.75rem", minHeight: 24 },
  "& .MuiInputBase-input": { py: 0.25, px: 0.375 },
  "& .MuiSelect-select": {
    py: 0.25,
    px: 0.375,
    minHeight: "24px !important",
    display: "flex",
    alignItems: "center",
  },
};

function getLineAccountSelectValue(line) {
  if (line?.accountCoaId != null && String(line.accountCoaId).trim() !== "") {
    return String(line.accountCoaId);
  }
  return line?.account || "";
}

function renderLineAccountValue(accountOptions, selected) {
  const selectedValue = String(selected ?? "");
  if (!selectedValue) return "";
  const option = (accountOptions || []).find(
    (row) =>
      String(row.value) === selectedValue ||
      String(row.label) === selectedValue ||
      String(row.coaId ?? row.id) === selectedValue
  );
  return formatLineAccountDropdownLabel(option) || option?.label || selectedValue;
}

function renderLineAccountMenuItem(option) {
  const groupColor = option?.groupColor || { bg: "transparent", accent: "#9e9e9e" };
  const groupName = String(option?.groupName || "").trim() || "—";
  return (
    <MDBox sx={{ width: "100%" }}>
      <MDTypography
        variant="caption"
        sx={{
          display: "block",
          fontSize: "0.6875rem",
          fontWeight: 700,
          color: groupColor.accent,
          lineHeight: 1.1,
          mb: 0.25,
        }}
      >
        {groupName}
      </MDTypography>
      <MDTypography variant="body2" sx={{ fontSize: "0.8125rem", lineHeight: 1.2 }}>
        {formatLineAccountDropdownLabel(option)}
      </MDTypography>
    </MDBox>
  );
}

function getPaymentHeaderTextAlign(col) {
  if (col.align === "right") return "right";
  if (col.key === "sno") return "right";
  return "center";
}

function buildPaymentColumns(
  mode,
  partyType,
  { simplified = false, simplifiedPartyLabel = "Party" } = {}
) {
  if (simplified) {
    return [
      { label: "Account", key: "account", align: "left" },
      { label: "Tenant", key: "tenant", align: "left" },
      { label: "Invoice No", key: "invoice", align: "left" },
      { label: "Amount", key: "amount", align: "right" },
      { label: "TIN-FTN", key: "tinFtn", align: "left" },
      { label: "Total", key: "total", align: "right" },
    ];
  }

  const cols = [{ label: "#", key: "sno", align: "right" }];
  if (mode === PAYMENT_LINE_MODES.ITEM_BASED) {
    cols.push({ label: "Item", key: "item", align: "left" });
    cols.push({ label: "Account", key: "account", align: "left" });
    cols.push({ label: "Qty", key: "quantity", align: "right" });
    cols.push({ label: "Unit Price", key: "unitPrice", align: "right" });
    cols.push({ label: "Amount", key: "amount", align: "right" });
    cols.push({ label: "TIN-FTN", key: "tinFtn", align: "left" });
    cols.push({ label: "Total", key: "total", align: "right" });
    return cols;
  }

  cols.push({ label: "Account", key: "account", align: "left" });
  if (isPaymentInvoiceMode(mode)) {
    cols.push({
      label: getPaymentPartyColumnLabel(partyType),
      key: "party",
      align: "left",
    });
    cols.push({ label: "Invoice No", key: "invoice", align: "left" });
    cols.push({ label: "Amount", key: "amount", align: "right" });
  } else {
    cols.push({ label: "Qty", key: "quantity", align: "right" });
    cols.push({ label: "Unit Price", key: "unitPrice", align: "right" });
    cols.push({ label: "Amount", key: "amount", align: "right" });
  }
  cols.push({ label: "TIN-FTN", key: "tinFtn", align: "left" });
  cols.push({ label: "Total", key: "total", align: "right" });
  return cols;
}

function buildPaymentGridTemplate(mode, { simplified = false } = {}) {
  if (simplified) {
    return [
      "minmax(112px, 0.84fr)",
      "minmax(128px, 1.05fr)",
      "minmax(112px, 0.95fr)",
      "minmax(72px, 0.55fr)",
      "minmax(68px, 0.6fr)",
      "minmax(68px, 0.6fr)",
      "64px",
    ].join(" ");
  }
  if (mode === PAYMENT_LINE_MODES.ITEM_BASED) {
    return [
      "28px",
      "minmax(120px, 1fr)",
      "minmax(78px, 0.67fr)",
      "minmax(52px, 0.45fr)",
      "minmax(72px, 0.55fr)",
      "minmax(72px, 0.55fr)",
      "minmax(72px, 0.55fr)",
      "minmax(68px, 0.6fr)",
      "64px",
    ].join(" ");
  }
  if (isPaymentInvoiceMode(mode)) {
    return [
      "28px",
      "minmax(78px, 0.67fr)",
      "minmax(128px, 1.05fr)",
      "minmax(112px, 0.95fr)",
      "minmax(72px, 0.55fr)",
      "minmax(68px, 0.6fr)",
      "minmax(68px, 0.6fr)",
      "64px",
    ].join(" ");
  }
  return [
    "28px",
    "minmax(78px, 0.67fr)",
    "minmax(52px, 0.45fr)",
    "minmax(72px, 0.55fr)",
    "minmax(72px, 0.55fr)",
    "minmax(68px, 0.6fr)",
    "minmax(68px, 0.6fr)",
    "64px",
  ].join(" ");
}

function renderPartyDropdownValue(partyOptions, selected) {
  const selectedValue = String(selected ?? "");
  if (!selectedValue) return "";
  const option = (partyOptions || []).find((row) => String(row.value) === selectedValue);
  return option?.label || selectedValue;
}

function PaymentLineRow({
  mode,
  partyType,
  simplified = false,
  lineMode = null,
  linePartyType = "",
  gridRowSx,
  bodyCellSx,
  line,
  index,
  accountOptions,
  partyOptions,
  invoiceOptions,
  productOptions,
  accountReadOnly,
  readOnly,
  errors,
  saving,
  canDelete,
  canDuplicate,
  onLineChange,
  onDuplicateLine,
  onDeleteLine,
}) {
  const effectiveMode = simplified ? lineMode : mode;
  const effectivePartyType = simplified ? linePartyType : partyType;
  const showInvoiceFields = simplified ? true : isPaymentInvoiceMode(mode);
  const partyColumnLabel = getPaymentPartyColumnLabel(effectivePartyType) || "Tenant";
  const lineTotal = effectiveMode
    ? computePaymentLineTotal(line, effectiveMode)
    : computePaymentLineTotal(line, mode);

  return (
    <MDBox
      sx={{
        ...gridRowSx,
        bgcolor: "rgba(25, 118, 210, 0.06)",
        "&:hover": { bgcolor: "rgba(25, 118, 210, 0.08)" },
        "& > *": { borderBottom: "1px solid rgba(0,0,0,0.08)" },
      }}
    >
      {!simplified ? (
        <MDBox sx={{ ...bodyCellSx, textAlign: "right", fontWeight: 600 }}>{index + 1}</MDBox>
      ) : null}

      {!simplified && mode === PAYMENT_LINE_MODES.ITEM_BASED ? (
        <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
          <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-item`])}>
            <SearchableSelect
              value={line.productKey || ""}
              onChange={(e) => onLineChange(line.id, "productKey", e.target.value)}
              fullWidth
              size="small"
              displayEmpty
              disabled={readOnly}
              sx={lineInputSx}
            >
              <MenuItem value="">
                <em>Select Item</em>
              </MenuItem>
              {(productOptions || []).map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </SearchableSelect>
          </FormControl>
        </MDBox>
      ) : null}

      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        {(!simplified && mode === PAYMENT_LINE_MODES.ITEM_BASED) || accountReadOnly ? (
          <MDTypography variant="caption" sx={{ fontSize: "0.75rem" }}>
            {line.account || "-"}
          </MDTypography>
        ) : (
          <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-account`])}>
            <SearchableSelect
              value={getLineAccountSelectValue(line)}
              onChange={(e) => onLineChange(line.id, "account", e.target.value)}
              fullWidth
              size="small"
              displayEmpty
              disabled={readOnly}
              renderValue={(selected) => renderLineAccountValue(accountOptions, selected)}
              sx={lineInputSx}
            >
              <MenuItem value="">
                <em>Select Account</em>
              </MenuItem>
              {(accountOptions || []).map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {renderLineAccountMenuItem(option)}
                </MenuItem>
              ))}
            </SearchableSelect>
          </FormControl>
        )}
      </MDBox>

      {showInvoiceFields ? (
        <>
          <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
            <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-party`])}>
              <SearchableSelect
                value={line.partyKey || ""}
                onChange={(e) => onLineChange(line.id, "partyKey", e.target.value)}
                fullWidth
                size="small"
                displayEmpty
                disabled={readOnly || !line.account}
                renderValue={(selected) => renderPartyDropdownValue(partyOptions, selected)}
                sx={{
                  ...lineInputSx,
                  "& .MuiSelect-select": {
                    ...lineInputSx["& .MuiSelect-select"],
                    ...partyDropdownOneLineSx,
                  },
                }}
              >
                <MenuItem value="">
                  <em>
                    {line.account
                      ? simplified
                        ? `Select ${partyColumnLabel}`
                        : `Select ${getPaymentPartyColumnLabel(partyType)}`
                      : "Select account first"}
                  </em>
                </MenuItem>
                {(partyOptions || []).map((option) => (
                  <MenuItem
                    key={option.value}
                    value={option.value}
                    title={option.label}
                    sx={partyDropdownOneLineSx}
                  >
                    {option.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
          </MDBox>
          <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
            <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-invoice`])}>
              <SearchableSelect
                value={line.invoiceKey || ""}
                onChange={(e) => onLineChange(line.id, "invoiceKey", e.target.value)}
                fullWidth
                size="small"
                displayEmpty
                disabled={readOnly || !line.partyKey}
                sx={lineInputSx}
              >
                <MenuItem value="">
                  <em>
                    {line.partyKey
                      ? "Select invoice (optional)"
                      : line.account
                      ? `Select ${partyColumnLabel} first`
                      : "Select account first"}
                  </em>
                </MenuItem>
                {(invoiceOptions || []).map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </SearchableSelect>
            </FormControl>
          </MDBox>
          <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
            <MDInput
              value={line.amount ?? ""}
              onChange={(e) => onLineChange(line.id, "amount", e.target.value)}
              fullWidth
              size="small"
              placeholder="Amount"
              inputProps={{ inputMode: "decimal" }}
              error={Boolean(errors[`line-${index}-amount`])}
              disabled={readOnly}
              sx={lineInputSx}
            />
          </MDBox>
        </>
      ) : simplified ? (
        <>
          <MDBox sx={bodyCellSx} />
          <MDBox sx={bodyCellSx} />
          <MDBox sx={bodyCellSx} />
        </>
      ) : !simplified && isPaymentInvoiceMode(mode) ? null : (
        <>
          <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
            <MDInput
              value={line.quantity ?? ""}
              onChange={(e) => onLineChange(line.id, "quantity", e.target.value)}
              fullWidth
              size="small"
              placeholder="Qty"
              inputProps={{ inputMode: "decimal" }}
              error={Boolean(errors[`line-${index}-quantity`])}
              disabled={readOnly}
              sx={lineInputSx}
            />
          </MDBox>
          <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
            <MDInput
              value={line.unitPrice ?? ""}
              onChange={(e) => onLineChange(line.id, "unitPrice", e.target.value)}
              fullWidth
              size="small"
              placeholder="Unit Price"
              inputProps={{ inputMode: "decimal" }}
              error={Boolean(errors[`line-${index}-unitPrice`])}
              disabled={readOnly}
              sx={lineInputSx}
            />
          </MDBox>
          <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
            <MDInput
              value={line.amount ?? ""}
              fullWidth
              size="small"
              placeholder="Amount"
              InputProps={{ readOnly: true }}
              disabled
              sx={lineInputSx}
            />
          </MDBox>
        </>
      )}

      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        <MDInput
          value={line.tinTrn ?? line.tinFtn ?? ""}
          onChange={(e) => onLineChange(line.id, "tinTrn", e.target.value)}
          fullWidth
          size="small"
          placeholder="TIN-FTN"
          disabled={readOnly}
          sx={lineInputSx}
        />
      </MDBox>

      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
        }}
      >
        {formatAmount(lineTotal)}
      </MDBox>

      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "center",
          display: "flex",
          justifyContent: "center",
          gap: 0,
          px: 0.25,
        }}
      >
        {!readOnly ? (
          <Tooltip title={canDuplicate ? "Duplicate" : "Complete this row before duplicating"}>
            <span>
              <IconButton
                size="small"
                color="secondary"
                disabled={saving || !canDuplicate}
                onClick={() => onDuplicateLine(line.id)}
                sx={{ p: "1px" }}
              >
                <Icon sx={{ fontSize: "0.95rem !important" }}>content_copy</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
        {!readOnly ? (
          <Tooltip title="Delete">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={saving || !canDelete}
                onClick={() => onDeleteLine(line.id)}
                sx={{ p: "1px" }}
              >
                <Icon sx={{ fontSize: "0.95rem !important" }}>delete</Icon>
              </IconButton>
            </span>
          </Tooltip>
        ) : null}
      </MDBox>
    </MDBox>
  );
}

PaymentLineRow.propTypes = {
  mode: PropTypes.string,
  partyType: PropTypes.string,
  simplified: PropTypes.bool,
  lineMode: PropTypes.string,
  linePartyType: PropTypes.string,
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
  line: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  accountOptions: PropTypes.array,
  partyOptions: PropTypes.array,
  invoiceOptions: PropTypes.array,
  productOptions: PropTypes.array,
  accountReadOnly: PropTypes.bool,
  readOnly: PropTypes.bool,
  errors: PropTypes.object,
  saving: PropTypes.bool,
  canDelete: PropTypes.bool,
  canDuplicate: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
};

PaymentLineRow.defaultProps = {
  mode: PAYMENT_LINE_MODES.ACCOUNT_QTY,
  partyType: "",
  simplified: false,
  lineMode: null,
  linePartyType: "",
  accountOptions: [],
  partyOptions: [],
  invoiceOptions: [],
  productOptions: [],
  accountReadOnly: false,
  readOnly: false,
  errors: {},
  saving: false,
  canDelete: true,
  canDuplicate: false,
};

export default function PaymentLinesGrid({
  lines,
  paymentLineMode,
  partyType,
  simplified = false,
  accountOptions,
  getLineAccountOptions,
  getLinePartyOptions,
  getLineInvoiceOptions,
  productOptions,
  errors,
  saving,
  grandTotal,
  readOnly,
  onLineChange,
  onAddLine,
  onDuplicateLine,
  onDeleteLine,
}) {
  const visibleColumns = buildPaymentColumns(paymentLineMode, partyType, { simplified });
  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: buildPaymentGridTemplate(paymentLineMode, { simplified }),
    minWidth: "max-content",
    width: "100%",
    alignItems: "center",
    columnGap: 0,
  };

  const cellBaseSx = {
    fontSize: "0.75rem",
    lineHeight: 1.15,
    py: 0.25,
    px: 0.375,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  };

  const headerCellSx = {
    ...cellBaseSx,
    fontWeight: 700,
    fontSize: "0.6875rem",
    py: 0.375,
    bgcolor: "#f4f6f8",
    borderBottom: "1px solid rgba(0,0,0,0.12)",
  };

  const bodyCellSx = {
    ...cellBaseSx,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  };

  const isLineComplete = (line) => {
    if (simplified) {
      return isPaymentSimplifiedLineComplete(line);
    }
    return isPaymentLineComplete(line, paymentLineMode);
  };

  const canAddLine =
    !readOnly && !saving && (lines.length === 0 || lines.every((line) => isLineComplete(line)));
  const addLineTooltip = canAddLine ? "Add line" : "Complete all rows before adding another line";

  const resolveAccountOptions = (line) =>
    getLineAccountOptions ? getLineAccountOptions(line) : accountOptions;

  return (
    <MDBox sx={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        mb={0.75}
        sx={{ flexShrink: 0, flexWrap: "nowrap" }}
      >
        <MDTypography variant="button" fontWeight="bold" sx={{ whiteSpace: "nowrap" }}>
          Line items
        </MDTypography>
        <MDBox
          display="flex"
          alignItems="center"
          gap={1}
          sx={{ flexShrink: 0, whiteSpace: "nowrap" }}
        >
          <MDTypography variant="button" fontWeight="medium">
            Total Amount: {formatAmount(grandTotal)}
          </MDTypography>
          {!readOnly ? (
            <Tooltip title={addLineTooltip}>
              <span>
                <IconButton
                  color="info"
                  size="small"
                  disabled={!canAddLine}
                  onClick={onAddLine}
                  sx={{
                    p: 0.35,
                    border: "1px solid",
                    borderColor: "info.main",
                    borderRadius: 1,
                  }}
                >
                  <Icon sx={{ fontSize: "1rem !important" }}>add</Icon>
                </IconButton>
              </span>
            </Tooltip>
          ) : null}
        </MDBox>
      </MDBox>

      <MDBox
        sx={{
          border: "1px solid rgba(0,0,0,0.12)",
          borderRadius: 1,
          overflow: "hidden",
        }}
      >
        <MDBox sx={{ maxHeight: 280, overflow: "auto" }}>
          <MDBox sx={{ minWidth: "max-content" }}>
            <MDBox sx={{ ...gridRowSx, position: "sticky", top: 0, zIndex: 2 }}>
              {visibleColumns.map((col) => (
                <MDBox
                  key={col.key}
                  sx={{
                    ...headerCellSx,
                    textAlign: getPaymentHeaderTextAlign(col),
                  }}
                >
                  {col.label}
                </MDBox>
              ))}
              <MDBox sx={{ ...headerCellSx, textAlign: "center" }}>Action</MDBox>
            </MDBox>

            {!lines?.length ? (
              <MDTypography
                variant="caption"
                color="text"
                display="block"
                textAlign="center"
                py={2}
              >
                No line items yet. Click add to create a row.
              </MDTypography>
            ) : (
              lines.map((line, index) => {
                const lineContext = simplified
                  ? resolveReceiptLineContextFromLine(line, accountOptions)
                  : { mode: paymentLineMode, partyType };
                return (
                  <PaymentLineRow
                    key={line.id}
                    mode={paymentLineMode}
                    partyType={partyType}
                    simplified={simplified}
                    lineMode={lineContext.mode}
                    linePartyType={lineContext.partyType}
                    gridRowSx={gridRowSx}
                    bodyCellSx={bodyCellSx}
                    line={line}
                    index={index}
                    accountOptions={resolveAccountOptions(line)}
                    partyOptions={getLinePartyOptions(line)}
                    invoiceOptions={getLineInvoiceOptions(line)}
                    productOptions={productOptions}
                    accountReadOnly={
                      !simplified && paymentLineMode === PAYMENT_LINE_MODES.ITEM_BASED
                    }
                    readOnly={readOnly}
                    errors={errors}
                    saving={saving}
                    canDelete
                    canDuplicate={isLineComplete(line)}
                    onLineChange={onLineChange}
                    onDuplicateLine={onDuplicateLine}
                    onDeleteLine={onDeleteLine}
                  />
                );
              })
            )}
          </MDBox>
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

PaymentLinesGrid.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.object).isRequired,
  paymentLineMode: PropTypes.string,
  partyType: PropTypes.string,
  simplified: PropTypes.bool,
  accountOptions: PropTypes.array,
  getLineAccountOptions: PropTypes.func,
  getLinePartyOptions: PropTypes.func,
  getLineInvoiceOptions: PropTypes.func,
  productOptions: PropTypes.array,
  errors: PropTypes.object,
  saving: PropTypes.bool,
  grandTotal: PropTypes.number,
  readOnly: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onAddLine: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
};

PaymentLinesGrid.defaultProps = {
  paymentLineMode: PAYMENT_LINE_MODES.ACCOUNT_QTY,
  partyType: "",
  simplified: false,
  accountOptions: [],
  getLineAccountOptions: undefined,
  getLinePartyOptions: () => [],
  getLineInvoiceOptions: () => [],
  productOptions: [],
  errors: {},
  saving: false,
  grandTotal: 0,
  readOnly: false,
};
