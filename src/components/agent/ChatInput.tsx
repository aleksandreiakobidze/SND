"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Loader2, Mic, MicOff, Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/lib/locale-context";
import { useSpeechRecognition, type VoiceLang } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";
import type { TranslationKey } from "@/lib/i18n";

const VOICE_AUTO_SEND_DELAY_MS = 3000;

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
  const [voiceLang, setVoiceLang] = useState<VoiceLang>("en-US");
  const [countdown, setCountdown] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef(input);
  const autoSendTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    transcript, interimTranscript, listening,
    supported: sttSupported, completedText,
    start, stop, clearTranscript, clearCompleted,
  } = useSpeechRecognition();

  useEffect(() => { inputRef.current = input; }, [input]);

  const cancelAutoSend = useCallback(() => {
    if (autoSendTimerRef.current) {
      clearTimeout(autoSendTimerRef.current);
      autoSendTimerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  // Sync live transcript into textarea while speaking
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
      clearTranscript();
    }
  }, [transcript, clearTranscript]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [input, interimTranscript]);

  // When recognition finishes with text, populate input and start 3s auto-send
  useEffect(() => {
    if (!completedText) return;
    const text = completedText;
    clearCompleted();
    setInput(text);

    let remaining = VOICE_AUTO_SEND_DELAY_MS / 1000;
    setCountdown(remaining);
    countdownIntervalRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdown(remaining);
      } else if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }, 1000);
    autoSendTimerRef.current = setTimeout(() => {
      const current = inputRef.current.trim();
      if (current && !disabled) {
        onSend(current);
        setInput("");
        clearTranscript();
        if (textareaRef.current) textareaRef.current.style.height = "auto";
      }
      cancelAutoSend();
    }, VOICE_AUTO_SEND_DELAY_MS);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completedText]);

  useEffect(() => () => cancelAutoSend(), [cancelAutoSend]);

  function handleSubmit() {
    cancelAutoSend();
    const trimmed = input.trim();
    if (!trimmed || disabled) return;
    if (listening) stop();
    onSend(trimmed);
    setInput("");
    clearTranscript();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }

  function handleMicClick() {
    if (listening) {
      stop();
    } else {
      cancelAutoSend();
      start(voiceLang);
    }
  }

  const displayValue = listening && interimTranscript
    ? input + interimTranscript
    : input;

  return (
    <div className="border-t border-border/60 bg-background/95 p-4 pb-5 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex max-w-4xl flex-col gap-2">
        {/* Language + mic row */}
        {sttSupported && (
          <div className="flex items-center gap-2 px-1">
            {/* EN / KA toggle */}
            <div className="inline-flex items-center rounded-lg border border-border/40 bg-muted/20 p-0.5">
              {(["en-US", "ka-GE"] as VoiceLang[]).map((lang) => (
                <button
                  key={lang}
                  type="button"
                  className={cn(
                    "rounded-md px-2.5 py-0.5 text-[11px] font-medium transition-all",
                    voiceLang === lang
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                  onClick={() => setVoiceLang(lang)}
                >
                  {lang === "en-US" ? "EN" : "KA"}
                </button>
              ))}
            </div>

            {/* Listening indicator */}
            {listening && (
              <span className="flex items-center gap-1.5 text-[11px] text-red-500 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-red-500 inline-block" />
                {t("voiceListen")}
              </span>
            )}

            {/* Auto-send countdown badge */}
            {countdown !== null && (
              <span className="flex items-center gap-1.5 rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                Sending in {countdown}s
                <button
                  type="button"
                  onClick={cancelAutoSend}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-amber-500/20 transition-colors"
                  title="Cancel auto-send"
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              </span>
            )}
          </div>
        )}

        {/* Input row */}
        <div className="flex items-end gap-3">
          <div className="relative flex-1">
            <textarea
              ref={textareaRef}
              value={displayValue}
              onChange={(e) => {
                setInput(e.target.value);
                cancelAutoSend();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder={listening ? t("voiceListen") : ph}
              disabled={disabled}
              rows={1}
              className={cn(
                "w-full resize-none rounded-2xl border bg-muted/40 px-4 py-3.5 pr-12 text-sm shadow-inner transition-colors placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-50 dark:bg-muted/25",
                listening
                  ? "border-red-500/50 focus:border-red-500/60 focus:ring-red-500/20"
                  : "border-border/80 focus:border-primary/40",
              )}
            />
          </div>

          {/* Mic button */}
          {sttSupported && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleMicClick}
              disabled={disabled}
              className={cn(
                "h-12 w-12 shrink-0 rounded-2xl transition-all",
                listening
                  ? "border-red-500/60 bg-red-500/10 text-red-500 animate-pulse hover:bg-red-500/20"
                  : "text-muted-foreground hover:text-foreground",
              )}
              title={listening ? t("voiceStop") : t("voiceSpeak")}
            >
              {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}

          {/* Send button */}
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
    </div>
  );
}
