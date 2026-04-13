import type { ChartVariant } from "@/components/charts/FlexChart";
import type { ChartMeasure } from "@/components/charts/ChartWrapper";

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

export type DashboardLayout = {
  order: DashboardWidgetId[];
  variants: Partial<Record<DashboardChartWidgetId, ChartVariant>>;
  measureByChart: Partial<Record<DashboardChartWidgetId, ChartMeasure>>;
};

export function getDefaultDashboardLayout(): DashboardLayout {
  return {
    order: [...DASHBOARD_WIDGET_IDS],
    variants: {
      "chart-revenue-by-region": "bar",
      "chart-sales-by-category": "pie",
      "chart-daily-trend": "area",
    },
    measureByChart: {},
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

export function mergeRemoteDashboardLayout(remote: DashboardLayout | null): DashboardLayout {
  const d = getDefaultDashboardLayout();
  if (!remote || !validateDashboardLayout(remote)) return d;
  return {
    order: [...remote.order],
    variants: { ...d.variants, ...remote.variants },
    measureByChart: { ...remote.measureByChart },
  };
}
