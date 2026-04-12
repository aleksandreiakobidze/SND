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
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function ProductsReportPage() {
  const { t } = useLocale();
  const filterOptions = useFilterOptions();
  const {
    filters, ready, crossFilters,
    handleFiltersChange, toggleCrossFilter, removeCrossFilter, clearAllCrossFilters,
    getCrossFilterValue,
  } = useFilters();
  const { data, loading, error } = useReport("productPerformance", filters, ready);

  const [categoryVariant, setCategoryVariant] = useState<ChartVariant>("pie");
  const [brandsVariant, setBrandsVariant] = useState<ChartVariant>("horizontal-bar");
  const [chartMeasure, setChartMeasure] = useState<ChartMeasure>("money");

  const categoryAgg = data.reduce<Record<string, number>>((acc, row) => {
    const cat = String(row.Category || "");
    const add =
      chartMeasure === "money" ? Number(row.Revenue || 0) : Number(row.Liters || 0);
    acc[cat] = (acc[cat] || 0) + add;
    return acc;
  }, {});

  const pieData = Object.entries(categoryAgg)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  const top15Brands = [...data]
    .sort((a, b) => {
      const av = chartMeasure === "money" ? Number(a.Revenue || 0) : Number(a.Liters || 0);
      const bv = chartMeasure === "money" ? Number(b.Revenue || 0) : Number(b.Liters || 0);
      return bv - av;
    })
    .slice(0, 15)
    .map((r) => ({
      name: String(r.Brand || ""),
      value: chartMeasure === "money" ? Number(r.Revenue || 0) : Number(r.Liters || 0),
    }));

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
        <PageHeader title={t("products")} description={t("productsPageDesc")} />

        <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
        <CrossFilterChips crossFilters={crossFilters} onRemove={removeCrossFilter} onClearAll={clearAllCrossFilters} />
      </StickyFilterBlock>

      <div className="animate-fade-in space-y-8 pt-8">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartWrapper
          title={t("revenueByCategory")}
          loading={loading}
          chartMeasure={chartMeasure}
          onChartMeasureChange={setChartMeasure}
          chartMeasureTitle={t("chartMeasureTitle")}
          chartMeasureMoneyLabel={t("chartMeasureMoney")}
          chartMeasureLitersLabel={t("chartMeasureLiters")}
          variants={["pie", "bar", "horizontal-bar"]}
          activeVariant={categoryVariant}
          onVariantChange={setCategoryVariant}
        >
          <FlexChart
            data={pieData}
            variant={categoryVariant}
            formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
            tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
            onElementClick={(name) => toggleCrossFilter("category", name)}
            highlightValue={getCrossFilterValue("category")}
          />
        </ChartWrapper>

        <ChartWrapper
          title={t("top15Brands")}
          loading={loading}
          chartMeasure={chartMeasure}
          onChartMeasureChange={setChartMeasure}
          chartMeasureTitle={t("chartMeasureTitle")}
          chartMeasureMoneyLabel={t("chartMeasureMoney")}
          chartMeasureLitersLabel={t("chartMeasureLiters")}
          variants={["horizontal-bar", "bar", "pie"]}
          activeVariant={brandsVariant}
          onVariantChange={setBrandsVariant}
        >
          <FlexChart
            data={top15Brands}
            variant={brandsVariant}
            formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
            tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
            onElementClick={(name) => toggleCrossFilter("brand", name)}
            highlightValue={getCrossFilterValue("brand")}
          />
        </ChartWrapper>
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">{t("fullProductData")}</h2>
        {loading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : (
          <DataTable data={data} title="product_performance" pageSize={15} />
        )}
      </div>
      </div>
      </div>
    </div>
  );
}
