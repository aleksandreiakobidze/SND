"use client";

import { Suspense, useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/agent/ChatMessage";
import { ChatInput } from "@/components/agent/ChatInput";
import { SuggestedQueries } from "@/components/agent/SuggestedQueries";
import { AgentModeSwitcher, type AgentPageMode } from "@/components/agent/AgentModeSwitcher";
import { PageGradientBackdrop, stickyFilterGlassClass } from "@/components/layout/PageGradientBackdrop";
import { AgentHintsPanel } from "@/components/agent/AgentHintsPanel";
import { SaveToWorkspaceSheet } from "@/components/workspace/SaveToWorkspaceSheet";
import {
  AnalyticsCoachMessage,
  type AnalyticsCoachMessageModel,
} from "@/components/analytics-coach/AnalyticsCoachMessage";
import { FilterBar } from "@/components/filters/FilterBar";
import { StickyFilterBlock } from "@/components/filters/StickyFilterBlock";
import { useLocale } from "@/lib/locale-context";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import { useFilterOptions } from "@/lib/useFilterOptions";
import { useFilters } from "@/lib/useFilters";
import type { AgentMessage, AgentResponse } from "@/types";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";

function AgentPageFallback() {
  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col">
      <PageGradientBackdrop />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
        <Skeleton className="h-8 w-56 rounded-md" />
        <Skeleton className="h-32 w-full max-w-2xl rounded-lg" />
      </div>
    </div>
  );
}

function AgentPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const { permissions, loading: authLoading } = useAuth();
  const { canUseAgent, canViewDashboard } = useAuthCapabilities(permissions);

  const canAccessPage = canUseAgent || canViewDashboard;
  const showModeSwitcher = canUseAgent && canViewDashboard;

  const urlMode: AgentPageMode =
    searchParams.get("mode") === "ask" ? "ask" : "agent";
  const mode: AgentPageMode = useMemo(() => {
    if (!canUseAgent && canViewDashboard) return "ask";
    if (canUseAgent && !canViewDashboard) return "agent";
    return urlMode;
  }, [canUseAgent, canViewDashboard, urlMode]);

  const setMode = useCallback(
    (next: AgentPageMode) => {
      router.replace(next === "ask" ? "/agent?mode=ask" : "/agent");
    },
    [router],
  );

  const filterOptions = useFilterOptions();
  const { filters, ready, handleFiltersChange } = useFilters();

  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);
  const [agentSuggestions, setAgentSuggestions] = useState<string[]>([]);
  const [agentLoading, setAgentLoading] = useState(false);

  const [coachMessages, setCoachMessages] = useState<AnalyticsCoachMessageModel[]>([]);
  const [coachSuggestions, setCoachSuggestions] = useState<string[]>([]);
  const [coachLoading, setCoachLoading] = useState(false);

  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState<AgentMessage | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [agentMessages, coachMessages, mode, scrollToBottom]);

  useEffect(() => {
    if (!authLoading && !canAccessPage) router.replace("/");
  }, [authLoading, canAccessPage, router]);

  async function handleSendAgent(question: string) {
    const userMessage: AgentMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: question,
      timestamp: new Date(),
    };

    const loadingMessage: AgentMessage = {
      id: `loading-${Date.now()}`,
      role: "assistant",
      content: "",
      timestamp: new Date(),
      loading: true,
    };

    setAgentMessages((prev) => [...prev, userMessage, loadingMessage]);
    setAgentLoading(true);

    try {
      const conversationHistory = agentMessages
        .filter((m) => !m.loading)
        .map((m) => ({
          role: m.role as "user" | "assistant",
          content:
            m.role === "user"
              ? m.content
              : m.narrative || m.content || "",
        }));

      const res = await fetch("/api/agent", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          history: conversationHistory.slice(-10),
          locale,
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        const errorMessage: AgentMessage = {
          id: `error-${Date.now()}`,
          role: "assistant",
          content: json.error || "Something went wrong",
          narrative: json.details
            ? `Error: ${json.details}${json.sql ? `\n\nGenerated SQL: ${json.sql}` : ""}`
            : json.error,
          timestamp: new Date(),
        };
        setAgentMessages((prev) =>
          prev.filter((m) => !m.loading).concat(errorMessage),
        );
        return;
      }

      const response = json as AgentResponse;

      const assistantMessage: AgentMessage = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: response.narrative,
        sql: response.sql,
        data: response.data,
        chartConfig: response.chartConfig,
        narrative: response.narrative,
        timestamp: new Date(),
      };

      setAgentMessages((prev) =>
        prev.filter((m) => !m.loading).concat(assistantMessage),
      );
      setAgentSuggestions(response.suggestedQuestions || []);
    } catch (err) {
      const errorMessage: AgentMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Failed to connect to the server",
        narrative:
          err instanceof Error ? err.message : "Network error occurred",
        timestamp: new Date(),
      };
      setAgentMessages((prev) =>
        prev.filter((m) => !m.loading).concat(errorMessage),
      );
    } finally {
      setAgentLoading(false);
    }
  }

  async function handleSendCoach(text: string) {
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

    setCoachMessages((prev) => [...prev, userMessage, loadingMessage]);
    setCoachLoading(true);

    const history = coachMessages
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
        setCoachMessages((prev) => prev.filter((m) => !m.loading).concat(errMsg));
        setCoachSuggestions([]);
        return;
      }

      const assistantMessage: AnalyticsCoachMessageModel = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: typeof json.reply === "string" ? json.reply : "",
      };

      setCoachMessages((prev) =>
        prev.filter((m) => !m.loading).concat(assistantMessage),
      );
      setCoachSuggestions(
        Array.isArray(json.suggestions)
          ? json.suggestions.filter((s: unknown) => typeof s === "string")
          : [],
      );
    } catch {
      const errMsg: AnalyticsCoachMessageModel = {
        id: `err-${Date.now()}`,
        role: "assistant",
        content: `**${t("error")}**\n\n${t("analyticsCoachNetworkError")}`,
      };
      setCoachMessages((prev) => prev.filter((m) => !m.loading).concat(errMsg));
      setCoachSuggestions([]);
    } finally {
      setCoachLoading(false);
    }
  }

  function handleNewChat() {
    if (mode === "agent") {
      setAgentMessages([]);
      setAgentSuggestions([]);
    } else {
      setCoachMessages([]);
      setCoachSuggestions([]);
    }
  }

  function promptBeforeAssistant(m: AgentMessage): string | undefined {
    const idx = agentMessages.findIndex((x) => x.id === m.id);
    if (idx <= 0) return undefined;
    for (let i = idx - 1; i >= 0; i--) {
      if (agentMessages[i].role === "user") return agentMessages[i].content;
    }
    return undefined;
  }

  function openSaveToWorkspace(m: AgentMessage) {
    setSaveTarget(m);
    setSaveOpen(true);
  }

  const starterCoachSuggestions = [
    t("analyticsCoachSuggested1"),
    t("analyticsCoachSuggested2"),
    t("analyticsCoachSuggested3"),
    t("analyticsCoachSuggested4"),
    t("analyticsCoachSuggested5"),
  ];

  const title =
    mode === "ask" ? t("sndAnalyticsCoach") : t("aiAgent");
  const subtitle =
    mode === "ask" ? t("sndAnalyticsCoachDesc") : t("agentHeaderDesc");

  if (!canAccessPage && !authLoading) {
    return null;
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col">
      <PageGradientBackdrop />
      <div className="relative flex flex-col gap-4 border-b border-border/50 bg-background/80 px-5 py-4 backdrop-blur-xl supports-[backdrop-filter]:bg-background/65 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
          {showModeSwitcher ? (
            <AgentModeSwitcher mode={mode} onChange={setMode} className="shrink-0" />
          ) : null}
          <div className="min-w-0">
            <h1 className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
              {mode === "ask" ? (
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500/20 to-chart-4/15 text-violet-600 dark:text-violet-400">
                  <Sparkles className="h-5 w-5 shrink-0" />
                </span>
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                  <Bot className="h-5 w-5 shrink-0" />
                </span>
              )}
              <span>{title}</span>
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              {subtitle}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="h-9 shrink-0 self-start rounded-xl border-border/70 sm:self-center"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {t("newChat")}
        </Button>
      </div>

      {mode === "agent" && canUseAgent ? <AgentHintsPanel /> : null}

      {mode === "ask" && canViewDashboard ? (
        <StickyFilterBlock className={cn(stickyFilterGlassClass, "border-b py-4")}>
          <p className="text-xs font-medium leading-relaxed text-muted-foreground">
            {t("analyticsCoachContextHint")}
          </p>
          <FilterBar filters={filters} onFiltersChange={handleFiltersChange} options={filterOptions} />
        </StickyFilterBlock>
      ) : null}

      <div className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="mx-auto max-w-4xl space-y-6 p-6 pb-8">
            {mode === "agent" ? (
              <>
                {agentMessages.length === 0 ? (
                  <div className="flex min-h-[50vh] flex-col items-center justify-center space-y-8">
                    <div className="space-y-3 text-center">
                      <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-primary/15 to-chart-2/10 shadow-inner ring-1 ring-primary/10">
                        <svg
                          className="h-9 w-9 text-primary"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        >
                          <path d="M12 2a4 4 0 0 1 4 4v1a1 1 0 0 0 1 1h1a4 4 0 0 1 0 8h-1a1 1 0 0 0-1 1v1a4 4 0 0 1-8 0v-1a1 1 0 0 0-1-1H6a4 4 0 0 1 0-8h1a1 1 0 0 0 1-1V6a4 4 0 0 1 4-4z" />
                        </svg>
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight">{t("aiAgent")}</h2>
                      <p className="mx-auto max-w-md text-sm leading-relaxed text-muted-foreground">
                        {t("agentSubtitle")}
                      </p>
                    </div>
                    <SuggestedQueries onSelect={handleSendAgent} />
                  </div>
                ) : (
                  <>
                    {agentMessages.map((msg) => (
                      <ChatMessage
                        key={msg.id}
                        message={msg}
                        onSaveToWorkspace={openSaveToWorkspace}
                      />
                    ))}
                    {!agentLoading && agentSuggestions.length > 0 && (
                      <SuggestedQueries
                        suggestions={agentSuggestions}
                        onSelect={handleSendAgent}
                      />
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                {coachMessages.length === 0 ? (
                  <div className="flex min-h-[40vh] flex-col items-center justify-center space-y-8">
                    <div className="space-y-3 text-center">
                      <div className="mx-auto mb-2 flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 to-chart-4/10 shadow-inner ring-1 ring-violet-500/20">
                        <Sparkles className="h-9 w-9 text-violet-600 dark:text-violet-400" />
                      </div>
                      <h2 className="text-2xl font-semibold tracking-tight">{t("sndAnalyticsCoach")}</h2>
                      <p className="mx-auto max-w-lg text-sm leading-relaxed text-muted-foreground">
                        {t("analyticsCoachWelcome")}
                      </p>
                    </div>
                    <SuggestedQueries
                      suggestions={starterCoachSuggestions}
                      onSelect={handleSendCoach}
                      headingKey="coachSuggestedTitle"
                    />
                  </div>
                ) : (
                  <>
                    {coachMessages.map((msg) => (
                      <AnalyticsCoachMessage key={msg.id} message={msg} />
                    ))}
                    {!coachLoading && coachSuggestions.length > 0 && (
                      <SuggestedQueries
                        suggestions={coachSuggestions}
                        onSelect={handleSendCoach}
                        headingKey="coachSuggestedTitle"
                      />
                    )}
                  </>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {mode === "agent" ? (
        <ChatInput onSend={handleSendAgent} disabled={agentLoading} />
      ) : (
        <ChatInput
          onSend={handleSendCoach}
          disabled={coachLoading || !ready}
          placeholderKey="analyticsCoachPlaceholder"
        />
      )}

      <SaveToWorkspaceSheet
        open={saveOpen}
        onOpenChange={(open) => {
          setSaveOpen(open);
          if (!open) setSaveTarget(null);
        }}
        payload={{
          title:
            saveTarget?.chartConfig?.title?.trim() ||
            (saveTarget?.narrative?.trim().slice(0, 120) ?? "") ||
            t("workspaceReportSaved"),
          prompt: saveTarget ? promptBeforeAssistant(saveTarget) : undefined,
          sql: saveTarget?.sql,
          chartConfig: saveTarget?.chartConfig ?? null,
          narrative: saveTarget?.narrative,
        }}
      />
    </div>
  );
}

export default function AgentPage() {
  return (
    <Suspense fallback={<AgentPageFallback />}>
      <AgentPageContent />
    </Suspense>
  );
}
