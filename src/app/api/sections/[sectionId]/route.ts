import { NextRequest, NextResponse } from "next/server";
import { deleteSection, patchWorkspaceSection } from "@/lib/workspace-db";
import { formatSqlDriverError } from "@/lib/sql-driver-error";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";

type Params = { sectionId: string };

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { sectionId: rawSectionId } = await ctx.params;
    const sectionId = rawSectionId.trim();
    const body = (await req.json()) as { title?: unknown; colorKey?: unknown };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const hasTitle = title.length > 0;
    const hasColor = body.colorKey !== undefined;

    if (!hasTitle && !hasColor) {
      return NextResponse.json({ error: "Provide title and/or colorKey" }, { status: 400 });
    }

    const outcome = await patchWorkspaceSection(auth.ctx.user.id, sectionId, {
      ...(hasTitle ? { title } : {}),
      ...(hasColor
        ? {
            colorKey:
              typeof body.colorKey === "string" || body.colorKey === null
                ? (body.colorKey as string | null)
                : null,
          }
        : {}),
    });
    if (outcome.kind === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    if (outcome.kind === "color_requires_migration") {
      return NextResponse.json(
        {
          error: "Workspace metadata migration required",
          details:
            "The ColorKey column is missing on dbo.SndApp_WorkspaceSection. Run scripts/migrations/009-workspace-bi-metadata.sql against the app database.",
        },
        { status: 503 },
      );
    }
    return NextResponse.json({
      ok: true,
      ...(outcome.kind === "ok_title_only" ? { colorKeySkipped: true } : {}),
    });
  } catch (e) {
    console.error("PATCH /api/sections/[id]", e);
    return NextResponse.json(
      { error: "Failed to update section", details: formatSqlDriverError(e) },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { sectionId: rawSectionId } = await ctx.params;
    const sectionId = rawSectionId.trim();
    const ok = await deleteSection(auth.ctx.user.id, sectionId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/sections/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete section", details: formatSqlDriverError(e) },
      { status: 500 },
    );
  }
}
