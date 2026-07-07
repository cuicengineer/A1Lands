import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { ServerGridPagination } from "components/CompactGridPagination";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import {
  canCreateCurrentMenu,
  canDeleteCurrentMenu,
  canEditCurrentMenu,
} from "services/api.service";
import {
  buildCollectionsGridTableBodySx,
  COLLECTIONS_GRID_ACTION_BOX_SX,
  COLLECTIONS_GRID_ICON_BUTTON_SX,
  renderCollectionsGridSno,
  renderCollectionsGridText,
} from "utils/collectionsGridTableSx";
import ProductsModuleTabs from "layouts/products/components/ProductsModuleTabs";
import ProductForm from "./ProductForm";
import {
  formatAccountingNumber,
  fetchProductUomOptions,
  buildProductUomLookup,
  formatProductUomLabel,
  normalizeGoodRecord,
  normalizeServiceRecord,
} from "./productUtils";

function renderStatusLabel(value) {
  const label = value != null && String(value).trim() !== "" ? String(value).trim() : "-";
  const active = label.toLowerCase() === "active";
  return (
    <MDBox
      component="span"
      sx={{
        display: "inline-flex",
        px: 1,
        py: 0.35,
        borderRadius: "999px",
        minWidth: 76,
        fontWeight: 600,
        backgroundColor: active ? "#d4edda" : "#f8d7da",
        color: active ? "#155724" : "#721c24",
      }}
    >
      {label}
    </MDBox>
  );
}

