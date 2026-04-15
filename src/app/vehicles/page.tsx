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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { CheckCircle2, Loader2, Pencil, X, Truck } from "lucide-react";

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

  useEffect(() => {
    void loadVehicles();
  }, [loadVehicles]);

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
