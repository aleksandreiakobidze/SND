import { describe, expect, it } from "vitest";
import { formatDateLikeLabel } from "@/lib/coordinate-format";

describe("formatDateLikeLabel", () => {
  it("formats iso datetime labels to YYYY-MM-DD", () => {
    expect(formatDateLikeLabel("2026-04-02T00:00:00.000Z")).toBe("2026-04-02");
    expect(formatDateLikeLabel("2026-04-09T00:00:00+00:00")).toBe("2026-04-09");
  });

  it("keeps plain dates untouched", () => {
    expect(formatDateLikeLabel("2026-04-14")).toBe("2026-04-14");
  });
});
