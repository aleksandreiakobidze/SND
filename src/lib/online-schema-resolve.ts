import sql from "mssql";
import { getAnalyticsPool } from "@/lib/db";
import { getOnlineViewSqlName } from "@/lib/online-orders-sql";
import type { OnlineColumnMap } from "@/lib/online-columns";

const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/** Candidate physical names per logical field (order = preference). RealViewAgent names first, then common alternates. */
const CANDIDATES: Record<keyof OnlineColumnMap, string[]> = {
  idReal1: [
    "IdReal1",
    "IdOnlineReal1",
    "Id_Real1",
    "Real1Id",
    "IdOnline1",
    "OnlineReal1Id",
    "IdR1",
    "Id_Real_1",
    "HeaderId",
    "OrderHeaderId",
    "IdOrderHeader",
  ],
  data: ["Data", "OrderDate", "Tarigi", "RealDate", "SachemDate", "TransactionDate", "Date"],
  org: ["Org", "OrgName", "CustomerName", "Customer", "Klienti", "OrganizationName"],
  reg: ["Reg", "RegionName", "Region", "Raioni"],
  orgT: ["OrgT", "OrgType", "CustomerType", "CustomerCategory", "Segment"],
  gvari: ["Gvari", "Salesman", "Preseller", "Courier", "FieldSales", "IdGvariName"],
  tanxa: ["Tanxa", "Amount", "Summa", "Total", "LineAmount", "LineTotal", "Tangi"],
  prodS: ["ProdS", "ProductCategory", "Category", "ProdCategory"],
  manag: ["Manag", "Manager", "ManagerName"],
  qseli: ["Qseli", "Network", "SalesChannel", "Channel"],
  prodT: ["ProdT", "Brand", "ProductBrand"],
  realT: ["RealT", "SalesCategory", "PaymentType", "PayType"],
  prodCode: ["ProdCode", "ProductCode", "Sku", "ItemCode"],
  lat: ["Lat", "Latitude", "GeoLat", "Y", "CustomerLat"],
  lon: ["Lon", "Lng", "Longitude", "GeoLon", "X", "CustomerLon"],
  liters: ["TevadobaTotal", "Liters", "Litr", "VolumeL", "QtyLiters", "Tevadoba"],
};

/** Must exist for list aggregate + transfer validation. */
const REQUIRED_KEYS: (keyof OnlineColumnMap)[] = [
  "idReal1",
  "data",
  "org",
  "reg",
  "orgT",
  "gvari",
  "tanxa",
];

/** Used only for FilterBar; may stay unmapped if the staging view has no column. */
const FILTER_OPTIONAL_KEYS: (keyof OnlineColumnMap)[] = [
  "prodS",
  "manag",
  "qseli",
  "prodT",
  "realT",
  "prodCode",
];

const ENV_KEYS: Record<keyof OnlineColumnMap, string> = {
  idReal1: "MSSQL_ONLINE_COL_IDREAL1",
  data: "MSSQL_ONLINE_COL_DATA",
  org: "MSSQL_ONLINE_COL_ORG",
  reg: "MSSQL_ONLINE_COL_REG",
  orgT: "MSSQL_ONLINE_COL_ORGT",
  gvari: "MSSQL_ONLINE_COL_GVARI",
  tanxa: "MSSQL_ONLINE_COL_TANXA",
  prodS: "MSSQL_ONLINE_COL_PRODS",
  manag: "MSSQL_ONLINE_COL_MANAG",
  qseli: "MSSQL_ONLINE_COL_QSELI",
  prodT: "MSSQL_ONLINE_COL_PRODT",
  realT: "MSSQL_ONLINE_COL_REALT",
  prodCode: "MSSQL_ONLINE_COL_PRODCODE",
  lat: "MSSQL_ONLINE_COL_LAT",
  lon: "MSSQL_ONLINE_COL_LON",
  liters: "MSSQL_ONLINE_COL_LITERS",
};

const MAP_OPTIONAL_KEYS: (keyof OnlineColumnMap)[] = ["lat", "lon", "liters"];

function envOverride(envKey: string): string | undefined {
  const raw = process.env[envKey];
  if (raw === undefined || raw.trim() === "") return undefined;
  const v = raw.trim();
  if (!IDENT.test(v)) {
    throw new Error(`${envKey} must be a single SQL identifier. Got: ${v}`);
  }
  return v;
}

function parseViewParts(): { schema: string; name: string } {
  const full = getOnlineViewSqlName();
  const parts = full.split(".");
  if (parts.length === 2) {
    return { schema: parts[0], name: parts[1] };
  }
  return { schema: "dbo", name: parts[0] };
}

