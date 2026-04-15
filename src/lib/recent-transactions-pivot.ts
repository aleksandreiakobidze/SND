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

export function makePivotKey(row: Record<string, unknown>, dimIds: RecentTransactionsColumnId[]): string {
  if (dimIds.length === 0) return "\u0000";
  return dimIds.map((id) => cellKeyPart(row[RECENT_TX_ID_TO_ROW_KEY[id]])).join("\u0001");
}

type MeasureAcc = {
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

export function emptyAcc(): MeasureAcc {
  return { stats: {} };
}

function keyify(v: unknown): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

function ensureStat(acc: MeasureAcc, id: RecentTransactionsColumnId) {
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

function addRowToAcc(acc: MeasureAcc, row: Record<string, unknown>): void {
  for (const id of Object.keys(RECENT_TX_VALUE_META) as RecentTransactionsColumnId[]) {
    const meta = RECENT_TX_VALUE_META[id];
    if (!meta) continue;
    const stat = ensureStat(acc, id);
    const raw = row[meta.sourceField];
    const key = keyify(raw);
    if (key) {
      stat.distinct.add(key);
      stat.count += 1;
    }
    const n = parseNum(raw);
    if (n === null) continue;
    stat.sum += n;
    stat.min = Math.min(stat.min, n);
    stat.max = Math.max(stat.max, n);
  }
}

export function mergeAcc(into: MeasureAcc, from: MeasureAcc): void {
  for (const id of Object.keys(from.stats) as RecentTransactionsColumnId[]) {
    const fs = from.stats[id];
    if (!fs) continue;
    const ts = ensureStat(into, id);
    ts.sum += fs.sum;
    ts.count += fs.count;
    ts.min = Math.min(ts.min, fs.min);
    ts.max = Math.max(ts.max, fs.max);
    for (const v of fs.distinct) ts.distinct.add(v);
  }
}

function statValue(
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

export function accToValues(
  acc: MeasureAcc,
  valueDefs: RecentTxValueDef[],
): Record<RecentTransactionsColumnId, number | null> {
  const out: Partial<Record<RecentTransactionsColumnId, number | null>> = {};
  for (const def of valueDefs) {
    out[def.valueId] = statValue(acc.stats[def.valueId], def);
  }
  return out as Record<RecentTransactionsColumnId, number | null>;
}

export type PivotDisplayRow =
  | {
      kind: "data";
      rowKey: string;
      dimValues: unknown[];
    }
  | {
      kind: "subtotal";
      /** First row-dimension value this block belongs to */
      label: string;
      depth: number;
    };

export type PivotModel = {
  rowIds: RecentTransactionsColumnId[];
  colIds: RecentTransactionsColumnId[];
  valueIds: RecentTransactionsColumnId[];
  valueDefs: RecentTxValueDef[];
  /** Sorted column keys (composite of col dimensions). */
  colKeys: string[];
  /** Human label per col key (e.g. "3 · 2024"). */
  colLabels: Map<string, string>;
  /** Row keys in display order (data rows only, for indexing). */
  dataRowKeys: string[];
  /** dimValues per data row key */
  dataRowDimValues: Map<string, unknown[]>;
  /** cell[rowKey][colKey] = aggregated measures */
  cells: Map<string, Map<string, MeasureAcc>>;
  /** Precomputed display rows (data + subtotals + grand). */
  displayRows: PivotDisplayRow[];
};

export type BuildPivotOptions = {
  /** BCP 47 locale for month (and similar) column labels, e.g. `en-US`, `ka-GE`. */
  locale?: string;
};

function expandMonthColumnKeys(
  colIds: RecentTransactionsColumnId[],
  keysFromData: string[],
): string[] {
  if (colIds.length === 1 && colIds[0] === "month") {
    const allMonths = Array.from({ length: 12 }, (_, i) => String(i + 1));
    return [...new Set([...keysFromData, ...allMonths])].sort((a, b) => Number(a) - Number(b));
  }
  return [...keysFromData].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

function buildColLabelsForKeys(
  colKeys: string[],
  colIds: RecentTransactionsColumnId[],
  locale: string,
): Map<string, string> {
  const map = new Map<string, string>();
  for (const ck of colKeys) {
    const parts = ck.split("\u0001").filter((p) => p.length > 0);
    const labels = parts.map((p, i) => {
      const id = colIds[i];
      if (id === "month") {
        const m = Number(p);
        if (Number.isFinite(m) && m >= 1 && m <= 12) {
          try {
            return new Intl.DateTimeFormat(locale, { month: "short" }).format(new Date(2000, m - 1, 1));
          } catch {
            return p;
          }
        }
      }
      return p;
    });
    map.set(ck, labels.join(" · "));
  }
  return map;
}

/**
 * Build pivot model: aggregates line-level rows into rowKey × colKey cells, optional first-dimension subtotals.
 */
export function buildPivotModel(
  rows: Record<string, unknown>[],
  rowIds: RecentTransactionsColumnId[],
  colIds: RecentTransactionsColumnId[],
  valueIds: RecentTransactionsColumnId[],
  valueDefsInput?: RecentTxValueDef[],
  options?: BuildPivotOptions,
): PivotModel {
  const badMeasure = valueIds.some((id) => !isRecentTxValueEligible(id));
  if (badMeasure || valueIds.length === 0) {
    return {
      rowIds,
      colIds,
      valueIds,
      valueDefs: [],
      colKeys: [],
      colLabels: new Map(),
      dataRowKeys: [],
      dataRowDimValues: new Map(),
      cells: new Map(),
      displayRows: [],
    };
  }
  const valueDefs = normalizeValueDefs(valueIds, valueDefsInput);

  const cells = new Map<string, Map<string, MeasureAcc>>();

  for (const row of rows) {
    const rk = makePivotKey(row, rowIds);
    const ck = makePivotKey(row, colIds);
    if (!cells.has(rk)) cells.set(rk, new Map());
    const rowMap = cells.get(rk)!;
    if (!rowMap.has(ck)) rowMap.set(ck, emptyAcc());
    addRowToAcc(rowMap.get(ck)!, row);
  }

  const colKeySet = new Set<string>();
  for (const colMap of cells.values()) {
    for (const ck of colMap.keys()) colKeySet.add(ck);
  }
  const keysFromData = [...colKeySet];
  const locale = options?.locale ?? "en-US";
  const colKeys = expandMonthColumnKeys(colIds, keysFromData);
  const colLabels = buildColLabelsForKeys(colKeys, colIds, locale);

  const dataRowKeys = [...cells.keys()].sort((a, b) => compareRowKeys(a, b, rowIds.length));

  const dataRowDimValues = new Map<string, unknown[]>();
  for (const rk of dataRowKeys) {
    const parts = rk.split("\u0001");
    const vals = parts.map((p, i) => (rowIds[i] ? parseDimPart(p, rowIds[i]) : p));
    dataRowDimValues.set(rk, vals);
  }

  const displayRows: PivotDisplayRow[] = [];

  if (rowIds.length <= 1) {
    for (const rk of dataRowKeys) {
      displayRows.push({
        kind: "data",
        rowKey: rk,
        dimValues: dataRowDimValues.get(rk) ?? splitKeyToUnknown(rk, rowIds.length),
      });
    }
  } else {
    const firstDimGroups = new Map<string, string[]>();
    for (const rk of dataRowKeys) {
      const first = rk.split("\u0001")[0] ?? "";
      if (!firstDimGroups.has(first)) firstDimGroups.set(first, []);
      firstDimGroups.get(first)!.push(rk);
    }
    const sortedFirst = [...firstDimGroups.keys()].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    for (const fd of sortedFirst) {
      const groupKeys = firstDimGroups.get(fd)!;
      groupKeys.sort((a, b) => compareRowKeys(a, b, rowIds.length));
      for (const rk of groupKeys) {
        displayRows.push({
          kind: "data",
          rowKey: rk,
          dimValues: dataRowDimValues.get(rk) ?? splitKeyToUnknown(rk, rowIds.length),
        });
      }
      displayRows.push({ kind: "subtotal", label: fd, depth: 0 });
    }
  }

  return {
    rowIds,
    colIds,
    valueIds,
    valueDefs,
    colKeys,
    colLabels,
    dataRowKeys,
    dataRowDimValues,
    cells,
    displayRows,
  };
}

function parseDimPart(part: string, id: RecentTransactionsColumnId): unknown {
  if (id === "month" || id === "year") {
    const n = Number(part);
    return Number.isFinite(n) ? n : part;
  }
  return part;
}

function splitKeyToUnknown(rk: string, n: number): unknown[] {
  const parts = rk.split("\u0001");
  return parts.slice(0, n);
}

function compareRowKeys(a: string, b: string, dimCount: number): number {
  const pa = a.split("\u0001");
  const pb = b.split("\u0001");
  for (let i = 0; i < dimCount; i++) {
    const cmp = (pa[i] ?? "").localeCompare(pb[i] ?? "", undefined, { numeric: true });
    if (cmp !== 0) return cmp;
  }
  return 0;
}

export function sumAccForRow(
  model: PivotModel,
  rowKey: string | null,
  predicate: (colKey: string) => boolean,
): MeasureAcc {
  const acc = emptyAcc();
  if (rowKey === null) {
    for (const colMap of model.cells.values()) {
      for (const [ck, a] of colMap) {
        if (predicate(ck)) mergeAcc(acc, a);
      }
    }
    return acc;
  }
  const rowMap = model.cells.get(rowKey);
  if (!rowMap) return acc;
  for (const [ck, a] of rowMap) {
    if (predicate(ck)) mergeAcc(acc, a);
  }
  return acc;
}

/** Sum all columns (for row total). */
export function sumAccRowAllCols(model: PivotModel, rowKey: string): MeasureAcc {
  return sumAccForRow(model, rowKey, () => true);
}

/** Sum all rows for one column key (footer). */
export function sumAccColAllRows(model: PivotModel, colKey: string): MeasureAcc {
  const acc = emptyAcc();
  for (const colMap of model.cells.values()) {
    const a = colMap.get(colKey);
    if (a) mergeAcc(acc, a);
  }
  return acc;
}

/** Subtotal for rows whose key starts with firstDimPrefix (including nested keys). */
export function sumAccForFirstDimPrefix(model: PivotModel, firstDimPrefix: string): MeasureAcc {
  const acc = emptyAcc();
  const prefix = `${firstDimPrefix}\u0001`;
  for (const [rk, colMap] of model.cells) {
    if (rk === firstDimPrefix || rk.startsWith(prefix)) {
      for (const a of colMap.values()) mergeAcc(acc, a);
    }
  }
  return acc;
}

export function grandTotalAcc(model: PivotModel): MeasureAcc {
  const acc = emptyAcc();
  for (const colMap of model.cells.values()) {
    for (const a of colMap.values()) mergeAcc(acc, a);
  }
  return acc;
}

/** Sum cells in `colKey` for all rows whose row key starts with the first dimension value `firstDimPrefix`. */
export function sumAccColForPrefix(model: PivotModel, firstDimPrefix: string, colKey: string): MeasureAcc {
  const acc = emptyAcc();
  const p = `${firstDimPrefix}\u0001`;
  for (const [rk, colMap] of model.cells) {
    if (rk === firstDimPrefix || rk.startsWith(p)) {
      const a = colMap.get(colKey);
      if (a) mergeAcc(acc, a);
    }
  }
  return acc;
}

export type { MeasureAcc };
