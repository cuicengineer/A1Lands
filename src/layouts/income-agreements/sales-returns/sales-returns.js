import TransactionWorkspace from "layouts/accounts/receipts/TransactionWorkspace";
import { SALES_RETURNS_LABELS } from "layouts/income-agreements/transactionLabels";

export default function SalesReturns() {
  return <TransactionWorkspace labels={SALES_RETURNS_LABELS} incomeAgreementsModule />;
}
