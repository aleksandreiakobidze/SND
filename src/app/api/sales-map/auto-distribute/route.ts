import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { listDriversWithCapacity } from "@/lib/online-drivers-db";
import { buildUnassignedOrdersQuery } from "@/lib/sales-map-sql";
import { buildNonDateConditions } from "@/lib/filters";
import { autoDistribute, optimizeRouteOrder } from "@/lib/distribution/auto-distribute";
import { getFleetForDate } from "@/lib/fleet-schedule-db";
import type { DriverCapacity, OrderForDistribution } from "@/lib/distribution/distribution-types";

/**
 * POST /api/sales-map/auto-distribute
 * Returns a proposed distribution plan (preview — does NOT write).
 *
 * Body: { filters?: string, deliveryDate?: string }
 * If deliveryDate is provided and a fleet is scheduled for that date,
 * only those drivers participate in distribution.
 */
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

    const body = await req.json().catch(() => ({})) as {
      filters?: string;
      deliveryDate?: string;
    };

    // Build non-date WHERE conditions only (region, manager, etc.)
    // The date filter is handled separately via deliveryDate to ensure correct ordering date.
    const params = new URLSearchParams(body.filters ?? "");
    const nonDateConditions = buildNonDateConditions(params);
    const nonDateWhere =
      nonDateConditions.length > 0
        ? " WHERE " + nonDateConditions.join(" AND ")
        : "";

    const sqlStr = buildUnassignedOrdersQuery(nonDateWhere, body.deliveryDate ?? undefined);
    const rows = await executeReadOnlyQuery(sqlStr);

    const orders: OrderForDistribution[] = rows
      .map((r) => {
        const lat = Number(r.Lat);
        const lon = Number(r.Lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
        return {
          idReal1: Number(r.IdReal1),
          lat,
          lon,
          liters: Number(r.OrderLiters) || 0,
          weightKg: Number(r.BrutoTotal) || 0,
          amount: Number(r.OrderTotal) || 0,
          org: String(r.Org ?? ""),
          reg: String(r.Reg ?? ""),
          orgCode: String(r.OrgCode ?? ""),
          city: String(r.City ?? ""),
        };
      })
      .filter((o): o is OrderForDistribution => o !== null);

    const driversRaw = await listDriversWithCapacity();

    let scheduledIds: number[] = [];
    let fleetFiltered = false;

    if (body.deliveryDate) {
      scheduledIds = await getFleetForDate(body.deliveryDate);
      if (scheduledIds.length > 0) {
        fleetFiltered = true;
      }
    }

    const scheduledSet = new Set(scheduledIds);
    const drivers: DriverCapacity[] = driversRaw
      .filter((d) => !fleetFiltered || scheduledSet.has(d.id))
      .map((d) => ({
        id: d.id,
        displayName: d.displayName,
        maxLiters: d.maxLiters ?? 0,
        maxKg: d.maxKg ?? 0,
        maxOrders: d.maxOrders ?? 0,
        vehiclePlate: d.vehiclePlate,
        vehicleType: d.vehicleType,
      }));

    const plan = autoDistribute(orders, drivers);

    const orderMap = new Map(orders.map((o) => [o.idReal1, o]));
    for (const stat of plan.driverStats) {
      const driverOrders = stat.orderIds
        .map((id) => orderMap.get(id))
        .filter((o): o is OrderForDistribution => o !== null);
      stat.orderIds = optimizeRouteOrder(driverOrders);
    }

    return NextResponse.json({
      plan,
      orders,
      meta: {
        deliveryDate: body.deliveryDate ?? null,
        fleetFiltered,
        fleetDriverCount: fleetFiltered ? scheduledIds.length : driversRaw.length,
      },
    });
  } catch (error) {
    console.error("Auto-distribute API error:", error);
    return NextResponse.json(
      { error: "Auto-distribution failed", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
