"use client";

import React, { useEffect, useState } from "react";
import dashboardStyles from "@/styles/dashboard.module.scss";
import styles from "@/styles/videos.module.scss";
import * as roomService from "@/services/room.service";
import type { RoomHistoryEntry } from "@/services/room.service";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

export default function MyVideosPage() {
  const [history, setHistory] = useState<RoomHistoryEntry[] | null>(null);

  useEffect(() => {
    roomService
      .getRoomHistory()
      .then(setHistory)
      .catch((err) => {
        console.error("Failed to fetch room history:", err);
        setHistory([]);
      });
  }, []);

  return (
    <div className={dashboardStyles.card}>
      <h3>Call History</h3>

      {history === null ? (
        <p className={styles.empty}>Loading…</p>
      ) : history.length === 0 ? (
        <p className={styles.empty}>No past calls yet. Start or join a room to see it here.</p>
      ) : (
        <div className={styles.list} style={{ marginTop: "1rem" }}>
          {history.map((entry, i) => (
            <div key={`${entry.roomCode}-${entry.joinedAt}-${i}`} className={styles.row}>
              <div>
                <div className={styles.roomCode}>{entry.roomCode}</div>
                <div className={styles.meta}>
                  {formatDate(entry.joinedAt)}
                  {entry.otherParticipantsCount > 0 &&
                    ` · ${entry.otherParticipantsCount} other${entry.otherParticipantsCount > 1 ? "s" : ""}`}
                </div>
              </div>
              <span className={`${styles.badge} ${entry.isHost ? styles.hostBadge : styles.joinedBadge}`}>
                {entry.isHost ? "Hosted" : "Joined"}
              </span>
              <span className={styles.duration}>{entry.durationMinutes} min</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
