import { injectWhere, sqlDataBeforeNextDay } from "@/lib/filters";
import { rvaSql } from "@/lib/realview-columns";
import { VIEW_NAME } from "@/lib/schema";

/**
 * Sales map: one row per order header (IdReal1) from RealViewAgent, only lines with Lon/Lat.
 */
export function buildSalesMapPointsQuery(whereClause: string): string {
  const id1 = rvaSql("IDREAL1");
  const data = rvaSql("DATA");
  const org = rvaSql("ORG");
  const orgT = rvaSql("ORGT");
  const reg = rvaSql("REG");
  const tanxa = rvaSql("TANXA");
  const tev = rvaSql("TEVADOBATOTAL");
  const bruto = rvaSql("BRUTOTOTAL");
  const lon = rvaSql("LON");
  const lat = rvaSql("LAT");
  const idmdz = rvaSql("IDMDZ");
  const mdz = rvaSql("MDZ");
  const micodeba = rvaSql("MICODEBA");

  const base = `
    SELECT
      ${id1} AS IdReal1,
      MIN(${data}) AS Data,
      MAX(${org}) AS Org,
      MAX(${orgT}) AS OrgT,
      MAX(${reg}) AS Reg,
      CAST(AVG(CAST(${lat} AS float)) AS float) AS Lat,
      CAST(AVG(CAST(${lon} AS float)) AS float) AS Lon,
      CAST(SUM(${tanxa}) AS float) AS OrderTotal,
      CAST(SUM(${tev}) AS float) AS OrderLiters,
      CAST(SUM(${bruto}) AS float) AS BrutoTotal,
      COUNT(*) AS LineCount,
      MAX(${idmdz}) AS IdMdz,
      MAX(${mdz}) AS Mdz,
      MAX(${micodeba}) AS Micodeba
    FROM ${VIEW_NAME}
    WHERE ${lon} IS NOT NULL AND ${lat} IS NOT NULL
    GROUP BY ${id1}
    ORDER BY MIN(${data}) DESC
  `;
  return injectWhere(base, whereClause);
}

/**
 * Unassigned orders with coordinates — for auto-distribution.
 * Micodeba = 1 means "not assigned" in ERP convention; also catches NULL IdMdz.
 *
 * @param nonDateWhere  Additional WHERE conditions (region, manager, etc.) but NOT date.
 * @param deliveryDate  Exact delivery date (YYYY-MM-DD). Filters Data column to that single day.
 *                      If omitted, no date filter is applied.
 */
