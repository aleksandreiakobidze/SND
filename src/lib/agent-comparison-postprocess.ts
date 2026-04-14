import { isTechnicalIdColumnKey } from "@/lib/technical-columns";
import type { ChartComparisonMeta, ChartConfig } from "@/types";
import type { ComparisonIntentResult } from "@/lib/agent-comparison-intent";
import type { MetricIntentResult } from "@/lib/agent-metric-intent";

export const DEFAULT_COMPARISON_TOP_N = 10;
const DEFAULT_TOP_N = DEFAULT_COMPARISON_TOP_N;
export const OTHER_LABEL = "Other";

const TIME_NAME_HINT =
  /^(year|month|quarter|week|day|date|data|period|time|sale|calendar|fy|q[1-4])/i;
const TIME_NAME_SUB =
  /month|week|quarter|year|date|data|period|time|day|თვე|კვირ|წელ/i;

function keysForRow(row: Record<string, unknown>): string[] {
  return Object.keys(row).filter((k) => !isTechnicalIdColumnKey(k));
}

function isNumericLike(v: unknown): boolean {
  if (typeof v === "number" && Number.isFinite(v)) return true;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n);
  }
  return false;
}

function toNumber(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function timeColumnScore(name: string): number {
  let s = 0;
  if (TIME_NAME_HINT.test(name)) s += 10;
  if (TIME_NAME_SUB.test(name)) s += 5;
  return s;
}

/** Column name looks like a time bucket (Month may be 1–12 in SQL — still not the measure). */
function isTimeBucketColumnKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  if (TIME_NAME_HINT.test(k) || TIME_NAME_SUB.test(k)) return true;
  return /^(m|mon|month|monthnum|month_id|mn|year|yr|week|w|quarter|q|period|tve|celi|salemonth|saledate|sale_date|fy|calendar)$/i.test(
    k,
  );
}

function isLikelyMeasureColumnKey(key: string): boolean {
  const k = key.trim().toLowerCase();
  return /revenue|tanxa|amount|total|liters|tevadoba|raod|qty|quantity|value|sum|sales|gross|net|money|amt/i.test(k);
}

function measureIntentBoost(key: string, intent: MetricIntentResult | null | undefined): number {
  if (!intent) return 0;
  const k = key.toLowerCase();
  switch (intent.kind) {
    case "volume_liters":
      if (/liters|tevadoba|volume/i.test(k)) return 8;
      if (/tanxa|revenue/i.test(k)) return -4;
      return 0;
    case "quantity_units":
      if (/raod|qty|quantity|units/i.test(k)) return 8;
      return 0;
    case "revenue_gel":
      if (/tanxa|revenue|amount/i.test(k)) return 8;
      if (/tevadoba|liters/i.test(k)) return -3;
      return 0;
    default:
      return 0;
  }
}

/**
 * Pick the single measure column when multiple numeric columns exist (e.g. Month=3 + Revenue).
 */
function pickMeasureColumnKey(
  numericKeys: string[],
  rows: Record<string, unknown>[],
  metricIntent?: MetricIntentResult | null,
): string | null {
  const nonTime = numericKeys.filter((k) => !isTimeBucketColumnKey(k));
  if (nonTime.length === 1) return nonTime[0];
  if (nonTime.length > 1) {
    const scored = nonTime.map((k) => ({
      k,
      nameHit: isLikelyMeasureColumnKey(k) ? 1 : 0,
      avgAbs: rows.reduce((s, r) => s + Math.abs(toNumber(r[k])), 0) / rows.length,
      intentB: measureIntentBoost(k, metricIntent),
    }));
    scored.sort(
      (a, b) =>
        b.intentB - a.intentB || b.nameHit - a.nameHit || b.avgAbs - a.avgAbs,
    );
    return scored[0]?.k ?? null;
  }
  // All numeric columns look like time buckets — try value heuristics (month 1–12 vs money)
  if (numericKeys.length >= 2) {
    for (const k of numericKeys) {
      const sample = rows.slice(0, Math.min(40, rows.length)).map((r) => toNumber(r[k]));
      const max = Math.max(...sample.map(Math.abs));
      if (max > 1000) return k;
    }
  }
  return null;
}

