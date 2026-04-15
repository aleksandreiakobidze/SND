import type { OwnerAgentHint } from "@/lib/owner-agent-hints-db";
import { getCanonicalDimensionKey, getCanonicalDimensionMeta } from "@/lib/schema";

export type AliasKind = "dimension" | "metric" | "time_grain" | "filter_value";

export type AliasResolution = {
  alias: string;
  canonical: string;
  kind: AliasKind;
};

export type AliasByDimensionUse = {
  alias: string;
  canonicalDimension: string;
  field: string;
  label: string;
};

export type NormalizedAliasContext = {
  normalizedQuestion: string;
  aliasMap: Record<string, string>;
  resolutions: AliasResolution[];
  byDimensionUses: AliasByDimensionUse[];
};

const ALIAS_RULE_RE = /^\s*([a-zA-Z0-9_\-]+)\s*=\s*([a-zA-Z0-9_\-\s]+?)\s*$/;

function escapeRegExp(v: string): string {
  return v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function extractAliasMapFromHints(hints: OwnerAgentHint[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const hint of hints) {
    const lines = hint.body.split(/\r?\n/);
    for (const line of lines) {
      const m = line.match(ALIAS_RULE_RE);
      if (!m) continue;
      const alias = m[1].trim().toLowerCase();
      const rhs = m[2].trim().toLowerCase();
      if (!alias || !rhs) continue;
      out[alias] = rhs;
    }
  }
  return out;
}

function classifyCanonical(canonical: string): AliasKind {
  if (getCanonicalDimensionKey(canonical)) return "dimension";
  return "filter_value";
}

function findByDimensionUses(
  normalizedQuestion: string,
  resolutions: AliasResolution[],
): AliasByDimensionUse[] {
  const out: AliasByDimensionUse[] = [];
  const seen = new Set<string>();
  const q = normalizedQuestion.toLowerCase();
  for (const r of resolutions) {
    if (r.kind !== "dimension") continue;
    const canonical = r.canonical.toLowerCase();
    const meta = getCanonicalDimensionMeta(canonical);
    if (!meta) continue;
    if (!new RegExp(`\\bby\\s+${escapeRegExp(canonical)}\\b`, "i").test(q)) continue;
    const key = `${r.alias}:${canonical}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      alias: r.alias,
      canonicalDimension: canonical,
      field: meta.field,
      label: meta.label,
    });
  }
  return out;
}

export function normalizeQuestionWithAliases(
  question: string,
  aliasMap: Record<string, string>,
): NormalizedAliasContext {
  let normalizedQuestion = question;
  const resolutions: AliasResolution[] = [];
  const entries = Object.entries(aliasMap).sort((a, b) => b[0].length - a[0].length);

  for (const [alias, canonicalRaw] of entries) {
    const canonical = canonicalRaw.trim().toLowerCase();
    if (!canonical) continue;
    const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "gi");
    if (!regex.test(normalizedQuestion)) continue;
    normalizedQuestion = normalizedQuestion.replace(regex, canonical);
    resolutions.push({
      alias,
      canonical,
      kind: classifyCanonical(canonical),
    });
  }

  const byDimensionUses = findByDimensionUses(normalizedQuestion, resolutions);

  return {
    normalizedQuestion,
    aliasMap,
    resolutions,
    byDimensionUses,
  };
}

