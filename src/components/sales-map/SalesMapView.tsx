"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocale } from "@/lib/locale-context";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatLiters } from "@/lib/formatLiters";
import { buildOrgTColorMap, colorForOrgT, normalizeOrgTLabel } from "@/lib/map-object-type-colors";
import { SalesMapRectSelect } from "@/components/sales-map/SalesMapRectSelect";
import { DriverSearchSelect } from "@/components/sales-map/DriverSearchSelect";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  BoxSelect,
  ChevronDown,
  ChevronUp,
  Eraser,
  FileSpreadsheet,
  RefreshCw,
  UserCheck,
} from "lucide-react";
import { downloadExcelFromRows } from "@/lib/export-excel";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DistributionPanel } from "@/components/sales-map/DistributionPanel";
import type { DistributionPlan, OrderForDistribution } from "@/lib/distribution/distribution-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { MAP_DEFAULT_CENTER_GEORGIA, MAP_DEFAULT_ZOOM_GEORGIA } from "@/lib/map-defaults";
import { fitMapToPoints } from "@/lib/map-viewport";

export type SalesMapPointRow = Record<string, unknown>;

const LINES_TABLE_MAX = 200;

const GLASS = "bg-background/80 backdrop-blur-xl border border-border/40 shadow-lg dark:bg-background/70";

function formatLineQty(v: unknown): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

function rowHasAssignedDriver(row: SalesMapPointRow): boolean {
  const mic = row.Micodeba;
  if (mic != null && mic !== "") {
    const m = Number(mic);
    if (Number.isFinite(m)) {
      if (m === 0) return true;
      if (m === 1) return false;
    }
  }
  const id = row.IdMdz;
  const n = id != null && id !== "" ? Number(id) : NaN;
  if (Number.isFinite(n) && n > 0) return true;
  const mz = row.Mdz;
  return mz != null && String(mz).trim() !== "";
}

/** Row belongs to a driver by DB IdMdz or by distribution preview order id list. */
function rowMatchesDistributionDriver(
  row: SalesMapPointRow,
  driverId: number,
  previewOrderIds: Set<number>,
): boolean {
  const idMdz = row.IdMdz != null && row.IdMdz !== "" ? Number(row.IdMdz) : NaN;
  if (Number.isFinite(idMdz) && idMdz === driverId) return true;
  const idReal = Number(row.IdReal1);
  if (Number.isFinite(idReal) && previewOrderIds.has(idReal)) return true;
  return false;
}

function FitBounds({ latLngs }: { latLngs: L.LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    fitMapToPoints(map, latLngs);
  }, [map, latLngs]);
  return null;
}

type BboxMode = "add" | "replace";
type MapDriverFilter = "all" | "assigned" | "unassigned";

type Props = {
  filtersKey: string;
  filtersReady: boolean;
};

