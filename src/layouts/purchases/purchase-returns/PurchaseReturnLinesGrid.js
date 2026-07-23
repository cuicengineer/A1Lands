import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import MenuItem from "@mui/material/MenuItem";
import FormControl from "@mui/material/FormControl";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import SearchableSelect from "components/SearchableSelect";
import MDInput from "components/MDInput";
import {
  computePurchaseReturnLineAmount,
  findPurchaseReturnAccountOption,
  findPurchaseReturnCapitalOption,
  formatAmount,
  isPurchaseReturnLineComplete,
} from "./purchaseReturnUtils";

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

const COLUMNS = [
  { label: "#", key: "sno", align: "right" },
  { label: "Item", key: "item", align: "left" },
  { label: "Account", key: "account", align: "left" },
  { label: "Capital", key: "capital", align: "left" },
  { label: "Particulars", key: "particulars", align: "left" },
  { label: "Qty", key: "quantity", align: "right" },
  { label: "Unit Price", key: "unitPrice", align: "right" },
  { label: "Disc %", key: "discount", align: "right" },
  { label: "Amount", key: "amount", align: "right" },
];

const GRID_TEMPLATE = [
  "28px",
  "minmax(120px, 1fr)",
  "minmax(130px, 1.05fr)",
  "minmax(110px, 0.9fr)",
  "minmax(130px, 1.05fr)",
  "minmax(52px, 0.45fr)",
  "minmax(72px, 0.55fr)",
  "minmax(48px, 0.42fr)",
  "minmax(72px, 0.55fr)",
  "64px",
].join(" ");

function PurchaseReturnLineRow({
  gridRowSx,
  bodyCellSx,
  line,
  index,
  productOptions,
  accountOptions,
  capitalOptions,
  readOnly,
  errors,
  onLineChange,
  onDuplicateLine,
  onDeleteLine,
}) {
  const lineAmount = computePurchaseReturnLineAmount(line);
  const selectedAccount = findPurchaseReturnAccountOption(accountOptions, line);
  const selectedCapital = findPurchaseReturnCapitalOption(capitalOptions, line);
  const accountSelectValue = selectedAccount?.value || line.accountKey || line.accountCoaId || "";
  const capitalSelectValue = selectedCapital?.value || line.capitalKey || line.capital || "";

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
        <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-item`])}>
          <SearchableSelect
            value={line.productKey || ""}
            onChange={(e) => onLineChange(line.id, "productKey", e.target.value)}
            fullWidth
            size="small"
            displayEmpty
            disabled={readOnly}
            renderValue={(selected) => {
              if (!selected) return "";
              const option = (productOptions || []).find((row) => row.value === selected);
              return option?.label || line.item || selected;
            }}
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

      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-account`])}>
          <SearchableSelect
            value={accountSelectValue}
            onChange={(e) => onLineChange(line.id, "accountKey", e.target.value)}
            fullWidth
            size="small"
            displayEmpty
            disabled={readOnly}
            renderValue={(selected) => {
              if (!selected) return "";
              const option = findPurchaseReturnAccountOption(accountOptions, selected);
              return option?.label || line.account || selected;
            }}
            sx={lineInputSx}
          >
            <MenuItem value="">
              <em>Select Account</em>
            </MenuItem>
            {(accountOptions || []).map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </SearchableSelect>
        </FormControl>
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        <FormControl fullWidth size="small" error={Boolean(errors[`line-${index}-capital`])}>
          <SearchableSelect
            value={capitalSelectValue}
            onChange={(e) => onLineChange(line.id, "capitalKey", e.target.value)}
            fullWidth
            size="small"
            displayEmpty
            disabled={readOnly}
            renderValue={(selected) => {
              if (!selected) return "";
              const option = findPurchaseReturnCapitalOption(capitalOptions, selected);
              return option?.label || line.capital || selected;
            }}
            sx={lineInputSx}
          >
            <MenuItem value="">
              <em>Select Capital</em>
            </MenuItem>
            {(capitalOptions || []).map((option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ))}
          </SearchableSelect>
        </FormControl>
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "left" }}>
        <MDInput
          value={line.particulars || ""}
          onChange={(e) => onLineChange(line.id, "particulars", e.target.value)}
          fullWidth
          size="small"
          disabled={readOnly}
          placeholder="Particulars"
          sx={lineInputSx}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
        <MDInput
          value={line.quantity ?? ""}
          onChange={(e) => onLineChange(line.id, "quantity", e.target.value)}
          fullWidth
          size="small"
          disabled={readOnly}
          inputProps={{ inputMode: "decimal" }}
          error={Boolean(errors[`line-${index}-quantity`])}
          sx={lineInputSx}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
        <MDInput
          value={line.unitPrice ?? ""}
          onChange={(e) => onLineChange(line.id, "unitPrice", e.target.value)}
          fullWidth
          size="small"
          disabled={readOnly}
          inputProps={{ inputMode: "decimal" }}
          error={Boolean(errors[`line-${index}-unitPrice`])}
          sx={lineInputSx}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right" }}>
        <MDInput
          value={line.discount ?? ""}
          onChange={(e) => onLineChange(line.id, "discount", e.target.value)}
          fullWidth
          size="small"
          disabled={readOnly}
          inputProps={{ inputMode: "decimal" }}
          sx={lineInputSx}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right", fontWeight: 600 }}>
        {formatAmount(lineAmount)}
      </MDBox>

      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "center",
          display: "flex",
          gap: 0.25,
          justifyContent: "center",
        }}
      >
        <Tooltip title="Duplicate line">
          <span>
            <IconButton
              size="small"
              color="info"
              disabled={readOnly}
              onClick={() => onDuplicateLine(line.id)}
              sx={{ p: 0.25 }}
            >
              <Icon sx={{ fontSize: "0.95rem !important" }}>content_copy</Icon>
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Delete line">
          <span>
            <IconButton
              size="small"
              color="error"
              disabled={readOnly}
              onClick={() => onDeleteLine(line.id)}
              sx={{ p: 0.25 }}
            >
              <Icon sx={{ fontSize: "0.95rem !important" }}>delete</Icon>
            </IconButton>
          </span>
        </Tooltip>
      </MDBox>
    </MDBox>
  );
}

