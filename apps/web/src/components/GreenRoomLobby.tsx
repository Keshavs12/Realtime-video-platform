"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  Users,
  Copy,
  Check,
  AlertCircle,
  LogIn,
  Camera,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
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
  onJoinMeeting: (name?: string) => void;
  onCancel: () => void;
}

interface PreviewPanelProps {
  readonly isVideoMuted: boolean;
  readonly isAudioMuted: boolean;
  readonly videoRef: React.RefObject<HTMLVideoElement | null>;
  readonly toggleAudio: () => void;
  readonly toggleVideo: () => void;
  readonly displayName: string;
  readonly audioStatusText: string;
  readonly micVolume: number;
}

function PreviewPanel({
  isVideoMuted,
  isAudioMuted,
  videoRef,
  toggleAudio,
  toggleVideo,
  displayName,
  audioStatusText,
  micVolume,
}: Readonly<PreviewPanelProps>) {
  return (
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

        <div className={styles.floatingControls}>
          <button
            type="button"
            className={`${styles.previewCtrlBtn} ${isAudioMuted ? styles.muted : ""}`}
            onClick={toggleAudio}
            title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
          >
            {isAudioMuted ? <MicOff size={18} /> : <Mic size={18} />}
          </button>
          <button
            type="button"
            className={`${styles.previewCtrlBtn} ${isVideoMuted ? styles.muted : ""}`}
            onClick={toggleVideo}
            title={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
          >
            {isVideoMuted ? <VideoOff size={18} /> : <Video size={18} />}
          </button>
        </div>
      </div>

      <div className={styles.vuMeterBox}>
        <div className={styles.vuHeader}>
          <span className={styles.vuTitle} style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Mic size={14} style={{ color: "#818cf8" }} />
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
  );
}

interface DeviceSelectorProps {
  readonly videoDevices: MediaDeviceOption[];
  readonly audioDevices: MediaDeviceOption[];
  readonly selectedVideoDeviceId: string;
  readonly selectedAudioDeviceId: string;
  readonly switchCamera: (deviceId: string) => void;
  readonly switchMicrophone: (deviceId: string) => void;
}

function DeviceSelector({
  videoDevices,
  audioDevices,
  selectedVideoDeviceId,
  selectedAudioDeviceId,
  switchCamera,
  switchMicrophone,
}: Readonly<DeviceSelectorProps>) {
  return (
    <div className={styles.deviceSelectGroup}>
      <div className={styles.deviceField}>
        <label htmlFor="camera-select" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Camera size={13} />
          <span>Camera</span>
        </label>
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
        <label htmlFor="mic-select" style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Mic size={13} />
          <span>Microphone</span>
        </label>
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
  );
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
    navigator.clipboard.writeText(roomId).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  let displayName = userName || "You";
  if (isGuest) {
    displayName = enteredName.trim() || guestName.trim() || "Guest";
  }

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
    onJoinMeeting(finalName);
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
        <PreviewPanel
          isVideoMuted={isVideoMuted}
          isAudioMuted={isAudioMuted}
          videoRef={videoRef}
          toggleAudio={toggleAudio}
          toggleVideo={toggleVideo}
          displayName={displayName}
          audioStatusText={audioStatusText}
          micVolume={micVolume}
        />

        {/* Right Column: Meeting Info, Device Selectors & Join Action */}
        <div className={styles.configColumn}>
          <div className={styles.headerArea}>
            <h2>Ready to Join?</h2>
            <p>
              {isGuest
                ? "Enter your name and test your camera & audio before entering the room."
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
                {copied ? <Check size={13} style={{ color: "#34d399" }} /> : <Copy size={13} />}
              </button>
            </div>
            <div className={styles.presenceRow}>
              <Users size={14} style={{ color: "#818cf8" }} />
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

          {/* Guest Name Field */}
          {isGuest && (
            <div className={styles.deviceField} style={{ marginTop: "0.25rem" }}>
              <label htmlFor="guest-name-input" style={{ color: "#818cf8", fontWeight: 700 }}>
                What&apos;s your name?
              </label>
              <input
                id="guest-name-input"
                type="text"
                className={styles.selectDropdown}
                style={{
                  background: "rgba(15, 23, 42, 0.9)",
                  border: nameError ? "1px solid #ef4444" : "1px solid rgba(99, 102, 241, 0.4)",
                  color: "#f8fafc",
                  fontSize: "0.95rem",
                  padding: "10px 14px",
                  borderRadius: "12px",
                }}
                placeholder="Enter your name (e.g. Aman Sharma)"
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

          <DeviceSelector
            videoDevices={videoDevices}
            audioDevices={audioDevices}
            selectedVideoDeviceId={selectedVideoDeviceId}
            selectedAudioDeviceId={selectedAudioDeviceId}
            switchCamera={switchCamera}
            switchMicrophone={switchMicrophone}
          />

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
                display: "flex",
                alignItems: "flex-start",
                gap: "0.5rem",
              }}
            >
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong>Camera/mic note:</strong> WebRTC requires HTTPS or localhost permissions. You can still join with your avatar and in-call chat!
              </div>
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
              <LogIn size={18} />
              <span>{isGuest ? "Ask to Join Room" : "Join Meeting Now"}</span>
            </button>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={onCancel}
            >
              {isGuest ? "Cancel & Exit" : "Return to Dashboard"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
