/**
 * Internal realization / order header & line IDs, plus common aliases such as
 * OrderID. Hidden from tables and chart inference by default unless the user
 * explicitly asks for them in the query.
 */
const TECHNICAL_ID_KEYS_LOWER = new Set([
  "idreal1",
  "idreal2",
  "idonlinereal1",
  "idonlinereal2",
  "orderid",
  "order_id",
  "orderheaderid",
  "order_header_id",
  "idorderheader",
  "id_order_header",
  "idorder",
  "id_order",
]);

export function isTechnicalIdColumnKey(key: string): boolean {
  return TECHNICAL_ID_KEYS_LOWER.has(key.trim().toLowerCase());
}

/** First object key that is not a technical ID (for default chart category axis). */
export function firstNonTechnicalColumnKey(row: Record<string, unknown>): string {
  const keys = Object.keys(row);
  const hit = keys.find((k) => !isTechnicalIdColumnKey(k));
  return hit ?? keys[0] ?? "name";
}

/** Numeric columns suitable as chart measures (excludes technical IDs). */
export function numericMeasureKeys(row: Record<string, unknown>, xKey: string): string[] {
  return Object.keys(row).filter(
    (k) =>
      k !== xKey &&
      typeof row[k] === "number" &&
      !isTechnicalIdColumnKey(k),
  );
}
