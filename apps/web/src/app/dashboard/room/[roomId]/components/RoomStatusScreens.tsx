import React from "react";
import { Clock } from "lucide-react";
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

export function WaitingForHostScreen({
  message,
  onCancel,
}: Readonly<{
  message?: string | null;
  onCancel: () => void;
}>) {
  return (
    <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
      <div
        style={{
          textAlign: "center",
          background: "rgba(15, 23, 42, 0.85)",
          backdropFilter: "blur(20px)",
          padding: "2.5rem 2rem",
          borderRadius: "24px",
          border: "1px solid rgba(99, 102, 241, 0.3)",
          boxShadow: "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 30px rgba(99, 102, 241, 0.15)",
          maxWidth: "460px",
          width: "90%",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "rgba(99, 102, 241, 0.15)",
            border: "1px solid rgba(99, 102, 241, 0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 1.25rem",
            color: "#818cf8",
          }}
        >
          <Clock size={28} />
        </div>
        <h2 style={{ color: "#ffffff", marginBottom: "0.5rem", fontSize: "1.35rem", fontWeight: 700 }}>
          Waiting to Be Admitted
        </h2>
        <p style={{ color: "#94a3b8", marginBottom: "1.75rem", fontSize: "0.88rem", lineHeight: 1.5 }}>
          {message || "The host has been notified that you are waiting. Please hold on while they let you in."}
        </p>
        <button onClick={onCancel} className={styles.returnButton}>
          Cancel &amp; Leave
        </button>
      </div>
    </div>
  );
}
