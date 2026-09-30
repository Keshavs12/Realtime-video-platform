"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { saveRecording, SavedRecording } from "@/lib/videoStorage";

interface UseMeetingRecorderProps {
  roomCode: string;
  localStream: MediaStream | null;
  onRecordingComplete?: (recording: SavedRecording) => void;
}

export function useMeetingRecorder({
  roomCode,
  localStream,
  onRecordingComplete,
}: UseMeetingRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [lastSavedRecording, setLastSavedRecording] = useState<SavedRecording | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const captureStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const recordingSecondsRef = useRef(0);

  // Clear timer helper
  const clearTimer = useCallback(() => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimer();
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
      if (captureStreamRef.current) {
        captureStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (audioContextRef.current && audioContextRef.current.state !== "closed") {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [clearTimer]);

  /**
   * Starts recording the meeting.
   * Captures screen/tab video + merges system and local microphone audio.
   */
  const startRecording = useCallback(async () => {
    if (isRecording) return;

    try {
      // 1. Capture screen/tab stream with system audio
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: true, // Captures tab/system audio
      });

      captureStreamRef.current = displayStream;

      // 2. Mix audio tracks: Combine Display Audio + Local Microphone Audio
      let finalAudioTrack: MediaStreamTrack | null = null;
      const displayAudioTracks = displayStream.getAudioTracks();
      const localAudioTracks = localStream ? localStream.getAudioTracks() : [];

      if (displayAudioTracks.length > 0 || localAudioTracks.length > 0) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const audioCtx = new AudioCtx();
        audioContextRef.current = audioCtx;

        const destination = audioCtx.createMediaStreamDestination();

        if (displayAudioTracks.length > 0) {
          const displayAudioStream = new MediaStream([displayAudioTracks[0]]);
          const displaySource = audioCtx.createMediaStreamSource(displayAudioStream);
          displaySource.connect(destination);
        }

        if (localAudioTracks.length > 0 && localAudioTracks[0].enabled) {
          const micAudioStream = new MediaStream([localAudioTracks[0]]);
          const micSource = audioCtx.createMediaStreamSource(micAudioStream);
          micSource.connect(destination);
        }

        const mixedAudioTracks = destination.stream.getAudioTracks();
        if (mixedAudioTracks.length > 0) {
          finalAudioTrack = mixedAudioTracks[0];
        }
      }

      // 3. Assemble the final stream to record
      const finalTracks: MediaStreamTrack[] = [displayStream.getVideoTracks()[0]];
      if (finalAudioTrack) {
        finalTracks.push(finalAudioTrack);
      }
      const combinedStream = new MediaStream(finalTracks);

      // 4. Select best supported mimeType
      const mimeTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];
      const selectedMimeType =
        mimeTypes.find((type) => MediaRecorder.isTypeSupported(type)) || "";

      const recorder = new MediaRecorder(
        combinedStream,
        selectedMimeType ? { mimeType: selectedMimeType } : undefined
      );

      mediaRecorderRef.current = recorder;
      recordedChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        clearTimer();
        setIsRecording(false);
        setIsPaused(false);

        // Stop all tracks in display stream
        displayStream.getTracks().forEach((t) => t.stop());
        if (audioContextRef.current && audioContextRef.current.state !== "closed") {
          audioContextRef.current.close().catch(() => {});
        }

        const totalDuration = recordingSecondsRef.current;
        const blob = new Blob(recordedChunksRef.current, {
          type: selectedMimeType || "video/webm",
        });

        if (blob.size > 0) {
          try {
            const saved = await saveRecording({
              roomCode,
              title: `Meeting in Room ${roomCode}`,
              blob,
              durationSeconds: totalDuration,
              recordedAt: new Date().toISOString(),
              sizeBytes: blob.size,
            });

            setLastSavedRecording(saved);
            if (onRecordingComplete) {
              onRecordingComplete(saved);
            }
          } catch (err) {
            console.error("Failed to store recording in IndexedDB:", err);
          }
        }
      };

      // Auto-stop if user clicks "Stop Sharing" on the browser native chrome bar
      displayStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      };

      // Start recording with 1-second timeslices
      recorder.start(1000);
      setIsRecording(true);
      setIsPaused(false);
      setRecordingSeconds(0);
      recordingSecondsRef.current = 0;

      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    } catch (err: unknown) {
      console.warn("User cancelled or screen capture denied for recording:", err);
      setIsRecording(false);
    }
  }, [isRecording, localStream, roomCode, clearTimer, onRecordingComplete]);

  /**
   * Stops the active recording.
   */
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  /**
   * Pauses the active recording.
   */
  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.pause();
      clearTimer();
      setIsPaused(true);
    }
  }, [clearTimer]);

  /**
   * Resumes a paused recording.
   */
  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "paused") {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds((prev) => {
          const next = prev + 1;
          recordingSecondsRef.current = next;
          return next;
        });
      }, 1000);
    }
  }, []);

  /**
   * Utility to trigger immediate browser file download for a recording blob.
   */
  const downloadRecording = useCallback((recording: SavedRecording) => {
    const url = URL.createObjectURL(recording.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SuperCall-${recording.roomCode}-${new Date(recording.recordedAt).toISOString().slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, []);

  return {
    isRecording,
    isPaused,
    recordingSeconds,
    lastSavedRecording,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
    setLastSavedRecording,
  };
}
