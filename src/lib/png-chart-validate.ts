/**
 * Server-side checks so we never attach empty/blank chart PNGs or non-PNG data.
 */

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Reject tiny icons / failed exports. */
const MIN_CHART_PNG_BYTES = 2_500;
const MIN_CHART_DIMENSION = 64;

export type PngChartValidationResult = { ok: true } | { ok: false; reason: string };

export function validateChartPngBuffer(buf: Buffer): PngChartValidationResult {
  if (!buf || buf.length < MIN_CHART_PNG_BYTES) {
    return { ok: false, reason: "too_small" };
  }
  if (!buf.subarray(0, 8).equals(PNG_MAGIC)) {
    return { ok: false, reason: "not_png" };
  }
  const dims = readPngIhdrDimensions(buf);
  if (!dims) {
    return { ok: false, reason: "invalid_png_header" };
  }
  if (dims.w < MIN_CHART_DIMENSION || dims.h < MIN_CHART_DIMENSION) {
    return { ok: false, reason: "dimensions_too_small" };
  }
  return { ok: true };
}

/** First chunk must be IHDR (standard PNG). */
function readPngIhdrDimensions(buf: Buffer): { w: number; h: number } | null {
  if (buf.length < 24) return null;
  const len = buf.readUInt32BE(8);
  const type = buf.toString("ascii", 12, 16);
  if (type !== "IHDR" || len < 13) return null;
  const w = buf.readUInt32BE(16);
  const h = buf.readUInt32BE(20);
  if (w > 0 && h > 0 && w < 100_000 && h < 100_000) return { w, h };
  return null;
}
