/**
 * Agent registry — single source of truth for all active domain agents.
 */

import type { DomainAgent, AgentDomain } from "./agent-base";
import { salesAgent } from "./sales/sales-agent";
import { onlineAgent } from "./online/online-agent";
import { pricingAgent } from "./pricing/pricing-agent";
import { purchaseAgent } from "./purchase/purchase-agent";
import { inventoryAgent } from "./inventory/inventory-agent";

const agents: DomainAgent[] = [
  salesAgent,
  onlineAgent,
  pricingAgent,
  purchaseAgent,
  inventoryAgent,
];

export function getAgent(domain: AgentDomain): DomainAgent | undefined {
  return agents.find((a) => a.domain === domain);
}

export function getAllAgents(): DomainAgent[] {
  return [...agents];
}

export function registerAgent(agent: DomainAgent): void {
  const idx = agents.findIndex((a) => a.domain === agent.domain);
  if (idx >= 0) {
    agents[idx] = agent;
  } else {
    agents.push(agent);
  }
}
