"use client";

import { ArrowRight, Truck } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import type { DriverLoadStats } from "@/lib/distribution/distribution-types";

function barGradient(pct: number): string {
  if (pct >= 100) return "bg-gradient-to-r from-red-500 to-red-400";
  if (pct >= 90) return "bg-gradient-to-r from-amber-500 to-amber-400";
  if (pct >= 70) return "bg-gradient-to-r from-emerald-500 to-emerald-400";
  return "bg-gradient-to-r from-sky-500 to-sky-400";
}

function LoadBar({ label, value, max, pct: p }: { label: string; value: number; max: number; pct: number }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-[11px]">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className={cn(
          "tabular-nums",
          p >= 100 ? "text-red-500 font-semibold" : p >= 90 ? "text-amber-500 font-medium" : "text-muted-foreground",
        )}>
          {value.toLocaleString(undefined, { maximumFractionDigits: 1 })} / {max.toLocaleString()} ({p}%)
        </span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted/40">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barGradient(p))}
          style={{ width: `${Math.min(p, 100)}%` }}
        />
      </div>
    </div>
  );
}

interface Props {
  stat: DriverLoadStats;
  color: string;
  onShowOrders?: () => void;
  /** Clicking the card background filters the map to this driver; toggles off when already selected. */
  onSelectForMap?: () => void;
  selected?: boolean;
}

export function DistributionDriverCard({
  stat,
  color,
  onShowOrders,
  onSelectForMap,
  selected = false,
}: Props) {
  const { t } = useLocale();
  const overCapacity =
    (stat.hasLitersLimit && stat.litersPct >= 100) ||
    (stat.hasKgLimit && stat.kgPct >= 100) ||
    (stat.hasOrdersLimit && stat.ordersPct >= 100);

  return (
    <div
      role={onSelectForMap ? "button" : undefined}
      tabIndex={onSelectForMap ? 0 : undefined}
      className={cn(
        "group/card relative rounded-2xl border p-4 space-y-3 transition-all duration-200",
        "backdrop-blur-sm bg-card/90 hover:shadow-lg hover:border-border hover:-translate-y-0.5",
        onSelectForMap && "cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        selected && "ring-2 ring-primary border-primary/50 shadow-md",
        overCapacity
          ? "border-red-500/40 bg-red-500/[0.03]"
          : "border-border/40",
      )}
      onClick={onSelectForMap}
      onKeyDown={(e) => {
        if (!onSelectForMap) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelectForMap();
        }
      }}
    >
      {/* Top: driver info + order count + amount */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="h-4 w-4 rounded-full shrink-0 shadow-sm ring-2 ring-background"
            style={{ backgroundColor: color }}
          />
          <Truck className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
          <div className="min-w-0">
            <p className="text-[13px] font-semibold truncate leading-tight">{stat.driverName}</p>
            {stat.vehiclePlate && (
              <p className="text-[10px] text-muted-foreground/70">{stat.vehiclePlate} {stat.vehicleType ?? ""}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center justify-center h-7 min-w-[28px] rounded-lg bg-primary/10 text-primary px-2 text-xs font-bold tabular-nums">
            {stat.orderCount}
          </span>
          <span className="text-xs font-semibold tabular-nums">
            {stat.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₾
          </span>
        </div>
      </div>

      {/* Load bars — only render if that capacity was actually configured */}
      <div className="space-y-2">
        {stat.hasLitersLimit && <LoadBar label={t("distLiters")} value={stat.totalLiters} max={stat.maxLiters} pct={stat.litersPct} />}
        {stat.hasKgLimit && <LoadBar label={t("distWeight")} value={stat.totalKg} max={stat.maxKg} pct={stat.kgPct} />}
        {stat.hasOrdersLimit && <LoadBar label={t("distOrders")} value={stat.orderCount} max={stat.maxOrders} pct={stat.ordersPct} />}
      </div>

      {/* View orders button */}
      <button
        type="button"
        className={cn(
          "flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-[11px] font-medium transition-all",
          "bg-muted/30 text-muted-foreground",
          "hover:bg-primary/10 hover:text-primary",
          "group-hover/card:bg-muted/40",
        )}
        onClick={(e) => {
          e.stopPropagation();
          onShowOrders?.();
        }}
      >
        {t("distViewOrders").replace("{n}", String(stat.orderCount))}
        <ArrowRight className="h-3 w-3 transition-transform group-hover/card:translate-x-0.5" />
      </button>
    </div>
  );
}
