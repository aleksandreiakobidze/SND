import { postprocessAgentComparison } from "@/lib/agent-comparison-postprocess";
import type { ComparisonIntentResult } from "@/lib/agent-comparison-intent";
import type { MetricIntentKind, MetricIntentResult } from "@/lib/agent-metric-intent";
import { buildAgentMatrixExportModel } from "@/lib/agent-matrix-export";
import { matrixExportColumnOrder, matrixToFlatExportRows } from "@/lib/agent-matrix";
import { computeAgentMatrixView } from "@/lib/agent-matrix-view";
import type { ExcelSheetPart } from "@/lib/excel-workbook-from-rows";
import type { ChartConfig } from "@/types";

export function comparisonIntentFromChartConfig(chartConfig: ChartConfig | null): ComparisonIntentResult {
  return {
    isComparison: Boolean(chartConfig?.comparison?.enabled),
    signals: { hasVersus: false, hasTimeBreakdown: false },
    explicitPieOrShare: false,
  };
}

export function metricIntentFromKind(kind: MetricIntentKind | undefined): MetricIntentResult {
  const k = kind ?? "unspecified";
  return {
    kind: k,
    hasVolume: k === "volume_liters" || k === "mixed",
    hasQuantity: k === "quantity_units" || k === "mixed",
    hasMoney: k === "revenue_gel" || k === "mixed",
  };
}

export type AgentExportRowBuildArgs = {
  rawRows: Record<string, unknown>[];
  chartConfig: ChartConfig | null;
  chartType: ChartConfig["type"];
  metricIntentKind?: MetricIntentKind;
};

function postprocessForExport(args: AgentExportRowBuildArgs) {
  const metricIntent = metricIntentFromKind(args.metricIntentKind);
  const intent = comparisonIntentFromChartConfig(args.chartConfig);
  return postprocessAgentComparison({
    intent,
    chartType: args.chartType,
    chartConfig: args.chartConfig,
    data: args.rawRows,
    metricIntent,
  });
}

/**
 * Flat tabular export: longData or raw table rows — never matrix-flattened.
 */
export function buildFlatTableEmailExportRows(
  args: AgentExportRowBuildArgs,
): { rows: Record<string, unknown>[]; columnOrder?: string[] } {
  const processed = postprocessForExport(args);
  const cc = processed.chartConfig;
  const data = processed.data;
  const comp = cc?.comparison;
  const flat = comp?.longData?.length ? comp.longData : data;
  const columnOrder = flat[0] ? Object.keys(flat[0]) : undefined;
  return { rows: flat, columnOrder };
}

/**
 * Matrix-shaped export only when matrix layout applies; otherwise null (caller must not substitute flat).
 */
export function buildMatrixEmailExportRows(
  args: AgentExportRowBuildArgs,
): { rows: Record<string, unknown>[]; columnOrder?: string[] } | null {
  const processed = postprocessForExport(args);
  const cc = processed.chartConfig;
  const data = processed.data;
  const mv = computeAgentMatrixView(cc, data);
  if (!mv) return null;
  const model = buildAgentMatrixExportModel(cc, data);
  if (!model) return null;
  return {
    rows: matrixToFlatExportRows(model, mv.rowDimLabel),
    columnOrder: matrixExportColumnOrder(model, mv.rowDimLabel),
  };
}

export function matrixExportUnavailablePlaceholderRows(
  locale: "en" | "ka",
): Record<string, unknown>[] {
  const col = locale === "ka" ? "შეტყობინება" : "Message";
  const text =
    locale === "ka"
      ? "ამ შედეგისთვის მატრიცის განლაგება ხელმისაწვდომი არ არის."
      : "Matrix layout is not available for this result.";
  return [{ [col]: text }];
}

/**
 * Chart view: two sheets — full flat table and matrix (or explicit N/A placeholder).
 */
export function buildChartViewExcelSheetParts(
  args: AgentExportRowBuildArgs,
  locale: "en" | "ka",
): ExcelSheetPart[] {
  const flat = buildFlatTableEmailExportRows(args);
  const matrix = buildMatrixEmailExportRows(args);
  const parts: ExcelSheetPart[] = [
    {
      sheetName: "Flat table",
      rows: flat.rows,
      columnOrder: flat.columnOrder,
    },
  ];
  if (matrix && matrix.rows.length > 0) {
    parts.push({
      sheetName: "Matrix",
      rows: matrix.rows,
      columnOrder: matrix.columnOrder,
    });
  } else {
    parts.push({
      sheetName: "Matrix",
      rows: matrixExportUnavailablePlaceholderRows(locale),
    });
  }
  return parts;
}
