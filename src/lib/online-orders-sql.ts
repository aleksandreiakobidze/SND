import { injectWhere } from "@/lib/filters";
import { type OnlineColumnMap, sqlIdent } from "@/lib/online-columns";
import { ONLINE_VIEW_NAME } from "@/lib/schema";

/**
 * Table name for SQL (unquoted); historically a view name. Allows `TableName` or `schema.TableName` (e.g. dbo.OnlineRealViewAgent).
 */
export function getOnlineViewSqlName(): string {
  const v = (process.env.MSSQL_ONLINE_VIEW || ONLINE_VIEW_NAME).trim();
  const safe =
    /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(v) ||
    /^[a-zA-Z_][a-zA-Z0-9_]*\.[a-zA-Z_][a-zA-Z0-9_]*$/.test(v);
  if (!safe) {
    throw new Error(
      "Invalid MSSQL_ONLINE_VIEW: use Identifier or schema.Identifier (letters, digits, underscore only)"
    );
  }
  return v;
}

/**
 * Pending mobile orders aggregated by header (logical IdReal1 in result set).
 * Physical columns come from resolveOnlineColumnMap() (INFORMATION_SCHEMA + env overrides).
 */
export function buildOnlineOrdersAggregateQuery(whereClause: string, c: OnlineColumnMap): string {
  const view = getOnlineViewSqlName();
  const id = sqlIdent(c.idReal1);
  const dt = sqlIdent(c.data);
  const base = `
    SELECT
      ${id} AS IdReal1,
      MIN(${dt}) AS Data,
      MAX(${sqlIdent(c.org)}) AS Org,
      MAX(${sqlIdent(c.reg)}) AS Reg,
      MAX(${sqlIdent(c.orgT)}) AS OrgT,
      MAX(${sqlIdent(c.gvari)}) AS Gvari,
      CAST(SUM(${sqlIdent(c.tanxa)}) AS float) AS OrderTotal,
      COUNT(*) AS LineCount
    FROM ${view}
    GROUP BY ${id}
    ORDER BY MIN(${dt}) DESC
  `;
  return injectWhere(base, whereClause);
}
