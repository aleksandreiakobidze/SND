"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import type { TranslationKey } from "@/lib/i18n";

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  /** Overrides default placeholder */
  placeholderKey?: TranslationKey;
}

export function ChatInput({ onSend, disabled, placeholderKey }: ChatInputProps) {
  const { t } = useLocale();
  const ph = placeholderKey ? t(placeholderKey) : t("askAnything");
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input]);

  function handleSubmit() {
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  return (
    <div className="border-t border-border/60 bg-background/95 p-4 pb-5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-4xl items-end gap-3">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSubmit();
              }
            }}
            placeholder={ph}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-2xl border border-border/80 bg-muted/40 px-4 py-3.5 pr-12 text-sm shadow-inner transition-colors placeholder:text-muted-foreground focus:border-primary/40 focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:bg-muted/25"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={disabled || !input.trim()}
          size="icon"
          className="h-12 w-12 shrink-0 rounded-2xl shadow-md shadow-primary/15"
        >
          {disabled ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
