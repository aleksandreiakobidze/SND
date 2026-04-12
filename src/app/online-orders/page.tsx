"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale } from "@/lib/locale-context";
import { useFilterOptions } from "@/lib/useFilterOptions";
import { useFilters } from "@/lib/useFilters";
import { buildFilterQueryString } from "@/lib/filters";
import { FilterBar } from "@/components/filters/FilterBar";
import { StickyFilterBlock } from "@/components/filters/StickyFilterBlock";
import { CrossFilterChips } from "@/components/filters/CrossFilterChips";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Download, FileSpreadsheet, RefreshCw } from "lucide-react";
import { downloadCsvFromRows } from "@/lib/export-csv";
import { downloadExcelFromRows } from "@/lib/export-excel";
import { MinOrderRulesTable } from "@/components/online-orders/MinOrderRulesTable";
import { PageGradientBackdrop, stickyFilterGlassClass } from "@/components/layout/PageGradientBackdrop";
import { cn } from "@/lib/utils";

type OnlineOrderRow = {
  IdReal1: number;
  Data?: string | Date;
  Org?: string;
  Reg?: string;
  OrgT?: string;
  Gvari?: string;
  OrderTotal?: number;
  LineCount?: number;
};

function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "number") return value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return String(value);
}

export default function OnlineOrdersPage() {
  const { t } = useLocale();
  const filterOptions = useFilterOptions();
  const {
    filters,
    ready,
    crossFilters,
    handleFiltersChange,
    removeCrossFilter,
    clearAllCrossFilters,
  } = useFilters();

  const [rows, setRows] = useState<OnlineOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorSql, setErrorSql] = useState<string | null>(null);
  const [listWarning, setListWarning] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [transferring, setTransferring] = useState(false);
  const [transferMessage, setTransferMessage] = useState<string | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);

  const filterKey = buildFilterQueryString(filters);

  const load = useCallback(async () => {
    if (!ready) return;
    try {
      setLoading(true);
      setError(null);
      setErrorSql(null);
      const qs = buildFilterQueryString(filters);
      const res = await fetch(`/api/online-orders?${qs}`, { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        setListWarning(null);
        setErrorSql(typeof json.sql === "string" && json.sql.trim() ? json.sql : null);
        const detail =
          typeof json.details === "string" && json.details.trim()
            ? json.details
            : typeof json.error === "string"
              ? json.error
              : "Request failed";
        throw new Error(detail);
      }
      setRows((json.data as OnlineOrderRow[]) || []);
      setListWarning(typeof json.warning === "string" && json.warning.trim() ? json.warning : null);
      setSelected(new Set());
      setTransferMessage(null);
      setErrorSql(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters, ready, filterKey]);

  useEffect(() => {
    load();
  }, [load]);

  const allIds = useMemo(() => rows.map((r) => Number(r.IdReal1)).filter(Number.isFinite), [rows]);

  const orderTotals = useMemo(() => {
    if (rows.length === 0) return { orderTotal: 0, lineCount: 0 };
    let orderTotal = 0;
    let lineCount = 0;
    for (const r of rows) {
      const ot = r.OrderTotal;
      const lc = r.LineCount;
      if (typeof ot === "number" && Number.isFinite(ot)) orderTotal += ot;
      if (typeof lc === "number" && Number.isFinite(lc)) lineCount += lc;
    }
    return { orderTotal, lineCount };
  }, [rows]);

  const exportRows = useMemo((): Record<string, unknown>[] => {
    return rows.map((r) => {
      let dateVal: string | number = "";
      if (r.Data instanceof Date) dateVal = r.Data.toISOString().slice(0, 10);
      else if (r.Data != null) dateVal = String(r.Data);
      return {
        [t("date")]: dateVal,
        [t("customer")]: r.Org ?? "",
        [t("customerCategory")]: r.OrgT ?? "",
        [t("region")]: r.Reg ?? "",
        [t("salesman")]: r.Gvari ?? "",
        [t("amount")]: typeof r.OrderTotal === "number" && Number.isFinite(r.OrderTotal) ? r.OrderTotal : "",
        [t("lines")]: typeof r.LineCount === "number" && Number.isFinite(r.LineCount) ? r.LineCount : "",
      };
    });
  }, [rows, t]);

  const exportTotals = useMemo((): Record<string, number | null> | null => {
    if (rows.length === 0) return null;
    return {
      [t("date")]: null,
      [t("customer")]: null,
      [t("customerCategory")]: null,
      [t("region")]: null,
      [t("salesman")]: null,
      [t("amount")]: orderTotals.orderTotal,
      [t("lines")]: orderTotals.lineCount,
    };
  }, [rows.length, t, orderTotals]);

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      if (prev.size === allIds.length) return new Set();
      return new Set(allIds);
    });
  };

  const transfer = async () => {
    if (selected.size === 0) return;
    setTransferring(true);
    setTransferMessage(null);
    try {
      const res = await fetch("/api/online-orders/transfer", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idReal1List: [...selected] }),
      });
      const json = await res.json();

      if (res.status === 422 && json.errors) {
        const lines = (json.errors as { idReal1: number; message: string }[])
          .map((e) => `#${e.idReal1}: ${e.message}`)
          .join("\n");
        setTransferMessage(lines);
        return;
      }

      if (!res.ok) {
        setTransferMessage(json.details || json.error || "Transfer failed");
        return;
      }

      if (json.procedureErrors?.length) {
        const lines = (json.procedureErrors as { idReal1: number; message: string }[])
          .map((e) => `#${e.idReal1}: ${e.message}`)
          .join("\n");
        setTransferMessage(`${t("transferPartialFailure")}\n${lines}`);
      } else {
        setTransferMessage(t("transferSuccess"));
      }
      await load();
    } catch (e) {
      setTransferMessage(e instanceof Error ? e.message : "Transfer failed");
    } finally {
      setTransferring(false);
    }
  };

  if (error) {
    return (
      <div className="relative min-h-full">
        <PageGradientBackdrop />
        <div className="relative mx-auto max-w-[1600px] space-y-4 p-6">
        <div className="whitespace-pre-wrap break-words text-destructive">
          {t("error")}: {error}
        </div>
        {errorSql && (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Generated SQL (shown in development or when MSSQL_ONLINE_DEBUG_SQL=1):
            </p>
            <pre className="text-xs overflow-auto max-h-[min(24rem,50vh)] p-4 rounded-lg border border-border bg-muted/50 text-left font-mono whitespace-pre-wrap break-all">
              {errorSql}
            </pre>
          </div>
        )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-full">
      <PageGradientBackdrop />
      <div className="relative mx-auto max-w-[1600px] space-y-6 px-6 pb-8 pt-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{t("onlineOrders")}</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-3xl">{t("onlineOrdersPageDesc")}</p>
        <div className="mt-2 max-w-3xl border-l-2 border-primary/40 pl-3 space-y-3">
          <p className="text-sm font-medium text-foreground">{t("minOrderAmountRestriction")}</p>
          <MinOrderRulesTable />
          <p className="text-muted-foreground text-sm">{t("minOrderRulesHint")}</p>
        </div>
      </div>

      <StickyFilterBlock className={cn(stickyFilterGlassClass, "pt-6")}>
        <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
        <CrossFilterChips crossFilters={crossFilters} onRemove={removeCrossFilter} onClearAll={clearAllCrossFilters} />
      </StickyFilterBlock>

      {listWarning && (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-foreground"
        >
          {listWarning}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="sm" onClick={() => load()} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          {t("refresh")}
        </Button>
        <Button
          type="button"
          variant="default"
          size="sm"
          className="shadow-sm"
          disabled={loading || rows.length === 0 || exportingExcel}
          onClick={() => {
            void (async () => {
              setExportingExcel(true);
              try {
                await downloadExcelFromRows(exportRows, "online_orders", {
                  sheetName: "OnlineOrders",
                  totals: exportTotals,
                  totalLabel: t("tableTotal"),
                });
              } finally {
                setExportingExcel(false);
              }
            })();
          }}
        >
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          {exportingExcel ? t("loading") : t("exportExcel")}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={loading || rows.length === 0}
          onClick={() =>
            downloadCsvFromRows(exportRows, "online_orders", {
              totals: exportTotals,
              totalLabel: t("tableTotal"),
            })
          }
        >
          <Download className="w-4 h-4 mr-2" />
          {t("exportCsv")}
        </Button>
        <Button
          type="button"
          onClick={transfer}
          disabled={transferring || selected.size === 0 || loading}
        >
          <ArrowRight className="w-4 h-4 mr-2" />
          {t("transferSelected")}
          {selected.size > 0 ? ` (${selected.size})` : ""}
        </Button>
      </div>

      {transferMessage && (
        <pre className="text-sm whitespace-pre-wrap rounded-lg border border-border bg-muted/40 p-4 text-foreground">
          {transferMessage}
        </pre>
      )}

      {loading ? (
        <Skeleton className="h-96 w-full rounded-lg" />
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-primary"
                    checked={allIds.length > 0 && selected.size === allIds.length}
                    onChange={toggleAll}
                    aria-label={t("selectAll")}
                  />
                </TableHead>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("customer")}</TableHead>
                <TableHead>{t("customerCategory")}</TableHead>
                <TableHead>{t("region")}</TableHead>
                <TableHead>{t("salesman")}</TableHead>
                <TableHead className="text-right">{t("amount")}</TableHead>
                <TableHead className="text-right">{t("lines")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground py-12">
                    {t("noPendingOnlineOrders")}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((row) => {
                  const id = Number(row.IdReal1);
                  return (
                    <TableRow key={id}>
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-primary"
                          checked={selected.has(id)}
                          onChange={() => toggleOne(id)}
                          aria-label={t("selectOrderRow")}
                        />
                      </TableCell>
                      <TableCell>{formatCell(row.Data)}</TableCell>
                      <TableCell className="max-w-[200px] truncate">{formatCell(row.Org)}</TableCell>
                      <TableCell>{formatCell(row.OrgT)}</TableCell>
                      <TableCell>{formatCell(row.Reg)}</TableCell>
                      <TableCell className="max-w-[140px] truncate">{formatCell(row.Gvari)}</TableCell>
                      <TableCell className="text-right font-medium">
                        ₾{formatCell(row.OrderTotal)}
                      </TableCell>
                      <TableCell className="text-right">{formatCell(row.LineCount)}</TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
            {rows.length > 0 && (
              <TableFooter>
                <TableRow className="hover:bg-muted/50">
                  <TableCell />
                  <TableCell className="font-semibold">{t("tableTotal")}</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell />
                  <TableCell className="text-right font-semibold tabular-nums">
                    ₾{formatCell(orderTotals.orderTotal)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">
                    {orderTotals.lineCount.toLocaleString()}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      )}
      </div>
    </div>
  );
}
