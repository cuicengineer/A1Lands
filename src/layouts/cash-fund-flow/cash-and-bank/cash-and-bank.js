import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
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
import DashboardLayout from "examples/LayoutContainers/DashboardLayout";
import EnterpriseWorkspace from "examples/LayoutContainers/EnterpriseWorkspace";
import DashboardNavbar from "examples/Navbars/DashboardNavbar";
import DataTable from "examples/Tables/DataTable";
import WorkspaceLoadingOverlay from "components/WorkspaceLoadingOverlay";
import { ServerGridPagination } from "components/CompactGridPagination";
import { buildWorkspaceRecordMetrics } from "utils/workspaceRecordMetrics";
import chartOfAccountsApi, { COA_SECTION_TYPE } from "services/api.chartofaccounts.service";
import { fetchBankListsForDropdown } from "services/api.bankAccount.service";
import cashAndBankApi from "services/api.cashAndBank.service";
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
import CashFundFlowModuleTabs from "layouts/cash-fund-flow/components/CashFundFlowModuleTabs";
import CashAndBankForm from "./CashAndBankForm";
import {
  buildCashAndBankPayload,
  flattenCashAndBankForGrid,
  getCashAndBankCoaDropdownLabel,
  pickField,
  isCashAndBankCoaOption,
  normalizeCashAndBankCoaOption,
  normalizeCashAndBankRecord,
} from "./cashAndBankUtils";

function renderStatusLabel(value) {
  const label = value != null && String(value).trim() !== "" ? String(value).trim() : "-";
  const key = label.toLowerCase();
  const palette =
    key === "active"
      ? { bg: "#d4edda", fg: "#155724" }
      : key === "inactive"
      ? { bg: "#f8d7da", fg: "#721c24" }
      : null;

  if (!palette) return label;
  return (
    <MDBox
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        px: 1,
        py: 0.35,
        borderRadius: "999px",
        minWidth: 76,
        fontWeight: 600,
        backgroundColor: palette.bg,
        color: palette.fg,
      }}
    >
      {label}
    </MDBox>
  );
}

function BalanceCell({ value }) {
  return (
    <MDTypography
      component="button"
      type="button"
      variant="caption"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      sx={{
        cursor: "pointer",
        color: "info.main",
        textDecoration: "underline",
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        background: "none",
        border: "none",
        padding: 0,
        "&:hover": { opacity: 0.85 },
      }}
    >
      {value ?? 0}
    </MDTypography>
  );
}

BalanceCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};

function readCashAndBankRouteFilters() {
  if (typeof window === "undefined") {
    return { parentId: "", parentAcctId: "", parentName: "", mode: "", view: "" };
  }
  const params = new URLSearchParams(window.location.search || "");
  return {
    parentId: String(params.get("parentId") || "").trim(),
    parentAcctId: String(params.get("parentAcctId") || params.get("acctId") || "").trim(),
    parentName: String(params.get("parentName") || "").trim(),
    mode: String(params.get("mode") || "")
      .trim()
      .toUpperCase(),
    view: String(params.get("view") || "")
      .trim()
      .toLowerCase(),
  };
}

function openCashAndBankTrChildrenInNewTab({ parentId, parentAcctId, parentName }) {
  const normalizedParentId = String(parentId || "").trim();
  if (!normalizedParentId || typeof window === "undefined") return;
  const params = new URLSearchParams({
    view: "grid",
    parentId: normalizedParentId,
    mode: "TR",
  });
  const normalizedAcctId = String(parentAcctId || "").trim();
  const normalizedName = String(parentName || "").trim();
  if (normalizedAcctId) params.set("parentAcctId", normalizedAcctId);
  if (normalizedName) params.set("parentName", normalizedName);
  window.open(
    `${window.location.origin}/cash-and-bank?${params.toString()}`,
    "_blank",
    "noopener,noreferrer"
  );
}

function AcctIdLinkCell({ value, hasLink, parentId, parentAcctId, parentName }) {
  if (!hasLink) return renderCollectionsGridText(value);
  return (
    <MDTypography
      component="button"
      type="button"
      variant="caption"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openCashAndBankTrChildrenInNewTab({ parentId, parentAcctId, parentName });
      }}
      sx={{
        cursor: "pointer",
        color: "info.main",
        textDecoration: "underline",
        fontFamily: "inherit",
        fontSize: "inherit",
        lineHeight: "inherit",
        background: "none",
        border: "none",
        padding: 0,
        "&:hover": { opacity: 0.85 },
      }}
    >
      {value}
    </MDTypography>
  );
}

AcctIdLinkCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  hasLink: PropTypes.bool,
  parentId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  parentAcctId: PropTypes.string,
  parentName: PropTypes.string,
};

AcctIdLinkCell.defaultProps = {
  value: "",
  hasLink: false,
  parentId: "",
  parentAcctId: "",
  parentName: "",
};

