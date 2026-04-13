import { NextRequest, NextResponse } from "next/server";
import { forbidden, requireAuth } from "@/lib/auth-route-helpers";
import { isAdminRole } from "@/lib/auth-roles";
import { getSidebarLayoutFromDb, upsertSidebarLayout } from "@/lib/sidebar-layout-db";
import { type SidebarLayout, getSidebarLayoutValidationError } from "@/lib/sidebar-layout";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    const layout = await getSidebarLayoutFromDb();
    return NextResponse.json({ layout });
  } catch (e) {
    console.error("GET /api/sidebar-layout", e);
    return NextResponse.json(
      { error: "Failed to load sidebar layout", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!isAdminRole(auth.ctx.roles)) return forbidden();

    const body = (await req.json()) as unknown;
    const validationError = getSidebarLayoutValidationError(body);
    if (validationError) {
      return NextResponse.json({ error: "Invalid layout payload", details: validationError }, { status: 400 });
    }
    await upsertSidebarLayout(body as SidebarLayout, auth.ctx.user.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("PUT /api/sidebar-layout", e);
    return NextResponse.json(
      { error: "Failed to save sidebar layout", details: e instanceof Error ? e.message : "Unknown" },
      { status: 500 },
    );
  }
}
