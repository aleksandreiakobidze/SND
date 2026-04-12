import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { buildDashboardQueries } from "@/lib/queries";
import { buildWhereClause, injectWhere } from "@/lib/filters";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canViewDashboard } from "@/lib/auth-roles";
import { jsonFromSqlError } from "@/lib/sql-api-error";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canViewDashboard(auth.ctx.permissions)) return forbidden();

    const { searchParams } = new URL(req.url);
    const where = buildWhereClause(searchParams);
    const dq = buildDashboardQueries();

    const [
      kpisRaw,
      revenueByRegion,
      salesByCategory,
      litersByRegion,
      litersBySalesCategory,
      dailyTrend,
      recentTransactions,
    ] = await Promise.all([
      executeReadOnlyQuery(injectWhere(dq.kpis, where)),
      executeReadOnlyQuery(injectWhere(dq.revenueByRegion, where)),
      executeReadOnlyQuery(injectWhere(dq.salesByCategory, where)),
      executeReadOnlyQuery(injectWhere(dq.litersByRegion, where)),
      executeReadOnlyQuery(injectWhere(dq.litersBySalesCategory, where)),
      executeReadOnlyQuery(injectWhere(dq.dailyTrend, where)),
      executeReadOnlyQuery(injectWhere(dq.recentTransactions, where)),
    ]);

    const kpis = kpisRaw[0] || {
      totalRevenue: 0,
      totalOrders: 0,
      avgOrderValue: 0,
      activeCustomers: 0,
    };

    return NextResponse.json({
      kpis,
      revenueByRegion,
      salesByCategory,
      litersByRegion,
      litersBySalesCategory,
      dailyTrend,
      recentTransactions,
    });
  } catch (error) {
    console.error("Dashboard API error:", error);
    return jsonFromSqlError("Failed to load dashboard data", error);
  }
}
