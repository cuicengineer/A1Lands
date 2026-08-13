import { useEffect } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Autocomplete from "@mui/material/Autocomplete";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDInput from "components/MDInput";
import {
  computePurchaseInvoiceLineTotal,
  findPurchaseInvoiceProductOption,
  formatPurchaseInvoiceGridNumber,
  getPurchaseInvoiceProductOptionLabel,
  resolveItemWithCodePurchaseAccHead,
  withSavedAccHeadOption,
} from "./purchaseInvoiceUtils";

const LINE_ACTION_BUTTON_SX = {
  p: 0,
  width: 18,
  height: 18,
  minWidth: 18,
  minHeight: 18,
};

const LINE_ACTION_ICON_SX = { fontSize: "0.85rem !important" };

const draftInputSx = {
  "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30 },
  "& .MuiInputBase-input": { py: 0.5, px: 0.75 },
};

const TABLE_COLUMNS = [
  { label: "Order", key: "sortOrder", align: "left", compact: true },
  { label: "Item with Code", key: "itemCode", align: "left" },
  { label: "Particular", key: "desc", align: "left", wide: true },
  { label: "Acc Head", key: "accHead", align: "left", wide: true },
  { label: "Qty", key: "months", align: "right", compact: true },
  { label: "Unit Price", key: "calculatedRentPM", align: "right", compact: true },
  { label: "Disc", key: "discountPercent", align: "center", compact: true },
  { label: "Total", key: "total", align: "right" },
];

const DATA_GRID_COLUMNS =
  "minmax(28px, 0.2fr) minmax(120px, 1.5fr) minmax(180px, 2fr) minmax(120px, 1.2fr) minmax(56px, 0.5fr) minmax(100px, 1fr) 52px minmax(100px, 0.9fr)";

const GRID_COLUMNS = `${DATA_GRID_COLUMNS} 88px`;
const GRID_COLUMNS_READONLY = DATA_GRID_COLUMNS;

