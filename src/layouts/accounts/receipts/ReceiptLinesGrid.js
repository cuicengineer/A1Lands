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
  ITEM_OPTIONS,
  computeLineTotal,
  formatAmount,
  getReceiptLineContractSelectValue,
  isReceiptLineComplete,
} from "./receiptUtils";

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
  return option?.label || selectedValue;
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

const RECEIPT_LINES_TABLE_COLUMNS = [
  { label: "#", key: "sno", align: "right", numeric: true },
  { label: "Item", key: "item", align: "left" },
  { label: "Account", key: "account", align: "left" },
  { label: "TIN-TRN", key: "tinTrn", align: "left" },
  { label: "Amount", key: "amount", align: "right", numeric: true },
  { label: "Qty", key: "quantity", align: "right", numeric: true },
  { label: "Disc %", key: "discount", align: "right", numeric: true },
  { label: "Tax %", key: "tax", align: "right", numeric: true },
  { label: "Total", key: "total", align: "right", numeric: true },
];

const PARTY_COLUMN = { label: "Customer / Tenant / Supplier", key: "party", align: "left" };
const CONTRACT_COLUMN = { label: "Contract", key: "contract", align: "left" };
const INVOICE_COLUMN = { label: "Invoice", key: "invoice", align: "left" };

function buildReceiptLineColumns(showPartyColumn, showContractColumn, showInvoiceColumn) {
  const columns = [...RECEIPT_LINES_TABLE_COLUMNS];
  const insertAt = 3;
  if (showPartyColumn) columns.splice(insertAt, 0, PARTY_COLUMN);
  if (showContractColumn) {
    columns.splice(insertAt + (showPartyColumn ? 1 : 0), 0, CONTRACT_COLUMN);
  }
  if (showInvoiceColumn) {
    columns.splice(
      insertAt + (showPartyColumn ? 1 : 0) + (showContractColumn ? 1 : 0),
      0,
      INVOICE_COLUMN
    );
  }
  return columns;
}

