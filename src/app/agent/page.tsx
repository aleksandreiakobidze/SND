"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatMessage } from "@/components/agent/ChatMessage";
import { ChatInput } from "@/components/agent/ChatInput";
import { SuggestedQueries } from "@/components/agent/SuggestedQueries";
import { PageGradientBackdrop } from "@/components/layout/PageGradientBackdrop";
import { AgentHintsPanel } from "@/components/agent/AgentHintsPanel";
import { SaveToWorkspaceSheet } from "@/components/workspace/SaveToWorkspaceSheet";
import { useLocale } from "@/lib/locale-context";
import { useAuth, useAuthCapabilities } from "@/lib/auth-context";
import type { AgentMessage, AgentResponse } from "@/types";

export default function AgentPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { permissions, loading: authLoading } = useAuth();
  const { canUseAgent } = useAuthCapabilities(permissions);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [lastSuggestions, setLastSuggestions] = useState<string[]>([]);
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
  }, [messages, scrollToBottom]);

  useEffect(() => {
    if (!authLoading && !canUseAgent) router.replace("/");
  }, [authLoading, canUseAgent, router]);

  async function handleSend(question: string) {
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

    setMessages((prev) => [...prev, userMessage, loadingMessage]);
    setIsLoading(true);

    try {
      const conversationHistory = messages
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
        setMessages((prev) =>
          prev.filter((m) => !m.loading).concat(errorMessage)
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

      setMessages((prev) =>
        prev.filter((m) => !m.loading).concat(assistantMessage)
      );
      setLastSuggestions(response.suggestedQuestions || []);
    } catch (err) {
      const errorMessage: AgentMessage = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Failed to connect to the server",
        narrative:
          err instanceof Error ? err.message : "Network error occurred",
        timestamp: new Date(),
      };
      setMessages((prev) =>
        prev.filter((m) => !m.loading).concat(errorMessage)
      );
    } finally {
      setIsLoading(false);
    }
  }

  function handleNewChat() {
    setMessages([]);
    setLastSuggestions([]);
  }

  function promptBeforeAssistant(m: AgentMessage): string | undefined {
    const idx = messages.findIndex((x) => x.id === m.id);
    if (idx <= 0) return undefined;
    for (let i = idx - 1; i >= 0; i--) {
      if (messages[i].role === "user") return messages[i].content;
    }
    return undefined;
  }

  function openSaveToWorkspace(m: AgentMessage) {
    setSaveTarget(m);
    setSaveOpen(true);
  }

  return (
    <div className="relative flex h-[calc(100vh-4rem)] flex-col">
      <PageGradientBackdrop />
      <div className="relative flex items-center justify-between border-b border-border/80 bg-background/75 px-6 py-3 backdrop-blur-sm">
        <div>
          <h1 className="text-lg font-semibold">{t("aiAgent")}</h1>
          <p className="text-xs text-muted-foreground">
            {t("agentHeaderDesc")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleNewChat}
          className="h-8"
        >
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
          {t("newChat")}
        </Button>
      </div>

      {canUseAgent ? <AgentHintsPanel /> : null}

      <div className="flex-1 overflow-hidden">
        <div ref={scrollRef} className="h-full overflow-y-auto">
          <div className="max-w-4xl mx-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-8">
                <div className="text-center space-y-2">
                  <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="h-8 w-8 text-primary"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                    >
                      <path d="M12 2a4 4 0 0 1 4 4v1a1 1 0 0 0 1 1h1a4 4 0 0 1 0 8h-1a1 1 0 0 0-1 1v1a4 4 0 0 1-8 0v-1a1 1 0 0 0-1-1H6a4 4 0 0 1 0-8h1a1 1 0 0 0 1-1V6a4 4 0 0 1 4-4z" />
                    </svg>
                  </div>
                  <h2 className="text-xl font-semibold">
                    {t("aiAgent")}
                  </h2>
                  <p className="text-muted-foreground text-sm max-w-md">
                    {t("agentSubtitle")}
                  </p>
                </div>
                <SuggestedQueries onSelect={handleSend} />
              </div>
            ) : (
              <>
                {messages.map((msg) => (
                  <ChatMessage
                    key={msg.id}
                    message={msg}
                    onSaveToWorkspace={openSaveToWorkspace}
                  />
                ))}
                {!isLoading && lastSuggestions.length > 0 && (
                  <SuggestedQueries
                    suggestions={lastSuggestions}
                    onSelect={handleSend}
                  />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ChatInput onSend={handleSend} disabled={isLoading} />

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