export default function ProductListPage({ title, subtitle, mode, api, exportFileName }) {
  const isGood = mode === "good";
  const normalize = isGood ? normalizeGoodRecord : normalizeServiceRecord;

  const [tableRows, setTableRows] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [paginationHost, setPaginationHost] = useState(null);
  const [uomOptions, setUomOptions] = useState([]);

  const uomLookup = useMemo(() => buildProductUomLookup(uomOptions), [uomOptions]);

  const txt = (v) => renderCollectionsGridText(v);

  const fetchRecords = useCallback(
    async (page = pageNumber, size = pageSize) => {
      setLoading(true);
      try {
        const response = await api.getAll(page, size);
        const data = Array.isArray(response) ? response : response?.data ?? [];
        setTableRows(Array.isArray(data) ? data : []);
        setTotalCount(
          Number(response?.pagination?.totalCount ?? (Array.isArray(data) ? data.length : 0))
        );
      } catch (error) {
        console.error(`Error fetching ${mode} products:`, error);
        setTableRows([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [api, mode, pageNumber, pageSize]
  );

  useEffect(() => {
    fetchRecords(pageNumber, pageSize);
  }, [pageNumber, pageSize, fetchRecords]);

  useEffect(() => {
    let alive = true;
    fetchProductUomOptions()
      .then((rows) => {
        if (alive) setUomOptions(Array.isArray(rows) ? rows : []);
      })
      .catch((error) => {
        console.error("Error loading UoM labels:", error);
        if (alive) setUomOptions([]);
      });
    return () => {
      alive = false;
    };
  }, []);

  const columns = useMemo(() => {
    const base = [
      { id: "actions", Header: "Action", accessor: "actions", align: "center" },
      { id: "sno", Header: "S.No", accessor: "sno", align: "center" },
      { id: "itemCode", Header: "Item Code", accessor: "itemCode", align: "left" },
      { id: "itemName", Header: "Item Name", accessor: "itemName", align: "left" },
      { id: "uom", Header: "UoM", accessor: "uom", align: "left" },
    ];
    if (isGood) {
      base.push({
        id: "controlAccount",
        Header: "Control Account",
        accessor: "controlAccount",
        align: "left",
      });
    }
    base.push(
      { id: "saleAccount", Header: "Sale - Account", accessor: "saleAccount", align: "left" },
      {
        id: "purchaseAccount",
        Header: "Purchase - Account",
        accessor: "purchaseAccount",
        align: "left",
      },
      {
        id: "defaultParticulars",
        Header: "Default Particulars",
        accessor: "defaultParticulars",
        align: "left",
      },
      {
        id: "defaultUnitPriceSales",
        Header: "Default Unit Price - Sales",
        accessor: "defaultUnitPriceSales",
        align: "left",
      },
      {
        id: "defaultUnitPricePurchase",
        Header: "Default Unit Price - Purchase",
        accessor: "defaultUnitPricePurchase",
        align: "left",
      },
      { id: "taxCode", Header: "Default - Tax Code", accessor: "taxCode", align: "left" },
      { id: "status", Header: "Status", accessor: "status", align: "left" }
    );
    return base.map((col) => ({
      ...col,
      Cell:
        col.id === "actions"
          ? ({ row }) => row?.original?.actions
          : col.id === "sno"
          ? ({ value }) => renderCollectionsGridSno(value)
          : col.id === "status"
          ? ({ value }) => renderStatusLabel(value)
          : ({ value }) => txt(value),
    }));
  }, [isGood]);

  const computedRows = useMemo(
    () =>
      tableRows.map((row, index) => {
        const flat = normalize(row);
        const recordId = flat.id;
        return {
          sno: (pageNumber - 1) * pageSize + index + 1,
          itemCode: flat.itemCode || "-",
          itemName: flat.itemName || "-",
          uom: formatProductUomLabel(flat.uom, uomLookup),
          controlAccount: flat.controlAccountDisplay || "-",
          saleAccount: flat.saleAccountDisplay || "-",
          purchaseAccount: flat.purchaseAccountDisplay || "-",
          defaultParticulars: flat.defaultParticulars || "-",
          defaultUnitPriceSales: formatAccountingNumber(flat.defaultUnitPriceSales),
          defaultUnitPricePurchase: formatAccountingNumber(flat.defaultUnitPricePurchase),
          taxCode: flat.taxCodeDisplay || "-",
          status: flat.status || "Active",
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              {canEditCurrentMenu() && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => {
                    setCurrentRecord(row);
                    setOpenForm(true);
                  }}
                  title="Edit"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">edit</Icon>
                </IconButton>
              )}
              {canDeleteCurrentMenu() && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => {
                    setRecordToDelete(recordId);
                    setDeleteDialogOpen(true);
                  }}
                  title="Delete"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">delete</Icon>
                </IconButton>
              )}
            </MDBox>
          ),
        };
      }),
    [tableRows, pageNumber, pageSize, normalize, uomLookup]
  );

  const displayTotal = totalCount > 0 ? totalCount : tableRows.length;
  const workspaceMetadata = useMemo(
    () => buildWorkspaceRecordMetrics({ total: displayTotal, page: pageNumber, pageSize }),
    [displayTotal, pageNumber, pageSize]
  );

  const serverPaginationFooter = useMemo(
    () => (
      <ServerGridPagination
        page={pageNumber}
        totalCount={displayTotal}
        pageSize={pageSize}
        onPageChange={setPageNumber}
      />
    ),
    [displayTotal, pageNumber, pageSize]
  );

  return (
    <DashboardLayout>
      <DashboardNavbar />
      <EnterpriseWorkspace
        title={title}
        subtitle={subtitle}
        metadata={workspaceMetadata}
        tabs={<ProductsModuleTabs />}
        actions={
          canCreateCurrentMenu() ? (
            <MDButton
              variant="outlined"
              color="dark"
              onClick={() => {
                setCurrentRecord(null);
                setOpenForm(true);
              }}
            >
              <Icon>add</Icon>&nbsp;Add New
            </MDButton>
          ) : null
        }
        bodySx={buildCollectionsGridTableBodySx({ leadingCompactColumnCount: 1 })}
      >
        <MDBox
          sx={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            position: "relative",
          }}
        >
          <MDBox
            ref={setPaginationHost}
            className="saas-settings-table-pagination-top"
            sx={{
              display: "flex",
              justifyContent: "flex-end",
              flexShrink: 0,
              width: "100%",
            }}
          />
          <DataTable
            table={{ columns, rows: computedRows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={{ defaultValue: 50, entries: [10, 25, 50, 100, 500] }}
            page={pageNumber - 1}
            pageSize={pageSize}
            onPageChange={(p) => setPageNumber(p + 1)}
            onEntriesPerPageChange={(value) => {
              setPageSize(value);
              setPageNumber(1);
            }}
            showTotalEntries={false}
            noEndBorder
            canSearch
            exportFileName={exportFileName}
            contentFitTable
            disableHeaderMetrics
            paginationFooter={serverPaginationFooter}
            paginationHost={paginationHost}
          />
          <WorkspaceLoadingOverlay active={loading} />
        </MDBox>
      </EnterpriseWorkspace>

      <ProductForm
        open={openForm}
        onClose={() => {
          setOpenForm(false);
          setCurrentRecord(null);
        }}
        onSubmit={async (payload) => {
          const existingId = currentRecord?.id ?? currentRecord?.Id;
          if (existingId) await api.update(existingId, payload);
          else await api.create(payload);
          await fetchRecords(pageNumber, pageSize);
          setOpenForm(false);
          setCurrentRecord(null);
        }}
        initialData={currentRecord}
        mode={mode}
        api={api}
      />

      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this record?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={() => setDeleteDialogOpen(false)}>Cancel</MDButton>
          <MDButton
            onClick={async () => {
              if (recordToDelete == null) return;
              try {
                await api.remove(recordToDelete);
                await fetchRecords(pageNumber, pageSize);
              } catch (error) {
                window.alert("Failed to delete record.");
              } finally {
                setDeleteDialogOpen(false);
                setRecordToDelete(null);
              }
            }}
            color="error"
          >
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}

ProductListPage.propTypes = {
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string.isRequired,
  mode: PropTypes.oneOf(["service", "good"]).isRequired,
  api: PropTypes.object.isRequired,
  exportFileName: PropTypes.string.isRequired,
};
