"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  Filter,
  GripVertical,
  LayoutGrid,
  LineChart,
  List,
  MoreHorizontal,
  Pencil,
  PieChart,
  Pin,
  Plus,
  Search,
  Table2,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  arrayMove,
  horizontalListSortingStrategy,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { PageHeader } from "@/components/layout/PageHeader";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/locale-context";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import type { SavedReportMeta, WorkspaceTree } from "@/lib/workspace-db";
import { SavedReportLibraryCard } from "@/components/workspace/SavedReportLibraryCard";
import { SavedReportLibraryRow } from "@/components/workspace/SavedReportLibraryRow";
import { MoveReportDialog } from "@/components/workspace/MoveReportDialog";
import {
  applyReportDragEnd,
  REP_PREFIX,
  SEC_PREFIX,
  stripSecPrefix,
} from "@/components/workspace/workspace-dnd-helpers";
import {
  filterFlatReports,
  flattenReportsInTab,
  groupBySectionOrder,
  sortFlatReports,
  tabReportCount,
  type WorkspaceFilterScope,
  type WorkspaceSortMode,
} from "@/components/workspace/workspace-report-index";
import { cn } from "@/lib/utils";

const VIEW_KEY = "snd-workspace-view";
const COLLAPSE_KEY = "snd-workspace-collapsed-sections";

function buildReportOrderMap(ws: WorkspaceTree): Record<string, string[]> {
  const o: Record<string, string[]> = {};
  for (const s of ws.sections) {
    o[s.id] = s.reports.map((r) => r.id);
  }
  return o;
}

