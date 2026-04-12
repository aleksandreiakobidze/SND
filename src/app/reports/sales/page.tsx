"use client";

import { useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { useReport } from "@/lib/useReport";
import { useFilterOptions } from "@/lib/useFilterOptions";
import { useFilters } from "@/lib/useFilters";
import { ChartWrapper, type ChartMeasure } from "@/components/charts/ChartWrapper";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatLiters } from "@/lib/formatLiters";
import { FlexChart, type ChartVariant } from "@/components/charts/FlexChart";
import { DataTable } from "@/components/data-table/DataTable";
import { FilterBar } from "@/components/filters/FilterBar";
import { StickyFilterBlock } from "@/components/filters/StickyFilterBlock";
import { CrossFilterChips } from "@/components/filters/CrossFilterChips";
import { PageGradientBackdrop, stickyFilterGlassClass } from "@/components/layout/PageGradientBackdrop";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function SalesReportPage() {
  const { t } = useLocale();
  const filterOptions = useFilterOptions();
  const {
    filters, ready, crossFilters,
    handleFiltersChange, toggleCrossFilter, removeCrossFilter, clearAllCrossFilters,
    getCrossFilterValue,
  } = useFilters();
  const { data, loading, error } = useReport("salesByRegionDetailed", filters, ready);
  const [chartVariant, setChartVariant] = useState<ChartVariant>("bar");
  const [chartMeasure, setChartMeasure] = useState<ChartMeasure>("money");

  const regionAgg = data.reduce<Record<string, number>>((acc, row) => {
    const reg = String(row.Region || "");
    const add =
      chartMeasure === "money" ? Number(row.Revenue || 0) : Number(row.Liters || 0);
    acc[reg] = (acc[reg] || 0) + add;
    return acc;
  }, {});

  const regionChartData = Object.entries(regionAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (error) {
    return (
      <div className="p-6 text-center text-destructive">
        {t("error")}: {error}
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <PageGradientBackdrop />
      <div className="relative mx-auto max-w-[1600px] px-6 pb-8">
      <StickyFilterBlock className={cn(stickyFilterGlassClass, "pt-6")}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("salesByRegion")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("salesPageDesc")}
          </p>
        </div>

        <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
        <CrossFilterChips crossFilters={crossFilters} onRemove={removeCrossFilter} onClearAll={clearAllCrossFilters} />
      </StickyFilterBlock>

      <div className="space-y-6 pt-6">
      <ChartWrapper
        title={t("revenueByRegion")}
        loading={loading}
        chartMeasure={chartMeasure}
        onChartMeasureChange={setChartMeasure}
        chartMeasureTitle={t("chartMeasureTitle")}
        chartMeasureMoneyLabel={t("chartMeasureMoney")}
        chartMeasureLitersLabel={t("chartMeasureLiters")}
        variants={["bar", "pie", "horizontal-bar"]}
        activeVariant={chartVariant}
        onVariantChange={setChartVariant}
      >
        <FlexChart
          data={regionChartData}
          variant={chartVariant}
          formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
          tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
          height={350}
          onElementClick={(name) => toggleCrossFilter("region", name)}
          highlightValue={getCrossFilterValue("region")}
        />
      </ChartWrapper>

      <div>
        <h2 className="text-lg font-semibold mb-3">{t("detailedBreakdown")}</h2>
        {loading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : (
          <DataTable data={data} title="sales_by_region" pageSize={15} />
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
