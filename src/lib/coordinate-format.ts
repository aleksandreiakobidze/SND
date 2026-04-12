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

export function formatTableCellDisplay(value: unknown, columnKey: string): string {
  if (value === null || value === undefined) return "-";
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
