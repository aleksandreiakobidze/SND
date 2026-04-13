import { NextRequest, NextResponse } from "next/server";
import { reorderSavedReports } from "@/lib/workspace-db";
import { isUuidString, requireAuth } from "@/lib/auth-route-helpers";

type Params = { sectionId: string };

export async function POST(req: NextRequest, ctx: { params: Promise<Params> }) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const { sectionId } = await ctx.params;
    if (!isUuidString(sectionId)) {
      return NextResponse.json({ error: "Invalid section id" }, { status: 400 });
    }

    const body = (await req.json()) as { reportIds?: unknown };
    const raw = Array.isArray(body.reportIds) ? body.reportIds : [];
    const reportIds = raw.filter((x): x is string => typeof x === "string" && isUuidString(x));
    if (reportIds.length === 0) {
      return NextResponse.json({ error: "reportIds must be a non-empty array of UUIDs" }, { status: 400 });
    }

    const ok = await reorderSavedReports(auth.ctx.user.id, sectionId, reportIds);
    if (!ok) {
      return NextResponse.json(
        { error: "Invalid reorder: report ids must match this section exactly" },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("POST /api/sections/[id]/reports/reorder", e);
    return NextResponse.json(
      { error: "Failed to reorder reports", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
