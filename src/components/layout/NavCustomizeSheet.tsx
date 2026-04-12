"use client";

import { useEffect, useState } from "react";
import { Eye, EyeOff, PanelLeft } from "lucide-react";
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
import { SIDEBAR_NAV_GROUPS, navItemsInGroup } from "@/lib/nav-items";
import type { NavPreferences } from "@/lib/useNavPreferences";
import type { UseNavPreferencesReturn } from "@/lib/useNavPreferences";
import { cn } from "@/lib/utils";

type NavCustomizeSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  nav: UseNavPreferencesReturn;
};

function draftTabLabelsFlat(prefs: NavPreferences): Record<string, string> {
  const entries = SIDEBAR_NAV_GROUPS.flatMap((g) => navItemsInGroup(g.id)).map((i) => [
    i.id,
    prefs.customLabels[i.id] ?? "",
  ]);
  return Object.fromEntries(entries);
}

function draftGroupLabelsFromPrefs(prefs: NavPreferences): Record<string, string> {
  return Object.fromEntries(SIDEBAR_NAV_GROUPS.map((g) => [g.id, prefs.groupLabels[g.id] ?? ""]));
}

export function NavCustomizeSheet({ open, onOpenChange, nav }: NavCustomizeSheetProps) {
  const { t } = useLocale();
  const { isHidden, setHidden, setCustomLabel, setGroupLabel, resetAll, prefs } = nav;
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>(() => draftTabLabelsFlat(prefs));
  const [draftGroupLabels, setDraftGroupLabels] = useState<Record<string, string>>(() =>
    draftGroupLabelsFromPrefs(prefs),
  );

  useEffect(() => {
    if (!open) return;
    setDraftLabels(draftTabLabelsFlat(prefs));
    setDraftGroupLabels(draftGroupLabelsFromPrefs(prefs));
  }, [open, prefs]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <PanelLeft className="h-5 w-5" />
            {t("navTabsTitle")}
          </SheetTitle>
          <SheetDescription>{t("navTabsDescription")}</SheetDescription>
        </SheetHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-4 pb-2">
          {SIDEBAR_NAV_GROUPS.map((group) => {
            const items = navItemsInGroup(group.id);
            if (items.length === 0) return null;

            const defaultGroupTitle = t(group.labelKey);

            return (
              <div key={group.id} className="flex flex-col gap-3">
                <div className="rounded-xl border border-border/80 bg-muted/20 p-3">
                  <label
                    className="text-xs font-medium text-muted-foreground"
                    htmlFor={`nav-group-${group.id}`}
                  >
                    {t("navGroupSectionTitle")}
                  </label>
                  <Input
                    id={`nav-group-${group.id}`}
                    value={draftGroupLabels[group.id] ?? ""}
                    placeholder={defaultGroupTitle}
                    className="mt-2 h-9"
                    onChange={(e) =>
                      setDraftGroupLabels((d) => ({ ...d, [group.id]: e.target.value }))
                    }
                    onBlur={(e) => setGroupLabel(group.id, e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                  />
                </div>

                {items.map((item) => {
                  const hidden = isHidden(item.id);
                  const defaultLabel = t(item.labelKey);

                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "rounded-xl border border-border/80 bg-muted/30 p-3",
                        hidden && "opacity-60",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <item.icon className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <label
                            className="text-xs font-medium text-muted-foreground"
                            htmlFor={`nav-label-${item.id}`}
                          >
                            {t("navTabDisplayName")}
                          </label>
                          <Input
                            id={`nav-label-${item.id}`}
                            value={draftLabels[item.id] ?? ""}
                            placeholder={defaultLabel}
                            className="h-9"
                            disabled={hidden}
                            onChange={(e) =>
                              setDraftLabels((d) => ({ ...d, [item.id]: e.target.value }))
                            }
                            onBlur={(e) => setCustomLabel(item.id, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                            }}
                          />
                          <div className="flex flex-wrap items-center gap-2">
                            <Button
                              type="button"
                              variant={hidden ? "secondary" : "outline"}
                              size="sm"
                              className="h-8 gap-1.5"
                              onClick={() => setHidden(item.id, !hidden)}
                            >
                              {hidden ? (
                                <>
                                  <Eye className="h-3.5 w-3.5" />
                                  {t("navTabShow")}
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3.5 w-3.5" />
                                  {t("navTabHide")}
                                </>
                              )}
                            </Button>
                            {hidden ? (
                              <span className="text-xs text-muted-foreground">{t("navTabHiddenHint")}</span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <SheetFooter className="border-t border-border pt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              resetAll();
            }}
          >
            {t("navTabsReset")}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
