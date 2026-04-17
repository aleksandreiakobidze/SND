"use client";

import { useState } from "react";
import { AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import type { DriverLoadStats, OrderForDistribution } from "@/lib/distribution/distribution-types";

interface CapacityWarning {
  liters: boolean;
  kg: boolean;
  pallets: boolean;
  orders: boolean;
}

function wouldExceed(stat: DriverLoadStats, order: OrderForDistribution): CapacityWarning {
  return {
    liters: stat.maxLiters > 0 && stat.totalLiters + order.liters > stat.maxLiters,
    kg: stat.maxKg > 0 && stat.totalKg + order.weightKg > stat.maxKg,
    pallets:
      stat.hasPalletsLimit &&
      stat.maxPallets > 0 &&
      stat.totalPallets + order.pallets > stat.maxPallets,
    orders: stat.maxOrders > 0 && stat.orderCount + 1 > stat.maxOrders,
  };
}

function remainingCapacity(stat: DriverLoadStats): {
  liters: number;
  kg: number;
  pallets: number;
  orders: number;
} {
  return {
    liters: Math.max(0, stat.maxLiters - stat.totalLiters),
    kg: Math.max(0, stat.maxKg - stat.totalKg),
    pallets:
      stat.hasPalletsLimit && stat.maxPallets > 0
        ? Math.max(0, stat.maxPallets - stat.totalPallets)
        : 0,
    orders: Math.max(0, stat.maxOrders - stat.orderCount),
  };
}

interface Props {
  orderId: number;
  order: OrderForDistribution;
  driverStats: DriverLoadStats[];
  driverColors: string[];
  onAssign: (orderId: number, driverId: number) => void;
}

export function UnassignedOrderCard({ orderId, order, driverStats, driverColors, onAssign }: Props) {
  const { t } = useLocale();
  const [selectedDriverId, setSelectedDriverId] = useState<number | "">(
    driverStats.length > 0 ? driverStats[0].driverId : "",
  );

  const selectedStat = driverStats.find((s) => s.driverId === selectedDriverId) ?? null;
  const warning = selectedStat ? wouldExceed(selectedStat, order) : null;
  const hasWarning = warning
    ? warning.liters || warning.kg || warning.pallets || warning.orders
    : false;

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2.5">
      {/* Order info */}
      <div className="space-y-0.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono text-muted-foreground">{order.orgCode}</span>
          <span className="text-sm font-medium truncate">{order.org}</span>
        </div>
        {order.city && (
          <p className="text-[11px] text-muted-foreground">{order.city}</p>
        )}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground tabular-nums pt-0.5">
          <span className="font-medium text-foreground">
            {order.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₾
          </span>
          <span>{order.liters.toLocaleString(undefined, { maximumFractionDigits: 1 })} L</span>
          <span>{order.weightKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</span>
          <span className="text-[10px] text-muted-foreground/80">
            {order.pallets.toLocaleString(undefined, { maximumFractionDigits: 1 })} {t("distPallets")}
          </span>
          <span className="text-[10px] text-muted-foreground/60">#{orderId}</span>
        </div>
      </div>

      {/* Driver select + assign */}
      <div className="flex items-start gap-2">
        <div className="flex-1 space-y-1.5">
          <select
            className="w-full rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value ? Number(e.target.value) : "")}
          >
            {driverStats.length === 0 && (
              <option value="">{t("distAssignTo")}</option>
            )}
            {driverStats.map((stat, idx) => {
              const rem = remainingCapacity(stat);
              const over = wouldExceed(stat, order);
              const isOver = over.liters || over.kg || over.pallets || over.orders;
              return (
                <option key={stat.driverId} value={stat.driverId}>
                  {isOver ? "⚠ " : ""}
                  {stat.driverName}
                  {stat.vehiclePlate ? ` (${stat.vehiclePlate})` : ""}
                  {" — "}
                  {rem.liters.toLocaleString(undefined, { maximumFractionDigits: 0 })}L /{" "}
                  {rem.kg.toLocaleString(undefined, { maximumFractionDigits: 0 })}kg
                  {stat.hasPalletsLimit && stat.maxPallets > 0
                    ? ` / ${rem.pallets.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${t("distPallets")}`
                    : ""}
                  {" / "}
                  {rem.orders} {t("distOrders").toLowerCase()}
                </option>
              );
            })}
          </select>

          {/* Capacity warning badges */}
          {hasWarning && warning && (
            <div className="flex flex-wrap gap-1">
              {warning.liters && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {t("distCapacityLitersOver")}
                </span>
              )}
              {warning.kg && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {t("distCapacityKgOver")}
                </span>
              )}
              {warning.orders && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {t("distCapacityOrdersOver")}
                </span>
              )}
              {warning.pallets && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-red-400/40 bg-red-400/10 px-1.5 py-0.5 text-[10px] font-medium text-red-600 dark:text-red-400">
                  <AlertTriangle className="h-2.5 w-2.5" />
                  {t("distCapacityPalletsOver")}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Assign button */}
        <button
          type="button"
          disabled={!selectedDriverId}
          onClick={() => {
            if (!selectedDriverId) return;
            onAssign(orderId, Number(selectedDriverId));
          }}
          className={cn(
            "shrink-0 inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
            hasWarning
              ? "border-amber-500/50 bg-amber-500/10 text-amber-700 hover:bg-amber-500/20 dark:text-amber-400"
              : "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400",
            !selectedDriverId && "opacity-40 cursor-not-allowed",
          )}
        >
          {hasWarning
            ? <AlertTriangle className="h-3 w-3" />
            : <CheckCircle2 className="h-3 w-3" />
          }
          {t("distAssign")}
        </button>
      </div>
    </div>
  );
}
