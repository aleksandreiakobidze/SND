import { NextResponse } from "next/server";
import { recordReportOpened } from "@/lib/workspace-db";
import { requireAuth } from "@/lib/auth-route-helpers";

type Params = { reportId: string };

export async function POST(_req: Request, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { reportId } = await ctx.params;
    const ok = await recordReportOpened(auth.ctx.user.id, reportId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/reports/[id]/open", e);
    return NextResponse.json(
      { error: "Failed to record open", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
