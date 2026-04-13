import { formatCurrency } from "@/lib/formatCurrency";
import { formatLiters } from "@/lib/formatLiters";

export type ChartNumberStyle = "compact" | "full";

/** Full-precision GEL for tooltips and “full” mode. */
export function formatCurrencyFull(value: number): string {
  if (!Number.isFinite(value)) return "₾0";
  return `₾${value.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

/** Full-precision liters for tooltips and “full” mode. */
export function formatLitersFull(value: number): string {
  if (!Number.isFinite(value)) return "0 L";
  const maxFrac = Math.abs(value) >= 100 ? 1 : 2;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: maxFrac })} L`;
}

/** Compact GEL — delegates to shared KPI formatter. */
export function formatCurrencyCompact(value: number): string {
  return formatCurrency(value);
}

/** Compact liters — BI-style; uppercase K for thousands. */
export function formatLitersCompact(value: number): string {
  if (!Number.isFinite(value)) return "0 L";
  const v = Math.abs(value);
  if (v >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M L`;
  if (v >= 1_000) return `${(value / 1_000).toFixed(1)}K L`;
  if (v >= 100) return `${value.toFixed(1)} L`;
  return `${value.toLocaleString(undefined, { maximumFractionDigits: 2 })} L`;
}

/** Axis + data labels: compact or full based on user preference. */
export function formatAxisForMeasure(
  measure: "money" | "liters",
  style: ChartNumberStyle,
): (v: number) => string {
  if (style === "full") {
    return measure === "money" ? formatCurrencyFull : formatLitersFull;
  }
  return measure === "money" ? formatCurrencyCompact : formatLitersCompact;
}

/** Tooltip should always show the most precise business value. */
export function formatTooltipForMeasure(measure: "money" | "liters"): (v: number) => string {
  return measure === "money" ? formatCurrencyFull : formatLitersFull;
}

/** Default FlexChart formatter when parent does not pass one (GEL compact). */
export function defaultChartValueFormat(value: number): string {
  return formatCurrencyCompact(value);
}