/** Prefer Month/Dimension/measure layout for tidy data. */
export function inferTidyLongKeys(
  rows: Record<string, unknown>[],
  metricIntent?: MetricIntentResult | null,
): { timeKey: string; dimKey: string; measureKey: string } | null {
  if (rows.length === 0) return null;
  const keys = keysForRow(rows[0]);
  if (keys.length < 3) return null;

  const numericKeys = keys.filter((k) => rows.every((r) => isNumericLike(r[k])));
  const measureKey = pickMeasureColumnKey(numericKeys, rows, metricIntent);
  if (!measureKey) return null;

  const catKeys = keys.filter((k) => k !== measureKey);
  if (catKeys.length < 2) return null;

  let bestTime = catKeys[0];
  let bestScore = timeColumnScore(catKeys[0]);
  for (const k of catKeys.slice(1)) {
    const sc = timeColumnScore(k);
    if (sc > bestScore) {
      bestScore = sc;
      bestTime = k;
    }
  }
  const dimKey = catKeys.find((k) => k !== bestTime) ?? catKeys[1];
  if (!dimKey || dimKey === bestTime) return null;

  return { timeKey: bestTime, dimKey, measureKey };
}

export type WidePivotResult = {
  data: Record<string, unknown>[];
  longData: Record<string, unknown>[];
  meta: ChartComparisonMeta;
};

/**
 * Pivot long (time, dimension, measure) rows to wide chart rows (one row per time, columns per top dimensions + Other).
 */
