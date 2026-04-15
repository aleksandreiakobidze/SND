import sql from "mssql";
import { getPool } from "@/lib/db";
import {
  driverTableActiveSql,
  driverTableIdSql,
  driverTableNameSql,
} from "@/lib/driver-table-env";

export type DriverRow = {
  id: number;
  displayName: string;
};

function activeWhereClause(): string {
  const a = driverTableActiveSql();
  return a ? `WHERE ${a} = 1` : "";
}

function activeAndClause(): string {
  const a = driverTableActiveSql();
  return a ? `AND ${a} = 1` : "";
}

export async function listActiveDrivers(): Promise<DriverRow[]> {
  const pool = await getPool();
  const idCol = driverTableIdSql();
  const nameCol = driverTableNameSql();
  const r = await pool.request().query<{ id: number; displayName: string | null }>(
    `SELECT ${idCol} AS id, ${nameCol} AS displayName
     FROM dbo.SndApp_DriverTable
     ${activeWhereClause()}
     ORDER BY ${nameCol}`,
  );
  return (r.recordset ?? []).map((row) => ({
    id: Number(row.id),
    displayName: row.displayName != null && String(row.displayName).trim() !== "" ? String(row.displayName) : "—",
  }));
}

/** Row for assign; null if missing (and optional active filter fails). */
export async function getActiveDriverById(id: number): Promise<DriverRow | null> {
  const pool = await getPool();
  const idCol = driverTableIdSql();
  const nameCol = driverTableNameSql();
  const r = await pool
    .request()
    .input("id", sql.Int, id)
    .query<{ id: number; displayName: string | null }>(
      `SELECT ${idCol} AS id, ${nameCol} AS displayName
       FROM dbo.SndApp_DriverTable
       WHERE ${idCol} = @id ${activeAndClause()}`,
    );
  const row = r.recordset[0];
  if (!row) return null;
  return {
    id: Number(row.id),
    displayName:
      row.displayName != null && String(row.displayName).trim() !== ""
        ? String(row.displayName)
        : "—",
  };
}

export async function driverExists(id: number): Promise<boolean> {
  return (await getActiveDriverById(id)) != null;
}

export type DriverWithCapacity = DriverRow & {
  maxLiters: number | null;
  maxKg: number | null;
  maxOrders: number | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
};

/**
 * Drivers with vehicle capacity columns (migration 012).
 * Falls back to base DriverRow fields if capacity columns are missing.
 */
export async function listDriversWithCapacity(): Promise<DriverWithCapacity[]> {
  const pool = await getPool();
  const idCol = driverTableIdSql();
  const nameCol = driverTableNameSql();
  try {
    const r = await pool.request().query<Record<string, unknown>>(
      `SELECT ${idCol} AS id, ${nameCol} AS displayName,
              MaxCapacityLiters, MaxCapacityKg, MaxOrders,
              VehiclePlate, VehicleType
       FROM dbo.SndApp_DriverTable
       ${activeWhereClause()}
       ORDER BY ${nameCol}`,
    );
    return (r.recordset ?? []).map(mapCapacityRow);
  } catch {
    const base = await listActiveDrivers();
    return base.map((d) => ({
      ...d,
      maxLiters: null,
      maxKg: null,
      maxOrders: null,
      vehiclePlate: null,
      vehicleType: null,
    }));
  }
}

export interface UpdateCapacityInput {
  maxLiters?: number | null;
  maxKg?: number | null;
  maxOrders?: number | null;
  vehiclePlate?: string | null;
  vehicleType?: string | null;
}

/**
 * Updates vehicle capacity fields for a single driver.
 * Only updates fields that are provided (not undefined).
 */
export async function updateDriverCapacity(
  id: number,
  input: UpdateCapacityInput,
): Promise<boolean> {
  const pool = await getPool();
  const idCol = driverTableIdSql();
  const setClauses: string[] = [];
  const req = pool.request().input("id", sql.Int, id);

  if (input.maxLiters !== undefined) {
    setClauses.push("MaxCapacityLiters = @maxLiters");
    req.input("maxLiters", sql.Numeric(12, 2), input.maxLiters ?? null);
  }
  if (input.maxKg !== undefined) {
    setClauses.push("MaxCapacityKg = @maxKg");
    req.input("maxKg", sql.Numeric(12, 2), input.maxKg ?? null);
  }
  if (input.maxOrders !== undefined) {
    setClauses.push("MaxOrders = @maxOrders");
    req.input("maxOrders", sql.Int, input.maxOrders ?? null);
  }
  if (input.vehiclePlate !== undefined) {
    setClauses.push("VehiclePlate = @vehiclePlate");
    req.input("vehiclePlate", sql.NVarChar(20), input.vehiclePlate ?? null);
  }
  if (input.vehicleType !== undefined) {
    setClauses.push("VehicleType = @vehicleType");
    req.input("vehicleType", sql.NVarChar(50), input.vehicleType ?? null);
  }

  if (setClauses.length === 0) return false;

  const result = await req.query(
    `UPDATE dbo.SndApp_DriverTable SET ${setClauses.join(", ")} WHERE ${idCol} = @id`,
  );
  return (result.rowsAffected[0] ?? 0) > 0;
}

function mapCapacityRow(row: Record<string, unknown>): DriverWithCapacity {
  const id = Number(row.id);
  const dn = row.displayName;
  const displayName =
    dn != null && String(dn).trim() !== "" ? String(dn) : "—";
  const toNum = (v: unknown): number | null => {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  const toStr = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s || null;
  };
  return {
    id,
    displayName,
    maxLiters: toNum(row.MaxCapacityLiters),
    maxKg: toNum(row.MaxCapacityKg),
    maxOrders: toNum(row.MaxOrders),
    vehiclePlate: toStr(row.VehiclePlate),
    vehicleType: toStr(row.VehicleType),
  };
}
