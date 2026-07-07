import PropTypes from "prop-types";
import { AgreementProvInvoiceEditDialog } from "layouts/contracts/agreement-prov-invoice/agreement-prov-invoice";
import { TenantsForm } from "layouts/contracts/tenants/tenants";

function CollectionRecordViewDialogs({
  invoiceRowData,
  onCloseInvoice,
  tenantData,
  onCloseTenant,
}) {
  return (
    <>
      <AgreementProvInvoiceEditDialog
        open={Boolean(invoiceRowData)}
        onClose={onCloseInvoice}
        rowData={invoiceRowData}
        viewMode
        saving={false}
      />
      <TenantsForm
        open={Boolean(tenantData)}
        onClose={onCloseTenant}
        onSubmit={() => {}}
        initialData={tenantData}
        readOnly
      />
    </>
  );
}

CollectionRecordViewDialogs.propTypes = {
  invoiceRowData: PropTypes.object,
  onCloseInvoice: PropTypes.func.isRequired,
  tenantData: PropTypes.object,
  onCloseTenant: PropTypes.func.isRequired,
};

CollectionRecordViewDialogs.defaultProps = {
  invoiceRowData: null,
  tenantData: null,
};

export default CollectionRecordViewDialogs;
