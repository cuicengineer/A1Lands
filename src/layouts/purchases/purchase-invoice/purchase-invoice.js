import { useCallback, useEffect, useMemo, useState } from "react";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import AgreementProvPdfPreviewDialog from "components/AgreementProvPdfPreviewDialog";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import PurchasesModuleTabs from "layouts/purchases/components/PurchasesModuleTabs";
import { PURCHASE_INVOICE_LABELS } from "layouts/purchases/transactionLabels";
import {
  computePurchaseInvoiceGrandTotal,
  formatAmount,
} from "layouts/purchases/purchase-invoice/purchaseInvoiceUtils";
import {
  generatePurchaseInvoicePdf,
  PURCHASE_INVOICE_PDF_DEFAULT_COLUMN_KEYS,
  PURCHASE_INVOICE_PDF_SELECTABLE_COLUMNS,
} from "layouts/purchases/purchase-invoice/purchaseInvoicePdf";
import PurchaseInvoiceForm from "layouts/purchases/purchase-invoice/PurchaseInvoiceForm";
import purchaseInvoicesApi from "services/api.purchaseInvoices.service";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";
import {
  PURCHASE_INVOICE_PDF_DEFAULT_MARGINS,
  loadPurchaseInvoicePdfMargins,
  savePurchaseInvoicePdfMargins,
} from "utils/agreementProvPdfMargins";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridAmount,
  renderCollectionsGridSno,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";

function formatDateDisplay(value) {
  if (!value) return "-";
  return formatDateDDMMMYYYY(value) || "-";
}

