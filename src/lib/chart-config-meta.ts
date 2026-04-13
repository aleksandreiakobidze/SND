import type { ChartConfig } from "@/types";

/** Chart type label for filter chips / badges (from config or JSON). */
export function chartTypeFromConfig(config: ChartConfig | null | undefined): string | null {
  if (!config?.type) return null;
  return config.type;
}

export function chartTypeFromJsonString(json: string | null | undefined): string | null {
  if (!json?.trim()) return null;
  try {
    const o = JSON.parse(json) as ChartConfig;
    return typeof o?.type === "string" ? o.type : null;
  } catch {
    return null;
  }
}

export function parseTagsJson(raw: string | null | undefined): string[] {
  if (!raw?.trim()) return [];
  try {
    const v = JSON.parse(raw) as unknown;
    if (!Array.isArray(v)) return [];
    return v.filter((x): x is string => typeof x === "string" && x.trim().length > 0).map((s) => s.trim());
  } catch {
    return [];
  }
}

export function serializeTagsJson(tags: string[]): string | null {
  const cleaned = [...new Set(tags.map((t) => t.trim()).filter(Boolean))];
  if (cleaned.length === 0) return null;
  return JSON.stringify(cleaned);
}
