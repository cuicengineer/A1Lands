import PropTypes from "prop-types";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Grid from "@mui/material/Grid";
import Icon from "@mui/material/Icon";
import IconButton from "@mui/material/IconButton";
import Card from "@mui/material/Card";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableRow from "@mui/material/TableRow";
import MDBox from "components/MDBox";
import MDTypography from "components/MDTypography";
import MDButton from "components/MDButton";
import CurrencyLoading from "components/CurrencyLoading";
import {
  filterAgreementDetailColumns,
  getAgreementDetailDisplayValue,
} from "utils/agreementDetailsSupport";

function resolveColumnHeader(col) {
  if (typeof col?.Header === "string") {
    return col.Header === "Actions" ? "Action" : col.Header;
  }
  if (col?.id) return String(col.id);
  if (col?.accessor) return String(col.accessor);
  return "";
}

function resolveFieldDisplayValue(col, rowData, displayContext) {
  const accessor = col?.accessor;
  const accessorKey = typeof accessor === "string" ? accessor : null;
  let value = accessorKey ? rowData[accessorKey] : undefined;
  if ((value === undefined || value === null) && accessorKey) {
    value = rowData[accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)];
  }

  if (col.Cell) {
    try {
      return col.Cell({ value, row: { original: rowData.original || rowData } });
    } catch {
      return getAgreementDetailDisplayValue(col, rowData, displayContext);
    }
  }

  if (typeof value === "number") return value.toLocaleString();
  if (value === null || value === undefined || value === "") {
    return getAgreementDetailDisplayValue(col, rowData, displayContext);
  }
  return getAgreementDetailDisplayValue(col, rowData, displayContext);
}

function AgreementDetailsDialog({
  open,
  onClose,
  contractDetails,
  columns,
  riseTerms,
  loadingRiseTerms,
  displayContext,
  footerActions,
}) {
  const detailColumns = filterAgreementDetailColumns(columns);
  const contractNo = contractDetails?.ContractNo || contractDetails?.contractNo || "-";

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <MDBox display="flex" justifyContent="space-between" alignItems="center">
          <MDBox>
            <MDTypography variant="h5" fontWeight="bold" sx={{ mb: 0.5 }}>
              Agreement Details
            </MDTypography>
            {contractDetails && (
              <MDTypography variant="body2" color="text" fontWeight="medium">
                Contract No: {contractNo}
              </MDTypography>
            )}
          </MDBox>
          <IconButton onClick={onClose} size="small" aria-label="Close agreement details">
            <Icon>close</Icon>
          </IconButton>
        </MDBox>
      </DialogTitle>
      <DialogContent dividers sx={{ maxHeight: "70vh", overflowY: "auto" }}>
        {contractDetails ? (
          <MDBox>
            <Grid container spacing={2} sx={{ mt: 1 }}>
              {detailColumns.map((col) => {
                const accessor = col.accessor;
                const displayValue = resolveFieldDisplayValue(col, contractDetails, displayContext);
                return (
                  <Grid item xs={12} sm={6} md={4} key={String(accessor || col.id)}>
                    <MDBox
                      sx={{
                        p: 1.5,
                        borderRadius: 1,
                        backgroundColor: "rgba(0, 0, 0, 0.02)",
                        border: "1px solid rgba(0, 0, 0, 0.05)",
                        transition: "all 0.2s ease",
                        "&:hover": {
                          backgroundColor: "rgba(0, 0, 0, 0.04)",
                          borderColor: "rgba(0, 0, 0, 0.1)",
                        },
                      }}
                    >
                      <MDTypography
                        variant="caption"
                        color="text"
                        fontWeight="bold"
                        sx={{ display: "block", mb: 0.5 }}
                      >
                        {resolveColumnHeader(col)}:
                      </MDTypography>
                      <MDTypography variant="body2" fontWeight="regular" color="text">
                        {displayValue}
                      </MDTypography>
                    </MDBox>
                  </Grid>
                );
              })}
            </Grid>

            {loadingRiseTerms ? (
              <MDBox display="flex" justifyContent="center" py={3} mt={3}>
                <CurrencyLoading size={40} />
              </MDBox>
            ) : riseTerms.length > 0 ? (
              <MDBox mt={4}>
                <MDTypography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                  Existing Rise Terms
                </MDTypography>
                <Card sx={{ boxShadow: "0 2px 8px rgba(0,0,0,0.1)", borderRadius: 2 }}>
                  <MDBox p={2}>
                    <TableContainer sx={{ maxHeight: "400px", overflowY: "auto" }}>
                      <Table size="small" sx={{ borderCollapse: "collapse" }}>
                        <thead
                          style={{
                            position: "sticky",
                            top: 0,
                            zIndex: 1,
                            backgroundColor: "#f5f5f5",
                          }}
                        >
                          <TableRow>
                            <TableCell sx={{ fontWeight: 600 }}>Sequence No</TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Months Interval</TableCell>
                            <TableCell align="right" sx={{ fontWeight: 600 }}>
                              Rise Percent (%)
                            </TableCell>
                          </TableRow>
                        </thead>
                        <TableBody>
                          {riseTerms.map((term, index) => (
                            <TableRow key={term.id || index}>
                              <TableCell>
                                <MDTypography variant="body2" fontWeight="medium">
                                  {term.sequenceNo}
                                </MDTypography>
                              </TableCell>
                              <TableCell>
                                <MDTypography variant="body2">{term.monthsInterval}</MDTypography>
                              </TableCell>
                              <TableCell align="right">
                                <MDTypography variant="body2" fontWeight="bold" color="primary">
                                  {term.risePercent}%
                                </MDTypography>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </MDBox>
                </Card>
              </MDBox>
            ) : null}
          </MDBox>
        ) : null}
      </DialogContent>
      <DialogActions>
        {footerActions || (
          <MDButton onClick={onClose} color="secondary">
            Close
          </MDButton>
        )}
      </DialogActions>
    </Dialog>
  );
}

AgreementDetailsDialog.defaultProps = {
  contractDetails: null,
  columns: [],
  riseTerms: [],
  loadingRiseTerms: false,
  displayContext: {},
  footerActions: null,
};

AgreementDetailsDialog.propTypes = {
  open: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired,
  contractDetails: PropTypes.object,
  columns: PropTypes.arrayOf(PropTypes.object),
  riseTerms: PropTypes.arrayOf(PropTypes.object),
  loadingRiseTerms: PropTypes.bool,
  displayContext: PropTypes.object,
  footerActions: PropTypes.node,
};

export default AgreementDetailsDialog;
