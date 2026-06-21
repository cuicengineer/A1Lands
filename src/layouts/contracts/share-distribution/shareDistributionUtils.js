import {
  formatAgreementLabel,
  formatTenantBusinessLabel,
  pickField,
} from "layouts/income-agreements/collections/collectionsUtils";
import { resolveBaseNameById } from "layouts/dashboard/kpi-overview/kpiOverviewNavigation";
import { formatDateDDMMMYYYY } from "utils/dateFormatter";

export const SHARE_DISTRIBUTION_HEADER_COLORS = {
  identity: "#1b5e20",
  financial: "#90caf9",
  rent: "#c8e6c9",
  receipt: "#ffccbc",
  share: "#fff59d",
  workbook: "#1b5e20",
};

function unwrapList(response) {
  if (!response) return [];
  if (Array.isArray(response)) return response;
  if (Array.isArray(response?.data)) return response.data;
  if (Array.isArray(response?.items)) return response.items;
  return [];
}

export function unwrapContractsResponse(response) {
  return unwrapList(response);
}

function parseNumber(value) {
  if (value == null || value === "") return null;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : null;
}

export function formatShareDistributionNumber(value) {
  const n = parseNumber(value);
  if (n == null) return "";
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

export function formatShareDistributionPercent(value) {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.includes("%")) return raw;
  const n = parseNumber(raw);
  if (n == null) return raw;
  const pct = Math.abs(n) <= 1 ? n * 100 : n;
  return `${pct.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

export function formatShareDistributionDate(value) {
  if (!value) return "";
  return formatDateDDMMMYYYY(value);
}

function findTenant(tenants, row) {
  const tenantNo = String(pickField(row, "tenantNo", "TenantNo") || "").trim();
  if (!tenantNo) return null;
  return (
    tenants.find((t) => String(pickField(t, "tenantNo", "TenantNo") || "").trim() === tenantNo) ||
    null
  );
}

function mergeContractRow(primary, catalogRow) {
  if (!catalogRow) return primary || {};
  return { ...catalogRow, ...primary };
}

export function isFinalizedContract(row) {
  if (!row) return false;
  const approval = pickField(
    row,
    "approvalStatus",
    "ApprovalStatus",
    "ApprovedStatus",
    "approvedStatus"
  );
  return approval === true || approval === 1 || approval === "1";
}

export function resolveShareDistributionBaseLabel(row, bases = []) {
  const baseId = pickField(row, "baseId", "BaseId", "BaseID", "baseID");
  const fromCatalog = resolveBaseNameById(bases, baseId);
  if (fromCatalog) return fromCatalog;

  const text = String(
    pickField(row, "baseName", "BaseName", "BaseLabel", "baseLabel", "Base", "base") || ""
  ).trim();
  if (!text) return "";

  const asNum = Number(text);
  if (Number.isFinite(asNum) && String(asNum) === text) {
    return resolveBaseNameById(bases, asNum) || text;
  }
  return text;
}

export function buildShareDistributionRows({ asOfRows, contractRows, tenants, bases = [] }) {
  const contractById = new Map();
  const contractByNo = new Map();
  contractRows.forEach((row) => {
    const id = pickField(row, "id", "Id");
    const contractNo = String(pickField(row, "contractNo", "ContractNo") || "").trim();
    if (id != null && id !== "") contractById.set(Number(id), row);
    if (contractNo) contractByNo.set(contractNo, row);
  });

  const sourceRows = asOfRows.length > 0 ? asOfRows : contractRows;

  return sourceRows
    .map((raw, index) => {
      const id = pickField(raw, "id", "Id");
      const contractNo = String(pickField(raw, "contractNo", "ContractNo") || "").trim();
      const catalog =
        (id != null && contractById.get(Number(id))) ||
        (contractNo && contractByNo.get(contractNo)) ||
        null;
      const row = mergeContractRow(raw, catalog);
      const tenant = findTenant(tenants, row);

      const caArea1 = pickField(row, "vaArea", "VaArea", "groupArea", "GroupArea");
      const caArea2 = pickField(
        row,
        "groupArea",
        "GroupArea",
        "totalArea",
        "TotalArea",
        "vaArea",
        "VaArea"
      );

      return {
        id: id ?? `${contractNo || "row"}-${index}`,
        base: resolveShareDistributionBaseLabel(row, bases),
        caId: formatAgreementLabel(row),
        tenantAndBusiness: formatTenantBusinessLabel(row, tenant),
        caArea1: formatShareDistributionNumber(caArea1),
        caArea2: formatShareDistributionNumber(caArea2),
        revenueRate: formatShareDistributionNumber(
          pickField(
            row,
            "groupRate",
            "GroupRate",
            "totalRate",
            "TotalRate",
            "revenueRate",
            "RevenueRate"
          )
        ),
        rrFy: pickField(row, "rrfy", "RRFY", "Rrfy", "fiscal", "Fiscal"),
        rentalValue: formatShareDistributionNumber(pickField(row, "rentalValue", "RentalValue")),
        annualRent: formatShareDistributionNumber(
          pickField(row, "initialRentPA", "InitialRentPA", "annualRent", "AnnualRent")
        ),
        currentRentPA: formatShareDistributionNumber(
          pickField(
            row,
            "currentRentPA",
            "CurrentRentPA",
            "currRentPA",
            "CurrRentPA",
            "currentRentPA"
          )
        ),
        govtSharePA: formatShareDistributionNumber(
          pickField(row, "govtShare", "GovtShare", "govtSharePA", "GovtSharePA")
        ),
        receiptDate: formatShareDistributionDate(
          pickField(row, "receiptDate", "ReceiptDate", "lastReceiptDate", "LastReceiptDate")
        ),
        receiptAmount: formatShareDistributionNumber(
          pickField(
            row,
            "receiptAmount",
            "ReceiptAmount",
            "paid",
            "Paid",
            "paidAmount",
            "PaidAmount"
          )
        ),
        ratio: formatShareDistributionPercent(
          pickField(
            row,
            "ratio",
            "Ratio",
            "shareRatio",
            "ShareRatio",
            "rentalValueRatePercent",
            "RentalValueRatePercent"
          )
        ),
        govt: formatShareDistributionNumber(
          pickField(
            row,
            "govt",
            "Govt",
            "govtShareAmount",
            "GovtShareAmount",
            "govtShare",
            "GovtShare"
          )
        ),
        paf: formatShareDistributionNumber(
          pickField(row, "paf", "PAF", "pafShare", "PAFShare", "pafShareAmount", "PAFShareAmount")
        ),
        ahq: formatShareDistributionNumber(
          pickField(row, "ahq", "AHQ", "ahqShare", "AHQShare", "ahqShareAmount", "AHQShareAmount")
        ),
        rac: formatShareDistributionNumber(
          pickField(row, "rac", "RAC", "racShare", "RACShare", "racShareAmount", "RACShareAmount")
        ),
        baseShare: formatShareDistributionNumber(
          pickField(row, "baseShare", "BaseShare", "baseShareAmount", "BaseShareAmount")
        ),
        workbook: pickField(
          row,
          "workbook",
          "Workbook",
          "workbookId",
          "WorkbookId",
          "wbId",
          "WBID"
        ),
        __isFinalized: isFinalizedContract(row),
      };
    })
    .filter((row) => row.__isFinalized)
    .map(({ __isFinalized, ...row }) => row);
}
