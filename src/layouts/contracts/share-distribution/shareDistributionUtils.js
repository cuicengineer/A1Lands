import {
  formatAgreementLabel,
  formatTenantBusinessLabel,
  pickField,
} from "layouts/income-agreements/collections/collectionsUtils";
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

export function formatShareDistributionRatioDisplay(value) {
  if (value == null || value === "") return "";
  const raw = String(value).trim();
  if (!raw) return "";
  if (raw.includes("%")) return raw;

  return raw
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => {
      const formatted = formatShareDistributionNumber(part);
      return formatted ? `${formatted}%` : "";
    })
    .filter(Boolean)
    .join(" ");
}

export function formatShareDistributionDate(value) {
  if (!value) return "";
  return formatDateDDMMMYYYY(value);
}

export const SHARE_DIST_GRID_NUMERIC_TOTAL_COLUMNS = [
  "booArea",
  "revenueRate",
  "govtSharePA",
  "currentRentPA",
  "receiptAmount",
  "govt",
  "paf",
  "ahq",
  "rac",
  "baseShare",
];

export function sumShareDistributionGridRows(
  rows = [],
  columnKeys = SHARE_DIST_GRID_NUMERIC_TOTAL_COLUMNS
) {
  return columnKeys.reduce((totals, key) => {
    const sum = rows.reduce((acc, row) => {
      const n = parseNumber(row?.[key]);
      return n == null ? acc : acc + n;
    }, 0);
    totals[key] = sum ? formatShareDistributionNumber(sum) : "";
    return totals;
  }, {});
}

