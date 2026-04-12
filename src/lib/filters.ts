import { rvaSql, type RvaKey } from "@/lib/realview-columns";

export interface FilterParams {
  dateFrom?: string;
  dateTo?: string;
  region?: string[];
  category?: string[];
  manager?: string[];
  network?: string[];
  brand?: string[];
  /** RealT — sales category (გაყიდვების კატეგორია) */
  salesCategory?: string[];
  customerCategory?: string[];
  product?: string[];
}

export type FilterField = keyof Omit<FilterParams, "dateFrom" | "dateTo">;

export function todayStr(): string {
  const d = new Date();
  return d.toISOString().split("T")[0];
}

/** Calendar yesterday (same date logic as todayStr). */
export function yesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split("T")[0];
}

/** Same shape as query string used by `/api/dashboard` and `/api/reports` */
export function filtersToSearchParams(filters: FilterParams): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.dateFrom) params.set("dateFrom", filters.dateFrom);
  if (filters.dateTo) params.set("dateTo", filters.dateTo);
  appendArray(params, "region", filters.region);
  appendArray(params, "category", filters.category);
  appendArray(params, "manager", filters.manager);
  appendArray(params, "network", filters.network);
  appendArray(params, "brand", filters.brand);
  appendArray(params, "salesCategory", filters.salesCategory);
  appendArray(params, "customerCategory", filters.customerCategory);
  appendArray(params, "product", filters.product);
  return params;
}

export function buildFilterQueryString(filters: FilterParams): string {
  const qs = filtersToSearchParams(filters).toString();
  return qs ? `&${qs}` : "";
}

function appendArray(params: URLSearchParams, key: string, values?: string[]) {
  if (values && values.length > 0) params.set(key, values.join(","));
}

const COL_MAP: Record<string, RvaKey> = {
  region: "REG",
  category: "PRODS",
  manager: "MANAG",
  network: "QSELI",
  brand: "PRODT",
  salesCategory: "REALT",
  customerCategory: "ORGT",
  product: "IDPROD",
};

/** Region, category, manager, … — not date. Used for fixed-window queries (e.g. month-over-month). */
export function buildNonDateConditions(params: URLSearchParams): string[] {
  const conditions: string[] = [];
  for (const [paramKey, colKey] of Object.entries(COL_MAP)) {
    const raw = params.get(paramKey);
    if (!raw) continue;
    const column = rvaSql(colKey);
    const values = raw.split(",").map((v) => v.trim()).filter(Boolean);
    if (values.length === 1) {
      conditions.push(`${column} = N'${sanitize(values[0])}'`);
    } else if (values.length > 1) {
      const list = values.map((v) => `N'${sanitize(v)}'`).join(",");
      conditions.push(`${column} IN (${list})`);
    }
  }
  return conditions;
}

/** ` AND t.[Col] = …` for subqueries with table alias `t` */
export function buildNonDateFilterAndClause(params: URLSearchParams, tableAlias = "t"): string {
  const parts = buildNonDateConditions(params).map((c) =>
    c.replace(/^(\[[^\]]+\])/, `${tableAlias}.$1`),
  );
  if (parts.length === 0) return "";
  return " AND " + parts.join(" AND ");
}

export function buildWhereClause(params: URLSearchParams): string {
  const conditions: string[] = [];

  const dateFrom = params.get("dateFrom");
  const dateTo = params.get("dateTo");

  const dataCol = rvaSql("DATA");
  if (dateFrom) conditions.push(`${dataCol} >= '${sanitize(dateFrom)}'`);
  if (dateTo) conditions.push(`${dataCol} <= '${sanitize(dateTo)} 23:59:59'`);

  conditions.push(...buildNonDateConditions(params));

  if (conditions.length === 0) return "";
  return " WHERE " + conditions.join(" AND ");
}

function sanitize(value: string): string {
  return value.replace(/'/g, "''").replace(/;/g, "").replace(/--/g, "");
}

export function injectWhere(query: string, whereClause: string): string {
  if (!whereClause) return query;

  const hasWhere = /\bWHERE\b/i.test(query);
  if (hasWhere) {
    return query.replace(/\bWHERE\b/i, `${whereClause} AND `).replace("WHERE  WHERE", "WHERE");
  }

  const groupByMatch = query.match(/\bGROUP\s+BY\b/i);
  const orderByMatch = query.match(/\bORDER\s+BY\b/i);
  const insertPoint = groupByMatch
    ? query.indexOf(groupByMatch[0])
    : orderByMatch
      ? query.indexOf(orderByMatch[0])
      : query.length;

  return query.slice(0, insertPoint) + whereClause + " " + query.slice(insertPoint);
}
