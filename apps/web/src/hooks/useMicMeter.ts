"use client";

import { useEffect, useState, useRef } from "react";

/**
 * Custom hook to measure live audio volume from a MediaStream in real-time.
 * Returns volume percentage from 0 to 100 with smooth decay for VU meters.
 */
export function useMicMeter(stream: MediaStream | null, isMuted: boolean = false): number {
  const [volume, setVolume] = useState<number>(0);
  const animFrameRef = useRef<number | null>(null);

  const isAudioDisabled = !stream || isMuted;

  useEffect(() => {
    if (isAudioDisabled || !stream) {
      return;
    }

    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0 || !audioTracks[0].enabled) {
      return;
    }

    let audioContext: AudioContext | null = null;
    let analyser: AnalyserNode | null = null;
    let source: MediaStreamAudioSourceNode | null = null;
    let isCancelled = false;

    try {
      const AudioCtx =
        typeof window !== "undefined"
          ? window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null;

      if (!AudioCtx) return;

      audioContext = new AudioCtx();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.4;

      source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      let smoothedVol = 0;

      const updateMeter = () => {
        if (isCancelled || !analyser) return;

        analyser.getByteFrequencyData(dataArray);

        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const avg = sum / bufferLength;

        const rawPercent = Math.min(100, Math.round((avg / 128) * 100 * 1.5));

        if (rawPercent > smoothedVol) {
          smoothedVol = rawPercent;
        } else {
          smoothedVol = Math.max(0, smoothedVol * 0.85);
        }

        setVolume(Math.round(smoothedVol));
        animFrameRef.current = requestAnimationFrame(updateMeter);
      };

      updateMeter();
    } catch (err) {
      console.warn("[useMicMeter] Failed to initialize AudioContext analyser:", err);
    }

    return () => {
      isCancelled = true;
      if (animFrameRef.current) {
        cancelAnimationFrame(animFrameRef.current);
      }
      try {
        source?.disconnect();
        analyser?.disconnect();
        audioContext?.close().catch(() => {});
      } catch {
        // ignore
      }
    };
  }, [stream, isMuted, isAudioDisabled]);

  return isAudioDisabled ? 0 : volume;
}
