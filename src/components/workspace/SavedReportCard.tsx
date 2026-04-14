"use client";

import { useState, useMemo, useEffect } from "react";
import Link from "next/link";
import {
  BarChart,
  BarChart3,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  LayoutGrid,
  PieChart,
  RefreshCw,
  Table2,
  Trash2,
  TrendingUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { DynamicChart } from "@/components/charts/DynamicChart";
import { FlexChart, type ChartVariant } from "@/components/charts/FlexChart";
import { defaultChartValueFormat, formatCurrencyFull } from "@/lib/chart-number-format";
import { DataTable } from "@/components/data-table/DataTable";
import { useLocale } from "@/lib/locale-context";
import type { SavedReportMeta } from "@/lib/workspace-db";
import type { ChartConfig } from "@/types";
import { firstNonTechnicalColumnKey, isTechnicalIdColumnKey, numericMeasureKeys } from "@/lib/technical-columns";
import { orderKeysItemCodeBeforeItemName } from "@/lib/table-column-order";
import { computeColumnTotals } from "@/lib/table-totals";
import { downloadExcelFromRows } from "@/lib/export-excel";
import { cn } from "@/lib/utils";
import {
  getVariantsForAgentChart,
  defaultShowDataLabelsForAgent,
} from "@/lib/chart-variant-presets";
import { matrixExportColumnOrder, matrixToFlatExportRows } from "@/lib/agent-matrix";
import { buildAgentMatrixExportModel } from "@/lib/agent-matrix-export";
import { coercePageSize } from "@/lib/report-pagination-presets";
import { ComparisonMatrixTable } from "@/components/agent/ComparisonMatrixTable";
import { useAgentMatrixModel } from "@/hooks/use-agent-matrix-model";

type Props = {
  report: SavedReportMeta;
  onDeleted: () => void;
  onTitleUpdated: () => void;
  /** When false, title is read-only and delete is hidden. Default true. */
  canEdit?: boolean;
};

const VARIANT_ICON: Record<ChartVariant, React.ElementType> = {
  bar: BarChart,
  "horizontal-bar": BarChart3,
  pie: PieChart,
  area: TrendingUp,
  line: TrendingUp,
};

function configToFlexProps(config: ChartConfig, data: Record<string, unknown>[]) {
  const xKey = config.xKey || (data[0] ? firstNonTechnicalColumnKey(data[0]) : "name");
  const yKeys =
    config.yKeys || (data[0] ? numericMeasureKeys(data[0], xKey) : []);
  const valueKeys = yKeys.map((k) => ({
    key: k,
    label: k,
    color: undefined as string | undefined,
  }));
  return { nameKey: xKey, valueKeys };
}

export function SavedReportCard({ report, onDeleted, onTitleUpdated, canEdit = true }: Props) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<Record<string, unknown>[] | null>(null);
  const [chartConfig, setChartConfig] = useState<ChartConfig | null>(null);
  const [narrative, setNarrative] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState(report.title);
  const [dataView, setDataView] = useState<"chart" | "matrix" | "flat">("chart");
  const [chartVariant, setChartVariant] = useState<ChartVariant | null>(null);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [reportPageSize, setReportPageSize] = useState(() => coercePageSize(10));
  const [matrixPageIndex, setMatrixPageIndex] = useState(0);

  const hasChartable = Boolean(
    chartConfig && data && data.length > 0 && chartConfig.type !== "table" && chartConfig.type !== "number",
  );
  const comparison = chartConfig?.comparison;
  const matrixView = useAgentMatrixModel(chartConfig, data ?? undefined);
  const showMatrix = Boolean(matrixView);

  const flatTableData = useMemo(
    () => comparison?.longData ?? data ?? [],
    [comparison?.longData, data],
  );

  const toolbarRowCountBadge = useMemo(
    () =>
      dataView === "matrix" && matrixView
        ? matrixView.model.rowLabels.length
        : flatTableData.length,
    [dataView, matrixView, flatTableData],
  );

  const idealDataView: "chart" | "matrix" | "flat" = showMatrix
    ? "matrix"
    : hasChartable
      ? "chart"
      : "flat";

  // Sync default view when report data / chart config loads (e.g. after refresh).
  useEffect(() => {
    setDataView(idealDataView);
  }, [idealDataView, report.id]);

  useEffect(() => {
    setMatrixPageIndex(0);
  }, [report.id]);

  useEffect(() => {
    if (!matrixView) return;
    const n = matrixView.model.rowLabels.length;
    const pc = Math.max(1, Math.ceil(n / reportPageSize));
    setMatrixPageIndex((i) => Math.min(i, pc - 1));
  }, [matrixView, data, reportPageSize]);

  const exportRows = useMemo(() => {
    const src = flatTableData;
    if (!src.length) return [] as Record<string, unknown>[];
    const keys = Object.keys(src[0]);
    const filtered = keys.filter((k) => !isTechnicalIdColumnKey(k));
    const visibleKeys = orderKeysItemCodeBeforeItemName(filtered);
    return src.map((row) => {
      const out: Record<string, unknown> = {};
      for (const k of visibleKeys) out[k] = row[k];
      return out;
    });
  }, [flatTableData]);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reports/${report.id}/refresh`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || json.details || t("error"));
        return;
      }
      setData(json.data as Record<string, unknown>[]);
      setChartConfig(json.chartConfig as ChartConfig | null);
      setNarrative(typeof json.narrative === "string" ? json.narrative : null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setLoading(false);
    }
  }

  async function saveTitle() {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === report.title) {
      setEditingTitle(false);
      setTitleDraft(report.title);
      return;
    }
    const res = await fetch(`/api/reports/${report.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    if (res.ok) onTitleUpdated();
    setEditingTitle(false);
  }

  async function exportExcel() {
    if (exportingExcel) return;
    if (dataView === "matrix" && matrixView) {
      setExportingExcel(true);
      try {
        const model = buildAgentMatrixExportModel(chartConfig, data ?? undefined);
        if (!model) return;
        const rows = matrixToFlatExportRows(model, matrixView.rowDimLabel);
        const safeTitle = report.title.replace(/[/\\?%*:[\]]/g, "-").trim() || "report";
        await downloadExcelFromRows(rows, `workspace_${safeTitle}_matrix`, {
          sheetName: `${safeTitle.slice(0, 20)}_matrix`.slice(0, 31),
          columnOrder: matrixExportColumnOrder(model, matrixView.rowDimLabel),
        });
      } catch (e) {
        console.error(e);
      } finally {
        setExportingExcel(false);
      }
      return;
    }
    if (exportRows.length === 0) return;
    setExportingExcel(true);
    try {
      const columnKeys = Object.keys(exportRows[0]);
      const totals = computeColumnTotals(columnKeys, exportRows);
      const safeTitle = report.title.replace(/[/\\?%*:[\]]/g, "-").trim() || "report";
      await downloadExcelFromRows(exportRows, `workspace_${safeTitle}`, {
        sheetName: safeTitle.slice(0, 31),
        totals,
        totalLabel: t("tableTotal"),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setExportingExcel(false);
    }
  }

  async function remove() {
    if (!confirm(t("workspaceConfirmDeleteReport"))) return;
    const res = await fetch(`/api/reports/${report.id}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) onDeleted();
  }

  const hasData = Boolean(data && data.length > 0);
  const isNumber = chartConfig?.type === "number";
  const variants = useMemo(
    () =>
      hasChartable && chartConfig
        ? getVariantsForAgentChart(chartConfig.type, {
            comparison: !!(comparison?.enabled || matrixView),
            explicitPie: chartConfig.type === "pie",
          })
        : [],
    [hasChartable, chartConfig, comparison?.enabled, matrixView],
  );
  const activeVariant = useMemo(() => {
    if (variants.length === 0) return "bar";
    if (chartVariant && variants.includes(chartVariant)) return chartVariant;
    return variants[0];
  }, [chartVariant, variants]);

  const showDataLabelsComputed =
    chartConfig && data?.length
      ? defaultShowDataLabelsForAgent(
          chartConfig.yKeys?.length ?? 0,
          data.length,
          !!(comparison?.enabled || matrixView),
        )
      : true;

  useEffect(() => {
    setChartVariant(null);
  }, [chartConfig?.type]);

  return (
    <Card className="overflow-hidden border-border/80">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          {editingTitle ? (
            <Input
              value={titleDraft}
              className="h-9 max-w-md font-semibold"
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveTitle}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              autoFocus
            />
          ) : canEdit ? (
            <button
              type="button"
              className="text-left font-semibold hover:underline"
              onClick={() => {
                setTitleDraft(report.title);
                setEditingTitle(true);
              }}
            >
              {report.title}
            </button>
          ) : (
            <span className="font-semibold">{report.title}</span>
          )}
          {report.narrative ? (
            <p className="text-xs text-muted-foreground line-clamp-2">{report.narrative}</p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={loading}
            onClick={() => {
              if (!expanded && data === null) void refresh();
              setExpanded(!expanded);
            }}
          >
            {expanded ? (
              <>
                <ChevronUp className="h-3.5 w-3.5 mr-1" />
                {t("workspaceCollapseReport")}
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5 mr-1" />
                {t("workspaceExpandReport")}
              </>
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8"
            disabled={loading}
            onClick={() => void refresh()}
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1", loading && "animate-spin")} />
            {t("workspaceRefreshReport")}
          </Button>
          {canEdit ? (
            <Button type="button" variant="ghost" size="sm" className="h-8 text-destructive" onClick={remove}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 pb-4 pt-2">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          {loading && !data ? (
            <p className="text-sm text-muted-foreground">{t("loading")}</p>
          ) : null}
          {narrative && hasData ? (
            <p className="text-sm text-muted-foreground mb-3">{narrative}</p>
          ) : null}

          {isNumber && hasData && chartConfig ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <DynamicChart data={data!} config={chartConfig} />
            </div>
          ) : null}

          {hasData && !isNumber && (
            <div className="space-y-1">
              {(hasChartable || showMatrix) && (
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {hasChartable && (
                    <Button
                      type="button"
                      variant={dataView === "chart" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setDataView("chart")}
                    >
                      <BarChart3 className="h-3 w-3 mr-1" />
                      {t("chart")}
                    </Button>
                  )}
                  {showMatrix && (
                    <Button
                      type="button"
                      variant={dataView === "matrix" ? "secondary" : "ghost"}
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setDataView("matrix")}
                    >
                      <LayoutGrid className="h-3 w-3 mr-1" />
                      {t("agentViewMatrix")}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant={dataView === "flat" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setDataView("flat")}
                  >
                    <Table2 className="h-3 w-3 mr-1" />
                    {t("agentFlatTable")}
                  </Button>

                  {dataView === "chart" && variants.length > 1 && (
                    <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 ml-1">
                      {variants.map((v) => {
                        const Icon = VARIANT_ICON[v];
                        return (
                          <button
                            key={v}
                            type="button"
                            onClick={() => setChartVariant(v)}
                            className={cn(
                              "p-1.5 rounded-md transition-all",
                              activeVariant === v
                                ? "bg-background shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground",
                            )}
                            title={v}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      className="h-7 text-xs"
                      title={t("exportFullReportTooltip")}
                      disabled={
                        loading ||
                        exportingExcel ||
                        (dataView === "matrix" ? !matrixView : exportRows.length === 0)
                      }
                      onClick={() => void exportExcel()}
                    >
                      <FileSpreadsheet className="h-3 w-3 mr-1" />
                      {exportingExcel ? t("loading") : t("exportFullReport")}
                    </Button>
                    <Badge variant="outline" className="text-xs">
                      {toolbarRowCountBadge} {t("rows")}
                    </Badge>
                  </div>
                </div>
              )}

              <Card className={cn("p-4 overflow-hidden")}>
                {dataView === "chart" && hasChartable && chartConfig ? (
                  (() => {
                    const { nameKey, valueKeys } = configToFlexProps(chartConfig, data!);
                    return (
                      <FlexChart
                        data={data!}
                        variant={activeVariant}
                        nameKey={nameKey}
                        valueKeys={valueKeys}
                        height={320}
                        formatter={defaultChartValueFormat}
                        tooltipFormatter={formatCurrencyFull}
                        showDataLabels={showDataLabelsComputed}
                      />
                    );
                  })()
                ) : dataView === "matrix" && matrixView ? (
                  <ComparisonMatrixTable
                    model={matrixView.model}
                    rowDimLabel={matrixView.rowDimLabel}
                    measureLabel={matrixView.measureLabel}
                    t={t}
                    formatCell={defaultChartValueFormat}
                    pageSize={reportPageSize}
                    pageIndex={matrixPageIndex}
                    onPageSizeChange={setReportPageSize}
                    onPageIndexChange={setMatrixPageIndex}
                  />
                ) : (
                  <DataTable
                    data={flatTableData}
                    title="workspace_report"
                    pageSize={reportPageSize}
                    showTotals
                    exportable={!hasChartable && !showMatrix}
                    onPageSizeChange={setReportPageSize}
                    exportExcelTooltip={t("exportFullReportTooltip")}
                    exportLabelFullReport
                  />
                )}
              </Card>
            </div>
          )}

          {data && data.length === 0 && !loading ? (
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
          ) : null}
          <div className="mt-3">
            <Link href="/agent" className="text-xs text-primary hover:underline">
              {t("workspaceOpenFullAgent")}
            </Link>
          </div>
        </div>
      )}
    </Card>
  );
}
