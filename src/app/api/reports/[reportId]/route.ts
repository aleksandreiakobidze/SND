import { NextRequest, NextResponse } from "next/server";
import { deleteSavedReport, getSavedReportFull, patchSavedReport } from "@/lib/workspace-db";
import { forbidden, isUuidString, requireAuth } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";

type Params = { reportId: string };

export async function GET(_req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { reportId } = await ctx.params;
    const full = await getSavedReportFull(auth.ctx.user.id, reportId);
    if (!full) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(full);
  } catch (e) {
    console.error("GET /api/reports/[id]", e);
    return NextResponse.json(
      { error: "Failed to load report", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { reportId } = await ctx.params;
    const body = (await req.json()) as {
      title?: unknown;
      sectionId?: unknown;
      isFavorite?: unknown;
      isPinned?: unknown;
      tags?: unknown;
    };
    const title = typeof body.title === "string" ? body.title : undefined;
    const sectionId = typeof body.sectionId === "string" ? body.sectionId : undefined;
    const hasTitle = title !== undefined && title.trim().length > 0;
    const hasSection = sectionId !== undefined && sectionId.trim().length > 0;
    const hasFavorite = typeof body.isFavorite === "boolean";
    const hasPinned = typeof body.isPinned === "boolean";
    const hasTagsField = body.tags !== undefined;
    const tagsParsed =
      body.tags === null
        ? []
        : Array.isArray(body.tags)
          ? body.tags.filter((t): t is string => typeof t === "string")
          : [];

    if (!hasTitle && !hasSection && !hasFavorite && !hasPinned && !hasTagsField) {
      return NextResponse.json(
        { error: "Provide title, sectionId, isFavorite, isPinned, and/or tags" },
        { status: 400 },
      );
    }
    if ((hasTitle || hasSection || hasTagsField) && !canEditWorkspace(auth.ctx.permissions)) {
      return forbidden();
    }
    if (hasFavorite && !canEditWorkspace(auth.ctx.permissions)) {
      return forbidden();
    }
    if (hasPinned && !canEditWorkspace(auth.ctx.permissions)) {
      return forbidden();
    }
    if (hasSection && !isUuidString(sectionId!)) {
      return NextResponse.json({ error: "sectionId must be a valid UUID" }, { status: 400 });
    }
    const ok = await patchSavedReport(auth.ctx.user.id, reportId, {
      ...(hasTitle ? { title: title!.trim() } : {}),
      ...(hasSection ? { sectionId: sectionId!.trim() } : {}),
      ...(hasFavorite ? { isFavorite: body.isFavorite as boolean } : {}),
      ...(hasPinned ? { isPinned: body.isPinned as boolean } : {}),
      ...(hasTagsField ? { tags: tagsParsed } : {}),
    });
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
