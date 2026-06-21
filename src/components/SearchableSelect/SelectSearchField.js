import PropTypes from "prop-types";
import ListSubheader from "@mui/material/ListSubheader";
import TextField from "@mui/material/TextField";

function SelectSearchField({ value, onChange, placeholder }) {
  return (
    <ListSubheader
      sx={{
        position: "sticky",
        top: 0,
        zIndex: 1,
        bgcolor: "background.paper",
        lineHeight: "normal",
        py: 1,
        px: 1.5,
      }}
    >
      <TextField
        size="small"
        placeholder={placeholder}
        fullWidth
        autoFocus
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Escape") {
            event.stopPropagation();
          }
        }}
        onClick={(event) => event.stopPropagation()}
      />
    </ListSubheader>
  );
}

SelectSearchField.propTypes = {
  value: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
  placeholder: PropTypes.string,
};

SelectSearchField.defaultProps = {
  placeholder: "Search...",
};

export default SelectSearchField;
