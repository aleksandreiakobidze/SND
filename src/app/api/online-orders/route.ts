import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { buildOnlineWhereClause, type OnlineColumnMap } from "@/lib/online-columns";
import { buildOnlineOrdersAggregateQuery, getOnlineViewSqlName } from "@/lib/online-orders-sql";
import { resolveOnlineColumnMap } from "@/lib/online-schema-resolve";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAccessOnlineOrders } from "@/lib/auth-roles";

function sqlErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** SQL Server 208 = object not found; message usually contains "Invalid object name". */
function isMissingDbObject(error: unknown): boolean {
  const msg = sqlErrorText(error).toLowerCase();
  if (msg.includes("invalid object name")) return true;
  let cur: unknown = error;
  for (let i = 0; i < 5 && cur; i++) {
    const n = (cur as { number?: number })?.number;
    if (n === 208) return true;
    cur =
      (cur as { originalError?: unknown })?.originalError ??
      (cur as { cause?: unknown })?.cause;
  }
  return false;
}

function includeSqlInErrorResponse(): boolean {
  return (
    process.env.NODE_ENV === "development" || process.env.MSSQL_ONLINE_DEBUG_SQL === "1"
  );
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.res;
  if (!canAccessOnlineOrders(auth.ctx.permissions)) return forbidden();

  const { searchParams } = new URL(req.url);
  let builtSql: string | undefined;
  let cols: OnlineColumnMap | undefined;

  try {
    cols = await resolveOnlineColumnMap();
    const where = buildOnlineWhereClause(searchParams, cols);
    builtSql = buildOnlineOrdersAggregateQuery(where, cols);
    const data = await executeReadOnlyQuery(builtSql, 5000);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Online orders API error:", error);

    if (isMissingDbObject(error)) {
      const view = getOnlineViewSqlName();
      return NextResponse.json({
        data: [] as Record<string, unknown>[],
        warning: `Database object "${view}" was not found. Create the view/table in SQL Server, or set MSSQL_ONLINE_VIEW in .env.local to the correct staging object name.`,
        ...(includeSqlInErrorResponse() && builtSql ? { sql: builtSql } : {}),
      });
    }

    let details = sqlErrorText(error);
    const low = details.toLowerCase();
    if (low.includes("invalid column name") || low.includes("207")) {
      details += ` If your view uses different names than RealViewAgent, set MSSQL_ONLINE_COL_* in .env.local (see src/lib/online-columns.ts).`;
    }
    if (low.includes("forbidden sql operation")) {
      details +=
        " A filter value may contain a reserved word (e.g. CREATE) that trips the read-only guard; try different filters or adjust db.ts validateReadOnly.";
    }
    return NextResponse.json(
      {
        error: "Failed to load online orders",
        details,
        ...(includeSqlInErrorResponse() && builtSql ? { sql: builtSql } : {}),
        ...(includeSqlInErrorResponse() && cols ? { resolvedColumns: cols } : {}),
      },
      { status: 500 }
    );
  }
}
