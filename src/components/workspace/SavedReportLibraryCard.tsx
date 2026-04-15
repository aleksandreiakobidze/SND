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
    case "bar": return t("workspaceChartTypeBar");
    case "line": return t("workspaceChartTypeLine");
    case "pie": return t("workspaceChartTypePie");
    case "area": return t("workspaceChartTypeArea");
    case "table": return t("workspaceChartTypeTable");
    case "number": return t("workspaceChartTypeNumber");
    default: return t("workspaceFilterChartAll");
  }
}

function ChartGlyph({ type }: { type: string | null }) {
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  switch (type) {
    case "line": return <LineChart className={cls} />;
    case "pie": return <PieChart className={cls} />;
    case "area": return <TrendingUp className={cls} />;
    case "table": return <Table2 className={cls} />;
    case "number": return <Hash className={cls} />;
    case "bar": default: return <BarChart3 className={cls} />;
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
  if (!iso) return "\u2014";
  try {
    return new Date(iso).toLocaleString(locale === "ka" ? "ka-GE" : undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch { return "\u2014"; }
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
        "group relative flex flex-col overflow-hidden rounded-xl border border-border/50 bg-card/70 shadow-sm transition-all hover:border-border/80 hover:shadow-md",
        report.isPinned && "ring-1 ring-primary/30",
      )}
    >
      <div className="flex flex-1 flex-col gap-2.5 p-3.5">
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 flex-1 items-start gap-2">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
              <ChartGlyph type={report.chartType} />
            </span>
            <div className="min-w-0">
              <Link
                href={`/agent?report=${encodeURIComponent(report.id)}`}
                className="line-clamp-2 text-sm font-semibold leading-snug text-foreground hover:text-primary"
              >
                {report.title}
              </Link>
              <p className="mt-0.5 line-clamp-2 text-[0.7rem] leading-relaxed text-muted-foreground">
                {report.narrative?.trim() || "\u2014"}
              </p>
            </div>
          </div>

          {/* Actions: visible on hover */}
          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              type="button"
              variant={report.isFavorite ? "secondary" : "ghost"}
              size="icon-xs"
              className="h-7 w-7"
              disabled={!canEdit}
              onClick={onToggleFavorite}
              aria-label={report.isFavorite ? t("workspaceReportUnfavorite") : t("workspaceReportFavorite")}
            >
              <Star className={cn("h-3.5 w-3.5", report.isFavorite && "fill-amber-400 text-amber-500")} />
            </Button>
            <Button
              type="button"
              variant={report.isPinned ? "secondary" : "ghost"}
              size="icon-xs"
              className="h-7 w-7"
              disabled={!canEdit}
              onClick={onTogglePin}
              aria-label={report.isPinned ? t("workspaceReportUnpin") : t("workspaceReportPin")}
            >
              <Pin className={cn("h-3.5 w-3.5", report.isPinned && "text-primary")} />
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }), "h-7 w-7")}
                aria-label={t("workspaceMore")}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onSelect={() => router.push(`/agent?report=${encodeURIComponent(report.id)}`)}>
                  {t("workspaceReportOpen")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onRefresh} disabled={refreshing}>
                  <RefreshCw className={cn("mr-2 h-3.5 w-3.5", refreshing && "animate-spin")} />
                  {t("workspaceRefreshReport")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onMove} disabled={!canEdit}>
                  <LayoutGrid className="mr-2 h-3.5 w-3.5" />
                  {t("workspaceReportMove")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDuplicate} disabled={!canEdit}>
                  <Copy className="mr-2 h-3.5 w-3.5" />
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

        {report.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {report.tags.slice(0, 5).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[0.6rem] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="mt-auto flex items-center gap-1 border-t border-border/30 pt-2.5 text-[0.65rem] text-muted-foreground">
          <span>{chartTypeLabel(t, report.chartType)}</span>
          <span className="text-border">·</span>
          <span>{fmtTime(report.updatedAt, locale)}</span>
          {report.openCount > 0 && (
            <>
              <span className="text-border">·</span>
              <span>{report.openCount}×</span>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}
