import PropTypes from "prop-types";
import { AgreementProvInvoiceEditDialog } from "layouts/contracts/agreement-prov-invoice/agreement-prov-invoice";

function CollectionRecordViewDialogs({ invoiceRowData, onCloseInvoice }) {
  return (
    <AgreementProvInvoiceEditDialog
      open={Boolean(invoiceRowData)}
      onClose={onCloseInvoice}
      rowData={invoiceRowData}
      viewMode
      saving={false}
    />
  );
}

CollectionRecordViewDialogs.propTypes = {
  invoiceRowData: PropTypes.object,
  onCloseInvoice: PropTypes.func.isRequired,
};

CollectionRecordViewDialogs.defaultProps = {
  invoiceRowData: null,
};

export default CollectionRecordViewDialogs;
