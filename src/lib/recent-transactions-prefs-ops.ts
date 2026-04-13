import {
  reconcileTablePartitionWithMatrix,
  type RecentTransactionsLayoutPrefs,
  type RecentTransactionsMatrixPrefs,
} from "@/lib/dashboard-layout";
import {
  RECENT_TRANSACTIONS_COLUMN_IDS,
  type RecentTransactionsColumnId,
  isRecentTransactionsColumnId,
  isRecentTxMeasureColumnId,
} from "@/lib/recent-transactions-columns";

function baseMatrix(prefs: RecentTransactionsLayoutPrefs): RecentTransactionsMatrixPrefs {
  return (
    prefs.matrix ?? {
      rowIds: [],
      columnIds: [],
      valueIds: ["liter"],
    }
  );
}

export function withReconciledPrefs(prefs: RecentTransactionsLayoutPrefs): RecentTransactionsLayoutPrefs {
  const m = baseMatrix(prefs);
  const r = reconcileTablePartitionWithMatrix(prefs.columnOrder, prefs.hiddenColumnIds, m);
  return {
    ...prefs,
    columnOrder: r.columnOrder,
    hiddenColumnIds: r.hiddenColumnIds,
    matrix: m,
  };
}

/** Add a field from the pool (hidden) into table columns at end. */
export function addFieldToTableColumns(prefs: RecentTransactionsLayoutPrefs, id: RecentTransactionsColumnId): RecentTransactionsLayoutPrefs {
  if (!prefs.hiddenColumnIds.includes(id)) return withReconciledPrefs(prefs);
  const hidden = prefs.hiddenColumnIds.filter((x) => x !== id);
  const columnOrder = [...prefs.columnOrder, id];
  const next: RecentTransactionsLayoutPrefs = { ...prefs, columnOrder, hiddenColumnIds: hidden, matrix: baseMatrix(prefs) };
  return withReconciledPrefs(next);
}

export function removeFieldFromTable(prefs: RecentTransactionsLayoutPrefs, id: RecentTransactionsColumnId): RecentTransactionsLayoutPrefs {
  if (!prefs.columnOrder.includes(id)) return withReconciledPrefs(prefs);
  if (prefs.columnOrder.length <= 1) return prefs;
  const columnOrder = prefs.columnOrder.filter((x) => x !== id);
  const hiddenColumnIds = [...prefs.hiddenColumnIds, id];
  const next: RecentTransactionsLayoutPrefs = { ...prefs, columnOrder, hiddenColumnIds, matrix: baseMatrix(prefs) };
  return withReconciledPrefs(next);
}

export function reorderTableColumns(
  prefs: RecentTransactionsLayoutPrefs,
  activeId: RecentTransactionsColumnId,
  overId: RecentTransactionsColumnId,
): RecentTransactionsLayoutPrefs {
  const order = [...prefs.columnOrder];
  const oi = order.indexOf(activeId);
  const ni = order.indexOf(overId);
  if (oi === -1 || ni === -1 || oi === ni) return prefs;
  const [removed] = order.splice(oi, 1);
  order.splice(ni, 0, removed);
  const next: RecentTransactionsLayoutPrefs = { ...prefs, columnOrder: order, matrix: baseMatrix(prefs) };
  return withReconciledPrefs(next);
}

export function setViewMode(prefs: RecentTransactionsLayoutPrefs, mode: "table" | "matrix"): RecentTransactionsLayoutPrefs {
  return withReconciledPrefs({ ...prefs, viewMode: mode, matrix: baseMatrix(prefs) });
}

function ensureMatrix(prefs: RecentTransactionsLayoutPrefs): RecentTransactionsMatrixPrefs {
  return prefs.matrix ?? { rowIds: [], columnIds: [], valueIds: ["liter"] };
}

/** Move id into matrix zone; removes from table partition or other matrix zones first. */
export function addFieldToMatrixZone(
  prefs: RecentTransactionsLayoutPrefs,
  id: RecentTransactionsColumnId,
  zone: "rows" | "columns" | "values",
  insertIndex?: number,
): RecentTransactionsLayoutPrefs {
  let columnOrder = prefs.columnOrder.filter((x) => x !== id);
  let hiddenColumnIds = prefs.hiddenColumnIds.filter((x) => x !== id);
  const m = ensureMatrix(prefs);
  let rowIds = m.rowIds.filter((x) => x !== id);
  let columnIds = m.columnIds.filter((x) => x !== id);
  let valueIds = m.valueIds.filter((x) => x !== id);

  if (zone === "values") {
    if (!isRecentTxMeasureColumnId(id)) return withReconciledPrefs(prefs);
    const idx = insertIndex ?? valueIds.length;
    valueIds = [...valueIds.slice(0, idx), id, ...valueIds.slice(idx)];
  } else {
    if (isRecentTxMeasureColumnId(id)) return withReconciledPrefs(prefs);
    if (zone === "rows") {
      const idx = insertIndex ?? rowIds.length;
      rowIds = [...rowIds.slice(0, idx), id, ...rowIds.slice(idx)];
    } else {
      const idx = insertIndex ?? columnIds.length;
      columnIds = [...columnIds.slice(0, idx), id, ...columnIds.slice(idx)];
    }
  }

  if (valueIds.length < 1) valueIds = ["liter"];

  const next: RecentTransactionsLayoutPrefs = {
    ...prefs,
    columnOrder,
    hiddenColumnIds,
    matrix: { rowIds, columnIds, valueIds },
  };
  return withReconciledPrefs(next);
}

