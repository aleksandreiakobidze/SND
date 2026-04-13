import { NextRequest, NextResponse } from "next/server";
import { deleteWorkspace, patchWorkspace } from "@/lib/workspace-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";

type Params = { workspaceId: string };

export async function PATCH(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { workspaceId } = await ctx.params;
    const body = (await req.json()) as {
      title?: unknown;
      iconKey?: unknown;
      isPinned?: unknown;
      accentColor?: unknown;
    };
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const hasTitle = title.length > 0;
    const hasIcon = body.iconKey !== undefined;
    const hasPin = typeof body.isPinned === "boolean";
    const hasAccent = body.accentColor !== undefined;

    if (!hasTitle && !hasIcon && !hasPin && !hasAccent) {
      return NextResponse.json(
        { error: "Provide title, iconKey, isPinned, and/or accentColor" },
        { status: 400 },
      );
    }

    const ok = await patchWorkspace(auth.ctx.user.id, workspaceId, {
      ...(hasTitle ? { title } : {}),
      ...(hasIcon
        ? {
            iconKey:
              body.iconKey === null
                ? null
                : typeof body.iconKey === "string"
                  ? body.iconKey
                  : null,
          }
        : {}),
      ...(hasPin ? { isPinned: body.isPinned as boolean } : {}),
      ...(hasAccent
        ? {
            accentColor:
              body.accentColor === null
                ? null
                : typeof body.accentColor === "string"
                  ? body.accentColor
                  : null,
          }
        : {}),
    });
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/workspaces/[id]", e);
    return NextResponse.json(
      { error: "Failed to update workspace", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { workspaceId } = await ctx.params;
    const ok = await deleteWorkspace(auth.ctx.user.id, workspaceId);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/workspaces/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete workspace", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
