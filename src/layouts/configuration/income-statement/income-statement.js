import { Navigate } from "react-router-dom";

function IncomeStatement() {
  return <Navigate to="/configuration/chart-of-accounts" replace />;
}

export { default as IncomeStatementPanel } from "./IncomeStatementPanel";
export default IncomeStatement;
