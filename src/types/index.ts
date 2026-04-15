/** Align with `MetricIntentKind` in agent-metric-intent (avoid circular imports). */
export type AgentMetricIntentKind =
  | "volume_liters"
  | "quantity_units"
  | "revenue_gel"
  | "mixed"
  | "unspecified";

export interface KPIData {
  totalRevenue: number;
  totalOrders: number;
  avgOrderValue: number;
  activeCustomers: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
  [key: string]: string | number;
}

export interface AgentMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  sql?: string;
  data?: Record<string, unknown>[];
  chartConfig?: ChartConfig | null;
  narrative?: string;
  /** Preserved from agent API for re-export / email (same query semantics). */
  metricIntentKind?: AgentMetricIntentKind;
  timestamp: Date;
  loading?: boolean;
}

/** BI comparison mode metadata (agent + saved reports). */
export interface ChartComparisonMeta {
  enabled: true;
  /** Matrix / legend row dimension name (e.g. brand column). */
  rowDim: string;
  /** Matrix column dimension (e.g. month). */
  colDim: string;
  measure: string;
  topN: number;
  wasPivoted: boolean;
  /** Wide chart series keys in display order (excludes x-axis key). */
  seriesKeys: string[];
  /** Original tidy rows when pivot was applied; used for flat table view. */
  longData?: Record<string, unknown>[];
}

/** How to format chart/matrix numbers (from agent metric intent). */
export type ChartMeasureDisplay = "liters" | "money" | "quantity" | "mixed";

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "area" | "table" | "number";
  xKey?: string;
  yKeys?: string[];
  title?: string;
  colors?: string[];
  /** Set when the agent detects a comparison-style analytical request. */
  comparison?: ChartComparisonMeta;
  /** Agent pipeline: which measure the user asked for (drives formatters). */
  measureDisplay?: ChartMeasureDisplay;
}

export interface AgentResponse {
  sql: string;
  data: Record<string, unknown>[];
  chartConfig: ChartConfig | null;
  narrative: string;
  suggestedQuestions?: string[];
  /** Echo for client-side re-execution / email export. */
  metricIntentKind?: AgentMetricIntentKind;
}

export interface DashboardData {
  kpis: KPIData;
  revenueByRegion: ChartDataPoint[];
  salesByCategory: ChartDataPoint[];
  litersByRegion: ChartDataPoint[];
  litersBySalesCategory: ChartDataPoint[];
  dailyTrend: ChartDataPoint[];
  recentTransactions: Record<string, unknown>[];
}
