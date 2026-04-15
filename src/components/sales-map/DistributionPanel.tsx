"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RotateCcw,
  Wand2,
  FileSpreadsheet,
  AlertTriangle,
  CalendarCheck,
  Truck,
  ExternalLink,
  Package,
  Hash,
  CreditCard,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { DistributionDriverCard } from "./DistributionDriverCard";
import { OrderDetailSheet } from "./OrderDetailSheet";
import { UnassignedOrderCard } from "./UnassignedOrderCard";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import type { DistributionPlan, OrderForDistribution, DriverLoadStats } from "@/lib/distribution/distribution-types";
import { downloadExcelFromRows } from "@/lib/export-excel";

const DRIVER_COLORS = [
  "#3b82f6", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#e11d48", "#0ea5e9", "#a855f7", "#22c55e",
];

export function driverColor(idx: number): string {
  return DRIVER_COLORS[idx % DRIVER_COLORS.length];
}

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}
function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}
function dayAfterStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  return d.toISOString().slice(0, 10);
}

interface FleetStatus {
  count: number;
  filtered: boolean;
}

interface Props {
  filtersKey: string;
  onPlanReady?: (plan: DistributionPlan, orders: OrderForDistribution[]) => void;
  onApplied?: () => void;
  highlightedOrderId?: number | null;
  onHoverOrder?: (orderId: number | null) => void;
  mapFilterDriverId?: number | null;
  onMapFilterDriverChange?: (driverId: number | null) => void;
}

