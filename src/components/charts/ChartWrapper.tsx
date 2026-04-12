"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3, PieChart as PieIcon, TrendingUp, ArrowRightLeft, AreaChart as AreaIcon } from "lucide-react";
import type { ChartVariant } from "./FlexChart";

export type ChartMeasure = "money" | "liters";

const VARIANT_ICONS: Record<ChartVariant, typeof BarChart3> = {
  bar: BarChart3,
  "horizontal-bar": ArrowRightLeft,
  pie: PieIcon,
  area: AreaIcon,
  line: TrendingUp,
};

const VARIANT_LABELS: Record<ChartVariant, string> = {
  bar: "Bar",
  "horizontal-bar": "H-Bar",
  pie: "Pie",
  area: "Area",
  line: "Line",
};

interface ChartWrapperProps {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  className?: string;
  chartMeasure?: ChartMeasure;
  onChartMeasureChange?: (m: ChartMeasure) => void;
  chartMeasureMoneyLabel?: string;
  chartMeasureLitersLabel?: string;
  chartMeasureTitle?: string;
  variants?: ChartVariant[];
  activeVariant?: ChartVariant;
  onVariantChange?: (v: ChartVariant) => void;
}

export function ChartWrapper({
  title,
  children,
  loading,
  className,
  chartMeasure,
  onChartMeasureChange,
  chartMeasureMoneyLabel = "₾",
  chartMeasureLitersLabel = "L",
  chartMeasureTitle,
  variants,
  activeVariant,
  onVariantChange,
}: ChartWrapperProps) {
  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="border-b border-border/50 pb-4">
          <Skeleton className="h-5 w-48" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="border-b border-border/50 pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base font-semibold tracking-tight">{title}</CardTitle>
          <div className="flex items-center gap-1.5 flex-wrap justify-end">
            {onChartMeasureChange && chartMeasure !== undefined && (
              <div
                className="flex items-center gap-0.5 rounded-xl border border-border/70 bg-muted/40 p-0.5 shadow-inner dark:bg-muted/25"
                role="group"
                aria-label={chartMeasureTitle}
              >
                <button
                  type="button"
                  onClick={() => onChartMeasureChange("money")}
                  title={chartMeasureMoneyLabel}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                    chartMeasure === "money"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {chartMeasureMoneyLabel}
                </button>
                <button
                  type="button"
                  onClick={() => onChartMeasureChange("liters")}
                  title={chartMeasureLitersLabel}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold tabular-nums transition-colors ${
                    chartMeasure === "liters"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {chartMeasureLitersLabel}
                </button>
              </div>
            )}
            {variants && variants.length > 1 && onVariantChange && (
              <div className="flex items-center gap-0.5 rounded-xl border border-border/50 bg-muted/50 p-0.5 dark:bg-muted/30">
                {variants.map((v) => {
                  const Icon = VARIANT_ICONS[v];
                  const isActive = v === activeVariant;
                  return (
                    <button
                      key={v}
                      onClick={() => onVariantChange(v)}
                      title={VARIANT_LABELS[v]}
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition-all ${
                        isActive
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">{VARIANT_LABELS[v]}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-4">{children}</CardContent>
    </Card>
  );
}
