"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLocale } from "@/lib/locale-context";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";

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

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-6">
      <PageGradientBackdrop />
      <div className="relative w-full max-w-md space-y-6 rounded-xl border border-border bg-card/80 p-8 shadow-lg backdrop-blur-sm">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{t("appName")}</h1>
          <p className="text-sm text-muted-foreground">{t("loginSubtitle")}</p>
        </div>

        {allowRegister && (
          <div className="flex rounded-lg border border-border p-0.5 bg-muted/40">
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "login" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => setMode("login")}
            >
              {t("loginAction")}
            </button>
            <button
              type="button"
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                mode === "register" ? "bg-background shadow-sm" : "text-muted-foreground"
              }`}
              onClick={() => setMode("register")}
            >
              {t("registerAction")}
            </button>
          </div>
        )}

        <form
          className="space-y-4"
          onSubmit={mode === "login" ? submitLogin : submitRegister}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("email")}</label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="h-10"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t("password")}</label>
            <Input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : undefined}
              className="h-10"
            />
          </div>
          {mode === "register" && (
            <div className="space-y-2">
              <label className="text-sm font-medium">{t("displayNameOptional")}</label>
              <Input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="h-10"
              />
            </div>
          )}
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t("loading") : mode === "login" ? t("loginAction") : t("registerAction")}
          </Button>
        </form>

        <p className="text-center text-xs text-muted-foreground">
          <Link href="/" className="text-primary hover:underline">
            {t("backToHome")}
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh] flex items-center justify-center">…</div>}>
      <LoginForm />
    </Suspense>
  );
}
