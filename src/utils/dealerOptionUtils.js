import { buildCustomerCode, parseCustomerCode } from "layouts/customer/customerUtils";

export { buildCustomerCode as buildDealerCode, parseCustomerCode as parseDealerCode };

export function getDealerCodeOptionLabel(option) {
  const code = String(option?.code || "").trim();
  const rank = String(option?.rank || "").trim();
  const name = String(option?.name || "").trim();
  const parts = [code, rank, name].filter(Boolean);
  if (parts.length) return parts.join(" — ");
  return option?.label || "";
}

export function normalizeDealerFormOption(row, codePrefixOptions = []) {
  const id = row?.id ?? row?.Id;
  const codeRaw = String(row?.code ?? row?.Code ?? "").trim();
  const parsed = parseCustomerCode(codeRaw, codePrefixOptions);
  const code = buildCustomerCode(parsed.codeAlpha, parsed.codeNumeric) || codeRaw;
  const prefix = String(row?.prefix ?? row?.Prefix ?? "").trim();
  const rank = String(row?.rank ?? row?.Rank ?? "").trim();
  const name = String(row?.name ?? row?.Name ?? "").trim();
  const label = getDealerCodeOptionLabel({ code, rank, name }) || "Unnamed dealer";

  return {
    id,
    label,
    code,
    codeAlpha: parsed.codeAlpha,
    codeNumeric: parsed.codeNumeric,
    prefix,
    rank,
    name,
    address: row?.address ?? row?.Address ?? "",
    province: row?.province ?? row?.Province ?? "",
    city: row?.city ?? row?.City ?? "",
    ntnCnic: row?.ntnCnic ?? row?.NtnCnic ?? "",
    gstNo: row?.gstNo ?? row?.GSTNo ?? "",
    telNo: row?.telNo ?? row?.TelNo ?? "",
    mobileNo: row?.mobileNo ?? row?.MobileNo ?? "",
    representative: row?.representative ?? row?.Representative ?? "",
    bankListsId: row?.bankListsId ?? row?.BankListsId ?? "",
    iban: row?.iban ?? row?.IBAN ?? "",
    status: row?.status ?? row?.Status ?? true,
  };
}
