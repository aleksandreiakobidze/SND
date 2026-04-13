import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";

export const REP_PREFIX = "rep:";
export const SEC_PREFIX = "sec:";

export function stripRepPrefix(id: string): string {
  return id.startsWith(REP_PREFIX) ? id.slice(REP_PREFIX.length) : id;
}

export function stripSecPrefix(id: string): string {
  return id.startsWith(SEC_PREFIX) ? id.slice(SEC_PREFIX.length) : id;
}

/** Normalize drag target id to a raw UUID (report, or section container). */
export function normalizeReportDragTargetId(id: string): string {
  if (id.startsWith(REP_PREFIX)) return stripRepPrefix(id);
  if (id.startsWith(SEC_PREFIX)) return stripSecPrefix(id);
  return id;
}

export function findReportContainer(
  id: string,
  items: Record<string, string[]>,
): string | undefined {
  const raw = stripRepPrefix(id);
  if (Object.prototype.hasOwnProperty.call(items, raw)) return raw;
  for (const [cid, ids] of Object.entries(items)) {
    if (ids.includes(raw)) return cid;
  }
  return undefined;
}

/** Returns next items map after a drag-end, or null if no change. */
export function applyReportDragEnd(
  items: Record<string, string[]>,
  event: DragEndEvent,
): Record<string, string[]> | null {
  const { active, over } = event;
  if (!over) return null;
  const activeId = stripRepPrefix(String(active.id));
  const overNorm = normalizeReportDragTargetId(String(over.id));
  if (activeId === overNorm) return null;

  const activeContainer = findReportContainer(activeId, items);
  const overContainer =
    findReportContainer(overNorm, items) ??
    (Object.prototype.hasOwnProperty.call(items, overNorm) ? overNorm : undefined);

  if (!activeContainer || !overContainer) return null;

  const next: Record<string, string[]> = {};
  for (const k of Object.keys(items)) {
    next[k] = [...items[k]];
  }

  if (activeContainer === overContainer) {
    const list = next[activeContainer];
    const oldIndex = list.indexOf(activeId);
    const newIndex = list.indexOf(overNorm);
    if (oldIndex === -1 || newIndex === -1) return null;
    next[activeContainer] = arrayMove(list, oldIndex, newIndex);
    return next;
  }

  const from = [...next[activeContainer]];
  const activeIndex = from.indexOf(activeId);
  if (activeIndex === -1) return null;
  from.splice(activeIndex, 1);
  next[activeContainer] = from;

  const to = [...next[overContainer]];
  let overIndex = to.indexOf(overNorm);
  if (overIndex === -1) {
    if (overNorm === overContainer) overIndex = to.length;
    else return null;
  }
  to.splice(overIndex, 0, activeId);
  next[overContainer] = to;
  return next;
}
