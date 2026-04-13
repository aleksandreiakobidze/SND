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

function fmtShort(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString(locale === "ka" ? "ka-GE" : undefined, {
      month: "short",
      day: "numeric",
    });
  } catch {
    return "—";
  }
}

export function SavedReportLibraryRow({
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
    <div
      className={cn(
        "flex min-h-14 items-center gap-2 rounded-lg border border-border/60 bg-card/50 px-3 py-2 transition-colors hover:bg-muted/30",
        report.isPinned && "border-primary/40",
      )}
    >
      <ChartGlyph type={report.chartType} />
      <div className="min-w-0 flex-1">
        <Link
          href={`/agent?report=${encodeURIComponent(report.id)}`}
          className="block truncate font-medium text-foreground hover:text-primary"
        >
          {report.title}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[0.7rem] text-muted-foreground">
          <span>{fmtShort(report.updatedAt, locale)}</span>
          {report.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="outline" className="px-1 py-0 text-[0.6rem] font-normal">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-8 w-8"
          disabled={!canEdit}
          onClick={onToggleFavorite}
        >
          <Star className={cn("h-4 w-4", report.isFavorite && "fill-amber-400 text-amber-500")} />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="h-8 w-8"
          disabled={!canEdit}
          onClick={onTogglePin}
        >
          <Pin className={cn("h-4 w-4", report.isPinned && "text-primary")} />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(buttonVariants({ variant: "ghost", size: "icon-xs" }), "h-8 w-8")}
          >
            <MoreHorizontal className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
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
            <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={onDelete} disabled={!canEdit}>
              {t("workspaceDeleteReport")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
