"use client";

import { useState } from "react";
import { Bot, User, ChevronDown, ChevronUp, Code, BarChart3, Table2, FileText, PieChart, TrendingUp, BarChart, BookmarkPlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { DynamicChart } from "@/components/charts/DynamicChart";
import { FlexChart, type ChartVariant } from "@/components/charts/FlexChart";
import { formatCurrencyCompact, formatCurrencyFull } from "@/lib/chart-number-format";
import { DataTable } from "@/components/data-table/DataTable";
import { useLocale } from "@/lib/locale-context";
import type { AgentMessage, ChartConfig } from "@/types";
import { firstNonTechnicalColumnKey, numericMeasureKeys } from "@/lib/technical-columns";
import { cn } from "@/lib/utils";

const VARIANT_ICON: Record<ChartVariant, React.ElementType> = {
  bar: BarChart,
  "horizontal-bar": BarChart3,
  pie: PieChart,
  area: TrendingUp,
  line: TrendingUp,
};

function getVariantsForType(type: string): ChartVariant[] {
  switch (type) {
    case "bar":
      return ["bar", "pie", "horizontal-bar"];
    case "pie":
      return ["pie", "bar", "horizontal-bar"];
    case "line":
      return ["line", "area", "bar"];
    case "area":
      return ["area", "line", "bar"];
    default:
      return ["bar", "pie", "line"];
  }
}

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

interface ChatMessageProps {
  message: AgentMessage;
  /** When set, shows “Save to workspace” for successful assistant replies with SQL + data */
  onSaveToWorkspace?: (message: AgentMessage) => void;
}

export function ChatMessage({ message, onSaveToWorkspace }: ChatMessageProps) {
  const { t } = useLocale();
  const [showSQL, setShowSQL] = useState(false);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const [chartVariant, setChartVariant] = useState<ChartVariant | null>(null);
  const isUser = message.role === "user";

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

  const hasChart = message.chartConfig && message.data && message.data.length > 0 && message.chartConfig.type !== "table" && message.chartConfig.type !== "number";
  const isNumber = message.chartConfig && message.chartConfig.type === "number";
  const hasData = message.data && message.data.length > 0;
  const canSaveToWorkspace = Boolean(
    onSaveToWorkspace && message.sql && !message.loading,
  );

  const variants = hasChart ? getVariantsForType(message.chartConfig!.type) : [];
  const activeVariant = chartVariant || (variants[0] ?? "bar");

  return (
    <div className="flex gap-3 items-start">
      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        <Bot className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 space-y-3 min-w-0">
        {message.narrative && (
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
            <p className="text-sm leading-relaxed">{message.narrative}</p>
          </div>
        )}

        {message.sql && (
          <div>
            <button
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
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              {hasChart && (
                <>
                  <Button
                    variant={viewMode === "chart" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setViewMode("chart")}
                  >
                    <BarChart3 className="h-3 w-3 mr-1" />
                    {t("chart")}
                  </Button>
                  <Button
                    variant={viewMode === "table" ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setViewMode("table")}
                  >
                    <Table2 className="h-3 w-3 mr-1" />
                    {t("table")}
                  </Button>

                  {viewMode === "chart" && variants.length > 1 && (
                    <div className="flex items-center gap-0.5 bg-muted/60 rounded-lg p-0.5 ml-2">
                      {variants.map((v) => {
                        const Icon = VARIANT_ICON[v];
                        return (
                          <button
                            key={v}
                            onClick={() => setChartVariant(v)}
                            className={cn(
                              "p-1.5 rounded-md transition-all",
                              activeVariant === v
                                ? "bg-background shadow-sm text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                            )}
                            title={v}
                          >
                            <Icon className="h-3.5 w-3.5" />
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
              <Badge variant="outline" className="ml-auto text-xs">
                {message.data!.length} {t("rows")}
              </Badge>
            </div>

            <Card className={cn("p-4 overflow-hidden")}>
              {viewMode === "chart" && hasChart && message.chartConfig ? (
                (() => {
                  const { nameKey, valueKeys } = configToFlexProps(message.chartConfig, message.data!);
                  return (
                    <FlexChart
                      data={message.data!}
                      variant={activeVariant}
                      nameKey={nameKey}
                      valueKeys={valueKeys}
                      height={320}
                      formatter={formatCurrencyCompact}
                      tooltipFormatter={formatCurrencyFull}
                      showDataLabels
                    />
                  );
                })()
              ) : (
                <DataTable
                  data={message.data!}
                  title="agent_result"
                  pageSize={10}
                />
              )}
            </Card>
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
