import { describe, expect, it } from "vitest";
import { validateAgentResponse } from "@/lib/agent-response-validate";
import type { MetricIntentResult } from "@/lib/agent-metric-intent";
import type { MinOrderAmountIntent } from "@/lib/agent-min-order-amount-intent";

const metricIntent: MetricIntentResult = {
  kind: "revenue_gel",
  hasMoney: true,
  hasQuantity: false,
  hasVolume: false,
};

function validate(sql: string, minOrderAmountIntent: MinOrderAmountIntent) {
  return validateAgentResponse(
    {
      sql,
      chartType: "table",
      chartConfig: {},
      narrative: "test",
      suggestedQuestions: [],
    },
    metricIntent,
    undefined,
    minOrderAmountIntent,
  );
}

describe("min order amount sql validation", () => {
  it("requires output column when explicitly requested", () => {
    const result = validate(
      "SELECT Org, SUM(Tanxa) AS Revenue FROM OnlineRealViewAgent GROUP BY Org",
      { mentioned: true, requestedInOutput: true, filter: null },
    );
    expect(result.ok).toBe(false);
    expect(result.reasons.join(" ")).toMatch(/Include MinOrderAmount in SELECT/i);
  });

  it("accepts null/non-null filters", () => {
    const ok = validate(
      "SELECT Org, MinOrderAmount, SUM(Tanxa) AS Revenue FROM OnlineRealViewAgent WHERE MinOrderAmount IS NOT NULL GROUP BY Org, MinOrderAmount",
      { mentioned: true, requestedInOutput: true, filter: { operator: "is_not_null" } },
    );
    expect(ok.ok).toBe(true);
  });

  it("rejects text-like predicates", () => {
    const bad = validate(
      "SELECT Org, MinOrderAmount FROM OnlineRealViewAgent WHERE MinOrderAmount = 'filled'",
      { mentioned: true, requestedInOutput: true, filter: { operator: "is_not_null" } },
    );
    expect(bad.ok).toBe(false);
    expect(bad.reasons.join(" ")).toMatch(/numeric threshold field/i);
  });

  it("enforces numeric threshold operator/value", () => {
    const bad = validate(
      "SELECT Org, MinOrderAmount FROM OnlineRealViewAgent WHERE MinOrderAmount LIKE '%250%'",
      { mentioned: true, requestedInOutput: true, filter: { operator: "gte", value: 250 } },
    );
    expect(bad.ok).toBe(false);
    expect(bad.reasons.join(" ")).toMatch(/Apply numeric MinOrderAmount filter/i);
  });
});
