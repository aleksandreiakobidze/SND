import { describe, expect, it } from "vitest";
import { composeAgentEmailBody } from "@/lib/agent-email-body-compose";

const baseParams = {
  locale: "en" as const,
  deliveryExcelKind: "flat" as const,
  chartImageActuallyAttached: false,
  chartConfig: { type: "bar" as const, title: "Test", xKey: "x", yKeys: ["y"] },
  metricIntentKind: undefined as undefined,
  rawRows: [{ x: "A", y: 100 }],
};

describe("composeAgentEmailBody", () => {
  it("uses custom text exactly with no greeting", () => {
    const r = composeAgentEmailBody({
      ...baseParams,
      emailBodyMode: "custom",
      customEmailBodyText: "make thiiiiis",
    });
    expect(r.text).toBe("make thiiiiis");
    expect(r.emailBodyModeSent).toBe("custom");
    expect(r.bodyContentIncluded).toBe(true);
  });

  it("does not embed assistant narrative for summary mode", () => {
    const r = composeAgentEmailBody({
      ...baseParams,
      emailBodyMode: "summary",
      customEmailBodyText: null,
    });
    expect(r.text).not.toContain("narrative");
    expect(r.text).toContain("Summary");
    expect(r.text).toContain("Test");
    expect(r.emailBodyModeSent).toBe("summary");
  });

  it("includes unquoted with summary: note inside the Summary block", () => {
    const r = composeAgentEmailBody({
      ...baseParams,
      emailBodyMode: "summary",
      customEmailBodyText: null,
      summaryUserNote: "yeeeeeeeeeeeeeeeeeeeeeeeeee",
    });
    expect(r.text).toContain("yeeeeeeeeeeeeeeeeeeeeeeeeee");
    expect(r.text).toContain("Summary");
    expect(r.text.indexOf("Summary")).toBeLessThan(r.text.indexOf("yeeee"));
    expect(r.emailBodyModeSent).toBe("summary");
  });
});
