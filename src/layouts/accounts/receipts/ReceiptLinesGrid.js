import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import ListSubheader from "@mui/material/ListSubheader";
import FormControl from "@mui/material/FormControl";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import SearchableSelect from "components/SearchableSelect";
import {
  RECEIPT_LINE_MODES,
  computeLineTotal,
  computeReceiptLineTotal,
  formatAmount,
  formatLineAccountDropdownLabel,
  getReceiptLineContractSelectValue,
  getReceiptPartyColumnLabel,
  isReceiptInvoiceMode,
  isReceiptLayoutLineComplete,
  isReceiptLineComplete,
  isReceiptQtyMode,
  partyDropdownOneLineSx,
  resolveReceiptLineContextFromLine,
  shouldShowReceiptItemColumn,
} from "./receiptUtils";
import { parseInvoiceKey } from "layouts/income-agreements/collections/collectionsUtils";
import { parseReceiptCollectionEntryOptionValue } from "./receiptUtils";

const RECEIPT_CONTRACT_DROPDOWN_NOTE =
  "Only active contracts finalized by AHQ are listed in this dropdown.";

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

function getLineAccountMenuItemSx(option) {
  const groupColor = option?.groupColor || { bg: "transparent", accent: "#9e9e9e" };
  return {
    bgcolor: groupColor.bg,
    borderLeft: `4px solid ${groupColor.accent}`,
    whiteSpace: "normal",
    alignItems: "flex-start",
    py: 0.75,
    mb: 0.25,
  };
}

