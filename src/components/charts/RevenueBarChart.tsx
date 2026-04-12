"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { ChartDataPoint } from "@/types";
import { colorForObjectTypeLabel } from "@/lib/map-object-type-colors";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `₾${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `₾${(value / 1_000).toFixed(1)}K`;
  return `₾${value.toFixed(0)}`;
}

interface Props {
  data: ChartDataPoint[];
}

export function RevenueBarChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11 }}
          tickLine={false}
          axisLine={false}
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
          formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={50}>
          {data.map((row, index) => (
            <Cell key={index} fill={colorForObjectTypeLabel(String(row.name))} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
