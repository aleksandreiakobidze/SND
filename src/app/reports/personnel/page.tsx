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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PersonnelReportPage() {
  const { t } = useLocale();
  const filterOptions = useFilterOptions();
  const {
    filters, ready, crossFilters,
    handleFiltersChange, toggleCrossFilter, removeCrossFilter, clearAllCrossFilters,
    getCrossFilterValue,
  } = useFilters();
  const [tab, setTab] = useState("managers");

  const managers = useReport("managerPerformance", filters, ready);
  const salesmen = useReport("salesmanPerformance", filters, ready);
  const drivers = useReport("driverPerformance", filters, ready);

  const [mgrVariant, setMgrVariant] = useState<ChartVariant>("bar");
  const [salesVariant, setSalesVariant] = useState<ChartVariant>("horizontal-bar");
  const [drvVariant, setDrvVariant] = useState<ChartVariant>("horizontal-bar");
  const [chartMeasure, setChartMeasure] = useState<ChartMeasure>("money");

  const activeReport =
    tab === "managers" ? managers : tab === "salesmen" ? salesmen : drivers;
  const error = activeReport.error;

  const mgrChartData = managers.data.map((r) => ({
    name: String(r.Manager || ""),
    value:
      chartMeasure === "money" ? Number(r.Revenue || 0) : Number(r.Liters || 0),
  }));

  const salesmenChartData = salesmen.data.map((r) => ({
    name: String(r.Salesman || ""),
    value:
      chartMeasure === "money" ? Number(r.Revenue || 0) : Number(r.Liters || 0),
  }));

  const driverChartData = drivers.data.map((r) => ({
    name: String(r.Deliverer || ""),
    value:
      chartMeasure === "money" ? Number(r.Revenue || 0) : Number(r.Liters || 0),
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
        <PageHeader title={t("personnel")} description={t("personnelPageDescExtended")} />

        <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
        <CrossFilterChips crossFilters={crossFilters} onRemove={removeCrossFilter} onClearAll={clearAllCrossFilters} />
      </StickyFilterBlock>

      <div className="animate-fade-in space-y-8 pt-8">
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="h-auto min-h-11 w-full max-w-2xl flex-wrap gap-1 rounded-2xl border border-border/50 bg-muted/25 p-1 dark:bg-muted/15">
          <TabsTrigger value="managers">{t("managers")}</TabsTrigger>
          <TabsTrigger value="salesmen">{t("salesmen")}</TabsTrigger>
          <TabsTrigger value="drivers">{t("drivers")}</TabsTrigger>
        </TabsList>

        <TabsContent value="managers" className="space-y-4 mt-4">
          <ChartWrapper
            title={t("managerRevenueComparison")}
            loading={managers.loading}
            chartMeasure={chartMeasure}
            onChartMeasureChange={setChartMeasure}
            chartMeasureTitle={t("chartMeasureTitle")}
            chartMeasureMoneyLabel={t("chartMeasureMoney")}
            chartMeasureLitersLabel={t("chartMeasureLiters")}
            variants={["bar", "horizontal-bar", "pie"]}
            activeVariant={mgrVariant}
            onVariantChange={setMgrVariant}
          >
            <FlexChart
              data={mgrChartData}
              variant={mgrVariant}
              formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
              tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
              height={350}
              leftMargin={mgrVariant === "horizontal-bar" ? 100 : undefined}
              onElementClick={(name) => toggleCrossFilter("manager", name)}
              highlightValue={getCrossFilterValue("manager")}
            />
          </ChartWrapper>

          {managers.loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <DataTable data={managers.data} title="manager_performance" pageSize={10} />
          )}
        </TabsContent>

        <TabsContent value="salesmen" className="space-y-4 mt-4">
          <ChartWrapper
            title={t("salesmenRevenueComparison")}
            loading={salesmen.loading}
            chartMeasure={chartMeasure}
            onChartMeasureChange={setChartMeasure}
            chartMeasureTitle={t("chartMeasureTitle")}
            chartMeasureMoneyLabel={t("chartMeasureMoney")}
            chartMeasureLitersLabel={t("chartMeasureLiters")}
            variants={["horizontal-bar", "bar", "pie"]}
            activeVariant={salesVariant}
            onVariantChange={setSalesVariant}
          >
            <FlexChart
              data={salesmenChartData}
              variant={salesVariant}
              formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
              tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
              height={400}
              leftMargin={salesVariant === "horizontal-bar" ? 120 : undefined}
            />
          </ChartWrapper>

          {salesmen.loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <DataTable data={salesmen.data} title="salesman_performance" pageSize={15} />
          )}
        </TabsContent>

        <TabsContent value="drivers" className="space-y-4 mt-4">
          <ChartWrapper
            title={t("top30Deliverers")}
            loading={drivers.loading}
            chartMeasure={chartMeasure}
            onChartMeasureChange={setChartMeasure}
            chartMeasureTitle={t("chartMeasureTitle")}
            chartMeasureMoneyLabel={t("chartMeasureMoney")}
            chartMeasureLitersLabel={t("chartMeasureLiters")}
            variants={["horizontal-bar", "bar", "pie"]}
            activeVariant={drvVariant}
            onVariantChange={setDrvVariant}
          >
            <FlexChart
              data={driverChartData}
              variant={drvVariant}
              formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
              tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
              height={400}
              leftMargin={drvVariant === "horizontal-bar" ? 120 : undefined}
            />
          </ChartWrapper>

          {drivers.loading ? (
            <Skeleton className="h-64 w-full rounded-lg" />
          ) : (
            <DataTable data={drivers.data} title="driver_performance" pageSize={15} />
          )}
        </TabsContent>
      </Tabs>
      </div>
      </div>
    </div>
  );
}
