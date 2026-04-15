"use client";

import ReactMarkdown from "react-markdown";
import { Bot, User, Volume2, VolumeX } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useSpeechSynthesis } from "@/hooks/useSpeechSynthesis";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";
import type { VoiceLang } from "@/hooks/useSpeechRecognition";

export type AnalyticsCoachMessageModel = {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
};

interface Props {
  message: AnalyticsCoachMessageModel;
  voiceLang?: VoiceLang;
}

export function AnalyticsCoachMessage({ message, voiceLang = "en-US" }: Props) {
  const { t } = useLocale();
  const { speak, cancel, speaking, supported: ttsSupported } = useSpeechSynthesis();

  if (message.loading) {
    return (
      <div className="flex gap-3 items-start">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
          <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
        </div>
        <div className="flex-1 space-y-3 pt-1">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  if (message.role === "user") {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="max-w-[80%]">
          <Card className="rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-primary-foreground">
            <p className="text-sm">{message.content}</p>
          </Card>
        </div>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
          <User className="h-4 w-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-3 items-start group/coach">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
        <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </div>
      <Card className="flex-1 rounded-2xl rounded-tl-sm border bg-card p-4 relative">
        <div className="max-w-none text-sm text-foreground [&_a]:text-primary [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
        {ttsSupported && (
          <button
            type="button"
            onClick={() => speaking ? cancel() : speak(message.content, voiceLang)}
            className={cn(
              "absolute top-3 right-3 p-1 rounded-lg transition-all opacity-0 group-hover/coach:opacity-100",
              speaking
                ? "text-violet-600 dark:text-violet-400 bg-violet-500/10 opacity-100"
                : "text-muted-foreground hover:text-foreground hover:bg-muted",
            )}
            title={speaking ? t("voiceStop") : t("voiceSpeak")}
          >
            {speaking
              ? <VolumeX className="h-3.5 w-3.5" />
              : <Volume2 className="h-3.5 w-3.5" />
            }
          </button>
        )}
      </Card>
    </div>
  );
}
