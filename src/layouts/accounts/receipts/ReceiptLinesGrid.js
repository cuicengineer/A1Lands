import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import {
  BASE_OPTIONS,
  ITEM_OPTIONS,
  LINE_ACCOUNT_OPTIONS,
  RAC_OPTIONS,
  computeLineTotal,
  formatAmount,
} from "./receiptUtils";

const RECEIPT_LINES_TABLE_COLUMNS = [
  { label: "#", key: "sno", align: "right", numeric: true },
  { label: "RAC", key: "rac", align: "left" },
  { label: "Base", key: "base", align: "left" },
  { label: "Item", key: "item", align: "left" },
  { label: "Account", key: "account", align: "left" },
  { label: "TIN-TRN", key: "tinTrn", align: "left" },
  { label: "Amount", key: "amount", align: "right", numeric: true },
  { label: "Total", key: "total", align: "right", numeric: true },
];

const RECEIPT_LINES_DATA_GRID_COLUMNS =
  "minmax(40px, 0.5fr) minmax(88px, 1fr) minmax(88px, 1fr) minmax(96px, 1.1fr) minmax(88px, 1fr) minmax(80px, 0.9fr) minmax(80px, 0.9fr) minmax(72px, 0.8fr)";

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

function filteredBasesForLine(racId) {
  return BASE_OPTIONS.filter((base) => !racId || Number(base.racId) === Number(racId));
}

function ReceiptLineRow({
  gridRowSx,
  bodyCellSx,
  line,
  index,
  errors,
  saving,
  canDelete,
  onLineChange,
  onDuplicateLine,
  onDeleteLine,
}) {
  const bases = filteredBasesForLine(line.racId);

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
          value={line.racId}
          onChange={(e) => onLineChange(line.id, "racId", e.target.value)}
          fullWidth
          size="small"
          displayEmpty
          error={Boolean(errors[`line-${index}-rac`])}
          sx={receiptLineInputSx}
        >
          <MenuItem value="">
            <em>Select RAC</em>
          </MenuItem>
          {RAC_OPTIONS.map((opt) => (
            <MenuItem key={opt.id} value={opt.id}>
              {opt.name}
            </MenuItem>
          ))}
        </MDInput>
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        <MDInput
          select
          value={line.baseId}
          onChange={(e) => onLineChange(line.id, "baseId", e.target.value)}
          fullWidth
          size="small"
          displayEmpty
          sx={receiptLineInputSx}
        >
          <MenuItem value="">
            <em>Select Base</em>
          </MenuItem>
          {bases.map((opt) => (
            <MenuItem key={opt.id} value={opt.id}>
              {opt.name}
            </MenuItem>
          ))}
        </MDInput>
      </MDBox>

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
          value={line.account || "Suspense"}
          onChange={(e) => onLineChange(line.id, "account", e.target.value)}
          fullWidth
          size="small"
          error={Boolean(errors[`line-${index}-account`])}
          sx={receiptLineInputSx}
        >
          {LINE_ACCOUNT_OPTIONS.map((name) => (
            <MenuItem key={name} value={name}>
              {name}
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
        <Tooltip title="Duplicate">
          <span>
            <IconButton
              size="small"
              color="secondary"
              disabled={saving}
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

ReceiptLineRow.propTypes = {
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
  line: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  errors: PropTypes.object,
  saving: PropTypes.bool,
  canDelete: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
};

export default function ReceiptLinesGrid({
  lines,
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
          <Tooltip title="Add line">
            <span>
              <IconButton
                color="info"
                size="small"
                disabled={saving}
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
                errors={errors}
                saving={saving}
                canDelete={lines.length > 1}
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
  errors: {},
  saving: false,
  grandTotal: 0,
  fillHeight: false,
};
