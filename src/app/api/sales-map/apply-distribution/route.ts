import { NextRequest, NextResponse } from "next/server";
import { executeSalesMapDriverUpdate } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { getActiveDriverById } from "@/lib/online-drivers-db";

/**
 * POST /api/sales-map/apply-distribution
 * Commits a distribution plan: assigns orders to drivers.
 * Body: { assignments: { [driverId: string]: number[] } }
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

    const body = await req.json() as {
      assignments?: Record<string, number[]>;
    };

    const assignments = body.assignments;
    if (!assignments || typeof assignments !== "object") {
      return NextResponse.json(
        { error: "Body must include assignments: { driverId: number[] }" },
        { status: 400 },
      );
    }

    const results: Array<{
      driverId: number;
      driverName: string;
      orderCount: number;
      ok: boolean;
      error?: string;
    }> = [];

    for (const [driverIdStr, orderIds] of Object.entries(assignments)) {
      const driverId = parseInt(driverIdStr, 10);
      if (!Number.isFinite(driverId) || driverId <= 0) continue;

      const ids = (orderIds ?? [])
        .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
        .filter((n) => Number.isFinite(n) && n > 0);

      if (ids.length === 0) continue;

      try {
        const driver = await getActiveDriverById(driverId);
        if (!driver) {
          results.push({
            driverId,
            driverName: "?",
            orderCount: ids.length,
            ok: false,
            error: "Driver not found or inactive",
          });
          continue;
        }

        await executeSalesMapDriverUpdate(ids, driverId, driver.displayName);
        results.push({
          driverId,
          driverName: driver.displayName,
          orderCount: ids.length,
          ok: true,
        });
      } catch (err) {
        results.push({
          driverId,
          driverName: "?",
          orderCount: ids.length,
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const totalAssigned = results.filter((r) => r.ok).reduce((s, r) => s + r.orderCount, 0);
    const allOk = results.every((r) => r.ok);

    return NextResponse.json({
      ok: allOk,
      totalAssigned,
      results,
    });
  } catch (error) {
    console.error("Apply distribution API error:", error);
    return NextResponse.json(
      { error: "Distribution apply failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
