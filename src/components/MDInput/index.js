/**
=========================================================
* Material Dashboard 2 React - v2.2.0
=========================================================

* Product Page: https://www.creative-tim.com/product/material-dashboard-react
* Copyright 2023 Creative Tim (https://www.creative-tim.com)

Coded by www.creative-tim.com

 =========================================================

* The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
*/

import { forwardRef, useMemo, useState } from "react";

// prop-types is a library for typechecking of props
import PropTypes from "prop-types";

// Custom styles for MDInput
import MDInputRoot from "components/MDInput/MDInputRoot";
import SelectSearchField from "components/SearchableSelect/SelectSearchField";
import {
  countSelectableMenuItems,
  filterMenuChildren,
  mergeSearchableMenuProps,
} from "components/SearchableSelect/searchableSelectUtils";

const MDInput = forwardRef(
  ({ error, success, disabled, select, children, SelectProps, ...rest }, ref) => {
    const [searchTerm, setSearchTerm] = useState("");

    const menuItemCount = useMemo(() => countSelectableMenuItems(children), [children]);
    const isSearchable = Boolean(select) && menuItemCount >= 2;

    const filteredChildren = useMemo(
      () => (isSearchable ? filterMenuChildren(children, searchTerm) : children),
      [children, isSearchable, searchTerm]
    );

    const enhancedSelectProps = useMemo(() => {
      if (!isSearchable) return SelectProps;

      const baseSelectProps = SelectProps ?? {};
      return {
        ...baseSelectProps,
        MenuProps: mergeSearchableMenuProps(baseSelectProps.MenuProps, true),
        onOpen: (event) => {
          setSearchTerm("");
          baseSelectProps.onOpen?.(event);
        },
        onClose: (event) => {
          setSearchTerm("");
          baseSelectProps.onClose?.(event);
        },
      };
    }, [SelectProps, isSearchable]);

    if (select) {
      return (
        <MDInputRoot
          {...rest}
          select
          ref={ref}
          ownerState={{ error, success, disabled }}
          SelectProps={enhancedSelectProps}
        >
          {isSearchable ? <SelectSearchField value={searchTerm} onChange={setSearchTerm} /> : null}
          {isSearchable ? filteredChildren : children}
        </MDInputRoot>
      );
    }

    return <MDInputRoot {...rest} ref={ref} ownerState={{ error, success, disabled }} />;
  }
);

// Setting default values for the props of MDInput
MDInput.defaultProps = {
  error: false,
  success: false,
  disabled: false,
};

// Typechecking props for the MDInput
MDInput.propTypes = {
  error: PropTypes.bool,
  success: PropTypes.bool,
  disabled: PropTypes.bool,
  select: PropTypes.bool,
  children: PropTypes.node,
  SelectProps: PropTypes.object,
};

export default MDInput;
