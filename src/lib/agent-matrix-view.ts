import type { ChartConfig } from "@/types";
import { buildMatrixFromWide, type AgentMatrixModel } from "@/lib/agent-matrix";
import { inferTidyLongKeys, pivotLongToWideTopN, OTHER_LABEL } from "@/lib/agent-comparison-postprocess";

function countDistinctDim(rows: Record<string, unknown>[], dimKey: string): number {
  const s = new Set<string>();
  for (const r of rows) s.add(String(r[dimKey] ?? ""));
  return s.size;
}

export type AgentMatrixView = {
  model: AgentMatrixModel;
  rowDimLabel: string;
  measureLabel: string;
};

function looksLikeDateValue(v: unknown): boolean {
  if (v instanceof Date) return true;
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (!s) return false;
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return true;
  const t = Date.parse(s);
  return Number.isFinite(t);
}

function inferStrictTidySchema(
  rows: Record<string, unknown>[],
): { timeKey: string; dimKey: string; measureKey: string } | null {
  if (rows.length === 0) return null;
  const keys = Object.keys(rows[0]);
  if (keys.length !== 3) return null;
  const sample = rows.slice(0, Math.min(60, rows.length));
  const numericKeys = keys.filter((k) =>
    sample.every((r) => {
      const v = r[k];
      if (typeof v === "number") return Number.isFinite(v);
      if (typeof v === "string" && v.trim() !== "") return Number.isFinite(Number(v));
      return false;
    }),
  );
  if (numericKeys.length !== 1) return null;
  const measureKey = numericKeys[0];
  const other = keys.filter((k) => k !== measureKey);
  if (other.length !== 2) return null;
  const dateByName = other.find((k) => /date|day|month|year|data|period|time|sale/i.test(k));
  const dateByValue = other.find((k) => sample.some((r) => looksLikeDateValue(r[k])));
  const timeKey = dateByName ?? dateByValue;
  if (!timeKey) return null;
  const dimKey = other.find((k) => k !== timeKey) ?? null;
  if (!dimKey) return null;
  return { timeKey, dimKey, measureKey };
}

function looksLikeComparisonLong(
  rows: Record<string, unknown>[],
  tidy: { timeKey: string; dimKey: string },
): boolean {
  if (rows.length < 4) return false;
  const times = new Set(rows.map((r) => String(r[tidy.timeKey] ?? "")));
  const dims = new Set(rows.map((r) => String(r[tidy.dimKey] ?? "")));
  return times.size > 1 && dims.size > 1;
}

/**
 * Pure matrix view builder. When `comparison.longData` exists, pivots **all** row-dimension
 * values (same as Excel export), not Top-N — so pagination can list every series.
 */
export function computeAgentMatrixView(
  chartConfig: ChartConfig | null | undefined,
  data: Record<string, unknown>[] | undefined,
): AgentMatrixView | null {
  if (!data?.length) return null;
  const cc = chartConfig;
  const sourceRows = cc?.comparison?.longData?.length ? cc.comparison.longData : data;
  const strict = inferStrictTidySchema(sourceRows);
  if (strict) {
    const fullN = Math.max(countDistinctDim(sourceRows, strict.dimKey), 1);
    const piv = pivotLongToWideTopN(
      sourceRows,
      strict.timeKey,
      strict.dimKey,
      strict.measureKey,
      fullN,
    );
    let series = piv.meta.seriesKeys ?? [];
    const hasOther = piv.data.some((r) => Number(r[OTHER_LABEL]) !== 0);
    if (!hasOther) series = series.filter((k) => k !== OTHER_LABEL);
    return {
      model: buildMatrixFromWide(piv.data, strict.timeKey, series),
      rowDimLabel: strict.dimKey,
      measureLabel: strict.measureKey,
    };
  }

  if (cc?.comparison?.enabled) {
    const comp = cc.comparison;

    if (comp.longData?.length) {
      const longData = comp.longData;
      const tidy = inferTidyLongKeys(longData);
      if (!tidy) return null;
      const fullN = Math.max(countDistinctDim(longData, tidy.dimKey), 1);
      const piv = pivotLongToWideTopN(
        longData,
        tidy.timeKey,
        tidy.dimKey,
        tidy.measureKey,
        fullN,
      );
      let series = piv.meta.seriesKeys ?? [];
      const hasOther = piv.data.some((r) => Number(r[OTHER_LABEL]) !== 0);
      if (!hasOther) series = series.filter((k) => k !== OTHER_LABEL);
      return {
        model: buildMatrixFromWide(piv.data, tidy.timeKey, series),
        rowDimLabel: comp.rowDim,
        measureLabel: comp.measure,
      };
    }

    if (cc.xKey && cc.yKeys?.length) {
      return {
        model: buildMatrixFromWide(data, cc.xKey, cc.yKeys),
        rowDimLabel: comp.rowDim,
        measureLabel: comp.measure,
      };
    }
    return null;
  }

  const tidy = inferTidyLongKeys(data);
  if (!tidy || !looksLikeComparisonLong(data, tidy)) return null;
  const fullN = Math.max(countDistinctDim(data, tidy.dimKey), 1);
  const piv = pivotLongToWideTopN(
    data,
    tidy.timeKey,
    tidy.dimKey,
    tidy.measureKey,
    fullN,
  );
  let series = piv.meta.seriesKeys ?? [];
  const hasOther = piv.data.some((r) => Number(r[OTHER_LABEL]) !== 0);
  if (!hasOther) series = series.filter((k) => k !== OTHER_LABEL);
  return {
    model: buildMatrixFromWide(piv.data, tidy.timeKey, series),
    rowDimLabel: tidy.dimKey,
    measureLabel: tidy.measureKey,
  };
}
