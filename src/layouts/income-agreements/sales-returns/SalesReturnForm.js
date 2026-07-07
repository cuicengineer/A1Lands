import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import TextField from "@mui/material/TextField";
import FormControl from "@mui/material/FormControl";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import Typography from "@mui/material/Typography";
import Icon from "@mui/material/Icon";
import Chip from "@mui/material/Chip";
import MDBox from "components/MDBox";
import MDButton from "components/MDButton";
import SearchableSelect from "components/SearchableSelect";
import CurrencyLoading from "components/CurrencyLoading";
import uploadApi from "services/api.upload.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import contractApi from "services/api.contract.service";
import customerApi from "services/api.customer.service";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import api from "services/api.service";
import salesReturnsApi from "services/api.salesReturns.service";
import {
  normalizeCatalogRow,
  parseInvoiceKey,
} from "layouts/income-agreements/collections/collectionsUtils";
import {
  buildLineAccountOptions,
  MAX_ATTACHMENT_FILES,
} from "layouts/accounts/receipts/receiptUtils";
import { SALES_RETURNS_LABELS } from "layouts/income-agreements/transactionLabels";
import SalesReturnLinesGrid from "./SalesReturnLinesGrid";
import {
  fetchSalesReturnUploadedFiles,
  SALES_RETURN_ATTACHMENT_MAX_BYTES,
  uploadSalesReturnAttachments,
} from "./salesReturnAttachmentUtils";
import {
  applySalesReturnProductSelection,
  buildSalesReturnContractCustomerOptions,
  buildSalesReturnFormState,
  computeNextSalesReturnVrNo,
  computeSalesReturnGrandTotal,
  createSalesReturnLineRow,
  fetchSalesReturnLinesFromInvoice,
  fetchSalesReturnProductOptions,
  fetchSalesReturnVrNos,
  findSalesReturnContractCustomerOption,
  findSalesReturnInvoiceRowByKey,
  formatSalesReturnInvoiceOption,
  getSalesReturnInvoicesForSelection,
  getSalesReturnYearFromDate,
  SALES_RETURN_VR_NO_PREFIX,
  syncSalesReturnLineAmount,
  validateSalesReturnForm,
} from "./salesReturnUtils";

const textFieldSx = {
  "& .MuiInputBase-root": { minHeight: 40 },
  "& .MuiInputLabel-root": { top: 0 },
};

function SalesReturnDateField({ value, onChange, disabled, readOnly, error, helperText }) {
  const inputRef = useRef(null);
  const dateValue = value || "";

  const openPicker = () => {
    if (disabled || readOnly) return;
    if (inputRef.current?.showPicker) {
      inputRef.current.showPicker();
      return;
    }
    inputRef.current?.click();
  };

  if (readOnly) {
    return (
      <TextField
        fullWidth
        label="Date"
        value={dateValue ? formatDateDDMMMYYYY(dateValue) : ""}
        disabled
        size="small"
        InputLabelProps={{ shrink: true }}
        sx={textFieldSx}
      />
    );
  }

  return (
    <MDBox sx={{ position: "relative" }}>
      <input
        ref={inputRef}
        type="date"
        value={dateValue}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        style={{
          position: "absolute",
          opacity: 0,
          width: "100%",
          height: "100%",
          top: 0,
          left: 0,
          cursor: disabled ? "default" : "pointer",
        }}
      />
      <TextField
        fullWidth
        label="Date"
        value={dateValue ? formatDateDDMMMYYYY(dateValue) : ""}
        onClick={openPicker}
        InputProps={{ readOnly: true }}
        disabled={disabled}
        size="small"
        placeholder="dd-MMM-yyyy"
        InputLabelProps={{ shrink: true }}
        error={Boolean(error)}
        helperText={helperText}
        sx={{
          ...textFieldSx,
          "& .MuiInputBase-input": { cursor: disabled ? "default" : "pointer" },
        }}
      />
    </MDBox>
  );
}

SalesReturnDateField.propTypes = {
  value: PropTypes.string,
  onChange: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  readOnly: PropTypes.bool,
  error: PropTypes.bool,
  helperText: PropTypes.string,
};

