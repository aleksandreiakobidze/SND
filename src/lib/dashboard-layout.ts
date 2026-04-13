import type { ChartVariant } from "@/components/charts/FlexChart";
import type { ChartMeasure } from "@/components/charts/ChartWrapper";
import type { ChartNumberStyle } from "@/lib/chart-number-format";
import {
  RECENT_TRANSACTIONS_COLUMN_IDS,
  type RecentTransactionsColumnId,
  isRecentTransactionsColumnId,
  isRecentTxMeasureColumnId,
} from "@/lib/recent-transactions-columns";

/** Stable widget ids for the home dashboard (order is a permutation of these 8). */
export const DASHBOARD_WIDGET_IDS = [
  "kpi-total-revenue",
  "kpi-total-orders",
  "kpi-avg-order-value",
  "kpi-active-customers",
  "chart-revenue-by-region",
  "chart-sales-by-category",
  "chart-daily-trend",
  "recent-transactions",
] as const;

export type DashboardWidgetId = (typeof DASHBOARD_WIDGET_IDS)[number];

export const KPI_WIDGET_PREFIX = "kpi-" as const;

export const CHART_WIDGET_IDS = [
  "chart-revenue-by-region",
  "chart-sales-by-category",
  "chart-daily-trend",
] as const;

export type DashboardChartWidgetId = (typeof CHART_WIDGET_IDS)[number];

const WIDGET_SET = new Set<string>(DASHBOARD_WIDGET_IDS);
const CHART_SET = new Set<string>(CHART_WIDGET_IDS);

const VARIANTS_REGION = new Set<ChartVariant>(["bar", "pie", "horizontal-bar"]);
const VARIANTS_CATEGORY = new Set<ChartVariant>(["pie", "bar", "horizontal-bar"]);
const VARIANTS_DAILY = new Set<ChartVariant>(["area", "line", "bar"]);

function allowedVariantsForChart(id: DashboardChartWidgetId): Set<ChartVariant> {
  if (id === "chart-revenue-by-region") return VARIANTS_REGION;
  if (id === "chart-sales-by-category") return VARIANTS_CATEGORY;
  return VARIANTS_DAILY;
}

export type RtViewMode = "table" | "matrix";

export type RecentTransactionsMatrixPrefs = {
  rowIds: RecentTransactionsColumnId[];
  columnIds: RecentTransactionsColumnId[];
  valueIds: RecentTransactionsColumnId[];
};

export type RecentTransactionsLayoutPrefs = {
  columnOrder: RecentTransactionsColumnId[];
  hiddenColumnIds: RecentTransactionsColumnId[];
  /** Default `table` when omitted (legacy layouts). */
  viewMode?: RtViewMode;
  matrix?: RecentTransactionsMatrixPrefs;
};

export function getDefaultMatrixPrefs(): RecentTransactionsMatrixPrefs {
  return {
    rowIds: ["region", "brand"],
    columnIds: ["month"],
    valueIds: ["liter"],
  };
}

/** Global chart UI preferences for the home dashboard (data labels, number style). */
export type ChartPrefs = {
  showDataLabels: boolean;
  numberStyle: ChartNumberStyle;
};

export type DashboardLayout = {
  order: DashboardWidgetId[];
  variants: Partial<Record<DashboardChartWidgetId, ChartVariant>>;
  measureByChart: Partial<Record<DashboardChartWidgetId, ChartMeasure>>;
  /** Optional; omitted = defaults (labels on, compact numbers). */
  chartPrefs?: ChartPrefs;
  /** Optional; omitted = defaults (all columns visible, catalog order). */
  recentTransactions?: RecentTransactionsLayoutPrefs;
};

export function reconcileTablePartitionWithMatrix(
  columnOrder: RecentTransactionsColumnId[],
  hiddenColumnIds: RecentTransactionsColumnId[],
  matrix: RecentTransactionsMatrixPrefs,
): { columnOrder: RecentTransactionsColumnId[]; hiddenColumnIds: RecentTransactionsColumnId[] } {
  const assigned = new Set<RecentTransactionsColumnId>([
    ...matrix.rowIds,
    ...matrix.columnIds,
    ...matrix.valueIds,
  ]);
  const unassigned = RECENT_TRANSACTIONS_COLUMN_IDS.filter((id) => !assigned.has(id));
  let order = columnOrder.filter((id) => unassigned.includes(id));
  let hidden = hiddenColumnIds.filter((id) => unassigned.includes(id));
  const used = new Set<RecentTransactionsColumnId>([...order, ...hidden]);
  for (const id of unassigned) {
    if (!used.has(id)) hidden.push(id);
    used.add(id);
  }
  hidden = hidden.filter((id) => !order.includes(id));
  if (order.length < 1 && unassigned.length > 0) {
    order = [unassigned[0]];
    hidden = unassigned.filter((id) => id !== unassigned[0]);
  }
  return { columnOrder: order, hiddenColumnIds: hidden };
}

