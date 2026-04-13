"use client";

import type { CSSProperties } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  AreaChart,
  Area,
  LineChart,
  Line,
  LabelList,
} from "recharts";
import { colorForObjectTypeLabel } from "@/lib/map-object-type-colors";
import { defaultChartValueFormat } from "@/lib/chart-number-format";
import { BarDataLabel } from "@/components/charts/BarDataLabel";

export type ChartVariant = "bar" | "horizontal-bar" | "pie" | "area" | "line";

const COLORS = [
  "hsl(220, 70%, 55%)",
  "hsl(160, 60%, 45%)",
  "hsl(40, 80%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(10, 70%, 55%)",
  "hsl(190, 65%, 50%)",
  "hsl(330, 60%, 55%)",
  "hsl(90, 55%, 50%)",
  "hsl(260, 50%, 60%)",
  "hsl(50, 70%, 50%)",
  "hsl(140, 50%, 55%)",
  "hsl(0, 60%, 55%)",
];

/** Theme tokens are oklch — never wrap in hsl(); use var() for SVG/CSS. */
const tooltipStyle: CSSProperties = {
  backgroundColor: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: "8px",
  fontSize: 12,
  color: "var(--card-foreground)",
};

const axisTick10 = { fontSize: 10, fill: "var(--foreground)" as const };
const axisTick11 = { fontSize: 11, fill: "var(--foreground)" as const };

export interface FlexChartProps {
  data: Record<string, unknown>[];
  variant: ChartVariant;
  nameKey?: string;
  valueKey?: string;
  valueKeys?: { key: string; label: string; color?: string }[];
  height?: number;
  /** Axis ticks, bar labels, pie slice text (compact or full — parent decides). */
  formatter?: (v: number) => string;
  /** Tooltip always shows precise values when provided; defaults to `formatter`. */
  tooltipFormatter?: (v: number) => string;
  tooltipLabel?: string;
  colorful?: boolean;
  leftMargin?: number;
  onElementClick?: (name: string) => void;
  highlightValue?: string;
  /** Show numeric labels on bars; line/area ignore. Default true. */
  showDataLabels?: boolean;
}

function cellOpacity(
  itemName: unknown,
  highlightValue: string | undefined,
): number {
  if (!highlightValue) return 1;
  return String(itemName) === highlightValue ? 1 : 0.25;
}

