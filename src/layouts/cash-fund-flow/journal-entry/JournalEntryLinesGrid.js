import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import SearchableSelect from "components/SearchableSelect";
import {
  computeJournalEntryLineTotals,
  findJournalEntryAccountOption,
  formatAmount,
  getJournalEntryLineMode,
} from "./journalEntryUtils";
import { sanitizeNumericAmountInput } from "layouts/income-agreements/collections/collectionsUtils";

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

const lineCenterInputSx = {
  ...lineInputSx,
  "& .MuiInputBase-input": {
    ...lineInputSx["& .MuiInputBase-input"],
    textAlign: "right",
  },
};

const MIDDLE_COLUMN_DEFS = {
  contract: { label: "Contract", width: "minmax(160px, 1.1fr)" },
  invoice: { label: "Invoice No", width: "minmax(180px, 1.2fr)" },
  quantity: { label: "Qty", width: "minmax(60px, 0.45fr)" },
  unitPrice: { label: "Unit Price", width: "minmax(72px, 0.55fr)" },
};

function getLineAccountSelectValue(line) {
  if (line?.accountSource && line?.accountCoaId) {
    return `${line.accountSource}:${line.accountCoaId}`;
  }
  return line?.accountCoaId || line?.account || "";
}

function resolveMiddleColumns(lines, accountOptions) {
  let showParty = false;
  let showRevenue = false;
  (lines || []).forEach((line) => {
    const account = findJournalEntryAccountOption(accountOptions, line);
    const mode = getJournalEntryLineMode(account);
    if (mode === "party") showParty = true;
    if (mode === "revenueExpense") showRevenue = true;
  });

  const keys = [];
  if (showParty) {
    keys.push("contract", "invoice");
  }
  if (showRevenue) {
    keys.push("quantity", "unitPrice");
  }
  return keys;
}

function buildGridTemplate(middleKeys) {
  const middleWidths = middleKeys.map((key) => MIDDLE_COLUMN_DEFS[key].width);
  return [
    "28px",
    "minmax(180px, 1.4fr)",
    ...middleWidths,
    "minmax(72px, 0.55fr)",
    "minmax(72px, 0.55fr)",
    "64px",
  ].join(" ");
}

function MiddleCell({ children, bodyCellSx }) {
  return <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>{children}</MDBox>;
}

MiddleCell.propTypes = {
  children: PropTypes.node,
  bodyCellSx: PropTypes.object.isRequired,
};

