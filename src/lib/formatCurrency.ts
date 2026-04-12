/** Compact currency for dashboard KPIs and charts (GEL). */
export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `₾${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `₾${(value / 1_000).toFixed(1)}K`;
  return `₾${value.toFixed(0)}`;
}
