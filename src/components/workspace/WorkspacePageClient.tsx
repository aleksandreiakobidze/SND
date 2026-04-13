"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  ChevronDown,
  ChevronRight,
  GripVertical,
  LayoutGrid,
  LineChart,
  List,
  Pencil,
  PieChart,
  Pin,
  Plus,
  Search,
  Table2,
  TrendingUp,
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

function findReportMeta(ws: WorkspaceTree, reportId: string): SavedReportMeta | undefined {
  for (const s of ws.sections) {
    const r = s.reports.find((x) => x.id === reportId);
    if (r) return r;
  }
  return undefined;
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

function SortableWorkspaceTab({
  id,
  active,
  canEdit,
  label,
  editing,
  onSelect,
  children,
  dragAriaLabel,
}: {
  id: string;
  active: boolean;
  canEdit: boolean;
  label: React.ReactNode;
  editing: boolean;
  onSelect: () => void;
  children?: React.ReactNode;
  dragAriaLabel: string;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    disabled: !canEdit,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-1 rounded-xl", isDragging && "z-50 opacity-60")}
    >
      {canEdit && (
        <button
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          {...attributes}
          {...listeners}
          aria-label={dragAriaLabel}
        >
          <GripVertical className="h-4 w-4" />
        </button>
      )}
      {editing ? (
        <div className="flex items-center gap-1">{label}</div>
      ) : (
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "relative rounded-xl px-4 py-2.5 text-sm font-semibold transition-all",
            active
              ? "bg-card text-foreground shadow-md ring-2 ring-primary/40"
              : "text-muted-foreground hover:bg-muted/80 hover:text-foreground",
          )}
        >
          {label}
          {active ? (
            <span className="absolute inset-x-3 -bottom-1 h-0.5 rounded-full bg-primary" />
          ) : null}
        </button>
      )}
      {children}
    </div>
  );
}

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
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center justify-between gap-2 rounded-t-xl border border-b-0 border-border/70 bg-muted/20 px-4 py-3",
        accentClassName,
        isDragging && "z-50 opacity-60",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {canEdit && (
          <button
            type="button"
            className="cursor-grab touch-none shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label={dragAriaLabel}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0">{titleContent}</div>
      </div>
      {actions}
    </div>
  );
}

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
        "flex min-h-[5rem] flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border/70 bg-muted/10 p-6 text-center text-sm text-muted-foreground",
        isOver && "border-primary bg-primary/5",
      )}
    >
      <p className="font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-xs">{hint}</p>
      <Link href="/agent" className={buttonVariants({ variant: "secondary", size: "sm" })}>
        {newReportCta}
      </Link>
    </div>
  );
}

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
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "z-50 opacity-50")}>
      <div className="flex items-start gap-2">
        {canEdit && (
          <button
            type="button"
            className="mt-3 cursor-grab touch-none shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
            {...attributes}
            {...listeners}
            aria-label={dragAriaLabel}
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}

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
  return <I className="mr-1.5 inline h-4 w-4 opacity-80" />;
}

