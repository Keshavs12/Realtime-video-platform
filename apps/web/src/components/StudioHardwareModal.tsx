"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Mic,
  MicOff,
  Video,
  VideoOff,
  Activity,
  CheckCircle2,
  Sparkles,
  Volume2,
  ShieldCheck,
  RefreshCw,
} from "lucide-react";
import styles from "./StudioHardwareModal.module.scss";

interface StudioHardwareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const StudioHardwareModal = ({ isOpen, onClose }: StudioHardwareModalProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [deviceLabels, setDeviceLabels] = useState<{ cam: string; mic: string }>({
    cam: "Default Camera",
    mic: "Default Microphone",
  });

  useEffect(() => {
    if (!isOpen) return;

    let isCancelled = false;

    const startMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });

        if (isCancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        setHasPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => {});
        }

        // Get track labels
        const videoTrack = stream.getVideoTracks()[0];
        const audioTrack = stream.getAudioTracks()[0];
        setDeviceLabels({
          cam: videoTrack?.label || "HD Web Camera",
          mic: audioTrack?.label || "Built-in Microphone",
        });

        // Setup Web Audio Spectrum Analyzer
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContextClass) {
          const audioCtx = new AudioContextClass();
          audioCtxRef.current = audioCtx;

          const source = audioCtx.createMediaStreamSource(stream);
          const analyser = audioCtx.createAnalyser();
          analyser.fftSize = 64;
          analyser.smoothingTimeConstant = 0.8;
          source.connect(analyser);

          const bufferLength = analyser.frequencyBinCount;
          const dataArray = new Uint8Array(bufferLength);

          const drawSpectrum = () => {
            if (!canvasRef.current) return;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            analyser.getByteFrequencyData(dataArray);

            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Calculate average volume level
            let sum = 0;
            for (let i = 0; i < bufferLength; i++) {
              sum += dataArray[i];
            }
            const avg = sum / bufferLength;
            setAudioLevel(Math.min(100, Math.round((avg / 128) * 100)));

            // Draw Equalizer Bars
            const barCount = 20;
            const barWidth = (canvas.width / barCount) - 3;
            for (let i = 0; i < barCount; i++) {
              const val = dataArray[i * 2] || 0;
              const barHeight = Math.max(3, (val / 255) * canvas.height);
              const x = i * (barWidth + 3);
              const y = canvas.height - barHeight;

              // Gradient from Emerald to Indigo to Purple
              const grad = ctx.createLinearGradient(0, canvas.height, 0, 0);
              grad.addColorStop(0, "#10b981");
              grad.addColorStop(0.6, "#6366f1");
              grad.addColorStop(1, "#c084fc");

              ctx.fillStyle = grad;
              ctx.beginPath();
              ctx.roundRect(x, y, barWidth, barHeight, 3);
              ctx.fill();
            }

            animFrameRef.current = requestAnimationFrame(drawSpectrum);
          };

          drawSpectrum();
        }
      } catch (err) {
        console.warn("Studio hardware access error:", err);
        setHasPermission(false);
      }
    };

    void startMedia();

    return () => {
      isCancelled = true;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
        void audioCtxRef.current.close().catch(() => {});
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isOpen]);

  const toggleMic = () => {
    if (!streamRef.current) return;
    const next = !isMicMuted;
    setIsMicMuted(next);
    streamRef.current.getAudioTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  const toggleCam = () => {
    if (!streamRef.current) return;
    const next = !isVideoMuted;
    setIsVideoMuted(next);
    streamRef.current.getVideoTracks().forEach((t) => {
      t.enabled = !next;
    });
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.modalHeader}>
          <div className={styles.titleGroup}>
            <div className={styles.iconGlow}>
              <Sparkles size={18} />
            </div>
            <div>
              <h3>Studio Pre-Flight Check</h3>
              <p>Verify HD camera framing, lighting, and real-time audio spectrum</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close modal">
            <X size={18} />
          </button>
        </div>

        {/* Camera Mirror Stage */}
        <div className={styles.videoStageContainer}>
          {hasPermission === false ? (
            <div className={styles.permissionDenied}>
              <VideoOff size={32} />
              <p>Camera or Microphone permission was blocked by the browser.</p>
              <span>Please grant media access in your browser settings to test hardware.</span>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`${styles.videoFeed} ${isVideoMuted ? styles.videoHidden : ""}`}
              />
              {isVideoMuted && (
                <div className={styles.videoPlaceholder}>
                  <VideoOff size={40} />
                  <span>Camera is turned off</span>
                </div>
              )}

              {/* Status Badges on Video */}
              <div className={styles.stageOverlayTop}>
                <div className={styles.statusPillLive}>
                  <span className={styles.liveDot} />
                  <span>1080p 60fps Ready</span>
                </div>
                <div className={styles.statusPillEncrypted}>
                  <ShieldCheck size={12} />
                  <span>DTLS-SRTP Secure</span>
                </div>
              </div>

              {/* Video Framing Guides */}
              <div className={styles.framingGuide} />
            </>
          )}
        </div>

        {/* Audio Spectrum Analyzer Widget */}
        <div className={styles.spectrumSection}>
          <div className={styles.spectrumHeader}>
            <div className={styles.spectrumLabel}>
              <Activity size={15} style={{ color: "#34d399" }} />
              <span>Real-Time Voice Spectrum</span>
            </div>
            <div className={styles.volumeLevelText}>
              <Volume2 size={13} />
              <span>{isMicMuted ? "Muted" : `${audioLevel}% Input Level`}</span>
            </div>
          </div>

          <div className={styles.canvasWrapper}>
            <canvas ref={canvasRef} width={420} height={42} className={styles.spectrumCanvas} />
          </div>
        </div>

        {/* Device Details & Toggles */}
        <div className={styles.controlsRow}>
          <div className={styles.deviceInfoPills}>
            <div className={styles.deviceItem}>
              <Video size={13} style={{ color: "#818cf8" }} />
              <span className={styles.deviceLabelText}>{deviceLabels.cam}</span>
            </div>
            <div className={styles.deviceItem}>
              <Mic size={13} style={{ color: "#34d399" }} />
              <span className={styles.deviceLabelText}>{deviceLabels.mic}</span>
            </div>
          </div>

          <div className={styles.toggleButtonGroup}>
            <button
              type="button"
              className={`${styles.btnToggle} ${isMicMuted ? styles.btnMuted : styles.btnActive}`}
              onClick={toggleMic}
            >
              {isMicMuted ? <MicOff size={16} /> : <Mic size={16} />}
              <span>{isMicMuted ? "Mic Muted" : "Mic Active"}</span>
            </button>

            <button
              type="button"
              className={`${styles.btnToggle} ${isVideoMuted ? styles.btnMuted : styles.btnActive}`}
              onClick={toggleCam}
            >
              {isVideoMuted ? <VideoOff size={16} /> : <Video size={16} />}
              <span>{isVideoMuted ? "Cam Off" : "Cam Active"}</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.modalFooter}>
          <div className={styles.allSystemsGood}>
            <CheckCircle2 size={15} style={{ color: "#10b981" }} />
            <span>All hardware systems operational</span>
          </div>
          <button type="button" className={styles.btnDone} onClick={onClose}>
            <span>Ready to Join Meetings</span>
          </button>
        </div>
      </div>
    </div>
  );
};
