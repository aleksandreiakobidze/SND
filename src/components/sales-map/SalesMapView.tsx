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
import { BoxSelect, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type SalesMapPointRow = Record<string, unknown>;

const LINES_TABLE_MAX = 200;

function formatLineQty(v: unknown): string {
  if (v == null) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return n.toLocaleString();
  return n.toLocaleString(undefined, { maximumFractionDigits: 3 });
}

/** ERP: Micodeba 0 = assigned, 1 = unassigned. If null/legacy, fall back to IdMdz/Mdz. */
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

function FitBounds({ latLngs }: { latLngs: L.LatLngTuple[] }) {
  const map = useMap();
  useEffect(() => {
    if (latLngs.length === 0) return;
    if (latLngs.length === 1) {
      map.setView(latLngs[0], 11);
      return;
    }
    const b = L.latLngBounds(latLngs);
    map.fitBounds(b, { padding: [48, 48], maxZoom: 14 });
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
  }, [mapDriverFilter]);

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

  const allowedOrderIdsForTable = useMemo(() => {
    const s = new Set<number>();
    for (const r of rowsFilteredByDriver) {
      const id = Number(r.IdReal1);
      if (Number.isFinite(id)) s.add(id);
    }
    return s;
  }, [rowsFilteredByDriver]);

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

  const points = useMemo(() => {
    const out: { id: number; pos: L.LatLngTuple; row: SalesMapPointRow; orgT: string }[] = [];
    for (const row of rowsFilteredByDriver) {
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
  }, [rowsFilteredByDriver]);

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
  const defaultCenter: L.LatLngTuple = [42.315, 43.3566];

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
      <div className="rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
        {t("error")}: {error}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm leading-relaxed text-muted-foreground">{t("salesMapBboxHint")}</p>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant={rectMode ? "default" : "outline"}
            size="sm"
            className="gap-2"
            onClick={() => setRectMode((v) => !v)}
          >
            <BoxSelect className="h-4 w-4" />
            {rectMode ? t("salesMapRectModeOn") : t("salesMapRectModeOff")}
          </Button>
          <span className="text-xs text-muted-foreground">{t("salesMapBboxMergeLabel")}</span>
          <div className="flex rounded-lg border border-border p-0.5 text-xs">
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                bboxMode === "add" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
              onClick={() => setBboxMode("add")}
            >
              {t("salesMapBboxAdd")}
            </button>
            <button
              type="button"
              className={cn(
                "rounded-md px-2 py-1 transition-colors",
                bboxMode === "replace" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
              onClick={() => setBboxMode("replace")}
            >
              {t("salesMapBboxReplace")}
            </button>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(new Set())} disabled={selected.size === 0}>
            {t("salesMapClearSelection")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadPoints()} disabled={loading || !filtersReady}>
            <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
            {t("refresh")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground">{t("salesMapDriverFilterLabel")}</span>
          <div className="flex flex-wrap rounded-lg border border-border p-0.5 text-xs">
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
                  "rounded-md px-2 py-1 transition-colors",
                  mapDriverFilter === key ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                )}
                onClick={() => setMapDriverFilter(key)}
              >
                {t(labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {driversWarning && (
        <div role="status" className="rounded-xl border border-amber-500/35 bg-amber-500/10 px-4 py-3 text-sm text-foreground">
          {driversWarning}
        </div>
      )}

      <div className="surface-elevated grid gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("salesMapSelectionSummary")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {selectedTotals.count}{" "}
            <span className="text-base font-normal text-muted-foreground">{t("salesMapSelectedOrders")}</span>
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("amount")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            ₾
            {selectedTotals.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("onlineMapTotalLiters")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{formatLiters(selectedTotals.liters)}</p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("salesMapSelectedWeight")}</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">
            {selectedTotals.weight.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 3 })}
          </p>
        </div>
      </div>

      {canAssignSalesDriver ? (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] space-y-2">
            <label className="text-xs font-medium text-muted-foreground" htmlFor="sales-map-driver">
              {t("drivers")}
            </label>
            <DriverSearchSelect
              id="sales-map-driver"
              drivers={drivers}
              value={driverId}
              onValueChange={setDriverId}
              disabled={loading || assigning}
              placeholder={t("salesMapDriverPlaceholder")}
              searchPlaceholder={t("salesMapDriverSearch")}
              noResultsLabel={t("salesMapDriverNoResults")}
              className="w-full max-w-md"
            />
          </div>
          <Button
            type="button"
            disabled={assigning || selected.size === 0 || !driverId || loading}
            onClick={() => void assignDriver()}
          >
            {assigning ? t("salesMapAssigning") : t("salesMapAssignDriver")}
            {selected.size > 0 ? ` (${selected.size})` : ""}
          </Button>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("salesMapPermHint")}</p>
      )}

      {assignMsg && (
        <pre className="rounded-xl border border-border bg-muted/40 p-4 text-sm whitespace-pre-wrap text-foreground">{assignMsg}</pre>
      )}

      {loading ? (
        <Skeleton className="h-[min(480px,65vh)] min-h-[300px] w-full rounded-2xl" />
      ) : rows.length === 0 ? (
        <div className="flex h-[min(480px,65vh)] min-h-[300px] items-center justify-center rounded-2xl border border-border/60 bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {t("salesMapNoData")}
        </div>
      ) : rowsFilteredByDriver.length === 0 ? (
        <div className="flex h-[min(480px,65vh)] min-h-[300px] items-center justify-center rounded-2xl border border-border/60 bg-muted/30 px-4 text-center text-sm text-muted-foreground">
          {t("salesMapDriverFilterNoMatches")}
        </div>
      ) : points.length === 0 ? (
        <div className="flex h-[min(480px,65vh)] min-h-[300px] items-center justify-center rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 text-center text-sm text-foreground">
          {t("customerLocationsNoCoords")}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative z-0 h-[min(480px,65vh)] min-h-[300px] w-full overflow-hidden rounded-2xl border border-border/60">
            <MapContainer
              center={latLngs[0] ?? defaultCenter}
              zoom={8}
              scrollWheelZoom
              className="h-full w-full bg-muted [&_.leaflet-control-attribution]:text-[10px]"
            >
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              <FitBounds latLngs={latLngs} />
              <SalesMapRectSelect enabled={rectMode} onBounds={handleBbox} />
              {points.map((p) => {
                const hex = colorForOrgT(orgTColorMap, p.orgT);
                const isSel = selected.has(p.id);
                const mdzFromRow =
                  p.row.Mdz != null && String(p.row.Mdz).trim() !== "" ? String(p.row.Mdz).trim() : null;
                const idMdz = p.row.IdMdz;
                const mdzNum = idMdz != null && idMdz !== "" ? Number(idMdz) : NaN;
                const mdzLabelFromId = Number.isFinite(mdzNum)
                  ? driverNameById.get(mdzNum) ?? `#${mdzNum}`
                  : null;
                const mdzLabel = mdzFromRow ?? mdzLabelFromId;
                return (
                  <CircleMarker
                    key={p.id}
                    center={p.pos}
                    radius={isSel ? 11 : 7}
                    pathOptions={{
                      color: hex,
                      fillColor: hex,
                      fillOpacity: isSel ? 0.55 : 0.38,
                      weight: isSel ? 3 : 2,
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
          </div>
          {legendItems.length > 0 && (
            <div
              className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border/50 bg-muted/20 px-3 py-2 text-xs text-foreground"
              role="list"
              aria-label={t("mapObjectTypeLegend")}
            >
              <span className="font-medium text-muted-foreground">{t("mapObjectTypeLegend")}:</span>
              {legendItems.map((item) => (
                <span key={item.label} className="inline-flex items-center gap-1.5" role="listitem">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: item.color }}
                  />
                  <span>{item.label}</span>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!loading && rows.length > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">{t("salesMapLinesTitle")}</CardTitle>
            <CardDescription>{t("salesMapLinesHint")}</CardDescription>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {rowsFilteredByDriver.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {mapDriverFilter === "unassigned" ? t("salesMapUnassignedEmpty") : t("salesMapAssignedEmpty")}
              </p>
            ) : linesForTable.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("salesMapLinesEmpty")}</p>
            ) : (
              <>
                {linesForTable.length > LINES_TABLE_MAX && (
                  <p className="mb-2 text-xs text-muted-foreground">
                    {t("salesMapAssignedFirstRows")} ({LINES_TABLE_MAX} / {linesForTable.length})
                  </p>
                )}
                <div className="max-h-[min(420px,50vh)] overflow-auto rounded-xl border border-border/60">
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
        </Card>
      )}
    </div>
  );
}
