import { NextRequest, NextResponse } from "next/server";
import { reorderSections } from "@/lib/workspace-db";
import { isUuidString, requireAuth } from "@/lib/auth-route-helpers";

type Params = { workspaceId: string };

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { workspaceId } = await ctx.params;
    if (!isUuidString(workspaceId)) {
      return NextResponse.json({ error: "Invalid workspace id" }, { status: 400 });
    }

    const body = (await req.json()) as { sectionIds?: unknown };
    const raw = Array.isArray(body.sectionIds) ? body.sectionIds : [];
    const sectionIds = raw.filter((x): x is string => typeof x === "string" && isUuidString(x));
    if (sectionIds.length === 0) {
      return NextResponse.json({ error: "sectionIds must be a non-empty array of UUIDs" }, { status: 400 });
    }

    const ok = await reorderSections(auth.ctx.user.id, workspaceId, sectionIds);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid reorder: section ids must match this workspace exactly" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/workspaces/[id]/sections/reorder", e);
    return NextResponse.json(
      { error: "Failed to reorder sections", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
