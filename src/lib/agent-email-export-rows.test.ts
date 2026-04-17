import { describe, expect, it } from "vitest";
import {
  buildChartViewExcelSheetParts,
  buildFlatTableEmailExportRows,
  buildMatrixEmailExportRows,
  matrixExportUnavailablePlaceholderRows,
} from "@/lib/agent-email-export-rows";

describe("agent-email-export-rows", () => {
  const simpleArgs = {
    rawRows: [{ region: "A", revenue: 100 }],
    chartConfig: null,
    chartType: "table" as const,
  };

  it("flat export returns row-based data (not matrix-flattened when no matrix)", () => {
    const { rows } = buildFlatTableEmailExportRows(simpleArgs);
    expect(rows.length).toBe(1);
    expect(rows[0]).toHaveProperty("region");
  });

  it("flat export includes totals for summable columns (matches DataTable footer)", () => {
    const { rows, totals } = buildFlatTableEmailExportRows({
      rawRows: [
        { Category: "A", Brand: "X", Revenue: 100 },
        { Category: "B", Brand: "Y", Revenue: 200 },
      ],
      chartConfig: null,
      chartType: "table",
    });
    expect(rows.length).toBe(2);
    expect(totals).not.toBeNull();
    expect(totals?.Revenue).toBe(300);
    expect(totals?.Category).toBeNull();
    expect(totals?.Brand).toBeNull();
  });

  it("chart bundle flat sheet includes totals and totalLabel for email Excel", () => {
    const parts = buildChartViewExcelSheetParts(simpleArgs, "en");
    expect(parts[0].totals).not.toBeNull();
    expect(parts[0].totalLabel).toBe("Total");
    expect(parts[0].totals?.revenue).toBe(100);
  });

  it("matrix export is null when no matrix layout", () => {
    expect(buildMatrixEmailExportRows(simpleArgs)).toBeNull();
  });

  it("chart bundle has Flat table and Matrix sheet names", () => {
    const parts = buildChartViewExcelSheetParts(simpleArgs, "en");
    expect(parts).toHaveLength(2);
    expect(parts[0].sheetName).toBe("Flat table");
    expect(parts[1].sheetName).toBe("Matrix");
  });

  it("uses informational row when matrix layout is unavailable", () => {
    const parts = buildChartViewExcelSheetParts(simpleArgs, "en");
    expect(parts[1].rows.length).toBe(1);
    const v = Object.values(parts[1].rows[0] ?? {})[0];
    expect(String(v)).toMatch(/matrix/i);
  });

  it("matrix placeholder is localized", () => {
    const en = matrixExportUnavailablePlaceholderRows("en");
    const ka = matrixExportUnavailablePlaceholderRows("ka");
    expect(String(Object.values(en[0] ?? {})[0])).toMatch(/matrix/i);
    expect(Object.keys(ka[0] ?? {})).toContain("შეტყობინება");
  });
});
