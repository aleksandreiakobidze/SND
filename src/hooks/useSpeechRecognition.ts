"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type VoiceLang = "en-US" | "ka-GE";

// Web Speech API type declarations (not in all TS lib.dom versions)
interface SpeechRecognitionResultItem {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionResultEntry {
  readonly isFinal: boolean;
  readonly length: number;
  item(index: number): SpeechRecognitionResultItem;
  [index: number]: SpeechRecognitionResultItem;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResultEntry;
  [index: number]: SpeechRecognitionResultEntry;
}

interface SpeechRecognitionEventData extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorData extends Event {
  readonly error: string;
  readonly message: string;
}

interface ISpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onend: ((this: ISpeechRecognition, ev: Event) => void) | null;
  onresult: ((this: ISpeechRecognition, ev: SpeechRecognitionEventData) => void) | null;
  onerror: ((this: ISpeechRecognition, ev: SpeechRecognitionErrorData) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition?: ISpeechRecognitionConstructor;
    webkitSpeechRecognition?: ISpeechRecognitionConstructor;
  }
}

interface UseSpeechRecognitionReturn {
  transcript: string;
  interimTranscript: string;
  listening: boolean;
  supported: boolean;
  error: string | null;
  /** Text produced by a completed recognition session (set once on end). */
  completedText: string | null;
  start: (lang: VoiceLang) => void;
  stop: () => void;
  clearTranscript: () => void;
  /** Acknowledge the completedText so it resets to null. */
  clearCompleted: () => void;
}

export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);
  const [completedText, setCompletedText] = useState<string | null>(null);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const accumulatedRef = useRef("");

  useEffect(() => {
    setSupported(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window,
    );
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterimTranscript("");
  }, []);

  const start = useCallback(
    (lang: VoiceLang) => {
      if (!supported) return;
      recognitionRef.current?.abort();

      const SpeechRecognitionImpl =
        window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!SpeechRecognitionImpl) return;

      const recognition = new SpeechRecognitionImpl();
      recognition.lang = lang;
      recognition.interimResults = true;
      recognition.continuous = false;
      recognition.maxAlternatives = 1;

      accumulatedRef.current = "";

      recognition.onstart = () => {
        setListening(true);
        setError(null);
        setTranscript("");
        setInterimTranscript("");
        setCompletedText(null);
        accumulatedRef.current = "";
      };

      recognition.onresult = (event: SpeechRecognitionEventData) => {
        let interim = "";
        let final = "";
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            final += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        if (final) {
          accumulatedRef.current += final;
          setTranscript(accumulatedRef.current);
        }
        setInterimTranscript(interim);
      };

      recognition.onerror = (event: SpeechRecognitionErrorData) => {
        if (event.error !== "aborted") {
          setError(event.error);
        }
        setListening(false);
        setInterimTranscript("");
      };

      recognition.onend = () => {
        const text = accumulatedRef.current.trim();
        setListening(false);
        setInterimTranscript("");
        if (text) setCompletedText(text);
        recognitionRef.current = null;
      };

      recognitionRef.current = recognition;
      recognition.start();
    },
    [supported],
  );

  const clearTranscript = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const clearCompleted = useCallback(() => {
    setCompletedText(null);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
    };
  }, []);

  return {
    transcript,
    interimTranscript,
    listening,
    supported,
    error,
    completedText,
    start,
    stop,
    clearTranscript,
    clearCompleted,
  };
}
