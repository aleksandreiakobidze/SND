import { sqlIdent } from "@/lib/online-columns";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Physical column names on dbo.SndApp_DriverTable.
 * Defaults match ERP-style lookup: IdMdz + Mdz (same meaning as RealViewAgent).
 * Legacy app-created table used Id + DisplayName + IsActive — set env to match.
 *
 * MSSQL_DRIVER_COL_ID — default IdMdz
 * MSSQL_DRIVER_COL_NAME — default Mdz
 * MSSQL_DRIVER_ACTIVE_COL — optional; if set (e.g. IsActive), list/get filter WHERE col = 1
 */
export function driverTableIdColumn(): string {
  const raw = process.env.MSSQL_DRIVER_COL_ID?.trim();
  if (raw && IDENT.test(raw)) return raw;
  return "IdMdz";
}

export function driverTableNameColumn(): string {
  const raw = process.env.MSSQL_DRIVER_COL_NAME?.trim();
  if (raw && IDENT.test(raw)) return raw;
  return "Mdz";
}

/** If set, only drivers with this column = 1 are listed (optional). */
export function driverTableActiveColumn(): string | null {
  const raw = process.env.MSSQL_DRIVER_ACTIVE_COL?.trim();
  if (!raw || !IDENT.test(raw)) return null;
  return raw;
}

export function driverTableIdSql(): string {
  return sqlIdent(driverTableIdColumn());
}

export function driverTableNameSql(): string {
  return sqlIdent(driverTableNameColumn());
}

export function driverTableActiveSql(): string | null {
  const c = driverTableActiveColumn();
  return c ? sqlIdent(c) : null;
}
