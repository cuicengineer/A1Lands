import { useMemo } from "react";
import PropTypes from "prop-types";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import {
  buildAgreementProvInvoiceDeepLink,
  buildCollectionGroupParentFields,
  buildTenantConfigDeepLink,
  formatAccountLabel,
  formatAgreementLabel,
  formatAmount,
  openAppRouteInNewTab,
  resolveCollectionInvoiceContext,
  resolveCollectionTenantNo,
} from "./collectionsUtils";

const COLLECTIONS_COLUMNS = [
  { label: "S.No", key: "sno", align: "center", width: "48px" },
  { label: "Class", key: "class", align: "left", width: "minmax(90px, 1fr)" },
  { label: "Agreement", key: "agreement", align: "left", width: "minmax(180px, 1.4fr)" },
  {
    label: "Tenant and Business",
    key: "tenantBusiness",
    align: "left",
    width: "minmax(200px, 1.6fr)",
  },
  { label: "Account", key: "account", align: "left", width: "minmax(150px, 1.2fr)" },
  { label: "Invoice", key: "invoice", align: "left", width: "minmax(180px, 1.4fr)" },
  { label: "Due", key: "due", align: "right", width: "minmax(80px, 0.8fr)" },
  { label: "Balance", key: "balance", align: "right", width: "minmax(80px, 0.8fr)" },
  { label: "Action", key: "actions", align: "center", width: "96px" },
];

const GRID_TEMPLATE = COLLECTIONS_COLUMNS.map((col) => col.width).join(" ");

const clickableLinkSx = {
  cursor: "pointer",
  color: "info.main",
  textDecoration: "underline",
  fontFamily: "inherit",
  fontSize: "inherit",
  lineHeight: "inherit",
  background: "none",
  border: "none",
  padding: 0,
  textAlign: "left",
  maxWidth: "100%",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  "&:hover": { opacity: 0.85 },
};

