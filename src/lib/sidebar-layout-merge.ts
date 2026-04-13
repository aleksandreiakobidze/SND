import {
  SIDEBAR_NAV_GROUPS,
  SIDEBAR_NAV_ITEMS,
  type NavGroupDef,
  type SidebarNavItemDef,
} from "@/lib/nav-items";
import type { SidebarLayout } from "@/lib/sidebar-layout";
import { getDefaultSidebarLayout } from "@/lib/sidebar-layout";

const itemById = new Map(SIDEBAR_NAV_ITEMS.map((i) => [i.id, i]));

/**
 * Resolve SQL layout (or defaults) into ordered groups and per-group item defs from catalog.
 */
export function mergeSidebarLayout(layout: SidebarLayout | null): {
  orderedGroups: NavGroupDef[];
  getItemsForGroup: (groupId: string) => SidebarNavItemDef[];
} {
  const base = layout ?? getDefaultSidebarLayout();
  const orderedGroups: NavGroupDef[] = [];
  const seen = new Set<string>();
  for (const gid of base.groupOrder) {
    const g = SIDEBAR_NAV_GROUPS.find((x) => x.id === gid);
    if (g) {
      orderedGroups.push(g);
      seen.add(gid);
    }
  }
  for (const g of SIDEBAR_NAV_GROUPS) {
    if (!seen.has(g.id)) orderedGroups.push(g);
  }

  function getItemsForGroup(groupId: string): SidebarNavItemDef[] {
    const ids = base.itemsByGroup[groupId] ?? [];
    const out: SidebarNavItemDef[] = [];
    for (const id of ids) {
      const def = itemById.get(id);
      if (def) out.push(def);
    }
    return out;
  }

  return { orderedGroups, getItemsForGroup };
}

/** Collapsed sidebar: single column in global order. */
export function flattenNavItemsInOrder(layout: SidebarLayout | null): SidebarNavItemDef[] {
  const { orderedGroups, getItemsForGroup } = mergeSidebarLayout(layout);
  const out: SidebarNavItemDef[] = [];
  for (const g of orderedGroups) {
    out.push(...getItemsForGroup(g.id));
  }
  return out;
}
