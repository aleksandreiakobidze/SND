"use client";

import { useState, useEffect, useCallback } from "react";
import { todayStr, type FilterParams, type FilterField } from "./filters";

export interface CrossFilter {
  field: FilterField;
  value: string;
}

export function useFilters() {
  const [filters, setFilters] = useState<FilterParams>({});
  const [ready, setReady] = useState(false);
  const [crossFilters, setCrossFilters] = useState<CrossFilter[]>([]);

  useEffect(() => {
    const today = todayStr();
    setFilters({ dateFrom: today, dateTo: today });
    setReady(true);
  }, []);

  const handleFiltersChange = useCallback((f: FilterParams) => {
    setFilters(f);
    setCrossFilters([]);
  }, []);

  const toggleCrossFilter = useCallback((field: FilterField, value: string) => {
    setCrossFilters((prev) => {
      const existing = prev.find((cf) => cf.field === field);
      if (existing && existing.value === value) {
        const next = prev.filter((cf) => cf.field !== field);
        setFilters((f) => ({ ...f, [field]: undefined }));
        return next;
      }
      const next = [...prev.filter((cf) => cf.field !== field), { field, value }];
      setFilters((f) => ({ ...f, [field]: [value] }));
      return next;
    });
  }, []);

  const removeCrossFilter = useCallback((field: FilterField) => {
    setCrossFilters((prev) => prev.filter((cf) => cf.field !== field));
    setFilters((f) => ({ ...f, [field]: undefined }));
  }, []);

  const clearAllCrossFilters = useCallback(() => {
    setCrossFilters((prev) => {
      if (prev.length === 0) return prev;
      setFilters((f) => {
        const next = { ...f };
        for (const cf of prev) {
          (next as Record<string, unknown>)[cf.field] = undefined;
        }
        return next;
      });
      return [];
    });
  }, []);

  const getCrossFilterValue = useCallback(
    (field: FilterField): string | undefined => {
      return crossFilters.find((cf) => cf.field === field)?.value;
    },
    [crossFilters]
  );

  return {
    filters,
    ready,
    crossFilters,
    handleFiltersChange,
    toggleCrossFilter,
    removeCrossFilter,
    clearAllCrossFilters,
    getCrossFilterValue,
  };
}
