"use client";

import { useEffect, useRef } from "react";
import { useMap } from "react-leaflet";
import L from "leaflet";

type Props = {
  /** When true, drag on the map draws a rectangle and calls onBounds with geographic bounds. */
  enabled: boolean;
  onBounds: (bounds: L.LatLngBounds) => void;
};

/**
 * Mouse drag rectangle in screen space → LatLngBounds (for selecting markers inside).
 */
export function SalesMapRectSelect({ enabled, onBounds }: Props) {
  const map = useMap();
  const rectRef = useRef<L.Rectangle | null>(null);
  const startRef = useRef<L.Point | null>(null);

  useEffect(() => {
    if (!enabled) {
      map.dragging.enable();
      return;
    }

    const container = map.getContainer();

    const cleanupRect = () => {
      if (rectRef.current) {
        map.removeLayer(rectRef.current);
        rectRef.current = null;
      }
    };

    const MIN_DRAG_PX = 12;

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return;
      e.preventDefault();
      map.dragging.disable();
      startRef.current = map.mouseEventToContainerPoint(e);
      cleanupRect();
    };

    const onMove = (e: MouseEvent) => {
      const start = startRef.current;
      if (!start) return;
      const end = map.mouseEventToContainerPoint(e);
      const sw = map.containerPointToLatLng(start);
      const ne = map.containerPointToLatLng(end);
      const bounds = L.latLngBounds(sw, ne);
      cleanupRect();
      rectRef.current = L.rectangle(bounds, {
        color: "#6366f1",
        weight: 2,
        dashArray: "6 4",
        fillOpacity: 0.12,
      }).addTo(map);
    };

    const finish = (e: MouseEvent) => {
      const start = startRef.current;
      if (!start) return;
      startRef.current = null;
      map.dragging.enable();
      const end = map.mouseEventToContainerPoint(e);
      const dist = Math.hypot(end.x - start.x, end.y - start.y);
      if (dist < MIN_DRAG_PX) {
        cleanupRect();
        return;
      }
      const sw = map.containerPointToLatLng(start);
      const ne = map.containerPointToLatLng(end);
      const bounds = L.latLngBounds(sw, ne);
      cleanupRect();
      if (bounds.isValid()) {
        onBounds(bounds);
      }
    };

    container.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", finish);

    return () => {
      container.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", finish);
      cleanupRect();
      map.dragging.enable();
      startRef.current = null;
    };
  }, [enabled, map, onBounds]);

  return null;
}
