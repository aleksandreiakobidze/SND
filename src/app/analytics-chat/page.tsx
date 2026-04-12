"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInput } from "@/components/agent/ChatInput";
import { SuggestedQueries } from "@/components/agent/SuggestedQueries";
import {
  AnalyticsCoachMessage,
  type AnalyticsCoachMessageModel,
} from "@/components/analytics-coach/AnalyticsCoachMessage";
import { PageGradientBackdrop, stickyFilterGlassClass } from "@/components/layout/PageGradientBackdrop";
import { FilterBar } from "@/components/filters/FilterBar";
import { StickyFilterBlock } from "@/components/filters/StickyFilterBlock";
import { useLocale } from "@/lib/locale-context";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import { useFilterOptions } from "@/lib/useFilterOptions";
import { useFilters } from "@/lib/useFilters";
import { cn } from "@/lib/utils";

export default function AnalyticsChatPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { permissions, loading: authLoading } = useAuth();
  const { canViewDashboard } = useAuthCapabilities(permissions);
  const filterOptions = useFilterOptions();
  const { filters, ready, handleFiltersChange } = useFilters();

  const [messages, setMessages] = useState<AnalyticsCoachMessageModel[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!authLoading && !canViewDashboard) router.replace("/");
  }, [authLoading, canViewDashboard, router]);

  const starterSuggestions = [
    t("analyticsCoachSuggested1"),
    t("analyticsCoachSuggested2"),
    t("analyticsCoachSuggested3"),
    t("analyticsCoachSuggested4"),
    t("analyticsCoachSuggested5"),
  ];

  async function handleSend(text: string) {
    const userMessage: AnalyticsCoachMessageModel = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    };
    const loadingMessage: AnalyticsCoachMessageModel = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "",
      loading: true,
    };

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);

    const history = messages
      .filter((m) => !m.loading)
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

    try {
      const res = await fetch("/api/analytics-chat", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: text,
          history: history.slice(-10),
          locale,
          filters: ready ? filters : undefined,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errText =
          typeof json.details === "string"
            ? json.details
            : typeof json.error === "string"
              ? json.error
              : t("error");
        const errMsg: AnalyticsCoachMessageModel = {
          id: `err-${Date.now()}`,
          role: "assistant",
          content: `**${t("error")}**\n\n${errText}`,
        };
        setMessages((prev) => prev.filter((m) => !m.loading).concat(errMsg));
        setLastSuggestions([]);
        return;
      }

      const assistantMessage: AnalyticsCoachMessageModel = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: typeof json.reply === "string" ? json.reply : "",
      };

      setMessages((prev) =>
        prev.filter((m) => !m.loading).concat(assistantMessage),
      );
      setLastSuggestions(
        Array.isArray(json.suggestions) ? json.suggestions.filter((s: unknown) => typeof s === "string") : [],
      );
    } catch {
      const errMsg: AnalyticsCoachMessageModel = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `**${t("error")}**\n\n${t("analyticsCoachNetworkError")}`,
      };
      setMessages((prev) => prev.filter((m) => !m.loading).concat(errMsg));
      setLastSuggestions([]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setLastSuggestions([]);
  }

  if (!canViewDashboard && !authLoading) {
    return null;
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col">
      <PageGradientBackdrop />

      <div className="relative border-b border-border/80 bg-background/75 px-6 py-3 backdrop-blur-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold">
              <Sparkles className="h-5 w-5 text-violet-600 dark:text-violet-400" />
              {t("sndAnalyticsCoach")}
            </h1>
            <p className="text-xs text-muted-foreground">{t("sndAnalyticsCoachDesc")}</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 shrink-0" onClick={handleNewChat}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            {t("newChat")}
          </Button>
        </div>
      </div>

      <StickyFilterBlock className={cn(stickyFilterGlassClass, "border-b py-3")}>
        <p className="text-xs text-muted-foreground">{t("analyticsCoachContextHint")}</p>
        <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
      </StickyFilterBlock>

      <div className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-6 p-6">
            {messages.length === 0 ? (
              <div className="flex min-h-[40vh] flex-col items-center justify-center space-y-8">
                <div className="space-y-2 text-center">
                  <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-violet-500/10">
                    <Sparkles className="h-8 w-8 text-violet-600 dark:text-violet-400" />
                  </div>
                  <h2 className="text-xl font-semibold">{t("sndAnalyticsCoach")}</h2>
                  <p className="mx-auto max-w-lg text-sm text-muted-foreground">
                    {t("analyticsCoachWelcome")}
                  </p>
                </div>
                <SuggestedQueries
                  suggestions={starterSuggestions}
                  onSelect={handleSend}
                  headingKey="coachSuggestedTitle"
                />
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <AnalyticsCoachMessage key={msg.id} message={msg} />
                ))}
                {!isLoading && lastSuggestions.length > 0 && (
                  <SuggestedQueries
                    suggestions={lastSuggestions}
                    onSelect={handleSend}
                    headingKey="coachSuggestedTitle"
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ChatInput
        onSend={handleSend}
        disabled={isLoading || !ready}
        placeholderKey="analyticsCoachPlaceholder"
      />
    </div>
  );
}
