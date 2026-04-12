"use client";

import { useState } from "react";
import { DollarSign, ShoppingCart, TrendingUp, Users } from "lucide-react";
import { KPICard } from "@/components/dashboard/KPICard";
import { ChartWrapper } from "@/components/charts/ChartWrapper";
import { FlexChart, type ChartVariant } from "@/components/charts/FlexChart";
import { DataTable } from "@/components/data-table/DataTable";
import { FilterBar } from "@/components/filters/FilterBar";
import { StickyFilterBlock } from "@/components/filters/StickyFilterBlock";
import { CrossFilterChips } from "@/components/filters/CrossFilterChips";
import { useLocale } from "@/lib/locale-context";
import { useFilterOptions } from "@/lib/useFilterOptions";
import { useFilters } from "@/lib/useFilters";
import { useDashboardData } from "@/lib/useDashboardData";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatLiters } from "@/lib/formatLiters";
import type { ChartMeasure } from "@/components/charts/ChartWrapper";
import { PageGradientBackdrop, stickyFilterGlassClass } from "@/components/layout/PageGradientBackdrop";
import { cn } from "@/lib/utils";

export default function DashboardPage() {
  const { t } = useLocale();
  const filterOptions = useFilterOptions();
  const {
    filters,
    ready,
    crossFilters,
    handleFiltersChange,
    toggleCrossFilter,
    removeCrossFilter,
    clearAllCrossFilters,
    getCrossFilterValue,
  } = useFilters();
  const { data, loading, error, fetchDashboard } = useDashboardData(filters, ready);

  const [regionVariant, setRegionVariant] = useState<ChartVariant>("bar");
  const [categoryVariant, setCategoryVariant] = useState<ChartVariant>("pie");
  const [trendVariant, setTrendVariant] = useState<ChartVariant>("area");
  const [chartMeasure, setChartMeasure] = useState<ChartMeasure>("money");

  if (error) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="text-center space-y-3">
          <p className="text-destructive font-medium">{t("error")}</p>
          <p className="text-sm text-muted-foreground">{error}</p>
          <button onClick={fetchDashboard} className="text-sm text-primary underline">
            {t("retry")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <PageGradientBackdrop />
      <div className="relative mx-auto max-w-[1600px] px-6 pb-6">
        <StickyFilterBlock className={cn(stickyFilterGlassClass, "pt-6")}>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{t("dashboard")}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("dashboardDataCaption")}</p>
        </div>

        <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
        <CrossFilterChips crossFilters={crossFilters} onRemove={removeCrossFilter} onClearAll={clearAllCrossFilters} />
        </StickyFilterBlock>

        <div className="space-y-6 pt-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KPICard
            title={t("totalRevenue")}
            value={data ? formatCurrency(Number(data.kpis.totalRevenue)) : ""}
            icon={DollarSign}
            loading={loading}
          />
          <KPICard
            title={t("totalOrders")}
            value={data ? Number(data.kpis.totalOrders).toLocaleString() : ""}
            icon={ShoppingCart}
            loading={loading}
          />
          <KPICard
            title={t("avgOrderValue")}
            value={data ? formatCurrency(Number(data.kpis.avgOrderValue)) : ""}
            icon={TrendingUp}
            loading={loading}
          />
          <KPICard
            title={t("activeCustomers")}
            value={data ? Number(data.kpis.activeCustomers).toLocaleString() : ""}
            icon={Users}
            loading={loading}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ChartWrapper
            title={t("revenueByRegion")}
            loading={loading}
            chartMeasure={chartMeasure}
            onChartMeasureChange={setChartMeasure}
            chartMeasureTitle={t("chartMeasureTitle")}
            chartMeasureMoneyLabel={t("chartMeasureMoney")}
            chartMeasureLitersLabel={t("chartMeasureLiters")}
            variants={["bar", "pie", "horizontal-bar"]}
            activeVariant={regionVariant}
            onVariantChange={setRegionVariant}
          >
            {data && (
              <FlexChart
                data={chartMeasure === "money" ? data.revenueByRegion : data.litersByRegion}
                variant={regionVariant}
                formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
                tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
                onElementClick={(name) => toggleCrossFilter("region", name)}
                highlightValue={getCrossFilterValue("region")}
              />
            )}
          </ChartWrapper>

          <ChartWrapper
            title={t("salesByCategory")}
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
            {data && (
              <FlexChart
                data={chartMeasure === "money" ? data.salesByCategory : data.litersBySalesCategory}
                variant={categoryVariant}
                formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
                tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
                onElementClick={(name) => toggleCrossFilter("category", name)}
                highlightValue={getCrossFilterValue("category")}
              />
            )}
          </ChartWrapper>
        </div>

        <ChartWrapper
          title={t("dailyTrend")}
          loading={loading}
          chartMeasure={chartMeasure}
          onChartMeasureChange={setChartMeasure}
          chartMeasureTitle={t("chartMeasureTitle")}
          chartMeasureMoneyLabel={t("chartMeasureMoney")}
          chartMeasureLitersLabel={t("chartMeasureLiters")}
          variants={["area", "line", "bar"]}
          activeVariant={trendVariant}
          onVariantChange={setTrendVariant}
        >
          {data && (
            <FlexChart
              data={data.dailyTrend}
              variant={trendVariant}
              valueKeys={[
                chartMeasure === "money"
                  ? { key: "Revenue", label: t("revenue"), color: "hsl(220, 70%, 55%)" }
                  : { key: "Liters", label: t("liters"), color: "hsl(220, 70%, 55%)" },
              ]}
              formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
              colorful={false}
            />
          )}
        </ChartWrapper>

        <div>
          <h2 className="text-lg font-semibold mb-3">{t("recentTransactions")}</h2>
          {loading ? (
            <div className="h-64 bg-muted/30 rounded-lg animate-pulse" />
          ) : data ? (
            <DataTable data={data.recentTransactions} title="recent_transactions" pageSize={10} />
          ) : null}
        </div>
        </div>
      </div>
    </div>
  );
}
