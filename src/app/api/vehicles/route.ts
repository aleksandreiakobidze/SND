import { NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { listDriversWithCapacity } from "@/lib/online-drivers-db";

/** GET /api/vehicles — full list of drivers with their capacity settings */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  try {
    const vehicles = await listDriversWithCapacity();
    return NextResponse.json({ vehicles });
  } catch (error) {
    console.error("Vehicles API list error:", error);
    return NextResponse.json(
      { error: "Failed to load vehicles", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
