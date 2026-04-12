/**
 * Footer subtotals: only **quantity** and **amount** columns (not price, rates, IDs, etc.).
 * Sums use all provided rows (e.g. filtered, not paginated).
 */

function parseCellNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;
  if (value instanceof Date) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const n = Number(s.replace(/,/g, "").replace(/^\s*[₾$€£]\s*/, ""));
  return Number.isFinite(n) ? n : null;
}

const ID_LIKE_KEY =
  /^(id|idonlinereal|idreal|zedd|factura|nom|phone|sagad|orgcode|waybill|hash|uuid|guid)$/i;

/** Quantity / line count fields (e.g. Raod, Qty). */
function isQuantityColumnKey(key: string): boolean {
  const k = key.trim();
  if (k.length === 0 || ID_LIKE_KEY.test(k)) return false;
  return (
    /^liters$/i.test(k) ||
    /^tevadoba/i.test(k) ||
    /^raod$/i.test(k) ||
    /^qty$/i.test(k) ||
    /^qnt$/i.test(k) ||
    /\b(quantity|raod|qty|qnt|units?|linecount|line_count|orderedqty|order_qty|ordered\s*qty)\b/i.test(
      k,
    )
  );
}

/** Money / amount fields (e.g. Tanxa, Amount, Revenue). Not unit price or rates. */
function isAmountColumnKey(key: string): boolean {
  const k = key.trim();
  if (k.length === 0 || ID_LIKE_KEY.test(k)) return false;
  if (/^tevadoba/i.test(k)) return false;
  if (
    /\b(price|fasi|unitprice|unit_price|perunit|per_unit|margin|markup|rate|percent|pct|avg|average)\b/i.test(
      k,
    )
  ) {
    return false;
  }
  // Order *count* is not a sum of line qty / amount
  if (/^orders$/i.test(k)) return false;

  // CamelCase / English totals: LineTotal, BrutoTotal, NetAmount, …
  if (/(Amount|Total|Sum|Revenue|Tanxa|Money|Lari)$/i.test(k)) {
    if (/^(date|time|price|unit|avg)/i.test(k)) return false;
    if (/\bpercent|ratio|share\b/i.test(k)) return false;
    return true;
  }

  return (
    /^amount$/i.test(k) ||
    /^tanxa$/i.test(k) ||
    /^revenue$/i.test(k) ||
    /^sum$/i.test(k) ||
    /^total$/i.test(k) ||
    /^lari$/i.test(k) ||
    /^money$/i.test(k) ||
    /\b(amount|tanxa|revenue|money|payment|balance|debit|credit|lari|subtotal|grandtotal|ordertotal|order_total|totalamount|netamount|grossamount|lineamount|net\s*amount|gross\s*amount)\b/i.test(
      k,
    ) ||
    /order[-_]?total|grand[-_]?total|total[-_]?amount/i.test(k)
  );
}

export function isSummableColumn(key: string, rows: Record<string, unknown>[]): boolean {
  if (rows.length === 0) return false;
  if (!isQuantityColumnKey(key) && !isAmountColumnKey(key)) return false;

  let numeric = 0;
  for (const row of rows) {
    const n = parseCellNumber(row[key]);
    if (n !== null) numeric++;
  }
  return numeric > 0;
}

export function sumColumn(rows: Record<string, unknown>[], key: string): number {
  let s = 0;
  for (const row of rows) {
    const n = parseCellNumber(row[key]);
    if (n !== null) s += n;
  }
  return s;
}

export function computeColumnTotals(
  keys: string[],
  rows: Record<string, unknown>[],
): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  for (const key of keys) {
    out[key] = isSummableColumn(key, rows) ? sumColumn(rows, key) : null;
  }
  return out;
}
