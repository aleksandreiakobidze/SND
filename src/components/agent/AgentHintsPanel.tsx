"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

type Hint = {
  id: string;
  title: string | null;
  body: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function AgentHintsPanel() {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [hints, setHints] = useState<Hint[]>([]);
  const [maxHints, setMaxHints] = useState(50);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftBody, setDraftBody] = useState("");
  const [saving, setSaving] = useState(false);

  const loadHints = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/agent/hints", { credentials: "include" });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : t("agentPersonalHintsLoadError"));
        setHints([]);
        return;
      }
      setHints(Array.isArray(json.hints) ? json.hints : []);
      if (json.limits?.maxHints != null) setMaxHints(Number(json.limits.maxHints));
    } catch {
      setError(t("agentPersonalHintsLoadError"));
      setHints([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void loadHints();
  }, [loadHints]);

  function startNew() {
    setEditingId("new");
    setDraftTitle("");
    setDraftBody("");
  }

  function startEdit(h: Hint) {
    setEditingId(h.id);
    setDraftTitle(h.title ?? "");
    setDraftBody(h.body);
  }

  function cancelEdit() {
    setEditingId(null);
    setDraftTitle("");
    setDraftBody("");
  }

  async function save() {
    const body = draftBody.trim();
    if (!body) return;
    setSaving(true);
    try {
      if (editingId === "new") {
        const res = await fetch("/api/agent/hints", {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draftTitle.trim() || null,
            body,
          }),
        });
        const json = await res.json();
        if (res.status === 409) {
          setError(t("agentPersonalHintsLimitReached"));
          return;
        }
        if (!res.ok) {
          setError(json.error || t("error"));
          return;
        }
      } else if (editingId) {
        const res = await fetch(`/api/agent/hints/${editingId}`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: draftTitle.trim() || null,
            body,
          }),
        });
        if (!res.ok) {
          const json = await res.json();
          setError(json.error || t("error"));
          return;
        }
      }
      cancelEdit();
      await loadHints();
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    if (!confirm(t("agentPersonalHintsDeleteConfirm"))) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/agent/hints/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || t("error"));
        return;
      }
      if (editingId === id) cancelEdit();
      await loadHints();
    } finally {
      setSaving(false);
    }
  }

  const atLimit = hints.length >= maxHints;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="border-b border-border/80 bg-muted/15">
        <CollapsibleTrigger
          className={cn(
            "flex w-full items-center justify-between gap-2 px-6 py-2.5 text-left text-sm outline-none",
            "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          <div>
            <span className="font-medium">{t("agentPersonalHintsTitle")}</span>
            <span className="text-muted-foreground text-xs ml-2">
              ({hints.length}/{maxHints})
            </span>
          </div>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-6 pb-4">
          <p className="text-xs text-muted-foreground mb-3 max-w-3xl">{t("agentPersonalHintsDesc")}</p>
          {error && <p className="text-xs text-destructive mb-2">{error}</p>}
          {loading ? (
            <p className="text-xs text-muted-foreground">{t("loading")}</p>
          ) : (
            <div className="space-y-3 max-w-3xl">
              {hints.length === 0 && editingId !== "new" && (
                <p className="text-sm text-muted-foreground">{t("agentPersonalHintsEmpty")}</p>
              )}
              {hints.map((h) =>
                editingId === h.id ? (
                  <Card key={h.id} className="p-3 space-y-2 border-border/80">
                    <Input
                      value={draftTitle}
                      onChange={(e) => setDraftTitle(e.target.value)}
                      placeholder={t("agentPersonalHintTitlePlaceholder")}
                      className="h-9"
                      disabled={saving}
                    />
                    <textarea
                      value={draftBody}
                      onChange={(e) => setDraftBody(e.target.value)}
                      placeholder={t("agentPersonalHintBodyPlaceholder")}
                      disabled={saving}
                      rows={4}
                      className={cn(
                        "flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm",
                        "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
                        "disabled:opacity-50",
                      )}
                    />
                    <div className="flex gap-2">
                      <Button type="button" size="sm" onClick={() => void save()} disabled={saving || !draftBody.trim()}>
                        {saving ? t("agentPersonalHintsSaving") : t("agentPersonalHintsSave")}
                      </Button>
                      <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                        {t("agentPersonalHintsCancel")}
                      </Button>
                    </div>
                  </Card>
                ) : (
                  <Card key={h.id} className="p-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between border-border/80">
                    <div className="min-w-0 space-y-1">
                      {h.title ? <p className="text-sm font-medium">{h.title}</p> : null}
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap break-words">{h.body}</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => startEdit(h)}
                        disabled={saving || editingId !== null}
                        aria-label={t("agentPersonalHintsEdit")}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        onClick={() => void remove(h.id)}
                        disabled={saving || editingId !== null}
                        aria-label={t("agentPersonalHintsDelete")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </Card>
                ),
              )}

              {editingId === "new" && (
                <Card className="p-3 space-y-2 border-primary/30">
                  <Input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    placeholder={t("agentPersonalHintTitlePlaceholder")}
                    className="h-9"
                    disabled={saving}
                  />
                  <textarea
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                    placeholder={t("agentPersonalHintBodyPlaceholder")}
                    disabled={saving}
                    rows={4}
                    className={cn(
                      "flex min-h-[80px] w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm",
                      "placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 outline-none",
                      "disabled:opacity-50",
                    )}
                  />
                  <div className="flex gap-2">
                    <Button type="button" size="sm" onClick={() => void save()} disabled={saving || !draftBody.trim()}>
                      {saving ? t("agentPersonalHintsSaving") : t("agentPersonalHintsSave")}
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={cancelEdit} disabled={saving}>
                      {t("agentPersonalHintsCancel")}
                    </Button>
                  </div>
                </Card>
              )}

              {!editingId && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={startNew}
                  disabled={atLimit || saving}
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  {t("agentPersonalHintsAdd")}
                </Button>
              )}
              {hints.length > 0 && !editingId && atLimit && (
                <p className="text-xs text-muted-foreground">{t("agentPersonalHintsLimitReached")}</p>
              )}
            </div>
          )}
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}