export function buildShareDistributionGridTotalRow(totals = {}) {
  return {
    id: "__share-dist-grid-total__",
    workbook: "",
    sn: "",
    racName: "",
    base: "Total",
    className: "",
    agreement: "",
    tenantAndBusiness: "",
    booArea: totals.booArea ?? "",
    rrFy: "",
    revenueRate: totals.revenueRate ?? "",
    govtSharePA: totals.govtSharePA ?? "",
    currentRentPA: totals.currentRentPA ?? "",
    receiptDate: "",
    receiptAmount: totals.receiptAmount ?? "",
    ratio: "",
    govt: totals.govt ?? "",
    paf: totals.paf ?? "",
    ahq: totals.ahq ?? "",
    rac: totals.rac ?? "",
    baseShare: totals.baseShare ?? "",
    __isTotalRow: true,
    __rowClassName: "share-dist-total-row",
    __rowStyle: {
      fontWeight: 700,
    },
  };
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

export function resolveShareDistributionBaseCode(bases, baseId) {
  const id = Number(baseId);
  if (!Number.isFinite(id) || id === 0) return "";
  const match = (bases || []).find((base) => Number(base?.id ?? base?.Id) === id);
  if (!match) return "";
  return String(match?.code ?? match?.Code ?? "").trim();
}

export function resolveShareDistributionBaseLabel(row, bases = []) {
  const baseId = pickField(row, "baseId", "BaseId", "BaseID", "baseID");
  const fromCatalog = resolveShareDistributionBaseCode(bases, baseId);
  if (fromCatalog) return fromCatalog;

  const text = String(
    pickField(
      row,
      "baseCode",
      "BaseCode",
      "baseName",
      "BaseName",
      "BaseLabel",
      "baseLabel",
      "Base",
      "base"
    ) || ""
  ).trim();
  if (!text) return "";

  const asNum = Number(text);
  if (Number.isFinite(asNum) && String(asNum) === text) {
    return resolveShareDistributionBaseCode(bases, asNum) || text;
  }
  return text;
}

export const SHARE_DIST_WORKBOOK_ROW_BG = "#f2f2f2";
export const SHARE_DIST_UNASSIGNED_ROW_BG = "#ffffff";

export function isShareDistributionWorkbookAssigned(row) {
  return Boolean(String(row?.workbook || "").trim());
}

export function getShareDistributionContractId(row = {}) {
  const contractId = pickField(row, "contractId", "ContractId");
  if (contractId != null && contractId !== "") {
    const parsed = Number(contractId);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }
  const legacyId = pickField(row, "id", "Id");
  if (legacyId == null || legacyId === "") return null;
  const parsed = Number(legacyId);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function getShareDistributionRowKey(row = {}) {
  if (row?.__isTotalRow) {
    return String(row.id || "__share-dist-grid-total__");
  }
  if (row?.isGroupRow) {
    return String(row.id || row.groupKey || "");
  }
  if (row?.selectionKey != null && row.selectionKey !== "") {
    return String(row.selectionKey);
  }
  const contractId = getShareDistributionContractId(row);
  if (contractId != null) {
    return `contract-${contractId}`;
  }
  const sn = pickField(row, "sn", "SN");
  if (sn != null && sn !== "") {
    return `row-${sn}`;
  }
  return String(row?.id ?? "");
}

export const SHARE_DIST_WORKBOOK_FILTER = {
  ALL: "all",
  ASSIGNED: "assigned",
  UNASSIGNED: "unassigned",
};

export const SHARE_DIST_GROUPING_COLUMN_OPTIONS = [
  { value: "workbook", label: "Workbook" },
  { value: "racName", label: "RAC Name" },
  { value: "base", label: "Base" },
  { value: "className", label: "Class" },
  { value: "agreement", label: "Agreement" },
  { value: "tenantAndBusiness", label: "Tenant and Business" },
  { value: "rrFy", label: "RR FY" },
  { value: "receiptDate", label: "Receipt Date" },
];

export const SHARE_DIST_DEFAULT_GROUP_BY_COLUMNS = [];

const SHARE_DIST_NUMERIC_GROUP_SUM_COLUMNS = new Set([
  "booArea",
  "revenueRate",
  "govtSharePA",
  "currentRentPA",
  "receiptAmount",
  "govt",
  "paf",
  "ahq",
  "rac",
  "baseShare",
]);

export function filterShareDistributionRowsByWorkbook(
  rows = [],
  filter = SHARE_DIST_WORKBOOK_FILTER.ALL
) {
  if (filter === SHARE_DIST_WORKBOOK_FILTER.ASSIGNED) {
    return rows.filter((row) => isShareDistributionWorkbookAssigned(row));
  }
  if (filter === SHARE_DIST_WORKBOOK_FILTER.UNASSIGNED) {
    return rows.filter((row) => !isShareDistributionWorkbookAssigned(row));
  }
  return rows;
}

function getShareDistributionGroupValue(row, columnKey) {
  const raw = row?.[columnKey];
  if (raw === null || raw === undefined || String(raw).trim() === "") return "-";
  return String(raw).trim();
}

function parseShareDistributionGridNumber(value) {
  if (value == null || value === "") return 0;
  const normalized = String(value).replace(/,/g, "").replace(/%/g, "").trim();
  if (!normalized) return 0;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function sumShareDistributionColumn(rows, columnKey) {
  const total = rows.reduce(
    (sum, row) => sum + parseShareDistributionGridNumber(row[columnKey]),
    0
  );
  return total ? formatShareDistributionNumber(total) : "";
}

function joinUniqueShareDistributionValues(rows, columnKey) {
  const values = new Set();
  rows.forEach((row) => {
    const text = String(row?.[columnKey] || "").trim();
    if (text) values.add(text);
  });
  return Array.from(values).sort().join(", ");
}

function resolveShareDistributionGroupColumnValue({
  columnKey,
  groupByColumns,
  firstRow,
  groupRows,
  groupLabel,
}) {
  if (groupByColumns.includes(columnKey)) {
    return firstRow?.[columnKey] ?? "";
  }
  if (SHARE_DIST_NUMERIC_GROUP_SUM_COLUMNS.has(columnKey)) {
    return sumShareDistributionColumn(groupRows, columnKey);
  }
  if (columnKey === "ratio") {
    return "";
  }
  if (columnKey === "workbook") {
    return joinUniqueShareDistributionValues(groupRows, columnKey);
  }
  if (columnKey === "base") {
    return joinUniqueShareDistributionValues(groupRows, columnKey) || groupLabel;
  }
  if (columnKey === "racName") {
    return joinUniqueShareDistributionValues(groupRows, columnKey);
  }
  return joinUniqueShareDistributionValues(groupRows, columnKey);
}

export function buildShareDistributionGroupedRows(
  rows = [],
  groupByColumns = [],
  expandedGroups = new Set()
) {
  if (!Array.isArray(groupByColumns) || groupByColumns.length === 0) {
    return rows.map((row) => ({
      ...row,
      isGroupRow: false,
      isExpandedRow: false,
    }));
  }

  const byKey = new Map();
  rows.forEach((row) => {
    const groupValues = groupByColumns.map((columnKey) =>
      getShareDistributionGroupValue(row, columnKey)
    );
    const key = groupValues.join(" || ");
    if (!byKey.has(key)) {
      const groupLabel = groupByColumns
        .map((columnKey, idx) => {
          const label =
            SHARE_DIST_GROUPING_COLUMN_OPTIONS.find((opt) => opt.value === columnKey)?.label ||
            columnKey;
          return `${label}: ${groupValues[idx]}`;
        })
        .join(" | ");
      byKey.set(key, { label: groupLabel, rows: [] });
    }
    byKey.get(key).rows.push(row);
  });

  const sortedKeys = Array.from(byKey.keys()).sort((keyA, keyB) => {
    const rowA = byKey.get(keyA).rows[0];
    const rowB = byKey.get(keyB).rows[0];
    return compareShareDistributionRows(rowA, rowB);
  });

  const result = [];
  let topSn = 0;

  sortedKeys.forEach((groupKey) => {
    const group = byKey.get(groupKey);
    const groupRows = sortShareDistributionRows(group.rows);
    const firstRow = groupRows[0];
    const isExpanded = expandedGroups.has(groupKey);
    const safeId = groupKey.replace(/[^a-zA-Z0-9_|.-]/g, "_");

    const groupRow = {
      ...firstRow,
      id: `group-${safeId}`,
      sn: ++topSn,
      isGroupRow: true,
      isExpandedRow: false,
      groupKey,
      groupLabel: group.label,
      groupRows,
      __rowClassName: "share-dist-group-row",
      __rowStyle: {
        backgroundColor: "#f8f9fa",
        fontWeight: 600,
      },
    };

    SHARE_DIST_GROUPING_COLUMN_OPTIONS.forEach(({ value: columnKey }) => {
      if (columnKey === "sn") return;
      groupRow[columnKey] = resolveShareDistributionGroupColumnValue({
        columnKey,
        groupByColumns,
        firstRow,
        groupRows,
        groupLabel: group.label,
      });
    });

    result.push(groupRow);

    if (isExpanded) {
      groupRows.forEach((row) => {
        result.push({
          ...row,
          isGroupRow: false,
          isExpandedRow: true,
          groupKey,
          __rowClassName: row.__rowClassName,
          __rowStyle: row.__rowStyle,
        });
      });
    }
  });

  return result;
}

function parseShareDistributionWorkbookSortKey(workbookNo = "") {
  const raw = String(workbookNo || "")
    .trim()
    .toUpperCase();
  if (!raw) {
    return { hasWorkbook: false, serial: 0, suffix: "", raw: "" };
  }
  const match = /^WB(\d+)-(.+)$/.exec(raw);
  if (!match) {
    return { hasWorkbook: true, serial: 0, suffix: "", raw };
  }
  return {
    hasWorkbook: true,
    serial: Number(match[1]) || 0,
    suffix: match[2] || "",
    raw,
  };
}

export function compareShareDistributionRows(a, b) {
  const aWb = parseShareDistributionWorkbookSortKey(a?.workbook);
  const bWb = parseShareDistributionWorkbookSortKey(b?.workbook);

  if (aWb.hasWorkbook !== bWb.hasWorkbook) {
    return aWb.hasWorkbook ? -1 : 1;
  }

  if (aWb.hasWorkbook && bWb.hasWorkbook) {
    if (aWb.serial !== bWb.serial) {
      return bWb.serial - aWb.serial;
    }
    if (aWb.suffix !== bWb.suffix) {
      return bWb.suffix.localeCompare(aWb.suffix);
    }
    if (aWb.raw !== bWb.raw) {
      return bWb.raw.localeCompare(aWb.raw);
    }
  }

  const dateCmp = String(b?.__sortReceiptDate || "").localeCompare(
    String(a?.__sortReceiptDate || "")
  );
  if (dateCmp !== 0) return dateCmp;

  return String(a?.caId || "").localeCompare(String(b?.caId || ""));
}

export function sortShareDistributionRows(rows = []) {
  return [...rows].sort(compareShareDistributionRows);
}

export function finalizeShareDistributionRows(rows = []) {
  return sortShareDistributionRows(rows).map((row, index, arr) => {
    const { __sortReceiptDate, ...rest } = row;
    const workbook = String(rest.workbook || "").trim();
    const prevWorkbook = index > 0 ? String(arr[index - 1].workbook || "").trim() : "";
    const hasWorkbook = Boolean(workbook);
    const startsNewWorkbookGroup = hasWorkbook && workbook !== prevWorkbook;

    return {
      ...rest,
      sn: index + 1,
      __rowStyle: {
        backgroundColor: hasWorkbook ? SHARE_DIST_WORKBOOK_ROW_BG : SHARE_DIST_UNASSIGNED_ROW_BG,
        ...(startsNewWorkbookGroup && index > 0 ? { boxShadow: "inset 0 2px 0 #bdbdbd" } : null),
      },
      __rowClassName: hasWorkbook ? "share-dist-workbook-row" : "share-dist-unassigned-row",
    };
  });
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

  const preparedRows = sourceRows
    .map((raw, index) => {
      const rawContractId = pickField(raw, "id", "Id", "contractId", "ContractId");
      const parsedContractId = Number(rawContractId);
      const contractId =
        Number.isFinite(parsedContractId) && parsedContractId > 0 ? parsedContractId : null;
      const contractNo = String(pickField(raw, "contractNo", "ContractNo") || "").trim();
      const catalog =
        (contractId != null && contractById.get(contractId)) ||
        (contractNo && contractByNo.get(contractNo)) ||
        null;
      const row = mergeContractRow(raw, catalog);
      const tenant = findTenant(tenants, row);
      const sn = pickField(raw, "sn", "SN") || index + 1;
      // Stable unique key per contract so checkbox selection matches workbook assignment grain.
      const selectionKey =
        contractId != null ? `contract-${contractId}` : `${contractNo || "row"}-${index}`;

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
        id: selectionKey,
        contractId,
        selectionKey,
        sn,
        racName: String(
          pickField(
            row,
            "racName",
            "RACName",
            "cmdName",
            "CmdName",
            "commandName",
            "CommandName"
          ) || ""
        ).trim(),
        base: resolveShareDistributionBaseLabel(row, bases),
        className:
          pickField(row, "class", "Class", "className", "ClassName", "classCode", "ClassCode") ||
          "",
        agreement:
          pickField(row, "agreement", "Agreement") ||
          pickField(row, "caId", "CAId") ||
          formatAgreementLabel(row),
        caId: pickField(row, "caId", "CAId") || formatAgreementLabel(row),
        tenantAndBusiness:
          pickField(row, "tenantAndBusiness", "TenantAndBusiness") ||
          formatTenantBusinessLabel(row, tenant),
        booArea: formatShareDistributionNumber(
          pickField(row, "booArea", "BoOArea", "caArea2", "CAArea2", "groupArea", "GroupArea")
        ),
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
        ratio: formatShareDistributionRatioDisplay(
          pickField(row, "ratio", "Ratio", "shareRatio", "ShareRatio")
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
        workbook: String(
          pickField(row, "workbook", "Workbook", "workbookId", "WorkbookId", "wbId", "WBID") || ""
        ).trim(),
        __sortReceiptDate: String(
          pickField(row, "receiptDate", "ReceiptDate", "lastReceiptDate", "LastReceiptDate") || ""
        ).slice(0, 10),
        __isFinalized: isFinalizedContract(row),
        __isFinalizedReceiptShareDistribution: Boolean(
          pickField(row, "receiptAmount", "ReceiptAmount")
        ),
      };
    })
    .filter((row) => row.__isFinalized || row.__isFinalizedReceiptShareDistribution)
    .map(({ __isFinalized, __isFinalizedReceiptShareDistribution, __sortReceiptDate, ...row }) => ({
      ...row,
      __sortReceiptDate,
    }));

  // One grid row per contract — prevents Create Workbook from appearing to bind
  // unselected sibling rows that shared the same ContractId.
  const uniqueByContract = [];
  const seenContractIds = new Set();
  preparedRows.forEach((row) => {
    const contractId = getShareDistributionContractId(row);
    if (contractId != null) {
      if (seenContractIds.has(contractId)) return;
      seenContractIds.add(contractId);
    }
    uniqueByContract.push(row);
  });

  return finalizeShareDistributionRows(uniqueByContract);
}
