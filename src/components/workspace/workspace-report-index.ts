import type { SavedReportMeta, WorkspaceTree } from "@/lib/workspace-db";

export type WorkspaceSortMode = "name" | "updated" | "opened" | "used";

export type WorkspaceFilterScope = "all" | "favorites" | "pinned";

export type FlatReportEntry = {
  report: SavedReportMeta;
  sectionId: string;
  sectionTitle: string;
};

export function flattenReportsInTab(ws: WorkspaceTree): FlatReportEntry[] {
  const out: FlatReportEntry[] = [];
  for (const sec of ws.sections) {
    for (const r of sec.reports) {
      out.push({ report: r, sectionId: sec.id, sectionTitle: sec.title });
    }
  }
  return out;
}

function matchesSearch(r: SavedReportMeta, q: string): boolean {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  if (r.title.toLowerCase().includes(s)) return true;
  if (r.narrative?.toLowerCase().includes(s)) return true;
  for (const tag of r.tags) {
    if (tag.toLowerCase().includes(s)) return true;
  }
  return false;
}

export function filterFlatReports(
  entries: FlatReportEntry[],
  options: {
    search: string;
    scope: WorkspaceFilterScope;
    chartType: string | null;
  },
): FlatReportEntry[] {
  return entries.filter(({ report: r }) => {
    if (!matchesSearch(r, options.search)) return false;
    if (options.scope === "favorites" && !r.isFavorite) return false;
    if (options.scope === "pinned" && !r.isPinned) return false;
    if (options.chartType && (r.chartType ?? "") !== options.chartType) return false;
    return true;
  });
}

export function sortFlatReports(entries: FlatReportEntry[], mode: WorkspaceSortMode): FlatReportEntry[] {
  const copy = [...entries];
  copy.sort((a, b) => {
    const ra = a.report;
    const rb = b.report;
    switch (mode) {
      case "name":
        return ra.title.localeCompare(rb.title, undefined, { sensitivity: "base" });
      case "updated": {
        const ta = new Date(ra.updatedAt).getTime();
        const tb = new Date(rb.updatedAt).getTime();
        return tb - ta;
      }
      case "opened": {
        const la = ra.lastOpenedAt ? new Date(ra.lastOpenedAt).getTime() : 0;
        const lb = rb.lastOpenedAt ? new Date(rb.lastOpenedAt).getTime() : 0;
        return lb - la;
      }
      case "used":
        return rb.openCount - ra.openCount;
      default:
        return 0;
    }
  });
  return copy;
}

/** Group sorted flat list back into section order; preserves section order from workspace. */
export function groupBySectionOrder(
  ws: WorkspaceTree,
  sortedFlat: FlatReportEntry[],
): { sectionId: string; title: string; colorKey: string | null; reports: SavedReportMeta[] }[] {
  const bySection = new Map<string, SavedReportMeta[]>();
  for (const s of ws.sections) {
    bySection.set(s.id, []);
  }
  for (const e of sortedFlat) {
    const list = bySection.get(e.sectionId);
    if (list) list.push(e.report);
  }
  return ws.sections.map((s) => ({
    sectionId: s.id,
    title: s.title,
    colorKey: s.colorKey,
    reports: bySection.get(s.id) ?? [],
  }));
}

export function tabReportCount(ws: WorkspaceTree): number {
  return ws.sections.reduce((n, s) => n + s.reports.length, 0);
}
