import { NextRequest, NextResponse } from "next/server";
import { reorderWorkspaces } from "@/lib/workspace-db";
import { isUuidString, requireAuth } from "@/lib/auth-route-helpers";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const body = (await req.json()) as { workspaceIds?: unknown };
    const raw = Array.isArray(body.workspaceIds) ? body.workspaceIds : [];
    const workspaceIds = raw.filter((x): x is string => typeof x === "string" && isUuidString(x));
    if (workspaceIds.length === 0) {
      return NextResponse.json({ error: "workspaceIds must be a non-empty array of UUIDs" }, { status: 400 });
    }

    const ok = await reorderWorkspaces(auth.ctx.user.id, workspaceIds);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid reorder: ids must match your workspaces exactly" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/workspaces/reorder", e);
    return NextResponse.json(
      { error: "Failed to reorder workspaces", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
