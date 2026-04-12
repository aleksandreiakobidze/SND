import { NextResponse } from "next/server";
import { executeReadOnlyQuery } from "@/lib/db";
import { requireAuth, forbidden } from "@/lib/auth-route-helpers";
import { canViewDashboard } from "@/lib/auth-roles";
import { jsonFromSqlError } from "@/lib/sql-api-error";
import { rvaSql } from "@/lib/realview-columns";

export async function GET() {
  try {
    const auth = await requireAuth();
    if (!auth.ok) return auth.res;
    if (!canViewDashboard(auth.ctx.permissions)) return forbidden();

    const reg = rvaSql("REG");
    const prodS = rvaSql("PRODS");
    const realT = rvaSql("REALT");
    const manag = rvaSql("MANAG");
    const qseli = rvaSql("QSELI");
    const prodT = rvaSql("PRODT");
    const orgT = rvaSql("ORGT");
    const idProd = rvaSql("IDPROD");
    const prod = rvaSql("PROD");

    const [regions, categories, salesCategories, managers, networks, brands, customerCategories, products] =
      await Promise.all([
        executeReadOnlyQuery(
          `SELECT TOP 500 ${reg} as value FROM RealViewAgent GROUP BY ${reg} ORDER BY ${reg}`,
        ),
        executeReadOnlyQuery(
          `SELECT TOP 500 ${prodS} as value FROM RealViewAgent GROUP BY ${prodS} ORDER BY ${prodS}`,
        ),
        executeReadOnlyQuery(
          `SELECT TOP 500 ${realT} as value FROM RealViewAgent GROUP BY ${realT} ORDER BY ${realT}`,
        ),
        executeReadOnlyQuery(
          `SELECT TOP 500 ${manag} as value FROM RealViewAgent GROUP BY ${manag} ORDER BY ${manag}`,
        ),
        executeReadOnlyQuery(
          `SELECT TOP 500 ${qseli} as value FROM RealViewAgent GROUP BY ${qseli} ORDER BY ${qseli}`,
        ),
        executeReadOnlyQuery(
          `SELECT TOP 500 ${prodT} as value FROM RealViewAgent GROUP BY ${prodT} ORDER BY ${prodT}`,
        ),
        executeReadOnlyQuery(
          `SELECT TOP 500 ${orgT} as value FROM RealViewAgent GROUP BY ${orgT} ORDER BY ${orgT}`,
        ),
        executeReadOnlyQuery(
          `SELECT TOP 2000 ${idProd} as code, ${prod} as name FROM RealViewAgent GROUP BY ${idProd}, ${prod} ORDER BY ${prod}`,
        ),
      ]);

    const toOptions = (rows: Record<string, unknown>[]) =>
      rows
        .filter((r) => r.value != null && String(r.value).trim() !== "")
        .map((r) => ({ value: String(r.value), label: String(r.value) }));

    const productOptions = (products as Record<string, unknown>[])
      .filter((r) => r.code != null && String(r.code).trim() !== "")
      .map((r) => ({
        value: String(r.code),
        label: `${String(r.code)} — ${String(r.name || "")}`,
      }));

    return NextResponse.json({
      regions: toOptions(regions),
      categories: toOptions(categories),
      salesCategories: toOptions(salesCategories),
      managers: toOptions(managers),
      networks: toOptions(networks),
      brands: toOptions(brands),
      customerCategories: toOptions(customerCategories),
      products: productOptions,
    });
  } catch (error) {
    console.error("Filter options API error:", error);
    return jsonFromSqlError("Failed to load filter options", error);
  }
}
