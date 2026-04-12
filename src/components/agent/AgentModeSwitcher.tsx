"use client";

import { ChevronDown, Infinity, MessageCircle } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLocale } from "@/lib/locale-context";
import { cn } from "@/lib/utils";

export type AgentPageMode = "agent" | "ask";

type Props = {
  mode: AgentPageMode;
  onChange: (mode: AgentPageMode) => void;
  className?: string;
};

export function AgentModeSwitcher({ mode, onChange, className }: Props) {
  const { t } = useLocale();
  const Icon = mode === "agent" ? Infinity : MessageCircle;
  const label = mode === "agent" ? t("agentModeAgent") : t("agentModeAsk");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "inline-flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-muted/40 px-3.5 text-sm font-semibold shadow-inner outline-none transition-colors hover:bg-muted/65 focus-visible:ring-2 focus-visible:ring-ring dark:bg-muted/25",
          className,
        )}
      >
        <Icon className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
        <span>{label}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuRadioGroup
          value={mode}
          onValueChange={(v) => onChange(v as AgentPageMode)}
        >
          <DropdownMenuRadioItem value="agent" className="gap-2 py-2">
            <Infinity className="h-4 w-4" />
            <span>{t("agentModeAgent")}</span>
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="ask" className="gap-2 py-2">
            <MessageCircle className="h-4 w-4" />
            <span>{t("agentModeAsk")}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
