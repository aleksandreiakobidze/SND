/**
 * Orchestrator — single entry point for all agent requests.
 * Routes to the correct domain agent, enforces security, manages conversation context.
 * Supports cross-domain parallel execution for multi-agent queries.
 */

import type { AgentContext, AgentDomain, AgentResult } from "@/lib/agents/agent-base";
import type { ComparisonIntentResult } from "@/lib/agent-comparison-intent";
import type { MetricIntentResult } from "@/lib/agent-metric-intent";
import type { NormalizedAliasContext } from "@/lib/agent-alias-normalize";
import type { MinOrderAmountIntent } from "@/lib/agent-min-order-amount-intent";

import { classifyDomain, resolveWithContext, detectCrossDomain } from "./intent-router";
import { inferLastDomainFromHistory } from "./conversation-context";
import { mergeSingleResult, mergeMultipleResults, type MergedResponse } from "./response-merger";
import { getAgent } from "@/lib/agents/registry";
import { hasPermissionForDomain } from "@/lib/agents/domain-permissions";
import { logAgentAudit } from "@/lib/agents/audit-log";

export interface OrchestratorInput {
  question: string;
  normalizedQuestion: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  locale: "en" | "ka";
  userId: string;
  permissions: string[];
  ownerHintsBlock?: string;
  comparisonIntent: ComparisonIntentResult;
  metricIntent: MetricIntentResult;
  aliasContext: NormalizedAliasContext;
  minOrderAmountIntent: MinOrderAmountIntent;
}

export interface OrchestratorOutput {
  merged: MergedResponse;
  domain: AgentDomain;
}

export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const crossDomain = detectCrossDomain(input.normalizedQuestion);

  if (crossDomain.isCrossDomain && crossDomain.domains.length >= 2) {
    return orchestrateCrossDomain(input, crossDomain.domains);
  }

  return orchestrateSingleDomain(input);
}

async function orchestrateSingleDomain(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const classification = classifyDomain(input.normalizedQuestion);
  const lastDomain = inferLastDomainFromHistory(input.history);
  const targetDomain = resolveWithContext(classification, lastDomain);

  if (!hasPermissionForDomain(input.permissions, targetDomain)) {
    throw new PermissionDeniedError(targetDomain);
  }

  const agent = getAgent(targetDomain);
  if (!agent) {
    throw new Error(`No agent registered for domain: ${targetDomain}`);
  }

  const ctx = buildAgentContext(input);
  const start = Date.now();

  let result: AgentResult;
  try {
    result = await agent.generate(ctx);

    logAgentAudit({
      timestamp: new Date().toISOString(),
      userId: input.userId,
      domain: targetDomain,
      question: input.question,
      sql: result.response.sql,
      latencyMs: Date.now() - start,
      success: true,
    });
  } catch (err) {
    logAgentAudit({
      timestamp: new Date().toISOString(),
      userId: input.userId,
      domain: targetDomain,
      question: input.question,
      latencyMs: Date.now() - start,
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
    throw err;
  }

  if (result.handoff) {
    const handoffAgent = getAgent(result.handoff);
    if (handoffAgent && hasPermissionForDomain(input.permissions, result.handoff)) {
      result = await handoffAgent.generate(ctx);
    }
  }

  return {
    merged: mergeSingleResult(result),
    domain: result.domain,
  };
}

async function orchestrateCrossDomain(
  input: OrchestratorInput,
  domains: AgentDomain[],
): Promise<OrchestratorOutput> {
  const permittedDomains = domains.filter((d) =>
    hasPermissionForDomain(input.permissions, d),
  );

  if (permittedDomains.length === 0) {
    throw new PermissionDeniedError(domains[0]);
  }

  if (permittedDomains.length === 1) {
    const agent = getAgent(permittedDomains[0]);
    if (!agent) throw new Error(`No agent registered for domain: ${permittedDomains[0]}`);
    const ctx = buildAgentContext(input);
    const result = await agent.generate(ctx);
    return { merged: mergeSingleResult(result), domain: result.domain };
  }

  const ctx = buildAgentContext(input);
  const start = Date.now();

  const promises = permittedDomains.map(async (domain) => {
    const agent = getAgent(domain);
    if (!agent) return null;
    try {
      const result = await agent.generate(ctx);
      logAgentAudit({
        timestamp: new Date().toISOString(),
        userId: input.userId,
        domain,
        question: `[cross-domain] ${input.question}`,
        sql: result.response.sql,
        latencyMs: Date.now() - start,
        success: true,
      });
      return result;
    } catch (err) {
      logAgentAudit({
        timestamp: new Date().toISOString(),
        userId: input.userId,
        domain,
        question: `[cross-domain] ${input.question}`,
        latencyMs: Date.now() - start,
        success: false,
        error: err instanceof Error ? err.message : "Unknown error",
      });
      return null;
    }
  });

  const settled = await Promise.all(promises);
  const results = settled.filter((r): r is AgentResult => r !== null);

  if (results.length === 0) {
    throw new Error("All cross-domain agents failed");
  }

  return {
    merged: mergeMultipleResults(results),
    domain: results[0].domain,
  };
}

function buildAgentContext(input: OrchestratorInput): AgentContext {
  return {
    question: input.question,
    normalizedQuestion: input.normalizedQuestion,
    history: input.history,
    locale: input.locale,
    ownerHintsBlock: input.ownerHintsBlock,
    comparisonIntent: input.comparisonIntent,
    metricIntent: input.metricIntent,
    aliasContext: input.aliasContext,
    minOrderAmountIntent: input.minOrderAmountIntent,
  };
}

export class PermissionDeniedError extends Error {
  public readonly domain: AgentDomain;
  constructor(domain: AgentDomain) {
    super(`Permission denied for domain: ${domain}`);
    this.name = "PermissionDeniedError";
    this.domain = domain;
  }
}
