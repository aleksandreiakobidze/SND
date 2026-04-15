"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useLocale } from "@/lib/locale-context";
import type { WorkspaceTree } from "@/lib/workspace-db";
import type { ChartConfig } from "@/types";

export type SavePayload = {
  title: string;
  prompt?: string;
  sql?: string;
  chartConfig?: ChartConfig | null;
  narrative?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload: SavePayload;
  onSaved?: () => void;
};

export function SaveToWorkspaceSheet({ open, onOpenChange, payload, onSaved }: Props) {
  const { t } = useLocale();
  const [tree, setTree] = useState<WorkspaceTree[]>([]);
  const [loadingTree, setLoadingTree] = useState(false);
  const [workspaceId, setWorkspaceId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [title, setTitle] = useState(payload.title);
  const [newWs, setNewWs] = useState("");
  const [newSec, setNewSec] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(payload.title);
    setError(null);
    setLoadingTree(true);
    fetch("/api/workspaces", { credentials: "include" })
      .then((r) => r.json())
      .then((data: WorkspaceTree[]) => {
        setTree(Array.isArray(data) ? data : []);
        if (Array.isArray(data) && data.length > 0) {
          const w = data[0];
          setWorkspaceId(w.id);
          setSectionId(w.sections[0]?.id ?? "");
        }
      })
      .catch(() => setTree([]))
      .finally(() => setLoadingTree(false));
  }, [open, payload.title]);

  const activeWs = tree.find((w) => w.id === workspaceId);

  async function createWs() {
    const name = newWs.trim();
    if (!name) return;
    const res = await fetch("/api/workspaces", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: name }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || t("error"));
      return;
    }
    setNewWs("");
    const r = await fetch("/api/workspaces", { credentials: "include" });
    const list = (await r.json()) as WorkspaceTree[];
    setTree(list);
    if (json.id) {
      setWorkspaceId(json.id);
      setSectionId("");
    }
  }

  async function createSec() {
    if (!workspaceId) return;
    const name = newSec.trim();
    if (!name) return;
    const res = await fetch(`/api/workspaces/${workspaceId}/sections`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: name }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error || t("error"));
      return;
    }
    setNewSec("");
    const r = await fetch("/api/workspaces", { credentials: "include" });
    const list = (await r.json()) as WorkspaceTree[];
    setTree(list);
    if (json.id) setSectionId(json.id);
  }

  async function save() {
    if (!sectionId) {
      setError(t("workspaceNoSections"));
      return;
    }
    const trimmed = title.trim();
    if (!trimmed) {
      setError(t("workspaceReportDisplayName"));
      return;
    }
    if (!payload.sql?.trim()) {
      setError(t("error"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/sections/${sectionId}/reports`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trimmed,
          source: "agent",
          prompt: payload.prompt ?? null,
          sql: payload.sql,
          chartConfig: payload.chartConfig ?? null,
          narrative: payload.narrative ?? null,
        }),
      });
      const json = (await res.json()) as { error?: string; details?: string };
      if (!res.ok) {
        console.error("save report failed", res.status, json);
        setError([json.error, json.details].filter(Boolean).join(": ") || t("error"));
        return;
      }
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{t("workspaceSaveTitle")}</SheetTitle>
          <SheetDescription>{t("workspaceSaveDescription")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-2">
          {loadingTree ? <p className="text-sm text-muted-foreground">{t("loading")}</p> : null}

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t("workspaceSelectTab")}</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={workspaceId}
              onChange={(e) => {
                setWorkspaceId(e.target.value);
                const ws = tree.find((w) => w.id === e.target.value);
                setSectionId(ws?.sections[0]?.id ?? "");
              }}
            >
              {tree.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Input
                placeholder={t("workspaceNewTabPlaceholder")}
                value={newWs}
                onChange={(e) => setNewWs(e.target.value)}
              />
              <Button type="button" variant="secondary" size="sm" onClick={() => void createWs()}>
                {t("workspaceAddTab")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t("workspaceSelectSection")}</label>
            <select
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={!activeWs?.sections.length}
            >
              {(activeWs?.sections ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <Input
                placeholder={t("workspaceNewSectionPlaceholder")}
                value={newSec}
                onChange={(e) => setNewSec(e.target.value)}
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={!workspaceId}
                onClick={() => void createSec()}
              >
                {t("workspaceAddSection")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">{t("workspaceReportDisplayName")}</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>

          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>

        <SheetFooter className="border-t border-border pt-4">
          <Button type="button" className="w-full" disabled={saving} onClick={() => void save()}>
            {saving ? t("loading") : t("workspaceSave")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
