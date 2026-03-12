"use client";

import { useState, useRef, useCallback, useEffect } from "react";

// ─── TTS: Finnish text-to-speech ───

function getGoogleTTSUrl(text: string, slow = false): string {
  const speed = slow ? 0.24 : 1;
  return `https://translate.google.com/translate_tts?ie=UTF-8&tl=fi&client=tw-ob&q=${encodeURIComponent(text)}&ttsspeed=${speed}`;
}

export function extractFinnishPhrases(text: string): string[] {
  const matches: string[] = [];
  const regex = /\*\*([^*]+)\*\*/g;
  let m;
  while ((m = regex.exec(text)) !== null) matches.push(m[1]);
  return matches;
}

export function useFinishTTS() {
  const [speaking, setSpeaking] = useState(false);
  const [currentPhrase, setCurrentPhrase] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const cancelledRef = useRef(false);
  const resolveRef = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    cancelledRef.current = true;

    // Stop any playing audio element
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current.src = "";
      audioRef.current = null;
    }

    // Stop browser speech synthesis
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // Resolve any pending promise so the loop exits
    if (resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }

    setSpeaking(false);
    setCurrentPhrase(null);
  }, []);

  const playGoogleTTS = useCallback(
    (text: string, slow: boolean): Promise<void> => {
      return new Promise((resolve) => {
        if (cancelledRef.current) { resolve(); return; }

        resolveRef.current = resolve;
        const audio = new Audio(getGoogleTTSUrl(text, slow));
        audioRef.current = audio;

        audio.onended = () => {
          audioRef.current = null;
          resolveRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          audioRef.current = null;
          resolveRef.current = null;
          resolve();
        };
        audio.play().catch(() => {
          resolveRef.current = null;
          resolve();
        });
      });
    },
    []
  );

  const speakOne = useCallback((text: string, slow = true): Promise<void> => {
    return new Promise((resolve) => {
      if (cancelledRef.current) { resolve(); return; }

      setCurrentPhrase(text);
      resolveRef.current = resolve;

      // Try browser synthesis first (better quality if Finnish voice exists)
      const voices = window.speechSynthesis?.getVoices() || [];
      const finnishVoice = voices.find((v) => v.lang.startsWith("fi"));

      if (finnishVoice && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = finnishVoice;
        utterance.lang = "fi-FI";
        utterance.rate = slow ? 0.7 : 0.9;
        utterance.onend = () => {
          resolveRef.current = null;
          resolve();
        };
        utterance.onerror = () => {
          // Fall back to Google TTS
          resolveRef.current = null;
          playGoogleTTS(text, slow).then(resolve);
        };
        window.speechSynthesis.speak(utterance);
      } else {
        resolveRef.current = null;
        playGoogleTTS(text, slow).then(resolve);
      }
    });
  }, [playGoogleTTS]);

  const speakPhrases = useCallback(
    async (phrases: string[]) => {
      if (phrases.length === 0) return;

      // If already speaking, stop first
      if (speaking) {
        stop();
        // Small delay to let cleanup happen
        await new Promise((r) => setTimeout(r, 100));
      }

      cancelledRef.current = false;
      setSpeaking(true);

      for (const phrase of phrases) {
        if (cancelledRef.current) break;
        await speakOne(phrase, true);
        // Small pause between phrases
        if (!cancelledRef.current) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      if (!cancelledRef.current) {
        setSpeaking(false);
        setCurrentPhrase(null);
      }
    },
    [speakOne, speaking, stop]
  );

  const speakFinnishFromMessage = useCallback(
    (messageText: string) => {
      const phrases = extractFinnishPhrases(messageText);
      if (phrases.length > 0) speakPhrases(phrases);
    },
    [speakPhrases]
  );

  const speakFullMessage = useCallback(
    (messageText: string) => {
      const cleaned = messageText.replace(/\*\*([^*]+)\*\*/g, "$1");
      const sentences = cleaned
        .split(/(?<=[.!?])\s+/)
        .filter((s) => s.trim().length > 0);
      speakPhrases(sentences);
    },
    [speakPhrases]
  );

  // Load voices on mount
  useEffect(() => {
    window.speechSynthesis?.getVoices();
    const h = () => window.speechSynthesis?.getVoices();
    window.speechSynthesis?.addEventListener("voiceschanged", h);
    return () => {
      window.speechSynthesis?.removeEventListener("voiceschanged", h);
      stop();
    };
  }, [stop]);

  return {
    speaking,
    currentPhrase,
    speakOne,
    speakFinnishFromMessage,
    speakFullMessage,
    stop,
  };
}

// ─── STT: Speech recognition ───

interface UseSpeechRecognitionOptions {
  onResult: (transcript: string) => void;
  lang?: string;
}

export function useSpeechRecognition({
  onResult,
  lang = "fi-FI",
}: UseSpeechRecognitionOptions) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [supported, setSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    const SR =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;
    setSupported(!!SR);
  }, []);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimT = "";
      let finalT = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalT += t;
        else interimT += t;
      }
      if (finalT) {
        onResult(finalT);
        setInterim("");
      } else {
        setInterim(interimT);
      }
    };

    recognition.onerror = () => {
      setListening(false);
      setInterim("");
    };
    recognition.onend = () => {
      setListening(false);
      setInterim("");
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  }, [lang, onResult]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return { listening, interim, supported, start, stop, toggle };
}
