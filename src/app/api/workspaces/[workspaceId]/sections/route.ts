import { NextRequest, NextResponse } from "next/server";
import { createSection } from "@/lib/workspace-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";

type Params = { workspaceId: string };

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const { workspaceId } = await ctx.params;
    const body = await req.json();
    const title = typeof body.title === "string" ? body.title : "";
    if (!title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const created = await createSection(auth.ctx.user.id, workspaceId, title);
    if (!created) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    return NextResponse.json({ id: created.id });
  } catch (e) {
    console.error("POST /api/workspaces/[id]/sections", e);
    return NextResponse.json(
      { error: "Failed to create section", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
