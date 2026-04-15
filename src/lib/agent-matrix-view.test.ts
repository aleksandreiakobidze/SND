import { describe, expect, it } from "vitest";
import { computeAgentMatrixView } from "@/lib/agent-matrix-view";
import { resolveMeasureDisplay } from "@/lib/agent-metric-intent";

describe("computeAgentMatrixView strict tidy inference", () => {
  it("pivots SaleDate/SalesRep/CustomerCount as date columns and rep rows", () => {
    const rows = [
      { SaleDate: "2026-04-01", SalesRep: "Rep A", CustomerCount: 12 },
      { SaleDate: "2026-04-01", SalesRep: "Rep B", CustomerCount: 7 },
      { SaleDate: "2026-04-02", SalesRep: "Rep A", CustomerCount: 15 },
      { SaleDate: "2026-04-02", SalesRep: "Rep B", CustomerCount: 9 },
    ];
    const view = computeAgentMatrixView(
      { type: "table", title: "Daily Customer Count" },
      rows,
    );
    expect(view).not.toBeNull();
    expect(view?.rowDimLabel).toBe("SalesRep");
    expect(view?.measureLabel).toBe("CustomerCount");
    expect(view?.model.rowLabels).toEqual(["Rep A", "Rep B"]);
    expect(view?.model.colLabels).toEqual(["2026-04-01", "2026-04-02"]);
    expect(view?.model.cells).toEqual([
      [12, 15],
      [7, 9],
    ]);
    expect(view?.model.rowTotals).toEqual([27, 16]);
    expect(view?.model.colTotals).toEqual([19, 24]);
    expect(view?.model.grandTotal).toBe(43);
  });

  it("prefers comparison longData (same source as flat table)", () => {
    const longRows = [
      { SaleDate: "2026-04-01", SalesRep: "Rep A", CustomerCount: 2 },
      { SaleDate: "2026-04-01", SalesRep: "Rep B", CustomerCount: 3 },
    ];
    const view = computeAgentMatrixView(
      {
        type: "bar",
        xKey: "Month",
        yKeys: ["Revenue"],
        comparison: {
          enabled: true,
          rowDim: "SalesRep",
          colDim: "SaleDate",
          measure: "CustomerCount",
          topN: 10,
          wasPivoted: true,
          seriesKeys: ["Rep A", "Rep B"],
          longData: longRows,
        },
      },
      [{ Month: "Apr", Revenue: 999 }],
    );
    expect(view).not.toBeNull();
    expect(new Set(view?.model.rowLabels ?? [])).toEqual(new Set(["Rep A", "Rep B"]));
    expect(view?.model.colLabels).toEqual(["2026-04-01"]);
  });

  it("formats ISO midnight date columns as yyyy-mm-dd", () => {
    const rows = [
      { SaleDate: "2026-04-01T00:00:00.000Z", SalesRep: "Rep A", CustomerCount: 12 },
      { SaleDate: "2026-04-01T00:00:00.000Z", SalesRep: "Rep B", CustomerCount: 7 },
      { SaleDate: "2026-04-02T00:00:00.000Z", SalesRep: "Rep A", CustomerCount: 15 },
      { SaleDate: "2026-04-02T00:00:00.000Z", SalesRep: "Rep B", CustomerCount: 9 },
    ];
    const view = computeAgentMatrixView(
      { type: "table", title: "Daily Customer Count" },
      rows,
    );
    expect(view).not.toBeNull();
    expect(view?.model.colLabels).toEqual(["2026-04-01", "2026-04-02"]);
  });
});

describe("resolveMeasureDisplay", () => {
  it("treats count metrics as quantity, not money", () => {
    const md = resolveMeasureDisplay(
      { type: "table", yKeys: ["CustomerCount"] },
      [{ SalesRep: "Rep A", CustomerCount: 10 }],
    );
    expect(md).toBe("quantity");
  });

  it("overrides money metadata when comparison measure is count-like", () => {
    const md = resolveMeasureDisplay(
      {
        type: "bar",
        measureDisplay: "money",
        yKeys: ["Rep A", "Rep B"],
        comparison: {
          enabled: true,
          rowDim: "SalesRep",
          colDim: "SaleDate",
          measure: "CustomerCount",
          topN: 10,
          wasPivoted: true,
          seriesKeys: ["Rep A", "Rep B"],
        },
      },
      [{ SaleDate: "2026-04-01", "Rep A": 10, "Rep B": 8 }],
    );
    expect(md).toBe("quantity");
  });
});