export async function fetchViewColumnNames(): Promise<string[]> {
  const { schema, name } = parseViewParts();
  const pool = await getAnalyticsPool();
  const r = await pool
    .request()
    .input("schema", sql.NVarChar(128), schema)
    .input("name", sql.NVarChar(128), name)
    .query<{ COLUMN_NAME: string }>(
      `SELECT COLUMN_NAME
       FROM INFORMATION_SCHEMA.COLUMNS
       WHERE TABLE_SCHEMA = @schema AND TABLE_NAME = @name
       ORDER BY ORDINAL_POSITION`
    );
  return r.recordset.map((row) => row.COLUMN_NAME);
}

function pickColumn(
  available: Set<string>,
  candidates: string[],
  key: keyof OnlineColumnMap
): string {
  const list = [...available];
  for (const c of candidates) {
    const hit = list.find((x) => x.toLowerCase() === c.toLowerCase());
    if (hit) return hit;
  }

  if (key === "idReal1") {
    const fuzzy = list.find(
      (x) =>
        /\bid.*real.*1\b/i.test(x) ||
        /\breal.*1.*id\b/i.test(x) ||
        /^idonline\d+$/i.test(x)
    );
    if (fuzzy) return fuzzy;
  }

  if (key === "tanxa") {
    const fuzzy = list.find((x) => /amount|sum|total|tanxa|tangi|lineamount/i.test(x));
    if (fuzzy) return fuzzy;
  }

  if (key === "data") {
    const fuzzy = list.find((x) => /date|tarigi|data/i.test(x) && !/birth|expir/i.test(x));
    if (fuzzy) return fuzzy;
  }

  throw new Error(
    `Online staging view: could not map logical column "${key}". ` +
      `Tried: ${candidates.slice(0, 8).join(", ")}… ` +
      `Available on view: ${list.sort().join(", ")}. ` +
      `Set ${ENV_KEYS[key]} in .env.local to the exact column name.`
  );
}

function cacheKey(): string {
  return `${getOnlineViewSqlName()}|${process.env.MSSQL_DATABASE ?? ""}`;
}

let cached: { key: string; map: OnlineColumnMap } | null = null;

/**
 * Resolves physical column names: optional MSSQL_ONLINE_COL_* overrides, otherwise
 * INFORMATION_SCHEMA + candidate list (OnlineRealViewAgent ≠ RealViewAgent column names).
 */
export async function resolveOnlineColumnMap(): Promise<OnlineColumnMap> {
  if (process.env.MSSQL_ONLINE_SCHEMA_CACHE !== "0") {
    const key = cacheKey();
    if (cached?.key === key) return cached.map;
  }

  const available = new Set(await fetchViewColumnNames());
  if (available.size === 0) {
    throw new Error(
      `No columns found for view "${getOnlineViewSqlName()}". Check MSSQL_ONLINE_VIEW and database permissions.`
    );
  }

  const map = {} as OnlineColumnMap;

  for (const key of REQUIRED_KEYS) {
    const envK = ENV_KEYS[key];
    const ov = envOverride(envK);
    if (ov) {
      const found = [...available].find((a) => a.toLowerCase() === ov.toLowerCase());
      if (!found) {
        throw new Error(
          `${envK}="${ov}" is not a column on the view. Available: ${[...available].sort().join(", ")}`
        );
      }
      map[key] = found;
    } else {
      map[key] = pickColumn(available, CANDIDATES[key], key);
    }
  }

  for (const key of FILTER_OPTIONAL_KEYS) {
    const envK = ENV_KEYS[key];
    const ov = envOverride(envK);
    if (ov) {
      const found = [...available].find((a) => a.toLowerCase() === ov.toLowerCase());
      if (!found) {
        throw new Error(
          `${envK}="${ov}" is not a column on the view. Available: ${[...available].sort().join(", ")}`
        );
      }
      map[key] = found;
    } else {
      try {
        (map as Record<keyof OnlineColumnMap, string | null>)[key] = pickColumn(
          available,
          CANDIDATES[key],
          key
        );
      } catch {
        (map as Record<keyof OnlineColumnMap, string | null>)[key] = null;
      }
    }
  }

  for (const key of MAP_OPTIONAL_KEYS) {
    const envK = ENV_KEYS[key];
    const ov = envOverride(envK);
    if (ov) {
      const found = [...available].find((a) => a.toLowerCase() === ov.toLowerCase());
      if (!found) {
        (map as Record<keyof OnlineColumnMap, string | null>)[key] = null;
      } else {
        (map as Record<keyof OnlineColumnMap, string | null>)[key] = found;
      }
    } else {
      try {
        (map as Record<keyof OnlineColumnMap, string | null>)[key] = pickColumn(
          available,
          CANDIDATES[key],
          key
        );
      } catch {
        (map as Record<keyof OnlineColumnMap, string | null>)[key] = null;
      }
    }
  }

  if (process.env.MSSQL_ONLINE_SCHEMA_CACHE !== "0") {
    cached = { key: cacheKey(), map };
  }
  return map;
}

export function invalidateOnlineColumnCache(): void {
  cached = null;
}
