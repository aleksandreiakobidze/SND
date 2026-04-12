"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/lib/locale-context";
import { useState, useEffect } from "react";
import {
  type SidebarNavItemDef,
  SIDEBAR_NAV_GROUPS,
  navItemsInGroup,
} from "@/lib/nav-items";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import { isNavItemVisible } from "@/lib/nav-access";
import { useNavPreferences } from "@/lib/useNavPreferences";
import { NavCustomizeSheet } from "@/components/layout/NavCustomizeSheet";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useLocale();
  const { permissions, loading: authLoading } = useAuth();
  const caps = useAuthCapabilities(permissions);
  const nav = useNavPreferences();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => setMounted(true), []);

  const allowItem = (item: SidebarNavItemDef) =>
    authLoading || isNavItemVisible(item, caps);

  const renderLink = (item: SidebarNavItemDef) => {
    const isActive = mounted
      ? item.href === "/"
        ? pathname === "/"
        : pathname.startsWith(item.href)
      : false;

    const label = nav.getDisplayLabel(item.id, t(item.labelKey));

    return (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 h-screen border-r border-border bg-card flex flex-col transition-all duration-300",
          collapsed ? "w-16" : "w-64",
        )}
      >
        <div className="flex h-16 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            S
          </div>
          {!collapsed && (
            <span className="truncate text-lg font-semibold tracking-tight">{t("appName")}</span>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
          {collapsed ? (
            SIDEBAR_NAV_GROUPS.flatMap((group) =>
              navItemsInGroup(group.id).filter(
                (item) => !nav.hiddenSet.has(item.id) && allowItem(item),
              ),
            ).map((item) => renderLink(item))
          ) : (
            <div className="flex flex-col gap-4">
              {SIDEBAR_NAV_GROUPS.map((group) => {
                const items = navItemsInGroup(group.id).filter(
                  (item) => !nav.hiddenSet.has(item.id) && allowItem(item),
                );
                if (items.length === 0) return null;

                const groupTitle = nav.getGroupLabel(group.id, t(group.labelKey));
                const open = !nav.isGroupCollapsed(group.id);

                return (
                  <Collapsible
                    key={group.id}
                    open={open}
                    onOpenChange={(next) => nav.setGroupCollapsed(group.id, !next)}
                  >
                    <div className="space-y-1">
                      <CollapsibleTrigger
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-xs font-semibold text-muted-foreground transition-colors",
                          "hover:bg-muted/60 hover:text-foreground",
                          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <span className="truncate">{groupTitle}</span>
                        <ChevronDown
                          className={cn(
                            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                            open && "rotate-180",
                          )}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-1">
                        {items.map((item) => renderLink(item))}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </nav>

        <div className="flex flex-col border-t border-border">
          <Button
            type="button"
            variant="ghost"
            className="h-12 justify-start gap-3 rounded-none px-3 text-muted-foreground hover:text-foreground"
            onClick={() => setSettingsOpen(true)}
            title={t("navOpenSettings")}
          >
            <Settings2 className="h-5 w-5 shrink-0" />
            {!collapsed && <span className="truncate text-sm">{t("navOpenSettings")}</span>}
          </Button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className="flex h-12 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <NavCustomizeSheet open={settingsOpen} onOpenChange={setSettingsOpen} nav={nav} />
    </>
  );
}
