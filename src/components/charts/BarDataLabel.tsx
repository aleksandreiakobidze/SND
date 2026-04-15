"use client";

import type { CSSProperties } from "react";

type Props = {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  value?: number | string;
  /** Recharts horizontal bar chart uses layout="vertical" (bars grow along X). */
  isHorizontalBar: boolean;
  formatLabel: (v: number) => string;
  /** Dark fills for outside labels when PNG uses white background (email export). */
  exportSafe?: boolean;
};

const OUTSIDE_LABEL_FILL = "#0f172a";
const OUTSIDE_LABEL_SHADOW_EXPORT =
  "0 0 1px #ffffff, 0 1px 2px rgba(15, 23, 42, 0.2)" as const;

const FS = 11;
/** Halo for light text on saturated bars (works in light + dark). */
const INSIDE_STROKE: CSSProperties = {
  paintOrder: "stroke",
  stroke: "rgba(0,0,0,0.5)",
  strokeWidth: 3,
};

function num(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Smart data label: inside bar when there is room, otherwise outside (above column or right of bar).
 */
export function BarDataLabel({
  x,
  y,
  width,
  height,
  value,
  isHorizontalBar,
  formatLabel,
  exportSafe = false,
}: Props) {
  const xv = num(x);
  const yv = num(y);
  const w = num(width);
  const h = num(height);
  const n = Number(value);
  if (!Number.isFinite(n) || (n === 0 && w < 2 && h < 2)) return null;

  const text = formatLabel(n);
  const estW = Math.max(24, text.length * (FS * 0.55));

  if (isHorizontalBar) {
    const inside = w >= estW + 10 && h >= 13;
    const cy = yv + h / 2;
    if (inside) {
      return (
        <text
          x={xv + w - 5}
          y={cy}
          fill="#fafafa"
          fontSize={FS}
          fontWeight={600}
          textAnchor="end"
          dominantBaseline="middle"
          className="pointer-events-none tabular-nums"
          style={INSIDE_STROKE}
        >
          {text}
        </text>
      );
    }
    return (
      <text
        x={xv + w + 6}
        y={cy}
        fill={exportSafe ? OUTSIDE_LABEL_FILL : "var(--foreground)"}
        fontSize={FS}
        fontWeight={600}
        textAnchor="start"
        dominantBaseline="middle"
        className="pointer-events-none tabular-nums"
        style={
          exportSafe
            ? { textShadow: OUTSIDE_LABEL_SHADOW_EXPORT }
            : { textShadow: "0 0 2px var(--background), 0 1px 2px var(--background)" }
        }
      >
        {text}
      </text>
    );
  }

  const insideCol = h >= 24 && w >= estW + 4;
  const cx = xv + w / 2;
  if (insideCol) {
    return (
      <text
        x={cx}
        y={yv + h / 2}
        fill="#fafafa"
        fontSize={FS}
        fontWeight={600}
        textAnchor="middle"
        dominantBaseline="middle"
        className="pointer-events-none tabular-nums"
        style={INSIDE_STROKE}
      >
        {text}
      </text>
    );
  }

  return (
    <text
      x={cx}
      y={yv - 6}
      fill={exportSafe ? OUTSIDE_LABEL_FILL : "var(--foreground)"}
      fontSize={FS}
      fontWeight={600}
      textAnchor="middle"
      dominantBaseline="auto"
      className="pointer-events-none tabular-nums"
      style={
        exportSafe
          ? { textShadow: OUTSIDE_LABEL_SHADOW_EXPORT }
          : { textShadow: "0 0 2px var(--background), 0 1px 3px var(--background)" }
      }
    >
      {text}
    </text>
  );
}
