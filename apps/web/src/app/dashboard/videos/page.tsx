"use client";

import React, { useEffect, useState } from "react";
import dashboardStyles from "@/styles/dashboard.module.scss";
import styles from "@/styles/videos.module.scss";
import * as roomService from "@/services/room.service";
import type { RoomHistoryEntry } from "@/services/room.service";
import {
  getAllRecordings,
  deleteRecording,
  formatBytes,
  formatDuration,
  SavedRecording,
} from "@/lib/videoStorage";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

interface RecordingCardProps {
  recording: SavedRecording;
  onPlay: (rec: SavedRecording) => void;
  onDownload: (rec: SavedRecording) => void;
  onDelete: (id: string) => void;
}

function RecordingCard({
  recording,
  onPlay,
  onDownload,
  onDelete,
}: Readonly<RecordingCardProps>) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(recording.blob);
    let isMounted = true;
    void Promise.resolve().then(() => {
      if (isMounted) {
        setVideoUrl(url);
      }
    });
    return () => {
      isMounted = false;
      URL.revokeObjectURL(url);
    };
  }, [recording.blob]);

  return (
    <div className={styles.recordingCard}>
      <div
        role="button"
        tabIndex={0}
        aria-label={`Play recording ${recording.roomCode}`}
        className={styles.thumbnailWrapper}
        onClick={() => onPlay(recording)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onPlay(recording);
          }
        }}
      >
        {videoUrl ? (
          <video
            src={`${videoUrl}#t=0.5`}
            preload="metadata"
            className={styles.cardThumbnailVideo}
            muted
          >
            <track kind="captions" />
          </video>
        ) : (
          <div className={styles.thumbnailPlaceholder}>🎥</div>
        )}
        <div className={styles.durationPill}>
          ⏱️ {formatDuration(recording.durationSeconds)}
        </div>
        <div className={styles.hoverPlayOverlay}>
          <div className={styles.playIconCircle}>▶</div>
        </div>
      </div>

      <div className={styles.cardBody}>
        <div className={styles.cardTitleRow}>
          <h4 className={styles.cardTitle} title={recording.title}>
            {recording.title}
          </h4>
          <span className={styles.sizeBadge}>{formatBytes(recording.sizeBytes)}</span>
        </div>

        <div className={styles.cardMeta}>
          <span>📅 {formatDate(recording.recordedAt)}</span>
          <span>🔑 Room: {recording.roomCode}</span>
        </div>

        <div className={styles.cardActions}>
          <button
            type="button"
            className={styles.playBtn}
            onClick={() => onPlay(recording)}
            title="Watch recording"
          >
            ▶ Watch
          </button>
          <button
            type="button"
            className={styles.downloadBtn}
            onClick={() => onDownload(recording)}
            title="Download .webm video"
          >
            ⬇️ Download
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={() => onDelete(recording.id)}
            title="Delete from local storage"
          >
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MyVideosPage() {
  const [activeTab, setActiveTab] = useState<"recordings" | "history">("recordings");
  const [recordings, setRecordings] = useState<SavedRecording[] | null>(null);
  const [history, setHistory] = useState<RoomHistoryEntry[] | null>(null);
  const [activePlayerRec, setActivePlayerRec] = useState<SavedRecording | null>(null);
  const [playerVideoUrl, setPlayerVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    getAllRecordings()
      .then(setRecordings)
      .catch((err) => {
        console.error("Failed to load recordings from IndexedDB:", err);
        setRecordings([]);
      });

    roomService
      .getRoomHistory()
      .then(setHistory)
      .catch((err) => {
        console.error("Failed to fetch room history:", err);
        setHistory([]);
      });
  }, []);

  // Update URL for modal player
  useEffect(() => {
    let isMounted = true;
    if (activePlayerRec?.blob) {
      const url = URL.createObjectURL(activePlayerRec.blob);
      void Promise.resolve().then(() => {
        if (isMounted) {
          setPlayerVideoUrl(url);
        }
      });
      return () => {
        isMounted = false;
        URL.revokeObjectURL(url);
      };
    } else {
      void Promise.resolve().then(() => {
        if (isMounted) {
          setPlayerVideoUrl(null);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [activePlayerRec]);

  const handleDownload = (rec: SavedRecording) => {
    const url = URL.createObjectURL(rec.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `SuperCall-${rec.roomCode}-${new Date(rec.recordedAt)
      .toISOString()
      .slice(0, 10)}.webm`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  };

  const handleDelete = async (id: string) => {
    if (
      !window.confirm(
        "Are you sure you want to delete this recorded meeting? This will permanently remove it from your browser storage."
      )
    ) {
      return;
    }
    await deleteRecording(id);
    setRecordings((prev) => (prev ? prev.filter((r) => r.id !== id) : []));
    if (activePlayerRec?.id === id) {
      setActivePlayerRec(null);
    }
  };

  // Calculate total recording stats
  const totalSizeBytes = (recordings || []).reduce((acc, r) => acc + r.sizeBytes, 0);

  return (
    <div className={dashboardStyles.card}>
      {/* Studio Header & Navigation Tabs */}
      <div className={styles.studioHeader}>
        <div>
          <h2 className={styles.studioTitle}>Videos &amp; Recordings Studio</h2>
          <p className={styles.studioSubtitle}>
            Review your recorded meetings, replay past calls, and manage your media library.
          </p>
        </div>

        <div className={styles.tabsBar}>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "recordings" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("recordings")}
          >
            🎥 Recorded Meetings ({recordings ? recordings.length : 0})
          </button>
          <button
            type="button"
            className={`${styles.tabBtn} ${activeTab === "history" ? styles.tabBtnActive : ""}`}
            onClick={() => setActiveTab("history")}
          >
            📞 Call History ({history ? history.length : 0})
          </button>
        </div>
      </div>

      {/* Tab 1: Recorded Meetings */}
      {activeTab === "recordings" && (
        <div className={styles.tabContent}>
          {recordings && recordings.length > 0 && (
            <div className={styles.statsBanner}>
              <span>
                💾 <strong>{recordings.length}</strong> meeting{recordings.length > 1 ? "s" : ""}{" "}
                recorded
              </span>
              <span className={styles.statsDot}>•</span>
              <span>
                💽 <strong>{formatBytes(totalSizeBytes)}</strong> stored locally (Zero cloud cost)
              </span>
            </div>
          )}

          {(() => {
            if (recordings === null) {
              return <p className={styles.empty}>Loading recordings…</p>;
            }
            if (recordings.length === 0) {
              return (
                <div className={styles.emptyStateBox}>
                  <div className={styles.emptyIcon}>🎥</div>
                  <h3>No recorded meetings yet</h3>
                  <p>
                    During any call in a room, click the <strong>⏺️ Record</strong> button in the
                    bottom controls to capture screen video and all participant audio. Your recording
                    will be saved here automatically!
                  </p>
                </div>
              );
            }
            return (
              <div className={styles.recordingsGrid}>
                {recordings.map((rec) => (
                  <RecordingCard
                    key={rec.id}
                    recording={rec}
                    onPlay={(r) => setActivePlayerRec(r)}
                    onDownload={handleDownload}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Tab 2: Call History */}
      {activeTab === "history" && (
        <div className={styles.tabContent}>
          {(() => {
            if (history === null) {
              return <p className={styles.empty}>Loading call history…</p>;
            }
            if (history.length === 0) {
              return (
                <p className={styles.empty}>
                  No past calls yet. Start or join a room to see it here.
                </p>
              );
            }
            return (
              <div className={styles.list}>
                {history.map((entry, i) => (
                  <div
                    key={`${entry.roomCode}-${entry.joinedAt}-${i}`}
                    className={styles.row}
                  >
                    <div>
                      <div className={styles.roomCode}>{entry.roomCode}</div>
                      <div className={styles.meta}>
                        {formatDate(entry.joinedAt)}
                        {entry.otherParticipantsCount > 0 &&
                          ` · ${entry.otherParticipantsCount} other${
                            entry.otherParticipantsCount > 1 ? "s" : ""
                          }`}
                      </div>
                    </div>
                    <span
                      className={`${styles.badge} ${
                        entry.isHost ? styles.hostBadge : styles.joinedBadge
                      }`}
                    >
                      {entry.isHost ? "Hosted" : "Joined"}
                    </span>
                    <span className={styles.duration}>{entry.durationMinutes} min</span>
                  </div>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {/* Modal Video Player */}
      {activePlayerRec && playerVideoUrl && (
        <div
          role="presentation"
          className={styles.playerModalOverlay}
          onClick={() => setActivePlayerRec(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") setActivePlayerRec(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="player-modal-title"
            className={styles.playerModal}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div className={styles.playerModalHeader}>
              <div>
                <h3 id="player-modal-title">{activePlayerRec.title}</h3>
                <span className={styles.playerModalMeta}>
                  {formatDate(activePlayerRec.recordedAt)} •{" "}
                  {formatDuration(activePlayerRec.durationSeconds)} •{" "}
                  {formatBytes(activePlayerRec.sizeBytes)}
                </span>
              </div>
              <button
                type="button"
                className={styles.modalCloseBtn}
                onClick={() => setActivePlayerRec(null)}
              >
                ✕
              </button>
            </div>

            <div className={styles.videoPlayerWrapper}>
              <video
                src={playerVideoUrl}
                controls
                autoPlay
                playsInline
                className={styles.modalVideoTag}
              >
                <track kind="captions" />
              </video>
            </div>

            <div className={styles.playerModalFooter}>
              <button
                type="button"
                className={styles.modalDownloadBtn}
                onClick={() => handleDownload(activePlayerRec)}
              >
                ⬇️ Download .webm Video
              </button>
              <button
                type="button"
                className={styles.modalDeleteBtn}
                onClick={() => handleDelete(activePlayerRec.id)}
              >
                🗑️ Delete Recording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
