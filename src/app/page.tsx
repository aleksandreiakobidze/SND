"use client";

import { FilterBar } from "@/components/filters/FilterBar";
import { StickyFilterBlock } from "@/components/filters/StickyFilterBlock";
import { CrossFilterChips } from "@/components/filters/CrossFilterChips";
import { useLocale } from "@/lib/locale-context";
import { useFilterOptions } from "@/lib/useFilterOptions";
import { useFilters } from "@/lib/useFilters";
import { useDashboardData } from "@/lib/useDashboardData";
import { PageGradientBackdrop, stickyFilterGlassClass } from "@/components/layout/PageGradientBackdrop";
import { PageHeader } from "@/components/layout/PageHeader";
import { cn } from "@/lib/utils";
import { DashboardWidgets } from "@/components/dashboard/DashboardWidgets";

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

  if (error) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4">
        <div className="glass-panel max-w-md space-y-4 p-8 text-center">
          <p className="font-semibold text-destructive">{t("error")}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={fetchDashboard}
            className="text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
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
          <PageHeader title={t("dashboard")} description={t("dashboardDataCaption")} />

          <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
          <CrossFilterChips crossFilters={crossFilters} onRemove={removeCrossFilter} onClearAll={clearAllCrossFilters} />
        </StickyFilterBlock>

        <div className="animate-fade-in pt-8">
          <DashboardWidgets
            data={data}
            loading={loading}
            t={t}
            toggleCrossFilter={toggleCrossFilter}
            getCrossFilterValue={getCrossFilterValue}
          />
        </div>
      </div>
    </div>
  );
}