async function persistReportLayout(
  prev: Record<string, string[]>,
  next: Record<string, string[]>,
): Promise<void> {
  const reportToSection = (m: Record<string, string[]>) => {
    const map = new Map<string, string>();
    for (const [sid, ids] of Object.entries(m)) {
      for (const rid of ids) map.set(rid, sid);
    }
    return map;
  };
  const before = reportToSection(prev);
  const after = reportToSection(next);

  for (const [rid, newSid] of after) {
    const oldSid = before.get(rid);
    if (oldSid !== newSid) {
      const res = await fetch(`/api/reports/${rid}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: newSid }),
      });
      if (!res.ok) throw new Error("move failed");
    }
  }

  const sections = new Set([...Object.keys(prev), ...Object.keys(next)]);
  for (const sid of sections) {
    const a = (next[sid] ?? []).join(",");
    const b = (prev[sid] ?? []).join(",");
    if (a !== b) {
      const ids = next[sid] ?? [];
      if (ids.length > 0) {
        const res = await fetch(`/api/sections/${sid}/reports/reorder`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reportIds: ids }),
        });
        if (!res.ok) throw new Error("reorder failed");
      }
    }
  }
}

/* ── Sortable workspace tab ──────────────────────────────────── */

function SortableWorkspaceTab({
  id,
  active,
  canEdit,
  label,
  onSelect,
  dragAriaLabel,
}: {
  id: string;
  active: boolean;
  canEdit: boolean;
  label: React.ReactNode;
  onSelect: () => void;
  dragAriaLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canEdit,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-0.5 rounded-lg", isDragging && "z-50 opacity-60")}
    >
      {canEdit && (
        <button
          type="button"
          className="cursor-grab touch-none rounded p-0.5 text-muted-foreground/50 opacity-0 transition-opacity group-hover/tab-bar:opacity-100 hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label={dragAriaLabel}
        >
          <GripVertical className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "relative rounded-lg px-3 py-2 text-sm font-medium transition-all",
          active
            ? "bg-background text-foreground shadow-sm ring-1 ring-border/80"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        {label}
      </button>
    </div>
  );
}

/* ── Sortable section header ─────────────────────────────────── */

function SortableSectionHeader({
  sectionId,
  canEdit,
  titleContent,
  actions,
  dragAriaLabel,
  accentClassName,
}: {
  sectionId: string;
  canEdit: boolean;
  titleContent: React.ReactNode;
  actions?: React.ReactNode;
  dragAriaLabel: string;
  accentClassName?: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${SEC_PREFIX}${sectionId}`,
    disabled: !canEdit,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group/sec flex items-center justify-between gap-2 px-4 py-3",
        accentClassName,
        isDragging && "z-50 opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {canEdit && (
          <button
            type="button"
            className="cursor-grab touch-none shrink-0 rounded p-0.5 text-muted-foreground/40 opacity-0 transition-opacity group-hover/sec:opacity-100 hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label={dragAriaLabel}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">{titleContent}</div>
      </div>
      {actions}
    </div>
  );
}

/* ── Empty section drop zone ─────────────────────────────────── */

function EmptySectionDropFixed({
  sectionId,
  title,
  hint,
  newReportCta,
}: {
  sectionId: string;
  title: string;
  hint: string;
  newReportCta: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `${SEC_PREFIX}${sectionId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[5rem] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/50 bg-muted/5 p-8 text-center text-sm text-muted-foreground transition-colors",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <p className="font-medium text-foreground/80">{title}</p>
      <p className="max-w-sm text-xs">{hint}</p>
      <Link href="/agent" className={buttonVariants({ variant: "secondary", size: "sm" })}>
        {newReportCta}
      </Link>
    </div>
  );
}

/* ── Sortable report row wrapper ─────────────────────────────── */

function SortableReportRow({
  reportId,
  canEdit,
  children,
  dragAriaLabel,
}: {
  reportId: string;
  canEdit: boolean;
  children: React.ReactNode;
  dragAriaLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${REP_PREFIX}${reportId}`,
    disabled: !canEdit,
  });
  const style = { transform: CSS.Transform.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-50 opacity-50")}>
      <div className="flex items-start gap-1.5">
        {canEdit && (
          <button
            type="button"
            className="mt-3 cursor-grab touch-none shrink-0 rounded p-0.5 text-muted-foreground/40 hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label={dragAriaLabel}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

/* ── Icons ───────────────────────────────────────────────────── */

const TAB_ICONS: Record<string, React.ElementType> = {
  BarChart3,
  LayoutGrid,
  LineChart,
  PieChart,
  Table2,
  TrendingUp,
};

function TabIcon({ name }: { name: string | null }) {
  if (!name) return null;
  const I = TAB_ICONS[name] ?? LayoutGrid;
  return <I className="mr-1.5 inline h-3.5 w-3.5 opacity-70" />;
}

function QuickAccessChartGlyph({ type }: { type: string | null }) {
  const cls = "h-4 w-4 shrink-0 text-muted-foreground";
  switch (type) {
    case "line": return <LineChart className={cls} />;
    case "pie": return <PieChart className={cls} />;
    case "area": return <TrendingUp className={cls} />;
    case "table": return <Table2 className={cls} />;
    case "bar": default: return <BarChart3 className={cls} />;
  }
}

const SECTION_RING: Record<string, string> = {
  blue: "border-l-[3px] border-l-blue-500/70",
  violet: "border-l-[3px] border-l-violet-500/70",
  emerald: "border-l-[3px] border-l-emerald-500/70",
  amber: "border-l-[3px] border-l-amber-500/70",
  rose: "border-l-[3px] border-l-rose-500/70",
};

const COLOR_DOTS: { key: string; cls: string }[] = [
  { key: "blue", cls: "bg-blue-500" },
  { key: "violet", cls: "bg-violet-500" },
  { key: "emerald", cls: "bg-emerald-500" },
  { key: "amber", cls: "bg-amber-500" },
  { key: "rose", cls: "bg-rose-500" },
];

const ICON_OPTIONS: { value: string; label: string }[] = [
  { value: "none", label: "No icon" },
  { value: "LayoutGrid", label: "Grid" },
  { value: "BarChart3", label: "Chart" },
  { value: "LineChart", label: "Line" },
  { value: "PieChart", label: "Pie" },
  { value: "Table2", label: "Table" },
  { value: "TrendingUp", label: "Trend" },
];

/* ================================================================
   Main component
   ================================================================ */

export function WorkspacePageClient() {
  const { t } = useLocale();
  const { user, permissions } = useAuth();
  const { canEditWorkspace } = useAuthCapabilities(permissions);
  const canReorderWorkspace = Boolean(user);
  const searchRef = useRef<HTMLInputElement>(null);

  const [tree, setTree] = useState<WorkspaceTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [addingTab, setAddingTab] = useState(false);
  const [newTabName, setNewTabName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");
  const [editingWsId, setEditingWsId] = useState<string | null>(null);
  const [wsTitleDraft, setWsTitleDraft] = useState("");
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [sectionTitleDraft, setSectionTitleDraft] = useState("");

  const [search, setSearch] = useState("");
  const [sortMode, setSortMode] = useState<WorkspaceSortMode>("updated");
  const [filterScope, setFilterScope] = useState<WorkspaceFilterScope>("all");
  const [chartTypeFilter, setChartTypeFilter] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [moveTarget, setMoveTarget] = useState<{ id: string; title: string; sectionId: string } | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "tab"; id: string }
    | { kind: "section"; id: string }
    | { kind: "report"; id: string }
    | null
  >(null);

  /* ── Persistence ─────────────────────────────────────────── */

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "list" || v === "card") setViewMode(v);
      const c = localStorage.getItem(COLLAPSE_KEY);
      if (c) setCollapsed(JSON.parse(c) as Record<string, boolean>);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(VIEW_KEY, viewMode); } catch { /* ignore */ }
  }, [viewMode]);

  useEffect(() => {
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed)); } catch { /* ignore */ }
  }, [collapsed]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* ── Data loading ────────────────────────────────────────── */

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/workspaces", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) { setError(json.error || json.details || t("error")); return; }
      const list = json as WorkspaceTree[];
      setTree(list);
      setActiveWsId((prev) => {
        if (prev && list.some((w) => w.id === prev)) return prev;
        return list[0]?.id ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { void load(); }, [load]);

  const activeWs = tree.find((w) => w.id === activeWsId) ?? null;

  const hasActiveFilters = search.trim().length > 0 || filterScope !== "all" || chartTypeFilter !== null;
  const nonDefaultSort = sortMode !== "updated";

  const displaySections = useMemo(() => {
    if (!activeWs) return [];
    const flat = flattenReportsInTab(activeWs);
    const filtered = filterFlatReports(flat, { search, scope: filterScope, chartType: chartTypeFilter });
    const sorted = sortFlatReports(filtered, sortMode);
    return groupBySectionOrder(activeWs, sorted);
  }, [activeWs, search, filterScope, chartTypeFilter, sortMode]);

  /* ── Quick access ────────────────────────────────────────── */

  type QuickItem = { report: SavedReportMeta; category: "pinned" | "favorite" | "recent" };

  const quickItems = useMemo<QuickItem[]>(() => {
    if (!activeWs) return [];
    const flat = flattenReportsInTab(activeWs);
    const seen = new Set<string>();
    const items: QuickItem[] = [];
    for (const e of flat) {
      if (e.report.isPinned && !seen.has(e.report.id)) {
        items.push({ report: e.report, category: "pinned" });
        seen.add(e.report.id);
      }
    }
    for (const e of flat) {
      if (e.report.isFavorite && !seen.has(e.report.id)) {
        items.push({ report: e.report, category: "favorite" });
        seen.add(e.report.id);
      }
    }
    const recent = [...flat]
      .filter((e) => e.report.lastOpenedAt && !seen.has(e.report.id))
      .sort((a, b) => new Date(b.report.lastOpenedAt!).getTime() - new Date(a.report.lastOpenedAt!).getTime());
    for (const e of recent.slice(0, 4)) {
      items.push({ report: e.report, category: "recent" });
      seen.add(e.report.id);
    }
    return items.slice(0, 8);
  }, [activeWs]);

  /* ── CRUD ────────────────────────────────────────────────── */

  async function addWorkspace() {
    if (!canEditWorkspace) return;
    const title = newTabName.trim();
    if (!title) return;
    const res = await fetch("/api/workspaces", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const json = (await res.json()) as { id?: string; error?: string };
    if (!res.ok) return;
    setNewTabName("");
    setAddingTab(false);
    if (json.id) setActiveWsId(json.id);
    await load();
    toast.success(t("workspaceToastSaved"));
  }

  async function removeWorkspace(id: string) {
    if (!canEditWorkspace) return;
    const res = await fetch(`/api/workspaces/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    if (activeWsId === id) setActiveWsId(null);
    await load();
    toast.success(t("workspaceToastSaved"));
  }

  async function saveWorkspaceTitle(workspaceId: string) {
    const title = wsTitleDraft.trim();
    if (!title) return;
    const res = await fetch(`/api/workspaces/${workspaceId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) { setEditingWsId(null); await load(); toast.success(t("workspaceToastSaved")); }
  }

  async function setWorkspaceIcon(wId: string, iconKey: string | null) {
    const res = await fetch(`/api/workspaces/${wId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ iconKey }),
    });
    if (res.ok) await load();
  }

  async function togglePinWorkspace(w: WorkspaceTree) {
    if (!canEditWorkspace) return;
    const res = await fetch(`/api/workspaces/${w.id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !w.isPinned }),
    });
    if (res.ok) { await load(); toast.success(t("workspaceToastSaved")); }
  }

  async function addSection() {
    if (!canEditWorkspace || !activeWsId) return;
    const title = newSectionName.trim();
    if (!title) return;
    const res = await fetch(`/api/workspaces/${activeWsId}/sections`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (!res.ok) return;
    setNewSectionName("");
    await load();
    toast.success(t("workspaceToastSaved"));
  }

  async function removeSection(id: string) {
    if (!canEditWorkspace) return;
    const res = await fetch(`/api/sections/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    await load();
    toast.success(t("workspaceToastSaved"));
  }

  async function saveSectionTitle(sectionId: string) {
    const title = sectionTitleDraft.trim();
    if (!title) return;
    const res = await fetch(`/api/sections/${sectionId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) { setEditingSectionId(null); await load(); toast.success(t("workspaceToastSaved")); }
  }

  async function setSectionColor(sectionId: string, colorKey: string | null) {
    const res = await fetch(`/api/sections/${sectionId}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ colorKey }),
    });
    if (res.ok) { await load(); toast.success(t("workspaceToastSaved")); }
  }

  /* ── DnD ─────────────────────────────────────────────────── */

  const onWorkspaceDragEnd = async (event: DragEndEvent) => {
    if (!canReorderWorkspace) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const ids = tree.map((w) => w.id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    const res = await fetch("/api/workspaces/reorder", {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceIds: newOrder }),
    });
    if (res.ok) await load();
  };

  const onSectionDragEnd = async (event: DragEndEvent) => {
    if (!canReorderWorkspace || !activeWs) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const a = stripSecPrefix(String(active.id));
    const o = stripSecPrefix(String(over.id));
    const ids = activeWs.sections.map((s) => s.id);
    const oldIndex = ids.indexOf(a);
    const newIndex = ids.indexOf(o);
    if (oldIndex === -1 || newIndex === -1) return;
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    const res = await fetch(`/api/workspaces/${activeWs.id}/sections/reorder`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sectionIds: newOrder }),
    });
    if (res.ok) await load();
  };

  const onReportDragEnd = async (event: DragEndEvent) => {
    if (!canReorderWorkspace || !activeWs || hasActiveFilters) return;
    const prev = buildReportOrderMap(activeWs);
    const next = applyReportDragEnd(prev, event);
    if (!next) return;
    try {
      await persistReportLayout(prev, next);
      await load();
    } catch {
      setError(t("workspaceReorderFailed"));
      await load();
    }
  };

  const onContentDragEnd = (event: DragEndEvent) => {
    const aid = String(event.active.id);
    if (aid.startsWith(SEC_PREFIX)) { void onSectionDragEnd(event); return; }
    if (aid.startsWith(REP_PREFIX)) void onReportDragEnd(event);
  };

  /* ── Report actions ──────────────────────────────────────── */

  async function patchReport(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/reports/${id}`, {
      method: "PATCH", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) { await load(); return true; }
    return false;
  }

  async function refreshReport(id: string) {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/reports/${id}/refresh`, { method: "POST", credentials: "include" });
      if (res.ok) { toast.success(t("workspaceToastSaved")); await load(); }
      else toast.error(t("error"));
    } finally { setRefreshingId(null); }
  }

  async function deleteReport(id: string) {
    const res = await fetch(`/api/reports/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) { await load(); toast.success(t("workspaceToastDeleted")); }
  }

  async function duplicateReport(id: string) {
    const res = await fetch(`/api/reports/${id}/duplicate`, {
      method: "POST", credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) { await load(); toast.success(t("workspaceToastDuplicated")); }
  }

  async function confirmMove(sectionId: string) {
    if (!moveTarget) return;
    const ok = await patchReport(moveTarget.id, { sectionId });
    if (ok) toast.success(t("workspaceToastMoved"));
  }

  /* ── Loading / error ─────────────────────────────────────── */

  if (loading) {
    return (
      <div className="relative p-6">
        <PageGradientBackdrop />
        <p className="relative text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (error && !tree.length) {
    return (
      <div className="relative p-6">
        <PageGradientBackdrop />
        <p className="relative text-destructive">{error}</p>
        <Button type="button" variant="outline" className="relative mt-4" onClick={() => void load()}>
          {t("retry")}
        </Button>
      </div>
    );
  }

  const workspaceIds = tree.map((w) => w.id);
  const sectionSortIds = activeWs ? activeWs.sections.map((s) => `${SEC_PREFIX}${s.id}`) : [];

  function clearAllFilters() {
    setSearch("");
    setFilterScope("all");
    setChartTypeFilter(null);
    setSortMode("updated");
  }

  /* ================================================================
     Render
     ================================================================ */

  return (
    <div className="relative min-h-full">
      <PageGradientBackdrop />
      <div className="relative mx-auto max-w-6xl space-y-6 px-4 pb-12 pt-6 sm:px-6">

        {/* ── Header ───────────────────────────────────────── */}
        <PageHeader title={t("myWorkspace")} description={t("workspacePageDesc")} className="max-w-xl">
          <Link
            href="/agent"
            className={buttonVariants({ size: "sm", className: "h-9 gap-1.5 rounded-xl" })}
          >
            <Plus className="h-4 w-4" />
            {t("workspaceNewReport")}
          </Link>
        </PageHeader>

        {!canEditWorkspace && (
          <p className="text-sm text-muted-foreground">{t("workspaceReadOnlyHint")}</p>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {/* ── Workspace tabs ───────────────────────────────── */}
        <div className="group/tab-bar glass-panel rounded-2xl p-3">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onWorkspaceDragEnd}>
            <div className="flex min-w-0 flex-wrap items-center gap-1">
              {tree.length === 0 ? (
                <p className="px-2 py-2 text-sm text-muted-foreground">{t("workspaceEmpty")}</p>
              ) : (
                <SortableContext items={workspaceIds} strategy={horizontalListSortingStrategy}>
                  {tree.map((w) => (
                    <div key={w.id} className="group/tab relative flex items-center">
                      {editingWsId === w.id ? (
                        <div className="flex items-center gap-1 rounded-lg bg-muted/40 p-1">
                          <Input
                            className="h-7 w-[140px] text-sm"
                            value={wsTitleDraft}
                            onChange={(e) => setWsTitleDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveWorkspaceTitle(w.id);
                              if (e.key === "Escape") setEditingWsId(null);
                            }}
                            autoFocus
                          />
                          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => void saveWorkspaceTitle(w.id)}>
                            {t("workspaceSave")}
                          </Button>
                        </div>
                      ) : (
                        <>
                          <SortableWorkspaceTab
                            id={w.id}
                            active={activeWsId === w.id}
                            canEdit={canReorderWorkspace}
                            dragAriaLabel={t("workspaceDragHandle")}
                            onSelect={() => setActiveWsId(w.id)}
                            label={
                              <span className="flex items-center gap-1.5">
                                <TabIcon name={w.iconKey} />
                                <span>{w.title}</span>
                                <Badge variant="secondary" className="ml-1 font-mono text-[0.6rem] leading-none">
                                  {tabReportCount(w)}
                                </Badge>
                              </span>
                            }
                          />
                          {canEditWorkspace && (
                            <DropdownMenu>
                              <DropdownMenuTrigger
                                className={cn(
                                  buttonVariants({ variant: "ghost", size: "icon-xs" }),
                                  "h-6 w-6 opacity-0 transition-opacity group-hover/tab:opacity-100",
                                  activeWsId === w.id && "opacity-60",
                                )}
                              >
                                <MoreHorizontal className="h-3.5 w-3.5" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="start" className="w-44">
                                <DropdownMenuItem onSelect={() => { setEditingWsId(w.id); setWsTitleDraft(w.title); }}>
                                  <Pencil className="mr-2 h-3.5 w-3.5" />
                                  {t("workspaceRename")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void togglePinWorkspace(w)}>
                                  <Pin className="mr-2 h-3.5 w-3.5" />
                                  {w.isPinned ? t("workspaceUnpinTab") : t("workspacePinTab")}
                                </DropdownMenuItem>
                                <DropdownMenuSub>
                                  <DropdownMenuSubTrigger>Icon</DropdownMenuSubTrigger>
                                  <DropdownMenuSubContent>
                                    {ICON_OPTIONS.map((opt) => (
                                      <DropdownMenuItem
                                        key={opt.value}
                                        onSelect={() => void setWorkspaceIcon(w.id, opt.value === "none" ? null : opt.value)}
                                      >
                                        {opt.label}
                                      </DropdownMenuItem>
                                    ))}
                                  </DropdownMenuSubContent>
                                </DropdownMenuSub>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  variant="destructive"
                                  onSelect={() => setConfirm({ kind: "tab", id: w.id })}
                                >
                                  <Trash2 className="mr-2 h-3.5 w-3.5" />
                                  {t("workspaceDeleteTab")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </SortableContext>
              )}

              {/* Add tab */}
              {canEditWorkspace && (
                addingTab ? (
                  <div className="flex items-center gap-1 rounded-lg bg-muted/30 p-1">
                    <Input
                      placeholder={t("workspaceNewTabPlaceholder")}
                      className="h-7 w-[140px] text-sm"
                      value={newTabName}
                      onChange={(e) => setNewTabName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void addWorkspace();
                        if (e.key === "Escape") { setAddingTab(false); setNewTabName(""); }
                      }}
                      autoFocus
                    />
                    <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={() => void addWorkspace()}>
                      {t("workspaceAddTab")}
                    </Button>
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => { setAddingTab(false); setNewTabName(""); }}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setAddingTab(true)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
                    title={t("workspaceAddTab")}
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                )
              )}
            </div>
          </DndContext>
        </div>

        {/* ── Quick access ─────────────────────────────────── */}
        {quickItems.length > 0 && (
          <div className="space-y-2">
            <p className="px-1 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
              {t("workspaceQuickAccessTitle")}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {quickItems.map((item) => (
                <Link
                  key={item.report.id}
                  href={`/agent?report=${encodeURIComponent(item.report.id)}`}
                  className="group/qa flex min-w-[160px] max-w-[200px] shrink-0 items-center gap-2.5 rounded-xl border border-border/50 bg-card/60 px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:border-border hover:shadow-md"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted/50">
                    <QuickAccessChartGlyph type={item.report.chartType} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground group-hover/qa:text-primary">
                      {item.report.title}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {item.category === "pinned" ? t("workspaceQuickPinned") : item.category === "favorite" ? t("workspaceQuickFavorites") : t("workspaceQuickRecent")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Toolbar ──────────────────────────────────────── */}
        <div className="surface-elevated flex items-center gap-2 rounded-2xl p-2.5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              ref={searchRef}
              className="h-9 rounded-xl border-transparent bg-muted/30 pl-9 focus:border-border focus:bg-background"
              placeholder={t("workspaceSearchPlaceholder")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Filters dropdown */}
          <DropdownMenu open={filtersOpen} onOpenChange={setFiltersOpen}>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "outline", size: "sm" }),
                "relative h-9 gap-1.5 rounded-xl border-border/60",
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("workspaceSortLabel")}</span>
              {(hasActiveFilters || nonDefaultSort) && (
                <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-primary" />
              )}
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 space-y-3 p-3">
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">{t("workspaceSortLabel")}</p>
                <Select value={sortMode} onValueChange={(v) => setSortMode(v as WorkspaceSortMode)}>
                  <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="name">{t("workspaceSortName")}</SelectItem>
                    <SelectItem value="updated">{t("workspaceSortUpdated")}</SelectItem>
                    <SelectItem value="opened">{t("workspaceSortOpened")}</SelectItem>
                    <SelectItem value="used">{t("workspaceSortUsed")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">{t("workspaceFilterAll")}</p>
                <Select value={filterScope} onValueChange={(v) => setFilterScope(v as WorkspaceFilterScope)}>
                  <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("workspaceFilterAll")}</SelectItem>
                    <SelectItem value="favorites">{t("workspaceFilterFavorites")}</SelectItem>
                    <SelectItem value="pinned">{t("workspaceFilterPinned")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">{t("workspaceFilterChartAll")}</p>
                <Select value={chartTypeFilter ?? "all"} onValueChange={(v) => setChartTypeFilter(v === "all" ? null : v)}>
                  <SelectTrigger className="h-8 rounded-lg text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("workspaceFilterChartAll")}</SelectItem>
                    <SelectItem value="bar">{t("workspaceChartTypeBar")}</SelectItem>
                    <SelectItem value="line">{t("workspaceChartTypeLine")}</SelectItem>
                    <SelectItem value="pie">{t("workspaceChartTypePie")}</SelectItem>
                    <SelectItem value="area">{t("workspaceChartTypeArea")}</SelectItem>
                    <SelectItem value="table">{t("workspaceChartTypeTable")}</SelectItem>
                    <SelectItem value="number">{t("workspaceChartTypeNumber")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(hasActiveFilters || nonDefaultSort) && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="w-full rounded-md py-1 text-center text-xs text-primary hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* View toggle */}
          <div className="flex rounded-lg border border-border/50 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("card")}
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                viewMode === "card" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("workspaceViewCard")}</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={cn(
                "flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium transition-colors",
                viewMode === "list" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("workspaceViewList")}</span>
            </button>
          </div>
        </div>

        {hasActiveFilters && (
          <p className="px-1 text-xs text-muted-foreground">{t("workspaceFiltersActiveHint")}</p>
        )}

        {/* ── Sections ─────────────────────────────────────── */}
        {!activeWs ? (
          <p className="text-sm text-muted-foreground">{t("workspaceEmpty")}</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onContentDragEnd}>
            <div className="space-y-4">
              {canEditWorkspace && (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    placeholder={t("workspaceNewSectionPlaceholder")}
                    className="h-9 max-w-xs rounded-xl"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addSection()}
                  />
                  <Button
                    type="button" size="sm" variant="secondary"
                    className="h-9 gap-1 rounded-xl"
                    onClick={() => void addSection()}
                  >
                    <Plus className="h-4 w-4" />
                    {t("workspaceAddSection")}
                  </Button>
                </div>
              )}

              {activeWs.sections.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("workspaceNoSections")}</p>
              ) : (
                <SortableContext items={sectionSortIds} strategy={verticalListSortingStrategy}>
                  {displaySections.map((section) => {
                    const orderMap = buildReportOrderMap(activeWs);
                    const sourceSec = activeWs.sections.find((s) => s.id === section.sectionId);
                    const orderIds = orderMap[section.sectionId] ?? sourceSec?.reports.map((r) => r.id) ?? [];
                    const visibleIds = section.reports.map((r) => r.id);
                    const reportSortIds = (hasActiveFilters ? visibleIds : orderIds).map((id) => `${REP_PREFIX}${id}`);
                    const isOpen = !collapsed[section.sectionId];
                    const ring = section.colorKey ? SECTION_RING[section.colorKey] : "";

                    return (
                      <Collapsible
                        key={section.sectionId}
                        open={isOpen}
                        onOpenChange={(open) => setCollapsed((prev) => ({ ...prev, [section.sectionId]: !open }))}
                        className={cn("overflow-hidden rounded-xl border border-border/50 bg-card/40 transition-colors", ring)}
                      >
                        <SortableSectionHeader
                          sectionId={section.sectionId}
                          canEdit={canReorderWorkspace}
                          dragAriaLabel={t("workspaceDragHandle")}
                          accentClassName="rounded-none border-0 bg-transparent"
                          titleContent={
                            <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              {isOpen
                                ? <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                                : <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />}
                              {editingSectionId === section.sectionId ? (
                                <div className="flex flex-wrap items-center gap-2" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                                  <Input
                                    className="h-8 max-w-md font-semibold"
                                    value={sectionTitleDraft}
                                    onChange={(e) => setSectionTitleDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") void saveSectionTitle(section.sectionId);
                                      if (e.key === "Escape") setEditingSectionId(null);
                                    }}
                                    autoFocus
                                  />
                                  <Button size="sm" variant="secondary" onClick={(e) => { e.stopPropagation(); void saveSectionTitle(section.sectionId); }}>
                                    {t("workspaceSave")}
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <h2 className="text-sm font-semibold tracking-tight">{section.title}</h2>
                                  <span className="text-xs text-muted-foreground">{section.reports.length}</span>
                                </div>
                              )}
                            </CollapsibleTrigger>
                          }
                          actions={
                            canEditWorkspace && editingSectionId !== section.sectionId ? (
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  className={cn(
                                    buttonVariants({ variant: "ghost", size: "icon-xs" }),
                                    "h-7 w-7 opacity-0 transition-opacity group-hover/sec:opacity-100",
                                  )}
                                >
                                  <MoreHorizontal className="h-4 w-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-44">
                                  <DropdownMenuItem onSelect={() => { setEditingSectionId(section.sectionId); setSectionTitleDraft(section.title); }}>
                                    <Pencil className="mr-2 h-3.5 w-3.5" />
                                    {t("workspaceRename")}
                                  </DropdownMenuItem>
                                  <DropdownMenuSub>
                                    <DropdownMenuSubTrigger>Color</DropdownMenuSubTrigger>
                                    <DropdownMenuSubContent>
                                      <DropdownMenuItem onSelect={() => void setSectionColor(section.sectionId, null)}>
                                        Default
                                      </DropdownMenuItem>
                                      {COLOR_DOTS.map((c) => (
                                        <DropdownMenuItem key={c.key} onSelect={() => void setSectionColor(section.sectionId, c.key)}>
                                          <span className={cn("mr-2 inline-block h-3 w-3 rounded-full", c.cls)} />
                                          {c.key.charAt(0).toUpperCase() + c.key.slice(1)}
                                        </DropdownMenuItem>
                                      ))}
                                    </DropdownMenuSubContent>
                                  </DropdownMenuSub>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem variant="destructive" onSelect={() => setConfirm({ kind: "section", id: section.sectionId })}>
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    {t("workspaceDeleteSection")}
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            ) : undefined
                          }
                        />
                        <CollapsibleContent>
                          <div className="border-t border-border/30 bg-background/30 p-4">
                            <SortableContext
                              id={`reports-${section.sectionId}`}
                              items={reportSortIds}
                              strategy={verticalListSortingStrategy}
                            >
                              {section.reports.length === 0 ? (
                                <EmptySectionDropFixed
                                  sectionId={section.sectionId}
                                  title={t("workspaceEmptySectionTitle")}
                                  hint={t("workspaceEmptySectionBody")}
                                  newReportCta={t("workspaceNewReport")}
                                />
                              ) : viewMode === "card" ? (
                                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                  {section.reports.map((r) => {
                                    const card = (
                                      <SavedReportLibraryCard
                                        key={r.id}
                                        report={r}
                                        canEdit={canEditWorkspace}
                                        refreshing={refreshingId === r.id}
                                        onRefresh={() => void refreshReport(r.id)}
                                        onDelete={() => setConfirm({ kind: "report", id: r.id })}
                                        onDuplicate={() => void duplicateReport(r.id)}
                                        onToggleFavorite={() => void patchReport(r.id, { isFavorite: !r.isFavorite })}
                                        onTogglePin={() => void patchReport(r.id, { isPinned: !r.isPinned })}
                                        onMove={() => setMoveTarget({ id: r.id, title: r.title, sectionId: section.sectionId })}
                                      />
                                    );
                                    return hasActiveFilters ? (
                                      <div key={r.id}>{card}</div>
                                    ) : (
                                      <SortableReportRow key={r.id} reportId={r.id} canEdit={canReorderWorkspace} dragAriaLabel={t("workspaceDragHandle")}>
                                        {card}
                                      </SortableReportRow>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="space-y-1.5">
                                  {section.reports.map((r) => {
                                    const row = (
                                      <SavedReportLibraryRow
                                        key={r.id}
                                        report={r}
                                        canEdit={canEditWorkspace}
                                        refreshing={refreshingId === r.id}
                                        onRefresh={() => void refreshReport(r.id)}
                                        onDelete={() => setConfirm({ kind: "report", id: r.id })}
                                        onDuplicate={() => void duplicateReport(r.id)}
                                        onToggleFavorite={() => void patchReport(r.id, { isFavorite: !r.isFavorite })}
                                        onTogglePin={() => void patchReport(r.id, { isPinned: !r.isPinned })}
                                        onMove={() => setMoveTarget({ id: r.id, title: r.title, sectionId: section.sectionId })}
                                      />
                                    );
                                    return hasActiveFilters ? (
                                      <div key={r.id}>{row}</div>
                                    ) : (
                                      <SortableReportRow key={r.id} reportId={r.id} canEdit={canReorderWorkspace} dragAriaLabel={t("workspaceDragHandle")}>
                                        {row}
                                      </SortableReportRow>
                                    );
                                  })}
                                </div>
                              )}
                            </SortableContext>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })}
                </SortableContext>
              )}
            </div>
          </DndContext>
        )}
      </div>

      {/* ── Dialogs ──────────────────────────────────────── */}
      <MoveReportDialog
        open={Boolean(moveTarget)}
        onOpenChange={(o) => !o && setMoveTarget(null)}
        workspace={activeWs}
        reportTitle={moveTarget?.title ?? ""}
        initialSectionId={moveTarget?.sectionId ?? ""}
        onConfirm={async (sectionId) => { await confirmMove(sectionId); setMoveTarget(null); }}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "tab" ? t("workspaceDeleteTab") : confirm?.kind === "section" ? t("workspaceDeleteSection") : t("workspaceDeleteReport")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "tab" ? t("workspaceConfirmDeleteTab") : confirm?.kind === "section" ? t("workspaceConfirmDeleteSection") : t("workspaceConfirmDeleteReport")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirm(null)}>{t("workspaceCancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                const c = confirm;
                setConfirm(null);
                if (!c) return;
                if (c.kind === "tab") void removeWorkspace(c.id);
                else if (c.kind === "section") void removeSection(c.id);
                else void deleteReport(c.id);
              }}
            >
              {t("workspaceConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
