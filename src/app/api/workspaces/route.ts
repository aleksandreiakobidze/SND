import { NextRequest, NextResponse } from "next/server";
import { createWorkspace, listWorkspaceTree } from "@/lib/workspace-db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canEditWorkspace } from "@/lib/auth-roles";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    const tree = await listWorkspaceTree(auth.ctx.user.id);
    return NextResponse.json(tree);
  } catch (e) {
    console.error("GET /api/workspaces", e);
    return NextResponse.json(
      { error: "Failed to load workspaces", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canEditWorkspace(auth.ctx.permissions)) return forbidden();

    const body = await req.json();
    const title = typeof body.title === "string" ? body.title : "";
    if (!title.trim()) {
      return NextResponse.json({ error: "title is required" }, { status: 400 });
    }
    const { id } = await createWorkspace(auth.ctx.user.id, title);
    return NextResponse.json({ id });
  } catch (e) {
    console.error("POST /api/workspaces", e);
    return NextResponse.json(
      { error: "Failed to create workspace", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
