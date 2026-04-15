import { describe, expect, it } from "vitest";
import { parseMinOrderAmountIntent } from "@/lib/agent-min-order-amount-intent";

describe("parseMinOrderAmountIntent", () => {
  it("detects output-only request", () => {
    const parsed = parseMinOrderAmountIntent("add minimum order amount to the report");
    expect(parsed.mentioned).toBe(true);
    expect(parsed.requestedInOutput).toBe(true);
    expect(parsed.filter).toBeNull();
  });

  it("detects existence filter", () => {
    const parsed = parseMinOrderAmountIntent(
      "show only rows where minimum order amount is not empty",
    );
    expect(parsed.filter?.operator).toBe("is_not_null");
  });

  it("detects missing-value filter", () => {
    const parsed = parseMinOrderAmountIntent(
      "show organizations without minimum order amount",
    );
    expect(parsed.filter?.operator).toBe("is_null");
  });

  it("detects threshold filter", () => {
    const parsed = parseMinOrderAmountIntent(
      "show only organizations with minimum order amount >= 250",
    );
    expect(parsed.filter?.operator).toBe("gte");
    expect(parsed.filter?.value).toBe(250);
  });
});
