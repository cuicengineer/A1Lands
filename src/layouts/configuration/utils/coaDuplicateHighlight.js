export const DUPLICATE_ACCT_ROW_STYLE = { backgroundColor: "#fff3cd" };

function buildAcctCompositeKey(acctId, acctName) {
  const id = String(acctId ?? "")
    .trim()
    .toLowerCase();
  const name = String(acctName ?? "")
    .trim()
    .toLowerCase();
  if (!id && !name) return null;
  return `${id}\0${name}`;
}

export function getDuplicateAcctRowIds(rows) {
  const keyToIds = new Map();

  (rows || []).forEach((row) => {
    const key = buildAcctCompositeKey(row?.acctId, row?.acctName);
    if (!key) return;
    if (!keyToIds.has(key)) keyToIds.set(key, []);
    keyToIds.get(key).push(row?.id);
  });

  const duplicateIds = new Set();
  keyToIds.forEach((ids) => {
    if (ids.length > 1) {
      ids.forEach((id) => {
        if (id != null) duplicateIds.add(id);
      });
    }
  });

  return duplicateIds;
}
