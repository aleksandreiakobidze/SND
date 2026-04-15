/**
 * Base contract for all SND domain agents.
 * Each agent generates SQL for its domain; the orchestrator calls agents through this interface.
 */

import type { AIResponse } from "@/lib/openai";
import type { MetricIntentResult } from "@/lib/agent-metric-intent";
import type { ComparisonIntentResult } from "@/lib/agent-comparison-intent";
import type { NormalizedAliasContext } from "@/lib/agent-alias-normalize";
import type { MinOrderAmountIntent } from "@/lib/agent-min-order-amount-intent";

export type AgentDomain =
  | "sales"
  | "online"
  | "pricing"
  | "purchase"
  | "inventory";

export interface AgentContext {
  question: string;
  normalizedQuestion: string;
  history: Array<{ role: "user" | "assistant" | "system"; content: string }>;
  locale: "en" | "ka";
  ownerHintsBlock?: string;
  comparisonIntent: ComparisonIntentResult;
  metricIntent: MetricIntentResult;
  aliasContext: NormalizedAliasContext;
  minOrderAmountIntent: MinOrderAmountIntent;
  validationFeedback?: string;
}

export interface AgentResult {
  domain: AgentDomain;
  response: AIResponse;
  /** If this agent cannot answer, suggest a handoff target. */
  handoff?: AgentDomain;
}

export interface DomainAgent {
  readonly domain: AgentDomain;
  readonly label: string;
  readonly labelKa: string;
  /** Permission key required to access this agent (checked by orchestrator before calling). */
  readonly requiredPermission: string;
  /** Views this agent is allowed to query. */
  readonly allowedViews: string[];

  generate(ctx: AgentContext): Promise<AgentResult>;
}
