import type { AgentMessage } from "@/types";
import { computeAgentMatrixView } from "@/lib/agent-matrix-view";

export type AgentReportView = "chart" | "matrix" | "flat";

/** Same default tab order as ChatMessage initial `dataView`. */
export function inferDefaultAgentReportView(m: AgentMessage): AgentReportView {
  const matrixView = computeAgentMatrixView(m.chartConfig, m.data);
  const hasData = Boolean(m.data?.length);
  const showMatrix = Boolean(matrixView);
  const hasChart = Boolean(
    m.chartConfig &&
      hasData &&
      m.chartConfig.type !== "table" &&
      m.chartConfig.type !== "number",
  );
  if (showMatrix) return "matrix";
  if (hasChart) return "chart";
  return "flat";
}

export function agentMessageHasChartable(m: AgentMessage): boolean {
  const hasData = Boolean(m.data?.length);
  return Boolean(
    m.chartConfig &&
      hasData &&
      m.chartConfig.type !== "table" &&
      m.chartConfig.type !== "number",
  );
}
