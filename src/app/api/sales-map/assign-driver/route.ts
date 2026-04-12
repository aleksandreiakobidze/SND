import { NextRequest, NextResponse } from "next/server";
import { executeSalesMapDriverUpdate } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { getActiveDriverById } from "@/lib/online-drivers-db";

const MAX_IDS = 500;

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

    const body = (await req.json()) as { idReal1List?: unknown; driverId?: unknown };
    const raw = body.idReal1List;
    const driverId =
      typeof body.driverId === "number"
        ? body.driverId
        : parseInt(String(body.driverId ?? ""), 10);

    if (!Number.isFinite(driverId) || driverId <= 0) {
      return NextResponse.json(
        { error: "driverId must be a positive integer (SndApp_DriverTable.IdMdz = RealViewAgent IdMdz)." },
        { status: 400 },
      );
    }

    if (!Array.isArray(raw) || raw.length === 0) {
      return NextResponse.json(
        { error: "Body must include idReal1List: number[] with at least one IdReal1." },
        { status: 400 },
      );
    }

    const idReal1List = [
      ...new Set(
        raw
          .map((x) => (typeof x === "number" ? x : parseInt(String(x), 10)))
          .filter((n) => Number.isFinite(n) && n > 0),
      ),
    ].slice(0, MAX_IDS);

    if (idReal1List.length === 0) {
      return NextResponse.json({ error: "No valid IdReal1 values." }, { status: 400 });
    }

    const driver = await getActiveDriverById(driverId);
    if (!driver) {
      return NextResponse.json(
        { error: "Driver not found or inactive in SndApp_DriverTable." },
        { status: 400 },
      );
    }

    await executeSalesMapDriverUpdate(idReal1List, driverId, driver.displayName);

    return NextResponse.json({
      ok: true,
      updatedOrders: idReal1List.length,
    });
  } catch (error) {
    console.error("Sales map assign-driver API error:", error);
    return NextResponse.json(
      {
        error: "Update failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
