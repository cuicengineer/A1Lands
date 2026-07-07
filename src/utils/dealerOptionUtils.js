import { buildCustomerCode, parseCustomerCode } from "layouts/customer/customerUtils";

export { buildCustomerCode as buildDealerCode, parseCustomerCode as parseDealerCode };

export function getDealerCodeOptionLabel(option) {
  const code = String(option?.code || "").trim();
  const name = String(option?.name || "").trim();
  if (code && name) return `${code} — ${name}`;
  return code || option?.label || "";
}

export function normalizeDealerFormOption(row, codePrefixOptions = []) {
  const id = row?.id ?? row?.Id;
  const codeRaw = String(row?.code ?? row?.Code ?? "").trim();
  const parsed = parseCustomerCode(codeRaw, codePrefixOptions);
  const code = buildCustomerCode(parsed.codeAlpha, parsed.codeNumeric) || codeRaw;
  const prefix = String(row?.prefix ?? row?.Prefix ?? "").trim();
  const name = String(row?.name ?? row?.Name ?? "").trim();
  const label = getDealerCodeOptionLabel({ code, name }) || "Unnamed dealer";

  return {
    id,
    label,
    code,
    codeAlpha: parsed.codeAlpha,
    codeNumeric: parsed.codeNumeric,
    prefix,
    rank: row?.rank ?? row?.Rank ?? "",
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
