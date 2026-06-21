import { forwardRef, useMemo, useState } from "react";
import PropTypes from "prop-types";
import MuiSelect from "@mui/material/Select";
import SelectSearchField from "components/SearchableSelect/SelectSearchField";
import {
  countSelectableMenuItems,
  filterMenuChildren,
  mergeSearchableMenuProps,
} from "components/SearchableSelect/searchableSelectUtils";

const SearchableSelect = forwardRef(function SearchableSelect(
  { children, MenuProps, onOpen, onClose, searchable, searchPlaceholder, ...rest },
  ref
) {
  const [searchTerm, setSearchTerm] = useState("");

  const menuItemCount = useMemo(() => countSelectableMenuItems(children), [children]);
  const isSearchable = searchable !== false && menuItemCount >= 2;

  const filteredChildren = useMemo(
    () => (isSearchable ? filterMenuChildren(children, searchTerm) : children),
    [children, isSearchable, searchTerm]
  );

  const mergedMenuProps = useMemo(
    () => mergeSearchableMenuProps(MenuProps, isSearchable),
    [MenuProps, isSearchable]
  );

  const handleOpen = (event) => {
    setSearchTerm("");
    onOpen?.(event);
  };

  const handleClose = (event) => {
    setSearchTerm("");
    onClose?.(event);
  };

  return (
    <MuiSelect
      {...rest}
      ref={ref}
      MenuProps={mergedMenuProps}
      onOpen={handleOpen}
      onClose={handleClose}
    >
      {isSearchable ? (
        <SelectSearchField
          value={searchTerm}
          onChange={setSearchTerm}
          placeholder={searchPlaceholder}
        />
      ) : null}
      {isSearchable ? filteredChildren : children}
    </MuiSelect>
  );
});

SearchableSelect.propTypes = {
  children: PropTypes.node,
  MenuProps: PropTypes.object,
  onOpen: PropTypes.func,
  onClose: PropTypes.func,
  searchable: PropTypes.bool,
  searchPlaceholder: PropTypes.string,
};

SearchableSelect.defaultProps = {
  children: null,
  MenuProps: undefined,
  onOpen: undefined,
  onClose: undefined,
  searchable: true,
  searchPlaceholder: "Search...",
};

export default SearchableSelect;
