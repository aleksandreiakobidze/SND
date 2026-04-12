import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { buildWhereClause } from "@/lib/filters";
import { buildSalesMapLinesQuery } from "@/lib/sales-map-sql";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canViewDashboard } from "@/lib/auth-roles";
import { jsonFromSqlError } from "@/lib/sql-api-error";

const MAX_LINES = 20000;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canViewDashboard(auth.ctx.permissions)) return forbidden();

    const { searchParams } = new URL(req.url);
    const where = buildWhereClause(searchParams);
    const sqlText = buildSalesMapLinesQuery(where);
    const data = await executeReadOnlyQuery(sqlText, MAX_LINES);
    return NextResponse.json({ data });
  } catch (error) {
    console.error("Sales map lines API error:", error);
    return jsonFromSqlError("Failed to load sales map lines", error);
  }
}
