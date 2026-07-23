import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import CurrencyLoading from "components/CurrencyLoading";
import PurchaseInvoiceLinesGrid from "./PurchaseInvoiceLinesGrid";
import {
  buildPurchaseInvoiceFormState,
  computeNextPurchaseInvoicePiNo,
  computePurchaseInvoiceGrandTotal,
  computePurchaseInvoiceLineTotal,
  createEmptyPurchaseInvoiceLineDraft,
  createNewLineDraftId,
  fetchPurchaseInvoicePiNos,
  findPurchaseInvoiceProductByAccHead,
  getFirstIncompletePurchaseInvoiceDraftError,
  getPurchaseInvoiceLineEffectiveAccHead,
  getPurchaseInvoiceYearFromDate,
  isPurchaseInvoiceLineDraftEmpty,
  loadPurchaseInvoiceFormCatalogs,
  normalizePurchaseInvoiceLine,
  PURCHASE_INVOICE_PI_NO_PREFIX,
  resolveItemWithCodePurchaseAccHead,
  sanitizeDecimalNumericInputValue,
  sanitizeIntegerInputValue,
  sanitizeSignedIntegerInputValue,
  suggestNextPurchaseInvoiceSortOrder,
  validatePurchaseInvoiceForm,
} from "./purchaseInvoiceUtils";
import purchaseInvoicesApi from "services/api.purchaseInvoices.service";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
};

const readOnlyPiNoFieldSx = {
  ...textFieldSx,
  "& .MuiInputBase-root": {
    ...textFieldSx["& .MuiInputBase-root"],
    bgcolor: "rgba(0,0,0,0.04)",
  },
};

