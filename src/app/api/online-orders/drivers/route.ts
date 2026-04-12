import { NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAccessOnlineOrders } from "@/lib/auth-roles";
import { listActiveDrivers } from "@/lib/online-drivers-db";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAccessOnlineOrders(auth.ctx.permissions)) return forbidden();

  try {
    const drivers = await listActiveDrivers();
    return NextResponse.json({ drivers });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (
      msg.includes("Invalid object name") &&
      msg.includes("SndApp_DriverTable")
    ) {
      return NextResponse.json({
        drivers: [] as { id: number; displayName: string }[],
        warning:
          "Table dbo.SndApp_DriverTable not found. Run scripts/migrations/005-snd-app-driver-table.sql on the app database.",
      });
    }
    if ((error as { number?: number })?.number === 208) {
      return NextResponse.json({
        drivers: [],
        warning:
          "dbo.SndApp_DriverTable missing — run migration 005-snd-app-driver-table.sql.",
      });
    }
    console.error("Drivers list error:", error);
    return NextResponse.json(
      { error: "Failed to load drivers", details: msg },
      { status: 500 },
    );
  }
}
