/**
 * Fixed-height Group By control — summary on trigger, full selection in popover.
 * Visual only; onChange receives array of selected option values.
 */

import { useMemo, useState } from "react";
import PropTypes from "prop-types";
import Button from "@mui/material/Button";
import Popover from "@mui/material/Popover";
import MenuItem from "@mui/material/MenuItem";
import Checkbox from "@mui/material/Checkbox";
import ListItemText from "@mui/material/ListItemText";
import Icon from "@mui/material/Icon";
import TextField from "@mui/material/TextField";
import MDBox from "components/MDBox";

const COMPACT_GROUP_BY_POPOVER_PAPER_SX = {
  mt: 0.5,
  minWidth: 200,
  maxWidth: 280,
  maxHeight: 320,
  overflow: "auto",
  bgcolor: "background.paper",
  backgroundImage: "none",
  boxShadow: "0 8px 24px rgba(15, 23, 42, 0.12)",
  border: "1px solid",
  borderColor: "divider",
};

const COMPACT_GROUP_BY_MENU_ITEM_SX = {
  py: 0.25,
  minHeight: 34,
  bgcolor: "background.paper",
  "&:hover": {
    bgcolor: "action.hover",
  },
};

function formatGroupBySummary(selectedOptions) {
  const count = selectedOptions.length;
  if (count === 0) return "Group By";
  if (count <= 3) {
    const joined = selectedOptions.map((o) => o.label).join(", ");
    if (joined.length <= 40) return joined;
  }
  return `Group By (${count})`;
}

function CompactGroupBySelect({ options, value, onChange, summaryMode }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  const filteredOptions = useMemo(() => {
    const term = searchTerm.toLowerCase().trim();
    if (!term) return options;
    return options.filter((opt) => opt.label.toLowerCase().includes(term));
  }, [options, searchTerm]);

  const selectedOptions = useMemo(
    () => options.filter((opt) => value.includes(opt.value)),
    [options, value]
  );

  const summary = useMemo(() => {
    if (summaryMode === "count") {
      return selectedOptions.length ? `${selectedOptions.length} Columns Selected` : "Group By";
    }
    if (summaryMode === "groupByCount") {
      return selectedOptions.length ? `Group By (${selectedOptions.length})` : "Group By";
    }
    return formatGroupBySummary(selectedOptions);
  }, [selectedOptions, summaryMode]);

  const handleToggle = (optionValue) => {
    const next = value.includes(optionValue)
      ? value.filter((v) => v !== optionValue)
      : [...value, optionValue];
    onChange(next);
  };

  return (
    <>
      <Button
        className="compact-group-by-trigger"
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
          maxWidth: 200,
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
        onClose={() => {
          setAnchorEl(null);
          setSearchTerm("");
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        PaperProps={{
          className: "compact-group-by-popover",
          sx: COMPACT_GROUP_BY_POPOVER_PAPER_SX,
        }}
      >
        {options.length >= 2 ? (
          <MDBox
            sx={{
              position: "sticky",
              top: 0,
              zIndex: 1,
              bgcolor: "background.paper",
              p: 1,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <TextField
              size="small"
              placeholder="Search..."
              fullWidth
              autoFocus
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            />
          </MDBox>
        ) : null}
        {filteredOptions.map((opt) => {
          const checked = value.includes(opt.value);
          return (
            <MenuItem
              key={opt.value}
              dense
              onClick={() => handleToggle(opt.value)}
              sx={COMPACT_GROUP_BY_MENU_ITEM_SX}
            >
              <Checkbox size="small" checked={checked} sx={{ p: 0.5, mr: 0.75 }} tabIndex={-1} />
              <ListItemText
                primary={opt.label}
                primaryTypographyProps={{ fontSize: "0.8125rem", fontWeight: checked ? 600 : 400 }}
              />
            </MenuItem>
          );
        })}
      </Popover>
    </>
  );
}

CompactGroupBySelect.propTypes = {
  options: PropTypes.arrayOf(
    PropTypes.shape({
      label: PropTypes.string.isRequired,
      value: PropTypes.string.isRequired,
    })
  ).isRequired,
  value: PropTypes.arrayOf(PropTypes.string).isRequired,
  onChange: PropTypes.func.isRequired,
  summaryMode: PropTypes.oneOf(["auto", "count", "groupByCount"]),
};

CompactGroupBySelect.defaultProps = {
  summaryMode: "auto",
};

export default CompactGroupBySelect;
