import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

export const SB_NAV_PREFIX = "sbnav:";
export const SB_GRP_PREFIX = "sbgrp:";

function stripNav(id: string): string {
  return id.startsWith(SB_NAV_PREFIX) ? id.slice(SB_NAV_PREFIX.length) : id;
}

export function stripSbGrp(id: string): string {
  return id.startsWith(SB_GRP_PREFIX) ? id.slice(SB_GRP_PREFIX.length) : id;
}

export function applyGroupOrderDragEnd(
  groupOrder: string[],
  event: DragEndEvent,
): string[] | null {
  const { active, over } = event;
  if (!over || active.id === over.id) return null;
  const a = stripSbGrp(String(active.id));
  const o = stripSbGrp(String(over.id));
  const oldIndex = groupOrder.indexOf(a);
  const newIndex = groupOrder.indexOf(o);
  if (oldIndex === -1 || newIndex === -1) return null;
  return arrayMove(groupOrder, oldIndex, newIndex);
}

function findItemContainer(itemId: string, itemsByGroup: Record<string, string[]>): string | undefined {
  for (const [cid, ids] of Object.entries(itemsByGroup)) {
    if (ids.includes(itemId)) return cid;
  }
  return undefined;
}

/** Move nav items between groups or reorder within a group. */
export function applyNavItemDragEnd(
  itemsByGroup: Record<string, string[]>,
  event: DragEndEvent,
): Record<string, string[]> | null {
  const { active, over } = event;
  if (!over) return null;
  const activeId = stripNav(String(active.id));
  const overStr = String(over.id);

  const activeContainer = findItemContainer(activeId, itemsByGroup);
  if (!activeContainer) return null;

  let overContainer: string | undefined;
  let overItemId: string | undefined;

  if (overStr.startsWith(SB_NAV_PREFIX)) {
    overItemId = stripNav(overStr);
    overContainer = findItemContainer(overItemId, itemsByGroup);
  } else if (overStr.startsWith(SB_GRP_PREFIX)) {
    overContainer = stripSbGrp(overStr);
  }

  if (!overContainer) return null;

  if (activeContainer === overContainer && overItemId !== undefined) {
    if (activeId === overItemId) return null;
    const list = [...itemsByGroup[activeContainer]];
    const oldIndex = list.indexOf(activeId);
    const newIndex = list.indexOf(overItemId);
    if (oldIndex === -1 || newIndex === -1) return null;
    return {
      ...itemsByGroup,
      [activeContainer]: arrayMove(list, oldIndex, newIndex),
    };
  }

  const next: Record<string, string[]> = {};
  for (const k of Object.keys(itemsByGroup)) {
    next[k] = [...itemsByGroup[k]];
  }

  const from = [...next[activeContainer]];
  const ai = from.indexOf(activeId);
  if (ai === -1) return null;
  from.splice(ai, 1);
  next[activeContainer] = from;

  const to = [...next[overContainer]];
  let insertAt: number;
  if (overItemId !== undefined) {
    insertAt = to.indexOf(overItemId);
    if (insertAt === -1) return null;
  } else {
    insertAt = to.length;
  }
  to.splice(insertAt, 0, activeId);
  next[overContainer] = to;
  return next;
}
