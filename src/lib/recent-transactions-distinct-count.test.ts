import { describe, expect, it } from "vitest";
import { aggregateRecentTransactionsRows } from "@/lib/recent-transactions-aggregate";
import { accToValues, buildPivotModel } from "@/lib/recent-transactions-pivot";

describe("recent transactions distinct count", () => {
  const rows = [
    { Date: "2026-04-14", Preseller: "Rep A", Org: "Nikora", IdOrg: 1, Qty: 1, Liters: 2, Amount: 10, Price: 10 },
    { Date: "2026-04-14", Preseller: "Rep A", Org: "Nikora", IdOrg: 1, Qty: 2, Liters: 3, Amount: 20, Price: 10 },
    { Date: "2026-04-14", Preseller: "Rep A", Org: "Spar", IdOrg: 2, Qty: 1, Liters: 1, Amount: 5, Price: 5 },
    { Date: "2026-04-14", Preseller: "Rep B", Org: "Ori Nabiji", IdOrg: 3, Qty: 1, Liters: 1, Amount: 5, Price: 5 },
  ];

  it("aggregates table rows with distinct_count IdOrg", () => {
    const out = aggregateRecentTransactionsRows(
      rows,
      ["date", "preseller", "distinctCustomers"],
      [{ valueId: "distinctCustomers", aggregation: "distinct_count" }],
    );
    const repA = out.find((r) => r.Preseller === "Rep A");
    const repB = out.find((r) => r.Preseller === "Rep B");
    expect(repA?.DistinctCustomerCount).toBe(2);
    expect(repB?.DistinctCustomerCount).toBe(1);
  });

  it("builds pivot cells with distinct_count per preseller/day", () => {
    const model = buildPivotModel(
      rows,
      ["preseller"],
      ["date"],
      ["distinctCustomers"],
      [{ valueId: "distinctCustomers", aggregation: "distinct_count" }],
      { locale: "en-US" },
    );
    const repAKey = "Rep A";
    const colKey = "2026-04-14";
    const acc = model.cells.get(repAKey)?.get(colKey);
    const vals = acc ? accToValues(acc, model.valueDefs) : null;
    expect(vals?.distinctCustomers).toBe(2);
  });
});

