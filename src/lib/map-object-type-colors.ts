/**
 * Object / customer segment (OrgT) colors — same semantics as the customer map legend:
 * Draft Shop → blue, HoReCa → red, KACC → green, TT → amber.
 * Unknown segments use the extended palette (stable hash).
 */
const CANONICAL_ORGT_HEX: Record<string, string> = {
  "draft shop": "#2563eb",
  horeca: "#dc2626",
  kacc: "#16a34a",
  tt: "#ca8a04",
};

const PALETTE = [
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#db2777",
  "#4f46e5",
  "#65a30d",
  "#0d9488",
  "#c026d3",
  "#b45309",
];

const FALLBACK = "#64748b";

export function normalizeOrgTLabel(raw: unknown): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  return s;
}

function normalizedLookupKey(label: string): string {
  return label.trim().toLowerCase();
}

/** Chart / map fill for a category name: canonical OrgT first, then hashed fallback */
export function colorForObjectTypeLabel(raw: string): string {
  const key = normalizedLookupKey(raw);
  if (!key || key === "---" || key === "—") return FALLBACK;
  const canonical = CANONICAL_ORGT_HEX[key];
  if (canonical) return canonical;
  return PALETTE[Math.abs(hashString(key)) % PALETTE.length];
}

/** Stable color per type label; empty / unknown uses neutral gray */
export function buildOrgTColorMap(labels: string[]): Map<string, string> {
  const unique = [...new Set(labels)]
    .filter((s) => s.length > 0)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const map = new Map<string, string>();
  for (const label of unique) {
    map.set(label, colorForObjectTypeLabel(label));
  }
  map.set("", FALLBACK);
  return map;
}

export function colorForOrgT(map: Map<string, string>, label: string): string {
  if (!label) return FALLBACK;
  return map.get(label) ?? colorForObjectTypeLabel(label);
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}
