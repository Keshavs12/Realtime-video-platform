"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "@/styles/greenRoom.module.scss";
import { useMicMeter } from "@/hooks/useMicMeter";
import type { MediaDeviceOption } from "@/hooks/useRoom";

interface GreenRoomLobbyProps {
  roomId: string;
  userName: string;
  localStream: MediaStream | null;
  isAudioMuted: boolean;
  isVideoMuted: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  videoDevices: MediaDeviceOption[];
  audioDevices: MediaDeviceOption[];
  selectedVideoDeviceId: string;
  selectedAudioDeviceId: string;
  switchCamera: (deviceId: string) => void;
  switchMicrophone: (deviceId: string) => void;
  participantCount: number;
  onJoinMeeting: () => void;
  onCancel: () => void;
}

export function GreenRoomLobby({
  roomId,
  userName,
  localStream,
  isAudioMuted,
  isVideoMuted,
  toggleAudio,
  toggleVideo,
  videoDevices,
  audioDevices,
  selectedVideoDeviceId,
  selectedAudioDeviceId,
  switchCamera,
  switchMicrophone,
  participantCount,
  onJoinMeeting,
  onCancel,
}: GreenRoomLobbyProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [copied, setCopied] = useState(false);
  const micVolume = useMicMeter(localStream, isAudioMuted);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
    }
  }, [localStream, isVideoMuted]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.lobbyContainer}>
      <div className={styles.lobbyCard}>
        {/* Left Column: Camera Preview + Live Mic VU Meter */}
        <div className={styles.previewColumn}>
          <div className={styles.previewFrame}>
            {isVideoMuted ? (
              <div className={styles.avatarFallback}>
                <div className={styles.avatarInitial}>
                  {(userName || "Y")[0].toUpperCase()}
                </div>
                <span className={styles.avatarLabel}>Camera is turned off</span>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={styles.previewVideo}
              />
            )}

            {/* Quick Floating Mute Toggles */}
            <div className={styles.floatingControls}>
              <button
                type="button"
                className={`${styles.previewCtrlBtn} ${isAudioMuted ? styles.muted : ""}`}
                onClick={toggleAudio}
                title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
              >
                {isAudioMuted ? "🔇" : "🎤"}
              </button>
              <button
                type="button"
                className={`${styles.previewCtrlBtn} ${isVideoMuted ? styles.muted : ""}`}
                onClick={toggleVideo}
                title={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
              >
                {isVideoMuted ? "🚫" : "📹"}
              </button>
            </div>
          </div>

          {/* Live Mic VU Meter */}
          <div className={styles.vuMeterBox}>
            <div className={styles.vuHeader}>
              <span className={styles.vuTitle}>
                <span>🎙️</span>
                <span>Microphone Level</span>
              </span>
              <span
                className={`${styles.vuStatus} ${
                  isAudioMuted ? styles.muted : styles.active
                }`}
              >
                {isAudioMuted
                  ? "Muted"
                  : micVolume > 6
                  ? "Speaking"
                  : "Ready"}
              </span>
            </div>
            <div className={styles.vuMeterTrack}>
              <div
                className={styles.vuMeterBar}
                style={{
                  width: `${isAudioMuted ? 0 : Math.min(100, micVolume)}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* Right Column: Meeting Info, Device Selectors & Join Action */}
        <div className={styles.configColumn}>
          <div className={styles.headerArea}>
            <h2>Ready to Join?</h2>
            <p>Check your audio, video, and device setup before entering the call.</p>
          </div>

          {/* Meeting Information */}
          <div className={styles.meetingInfoBox}>
            <div className={styles.roomInfoRow}>
              <span className={styles.roomLabel}>Meeting ID</span>
              <button
                type="button"
                className={styles.roomCodePill}
                onClick={handleCopyLink}
                title="Click to copy Room ID"
              >
                <span>{roomId}</span>
                <span>{copied ? "✓ Copied" : "📋"}</span>
              </button>
            </div>
            <div className={styles.presenceRow}>
              <span>👥</span>
              <span>
                {participantCount === 0 ? (
                  "No one else is in this meeting yet."
                ) : (
                  <>
                    <strong>{participantCount}</strong> participant
                    {participantCount > 1 ? "s" : ""} already in the meeting.
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Hardware Device Selection */}
          <div className={styles.deviceSelectGroup}>
            <div className={styles.deviceField}>
              <label htmlFor="camera-select">Camera</label>
              <select
                id="camera-select"
                className={styles.selectDropdown}
                value={selectedVideoDeviceId}
                onChange={(e) => switchCamera(e.target.value)}
              >
                {videoDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Camera"}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.deviceField}>
              <label htmlFor="mic-select">Microphone</label>
              <select
                id="mic-select"
                className={styles.selectDropdown}
                value={selectedAudioDeviceId}
                onChange={(e) => switchMicrophone(e.target.value)}
              >
                {audioDevices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label || "Microphone"}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className={styles.actionGroup}>
            <button
              type="button"
              className={styles.joinNowButton}
              onClick={onJoinMeeting}
            >
              <span>🚀</span>
              <span>Join Meeting Now</span>
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onCancel}
            >
              Cancel &amp; Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
