import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import {
  getFleetForDate,
  setFleetForDate,
  listUpcomingFleets,
  copyFleetToDate,
} from "@/lib/fleet-schedule-db";
import { listDriversWithCapacity } from "@/lib/online-drivers-db";

/**
 * GET /api/fleet-schedule?date=YYYY-MM-DD
 * Returns the fleet scheduled for the given date + driver details.
 * Also returns upcoming fleet summary when no date is provided.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  try {
    const date = req.nextUrl.searchParams.get("date");

    if (!date) {
      const upcoming = await listUpcomingFleets();
      return NextResponse.json({ upcoming });
    }

    const [scheduledIds, allDrivers] = await Promise.all([
      getFleetForDate(date),
      listDriversWithCapacity(),
    ]);

    return NextResponse.json({
      date,
      scheduledIds,
      drivers: allDrivers,
      count: scheduledIds.length,
    });
  } catch (error) {
    console.error("Fleet schedule GET error:", error);
    return NextResponse.json(
      { error: "Failed to load fleet schedule", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/**
 * POST /api/fleet-schedule
 * Body: { date: string, driverIds: number[] } — replaces the fleet for that date.
 * Body: { fromDate: string, toDate: string } — copies fleet from one date to another.
 */
export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  try {
    const body = (await req.json()) as {
      date?: string;
      driverIds?: unknown[];
      fromDate?: string;
      toDate?: string;
    };

    if (body.fromDate && body.toDate) {
      await copyFleetToDate(body.fromDate, body.toDate);
      const count = (await getFleetForDate(body.toDate)).length;
      return NextResponse.json({ ok: true, date: body.toDate, count });
    }

    const date = body.date;
    if (!date || typeof date !== "string") {
      return NextResponse.json({ error: "date (YYYY-MM-DD) is required" }, { status: 400 });
    }

    const raw = body.driverIds ?? [];
    if (!Array.isArray(raw)) {
      return NextResponse.json({ error: "driverIds must be an array" }, { status: 400 });
    }

    const driverIds = raw
      .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
      .filter((n) => Number.isFinite(n) && n > 0);

    await setFleetForDate(date, driverIds);
    return NextResponse.json({ ok: true, date, count: driverIds.length });
  } catch (error) {
    console.error("Fleet schedule POST error:", error);
    return NextResponse.json(
      { error: "Failed to save fleet schedule", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
