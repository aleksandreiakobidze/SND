import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { getDriverRegions, setDriverRegions } from "@/lib/online-drivers-db";

type Params = { params: Promise<{ id: string }> };

function parseId(idStr: string): number | null {
  const id = parseInt(idStr, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** GET /api/vehicles/[id]/regions — allowed regions for a driver */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid driver id" }, { status: 400 });

  try {
    const regions = await getDriverRegions(id);
    return NextResponse.json({ regions });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load regions", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/** PUT /api/vehicles/[id]/regions — replace allowed regions for a driver */
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  const id = parseId((await params).id);
  if (!id) return NextResponse.json({ error: "Invalid driver id" }, { status: 400 });

  try {
    const body = (await req.json()) as { regions?: string[] };
    const regions = Array.isArray(body.regions) ? body.regions.filter((r) => typeof r === "string") : [];
    await setDriverRegions(id, regions);
    return NextResponse.json({ ok: true, regions });
  } catch (error) {
    console.error("Driver regions update error:", error);
    return NextResponse.json(
      { error: "Failed to update regions", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
