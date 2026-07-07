import PropTypes from "prop-types";
import Checkbox from "@mui/material/Checkbox";
import Divider from "@mui/material/Divider";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import MDBox from "components/MDBox";
import MDInput from "components/MDInput";
import MDTypography from "components/MDTypography";
import { COLLECTIONS_TOGGLEABLE_COLUMNS } from "./collectionGridShared";

function CollectionGridColumnsMenu({
  anchorEl,
  open,
  onClose,
  hiddenColumnKeys,
  onToggleColumn,
  onShowAllColumns,
  search,
  onSearchChange,
}) {
  const hidden = new Set(hiddenColumnKeys || []);
  const query = String(search || "")
    .trim()
    .toLowerCase();
  const filteredColumns = COLLECTIONS_TOGGLEABLE_COLUMNS.filter((col) => {
    if (!query) return true;
    return String(col.label || col.key)
      .toLowerCase()
      .includes(query);
  });

  return (
    <Menu
      anchorEl={anchorEl}
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: 260,
          maxHeight: 360,
        },
      }}
      MenuListProps={{
        dense: true,
        onClick: (e) => e.stopPropagation(),
      }}
    >
      <MDBox px={1.5} py={1} onClick={(e) => e.stopPropagation()}>
        <MDInput
          placeholder="Search columns..."
          size="small"
          fullWidth
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
        />
      </MDBox>
      <Divider />
      <MenuItem
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onShowAllColumns?.();
        }}
      >
        <Checkbox size="small" checked={hidden.size === 0} />
        <MDTypography variant="button" sx={{ fontSize: "0.85rem" }}>
          (Show All)
        </MDTypography>
      </MenuItem>
      <Divider />
      {filteredColumns.map((col) => {
        const checked = !hidden.has(col.key);
        return (
          <MenuItem
            key={col.key}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onToggleColumn?.(col.key);
            }}
          >
            <Checkbox size="small" checked={checked} />
            <MDTypography variant="button" sx={{ fontSize: "0.85rem" }}>
              {col.label || col.key}
            </MDTypography>
          </MenuItem>
        );
      })}
    </Menu>
  );
}

CollectionGridColumnsMenu.propTypes = {
  anchorEl: PropTypes.object,
  open: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
  hiddenColumnKeys: PropTypes.arrayOf(PropTypes.string),
  onToggleColumn: PropTypes.func.isRequired,
  onShowAllColumns: PropTypes.func.isRequired,
  search: PropTypes.string,
  onSearchChange: PropTypes.func,
};

CollectionGridColumnsMenu.defaultProps = {
  anchorEl: null,
  open: false,
  hiddenColumnKeys: [],
  search: "",
  onSearchChange: undefined,
};

export default CollectionGridColumnsMenu;