function ReadOnlyCell({ value, align = "left" }) {
  return (
    <MDTypography
      variant="caption"
      sx={{
        display: "block",
        width: "100%",
        textAlign: align,
        fontSize: "0.8125rem",
        lineHeight: 1.3,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {value || "—"}
    </MDTypography>
  );
}

ReadOnlyCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  align: PropTypes.string,
};

function ClickableLinkCell({ value, align = "left", onClick, disabled = false }) {
  const label = value || "—";
  if (disabled || !value || !onClick) {
    return <ReadOnlyCell value={label === "—" ? "" : label} align={align} />;
  }

  return (
    <MDTypography
      component="button"
      type="button"
      variant="caption"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      sx={{
        ...clickableLinkSx,
        display: "block",
        width: "100%",
        textAlign: align,
      }}
    >
      {label}
    </MDTypography>
  );
}

ClickableLinkCell.propTypes = {
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  align: PropTypes.string,
  onClick: PropTypes.func,
  disabled: PropTypes.bool,
};

function CollectionGroupRow({
  group,
  index,
  classOptions,
  contracts,
  invoices,
  tenants,
  coaById,
  canEdit,
  canDelete,
  saving,
  onOpenDialog,
  onDeleteGroup,
  gridRowSx,
  bodyCellSx,
}) {
  const parent = buildCollectionGroupParentFields(group, {
    contracts,
    tenants,
    coaOptions: Array.from(coaById.values()),
    invoices,
    classes: classOptions,
  });
  const selectedContract = parent.selectedContract;
  const tenantBusinessLabel = parent.tenantBusiness;
  const invoiceContext = resolveCollectionInvoiceContext(parent, selectedContract, invoices);
  const tenantNo = resolveCollectionTenantNo(parent, selectedContract, tenants);
  const agreementLabel = selectedContract ? formatAgreementLabel(selectedContract) : "";

  const handleOpenInvoice = () => {
    if (!invoiceContext.invoiceNo) return;
    openAppRouteInNewTab(
      buildAgreementProvInvoiceDeepLink(invoiceContext.contractNo, invoiceContext.invoiceNo)
    );
  };

  const handleOpenTenant = () => {
    if (!tenantNo) return;
    openAppRouteInNewTab(buildTenantConfigDeepLink(tenantNo));
  };

  return (
    <MDBox
      sx={{
        ...gridRowSx,
        "&:hover": { bgcolor: "rgba(0,0,0,0.02)" },
      }}
    >
      <MDBox sx={{ ...bodyCellSx, textAlign: "center", fontWeight: 600 }}>{index + 1}</MDBox>

      <MDBox sx={{ ...bodyCellSx, p: 0.5 }}>
        <ReadOnlyCell value={parent.className || parent.classId} />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, p: 0.5 }}>
        <ReadOnlyCell value={agreementLabel} />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, p: 0.5 }}>
        <ClickableLinkCell
          value={tenantBusinessLabel}
          onClick={handleOpenTenant}
          disabled={!tenantNo}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, p: 0.5 }}>
        <ReadOnlyCell
          value={parent.accountLabel || formatAccountLabel(coaById.get(Number(parent.coaId)))}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, p: 0.5 }}>
        <ClickableLinkCell
          value={invoiceContext.label}
          onClick={handleOpenInvoice}
          disabled={!invoiceContext.invoiceNo}
        />
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatAmount(parent.due)}
      </MDBox>

      <MDBox sx={{ ...bodyCellSx, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
        {formatAmount(parent.balance)}
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
        {canEdit && (
          <Tooltip title="Edit receipt lines">
            <span>
              <IconButton
                size="small"
                color="info"
                disabled={saving}
                onClick={() => onOpenDialog("edit", parent)}
                sx={{ padding: "2px" }}
              >
                <Icon fontSize="small">edit</Icon>
              </IconButton>
            </span>
          </Tooltip>
        )}
        {canEdit && (
          <Tooltip title="View receipt lines">
            <span>
              <IconButton
                size="small"
                color="secondary"
                disabled={saving}
                onClick={() => onOpenDialog("view", parent)}
                sx={{ padding: "2px" }}
              >
                <Icon fontSize="small">visibility</Icon>
              </IconButton>
            </span>
          </Tooltip>
        )}
        {canDelete && (
          <Tooltip title="Delete collection">
            <span>
              <IconButton
                size="small"
                color="error"
                disabled={saving}
                onClick={() => onDeleteGroup(parent.groupKey)}
                sx={{ padding: "2px" }}
              >
                <Icon fontSize="small">delete</Icon>
              </IconButton>
            </span>
          </Tooltip>
        )}
      </MDBox>
    </MDBox>
  );
}

CollectionGroupRow.propTypes = {
  group: PropTypes.object.isRequired,
  index: PropTypes.number.isRequired,
  classOptions: PropTypes.array.isRequired,
  contracts: PropTypes.array.isRequired,
  invoices: PropTypes.array.isRequired,
  tenants: PropTypes.array.isRequired,
  coaById: PropTypes.instanceOf(Map).isRequired,
  canEdit: PropTypes.bool,
  canDelete: PropTypes.bool,
  saving: PropTypes.bool,
  onOpenDialog: PropTypes.func.isRequired,
  onDeleteGroup: PropTypes.func.isRequired,
  gridRowSx: PropTypes.object.isRequired,
  bodyCellSx: PropTypes.object.isRequired,
};