function JournalEntryLineRow({
  line,
  index,
  accountOptions,
  middleKeys,
  getLineContractOptions,
  getLineInvoiceOptions,
  readOnly,
  errors,
  saving,
  canDelete,
  onLineChange,
  onDuplicateLine,
  onDeleteLine,
  gridRowSx,
  bodyCellSx,
}) {
  const account = findJournalEntryAccountOption(accountOptions, line);
  const lineMode = getJournalEntryLineMode(account);
  const contractOptions = lineMode === "party" ? getLineContractOptions(line, account) : [];
  const invoiceOptions = lineMode === "party" ? getLineInvoiceOptions(line, account) : [];

  const handleAccountChange = (value) => {
    const selected = (accountOptions || []).find(
      (option) => String(option.value) === String(value)
    );
    onLineChange(line.id, {
      accountSource: selected?.accountSource || "",
      accountCoaId: selected?.coaId || "",
      accountLabel: selected?.label || "",
      contractId: "",
      contractNo: "",
      invoiceKey: "",
      invoiceNo: "",
      invoiceLabel: "",
      quantity: "",
      unitPrice: "",
    });
  };

  const handleContractChange = (value) => {
    const selected = contractOptions.find((option) => String(option.value) === String(value));
    onLineChange(line.id, {
      contractId: selected?.contractId ? String(selected.contractId) : value,
      contractNo: selected?.contractNo || "",
      invoiceKey: "",
      invoiceNo: "",
      invoiceLabel: "",
    });
  };

  const handleInvoiceChange = (value) => {
    const selected = invoiceOptions.find((option) => String(option.value) === String(value));
    onLineChange(line.id, {
      invoiceKey: selected?.invoiceKey || value,
      invoiceNo: selected?.invoiceNo || "",
      invoiceLabel: selected?.label || "",
    });
  };

  const renderMiddleCell = (key) => {
    if (key === "contract") {
      if (lineMode !== "party") {
        return <MiddleCell key={key} bodyCellSx={bodyCellSx} />;
      }
      return (
        <MiddleCell key={key} bodyCellSx={bodyCellSx}>
          {readOnly ? (
            <MDTypography variant="caption">{line.contractNo || "—"}</MDTypography>
          ) : (
            <SearchableSelect
              fullWidth
              size="small"
              value={String(line.contractId || "")}
              displayEmpty
              onChange={(e) => handleContractChange(e.target.value)}
              disabled={saving || !account}
              error={Boolean(errors[`line-${index}-contract`])}
              sx={lineInputSx}
            >
              <MenuItem value="">
                <em>Select contract</em>
              </MenuItem>
              {contractOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} sx={{ whiteSpace: "normal" }}>
                  {option.label}
                </MenuItem>
              ))}
            </SearchableSelect>
          )}
        </MiddleCell>
      );
    }

    if (key === "invoice") {
      if (lineMode !== "party") {
        return <MiddleCell key={key} bodyCellSx={bodyCellSx} />;
      }
      return (
        <MiddleCell key={key} bodyCellSx={bodyCellSx}>
          {readOnly ? (
            <MDTypography variant="caption">
              {line.invoiceNo || line.invoiceLabel || "—"}
            </MDTypography>
          ) : (
            <SearchableSelect
              fullWidth
              size="small"
              value={String(line.invoiceKey || line.invoiceNo || "")}
              displayEmpty
              onChange={(e) => handleInvoiceChange(e.target.value)}
              disabled={saving || !line.contractId}
              error={Boolean(errors[`line-${index}-invoice`])}
              sx={lineInputSx}
            >
              <MenuItem value="">
                <em>Select invoice</em>
              </MenuItem>
              {invoiceOptions.map((option) => (
                <MenuItem key={option.value} value={option.value} sx={{ whiteSpace: "normal" }}>
                  {option.label}
                </MenuItem>
              ))}
            </SearchableSelect>
          )}
        </MiddleCell>
      );
    }

    if (key === "quantity") {
      if (lineMode !== "revenueExpense") return <MiddleCell key={key} bodyCellSx={bodyCellSx} />;
      return (
        <MiddleCell key={key} bodyCellSx={bodyCellSx}>
          {readOnly ? (
            <MDTypography variant="caption">{line.quantity || "—"}</MDTypography>
          ) : (
            <MDInput
              value={line.quantity ?? ""}
              onChange={(e) =>
                onLineChange(line.id, { quantity: sanitizeNumericAmountInput(e.target.value) })
              }
              disabled={saving}
              size="small"
              error={Boolean(errors[`line-${index}-quantity`])}
              sx={lineCenterInputSx}
            />
          )}
        </MiddleCell>
      );
    }

    if (key === "unitPrice") {
      if (lineMode !== "revenueExpense") return <MiddleCell key={key} bodyCellSx={bodyCellSx} />;
      return (
        <MiddleCell key={key} bodyCellSx={bodyCellSx}>
          {readOnly ? (
            <MDTypography variant="caption">{formatAmount(line.unitPrice)}</MDTypography>
          ) : (
            <MDInput
              value={line.unitPrice ?? ""}
              onChange={(e) =>
                onLineChange(line.id, { unitPrice: sanitizeNumericAmountInput(e.target.value) })
              }
              disabled={saving}
              size="small"
              error={Boolean(errors[`line-${index}-unitPrice`])}
              sx={lineCenterInputSx}
            />
          )}
        </MiddleCell>
      );
    }

    return null;
  };

  return (
    <MDBox sx={gridRowSx}>
      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>{index + 1}</MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        {readOnly ? (
          <MDTypography variant="caption">{line.accountLabel || line.account || "—"}</MDTypography>
        ) : (
          <SearchableSelect
            fullWidth
            size="small"
            value={getLineAccountSelectValue(line)}
            displayEmpty
            onChange={(e) => handleAccountChange(e.target.value)}
            disabled={saving}
            error={Boolean(errors[`line-${index}-account`])}
            sx={lineInputSx}
            renderValue={(selected) => {
              if (!selected) return "Select account";
              const option = (accountOptions || []).find(
                (row) => String(row.value) === String(selected)
              );
              return option?.label || line.accountLabel || selected;
            }}
          >
            <MenuItem value="">
              <em>Select account</em>
            </MenuItem>
            {(accountOptions || []).map((option) => (
              <MenuItem key={option.value} value={option.value} sx={{ whiteSpace: "normal" }}>
                {option.label}
              </MenuItem>
            ))}
          </SearchableSelect>
        )}
      </MDBox>
      {middleKeys.map((key) => renderMiddleCell(key))}
      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
        {readOnly ? (
          <MDTypography variant="caption">{formatAmount(line.debit)}</MDTypography>
        ) : (
          <MDInput
            value={line.debit ?? ""}
            onChange={(e) =>
              onLineChange(line.id, {
                debit: sanitizeNumericAmountInput(e.target.value),
                credit: "",
              })
            }
            disabled={saving}
            size="small"
            error={Boolean(errors[`line-${index}-amount`])}
            sx={lineCenterInputSx}
          />
        )}
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
        {readOnly ? (
          <MDTypography variant="caption">{formatAmount(line.credit)}</MDTypography>
        ) : (
          <MDInput
            value={line.credit ?? ""}
            onChange={(e) =>
              onLineChange(line.id, {
                credit: sanitizeNumericAmountInput(e.target.value),
                debit: "",
              })
            }
            disabled={saving}
            size="small"
            error={Boolean(errors[`line-${index}-amount`])}
            sx={lineCenterInputSx}
          />
        )}
      </MDBox>
      <MDBox sx={{ ...bodyCellSx, textAlign: "center" }}>
        {!readOnly ? (
          <MDBox display="flex" justifyContent="center" gap={0.25}>
            <Tooltip title="Duplicate line">
              <span>
                <IconButton
                  size="small"
                  color="info"
                  disabled={saving}
                  onClick={() => onDuplicateLine(line.id)}
                >
                  <Icon sx={{ fontSize: "0.95rem !important" }}>content_copy</Icon>
                </IconButton>
              </span>
            </Tooltip>
            {canDelete ? (
              <Tooltip title="Delete line">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    disabled={saving}
                    onClick={() => onDeleteLine(line.id)}
                  >
                    <Icon sx={{ fontSize: "0.95rem !important" }}>delete</Icon>
                  </IconButton>
                </span>
              </Tooltip>
            ) : null}
          </MDBox>
        ) : null}
      </MDBox>
    </MDBox>
  );
}

