import React from "react";
import styles from "@/styles/room.module.scss";
import { formatBytes } from "@/lib/videoStorage";

interface SavedRecording {
  id: string;
  roomCode: string;
  title: string;
  blob: Blob;
  durationSeconds: number;
  recordedAt: string;
  sizeBytes: number;
}

interface RecordingCompletionModalProps {
  isOpen: boolean;
  recording: SavedRecording | null;
  videoUrl: string | null;
  onClose: () => void;
  onDownload: (recording: SavedRecording) => void;
  onViewStudio: () => void;
  formatDuration: (sec: number) => string;
}

export function RecordingCompletionModal({
  isOpen,
  recording,
  videoUrl,
  onClose,
  onDownload,
  onViewStudio,
  formatDuration,
}: Readonly<RecordingCompletionModalProps>) {
  if (!isOpen || !recording) return null;

  return (
    <div className={styles.recordingModalOverlay}>
      <button
        type="button"
        className={styles.modalBackdrop}
        onClick={onClose}
        aria-label="Close modal overlay"
        tabIndex={-1}
      />
      <dialog
        open
        aria-modal="true"
        aria-labelledby="recording-saved-modal-title"
        className={styles.recordingModal}
      >
        <div className={styles.recordingModalHeader}>
          <div className={styles.modalTitleBox}>
            <span className={styles.modalTitleIcon}>🎉</span>
            <div>
              <h3 id="recording-saved-modal-title">Meeting Recording Saved!</h3>
              <p>Saved locally in your browser studio (Zero cloud cost, instant access)</p>
            </div>
          </div>
          <button
            type="button"
            className={styles.modalCloseBtn}
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        {videoUrl && (
          <div className={styles.recordingVideoContainer}>
            <video
              src={videoUrl}
              controls
              playsInline
              className={styles.recordingVideoPlayer}
            >
              <track kind="captions" />
            </video>
          </div>
        )}

        <div className={styles.recordingMetaGrid}>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Duration</span>
            <span className={styles.metaValue}>{formatDuration(recording.durationSeconds)}</span>
          </div>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>File Size</span>
            <span className={styles.metaValue}>{formatBytes(recording.sizeBytes)}</span>
          </div>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Room</span>
            <span className={styles.metaValue}>{recording.roomCode}</span>
          </div>
          <div className={styles.metaCard}>
            <span className={styles.metaLabel}>Storage</span>
            <span className={styles.metaValue}>IndexedDB (Local)</span>
          </div>
        </div>

        <div className={styles.recordingModalActions}>
          <button
            type="button"
            className={styles.downloadRecBtn}
            onClick={() => onDownload(recording)}
          >
            ⬇️ Download .webm Video
          </button>
          <button
            type="button"
            className={styles.viewStudioBtn}
            onClick={onViewStudio}
          >
            🎬 View in My Videos Studio
          </button>
          <button
            type="button"
            className={styles.dismissRecBtn}
            onClick={onClose}
          >
            Dismiss
          </button>
        </div>
      </dialog>
    </div>
  );
}
