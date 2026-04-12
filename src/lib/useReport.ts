"use client";

import { useState, useEffect } from "react";
import { buildFilterQueryString, type FilterParams } from "./filters";

export function useReport(reportName: string, filters?: FilterParams, ready = true) {
  const [data, setData] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const filterKey = filters ? buildFilterQueryString(filters) : "";

  useEffect(() => {
    if (!ready) return;

    async function fetchReport() {
      try {
        setLoading(true);
        setError(null);
        const qs = filters ? buildFilterQueryString(filters) : "";
        const res = await fetch(`/api/reports?name=${reportName}${qs}`, {
          credentials: "include",
        });
        if (!res.ok) throw new Error("Failed to load report");
        const json = await res.json();
        setData(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    }
    fetchReport();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportName, ready, filterKey]);

  return { data, loading, error };
}
