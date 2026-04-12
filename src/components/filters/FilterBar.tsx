"use client";

import { useState, useEffect, useCallback } from "react";
import { Calendar, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/locale-context";
import { todayStr, yesterdayStr, type FilterParams } from "@/lib/filters";
import { MultiSelect } from "./MultiSelect";
import type { FilterOptions } from "@/lib/useFilterOptions";

interface FilterBarProps {
  filters: FilterParams;
  onFiltersChange: (filters: FilterParams) => void;
  options: FilterOptions;
}

const QUICK_RANGES = ["today", "yesterday", "thisWeek", "thisMonth", "allTime"] as const;

function getQuickRange(key: string): { dateFrom: string; dateTo: string } {
  const today = todayStr();
  const d = new Date();
  switch (key) {
    case "today":
      return { dateFrom: today, dateTo: today };
    case "yesterday": {
      const y = yesterdayStr();
      return { dateFrom: y, dateTo: y };
    }
    case "thisWeek": {
      const day = d.getDay();
      const mondayOffset = day === 0 ? 6 : day - 1;
      const monday = new Date(d);
      monday.setDate(d.getDate() - mondayOffset);
      return { dateFrom: monday.toISOString().split("T")[0], dateTo: today };
    }
    case "thisMonth": {
      const first = new Date(d.getFullYear(), d.getMonth(), 1);
      return { dateFrom: first.toISOString().split("T")[0], dateTo: today };
    }
    case "allTime":
      return { dateFrom: "", dateTo: "" };
    default:
      return { dateFrom: today, dateTo: today };
  }
}

export function FilterBar({ filters, onFiltersChange, options }: FilterBarProps) {
  const { t } = useLocale();
  const [activeQuick, setActiveQuick] = useState<string>("today");
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!filters.dateFrom && !filters.dateTo) {
      setActiveQuick("allTime");
    } else if (filters.dateFrom === todayStr() && filters.dateTo === todayStr()) {
      setActiveQuick("today");
    } else if (filters.dateFrom === yesterdayStr() && filters.dateTo === yesterdayStr()) {
      setActiveQuick("yesterday");
    } else {
      setActiveQuick("");
    }
  }, [filters.dateFrom, filters.dateTo]);

  const handleQuickRange = useCallback(
    (key: string) => {
      const range = getQuickRange(key);
      setActiveQuick(key);
      onFiltersChange({ ...filters, ...range });
    },
    [filters, onFiltersChange]
  );

  const handleReset = useCallback(() => {
    const range = getQuickRange("today");
    setActiveQuick("today");
    onFiltersChange({ dateFrom: range.dateFrom, dateTo: range.dateTo });
  }, [onFiltersChange]);

  const setField = useCallback(
    (field: keyof FilterParams, values: string[]) => {
      onFiltersChange({
        ...filters,
        [field]: values.length > 0 ? values : undefined,
      });
    },
    [filters, onFiltersChange]
  );

  if (!mounted) {
    return <div className="h-[76px]" />;
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 mr-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          {QUICK_RANGES.map((key) => (
            <Button
              key={key}
              variant={activeQuick === key ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs px-2.5"
              onClick={() => handleQuickRange(key)}
            >
              {t(key)}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-1.5">
          <Input
            type="date"
            value={filters.dateFrom || ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, dateFrom: e.target.value })
            }
            className="h-9 w-[140px] text-xs"
          />
          <span className="text-muted-foreground text-xs">—</span>
          <Input
            type="date"
            value={filters.dateTo || ""}
            onChange={(e) =>
              onFiltersChange({ ...filters, dateTo: e.target.value })
            }
            className="h-9 w-[140px] text-xs"
          />
        </div>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs ml-auto"
          onClick={handleReset}
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          {t("reset")}
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {(options.regions?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.regions}
            selected={filters.region || []}
            onChange={(v) => setField("region", v)}
            placeholder={t("allRegions")}
          />
        )}
        {(options.categories?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.categories}
            selected={filters.category || []}
            onChange={(v) => setField("category", v)}
            placeholder={t("allCategories")}
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
        {(options.brands?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.brands}
            selected={filters.brand || []}
            onChange={(v) => setField("brand", v)}
            placeholder={t("allBrands")}
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
        {(options.products?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.products}
            selected={filters.product || []}
            onChange={(v) => setField("product", v)}
            placeholder={t("allProducts")}
            maxDisplay={1}
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
        {(options.networks?.length ?? 0) > 0 && (
          <MultiSelect
            options={options.networks}
            selected={filters.network || []}
            onChange={(v) => setField("network", v)}
            placeholder={t("allNetworks")}
          />
        )}
      </div>
    </div>
  );
}
