import sql, { type ISqlType } from "mssql";
import { rvaSql } from "@/lib/realview-columns";
import { VIEW_NAME } from "@/lib/schema";

/** App metadata: SndApp_*, sessions, workspaces. */
export function getAppDatabaseName(): string {
  return process.env.MSSQL_DATABASE || "SND";
}

/**
 * Reporting / analytics: RealViewAgent, OnlineRealViewAgent, saved report SELECTs.
 * Defaults to the app DB when unset — same connection as `getPool()`.
 */
export function getAnalyticsDatabaseName(): string {
  const explicit = process.env.MSSQL_ANALYTICS_DATABASE?.trim();
  if (explicit) return explicit;
  return getAppDatabaseName();
}

function getMssqlConfigForDatabase(database: string): sql.config {
  return {
    server: process.env.MSSQL_SERVER || "192.168.0.200",
    database,
    user: process.env.MSSQL_USER || "SND",
    password: process.env.MSSQL_PASSWORD || "Sandro1991!",
    options: {
      encrypt: false,
      trustServerCertificate: true,
    },
    requestTimeout: 30000,
    connectionTimeout: 15000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

function poolKeyFromConfig(cfg: sql.config): string {
  return [cfg.server, cfg.database, cfg.user, cfg.password].join("\0");
}

let poolPromise: Promise<sql.ConnectionPool> | null = null;
let activePoolKey = "";

let poolAnalyticsPromise: Promise<sql.ConnectionPool> | null = null;
let activeAnalyticsPoolKey = "";

/** Shared pool for app tables (auth, workspace metadata). */
export async function getPool(): Promise<sql.ConnectionPool> {
  const cfg = getMssqlConfigForDatabase(getAppDatabaseName());
  const key = poolKeyFromConfig(cfg);
  if (poolPromise && activePoolKey !== key) {
    try {
      const old = await poolPromise;
      await old.close();
    } catch {
      /* ignore */
    }
    poolPromise = null;
    activePoolKey = "";
  }
  if (!poolPromise) {
    activePoolKey = key;
    poolPromise = sql.connect(cfg).catch((err) => {
      poolPromise = null;
      activePoolKey = "";
      throw err;
    });
  }
  return poolPromise;
}

/**
 * Pool for dashboard, filter-options, reports, agent read-only SQL, online orders.
 * Use `MSSQL_ANALYTICS_DATABASE` when views live in a different DB than `MSSQL_DATABASE`.
 */
export async function getAnalyticsPool(): Promise<sql.ConnectionPool> {
  const appDb = getAppDatabaseName();
  const analyticsDb = getAnalyticsDatabaseName();
  if (analyticsDb === appDb) {
    return getPool();
  }
  const cfg = getMssqlConfigForDatabase(analyticsDb);
  const key = poolKeyFromConfig(cfg);
  if (poolAnalyticsPromise && activeAnalyticsPoolKey !== key) {
    try {
      const old = await poolAnalyticsPromise;
      await old.close();
    } catch {
      /* ignore */
    }
    poolAnalyticsPromise = null;
    activeAnalyticsPoolKey = "";
  }
  if (!poolAnalyticsPromise) {
    activeAnalyticsPoolKey = key;
    poolAnalyticsPromise = sql.connect(cfg).catch((err) => {
      poolAnalyticsPromise = null;
      activeAnalyticsPoolKey = "";
      throw err;
    });
  }
  return poolAnalyticsPromise;
}

const FORBIDDEN_KEYWORDS = [
  "INSERT",
  "UPDATE",
  "DELETE",
  "DROP",
  "ALTER",
  "CREATE",
  "TRUNCATE",
  "EXEC",
  "EXECUTE",
  "MERGE",
  "GRANT",
  "REVOKE",
  "xp_",
  "sp_",
];

/** Reject non-SELECT / dangerous SQL before save or execution (workspace saved reports). */
export function validateReadOnlySql(query: string): void {
  const upper = query.toUpperCase().replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const keyword of FORBIDDEN_KEYWORDS) {
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(upper)) {
      throw new Error(`Forbidden SQL operation detected: ${keyword}`);
    }
  }
}

function validateReadOnly(query: string): void {
  validateReadOnlySql(query);
}

export async function executeReadOnlyQuery(
  query: string,
  maxRows: number = 10000
): Promise<Record<string, unknown>[]> {
  validateReadOnly(query);

  const wrappedQuery = query.includes("TOP")
    ? query
    : query.replace(/^\s*SELECT\b/i, `SELECT TOP ${maxRows}`);

  const pool = await getAnalyticsPool();
  const result = await pool.request().query(wrappedQuery);
  return result.recordset;
}

const SAFE_PROC_NAME = /^[a-zA-Z_][a-zA-Z0-9_.]*$/;

/**
 * Execute a stored procedure with typed parameters (used for online → Real transfer).
 * Procedure name must match SAFE_PROC_NAME (alphanumeric, underscore, optional dbo. prefix).
 */
export async function executeStoredProcedure(
  procedureName: string,
  inputs: Array<{ name: string; type: ISqlType; value: unknown }>
) {
  if (!SAFE_PROC_NAME.test(procedureName)) {
    throw new Error("Invalid procedure name");
  }
  const pool = await getAnalyticsPool();
  const request = pool.request();
  for (const input of inputs) {
    request.input(input.name, input.type, input.value);
  }
  return request.execute(procedureName);
}

const SALES_MAP_UPDATE_CHUNK = 200;

const MDZ_NVARCHAR_LEN = 50;

/**
 * Sets driver IdMdz, Mdz, and Micodeba=0 on all RealViewAgent lines matching the given order headers.
 * Mdz text is filled from SndApp_DriverTable.Mdz (name column; see driver-table-env.ts / MSSQL_DRIVER_COL_NAME).
 * Micodeba: 0 = assigned, 1 = unassigned (ERP convention).
 * Uses parameterized UPDATE only (no string-built identifiers for values).
 */
export async function executeSalesMapDriverUpdate(
  idReal1List: number[],
  driverId: number,
  driverDisplayName: string,
): Promise<void> {
  const unique = [...new Set(idReal1List)].filter((n) => Number.isFinite(n) && n > 0);
  if (unique.length === 0) return;

  const trimmed = driverDisplayName.trim();
  const mdzText = trimmed.slice(0, MDZ_NVARCHAR_LEN);

  const idmdz = rvaSql("IDMDZ");
  const mdzCol = rvaSql("MDZ");
  const micodeba = rvaSql("MICODEBA");
  const id1 = rvaSql("IDREAL1");
  const pool = await getAnalyticsPool();

  for (let i = 0; i < unique.length; i += SALES_MAP_UPDATE_CHUNK) {
    const chunk = unique.slice(i, i + SALES_MAP_UPDATE_CHUNK);
    const req = pool.request();
    req.input("driverId", sql.Int, driverId);
    req.input("mdzText", sql.NVarChar(MDZ_NVARCHAR_LEN), mdzText);
    req.input("micodebaAssigned", sql.TinyInt, 0);
    const placeholders: string[] = [];
    chunk.forEach((id, idx) => {
      const name = `id${idx}`;
      req.input(name, sql.Int, id);
      placeholders.push(`@${name}`);
    });
    await req.query(
      `UPDATE ${VIEW_NAME} SET ${idmdz} = @driverId, ${mdzCol} = @mdzText, ${micodeba} = @micodebaAssigned WHERE ${id1} IN (${placeholders.join(",")})`,
    );
  }
}
