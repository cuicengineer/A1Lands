import TransactionWorkspace from "layouts/accounts/receipts/TransactionWorkspace";
import { RECEIPTS_LABELS } from "layouts/accounts/receipts/transactionLabels";

export default function Receipts() {
  return <TransactionWorkspace labels={RECEIPTS_LABELS} useReceiptApi />;
}
