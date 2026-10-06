"use client";

import { useEffect, useRef, useState, useCallback } from "react";

export interface CaptionEntry {
  id: string;
  speaker: string;
  text: string;
  timestamp: number;
}

export function useSpeechCaptions(userName: string, isAudioMuted: boolean) {
  const [isCaptionsEnabled, setIsCaptionsEnabled] = useState(false);
  const [currentCaption, setCurrentCaption] = useState<string>("");
  const [transcriptHistory, setTranscriptHistory] = useState<CaptionEntry[]>([]);
  const [isSupported, setIsSupported] = useState(false);

  const recognitionRef = useRef<any>(null);
  const captionTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        const textToShow = (finalTranscript || interimTranscript).trim();
        if (textToShow) {
          setCurrentCaption(textToShow);

          if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
          captionTimeoutRef.current = setTimeout(() => {
            setCurrentCaption("");
          }, 4000);

          if (finalTranscript.trim()) {
            setTranscriptHistory((prev) => [
              ...prev.slice(-30),
              {
                id: `${Date.now()}-${Math.random()}`,
                speaker: userName || "You",
                text: finalTranscript.trim(),
                timestamp: Date.now(),
              },
            ]);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error !== "no-speech") {
          console.warn("[SpeechRecognition] Error:", event.error);
        }
      };

      recognition.onend = () => {
        // Auto-restart if still enabled and not muted
        if (recognitionRef.current?.shouldRun) {
          try {
            recognition.start();
          } catch {
            // Already started or busy
          }
        }
      };

      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.shouldRun = false;
        try {
          recognitionRef.current.stop();
        } catch {}
      }
      if (captionTimeoutRef.current) clearTimeout(captionTimeoutRef.current);
    };
  }, [userName]);

  // Handle toggle or mute change
  useEffect(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    if (isCaptionsEnabled && !isAudioMuted) {
      recognition.shouldRun = true;
      try {
        recognition.start();
      } catch {}
    } else {
      recognition.shouldRun = false;
      try {
        recognition.stop();
      } catch {}
      setCurrentCaption("");
    }
  }, [isCaptionsEnabled, isAudioMuted]);

  const toggleCaptions = useCallback(() => {
    setIsCaptionsEnabled((prev) => !prev);
  }, []);

  return {
    isCaptionsEnabled,
    toggleCaptions,
    currentCaption,
    transcriptHistory,
    isSupported,
  };
}
