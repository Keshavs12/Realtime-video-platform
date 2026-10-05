import React from "react";
import styles from "@/styles/room.module.scss";

export function RoomNotFoundScreen() {
  return (
    <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#94a3b8" }}>This room doesn&apos;t exist. Redirecting…</p>
    </div>
  );
}

export function RoomFullScreen() {
  return (
    <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
      <p style={{ color: "#f87171", fontSize: "1.1rem", fontWeight: 500 }}>
        This room has reached maximum capacity (8 participants). Redirecting to dashboard…
      </p>
    </div>
  );
}

export function RoomLockedScreen({ onReturn }: Readonly<{ onReturn: () => void }>) {
  return (
    <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", background: "rgba(15, 23, 42, 0.8)", padding: "2.5rem", borderRadius: "16px", border: "1px solid #3b82f6" }}>
        <h2 style={{ color: "#ffffff", marginBottom: "0.75rem", fontSize: "1.4rem" }}>🔒 Room is Locked</h2>
        <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
          The meeting host has locked this room. No new participants can join.
        </p>
        <button onClick={onReturn} className={styles.returnButton}>
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}

export function KickedFromRoomScreen({ onReturn }: Readonly<{ onReturn: () => void }>) {
  return (
    <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
      <div style={{ textAlign: "center", background: "rgba(15, 23, 42, 0.8)", padding: "2.5rem", borderRadius: "16px", border: "1px solid #ef4444" }}>
        <h2 style={{ color: "#ef4444", marginBottom: "0.75rem", fontSize: "1.4rem" }}>🚫 Removed from Meeting</h2>
        <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
          You have been removed from the meeting by the room host.
        </p>
        <button onClick={onReturn} className={styles.returnButton}>
          Return to Dashboard
        </button>
      </div>
    </div>
  );
}