export default function CashAndBank() {
  const [tableRows, setTableRows] = useState([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [coaLabelById, setCoaLabelById] = useState({});
  const [bankLabelById, setBankLabelById] = useState({});
  const [openForm, setOpenForm] = useState(false);
  const [currentRecord, setCurrentRecord] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState(null);
  const [paginationHost, setPaginationHost] = useState(null);
  const routeFilters = useMemo(() => readCashAndBankRouteFilters(), []);

  const txt = (v) => renderCollectionsGridText(v);

  const fetchCoaLabels = useCallback(async () => {
    try {
      const response = await chartOfAccountsApi.getAll(COA_SECTION_TYPE);
      const rows = chartOfAccountsApi.unwrapList(response) || [];
      const lookup = {};
      rows.forEach((row) => {
        if (!isCashAndBankCoaOption(row)) return;
        const option = normalizeCashAndBankCoaOption(row);
        if (option.id == null) return;
        lookup[Number(option.id)] = getCashAndBankCoaDropdownLabel(option);
      });
      setCoaLabelById(lookup);
    } catch (error) {
      console.error("Error fetching Cash & Bank control accounts:", error);
      setCoaLabelById({});
    }
  }, []);

  const fetchBankLabels = useCallback(async () => {
    try {
      const banks = await fetchBankListsForDropdown();
      const lookup = {};
      (banks || []).forEach((bank) => {
        if (bank?.id == null) return;
        lookup[Number(bank.id)] = bank.label || bank.name || String(bank.id);
      });
      setBankLabelById(lookup);
    } catch (error) {
      console.error("Error fetching bank list:", error);
      setBankLabelById({});
    }
  }, []);

  const fetchRecords = useCallback(
    async (page = pageNumber, size = pageSize) => {
      setLoading(true);
      try {
        const isChildView = Boolean(routeFilters.parentId);
        const effectivePage = isChildView ? 1 : page;
        const effectiveSize = isChildView ? 1000 : size;
        const response = await cashAndBankApi.getAll(effectivePage, effectiveSize, {
          parentCashAndBankId: isChildView ? routeFilters.parentId : undefined,
          topLevelOnly: !isChildView,
        });
        if (Array.isArray(response)) {
          setTableRows(response);
          setTotalCount(response.length);
          return;
        }
        const data = response?.data ?? [];
        const pagination = response?.pagination;
        setTableRows(Array.isArray(data) ? data : []);
        setTotalCount(Number(pagination?.totalCount ?? 0));
      } catch (error) {
        console.error("Error fetching Cash & Bank records:", error);
        setTableRows([]);
        setTotalCount(0);
      } finally {
        setLoading(false);
      }
    },
    [pageNumber, pageSize, routeFilters.parentId]
  );

  useEffect(() => {
    fetchCoaLabels();
    fetchBankLabels();
  }, [fetchCoaLabels, fetchBankLabels]);

  useEffect(() => {
    fetchRecords(pageNumber, pageSize);
  }, [pageNumber, pageSize, fetchRecords]);

  const handleOpenForm = () => {
    setCurrentRecord(null);
    setOpenForm(true);
  };

  const handleCloseForm = () => {
    setOpenForm(false);
    setCurrentRecord(null);
  };

  const handleEditRecord = (id) => {
    const record = tableRows.find((row) => Number(row.id ?? row.Id) === Number(id));
    if (!record) return;
    setCurrentRecord({
      ...normalizeCashAndBankRecord(record),
      id: record.id ?? record.Id,
    });
    setOpenForm(true);
  };

  const handleDeleteRecord = (id) => {
    setRecordToDelete(id);
    setDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (recordToDelete == null) return;
    try {
      await cashAndBankApi.remove(recordToDelete);
      await fetchRecords(pageNumber, pageSize);
    } catch (error) {
      console.error("Error deleting Cash & Bank record:", error);
      window.alert(error?.message || "Failed to delete record. Please try again.");
    } finally {
      setDeleteDialogOpen(false);
      setRecordToDelete(null);
    }
  };

  const handleCancelDelete = () => {
    setDeleteDialogOpen(false);
    setRecordToDelete(null);
  };

  const handleSubmit = async (form) => {
    const payload = buildCashAndBankPayload(form);
    const existingId = currentRecord?.id ?? currentRecord?.Id;
    if (existingId) {
      await cashAndBankApi.update(existingId, payload);
    } else {
      await cashAndBankApi.create(payload);
    }
    await fetchRecords(pageNumber, pageSize);
    handleCloseForm();
  };

  const visibleTableRows = useMemo(() => tableRows, [tableRows]);

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
        width: "48px",
        Cell: ({ value }) => renderCollectionsGridSno(value),
      },
      {
        id: "acctId",
        Header: "Acct ID",
        accessor: "acctIdDisplay",
        align: "left",
        Cell: ({ value }) => value,
      },
      {
        id: "name",
        Header: "Name",
        accessor: "name",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "controlAccount",
        Header: "Control Account",
        accessor: "controlAccount",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "currency",
        Header: "Currency",
        accessor: "currency",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "mode",
        Header: "Mode",
        accessor: "mode",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "iban",
        Header: "IBAN",
        accessor: "iban",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "bank",
        Header: "Bank",
        accessor: "bank",
        align: "left",
        Cell: ({ value }) => txt(value),
      },
      {
        id: "status",
        Header: "Status",
        accessor: "status",
        align: "left",
        Cell: ({ value }) => renderStatusLabel(value),
      },
      {
        id: "balance",
        Header: "Balance",
        accessor: "balance",
        align: "right",
        Cell: BalanceCell,
      },
    ],
    []
  );

  const computedRows = useMemo(
    () =>
      visibleTableRows.map((row, index) => {
        const flat = flattenCashAndBankForGrid(
          row,
          (pageNumber - 1) * pageSize + index,
          coaLabelById,
          bankLabelById
        );
        const recordId = flat.id;
        const rowMode = String(flat.mode || "")
          .trim()
          .toUpperCase();
        const isParentTrRow =
          !routeFilters.parentId && rowMode === "TR" && flat.parentCashAndBankId == null;
        const hasTrChildren = isParentTrRow && Number(flat.childCount || 0) > 0;
        const displayName = hasTrChildren ? flat.parentName : flat.name;
        const referencedByTransfer = Boolean(flat.isReferencedByInterAccTransfer);
        return {
          ...flat,
          name: displayName,
          acctIdHasLink: hasTrChildren,
          acctIdDisplay: (
            <AcctIdLinkCell
              value={flat.acctId}
              hasLink={hasTrChildren}
              parentId={recordId}
              parentAcctId={flat.acctId}
              parentName={flat.parentName}
            />
          ),
          actions: (
            <MDBox sx={COLLECTIONS_GRID_ACTION_BOX_SX}>
              {canEditCurrentMenu() && (
                <IconButton
                  size="small"
                  color="info"
                  onClick={() => handleEditRecord(recordId)}
                  title="Edit"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">edit</Icon>
                </IconButton>
              )}
              {canDeleteCurrentMenu() && !referencedByTransfer && (
                <IconButton
                  size="small"
                  color="error"
                  onClick={() => handleDeleteRecord(recordId)}
                  title="Delete"
                  sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                >
                  <Icon fontSize="small">delete</Icon>
                </IconButton>
              )}
              {canDeleteCurrentMenu() && referencedByTransfer && (
                <Tooltip title="Used in inter-account transfer records. Delete those transfers first.">
                  <span>
                    <IconButton
                      size="small"
                      color="error"
                      disabled
                      sx={COLLECTIONS_GRID_ICON_BUTTON_SX}
                    >
                      <Icon fontSize="small">delete</Icon>
                    </IconButton>
                  </span>
                </Tooltip>
              )}
            </MDBox>
          ),
        };
      }),
    [visibleTableRows, pageNumber, pageSize, coaLabelById, bankLabelById, routeFilters.parentId]
  );

  const displayTotal = routeFilters.parentId
    ? visibleTableRows.length
    : totalCount > 0
    ? totalCount
    : visibleTableRows.length;
  const workspaceMetadata = useMemo(
    () =>
      buildWorkspaceRecordMetrics({
        total: displayTotal,
        page: pageNumber,
        pageSize,
      }),
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
        title="Cash & Bank"
        subtitle={
          routeFilters.parentId
            ? `TR child records for ${routeFilters.parentAcctId || "parent"}${
                routeFilters.parentName ? ` (${routeFilters.parentName})` : ""
              }`
            : "Manage cash and bank ledger accounts"
        }
        metadata={workspaceMetadata}
        tabs={<CashFundFlowModuleTabs />}
        actions={
          !routeFilters.parentId && canCreateCurrentMenu() ? (
            <MDButton variant="outlined" color="dark" onClick={handleOpenForm}>
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
              alignItems: "center",
              flexShrink: 0,
              width: "100%",
            }}
          />

          <DataTable
            table={{ columns, rows: computedRows }}
            isSorted={false}
            stickyToolbarAndHeader
            entriesPerPage={{
              defaultValue: 50,
              entries: [10, 25, 50, 100, 500],
            }}
            page={pageNumber - 1}
            pageSize={pageSize}
            onPageChange={(newPage) => {
              setPageNumber(newPage + 1);
            }}
            onEntriesPerPageChange={(value) => {
              setPageSize(value);
              setPageNumber(1);
            }}
            showTotalEntries={false}
            noEndBorder
            canSearch
            exportFileName="Cash-And-Bank"
            contentFitTable
            disableHeaderMetrics
            paginationFooter={serverPaginationFooter}
            paginationHost={paginationHost}
          />
          <WorkspaceLoadingOverlay active={loading} />
        </MDBox>
      </EnterpriseWorkspace>

      <CashAndBankForm
        open={openForm}
        onClose={handleCloseForm}
        onSubmit={handleSubmit}
        initialData={currentRecord}
      />

      <Dialog open={deleteDialogOpen} onClose={handleCancelDelete}>
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <MDTypography>Are you sure you want to delete this record?</MDTypography>
        </DialogContent>
        <DialogActions>
          <MDButton onClick={handleCancelDelete}>Cancel</MDButton>
          <MDButton onClick={handleConfirmDelete} color="error" disabled={!canDeleteCurrentMenu()}>
            Delete
          </MDButton>
        </DialogActions>
      </Dialog>
    </DashboardLayout>
  );
}
