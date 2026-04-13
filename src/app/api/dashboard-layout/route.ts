import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-route-helpers";
import { getDashboardLayoutForUser, upsertDashboardLayout } from "@/lib/dashboard-layout-db";
import { type DashboardLayout, getDashboardLayoutValidationError } from "@/lib/dashboard-layout";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    const layout = await getDashboardLayoutForUser(auth.ctx.user.id);
    return NextResponse.json({ layout });
  } catch (e) {
    console.error("GET /api/dashboard-layout", e);
    return NextResponse.json(
      { error: "Failed to load dashboard layout", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;

    const body = (await req.json()) as unknown;
    const validationError = getDashboardLayoutValidationError(body);
    if (validationError) {
      return NextResponse.json({ error: "Invalid layout payload", details: validationError }, { status: 400 });
    }
    await upsertDashboardLayout(auth.ctx.user.id, body as DashboardLayout);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/dashboard-layout", e);
    return NextResponse.json(
      { error: "Failed to save dashboard layout", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
