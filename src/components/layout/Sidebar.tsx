"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight, Settings2, Sparkles } from "lucide-react";
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
        title={collapsed ? label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
          isActive
            ? "bg-sidebar-primary/12 text-sidebar-primary shadow-sm ring-1 ring-sidebar-primary/20 dark:bg-sidebar-primary/18"
            : "text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
        )}
      >
        {isActive && (
          <span
            className="absolute left-0 top-1/2 h-7 w-1 -translate-y-1/2 rounded-full bg-sidebar-primary"
            aria-hidden
          />
        )}
        <item.icon
          className={cn(
            "h-[1.15rem] w-[1.15rem] shrink-0 transition-transform duration-200",
            isActive && "text-sidebar-primary",
            !isActive && "group-hover:scale-105",
          )}
        />
        {!collapsed && <span className="truncate">{label}</span>}
      </Link>
    );
  };

  return (
    <>
      <aside
        className={cn(
          "sticky top-0 flex h-screen shrink-0 flex-col border-r border-sidebar-border/80 bg-sidebar/95 shadow-[4px_0_24px_-12px_oklch(0_0_0/12%)] backdrop-blur-md transition-[width] duration-300 dark:shadow-[4px_0_32px_-16px_oklch(0_0_0/45%)]",
          collapsed ? "w-[4.25rem]" : "w-[17.5rem]",
        )}
      >
        <div className="flex h-[4.25rem] shrink-0 items-center gap-3 border-b border-sidebar-border/60 px-4">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-chart-1 to-chart-4 text-[13px] font-bold text-primary-foreground shadow-md ring-1 ring-white/20">
            <Sparkles className="absolute -right-1 -top-1 h-4 w-4 opacity-40" aria-hidden />
            S
          </div>
          {!collapsed && (
            <span className="min-w-0 truncate text-[15px] font-semibold tracking-tight text-sidebar-foreground">
              {t("appName")}
            </span>
          )}
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-2.5 py-4">
          {collapsed ? (
            SIDEBAR_NAV_GROUPS.flatMap((group) =>
              navItemsInGroup(group.id).filter(
                (item) => !nav.hiddenSet.has(item.id) && allowItem(item),
              ),
            ).map((item) => renderLink(item))
          ) : (
            <div className="flex flex-col gap-5">
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
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors",
                          "hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                          "outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        )}
                      >
                        <span className="truncate">{groupTitle}</span>
                        <ChevronDown
                          className={cn(
                            "h-3.5 w-3.5 shrink-0 text-muted-foreground/80 transition-transform duration-200",
                            open && "rotate-180",
                          )}
                        />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="space-y-0.5">
                        {items.map((item) => renderLink(item))}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}
            </div>
          )}
        </nav>

        <div className="flex flex-col gap-0.5 border-t border-sidebar-border/60 p-2">
          <Button
            type="button"
            variant="ghost"
            className={cn(
              "h-11 justify-start gap-3 rounded-xl px-3 text-muted-foreground hover:bg-sidebar-accent/80 hover:text-sidebar-foreground",
              collapsed && "justify-center px-0",
            )}
            onClick={() => setSettingsOpen(true)}
            title={t("navOpenSettings")}
          >
            <Settings2 className="h-[1.15rem] w-[1.15rem] shrink-0" />
            {!collapsed && (
              <span className="truncate text-sm font-medium">{t("navOpenSettings")}</span>
            )}
          </Button>
          <button
            type="button"
            onClick={() => setCollapsed(!collapsed)}
            className={cn(
              "flex h-10 items-center rounded-xl text-muted-foreground transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
              collapsed ? "justify-center" : "justify-center gap-2 px-3 text-xs font-medium",
            )}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        </div>
      </aside>

      <NavCustomizeSheet open={settingsOpen} onOpenChange={setSettingsOpen} nav={nav} />
    </>
  );
}
