import { rvaSql } from "@/lib/realview-columns";

/**
 * Revenue by product for **last complete calendar month (M-1)** vs **month before (M-2)**.
 * Date filters from the UI are ignored here (fixed windows); region/category/etc. filters apply via `filterAndClause`.
 */
export function buildProductMonthOverMonthSql(filterAndClause: string): string {
  const data = rvaSql("DATA");
  const tanxa = rvaSql("TANXA");
  const prod = rvaSql("PROD");
  const idProd = rvaSql("IDPROD");

  return `
WITH b AS (
  SELECT
    DATEFROMPARTS(YEAR(DATEADD(month, -1, GETDATE())), MONTH(DATEADD(month, -1, GETDATE())), 1) AS m1_start,
    DATEFROMPARTS(YEAR(GETDATE()), MONTH(GETDATE()), 1) AS after_m1,
    DATEFROMPARTS(YEAR(DATEADD(month, -2, GETDATE())), MONTH(DATEADD(month, -2, GETDATE())), 1) AS m2_start
)
SELECT TOP 40
  ${idProd} AS IdProd,
  ${prod} AS Product,
  CAST(SUM(CASE WHEN t.${data} >= b.m1_start AND t.${data} < b.after_m1 THEN ${tanxa} ELSE 0 END) AS float) AS RevPrevMonth,
  CAST(SUM(CASE WHEN t.${data} >= b.m2_start AND t.${data} < b.m1_start THEN ${tanxa} ELSE 0 END) AS float) AS RevMonthBeforePrev,
  CAST(
    SUM(CASE WHEN t.${data} >= b.m1_start AND t.${data} < b.after_m1 THEN ${tanxa} ELSE 0 END)
    - SUM(CASE WHEN t.${data} >= b.m2_start AND t.${data} < b.m1_start THEN ${tanxa} ELSE 0 END)
  AS float) AS DeltaMoM
FROM RealViewAgent t
CROSS JOIN b
WHERE t.${data} >= b.m2_start AND t.${data} < b.after_m1
${filterAndClause}
GROUP BY ${idProd}, ${prod}
HAVING
  ABS(SUM(CASE WHEN t.${data} >= b.m1_start AND t.${data} < b.after_m1 THEN ${tanxa} ELSE 0 END)) > 0.01
  OR ABS(SUM(CASE WHEN t.${data} >= b.m2_start AND t.${data} < b.m1_start THEN ${tanxa} ELSE 0 END)) > 0.01
ORDER BY DeltaMoM ASC
`.trim();
}
