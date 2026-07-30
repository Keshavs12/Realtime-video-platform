"use client";

import React, { use, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useRoom } from "@/hooks/useRoom";
import styles from "@/styles/room.module.scss";

interface VideoFeedProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}

/**
 * A helper component to assign a MediaStream to an HTML5 video tag.
 */
const VideoFeed = ({ stream, muted = false, className }: VideoFeedProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={className}
    />
  );
};

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  
  const {
    localStream,
    peers,
    presenceList,
    toggleAudio,
    toggleVideo,
    isAudioMuted,
    isVideoMuted,
  } = useRoom(roomId, user);

  const handleLeave = () => {
    router.push("/dashboard");
  };

  return (
    <div className={styles.roomContainer}>
      {/* Video feeds and floating controllers */}
      <div className={styles.videoSection}>
        <div className={styles.videoGrid}>
          {/* Local Feed */}
          <div className={styles.videoWrapper}>
            <VideoFeed
              stream={localStream}
              muted={true} // local feed should always be muted to prevent feedback loop
              className={`${styles.video} ${styles.mirror}`}
            />
            <div className={styles.peerName}>
              <span>👤 {user?.name || "You"} (You)</span>
              {isAudioMuted && <span>🔇</span>}
              {isVideoMuted && <span>🚫 Video Off</span>}
            </div>
          </div>

          {/* Remote Feeds */}
          {peers.map((peer) => (
            <div key={peer.socketId} className={styles.videoWrapper}>
              <VideoFeed
                stream={peer.stream}
                muted={false}
                className={styles.video}
              />
              <div className={styles.peerName}>
                <span>👤 {peer.name || `Peer (${peer.userId.slice(0, 4)})`}</span>
              </div>
            </div>
          ))}

          {peers.length === 0 && (
            <div className="flex items-center justify-center col-span-full h-full text-zinc-400 p-8 text-center bg-zinc-950/20 rounded-2xl border border-dashed border-zinc-800">
              <p>⌛ Waiting for other participants to join...</p>
            </div>
          )}
        </div>

        {/* Controllers */}
        <div className={styles.controls}>
          <button
            onClick={toggleAudio}
            className={`${styles.controlButton} ${isAudioMuted ? styles.active : ""}`}
            title={isAudioMuted ? "Unmute Audio" : "Mute Audio"}
          >
            {isAudioMuted ? "🔇" : "🎤"}
          </button>
          <button
            onClick={toggleVideo}
            className={`${styles.controlButton} ${isVideoMuted ? styles.active : ""}`}
            title={isVideoMuted ? "Turn Video On" : "Turn Video Off"}
          >
            {isVideoMuted ? "🚫" : "📹"}
          </button>
          <button
            onClick={handleLeave}
            className={`${styles.controlButton} ${styles.leave}`}
            title="Leave Room"
          >
            📞
          </button>
        </div>
      </div>

      {/* Right Sidebar: Presence List */}
      <div className={styles.sidebar}>
        <h3>Room Participants ({presenceList.length + 1})</h3>
        <ul className={styles.userList}>
          {/* Current Local User */}
          <li className={styles.userItem}>
            <div className={styles.userAvatar}>
              {(user?.name || "U")[0].toUpperCase()}
            </div>
            <div className={styles.userInfo}>
              <span className={styles.name}>{user?.name || "You"}</span>
              <span className={styles.status}>🟢 Active</span>
            </div>
          </li>

          {/* Connected Peers */}
          {presenceList.map((presenceUser) => (
            <li key={presenceUser.socketId} className={styles.userItem}>
              <div className={styles.userAvatar}>
                {(presenceUser.name || "P")[0].toUpperCase()}
              </div>
              <div className={styles.userInfo}>
                <span className={styles.name}>
                  {presenceUser.name || `Peer (${presenceUser.userId.slice(0, 4)})`}
                </span>
                <span className={styles.status}>🟢 Active</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
