import { NextRequest, NextResponse } from "next/server";
import { deleteOwnerAgentHint, updateOwnerAgentHint } from "@/lib/owner-agent-hints-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canUseAgent } from "@/lib/auth-roles";

type RouteParams = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canUseAgent(auth.ctx.permissions)) return forbidden();

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const body = (await req.json()) as { title?: unknown; body?: unknown };
    const title = typeof body.title === "string" ? body.title : null;
    const text = typeof body.body === "string" ? body.body : "";
    const ok = await updateOwnerAgentHint(auth.ctx.user.id, id.trim(), { title, body: text });
    if (!ok) {
      return NextResponse.json({ error: "Not found or empty body" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PATCH /api/agent/hints/[id]", e);
    return NextResponse.json(
      { error: "Failed to update hint", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canUseAgent(auth.ctx.permissions)) return forbidden();

    const { id } = await params;
    if (!id?.trim()) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const ok = await deleteOwnerAgentHint(auth.ctx.user.id, id.trim());
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("DELETE /api/agent/hints/[id]", e);
    return NextResponse.json(
      { error: "Failed to delete hint", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