export function SalesMapView({ filtersKey, filtersReady }: Props) {
  const { t } = useLocale();
  const { permissions } = useAuth();
  const { canAssignSalesDriver } = useAuthCapabilities(permissions);

  const [rows, setRows] = useState<SalesMapPointRow[]>([]);
  const [lineRows, setLineRows] = useState<SalesMapPointRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [rectMode, setRectMode] = useState(false);
  const [bboxMode, setBboxMode] = useState<BboxMode>("add");
  const [mapDriverFilter, setMapDriverFilter] = useState<MapDriverFilter>("all");

  const [drivers, setDrivers] = useState<{ id: number; displayName: string }[]>([]);
  const [driversWarning, setDriversWarning] = useState<string | null>(null);
  const [driverId, setDriverId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignMsg, setAssignMsg] = useState<string | null>(null);
  const [exportingLinesExcel, setExportingLinesExcel] = useState(false);
  const [linesOpen, setLinesOpen] = useState(false);

  const [distPlan, setDistPlan] = useState<DistributionPlan | null>(null);
  const [distOrders, setDistOrders] = useState<OrderForDistribution[]>([]);
  const [distHoveredOrder, setDistHoveredOrder] = useState<number | null>(null);
  const [mapFilterDriverId, setMapFilterDriverId] = useState<number | null>(null);

  const distOrderDriverMap = useMemo(() => {
    if (!distPlan) return new Map<number, number>();
    const m = new Map<number, number>();
    for (let i = 0; i < distPlan.driverStats.length; i++) {
      const stat = distPlan.driverStats[i];
      for (const oid of stat.orderIds) {
        m.set(oid, i);
      }
    }
    return m;
  }, [distPlan]);

  const moveOrderBetweenDrivers = useCallback(
    (orderId: number, targetDriverIdx: number) => {
      if (!distPlan) return;
      const order = distOrders.find((o) => o.idReal1 === orderId);
      if (!order) return;
      const updated = distPlan.driverStats.map((s, idx) => {
        if (s.orderIds.includes(orderId)) {
          const newIds = s.orderIds.filter((id) => id !== orderId);
          const liters = s.totalLiters - order.liters;
          const kg = s.totalKg - order.weightKg;
          return {
            ...s,
            orderIds: newIds,
            orderCount: newIds.length,
            totalLiters: Math.max(0, liters),
            totalKg: Math.max(0, kg),
            totalAmount: Math.max(0, s.totalAmount - order.amount),
            litersPct: s.maxLiters > 0 ? Math.round((liters / s.maxLiters) * 1000) / 10 : 0,
            kgPct: s.maxKg > 0 ? Math.round((kg / s.maxKg) * 1000) / 10 : 0,
            ordersPct: s.maxOrders > 0 ? Math.round((newIds.length / s.maxOrders) * 1000) / 10 : 0,
          };
        }
        if (idx === targetDriverIdx) {
          const newIds = [...s.orderIds, orderId];
          const liters = s.totalLiters + order.liters;
          const kg = s.totalKg + order.weightKg;
          return {
            ...s,
            orderIds: newIds,
            orderCount: newIds.length,
            totalLiters: liters,
            totalKg: kg,
            totalAmount: s.totalAmount + order.amount,
            litersPct: s.maxLiters > 0 ? Math.round((liters / s.maxLiters) * 1000) / 10 : 0,
            kgPct: s.maxKg > 0 ? Math.round((kg / s.maxKg) * 1000) / 10 : 0,
            ordersPct: s.maxOrders > 0 ? Math.round((newIds.length / s.maxOrders) * 1000) / 10 : 0,
          };
        }
        return s;
      });
      const newPlan: DistributionPlan = {
        ...distPlan,
        driverStats: updated,
        unassigned: distPlan.unassigned.filter((id) => id !== orderId),
      };
      setDistPlan(newPlan);
    },
    [distPlan, distOrders],
  );

  const loadPoints = useCallback(async () => {
    if (!filtersReady) return;
    try {
      setLoading(true);
      setError(null);
      const qs = filtersKey ? `?${filtersKey}` : "";
      const pointsUrl = `/api/sales-map/points${qs}`;
      const linesUrl = `/api/sales-map/lines${qs}`;
      const [pointsRes, linesRes] = await Promise.all([
        fetch(pointsUrl, { credentials: "include" }),
        fetch(linesUrl, { credentials: "include" }),
      ]);
      const pointsJson = await pointsRes.json();
      if (!pointsRes.ok) {
        throw new Error(
          typeof pointsJson.details === "string" && pointsJson.details.trim()
            ? pointsJson.details
            : typeof pointsJson.error === "string"
              ? pointsJson.error
              : "Request failed",
        );
      }
      setRows((pointsJson.data as SalesMapPointRow[]) || []);
      if (linesRes.ok) {
        const linesJson = await linesRes.json();
        setLineRows(Array.isArray(linesJson.data) ? (linesJson.data as SalesMapPointRow[]) : []);
      } else {
        setLineRows([]);
      }
      setAssignMsg(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setRows([]);
      setLineRows([]);
    } finally {
      setLoading(false);
    }
  }, [filtersKey, filtersReady]);

  useEffect(() => {
    void loadPoints();
  }, [loadPoints]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/drivers", { credentials: "include" });
        const json = await res.json();
        if (!res.ok) {
          setDrivers([]);
          setDriversWarning(null);
          return;
        }
        setDrivers(Array.isArray(json.drivers) ? json.drivers : []);
        setDriversWarning(typeof json.warning === "string" && json.warning.trim() ? json.warning : null);
      } catch {
        setDrivers([]);
        setDriversWarning(null);
      }
    })();
  }, []);

  useEffect(() => {
    setSelected(new Set());
    setMapFilterDriverId(null);
  }, [mapDriverFilter]);

  useEffect(() => {
    if (!distPlan) {
      setMapFilterDriverId(null);
      return;
    }
    if (mapFilterDriverId == null) return;
    if (!distPlan.driverStats.some((s) => s.driverId === mapFilterDriverId)) {
      setMapFilterDriverId(null);
    }
  }, [distPlan, mapFilterDriverId]);

  const driverNameById = useMemo(() => {
    const m = new Map<number, string>();
    for (const d of drivers) m.set(d.id, d.displayName);
    return m;
  }, [drivers]);

  const rowsFilteredByDriver = useMemo(() => {
    if (mapDriverFilter === "all") return rows;
    if (mapDriverFilter === "assigned") return rows.filter(rowHasAssignedDriver);
    return rows.filter((r) => !rowHasAssignedDriver(r));
  }, [rows, mapDriverFilter]);

  const previewOrderIdsByDriver = useMemo(() => {
    if (!distPlan || mapFilterDriverId == null) return null;
    const stat = distPlan.driverStats.find((s) => s.driverId === mapFilterDriverId);
    if (!stat) return null;
    return new Set(stat.orderIds);
  }, [distPlan, mapFilterDriverId]);

  const rowsForMap = useMemo(() => {
    if (mapFilterDriverId == null || !distPlan || previewOrderIdsByDriver == null) {
      return rowsFilteredByDriver;
    }
    return rowsFilteredByDriver.filter((row) =>
      rowMatchesDistributionDriver(row, mapFilterDriverId, previewOrderIdsByDriver),
    );
  }, [rowsFilteredByDriver, mapFilterDriverId, distPlan, previewOrderIdsByDriver]);

  const allowedOrderIdsForTable = useMemo(() => {
    const s = new Set<number>();
    for (const r of rowsForMap) {
      const id = Number(r.IdReal1);
      if (Number.isFinite(id)) s.add(id);
    }
    return s;
  }, [rowsForMap]);

  const linesForTable = useMemo(() => {
    const out: SalesMapPointRow[] = [];
    for (const line of lineRows) {
      const id = Number(line.IdReal1);
      if (!Number.isFinite(id) || !allowedOrderIdsForTable.has(id)) continue;
      out.push(line);
    }
    return out;
  }, [lineRows, allowedOrderIdsForTable]);

  const driverLabelForRow = useCallback(
    (row: SalesMapPointRow) => {
      const mdzFromRow = row.Mdz != null && String(row.Mdz).trim() !== "" ? String(row.Mdz).trim() : "";
      if (mdzFromRow) return mdzFromRow;
      const idMdz = row.IdMdz;
      const n = idMdz != null && idMdz !== "" ? Number(idMdz) : NaN;
      if (Number.isFinite(n) && n > 0) return driverNameById.get(n) ?? `#${n}`;
      return "—";
    },
    [driverNameById],
  );

  const linesExcelRows = useMemo(() => {
    const dk = t("drivers");
    const pk = t("productCode");
    const nk = t("productName");
    const qk = t("qty");
    return linesForTable.map((line) => {
      const ra = line.Raod;
      const qty = ra != null && Number.isFinite(Number(ra)) ? Number(ra) : "";
      return {
        [dk]: driverLabelForRow(line),
        [pk]:
          line.IdProd != null && String(line.IdProd).trim() !== ""
            ? String(line.IdProd)
            : "",
        [nk]: String(line.Prod ?? ""),
        [qk]: qty,
      } as Record<string, unknown>;
    });
  }, [linesForTable, driverLabelForRow, t]);

  const linesExcelTotals = useMemo(() => {
    let sumQty = 0;
    for (const line of linesForTable) {
      const ra = line.Raod;
      if (ra != null && Number.isFinite(Number(ra))) sumQty += Number(ra);
    }
    return { [t("qty")]: sumQty } as Record<string, number | null>;
  }, [linesForTable, t]);

  const points = useMemo(() => {
    const out: { id: number; pos: L.LatLngTuple; row: SalesMapPointRow; orgT: string }[] = [];
    for (const row of rowsForMap) {
      const id = Number(row.IdReal1);
      if (!Number.isFinite(id)) continue;
      const lat = Number(row.Lat);
      const lon = Number(row.Lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      const orgT = normalizeOrgTLabel(row.OrgT);
      out.push({ id, pos: [lat, lon], row, orgT });
    }
    return out;
  }, [rowsForMap]);

  const orgTColorMap = useMemo(() => buildOrgTColorMap(points.map((p) => p.orgT)), [points]);

  const legendItems = useMemo(() => {
    const seen = new Set<string>();
    const ordered: { label: string; color: string }[] = [];
    for (const p of points) {
      const key = p.orgT || "";
      if (seen.has(key)) continue;
      seen.add(key);
      ordered.push({
        label: key || t("mapUnknownOrgT"),
        color: colorForOrgT(orgTColorMap, p.orgT),
      });
    }
    ordered.sort((a, b) => a.label.localeCompare(b.label, undefined, { sensitivity: "base" }));
    return ordered;
  }, [points, orgTColorMap, t]);

  const latLngs = useMemo(() => points.map((p) => p.pos), [points]);

  const selectedTotals = useMemo(() => {
    let liters = 0;
    let amount = 0;
    let weight = 0;
    let count = 0;
    for (const p of points) {
      if (!selected.has(p.id)) continue;
      count++;
      const r = p.row;
      const ot = r.OrderTotal;
      const ol = r.OrderLiters;
      const bt = r.BrutoTotal;
      if (typeof ot === "number" && Number.isFinite(ot)) amount += ot;
      if (ol != null && Number.isFinite(Number(ol))) liters += Number(ol);
      if (bt != null && Number.isFinite(Number(bt))) weight += Number(bt);
    }
    return { count, liters, amount, weight };
  }, [points, selected]);

  const toggleOne = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBbox = useCallback(
    (bounds: L.LatLngBounds) => {
      const ids: number[] = [];
      for (const p of points) {
        if (bounds.contains(p.pos)) ids.push(p.id);
      }
      if (ids.length === 0) return;
      setSelected((prev) => {
        if (bboxMode === "replace") return new Set(ids);
        const next = new Set(prev);
        for (const id of ids) next.add(id);
        return next;
      });
    },
    [points, bboxMode],
  );

  const assignDriver = async () => {
    const id = parseInt(driverId, 10);
    if (!Number.isFinite(id) || selected.size === 0) return;
    setAssigning(true);
    setAssignMsg(null);
    try {
      const res = await fetch("/api/sales-map/assign-driver", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idReal1List: [...selected], driverId: id }),
      });
      const json = await res.json();
      if (!res.ok) {
        setAssignMsg(
          typeof json.details === "string"
            ? json.details
            : typeof json.error === "string"
              ? json.error
              : "Failed",
        );
        return;
      }
      setAssignMsg(
        `${t("salesMapAssignSuccess")} (${Number(json.updatedOrders ?? selected.size) || selected.size})`,
      );
      await loadPoints();
    } catch (e) {
      setAssignMsg(e instanceof Error ? e.message : "Error");
    } finally {
      setAssigning(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 px-5 py-4 text-sm text-destructive">
        {t("error")}: {error}
      </div>
    );
  }

  const hasSelection = selected.size > 0;

  const renderLegendContent = () => {
    if (legendItems.length > 0) {
      return (
        <div
          className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] text-foreground"
          role="list"
          aria-label={t("mapObjectTypeLegend")}
        >
          <span className="font-medium text-muted-foreground">{t("mapObjectTypeLegend")}:</span>
          {legendItems.map((item) => (
            <span key={item.label} className="inline-flex items-center gap-1" role="listitem">
              <span
                className="h-2 w-2 shrink-0 rounded-full border border-black/10"
                style={{ backgroundColor: item.color }}
              />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-4">
      {driversWarning && (
        <div role="status" className="rounded-2xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          {driversWarning}
        </div>
      )}

      {assignMsg && (
        <div className="rounded-2xl border border-border/50 bg-muted/40 px-4 py-3 text-sm whitespace-pre-wrap text-foreground">
          {assignMsg}
        </div>
      )}

      {/* === MAP AREA === */}
      {loading ? (
        <Skeleton className="h-[min(640px,72vh)] min-h-[320px] w-full rounded-2xl" />
      ) : rows.length === 0 ? (
        <div className="flex h-[min(640px,72vh)] min-h-[320px] items-center justify-center rounded-2xl border border-border/60 bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {t("salesMapNoData")}
        </div>
      ) : rowsFilteredByDriver.length === 0 ? (
        <div className="flex h-[min(640px,72vh)] min-h-[320px] items-center justify-center rounded-2xl border border-border/60 bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {t("salesMapDriverFilterNoMatches")}
        </div>
      ) : rowsForMap.length === 0 && mapFilterDriverId != null ? (
        <div className="flex h-[min(640px,72vh)] min-h-[320px] items-center justify-center rounded-2xl border border-border/60 bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {t("salesMapVehicleCardNoMatches")}
        </div>
      ) : points.length === 0 ? (
        <div className="flex h-[min(640px,72vh)] min-h-[320px] items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 text-center text-sm text-foreground">
          {t("customerLocationsNoCoords")}
        </div>
      ) : (
        <div className="relative z-0 h-[min(640px,72vh)] min-h-[320px] w-full overflow-hidden rounded-2xl border border-border/50 shadow-sm">
          {/* Leaflet map */}
          <MapContainer
            center={MAP_DEFAULT_CENTER_GEORGIA}
            zoom={MAP_DEFAULT_ZOOM_GEORGIA}
            scrollWheelZoom
            className="h-full w-full bg-muted [&_.leaflet-control-attribution]:text-[10px]"
          >
            <TileLayer
              attribution='&copy; Google Maps'
              url="https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}"
            />
            <FitBounds latLngs={latLngs} />
            <SalesMapRectSelect enabled={rectMode} onBounds={handleBbox} />
            {points.map((p) => {
              const distDriverIdx = distOrderDriverMap.get(p.id);
              const hasDistColor = distDriverIdx !== undefined;
              const hex = colorForOrgT(orgTColorMap, p.orgT);
              const isSel = selected.has(p.id);
              const isDistHovered = distHoveredOrder === p.id;
              const mdzFromRow =
                p.row.Mdz != null && String(p.row.Mdz).trim() !== "" ? String(p.row.Mdz).trim() : null;
              const idMdz = p.row.IdMdz;
              const mdzNum = idMdz != null && idMdz !== "" ? Number(idMdz) : NaN;
              const mdzLabelFromId = Number.isFinite(mdzNum)
                ? driverNameById.get(mdzNum) ?? `#${mdzNum}`
                : null;
              const mdzLabel = mdzFromRow ?? mdzLabelFromId;
              const distDriverName = hasDistColor
                ? distPlan?.driverStats[distDriverIdx]?.driverName
                : null;
              return (
                <CircleMarker
                  key={p.id}
                  center={p.pos}
                  radius={isDistHovered ? 14 : isSel ? 11 : hasDistColor ? 9 : 7}
                  pathOptions={{
                    color: hex,
                    fillColor: hex,
                    fillOpacity: isDistHovered ? 0.8 : isSel ? 0.55 : hasDistColor ? 0.6 : 0.38,
                    weight: isDistHovered ? 4 : isSel ? 3 : 2,
                  }}
                  eventHandlers={{
                    click: () => toggleOne(p.id),
                  }}
                >
                  <Popup>
                    <div className="min-w-[180px] space-y-1 text-sm">
                      <div className="font-semibold">{String(p.row.Org ?? "")}</div>
                      <div className="text-muted-foreground">
                        {p.orgT ? (
                          <span>
                            {t("customerCategory")}: {p.orgT}
                          </span>
                        ) : (
                          <span>{t("mapUnknownOrgT")}</span>
                        )}
                      </div>
                      <div className="text-muted-foreground">{String(p.row.Reg ?? "")}</div>
                      <div>
                        {formatCurrency(Number(p.row.OrderTotal ?? 0))} ·{" "}
                        {p.row.OrderLiters != null && Number(p.row.OrderLiters) > 0
                          ? formatLiters(Number(p.row.OrderLiters))
                          : "—"}
                      </div>
                      {mdzLabel && (
                        <div className="text-xs text-muted-foreground">
                          {t("drivers")}: {mdzLabel}
                        </div>
                      )}
                      {distDriverName && (
                        <div className="text-xs font-medium text-foreground">
                          {t("distAssignedTo")}: {distDriverName}
                        </div>
                      )}
                      {distPlan && distPlan.driverStats.length > 1 && (
                        <select
                          className="mt-1 w-full rounded border border-border bg-background px-1 py-0.5 text-[10px]"
                          value={distDriverIdx !== undefined ? String(distDriverIdx) : ""}
                          onChange={(e) => {
                            const targetIdx = parseInt(e.target.value, 10);
                            if (!Number.isFinite(targetIdx)) return;
                            moveOrderBetweenDrivers(p.id, targetIdx);
                          }}
                        >
                          <option value="" disabled>{t("distMoveTo")}</option>
                          {distPlan.driverStats.map((ds, di) => (
                            <option key={ds.driverId} value={String(di)} disabled={di === distDriverIdx}>
                              {ds.driverName} ({ds.orderCount})
                            </option>
                          ))}
                        </select>
                      )}
                      <div className="text-xs text-muted-foreground">IdReal1: {p.id}</div>
                      <button
                        type="button"
                        className={cn(
                          "mt-2 w-full rounded-lg border px-2 py-1 text-xs font-medium transition-colors",
                          isSel ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-muted",
                        )}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleOne(p.id);
                        }}
                      >
                        {isSel ? t("onlineMapDeselect") : t("onlineMapSelect")}
                      </button>
                    </div>
                  </Popup>
                </CircleMarker>
              );
            })}
          </MapContainer>

          {/* ===== FLOATING TOOLBAR (top-left) ===== */}
          <div className={cn("absolute top-3 left-3 z-[500] flex flex-col gap-2 rounded-xl p-2", GLASS)}>
            {/* Row 1: Selection tools */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                title={rectMode ? t("salesMapRectModeOn") : t("salesMapRectModeOff")}
                className={cn(
                  "rounded-lg p-1.5 transition-all",
                  rectMode
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/60",
                )}
                onClick={() => setRectMode((v) => !v)}
              >
                <BoxSelect className="h-4 w-4" />
              </button>

              <div className="h-4 w-px bg-border/60" />

              <div className="flex rounded-lg bg-muted/40 p-0.5 gap-0.5">
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-medium transition-all",
                    bboxMode === "add"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setBboxMode("add")}
                >
                  {t("salesMapBboxAdd")}
                </button>
                <button
                  type="button"
                  className={cn(
                    "rounded-md px-2 py-0.5 text-[10px] font-medium transition-all",
                    bboxMode === "replace"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setBboxMode("replace")}
                >
                  {t("salesMapBboxReplace")}
                </button>
              </div>

              <div className="h-4 w-px bg-border/60" />

              <button
                type="button"
                title={t("salesMapClearSelection")}
                disabled={!hasSelection}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all disabled:opacity-30"
                onClick={() => setSelected(new Set())}
              >
                <Eraser className="h-4 w-4" />
              </button>

              <button
                type="button"
                title={t("refresh")}
                disabled={loading || !filtersReady}
                className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-all disabled:opacity-30"
                onClick={() => void loadPoints()}
              >
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </button>
            </div>

            {/* Row 2: Driver filter segmented control */}
            <div className="flex rounded-lg bg-muted/40 p-0.5 gap-0.5">
              {(
                [
                  ["all", "salesMapDriverFilterAll"],
                  ["assigned", "salesMapDriverFilterAssigned"],
                  ["unassigned", "salesMapDriverFilterUnassigned"],
                ] as const
              ).map(([key, labelKey]) => (
                <button
                  key={key}
                  type="button"
                  className={cn(
                    "flex-1 rounded-md px-2 py-1 text-[10px] font-medium transition-all",
                    mapDriverFilter === key
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setMapDriverFilter(key)}
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>

            {/* Row 3: Driver assignment — visible when there's a selection */}
            {canAssignSalesDriver && hasSelection && (
              <div className="flex items-center gap-1.5 pt-0.5 border-t border-border/30">
                <DriverSearchSelect
                  id="sales-map-driver"
                  drivers={drivers}
                  value={driverId}
                  onValueChange={setDriverId}
                  disabled={loading || assigning}
                  placeholder={t("salesMapDriverPlaceholder")}
                  searchPlaceholder={t("salesMapDriverSearch")}
                  noResultsLabel={t("salesMapDriverNoResults")}
                  className="w-[160px] text-xs"
                />
                <button
                  type="button"
                  disabled={assigning || !driverId || loading}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-all",
                    "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                  )}
                  onClick={() => void assignDriver()}
                >
                  <UserCheck className="h-3.5 w-3.5" />
                  {assigning ? t("salesMapAssigning") : `${t("salesMapAssignDriver")} (${selected.size})`}
                </button>
              </div>
            )}
          </div>

          {/* ===== FLOATING STATS (top-right) — only when selection > 0 ===== */}
          {hasSelection && (
            <div
              className={cn(
                "absolute top-3 right-3 z-[500] rounded-xl px-3 py-2 animate-in fade-in slide-in-from-right-4 duration-200",
                GLASS,
              )}
            >
              <div className="flex items-center gap-3 divide-x divide-border/40">
                <div className="text-center">
                  <p className="text-lg font-bold tabular-nums leading-none">{selectedTotals.count}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{t("salesMapSelectedOrders")}</p>
                </div>
                <div className="pl-3 text-center">
                  <p className="text-sm font-semibold tabular-nums leading-none">
                    ₾{selectedTotals.amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{t("amount")}</p>
                </div>
                <div className="pl-3 text-center">
                  <p className="text-sm font-semibold tabular-nums leading-none">{formatLiters(selectedTotals.liters)}</p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{t("onlineMapTotalLiters")}</p>
                </div>
                <div className="pl-3 text-center">
                  <p className="text-sm font-semibold tabular-nums leading-none">
                    {selectedTotals.weight.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground mt-0.5">{t("salesMapSelectedWeight")}</p>
                </div>
              </div>
            </div>
          )}

          {/* ===== FLOATING LEGEND (bottom overlay) ===== */}
          {renderLegendContent() && (
            <div className={cn("absolute bottom-3 left-3 right-3 z-[500] rounded-xl px-3 py-2", GLASS)}>
              {renderLegendContent()}
            </div>
          )}
        </div>
      )}

      {/* ===== DISTRIBUTION PANEL ===== */}
      {canAssignSalesDriver && !loading && rows.length > 0 && (
        <DistributionPanel
          filtersKey={filtersKey}
          onPlanReady={(plan, orders) => {
            setDistPlan(plan);
            setDistOrders(orders);
          }}
          onApplied={() => {
            setDistPlan(null);
            setDistOrders([]);
            setDistHoveredOrder(null);
            setMapFilterDriverId(null);
            void loadPoints();
          }}
          highlightedOrderId={distHoveredOrder}
          onHoverOrder={setDistHoveredOrder}
          mapFilterDriverId={mapFilterDriverId}
          onMapFilterDriverChange={setMapFilterDriverId}
        />
      )}

      {/* ===== PRODUCT LINES — collapsible, default closed ===== */}
      {!loading && rows.length > 0 && (
        <Card className="border-border/40 rounded-2xl overflow-hidden">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left hover:bg-muted/30 transition-colors"
            onClick={() => setLinesOpen((v) => !v)}
          >
            <div className="space-y-0.5">
              <p className="text-sm font-semibold">{t("salesMapLinesTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("salesMapLinesHint")}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {linesForTable.length > 0 && (
                <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium tabular-nums">
                  {linesForTable.length}
                </span>
              )}
              {linesOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </div>
          </button>

          {linesOpen && (
            <CardContent className="px-4 pb-4 pt-0 space-y-3 border-t border-border/30">
              {linesForTable.length > 0 && (
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-2 rounded-full text-xs"
                    disabled={exportingLinesExcel}
                    onClick={() => {
                      void (async () => {
                        if (linesExcelRows.length === 0) return;
                        try {
                          setExportingLinesExcel(true);
                          await downloadExcelFromRows(linesExcelRows, "sales_map_product_lines", {
                            sheetName: "ProductLines",
                            totals: linesExcelTotals,
                            totalLabel: t("tableTotal"),
                          });
                        } finally {
                          setExportingLinesExcel(false);
                        }
                      })();
                    }}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    {exportingLinesExcel ? t("loading") : t("exportExcel")}
                  </Button>
                </div>
              )}

              {rowsFilteredByDriver.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {mapDriverFilter === "unassigned" ? t("salesMapUnassignedEmpty") : t("salesMapAssignedEmpty")}
                </p>
              ) : rowsForMap.length === 0 && mapFilterDriverId != null ? (
                <p className="text-sm text-muted-foreground">{t("salesMapVehicleCardNoMatches")}</p>
              ) : linesForTable.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("salesMapLinesEmpty")}</p>
              ) : (
                <>
                  {linesForTable.length > LINES_TABLE_MAX && (
                    <p className="text-xs text-muted-foreground">
                      {t("salesMapAssignedFirstRows")} ({LINES_TABLE_MAX} / {linesForTable.length})
                    </p>
                  )}
                  <div className="max-h-[min(400px,50vh)] overflow-auto rounded-xl border border-border/50">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("drivers")}</TableHead>
                          <TableHead className="tabular-nums">{t("productCode")}</TableHead>
                          <TableHead>{t("productName")}</TableHead>
                          <TableHead className="text-right tabular-nums">{t("qty")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {linesForTable.slice(0, LINES_TABLE_MAX).map((line, idx) => {
                          const id1 = Number(line.IdReal1);
                          const id2 = line.IdReal2 != null ? Number(line.IdReal2) : idx;
                          const rowKey = Number.isFinite(id1) && Number.isFinite(id2) ? `${id1}-${id2}` : `line-${idx}`;
                          return (
                            <TableRow key={rowKey}>
                              <TableCell className="max-w-[200px] truncate">{driverLabelForRow(line)}</TableCell>
                              <TableCell className="tabular-nums text-muted-foreground">
                                {line.IdProd != null && String(line.IdProd).trim() !== ""
                                  ? String(line.IdProd)
                                  : "—"}
                              </TableCell>
                              <TableCell className="max-w-[280px] truncate">{String(line.Prod ?? "")}</TableCell>
                              <TableCell className="text-right tabular-nums">{formatLineQty(line.Raod)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          )}
        </Card>
      )}
    </div>
  );
}
