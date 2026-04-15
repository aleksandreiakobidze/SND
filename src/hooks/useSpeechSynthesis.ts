"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VoiceLang } from "./useSpeechRecognition";

interface UseSpeechSynthesisReturn {
  speaking: boolean;
  supported: boolean;
  speak: (text: string, lang: VoiceLang) => void;
  cancel: () => void;
}

function pickVoice(lang: VoiceLang): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;

  // Exact match first (e.g. "ka-GE"), then language prefix (e.g. "ka")
  const langPrefix = lang.split("-")[0].toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang.toLowerCase()) ??
    voices.find((v) => v.lang.toLowerCase().startsWith(langPrefix)) ??
    null
  );
}

export function useSpeechSynthesis(): UseSpeechSynthesisReturn {
  const [speaking, setSpeaking] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;

  // Trigger voice list load (Chrome requires this)
  useEffect(() => {
    if (!supported) return;
    // Load voices; may fire asynchronously on Chrome
    window.speechSynthesis.getVoices();
    const handler = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.addEventListener("voiceschanged", handler);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", handler);
    };
  }, [supported]);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
    utteranceRef.current = null;
  }, [supported]);

  const speak = useCallback(
    (text: string, lang: VoiceLang) => {
      if (!supported || !text.trim()) return;
      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;

      const voice = pickVoice(lang);
      if (voice) utterance.voice = voice;

      utterance.rate = 1.0;
      utterance.pitch = 1.0;

      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => {
        setSpeaking(false);
        utteranceRef.current = null;
      };
      utterance.onerror = () => {
        setSpeaking(false);
        utteranceRef.current = null;
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported],
  );

  // Cancel on unmount
  useEffect(() => {
    return () => {
      if (supported) window.speechSynthesis.cancel();
    };
  }, [supported]);

  return { speaking, supported, speak, cancel };
}
