"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { GripVertical, Pencil, Plus } from "lucide-react";
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
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { PageHeader } from "@/components/layout/PageHeader";
import { useLocale } from "@/lib/locale-context";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import type { SavedReportMeta, WorkspaceTree } from "@/lib/workspace-db";
import { SavedReportCard } from "@/components/workspace/SavedReportCard";
import {
  applyReportDragEnd,
  REP_PREFIX,
  SEC_PREFIX,
  stripSecPrefix,
} from "@/components/workspace/workspace-dnd-helpers";
import { cn } from "@/lib/utils";

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
            "rounded-xl px-3 py-2 text-sm font-semibold transition-all",
            active
              ? "bg-background text-foreground shadow-md ring-1 ring-border/60"
              : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
          )}
        >
          {label}
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
}: {
  sectionId: string;
  canEdit: boolean;
  titleContent: React.ReactNode;
  actions?: React.ReactNode;
  dragAriaLabel: string;
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
        "flex items-center justify-between gap-2 border-b border-border/50 pb-3",
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

function EmptySectionDrop({ sectionId, label }: { sectionId: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${SEC_PREFIX}${sectionId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[4rem] rounded-lg border border-dashed border-border/60 p-4 text-sm text-muted-foreground",
        isOver && "border-primary bg-primary/5",
      )}
    >
      {label}
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
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-50 opacity-50")}
    >
      <div className="flex gap-2 items-start">
        {canEdit && (
          <button
            type="button"
            className="mt-4 cursor-grab touch-none shrink-0 rounded p-1 text-muted-foreground hover:text-foreground"
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

export function WorkspacePageClient() {
  const { t } = useLocale();
  const { user, permissions } = useAuth();
  const { canEditWorkspace } = useAuthCapabilities(permissions);
  /** Reordering tabs/sections/reports is allowed for any signed-in user (API scopes by owner). */
  const canReorderWorkspace = Boolean(user);
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
  }

  async function removeWorkspace(id: string) {
    if (!canEditWorkspace) return;
    if (!confirm(t("workspaceConfirmDeleteTab"))) return;
    const res = await fetch(`/api/workspaces/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    if (activeWsId === id) setActiveWsId(null);
    await load();
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
  }

  async function removeSection(id: string) {
    if (!canEditWorkspace) return;
    if (!confirm(t("workspaceConfirmDeleteSection"))) return;
    const res = await fetch(`/api/sections/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    await load();
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
    if (!canReorderWorkspace || !activeWs) return;
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
      <div className="relative mx-auto max-w-[1600px] space-y-8 px-6 pb-10 pt-6">
        <PageHeader title={t("myWorkspace")} description={t("workspacePageDesc")}>
          <Link
            href="/agent"
            className={buttonVariants({ variant: "outline", size: "sm", className: "rounded-xl border-border/70" })}
          >
            {t("workspaceOpenFullAgent")}
          </Link>
        </PageHeader>

        {!canEditWorkspace ? (
          <p className="text-sm text-muted-foreground">{t("workspaceReadOnlyHint")}</p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <div className="flex flex-col gap-3 overflow-x-auto rounded-2xl border border-border/50 bg-muted/25 p-4 shadow-inner dark:bg-muted/15 sm:flex-row sm:items-end">
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onWorkspaceDragEnd}>
            <div className="flex min-w-0 flex-1 flex-wrap gap-2">
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
                          w.title
                        )
                      }
                    >
                      {canEditWorkspace && editingWsId !== w.id ? (
                        <>
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
                            onClick={() => void removeWorkspace(w.id)}
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
            <div className="flex flex-wrap items-center gap-2">
              <Input
                placeholder={t("workspaceNewTabPlaceholder")}
                className="h-9 w-[200px]"
                value={newTabName}
                onChange={(e) => setNewTabName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void addWorkspace()}
              />
              <Button type="button" size="sm" className="h-9 gap-1" onClick={() => void addWorkspace()}>
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
            <div className="space-y-8">
              {canEditWorkspace ? (
                <div className="flex flex-wrap items-end gap-2">
                  <Input
                    placeholder={t("workspaceNewSectionPlaceholder")}
                    className="h-9 max-w-xs"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && void addSection()}
                  />
                  <Button type="button" size="sm" variant="secondary" className="h-9 gap-1" onClick={() => void addSection()}>
                    <Plus className="h-4 w-4" />
                    {t("workspaceAddSection")}
                  </Button>
                </div>
              ) : null}

              {activeWs.sections.length === 0 ? (
                <p className="text-muted-foreground text-sm">{t("workspaceNoSections")}</p>
              ) : (
                <SortableContext items={sectionSortIds} strategy={verticalListSortingStrategy}>
                  {activeWs.sections.map((section) => {
                    const orderIds = buildReportOrderMap(activeWs)[section.id] ?? section.reports.map((r) => r.id);
                    const reportSortIds = orderIds.map((id) => `${REP_PREFIX}${id}`);
                    return (
                      <section key={section.id} className="space-y-3">
                        <SortableSectionHeader
                          sectionId={section.id}
                          canEdit={canReorderWorkspace}
                          dragAriaLabel={t("workspaceDragHandle")}
                          titleContent={
                            editingSectionId === section.id ? (
                              <div className="flex flex-wrap items-center gap-2">
                                <Input
                                  className="h-9 max-w-md font-semibold"
                                  value={sectionTitleDraft}
                                  onChange={(e) => setSectionTitleDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") void saveSectionTitle(section.id);
                                    if (e.key === "Escape") setEditingSectionId(null);
                                  }}
                                  autoFocus
                                />
                                <Button type="button" size="sm" variant="secondary" onClick={() => void saveSectionTitle(section.id)}>
                                  {t("workspaceSave")}
                                </Button>
                              </div>
                            ) : (
                              <h2 className="text-lg font-semibold tracking-tight">{section.title}</h2>
                            )
                          }
                          actions={
                            <div className="flex items-center gap-1 shrink-0">
                              {canEditWorkspace && editingSectionId !== section.id ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-8"
                                  onClick={() => {
                                    setEditingSectionId(section.id);
                                    setSectionTitleDraft(section.title);
                                  }}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                              ) : null}
                              {canEditWorkspace ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => void removeSection(section.id)}
                                >
                                  {t("workspaceDeleteSection")}
                                </Button>
                              ) : null}
                            </div>
                          }
                        />
                        <SortableContext id={`reports-${section.id}`} items={reportSortIds} strategy={verticalListSortingStrategy}>
                          <div className="grid min-h-[3rem] gap-4 rounded-lg border border-dashed border-transparent p-1 md:grid-cols-1">
                            {orderIds.length === 0 ? (
                              <EmptySectionDrop sectionId={section.id} label={t("workspaceNoReports")} />
                            ) : (
                              orderIds.map((rid) => {
                                const r = findReportMeta(activeWs, rid);
                                if (!r) return null;
                                return (
                                  <SortableReportRow
                                    key={rid}
                                    reportId={rid}
                                    canEdit={canReorderWorkspace}
                                    dragAriaLabel={t("workspaceDragHandle")}
                                  >
                                    <SavedReportCard
                                      report={r}
                                      onDeleted={() => void load()}
                                      onTitleUpdated={() => void load()}
                                      canEdit={canEditWorkspace}
                                    />
                                  </SortableReportRow>
                                );
                              })
                            )}
                          </div>
                        </SortableContext>
                      </section>
                    );
                  })}
                </SortableContext>
              )}
            </div>
          </DndContext>
        )}
      </div>
    </div>
  );
}
