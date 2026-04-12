"use client";

import { useState, useEffect } from "react";

export interface FilterOption {
  value: string;
  label: string;
}

export interface FilterOptions {
  regions: FilterOption[];
  categories: FilterOption[];
  salesCategories: FilterOption[];
  managers: FilterOption[];
  networks: FilterOption[];
  brands: FilterOption[];
  customerCategories: FilterOption[];
  products: FilterOption[];
}

const EMPTY: FilterOptions = {
  regions: [],
  categories: [],
  salesCategories: [],
  managers: [],
  networks: [],
  brands: [],
  customerCategories: [],
  products: [],
};

let cachedOptions: FilterOptions | null = null;

export function useFilterOptions() {
  const [options, setOptions] = useState<FilterOptions>(cachedOptions || EMPTY);

  useEffect(() => {
    if (cachedOptions) return;

    fetch("/api/filter-options", { credentials: "include" })
      .then((res) => res.json())
      .then((data: FilterOptions) => {
        const merged: FilterOptions = {
          ...EMPTY,
          ...data,
          salesCategories: data.salesCategories ?? [],
        };
        cachedOptions = merged;
        setOptions(merged);
      })
      .catch(() => {});
  }, []);

  return options;
}
