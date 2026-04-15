import { describe, expect, it } from "vitest";
import { validateChartPngBuffer } from "@/lib/png-chart-validate";

describe("validateChartPngBuffer", () => {
  it("rejects tiny buffers", () => {
    expect(validateChartPngBuffer(Buffer.from([1, 2, 3])).ok).toBe(false);
  });

  it("rejects non-png", () => {
    const b = Buffer.alloc(3000, 7);
    expect(validateChartPngBuffer(b).ok).toBe(false);
  });

  it("accepts a minimal valid PNG header fixture if present", () => {
    // 1x1 red PNG — too small for MIN_CHART_PNG_BYTES
    const onePixelPng = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    expect(validateChartPngBuffer(onePixelPng).ok).toBe(false);
  });
});
