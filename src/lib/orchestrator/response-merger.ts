/**
 * Merges responses from multiple domain agents into a unified response.
 * Handles both single-agent pass-through and multi-agent cross-domain merging.
 */

import type { AgentResult, AgentDomain } from "@/lib/agents/agent-base";
import type { AIResponse } from "@/lib/openai";

export interface MergedResponse {
  domain: AgentDomain;
  domains?: AgentDomain[];
  response: AIResponse;
  isCrossDomain?: boolean;
}

export function mergeSingleResult(result: AgentResult): MergedResponse {
  return {
    domain: result.domain,
    response: result.response,
  };
}

export function mergeMultipleResults(results: AgentResult[]): MergedResponse {
  if (results.length === 0) {
    throw new Error("No agent results to merge");
  }
  if (results.length === 1) {
    return mergeSingleResult(results[0]);
  }

  const domainLabels: Record<AgentDomain, string> = {
    sales: "Sales",
    online: "Field Ops",
    pricing: "Pricing",
    purchase: "Purchase",
    inventory: "Inventory",
  };

  const narratives = results.map(
    (r) => `**${domainLabels[r.domain] ?? r.domain}:** ${r.response.narrative}`,
  );

  const allSuggestions = results.flatMap(
    (r) => r.response.suggestedQuestions ?? [],
  );
  const uniqueSuggestions = [...new Set(allSuggestions)].slice(0, 6);

  const combinedSql = results
    .map((r) => `-- [${r.domain}]\n${r.response.sql}`)
    .join("\n\n");

  const primary = results[0];

  return {
    domain: primary.domain,
    domains: results.map((r) => r.domain),
    isCrossDomain: true,
    response: {
      sql: combinedSql,
      chartType: primary.response.chartType,
      chartConfig: primary.response.chartConfig,
      narrative: narratives.join("\n\n"),
      suggestedQuestions: uniqueSuggestions,
    },
  };
}
