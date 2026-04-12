import { injectWhere } from "@/lib/filters";
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