function normalizeAccHeadKey(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function PurchaseInvoiceLineDraftRow({
  gridRowSx,
  bodyCellSx,
  draftForm,
  productOptions,
  accHeadOptions,
  onDraftFieldChange,
  onDraftItemServiceChange,
  onDraftAccHeadChange,
  onDraftIntegerFieldChange,
  onDraftNumericFieldChange,
  onDraftCancel,
  onDuplicateLine,
  hasIncompleteDrafts,
  saving,
  readOnly,
}) {
  const serviceOptions = productOptions || [];
  const selectedService = findPurchaseInvoiceProductOption(serviceOptions, draftForm.itemCode);
  const linkedAccHead = resolveItemWithCodePurchaseAccHead(selectedService);
  const currentAccHead = String(draftForm.accHead || linkedAccHead || "").trim();
  const accOptions = withSavedAccHeadOption(accHeadOptions, currentAccHead);
  const selectedAccHeadOption =
    accOptions.find(
      (option) => normalizeAccHeadKey(option.value) === normalizeAccHeadKey(currentAccHead)
    ) || null;
  const itemCodeOptions =
    selectedService || !String(draftForm.itemCode || "").trim()
      ? serviceOptions
      : [
          {
            id: `saved:${draftForm.itemCode}`,
            itemCode: String(draftForm.itemCode).trim(),
            itemName: "",
            uom: "",
            uomLabel: "",
            label: String(draftForm.itemCode).trim(),
          },
          ...serviceOptions,
        ];

  // Keep draft.accHead in sync when UI shows a linked Acc Head but the field was never written
  // (e.g. account not in Expenses-only options). Do not overwrite a manual Acc Head selection.
  useEffect(() => {
    if (!linkedAccHead) return;
    if (String(draftForm.accHead || "").trim()) return;
    onDraftFieldChange?.("accHead")?.({ target: { value: linkedAccHead } });
  }, [linkedAccHead, draftForm.accHead, onDraftFieldChange]);

  return (
    <MDBox
      sx={{
        ...gridRowSx,
        bgcolor: "rgba(25, 118, 210, 0.06)",
        "& > *": { borderBottom: "1px solid rgba(0,0,0,0.08)" },
      }}
    >
      <MDBox sx={{ ...bodyCellSx, px: 0.5, py: 0.5, textAlign: "left", fontWeight: 600 }}>
        {draftForm.sortOrder || "1"}
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "left", p: 0.5 }}>
        {readOnly ? (
          <MDTypography variant="caption" sx={{ fontSize: "0.8125rem" }}>
            {getPurchaseInvoiceProductOptionLabel(selectedService) || draftForm.itemCode || "—"}
          </MDTypography>
        ) : (
          <Autocomplete
            size="small"
            fullWidth
            options={itemCodeOptions}
            value={
              selectedService ||
              findPurchaseInvoiceProductOption(itemCodeOptions, draftForm.itemCode) ||
              null
            }
            getOptionLabel={getPurchaseInvoiceProductOptionLabel}
            isOptionEqualToValue={(a, b) =>
              String(a?.itemCode || "")
                .trim()
                .toUpperCase() ===
              String(b?.itemCode || "")
                .trim()
                .toUpperCase()
            }
            onChange={(_, newValue) => onDraftItemServiceChange?.(newValue)}
            renderOption={(props, option) => (
              <li {...props} key={option.id ?? option.itemCode}>
                <MDTypography
                  component="span"
                  variant="caption"
                  sx={{
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: "0.8125rem",
                  }}
                >
                  {getPurchaseInvoiceProductOptionLabel(option)}
                </MDTypography>
              </li>
            )}
            renderInput={(params) => (
              <MDInput {...params} placeholder="Item Code — Name — UoM" sx={draftInputSx} />
            )}
          />
        )}
      </MDBox>

      <MDBox
        sx={{ ...bodyCellSx, textAlign: "left", px: 0.5, py: 0.5, minWidth: 0, overflow: "hidden" }}
      >
        {readOnly ? (
          <MDTypography
            variant="caption"
            sx={{ fontSize: "0.8125rem" }}
            title={draftForm.desc || undefined}
          >
            {draftForm.desc || "—"}
          </MDTypography>
        ) : (
          <MDInput
            value={draftForm.desc ?? ""}
            onChange={onDraftFieldChange("desc")}
            fullWidth
            size="small"
            placeholder="Particular"
            title={draftForm.desc || undefined}
            sx={{
              ...draftInputSx,
              width: "100%",
              minWidth: 0,
              maxWidth: "100%",
              "& .MuiInputBase-root": {
                fontSize: "0.8125rem",
                minHeight: 30,
                width: "100%",
                maxWidth: "100%",
              },
              "& .MuiInputBase-input": {
                py: 0.5,
                px: 0.75,
                overflow: "hidden",
                textOverflow: "ellipsis",
              },
            }}
          />
        )}
      </MDBox>

      <MDBox
        sx={{ ...bodyCellSx, textAlign: "left", px: 0.5, py: 0.5, minWidth: 0, overflow: "hidden" }}
      >
        {readOnly ? (
          <MDTypography
            variant="caption"
            sx={{ fontSize: "0.8125rem" }}
            title={currentAccHead || undefined}
          >
            {currentAccHead || "—"}
          </MDTypography>
        ) : (
          <Autocomplete
            size="small"
            fullWidth
            options={accOptions}
            value={selectedAccHeadOption}
            getOptionLabel={(option) => String(option?.label || option?.value || "").trim()}
            isOptionEqualToValue={(a, b) =>
              normalizeAccHeadKey(a?.value ?? a) === normalizeAccHeadKey(b?.value ?? b)
            }
            onChange={(_, newValue) =>
              onDraftAccHeadChange?.(String(newValue?.value || newValue || "").trim())
            }
            renderOption={(props, option) => (
              <li {...props} key={option.value}>
                <MDTypography
                  component="span"
                  variant="caption"
                  sx={{
                    display: "block",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    fontSize: "0.8125rem",
                  }}
                  title={option.label}
                >
                  {option.label}
                </MDTypography>
              </li>
            )}
            renderInput={(params) => (
              <MDInput
                {...params}
                placeholder="Acc Head"
                title={currentAccHead || undefined}
                sx={draftInputSx}
              />
            )}
          />
        )}
      </MDBox>

      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "right",
          px: 0.5,
          py: 0.5,
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {readOnly ? (
          <MDTypography variant="caption" sx={{ fontSize: "0.8125rem" }}>
            {draftForm.months || "—"}
          </MDTypography>
        ) : (
          <MDInput
            value={draftForm.months ?? ""}
            onChange={onDraftIntegerFieldChange("months")}
            fullWidth
            size="small"
            placeholder="Qty"
            inputProps={{ inputMode: "text", pattern: "-?[0-9]*" }}
            sx={{
              ...draftInputSx,
              width: "100%",
              minWidth: 0,
              maxWidth: "100%",
              "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30, width: "100%" },
              "& .MuiInputBase-input": { py: 0.5, px: 0.5, textAlign: "right" },
            }}
          />
        )}
      </MDBox>

      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "right",
          px: 0.5,
          py: 0.5,
          minWidth: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "flex-end",
          gap: 0.5,
          overflow: "hidden",
        }}
      >
        {readOnly ? (
          <MDTypography variant="caption" sx={{ fontSize: "0.8125rem" }}>
            {draftForm.calculatedRentPM || "—"}
          </MDTypography>
        ) : (
          <MDInput
            value={draftForm.calculatedRentPM ?? ""}
            onChange={onDraftNumericFieldChange("calculatedRentPM")}
            size="small"
            placeholder="Unit Price"
            inputProps={{ inputMode: "decimal" }}
            sx={{
              ...draftInputSx,
              flex: "1 1 auto",
              width: "auto",
              minWidth: 0,
              maxWidth: "100%",
              "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30, width: "100%" },
              "& .MuiInputBase-input": { py: 0.5, px: 0.5, textAlign: "right" },
            }}
          />
        )}
        <MDTypography
          component="span"
          variant="caption"
          color="text"
          sx={{
            flex: "0 0 auto",
            maxWidth: "42%",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            fontSize: "0.75rem",
            lineHeight: 1.2,
            textAlign: "left",
          }}
          title={
            String(
              selectedService?.uomLabel || selectedService?.uom || draftForm.uomLabel || ""
            ).trim() || undefined
          }
        >
          {String(
            selectedService?.uomLabel ||
              selectedService?.uom ||
              draftForm.uomLabel ||
              draftForm.uom ||
              ""
          ).trim() || "—"}
        </MDTypography>
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "center", p: 0.5, minWidth: 0, overflow: "hidden" }}>
        {readOnly ? (
          <MDTypography variant="caption" sx={{ fontSize: "0.8125rem" }}>
            {draftForm.discountPercent || "0"}
          </MDTypography>
        ) : (
          <MDInput
            value={draftForm.discountPercent ?? ""}
            onChange={onDraftIntegerFieldChange("discountPercent")}
            fullWidth
            size="small"
            placeholder="Disc %"
            inputProps={{ inputMode: "numeric", pattern: "[0-9]*" }}
            sx={{
              ...draftInputSx,
              width: "100%",
              minWidth: 0,
              "& .MuiInputBase-root": { fontSize: "0.8125rem", minHeight: 30, width: "100%" },
              "& .MuiInputBase-input": { py: 0.5, px: 0.35, textAlign: "center" },
            }}
          />
        )}
      </MDBox>

      <MDBox
        sx={{
          ...bodyCellSx,
          textAlign: "right",
          fontVariantNumeric: "tabular-nums",
          fontWeight: 600,
          overflow: "visible",
          textOverflow: "clip",
          whiteSpace: "nowrap",
          px: 0.75,
        }}
      >
        {(() => {
          const totalVal = computePurchaseInvoiceLineTotal(
            draftForm.months,
            draftForm.calculatedRentPM,
            draftForm.discountPercent
          );
          return totalVal != null ? formatPurchaseInvoiceGridNumber(totalVal, true) : "—";
        })()}
      </MDBox>

      {!readOnly ? (
        <MDBox
          sx={{
            ...bodyCellSx,
            textAlign: "center",
            display: "flex",
            justifyContent: "center",
            gap: 0.15,
            px: 0.25,
          }}
        >
          <Tooltip title="Duplicate">
            <span>
              <IconButton
                size="small"
                color="secondary"
                disabled={saving || hasIncompleteDrafts}
                onClick={() => onDuplicateLine?.(draftForm)}
                sx={LINE_ACTION_BUTTON_SX}
              >
                <Icon sx={LINE_ACTION_ICON_SX}>content_copy</Icon>
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Cancel">
            <span>
              <IconButton
                size="small"
                color="secondary"
                disabled={saving}
                onClick={onDraftCancel}
                sx={LINE_ACTION_BUTTON_SX}
              >
                <Icon sx={LINE_ACTION_ICON_SX}>close</Icon>
              </IconButton>
            </span>
          </Tooltip>
        </MDBox>
      ) : null}
    </MDBox>
  );
}

