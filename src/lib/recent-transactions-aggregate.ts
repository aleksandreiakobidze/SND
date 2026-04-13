import {
  RECENT_TX_ID_TO_ROW_KEY,
  isRecentTxMeasureColumnId,
  type RecentTransactionsColumnId,
} from "@/lib/recent-transactions-columns";

function parseNum(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return null;
  if (value instanceof Date) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return null;
  const n = Number(s.replace(/,/g, "").replace(/^\s*[₾$€£]\s*/, ""));
  return Number.isFinite(n) ? n : null;
}

function cellKeyPart(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return String(value).trim();
}

function makeGroupKey(row: Record<string, unknown>, dimensionIds: RecentTransactionsColumnId[]): string {
  return dimensionIds.map((id) => cellKeyPart(row[RECENT_TX_ID_TO_ROW_KEY[id]])).join("\u0001");
}

type Acc = {
  dimVals: Partial<Record<RecentTransactionsColumnId, unknown>>;
  sumQty: number;
  sumLiters: number;
  sumAmount: number;
  sumPriceTimesQty: number;
  sumQtyForWeightedPrice: number;
  sumPrice: number;
  nPrice: number;
};

/**
 * When the user hides columns, group source rows by visible **dimension** columns and
 * aggregate **measure** columns (sum qty/liters/amount; weighted average price by qty when possible).
 */
export function aggregateRecentTransactionsRows(
  rows: Record<string, unknown>[],
  visibleIds: RecentTransactionsColumnId[],
): Record<string, unknown>[] {
  const dimensionIds = visibleIds.filter((id) => !isRecentTxMeasureColumnId(id));

  const map = new Map<string, Acc>();

  for (const row of rows) {
    const key = makeGroupKey(row, dimensionIds);
    let acc = map.get(key);
    if (!acc) {
      acc = {
        dimVals: {},
        sumQty: 0,
        sumLiters: 0,
        sumAmount: 0,
        sumPriceTimesQty: 0,
        sumQtyForWeightedPrice: 0,
        sumPrice: 0,
        nPrice: 0,
      };
      for (const id of dimensionIds) {
        acc.dimVals[id] = row[RECENT_TX_ID_TO_ROW_KEY[id]];
      }
      map.set(key, acc);
    }

    const qty = parseNum(row.Qty) ?? 0;
    const liters = parseNum(row.Liters) ?? 0;
    const amount = parseNum(row.Amount) ?? 0;
    const price = parseNum(row.Price);

    acc.sumQty += qty;
    acc.sumLiters += liters;
    acc.sumAmount += amount;

    if (price !== null) {
      acc.sumPrice += price;
      acc.nPrice++;
      if (qty > 0) {
        acc.sumPriceTimesQty += price * qty;
        acc.sumQtyForWeightedPrice += qty;
      }
    }
  }

  const out: Record<string, unknown>[] = [];
  for (const acc of map.values()) {
    const o: Record<string, unknown> = {};
    for (const id of visibleIds) {
      const rk = RECENT_TX_ID_TO_ROW_KEY[id];
      if (!isRecentTxMeasureColumnId(id)) {
        o[rk] = acc.dimVals[id];
        continue;
      }
      switch (id) {
        case "qty":
          o[rk] = acc.sumQty;
          break;
        case "liter":
          o[rk] = acc.sumLiters;
          break;
        case "amount":
          o[rk] = acc.sumAmount;
          break;
        case "price":
          o[rk] =
            acc.sumQtyForWeightedPrice > 0
              ? acc.sumPriceTimesQty / acc.sumQtyForWeightedPrice
              : acc.nPrice > 0
                ? acc.sumPrice / acc.nPrice
                : null;
          break;
        default:
          break;
      }
    }
    out.push(o);
  }

  return out;
}

/** Case-insensitive substring match across all values in a row (full SQL row). */
export function filterRecentTransactionsSearch(rows: Record<string, unknown>[], query: string): Record<string, unknown>[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter((row) => {
    for (const v of Object.values(row)) {
      if (v === null || v === undefined) continue;
      if (String(v).toLowerCase().includes(q)) return true;
    }
    return false;
  });
}
