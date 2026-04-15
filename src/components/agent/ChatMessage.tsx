"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Bot,
  User,
  ChevronDown,
  ChevronUp,
  Code,
  BarChart3,
  Table2,
  FileText,
  PieChart,
  TrendingUp,
  BarChart,
  BookmarkPlus,
  LayoutGrid,
  FileSpreadsheet,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicChart } from "@/components/charts/DynamicChart";
import { FlexChart, type ChartVariant } from "@/components/charts/FlexChart";
import {
  formatCurrencyCompact,
  formatCurrencyFull,
  formatLitersCompact,
  formatLitersFull,
  formatNumberCompact,
} from "@/lib/chart-number-format";
import { resolveMeasureDisplay } from "@/lib/agent-metric-intent";
import { DataTable } from "@/components/data-table/DataTable";
import { useLocale } from "@/lib/locale-context";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import type { VoiceLang } from "@/hooks/useSpeechRecognition";
import type { AgentMessage, AgentDomainKind, ChartConfig } from "@/types";
import { firstNonTechnicalColumnKey, numericMeasureKeys } from "@/lib/technical-columns";
import { cn } from "@/lib/utils";
import {
  getVariantsForAgentChart,
  defaultShowDataLabelsForAgent,
} from "@/lib/chart-variant-presets";
import { matrixExportColumnOrder, matrixToFlatExportRows } from "@/lib/agent-matrix";
import { buildAgentMatrixExportModel } from "@/lib/agent-matrix-export";
import { coercePageSize } from "@/lib/report-pagination-presets";
import { ComparisonMatrixTable } from "@/components/agent/ComparisonMatrixTable";
import { downloadExcelFromRows } from "@/lib/export-excel";
import { useAgentMatrixModel } from "@/hooks/use-agent-matrix-model";
import type { AgentReportView } from "@/lib/agent-report-view";
import { captureElementToPngBase64 } from "@/lib/chart-capture-to-png";

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

