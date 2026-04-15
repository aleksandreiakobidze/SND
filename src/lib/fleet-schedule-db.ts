import sql from "mssql";
import { getPool } from "@/lib/db";

const TABLE = "dbo.SndApp_FleetSchedule";

function isValidDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/**
 * Returns the list of driver IDs scheduled for a given delivery date.
 * Returns an empty array if no fleet is scheduled or the table doesn't exist.
 */
export async function getFleetForDate(date: string): Promise<number[]> {
  if (!isValidDate(date)) return [];
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .input("date", sql.Date, date)
      .query<{ DriverId: number }>(
        `SELECT DriverId FROM ${TABLE} WHERE DeliveryDate = @date`,
      );
    return (r.recordset ?? []).map((row) => Number(row.DriverId));
  } catch {
    return [];
  }
}

/**
 * Replaces the entire fleet for a delivery date.
 * Deletes all existing rows for that date, then inserts the new set.
 * Pass an empty array to clear a date's fleet.
 */
export async function setFleetForDate(
  date: string,
  driverIds: number[],
): Promise<void> {
  if (!isValidDate(date)) throw new Error("Invalid date format — expected YYYY-MM-DD");
  const unique = [...new Set(driverIds.filter((id) => Number.isFinite(id) && id > 0))];
  const pool = await getPool();
  const tx = pool.transaction();
  await tx.begin();
  try {
    await tx
      .request()
      .input("date", sql.Date, date)
      .query(`DELETE FROM ${TABLE} WHERE DeliveryDate = @date`);

    for (const driverId of unique) {
      await tx
        .request()
        .input("date", sql.Date, date)
        .input("driverId", sql.Int, driverId)
        .query(
          `INSERT INTO ${TABLE} (DeliveryDate, DriverId) VALUES (@date, @driverId)`,
        );
    }
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => undefined);
    throw err;
  }
}

export interface UpcomingFleetEntry {
  date: string;
  count: number;
}

/**
 * Returns a summary of scheduled fleets for the next 14 days (including today).
 */
export async function listUpcomingFleets(): Promise<UpcomingFleetEntry[]> {
  try {
    const pool = await getPool();
    const r = await pool
      .request()
      .query<{ DeliveryDate: Date | string; cnt: number }>(
        `SELECT DeliveryDate, COUNT(*) AS cnt
         FROM ${TABLE}
         WHERE DeliveryDate >= CAST(GETDATE() AS DATE)
           AND DeliveryDate <= DATEADD(DAY, 14, CAST(GETDATE() AS DATE))
         GROUP BY DeliveryDate
         ORDER BY DeliveryDate`,
      );
    return (r.recordset ?? []).map((row) => {
      const d = row.DeliveryDate;
      const dateStr =
        d instanceof Date
          ? d.toISOString().slice(0, 10)
          : String(d).slice(0, 10);
      return { date: dateStr, count: Number(row.cnt) };
    });
  } catch {
    return [];
  }
}

/**
 * Copy fleet from one date to another (useful for "copy from today").
 */
export async function copyFleetToDate(
  fromDate: string,
  toDate: string,
): Promise<void> {
  const ids = await getFleetForDate(fromDate);
  await setFleetForDate(toDate, ids);
}
