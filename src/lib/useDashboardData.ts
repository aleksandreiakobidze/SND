"use client";

import { useState, useEffect, useCallback } from "react";
import { buildFilterQueryString, type FilterParams } from "@/lib/filters";
import type { DashboardData } from "@/types";

export function useDashboardData(filters: FilterParams, ready: boolean) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const qs = buildFilterQueryString(filters);
      const res = await fetch(`/api/dashboard?_=1${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        const detail =
          typeof json.details === "string"
            ? json.details
            : typeof json.error === "string"
              ? json.error
              : null;
        throw new Error(detail || `Failed to load dashboard (${res.status})`);
      }
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    if (ready) fetchDashboard();
  }, [ready, fetchDashboard]);

  return { data, loading, error, fetchDashboard };
}