const SECTION_RING: Record<string, string> = {
  blue: "border-l-4 border-l-blue-500/80",
  violet: "border-l-4 border-l-violet-500/80",
  emerald: "border-l-4 border-l-emerald-500/80",
  amber: "border-l-4 border-l-amber-500/80",
  rose: "border-l-4 border-l-rose-500/80",
};

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

  const [moveTarget, setMoveTarget] = useState<{ id: string; title: string; sectionId: string } | null>(null);
  const [confirm, setConfirm] = useState<
    | { kind: "tab"; id: string }
    | { kind: "section"; id: string }
    | { kind: "report"; id: string }
    | null
  >(null);

  useEffect(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      if (v === "list" || v === "card") setViewMode(v);
      const c = localStorage.getItem(COLLAPSE_KEY);
      if (c) setCollapsed(JSON.parse(c) as Record<string, boolean>);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, JSON.stringify(collapsed));
    } catch {
      /* ignore */
    }
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

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/workspaces", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || json.details || t("error"));
        return;
      }
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

  useEffect(() => {
    void load();
  }, [load]);

  const activeWs = tree.find((w) => w.id === activeWsId) ?? null;

  const hasActiveFilters =
    search.trim().length > 0 || filterScope !== "all" || chartTypeFilter !== null;

  const displaySections = useMemo(() => {
    if (!activeWs) return [];
    const flat = flattenReportsInTab(activeWs);
    const filtered = filterFlatReports(flat, {
      search,
      scope: filterScope,
      chartType: chartTypeFilter,
    });
    const sorted = sortFlatReports(filtered, sortMode);
    return groupBySectionOrder(activeWs, sorted);
  }, [activeWs, search, filterScope, chartTypeFilter, sortMode]);

  const quickFavorites = useMemo(() => {
    if (!activeWs) return [];
    return flattenReportsInTab(activeWs)
      .filter((e) => e.report.isFavorite)
      .slice(0, 8)
      .map((e) => e.report);
  }, [activeWs]);

  const quickRecent = useMemo(() => {
    if (!activeWs) return [];
    return flattenReportsInTab(activeWs)
      .filter((e) => e.report.lastOpenedAt)
      .sort(
        (a, b) =>
          new Date(b.report.lastOpenedAt!).getTime() - new Date(a.report.lastOpenedAt!).getTime(),
      )
      .slice(0, 6)
      .map((e) => e.report);
  }, [activeWs]);

  const quickPinned = useMemo(() => {
    if (!activeWs) return [];
    return flattenReportsInTab(activeWs)
      .filter((e) => e.report.isPinned)
      .slice(0, 6)
      .map((e) => e.report);
  }, [activeWs]);

  async function addWorkspace() {
    if (!canEditWorkspace) return;
    const title = newTabName.trim();
    if (!title) return;
    const res = await fetch("/api/workspaces", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    const json = (await res.json()) as { id?: string; error?: string };
    if (!res.ok) return;
    setNewTabName("");
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
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setEditingWsId(null);
      await load();
      toast.success(t("workspaceToastSaved"));
    }
  }

  async function togglePinWorkspace(w: WorkspaceTree) {
    if (!canEditWorkspace) return;
    const res = await fetch(`/api/workspaces/${w.id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isPinned: !w.isPinned }),
    });
    if (res.ok) {
      await load();
      toast.success(t("workspaceToastSaved"));
    }
  }

  async function addSection() {
    if (!canEditWorkspace || !activeWsId) return;
    const title = newSectionName.trim();
    if (!title) return;
    const res = await fetch(`/api/workspaces/${activeWsId}/sections`, {
      method: "POST",
      credentials: "include",
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
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    if (res.ok) {
      setEditingSectionId(null);
      await load();
      toast.success(t("workspaceToastSaved"));
    }
  }

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
      method: "POST",
      credentials: "include",
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
      method: "POST",
      credentials: "include",
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
    if (aid.startsWith(SEC_PREFIX)) {
      void onSectionDragEnd(event);
      return;
    }
    if (aid.startsWith(REP_PREFIX)) {
      void onReportDragEnd(event);
    }
  };

  async function patchReport(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/reports/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      await load();
      return true;
    }
    return false;
  }

  async function refreshReport(id: string) {
    setRefreshingId(id);
    try {
      const res = await fetch(`/api/reports/${id}/refresh`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        toast.success(t("workspaceToastSaved"));
        await load();
      } else {
        toast.error(t("error"));
      }
    } finally {
      setRefreshingId(null);
    }
  }

  async function deleteReport(id: string) {
    const res = await fetch(`/api/reports/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      await load();
      toast.success(t("workspaceToastDeleted"));
    }
  }

  async function duplicateReport(id: string) {
    const res = await fetch(`/api/reports/${id}/duplicate`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      await load();
      toast.success(t("workspaceToastDuplicated"));
    }
  }

  async function confirmMove(sectionId: string) {
    if (!moveTarget) return;
    const ok = await patchReport(moveTarget.id, { sectionId });
    if (ok) toast.success(t("workspaceToastMoved"));
  }

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

  return (
    <div className="relative min-h-full">
      <PageGradientBackdrop />
      <div className="relative mx-auto max-w-[1600px] space-y-6 px-6 pb-12 pt-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <PageHeader title={t("myWorkspace")} description={t("workspacePageDesc")} className="max-w-xl" />
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/agent"
              className={buttonVariants({ size: "sm", className: "h-9 gap-1.5 rounded-xl" })}
            >
              <Plus className="h-4 w-4" />
              {t("workspaceNewReport")}
            </Link>
            <Link
              href="/agent"
              className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-xl border-border/70" })}
            >
              {t("workspaceOpenFullAgent")}
            </Link>
          </div>
        </div>

        {!canEditWorkspace ? (
          <p className="text-sm text-muted-foreground">{t("workspaceReadOnlyHint")}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        {/* Toolbar */}
        <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 p-4 shadow-sm">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                ref={searchRef}
                className="h-10 rounded-xl pl-9"
                placeholder={t("workspaceSearchPlaceholder")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <span className="pointer-events-none absolute right-3 top-1/2 hidden -translate-y-1/2 text-[0.65rem] text-muted-foreground sm:inline">
                {t("workspaceFocusSearchHint")}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select value={sortMode} onValueChange={(v) => setSortMode(v as WorkspaceSortMode)}>
                <SelectTrigger className="h-9 w-[160px] rounded-xl">
                  <SelectValue placeholder={t("workspaceSortLabel")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="name">{t("workspaceSortName")}</SelectItem>
                  <SelectItem value="updated">{t("workspaceSortUpdated")}</SelectItem>
                  <SelectItem value="opened">{t("workspaceSortOpened")}</SelectItem>
                  <SelectItem value="used">{t("workspaceSortUsed")}</SelectItem>
                </SelectContent>
              </Select>
              <Select value={filterScope} onValueChange={(v) => setFilterScope(v as WorkspaceFilterScope)}>
                <SelectTrigger className="h-9 w-[140px] rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("workspaceFilterAll")}</SelectItem>
                  <SelectItem value="favorites">{t("workspaceFilterFavorites")}</SelectItem>
                  <SelectItem value="pinned">{t("workspaceFilterPinned")}</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={chartTypeFilter ?? "all"}
                onValueChange={(v) => setChartTypeFilter(v === "all" ? null : v)}
              >
                <SelectTrigger className="h-9 w-[160px] rounded-xl">
                  <SelectValue placeholder={t("workspaceFilterChartAll")} />
                </SelectTrigger>
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
              <div className="flex rounded-xl border border-border/70 p-0.5">
                <Button
                  type="button"
                  variant={viewMode === "card" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 gap-1 rounded-lg"
                  onClick={() => setViewMode("card")}
                >
                  <LayoutGrid className="h-4 w-4" />
                  {t("workspaceViewCard")}
                </Button>
                <Button
                  type="button"
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-8 gap-1 rounded-lg"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                  {t("workspaceViewList")}
                </Button>
              </div>
            </div>
          </div>
          {hasActiveFilters ? (
            <p className="text-xs text-muted-foreground">{t("workspaceFiltersActiveHint")}</p>
          ) : null}
        </div>

        {/* Quick access */}
        {activeWs && (quickFavorites.length > 0 || quickRecent.length > 0 || quickPinned.length > 0) ? (
          <div className="space-y-2 rounded-2xl border border-border/50 bg-muted/15 p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {t("workspaceQuickAccessTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {quickPinned.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("workspaceQuickPinned")}:</span>
                  {quickPinned.map((r) => (
                    <Link key={r.id} href={`/agent?report=${r.id}`}>
                      <Badge variant="secondary" className="cursor-pointer font-normal hover:bg-muted">
                        {r.title}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
              {quickFavorites.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("workspaceQuickFavorites")}:</span>
                  {quickFavorites.map((r) => (
                    <Link key={r.id} href={`/agent?report=${r.id}`}>
                      <Badge variant="outline" className="cursor-pointer font-normal">
                        {r.title}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
              {quickRecent.length > 0 ? (
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted-foreground">{t("workspaceQuickRecent")}:</span>
                  {quickRecent.map((r) => (
                    <Link key={r.id} href={`/agent?report=${r.id}`}>
                      <Badge variant="outline" className="cursor-pointer font-normal">
                        {r.title}
                      </Badge>
                    </Link>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Tabs */}
        <div className="flex flex-col gap-3 overflow-x-auto rounded-2xl border border-border/60 bg-muted/20 p-4 dark:bg-muted/10">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onWorkspaceDragEnd}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              {tree.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{t("workspaceEmpty")}</p>
              ) : (
                <SortableContext items={workspaceIds} strategy={horizontalListSortingStrategy}>
                  {tree.map((w) => (
                    <SortableWorkspaceTab
                      key={w.id}
                      id={w.id}
                      active={activeWsId === w.id}
                      canEdit={canReorderWorkspace}
                      editing={editingWsId === w.id}
                      dragAriaLabel={t("workspaceDragHandle")}
                      onSelect={() => setActiveWsId(w.id)}
                      label={
                        editingWsId === w.id ? (
                          <Input
                            className="h-8 w-[160px] text-sm"
                            value={wsTitleDraft}
                            onChange={(e) => setWsTitleDraft(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") void saveWorkspaceTitle(w.id);
                              if (e.key === "Escape") setEditingWsId(null);
                            }}
                            autoFocus
                          />
                        ) : (
                          <span className="flex items-center">
                            <TabIcon name={w.iconKey} />
                            {w.title}
                            <Badge variant="secondary" className="ml-2 font-mono text-[0.65rem]">
                              {tabReportCount(w)}
                            </Badge>
                          </span>
                        )
                      }
                    >
                      {canEditWorkspace && editingWsId !== w.id ? (
                        <>
                          <Select
                            value={w.iconKey ?? "none"}
                            onValueChange={async (v) => {
                              const iconKey = v === "none" ? null : v;
                              const res = await fetch(`/api/workspaces/${w.id}`, {
                                method: "PATCH",
                                credentials: "include",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify({ iconKey }),
                              });
                              if (res.ok) await load();
                            }}
                          >
                            <SelectTrigger className="h-8 w-[110px] rounded-lg text-xs">
                              <SelectValue placeholder="Icon" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">No icon</SelectItem>
                              <SelectItem value="LayoutGrid">Grid</SelectItem>
                              <SelectItem value="BarChart3">Chart</SelectItem>
                              <SelectItem value="LineChart">Line</SelectItem>
                              <SelectItem value="PieChart">Pie</SelectItem>
                              <SelectItem value="Table2">Table</SelectItem>
                              <SelectItem value="TrendingUp">Trend</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="h-8 w-8"
                            title={w.isPinned ? t("workspaceUnpinTab") : t("workspacePinTab")}
                            onClick={() => void togglePinWorkspace(w)}
                          >
                            <Pin className={cn("h-3.5 w-3.5", w.isPinned && "text-primary")} />
                          </Button>
                          <button
                            type="button"
                            className="rounded p-1 text-muted-foreground hover:bg-muted"
                            title={t("workspaceRename")}
                            onClick={() => {
                              setEditingWsId(w.id);
                              setWsTitleDraft(w.title);
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            className="rounded p-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                            title={t("workspaceDeleteTab")}
                            onClick={() => setConfirm({ kind: "tab", id: w.id })}
                          >
                            ×
                          </button>
                        </>
                      ) : editingWsId === w.id ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7"
                          onClick={() => void saveWorkspaceTitle(w.id)}
                        >
                          {t("workspaceSave")}
                        </Button>
                      ) : null}
                    </SortableWorkspaceTab>
                  ))}
                </SortableContext>
              )}
            </div>
          </DndContext>
          {canEditWorkspace ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/40 pt-3">
              <Input
                placeholder={t("workspaceNewTabPlaceholder")}
                className="h-9 max-w-[200px] rounded-xl"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addWorkspace()}
              />
              <Button type="button" size="sm" className="h-9 gap-1 rounded-xl" onClick={() => void addWorkspace()}>
                <Plus className="h-4 w-4" />
                {t("workspaceAddTab")}
              </Button>
            </div>
          ) : null}
        </div>

        {!activeWs ? (
          <p className="text-muted-foreground text-sm">{t("workspaceEmpty")}</p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onContentDragEnd}>
            <div className="space-y-6">
              {canEditWorkspace ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    placeholder={t("workspaceNewSectionPlaceholder")}
                    className="h-9 max-w-xs rounded-xl"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addSection()}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="h-9 gap-1 rounded-xl"
                    onClick={() => void addSection()}
                  >
                    <Plus className="h-4 w-4" />
                    {t("workspaceAddSection")}
                  </Button>
                </div>
              ) : null}

              {activeWs.sections.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("workspaceNoSections")}</p>
              ) : (
                <SortableContext items={sectionSortIds} strategy={verticalListSortingStrategy}>
                  {displaySections.map((section) => {
                    const sourceSec = activeWs.sections.find((s) => s.id === section.sectionId);
                    const orderMap = buildReportOrderMap(activeWs);
                    const orderIds = orderMap[section.sectionId] ?? sourceSec?.reports.map((r) => r.id) ?? [];
                    const visibleIds = section.reports.map((r) => r.id);
                    const reportSortIds = (hasActiveFilters ? visibleIds : orderIds).map(
                      (id) => `${REP_PREFIX}${id}`,
                    );
                    const isOpen = !collapsed[section.sectionId];
                    const ring = section.colorKey ? SECTION_RING[section.colorKey] : "";

                    return (
                      <Collapsible
                        key={section.sectionId}
                        open={isOpen}
                        onOpenChange={(open) =>
                          setCollapsed((prev) => ({ ...prev, [section.sectionId]: !open }))
                        }
                        className={cn("overflow-hidden rounded-xl border border-border/70 bg-card/30 shadow-sm", ring)}
                      >
                        <SortableSectionHeader
                          sectionId={section.sectionId}
                          canEdit={canReorderWorkspace}
                          dragAriaLabel={t("workspaceDragHandle")}
                          accentClassName="rounded-none border-0 bg-transparent"
                          titleContent={
                            <CollapsibleTrigger className="flex w-full min-w-0 items-center gap-2 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                              {isOpen ? (
                                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                              ) : (
                                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                              )}
                              {editingSectionId === section.sectionId ? (
                                <div
                                  className="flex flex-wrap items-center gap-2"
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => e.stopPropagation()}
                                >
                                  <Input
                                    className="h-9 max-w-md font-semibold"
                                    value={sectionTitleDraft}
                                    onChange={(e) => setSectionTitleDraft(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") void saveSectionTitle(section.sectionId);
                                      if (e.key === "Escape") setEditingSectionId(null);
                                    }}
                                    autoFocus
                                  />
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="secondary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      void saveSectionTitle(section.sectionId);
                                    }}
                                  >
                                    {t("workspaceSave")}
                                  </Button>
                                </div>
                              ) : (
                                <div>
                                  <h2 className="text-base font-semibold tracking-tight">{section.title}</h2>
                                  <p className="text-xs text-muted-foreground">
                                    {section.reports.length} {t("workspaceReportsInSection")}
                                  </p>
                                </div>
                              )}
                            </CollapsibleTrigger>
                          }
                          actions={
                            <div className="flex items-center gap-1 shrink-0">
                              {canEditWorkspace && editingSectionId !== section.sectionId ? (
                                <>
                                  <Select
                                    value={section.colorKey ?? "none"}
                                    onValueChange={async (v) => {
                                      const colorKey = v === "none" ? null : v;
                                      const res = await fetch(`/api/sections/${section.sectionId}`, {
                                        method: "PATCH",
                                        credentials: "include",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ colorKey }),
                                      });
                                      if (res.ok) {
                                        await load();
                                        toast.success(t("workspaceToastSaved"));
                                      }
                                    }}
                                  >
                                    <SelectTrigger className="h-8 w-[120px] rounded-lg text-xs">
                                      <SelectValue placeholder="Color" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="none">Default</SelectItem>
                                      <SelectItem value="blue">Blue</SelectItem>
                                      <SelectItem value="violet">Violet</SelectItem>
                                      <SelectItem value="emerald">Emerald</SelectItem>
                                      <SelectItem value="amber">Amber</SelectItem>
                                      <SelectItem value="rose">Rose</SelectItem>
                                    </SelectContent>
                                  </Select>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-8"
                                    onClick={() => {
                                      setEditingSectionId(section.sectionId);
                                      setSectionTitleDraft(section.title);
                                    }}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </>
                              ) : null}
                              {canEditWorkspace ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setConfirm({ kind: "section", id: section.sectionId })}
                                >
                                  {t("workspaceDeleteSection")}
                                </Button>
                              ) : null}
                            </div>
                          }
                        />
                        <CollapsibleContent>
                          <div className="border-t border-border/50 bg-background/40 p-4">
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
                                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                  {section.reports.map((r) => {
                                    const row = (
                                      <SavedReportLibraryCard
                                        key={r.id}
                                        report={r}
                                        canEdit={canEditWorkspace}
                                        refreshing={refreshingId === r.id}
                                        onRefresh={() => void refreshReport(r.id)}
                                        onDelete={() => setConfirm({ kind: "report", id: r.id })}
                                        onDuplicate={() => void duplicateReport(r.id)}
                                        onToggleFavorite={() =>
                                          void patchReport(r.id, { isFavorite: !r.isFavorite })
                                        }
                                        onTogglePin={() => void patchReport(r.id, { isPinned: !r.isPinned })}
                                        onMove={() =>
                                          setMoveTarget({
                                            id: r.id,
                                            title: r.title,
                                            sectionId: section.sectionId,
                                          })
                                        }
                                      />
                                    );
                                    if (hasActiveFilters) {
                                      return <div key={r.id}>{row}</div>;
                                    }
                                    return (
                                      <SortableReportRow
                                        key={r.id}
                                        reportId={r.id}
                                        canEdit={canReorderWorkspace}
                                        dragAriaLabel={t("workspaceDragHandle")}
                                      >
                                        {row}
                                      </SortableReportRow>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="space-y-2">
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
                                        onToggleFavorite={() =>
                                          void patchReport(r.id, { isFavorite: !r.isFavorite })
                                        }
                                        onTogglePin={() => void patchReport(r.id, { isPinned: !r.isPinned })}
                                        onMove={() =>
                                          setMoveTarget({
                                            id: r.id,
                                            title: r.title,
                                            sectionId: section.sectionId,
                                          })
                                        }
                                      />
                                    );
                                    if (hasActiveFilters) {
                                      return <div key={r.id}>{row}</div>;
                                    }
                                    return (
                                      <SortableReportRow
                                        key={r.id}
                                        reportId={r.id}
                                        canEdit={canReorderWorkspace}
                                        dragAriaLabel={t("workspaceDragHandle")}
                                      >
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

      <MoveReportDialog
        open={Boolean(moveTarget)}
        onOpenChange={(o) => !o && setMoveTarget(null)}
        workspace={activeWs}
        reportTitle={moveTarget?.title ?? ""}
        initialSectionId={moveTarget?.sectionId ?? ""}
        onConfirm={async (sectionId) => {
          await confirmMove(sectionId);
          setMoveTarget(null);
        }}
      />

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.kind === "tab"
                ? t("workspaceDeleteTab")
                : confirm?.kind === "section"
                  ? t("workspaceDeleteSection")
                  : t("workspaceDeleteReport")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.kind === "tab"
                ? t("workspaceConfirmDeleteTab")
                : confirm?.kind === "section"
                  ? t("workspaceConfirmDeleteSection")
                  : t("workspaceConfirmDeleteReport")}
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
