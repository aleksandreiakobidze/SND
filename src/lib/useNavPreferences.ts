"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "snd-sidebar-nav-v1";

export type NavPreferences = {
  hiddenIds: string[];
  customLabels: Record<string, string>;
  /** Custom section titles by group id (overview, sales, orders, …) */
  groupLabels: Record<string, string>;
  /** Group ids whose section is collapsed in the sidebar */
  collapsedGroupIds: string[];
};

export type UseNavPreferencesReturn = {
  ready: boolean;
  prefs: NavPreferences;
  hiddenSet: Set<string>;
  isHidden: (id: string) => boolean;
  getDisplayLabel: (id: string, defaultLabel: string) => string;
  getGroupLabel: (groupId: string, defaultLabel: string) => string;
  isGroupCollapsed: (groupId: string) => boolean;
  setHidden: (id: string, hidden: boolean) => void;
  setCustomLabel: (id: string, label: string) => void;
  setGroupLabel: (groupId: string, label: string) => void;
  setGroupCollapsed: (groupId: string, collapsed: boolean) => void;
  resetAll: () => void;
};

const defaultPrefs: NavPreferences = {
  hiddenIds: [],
  customLabels: {},
  groupLabels: {},
  collapsedGroupIds: [],
};

function load(): NavPreferences {
  if (typeof window === "undefined") return defaultPrefs;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPrefs;
    const parsed = JSON.parse(raw) as Partial<NavPreferences>;
    return {
      hiddenIds: Array.isArray(parsed.hiddenIds) ? parsed.hiddenIds : [],
      customLabels:
        parsed.customLabels && typeof parsed.customLabels === "object"
          ? parsed.customLabels
          : {},
      groupLabels:
        parsed.groupLabels && typeof parsed.groupLabels === "object"
          ? parsed.groupLabels
          : {},
      collapsedGroupIds: Array.isArray(parsed.collapsedGroupIds)
        ? parsed.collapsedGroupIds
        : [],
    };
  } catch {
    return defaultPrefs;
  }
}

function save(prefs: NavPreferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore quota */
  }
}

export function useNavPreferences(): UseNavPreferencesReturn {
  const [prefs, setPrefs] = useState<NavPreferences>(defaultPrefs);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(load());
    setReady(true);
  }, []);

  const setHidden = useCallback((id: string, hidden: boolean) => {
    setPrefs((prev) => {
      const set = new Set(prev.hiddenIds);
      if (hidden) set.add(id);
      else set.delete(id);
      const next = { ...prev, hiddenIds: [...set] };
      save(next);
      return next;
    });
  }, []);

  const setCustomLabel = useCallback((id: string, label: string) => {
    const trimmed = label.trim();
    setPrefs((prev) => {
      const customLabels = { ...prev.customLabels };
      if (trimmed === "") delete customLabels[id];
      else customLabels[id] = trimmed;
      const next = { ...prev, customLabels };
      save(next);
      return next;
    });
  }, []);

  const setGroupLabel = useCallback((groupId: string, label: string) => {
    const trimmed = label.trim();
    setPrefs((prev) => {
      const groupLabels = { ...prev.groupLabels };
      if (trimmed === "") delete groupLabels[groupId];
      else groupLabels[groupId] = trimmed;
      const next = { ...prev, groupLabels };
      save(next);
      return next;
    });
  }, []);

  const setGroupCollapsed = useCallback((groupId: string, collapsed: boolean) => {
    setPrefs((prev) => {
      const set = new Set(prev.collapsedGroupIds);
      if (collapsed) set.add(groupId);
      else set.delete(groupId);
      const next = { ...prev, collapsedGroupIds: [...set] };
      save(next);
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setPrefs(defaultPrefs);
    save(defaultPrefs);
  }, []);

  const isHidden = useCallback(
    (id: string) => prefs.hiddenIds.includes(id),
    [prefs.hiddenIds],
  );

  const getDisplayLabel = useCallback(
    (id: string, defaultLabel: string) => {
      const c = prefs.customLabels[id]?.trim();
      return c || defaultLabel;
    },
    [prefs.customLabels],
  );

  const getGroupLabel = useCallback(
    (groupId: string, defaultLabel: string) => {
      const c = prefs.groupLabels[groupId]?.trim();
      return c || defaultLabel;
    },
    [prefs.groupLabels],
  );

  const isGroupCollapsed = useCallback(
    (groupId: string) => prefs.collapsedGroupIds.includes(groupId),
    [prefs.collapsedGroupIds],
  );

  const hiddenSet = useMemo(() => new Set(prefs.hiddenIds), [prefs.hiddenIds]);

  return {
    ready,
    prefs,
    hiddenSet,
    isHidden,
    getDisplayLabel,
    getGroupLabel,
    isGroupCollapsed,
    setHidden,
    setCustomLabel,
    setGroupLabel,
    setGroupCollapsed,
    resetAll,
  };
}
