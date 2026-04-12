/**
 * When both code and name columns are present, ensure code comes before name
 * (ItemCode/ItemName; IdProd/Product — preserves all other columns’ relative order).
 */
function moveCodeBeforeName(keys: string[], codeLc: string, nameLc: string): string[] {
  const codeKey = keys.find((k) => k.toLowerCase() === codeLc);
  const nameKey = keys.find((k) => k.toLowerCase() === nameLc);
  if (!codeKey || !nameKey) return keys;

  const iCode = keys.indexOf(codeKey);
  const iName = keys.indexOf(nameKey);
  if (iCode < iName) return keys;

  const without = keys.filter((k) => k !== codeKey && k !== nameKey);
  const insertAt = iName;
  return [...without.slice(0, insertAt), codeKey, nameKey, ...without.slice(insertAt)];
}

export function orderKeysItemCodeBeforeItemName(keys: string[]): string[] {
  let out = keys;
  out = moveCodeBeforeName(out, "itemcode", "itemname");
  out = moveCodeBeforeName(out, "idprod", "product");
  return out;
}