export default function PurchaseInvoices() {
  const labels = PURCHASE_INVOICE_LABELS;
  const [records, setRecords] = useState([]);
  const [paginationHost, setPaginationHost] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [readOnlyForm, setReadOnlyForm] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewRecord, setPdfPreviewRecord] = useState(null);

  const loadRecords = useCallback(async () => {
    setLoading(true);
    try {
      const response = await purchaseInvoicesApi.listPurchaseInvoices();
      const rows = purchaseInvoicesApi
        .unwrapList(response)
        .map(purchaseInvoicesApi.normalizePurchaseInvoiceRow);
      setRecords(rows);
    } catch (error) {
      console.error("Failed to load purchase invoices:", error);
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setReadOnlyForm(false);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
    setReadOnlyForm(false);
  };

  const handleEditRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    setCurrentRecord(record);
    setReadOnlyForm(false);
    setOpenForm(true);
  };

  const handleViewRecord = (id) => {
    const record = records.find((row) => Number(row.id) === Number(id));
    if (!record) return;
    setCurrentRecord(record);
    setReadOnlyForm(true);
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    try {
      await purchaseInvoicesApi.removePurchaseInvoice(recordToDelete);
      setRecords((prev) => prev.filter((row) => Number(row.id) !== Number(recordToDelete)));
    } catch (error) {
      console.error("Failed to delete purchase invoice:", error);
      window.alert("Failed to delete purchase invoice.");
      return;
    }
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleOpenPurchaseInvoicePdfPreview = (record) => {
    if (!record) return;
    setPdfPreviewRecord(record);
    setPdfPreviewOpen(true);
  };

  const handleClosePurchaseInvoicePdfPreview = () => {
    setPdfPreviewOpen(false);
    setPdfPreviewRecord(null);
  };

  const generatePurchaseInvoicePdfBlob = useCallback(
    (record, marginsIn, { columnKeys } = {}) =>
      generatePurchaseInvoicePdf(record, marginsIn, { openNewTab: false, columnKeys }),
    []
  );

  const handleSubmit = async (payload) => {
    const existingId = payload?.id ?? currentRecord?.id;
    const grandTotal =
      payload?.grandTotal ?? computePurchaseInvoiceGrandTotal(payload?.lines || []);
    const apiPayload = purchaseInvoicesApi.buildPurchaseInvoiceApiPayload(payload, grandTotal);

    if (existingId) {
      await purchaseInvoicesApi.updatePurchaseInvoice(existingId, apiPayload);
      const normalized = purchaseInvoicesApi.normalizePurchaseInvoiceRow({
        ...apiPayload,
        Id: existingId,
      });
      setRecords((prev) =>
        prev.map((row) => (Number(row.id) === Number(existingId) ? normalized : row))
      );
      return { id: existingId };
    }

    const created = await purchaseInvoicesApi.createPurchaseInvoice(apiPayload);
    const createdId = created?.id ?? created?.Id;
    const normalized = purchaseInvoicesApi.normalizePurchaseInvoiceRow({
      ...apiPayload,
      ...(created || {}),
      Id: createdId,
    });
    setRecords((prev) => [normalized, ...prev]);
    return { id: createdId };
  };

  const txt = (v) => renderCollectionsGridText(v);

  const columns = useMemo(
    () => [
      {
        id: "actions",
        Header: "Action",
        accessor: "actions",
        align: "center",
        width: "96px",
        Cell: ({ row }) => row?.original?.actions,
      },
      {
        id: "sno",
        Header: "S.No",
        accessor: "sno",
        align: "center",
        width: "36px",
        Cell: ({ value }) => renderCollectionsGridSno(value),
      },
      {
        id: "date",
        Header: "Date",
        accessor: "date",
        align: "left",
        Cell: ({ value }) => renderCollectionsGridText(formatDateDisplay(value)),
      },
      {
        id: "piNo",
        Header: "PI No",
        accessor: "piNo",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "description",
        Header: "Description",
        accessor: "description",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "items",
        Header: "Items",
        accessor: "items",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "grandTotal",
        Header: "Total",
        accessor: "grandTotal",
        align: "right",
        Cell: ({ value }) => renderCollectionsGridAmount(formatAmount(value)),
      },
    ],
    []
  );

  const computedRows = useMemo(
    () =>
      records.map((record, index) => {
        const itemCodes = (record.lines || [])
          .map((line) => line.itemCode)
          .filter(Boolean)
          .join(", ");
        return {
          sno: index + 1,
          date: record.date,
          piNo: record.piNo,
          description: record.description,
          items: itemCodes || "—",
          grandTotal: record.grandTotal ?? computePurchaseInvoiceGrandTotal(record.lines),
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              <Tooltip title="Generate PDF">
                <span>
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => handleOpenPurchaseInvoicePdfPreview(record)}
                    title="Generate PDF"
                    sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                  >
                    <Icon fontSize="small">picture_as_pdf</Icon>
                  </IconButton>
                </span>
              </Tooltip>
              <IconButton
                size="small"
                color="secondary"
                onClick={() => handleViewRecord(record.id)}
                title="View"
                sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
              >
                <Icon fontSize="small">visibility</Icon>
              </IconButton>
              {canEditCurrentMenu() ? (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(record.id)}
                  title="Edit"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">edit</Icon>
                </IconButton>
              ) : null}
              {canDeleteCurrentMenu() ? (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(record.id)}
                  title="Delete"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">delete</Icon>
                </IconButton>
              ) : null}
            </MDBox>
          ),
        };
      }),
    [records]
  );

  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: records.length }),
    [records.length]
  );

  const gridBodySx = useMemo(
    () =>
      buildCollectionsGridTableBodySx({
        leadingCompactColumnCount: 2,
        trailingCompactColumnCount: 0,
      }),
    []
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title={labels.pageTitle}
        subtitle={labels.pageSubtitle}
        metadata={workspaceMetadata}
        tabs={<PurchasesModuleTabs />}
        filters={
          <MDBox
            ref={setPaginationHost}
            className="purchases-filter-pagination saas-settings-table-pagination-top"
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              flexShrink: 0,
              width: "100%",
              px: 1,
              "& .MuiPaginationItem-root": {
                fontSize: "0.6rem",
                minWidth: "1.2rem",
                height: "1.2rem",
                padding: "0 2px",
              },
              "& .MuiPaginationItem-icon": {
                fontSize: "0.8rem",
              },
              "& .compact-grid-pagination": {
                gap: 0,
              },
            }}
          />
        }
        actions={
          canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={gridBodySx}
      >
        {loading ? (
          <MDTypography variant="caption" color="text" px={2} py={1}>
            Loading purchase invoices...
          </MDTypography>
        ) : (
          <DataTable
            table={{ columns, rows: computedRows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={false}
            paginationPortalTarget={paginationHost}
            showTotalEntries={false}
            canSearch
            canExport
            exportFileName={labels.exportFileName}
          />
        )}
      </EnterpriseWorkspace>

      <PurchaseInvoiceForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
        labels={labels}
        readOnly={readOnlyForm}
      />

      <AgreementProvPdfPreviewDialog
        open={pdfPreviewOpen}
        onClose={handleClosePurchaseInvoicePdfPreview}
        data={pdfPreviewRecord}
        generatePdfBlob={generatePurchaseInvoicePdfBlob}
        title="PDF Preview"
        previewTitle="Purchase Invoice PDF"
        defaultMargins={PURCHASE_INVOICE_PDF_DEFAULT_MARGINS}
        loadMargins={loadPurchaseInvoicePdfMargins}
        saveMargins={savePurchaseInvoicePdfMargins}
        selectableColumns={PURCHASE_INVOICE_PDF_SELECTABLE_COLUMNS}
        defaultColumnKeys={PURCHASE_INVOICE_PDF_DEFAULT_COLUMN_KEYS}
        alwaysOnColumnLabels={["Total (always shown)"]}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Delete Purchase Invoice</DialogTitle>
        <DialogContent>
          <MDTypography variant="body2">{labels.deleteConfirm}</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton variant="text" color="secondary" onClick={handleCancelDelete}>
            Cancel
          </MDButton>
          <MDButton variant="gradient" color="error" onClick={handleConfirmDelete}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
