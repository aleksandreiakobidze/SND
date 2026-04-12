"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { useLocale } from "@/lib/locale-context";
import type { WorkspaceTree } from "@/lib/workspace-db";
import { SavedReportCard } from "@/components/workspace/SavedReportCard";
import { cn } from "@/lib/utils";

export function WorkspacePageClient() {
  const { t } = useLocale();
  const [tree, setTree] = useState<WorkspaceTree[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeWsId, setActiveWsId] = useState<string | null>(null);
  const [newTabName, setNewTabName] = useState("");
  const [newSectionName, setNewSectionName] = useState("");

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
    if (!confirm(t("workspaceConfirmDeleteTab"))) return;
    const res = await fetch(`/api/workspaces/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    if (activeWsId === id) setActiveWsId(null);
    await load();
  }

  async function addSection() {
    if (!activeWsId) return;
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
    if (!confirm(t("workspaceConfirmDeleteSection"))) return;
    const res = await fetch(`/api/sections/${id}`, { method: "DELETE", credentials: "include" });
    if (!res.ok) return;
    await load();
  }

  if (loading) {
    return (
      <div className="relative p-6">
        <PageGradientBackdrop />
        <p className="relative text-muted-foreground">{t("loading")}</p>
      </div>
    );
  }

  if (error) {
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

  return (
    <div className="relative min-h-full">
      <PageGradientBackdrop />
      <div className="relative mx-auto max-w-[1600px] px-6 pb-10 pt-6">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("myWorkspace")}</h1>
            <p className="text-muted-foreground mt-1 text-sm max-w-2xl">{t("workspacePageDesc")}</p>
          </div>
          <Link
            href="/agent"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            {t("workspaceOpenFullAgent")}
          </Link>
        </div>

        <div className="mb-6 flex flex-col gap-3 overflow-x-auto rounded-xl border border-border/80 bg-muted/20 p-3 sm:flex-row sm:items-end">
          <div className="flex min-w-0 flex-1 flex-wrap gap-2">
            {tree.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">{t("workspaceEmpty")}</p>
            ) : (
              tree.map((w) => (
                <div key={w.id} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveWsId(w.id)}
                    className={cn(
                      "rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      activeWsId === w.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {w.title}
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-xs text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    title={t("workspaceDeleteTab")}
                    onClick={() => void removeWorkspace(w.id)}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
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
        </div>

        {!activeWs ? (
          <p className="text-muted-foreground text-sm">{t("workspaceEmpty")}</p>
        ) : (
          <div className="space-y-8">
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

            {activeWs.sections.length === 0 ? (
              <p className="text-muted-foreground text-sm">{t("workspaceNoSections")}</p>
            ) : (
              activeWs.sections.map((section) => (
                <section key={section.id} className="space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-border/60 pb-2">
                    <h2 className="text-lg font-semibold">{section.title}</h2>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => void removeSection(section.id)}
                    >
                      {t("workspaceDeleteSection")}
                    </Button>
                  </div>
                  {section.reports.length === 0 ? (
                    <p className="text-sm text-muted-foreground">{t("workspaceNoReports")}</p>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-1">
                      {section.reports.map((r) => (
                        <SavedReportCard
                          key={r.id}
                          report={r}
                          onDeleted={() => void load()}
                          onTitleUpdated={() => void load()}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