function buildReceiptLineGridColumns(showPartyColumn, showContractColumn, showInvoiceColumn) {
  const columns = ["28px", "minmax(84px, 0.85fr)", "minmax(112px, 0.95fr)"];
  if (showPartyColumn) columns.push("minmax(128px, 1.05fr)");
  if (showContractColumn) columns.push("minmax(136px, 1.1fr)");
  if (showInvoiceColumn) columns.push("minmax(112px, 0.95fr)");
  columns.push(
    "minmax(68px, 0.6fr)",
    "minmax(68px, 0.6fr)",
    "minmax(44px, 0.4fr)",
    "minmax(48px, 0.42fr)",
    "minmax(48px, 0.42fr)",
    "minmax(68px, 0.6fr)",
    "64px"
  );
  return columns.join(" ");
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

function ReceiptLineRow({
  gridRowSx,
  bodyCellSx,
  line,
  index,
  accountOptions,
  partyOptions,
  contractOptions,
  invoiceOptions,
  showPartyColumn,
  showContractColumn,
  showInvoiceColumn,
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

      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        <MDInput
          select
          value={line.item}
          onChange={(e) => onLineChange(line.id, "item", e.target.value)}
          fullWidth
          size="small"
          displayEmpty
          error={showContractColumn ? false : Boolean(errors[`line-${index}-item`])}
          disabled={readOnly}
          sx={receiptLineInputSx}
        >
          <MenuItem value="">
            <em>Select Item</em>
          </MenuItem>
          {ITEM_OPTIONS.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
            </MenuItem>
          ))}
        </MDInput>
      </MDBox>

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

      {showPartyColumn ? (
        <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
          <FormControl fullWidth size="small">
            <SearchableSelect
              value={line.partyKey || ""}
              onChange={(e) => onLineChange(line.id, "partyKey", e.target.value)}
              fullWidth
              size="small"
              displayEmpty
              disabled={readOnly || !line.account}
              sx={receiptLineInputSx}
            >
              <MenuItem value="">
                <em>{line.account ? "Select party" : "Select account first"}</em>
              </MenuItem>
              {(partyOptions || []).map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
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
              disabled={readOnly || !line.partyKey}
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
                <em>{line.partyKey ? "Select contract" : "Select party first"}</em>
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
              disabled={readOnly || !line.partyKey}
              sx={receiptLineInputSx}
            >
              <MenuItem value="">
                <em>{line.partyKey ? "Select invoice" : "Select party first"}</em>
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
          disabled={readOnly}
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

      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
        <MDInput
          value={line.discount ?? "0"}
          onChange={(e) => onLineChange(line.id, "discount", e.target.value)}
          fullWidth
          size="small"
          placeholder="0"
          inputProps={{ inputMode: "decimal" }}
          disabled={readOnly}
          sx={receiptLineInputSx}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
        <MDInput
          value={line.tax ?? "0"}
          onChange={(e) => onLineChange(line.id, "tax", e.target.value)}
          fullWidth
          size="small"
          placeholder="0"
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

const lineAccountOptionShape = PropTypes.shape({
  value: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
  groupName: PropTypes.string,
  groupColor: PropTypes.shape({
    bg: PropTypes.string,
    accent: PropTypes.string,
  }),
});

ReceiptLineRow.propTypes = {
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
  line: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  accountOptions: PropTypes.arrayOf(lineAccountOptionShape),
  partyOptions: PropTypes.arrayOf(lineAccountOptionShape),
  contractOptions: PropTypes.arrayOf(lineAccountOptionShape),
  invoiceOptions: PropTypes.arrayOf(lineAccountOptionShape),
  showPartyColumn: PropTypes.bool,
  showContractColumn: PropTypes.bool,
  showInvoiceColumn: PropTypes.bool,
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

ReceiptLineRow.defaultProps = {
  accountOptions: [],
  partyOptions: [],
  contractOptions: [],
  invoiceOptions: [],
  showPartyColumn: false,
  showContractColumn: false,
  showInvoiceColumn: false,
  accountReadOnly: false,
  readOnly: false,
  errors: {},
  saving: false,
  canDelete: true,
  canDuplicate: false,
};

function ReceiptLinesGrid({
  lines,
  accountOptions,
  getLinePartyOptions,
  contractOptions,
  getLineInvoiceOptions,
  errors,
  saving,
  grandTotal,
  accountReadOnly,
  readOnly,
  showContractColumn = false,
  onLineChange,
  onAddLine,
  onDuplicateLine,
  onDeleteLine,
  fillHeight,
}) {
  const showPartyColumn = (lines || []).some((line) => String(line?.account || "").trim());
  const showInvoiceColumn = (lines || []).some((line) => String(line?.partyKey || "").trim());
  const visibleContractColumn = showContractColumn && showPartyColumn;
  const visibleColumns = buildReceiptLineColumns(
    showPartyColumn,
    visibleContractColumn,
    showInvoiceColumn
  );
  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: buildReceiptLineGridColumns(
      showPartyColumn,
      visibleContractColumn,
      showInvoiceColumn
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

  const canAddLine =
    !readOnly &&
    !saving &&
    (lines.length === 0 ||
      lines.every((line) => isReceiptLineComplete(line, { requireItem: !showContractColumn })));
  const addLineTooltip =
    lines.length === 0 ||
    lines.every((line) => isReceiptLineComplete(line, { requireItem: !showContractColumn }))
      ? "Add line"
      : "Complete all rows before adding another line";

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
                    textAlign: col.align === "right" ? "right" : "left",
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
              lines.map((line, index) => (
                <ReceiptLineRow
                  key={line.id}
                  gridRowSx={gridRowSx}
                  bodyCellSx={bodyCellSx}
                  line={line}
                  index={index}
                  accountOptions={accountOptions}
                  partyOptions={getLinePartyOptions(line)}
                  contractOptions={contractOptions}
                  invoiceOptions={getLineInvoiceOptions(line)}
                  showPartyColumn={showPartyColumn}
                  showContractColumn={visibleContractColumn}
                  showInvoiceColumn={showInvoiceColumn}
                  accountReadOnly={accountReadOnly}
                  readOnly={readOnly}
                  errors={errors}
                  saving={saving}
                  canDelete
                  canDuplicate={isReceiptLineComplete(line, { requireItem: !showContractColumn })}
                  onLineChange={onLineChange}
                  onDuplicateLine={onDuplicateLine}
                  onDeleteLine={onDeleteLine}
                />
              ))
            )}
          </MDBox>
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

ReceiptLinesGrid.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.object).isRequired,
  accountOptions: PropTypes.arrayOf(lineAccountOptionShape),
  getLinePartyOptions: PropTypes.func,
  contractOptions: PropTypes.arrayOf(lineAccountOptionShape),
  getLineInvoiceOptions: PropTypes.func,
  errors: PropTypes.object,
  saving: PropTypes.bool,
  grandTotal: PropTypes.number,
  accountReadOnly: PropTypes.bool,
  readOnly: PropTypes.bool,
  showContractColumn: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onAddLine: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
  fillHeight: PropTypes.bool,
};

ReceiptLinesGrid.defaultProps = {
  accountOptions: [],
  getLinePartyOptions: () => [],
  contractOptions: [],
  getLineInvoiceOptions: () => [],
  errors: {},
  saving: false,
  grandTotal: 0,
  accountReadOnly: false,
  readOnly: false,
  showContractColumn: false,
  fillHeight: false,
};

export default ReceiptLinesGrid;
