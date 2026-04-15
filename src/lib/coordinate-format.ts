/**
 * Lon/Lat columns: show full fractional digits as stored (no 2-decimal rounding).
 */
export function isLonLatColumnKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  return (
    k === "lon" ||
    k === "lat" ||
    k === "lan" ||
    k === "longitude" ||
    k === "latitude"
  );
}

export function formatDateLikeLabel(value: unknown): string {
  if (value instanceof Date && Number.isFinite(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  const s = String(value ?? "").trim();
  if (!s) return "";
  const isoLike = /^(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?$/i.exec(s);
  if (isoLike) return isoLike[1];
  const datePrefix = /^(\d{4}-\d{2}-\d{2})/.exec(s);
  if (datePrefix) return datePrefix[1];
  return s;
}

export type ColumnDisplayMeta = {
  semanticType?: "identifier" | "dimension" | "measure";
  format?: "text" | "number" | "money" | "liters";
};

const IDENTIFIER_KEY_RE =
  /(^|[^a-z])(id|code|orderno|orderno|invoice|invoiceno|documentno|docno|customerid|organizationid|orgid|itemcode|sku|barcode|serialno|voucherno|billno)([^a-z]|$)/i;

function normalizeColumnKey(key: string): string {
  return key.trim().replace(/[\s_\-]/g, "").toLowerCase();
}

export function isIdentifierLikeColumnKey(key: string): boolean {
  const normalized = normalizeColumnKey(key);
  if (!normalized) return false;
  if (normalized.startsWith("id")) return true;
  if (
    normalized.endsWith("id") ||
    normalized.endsWith("code") ||
    normalized.endsWith("no") ||
    normalized.endsWith("number")
  ) {
    return true;
  }
  return IDENTIFIER_KEY_RE.test(normalized);
}

export function shouldRenderAsText(columnKey: string, meta?: ColumnDisplayMeta): boolean {
  if (meta?.semanticType === "identifier" || meta?.format === "text") return true;
  return isIdentifierLikeColumnKey(columnKey);
}

export function formatTableCellDisplay(value: unknown, columnKey: string, meta?: ColumnDisplayMeta): string {
  if (value === null || value === undefined) return "-";
  if (shouldRenderAsText(columnKey, meta)) {
    return String(value);
  }
  if (typeof value === "number") {
    if (Number.isNaN(value)) return "-";
    if (isLonLatColumnKey(columnKey)) return String(value);
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (typeof value === "string" && isLonLatColumnKey(columnKey)) {
    const trimmed = value.trim();
    if (trimmed === "") return "-";
    return trimmed;
  }
  return String(value);
}
