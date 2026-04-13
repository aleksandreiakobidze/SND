"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  GripVertical,
  Settings2,
  Sparkles,
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
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import { useCallback, useEffect, useMemo, useState } from "react";
import { type NavGroupDef, type SidebarNavItemDef } from "@/lib/nav-items";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import { isAdminRole } from "@/lib/auth-roles";
import { isNavItemVisible } from "@/lib/nav-access";
import { useNavPreferences } from "@/lib/useNavPreferences";
import { NavCustomizeSheet } from "@/components/layout/NavCustomizeSheet";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { SidebarLayout } from "@/lib/sidebar-layout";
import { getDefaultSidebarLayout } from "@/lib/sidebar-layout";
import { flattenNavItemsInOrder, mergeSidebarLayout } from "@/lib/sidebar-layout-merge";
import {
  applyGroupOrderDragEnd,
  applyNavItemDragEnd,
  SB_GRP_PREFIX,
  SB_NAV_PREFIX,
} from "@/components/layout/sidebar-nav-dnd-helpers";

function GroupDropPlaceholder({ groupId, label }: { groupId: string; label: string }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${SB_GRP_PREFIX}${groupId}` });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "rounded-lg border border-dashed border-sidebar-border/60 px-3 py-6 text-center text-xs text-muted-foreground",
        isOver && "border-sidebar-primary bg-sidebar-primary/5",
      )}
    >
      {label}
    </div>
  );
}

function SortableGroupShell({
  group,
  editMode,
  groupTitle,
  open,
  onOpenChange,
  children,
}: {
  group: NavGroupDef;
  editMode: boolean;
  groupTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${SB_GRP_PREFIX}${group.id}`,
    disabled: !editMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(isDragging && "z-50 opacity-70")}
    >
      <Collapsible open={open} onOpenChange={onOpenChange}>
        <div className="flex items-start gap-0.5">
          {editMode ? (
            <button
              type="button"
              className="mt-1 cursor-grab touch-none shrink-0 rounded p-1 text-muted-foreground hover:text-sidebar-foreground"
              {...attributes}
              {...listeners}
              aria-label="Reorder group"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          ) : null}
          <div className="min-w-0 flex-1 space-y-1">
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors",
                "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="truncate">{groupTitle}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground/80 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
            <CollapsibleContent>{children}</CollapsibleContent>
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

