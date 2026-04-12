/** Compact liters for charts (no currency). */
export function formatLiters(value: number): string {
  if (!Number.isFinite(value)) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M L`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k L`;
  return `${value.toFixed(0)} L`;
}
