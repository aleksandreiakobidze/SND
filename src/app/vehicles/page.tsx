"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Pencil, X, Truck, ChevronDown } from "lucide-react";

interface VehicleRow {
  id: number;
  displayName: string;
  maxLiters: number | null;
  maxKg: number | null;
  maxOrders: number | null;
  vehiclePlate: string | null;
  vehicleType: string | null;
}

interface EditState {
  maxLiters: string;
  maxKg: string;
  maxOrders: string;
  vehiclePlate: string;
  vehicleType: string;
}

function toEditState(v: VehicleRow): EditState {
  return {
    maxLiters: v.maxLiters != null ? String(v.maxLiters) : "",
    maxKg: v.maxKg != null ? String(v.maxKg) : "",
    maxOrders: v.maxOrders != null ? String(v.maxOrders) : "",
    vehiclePlate: v.vehiclePlate ?? "",
    vehicleType: v.vehicleType ?? "",
  };
}

function CapacityBar({ value, max, unit }: { value: number | null; max: number | null; unit: string }) {
  if (!max || max <= 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const pct = Math.min(100, Math.round(((value ?? 0) / max) * 100));
  return (
    <div className="flex items-center gap-2 min-w-[80px]">
      <div className="h-1.5 w-16 rounded-full bg-muted">
        <div className="h-full rounded-full bg-sky-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs tabular-nums text-muted-foreground">
        {max.toLocaleString()} {unit}
      </span>
    </div>
  );
}

function RegionCell({
  driverId,
  regions,
  availableRegions,
  onUpdate,
}: {
  driverId: number;
  regions: string[];
  availableRegions: string[];
  onUpdate: (driverId: number, regions: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  async function toggle(code: string) {
    const next = regions.includes(code)
      ? regions.filter((r) => r !== code)
      : [...regions, code];
    setSaving(true);
    try {
      const res = await fetch(`/api/vehicles/${driverId}/regions`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regions: next }),
      });
      if (res.ok) onUpdate(driverId, next);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        onClick={() => setOpen((p) => !p)}
      >
        {regions.length === 0 ? (
          <span className="italic text-border">All regions</span>
        ) : (
          <span className="flex flex-wrap gap-1 max-w-[180px]">
            {regions.slice(0, 3).map((r) => (
              <Badge key={r} variant="secondary" className="text-[10px] px-1.5 py-0">
                {r}
              </Badge>
            ))}
            {regions.length > 3 && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                +{regions.length - 3}
              </Badge>
            )}
          </span>
        )}
        <ChevronDown className="h-3 w-3 shrink-0" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-52 rounded-lg border bg-popover p-1 shadow-md max-h-60 overflow-y-auto">
          {availableRegions.length === 0 ? (
            <p className="px-2 py-1.5 text-xs text-muted-foreground">No regions found</p>
          ) : (
            availableRegions.map((code) => (
              <label
                key={code}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent cursor-pointer"
              >
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 rounded border-border"
                  checked={regions.includes(code)}
                  disabled={saving}
                  onChange={() => void toggle(code)}
                />
                {code}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export default function VehiclesPage() {
  const { t } = useLocale();
  const { permissions } = useAuth();
  const { canAssignSalesDriver } = useAuthCapabilities(permissions);

  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  const [driverRegions, setDriverRegions] = useState<Record<number, string[]>>({});
  const [availableRegions, setAvailableRegions] = useState<string[]>([]);

  const loadVehicles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/vehicles", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Failed to load vehicles");
        return;
      }
      setVehicles(json.vehicles ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRegions = useCallback(async () => {
    try {
      const [regRes, allRes] = await Promise.all([
        fetch("/api/regions", { credentials: "include" }),
        fetch("/api/vehicles", { credentials: "include" }),
      ]);
      if (regRes.ok) {
        const json = await regRes.json();
        setAvailableRegions(json.regions ?? []);
      }
      const vehicleList: VehicleRow[] = allRes.ok ? (await allRes.json()).vehicles ?? [] : [];
      const map: Record<number, string[]> = {};
      await Promise.all(
        vehicleList.map(async (v) => {
          try {
            const r = await fetch(`/api/vehicles/${v.id}/regions`, { credentials: "include" });
            if (r.ok) {
              const j = await r.json();
              map[v.id] = j.regions ?? [];
            }
          } catch { /* ignore */ }
        }),
      );
      setDriverRegions(map);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    void loadVehicles();
    void loadRegions();
  }, [loadVehicles, loadRegions]);

  function startEdit(v: VehicleRow) {
    setEditingId(v.id);
    setEditState(toEditState(v));
    setSaveMsg(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditState(null);
  }

  async function saveEdit(id: number) {
    if (!editState) return;
    setSaving(true);
    setSaveMsg(null);
    try {
      const body = {
        maxLiters: editState.maxLiters !== "" ? parseFloat(editState.maxLiters) : null,
        maxKg: editState.maxKg !== "" ? parseFloat(editState.maxKg) : null,
        maxOrders: editState.maxOrders !== "" ? parseInt(editState.maxOrders, 10) : null,
        vehiclePlate: editState.vehiclePlate || null,
        vehicleType: editState.vehicleType || null,
      };
      const res = await fetch(`/api/vehicles/${id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) {
        setSaveMsg(json.error ?? "Save failed");
        return;
      }
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === id
            ? {
                ...v,
                maxLiters: body.maxLiters,
                maxKg: body.maxKg,
                maxOrders: body.maxOrders,
                vehiclePlate: body.vehiclePlate,
                vehicleType: body.vehicleType,
              }
            : v,
        ),
      );
      setEditingId(null);
      setEditState(null);
    } catch (e) {
      setSaveMsg(e instanceof Error ? e.message : "Network error");
    } finally {
      setSaving(false);
    }
  }

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
      <div className="relative z-10 mx-auto max-w-6xl px-4 py-8 space-y-6">
        <PageHeader
          title={t("vehicles")}
          description={t("vehiclesPageDesc")}
        />

        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">{t("vehicleCapacityTitle")}</CardTitle>
                <CardDescription className="mt-1">{t("vehicleCapacityDesc")}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => void loadVehicles()} disabled={loading}>
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : t("refresh")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && (
              <div className="mb-4 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
            )}

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : vehicles.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">{t("vehiclesEmpty")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("driverName")}</TableHead>
                      <TableHead>{t("vehiclePlate")}</TableHead>
                      <TableHead>{t("vehicleType")}</TableHead>
                      <TableHead>{t("distLiters")} (max)</TableHead>
                      <TableHead>{t("distWeight")} (max)</TableHead>
                      <TableHead>{t("distOrders")} (max)</TableHead>
                      <TableHead>Regions</TableHead>
                      <TableHead className="w-24" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vehicles.map((v) => {
                      const isEditing = editingId === v.id;
                      return (
                        <TableRow key={v.id} className={cn(isEditing && "bg-muted/30")}>
                          <TableCell className="font-medium">{v.displayName}</TableCell>

                          {isEditing && editState ? (
                            <>
                              <TableCell>
                                <Input
                                  className="h-7 text-sm w-28"
                                  value={editState.vehiclePlate}
                                  placeholder="AA-123-BB"
                                  onChange={(e) =>
                                    setEditState((s) => s ? { ...s, vehiclePlate: e.target.value } : s)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  className="h-7 text-sm w-32"
                                  value={editState.vehicleType}
                                  placeholder={t("vehicleTypePlaceholder")}
                                  onChange={(e) =>
                                    setEditState((s) => s ? { ...s, vehicleType: e.target.value } : s)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-7 text-sm w-24"
                                  value={editState.maxLiters}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setEditState((s) => s ? { ...s, maxLiters: e.target.value } : s)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-7 text-sm w-24"
                                  value={editState.maxKg}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setEditState((s) => s ? { ...s, maxKg: e.target.value } : s)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min={0}
                                  className="h-7 text-sm w-20"
                                  value={editState.maxOrders}
                                  placeholder="0"
                                  onChange={(e) =>
                                    setEditState((s) => s ? { ...s, maxOrders: e.target.value } : s)
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <RegionCell
                                  driverId={v.id}
                                  regions={driverRegions[v.id] ?? []}
                                  availableRegions={availableRegions}
                                  onUpdate={(id, regs) =>
                                    setDriverRegions((prev) => ({ ...prev, [id]: regs }))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    size="sm"
                                    className="h-7 px-2 gap-1 text-xs"
                                    onClick={() => void saveEdit(v.id)}
                                    disabled={saving}
                                  >
                                    {saving ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : (
                                      <CheckCircle2 className="h-3 w-3" />
                                    )}
                                    {t("save")}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 px-2"
                                    onClick={cancelEdit}
                                    disabled={saving}
                                  >
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                                {saveMsg && (
                                  <p className="text-[10px] text-destructive mt-1">{saveMsg}</p>
                                )}
                              </TableCell>
                            </>
                          ) : (
                            <>
                              <TableCell className="text-sm text-muted-foreground">
                                {v.vehiclePlate ?? <span className="text-border">—</span>}
                              </TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {v.vehicleType ?? <span className="text-border">—</span>}
                              </TableCell>
                              <TableCell>
                                <CapacityBar value={null} max={v.maxLiters} unit="L" />
                              </TableCell>
                              <TableCell>
                                <CapacityBar value={null} max={v.maxKg} unit="kg" />
                              </TableCell>
                              <TableCell className="text-sm tabular-nums text-muted-foreground">
                                {v.maxOrders != null ? v.maxOrders : <span className="text-border">—</span>}
                              </TableCell>
                              <TableCell>
                                <RegionCell
                                  driverId={v.id}
                                  regions={driverRegions[v.id] ?? []}
                                  availableRegions={availableRegions}
                                  onUpdate={(id, regs) =>
                                    setDriverRegions((prev) => ({ ...prev, [id]: regs }))
                                  }
                                />
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 gap-1 text-xs"
                                  onClick={() => startEdit(v)}
                                >
                                  <Pencil className="h-3 w-3" />
                                  {t("vehicleEdit")}
                                </Button>
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
