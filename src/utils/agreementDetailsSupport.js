import api from "services/api.service";
import contractApi from "services/api.contract.service";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";

const CONTRACT_PAYMENT_TERM_OPTIONS = [
  { value: 1, label: "Monthly" },
  { value: 3, label: "Quarterly" },
  { value: 6, label: "Sixmonthly" },
  { value: 12, label: "Annual" },
];

function formatContractPaymentTermDisplay(months) {
  if (months === "" || months === null || months === undefined) return "";
  const n = Number(months);
  const match = CONTRACT_PAYMENT_TERM_OPTIONS.find((o) => o.value === n);
  if (match) return match.label;
  return String(months);
}

function formatContractSdRateDisplay(months) {
  if (months === "" || months === null || months === undefined) return "";
  const n = Number(months);
  if (!Number.isFinite(n)) return String(months);
  return `${n} Month${n === 1 ? "" : "s"}`;
}

function pickField(row, camelKey, pascalKey) {
  const v = row?.[camelKey] ?? row?.[pascalKey];
  return v === undefined || v === null ? "" : v;
}

export const AGREEMENT_DETAILS_COLUMNS = [
  { Header: "S.No", accessor: "id" },
  { Header: "Contract No", accessor: "contractNo" },
  { Header: "RAC", accessor: "cmdName" },
  { Header: "Base", accessor: "baseName" },
  { Header: "Class", accessor: "className" },
  { Header: "Grouping ID", accessor: "grpId" },
  { Header: "Current Rent PA", accessor: "initialRentPA" },
  { Header: "Viability", accessor: "feasible" },
  { Header: "Total Area (UoM)", accessor: "totalArea" },
  { Header: "Location", accessor: "location" },
  { Header: "UoM", accessor: "uoM" },
  { Header: "Unit", accessor: "unitName" },
  { Header: "Tenant No", accessor: "tenantNo" },
  { Header: "Business Name", accessor: "businessName" },
  { Header: "Nature of Business", accessor: "natureOfBusiness" },
  { Header: "Contract Start Date", accessor: "contractStartDate" },
  { Header: "Contract End Date", accessor: "contractEndDate" },
  { Header: "Commercial Operation Date", accessor: "commercialOperationDate" },
  { Header: "Initial Rent PM", accessor: "initialRentPM" },
  { Header: "Initial Rent PA", accessor: "initialRentPA" },
  { Header: "Payment Term", accessor: "paymentTermMonths" },
  { Header: "Term", accessor: "term" },
  { Header: "Increase Rate %", accessor: "increaseRatePercent" },
  { Header: "Increase Interval (Months)", accessor: "increaseIntervalMonths" },
  { Header: "SD Rate", accessor: "sdRateMonths" },
  { Header: "Security Deposit (Rs)", accessor: "securityDepositAmount" },
  { Header: "Contract State", accessor: "contractState" },
  { Header: "Rental Value", accessor: "rentalValue" },
  { Header: "CA Area", accessor: "vaArea" },
  { Header: "Group Rate", accessor: "groupRate" },
  { Header: "Govt Share", accessor: "govtShare" },
  { Header: "PAF Share", accessor: "pafShare" },
  { Header: "Rise Term Type", accessor: "riseTermType" },
  { Header: "Rise Term", accessor: "riseTerm" },
  { Header: "Rise Rate", accessor: "riseRate" },
  { Header: "Rise Date", accessor: "risedate" },
  { Header: "Invoice Date Type", accessor: "invoiceDateType" },
  { Header: "Status", accessor: "status" },
  { Header: "Approval", accessor: "approval" },
  { Header: "Invoices", accessor: "invoices" },
  { Header: "Description", accessor: "description" },
];