function SortableNavItemRow({
  item,
  editMode,
  children,
}: {
  item: SidebarNavItemDef;
  editMode: boolean;
  children: React.ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${SB_NAV_PREFIX}${item.id}`,
    disabled: !editMode,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn("flex items-center gap-0.5", isDragging && "z-50 opacity-70")}
    >
      {editMode ? (
        <button
          type="button"
          className="cursor-grab touch-none shrink-0 rounded p-1 text-muted-foreground hover:text-sidebar-foreground"
          {...attributes}
          {...listeners}
          aria-label="Reorder link"
        >
          <GripVertical className="h-4 w-4" />
        </button>
      ) : null}
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { permissions, roles, loading: authLoading } = useAuth();
  const caps = useAuthCapabilities(permissions);
  const nav = useNavPreferences();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [remoteLayout, setRemoteLayout] = useState<SidebarLayout | null>(null);
  const [workingLayout, setWorkingLayout] = useState<SidebarLayout | null>(null);
  const [sidebarEditMode, setSidebarEditMode] = useState(false);
  const [layoutError, setLayoutError] = useState<string | null>(null);

  const isAdmin = isAdminRole(roles);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/sidebar-layout", { credentials: "include" });
        const json = (await res.json()) as { layout?: SidebarLayout | null };
        if (!cancelled && res.ok) {
          setRemoteLayout(json.layout ?? null);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const layoutForMerge = sidebarEditMode && workingLayout ? workingLayout : remoteLayout;
  const merged = useMemo(() => mergeSidebarLayout(layoutForMerge), [layoutForMerge]);

  const allowItem = (item: SidebarNavItemDef) =>
    authLoading || isNavItemVisible(item, caps);

  const persistLayout = useCallback(
    async (layout: SidebarLayout) => {
      setLayoutError(null);
      const res = await fetch("/api/sidebar-layout", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(layout),
      });
      const resBody = (await res.json().catch(() => ({}))) as {
        error?: string;
        details?: string;
      };
      if (!res.ok) {
        const msg =
          resBody.details != null && resBody.details !== ""
            ? `${resBody.error ?? t("sidebarLayoutSaveFailed")}: ${resBody.details}`
            : resBody.error ?? t("sidebarLayoutSaveFailed");
        setLayoutError(msg);
        try {
          const again = await fetch("/api/sidebar-layout", { credentials: "include" });
          const json = (await again.json()) as { layout?: SidebarLayout | null };
          if (again.ok) {
            const fresh = json.layout ?? null;
            setRemoteLayout(fresh);
            setWorkingLayout(fresh ?? getDefaultSidebarLayout());
          } else {
            setWorkingLayout(remoteLayout ?? getDefaultSidebarLayout());
          }
        } catch {
          setWorkingLayout(remoteLayout ?? getDefaultSidebarLayout());
        }
        return false;
      }
      setRemoteLayout(layout);
      return true;
    },
    [remoteLayout, t],
  );

  const onSidebarDragEnd = async (event: DragEndEvent) => {
    if (!sidebarEditMode || !workingLayout || !isAdmin) return;
    const aid = String(event.active.id);
    let next: SidebarLayout | null = null;
    if (aid.startsWith(SB_GRP_PREFIX)) {
      const go = applyGroupOrderDragEnd(workingLayout.groupOrder, event);
      if (go) next = { ...workingLayout, groupOrder: go };
    } else if (aid.startsWith(SB_NAV_PREFIX)) {
      const ig = applyNavItemDragEnd(workingLayout.itemsByGroup, event);
      if (ig) next = { ...workingLayout, itemsByGroup: ig };
    }
    if (!next) return;
    setWorkingLayout(next);
    await persistLayout(next);
  };

  const renderLinkInner = (item: SidebarNavItemDef) => {
    const isActive = mounted
      ? item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href)
      : false;

    const label = nav.getDisplayLabel(item.id, t(item.labelKey));

    return (
      <Link
        href={item.href}
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-primary/12 text-sidebar-primary shadow-sm ring-1 ring-sidebar-primary/20 dark:bg-sidebar-primary/18"
            : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
        )}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-sidebar-primary"
            aria-hidden
          />
        )}
        <item.icon
          className={cn(
            "h-[1.15rem] w-[1.15rem] shrink-0 transition-transform duration-200",
            isActive && "text-sidebar-primary",
            !isActive && "group-hover:scale-105",
          )}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  const expandedNav = () => {
    const { orderedGroups, getItemsForGroup } = merged;
    const showDnd = sidebarEditMode && isAdmin && !collapsed && workingLayout;

    const groupNodes = orderedGroups.map((group) => {
      const rawItems = getItemsForGroup(group.id).filter(
        (item) => !nav.hiddenSet.has(item.id) && allowItem(item),
      );
      if (rawItems.length === 0 && !showDnd) return null;

      const groupTitle = nav.getGroupLabel(group.id, t(group.labelKey));
      const open = !nav.isGroupCollapsed(group.id);
      const navIds = rawItems.map((i) => `${SB_NAV_PREFIX}${i.id}`);

      const body =
        showDnd && workingLayout ? (
          <SortableContext items={navIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-0.5">
              {rawItems.length === 0 ? (
                <GroupDropPlaceholder groupId={group.id} label={t("workspaceNoReports")} />
              ) : (
                rawItems.map((item) => (
                  <SortableNavItemRow key={item.id} item={item} editMode>
                    {renderLinkInner(item)}
                  </SortableNavItemRow>
                ))
              )}
            </div>
          </SortableContext>
        ) : (
          <CollapsibleContent className="space-y-0.5">
            {rawItems.map((item) => (
              <div key={item.id}>{renderLinkInner(item)}</div>
            ))}
          </CollapsibleContent>
        );

      if (showDnd) {
        return (
          <SortableGroupShell
            key={group.id}
            group={group}
            editMode
            groupTitle={groupTitle}
            open={open}
            onOpenChange={(next) => nav.setGroupCollapsed(group.id, !next)}
          >
            {body}
          </SortableGroupShell>
        );
      }

      return (
        <Collapsible
          key={group.id}
          open={open}
          onOpenChange={(next) => nav.setGroupCollapsed(group.id, !next)}
        >
          <div className="space-y-1">
            <CollapsibleTrigger
              className={cn(
                "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors",
                "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            >
              <span className="truncate">{groupTitle}</span>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 shrink-0 text-muted-foreground/80 transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </CollapsibleTrigger>
            {body}
          </div>
        </Collapsible>
      );
    });

    const renderedGroups = groupNodes.filter(Boolean);

    if (showDnd && workingLayout) {
      const groupSortIds = orderedGroups.map((g) => `${SB_GRP_PREFIX}${g.id}`);
      return (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onSidebarDragEnd}>
          <SortableContext items={groupSortIds} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-5">{renderedGroups}</div>
          </SortableContext>
        </DndContext>
      );
    }

    return <div className="flex flex-col gap-5">{renderedGroups}</div>;
  };

  const collapsedLinks = flattenNavItemsInOrder(layoutForMerge)
    .filter((item) => !nav.hiddenSet.has(item.id) && allowItem(item))
    .map((item) => <div key={item.id}>{renderLinkInner(item)}</div>);

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border/80 bg-sidebar/95 shadow-[4px_0_24px_-12px_oklch(0_0_0/12%)] backdrop-blur-md transition-[width] duration-300 dark:shadow-[4px_0_32px_-16px_oklch(0_0_0/45%)]",
          collapsed ? "w-[4.25rem]" : "w-[17.5rem]",
        )}
      >
        <div className="flex h-[4.25rem] shrink-0 items-center gap-3 border-b border-sidebar-border/60 px-4">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-chart-1 to-chart-4 text-[13px] font-bold text-primary-foreground shadow-md ring-1 ring-white/20">
            <Sparkles className="absolute -right-1 -top-1 h-4 w-4 opacity-40" aria-hidden />
            S
          </div>
          {!collapsed && (
            <span className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-sidebar-foreground">
              {t("appName")}
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
          {layoutError ? (
            <p className="mb-2 px-1 text-xs text-destructive">{layoutError}</p>
          ) : null}
          {collapsed ? collapsedLinks : expandedNav()}
        </nav>

        <div className="flex flex-col gap-0.5 border-t border-sidebar-border/60 p-2">
          {isAdmin && !collapsed ? (
            <Button
              type="button"
              variant={sidebarEditMode ? "secondary" : "ghost"}
              className={cn(
                "h-11 justify-start gap-3 rounded-xl px-3 text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
              )}
              onClick={() => {
                if (sidebarEditMode) {
                  setSidebarEditMode(false);
                  setWorkingLayout(null);
                } else {
                  setWorkingLayout(remoteLayout ?? getDefaultSidebarLayout());
                  setSidebarEditMode(true);
                }
              }}
            >
              <GripVertical className="h-[1.15rem] w-[1.15rem] shrink-0" />
              <span className="truncate text-sm font-medium">
                {sidebarEditMode ? t("sidebarEditNavOrderDone") : t("sidebarEditNavOrder")}
              </span>
            </Button>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-11 justify-start gap-3 rounded-xl px-3 text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
            onClick={() => setSettingsOpen(true)}
            title={t("navOpenSettings")}
          >
            <Settings2 className="h-[1.15rem] w-[1.15rem] shrink-0" />
            {!collapsed && (
              <span className="truncate text-sm font-medium">{t("navOpenSettings")}</span>
            )}
          </Button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex h-10 items-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              collapsed ? "justify-center" : "justify-center gap-2 px-3 text-xs font-medium",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <NavCustomizeSheet open={settingsOpen} onOpenChange={setSettingsOpen} nav={nav} />
    </>
  );
}
