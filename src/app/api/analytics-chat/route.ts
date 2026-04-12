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

function filterDateSummary(filters: FilterParams | undefined): string {
  if (!filters) return "Date filter: (not provided — snapshot may be unscoped).";
  const from = filters.dateFrom?.trim();
  const to = filters.dateTo?.trim();
  if (from && to && from === to) return `Date filter: single day ${from} (e.g. “Yesterday” preset).`;
  if (from || to) return `Date filter: from ${from ?? "…"} to ${to ?? "…"}.`;
  return "Date filter: all time (no from/to in request).";
}

/** True if the user narrowed data (any date range and/or cross-filters). */
function hasNarrowFilters(filters: FilterParams | undefined): boolean {
  if (!filters) return false;
  const hasDate = Boolean(filters.dateFrom?.trim() || filters.dateTo?.trim());
  const hasCross =
    (filters.region?.length ?? 0) > 0 ||
    (filters.category?.length ?? 0) > 0 ||
    (filters.manager?.length ?? 0) > 0 ||
    (filters.network?.length ?? 0) > 0 ||
    (filters.brand?.length ?? 0) > 0 ||
    (filters.salesCategory?.length ?? 0) > 0 ||
    (filters.customerCategory?.length ?? 0) > 0 ||
    (filters.product?.length ?? 0) > 0;
  return hasDate || hasCross;
}

function activeFiltersSummary(filters: FilterParams | undefined): string {
  if (!filters) return "none";
  const bits: string[] = [];
  if (filters.dateFrom?.trim() || filters.dateTo?.trim()) {
    bits.push(
      `dates ${filters.dateFrom?.trim() ?? "…"}–${filters.dateTo?.trim() ?? "…"}`,
    );
  }
  const push = (label: string, arr?: string[]) => {
    if (arr && arr.length > 0) bits.push(`${label}: ${arr.join(", ")}`);
  };
  push("regions", filters.region);
  push("categories (ProdS)", filters.category);
  push("managers", filters.manager);
  push("networks", filters.network);
  push("brands", filters.brand);
  push("sales categories (RealT)", filters.salesCategory);
  push("customer categories (OrgT)", filters.customerCategory);
  push("products (IdProd)", filters.product);
  return bits.length > 0 ? bits.join(" | ") : "dates/categories: full defaults only";
}

function scopeBlock(filters: FilterParams | undefined): string {
  if (hasNarrowFilters(filters)) {
    return [
      "SCOPE: FILTERED — The user applied filters (see **Active filter summary** below).",
      "You MUST analyze and answer ONLY for this slice of data. Do not speak as if describing the entire company, all time, or unrelated regions/categories unless the user explicitly asks to compare outside this scope.",
      "If the snapshot is empty or KPIs are zero, say there is no activity in this filter — do not invent global figures.",
      `Active filter summary: ${activeFiltersSummary(filters)}`,
    ].join("\n");
  }
  return [
    "SCOPE: BROAD — No narrow filters (or only full-range defaults). Numbers below are for the widest slice the app computed (see date line). You may give full-scope analysis.",
    `Filter summary: ${activeFiltersSummary(filters)}`,
  ].join("\n");
}

async function buildDataContext(filters: FilterParams | undefined): Promise<string | null> {
  const params = filters ? filtersToSearchParams(filters) : new URLSearchParams();
  const where = buildWhereClause(params);
  const filterAnd = buildNonDateFilterAndClause(params, "t");
  const dq = buildDashboardQueries();

  const [
    kpisRaw,
    revenueByRegion,
    salesByCategory,
    topByRevenue,
    topByLiters,
  ] = await Promise.all([
    executeReadOnlyQuery(injectWhere(dq.kpis, where)),
    executeReadOnlyQuery(injectWhere(dq.revenueByRegion, where)),
    executeReadOnlyQuery(injectWhere(dq.salesByCategory, where)),
    executeReadOnlyQuery(injectWhere(dq.topProductsByRevenueInPeriod, where)),
    executeReadOnlyQuery(injectWhere(dq.topProductsByLitersInPeriod, where)),
  ]);

  let productMoM: Record<string, unknown>[] = [];
  try {
    productMoM = await executeReadOnlyQuery(buildProductMonthOverMonthSql(filterAnd));
  } catch (e) {
    console.warn("Analytics coach product MoM query failed:", e);
  }

  const kpis = (kpisRaw[0] || {}) as Record<string, unknown>;
  const dateLine = filterDateSummary(filters);
  const momExplain =
    "SEPARATE — Product month-over-month (calendar months only; IGNORES the date pickers above): use ONLY for questions explicitly about “last month vs previous month” or MoM trends. Do NOT use this block for “yesterday”, “selected period”, or “best seller in the filter” — use **Filtered period — top products** instead.";

  const lines = [
    scopeBlock(filters),
    dateLine,
    `KPIs (same filter scope): totalRevenue=${kpis.totalRevenue ?? "n/a"}, totalOrders=${kpis.totalOrders ?? "n/a"}, avgOrderValue=${kpis.avgOrderValue ?? "n/a"}, activeCustomers=${kpis.activeCustomers ?? "n/a"}`,
    `Filtered period — top products by revenue (Tanxa); index 0 = #1 seller by money: ${JSON.stringify(topByRevenue.slice(0, 15))}`,
    `Filtered period — top products by liters (TevadobaTotal); index 0 = #1 by volume: ${JSON.stringify(topByLiters.slice(0, 15))}`,
    `Revenue by region (top 8): ${JSON.stringify(revenueByRegion.slice(0, 8))}`,
    `Revenue by product category (top 8): ${JSON.stringify(salesByCategory.slice(0, 8))}`,
    momExplain,
    `Products MoM (last complete month vs prior month): ${JSON.stringify(productMoM)}`,
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
