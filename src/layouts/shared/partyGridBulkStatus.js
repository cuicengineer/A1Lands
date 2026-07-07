import { useCallback, useState } from "react";

import PropTypes from "prop-types";

import Checkbox from "@mui/material/Checkbox";

import Icon from "@mui/material/Icon";

import IconButton from "@mui/material/IconButton";

import Menu from "@mui/material/Menu";

import MenuItem from "@mui/material/MenuItem";

import Tooltip from "@mui/material/Tooltip";

import MDBox from "components/MDBox";

import MDTypography from "components/MDTypography";

import StatusBadge from "components/StatusBadge";

import { normalizePartyStatus } from "utils/partyStatusUtils";

function PartyGridStatusHeader({
  canEdit,
  saving,
  allRowIds,
  selectedRowIds,
  bulkStatusValue,
  onToggleAll,
  onStatusSelect,
  onSave,
}) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const ids = (allRowIds || []).map((id) => String(id)).filter(Boolean);
  const allSelected = ids.length > 0 && ids.every((id) => selectedRowIds.has(id));
  const someSelected = ids.some((id) => selectedRowIds.has(id)) && !allSelected;
  const statusLabel =
    bulkStatusValue === "true" ? "Active" : bulkStatusValue === "false" ? "Inactive" : "";

  const handleStatusPick = (value) => {
    onStatusSelect(value);
    setMenuAnchor(null);
  };

  return (
    <MDBox display="flex" alignItems="center" gap={0.25} sx={{ minWidth: 96 }}>
      {canEdit ? (
        <Checkbox
          size="small"
          checked={allSelected}
          indeterminate={someSelected}
          onChange={() => onToggleAll(ids)}
          disabled={saving || ids.length === 0}
          inputProps={{ "aria-label": "Select all rows" }}
          sx={{ p: 0, mr: 0.25 }}
        />
      ) : null}
      <MDTypography variant="caption" fontWeight="medium" color="secondary" sx={{ flexShrink: 0 }}>
        Status
      </MDTypography>
      {canEdit ? (
        <>
          <Tooltip title={statusLabel ? `Status: ${statusLabel}` : "Choose Active or Inactive"}>
            <span>
              <IconButton
                size="small"
                onClick={(e) => setMenuAnchor(e.currentTarget)}
                disabled={saving || selectedRowIds.size === 0}
                sx={{ p: 0.25 }}
                aria-label="Choose status"
              >
                <Icon fontSize="small">arrow_drop_down</Icon>
              </IconButton>
            </span>
          </Tooltip>
          <Menu
            anchorEl={menuAnchor}
            open={Boolean(menuAnchor)}
            onClose={() => setMenuAnchor(null)}
            anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
            transformOrigin={{ vertical: "top", horizontal: "left" }}
          >
            <MenuItem
              selected={bulkStatusValue === "true"}
              onClick={() => handleStatusPick("true")}
            >
              Active
            </MenuItem>
            <MenuItem
              selected={bulkStatusValue === "false"}
              onClick={() => handleStatusPick("false")}
            >
              Inactive
            </MenuItem>
          </Menu>
          <Tooltip title="Save status for selected rows">
            <span>
              <IconButton
                size="small"
                color="info"
                onClick={onSave}
                disabled={saving || selectedRowIds.size === 0 || bulkStatusValue === ""}
                sx={{ p: 0.25 }}
                aria-label="Save status"
              >
                <Icon fontSize="small">save</Icon>
              </IconButton>
            </span>
          </Tooltip>
        </>
      ) : null}
    </MDBox>
  );
}

PartyGridStatusHeader.propTypes = {
  canEdit: PropTypes.bool,
  saving: PropTypes.bool,
  allRowIds: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.number, PropTypes.string])),
  selectedRowIds: PropTypes.instanceOf(Set).isRequired,
  bulkStatusValue: PropTypes.string,
  onToggleAll: PropTypes.func.isRequired,
  onStatusSelect: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
};

PartyGridStatusHeader.defaultProps = {
  canEdit: false,
  saving: false,
  allRowIds: [],
  bulkStatusValue: "",
};