export function removeFieldFromMatrix(prefs: RecentTransactionsLayoutPrefs, id: RecentTransactionsColumnId): RecentTransactionsLayoutPrefs {
  const m = ensureMatrix(prefs);
  const rowIds = m.rowIds.filter((x) => x !== id);
  const columnIds = m.columnIds.filter((x) => x !== id);
  let valueIds = m.valueIds.filter((x) => x !== id);
  if (valueIds.length < 1) valueIds = ["liter"];
  let hiddenColumnIds = [...prefs.hiddenColumnIds];
  if (!prefs.columnOrder.includes(id) && !hiddenColumnIds.includes(id)) {
    hiddenColumnIds = [...hiddenColumnIds, id];
  }
  const next: RecentTransactionsLayoutPrefs = {
    ...prefs,
    hiddenColumnIds,
    matrix: { rowIds, columnIds, valueIds },
  };
  return withReconciledPrefs(next);
}

export function reorderMatrixZone(
  prefs: RecentTransactionsLayoutPrefs,
  zone: "rows" | "columns" | "values",
  activeId: RecentTransactionsColumnId,
  overId: RecentTransactionsColumnId,
): RecentTransactionsLayoutPrefs {
  const m = ensureMatrix(prefs);
  const key = zone === "rows" ? "rowIds" : zone === "columns" ? "columnIds" : "valueIds";
  const list = [...m[key]];
  const oi = list.indexOf(activeId);
  const ni = list.indexOf(overId);
  if (oi === -1 || ni === -1 || oi === ni) return prefs;
  const [removed] = list.splice(oi, 1);
  list.splice(ni, 0, removed);
  const next: RecentTransactionsLayoutPrefs = {
    ...prefs,
    matrix: { ...m, [key]: list },
  };
  return withReconciledPrefs(next);
}

export function moveMatrixFieldBetweenZones(
  prefs: RecentTransactionsLayoutPrefs,
  id: RecentTransactionsColumnId,
  target: "rows" | "columns" | "values",
  insertIndex?: number,
): RecentTransactionsLayoutPrefs {
  const m = ensureMatrix(prefs);
  let rowIds = m.rowIds.filter((x) => x !== id);
  let columnIds = m.columnIds.filter((x) => x !== id);
  let valueIds = m.valueIds.filter((x) => x !== id);

  if (target === "values") {
    if (!isRecentTxMeasureColumnId(id)) return withReconciledPrefs(prefs);
    const idx = insertIndex ?? valueIds.length;
    valueIds = [...valueIds.slice(0, idx), id, ...valueIds.slice(idx)];
  } else if (target === "rows") {
    if (isRecentTxMeasureColumnId(id)) return withReconciledPrefs(prefs);
    const idx = insertIndex ?? rowIds.length;
    rowIds = [...rowIds.slice(0, idx), id, ...rowIds.slice(idx)];
  } else {
    if (isRecentTxMeasureColumnId(id)) return withReconciledPrefs(prefs);
    const idx = insertIndex ?? columnIds.length;
    columnIds = [...columnIds.slice(0, idx), id, ...columnIds.slice(idx)];
  }

  if (valueIds.length < 1) valueIds = ["liter"];

  const next: RecentTransactionsLayoutPrefs = {
    ...prefs,
    matrix: { rowIds, columnIds, valueIds },
  };
  return withReconciledPrefs(next);
}

export function catalogFieldIds(): RecentTransactionsColumnId[] {
  return [...RECENT_TRANSACTIONS_COLUMN_IDS];
}

export function parseRtDndField(s: string): RecentTransactionsColumnId | null {
  if (!s.startsWith("rtf:")) return null;
  const id = s.slice(4);
  return isRecentTransactionsColumnId(id) ? id : null;
}

export function parseRtSlot(
  s: string,
): { zone: "table" | "rows" | "cols" | "values"; id: RecentTransactionsColumnId } | null {
  if (s.startsWith("rtt:")) {
    const id = s.slice(4);
    return isRecentTransactionsColumnId(id) ? { zone: "table", id } : null;
  }
  if (s.startsWith("rtr:")) {
    const id = s.slice(4);
    return isRecentTransactionsColumnId(id) ? { zone: "rows", id } : null;
  }
  if (s.startsWith("rtc:")) {
    const id = s.slice(4);
    return isRecentTransactionsColumnId(id) ? { zone: "cols", id } : null;
  }
  if (s.startsWith("rtv:")) {
    const id = s.slice(4);
    return isRecentTransactionsColumnId(id) ? { zone: "values", id } : null;
  }
  return null;
}

export const RT_ZONE_TABLE = "rtz-table";
export const RT_ZONE_ROWS = "rtz-rows";
export const RT_ZONE_COLS = "rtz-cols";
export const RT_ZONE_VALUES = "rtz-values";
