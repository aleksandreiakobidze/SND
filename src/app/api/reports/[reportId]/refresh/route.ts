import { NextResponse } from "next/server";
import { executeReadOnlyQuery, validateReadOnlySql } from "@/lib/db";
import { chartTypeFromConfig } from "@/lib/chart-config-meta";
import { getSavedReportFull, updateSavedReportChartType } from "@/lib/workspace-db";
import { requireAuth } from "@/lib/auth-route-helpers";
import type { ChartConfig } from "@/types";
import { detectComparisonIntent } from "@/lib/agent-comparison-intent";
import { postprocessAgentComparison } from "@/lib/agent-comparison-postprocess";

type Params = { reportId: string };

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { reportId } = await ctx.params;
    const report = await getSavedReportFull(auth.ctx.user.id, reportId);
    if (!report) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (!report.sqlText?.trim()) {
      return NextResponse.json({ error: "Report has no SQL" }, { status: 400 });
    }
    try {
      validateReadOnlySql(report.sqlText);
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Invalid SQL" },
        { status: 400 },
      );
    }
    const rawData = await executeReadOnlyQuery(report.sqlText);
    let storedConfig: ChartConfig | null = null;
    if (report.chartConfigJson) {
      try {
        storedConfig = JSON.parse(report.chartConfigJson) as ChartConfig;
      } catch {
        storedConfig = null;
      }
    }
    const promptText = report.prompt?.trim() || report.title?.trim() || "";
    const intent = detectComparisonIntent(promptText);
    const processed = postprocessAgentComparison({
      intent,
      chartType: storedConfig?.type ?? "bar",
      chartConfig: storedConfig
        ? {
            xKey: storedConfig.xKey,
            yKeys: storedConfig.yKeys,
            title: storedConfig.title,
          }
        : null,
      data: rawData,
    });
    const chartConfig: ChartConfig | null = processed.chartConfig
      ? {
          type: processed.chartType,
          xKey: processed.chartConfig.xKey,
          yKeys: processed.chartConfig.yKeys,
          title: processed.chartConfig.title ?? storedConfig?.title,
          comparison: processed.chartConfig.comparison,
          colors: storedConfig?.colors,
        }
      : storedConfig;

    const ct = chartTypeFromConfig(chartConfig);
    if (ct) {
      await updateSavedReportChartType(auth.ctx.user.id, reportId, ct);
    }

    return NextResponse.json({
      data: processed.data,
      chartConfig,
      narrative: report.narrative,
      title: report.title,
    });
  } catch (e) {
    console.error("POST /api/reports/[id]/refresh", e);
    return NextResponse.json(
      { error: "Failed to refresh report", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
