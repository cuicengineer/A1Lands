import TransactionWorkspace from "layouts/accounts/receipts/TransactionWorkspace";
import { SHARE_DISTRIBUTIONS_LABELS } from "layouts/income-agreements/transactionLabels";

export default function ShareDistributions() {
  return <TransactionWorkspace labels={SHARE_DISTRIBUTIONS_LABELS} incomeAgreementsModule />;
}
