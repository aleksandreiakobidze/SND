import { describe, expect, it } from "vitest";
import { extractAliasMapFromHints, normalizeQuestionWithAliases } from "@/lib/agent-alias-normalize";
import { validateAgentResponse } from "@/lib/agent-response-validate";
import type { MetricIntentResult } from "@/lib/agent-metric-intent";

describe("agent alias normalization", () => {
  it("extracts alias rules and normalizes by-dimension prompts", () => {
    const hints = [
      {
        id: "1",
        title: "alias",
        body: "xxx = brand\ncust = customer",
        sortOrder: 0,
        createdAt: "",
        updatedAt: "",
      },
    ];
    const aliasMap = extractAliasMapFromHints(hints);
    const normalized = normalizeQuestionWithAliases("give me sales by xxx today", aliasMap);

    expect(aliasMap.xxx).toBe("brand");
    expect(normalized.normalizedQuestion).toBe("give me sales by brand today");
    expect(normalized.byDimensionUses[0]?.field).toBe("ProdT");
  });
});

describe("alias-aware SQL validation", () => {
  const metricIntent: MetricIntentResult = {
    kind: "revenue_gel",
    hasMoney: true,
    hasQuantity: false,
    hasVolume: false,
  };

  it("rejects leaking alias token as literal filter", () => {
    const aliasContext = normalizeQuestionWithAliases("give me sales by xxx today", { xxx: "brand" });
    const bad = validateAgentResponse(
      {
        sql: "SELECT ProdT AS Brand, SUM(Tanxa) AS Revenue FROM RealViewAgent WHERE ProdT = N'xxx' GROUP BY ProdT",
        chartType: "bar",
        chartConfig: {},
        narrative: "sales by xxx",
        suggestedQuestions: [],
      },
      metricIntent,
      aliasContext,
    );
    expect(bad.ok).toBe(false);
    expect(bad.reasons.join(" ")).toMatch(/semantic dimension alias/i);
  });

  it("accepts grouped dimension SQL for by-alias request", () => {
    const aliasContext = normalizeQuestionWithAliases("give me sales by xxx today", { xxx: "brand" });
    const ok = validateAgentResponse(
      {
        sql: "SELECT ProdT AS Brand, SUM(Tanxa) AS Revenue FROM RealViewAgent WHERE CAST(Data AS date)=CAST(GETDATE() AS date) GROUP BY ProdT ORDER BY Revenue DESC",
        chartType: "bar",
        chartConfig: {},
        narrative: "sales by brand",
        suggestedQuestions: [],
      },
      metricIntent,
      aliasContext,
    );
    expect(ok.ok).toBe(true);
  });
});

