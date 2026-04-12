import { NextRequest, NextResponse } from "next/server";
import sql from "mssql";
import { executeStoredProcedure } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAccessOnlineOrders } from "@/lib/auth-roles";
import { driverExists } from "@/lib/online-drivers-db";

const DEFAULT_SP = "dbo.usp_OnlineReal_AssignDriver";

function assignDriverProcedureName(): string {
  const name = process.env.MSSQL_ONLINE_ASSIGN_DRIVER_SP || DEFAULT_SP;
  if (!/^[a-zA-Z_][a-zA-Z0-9_.]*$/.test(name)) {
    throw new Error("Invalid MSSQL_ONLINE_ASSIGN_DRIVER_SP");
  }
  return name;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canAccessOnlineOrders(auth.ctx.permissions)) return forbidden();

    const body = (await req.json()) as { idReal1List?: unknown; driverId?: unknown };
    const raw = body.idReal1List;
    const driverId =
      typeof body.driverId === "number"
        ? body.driverId
        : parseInt(String(body.driverId ?? ""), 10);

    if (!Number.isFinite(driverId) || driverId <= 0) {
      return NextResponse.json(
        { error: "driverId must be a positive integer (SndApp_DriverTable.IdMdz or legacy Id column)." },
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
    ];

    if (idReal1List.length === 0) {
      return NextResponse.json({ error: "No valid IdReal1 values." }, { status: 400 });
    }

    const okDriver = await driverExists(driverId);
    if (!okDriver) {
      return NextResponse.json(
        { error: "Driver not found or inactive in SndApp_DriverTable." },
        { status: 400 },
      );
    }

    const proc = assignDriverProcedureName();
    const updated: number[] = [];
    const errors: { idReal1: number; message: string }[] = [];

    for (const idReal1 of idReal1List) {
      try {
        await executeStoredProcedure(proc, [
          { name: "IdReal1", type: sql.Int(), value: idReal1 },
          { name: "DriverId", type: sql.Int(), value: driverId },
        ]);
        updated.push(idReal1);
      } catch (e) {
        errors.push({
          idReal1,
          message: e instanceof Error ? e.message : String(e),
        });
      }
    }

    return NextResponse.json({
      ok: errors.length === 0,
      updated,
      errors,
      procedure: proc,
      hint:
        "Implement dbo.usp_OnlineReal_AssignDriver(IdReal1, DriverId) on SQL Server to update the ERP order header, or set MSSQL_ONLINE_ASSIGN_DRIVER_SP.",
    });
  } catch (error) {
    console.error("Assign driver API error:", error);
    return NextResponse.json(
      {
        error: "Assign driver failed",
        details: error instanceof Error ? error.message : "Unknown",
      },
      { status: 500 },
    );
  }
}
