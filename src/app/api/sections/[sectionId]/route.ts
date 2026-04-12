import { NextRequest, NextResponse } from "next/server";
import { deleteSection, updateSection } from "@/lib/workspace-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";

type Params = { sectionId: string };

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { sectionId } = await ctx.params;
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title : "";
    if (!title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const ok = await updateSection(auth.ctx.user.id, sectionId, title);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/sections/[id]", e);
    return NextResponse.json(
      { error: "Failed to update section", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { sectionId } = await ctx.params;
    const ok = await deleteSection(auth.ctx.user.id, sectionId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/sections/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete section", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