PurchaseInvoiceLineDraftRow.propTypes = {
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
  draftForm: PropTypes.object.isRequired,
  productOptions: PropTypes.arrayOf(PropTypes.object),
  accHeadOptions: PropTypes.arrayOf(PropTypes.object),
  onDraftFieldChange: PropTypes.func.isRequired,
  onDraftItemServiceChange: PropTypes.func,
  onDraftAccHeadChange: PropTypes.func,
  onDraftIntegerFieldChange: PropTypes.func.isRequired,
  onDraftNumericFieldChange: PropTypes.func.isRequired,
  onDraftCancel: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func,
  hasIncompleteDrafts: PropTypes.bool,
  saving: PropTypes.bool,
  readOnly: PropTypes.bool,
};

PurchaseInvoiceLineDraftRow.defaultProps = {
  productOptions: [],
  accHeadOptions: [],
  onDraftItemServiceChange: undefined,
  onDraftAccHeadChange: undefined,
  onDuplicateLine: undefined,
  hasIncompleteDrafts: false,
  saving: false,
  readOnly: false,
};

export default function PurchaseInvoiceLinesGrid({
  lines,
  productOptions,
  accHeadOptions,
  saving,
  grandTotal,
  readOnly,
  hasIncompleteDrafts,
  onDraftFieldChange,
  onDraftItemServiceChange,
  onDraftAccHeadChange,
  onDraftIntegerFieldChange,
  onDraftNumericFieldChange,
  onDraftCancel,
  onDuplicateLine,
  onAddLine,
}) {
  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: readOnly ? GRID_COLUMNS_READONLY : GRID_COLUMNS,
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

  return (
    <MDBox>
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        mb={0.75}
        sx={{ flexWrap: "nowrap" }}
      >
        <MDTypography variant="button" fontWeight="bold" sx={{ whiteSpace: "nowrap" }}>
          Invoice Item records
        </MDTypography>
        <MDBox display="flex" alignItems="center" gap={1} sx={{ flexShrink: 0 }}>
          <MDTypography variant="button" fontWeight="medium">
            Total Amount: {formatPurchaseInvoiceGridNumber(grandTotal)}
          </MDTypography>
          {!readOnly ? (
            <Tooltip
              title={
                hasIncompleteDrafts
                  ? "Complete all fields in the current row(s) before adding another"
                  : "Add invoice record"
              }
            >
              <span>
                <IconButton
                  color="info"
                  size="small"
                  disabled={saving || hasIncompleteDrafts}
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
        <MDBox
          sx={{
            maxHeight: "calc(88vh - 280px)",
            overflowX: "hidden",
            overflowY: "auto",
            minWidth: 0,
          }}
        >
          <MDBox sx={{ width: "100%" }}>
            <MDBox sx={gridRowSx}>
              {TABLE_COLUMNS.map((col) => (
                <MDBox
                  key={col.key}
                  sx={{
                    ...headerCellSx,
                    textAlign: col.align || "left",
                    ...(col.compact ? { px: 0.5, py: 0.5 } : {}),
                  }}
                >
                  {col.label}
                </MDBox>
              ))}
              {!readOnly ? (
                <MDBox sx={{ ...headerCellSx, textAlign: "center" }}>Action</MDBox>
              ) : null}
            </MDBox>

            {(lines || []).length === 0 ? (
              <MDTypography
                variant="caption"
                color="text"
                display="block"
                textAlign="center"
                py={2}
              >
                No records found. Click + to add a line item.
              </MDTypography>
            ) : (
              (lines || []).map((draftForm) => (
                <PurchaseInvoiceLineDraftRow
                  key={draftForm.__draftId || draftForm.id}
                  gridRowSx={gridRowSx}
                  bodyCellSx={bodyCellSx}
                  draftForm={draftForm}
                  productOptions={productOptions}
                  accHeadOptions={accHeadOptions}
                  onDraftFieldChange={onDraftFieldChange(draftForm.__draftId || draftForm.id)}
                  onDraftItemServiceChange={onDraftItemServiceChange?.(
                    draftForm.__draftId || draftForm.id
                  )}
                  onDraftAccHeadChange={onDraftAccHeadChange?.(draftForm.__draftId || draftForm.id)}
                  onDraftIntegerFieldChange={onDraftIntegerFieldChange(
                    draftForm.__draftId || draftForm.id
                  )}
                  onDraftNumericFieldChange={onDraftNumericFieldChange(
                    draftForm.__draftId || draftForm.id
                  )}
                  onDraftCancel={() => onDraftCancel?.(draftForm.__draftId || draftForm.id)}
                  onDuplicateLine={onDuplicateLine}
                  hasIncompleteDrafts={hasIncompleteDrafts}
                  saving={saving}
                  readOnly={readOnly}
                />
              ))
            )}
          </MDBox>
        </MDBox>
      </MDBox>
    </MDBox>
  );
}

PurchaseInvoiceLinesGrid.propTypes = {
  lines: PropTypes.arrayOf(PropTypes.object),
  productOptions: PropTypes.arrayOf(PropTypes.object),
  accHeadOptions: PropTypes.arrayOf(PropTypes.object),
  saving: PropTypes.bool,
  grandTotal: PropTypes.number,
  readOnly: PropTypes.bool,
  hasIncompleteDrafts: PropTypes.bool,
  onDraftFieldChange: PropTypes.func.isRequired,
  onDraftItemServiceChange: PropTypes.func,
  onDraftAccHeadChange: PropTypes.func,
  onDraftIntegerFieldChange: PropTypes.func.isRequired,
  onDraftNumericFieldChange: PropTypes.func.isRequired,
  onDraftCancel: PropTypes.func.isRequired,
  onDuplicateLine: PropTypes.func,
  onAddLine: PropTypes.func.isRequired,
};

PurchaseInvoiceLinesGrid.defaultProps = {
  lines: [],
  productOptions: [],
  accHeadOptions: [],
  saving: false,
  grandTotal: 0,
  readOnly: false,
  hasIncompleteDrafts: false,
  onDraftItemServiceChange: undefined,
  onDraftAccHeadChange: undefined,
  onDuplicateLine: undefined,
};
