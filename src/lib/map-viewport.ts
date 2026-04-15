import L from "leaflet";
import type { LatLngTuple } from "leaflet";
import { MAP_DEFAULT_CENTER_GEORGIA, MAP_DEFAULT_ZOOM_GEORGIA } from "@/lib/map-defaults";

/**
 * Rough box for Georgia + immediate neighbors (Armenia / Azerbaijan / NE Turkey).
 * Used to ignore bogus coordinates (0,0, swapped fields, etc.) that would make
 * fitBounds span the globe.
 */
const VIEWPORT_SW: LatLngTuple = [40.45, 39.4];
const VIEWPORT_NE: LatLngTuple = [43.95, 47.05];

export function isInGeorgiaCaucasusViewport(lat: number, lon: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  if (Math.abs(lat) < 1e-5 && Math.abs(lon) < 1e-5) return false;
  return (
    lat >= VIEWPORT_SW[0] &&
    lat <= VIEWPORT_NE[0] &&
    lon >= VIEWPORT_SW[1] &&
    lon <= VIEWPORT_NE[1]
  );
}

function filterRegional(latLngs: LatLngTuple[]): LatLngTuple[] {
  return latLngs.filter(([lat, lon]) => isInGeorgiaCaucasusViewport(lat, lon));
}

function boundsSpan(latLngs: LatLngTuple[]): { lat: number; lon: number } {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLon = Infinity;
  let maxLon = -Infinity;
  for (const [lat, lon] of latLngs) {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLon = Math.min(minLon, lon);
    maxLon = Math.max(maxLon, lon);
  }
  return { lat: maxLat - minLat, lon: maxLon - minLon };
}

/** If bounds span exceeds this, we fall back to Georgia instead of fitting junk. */
const MAX_SPAN_FALLBACK = { lat: 6, lon: 7 };

/**
 * Fits the map to markers: prefers points inside the Caucasus/Georgia box so one
 * bad coordinate cannot zoom the map out to a continent. Falls back to a
 * Georgia-wide view when that happens.
 */
export function fitMapToPoints(map: L.Map, latLngs: LatLngTuple[]): void {
  if (latLngs.length === 0) return;

  const regional = filterRegional(latLngs);

  if (regional.length >= 2) {
    map.fitBounds(L.latLngBounds(regional), { padding: [48, 48], maxZoom: 14 });
    return;
  }
  if (regional.length === 1) {
    map.setView(regional[0], 11);
    return;
  }

  const span = boundsSpan(latLngs);
  if (
    latLngs.length >= 2 &&
    span.lat <= MAX_SPAN_FALLBACK.lat &&
    span.lon <= MAX_SPAN_FALLBACK.lon
  ) {
    map.fitBounds(L.latLngBounds(latLngs), { padding: [48, 48], maxZoom: 14 });
    return;
  }
  if (latLngs.length === 1) {
    map.setView(latLngs[0], 11);
    return;
  }

  map.setView(MAP_DEFAULT_CENTER_GEORGIA, MAP_DEFAULT_ZOOM_GEORGIA);
}
