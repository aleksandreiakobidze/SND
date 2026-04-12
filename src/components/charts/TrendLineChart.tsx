"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { ChartDataPoint } from "@/types";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `₾${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₾${(value / 1_000).toFixed(1)}K`;
  return `₾${value.toFixed(0)}`;
}

interface Props {
  data: ChartDataPoint[];
}

export function TrendLineChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="hsl(220, 70%, 55%)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="hsl(220, 70%, 55%)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(val) => {
            if (!val) return "";
            const parts = val.split("-");
            return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : val;
          }}
        />
        <YAxis
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={formatCurrency}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value, name) => [
            formatCurrency(Number(value)),
            name === "Revenue" ? "Revenue" : String(name),
          ]}
        />
        <Area
          type="monotone"
          dataKey="Revenue"
          stroke="hsl(220, 70%, 55%)"
          strokeWidth={2}
          fill="url(#revenueGradient)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
