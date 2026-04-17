import { NextRequest, NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { updateDriverCapacity, listDriversWithCapacity } from "@/lib/online-drivers-db";

type Params = { params: Promise<{ id: string }> };

/** GET /api/vehicles/[id] — single driver with capacity */
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid driver id" }, { status: 400 });
  }

  try {
    const all = await listDriversWithCapacity();
    const vehicle = all.find((v) => v.id === id);
    if (!vehicle) return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    return NextResponse.json({ vehicle });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to load vehicle", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

/** PUT /api/vehicles/[id] — update capacity fields */
export async function PUT(req: NextRequest, { params }: Params) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "Invalid driver id" }, { status: 400 });
  }

  try {
    const body = (await req.json()) as {
      maxLiters?: number | null;
      maxKg?: number | null;
      maxOrders?: number | null;
      maxPallets?: number | null;
      vehiclePlate?: string | null;
      vehicleType?: string | null;
    };

    const toNum = (v: unknown): number | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      const n = Number(v);
      return Number.isFinite(n) && n >= 0 ? n : null;
    };
    const toStr = (v: unknown): string | null | undefined => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      return String(v).slice(0, 50);
    };

    const updated = await updateDriverCapacity(id, {
      maxLiters: toNum(body.maxLiters),
      maxKg: toNum(body.maxKg),
      maxOrders: body.maxOrders !== undefined ? (body.maxOrders === null ? null : Math.floor(Number(body.maxOrders))) : undefined,
      maxPallets:
        body.maxPallets !== undefined
          ? body.maxPallets === null
            ? null
            : (() => {
                const n = Math.floor(Number(body.maxPallets));
                return Number.isFinite(n) && n >= 0 ? n : null;
              })()
          : undefined,
      vehiclePlate: body.vehiclePlate !== undefined ? (toStr(body.vehiclePlate) as string | null) : undefined,
      vehicleType: body.vehicleType !== undefined ? (toStr(body.vehicleType) as string | null) : undefined,
    });

    if (!updated) {
      return NextResponse.json({ error: "Driver not found or nothing to update" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Vehicles API update error:", error);
    return NextResponse.json(
      { error: "Failed to update vehicle", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
