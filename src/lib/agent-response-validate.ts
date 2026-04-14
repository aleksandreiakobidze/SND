import type { AIResponse } from "@/lib/openai";
import type { MetricIntentResult } from "@/lib/agent-metric-intent";

export type AgentValidationResult = {
  ok: boolean;
  /** Human-readable reasons; join for LLM retry prompt */
  reasons: string[];
};

/**
 * Heuristic validation: SQL + light checks on title/narrative vs detected metric intent.
 */
export function validateAgentResponse(
  parsed: AIResponse,
  metricIntent: MetricIntentResult,
): AgentValidationResult {
  const sql = parsed.sql ?? "";
  const reasons: string[] = [];

  const hasTevadoba = /\bTevadobaTotal\b/i.test(sql);
  const hasTanxaAgg = /\bSUM\s*\(\s*Tanxa\s*\)/i.test(sql);
  const hasRaodAgg = /\bSUM\s*\(\s*Raod\s*\)/i.test(sql);

  switch (metricIntent.kind) {
    case "volume_liters": {
      if (!hasTevadoba) {
        reasons.push(
          "The user asked for volume in liters. The SQL must use SUM(TevadobaTotal) (or include TevadobaTotal) with an alias like Liters.",
        );
      }
      if (hasTanxaAgg && !hasTevadoba) {
        reasons.push("Do not use SUM(Tanxa) as the only aggregate for a liters-only request.");
      }
      break;
    }
    case "quantity_units": {
      if (!hasRaodAgg && !/\bRaod\b/i.test(sql)) {
        reasons.push(
          "The user asked for quantity/units. The SQL should aggregate Raod (e.g. SUM(Raod) AS Quantity).",
        );
      }
      break;
    }
    case "revenue_gel": {
      if (!/\bTanxa\b/i.test(sql) && !/\bAmount\b/i.test(sql)) {
        reasons.push(
          "The user asked for monetary amounts. The SQL should include SUM(Tanxa) or line amount columns with a Revenue/Amount-style alias.",
        );
      }
      break;
    }
    case "mixed": {
      if (!(hasTevadoba && /\bTanxa\b/i.test(sql))) {
        reasons.push(
          "The user asked for more than one measure (e.g. liters and revenue). Include both TevadobaTotal (liters) and Tanxa (money) with clear aliases.",
        );
      }
      break;
    }
    case "unspecified":
    default:
      break;
  }

  return { ok: reasons.length === 0, reasons };
}

export function formatValidationFeedbackForRetry(reasons: string[]): string {
  return reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
}
