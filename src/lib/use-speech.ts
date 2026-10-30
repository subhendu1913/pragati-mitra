"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API wrapper. Only reports supported when the browser really has SpeechRecognition.
export function useSpeechRecognition(lang: "en" | "od") {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recRef = useRef<any>(null);

  useEffect(() => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    setSupported(!!SR);
  }, []);

  const stop = useCallback(() => {
    try {
      recRef.current?.stop();
    } catch {}
    setListening(false);
  }, []);

  const start = useCallback(
    (onText: (text: string, isFinal: boolean) => void) => {
      const w = window as any;
      const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
      if (!SR) {
        setError("unsupported");
        return false;
      }
      setError(null);
      try {
        const rec = new SR();
        rec.lang = lang === "od" ? "od-IN" : "en-IN";
        rec.interimResults = true;
        rec.continuous = false;
        rec.maxAlternatives = 1;
        rec.onresult = (e: any) => {
          let interim = "";
          let final = "";
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript;
            if (e.results[i].isFinal) final += t;
            else interim += t;
          }
          onText((final || interim).trim(), !!final);
        };
        rec.onerror = (e: any) => {
          if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("permission-denied");
          else if (e.error !== "aborted") setError(e.error ?? "error");
          setListening(false);
        };
        rec.onend = () => setListening(false);
        recRef.current = rec;
        rec.start();
        setListening(true);
        return true;
      } catch {
        setError("error");
        return false;
      }
    },
    [lang]
  );

  return { supported, listening, error, start, stop };
}
