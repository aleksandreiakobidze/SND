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
