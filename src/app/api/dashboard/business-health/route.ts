import { NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canViewDashboard } from "@/lib/auth-roles";
import { VIEW_NAME } from "@/lib/schema";
import { PURCHASE_VIEW_NAME } from "@/lib/agents/purchase/purchase-schema";
import { INVENTORY_VIEW_NAME } from "@/lib/agents/inventory/inventory-schema";

/**
 * GET /api/dashboard/business-health
 * Unified business health endpoint combining sales, pricing, purchase, and inventory KPIs.
 * Each section gracefully degrades if the underlying view doesn't exist yet.
 */
export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canViewDashboard(auth.ctx.permissions)) return forbidden();

    const todayFilter = `CAST(Data AS date) = CAST(GETDATE() AS date)`;
    const monthFilter = `Tve = MONTH(GETDATE()) AND Celi = YEAR(GETDATE())`;

    const salesKpis = safeQuery(`
      SELECT
        SUM(Tanxa) AS Revenue,
        SUM(TevadobaTotal) AS Liters,
        COUNT(DISTINCT IdReal1) AS Orders,
        COUNT(DISTINCT IdOrg) AS Customers
      FROM ${VIEW_NAME}
      WHERE ${todayFilter}
    `);

    const pricingKpis = safeQuery(`
      SELECT
        AVG(Fasi) AS AvgPrice,
        AVG(Discount) AS AvgDiscount,
        SUM(TanxaDiler) AS DealerTotal,
        CASE WHEN SUM(Tanxa) > 0
          THEN ROUND(SUM(Aqcizi) * 100.0 / SUM(Tanxa), 2)
          ELSE 0
        END AS ExcisePct
      FROM ${VIEW_NAME}
      WHERE ${monthFilter}
    `);

    const purchaseKpis = safeQuery(`
      SELECT
        SUM(Tanxa) AS PurchaseCost,
        COUNT(DISTINCT IdPurchase1) AS PurchaseOrders,
        SUM(TevadobaTotal) AS PurchaseLiters
      FROM ${PURCHASE_VIEW_NAME}
      WHERE ${monthFilter}
    `);

    const inventoryKpis = safeQuery(`
      SELECT
        SUM(StockValue) AS TotalStockValue,
        SUM(StockQty) AS TotalStockQty,
        SUM(CASE WHEN StockQty < SafetyStockQty AND SafetyStockQty > 0 THEN 1 ELSE 0 END) AS BelowSafetyCount
      FROM ${INVENTORY_VIEW_NAME}
      WHERE MovementType IS NULL
    `);

    const [sales, pricing, purchase, inventory] = await Promise.all([
      salesKpis,
      pricingKpis,
      purchaseKpis,
      inventoryKpis,
    ]);

    return NextResponse.json({
      sales: sales.data?.[0] ?? null,
      salesAvailable: sales.ok,
      pricing: pricing.data?.[0] ?? null,
      pricingAvailable: pricing.ok,
      purchase: purchase.data?.[0] ?? null,
      purchaseAvailable: purchase.ok,
      inventory: inventory.data?.[0] ?? null,
      inventoryAvailable: inventory.ok,
    });
  } catch (error) {
    console.error("Business health API error:", error);
    return NextResponse.json(
      { error: "Failed to load business health data" },
      { status: 500 },
    );
  }
}

async function safeQuery(
  sql: string,
): Promise<{ ok: boolean; data: Record<string, unknown>[] | null }> {
  try {
    const data = await executeReadOnlyQuery(sql);
    return { ok: true, data };
  } catch {
    return { ok: false, data: null };
  }
}