export default function PurchaseInvoiceForm({
  open,
  onClose,
  onSubmit,
  initialData,
  labels,
  readOnly,
}) {
  const isEditMode = Boolean(initialData?.id);
  const [form, setForm] = useState(() => buildPurchaseInvoiceFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);
  const [productOptions, setProductOptions] = useState([]);
  const [accHeadOptions, setAccHeadOptions] = useState([]);
  const [existingPiNos, setExistingPiNos] = useState([]);
  const [piNosLoaded, setPiNosLoaded] = useState(false);

  const grandTotal = useMemo(() => computePurchaseInvoiceGrandTotal(form.lines), [form.lines]);

  const hasIncompleteDrafts = useMemo(() => {
    const lines = form.lines || [];
    if (!lines.length) return false;
    return Boolean(getFirstIncompletePurchaseInvoiceDraftError(lines, productOptions));
  }, [form.lines, productOptions]);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;

    const hydrate = async () => {
      setLoadingCatalogs(true);
      setErrors({});
      try {
        const [catalogs, piNos] = await Promise.all([
          loadPurchaseInvoiceFormCatalogs(),
          isEditMode || readOnly
            ? Promise.resolve([])
            : fetchPurchaseInvoicePiNos(purchaseInvoicesApi).catch(() => []),
        ]);
        if (cancelled) return;
        setProductOptions(catalogs.productOptions || []);
        setAccHeadOptions(catalogs.accHeadOptions || []);
        setExistingPiNos(piNos);
        setPiNosLoaded(true);

        if (initialData?.id) {
          setForm(
            buildPurchaseInvoiceFormState({
              ...initialData,
              lines: (initialData.lines || []).map(normalizePurchaseInvoiceLine),
            })
          );
        } else {
          const date = new Date().toISOString().slice(0, 10);
          const piNo = computeNextPurchaseInvoicePiNo(piNos, date);
          setForm(
            buildPurchaseInvoiceFormState({
              date,
              piNo,
              lines: [],
            })
          );
        }
      } catch (error) {
        console.error("Failed to load purchase invoice catalogs:", error);
        if (!cancelled) {
          setProductOptions([]);
          setAccHeadOptions([]);
        }
      } finally {
        if (!cancelled) setLoadingCatalogs(false);
      }
    };

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [open, initialData, isEditMode, readOnly]);

  useEffect(() => {
    if (!open || isEditMode || readOnly || !piNosLoaded) return;
    setForm((prev) => {
      const nextPiNo = computeNextPurchaseInvoicePiNo(existingPiNos, prev.date);
      if (prev.piNo === nextPiNo) return prev;
      return { ...prev, piNo: nextPiNo };
    });
  }, [form.date, existingPiNos, open, isEditMode, readOnly, piNosLoaded]);

  const updateHeader = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const updateDraftById = useCallback((draftId, updater) => {
    setForm((prev) => ({
      ...prev,
      lines: (prev.lines || []).map((line) =>
        (line.__draftId || line.id) === draftId ? updater(line) : line
      ),
    }));
  }, []);

  const recalcDraftTotal = (draft) => {
    const totalVal = computePurchaseInvoiceLineTotal(
      draft.months,
      draft.calculatedRentPM,
      draft.discountPercent
    );
    return {
      ...draft,
      total: totalVal != null ? String(totalVal) : "",
    };
  };

  const handleDraftFieldChange = (draftId) => (field) => (e) => {
    updateDraftById(draftId, (prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleDraftItemServiceChange = (draftId) => (service) => {
    updateDraftById(draftId, (prev) => {
      if (!service) {
        return { ...prev, itemCode: "", accHead: "" };
      }
      const nextUnitPrice =
        service.defaultUnitPricePurchase !== "" && service.defaultUnitPricePurchase != null
          ? String(service.defaultUnitPricePurchase)
          : prev.calculatedRentPM;
      const nextDesc =
        String(service.defaultParticulars || "").trim() ||
        String(service.itemName || "").trim() ||
        prev.desc;
      const linkedAccHead = resolveItemWithCodePurchaseAccHead(service);
      return recalcDraftTotal({
        ...prev,
        itemCode: String(service.itemCode || "").trim(),
        desc: nextDesc,
        // Always persist the item's purchase Acc Head so validation sees it
        // (UI may already show linked Acc Head even when it is not in Expenses options).
        accHead: linkedAccHead || prev.accHead || "",
        calculatedRentPM: nextUnitPrice,
        uom: String(service.uom || "").trim(),
        uomLabel: String(service.uomLabel || service.uom || "").trim(),
      });
    });
  };

  const handleDraftAccHeadChange = (draftId) => (accHeadValue) => {
    const nextAccHead = String(accHeadValue || "").trim();
    if (!nextAccHead) {
      updateDraftById(draftId, (prev) => ({ ...prev, accHead: "", itemCode: "" }));
      return;
    }

    updateDraftById(draftId, (prev) => {
      const matched = findPurchaseInvoiceProductByAccHead(
        productOptions,
        nextAccHead,
        prev.itemCode
      );
      if (!matched) {
        return { ...prev, accHead: nextAccHead };
      }
      const nextUnitPrice =
        matched.defaultUnitPricePurchase !== "" && matched.defaultUnitPricePurchase != null
          ? String(matched.defaultUnitPricePurchase)
          : prev.calculatedRentPM;
      const nextDesc =
        String(matched.defaultParticulars || "").trim() ||
        String(matched.itemName || "").trim() ||
        prev.desc;
      return recalcDraftTotal({
        ...prev,
        accHead: nextAccHead,
        itemCode: String(matched.itemCode || "").trim(),
        desc: nextDesc,
        calculatedRentPM: nextUnitPrice,
        uom: String(matched.uom || "").trim(),
        uomLabel: String(matched.uomLabel || matched.uom || "").trim(),
      });
    });
  };

  const handleDraftIntegerFieldChange = (draftId) => (field) => (e) => {
    const value =
      field === "months"
        ? sanitizeSignedIntegerInputValue(e.target.value)
        : sanitizeIntegerInputValue(e.target.value);
    updateDraftById(draftId, (prev) => recalcDraftTotal({ ...prev, [field]: value }));
  };

  const handleDraftNumericFieldChange = (draftId) => (field) => (e) => {
    const value = sanitizeDecimalNumericInputValue(e.target.value);
    updateDraftById(draftId, (prev) => recalcDraftTotal({ ...prev, [field]: value }));
  };

  const handleDraftCancel = (draftId) => {
    if (saving) return;
    setForm((prev) => ({
      ...prev,
      lines: (prev.lines || []).filter((line) => (line.__draftId || line.id) !== draftId),
    }));
  };

  const handleAddLine = () => {
    if (saving || readOnly) return;
    const incompleteErr = getFirstIncompletePurchaseInvoiceDraftError(form.lines, productOptions);
    if (incompleteErr) {
      window.alert(incompleteErr);
      return;
    }
    setForm((prev) => ({
      ...prev,
      lines: [
        ...(prev.lines || []),
        createEmptyPurchaseInvoiceLineDraft({
          sortOrder: suggestNextPurchaseInvoiceSortOrder(prev.lines),
        }),
      ],
    }));
    setErrors((prev) => {
      if (!prev.lines) return prev;
      const next = { ...prev };
      delete next.lines;
      return next;
    });
  };

  const handleDuplicateLine = (sourceLine) => {
    if (saving || readOnly || !sourceLine) return;
    const incompleteErr = getFirstIncompletePurchaseInvoiceDraftError(form.lines, productOptions);
    if (incompleteErr) {
      window.alert(incompleteErr);
      return;
    }
    setForm((prev) => ({
      ...prev,
      lines: [
        ...(prev.lines || []),
        recalcDraftTotal({
          ...normalizePurchaseInvoiceLine(sourceLine),
          __draftId: createNewLineDraftId(),
          id: createNewLineDraftId(),
          sortOrder: suggestNextPurchaseInvoiceSortOrder(prev.lines),
        }),
      ],
    }));
  };

  const handleSave = async () => {
    let formToSave = form;
    if (!isEditMode) {
      try {
        const freshPiNos = await fetchPurchaseInvoicePiNos(purchaseInvoicesApi);
        const nextPiNo = computeNextPurchaseInvoicePiNo(freshPiNos, form.date);
        formToSave = { ...form, piNo: nextPiNo };
        setExistingPiNos(freshPiNos);
        setForm((prev) => ({ ...prev, piNo: nextPiNo }));
      } catch (error) {
        console.error("Failed to refresh PI Nos before save:", error);
      }
    }

    const validationErrors = validatePurchaseInvoiceForm(formToSave, productOptions);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length) return;

    setSaving(true);
    try {
      const result = await onSubmit?.({
        ...formToSave,
        lines: (formToSave.lines || [])
          .filter((line) => !isPurchaseInvoiceLineDraftEmpty(line))
          .map((line) => {
            const normalized = normalizePurchaseInvoiceLine(line);
            return {
              ...normalized,
              accHead:
                normalized.accHead || getPurchaseInvoiceLineEffectiveAccHead(line, productOptions),
            };
          }),
        grandTotal: computePurchaseInvoiceGrandTotal(formToSave.lines),
      });
      if (result !== false) onClose?.();
    } catch (error) {
      console.error("Failed to save purchase invoice:", error);
      window.alert(error?.message || "Failed to save purchase invoice.");
    } finally {
      setSaving(false);
    }
  };

  const formTitle = initialData?.id ? labels.editFormTitle : labels.addFormTitle;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{formTitle}</DialogTitle>
      <DialogContent dividers>
        {loadingCatalogs ? (
          <MDBox display="flex" justifyContent="center" py={4}>
            <CurrencyLoading size={36} />
          </MDBox>
        ) : (
          <>
            <Grid container spacing={2} sx={{ mb: 2 }}>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  type="date"
                  label="Date"
                  value={form.date || ""}
                  onChange={(e) => updateHeader("date", e.target.value)}
                  disabled={readOnly || saving}
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  error={Boolean(errors.date)}
                  helperText={errors.date}
                  sx={textFieldSx}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <TextField
                  fullWidth
                  label="PI No"
                  value={form.piNo}
                  disabled
                  size="small"
                  InputLabelProps={{ shrink: true }}
                  InputProps={{ readOnly: true }}
                  placeholder={`${PURCHASE_INVOICE_PI_NO_PREFIX}-1/${getPurchaseInvoiceYearFromDate(
                    form.date
                  )}`}
                  error={Boolean(errors.piNo)}
                  helperText={errors.piNo}
                  sx={isEditMode || readOnly ? textFieldSx : readOnlyPiNoFieldSx}
                />
              </Grid>
              <Grid item xs={12} md={6}>
                <TextField
                  fullWidth
                  label="Description"
                  value={form.description}
                  onChange={(e) => updateHeader("description", e.target.value)}
                  disabled={readOnly || saving}
                  size="small"
                  placeholder="Optional"
                  InputLabelProps={{ shrink: true }}
                  sx={textFieldSx}
                />
              </Grid>
            </Grid>

            <MDBox sx={{ mb: 1 }}>
              <PurchaseInvoiceLinesGrid
                lines={form.lines}
                productOptions={productOptions}
                accHeadOptions={accHeadOptions}
                saving={saving}
                grandTotal={grandTotal}
                readOnly={readOnly}
                hasIncompleteDrafts={hasIncompleteDrafts}
                onDraftFieldChange={handleDraftFieldChange}
                onDraftItemServiceChange={handleDraftItemServiceChange}
                onDraftAccHeadChange={handleDraftAccHeadChange}
                onDraftIntegerFieldChange={handleDraftIntegerFieldChange}
                onDraftNumericFieldChange={handleDraftNumericFieldChange}
                onDraftCancel={handleDraftCancel}
                onDuplicateLine={handleDuplicateLine}
                onAddLine={handleAddLine}
              />
              {errors.lines ? (
                <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
                  {errors.lines}
                </Typography>
              ) : null}
            </MDBox>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <MDButton variant="outlined" color="secondary" onClick={onClose} disabled={saving}>
          {readOnly ? "Close" : "Cancel"}
        </MDButton>
        {!readOnly ? (
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            disabled={saving || loadingCatalogs}
          >
            {saving ? "Saving…" : "Save"}
          </MDButton>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

PurchaseInvoiceForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
  labels: PropTypes.object.isRequired,
  readOnly: PropTypes.bool,
};

PurchaseInvoiceForm.defaultProps = {
  onSubmit: undefined,
  initialData: null,
  readOnly: false,
};