SalesReturnDateField.defaultProps = {
  value: "",
  disabled: false,
  readOnly: false,
  error: false,
  helperText: "",
};

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  return [];
}

export default function SalesReturnForm({
  open,
  onClose,
  onSubmit,
  initialData,
  labels = SALES_RETURNS_LABELS,
  readOnly = false,
  onUploadSuccess,
}) {
  const [form, setForm] = useState(() => buildSalesReturnFormState());
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [existingFiles, setExistingFiles] = useState([]);
  const [loadingExistingFiles, setLoadingExistingFiles] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [contractCustomerOptions, setContractCustomerOptions] = useState([]);
  const [invoiceRows, setInvoiceRows] = useState([]);
  const [productOptions, setProductOptions] = useState([]);
  const [accountOptions, setAccountOptions] = useState([]);
  const [loadingInvoiceLines, setLoadingInvoiceLines] = useState(false);
  const [existingVrNos, setExistingVrNos] = useState([]);
  const [vrNosLoaded, setVrNosLoaded] = useState(false);
  const fileInputRef = useRef(null);
  const isEditMode = Boolean(initialData?.id);
  const lockContractAndInvoice = Boolean(initialData?.lockContractAndInvoice);

  const fetchExistingFiles = useCallback(async (id) => {
    if (id == null) return;
    setLoadingExistingFiles(true);
    try {
      const files = await fetchSalesReturnUploadedFiles(id);
      setExistingFiles(files);
    } catch (error) {
      console.error("Error fetching sales return attachments:", error);
      setExistingFiles([]);
    } finally {
      setLoadingExistingFiles(false);
    }
  }, []);

  const invoiceOptions = useMemo(() => {
    const selected = findSalesReturnContractCustomerOption(
      contractCustomerOptions,
      form.contractCustomerKey
    );
    return getSalesReturnInvoicesForSelection(invoiceRows, selected, {
      includeInvoiceKey: form.invoiceKey,
    }).map(formatSalesReturnInvoiceOption);
  }, [contractCustomerOptions, form.contractCustomerKey, form.invoiceKey, invoiceRows]);

  const grandTotal = useMemo(() => computeSalesReturnGrandTotal(form.lines), [form.lines]);

  const showLinesGrid = Boolean(form.invoiceKey);

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;

    const loadCatalogs = async () => {
      try {
        const [contractRes, tenantRes, customerRes, invoiceRes, coaRes, productRes] =
          await Promise.allSettled([
            contractApi.getAllRecords(),
            api.list("tenant"),
            customerApi.listCustomers(),
            contractApi.getAllInvoiceScheduleRecords(),
            chartOfAccountsApi.getAll(COA_SECTION_TYPE),
            fetchSalesReturnProductOptions(),
          ]);

        const contractResponse =
          contractRes.status === "fulfilled" ? contractRes.value : { data: [] };
        const contracts = unwrapList(contractResponse?.data ?? contractResponse);
        const tenants =
          tenantRes.status === "fulfilled"
            ? unwrapList(tenantRes.value).map(normalizeCatalogRow)
            : [];

        const customers =
          customerRes.status === "fulfilled" ? customerApi.unwrapList(customerRes.value) : [];
        const invoices =
          invoiceRes.status === "fulfilled"
            ? unwrapList(invoiceRes.value?.data ?? invoiceRes.value)
            : [];
        const coaRows =
          coaRes.status === "fulfilled" ? chartOfAccountsApi.unwrapList(coaRes.value) : [];
        const products = productRes.status === "fulfilled" ? productRes.value : [];

        if (!cancelled) {
          setContractCustomerOptions(
            buildSalesReturnContractCustomerOptions(contracts, tenants, customers)
          );
          setInvoiceRows(invoices);
          setAccountOptions(buildLineAccountOptions(coaRows));
          setProductOptions(products);
        }
      } catch (error) {
        console.error("Error loading sales return catalogs:", error);
        if (!cancelled) {
          setContractCustomerOptions([]);
          setInvoiceRows([]);
          setAccountOptions([]);
          setProductOptions([]);
        }
      }
    };

    loadCatalogs();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (initialData) {
      const { lockContractAndInvoice: _lockContractAndInvoice, ...formInitial } = initialData;
      setForm(
        buildSalesReturnFormState({
          ...formInitial,
          lines: Array.isArray(formInitial.lines)
            ? formInitial.lines.map((line) =>
                syncSalesReturnLineAmount({ ...createSalesReturnLineRow(), ...line })
              )
            : [],
        })
      );
    } else {
      setForm(buildSalesReturnFormState());
    }
    setErrors({});
    setSelectedFiles([]);
    if (initialData?.id) {
      fetchExistingFiles(initialData.id);
    } else {
      setExistingFiles([]);
    }
  }, [open, initialData, fetchExistingFiles]);

  useEffect(() => {
    if (!open) {
      setExistingVrNos([]);
      setVrNosLoaded(false);
      return undefined;
    }
    if (isEditMode) return undefined;

    let cancelled = false;

    const loadExistingVrNos = async () => {
      try {
        const vrNos = await fetchSalesReturnVrNos(salesReturnsApi);
        if (!cancelled) {
          setExistingVrNos(vrNos);
          setVrNosLoaded(true);
        }
      } catch (error) {
        console.error("Error loading sales return Vr Nos:", error);
        if (!cancelled) {
          setExistingVrNos([]);
          setVrNosLoaded(true);
        }
      }
    };

    loadExistingVrNos();
    return () => {
      cancelled = true;
    };
  }, [open, isEditMode]);

  useEffect(() => {
    if (!open || isEditMode || !vrNosLoaded) return;
    setForm((prev) => {
      const nextVrNo = computeNextSalesReturnVrNo(existingVrNos, prev.date);
      if (prev.vrNo === nextVrNo) return prev;
      return { ...prev, vrNo: nextVrNo };
    });
  }, [open, isEditMode, vrNosLoaded, existingVrNos, form.date]);

  useEffect(() => {
    if (!open || !contractCustomerOptions.length) return;

    setForm((prev) => {
      let contractCustomerKey = String(prev.contractCustomerKey || "").trim();
      let contractOption = findSalesReturnContractCustomerOption(
        contractCustomerOptions,
        contractCustomerKey
      );

      if (!contractOption) {
        const cid = String(prev.contractId || "").trim();
        const cn = String(prev.contractNo || "").trim();
        contractOption =
          contractCustomerOptions.find(
            (option) =>
              option.type === "contract" &&
              ((cid && String(option.contractId) === cid) ||
                (cn &&
                  String(option.contractNo || "")
                    .trim()
                    .toLowerCase() === cn.toLowerCase()))
          ) || null;
        if (contractOption) contractCustomerKey = contractOption.value;
      }

      if (!contractOption && !prev.invoiceKey) return prev;

      const invoiceOptions = getSalesReturnInvoicesForSelection(invoiceRows, contractOption, {
        includeInvoiceKey: prev.invoiceKey,
      }).map(formatSalesReturnInvoiceOption);
      let invoiceOption = invoiceOptions.find((option) => option.value === prev.invoiceKey) || null;

      if (lockContractAndInvoice && prev.invoiceKey && !invoiceOption) {
        const invoiceRow = findSalesReturnInvoiceRowByKey(invoiceRows, prev.invoiceKey);
        if (invoiceRow) {
          invoiceOption = formatSalesReturnInvoiceOption(invoiceRow);
        }
      }

      const next = { ...prev };
      if (contractOption) {
        next.contractCustomerKey = contractCustomerKey;
        next.contractCustomerLabel = prev.contractCustomerLabel || contractOption.label || "";
        if (contractOption.type === "contract") {
          next.contractId = String(contractOption.contractId || prev.contractId || "");
          next.contractNo = String(contractOption.contractNo || prev.contractNo || "");
        }
      } else if (lockContractAndInvoice) {
        if (!next.contractCustomerKey && next.contractId) {
          next.contractCustomerKey = `contract:${next.contractId}`;
        }
      }
      if (invoiceOption) {
        next.invoiceKey = invoiceOption.value;
        next.invoiceNo = prev.invoiceNo || invoiceOption.invoiceNo || "";
        next.invoiceLabel = prev.invoiceLabel || invoiceOption.label || "";
      } else if (lockContractAndInvoice && prev.invoiceKey) {
        next.invoiceKey = prev.invoiceKey;
        next.invoiceNo = prev.invoiceNo || parseInvoiceKey(prev.invoiceKey).invoiceNo || "";
        next.invoiceLabel =
          prev.invoiceLabel ||
          (next.invoiceNo && next.contractNo
            ? `${next.invoiceNo}-${next.contractNo}`
            : next.invoiceNo);
      }
      return next;
    });
  }, [open, contractCustomerOptions, invoiceRows, lockContractAndInvoice]);

  const loadLinesFromInvoice = useCallback(
    async (invoiceNo) => {
      if (!invoiceNo || !productOptions.length || !accountOptions.length) return;
      setLoadingInvoiceLines(true);
      try {
        const lines = await fetchSalesReturnLinesFromInvoice(
          invoiceNo,
          productOptions,
          accountOptions
        );
        setForm((prev) => ({ ...prev, lines }));
      } catch (error) {
        console.error("Failed to load invoice lines:", error);
        window.alert("Failed to load line items from the selected invoice.");
      } finally {
        setLoadingInvoiceLines(false);
      }
    },
    [productOptions, accountOptions]
  );

  useEffect(() => {
    if (!open || !form.invoiceNo || !productOptions.length || !accountOptions.length) return;
    loadLinesFromInvoice(form.invoiceNo);
  }, [open, form.invoiceNo, productOptions.length, accountOptions.length, loadLinesFromInvoice]);

  const updateHeader = (field, value) => {
    if (field === "vrNo") return;
    if (lockContractAndInvoice && (field === "contractCustomerKey" || field === "invoiceKey")) {
      return;
    }

    if (field === "invoiceKey") {
      setForm((prev) => {
        const selected = findSalesReturnContractCustomerOption(
          contractCustomerOptions,
          prev.contractCustomerKey
        );
        const options = getSalesReturnInvoicesForSelection(invoiceRows, selected, {
          includeInvoiceKey: value,
        }).map(formatSalesReturnInvoiceOption);
        const option = options.find((row) => row.value === value);
        return {
          ...prev,
          invoiceKey: value,
          invoiceNo: option?.invoiceNo || "",
          invoiceLabel: option?.label || "",
          lines: [],
        };
      });
      return;
    }

    setForm((prev) => {
      const next = { ...prev, [field]: value };

      if (field === "contractCustomerKey") {
        const option = findSalesReturnContractCustomerOption(contractCustomerOptions, value);
        next.contractCustomerLabel = option?.label || "";
        next.contractId = option?.type === "contract" ? String(option.contractId || "") : "";
        next.contractNo = option?.type === "contract" ? String(option.contractNo || "") : "";
        next.customerId = option?.type === "customer" ? String(option.customerId || "") : "";
        next.invoiceKey = "";
        next.invoiceNo = "";
        next.invoiceLabel = "";
        next.lines = [];
      }

      return next;
    });
  };

  const updateLine = (lineId, field, value) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.map((line) => {
        if (line.id !== lineId) return line;
        let updated = { ...line, [field]: value };
        if (field === "productKey") {
          updated = applySalesReturnProductSelection(
            updated,
            value,
            productOptions,
            accountOptions
          );
        } else if (field === "quantity" || field === "unitPrice" || field === "discount") {
          updated = syncSalesReturnLineAmount(updated);
        }
        return updated;
      }),
    }));
  };

  const handleAddLine = () => {
    setForm((prev) => ({
      ...prev,
      lines: [...prev.lines, createSalesReturnLineRow()],
    }));
  };

  const handleDuplicateLine = (lineId) => {
    setForm((prev) => {
      const source = prev.lines.find((line) => line.id === lineId);
      if (!source) return prev;
      const duplicate = createSalesReturnLineRow({
        ...source,
        id: `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      });
      const index = prev.lines.findIndex((line) => line.id === lineId);
      const lines = [...prev.lines];
      lines.splice(index + 1, 0, duplicate);
      return { ...prev, lines };
    });
  };

  const handleDeleteLine = (lineId) => {
    setForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((line) => line.id !== lineId),
    }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${Math.round((bytes / k ** i) * 100) / 100} ${sizes[i]}`;
  };

  const totalAttachmentSlots = existingFiles.length + selectedFiles.length;

  const handleAttachmentSelect = (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;

    const remaining = MAX_ATTACHMENT_FILES - totalAttachmentSlots;
    if (remaining <= 0) {
      window.alert(
        `Maximum ${MAX_ATTACHMENT_FILES} files allowed. Please delete some existing files before uploading new ones.`
      );
      event.target.value = "";
      return;
    }

    if (files.length > remaining) {
      window.alert(
        `You can only upload ${remaining} more file(s). Maximum ${MAX_ATTACHMENT_FILES} files allowed (${existingFiles.length} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    const validFiles = files.filter((file) => {
      if (file.size > SALES_RETURN_ATTACHMENT_MAX_BYTES) {
        window.alert(`File "${file.name}" exceeds 10MB limit and will be skipped.`);
        return false;
      }
      return true;
    });

    if (totalAttachmentSlots + validFiles.length > MAX_ATTACHMENT_FILES) {
      const allowedCount = MAX_ATTACHMENT_FILES - totalAttachmentSlots;
      window.alert(
        `You can only upload ${allowedCount} more file(s). Maximum ${MAX_ATTACHMENT_FILES} files allowed (${existingFiles.length} already uploaded).`
      );
      event.target.value = "";
      return;
    }

    setSelectedFiles((prev) => [...prev, ...validFiles]);
    event.target.value = "";
  };

  const handleRemoveSelectedFile = (index) => {
    setSelectedFiles((prev) => {
      const next = [...prev];
      next.splice(index, 1);
      return next;
    });
  };

  const handleDeleteExistingFile = async (file) => {
    const fileId = file?.id || file?.fileId;
    if (!fileId) {
      window.alert("File ID is not available. Cannot delete this file.");
      return;
    }
    if (!window.confirm(`Delete "${file.fileName || file.name || "this file"}"?`)) return;
    try {
      await uploadApi.deleteUploadedFile(fileId);
      if (initialData?.id) await fetchExistingFiles(initialData.id);
      onUploadSuccess?.();
    } catch (error) {
      console.error("Failed to delete sales return attachment:", error);
      window.alert(error?.message || "Failed to delete file.");
    }
  };

  const handleSave = async () => {
    let formToSave = form;
    if (!isEditMode) {
      try {
        const freshVrNos = await fetchSalesReturnVrNos(salesReturnsApi);
        const nextVrNo = computeNextSalesReturnVrNo(freshVrNos, form.date);
        formToSave = { ...form, vrNo: nextVrNo };
        setExistingVrNos(freshVrNos);
        setForm(formToSave);
      } catch (error) {
        console.error("Error refreshing sales return Vr Nos:", error);
      }
    }

    const validationErrors = validateSalesReturnForm(formToSave);
    setErrors(validationErrors);
    if (Object.keys(validationErrors).length > 0) {
      window.alert("Please complete all required fields before saving.");
      return;
    }
    setSaving(true);
    try {
      const result = await onSubmit?.({ ...formToSave, grandTotal });
      const recordId = initialData?.id ?? result?.id;
      if (recordId && selectedFiles.length > 0) {
        setIsUploading(true);
        try {
          await uploadSalesReturnAttachments(recordId, selectedFiles);
          setSelectedFiles([]);
          onUploadSuccess?.();
        } catch (error) {
          console.error("Error uploading sales return files:", error);
          window.alert(`Failed to upload files: ${error.message}`);
          return;
        } finally {
          setIsUploading(false);
        }
      }
      onClose?.();
    } finally {
      setSaving(false);
    }
  };

  const contractCustomerDisplay = useMemo(() => {
    if (form.contractCustomerLabel) return form.contractCustomerLabel;
    const option = findSalesReturnContractCustomerOption(
      contractCustomerOptions,
      form.contractCustomerKey
    );
    return option?.label || form.contractNo || "";
  }, [
    contractCustomerOptions,
    form.contractCustomerKey,
    form.contractCustomerLabel,
    form.contractNo,
  ]);

  const invoiceDisplay = useMemo(() => {
    if (form.invoiceLabel) return form.invoiceLabel;
    const option = invoiceOptions.find((row) => row.value === form.invoiceKey);
    return option?.label || form.invoiceNo || "";
  }, [form.invoiceKey, form.invoiceLabel, form.invoiceNo, invoiceOptions]);

  const formTitle = initialData?.id ? labels.editFormTitle : labels.addFormTitle;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{formTitle}</DialogTitle>
      <DialogContent dividers>
        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={6} md={3}>
            <SalesReturnDateField
              value={form.date}
              onChange={(value) => updateHeader("date", value)}
              disabled={readOnly || saving}
              readOnly={readOnly}
              error={Boolean(errors.date)}
              helperText={errors.date}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            <TextField
              fullWidth
              label="Vr No"
              value={form.vrNo}
              disabled
              size="small"
              InputLabelProps={{ shrink: true }}
              InputProps={{ readOnly: true }}
              placeholder={`${SALES_RETURN_VR_NO_PREFIX}-1/${getSalesReturnYearFromDate(
                form.date
              )}`}
              error={Boolean(errors.vrNo)}
              helperText={errors.vrNo}
              sx={textFieldSx}
            />
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {lockContractAndInvoice ? (
              <TextField
                fullWidth
                label="Contracts / Customers"
                value={contractCustomerDisplay}
                disabled
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={textFieldSx}
              />
            ) : (
              <FormControl fullWidth size="small" error={Boolean(errors.contractCustomerKey)}>
                <InputLabel id="sales-return-contract-label" shrink>
                  Contracts / Customers
                </InputLabel>
                <SearchableSelect
                  labelId="sales-return-contract-label"
                  label="Contracts / Customers"
                  value={form.contractCustomerKey || ""}
                  displayEmpty
                  onChange={(e) => updateHeader("contractCustomerKey", e.target.value)}
                  disabled={readOnly || saving}
                  sx={textFieldSx}
                >
                  <MenuItem value="">
                    <em>Select contract or customer</em>
                  </MenuItem>
                  {contractCustomerOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.contractCustomerKey ? (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.contractCustomerKey}
                  </Typography>
                ) : null}
              </FormControl>
            )}
          </Grid>
          <Grid item xs={12} sm={6} md={3}>
            {lockContractAndInvoice ? (
              <TextField
                fullWidth
                label="Sales Invoice"
                value={invoiceDisplay}
                disabled
                size="small"
                InputLabelProps={{ shrink: true }}
                sx={textFieldSx}
              />
            ) : (
              <FormControl fullWidth size="small" error={Boolean(errors.invoiceKey)}>
                <InputLabel id="sales-return-invoice-label" shrink>
                  Sales Invoice
                </InputLabel>
                <SearchableSelect
                  labelId="sales-return-invoice-label"
                  label="Sales Invoice"
                  value={form.invoiceKey || ""}
                  displayEmpty
                  onChange={(e) => updateHeader("invoiceKey", e.target.value)}
                  disabled={readOnly || saving || !form.contractCustomerKey || loadingInvoiceLines}
                  sx={textFieldSx}
                >
                  <MenuItem value="">
                    <em>Select invoice</em>
                  </MenuItem>
                  {invoiceOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </SearchableSelect>
                {errors.invoiceKey ? (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>
                    {errors.invoiceKey}
                  </Typography>
                ) : null}
              </FormControl>
            )}
          </Grid>
          <Grid item xs={12}>
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

        <MDBox sx={{ mb: 2 }}>
          {showLinesGrid ? (
            <SalesReturnLinesGrid
              lines={form.lines}
              productOptions={productOptions}
              errors={errors}
              saving={saving || loadingInvoiceLines}
              grandTotal={grandTotal}
              readOnly={readOnly}
              onLineChange={updateLine}
              onAddLine={handleAddLine}
              onDuplicateLine={handleDuplicateLine}
              onDeleteLine={handleDeleteLine}
            />
          ) : (
            <Typography variant="caption" color="text">
              Select Contract / Customer and Sales Invoice to load line items.
            </Typography>
          )}
          {errors.lines ? (
            <Typography variant="caption" color="error" display="block" sx={{ mt: 0.5 }}>
              {errors.lines}
            </Typography>
          ) : null}
        </MDBox>

        <MDBox
          sx={{
            border: "1px dashed",
            borderColor: "grey.400",
            borderRadius: 2,
            p: 2,
            bgcolor: "background.paper",
          }}
        >
          <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>
            Attachments (max {MAX_ATTACHMENT_FILES} files total)
          </Typography>

          {isEditMode ? (
            loadingExistingFiles ? (
              <MDBox display="flex" justifyContent="center" py={1}>
                <CurrencyLoading size={20} />
              </MDBox>
            ) : existingFiles.length > 0 ? (
              <MDBox mb={2}>
                <Typography variant="caption" color="text" display="block" sx={{ mb: 1 }}>
                  Already uploaded files ({existingFiles.length}/{MAX_ATTACHMENT_FILES}):
                </Typography>
                {existingFiles.map((file, index) => (
                  <Chip
                    key={file.id || file.fileName || index}
                    label={file.fileName || `File ${index + 1}`}
                    onDelete={readOnly ? undefined : () => handleDeleteExistingFile(file)}
                    size="small"
                    sx={{ mr: 1, mb: 1 }}
                    variant="outlined"
                  />
                ))}
              </MDBox>
            ) : null
          ) : null}

          {!readOnly ? (
            totalAttachmentSlots >= MAX_ATTACHMENT_FILES ? (
              <Typography variant="caption" color="warning.main" display="block" sx={{ mb: 1 }}>
                Maximum {MAX_ATTACHMENT_FILES} files already uploaded. Delete existing files to
                upload new ones.
              </Typography>
            ) : (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  hidden
                  accept="*/*"
                  onChange={handleAttachmentSelect}
                  disabled={saving || isUploading || totalAttachmentSlots >= MAX_ATTACHMENT_FILES}
                />
                <MDButton
                  variant="outlined"
                  color="info"
                  size="small"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving || isUploading || totalAttachmentSlots >= MAX_ATTACHMENT_FILES}
                >
                  <Icon>cloud_upload</Icon>&nbsp;Upload Files ({totalAttachmentSlots}/
                  {MAX_ATTACHMENT_FILES})
                </MDButton>
                {totalAttachmentSlots < MAX_ATTACHMENT_FILES ? (
                  <Typography variant="caption" color="text" display="block" sx={{ mt: 1 }}>
                    You can upload {MAX_ATTACHMENT_FILES - totalAttachmentSlots} more file(s).
                  </Typography>
                ) : null}
              </>
            )
          ) : null}

          {selectedFiles.length > 0 ? (
            <MDBox mt={2}>
              <Typography variant="caption" color="text" display="block" sx={{ mb: 1 }}>
                New files to upload:
              </Typography>
              {selectedFiles.map((file, index) => (
                <Chip
                  key={`${file.name}-${index}`}
                  label={`${file.name} (${formatFileSize(file.size)})`}
                  onDelete={readOnly ? undefined : () => handleRemoveSelectedFile(index)}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                  color="primary"
                  variant="outlined"
                />
              ))}
            </MDBox>
          ) : selectedFiles.length === 0 && existingFiles.length === 0 ? (
            <Typography variant="caption" color="text" display="block" sx={{ mt: 1 }}>
              No files selected. Click &quot;Upload Files&quot; to add attachments.
            </Typography>
          ) : null}
        </MDBox>
      </DialogContent>
      <DialogActions>
        <MDButton
          variant="text"
          color="secondary"
          onClick={onClose}
          disabled={saving || isUploading}
        >
          Cancel
        </MDButton>
        {!readOnly ? (
          <MDButton
            variant="gradient"
            color="info"
            onClick={handleSave}
            disabled={saving || isUploading}
          >
            {saving || isUploading ? "Saving..." : "Save"}
          </MDButton>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}

SalesReturnForm.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  onSubmit: PropTypes.func,
  initialData: PropTypes.object,
  labels: PropTypes.object,
  readOnly: PropTypes.bool,
  onUploadSuccess: PropTypes.func,
};

SalesReturnForm.defaultProps = {
  onSubmit: undefined,
  initialData: null,
  labels: SALES_RETURNS_LABELS,
  readOnly: false,
  onUploadSuccess: undefined,
};
