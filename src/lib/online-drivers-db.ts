import sql from "mssql";
import { getPool } from "@/lib/db";
import {
  driverTableActiveSql,
  driverTableIdSql,
  driverTableNameSql,
} from "@/lib/driver-table-env";
import { rvaSql } from "@/lib/realview-columns";
import { VIEW_NAME } from "@/lib/schema";

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
  maxPallets: number | null;
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
              MaxCapacityLiters, MaxCapacityKg, MaxOrders, MaxPallets,
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
      maxPallets: null,
      vehiclePlate: null,
      vehicleType: null,
    }));
  }
}

export interface UpdateCapacityInput {
  maxLiters?: number | null;
  maxKg?: number | null;
  maxOrders?: number | null;
  maxPallets?: number | null;
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
  if (input.maxPallets !== undefined) {
    setClauses.push("MaxPallets = @maxPallets");
    req.input("maxPallets", sql.Int, input.maxPallets ?? null);
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

/* ── Driver-Region permissions (migration 015) ─────────────────── */

const REGION_TABLE = "dbo.SndApp_DriverRegion";

export async function getDriverRegions(driverId: number): Promise<string[]> {
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input("id", sql.Int, driverId)
      .query<{ RegionCode: string }>(
        `SELECT RegionCode FROM ${REGION_TABLE} WHERE DriverId = @id ORDER BY RegionCode`,
      );
    return (r.recordset ?? []).map((row) => row.RegionCode);
  } catch {
    return [];
  }
}

export async function getAllDriverRegions(): Promise<Map<number, string[]>> {
  const m = new Map<number, string[]>();
  try {
    const pool = await getPool();
    const r = await pool.request().query<{ DriverId: number; RegionCode: string }>(
      `SELECT DriverId, RegionCode FROM ${REGION_TABLE} ORDER BY DriverId, RegionCode`,
    );
    for (const row of r.recordset ?? []) {
      const id = Number(row.DriverId);
      const list = m.get(id) ?? [];
      list.push(row.RegionCode);
      m.set(id, list);
    }
  } catch {
    // Table might not exist yet — return empty map (unrestricted)
  }
  return m;
}

export async function setDriverRegions(
  driverId: number,
  regions: string[],
): Promise<void> {
  const unique = [...new Set(regions.map((r) => r.trim()).filter(Boolean))];
  const pool = await getPool();
  const tx = pool.transaction();
  await tx.begin();
  try {
    await tx
      .request()
      .input("id", sql.Int, driverId)
      .query(`DELETE FROM ${REGION_TABLE} WHERE DriverId = @id`);
    for (const code of unique) {
      await tx
        .request()
        .input("id", sql.Int, driverId)
        .input("code", sql.NVarChar(100), code)
        .query(`INSERT INTO ${REGION_TABLE} (DriverId, RegionCode) VALUES (@id, @code)`);
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

export async function getAvailableRegions(): Promise<string[]> {
  try {
    const pool = await getPool();
    const reg = rvaSql("REG");
    const r = await pool.request().query<{ Reg: string }>(
      `SELECT DISTINCT ${reg} AS Reg FROM ${VIEW_NAME} WHERE ${reg} IS NOT NULL AND ${reg} <> '' ORDER BY Reg`,
    );
    return (r.recordset ?? []).map((row) => String(row.Reg).trim()).filter(Boolean);
  } catch {
    return [];
  }
}

/* ── Helpers ───────────────────────────────────────────────────── */

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
    maxPallets: toNum(row.MaxPallets),
    vehiclePlate: toStr(row.VehiclePlate),
    vehicleType: toStr(row.VehicleType),
  };
}
