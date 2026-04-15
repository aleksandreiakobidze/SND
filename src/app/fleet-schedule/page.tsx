"use client";

import { useCallback, useEffect, useState } from "react";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CheckCircle2, Copy, Loader2, Truck, Users } from "lucide-react";
import { driverColor } from "@/components/sales-map/DistributionPanel";

interface VehicleRow {
  id: number;
  displayName: string;
  maxLiters: number | null;
  maxKg: number | null;
  maxOrders: number | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
}

interface UpcomingEntry {
  date: string;
  count: number;
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

function formatDateLabel(dateStr: string): string {
  const today = todayStr();
  const tomorrow = tomorrowStr();
  const dayAfter = dayAfterStr();
  const locale = typeof navigator !== "undefined" ? navigator.language : "en";
  const label = new Date(dateStr + "T00:00:00").toLocaleDateString(locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  if (dateStr === today) return `Today — ${label}`;
  if (dateStr === tomorrow) return `Tomorrow — ${label}`;
  if (dateStr === dayAfter) return `Day after — ${label}`;
  return label;
}

export default function FleetSchedulePage() {
  const { t } = useLocale();
  const { permissions } = useAuth();
  const { canAssignSalesDriver } = useAuthCapabilities(permissions);

  const [selectedDate, setSelectedDate] = useState<string>(tomorrowStr());
  const [allDrivers, setAllDrivers] = useState<VehicleRow[]>([]);
  const [checkedIds, setCheckedIds] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copying, setCopying] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingEntry[]>([]);
  const [search, setSearch] = useState("");

  const loadFleetForDate = useCallback(async (date: string) => {
    setLoading(true);
    setSaveMsg(null);
    try {
      const res = await fetch(`/api/fleet-schedule?date=${encodeURIComponent(date)}`, {
        credentials: "include",
      });
      const json = await res.json();
      if (!res.ok) return;
      setAllDrivers(json.drivers ?? []);
      setCheckedIds(new Set<number>((json.scheduledIds ?? []).map(Number)));
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUpcoming = useCallback(async () => {
    try {
      const res = await fetch("/api/fleet-schedule", { credentials: "include" });
      const json = await res.json();
      setUpcoming(json.upcoming ?? []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    void loadFleetForDate(selectedDate);
  }, [selectedDate, loadFleetForDate]);

  useEffect(() => {
    void loadUpcoming();
  }, [loadUpcoming]);

  async function saveFleet() {
    setSaving(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/fleet-schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, driverIds: [...checkedIds] }),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveMsg({ ok: false, text: json.error ?? "Save failed" });
        return;
      }
      setSaveMsg({ ok: true, text: t("fleetSaved").replace("{n}", String(json.count)).replace("{date}", selectedDate) });
      void loadUpcoming();
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setSaving(false);
    }
  }

  async function copyFromToday() {
    setCopying(true);
    setSaveMsg(null);
    try {
      const res = await fetch("/api/fleet-schedule", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromDate: todayStr(), toDate: selectedDate }),
      });
      const json = await res.json();
      if (res.ok) {
        await loadFleetForDate(selectedDate);
        void loadUpcoming();
      } else {
        setSaveMsg({ ok: false, text: json.error ?? "Copy failed" });
      }
    } catch (e) {
      setSaveMsg({ ok: false, text: e instanceof Error ? e.message : "Network error" });
    } finally {
      setCopying(false);
    }
  }

  function toggleDriver(id: number) {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSaveMsg(null);
  }

  function selectAll() {
    setCheckedIds(new Set(filteredDrivers.map((d) => d.id)));
    setSaveMsg(null);
  }
  function clearAll() {
    setCheckedIds(new Set());
    setSaveMsg(null);
  }