const receiptLineInputSx = {
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

const receiptLineCenterInputSx = {
  ...receiptLineInputSx,
  "& .MuiInputBase-input": {
    ...receiptLineInputSx["& .MuiInputBase-input"],
    textAlign: "center",
  },
};

const LEGACY_LINES_TABLE_COLUMNS = [
  { label: "#", key: "sno", align: "right", numeric: true },
  { label: "Item", key: "item", align: "left" },
  { label: "Account", key: "account", align: "left" },
  { label: "TIN-TRN", key: "tinTrn", align: "left" },
  { label: "Amount", key: "amount", align: "right", numeric: true },
  { label: "Qty", key: "quantity", align: "right", numeric: true },
  { label: "Total", key: "total", align: "right", numeric: true },
];

const LEGACY_PARTY_COLUMN = { label: "Party", key: "party", align: "left" };
const LEGACY_CONTRACT_COLUMN = { label: "Contract", key: "contract", align: "left" };
const LEGACY_INVOICE_COLUMN = { label: "Invoice", key: "invoice", align: "left" };

function buildLegacyReceiptLineColumns(
  showPartyColumn,
  showContractColumn,
  showInvoiceColumn,
  hideAccountColumn = false
) {
  const columns = hideAccountColumn
    ? LEGACY_LINES_TABLE_COLUMNS.filter((col) => col.key !== "account")
    : [...LEGACY_LINES_TABLE_COLUMNS];
  const insertAt = hideAccountColumn ? 2 : 3;
  if (showPartyColumn) columns.splice(insertAt, 0, LEGACY_PARTY_COLUMN);
  if (showContractColumn) {
    columns.splice(insertAt + (showPartyColumn ? 1 : 0), 0, LEGACY_CONTRACT_COLUMN);
  }
  if (showInvoiceColumn) {
    columns.splice(
      insertAt + (showPartyColumn ? 1 : 0) + (showContractColumn ? 1 : 0),
      0,
      LEGACY_INVOICE_COLUMN
    );
  }
  return columns;
}

function buildLegacyReceiptLineGridColumns(
  showPartyColumn,
  showContractColumn,
  showInvoiceColumn,
  hideAccountColumn = false
) {
  const columns = ["28px", "minmax(84px, 0.85fr)"];
  if (!hideAccountColumn) columns.push("minmax(78px, 0.67fr)");
  if (showPartyColumn) columns.push("minmax(128px, 1.05fr)");
  if (showContractColumn) columns.push("minmax(136px, 1.1fr)");
  if (showInvoiceColumn) columns.push("minmax(112px, 0.95fr)");
  columns.push(
    "minmax(68px, 0.6fr)",
    "minmax(68px, 0.6fr)",
    "minmax(44px, 0.4fr)",
    "minmax(68px, 0.6fr)",
    "64px"
  );
  return columns.join(" ");
}

const productOptionShape = PropTypes.shape({
  value: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
});

const lineAccountOptionShape = PropTypes.shape({
  value: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  groupName: PropTypes.string,
  groupColor: PropTypes.shape({
    bg: PropTypes.string,
    accent: PropTypes.string,
  }),
});

const receiptLineRowPropTypes = {
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
  line: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  accountOptions: PropTypes.arrayOf(lineAccountOptionShape),
  partyOptions: PropTypes.arrayOf(lineAccountOptionShape),
  invoiceOptions: PropTypes.arrayOf(lineAccountOptionShape),
  productOptions: PropTypes.arrayOf(productOptionShape),
  readOnly: PropTypes.bool,
  errors: PropTypes.object,
  saving: PropTypes.bool,
  canDelete: PropTypes.bool,
  canDuplicate: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
};

const receiptLineRowDefaultProps = {
  accountOptions: [],
  partyOptions: [],
  invoiceOptions: [],
  productOptions: [],
  readOnly: false,
  errors: {},
  saving: false,
  canDelete: true,
  canDuplicate: false,
};

function LineItemSelect({
  line,
  index,
  productOptions,
  readOnly,
  errors,
  onLineChange,
  bodyCellSx,
}) {
  return (
    <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
      <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-item`])}>
        <SearchableSelect
          value={line.productKey || ""}
          onChange={(e) => onLineChange(line.id, "productKey", e.target.value)}
          fullWidth
          size="small"
          displayEmpty
          disabled={readOnly}
          renderValue={(selected) => {
            const selectedValue = String(selected ?? "");
            if (!selectedValue) return "";
            const option = (productOptions || []).find((row) => row.value === selectedValue);
            return option?.label || line.item || selectedValue;
          }}
          sx={receiptLineInputSx}
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
  );
}

LineItemSelect.propTypes = {
  line: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  productOptions: PropTypes.arrayOf(productOptionShape),
  readOnly: PropTypes.bool,
  errors: PropTypes.object,
  onLineChange: PropTypes.func.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
};

LineItemSelect.defaultProps = {
  productOptions: [],
  readOnly: false,
  errors: {},
};

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

function getReceiptHeaderTextAlign(col) {
  if (col.align === "center") return "center";
  if (col.align === "right" || col.numeric) return "right";
  if (col.key === "sno") return "right";
  return "center";
}

function buildReceiptModeColumns(
  mode,
  receiptPartyType,
  { simplified = false, simplifiedPartyLabel = "Party" } = {}
) {
  const cols = [];
  if (!simplified) {
    cols.push({ label: "#", key: "sno", align: "right" });
  }
  if (!simplified && shouldShowReceiptItemColumn(mode)) {
    cols.push({ label: "Item", key: "item", align: "left" });
  }
  cols.push({ label: "Account", key: "account", align: "left" });
  if (simplified) {
    cols.push({ label: "Tenant", key: "tenant", align: "left" });
    cols.push({ label: "Invoice No", key: "invoice", align: "left" });
    cols.push({ label: "Amount", key: "amount", align: "center" });
  } else if (isReceiptInvoiceMode(mode)) {
    cols.push({ label: "Tenant", key: "tenant", align: "left" });
    cols.push({ label: "Invoice No", key: "invoice", align: "left" });
    cols.push({ label: "Amount", key: "amount", align: "center" });
  } else if (isReceiptQtyMode(mode)) {
    cols.push({ label: "Qty", key: "quantity", align: "right" });
    cols.push({ label: "Unit Price", key: "unitPrice", align: "right" });
    cols.push({ label: "Amount", key: "amount", align: "center" });
  }
  cols.push({ label: "TIN-FTN", key: "tinFtn", align: "center" });
  cols.push({ label: "Total", key: "total", align: "right" });
  return cols;
}

function buildReceiptModeGridTemplate(mode, { simplified = false } = {}) {
  const columns = [];
  if (!simplified) {
    columns.push("28px");
    if (shouldShowReceiptItemColumn(mode)) {
      columns.push("minmax(120px, 1fr)");
    }
  }
  if (simplified) {
    columns.push(
      "minmax(112px, 0.84fr)",
      "minmax(128px, 1.05fr)",
      "minmax(112px, 0.95fr)",
      "minmax(72px, 0.55fr)",
      "minmax(68px, 0.6fr)",
      "minmax(68px, 0.6fr)",
      "64px"
    );
    return columns.join(" ");
  }
  if (isReceiptInvoiceMode(mode) && !simplified) {
    columns.push(
      "minmax(78px, 0.67fr)",
      "minmax(128px, 1.05fr)",
      "minmax(112px, 0.95fr)",
      "minmax(72px, 0.55fr)",
      "minmax(68px, 0.6fr)",
      "minmax(68px, 0.6fr)",
      "64px"
    );
    return columns.join(" ");
  }
  columns.push(
    simplified ? "minmax(112px, 0.84fr)" : "minmax(78px, 0.67fr)",
    "minmax(52px, 0.45fr)",
    "minmax(72px, 0.55fr)",
    "minmax(72px, 0.55fr)",
    "minmax(68px, 0.6fr)",
    "minmax(68px, 0.6fr)",
    "64px"
  );
  return columns.join(" ");
}

function renderPartyDropdownValue(partyOptions, selected) {
  const selectedValue = String(selected ?? "");
  if (!selectedValue) return "";
  const option = (partyOptions || []).find((row) => String(row.value) === selectedValue);
  return option?.label || selectedValue;
}

function renderInvoiceDropdownValue(line, invoiceOptions, selected) {
  const selectedValue = String(selected ?? "");
  if (!selectedValue) return "";
  const option = (invoiceOptions || []).find((row) => String(row.value) === selectedValue);
  if (option?.label) return option.label;
  const fromLine = String(line?.invoiceNo || "").trim();
  if (fromLine) return fromLine;
  if (parseReceiptCollectionEntryOptionValue(selectedValue)) {
    return fromLine || "Invoice";
  }
  return parseInvoiceKey(selectedValue).invoiceNo || selectedValue;
}

function ReceiptModeLineRow({
  mode,
  receiptPartyType,
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
  const effectivePartyType = simplified ? linePartyType : receiptPartyType;
  const showInvoiceFields = simplified ? true : isReceiptInvoiceMode(mode);
  const partyColumnLabel = getReceiptPartyColumnLabel(effectivePartyType) || "Tenant";
  const amountLockedByInvoice = Boolean(String(line.invoiceKey || "").trim());
  const lineTotal = effectiveMode
    ? computeReceiptLineTotal(line, effectiveMode)
    : computeLineTotal(line);

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

      {!simplified && shouldShowReceiptItemColumn(mode) ? (
        <LineItemSelect
          line={line}
          index={index}
          productOptions={productOptions}
          readOnly={readOnly}
          errors={errors}
          onLineChange={onLineChange}
          bodyCellSx={bodyCellSx}
        />
      ) : null}

      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-account`])}>
          <SearchableSelect
            value={getLineAccountSelectValue(line)}
            onChange={(e) => onLineChange(line.id, "account", e.target.value)}
            fullWidth
            size="small"
            displayEmpty
            disabled={readOnly}
            renderValue={(selected) => renderLineAccountValue(accountOptions, selected)}
            sx={receiptLineInputSx}
          >
            <MenuItem value="">
              <em>Select Account</em>
            </MenuItem>
            {(accountOptions || []).map((option) => (
              <MenuItem
                key={option.value}
                value={option.value}
                sx={getLineAccountMenuItemSx(option)}
              >
                {simplified ? renderLineAccountMenuItem(option) : option.label}
              </MenuItem>
            ))}
          </SearchableSelect>
        </FormControl>
      </MDBox>

      {!simplified && isReceiptInvoiceMode(mode) ? (
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
                  ...receiptLineInputSx,
                  "& .MuiSelect-select": {
                    ...receiptLineInputSx["& .MuiSelect-select"],
                    ...partyDropdownOneLineSx,
                  },
                }}
              >
                <MenuItem value="">
                  <em>{line.account ? "Select Tenant" : "Select account first"}</em>
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
                renderValue={(selected) =>
                  renderInvoiceDropdownValue(line, invoiceOptions, selected)
                }
                sx={receiptLineInputSx}
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
          <MDBox sx={{ ...bodyCellSx, textAlign: "center" }}>
            <MDInput
              value={line.amount ?? ""}
              onChange={(e) => onLineChange(line.id, "amount", e.target.value)}
              fullWidth
              size="small"
              placeholder="Amount"
              inputProps={{ inputMode: "decimal" }}
              error={Boolean(errors[`line-${index}-amount`])}
              disabled={readOnly || amountLockedByInvoice}
              sx={receiptLineCenterInputSx}
            />
          </MDBox>
        </>
      ) : simplified && showInvoiceFields ? (
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
                  ...receiptLineInputSx,
                  "& .MuiSelect-select": {
                    ...receiptLineInputSx["& .MuiSelect-select"],
                    ...partyDropdownOneLineSx,
                  },
                }}
              >
                <MenuItem value="">
                  <em>{line.account ? `Select ${partyColumnLabel}` : "Select account first"}</em>
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
                renderValue={(selected) =>
                  renderInvoiceDropdownValue(line, invoiceOptions, selected)
                }
                sx={receiptLineInputSx}
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
          <MDBox sx={{ ...bodyCellSx, textAlign: "center" }}>
            <MDInput
              value={line.amount ?? ""}
              onChange={(e) => onLineChange(line.id, "amount", e.target.value)}
              fullWidth
              size="small"
              placeholder="Amount"
              inputProps={{ inputMode: "decimal" }}
              error={Boolean(errors[`line-${index}-amount`])}
              disabled={readOnly || amountLockedByInvoice}
              sx={receiptLineCenterInputSx}
            />
          </MDBox>
        </>
      ) : simplified ? (
        <>
          <MDBox sx={bodyCellSx} />
          <MDBox sx={bodyCellSx} />
          <MDBox sx={bodyCellSx} />
        </>
      ) : (
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
              sx={receiptLineInputSx}
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
              sx={receiptLineInputSx}
            />
          </MDBox>
          <MDBox sx={{ ...bodyCellSx, textAlign: "center" }}>
            <MDInput
              value={line.amount ?? ""}
              fullWidth
              size="small"
              placeholder="Amount"
              InputProps={{ readOnly: true }}
              disabled
              sx={receiptLineCenterInputSx}
            />
          </MDBox>
        </>
      )}

      <MDBox sx={{ ...bodyCellSx, textAlign: "center" }}>
        <MDInput
          value={line.tinTrn ?? line.tinFtn ?? ""}
          onChange={(e) => onLineChange(line.id, "tinTrn", e.target.value)}
          fullWidth
          size="small"
          placeholder="TIN-FTN"
          disabled={readOnly}
          sx={receiptLineCenterInputSx}
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