export function getAgreementDetailDisplayValue(col, rowData, context = {}) {
  const tenants = Array.isArray(context.tenants) ? context.tenants : [];
  const accessor = col?.accessor;
  const accessorKey = typeof accessor === "string" ? accessor : null;
  let value = accessorKey ? rowData[accessorKey] : undefined;
  if ((value === undefined || value === null) && accessorKey) {
    const pascal = accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1);
    value = rowData[pascal];
  }
  if ((value === undefined || value === null) && rowData?.original && accessorKey) {
    value = rowData.original[accessorKey];
    if (value === undefined || value === null) {
      value = rowData.original[accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)];
    }
  }
  if (accessor === "groupRate" || accessor === "totalRate") {
    value =
      rowData.GroupRate || rowData.groupRate || rowData.TotalRate || rowData.totalRate || value;
  }
  if (accessor === "grpId") return value || rowData?.GId || "-";
  if (accessor === "feasible") {
    const fromPayload = String(
      value ??
        rowData?.Viability ??
        rowData?.viability ??
        rowData?.Feasible ??
        rowData?.feasible ??
        ""
    )
      .trim()
      .toLowerCase();
    if (fromPayload === "viable" || fromPayload === "unviable") {
      return fromPayload === "viable" ? "Viable" : "Unviable";
    }
    const govt = Number(rowData?.GovtShare ?? rowData?.govtShare ?? 0);
    const paf = Number(rowData?.PAFShare ?? rowData?.pafShare ?? 0);
    return govt > paf ? "Viable" : "Unviable";
  }
  if (accessor === "totalArea") {
    const area = rowData?.TotalArea ?? rowData?.totalArea ?? value ?? 0;
    const uom = rowData?.UoM || rowData?.uoM || rowData?.unitName || rowData?.UnitName || "";
    if (!area && area !== 0) return "-";
    return uom ? `${Number(area).toLocaleString()} (${uom})` : Number(area).toLocaleString();
  }
  if (accessor === "paymentTermMonths") {
    const v = value ?? rowData?.PaymentTermMonths ?? rowData?.paymentTermMonths;
    return formatContractPaymentTermDisplay(v) || "-";
  }
  if (accessor === "sdRateMonths") {
    const v = value ?? rowData?.SDRateMonths ?? rowData?.SdRateMonths ?? rowData?.sdRateMonths;
    return formatContractSdRateDisplay(v) || "-";
  }
  if (accessor === "location") return rowData?.Location || rowData?.location || value || "-";
  if (accessor === "uoM") return value || rowData?.UoM || rowData?.unitName || "-";
  if (accessor === "unitName") return value || rowData?.UnitName || rowData?.UoM || "-";
  if (accessor === "tenantNo") {
    const tn = value || rowData?.TenantNo || rowData?.tenantNo || "";
    const tenant = tenants.find(
      (t) => String(t?.tenantNo ?? t?.TenantNo ?? "").trim() === String(tn).trim()
    );
    if (tenant) {
      const parts = [tn];
      if (tenant.ownerName || tenant.OwnerName) parts.push(tenant.ownerName || tenant.OwnerName);
      if (tenant.address || tenant.Address) parts.push(tenant.address || tenant.Address);
      return parts.join(" - ");
    }
    return tn || "-";
  }
  if (accessor === "contractState") {
    const state =
      rowData?.ContractState ??
      rowData?.contractState ??
      rowData?.ContractStatus ??
      rowData?.contractStatus ??
      value;
    return state ? String(state) : "-";
  }
  const dateCols = [
    "contractStartDate",
    "contractEndDate",
    "commercialOperationDate",
    "risedate",
    "riseDate",
  ];
  if (dateCols.includes(accessor)) return formatDateDDMMMYYYY(value) || "-";
  const numCols = [
    "initialRentPM",
    "initialRentPA",
    "groupRate",
    "rentalValue",
    "vaArea",
    "govtShare",
    "pafShare",
    "securityDepositAmount",
    "riseRate",
  ];
  if (accessorKey && numCols.includes(accessorKey)) {
    const v = value ?? rowData?.[accessorKey.charAt(0).toUpperCase() + accessorKey.slice(1)];
    return v !== undefined && v !== null && v !== "" ? Number(v).toLocaleString() : "-";
  }
  if (accessor === "increaseRatePercent") return value ? `${value}%` : "-";
  if (accessor === "status") {
    return value === true || value === 1 || value === "Active" || value === "1"
      ? "Active"
      : "Inactive";
  }
  if (value === null || value === undefined || value === "") return "-";
  return String(value);
}

export async function resolveAgreementContract({ contractNo, contractId }) {
  const id = contractId != null && contractId !== "" ? Number(contractId) : null;
  if (Number.isFinite(id) && id > 0) {
    try {
      return await api.get("Contracts", id);
    } catch (error) {
      console.error("Error loading agreement by id:", error);
    }
  }
  const key = String(contractNo || "").trim();
  if (!key) return null;
  const response = await contractApi.getAllRecords();
  const list = response?.data ?? (Array.isArray(response) ? response : []);
  return (
    list.find(
      (c) =>
        String(c?.ContractNo ?? c?.contractNo ?? "")
          .trim()
          .toLowerCase() === key.toLowerCase()
    ) || null
  );
}

export async function fetchNormalizedContractRiseTerms(contractId) {
  const id = Number(contractId);
  if (!Number.isFinite(id) || id <= 0) return [];
  try {
    const response = await contractApi.getContractRiseTermsByContractId(id);
    const data = Array.isArray(response) ? response : response?.data || [];
    return data
      .filter((t) => !t.IsDeleted && t.IsDeleted !== true)
      .map((t) => {
        const monthsInterval = t.MonthsInterval ?? null;
        const risePercent = t.RisePercent ?? null;
        const sequenceNo = t.SequenceNo ?? null;
        const termId = t.Id ?? null;
        if (monthsInterval === null || risePercent === null || sequenceNo === null) return null;
        return {
          id: termId ? Number(termId) : null,
          monthsInterval: String(monthsInterval),
          risePercent: String(risePercent),
          sequenceNo: String(sequenceNo),
        };
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.sequenceNo) - Number(b.sequenceNo));
  } catch (error) {
    console.error("Error fetching agreement rise terms:", error);
    return [];
  }
}

export function filterAgreementDetailColumns(columns) {
  return (columns || []).filter(
    (col) =>
      col.accessor !== "actions" &&
      col.accessor !== "attachments" &&
      col.accessor !== "contractAttachments" &&
      col.accessor !== "contractAnnotations" &&
      col.accessor != null
  );
}
