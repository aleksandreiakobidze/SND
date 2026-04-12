import { NextResponse } from "next/server";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canViewDashboard } from "@/lib/auth-roles";
import { getAnalyticsDatabaseName, getAppDatabaseName } from "@/lib/db";
import { listActiveDrivers } from "@/lib/online-drivers-db";
import { sqlServerErrorNumber } from "@/lib/sql-api-error";

function driverTableWarningMessage(): string {
  const db = getAppDatabaseName();
  const analyticsDb = getAnalyticsDatabaseName();
  const core =
    `Cannot load dbo.SndApp_DriverTable in database "${db}". ` +
    `Expected columns IdMdz + Mdz (defaults), or set MSSQL_DRIVER_COL_ID / MSSQL_DRIVER_COL_NAME / optional MSSQL_DRIVER_ACTIVE_COL. ` +
    `See scripts/migrations/005-snd-app-driver-table.sql.`;
  if (analyticsDb !== db) {
    return (
      core +
      ` Drivers use MSSQL_DATABASE="${db}"; analytics uses MSSQL_ANALYTICS_DATABASE="${analyticsDb}".`
    );
  }
  return core;
}

function isDriverTableGracefulError(error: unknown, message: string): boolean {
  const lower = message.toLowerCase();
  const n = sqlServerErrorNumber(error);
  // 208 = object missing; 207 = column mismatch — this route only runs listActiveDrivers()
  if (n === 208 || n === 207) return true;
  if (lower.includes("sndapp_drivertable")) return true;
  if (lower.includes("invalid object name") && lower.includes("driver")) return true;
  return false;
}

/** Active drivers from dbo.SndApp_DriverTable (for sales map, etc.). */
export async function GET() {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canViewDashboard(auth.ctx.permissions)) return forbidden();

  try {
    const drivers = await listActiveDrivers();
    return NextResponse.json({ drivers });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (isDriverTableGracefulError(error, msg)) {
      console.warn("[api/drivers] SndApp_DriverTable:", msg);
      return NextResponse.json({
        drivers: [] as { id: number; displayName: string }[],
        warning: driverTableWarningMessage(),
        appDatabase: getAppDatabaseName(),
      });
    }
    console.error("Drivers API error:", error);
    return NextResponse.json(
      { error: "Failed to load drivers", details: msg },
      { status: 500 },
    );
  }
}