export function getDefaultRecentTransactionsLayoutPrefs(): RecentTransactionsLayoutPrefs {
  return getDefaultDashboardLayout().recentTransactions!;
}

export function getDefaultDashboardLayout(): DashboardLayout {
  const matrix = getDefaultMatrixPrefs();
  const { columnOrder, hiddenColumnIds } = reconcileTablePartitionWithMatrix([], [], matrix);
  return {
    order: [...DASHBOARD_WIDGET_IDS],
    variants: {
      "chart-revenue-by-region": "bar",
      "chart-sales-by-category": "pie",
      "chart-daily-trend": "area",
    },
    measureByChart: {},
    chartPrefs: {
      showDataLabels: true,
      numberStyle: "compact",
    },
    recentTransactions: {
      columnOrder,
      hiddenColumnIds,
      viewMode: "table",
      matrix,
    },
  };
}

function isChartVariant(v: unknown): v is ChartVariant {
  return (
    v === "bar" ||
    v === "horizontal-bar" ||
    v === "pie" ||
    v === "area" ||
    v === "line"
  );
}

function isChartMeasure(v: unknown): v is ChartMeasure {
  return v === "money" || v === "liters";
}

function isChartNumberStyle(v: unknown): v is ChartNumberStyle {
  return v === "compact" || v === "full";
}

function getChartPrefsValidationError(o: unknown): string | null {
  if (o === undefined || o === null) return null;
  if (typeof o !== "object") return "chartPrefs must be an object";
  const x = o as Record<string, unknown>;
  if (x.showDataLabels !== undefined && typeof x.showDataLabels !== "boolean") {
    return "chartPrefs.showDataLabels must be a boolean";
  }
  if (x.numberStyle !== undefined && !isChartNumberStyle(x.numberStyle)) {
    return "chartPrefs.numberStyle must be compact or full";
  }
  return null;
}

const RT_CATALOG_LEN = RECENT_TRANSACTIONS_COLUMN_IDS.length;

function getMatrixPrefsValidationError(m: unknown): string | null {
  if (m === undefined || m === null) return null;
  if (typeof m !== "object") return "recentTransactions.matrix must be an object";
  const x = m as Record<string, unknown>;
  if (!Array.isArray(x.rowIds)) return "recentTransactions.matrix.rowIds must be an array";
  if (!Array.isArray(x.columnIds)) return "recentTransactions.matrix.columnIds must be an array";
  if (!Array.isArray(x.valueIds)) return "recentTransactions.matrix.valueIds must be an array";
  const rowIds = x.rowIds.filter((id): id is RecentTransactionsColumnId => typeof id === "string" && isRecentTransactionsColumnId(id));
  const columnIds = x.columnIds.filter((id): id is RecentTransactionsColumnId => typeof id === "string" && isRecentTransactionsColumnId(id));
  const valueIds = x.valueIds.filter((id): id is RecentTransactionsColumnId => typeof id === "string" && isRecentTransactionsColumnId(id));
  if (rowIds.length !== x.rowIds.length) return "recentTransactions.matrix.rowIds has invalid id";
  if (columnIds.length !== x.columnIds.length) return "recentTransactions.matrix.columnIds has invalid id";
  if (valueIds.length !== x.valueIds.length) return "recentTransactions.matrix.valueIds has invalid id";
  if (new Set(rowIds).size !== rowIds.length) return "recentTransactions.matrix.rowIds must not duplicate";
  if (new Set(columnIds).size !== columnIds.length) return "recentTransactions.matrix.columnIds must not duplicate";
  if (new Set(valueIds).size !== valueIds.length) return "recentTransactions.matrix.valueIds must not duplicate";
  for (const id of rowIds) {
    if (isRecentTxMeasureColumnId(id)) return "recentTransactions.matrix: row fields must be dimensions";
  }
  for (const id of columnIds) {
    if (isRecentTxMeasureColumnId(id)) return "recentTransactions.matrix: column fields must be dimensions";
  }
  for (const id of valueIds) {
    if (!isRecentTxMeasureColumnId(id)) return "recentTransactions.matrix: value fields must be measures";
  }
  const all = new Set<RecentTransactionsColumnId>();
  for (const id of rowIds) {
    if (all.has(id)) return "recentTransactions.matrix: a field cannot appear in multiple areas";
    all.add(id);
  }
  for (const id of columnIds) {
    if (all.has(id)) return "recentTransactions.matrix: a field cannot appear in multiple areas";
    all.add(id);
  }
  for (const id of valueIds) {
    if (all.has(id)) return "recentTransactions.matrix: a field cannot appear in multiple areas";
    all.add(id);
  }
  if (valueIds.length < 1) return "recentTransactions.matrix: at least one value measure required";
  return null;
}

