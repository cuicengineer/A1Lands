import TransactionWorkspace from "./TransactionWorkspace";
import { PAYMENTS_LABELS } from "./transactionLabels";

export default function Payments() {
  return <TransactionWorkspace labels={PAYMENTS_LABELS} usePaymentApi />;
}
