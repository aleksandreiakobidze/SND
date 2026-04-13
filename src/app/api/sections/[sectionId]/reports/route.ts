import { NextRequest, NextResponse } from "next/server";
import { createSavedReport } from "@/lib/workspace-db";
import { validateReadOnlySql } from "@/lib/db";
import { chartTypeFromConfig } from "@/lib/chart-config-meta";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";
import type { ChartConfig } from "@/types";

type Params = { sectionId: string };

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { sectionId } = await ctx.params;
    const body = await req.json();

    const title = typeof body.title === "string" ? body.title : "";
    const source = body.source === "builtin" ? "builtin" : "agent";
    const prompt = typeof body.prompt === "string" ? body.prompt : null;
    const sqlText = typeof body.sql === "string" ? body.sql : null;
    const narrative = typeof body.narrative === "string" ? body.narrative : null;
    let chartConfigJson: string | null = null;
    let chartType: string | null = null;
    if (body.chartConfig != null) {
      const cfg = body.chartConfig as ChartConfig;
      chartConfigJson = JSON.stringify(cfg);
      chartType = chartTypeFromConfig(cfg);
    }

    if (!title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    if (source === "agent" && sqlText) {
      try {
        validateReadOnlySql(sqlText);
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : "Invalid SQL" },
          { status: 400 },
        );
      }
    }

    const created = await createSavedReport(auth.ctx.user.id, sectionId, {
      title,
      source,
      prompt,
      sqlText,
      chartConfigJson,
      narrative,
      chartType,
    });
    if (!created) return NextResponse.json({ error: "Section not found" }, { status: 404 });
    return NextResponse.json({ id: created.id });
  } catch (e) {
    console.error("POST /api/sections/[id]/reports", e);
    return NextResponse.json(
      { error: "Failed to save report", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