export function DistributionPanel({
  filtersKey,
  onPlanReady,
  onApplied,
  mapFilterDriverId = null,
  onMapFilterDriverChange,
}: Props) {
  const { t } = useLocale();
  const [plan, setPlan] = useState<DistributionPlan | null>(null);
  const [orders, setOrders] = useState<OrderForDistribution[]>([]);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openSheetDriverIdx, setOpenSheetDriverIdx] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);
  const [unassignedOpen, setUnassignedOpen] = useState(true);

  const mapDate = useMemo(() => {
    const p = new URLSearchParams(filtersKey.replace(/^&/, ""));
    const d = p.get("dateFrom");
    return d && /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : todayStr();
  }, [filtersKey]);

  const [deliveryDate, setDeliveryDate] = useState<string>(() => mapDate);
  const [fleetStatus, setFleetStatus] = useState<FleetStatus | null>(null);
  const [fleetLoading, setFleetLoading] = useState(false);

  useEffect(() => {
    setDeliveryDate(mapDate);
    setPlan(null);
    setApplied(false);
  }, [mapDate]);

  useEffect(() => {
    let cancelled = false;
    async function loadFleet() {
      setFleetLoading(true);
      try {
        const res = await fetch(
          `/api/fleet-schedule?date=${encodeURIComponent(deliveryDate)}`,
          { credentials: "include" },
        );
        if (!res.ok || cancelled) return;
        const json = await res.json();
        const ids: number[] = json.scheduledIds ?? [];
        setFleetStatus({ count: ids.length, filtered: ids.length > 0 });
      } catch {
        setFleetStatus(null);
      } finally {
        if (!cancelled) setFleetLoading(false);
      }
    }
    void loadFleet();
    return () => { cancelled = true; };
  }, [deliveryDate]);

  async function runAutoDistribute() {
    setLoading(true);
    setError(null);
    setApplied(false);
    try {
      const res = await fetch("/api/sales-map/auto-distribute", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filters: filtersKey, deliveryDate }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.details || json.error || "Failed");
        return;
      }
      const p = json.plan as DistributionPlan;
      const o = (json.orders ?? []) as OrderForDistribution[];
      setPlan(p);
      setOrders(o);
      onPlanReady?.(p, o);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function applyDistribution() {
    if (!plan) return;
    setApplying(true);
    setError(null);
    try {
      const assignments: Record<string, number[]> = {};
      for (const stat of plan.driverStats) {
        if (stat.orderIds.length > 0) {
          assignments[String(stat.driverId)] = stat.orderIds;
        }
      }
      const res = await fetch("/api/sales-map/apply-distribution", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignments }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.details || json.error || "Failed to apply");
        return;
      }
      setApplied(true);
      onApplied?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setApplying(false);
    }
  }

  function handleRemoveOrder(driverId: number, orderId: number) {
    if (!plan) return;
    const updated: DriverLoadStats[] = plan.driverStats.map((s) => {
      if (s.driverId !== driverId) return s;
      const newIds = s.orderIds.filter((id) => id !== orderId);
      const order = orders.find((o) => o.idReal1 === orderId);
      const liters = s.totalLiters - (order?.liters ?? 0);
      const kg = s.totalKg - (order?.weightKg ?? 0);
      const amount = s.totalAmount - (order?.amount ?? 0);
      return {
        ...s,
        orderIds: newIds,
        orderCount: newIds.length,
        totalLiters: Math.max(0, liters),
        totalKg: Math.max(0, kg),
        totalAmount: Math.max(0, amount),
        litersPct: s.maxLiters > 0 ? Math.round((liters / s.maxLiters) * 1000) / 10 : 0,
        kgPct: s.maxKg > 0 ? Math.round((kg / s.maxKg) * 1000) / 10 : 0,
        ordersPct: s.maxOrders > 0 ? Math.round((newIds.length / s.maxOrders) * 1000) / 10 : 0,
      };
    });
    const newUnassigned = [...plan.unassigned, orderId];
    const newPlan: DistributionPlan = {
      ...plan,
      driverStats: updated,
      unassigned: newUnassigned,
      totalAssigned: plan.totalAssigned - 1,
    };
    setPlan(newPlan);
    onPlanReady?.(newPlan, orders);
  }

  function handleAssignOrder(orderId: number, driverId: number) {
    if (!plan) return;
    const order = orders.find((o) => o.idReal1 === orderId);
    const updated: DriverLoadStats[] = plan.driverStats.map((s) => {
      if (s.driverId !== driverId) return s;
      const newIds = [...s.orderIds, orderId];
      const liters = s.totalLiters + (order?.liters ?? 0);
      const kg = s.totalKg + (order?.weightKg ?? 0);
      const amount = s.totalAmount + (order?.amount ?? 0);
      return {
        ...s,
        orderIds: newIds,
        orderCount: newIds.length,
        totalLiters: liters,
        totalKg: kg,
        totalAmount: amount,
        litersPct: s.maxLiters > 0 ? Math.round((liters / s.maxLiters) * 1000) / 10 : 0,
        kgPct: s.maxKg > 0 ? Math.round((kg / s.maxKg) * 1000) / 10 : 0,
        ordersPct: s.maxOrders > 0 ? Math.round((newIds.length / s.maxOrders) * 1000) / 10 : 0,
      };
    });
    const newUnassigned = plan.unassigned.filter((id) => id !== orderId);
    const newPlan: DistributionPlan = {
      ...plan,
      driverStats: updated,
      unassigned: newUnassigned,
      totalAssigned: plan.totalAssigned + 1,
    };
    setPlan(newPlan);
    onPlanReady?.(newPlan, orders);
  }

  async function handleExport() {
    if (!plan) return;
    setExporting(true);
    try {
      const rows: Record<string, unknown>[] = [];
      for (const stat of plan.driverStats) {
        for (const orderId of stat.orderIds) {
          const order = orders.find((o) => o.idReal1 === orderId);
          rows.push({
            [t("drivers")]: stat.driverName,
            [t("distVehicle")]: stat.vehiclePlate ?? "",
            "IdReal1": orderId,
            [t("distCustomer")]: order?.org ?? "",
            [t("distRegion")]: order?.reg ?? "",
            [t("distLiters")]: order?.liters ?? 0,
            [t("distWeight")]: order?.weightKg ?? 0,
            [t("amount")]: order?.amount ?? 0,
            [t("distDeliveryDate")]: deliveryDate,
          });
        }
      }
      if (rows.length > 0) {
        await downloadExcelFromRows(rows, `distribution_plan_${deliveryDate}`, {
          sheetName: "Distribution",
        });
      }
    } finally {
      setExporting(false);
    }
  }

  const hasOverCapacity = plan?.driverStats.some(
    (s) =>
      (s.hasLitersLimit && s.litersPct >= 100) ||
      (s.hasKgLimit && s.kgPct >= 100) ||
      (s.hasOrdersLimit && s.ordersPct >= 100),
  );

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm">
      {/* Accent bar */}
      <div className="absolute inset-y-0 left-0 w-1 rounded-l-2xl bg-gradient-to-b from-primary via-primary/60 to-primary/20" />

      {/* Header */}
      <div className="px-5 pt-5 pb-4 space-y-4 border-b border-border/30">
        {/* Title row + primary actions */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary/10 shrink-0">
              <Wand2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold truncate">{t("distTitle")}</h3>
              <p className="text-[11px] text-muted-foreground truncate">{t("distDesc")}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              type="button"
              size="sm"
              className="gap-1.5 h-8 text-xs rounded-lg"
              onClick={() => void runAutoDistribute()}
              disabled={loading || applying}
            >
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
              {loading ? t("distCalculating") : t("distAutoDistribute")}
            </Button>
            {plan && !applied && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8 text-xs rounded-lg"
                  onClick={() => void runAutoDistribute()}
                  disabled={loading || applying}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {t("distRedistribute")}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="gap-1.5 h-8 text-xs rounded-lg"
                  onClick={() => void handleExport()}
                  disabled={exporting || loading}
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {exporting ? t("loading") : t("exportExcel")}
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  className="gap-1.5 h-8 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white"
                  onClick={() => void applyDistribution()}
                  disabled={applying || loading}
                >
                  {applying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {applying ? t("distApplying") : t("distApply")}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Date selection + fleet badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarCheck className="h-3.5 w-3.5" />
            <span className="font-medium text-foreground">{t("distDeliveryDate")}:</span>
          </div>
          <div className="inline-flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5 gap-0.5">
            {[
              { label: t("today"), value: todayStr() },
              { label: t("tomorrow"), value: tomorrowStr() },
              { label: t("dayAfter"), value: dayAfterStr() },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={cn(
                  "rounded-md px-3 py-1 text-[11px] font-medium transition-all",
                  deliveryDate === opt.value
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => {
                  setDeliveryDate(opt.value);
                  setPlan(null);
                  setApplied(false);
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <input
            type="date"
            className="rounded-lg border border-border/40 bg-background px-2.5 py-1 text-[11px] text-foreground h-7"
            value={deliveryDate}
            min={todayStr()}
            onChange={(e) => {
              setDeliveryDate(e.target.value);
              setPlan(null);
              setApplied(false);
            }}
          />

          {/* Fleet status badge */}
          {fleetLoading ? (
            <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
          ) : fleetStatus?.filtered ? (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              <Truck className="h-3 w-3" />
              {t("distFleetReady").replace("{n}", String(fleetStatus.count))}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-3 w-3" />
              {t("distNoFleet")}
              <Link
                href="/fleet-schedule"
                className="underline hover:text-foreground transition-colors inline-flex items-center gap-0.5"
              >
                {t("distSetupFleet")}
                <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4 space-y-4">
        {error && (
          <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {applied && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" />
            {t("distApplied")}
          </div>
        )}

        {hasOverCapacity && !applied && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm text-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
            <span className="text-xs">{t("distOverCapacityWarning")}</span>
          </div>
        )}

        {plan && (
          <div className="animate-in fade-in slide-in-from-bottom-3 duration-300 space-y-4">
            {/* Driver cards grid */}
            <div className={cn("grid gap-3", plan.driverStats.length > 3 ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2")}>
              {plan.driverStats.map((stat, idx) => (
                <DistributionDriverCard
                  key={stat.driverId}
                  stat={stat}
                  color={driverColor(idx)}
                  selected={mapFilterDriverId === stat.driverId}
                  onSelectForMap={() => {
                    onMapFilterDriverChange?.(
                      mapFilterDriverId === stat.driverId ? null : stat.driverId,
                    );
                  }}
                  onShowOrders={() => setOpenSheetDriverIdx(idx)}
                />
              ))}
            </div>

            {/* Order detail sheet */}
            <OrderDetailSheet
              open={openSheetDriverIdx !== null}
              onClose={() => setOpenSheetDriverIdx(null)}
              stat={openSheetDriverIdx !== null ? (plan.driverStats[openSheetDriverIdx] ?? null) : null}
              driverColor={openSheetDriverIdx !== null ? driverColor(openSheetDriverIdx) : "#888"}
              onRemoveOrder={(orderId) => {
                if (openSheetDriverIdx === null) return;
                const stat = plan.driverStats[openSheetDriverIdx];
                if (stat) handleRemoveOrder(stat.driverId, orderId);
              }}
            />

            {/* Summary bar */}
            <div className="flex items-center gap-4 rounded-xl bg-muted/20 border border-border/30 px-4 py-2.5">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Hash className="h-3 w-3" />
                <span>{t("distTotalOrders")}:</span>
                <strong className="text-foreground">{plan.totalOrders}</strong>
              </div>
              <div className="h-3 w-px bg-border/50" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Package className="h-3 w-3" />
                <span>{t("distAssigned")}:</span>
                <strong className="text-foreground">{plan.totalAssigned}</strong>
              </div>
              {plan.unassigned.length > 0 && (
                <>
                  <div className="h-3 w-px bg-border/50" />
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-3 w-3" />
                    <span>{t("distUnassigned")}:</span>
                    <strong>{plan.unassigned.length}</strong>
                  </div>
                </>
              )}
              <div className="h-3 w-px bg-border/50" />
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <CreditCard className="h-3 w-3" />
                <span>{t("distDeliveryDate")}:</span>
                <strong className="text-foreground">{deliveryDate}</strong>
              </div>
            </div>

            {/* Unassigned orders section */}
            {plan.unassigned.length > 0 && (
              <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.03] overflow-hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-sm font-medium text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 transition-colors"
                  onClick={() => setUnassignedOpen((v) => !v)}
                >
                  <span className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    {t("distUnassignedOrders")} ({plan.unassigned.length})
                  </span>
                  {unassignedOpen
                    ? <ChevronUp className="h-4 w-4" />
                    : <ChevronDown className="h-4 w-4" />
                  }
                </button>

                {unassignedOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    {plan.unassigned.map((orderId) => {
                      const order = orders.find((o) => o.idReal1 === orderId);
                      if (!order) return null;
                      return (
                        <UnassignedOrderCard
                          key={orderId}
                          orderId={orderId}
                          order={order}
                          driverStats={plan.driverStats}
                          driverColors={plan.driverStats.map((_, idx) => driverColor(idx))}
                          onAssign={handleAssignOrder}
                        />
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {!plan && !loading && !error && (
          <div className="flex flex-col items-center justify-center gap-3 py-10 text-muted-foreground">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-muted/30">
              <Wand2 className="h-5 w-5 opacity-50" />
            </div>
            <p className="text-sm">{t("distHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