function CollectionsGrid({
  groups,
  classOptions,
  contracts,
  invoices,
  tenants,
  coaById,
  canEdit,
  canDelete,
  saving,
  addDisabled,
  onOpenDialog,
  onDeleteGroup,
  onAddGroup,
}) {
  const gridRowSx = {
    display: "grid",
    gridTemplateColumns: GRID_TEMPLATE,
    width: "100%",
    alignItems: "center",
    columnGap: 0,
    minWidth: "1100px",
  };

  const cellBaseSx = {
    fontSize: "0.8125rem",
    lineHeight: 1.25,
    py: 0.75,
    px: 1,
    overflow: "hidden",
    boxSizing: "border-box",
  };

  const headerCellSx = {
    ...cellBaseSx,
    fontWeight: 700,
    fontSize: "0.75rem",
    bgcolor: "#c8e6c9",
    color: "#1b5e20",
    borderBottom: "1px solid rgba(0,0,0,0.12)",
    borderRight: "1px solid rgba(0,0,0,0.06)",
    whiteSpace: "nowrap",
  };

  const bodyCellSx = {
    ...cellBaseSx,
    borderBottom: "1px solid rgba(0,0,0,0.06)",
    borderRight: "1px solid rgba(0,0,0,0.04)",
  };

  const displayGroups = useMemo(() => groups || [], [groups]);

  return (
    <MDBox sx={{ display: "flex", flexDirection: "column", minHeight: 0, height: "100%" }}>
      <MDBox
        display="flex"
        alignItems="center"
        justifyContent="space-between"
        gap={1}
        mb={1}
        sx={{ flexShrink: 0 }}
      >
        <MDTypography variant="button" fontWeight="bold">
          Collection entries
        </MDTypography>
        {canEdit && (
          <Tooltip
            title={
              addDisabled
                ? "Finish the current new collection before adding another"
                : "Add collection"
            }
          >
            <span>
              <IconButton
                color="info"
                size="small"
                disabled={saving || addDisabled}
                onClick={onAddGroup}
                sx={{ border: "1px solid", borderColor: "info.main", borderRadius: 1, p: 0.35 }}
              >
                <Icon fontSize="small">add</Icon>
              </IconButton>
            </span>
          </Tooltip>
        )}
      </MDBox>

      <MDBox sx={{ flex: "1 1 0", minHeight: 0, overflow: "auto", border: "1px solid #e0e0e0" }}>
        <MDBox sx={gridRowSx}>
          {COLLECTIONS_COLUMNS.map((col) => (
            <MDBox
              key={col.key}
              sx={{
                ...headerCellSx,
                textAlign: col.align,
              }}
            >
              {col.label}
            </MDBox>
          ))}
        </MDBox>

        {displayGroups.length === 0 ? (
          <MDBox py={3} textAlign="center">
            <MDTypography variant="caption" color="text">
              No collection entries yet. Use Add to create one.
            </MDTypography>
          </MDBox>
        ) : (
          displayGroups.map((group, index) => (
            <CollectionGroupRow
              key={group.groupKey}
              group={group}
              index={index}
              classOptions={classOptions}
              contracts={contracts}
              invoices={invoices}
              tenants={tenants}
              coaById={coaById}
              canEdit={canEdit}
              canDelete={canDelete}
              saving={saving}
              onOpenDialog={onOpenDialog}
              onDeleteGroup={onDeleteGroup}
              gridRowSx={gridRowSx}
              bodyCellSx={bodyCellSx}
            />
          ))
        )}
      </MDBox>
    </MDBox>
  );
}

CollectionsGrid.propTypes = {
  groups: PropTypes.array.isRequired,
  classOptions: PropTypes.array.isRequired,
  contracts: PropTypes.array.isRequired,
  invoices: PropTypes.array.isRequired,
  tenants: PropTypes.array.isRequired,
  coaById: PropTypes.instanceOf(Map).isRequired,
  canEdit: PropTypes.bool,
  canDelete: PropTypes.bool,
  saving: PropTypes.bool,
  addDisabled: PropTypes.bool,
  onOpenDialog: PropTypes.func.isRequired,
  onDeleteGroup: PropTypes.func.isRequired,
  onAddGroup: PropTypes.func.isRequired,
};

CollectionsGrid.defaultProps = {
  canEdit: false,
  canDelete: false,
  saving: false,
  addDisabled: false,
};

export default CollectionsGrid;
