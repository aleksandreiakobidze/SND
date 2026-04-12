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
  timestamp: Date;
  loading?: boolean;
}

export interface ChartConfig {
  type: "bar" | "line" | "pie" | "area" | "table" | "number";
  xKey?: string;
  yKeys?: string[];
  title?: string;
  colors?: string[];
}

export interface AgentResponse {
  sql: string;
  data: Record<string, unknown>[];
  chartConfig: ChartConfig | null;
  narrative: string;
  suggestedQuestions?: string[];
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
