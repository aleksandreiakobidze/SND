import { NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { listDriversWithCapacity } from "@/lib/online-drivers-db";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  try {
    const drivers = await listDriversWithCapacity();
    return NextResponse.json({ drivers });
  } catch (error) {
    console.error("Driver capacity API error:", error);
    return NextResponse.json(
      { error: "Failed to load driver capacities", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
