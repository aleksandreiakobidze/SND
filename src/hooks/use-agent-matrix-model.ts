"use client";

import { useMemo } from "react";
import type { ChartConfig } from "@/types";
import { buildMatrixFromWide } from "@/lib/agent-matrix";
import type { AgentMatrixModel } from "@/lib/agent-matrix";
import {
  DEFAULT_COMPARISON_TOP_N,
  inferTidyLongKeys,
  pivotLongToWideTopN,
  OTHER_LABEL,
} from "@/lib/agent-comparison-postprocess";

export type AgentMatrixView = {
  model: AgentMatrixModel;
  rowDimLabel: string;
  measureLabel: string;
};

/** True when long data has multiple time buckets and multiple series (comparison grid). */
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
 * Build matrix for comparison reports: prefers server `chartConfig.comparison`,
 * otherwise infers tidy long (Month + Brand + Revenue) on the client when the API
 * did not attach metadata (edge cases / Month as number).
 */
export function useAgentMatrixModel(
  chartConfig: ChartConfig | null | undefined,
  data: Record<string, unknown>[] | undefined,
): AgentMatrixView | null {
  return useMemo(() => {
    if (!data?.length) return null;
    const cc = chartConfig;

    if (cc?.comparison?.enabled) {
      const comp = cc.comparison;

      if (cc.type === "table" && comp.longData?.length) {
        const longData = comp.longData;
        const tidy = inferTidyLongKeys(longData);
        if (!tidy) return null;
        const piv = pivotLongToWideTopN(
          longData,
          tidy.timeKey,
          tidy.dimKey,
          tidy.measureKey,
          comp.topN ?? DEFAULT_COMPARISON_TOP_N,
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

    // Client fallback: tidy long SQL without comparison meta (e.g. Month numeric + Revenue)
    const tidy = inferTidyLongKeys(data);
    if (!tidy || !looksLikeComparisonLong(data, tidy)) return null;
    const piv = pivotLongToWideTopN(
      data,
      tidy.timeKey,
      tidy.dimKey,
      tidy.measureKey,
      DEFAULT_COMPARISON_TOP_N,
    );
    let series = piv.meta.seriesKeys ?? [];
    const hasOther = piv.data.some((r) => Number(r[OTHER_LABEL]) !== 0);
    if (!hasOther) series = series.filter((k) => k !== OTHER_LABEL);
    return {
      model: buildMatrixFromWide(piv.data, tidy.timeKey, series),
      rowDimLabel: tidy.dimKey,
      measureLabel: tidy.measureKey,
    };
  }, [chartConfig, data]);
}
