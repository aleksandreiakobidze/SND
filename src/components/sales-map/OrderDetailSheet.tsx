"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Loader2, MapPin, Package, Trash2, Truck, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import type { DriverLoadStats, OrderDetail } from "@/lib/distribution/distribution-types";

function barGradient(pct: number): string {
  if (pct >= 100) return "bg-gradient-to-r from-red-500 to-red-400";
  if (pct >= 90) return "bg-gradient-to-r from-amber-500 to-amber-400";
  if (pct >= 70) return "bg-gradient-to-r from-emerald-500 to-emerald-400";
  return "bg-gradient-to-r from-sky-500 to-sky-400";
}

function MiniLoadBar({ pct, label }: { pct: number; label: string }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] text-muted-foreground w-14 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-muted/50">
        <div
          className={cn("h-full rounded-full transition-all duration-500", barGradient(pct))}
          style={{ width: `${Math.min(pct, 100)}%` }}
        />
      </div>
      <span className={cn(
        "text-[10px] tabular-nums w-12 text-right font-medium",
        pct >= 100 ? "text-red-500" : pct >= 90 ? "text-amber-500" : "text-muted-foreground",
      )}>{pct}%</span>
    </div>
  );
}

interface OrderRowProps {
  detail: OrderDetail;
  index: number;
  onRemove: (id: number) => void;
}

