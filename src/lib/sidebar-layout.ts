import { SIDEBAR_NAV_GROUPS, SIDEBAR_NAV_ITEMS, navItemsInGroup } from "@/lib/nav-items";

/** Persisted global sidebar structure (JSON in dbo.SndApp_SidebarLayout). */
export type SidebarLayout = {
  groupOrder: string[];
  itemsByGroup: Record<string, string[]>;
};

const CATALOG_GROUP_IDS = new Set(SIDEBAR_NAV_GROUPS.map((g) => g.id));
const CATALOG_ITEM_IDS = new Set(SIDEBAR_NAV_ITEMS.map((i) => i.id));
const CATALOG_ITEM_COUNT = SIDEBAR_NAV_ITEMS.length;

export function getDefaultSidebarLayout(): SidebarLayout {
  const groupOrder = [...SIDEBAR_NAV_GROUPS]
    .sort((a, b) => a.order - b.order)
    .map((g) => g.id);
  const itemsByGroup: Record<string, string[]> = {};
  for (const gid of groupOrder) {
    itemsByGroup[gid] = navItemsInGroup(gid).map((i) => i.id);
  }
  return { groupOrder, itemsByGroup };
}

/** Human-readable reason, or null when valid. */
export function getSidebarLayoutValidationError(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") return "Layout must be a JSON object";
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.groupOrder)) return "groupOrder must be an array";
  if (typeof o.itemsByGroup !== "object" || o.itemsByGroup === null) return "itemsByGroup must be an object";

  const groupOrder = o.groupOrder as unknown[];
  if (groupOrder.length !== CATALOG_GROUP_IDS.size) {
    return `groupOrder must list every group exactly once (expected ${CATALOG_GROUP_IDS.size})`;
  }
  const seenGroups = new Set<string>();
  for (const g of groupOrder) {
    if (typeof g !== "string" || !CATALOG_GROUP_IDS.has(g) || seenGroups.has(g)) {
      return "groupOrder must be a permutation of the known sidebar groups";
    }
    seenGroups.add(g);
  }
  if (seenGroups.size !== CATALOG_GROUP_IDS.size) {
    return "groupOrder must include every sidebar group id";
  }

  const itemsByGroup = o.itemsByGroup as Record<string, unknown>;
  const allIds: string[] = [];
  for (const gid of CATALOG_GROUP_IDS) {
    const list = itemsByGroup[gid];
    if (!Array.isArray(list)) return `itemsByGroup.${gid} must be an array`;
    for (const id of list) {
      if (typeof id !== "string" || !CATALOG_ITEM_IDS.has(id)) {
        return `Unknown or invalid nav item id in group ${gid}`;
      }
      allIds.push(id);
    }
  }
  for (const key of Object.keys(itemsByGroup)) {
    if (!CATALOG_GROUP_IDS.has(key)) return `Unexpected itemsByGroup key: ${key}`;
  }
  if (allIds.length !== CATALOG_ITEM_COUNT) {
    return `Every nav item must appear exactly once (got ${allIds.length}, expected ${CATALOG_ITEM_COUNT})`;
  }
  const unique = new Set(allIds);
  if (unique.size !== CATALOG_ITEM_COUNT) return "Duplicate nav item ids across groups";
  return null;
}

export function validateSidebarLayout(raw: unknown): raw is SidebarLayout {
  return getSidebarLayoutValidationError(raw) === null;
}

export function parseSidebarLayoutJson(json: string | null): SidebarLayout | null {
  if (json == null || json.trim() === "") return null;
  try {
    const v = JSON.parse(json) as unknown;
    return validateSidebarLayout(v) ? v : null;
  } catch {
    return null;
  }
}
