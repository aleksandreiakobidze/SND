import { NextRequest, NextResponse } from "next/server";
import { duplicateSavedReport } from "@/lib/workspace-db";
import { forbidden, isUuidString, requireAuth } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";

type Params = { reportId: string };

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { reportId } = await ctx.params;
    let sectionId: string | undefined;
    try {
      const body = await req.json();
      if (typeof body?.sectionId === "string" && body.sectionId.trim()) {
        sectionId = body.sectionId.trim();
      }
    } catch {
      /* empty body */
    }
    if (sectionId && !isUuidString(sectionId)) {
      return NextResponse.json({ error: "sectionId must be a valid UUID" }, { status: 400 });
    }

    const created = await duplicateSavedReport(auth.ctx.user.id, reportId, sectionId);
    if (!created) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ id: created.id });
  } catch (e) {
    console.error("POST /api/reports/[id]/duplicate", e);
    return NextResponse.json(
      { error: "Failed to duplicate report", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
