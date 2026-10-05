import React from "react";
import styles from "@/styles/room.module.scss";

interface RoomHeaderProps {
  roomId: string;
  copiedLink: boolean;
  onCopyMeetingLink: () => void;
  callDurationSeconds: number;
  formatDuration: (sec: number) => string;
  isRecording: boolean;
  isPaused: boolean;
  recordingSeconds: number;
  onResumeRecording: () => void;
  onPauseRecording: () => void;
  onStopRecording: () => void;
  isSidebarOpen: boolean;
  sidebarTab: "people" | "chat" | "host";
  onToggleSidebarTab: (tab: "people" | "chat" | "host") => void;
  participantCount: number;
  unreadCount: number;
  isHost: boolean;
}

export function RoomHeader({
  roomId,
  copiedLink,
  onCopyMeetingLink,
  callDurationSeconds,
  formatDuration,
  isRecording,
  isPaused,
  recordingSeconds,
  onResumeRecording,
  onPauseRecording,
  onStopRecording,
  isSidebarOpen,
  sidebarTab,
  onToggleSidebarTab,
  participantCount,
  unreadCount,
  isHost,
}: Readonly<RoomHeaderProps>) {
  return (
    <header className={styles.topHeaderBar}>
      <div className={styles.headerLeft}>
        <button
          type="button"
          className={styles.meetingBadge}
          onClick={onCopyMeetingLink}
          title="Click to copy meeting link"
        >
          <span>{roomId}</span>
          <span>{copiedLink ? "✓ Copied" : "📋"}</span>
        </button>
        <span className={styles.securityBadge}>🔒 Mesh Encrypted</span>
      </div>

      <div className={styles.headerCenter}>
        <div className={styles.callTimer}>
          <span>⏱️</span>
          <span>{formatDuration(callDurationSeconds)}</span>
        </div>
        {isRecording && (
          <div className={styles.recordingBadge} style={{ position: "static" }}>
            <span className={`${styles.recDot} ${isPaused ? styles.pausedDot : ""}`}></span>
            <span className={styles.recText}>
              {isPaused ? "PAUSED" : "REC"} {formatDuration(recordingSeconds)}
            </span>
            <button
              type="button"
              className={styles.recMiniButton}
              onClick={isPaused ? onResumeRecording : onPauseRecording}
              title={isPaused ? "Resume Recording" : "Pause Recording"}
            >
              {isPaused ? "▶️" : "⏸️"}
            </button>
            <button
              type="button"
              className={styles.recStopButton}
              onClick={onStopRecording}
              title="Stop and Save Recording"
            >
              ⏹️
            </button>
          </div>
        )}
      </div>

      <div className={styles.headerRight}>
        <button
          type="button"
          className={`${styles.headerIconBtn} ${isSidebarOpen && sidebarTab === "people" ? styles.active : ""}`}
          onClick={() => onToggleSidebarTab("people")}
          title="Participants"
        >
          <span>👥</span>
          <span>{participantCount}</span>
        </button>

        <button
          type="button"
          className={`${styles.headerIconBtn} ${isSidebarOpen && sidebarTab === "chat" ? styles.active : ""}`}
          onClick={() => onToggleSidebarTab("chat")}
          title="In-call Chat"
        >
          <span>💬</span>
          <span>Chat</span>
          {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
        </button>

        {isHost && (
          <button
            type="button"
            className={`${styles.headerIconBtn} ${isSidebarOpen && sidebarTab === "host" ? styles.active : ""}`}
            onClick={() => onToggleSidebarTab("host")}
            title="Host Controls"
          >
            <span>👑</span>
            <span>Host</span>
          </button>
        )}
      </div>
    </header>
  );
}
