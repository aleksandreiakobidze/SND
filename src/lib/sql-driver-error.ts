/**
 * Flatten mssql/tedious / nested Error chains for API responses and logs.
 */
export function formatSqlDriverError(e: unknown): string {
  if (e == null) return "Unknown error";
  const parts: string[] = [];
  let cur: unknown = e;
  const seen = new Set<unknown>();
  let depth = 0;
  while (cur != null && depth < 8) {
    if (typeof cur === "object" && seen.has(cur)) break;
    if (typeof cur === "object") seen.add(cur);
    if (cur instanceof Error) {
      const n = (cur as { number?: number }).number;
      const code = (cur as { code?: string }).code;
      const line = [cur.message];
      if (n != null) line.push(`(SQL ${n})`);
      if (code) line.push(`[${code}]`);
      parts.push(line.join(" "));
      cur = (cur as { originalError?: unknown }).originalError;
    } else {
      parts.push(String(cur));
      break;
    }
    depth++;
  }
  return parts.join(" → ") || String(e);
}
