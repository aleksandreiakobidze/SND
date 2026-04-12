"use client";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
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

export function CategoryPieChart({ data }: Props) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={3}
          dataKey="value"
          nameKey="name"
          label={({ name, percent }) =>
            `${name} ${((percent || 0) * 100).toFixed(0)}%`
          }
          labelLine={false}
        >
          {data.map((row, index) => (
            <Cell key={index} fill={colorForObjectTypeLabel(String(row.name))} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--card))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: 12,
          }}
          formatter={(value) => [formatCurrency(Number(value)), "Revenue"]}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 11 }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
