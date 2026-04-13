"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BarChart3,
  Copy,
  LayoutGrid,
  LineChart,
  MoreHorizontal,
  PieChart,
  Pin,
  RefreshCw,
  Star,
  Table2,
  TrendingUp,
  Hash,
} from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/locale-context";
import type { SavedReportMeta } from "@/lib/workspace-db";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";

function chartTypeLabel(t: (k: TranslationKey) => string, chartType: string | null): string {
  switch (chartType) {
    case "bar":
      return t("workspaceChartTypeBar");
    case "line":
      return t("workspaceChartTypeLine");
    case "pie":
      return t("workspaceChartTypePie");
    case "area":
      return t("workspaceChartTypeArea");
    case "table":
      return t("workspaceChartTypeTable");
    case "number":
      return t("workspaceChartTypeNumber");
    default:
      return t("workspaceFilterChartAll");
  }
}

function ChartGlyph({ type }: { type: string | null }) {
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  switch (type) {
    case "line":
      return <LineChart className={cls} />;
    case "pie":
      return <PieChart className={cls} />;
    case "area":
      return <TrendingUp className={cls} />;
    case "table":
      return <Table2 className={cls} />;
    case "number":
      return <Hash className={cls} />;
    case "bar":
    default:
      return <BarChart3 className={cls} />;
  }
}

type Props = {
  report: SavedReportMeta;
  canEdit: boolean;
  onRefresh: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleFavorite: () => void;
  onTogglePin: () => void;
  onMove: () => void;
  refreshing?: boolean;
};

function fmtTime(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(locale === "ka" ? "ka-GE" : undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "—";
  }
}

export function SavedReportLibraryCard({
  report,
  canEdit,
  onRefresh,
  onDelete,
  onDuplicate,
  onToggleFavorite,
  onTogglePin,
  onMove,
  refreshing,
}: Props) {
  const { t, locale } = useLocale();
  const router = useRouter();

  return (
    <Card
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/80 bg-card/80 shadow-sm transition-all hover:border-border hover:shadow-md",
        report.isPinned && "ring-1 ring-primary/35",
      )}
    >
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span className="mt-0.5 rounded-md bg-muted/60 p-1.5">
              <ChartGlyph type={report.chartType} />
            </span>
            <div className="min-w-0">
              <Link
                href={`/agent?report=${encodeURIComponent(report.id)}`}
                className="line-clamp-2 text-base font-semibold leading-snug text-foreground hover:text-primary"
              >
                {report.title}
              </Link>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {report.narrative?.trim() || "—"}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <Button
              type="button"
              variant={report.isFavorite ? "secondary" : "ghost"}
              size="icon-xs"
              className="h-8 w-8"
              disabled={!canEdit}
              onClick={onToggleFavorite}
              aria-label={report.isFavorite ? t("workspaceReportUnfavorite") : t("workspaceReportFavorite")}
            >
              <Star className={cn("h-4 w-4", report.isFavorite && "fill-amber-400 text-amber-500")} />
            </Button>
            <Button
              type="button"
              variant={report.isPinned ? "secondary" : "ghost"}
              size="icon-xs"
              className="h-8 w-8"
              disabled={!canEdit}
              onClick={onTogglePin}
              aria-label={report.isPinned ? t("workspaceReportUnpin") : t("workspaceReportPin")}
            >
              <Pin className={cn("h-4 w-4", report.isPinned && "text-primary")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(
                  buttonVariants({ variant: "ghost", size: "icon-xs" }),
                  "h-8 w-8",
                )}
                aria-label={t("workspaceMore")}
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={() => router.push(`/agent?report=${encodeURIComponent(report.id)}`)}>
                  {t("workspaceReportOpen")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRefresh} disabled={refreshing}>
                  <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
                  {t("workspaceRefreshReport")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMove} disabled={!canEdit}>
                  <LayoutGrid className="mr-2 h-4 w-4" />
                  {t("workspaceReportMove")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate} disabled={!canEdit}>
                  <Copy className="mr-2 h-4 w-4" />
                  {t("workspaceReportDuplicate")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive"
                  onClick={onDelete}
                  disabled={!canEdit}
                >
                  {t("workspaceDeleteReport")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {report.tags.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {report.tags.slice(0, 6).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[0.65rem] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        ) : null}

        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 border-t border-border/50 pt-3 text-[0.7rem] text-muted-foreground">
          <span>
            {chartTypeLabel(t, report.chartType)}
          </span>
          <span>
            {t("workspaceSortUpdated")}: {fmtTime(report.updatedAt, locale)}
          </span>
          <span>
            {t("workspaceSortOpened")}: {fmtTime(report.lastOpenedAt, locale)}
          </span>
          <span>
            {report.openCount}×
          </span>
        </div>
      </div>
    </Card>
  );
}
