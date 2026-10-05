"use client";

import React, { useEffect, useRef, useState } from "react";
import styles from "@/styles/greenRoom.module.scss";
import { useMicMeter } from "@/hooks/useMicMeter";
import type { MediaDeviceOption } from "@/hooks/useRoom";

interface GreenRoomLobbyProps {
  roomId: string;
  userName: string;
  isGuest?: boolean;
  guestName?: string;
  onGuestNameChange?: (name: string) => void;
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
  isGuest = false,
  guestName = "",
  onGuestNameChange,
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
}: Readonly<GreenRoomLobbyProps>) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [nameError, setNameError] = useState("");
  const [enteredName, setEnteredName] = useState(guestName || "");
  const [prevGuestName, setPrevGuestName] = useState(guestName);

  if (guestName !== prevGuestName) {
    setPrevGuestName(guestName);
    if (!enteredName) {
      setEnteredName(guestName);
    }
  }

  const micVolume = useMicMeter(localStream, isAudioMuted);

  useEffect(() => {
    if (videoRef.current && localStream) {
      videoRef.current.srcObject = localStream;
      videoRef.current.play().catch(() => {});
    }
  }, [localStream, isVideoMuted]);

  const handleCopyLink = () => {
    void navigator.clipboard.writeText(roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const displayName = isGuest ? (enteredName.trim() || guestName.trim() || "Guest") : (userName || "You");

  const handleJoinClick = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    const finalName = isGuest ? enteredName.trim() : (userName || "").trim();
    if (isGuest && !finalName) {
      setNameError("Please enter your name to join the meeting.");
      return;
    }
    setNameError("");
    onGuestNameChange?.(finalName);
    onJoinMeeting();
  };

  const isMediaUnavailable = videoDevices.length === 0 && audioDevices.length === 0;

  let audioStatusText = "Ready";
  if (isAudioMuted) {
    audioStatusText = "Muted";
  } else if (micVolume > 6) {
    audioStatusText = "Speaking";
  }

  return (
    <div className={styles.lobbyContainer}>
      <div className={styles.lobbyCard}>
        {/* Left Column: Camera Preview + Live Mic VU Meter */}
        <div className={styles.previewColumn}>
          <div className={styles.previewFrame}>
            {isVideoMuted ? (
              <div className={styles.avatarFallback}>
                <div className={styles.avatarInitial}>
                  {(displayName || "G")[0].toUpperCase()}
                </div>
                <span className={styles.avatarLabel}>{displayName} (Camera is off)</span>
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
                {audioStatusText}
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
            <p>
              {isGuest
                ? "Enter your name and check your setup before joining the meeting."
                : `Joining as ${userName}. Check your audio and video setup.`}
            </p>
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

          {/* Google Meet style: Guest Name Field */}
          {isGuest && (
            <div className={styles.deviceField} style={{ marginTop: "0.25rem" }}>
              <label htmlFor="guest-name-input" style={{ color: "#60a5fa", fontWeight: 700 }}>
                What&apos;s your name?
              </label>
              <input
                id="guest-name-input"
                type="text"
                className={styles.selectDropdown}
                style={{
                  background: "rgba(15, 23, 42, 0.9)",
                  border: nameError ? "1px solid #ef4444" : "1px solid #3b82f6",
                  color: "#f8fafc",
                  fontSize: "0.95rem",
                  padding: "10px 14px",
                  borderRadius: "10px",
                }}
                placeholder="Enter your name to join (e.g. Aman Kumar)"
                value={enteredName}
                onChange={(e) => {
                  setNameError("");
                  setEnteredName(e.target.value);
                  onGuestNameChange?.(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleJoinClick();
                  }
                }}
              />
              {nameError && (
                <span style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: "2px" }}>
                  {nameError}
                </span>
              )}
            </div>
          )}

          {/* Hardware Device Selection */}
          <div className={styles.deviceSelectGroup}>
            <div className={styles.deviceField}>
              <label htmlFor="camera-select">Camera</label>
              <select
                id="camera-select"
                className={styles.selectDropdown}
                value={selectedVideoDeviceId}
                onChange={(e) => switchCamera(e.target.value)}
                disabled={videoDevices.length === 0}
              >
                {videoDevices.length === 0 ? (
                  <option value="">No camera available</option>
                ) : (
                  videoDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Camera"}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className={styles.deviceField}>
              <label htmlFor="mic-select">Microphone</label>
              <select
                id="mic-select"
                className={styles.selectDropdown}
                value={selectedAudioDeviceId}
                onChange={(e) => switchMicrophone(e.target.value)}
                disabled={audioDevices.length === 0}
              >
                {audioDevices.length === 0 ? (
                  <option value="">No microphone available</option>
                ) : (
                  audioDevices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label || "Microphone"}
                    </option>
                  ))
                )}
              </select>
            </div>
          </div>

          {isMediaUnavailable && (
            <div
              style={{
                background: "rgba(245, 158, 11, 0.12)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "10px",
                padding: "8px 12px",
                fontSize: "0.8rem",
                color: "#fcd34d",
                lineHeight: "1.35",
              }}
            >
              💡 <strong>Camera/mic note:</strong> Modern browsers require HTTPS (or localhost) to grant camera/mic permissions. You can join with avatar and chat!
            </div>
          )}

          {/* Primary Action Buttons */}
          <div className={styles.actionGroup}>
            <button
              id="lobby-join-button"
              type="button"
              className={styles.joinNowButton}
              onClick={handleJoinClick}
            >
              <span>🚀</span>
              <span>{isGuest ? "Ask to Join" : "Join Meeting Now"}</span>
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onCancel}
            >
              {isGuest ? "Leave / Cancel" : "Cancel & Return to Dashboard"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