function getRecentTransactionsPrefsValidationError(o: unknown): string | null {
  if (o === undefined) return null;
  if (o === null || typeof o !== "object") return "recentTransactions must be an object";
  const x = o as Record<string, unknown>;
  if (!Array.isArray(x.columnOrder)) return "recentTransactions.columnOrder must be an array";
  if (!Array.isArray(x.hiddenColumnIds)) return "recentTransactions.hiddenColumnIds must be an array";
  const order = x.columnOrder as unknown[];
  const hidden = x.hiddenColumnIds as unknown[];
  const orderIds = order.filter((id): id is RecentTransactionsColumnId => typeof id === "string" && isRecentTransactionsColumnId(id));
  const hiddenIds = hidden.filter((id): id is RecentTransactionsColumnId => typeof id === "string" && isRecentTransactionsColumnId(id));
  if (orderIds.length !== order.length) return "recentTransactions.columnOrder has invalid id";
  if (hiddenIds.length !== hidden.length) return "recentTransactions.hiddenColumnIds has invalid id";
  if (new Set(orderIds).size !== orderIds.length) return "recentTransactions.columnOrder must not duplicate ids";
  if (new Set(hiddenIds).size !== hiddenIds.length) return "recentTransactions.hiddenColumnIds must not duplicate ids";
  const orderSet = new Set(orderIds);
  const hiddenSet = new Set(hiddenIds);
  for (const h of hiddenIds) {
    if (orderSet.has(h)) return "recentTransactions: column cannot be both ordered and hidden";
  }

  if (x.viewMode !== undefined) {
    if (x.viewMode !== "table" && x.viewMode !== "matrix") return "recentTransactions.viewMode must be table or matrix";
  }
  const vm = x.viewMode === "matrix" ? "matrix" : "table";
  if (vm === "matrix") {
    if (x.matrix === undefined || x.matrix === null) return "recentTransactions.matrix is required in matrix view";
  }

  if (x.matrix !== undefined && x.matrix !== null) {
    const mErr = getMatrixPrefsValidationError(x.matrix);
    if (mErr) return mErr;
  }

  const matrixAssigned = new Set<RecentTransactionsColumnId>();
  if (x.matrix && typeof x.matrix === "object") {
    const mx = x.matrix as Record<string, unknown>;
    const take = (a: unknown) =>
      Array.isArray(a)
        ? a.filter((id): id is RecentTransactionsColumnId => typeof id === "string" && isRecentTransactionsColumnId(id))
        : [];
    for (const id of [...take(mx.rowIds), ...take(mx.columnIds), ...take(mx.valueIds)]) {
      matrixAssigned.add(id);
    }
  }

  if (orderIds.length + hiddenIds.length + matrixAssigned.size !== RT_CATALOG_LEN) {
    return "recentTransactions: visible columns, hidden columns, and matrix fields must partition the catalog";
  }
  for (const id of orderIds) {
    if (matrixAssigned.has(id)) return "recentTransactions: field in both table and matrix";
  }
  for (const id of hiddenIds) {
    if (matrixAssigned.has(id)) return "recentTransactions: field in both table and matrix";
  }
  for (const id of RECENT_TRANSACTIONS_COLUMN_IDS) {
    const inTable = orderSet.has(id) || hiddenSet.has(id);
    const inMatrix = matrixAssigned.has(id);
    if (inTable && inMatrix) return "recentTransactions: field in both table and matrix";
    if (!inTable && !inMatrix) return "recentTransactions: field missing from table and matrix";
  }
  if (orderIds.length < 1) return "recentTransactions: at least one visible column required";

  return null;
}

export function getDashboardLayoutValidationError(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return "Layout must be a JSON object";
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.order)) return "order must be an array";
  const order = o.order as unknown[];
  if (order.length !== DASHBOARD_WIDGET_IDS.length) {
    return `order must have length ${DASHBOARD_WIDGET_IDS.length}`;
  }
  const seen = new Set<string>();
  for (const id of order) {
    if (typeof id !== "string" || !WIDGET_SET.has(id) || seen.has(id)) {
      return "order must be a permutation of the known dashboard widget ids";
    }
    seen.add(id);
  }

  if (typeof o.variants !== "object" || o.variants === null) return "variants must be an object";
  const variants = o.variants as Record<string, unknown>;
  for (const key of Object.keys(variants)) {
    if (!CHART_SET.has(key)) return `variants: unknown chart id ${key}`;
    const val = variants[key];
    if (!isChartVariant(val)) return `variants.${key} must be a valid chart variant`;
    if (!allowedVariantsForChart(key as DashboardChartWidgetId).has(val)) {
      return `variants.${key} is not allowed for this chart`;
    }
  }

  if (typeof o.measureByChart !== "object" || o.measureByChart === null) {
    return "measureByChart must be an object";
  }
  const measureByChart = o.measureByChart as Record<string, unknown>;
  for (const key of Object.keys(measureByChart)) {
    if (!CHART_SET.has(key)) return `measureByChart: unknown chart id ${key}`;
    const val = measureByChart[key];
    if (!isChartMeasure(val)) return `measureByChart.${key} must be money or liters`;
  }

  const cpErr = getChartPrefsValidationError(o.chartPrefs);
  if (cpErr) return cpErr;

  const rtErr = getRecentTransactionsPrefsValidationError(o.recentTransactions);
  if (rtErr) return rtErr;

  return null;
}

