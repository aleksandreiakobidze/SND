"use client";

import { useEffect, useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useLocale } from "@/lib/locale-context";
import { buildOrgTColorMap, colorForOrgT, normalizeOrgTLabel } from "@/lib/map-object-type-colors";

export type CustomerLocationRow = Record<string, unknown>;

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

type Props = {
  rows: CustomerLocationRow[];
  formatCurrency: (value: number) => string;
  emptyMessage: string;
};

/** OpenStreetMap — customer points by Lon/Lat from report rows */
export function CustomerLocationsMap({ rows, formatCurrency, emptyMessage }: Props) {
  const { t } = useLocale();
  const points = useMemo(() => {
    const out: { pos: L.LatLngTuple; row: CustomerLocationRow; orgT: string }[] = [];
    for (const row of rows) {
      const lat = Number(row.Lat);
      const lon = Number(row.Lon);
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue;
      const orgT = normalizeOrgTLabel(row.OrgT);
      out.push({ pos: [lat, lon], row, orgT });
    }
    return out;
  }, [rows]);

  const orgTColorMap = useMemo(() => {
    const labels = points.map((p) => p.orgT);
    return buildOrgTColorMap(labels);
  }, [points]);

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

  if (points.length === 0) {
    return (
      <div className="flex h-[min(420px,60vh)] min-h-[280px] items-center justify-center rounded-lg border bg-muted/30 text-center text-sm text-muted-foreground px-4">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative z-0 h-[min(420px,60vh)] min-h-[280px] w-full overflow-hidden rounded-lg border">
        <MapContainer
          center={latLngs[0] ?? defaultCenter}
          zoom={8}
          scrollWheelZoom
          className="h-full w-full [&_.leaflet-control-attribution]:text-[10px]"
          style={{ background: "hsl(var(--muted))" }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <FitBounds latLngs={latLngs} />
          {points.map((p, i) => {
            const hex = colorForOrgT(orgTColorMap, p.orgT);
            return (
              <CircleMarker
                key={`${p.pos[0]}-${p.pos[1]}-${i}`}
                center={p.pos}
                radius={7}
                pathOptions={{
                  color: hex,
                  fillColor: hex,
                  fillOpacity: 0.38,
                  weight: 2,
                }}
              >
                <Popup>
                  <div className="min-w-[160px] space-y-1 text-sm">
                    <div className="font-semibold">{String(p.row.Customer ?? "")}</div>
                    <div className="text-muted-foreground">
                      {p.orgT ? (
                        <span>
                          {t("customerCategory")}: {p.orgT}
                        </span>
                      ) : (
                        <span>{t("mapUnknownOrgT")}</span>
                      )}
                    </div>
                    <div className="text-muted-foreground">
                      {String(p.row.Region ?? "")}
                      {p.row.City != null && String(p.row.City) !== "" ? ` · ${String(p.row.City)}` : ""}
                    </div>
                    <div>
                      {formatCurrency(Number(p.row.Revenue ?? 0))} · {String(p.row.Orders ?? 0)}{" "}
                      {t("orders")}
                    </div>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>
      {legendItems.length > 0 && (
        <div
          className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border bg-muted/20 px-3 py-2 text-xs text-foreground"
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
  );
}
