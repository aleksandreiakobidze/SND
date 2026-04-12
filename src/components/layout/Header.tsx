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

  return (
    <header className="sticky top-0 z-30 h-16 border-b border-border bg-background/80 backdrop-blur-md flex items-center justify-between px-6">
      <div className="min-w-0 flex-1 text-left text-xs text-muted-foreground truncate pr-2">
        {user ? (
          <span>
            {t("loggedInAs")}{" "}
            <span className="font-medium text-foreground">
              {user.displayName?.trim() || user.email}
            </span>
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-9 w-9 text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Languages className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem
              onClick={() => setLocale("en")}
              className={locale === "en" ? "bg-accent" : ""}
            >
              EN - English
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setLocale("ka")}
              className={locale === "ka" ? "bg-accent" : ""}
            >
              KA - ქართული
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {mounted ? (
            resolvedTheme === "dark" ? (
              <Moon className="h-4 w-4" />
            ) : (
              <Sun className="h-4 w-4" />
            )
          ) : (
            <Sun className="h-4 w-4" />
          )}
        </Button>

        {user ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
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
