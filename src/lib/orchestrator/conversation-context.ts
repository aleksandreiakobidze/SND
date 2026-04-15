/**
 * Cross-turn domain memory for the orchestrator.
 * Tracks which domain was last used so follow-up questions route to the same agent.
 * 
 * In Phase 1 this is stateless per-request (derived from conversation history).
 * Can later be backed by session/DB storage.
 */

import type { AgentDomain } from "@/lib/agents/agent-base";

const DOMAIN_LABELS: Record<AgentDomain, string[]> = {
  sales: ["[Sales]", "[SALES]"],
  online: ["[Field Operations]", "[ONLINE]"],
  pricing: ["[Pricing]", "[PRICING]"],
  purchase: ["[Purchase]", "[PURCHASE]"],
  inventory: ["[Inventory]", "[INVENTORY]"],
};

/**
 * Scan conversation history (assistant messages) for domain badges to recover last-used domain.
 */
export function inferLastDomainFromHistory(
  history: Array<{ role: string; content: string }>,
): AgentDomain | null {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== "assistant") continue;
    for (const [domain, labels] of Object.entries(DOMAIN_LABELS) as Array<
      [AgentDomain, string[]]
    >) {
      if (labels.some((l) => msg.content.includes(l))) {
        return domain;
      }
    }
  }
  return null;
}
