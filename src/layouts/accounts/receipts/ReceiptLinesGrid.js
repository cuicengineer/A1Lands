import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import {
  ITEM_OPTIONS,
  computeLineTotal,
  formatAmount,
  isReceiptLineComplete,
} from "./receiptUtils";

const RECEIPT_LINES_TABLE_COLUMNS = [
  { label: "#", key: "sno", align: "right", numeric: true },
  { label: "Item", key: "item", align: "left" },
  { label: "Account", key: "account", align: "left" },
  { label: "TIN-TRN", key: "tinTrn", align: "left" },
  { label: "Amount", key: "amount", align: "right", numeric: true },
  { label: "Total", key: "total", align: "right", numeric: true },
];

const RECEIPT_LINES_DATA_GRID_COLUMNS =
  "minmax(40px, 0.5fr) minmax(120px, 1.3fr) minmax(110px, 1.2fr) minmax(96px, 1fr) minmax(96px, 1fr) minmax(84px, 0.9fr)";

const RECEIPT_LINES_GRID_COLUMNS = `${RECEIPT_LINES_DATA_GRID_COLUMNS} 120px`;

const receiptLineInputSx = {
  "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30 },
  "& .MuiInputBase-input": { py: 0.5, px: 0.75 },
  "& .MuiSelect-select": {
    py: 0.5,
    px: 0.75,
    minHeight: "30px !important",
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

      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        <MDInput
          select
          value={line.item}
          onChange={(e) => onLineChange(line.id, "item", e.target.value)}
          fullWidth
          size="small"
          displayEmpty
          error={Boolean(errors[`line-${index}-item`])}
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

      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        <MDInput
          select
          value={line.account}
          onChange={(e) => onLineChange(line.id, "account", e.target.value)}
          fullWidth
          size="small"
          displayEmpty
          error={Boolean(errors[`line-${index}-account`])}
          sx={receiptLineInputSx}
        >
          <MenuItem value="">
            <em>Select Account</em>
          </MenuItem>
          {accountOptions.map((option) => (
            <MenuItem key={option.value} value={option.value}>
              {option.label}
            </MenuItem>
          ))}
        </MDInput>
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        <MDInput
          value={line.tinTrn ?? ""}
          onChange={(e) => onLineChange(line.id, "tinTrn", e.target.value)}
          fullWidth
          size="small"
          placeholder="TIN-TRN"
          sx={receiptLineInputSx}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right", p: 0.5 }}>
        <MDInput
          value={line.amount ?? ""}
          onChange={(e) => onLineChange(line.id, "amount", e.target.value)}
          fullWidth
          size="small"
          placeholder="Amount"
          inputProps={{ inputMode: "decimal" }}
          error={Boolean(errors[`line-${index}-amount`])}
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
          gap: 0.25,
        }}
      >
        <Tooltip title={canDuplicate ? "Duplicate" : "Complete this row before duplicating"}>
          <span>
            <IconButton
              size="small"
              color="secondary"
              disabled={saving || !canDuplicate}
              onClick={() => onDuplicateLine(line.id)}
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
              disabled={saving || !canDelete}
              onClick={() => onDeleteLine(line.id)}
              sx={{ padding: "2px" }}
            >
              <Icon fontSize="small">delete</Icon>
            </IconButton>
          </span>
        </Tooltip>
      </MDBox>
    </MDBox>
  );
}

const lineAccountOptionShape = PropTypes.shape({
  value: PropTypes.string.isRequired,
  label: PropTypes.string.isRequired,
});

ReceiptLineRow.propTypes = {
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
  line: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  accountOptions: PropTypes.arrayOf(lineAccountOptionShape),
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
  errors: {},
  saving: false,
  canDelete: true,
  canDuplicate: false,
};

function ReceiptLinesGrid({
  lines,
  accountOptions,
  errors,
  saving,
  grandTotal,
  onLineChange,
  onAddLine,
  onDuplicateLine,
  onDeleteLine,
  fillHeight,
}) {
  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: RECEIPT_LINES_GRID_COLUMNS,
    width: "100%",
    alignItems: "center",
    columnGap: 0,
  };

  const cellBaseSx = {
    fontSize: "0.8125rem",
    lineHeight: 1.25,
    py: 0.75,
    px: 1.25,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    boxSizing: "border-box",
  };

  const headerCellSx = {
    ...cellBaseSx,
    fontWeight: 700,
    fontSize: "0.75rem",
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
    !saving && (lines.length === 0 || lines.every((line) => isReceiptLineComplete(line)));
  const addLineTooltip =
    lines.length === 0 || lines.every((line) => isReceiptLineComplete(line))
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
        <MDBox sx={gridRowSx}>
          {RECEIPT_LINES_TABLE_COLUMNS.map((col) => (
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

        <MDBox sx={linesBodySx}>
          {!lines?.length ? (
            <MDTypography variant="caption" color="text" display="block" textAlign="center" py={2}>
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
                errors={errors}
                saving={saving}
                canDelete
                canDuplicate={isReceiptLineComplete(line)}
                onLineChange={onLineChange}
                onDuplicateLine={onDuplicateLine}
                onDeleteLine={onDeleteLine}
              />
            ))
          )}
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

ReceiptLinesGrid.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.object).isRequired,
  accountOptions: PropTypes.arrayOf(lineAccountOptionShape),
  errors: PropTypes.object,
  saving: PropTypes.bool,
  grandTotal: PropTypes.number,
  onLineChange: PropTypes.func.isRequired,
  onAddLine: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
  fillHeight: PropTypes.bool,
};

ReceiptLinesGrid.defaultProps = {
  accountOptions: [],
  errors: {},
  saving: false,
  grandTotal: 0,
  fillHeight: false,
};

export default ReceiptLinesGrid;
