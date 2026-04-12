import { rvaSql } from "@/lib/realview-columns";

export function buildDashboardQueries() {
  const id1 = rvaSql("IDREAL1");
  const idOrg = rvaSql("IDORG");
  const data = rvaSql("DATA");
  const tanxa = rvaSql("TANXA");
  const reg = rvaSql("REG");
  const prodS = rvaSql("PRODS");
  const prod = rvaSql("PROD");
  const tevadobaTotal = rvaSql("TEVADOBATOTAL");
  const fasi = rvaSql("FASI");
  const manag = rvaSql("MANAG");
  const gvari = rvaSql("GVARI");
  const orgT = rvaSql("ORGT");
  const prodT = rvaSql("PRODT");
  const idProd = rvaSql("IDPROD");
  const superCol = rvaSql("SUPER");
  const cd = rvaSql("CD");

  return {
    kpis: `
    SELECT 
      SUM(${tanxa}) as totalRevenue,
      COUNT(DISTINCT ${id1}) as totalOrders,
      CASE WHEN COUNT(DISTINCT ${id1}) > 0 
        THEN SUM(${tanxa}) / COUNT(DISTINCT ${id1}) 
        ELSE 0 END as avgOrderValue,
      COUNT(DISTINCT ${idOrg}) as activeCustomers
    FROM RealViewAgent
  `,

    revenueByRegion: `
    SELECT 
      ${reg} as name,
      CAST(SUM(${tanxa}) as float) as value
    FROM RealViewAgent
    GROUP BY ${reg}
    ORDER BY value DESC
  `,

    salesByCategory: `
    SELECT 
      ${prodS} as name,
      CAST(SUM(${tanxa}) as float) as value
    FROM RealViewAgent
    GROUP BY ${prodS}
    ORDER BY value DESC
  `,

    litersByRegion: `
    SELECT 
      ${reg} as name,
      CAST(SUM(${tevadobaTotal}) as float) as value
    FROM RealViewAgent
    GROUP BY ${reg}
    ORDER BY value DESC
  `,

    litersBySalesCategory: `
    SELECT 
      ${prodS} as name,
      CAST(SUM(${tevadobaTotal}) as float) as value
    FROM RealViewAgent
    GROUP BY ${prodS}
    ORDER BY value DESC
  `,

    dailyTrend: `
    SELECT 
      CONVERT(varchar, ${data}, 23) as name,
      CAST(SUM(${tanxa}) as float) as Revenue,
      COUNT(DISTINCT ${id1}) as Orders,
      CAST(SUM(${tevadobaTotal}) as float) as Liters
    FROM RealViewAgent
    GROUP BY ${data}
    ORDER BY ${data}
  `,

    /** Line-level rows for selected filters (date range + cross-filters); preseller = Gvari per schema */
    recentTransactions: `
    SELECT TOP 200
      CONVERT(varchar, ${data}, 23) as Day,
      ${reg} as Region,
      ${prodS} as Category,
      ${prodT} as Brand,
      ${orgT} as OrgType,
      ${idProd} as IdProd,
      ${prod} as Product,
      CAST(${tevadobaTotal} as float) as Liters,
      CAST(${fasi} as float) as Price,
      CAST(${tanxa} as float) as Amount,
      ${gvari} as Preseller,
      ${manag} as Manager,
      ${superCol} as Supervisor
    FROM RealViewAgent
    ORDER BY ${cd} DESC
  `,
  };
}

