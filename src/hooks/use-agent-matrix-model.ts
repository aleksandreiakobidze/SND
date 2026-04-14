"use client";

import { useMemo } from "react";
import type { ChartConfig } from "@/types";
import {
  computeAgentMatrixView,
  type AgentMatrixView,
} from "@/lib/agent-matrix-view";

export type { AgentMatrixView };

/**
 * Build matrix for comparison reports: prefers server `chartConfig.comparison`,
 * otherwise infers tidy long (Month + Brand + Revenue) on the client when the API
 * did not attach metadata (edge cases / Month as number).
 */
export function useAgentMatrixModel(
  chartConfig: ChartConfig | null | undefined,
  data: Record<string, unknown>[] | undefined,
): AgentMatrixView | null {
  return useMemo(
    () => computeAgentMatrixView(chartConfig, data),
    [chartConfig, data],
  );
}
