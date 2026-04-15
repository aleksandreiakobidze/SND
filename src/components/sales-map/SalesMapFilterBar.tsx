"use client";

import { useCallback, useEffect, useState } from "react";
import { Calendar, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/locale-context";
import { localDateStr, todayStr, type FilterParams } from "@/lib/filters";
import { MultiSelect } from "@/components/filters/MultiSelect";
import { cn } from "@/lib/utils";
import type { FilterOptions } from "@/lib/useFilterOptions";

interface Props {
  filters: FilterParams;
  onFiltersChange: (filters: FilterParams) => void;
  options: FilterOptions;
}

function addDays(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return localDateStr(d);
}

const QUICK_DATES = [
  { key: "today", offset: 0 },
  { key: "tomorrow", offset: 1 },
  { key: "dayAfter", offset: 2 },
] as const;

export function SalesMapFilterBar({ filters, onFiltersChange, options }: Props) {
  const { t } = useLocale();
  const today = todayStr();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const activeQuick = QUICK_DATES.find(
    (q) => {
      const d = addDays(q.offset);
      return filters.dateFrom === d && filters.dateTo === d;
    },
  )?.key ?? "";

  const setDate = useCallback(
    (dateStr: string) => {
      const safe = dateStr < today ? today : dateStr;
      onFiltersChange({ ...filters, dateFrom: safe, dateTo: safe });
    },
    [filters, onFiltersChange, today],
  );

  const handleReset = useCallback(() => {
    onFiltersChange({
      dateFrom: today,
      dateTo: today,
    });
  }, [onFiltersChange, today]);

  const setField = useCallback(
    (field: keyof FilterParams, values: string[]) => {
      onFiltersChange({ ...filters, [field]: values.length > 0 ? values : undefined });
    },
    [filters, onFiltersChange],
  );

  if (!mounted) return <div className="h-[60px]" />;

  return (
    <div className="space-y-2.5 rounded-2xl border border-border/40 bg-background/60 backdrop-blur-xl p-3 shadow-sm dark:bg-background/40">
      <div className="flex flex-wrap items-center gap-2">
        <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />

        <div className="flex rounded-full border border-border/50 bg-muted/30 p-0.5 gap-0.5">
          {QUICK_DATES.map(({ key, offset }) => (
            <button
              key={key}
              type="button"
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium transition-all",
                activeQuick === key
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
              )}
              onClick={() => setDate(addDays(offset))}
            >
              {t(key as "today" | "tomorrow" | "dayAfter")}
            </button>
          ))}
        </div>

        <Input
          type="date"
          value={filters.dateFrom || today}
          min={today}
          onChange={(e) => setDate(e.target.value)}
          className="h-7 w-[130px] rounded-full text-xs border-border/50"
        />

        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          className="h-7 rounded-full text-xs gap-1 text-muted-foreground"
          onClick={handleReset}
        >
          <RotateCcw className="h-3 w-3" />
          {t("reset")}
        </Button>
      </div>

      {/* Dimension filters */}
      <div className="flex flex-wrap items-center gap-2">
        {(options.regions?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.regions}
            selected={filters.region || []}
            onChange={(v) => setField("region", v)}
            placeholder={t("allRegions")}
          />
        )}
        {(options.managers?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.managers}
            selected={filters.manager || []}
            onChange={(v) => setField("manager", v)}
            placeholder={t("allManagers")}
          />
        )}
        {(options.customerCategories?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.customerCategories}
            selected={filters.customerCategory || []}
            onChange={(v) => setField("customerCategory", v)}
            placeholder={t("allCustomerCategories")}
          />
        )}
        {(options.salesCategories?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.salesCategories}
            selected={filters.salesCategory || []}
            onChange={(v) => setField("salesCategory", v)}
            placeholder={t("allSalesCategories")}
          />
        )}
      </div>
    </div>
  );
}