export function validateDashboardLayout(raw: unknown): raw is DashboardLayout {
  return getDashboardLayoutValidationError(raw) === null;
}

/** Group consecutive KPIs into a band; pair region+category charts when adjacent for a two-column row. */
export type DashboardSegment =
  | { type: "kpi-run"; ids: DashboardWidgetId[] }
  | { type: "chart-pair"; ids: [DashboardWidgetId, DashboardWidgetId] }
  | { type: "single"; id: DashboardWidgetId };

export function buildDashboardSegments(order: DashboardWidgetId[]): DashboardSegment[] {
  const segments: DashboardSegment[] = [];
  let i = 0;
  while (i < order.length) {
    const id = order[i];
    if (id.startsWith("kpi-")) {
      const run: DashboardWidgetId[] = [];
      while (i < order.length && order[i].startsWith("kpi-")) {
        run.push(order[i]);
        i++;
      }
      segments.push({ type: "kpi-run", ids: run });
      continue;
    }
    if (
      id === "chart-revenue-by-region" &&
      order[i + 1] === "chart-sales-by-category"
    ) {
      segments.push({
        type: "chart-pair",
        ids: ["chart-revenue-by-region", "chart-sales-by-category"],
      });
      i += 2;
      continue;
    }
    segments.push({ type: "single", id });
    i++;
  }
  return segments;
}

function sanitizeMatrixFromRemote(
  m: RecentTransactionsMatrixPrefs | undefined,
  fallback: RecentTransactionsMatrixPrefs,
): RecentTransactionsMatrixPrefs {
  if (!m) return { ...fallback };
  const catalog = new Set<string>(RECENT_TRANSACTIONS_COLUMN_IDS);
  const strip = (ids: RecentTransactionsColumnId[]) =>
    ids.filter((id) => catalog.has(id) && isRecentTransactionsColumnId(id));
  let rowIds = strip(m.rowIds).filter((id) => !isRecentTxMeasureColumnId(id));
  let columnIds = strip(m.columnIds).filter((id) => !isRecentTxMeasureColumnId(id));
  let valueIds = strip(m.valueIds).filter((id) => isRecentTxMeasureColumnId(id));
  const seen = new Set<RecentTransactionsColumnId>();
  rowIds = rowIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  columnIds = columnIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  valueIds = valueIds.filter((id) => {
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
  if (valueIds.length < 1) return { ...fallback };
  return { rowIds, columnIds, valueIds };
}

function mergeChartPrefs(remote: ChartPrefs | undefined, fallback: ChartPrefs): ChartPrefs {
  if (!remote || typeof remote !== "object") return { ...fallback };
  return {
    showDataLabels:
      typeof remote.showDataLabels === "boolean" ? remote.showDataLabels : fallback.showDataLabels,
    numberStyle: isChartNumberStyle(remote.numberStyle) ? remote.numberStyle : fallback.numberStyle,
  };
}

export function mergeRemoteDashboardLayout(remote: DashboardLayout | null): DashboardLayout {
  const d = getDefaultDashboardLayout();
  if (!remote || !validateDashboardLayout(remote)) return d;
  const fallbackMatrix = d.recentTransactions?.matrix ?? getDefaultMatrixPrefs();
  const rt = remote.recentTransactions;
  const m = sanitizeMatrixFromRemote(rt?.matrix, fallbackMatrix);
  const r = reconcileTablePartitionWithMatrix(rt?.columnOrder ?? [], rt?.hiddenColumnIds ?? [], m);
  const baseCp = d.chartPrefs!;
  return {
    order: [...remote.order],
    variants: { ...d.variants, ...remote.variants },
    measureByChart: { ...remote.measureByChart },
    chartPrefs: mergeChartPrefs(remote.chartPrefs, baseCp),
    recentTransactions: rt
      ? {
          columnOrder: r.columnOrder,
          hiddenColumnIds: r.hiddenColumnIds,
          viewMode: rt.viewMode ?? "table",
          matrix: m,
        }
      : d.recentTransactions,
  };
}
