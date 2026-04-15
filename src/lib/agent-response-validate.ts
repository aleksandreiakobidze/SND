import type { AIResponse } from "@/lib/openai";
import type { MetricIntentResult } from "@/lib/agent-metric-intent";
import type { NormalizedAliasContext } from "@/lib/agent-alias-normalize";
import type { MinOrderAmountIntent } from "@/lib/agent-min-order-amount-intent";

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
  aliasContext?: NormalizedAliasContext,
  minOrderAmountIntent?: MinOrderAmountIntent,
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

  const dimUses = aliasContext?.byDimensionUses ?? [];
  for (const dimUse of dimUses) {
    const escapedAlias = dimUse.alias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedCanonical = dimUse.canonicalDimension.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const escapedField = dimUse.field.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const hasGroupByField = new RegExp(`\\bGROUP\\s+BY\\b[\\s\\S]*\\b${escapedField}\\b`, "i").test(sql);
    const hasGroupByCanonicalAlias = new RegExp(`\\bGROUP\\s+BY\\b[\\s\\S]*\\b${escapedCanonical}\\b`, "i").test(
      sql,
    );
    if (!hasGroupByField && !hasGroupByCanonicalAlias) {
      reasons.push(
        `Alias "${dimUse.alias}" resolves to ${dimUse.label}. For "by ${dimUse.alias}" requests, SQL must group by ${dimUse.field} (${dimUse.label}).`,
      );
    }

    const leaksLiteralAlias = new RegExp(
      `\\b${escapedField}\\b\\s*=\\s*N?'${escapedAlias}'|\\b${escapedCanonical}\\b\\s*=\\s*N?'${escapedAlias}'`,
      "i",
    ).test(sql);
    if (leaksLiteralAlias) {
      reasons.push(
        `Alias "${dimUse.alias}" is a semantic dimension alias, not a member value. Do not filter ${dimUse.field} by '${dimUse.alias}'.`,
      );
    }
  }

  const hasMinOrderRef = /\bMinOrderAmount\b/i.test(sql);
  const hasTextLikeMinOrder = /\bMinOrderAmount\b\s*(?:=|<>|!=)\s*N?'[^']*'|\bMinOrderAmount\b\s+LIKE\s+N?'[^']*'/i.test(
    sql,
  );
  if (hasTextLikeMinOrder) {
    reasons.push(
      "MinOrderAmount is numeric threshold field. Do not use text predicates (e.g. 'filled' or LIKE) on MinOrderAmount.",
    );
  }

  if (minOrderAmountIntent?.requestedInOutput) {
    const selectMatch = /\bSELECT\b([\s\S]*?)\bFROM\b/i.exec(sql);
    const selectPart = selectMatch?.[1] ?? "";
    if (!/\bMinOrderAmount\b/i.test(selectPart)) {
      reasons.push(
        "The user asked to show/add MinOrderAmount in output. Include MinOrderAmount in SELECT list.",
      );
    }
  }

  const filterIntent = minOrderAmountIntent?.filter;
  if (filterIntent) {
    if (!hasMinOrderRef) {
      reasons.push("The user requested MinOrderAmount filter, but SQL does not reference MinOrderAmount.");
    } else if (filterIntent.operator === "is_not_null") {
      if (!/\bMinOrderAmount\b\s+IS\s+NOT\s+NULL\b/i.test(sql)) {
        reasons.push(
          "For 'minimum order amount exists/not empty/configured', use WHERE MinOrderAmount IS NOT NULL.",
        );
      }
    } else if (filterIntent.operator === "is_null") {
      if (!/\bMinOrderAmount\b\s+IS\s+NULL\b/i.test(sql)) {
        reasons.push("For 'minimum order amount is empty/null', use WHERE MinOrderAmount IS NULL.");
      }
    } else {
      const op =
        filterIntent.operator === "gt"
          ? ">"
          : filterIntent.operator === "gte"
            ? ">="
            : filterIntent.operator === "lt"
              ? "<"
              : filterIntent.operator === "lte"
                ? "<="
                : filterIntent.operator === "neq"
                  ? "(?:<>|!=)"
                  : "=";
      const value = filterIntent.value;
      if (value === undefined || !Number.isFinite(value)) {
        reasons.push("MinOrderAmount numeric filter is missing a numeric threshold value.");
      } else {
        const numericPredicate = new RegExp(`\\bMinOrderAmount\\b\\s*${op}\\s*${value}\\b`, "i");
        if (!numericPredicate.test(sql)) {
          reasons.push(
            `Apply numeric MinOrderAmount filter as MinOrderAmount ${filterIntent.operator} ${value} (SQL operator equivalent).`,
          );
        }
      }
    }
  }

  return { ok: reasons.length === 0, reasons };
}

export function formatValidationFeedbackForRetry(reasons: string[]): string {
  return reasons.map((r, i) => `${i + 1}. ${r}`).join("\n");
}
