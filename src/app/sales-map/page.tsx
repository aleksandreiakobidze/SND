"use client";

import dynamic from "next/dynamic";
import { useFilterOptions } from "@/lib/useFilterOptions";
import { useSalesMapFilters } from "@/lib/useFilters";
import { buildFilterQueryString } from "@/lib/filters";
import { useLocale } from "@/lib/locale-context";
import { SalesMapFilterBar } from "@/components/sales-map/SalesMapFilterBar";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";

const SalesMapView = dynamic(
  () => import("@/components/sales-map/SalesMapView").then((m) => ({ default: m.SalesMapView })),
  {
    ssr: false,
    loading: () => <Skeleton className="min-h-[320px] w-full rounded-2xl" />,
  },
);

export default function SalesMapPage() {
  const { t } = useLocale();
  const filterOptions = useFilterOptions();
  const { filters, ready, handleFiltersChange } = useSalesMapFilters();

  const filterKey = buildFilterQueryString(filters);

  return (
    <div className="relative min-h-full">
      <PageGradientBackdrop />
      <div className="relative mx-auto max-w-[1600px] space-y-4 px-6 pb-6 pt-6">
        <div className="space-y-3 pt-4">
          <PageHeader title={t("salesMap")} description={t("salesMapPageDesc")} />
          <SalesMapFilterBar
            filters={filters}
            onFiltersChange={handleFiltersChange}
            options={filterOptions}
          />
        </div>

        <SalesMapView filtersKey={filterKey} filtersReady={ready} />
      </div>
    </div>
  );
}
