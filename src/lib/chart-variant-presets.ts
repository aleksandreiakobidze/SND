import type { ChartVariant } from "@/components/charts/FlexChart";

export type AgentChartVariantOptions = {
  /** Comparison BI mode — hide pie for bar charts unless explicitPie */
  comparison?: boolean;
  /** User asked for pie/share explicitly */
  explicitPie?: boolean;
};

/**
 * Chart type from the agent API → FlexChart variants (order = default preference first).
 */
export function getVariantsForAgentChart(
  type: string,
  options?: AgentChartVariantOptions,
): ChartVariant[] {
  const comp = options?.comparison === true;
  const pieOk = options?.explicitPie === true;

  switch (type) {
    case "bar":
      if (comp && !pieOk) return ["bar", "line", "horizontal-bar"];
      return ["bar", "pie", "horizontal-bar"];
    case "pie":
      return ["pie", "bar", "horizontal-bar"];
    case "line":
      if (comp) return ["line", "area", "bar"];
      return ["line", "area", "bar"];
    case "area":
      if (comp) return ["area", "line", "bar"];
      return ["area", "line", "bar"];
    default:
      return ["bar", "pie", "line"];
  }
}

/** Prefer fewer on-chart labels when the chart would be crowded. */
export function defaultShowDataLabelsForAgent(
  seriesCount: number,
  xBucketCount: number,
  comparison?: boolean,
): boolean {
  if (!comparison) return true;
  return seriesCount <= 5 && xBucketCount <= 12;
}
