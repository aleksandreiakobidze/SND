"use client";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  Legend,
} from "recharts";
import type { ChartConfig } from "@/types";
import { firstNonTechnicalColumnKey, isTechnicalIdColumnKey, numericMeasureKeys } from "@/lib/technical-columns";
import { colorForObjectTypeLabel } from "@/lib/map-object-type-colors";

const COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(40, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(10, 70%, 55%)",
  "hsl(190, 65%, 50%)",
  "hsl(330, 60%, 55%)",
  "hsl(90, 55%, 50%)",
];

function formatValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

const tooltipStyle = {
  backgroundColor: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: 12,
};

interface Props {
  data: Record<string, unknown>[];
  config: ChartConfig;
}

export function DynamicChart({ data, config }: Props) {
  const xKey = config.xKey || (data[0] ? firstNonTechnicalColumnKey(data[0]) : "name");
  const yKeys = config.yKeys || (data[0] ? numericMeasureKeys(data[0], xKey) : []);

  if (config.type === "number") {
    const row = data[0];
    let value: unknown = 0;
    if (row) {
      const preferred = Object.entries(row).find(
        ([k, v]) => typeof v === "number" && !isTechnicalIdColumnKey(k),
      );
      value = preferred ? preferred[1] : Object.values(row).find((v) => typeof v === "number") ?? Object.values(row)[0];
    }
    return (
      <div className="flex items-center justify-center h-32">
        <p className="text-5xl font-bold">{formatValue(Number(value))}</p>
      </div>
    );
  }

  if (config.type === "pie") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <PieChart>
          <Pie
            data={data}
            dataKey={yKeys[0] || "value"}
            nameKey={xKey}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={100}
            paddingAngle={3}
            label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {data.map((row, i) => (
              <Cell key={i} fill={colorForObjectTypeLabel(String(row[xKey]))} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatValue(Number(v))]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === "line") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatValue} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatValue(Number(v))]} />
          <Legend iconType="circle" iconSize={8} />
          {yKeys.map((key, i) => (
            <Line key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} strokeWidth={2} dot={false} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    );
  }

  if (config.type === "area") {
    return (
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
          <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatValue} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatValue(Number(v))]} />
          {yKeys.map((key, i) => (
            <Area key={key} type="monotone" dataKey={key} stroke={COLORS[i % COLORS.length]} fill={COLORS[i % COLORS.length]} fillOpacity={0.15} strokeWidth={2} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis dataKey={xKey} tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} tickFormatter={formatValue} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v) => [formatValue(Number(v))]} />
        <Legend iconType="circle" iconSize={8} />
        {yKeys.map((key, i) => (
          <Bar key={key} dataKey={key} fill={COLORS[i % COLORS.length]} radius={[4, 4, 0, 0]} maxBarSize={50} />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