PurchaseReturnLineRow.propTypes = {
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
  line: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  productOptions: PropTypes.array,
  accountOptions: PropTypes.array,
  capitalOptions: PropTypes.array,
  readOnly: PropTypes.bool,
  errors: PropTypes.object,
  onLineChange: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
};

PurchaseReturnLineRow.defaultProps = {
  productOptions: [],
  accountOptions: [],
  capitalOptions: [],
  readOnly: false,
  errors: {},
};

export default function PurchaseReturnLinesGrid({
  lines,
  productOptions,
  accountOptions,
  capitalOptions,
  errors,
  saving,
  grandTotal,
  readOnly,
  onLineChange,
  onAddLine,
  onDuplicateLine,
  onDeleteLine,
}) {
  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: GRID_TEMPLATE,
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

  const canAddLine =
    !readOnly &&
    !saving &&
    (lines.length === 0 || lines.every((line) => isPurchaseReturnLineComplete(line)));

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
        <MDBox display="flex" alignItems="center" gap={1}>
          <MDTypography variant="caption" fontWeight="bold" sx={{ whiteSpace: "nowrap" }}>
            Total: {formatAmount(grandTotal)}
          </MDTypography>
          {!readOnly ? (
            <Tooltip
              title={canAddLine ? "Add line" : "Complete all rows before adding another line"}
            >
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

      <MDBox sx={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 1, overflow: "hidden" }}>
        <MDBox sx={{ maxHeight: 280, overflow: "auto" }}>
          <MDBox sx={{ minWidth: "max-content" }}>
            <MDBox sx={{ ...gridRowSx, position: "sticky", top: 0, zIndex: 2 }}>
              {COLUMNS.map((col) => (
                <MDBox
                  key={col.key}
                  sx={{ ...headerCellSx, textAlign: col.align === "right" ? "right" : "left" }}
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
                Click add to create a line item row.
              </MDTypography>
            ) : (
              lines.map((line, index) => (
                <PurchaseReturnLineRow
                  key={line.id}
                  gridRowSx={gridRowSx}
                  bodyCellSx={bodyCellSx}
                  line={line}
                  index={index}
                  productOptions={productOptions}
                  accountOptions={accountOptions}
                  capitalOptions={capitalOptions}
                  readOnly={readOnly}
                  errors={errors}
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

PurchaseReturnLinesGrid.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.object).isRequired,
  productOptions: PropTypes.array,
  accountOptions: PropTypes.array,
  capitalOptions: PropTypes.array,
  errors: PropTypes.object,
  saving: PropTypes.bool,
  grandTotal: PropTypes.number,
  readOnly: PropTypes.bool,
  onLineChange: PropTypes.func.isRequired,
  onAddLine: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func.isRequired,
  onDeleteLine: PropTypes.func.isRequired,
};

PurchaseReturnLinesGrid.defaultProps = {
  productOptions: [],
  accountOptions: [],
  capitalOptions: [],
  errors: {},
  saving: false,
  grandTotal: 0,
  readOnly: false,
};