function PartyGridStatusCell({ row, selectedRowIds, onToggle, disabled, showCheckbox }) {
  const id = row?.original?.id;

  return (
    <MDBox display="flex" alignItems="center" gap={0.5}>
      {showCheckbox && id != null ? (
        <Checkbox
          size="small"
          checked={selectedRowIds.has(String(id))}
          onChange={() => onToggle(id)}
          disabled={disabled}
          inputProps={{ "aria-label": `Select row ${id}` }}
          sx={{ p: 0 }}
        />
      ) : null}
      <StatusBadge value={row?.original?.statusRaw} />
    </MDBox>
  );
}

PartyGridStatusCell.propTypes = {
  row: PropTypes.shape({
    original: PropTypes.shape({
      id: PropTypes.oneOfType([PropTypes.number, PropTypes.string]),
      statusRaw: PropTypes.oneOfType([PropTypes.bool, PropTypes.string, PropTypes.number]),
    }),
  }),
  selectedRowIds: PropTypes.instanceOf(Set).isRequired,
  onToggle: PropTypes.func.isRequired,
  disabled: PropTypes.bool,
  showCheckbox: PropTypes.bool,
};

PartyGridStatusCell.defaultProps = {
  row: undefined,
  disabled: false,
  showCheckbox: false,
};

export function usePartyGridBulkStatus({ canEdit, bulkUpdateStatus, onRefresh }) {
  const [selectedRowIds, setSelectedRowIds] = useState(() => new Set());
  const [bulkStatusValue, setBulkStatusValue] = useState("");
  const [saving, setSaving] = useState(false);

  const toggleRowSelection = useCallback((id) => {
    const key = String(id);
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleAllRowsSelection = useCallback((rowIds) => {
    const ids = (rowIds || []).map((id) => String(id)).filter(Boolean);
    setSelectedRowIds((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        ids.forEach((id) => next.delete(id));
        return next;
      }
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedRowIds(new Set());
    setBulkStatusValue("");
  }, []);

  const handleBulkStatusSave = useCallback(async () => {
    if (!canEdit) return;
    if (selectedRowIds.size === 0 || bulkStatusValue === "") {
      window.alert("Select one or more rows and choose Active or Inactive before saving.");
      return;
    }

    const status = normalizePartyStatus(bulkStatusValue === "true");
    const ids = Array.from(selectedRowIds).map((id) => Number(id));
    const label = status ? "Active" : "Inactive";

    if (!window.confirm(`Set ${ids.length} selected record(s) to ${label}?`)) return;

    setSaving(true);
    try {
      await bulkUpdateStatus(ids, status);
      clearSelection();
      await onRefresh?.();
    } catch (error) {
      window.alert(error?.message || "Failed to update status.");
    } finally {
      setSaving(false);
    }
  }, [bulkStatusValue, bulkUpdateStatus, canEdit, clearSelection, onRefresh, selectedRowIds]);

  const buildStatusColumn = useCallback(
    (allRowIds) => ({
      id: "status",
      Header: () => (
        <PartyGridStatusHeader
          canEdit={canEdit}
          saving={saving}
          allRowIds={allRowIds}
          selectedRowIds={selectedRowIds}
          bulkStatusValue={bulkStatusValue}
          onToggleAll={toggleAllRowsSelection}
          onStatusSelect={setBulkStatusValue}
          onSave={handleBulkStatusSave}
        />
      ),
      accessor: "status",
      align: "left",
      disableSortBy: true,
      width: "132px",
      Cell: (cellProps) => (
        <PartyGridStatusCell
          row={cellProps.row}
          selectedRowIds={selectedRowIds}
          onToggle={toggleRowSelection}
          disabled={!canEdit || saving}
          showCheckbox={canEdit}
        />
      ),
    }),
    [
      bulkStatusValue,
      canEdit,
      handleBulkStatusSave,
      saving,
      selectedRowIds,
      toggleAllRowsSelection,
      toggleRowSelection,
    ]
  );

  // Legacy no-op: row selection lives in the status column (avoids stale call-site errors).
  const buildSelectColumn = useCallback(() => null, []);

  return {
    selectedRowIds,
    buildStatusColumn,
    buildSelectColumn,
    clearSelection,
  };
}
