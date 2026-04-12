import { NextResponse } from "next/server";

const REAL_VIEW = "RealViewAgent";

/**
 * Maps common SQL errors to a clearer API response (dashboard/reports read RealViewAgent).
 */
export function jsonFromSqlError(
  fallbackError: string,
  error: unknown,
): NextResponse {
  const raw = error instanceof Error ? error.message : String(error);
  if (raw.includes("Invalid column name")) {
    return NextResponse.json(
      {
        error: "RealViewAgent column mismatch",
        details:
          `${raw} Set MSSQL_RVA_COL_* in .env.local to match your view (see src/lib/realview-columns.ts). ` +
          `Run: npm run rva:columns`,
      },
      { status: 500 },
    );
  }
  if (raw.includes("Invalid object name") && raw.includes(REAL_VIEW)) {
    const appDb = process.env.MSSQL_DATABASE || "SND";
    const analyticsDb =
      process.env.MSSQL_ANALYTICS_DATABASE?.trim() || appDb;
    return NextResponse.json(
      {
        error: "Analytics data unavailable",
        details:
          `"${REAL_VIEW}" was not found in the analytics database "${analyticsDb}" ` +
          `(set MSSQL_ANALYTICS_DATABASE if views differ from MSSQL_DATABASE / app DB "${appDb}").`,
      },
      { status: 503 },
    );
  }
  return NextResponse.json(
    { error: fallbackError, details: raw },
    { status: 500 },
  );
}
