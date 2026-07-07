import customerApi from "services/api.customer.service";
import supplierApi from "services/api.supplier.service";
import { normalizePartyStatus } from "utils/partyStatusUtils";

function isNotFoundError(error) {
  return String(error?.message || "").includes("HTTP 404");
}

function isActiveParty(record) {
  if (!record) return false;
  return normalizePartyStatus(record.status ?? record.Status);
}

async function getCustomerByCodeSafe(code, excludeId) {
  try {
    return await customerApi.getByCode(code, excludeId);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

async function getSupplierByCodeSafe(code, excludeId) {
  try {
    return await supplierApi.getByCode(code, excludeId);
  } catch (error) {
    if (isNotFoundError(error)) return null;
    throw error;
  }
}

export async function lookupPartyCodeForCustomerForm(code, { excludeId } = {}) {
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) return { type: "clear" };

  const existingCustomer = await getCustomerByCodeSafe(normalizedCode, excludeId);
  if (existingCustomer && isActiveParty(existingCustomer)) {
    return {
      type: "duplicate",
      message: "Cannot create duplicate customer. This code already exists for an active customer.",
    };
  }

  return { type: "clear" };
}

export async function lookupPartyCodeForSupplierForm(code, { excludeId } = {}) {
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) return { type: "clear" };

  const existingSupplier = await getSupplierByCodeSafe(normalizedCode, excludeId);
  if (existingSupplier && isActiveParty(existingSupplier)) {
    return {
      type: "duplicate",
      message: "Cannot create duplicate supplier. This code already exists for an active supplier.",
    };
  }

  return { type: "clear" };
}
