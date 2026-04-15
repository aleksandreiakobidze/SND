import { NextRequest, NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canAssignSalesDriver } from "@/lib/auth-roles";
import { buildOrderDetailQuery } from "@/lib/sales-map-sql";
import type { OrderDetail, OrderLineItem } from "@/lib/distribution/distribution-types";

const MAX_IDS = 200;

/**
 * GET /api/sales-map/order-details?ids=1,2,3
 * Returns full order detail with product lines for the given IdReal1 list.
 * Permission: canAssignSalesDriver
 */
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canAssignSalesDriver(auth.ctx.permissions)) return forbidden();

    const raw = req.nextUrl.searchParams.get("ids") ?? "";
    const idReal1List = raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0)
      .slice(0, MAX_IDS);

    if (idReal1List.length === 0) {
      return NextResponse.json({ details: [] });
    }

    const sql = buildOrderDetailQuery(idReal1List);
    const rows = await executeReadOnlyQuery(sql);

    // Group rows by IdReal1 → build OrderDetail objects
    const orderMap = new Map<number, OrderDetail>();

    for (const r of rows) {
      const id = Number(r.IdReal1);
      if (!orderMap.has(id)) {
        orderMap.set(id, {
          idReal1: id,
          orgCode: String(r.OrgCode ?? ""),
          org: String(r.Org ?? ""),
          city: String(r.City ?? ""),
          address: String(r.Address ?? ""),
          amount: 0,
          liters: 0,
          kg: 0,
          lines: [],
        });
      }

      const detail = orderMap.get(id)!;
      const line: OrderLineItem = {
        idReal2: Number(r.IdReal2),
        prodCode: String(r.ProdCode ?? ""),
        prod: String(r.Prod ?? ""),
        qty: Number(r.Qty) || 0,
        price: Number(r.Price) || 0,
        lineAmount: Number(r.LineAmount) || 0,
        liters: Number(r.Liters) || 0,
        kg: Number(r.Kg) || 0,
      };

      detail.lines.push(line);
      detail.amount += line.lineAmount;
      detail.liters += line.liters;
      detail.kg += line.kg;
    }

    const details: OrderDetail[] = idReal1List
      .map((id) => orderMap.get(id))
      .filter((d): d is OrderDetail => d !== undefined);

    return NextResponse.json({ details });
  } catch (error) {
    console.error("Order details API error:", error);
    return NextResponse.json(
      { error: "Failed to load order details", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
