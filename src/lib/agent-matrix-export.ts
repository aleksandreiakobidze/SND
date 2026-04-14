import type { AgentMatrixModel } from "@/lib/agent-matrix";
import { computeAgentMatrixView } from "@/lib/agent-matrix-view";
import type { ChartConfig } from "@/types";

/**
 * Excel matrix sheet — same underlying model as the matrix view (full pivot when `longData` exists).
 */
export function buildAgentMatrixExportModel(
  chartConfig: ChartConfig | null | undefined,
  data: Record<string, unknown>[] | undefined,
): AgentMatrixModel | null {
  return computeAgentMatrixView(chartConfig, data)?.model ?? null;
}
