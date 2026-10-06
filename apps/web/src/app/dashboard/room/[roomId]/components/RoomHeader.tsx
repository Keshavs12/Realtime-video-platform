import React from "react";
import {
  Lock,
  Copy,
  Check,
  Clock,
  Circle,
  Play,
  Pause,
  Square,
  Users,
  MessageSquare,
  Crown,
  Sparkles,
} from "lucide-react";
import styles from "@/styles/room.module.scss";
import type { SidebarTabType } from "./RoomSidebar";

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
  sidebarTab: SidebarTabType;
  onToggleSidebarTab: (tab: SidebarTabType) => void;
  participantCount: number;
  unreadCount: number;
  isHost: boolean;
  onOpenRecap?: () => void;
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
  onOpenRecap,
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
          {copiedLink ? (
            <Check size={14} style={{ color: "#34d399" }} />
          ) : (
            <Copy size={14} />
          )}
        </button>
        <span className={styles.securityBadge}>
          <Lock size={12} />
          <span>Mesh Encrypted</span>
        </span>
      </div>

      <div className={styles.headerCenter}>
        <div className={styles.callTimer}>
          <Clock size={14} style={{ color: "#94a3b8" }} />
          <span>{formatDuration(callDurationSeconds)}</span>
        </div>
        {isRecording && (
          <div className={styles.recordingBadge} style={{ position: "static" }}>
            <span className={`${styles.recDot} ${isPaused ? styles.pausedDot : ""}`} />
            <span className={styles.recText}>
              {isPaused ? "PAUSED" : "REC"} {formatDuration(recordingSeconds)}
            </span>
            <button
              type="button"
              className={styles.recMiniButton}
              onClick={isPaused ? onResumeRecording : onPauseRecording}
              title={isPaused ? "Resume Recording" : "Pause Recording"}
            >
              {isPaused ? <Play size={12} /> : <Pause size={12} />}
            </button>
            <button
              type="button"
              className={styles.recStopButton}
              onClick={onStopRecording}
              title="Stop and Save Recording"
            >
              <Square size={12} />
            </button>
          </div>
        )}
      </div>

      <div className={styles.headerRight}>
        {onOpenRecap && (
          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={onOpenRecap}
            title="Meeting Intelligence & Recap"
            style={{
              background: "rgba(99, 102, 241, 0.15)",
              borderColor: "rgba(99, 102, 241, 0.35)",
              color: "#a5b4fc",
            }}
          >
            <Sparkles size={14} style={{ color: "#c084fc" }} />
            <span>Recap</span>
          </button>
        )}

        <button
          type="button"
          className={`${styles.headerIconBtn} ${isSidebarOpen && sidebarTab === "people" ? styles.active : ""}`}
          onClick={() => onToggleSidebarTab("people")}
          title="Participants"
        >
          <Users size={16} />
          <span>{participantCount}</span>
        </button>

        <button
          type="button"
          className={`${styles.headerIconBtn} ${isSidebarOpen && sidebarTab === "chat" ? styles.active : ""}`}
          onClick={() => onToggleSidebarTab("chat")}
          title="In-call Chat"
        >
          <MessageSquare size={16} />
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
            <Crown size={16} style={{ color: "#fbbf24" }} />
            <span>Host</span>
          </button>
        )}
      </div>
    </header>
  );
}