function OrderRow({ detail, index, onRemove }: OrderRowProps) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="group/order">
      {/* Order card */}
      <div className="flex items-start gap-3 px-4 py-3.5 hover:bg-muted/20 transition-colors">
        {/* Sequence + expand */}
        <button
          type="button"
          className="mt-0.5 shrink-0 flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded
            ? <ChevronDown className="h-3.5 w-3.5" />
            : <ChevronRight className="h-3.5 w-3.5" />}
        </button>

        {/* Order content */}
        <div className="flex-1 min-w-0 space-y-1.5">
          {/* Row 1: sequence, code, name */}
          <div className="flex items-baseline gap-2">
            <span className="text-xs tabular-nums text-muted-foreground font-medium shrink-0">{index + 1}.</span>
            <span className="text-[10px] font-mono bg-muted/50 rounded px-1.5 py-0.5 text-muted-foreground shrink-0">{detail.orgCode}</span>
            <span className="text-[13px] font-semibold truncate leading-tight">{detail.org}</span>
          </div>

          {/* Row 2: city + address */}
          {(detail.city || detail.address) && (
            <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0 opacity-50" />
              <span className="truncate">{[detail.city, detail.address].filter(Boolean).join(", ")}</span>
            </div>
          )}

          {/* Row 3: stats */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="text-sm font-bold tabular-nums text-foreground">
              {detail.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₾
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {detail.liters.toLocaleString(undefined, { maximumFractionDigits: 1 })} L
            </span>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {detail.kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
            </span>
            <span className="text-[10px] tabular-nums text-muted-foreground/50">#{detail.idReal1}</span>
          </div>
        </div>

        {/* Remove button */}
        <button
          type="button"
          className="shrink-0 mt-1 p-1.5 rounded-lg text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-all opacity-0 group-hover/order:opacity-100"
          onClick={() => onRemove(detail.idReal1)}
          title={t("distRemove")}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Product lines drill-down */}
      {expanded && (
        <div className="mx-4 mb-3 rounded-xl border border-border/30 bg-muted/10 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {detail.lines.length === 0 ? (
            <p className="px-4 py-3 text-xs text-muted-foreground flex items-center gap-2">
              <Package className="h-3.5 w-3.5" />
              {t("distOrderLinesEmpty")}
            </p>
          ) : (
            <div className="divide-y divide-border/20">
              {detail.lines.map((line, lineIdx) => (
                <div
                  key={line.idReal2}
                  className={cn(
                    "px-3 py-2.5 space-y-1 transition-colors hover:bg-muted/20",
                    lineIdx % 2 === 1 ? "bg-muted/[0.04]" : "",
                  )}
                >
                  {/* Line 1: code chip + product name */}
                  <div className="flex items-start gap-2">
                    <span className="shrink-0 mt-0.5 font-mono text-[10px] bg-muted/50 text-muted-foreground rounded px-1.5 py-0.5 leading-tight">
                      {line.prodCode}
                    </span>
                    <span className="text-[12px] font-medium leading-snug">{line.prod}</span>
                  </div>

                  {/* Line 2: numeric stats as inline chips */}
                  <div className="flex items-center flex-wrap gap-x-3 gap-y-1 pl-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {t("qty")}: <strong className="text-foreground tabular-nums">{line.qty.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                    </span>
                    <span className="text-border/50 select-none">·</span>
                    <span className="text-[11px] text-muted-foreground">
                      {t("price")}: <strong className="text-foreground tabular-nums">{line.price.toLocaleString(undefined, { maximumFractionDigits: 2 })}</strong>
                    </span>
                    <span className="text-border/50 select-none">·</span>
                    <span className="text-[11px] font-semibold tabular-nums">
                      {line.lineAmount.toLocaleString(undefined, { maximumFractionDigits: 2 })} ₾
                    </span>
                    <span className="text-border/50 select-none">·</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {line.liters.toLocaleString(undefined, { maximumFractionDigits: 1 })} L
                    </span>
                    <span className="text-border/50 select-none">·</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {line.kg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Separator */}
      <div className="mx-4 border-b border-border/50 last:border-0" />
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  stat: DriverLoadStats | null;
  driverColor: string;
  onRemoveOrder: (orderId: number) => void;
}

export function OrderDetailSheet({ open, onClose, stat, driverColor, onRemoveOrder }: Props) {
  const { t } = useLocale();
  const [details, setDetails] = useState<OrderDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !stat || stat.orderIds.length === 0) {
      setDetails([]);
      return;
    }
    let cancelled = false;
    async function load() {
      setLoading(true);
      setFetchError(null);
      try {
        const ids = stat!.orderIds.join(",");
        const res = await fetch(
          `/api/sales-map/order-details?ids=${encodeURIComponent(ids)}`,
          { credentials: "include" },
        );
        if (cancelled) return;
        if (!res.ok) {
          const j = await res.json().catch(() => ({}));
          setFetchError(j.error ?? "Failed to load");
          return;
        }
        const json = await res.json();
        if (!cancelled) {
          const map = new Map<number, OrderDetail>(
            (json.details as OrderDetail[]).map((d) => [d.idReal1, d]),
          );
          setDetails(stat!.orderIds.map((id) => map.get(id)).filter((d): d is OrderDetail => d !== undefined));
        }
      } catch (e) {
        if (!cancelled) setFetchError(e instanceof Error ? e.message : "Network error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [open, stat]);

  const visibleDetails = details.filter((d) => stat?.orderIds.includes(d.idReal1));

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" className="sm:max-w-2xl w-full flex flex-col p-0 gap-0">
        {/* Header */}
        <SheetHeader className="px-5 pt-5 pb-4 border-b border-border/30 space-y-4 bg-muted/5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="h-4 w-4 rounded-full shrink-0 shadow-sm ring-2 ring-background"
                style={{ backgroundColor: driverColor }}
              />
              <Truck className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold leading-tight truncate">
                  {stat?.driverName ?? ""}
                </SheetTitle>
                {stat?.vehiclePlate && (
                  <SheetDescription className="text-[11px] mt-0.5">
                    {stat.vehiclePlate} {stat.vehicleType ?? ""}
                  </SheetDescription>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="shrink-0 rounded-lg p-2 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Load bars — only render if that capacity was actually configured */}
          {stat && (
            <div className="space-y-2">
              {stat.hasLitersLimit && <MiniLoadBar pct={stat.litersPct} label={t("distLiters")} />}
              {stat.hasKgLimit && <MiniLoadBar pct={stat.kgPct} label={t("distWeight")} />}
              {stat.hasOrdersLimit && <MiniLoadBar pct={stat.ordersPct} label={t("distOrders")} />}

              {/* Summary stats */}
              <div className="flex items-center gap-1 pt-1">
                <div className="flex items-center gap-3 rounded-lg bg-muted/30 px-3 py-1.5 text-[11px] tabular-nums flex-wrap">
                  <span>{t("distOrders")}: <strong className="text-foreground">{stat.orderCount}</strong></span>
                  {stat.hasLitersLimit && (
                    <>
                      <span className="text-border">|</span>
                      <span>{t("distLiters")}: <strong className="text-foreground">{stat.totalLiters.toLocaleString(undefined, { maximumFractionDigits: 1 })}</strong></span>
                    </>
                  )}
                  {stat.hasKgLimit && (
                    <>
                      <span className="text-border">|</span>
                      <span>{t("distWeight")}: <strong className="text-foreground">{stat.totalKg.toLocaleString(undefined, { maximumFractionDigits: 1 })} kg</strong></span>
                    </>
                  )}
                  <span className="text-border">|</span>
                  <span>{t("amount")}: <strong className="text-foreground">{stat.totalAmount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ₾</strong></span>
                </div>
              </div>
            </div>
          )}
        </SheetHeader>

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">{t("distOrderLoading")}</p>
            </div>
          )}

          {fetchError && !loading && (
            <div className="mx-4 mt-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
              {fetchError}
            </div>
          )}

          {!loading && !fetchError && visibleDetails.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-muted-foreground">
              <Package className="h-8 w-8 opacity-30" />
              <p className="text-sm">{t("distOrderLinesEmpty")}</p>
            </div>
          )}

          {!loading && visibleDetails.length > 0 && (
            <div>
              {visibleDetails.map((detail, idx) => (
                <OrderRow
                  key={detail.idReal1}
                  detail={detail}
                  index={idx}
                  onRemove={onRemoveOrder}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