ReceiptModeLineRow.propTypes = {
  mode: PropTypes.string.isRequired,
  receiptPartyType: PropTypes.string,
  simplified: PropTypes.bool,
  lineMode: PropTypes.string,
  linePartyType: PropTypes.string,
  ...receiptLineRowPropTypes,
};

ReceiptModeLineRow.defaultProps = {
  receiptPartyType: "",
  simplified: false,
  lineMode: null,
  linePartyType: "",
  ...receiptLineRowDefaultProps,
};

function LegacyReceiptLineRow({
  gridRowSx,
  bodyCellSx,
  line,
  index,
  accountOptions,
  partyOptions,
  contractOptions,
  invoiceOptions,
  productOptions,
  showPartyColumn,
  showContractColumn,
  showInvoiceColumn,
  hideAccountColumn,
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
  const amountLockedByInvoice = Boolean(String(line.invoiceKey || "").trim());
  return (
    <MDBox
      sx={{
        ...gridRowSx,
        bgcolor: "rgba(25, 118, 210, 0.06)",
        "&:hover": { bgcolor: "rgba(25, 118, 210, 0.08)" },
        "& > *": { borderBottom: "1px solid rgba(0,0,0,0.08)" },
      }}
    >
      <MDBox sx={{ ...bodyCellSx, textAlign: "right", fontWeight: 600 }}>{index + 1}</MDBox>

      <LineItemSelect
        line={line}
        index={index}
        productOptions={productOptions}
        readOnly={readOnly}
        errors={errors}
        onLineChange={onLineChange}
        bodyCellSx={bodyCellSx}
      />

      {!hideAccountColumn ? (
        <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
          <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-account`])}>
            <SearchableSelect
              value={getLineAccountSelectValue(line)}
              onChange={(e) => onLineChange(line.id, "account", e.target.value)}
              fullWidth
              size="small"
              displayEmpty
              disabled={readOnly || accountReadOnly}
              renderValue={(selected) => renderLineAccountValue(accountOptions, selected)}
              sx={receiptLineInputSx}
            >
              <MenuItem value="">
                <em>Select Account</em>
              </MenuItem>
              {accountOptions.map((option) => {
                const groupColor = option?.groupColor || { bg: "transparent", accent: "#9e9e9e" };
                const groupName = String(option?.groupName || "").trim() || "—";
                return (
                  <MenuItem
                    key={option.value}
                    value={option.value}
                    sx={getLineAccountMenuItemSx(option)}
                  >
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
                        {option.label}
                      </MDTypography>
                    </MDBox>
                  </MenuItem>
                );
              })}
            </SearchableSelect>
          </FormControl>
        </MDBox>
      ) : null}

      {showContractColumn ? (
        <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
          <FormControl fullWidth size="small">
            <SearchableSelect
              value={getReceiptLineContractSelectValue(line, contractOptions)}
              onChange={(e) => onLineChange(line.id, "contractId", e.target.value)}
              fullWidth
              size="small"
              displayEmpty
              disabled={readOnly || (!hideAccountColumn && !line.account)}
              renderValue={(selected) => {
                const selectedValue = String(selected ?? "");
                if (!selectedValue) return "";
                const option = (contractOptions || []).find(
                  (row) => String(row.value) === selectedValue
                );
                return option?.label || selectedValue;
              }}
              sx={receiptLineInputSx}
            >
              <ListSubheader
                sx={{
                  fontSize: "0.6875rem",
                  lineHeight: 1.35,
                  whiteSpace: "normal",
                  fontWeight: 600,
                  color: "text.secondary",
                  py: 0.75,
                }}
              >
                {RECEIPT_CONTRACT_DROPDOWN_NOTE}
              </ListSubheader>
              <MenuItem value="">
                <em>
                  {hideAccountColumn || line.account ? "Select contract" : "Select account first"}
                </em>
              </MenuItem>
              {(contractOptions || []).map((option) => (
                <MenuItem key={option.value} value={option.value} sx={{ whiteSpace: "normal" }}>
                  {option.label}
                </MenuItem>
              ))}
            </SearchableSelect>
          </FormControl>
        </MDBox>
      ) : null}

      {showInvoiceColumn ? (
        <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
          <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-invoice`])}>
            <SearchableSelect
              value={line.invoiceKey || ""}
              onChange={(e) => onLineChange(line.id, "invoiceKey", e.target.value)}
              fullWidth
              size="small"
              displayEmpty
              disabled={readOnly || (!hideAccountColumn && !line.account)}
              renderValue={(selected) => renderInvoiceDropdownValue(line, invoiceOptions, selected)}
              sx={receiptLineInputSx}
            >
              <MenuItem value="">
                <em>
                  {hideAccountColumn || line.account
                    ? "Select invoice (optional)"
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
      ) : null}

      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        <MDInput
          value={line.tinTrn ?? ""}
          onChange={(e) => onLineChange(line.id, "tinTrn", e.target.value)}
          fullWidth
          size="small"
          placeholder="TIN-TRN"
          disabled={readOnly}
          sx={receiptLineInputSx}
        />
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
          disabled={readOnly || amountLockedByInvoice}
          sx={receiptLineInputSx}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
        <MDInput
          value={line.quantity ?? ""}
          onChange={(e) => onLineChange(line.id, "quantity", e.target.value)}
          fullWidth
          size="small"
          placeholder="1"
          inputProps={{ inputMode: "decimal" }}
          disabled={readOnly}
          sx={receiptLineInputSx}
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
        {formatAmount(computeLineTotal(line))}
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

LegacyReceiptLineRow.propTypes = {
  ...receiptLineRowPropTypes,
  contractOptions: PropTypes.arrayOf(lineAccountOptionShape),
  showPartyColumn: PropTypes.bool,
  showContractColumn: PropTypes.bool,
  showInvoiceColumn: PropTypes.bool,
  hideAccountColumn: PropTypes.bool,
  accountReadOnly: PropTypes.bool,
};

LegacyReceiptLineRow.defaultProps = {
  ...receiptLineRowDefaultProps,
  contractOptions: [],
  showPartyColumn: false,
  showContractColumn: false,
  showInvoiceColumn: false,
  hideAccountColumn: false,
  accountReadOnly: false,
};

function ReceiptLinesGrid({
  lines,
  receiptLineMode,
  receiptPartyType,
  accountOptions,
  getLineAccountOptions,
  getLinePartyOptions,
  contractOptions,
  getLineInvoiceOptions,
  productOptions,
  errors,
  saving,
  grandTotal,
  accountReadOnly,
  readOnly,
  showContractColumn = false,
  hideAccountColumn = false,
  headerShowPartyColumn,
  requireLineAccount = true,
  requireLineItem,
  onLineChange,
  onAddLine,
  onDuplicateLine,
  onDeleteLine,
  fillHeight,
  receiptSimplifiedLines = false,
}) {
  const useReceiptMode = Boolean(receiptLineMode);
  const simplified = Boolean(receiptSimplifiedLines);

  const showPartyColumn = false;

  const showInvoiceColumn = simplified
    ? false
    : useReceiptMode
    ? isReceiptInvoiceMode(receiptLineMode)
    : (lines || []).some((line) => String(line?.account || "").trim());

  const visibleContractColumn = !useReceiptMode && showContractColumn;

  const visibleColumns = useReceiptMode
    ? buildReceiptModeColumns(receiptLineMode, receiptPartyType, { simplified })
    : buildLegacyReceiptLineColumns(
        showPartyColumn,
        visibleContractColumn,
        showInvoiceColumn,
        hideAccountColumn
      );

  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: useReceiptMode
      ? buildReceiptModeGridTemplate(receiptLineMode, { simplified })
      : buildLegacyReceiptLineGridColumns(
          showPartyColumn,
          visibleContractColumn,
          showInvoiceColumn,
          hideAccountColumn
        ),
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

  const linesBodySx = fillHeight
    ? { flex: "1 1 0", minHeight: 0, overflow: "auto" }
    : { maxHeight: 280, overflow: "auto" };

  const lineCompleteOptions = useReceiptMode
    ? null
    : {
        requireItem: requireLineItem != null ? requireLineItem : !showContractColumn,
        requireAccount: requireLineAccount,
      };

  const isLineComplete = (line) => {
    if (useReceiptMode) {
      if (simplified) {
        const { mode } = resolveReceiptLineContextFromLine(line, accountOptions);
        if (!mode) return Boolean(String(line.account || "").trim());
        return isReceiptLayoutLineComplete(line, mode);
      }
      return isReceiptLayoutLineComplete(line, receiptLineMode);
    }
    return isReceiptLineComplete(line, lineCompleteOptions);
  };

  const canAddLine =
    !readOnly && !saving && (lines.length === 0 || lines.every((line) => isLineComplete(line)));
  const addLineTooltip =
    lines.length === 0 || lines.every((line) => isLineComplete(line))
      ? "Add line"
      : "Complete all rows before adding another line";

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
          display: fillHeight ? "flex" : "block",
          flexDirection: fillHeight ? "column" : undefined,
          flex: fillHeight ? "1 1 0" : undefined,
          minHeight: fillHeight ? 0 : undefined,
        }}
      >
        <MDBox sx={linesBodySx}>
          <MDBox sx={{ minWidth: "max-content" }}>
            <MDBox
              sx={{
                ...gridRowSx,
                position: "sticky",
                top: 0,
                zIndex: 2,
              }}
            >
              {visibleColumns.map((col) => (
                <MDBox
                  key={col.key}
                  sx={{
                    ...headerCellSx,
                    textAlign: getReceiptHeaderTextAlign(col),
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
                  : { mode: receiptLineMode, partyType: receiptPartyType };
                return useReceiptMode ? (
                  <ReceiptModeLineRow
                    key={line.id}
                    mode={receiptLineMode}
                    receiptPartyType={receiptPartyType}
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
                    readOnly={readOnly}
                    errors={errors}
                    saving={saving}
                    canDelete
                    canDuplicate={isLineComplete(line)}
                    onLineChange={onLineChange}
                    onDuplicateLine={onDuplicateLine}
                    onDeleteLine={onDeleteLine}
                  />
                ) : (
                  <LegacyReceiptLineRow
                    key={line.id}
                    gridRowSx={gridRowSx}
                    bodyCellSx={bodyCellSx}
                    line={line}
                    index={index}
                    accountOptions={accountOptions}
                    partyOptions={getLinePartyOptions(line)}
                    contractOptions={contractOptions}
                    invoiceOptions={getLineInvoiceOptions(line)}
                    productOptions={productOptions}
                    showPartyColumn={showPartyColumn}
                    showContractColumn={visibleContractColumn}
                    showInvoiceColumn={showInvoiceColumn}
                    hideAccountColumn={hideAccountColumn}
                    accountReadOnly={accountReadOnly}
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

ReceiptLinesGrid.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.object).isRequired,
  receiptLineMode: PropTypes.string,
  receiptPartyType: PropTypes.string,
  accountOptions: PropTypes.arrayOf(lineAccountOptionShape),
  getLineAccountOptions: PropTypes.func,
  getLinePartyOptions: PropTypes.func,
  contractOptions: PropTypes.arrayOf(lineAccountOptionShape),
  getLineInvoiceOptions: PropTypes.func,
  productOptions: PropTypes.arrayOf(productOptionShape),
  errors: PropTypes.object,
  saving: PropTypes.bool,
  grandTotal: PropTypes.number,
  accountReadOnly: PropTypes.bool,
  readOnly: PropTypes.bool,
  showContractColumn: PropTypes.bool,
  hideAccountColumn: PropTypes.bool,
  headerShowPartyColumn: PropTypes.bool,
  requireLineAccount: PropTypes.bool,
  requireLineItem: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onAddLine: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
  fillHeight: PropTypes.bool,
  receiptSimplifiedLines: PropTypes.bool,
};

ReceiptLinesGrid.defaultProps = {
  receiptLineMode: undefined,
  receiptPartyType: "",
  accountOptions: [],
  getLineAccountOptions: undefined,
  getLinePartyOptions: () => [],
  contractOptions: [],
  getLineInvoiceOptions: () => [],
  productOptions: [],
  errors: {},
  saving: false,
  grandTotal: 0,
  accountReadOnly: false,
  readOnly: false,
  showContractColumn: false,
  hideAccountColumn: false,
  headerShowPartyColumn: undefined,
  requireLineAccount: true,
  requireLineItem: undefined,
  fillHeight: false,
  receiptSimplifiedLines: false,
};

export default ReceiptLinesGrid;
