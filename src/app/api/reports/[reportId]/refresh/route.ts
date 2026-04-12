import { NextResponse } from "next/server";
import { executeReadOnlyQuery, validateReadOnlySql } from "@/lib/db";
import { getSavedReportFull } from "@/lib/workspace-db";
import { requireAuth } from "@/lib/auth-route-helpers";
import type { ChartConfig } from "@/types";

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
    const data = await executeReadOnlyQuery(report.sqlText);
    let chartConfig: ChartConfig | null = null;
    if (report.chartConfigJson) {
      try {
        chartConfig = JSON.parse(report.chartConfigJson) as ChartConfig;
      } catch {
        chartConfig = null;
      }
    }
    return NextResponse.json({
      data,
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