export function buildReportQueries() {
  const id1 = rvaSql("IDREAL1");
  const idOrg = rvaSql("IDORG");
  const data = rvaSql("DATA");
  const tanxa = rvaSql("TANXA");
  const reg = rvaSql("REG");
  const prodS = rvaSql("PRODS");
  const realT = rvaSql("REALT");
  const org = rvaSql("ORG");
  const prod = rvaSql("PROD");
  const raod = rvaSql("RAOD");
  const fasi = rvaSql("FASI");
  const manag = rvaSql("MANAG");
  const city = rvaSql("CITY");
  const gvari = rvaSql("GVARI");
  const qseli = rvaSql("QSELI");
  const orgT = rvaSql("ORGT");
  const prodT = rvaSql("PRODT");
  const lon = rvaSql("LON");
  const lat = rvaSql("LAT");
  const tevadobaTotal = rvaSql("TEVADOBATOTAL");

  return {
    salesByRegionDetailed: `
    SELECT 
      ${reg} as Region,
      ${city},
      CAST(SUM(${tanxa}) as float) as Revenue,
      SUM(${raod}) as Quantity,
      CAST(SUM(${tevadobaTotal}) as float) as Liters,
      COUNT(DISTINCT ${id1}) as Orders,
      COUNT(DISTINCT ${idOrg}) as Customers
    FROM RealViewAgent
    GROUP BY ${reg}, ${city}
    ORDER BY Revenue DESC
  `,

    productPerformance: `
    SELECT 
      ${prodS} as Category,
      ${prodT} as Brand,
      CAST(SUM(${tanxa}) as float) as Revenue,
      SUM(${raod}) as Quantity,
      CAST(SUM(${tevadobaTotal}) as float) as Liters,
      COUNT(DISTINCT ${idOrg}) as Customers,
      CAST(AVG(${fasi}) as float) as AvgPrice
    FROM RealViewAgent
    GROUP BY ${prodS}, ${prodT}
    ORDER BY Revenue DESC
  `,

    managerPerformance: `
    SELECT 
      ${manag} as Manager,
      CAST(SUM(${tanxa}) as float) as Revenue,
      CAST(SUM(${tevadobaTotal}) as float) as Liters,
      COUNT(DISTINCT ${idOrg}) as Customers,
      COUNT(DISTINCT ${id1}) as Orders,
      CAST(SUM(${tanxa}) / NULLIF(COUNT(DISTINCT ${id1}), 0) as float) as AvgOrderValue
    FROM RealViewAgent
    GROUP BY ${manag}
    ORDER BY Revenue DESC
  `,

    driverPerformance: `
    SELECT TOP 30
      ${gvari} as Deliverer,
      CAST(SUM(${tanxa}) as float) as Revenue,
      CAST(SUM(${tevadobaTotal}) as float) as Liters,
      COUNT(DISTINCT ${idOrg}) as Customers,
      COUNT(DISTINCT ${id1}) as Deliveries,
      CAST(SUM(${tanxa}) / NULLIF(COUNT(DISTINCT ${id1}), 0) as float) as AvgDeliveryValue
    FROM RealViewAgent
    GROUP BY ${gvari}
    ORDER BY Revenue DESC
  `,

    salesmanPerformance: `
    SELECT TOP 30
      ${gvari} as Salesman,
      CAST(SUM(${tanxa}) as float) as Revenue,
      CAST(SUM(${tevadobaTotal}) as float) as Liters,
      COUNT(DISTINCT ${idOrg}) as Customers,
      COUNT(DISTINCT ${id1}) as Orders,
      CAST(SUM(${tanxa}) / NULLIF(COUNT(DISTINCT ${id1}), 0) as float) as AvgOrderValue
    FROM RealViewAgent
    GROUP BY ${gvari}
    ORDER BY Revenue DESC
  `,

    topCustomers: `
    SELECT TOP 30
      ${org} as Customer,
      ${reg} as Region,
      ${city},
      ${qseli} as Network,
      CAST(SUM(${tanxa}) as float) as Revenue,
      SUM(${raod}) as Quantity,
      CAST(SUM(${tevadobaTotal}) as float) as Liters,
      COUNT(DISTINCT ${id1}) as Orders
    FROM RealViewAgent
    GROUP BY ${org}, ${reg}, ${city}, ${qseli}
    ORDER BY Revenue DESC
  `,

    customerCategoryBreakdown: `
    SELECT 
      ${orgT} as CustomerCategory,
      CAST(SUM(${tanxa}) as float) as Revenue,
      COUNT(DISTINCT ${idOrg}) as Customers,
      COUNT(DISTINCT ${id1}) as Orders,
      SUM(${raod}) as Quantity,
      CAST(SUM(${tevadobaTotal}) as float) as Liters
    FROM RealViewAgent
    GROUP BY ${orgT}
    ORDER BY Revenue DESC
  `,

    /** Customers with GPS (Lon/Lat); OrgT = object / customer segment for map colors */
    customerLocations: `
    SELECT TOP 500
      ${org} as Customer,
      ${reg} as Region,
      ${city} as City,
      ${orgT} as OrgT,
      CAST(AVG(CAST(${lon} as float)) as float) as Lon,
      CAST(AVG(CAST(${lat} as float)) as float) as Lat,
      CAST(SUM(${tanxa}) as float) as Revenue,
      COUNT(DISTINCT ${id1}) as Orders,
      CAST(SUM(${tevadobaTotal}) as float) as Liters
    FROM RealViewAgent
    WHERE ${lon} IS NOT NULL AND ${lat} IS NOT NULL
    GROUP BY ${org}, ${reg}, ${city}, ${orgT}
    ORDER BY Revenue DESC
  `,
  };
}

/** Stable list for /api/reports?name=… validation */
export const REPORT_QUERY_KEYS = [
  "salesByRegionDetailed",
  "productPerformance",
  "managerPerformance",
  "driverPerformance",
  "salesmanPerformance",
  "topCustomers",
  "customerCategoryBreakdown",
  "customerLocations",
] as const;

export type ReportQueryKey = (typeof REPORT_QUERY_KEYS)[number];
