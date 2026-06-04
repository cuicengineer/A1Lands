import PropTypes from "prop-types";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import Icon from "@mui/material/Icon";

/** Tiny Excel export control for KPI chart cards (stops click propagation for zoom surfaces). */
function ChartExportButton({ onExport, disabled, ariaLabel }) {
  return (
    <Tooltip title="Export to Excel">
      <span>
        <IconButton
          size="small"
          disabled={disabled}
          aria-label={ariaLabel || "Export chart data to Excel"}
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            onExport?.();
          }}
          sx={{
            p: 0.25,
            flexShrink: 0,
            "& .MuiIcon-root": { fontSize: "1rem" },
          }}
        >
          <Icon fontSize="inherit">file_download</Icon>
        </IconButton>
      </span>
    </Tooltip>
  );
}

ChartExportButton.propTypes = {
  onExport: PropTypes.func,
  disabled: PropTypes.bool,
  ariaLabel: PropTypes.string,
};

ChartExportButton.defaultProps = {
  onExport: undefined,
  disabled: false,
  ariaLabel: undefined,
};

export default ChartExportButton;