const DOMAIN_BADGE_META: Record<AgentDomainKind, { label: string; labelKa: string; cls: string }> = {
  sales: { label: "Sales", labelKa: "გაყიდვები", cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30" },
  online: { label: "Field Ops", labelKa: "საველე", cls: "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/30" },
  pricing: { label: "Pricing", labelKa: "ფასები", cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/30" },
  purchase: { label: "Purchase", labelKa: "შესყიდვა", cls: "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/30" },
  inventory: { label: "Inventory", labelKa: "მარაგი", cls: "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30" },
};

interface ChatMessageProps {
  message: AgentMessage;
  onSaveToWorkspace?: (message: AgentMessage) => void;
  /** Fired when Chart / Matrix / Flat tab changes (assistant report rows only). */
  onReportViewChange?: (messageId: string, view: AgentReportView) => void;
  /** Register a PNG capture fn for email; parent calls it for this message id. */
  registerChartCapture?: (messageId: string, fn: (() => Promise<string | null>) | null) => void;
  /** Language for text-to-speech playback */
  voiceLang?: VoiceLang;
}

export function ChatMessage({
  message,
  onSaveToWorkspace,
  onReportViewChange,
  registerChartCapture,
  voiceLang = "en-US",
}: ChatMessageProps) {
  const { t, locale } = useLocale();
  const { speak, cancel, speaking, supported: ttsSupported } = useSpeechSynthesis();
  const [showSQL, setShowSQL] = useState(false);
  const [chartVariant, setChartVariant] = useState<ChartVariant | null>(null);
  const isUser = message.role === "user";

  const comparison = message.chartConfig?.comparison;
  const flatTableData = comparison?.longData ?? message.data ?? [];
  const matrixView = useAgentMatrixModel(message.chartConfig, flatTableData);
  const hasData = Boolean(message.data && message.data.length > 0);
  const hasChart = Boolean(
    message.chartConfig &&
      hasData &&
      message.chartConfig.type !== "table" &&
      message.chartConfig.type !== "number",
  );
  const showMatrix = Boolean(matrixView);

  const [dataView, setDataView] = useState<"chart" | "matrix" | "flat">(() =>
    showMatrix ? "matrix" : hasChart ? "chart" : "flat",
  );
  const [reportPageSize, setReportPageSize] = useState(() => coercePageSize(10));
  const [matrixPageIndex, setMatrixPageIndex] = useState(0);
  const [exportingMatrix, setExportingMatrix] = useState(false);

  const chartCaptureVisibleRef = useRef<HTMLDivElement>(null);
  const chartCaptureHiddenRef = useRef<HTMLDivElement>(null);

  /**
   * Prefer the visible chart when user is on Chart tab (fully painted + correct layout).
   * Otherwise use the email-safe off-screen clone (still in-viewport so Recharts gets width).
   */
  const captureFn = useCallback(async () => {
    if (!hasChart) return null;
    const target =
      dataView === "chart" ? chartCaptureVisibleRef.current : chartCaptureHiddenRef.current;
    return captureElementToPngBase64(target);
  }, [hasChart, dataView]);

  useEffect(() => {
    setMatrixPageIndex(0);
  }, [message.id]);

  useEffect(() => {
    if (!matrixView) return;
    const n = matrixView.model.rowLabels.length;
    const pc = Math.max(1, Math.ceil(n / reportPageSize));
    setMatrixPageIndex((i) => Math.min(i, pc - 1));
  }, [matrixView, message.data, reportPageSize]);

  useEffect(() => {
    if (!onReportViewChange || message.loading || isUser) return;
    if (!hasData || message.chartConfig?.type === "number") return;
    onReportViewChange(message.id, dataView);
  }, [message.id, message.loading, isUser, hasData, message.chartConfig?.type, dataView, onReportViewChange]);

  useEffect(() => {
    if (!registerChartCapture) return;
    if (message.loading || isUser || !hasChart) {
      registerChartCapture(message.id, null);
      return;
    }
    registerChartCapture(message.id, captureFn);
    return () => {
      registerChartCapture(message.id, null);
    };
  }, [message.id, message.loading, isUser, hasChart, captureFn, registerChartCapture]);

  if (message.loading) {
    return (
      <div className="flex gap-3 items-start">
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 space-y-3 pt-1">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-4 w-64" />
        </div>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex gap-3 items-start justify-end">
        <div className="max-w-[80%]">
          <Card className="bg-primary text-primary-foreground px-4 py-3 rounded-2xl rounded-tr-sm">
            <p className="text-sm">{message.content}</p>
          </Card>
        </div>
        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  const isNumber = message.chartConfig && message.chartConfig.type === "number";
  const canSaveToWorkspace = Boolean(onSaveToWorkspace && message.sql && !message.loading);

  const variants = hasChart
    ? getVariantsForAgentChart(message.chartConfig!.type, {
        comparison: !!(comparison?.enabled || matrixView),
        explicitPie: message.chartConfig?.type === "pie",
      })
    : [];
  const activeVariant = chartVariant || (variants[0] ?? "bar");

  const toolbarRowCountBadge =
    dataView === "matrix" && matrixView
      ? matrixView.model.rowLabels.length
      : flatTableData.length;

  const showDataLabelsComputed =
    message.chartConfig && message.data?.length
      ? defaultShowDataLabelsForAgent(
          message.chartConfig.yKeys?.length ?? 0,
          message.data.length,
          !!(comparison?.enabled || matrixView),
        )
      : true;

  const measureResolved = resolveMeasureDisplay(message.chartConfig, message.data);
  const matrixCountLike = /count|distinct|quantity|qty|units|customers?|orders?|organizations?|org/i.test(
    matrixView?.measureLabel ?? message.chartConfig?.comparison?.measure ?? "",
  );
  const chartAxisFormatter =
    measureResolved === "liters"
      ? formatLitersCompact
      : measureResolved === "quantity" || measureResolved === "mixed"
        ? formatNumberCompact
        : formatCurrencyCompact;
  const chartTooltipFormatter =
    measureResolved === "liters"
      ? formatLitersFull
      : measureResolved === "quantity" || measureResolved === "mixed"
        ? (v: number) =>
            Number.isFinite(v)
              ? v.toLocaleString(undefined, { maximumFractionDigits: 2 })
              : ""
        : formatCurrencyFull;
  const matrixCellFormatter =
    matrixCountLike
      ? formatNumberCompact
      : measureResolved === "liters"
      ? formatLitersCompact
      : measureResolved === "quantity" || measureResolved === "mixed"
        ? formatNumberCompact
        : formatCurrencyCompact;

  async function handleExportMatrix() {
    if (!matrixView || exportingMatrix) return;
    setExportingMatrix(true);
    try {
      const model = buildAgentMatrixExportModel(message.chartConfig, message.data);
      if (!model) return;
      const rows = matrixToFlatExportRows(model, matrixView.rowDimLabel);
      await downloadExcelFromRows(rows, `comparison-matrix-${Date.now()}`, {
        sheetName: message.chartConfig?.title?.slice(0, 31) ?? "Matrix",
        columnOrder: matrixExportColumnOrder(model, matrixView.rowDimLabel),
      });
    } catch (e) {
      console.error(e);
    } finally {
      setExportingMatrix(false);
    }
  }

  return (
    <div className="flex gap-3 items-start">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-3 min-w-0">
        {message.domain && DOMAIN_BADGE_META[message.domain] && (
          <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-wide uppercase", DOMAIN_BADGE_META[message.domain].cls)}>
            {locale === "ka" ? DOMAIN_BADGE_META[message.domain].labelKa : DOMAIN_BADGE_META[message.domain].label}
          </span>
        )}
        {message.narrative && (
          <div className="flex items-start gap-2 group/narrative">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed flex-1">{message.narrative}</p>
            {ttsSupported && (
              <button
                type="button"
                onClick={() => speaking ? cancel() : speak(message.narrative!, voiceLang)}
                className={cn(
                  "shrink-0 mt-0.5 p-1 rounded-lg transition-all opacity-0 group-hover/narrative:opacity-100",
                  speaking
                    ? "text-primary bg-primary/10 opacity-100"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
                title={speaking ? t("voiceStop") : t("voiceSpeak")}
              >
                {speaking
                  ? <VolumeX className="h-3.5 w-3.5" />
                  : <Volume2 className="h-3.5 w-3.5" />
                }
              </button>
            )}
          </div>
        )}

        {message.sql && (
          <div>
            <button
              type="button"
              onClick={() => setShowSQL(!showSQL)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Code className="h-3 w-3" />
              {t("sqlQuery")}
              {showSQL ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {showSQL && (
              <pre className="mt-2 p-3 bg-muted/50 rounded-lg text-xs overflow-x-auto font-mono">
                {message.sql}
              </pre>
            )}
          </div>
        )}

        {isNumber && hasData && (
          <DynamicChart data={message.data!} config={message.chartConfig!} />
        )}

        {hasData && !isNumber && (
          <div>
            {message.chartConfig?.title ? (
              <h3 className="text-sm font-semibold mb-2">{message.chartConfig.title}</h3>
            ) : null}
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {hasChart && (
                <Button
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
                variant={dataView === "flat" ? "secondary" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setDataView("flat")}
              >
                <Table2 className="h-3 w-3 mr-1" />
                {t("agentFlatTable")}
              </Button>

              {dataView === "chart" && variants.length > 1 && (
                <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 ml-2">
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

              {dataView === "matrix" && matrixView && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs ml-1"
                  disabled={exportingMatrix}
                  title={t("exportFullReportTooltip")}
                  onClick={() => void handleExportMatrix()}
                >
                  <FileSpreadsheet className="h-3 w-3 mr-1" />
                  {exportingMatrix ? t("loading") : t("exportFullReport")}
                </Button>
              )}

              <Badge variant="outline" className="ml-auto text-xs">
                {toolbarRowCountBadge} {t("rows")}
              </Badge>
            </div>

            <Card className={cn("p-4 overflow-hidden")}>
              {dataView === "chart" && hasChart && message.chartConfig ? (
                (() => {
                  const { nameKey, valueKeys } = configToFlexProps(message.chartConfig, message.data!);
                  return (
                    <div
                      ref={chartCaptureVisibleRef}
                      className="agent-chart-light-surface w-full min-w-0 rounded-md bg-white p-1"
                    >
                      <FlexChart
                        data={message.data!}
                        variant={activeVariant}
                        nameKey={nameKey}
                        valueKeys={valueKeys}
                        height={320}
                        formatter={chartAxisFormatter}
                        tooltipFormatter={chartTooltipFormatter}
                        showDataLabels={showDataLabelsComputed}
                        emailExportSafe
                      />
                    </div>
                  );
                })()
              ) : dataView === "matrix" && matrixView ? (
                <ComparisonMatrixTable
                  model={matrixView.model}
                  rowDimLabel={matrixView.rowDimLabel}
                  measureLabel={matrixView.measureLabel}
                  t={t}
                  formatCell={matrixCellFormatter}
                  pageSize={reportPageSize}
                  pageIndex={matrixPageIndex}
                  onPageSizeChange={(n) => setReportPageSize(coercePageSize(n))}
                  onPageIndexChange={setMatrixPageIndex}
                />
              ) : (
                <DataTable
                  data={flatTableData}
                  title="agent_result"
                  pageSize={reportPageSize}
                  onPageSizeChange={(n) => setReportPageSize(coercePageSize(n))}
                  exportExcelTooltip={t("exportFullReportTooltip")}
                  exportLabelFullReport
                />
              )}
            </Card>

            {hasChart && message.chartConfig ? (
              <div
                ref={chartCaptureHiddenRef}
                className="agent-chart-light-surface pointer-events-none fixed left-0 top-0 z-[-30] w-[800px] min-h-[360px] max-w-[800px] opacity-[0.015] bg-white p-4 text-slate-900"
                aria-hidden
              >
                {(() => {
                  const { nameKey, valueKeys } = configToFlexProps(message.chartConfig!, message.data!);
                  return (
                    <FlexChart
                      data={message.data!}
                      variant={activeVariant}
                      nameKey={nameKey}
                      valueKeys={valueKeys}
                      height={320}
                      formatter={chartAxisFormatter}
                      tooltipFormatter={chartTooltipFormatter}
                      showDataLabels={showDataLabelsComputed}
                      emailExportSafe
                    />
                  );
                })()}
              </div>
            ) : null}
          </div>
        )}

        {canSaveToWorkspace ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            onClick={() => onSaveToWorkspace?.(message)}
          >
            <BookmarkPlus className="h-3.5 w-3.5" />
            {t("workspaceSaveToWorkspace")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
