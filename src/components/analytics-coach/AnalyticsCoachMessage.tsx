"use client";

import ReactMarkdown from "react-markdown";
import { Bot, User } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export type AnalyticsCoachMessageModel = {
  id: string;
  role: "user" | "assistant";
  content: string;
  loading?: boolean;
};

export function AnalyticsCoachMessage({ message }: { message: AnalyticsCoachMessageModel }) {
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
    <div className="flex gap-3 items-start">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-violet-500/15">
        <Bot className="h-4 w-4 text-violet-600 dark:text-violet-400" />
      </div>
      <Card className="flex-1 rounded-2xl rounded-tl-sm border bg-card p-4">
        <div className="max-w-none text-sm text-foreground [&_a]:text-primary [&_a]:underline [&_li]:my-0.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:pl-5">
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>
      </Card>
    </div>
  );
}
