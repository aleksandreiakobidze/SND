import { describe, it, expect } from "vitest";
import { detectComparisonIntent } from "./agent-comparison-intent";
import { inferTidyLongKeys, pivotLongToWideTopN } from "./agent-comparison-postprocess";

describe("detectComparisonIntent", () => {
  it("detects compare across months (EN)", () => {
    const r = detectComparisonIntent("Compare sales by brand by months of current year");
    expect(r.isComparison).toBe(true);
    expect(r.signals.hasTimeBreakdown).toBe(true);
  });

  it("detects versus", () => {
    const r = detectComparisonIntent("Revenue brand A vs brand B by week");
    expect(r.isComparison).toBe(true);
  });

  it("detects trend language", () => {
    const r = detectComparisonIntent("Show trend across months for categories");
    expect(r.isComparison).toBe(true);
    expect(r.signals.hasTimeBreakdown).toBe(true);
  });

  it("flags explicit pie/share", () => {
    const r = detectComparisonIntent("Show market share as pie chart by region");
    expect(r.explicitPieOrShare).toBe(true);
  });

  it("returns false for generic snapshot", () => {
    const r = detectComparisonIntent("Total revenue yesterday");
    expect(r.isComparison).toBe(false);
  });

  it("detects Georgian შეადარე and თვეების მიხედვით (no ASCII word boundaries)", () => {
    const r = detectComparisonIntent("შეადარე 2026 ის ბრენდების გაყიდვები თვეების მიხედვით");
    expect(r.isComparison).toBe(true);
    expect(r.signals.hasVersus).toBe(true);
    expect(r.signals.hasTimeBreakdown).toBe(true);
  });
});

describe("pivotLongToWideTopN", () => {
  it("aggregates long rows to wide with Top N + Other", () => {
    const rows = [
      { Month: "2026-01", Brand: "A", Revenue: 100 },
      { Month: "2026-01", Brand: "B", Revenue: 200 },
      { Month: "2026-02", Brand: "A", Revenue: 50 },
      { Month: "2026-02", Brand: "C", Revenue: 10 },
    ];
    const piv = pivotLongToWideTopN(rows, "Month", "Brand", "Revenue", 2);
    expect(piv.data.length).toBe(2);
    expect(piv.meta.wasPivoted).toBe(true);
    expect(piv.meta.seriesKeys.length).toBeGreaterThanOrEqual(2);
  });
});

describe("inferTidyLongKeys", () => {
  it("finds time, dimension, measure columns", () => {
    const rows = [
      { Month: "Jan", Brand: "X", Revenue: 1 },
      { Month: "Jan", Brand: "Y", Revenue: 2 },
    ];
    const k = inferTidyLongKeys(rows);
    expect(k).not.toBeNull();
    expect(k?.measureKey).toBe("Revenue");
  });

  it("treats numeric Month (1–12) as time axis, not measure", () => {
    const rows = [
      { Month: 3, Brand: "A", Revenue: 100 },
      { Month: 3, Brand: "B", Revenue: 200 },
      { Month: 4, Brand: "A", Revenue: 50 },
    ];
    const k = inferTidyLongKeys(rows);
    expect(k).not.toBeNull();
    expect(k?.measureKey).toBe("Revenue");
    expect(k?.timeKey).toBe("Month");
    expect(k?.dimKey).toBe("Brand");
  });
});
