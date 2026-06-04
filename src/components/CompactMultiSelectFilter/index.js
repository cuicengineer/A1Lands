/**
 * Fixed-height multi-select filter — summary on trigger, full selection in popover.
 * Visual only; onChange receives the next selected value array.
 */

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Icon from "@mui/material/Icon";

const COMPACT_FILTER_POPOVER_PAPER_SX = {
  mt: 0.5,
  minWidth: 180,
  maxWidth: 260,
  maxHeight: 320,
  overflow: "auto",
  bgcolor: "background.paper",
  backgroundImage: "none",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
  border: "1px solid",
  borderColor: "divider",
};

const COMPACT_FILTER_MENU_ITEM_SX = {
  py: 0.25,
  minHeight: 34,
  bgcolor: "background.paper",
  "&:hover": {
    bgcolor: "action.hover",
  },
};

function formatSummary(label, selectedCount, totalCount) {
  if (selectedCount === 0 || selectedCount === totalCount) return label;
  if (selectedCount === 1) return `${label} (1)`;
  return `${label} (${selectedCount})`;
}

function CompactMultiSelectFilter({
  label,
  options,
  value,
  onChange,
  allValue,
  getOptionLabel,
  isOptionEqualToValue,
}) {
  const [anchorEl, setAnchorEl] = useState(null);

  const optionList = useMemo(() => options.filter((opt) => opt !== allValue), [options, allValue]);

  const summary = useMemo(
    () => formatSummary(label, value.length, optionList.length),
    [label, value.length, optionList.length]
  );

  const allSelected = optionList.length > 0 && value.length === optionList.length;

  const handleToggleAll = () => {
    onChange(allSelected ? [] : [...optionList]);
  };

  const handleToggle = (option) => {
    const equals = isOptionEqualToValue || ((a, b) => a === b);
    const isSelected = value.some((v) => equals(v, option));
    if (isSelected) {
      onChange(value.filter((v) => !equals(v, option)));
    } else {
      onChange([...value, option]);
    }
  };

  const resolveLabel = (option) => {
    if (option === allValue) return "All";
    return getOptionLabel ? getOptionLabel(option) : String(option ?? "");
  };

  return (
    <>
      <Button
        className="compact-filter-trigger"
        size="small"
        variant="outlined"
        color="inherit"
        onClick={(event) => setAnchorEl(event.currentTarget)}
        endIcon={<Icon sx={{ fontSize: "1rem !important" }}>expand_more</Icon>}
        sx={{
          textTransform: "none",
          fontWeight: 500,
          fontSize: "0.8125rem",
          lineHeight: 1,
          minHeight: 32,
          maxHeight: 32,
          height: 32,
          py: 0,
          px: 1.25,
          borderColor: "#e5e5e5",
          color: "#171717",
          whiteSpace: "nowrap",
          maxWidth: 120,
          overflow: "hidden",
          textOverflow: "ellipsis",
          flexShrink: 0,
          boxShadow: "none",
        }}
      >
        {summary}
      </Button>
      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          className: "compact-filter-popover",
          sx: { ...COMPACT_FILTER_POPOVER_PAPER_SX, minWidth: 180, maxWidth: 260 },
        }}
      >
        {allValue != null ? (
          <MenuItem dense onClick={handleToggleAll} sx={COMPACT_FILTER_MENU_ITEM_SX}>
            <Checkbox size="small" checked={allSelected} sx={{ p: 0.5, mr: 0.75 }} tabIndex={-1} />
            <ListItemText
              primary="All"
              primaryTypographyProps={{
                fontSize: "0.8125rem",
                fontWeight: allSelected ? 600 : 400,
              }}
            />
          </MenuItem>
        ) : null}
        {optionList.map((option) => {
          const equals = isOptionEqualToValue || ((a, b) => a === b);
          const checked = value.some((v) => equals(v, option));
          return (
            <MenuItem
              key={resolveLabel(option)}
              dense
              onClick={() => handleToggle(option)}
              sx={COMPACT_FILTER_MENU_ITEM_SX}
            >
              <Checkbox size="small" checked={checked} sx={{ p: 0.5, mr: 0.75 }} tabIndex={-1} />
              <ListItemText
                primary={resolveLabel(option)}
                primaryTypographyProps={{
                  fontSize: "0.8125rem",
                  fontWeight: checked ? 600 : 400,
                }}
              />
            </MenuItem>
          );
        })}
      </Popover>
    </>
  );
}

CompactMultiSelectFilter.propTypes = {
  label: PropTypes.string.isRequired,
  options: PropTypes.array.isRequired,
  value: PropTypes.array.isRequired,
  onChange: PropTypes.func.isRequired,
  allValue: PropTypes.oneOfType([PropTypes.string, PropTypes.number, PropTypes.bool]),
  getOptionLabel: PropTypes.func,
  isOptionEqualToValue: PropTypes.func,
};

CompactMultiSelectFilter.defaultProps = {
  allValue: null,
  getOptionLabel: null,
  isOptionEqualToValue: null,
};

export default CompactMultiSelectFilter;
