/**
 * Lightweight agent audit log. Prints structured JSON to server console.
 * Can be extended to write to a DB table (e.g. SndApp_AgentAuditLog) later.
 */

import type { AgentDomain } from "./agent-base";

export interface AgentAuditEntry {
  timestamp: string;
  userId: string;
  domain: AgentDomain;
  question: string;
  sql?: string;
  rowCount?: number;
  latencyMs: number;
  success: boolean;
  error?: string;
}

export function logAgentAudit(entry: AgentAuditEntry): void {
  try {
    console.log("[agent-audit]", JSON.stringify(entry));
  } catch {
    /* non-critical */
  }
}