export function FlexChart({
  data,
  variant,
  nameKey = "name",
  valueKey = "value",
  valueKeys,
  height = 320,
  formatter = defaultChartValueFormat,
  tooltipFormatter,
  tooltipLabel = "Value",
  colorful = true,
  leftMargin,
  onElementClick,
  highlightValue,
  showDataLabels = true,
}: FlexChartProps) {
  const series = valueKeys || [{ key: valueKey, label: tooltipLabel, color: COLORS[0] }];
  const tipFmt = tooltipFormatter ?? formatter;
  const interactive = !!onElementClick;
  const cursorStyle = interactive ? "pointer" : "default";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleClick = (entry: any) => {
    if (!onElementClick) return;
    const name = entry?.[nameKey] ?? entry?.name ?? entry?.payload?.[nameKey] ?? entry?.payload?.name;
    if (name != null) onElementClick(String(name));
  };

  if (variant === "pie") {
    const pieKey = series[0].key;
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey={pieKey}
            nameKey={nameKey}
            cx="50%"
            cy="50%"
            innerRadius={Math.max(40, height * 0.15)}
            outerRadius={Math.max(70, height * 0.28)}
            paddingAngle={3}
            label={({ name, percent, value }) => {
              const short =
                String(name).length > 10 ? String(name).slice(0, 10) + "…" : String(name);
              const val = formatter(Number(value));
              return `${short} ${val} (${((percent || 0) * 100).toFixed(0)}%)`;
            }}
            labelLine={false}
            onClick={handleClick}
            style={{ cursor: cursorStyle }}
          >
            {data.map((d, i) => (
              <Cell
                key={i}
                fill={colorForObjectTypeLabel(String(d[nameKey]))}
                opacity={cellOpacity(d[nameKey], highlightValue)}
                stroke={String(d[nameKey]) === highlightValue ? "var(--foreground)" : undefined}
                strokeWidth={String(d[nameKey]) === highlightValue ? 2 : 0}
              />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v) => [tipFmt(Number(v)), series[0].label]} />
          <Legend
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (variant === "area" || variant === "line") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        {variant === "area" ? (
          <AreaChart data={data} margin={{ top: 8, right: 20, left: leftMargin ?? 10, bottom: 8 }}>
            <defs>
              {series.map((s, i) => (
                <linearGradient key={s.key} id={`grad-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={s.color || COLORS[i]} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={s.color || COLORS[i]} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey={nameKey} tick={axisTick10} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick11} tickLine={false} axisLine={false} tickFormatter={formatter} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [tipFmt(Number(v)), String(name)]} />
            {series.length > 1 && (
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />
            )}
            {series.map((s, i) => (
              <Area
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color || COLORS[i]}
                strokeWidth={2}
                fill={`url(#grad-${s.key})`}
              />
            ))}
          </AreaChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 20, left: leftMargin ?? 10, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
            <XAxis dataKey={nameKey} tick={axisTick10} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick11} tickLine={false} axisLine={false} tickFormatter={formatter} />
            <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [tipFmt(Number(v)), String(name)]} />
            {series.length > 1 && (
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />
            )}
            {series.map((s, i) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                name={s.label}
                stroke={s.color || COLORS[i]}
                strokeWidth={2}
                dot={{ r: 3, fill: s.color || COLORS[i] }}
                activeDot={{ r: 5 }}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    );
  }

  const isHorizontal = variant === "horizontal-bar";
  const labelMarginTop = showDataLabels && !isHorizontal ? 26 : 8;
  const labelMarginRight = showDataLabels && isHorizontal ? 64 : 20;
  const showBarLabels = showDataLabels && series.length === 1;

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout={isHorizontal ? "vertical" : "horizontal"}
        margin={{
          top: labelMarginTop,
          right: labelMarginRight,
          left: isHorizontal ? (leftMargin ?? 80) : (leftMargin ?? 12),
          bottom: 8,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.3} />
        {isHorizontal ? (
          <>
            <XAxis
              type="number"
              tick={axisTick11}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatter}
            />
            <YAxis
              dataKey={nameKey}
              type="category"
              tick={axisTick10}
              tickLine={false}
              axisLine={false}
              width={leftMargin ? leftMargin - 5 : 75}
              tickFormatter={(v: string) => (v.length > 18 ? v.slice(0, 18) + "…" : v)}
            />
          </>
        ) : (
          <>
            <XAxis dataKey={nameKey} tick={axisTick11} tickLine={false} axisLine={false} />
            <YAxis tick={axisTick11} tickLine={false} axisLine={false} tickFormatter={formatter} />
          </>
        )}
        <Tooltip contentStyle={tooltipStyle} formatter={(v, name) => [tipFmt(Number(v)), String(name)]} />
        {series.length > 1 && (
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "var(--foreground)" }} />
        )}
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.label}
            fill={s.color || COLORS[i]}
            radius={isHorizontal ? [0, 4, 4, 0] : [6, 6, 0, 0]}
            maxBarSize={isHorizontal ? 22 : 50}
            onClick={handleClick}
            style={{ cursor: cursorStyle }}
          >
            {colorful && series.length === 1
              ? data.map((d, idx) => (
                  <Cell
                    key={idx}
                    fill={colorForObjectTypeLabel(String(d[nameKey]))}
                    opacity={cellOpacity(d[nameKey], highlightValue)}
                    stroke={String(d[nameKey]) === highlightValue ? "var(--foreground)" : undefined}
                    strokeWidth={String(d[nameKey]) === highlightValue ? 2 : 0}
                  />
                ))
              : data.map((d, idx) => (
                  <Cell
                    key={idx}
                    fill={s.color || COLORS[i]}
                    opacity={cellOpacity(d[nameKey], highlightValue)}
                    stroke={String(d[nameKey]) === highlightValue ? "var(--foreground)" : undefined}
                    strokeWidth={String(d[nameKey]) === highlightValue ? 2 : 0}
                  />
                ))}
            {showBarLabels ? (
              <LabelList
                dataKey={s.key}
                content={(props) => (
                  <BarDataLabel
                    x={props.x as number | undefined}
                    y={props.y as number | undefined}
                    width={props.width as number | undefined}
                    height={props.height as number | undefined}
                    value={props.value as number | undefined}
                    isHorizontalBar={isHorizontal}
                    formatLabel={formatter}
                  />
                )}
              />
            ) : null}
          </Bar>
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}