export function pivotLongToWideTopN(
  rows: Record<string, unknown>[],
  timeKey: string,
  dimKey: string,
  measureKey: string,
  topN: number,
): WidePivotResult {
  const longData = rows.map((r) => ({ ...r }));
  const dimTotals = new Map<string, number>();
  const cell = new Map<string, Map<string, number>>();

  for (const r of rows) {
    const t = String(r[timeKey] ?? "");
    const d = String(r[dimKey] ?? "");
    const v = toNumber(r[measureKey]);
    dimTotals.set(d, (dimTotals.get(d) ?? 0) + v);
    if (!cell.has(t)) cell.set(t, new Map());
    const row = cell.get(t)!;
    row.set(d, (row.get(d) ?? 0) + v);
  }

  const sortedDims = [...dimTotals.entries()].sort((a, b) => b[1] - a[1]);
  const top = new Set(sortedDims.slice(0, topN).map(([d]) => d));
  const times = [...cell.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const seriesKeys = sortedDims.slice(0, topN).map(([d]) => d);
  if (sortedDims.length > topN) seriesKeys.push(OTHER_LABEL);

  const wide: Record<string, unknown>[] = [];
  for (const t of times) {
    const m = cell.get(t)!;
    const rawTime = rows.find((r) => String(r[timeKey]) === t)?.[timeKey] ?? t;
    const out: Record<string, unknown> = { [timeKey]: rawTime };
    let otherSum = 0;
    for (const [d, val] of m) {
      if (top.has(d)) {
        out[d] = val;
      } else {
        otherSum += val;
      }
    }
    for (const d of top) {
      if (out[d] === undefined) out[d] = 0;
    }
    if (sortedDims.length > topN && otherSum !== 0) {
      out[OTHER_LABEL] = otherSum;
    }
    wide.push(out);
  }

  const meta: ChartComparisonMeta = {
    enabled: true,
    rowDim: dimKey,
    colDim: timeKey,
    measure: measureKey,
    topN,
    wasPivoted: true,
    seriesKeys,
    longData,
  };

  return { data: wide, longData, meta };
}

function trimWideToTopN(
  rows: Record<string, unknown>[],
  xKey: string,
  yKeys: string[],
  topN: number,
): { data: Record<string, unknown>[]; meta: ChartComparisonMeta | null } {
  if (rows.length === 0 || yKeys.length <= topN) {
    return { data: rows, meta: null };
  }
  const totals = new Map<string, number>();
  for (const k of yKeys) {
    let s = 0;
    for (const r of rows) s += toNumber(r[k]);
    totals.set(k, s);
  }
  const ranked = [...totals.entries()].sort((a, b) => b[1] - a[1]);
  const keep = new Set(ranked.slice(0, topN).map(([k]) => k));
  const out: Record<string, unknown>[] = rows.map((r) => {
    const o: Record<string, unknown> = { [xKey]: r[xKey] };
    let other = 0;
    for (const k of yKeys) {
      const v = toNumber(r[k]);
      if (keep.has(k)) o[k] = v;
      else other += v;
    }
    if (ranked.length > topN && other !== 0) o[OTHER_LABEL] = other;
    return o;
  });
  const seriesKeys = ranked.slice(0, topN).map(([k]) => k);
  if (ranked.length > topN) seriesKeys.push(OTHER_LABEL);
  const meta: ChartComparisonMeta = {
    enabled: true,
    rowDim: "series",
    colDim: xKey,
    measure: yKeys[0] ?? "Value",
    topN,
    wasPivoted: false,
    seriesKeys,
    longData: undefined,
  };
  return { data: out, meta };
}

export type PostprocessParams = {
  intent: ComparisonIntentResult;
  chartType: ChartConfig["type"];
  chartConfig: Pick<ChartConfig, "xKey" | "yKeys" | "title"> | null;
  data: Record<string, unknown>[];
  /** Prefer this measure when inferring tidy long columns */
  metricIntent?: MetricIntentResult | null;
};

export type PostprocessResult = {
  chartType: ChartConfig["type"];
  chartConfig: ChartConfig | null;
  data: Record<string, unknown>[];
};

/**
 * Apply BI rules: coerce pie→bar for comparisons, pivot long→wide, Top-N wide series.
 */
export function postprocessAgentComparison(p: PostprocessParams): PostprocessResult {
  const { intent, chartConfig, metricIntent } = p;
  let chartType = p.chartType;
  let data = p.data;
  let nextConfig: ChartConfig | null = chartConfig
    ? {
        type: chartType,
        xKey: chartConfig.xKey,
        yKeys: chartConfig.yKeys,
        title: chartConfig.title,
      }
    : null;

  if (!intent.isComparison || data.length === 0) {
    return { chartType, chartConfig: nextConfig, data };
  }

  if (chartType === "number") {
    return { chartType, chartConfig: nextConfig, data };
  }

  if (chartType === "table") {
    const tidy = inferTidyLongKeys(data, metricIntent);
    if (tidy && intent.isComparison) {
      return {
        chartType: "table",
        chartConfig: {
          type: "table",
          xKey: tidy.dimKey,
          yKeys: [tidy.measureKey],
          title: nextConfig?.title,
          comparison: {
            enabled: true,
            rowDim: tidy.dimKey,
            colDim: tidy.timeKey,
            measure: tidy.measureKey,
            topN: DEFAULT_TOP_N,
            wasPivoted: false,
            seriesKeys: [],
            longData: data.map((r) => ({ ...r })),
          },
        },
        data,
      };
    }
    return { chartType, chartConfig: nextConfig, data };
  }

  const allowPie = intent.explicitPieOrShare && intent.signals.hasTimeBreakdown === false;

  if (chartType === "pie" && !allowPie) {
    chartType = "bar";
    if (nextConfig) nextConfig.type = "bar";
  }

  const tidy = inferTidyLongKeys(data, metricIntent);
  if (tidy) {
    const pivoted = pivotLongToWideTopN(data, tidy.timeKey, tidy.dimKey, tidy.measureKey, DEFAULT_TOP_N);
    data = pivoted.data;
    const xKey = tidy.timeKey;
    let yKeysFinal = [...(pivoted.meta.seriesKeys ?? [])];
    const hasOther = pivoted.data.some((r) => toNumber(r[OTHER_LABEL]) !== 0);
    if (!hasOther) {
      yKeysFinal = yKeysFinal.filter((k) => k !== OTHER_LABEL);
    }

    chartType = chartType === "line" || chartType === "area" ? chartType : "bar";
    nextConfig = {
      type: chartType,
      xKey,
      yKeys: yKeysFinal,
      title: nextConfig?.title,
      comparison: pivoted.meta,
    };
    return { chartType, chartConfig: nextConfig, data };
  }

  const xKey =
    nextConfig?.xKey ||
    (data[0] ? keysForRow(data[0]).find((k) => !isNumericLike(data[0][k])) : undefined) ||
    keysForRow(data[0] ?? {})[0];
  const yKeys =
    nextConfig?.yKeys?.length && nextConfig.yKeys.length > 0
      ? nextConfig.yKeys
      : data[0]
        ? keysForRow(data[0]).filter((k) => k !== xKey && isNumericLike(data[0][k]))
        : [];

  if (xKey && yKeys.length > DEFAULT_TOP_N) {
    const trimmed = trimWideToTopN(data, xKey, yKeys, DEFAULT_TOP_N);
    data = trimmed.data;
    const newY = trimmed.meta?.seriesKeys ?? yKeys.slice(0, DEFAULT_TOP_N);
    nextConfig = {
      type: chartType,
      xKey,
      yKeys: newY,
      title: nextConfig?.title,
      comparison: trimmed.meta ?? undefined,
    };
    return { chartType, chartConfig: nextConfig, data };
  }

  if (xKey && yKeys.length > 0) {
    nextConfig = {
      type: chartType,
      xKey,
      yKeys,
      title: nextConfig?.title,
      comparison: {
        enabled: true,
        rowDim: "series",
        colDim: xKey,
        measure: yKeys[0],
        topN: DEFAULT_TOP_N,
        wasPivoted: false,
        seriesKeys: yKeys,
        longData: undefined,
      },
    };
  }

  return { chartType, chartConfig: nextConfig, data };
}
