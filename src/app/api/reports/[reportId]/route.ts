import { NextRequest, NextResponse } from "next/server";
import { deleteSavedReport, updateSavedReportTitle } from "@/lib/workspace-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";

type Params = { reportId: string };

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { reportId } = await ctx.params;
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title : "";
    if (!title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const ok = await updateSavedReportTitle(auth.ctx.user.id, reportId, title);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/reports/[id]", e);
    return NextResponse.json(
      { error: "Failed to update report", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { reportId } = await ctx.params;
    const ok = await deleteSavedReport(auth.ctx.user.id, reportId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/reports/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete report", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
