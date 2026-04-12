"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  loading?: boolean;
  className?: string;
}

export function KPICard({
  title,
  value,
  icon: Icon,
  trend,
  loading,
  className,
}: KPICardProps) {
  if (loading) {
    return (
      <Card
        className={cn(
          "relative overflow-hidden border-border/50 bg-card/90 backdrop-blur-sm",
          className,
        )}
      >
        <CardContent className="p-6">
          <Skeleton className="mb-3 h-4 w-24" />
          <Skeleton className="mb-2 h-9 w-36" />
          <Skeleton className="h-3 w-16" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/60 bg-gradient-to-br from-card to-card/80 transition-all duration-300",
        "hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg hover:shadow-primary/5",
        className,
      )}
    >
      <div
        className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/[0.07] blur-2xl transition-opacity group-hover:opacity-100 dark:bg-primary/10"
        aria-hidden
      />
      <CardContent className="relative p-6">
        <div className="mb-4 flex items-start justify-between gap-3">
          <p className="text-[13px] font-medium leading-snug text-muted-foreground">{title}</p>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/15 to-chart-2/10 text-primary ring-1 ring-primary/10 dark:from-primary/25 dark:to-chart-2/15">
            <Icon className="h-5 w-5" />
          </div>
        </div>
        <p className="text-3xl font-semibold tabular-nums tracking-tight text-foreground sm:text-[2rem] sm:leading-none">
          {value}
        </p>
        {trend ? (
          <p className="mt-2 text-xs font-medium text-muted-foreground">{trend}</p>
        ) : null}
      </CardContent>
    </Card>
  );
}
