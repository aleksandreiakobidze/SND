import {
  RECENT_TX_VALUE_META,
  defaultAggregationForValueId,
  type RecentTxValueDef,
  normalizeValueDefs,
  RECENT_TX_ID_TO_ROW_KEY,
  isRecentTxValueEligible,
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
  stats: Partial<
    Record<
      RecentTransactionsColumnId,
      {
        sum: number;
        count: number;
        min: number;
        max: number;
        distinct: Set<string>;
      }
    >
  >;
};

function keyify(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function ensureStat(acc: Acc, id: RecentTransactionsColumnId) {
  if (!acc.stats[id]) {
    acc.stats[id] = {
      sum: 0,
      count: 0,
      min: Number.POSITIVE_INFINITY,
      max: Number.NEGATIVE_INFINITY,
      distinct: new Set<string>(),
    };
  }
  return acc.stats[id]!;
}

function addRowStats(acc: Acc, row: Record<string, unknown>, measureIds: RecentTransactionsColumnId[]): void {
  for (const id of measureIds) {
    const meta = RECENT_TX_VALUE_META[id];
    if (!meta) continue;
    const st = ensureStat(acc, id);
    const raw = row[meta.sourceField];
    const key = keyify(raw);
    if (key) {
      st.distinct.add(key);
      st.count += 1;
    }
    const n = parseNum(raw);
    if (n === null) continue;
    st.sum += n;
    st.min = Math.min(st.min, n);
    st.max = Math.max(st.max, n);
  }
}

function valueFromStat(
  stat: { sum: number; count: number; min: number; max: number; distinct: Set<string> } | undefined,
  def: RecentTxValueDef,
): number | null {
  if (!stat) return null;
  switch (def.aggregation) {
    case "sum":
      return stat.sum;
    case "count":
      return stat.count;
    case "distinct_count":
      return stat.distinct.size;
    case "avg":
      return stat.count > 0 ? stat.sum / stat.count : null;
    case "min":
      return stat.count > 0 ? stat.min : null;
    case "max":
      return stat.count > 0 ? stat.max : null;
    default:
      return stat.sum;
  }
}

/**
 * When the user hides columns, group source rows by visible **dimension** columns and
 * aggregate **measure** columns (sum qty/liters/amount; weighted average price by qty when possible).
 */
export function aggregateRecentTransactionsRows(
  rows: Record<string, unknown>[],
  visibleIds: RecentTransactionsColumnId[],
  valueDefsInput?: RecentTxValueDef[],
): Record<string, unknown>[] {
  const explicitValueIds = normalizeValueDefs(
    (valueDefsInput?.map((d) => d.valueId) ?? []).filter((id): id is RecentTransactionsColumnId => isRecentTxValueEligible(id)),
    valueDefsInput,
  ).map((d) => d.valueId);
  const measureIds = visibleIds.filter((id) => explicitValueIds.includes(id));
  const dimensionIds = visibleIds.filter((id) => !measureIds.includes(id));
  const valueDefs = normalizeValueDefs(measureIds, valueDefsInput);

  const map = new Map<string, Acc>();

  for (const row of rows) {
    const key = makeGroupKey(row, dimensionIds);
    let acc = map.get(key);
    if (!acc) {
      acc = {
        dimVals: {},
        stats: {},
      };
      for (const id of dimensionIds) {
        acc.dimVals[id] = row[RECENT_TX_ID_TO_ROW_KEY[id]];
      }
      map.set(key, acc);
    }

    addRowStats(acc, row, measureIds);
  }

  const out: Record<string, unknown>[] = [];
  for (const acc of map.values()) {
    const o: Record<string, unknown> = {};
    for (const id of visibleIds) {
      const rk = RECENT_TX_ID_TO_ROW_KEY[id];
      if (!measureIds.includes(id)) {
        o[rk] = acc.dimVals[id];
        continue;
      }
      const def =
        valueDefs.find((d) => d.valueId === id) ??
        ({ valueId: id, aggregation: defaultAggregationForValueId(id) } as RecentTxValueDef);
      o[rk] = valueFromStat(acc.stats[id], def);
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
