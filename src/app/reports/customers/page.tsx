"use client";

import dynamic from "next/dynamic";
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

const CustomerLocationsMap = dynamic(
  () =>
    import("@/components/maps/CustomerLocationsMap").then((m) => ({
      default: m.CustomerLocationsMap,
    })),
  {
    ssr: false,
    loading: () => (
      <Skeleton className="h-[min(420px,60vh)] min-h-[280px] w-full rounded-lg" />
    ),
  },
);

export default function CustomersReportPage() {
  const { t } = useLocale();
  const filterOptions = useFilterOptions();
  const {
    filters, ready, crossFilters,
    handleFiltersChange, toggleCrossFilter, removeCrossFilter, clearAllCrossFilters,
    getCrossFilterValue,
  } = useFilters();

  const topCustomers = useReport("topCustomers", filters, ready);
  const customerCategories = useReport("customerCategoryBreakdown", filters, ready);
  const customerLocations = useReport("customerLocations", filters, ready);

  const [custVariant, setCustVariant] = useState<ChartVariant>("horizontal-bar");
  const [catVariant, setCatVariant] = useState<ChartVariant>("pie");
  const [chartMeasure, setChartMeasure] = useState<ChartMeasure>("money");

  const error =
    topCustomers.error ||
    customerCategories.error ||
    customerLocations.error;

  const custChartData = topCustomers.data.slice(0, 15).map((r) => ({
    name: String(r.Customer || ""),
    value:
      chartMeasure === "money" ? Number(r.Revenue || 0) : Number(r.Liters || 0),
  }));

  const catChartData = customerCategories.data.map((r) => ({
    name: String(r.CustomerCategory || ""),
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
          <PageHeader title={t("customers")} description={t("customersPageDesc")} />

          <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
          <CrossFilterChips
            crossFilters={crossFilters}
            onRemove={removeCrossFilter}
            onClearAll={clearAllCrossFilters}
          />
        </StickyFilterBlock>

        <div className="animate-fade-in space-y-8 pt-8">
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <ChartWrapper
              title={t("topCustomersByRevenue")}
              loading={topCustomers.loading}
              className="lg:col-span-2"
              chartMeasure={chartMeasure}
              onChartMeasureChange={setChartMeasure}
              chartMeasureTitle={t("chartMeasureTitle")}
              chartMeasureMoneyLabel={t("chartMeasureMoney")}
              chartMeasureLitersLabel={t("chartMeasureLiters")}
              variants={["horizontal-bar", "bar", "pie"]}
              activeVariant={custVariant}
              onVariantChange={setCustVariant}
            >
              <FlexChart
                data={custChartData}
                variant={custVariant}
                formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
                tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
                height={350}
                leftMargin={custVariant === "horizontal-bar" ? 120 : undefined}
              />
            </ChartWrapper>

            <ChartWrapper
              title={t("customerCategoryBreakdown")}
              loading={customerCategories.loading}
              chartMeasure={chartMeasure}
              onChartMeasureChange={setChartMeasure}
              chartMeasureTitle={t("chartMeasureTitle")}
              chartMeasureMoneyLabel={t("chartMeasureMoney")}
              chartMeasureLitersLabel={t("chartMeasureLiters")}
              variants={["pie", "bar", "horizontal-bar"]}
              activeVariant={catVariant}
              onVariantChange={setCatVariant}
            >
              <FlexChart
                data={catChartData}
                variant={catVariant}
                formatter={chartMeasure === "money" ? formatCurrency : formatLiters}
                tooltipLabel={chartMeasure === "money" ? t("revenue") : t("liters")}
                height={350}
                onElementClick={(name) => toggleCrossFilter("customerCategory", name)}
                highlightValue={getCrossFilterValue("customerCategory")}
              />
            </ChartWrapper>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-lg font-semibold">{t("customerLocationsMap")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{t("customerLocationsMapDesc")}</p>
            </div>
            {customerLocations.loading ? (
              <Skeleton className="h-[min(420px,60vh)] min-h-[280px] w-full rounded-lg" />
            ) : (
              <CustomerLocationsMap
                rows={customerLocations.data}
                formatCurrency={formatCurrency}
                emptyMessage={t("customerLocationsNoCoords")}
              />
            )}
            {!customerLocations.loading && customerLocations.data.length > 0 && (
              <DataTable data={customerLocations.data} title="customer_locations" pageSize={15} />
            )}
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">{t("top30Customers")}</h2>
            {topCustomers.loading ? (
              <Skeleton className="h-64 w-full rounded-lg" />
            ) : (
              <DataTable data={topCustomers.data} title="top_customers" pageSize={15} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
