import { describe, expect, it } from "vitest";
import { addFieldToMatrixZone } from "@/lib/recent-transactions-prefs-ops";
import { buildPivotModel, accToValues } from "@/lib/recent-transactions-pivot";
import { aggregateRecentTransactionsRows } from "@/lib/recent-transactions-aggregate";

describe("recent transactions value eligibility", () => {
  it("allows customer dimension in Values zone", () => {
    const next = addFieldToMatrixZone(
      {
        columnOrder: ["date", "customer", "preseller"],
        hiddenColumnIds: [
          "region",
          "customerCategory",
          "itemCategory",
          "brand",
          "saleType",
          "documentNo",
          "itemCode",
          "item",
          "qty",
          "liter",
          "price",
          "amount",
          "distinctCustomers",
          "manager",
          "supervisor",
          "month",
          "year",
        ],
        viewMode: "matrix",
        matrix: { rowIds: ["preseller"], columnIds: ["date"], valueIds: ["liter"] },
      },
      "customer",
      "values",
    );
    expect(next.matrix?.valueIds.includes("customer")).toBe(true);
    expect(next.matrix?.valueDefs?.find((d) => d.valueId === "customer")?.aggregation).toBe(
      "distinct_count",
    );
  });

  it("computes distinct_count for customer value by preseller/date", () => {
    const rows = [
      { Date: "2026-04-14", Preseller: "Rep A", Org: "Nikora", IdOrg: 1 },
      { Date: "2026-04-14", Preseller: "Rep A", Org: "Nikora", IdOrg: 1 },
      { Date: "2026-04-14", Preseller: "Rep A", Org: "Spar", IdOrg: 2 },
      { Date: "2026-04-14", Preseller: "Rep B", Org: "Ori Nabiji", IdOrg: 3 },
    ];
    const model = buildPivotModel(
      rows,
      ["preseller"],
      ["date"],
      ["customer"],
      [{ valueId: "customer", aggregation: "distinct_count" }],
      { locale: "en-US" },
    );
    const acc = model.cells.get("Rep A")?.get("2026-04-14");
    const vals = acc ? accToValues(acc, model.valueDefs) : null;
    expect(vals?.customer).toBe(2);
  });

  it("computes count for documentNo value", () => {
    const rows = [
      { Date: "2026-04-14", Preseller: "Rep A", DocumentNo: "A001" },
      { Date: "2026-04-14", Preseller: "Rep A", DocumentNo: "A001" },
      { Date: "2026-04-14", Preseller: "Rep A", DocumentNo: "A002" },
    ];
    const out = aggregateRecentTransactionsRows(
      rows,
      ["date", "preseller", "documentNo"],
      [{ valueId: "documentNo", aggregation: "count" }],
    );
    expect(out[0]?.DocumentNo).toBe(3);
  });
});

