const IDENT = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Logical field → physical column names on the staging view (resolved at runtime).
 * Filter-only fields may be null if the view has no matching column (e.g. no payment type online).
 */
export type OnlineColumnMap = {
  idReal1: string;
  data: string;
  org: string;
  reg: string;
  orgT: string;
  gvari: string;
  tanxa: string;
  prodS: string | null;
  manag: string | null;
  qseli: string | null;
  prodT: string | null;
  realT: string | null;
  prodCode: string | null;
};

/** Safe bracket-quoted identifier for SQL Server ([name]). */
export function sqlIdent(name: string): string {
  const n = name.trim();
  if (!IDENT.test(n)) {
    throw new Error(`Invalid SQL identifier: ${name}`);
  }
  return `[${n.replace(/\]/g, "]]")}]`;
}

function sanitize(value: string): string {
  return value.replace(/'/g, "''").replace(/;/g, "").replace(/--/g, "");
}

const ONLINE_FILTER_MAP: Record<string, keyof OnlineColumnMap> = {
  region: "reg",
  category: "prodS",
  manager: "manag",
  network: "qseli",
  brand: "prodT",
  salesCategory: "realT",
  customerCategory: "orgT",
  product: "prodCode",
};

/**
 * WHERE clause for online staging view (uses resolved physical column names).
 */
export function buildOnlineWhereClause(params: URLSearchParams, c: OnlineColumnMap): string {
  const conditions: string[] = [];

  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");
  if (dateFrom) conditions.push(`${sqlIdent(c.data)} >= '${sanitize(dateFrom)}'`);
  if (dateTo) conditions.push(`${sqlIdent(c.data)} <= '${sanitize(dateTo)} 23:59:59'`);

  for (const [paramKey, colKey] of Object.entries(ONLINE_FILTER_MAP)) {
    const raw = params.get(paramKey);
    if (!raw) continue;
    const columnName = c[colKey];
    if (columnName == null) continue;
    const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) {
      conditions.push(`${sqlIdent(columnName)} = N'${sanitize(values[0])}'`);
    } else if (values.length > 1) {
      const list = values.map((v) => `N'${sanitize(v)}'`).join(",");
      conditions.push(`${sqlIdent(columnName)} IN (${list})`);
    }
  }

  if (conditions.length === 0) return "";
  return " WHERE " + conditions.join(" AND ");
}