export function buildUnassignedOrdersQuery(
  nonDateWhere: string,
  deliveryDate?: string,
): string {
  const id1 = rvaSql("IDREAL1");
  const data = rvaSql("DATA");
  const org = rvaSql("ORG");
  const reg = rvaSql("REG");
  const idorg = rvaSql("IDORG");
  const city = rvaSql("CITY");
  const tanxa = rvaSql("TANXA");
  const tev = rvaSql("TEVADOBATOTAL");
  const bruto = rvaSql("BRUTOTOTAL");
  const lon = rvaSql("LON");
  const lat = rvaSql("LAT");
  const idmdz = rvaSql("IDMDZ");
  const micodeba = rvaSql("MICODEBA");

  const dateParts: string[] = [];
  if (deliveryDate) {
    const safe = deliveryDate.replace(/'/g, "").slice(0, 10);
    dateParts.push(`${data} >= '${safe}'`);
    dateParts.push(sqlDataBeforeNextDay(data, safe));
  }

  const dateClauses = dateParts.length > 0 ? dateParts.join(" AND ") + " AND " : "";

  const base = `
    SELECT
      ${id1} AS IdReal1,
      MAX(${org}) AS Org,
      MAX(${reg}) AS Reg,
      MAX(${idorg}) AS OrgCode,
      MAX(${city}) AS City,
      CAST(AVG(CAST(${lat} AS float)) AS float) AS Lat,
      CAST(AVG(CAST(${lon} AS float)) AS float) AS Lon,
      CAST(SUM(${tanxa}) AS float) AS OrderTotal,
      CAST(SUM(${tev}) AS float) AS OrderLiters,
      CAST(SUM(${bruto}) AS float) AS BrutoTotal,
      COUNT(*) AS LineCount
    FROM ${VIEW_NAME}
    WHERE ${dateClauses}${lon} IS NOT NULL AND ${lat} IS NOT NULL
      AND (${micodeba} = 1 OR ${micodeba} IS NULL OR ${idmdz} IS NULL OR ${idmdz} = 0)
    GROUP BY ${id1}
    ORDER BY MIN(${data}) DESC
  `;
  return injectWhere(base, nonDateWhere);
}

/**
 * Full order detail with product lines for a list of IdReal1 values.
 * Returns every row (one per line item). Group header fields are repeated per line.
 * The caller builds the header + lines structure in application code.
 *
 * Safe: idReal1List is validated to positive integers before calling.
 */
export function buildOrderDetailQuery(idReal1List: number[]): string {
  if (idReal1List.length === 0) return "";
  const ids = idReal1List.map((n) => String(Math.floor(n))).join(",");

  const id1 = rvaSql("IDREAL1");
  const id2 = rvaSql("IDREAL2");
  const data = rvaSql("DATA");
  const org = rvaSql("ORG");
  const idorg = rvaSql("IDORG");
  const city = rvaSql("CITY");
  const cd = rvaSql("CD");
  const prod = rvaSql("PROD");
  const prodCode = rvaSql("PRODCODE");
  const raod = rvaSql("RAOD");
  const fasi = rvaSql("FASI");
  const tanxa = rvaSql("TANXA");
  const tev = rvaSql("TEVADOBATOTAL");
  const bruto = rvaSql("BRUTOTOTAL");

  return `
    SELECT
      ${id1}   AS IdReal1,
      ${id2}   AS IdReal2,
      ${idorg} AS OrgCode,
      ${org}   AS Org,
      ${city}  AS City,
      ${cd}    AS Address,
      ${prodCode} AS ProdCode,
      ${prod}  AS Prod,
      CAST(${raod}  AS float) AS Qty,
      CAST(${fasi}  AS float) AS Price,
      CAST(${tanxa} AS float) AS LineAmount,
      CAST(${tev}   AS float) AS Liters,
      CAST(${bruto} AS float) AS Kg
    FROM ${VIEW_NAME}
    WHERE ${id1} IN (${ids})
    ORDER BY ${id1}, ${data}, ${id2}
  `;
}

/**
 * Sales map table: one row per RealViewAgent line (product) for rows that have Lon/Lat.
 * Used for the product lines report (driver, IdProd, Prod, Raod).
 */
export function buildSalesMapLinesQuery(whereClause: string): string {
  const id1 = rvaSql("IDREAL1");
  const id2 = rvaSql("IDREAL2");
  const data = rvaSql("DATA");
  const lon = rvaSql("LON");
  const lat = rvaSql("LAT");
  const idmdz = rvaSql("IDMDZ");
  const mdz = rvaSql("MDZ");
  const micodeba = rvaSql("MICODEBA");
  const idprod = rvaSql("IDPROD");
  const prod = rvaSql("PROD");
  const raod = rvaSql("RAOD");

  const base = `
    SELECT
      ${id1} AS IdReal1,
      ${id2} AS IdReal2,
      ${idmdz} AS IdMdz,
      ${mdz} AS Mdz,
      ${micodeba} AS Micodeba,
      ${idprod} AS IdProd,
      ${prod} AS Prod,
      CAST(${raod} AS float) AS Raod
    FROM ${VIEW_NAME}
    WHERE ${lon} IS NOT NULL AND ${lat} IS NOT NULL
    ORDER BY ${data} DESC, ${id1}, ${id2}
  `;
  return injectWhere(base, whereClause);
}
