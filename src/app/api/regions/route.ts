import { NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { getAvailableRegions } from "@/lib/online-drivers-db";

/** GET /api/regions — all distinct region values from the sales data */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  try {
    const regions = await getAvailableRegions();
    return NextResponse.json({ regions });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load regions", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