JournalEntryLineRow.propTypes = {
  line: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  accountOptions: PropTypes.array.isRequired,
  middleKeys: PropTypes.arrayOf(PropTypes.string).isRequired,
  getLineContractOptions: PropTypes.func.isRequired,
  getLineInvoiceOptions: PropTypes.func.isRequired,
  readOnly: PropTypes.bool,
  errors: PropTypes.object,
  saving: PropTypes.bool,
  canDelete: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
};

JournalEntryLineRow.defaultProps = {
  readOnly: false,
  errors: {},
  saving: false,
  canDelete: true,
};

export default function JournalEntryLinesGrid({
  lines,
  accountOptions,
  getLineContractOptions,
  getLineInvoiceOptions,
  errors,
  saving,
  readOnly,
  onLineChange,
  onAddLine,
  onDuplicateLine,
  onDeleteLine,
}) {
  const middleKeys = resolveMiddleColumns(lines, accountOptions);
  const gridColumns = buildGridTemplate(middleKeys);
  const headerColumns = [
    "#",
    "Account",
    ...middleKeys.map((key) => MIDDLE_COLUMN_DEFS[key].label),
    "Debit",
    "Credit",
    "",
  ];

  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: gridColumns,
    gap: 0.5,
    alignItems: "center",
    px: 0.5,
    py: 0.25,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
  };

  const headerCellSx = {
    px: 0.5,
    py: 0.5,
    fontSize: "0.6875rem",
    fontWeight: 700,
    color: "#344767",
    textTransform: "uppercase",
  };

  const bodyCellSx = {
    px: 0.25,
    py: 0.125,
    minWidth: 0,
  };

  const { totalDebit, totalCredit } = computeJournalEntryLineTotals(lines);
  const totalsSpan = 2 + middleKeys.length;

  return (
    <MDBox className="journal-entry-lines-grid">
      {!readOnly ? (
        <MDBox display="flex" justifyContent="flex-end" alignItems="center" mb={0.5}>
          <Tooltip title="Add line">
            <span>
              <IconButton color="info" size="small" onClick={onAddLine} disabled={saving}>
                <Icon>add_circle</Icon>
              </IconButton>
            </span>
          </Tooltip>
        </MDBox>
      ) : null}

      <MDBox
        sx={{
          ...gridRowSx,
          bgcolor: "rgba(0,0,0,0.03)",
          borderBottom: "1px solid rgba(0,0,0,0.12)",
        }}
      >
        {headerColumns.map((label) => (
          <MDBox key={label || "actions"} sx={headerCellSx}>
            {label}
          </MDBox>
        ))}
      </MDBox>

      {(lines || []).map((line, index) => (
        <JournalEntryLineRow
          key={line.id}
          line={line}
          index={index}
          accountOptions={accountOptions}
          middleKeys={middleKeys}
          getLineContractOptions={getLineContractOptions}
          getLineInvoiceOptions={getLineInvoiceOptions}
          readOnly={readOnly}
          errors={errors}
          saving={saving}
          canDelete={(lines || []).length > 0}
          onLineChange={onLineChange}
          onDuplicateLine={onDuplicateLine}
          onDeleteLine={onDeleteLine}
          gridRowSx={gridRowSx}
          bodyCellSx={bodyCellSx}
        />
      ))}

      <MDBox
        sx={{
          ...gridRowSx,
          bgcolor: "rgba(25,118,210,0.04)",
          fontWeight: 700,
        }}
      >
        <MDBox sx={{ ...bodyCellSx, gridColumn: `span ${totalsSpan}` }}>
          <MDTypography variant="caption" fontWeight="bold">
            Totals
          </MDTypography>
        </MDBox>
        <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
          <MDTypography variant="caption" fontWeight="bold">
            {formatAmount(totalDebit)}
          </MDTypography>
        </MDBox>
        <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
          <MDTypography variant="caption" fontWeight="bold">
            {formatAmount(totalCredit)}
          </MDTypography>
        </MDBox>
        <MDBox sx={bodyCellSx} />
      </MDBox>

      {errors.lines ? (
        <MDTypography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
          {errors.lines}
        </MDTypography>
      ) : null}

      {errors.totals ? (
        <MDTypography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
          {errors.totals}
        </MDTypography>
      ) : null}
    </MDBox>
  );
}

JournalEntryLinesGrid.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.object).isRequired,
  accountOptions: PropTypes.array.isRequired,
  getLineContractOptions: PropTypes.func.isRequired,
  getLineInvoiceOptions: PropTypes.func.isRequired,
  errors: PropTypes.object,
  saving: PropTypes.bool,
  readOnly: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onAddLine: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
};

JournalEntryLinesGrid.defaultProps = {
  errors: {},
  saving: false,
  readOnly: false,
};
