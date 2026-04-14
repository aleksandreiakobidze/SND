/** Shared page sizes for agent report flat table and matrix views. */
export const REPORT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100, 250] as const;

export type ReportPageSize = (typeof REPORT_PAGE_SIZE_OPTIONS)[number];

export function coercePageSize(
  n: number,
  options: readonly number[] = REPORT_PAGE_SIZE_OPTIONS,
): ReportPageSize {
  if (!Number.isFinite(n) || n < 1) return (options[0] ?? 10) as ReportPageSize;
  const match = options.find((o) => o === n);
  if (match !== undefined) return match as ReportPageSize;
  let best = options[0] ?? 10;
  let bestDist = Math.abs(best - n);
  for (const o of options) {
    const d = Math.abs(o - n);
    if (d < bestDist) {
      best = o;
      bestDist = d;
    }
  }
  return best as ReportPageSize;
}