  const filteredDrivers = allDrivers.filter((d) =>
    search === "" ||
    d.displayName.toLowerCase().includes(search.toLowerCase()) ||
    (d.vehiclePlate ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  if (!canAssignSalesDriver) {
    return (
      <main className="relative min-h-screen">
        <PageGradientBackdrop />
        <div className="relative z-10 px-4 py-16 text-center text-muted-foreground">
          {t("permissionDenied")}
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-screen">
      <PageGradientBackdrop />
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-8 space-y-6">
        <PageHeader
          title={t("fleetSchedule")}
          description={t("fleetScheduleDesc")}
        />

        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          {/* Main fleet selector card */}
          <Card className="border-border/60">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    {t("fleetSelectVehicles")}
                  </CardTitle>
                  <CardDescription className="mt-1">{t("fleetSelectDesc")}</CardDescription>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {/* Quick date buttons */}
                  {[
                    { label: t("today"), value: todayStr() },
                    { label: t("tomorrow"), value: tomorrowStr() },
                    { label: t("dayAfter"), value: dayAfterStr() },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      className={cn(
                        "rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors",
                        selectedDate === opt.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted",
                      )}
                      onClick={() => setSelectedDate(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                  <input
                    type="date"
                    className="rounded-lg border border-border/60 bg-background px-2 py-1.5 text-xs text-foreground"
                    value={selectedDate}
                    min={todayStr()}
                    onChange={(e) => setSelectedDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <div className="flex-1 min-w-[180px]">
                  <Input
                    className="h-8 text-sm"
                    placeholder={t("fleetSearchPlaceholder")}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
                <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={selectAll}>
                  <Users className="h-3 w-3" />{t("fleetSelectAll")}
                </Button>
                <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearAll}>
                  {t("fleetClearAll")}
                </Button>
                {selectedDate !== todayStr() && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1 text-xs"
                    onClick={() => void copyFromToday()}
                    disabled={copying}
                  >
                    {copying ? <Loader2 className="h-3 w-3 animate-spin" /> : <Copy className="h-3 w-3" />}
                    {t("fleetCopyFromToday")}
                  </Button>
                )}
              </div>
            </CardHeader>

            <CardContent className="space-y-2">
              {saveMsg && (
                <div
                  className={cn(
                    "rounded-xl border px-4 py-3 text-sm flex items-center gap-2",
                    saveMsg.ok
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                      : "border-destructive/40 bg-destructive/10 text-destructive",
                  )}
                >
                  {saveMsg.ok && <CheckCircle2 className="h-4 w-4" />}
                  {saveMsg.text}
                </div>
              )}

              {/* Summary bar */}
              <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/20 px-4 py-2 text-xs">
                <span className="text-muted-foreground">
                  <strong className="text-foreground">{checkedIds.size}</strong> / {allDrivers.length} {t("fleetVehiclesSelected")}
                </span>
                <Button
                  size="sm"
                  className="h-7 px-3 gap-1 text-xs"
                  onClick={() => void saveFleet()}
                  disabled={saving || loading}
                >
                  {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  {saving ? t("saving") : t("fleetSaveBtn").replace("{date}", formatDateLabel(selectedDate))}
                </Button>
              </div>

              {loading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-14 w-full rounded-xl" />
                  ))}
                </div>
              ) : filteredDrivers.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">{t("fleetNoDrivers")}</p>
              ) : (
                <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-1">
                  {filteredDrivers.map((d, idx) => {
                    const checked = checkedIds.has(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={cn(
                          "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                          checked
                            ? "border-primary/40 bg-primary/5"
                            : "border-border/40 bg-card hover:bg-muted/30",
                        )}
                        onClick={() => toggleDriver(d.id)}
                      >
                        {/* checkbox indicator */}
                        <div
                          className={cn(
                            "h-5 w-5 shrink-0 rounded border-2 flex items-center justify-center transition-colors",
                            checked
                              ? "border-primary bg-primary"
                              : "border-muted-foreground/40 bg-background",
                          )}
                        >
                          {checked && (
                            <svg className="h-3 w-3 text-primary-foreground" viewBox="0 0 12 12" fill="currentColor">
                              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        <div
                          className="h-3 w-3 rounded-full shrink-0"
                          style={{ backgroundColor: driverColor(idx) }}
                        />

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{d.displayName}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {d.vehiclePlate ?? "—"}
                            {d.vehicleType ? ` · ${d.vehicleType}` : ""}
                          </p>
                        </div>

                        <div className="text-right shrink-0 space-y-0.5">
                          {d.maxLiters != null && (
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {d.maxLiters.toLocaleString()} L
                            </p>
                          )}
                          {d.maxKg != null && (
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {d.maxKg.toLocaleString()} kg
                            </p>
                          )}
                          {d.maxOrders != null && (
                            <p className="text-[10px] text-muted-foreground tabular-nums">
                              {d.maxOrders} {t("distOrders")}
                            </p>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming fleets sidebar */}
          <div className="space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{t("fleetUpcomingTitle")}</CardTitle>
                <CardDescription className="text-xs">{t("fleetUpcomingDesc")}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {upcoming.length === 0 ? (
                  <p className="text-xs text-muted-foreground">{t("fleetNoScheduled")}</p>
                ) : (
                  upcoming.map((e) => (
                    <button
                      key={e.date}
                      type="button"
                      className={cn(
                        "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors",
                        selectedDate === e.date
                          ? "border-primary/40 bg-primary/10"
                          : "border-border/40 bg-muted/20 hover:bg-muted/40",
                      )}
                      onClick={() => setSelectedDate(e.date)}
                    >
                      <span className="text-muted-foreground">{formatDateLabel(e.date)}</span>
                      <span className="font-medium tabular-nums text-foreground">{e.count} {t("fleetVehiclesCount")}</span>
                    </button>
                  ))
                )}
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardContent className="pt-4 text-xs text-muted-foreground space-y-2">
                <p className="font-medium text-foreground">{t("fleetHowItWorksTitle")}</p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>{t("fleetHint1")}</li>
                  <li>{t("fleetHint2")}</li>
                  <li>{t("fleetHint3")}</li>
                </ol>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </main>
  );
}
