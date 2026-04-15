/**
 * Maps agent domains to required permission keys.
 * Orchestrator checks these before routing.
 */

import type { AgentDomain } from "./agent-base";

export const DOMAIN_PERMISSION_MAP: Record<AgentDomain, string> = {
  sales: "use_agent",
  online: "use_agent",
  pricing: "use_agent",
  purchase: "use_agent",
  inventory: "use_agent",
};

export function hasPermissionForDomain(
  permissions: string[],
  domain: AgentDomain,
): boolean {
  const required = DOMAIN_PERMISSION_MAP[domain];
  return permissions.includes(required);
}
