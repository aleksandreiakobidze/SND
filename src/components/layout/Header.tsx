"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Moon, Sun, Languages, LogOut } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocale } from "@/lib/locale-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function Header() {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const { t, locale, setLocale } = useLocale();
  const { user, refresh } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    await refresh();
    router.push("/login");
    router.refresh();
  }

  const display =
    user?.displayName?.trim() || user?.email?.split("@")[0] || user?.email || "";

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border/50 bg-background/75 px-4 backdrop-blur-2xl supports-[backdrop-filter]:bg-background/55 sm:h-[3.75rem] sm:px-6">
      <div className="min-w-0 flex-1 truncate text-left">
        {user ? (
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "hidden h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold text-primary-foreground shadow-inner sm:flex",
                "bg-gradient-to-br from-primary to-chart-1",
              )}
              aria-hidden
            >
              {(display.slice(0, 2) || "S").toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
                {t("loggedInAs")}
              </p>
              <p className="truncate text-sm font-semibold text-foreground">
                {user.displayName?.trim() || user.email}
              </p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1 rounded-2xl border border-border/60 bg-muted/30 p-1 shadow-inner dark:bg-muted/15">
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "inline-flex h-9 w-9 items-center justify-center rounded-xl text-sm font-medium",
              "text-muted-foreground transition-colors hover:bg-background hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
            aria-label="Language"
          >
            <Languages className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[10rem]">
            <DropdownMenuItem
              onClick={() => setLocale("en")}
              className={locale === "en" ? "bg-accent" : ""}
            >
              EN — English
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLocale("ka")}
              className={locale === "ka" ? "bg-accent" : ""}
            >
              KA — ქართული
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 rounded-xl text-muted-foreground hover:bg-background hover:text-foreground"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          {mounted ? (
            resolvedTheme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )
          ) : (
            <Sun className="h-4 w-4 opacity-60" />
          )}
        </Button>

        {user ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-9 gap-2 rounded-xl px-3 text-muted-foreground hover:bg-background hover:text-foreground"
            onClick={() => void logout()}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t("logout")}</span>
          </Button>
        ) : null}
      </div>
    </header>
  );
}
