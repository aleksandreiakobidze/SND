import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { buildDashboardQueries } from "@/lib/queries";
import {
  buildWhereClause,
  buildNonDateFilterAndClause,
  injectWhere,
  filtersToSearchParams,
  type FilterParams,
} from "@/lib/filters";
import { buildProductMonthOverMonthSql } from "@/lib/analytics-product-mom";
import { generateAnalyticsCoachReply } from "@/lib/analytics-coach-openai";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canViewDashboard } from "@/lib/auth-roles";

async function buildDataContext(filters: FilterParams | undefined): Promise<string | null> {
  const params = filters ? filtersToSearchParams(filters) : new URLSearchParams();
  const where = buildWhereClause(params);
  const filterAnd = buildNonDateFilterAndClause(params, "t");
  const dq = buildDashboardQueries();

  const [kpisRaw, revenueByRegion, salesByCategory] = await Promise.all([
    executeReadOnlyQuery(injectWhere(dq.kpis, where)),
    executeReadOnlyQuery(injectWhere(dq.revenueByRegion, where)),
    executeReadOnlyQuery(injectWhere(dq.salesByCategory, where)),
  ]);

  let productMoM: Record<string, unknown>[] = [];
  try {
    productMoM = await executeReadOnlyQuery(buildProductMonthOverMonthSql(filterAnd));
  } catch (e) {
    console.warn("Analytics coach product MoM query failed:", e);
  }

  const kpis = (kpisRaw[0] || {}) as Record<string, unknown>;
  const momExplain =
    "Product month-over-month (fixed windows; ignores UI date range): RevPrevMonth = last COMPLETE calendar month; RevMonthBeforePrev = the month before that; DeltaMoM = RevPrevMonth - RevMonthBeforePrev (negative = sales dropped vs prior month). Rows ordered by worst drops first (top 40).";

  const lines = [
    `KPIs: totalRevenue=${kpis.totalRevenue ?? "n/a"}, totalOrders=${kpis.totalOrders ?? "n/a"}, avgOrderValue=${kpis.avgOrderValue ?? "n/a"}, activeCustomers=${kpis.activeCustomers ?? "n/a"}`,
    `Revenue by region (top 8): ${JSON.stringify(revenueByRegion.slice(0, 8))}`,
    `Revenue by product category (top 8): ${JSON.stringify(salesByCategory.slice(0, 8))}`,
    `${momExplain}`,
    `Products MoM (last month vs month before): ${JSON.stringify(productMoM)}`,
  ];
  return lines.join("\n");
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canViewDashboard(auth.ctx.permissions)) return forbidden();

    const body = await req.json();
    const message = body.message;
    const history = Array.isArray(body.history) ? body.history : [];
    const locale = body.locale === "ka" ? "ka" : "en";
    const filters =
      body.filters != null && typeof body.filters === "object"
        ? (body.filters as FilterParams)
        : undefined;

    if (!message || typeof message !== "string" || !message.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 });
    }

    let dataContext: string | null = null;
    try {
      dataContext = await buildDataContext(filters);
    } catch (e) {
      console.warn("Analytics coach snapshot failed:", e);
      dataContext = null;
    }

    const normalizedHistory = history
      .filter(
        (h: unknown) =>
          h &&
          typeof h === "object" &&
          (h as { role?: string }).role &&
          typeof (h as { content?: unknown }).content === "string",
      )
      .map((h: unknown) => ({
        role: (h as { role: string }).role === "assistant" ? "assistant" as const : "user" as const,
        content: (h as { content: string }).content,
      }));

    const result = await generateAnalyticsCoachReply(
      message.trim(),
      normalizedHistory,
      locale,
      dataContext,
    );

    return NextResponse.json({
      reply: result.reply,
      suggestions: result.suggestions,
    });
  } catch (error) {
    console.error("Analytics chat API error:", error);
    return NextResponse.json(
      {
        error: "Failed to get advice",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
