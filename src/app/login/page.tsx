"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BarChart3, Bot, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/locale-context";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { cn } from "@/lib/utils";

function LoginForm() {
  const { t } = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [allowRegister, setAllowRegister] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/auth/register");
        const json = (await res.json()) as { allowRegister?: boolean };
        setAllowRegister(Boolean(json.allowRegister));
      } catch {
        setAllowRegister(false);
      }
    })();
  }, []);

  async function submitLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      let json: { error?: string; details?: string };
      try {
        json = (await res.json()) as { error?: string; details?: string };
      } catch {
        setError(`${t("loginFailed")} (HTTP ${res.status})`);
        return;
      }
      if (!res.ok) {
        const parts = [json.error, json.details].filter(
          (x): x is string => typeof x === "string" && x.length > 0,
        );
        setError(parts.length ? parts.join(" — ") : t("loginFailed"));
        return;
      }
      router.push(from.startsWith("/login") ? "/" : from);
      router.refresh();
    } catch {
      setError(t("loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  async function submitRegister(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email,
          password,
          displayName: displayName.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : t("registerFailed"));
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError(t("registerFailed"));
    } finally {
      setLoading(false);
    }
  }

  const features = [
    { icon: BarChart3, label: t("dashboard") },
    { icon: Sparkles, label: t("sndAnalyticsCoach") },
    { icon: Bot, label: t("aiAgent") },
    { icon: TrendingUp, label: t("reports") },
  ];

  return (
    <div className="relative grid min-h-full lg:min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] xl:grid-cols-[minmax(0,1.1fr)_minmax(0,28rem)]">
      <PageGradientBackdrop className="h-full lg:h-screen" />
      <div className="relative hidden flex-col justify-between overflow-hidden border-border/50 bg-gradient-to-br from-primary/[0.12] via-background to-chart-2/[0.08] px-10 py-12 lg:flex xl:px-14">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_20%_-10%,oklch(0.55_0.2_265/0.25),transparent)]" />
        <div className="relative space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">{t("appName")}</p>
          <h2 className="max-w-md text-3xl font-semibold leading-tight tracking-tight text-foreground xl:text-4xl">
            {t("loginSubtitle")}
          </h2>
        </div>
        <ul className="relative mt-12 grid gap-3 sm:grid-cols-2">
          {features.map(({ icon: Icon, label }) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/60 px-4 py-3 text-sm font-medium text-foreground shadow-sm backdrop-blur-md dark:bg-card/40"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="relative flex min-h-[calc(100vh-0px)] flex-col items-center justify-center p-6 sm:p-10">
        <div
          className={cn(
            "w-full max-w-md space-y-8 rounded-3xl border border-border/60 bg-card/90 p-8 shadow-2xl shadow-black/10 backdrop-blur-xl",
            "dark:bg-card/80 dark:shadow-black/40",
          )}
        >
          <div className="space-y-2 text-center lg:text-left">
            <h1 className="text-2xl font-semibold tracking-tight">{t("appName")}</h1>
            <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
          </div>

          {allowRegister && (
            <div className="flex rounded-2xl border border-border/70 bg-muted/40 p-1 dark:bg-muted/20">
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  mode === "login"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("login")}
              >
                {t("loginAction")}
              </button>
              <button
                type="button"
                className={cn(
                  "flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all",
                  mode === "register"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => setMode("register")}
              >
                {t("registerAction")}
              </button>
            </div>
          )}

          <form className="space-y-5" onSubmit={mode === "login" ? submitLogin : submitRegister}>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("email")}
              </label>
              <Input
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11 rounded-xl border-border/80 bg-muted/30 shadow-inner dark:bg-muted/20"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("password")}
              </label>
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : undefined}
                className="h-11 rounded-xl border-border/80 bg-muted/30 shadow-inner dark:bg-muted/20"
              />
            </div>
            {mode === "register" && (
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("displayNameOptional")}
                </label>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-11 rounded-xl border-border/80 bg-muted/30 shadow-inner dark:bg-muted/20"
                />
              </div>
            )}
            {error ? <p className="text-sm font-medium text-destructive">{error}</p> : null}
            <Button type="submit" className="h-11 w-full rounded-xl text-base font-semibold shadow-lg shadow-primary/20" disabled={loading}>
              {loading ? t("loading") : mode === "login" ? t("loginAction") : t("registerAction")}
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            <Link href="/" className="font-medium text-primary underline-offset-4 hover:underline">
              {t("backToHome")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center text-muted-foreground">…</div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
