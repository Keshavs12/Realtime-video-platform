"use client";

import React, { use, useEffect, useRef, useState } from "react";
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
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    // Guards against acting on a play() call that a later srcObject/play()
    // call has already superseded (e.g. React re-running this effect, or a
    // fast peer reconnect). The browser aborts the stale call with
    // AbortError — that's expected noise, not a real playback failure, and
    // must not be treated as one or the video gets stuck showing the
    // "blocked" fallback forever even though a newer play() call succeeded.
    let cancelled = false;

    video.srcObject = stream;

    const playVideo = async () => {
      try {
        await video.play();
      } catch (err) {
        if (cancelled || (err as DOMException).name === "AbortError") return;

        console.warn("Unmuted playback prevented by browser. Falling back to muted to show video:", err);
        video.muted = true;
        setIsAudioBlocked(true);
        try {
          await video.play();
        } catch (e) {
          if (!cancelled && (e as DOMException).name !== "AbortError") {
            console.error("Muted video playback failed:", e);
          }
        }
      }
    };

    playVideo();

    const handleTrackEvent = () => playVideo();
    stream.getTracks().forEach((track) => {
      track.addEventListener("unmute", handleTrackEvent);
    });
    stream.addEventListener("addtrack", handleTrackEvent);

    return () => {
      cancelled = true;
      stream.getTracks().forEach((track) => {
        track.removeEventListener("unmute", handleTrackEvent);
      });
      stream.removeEventListener("addtrack", handleTrackEvent);
    };
  }, [stream]);

  const handleUnmute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = false;
      videoRef.current.play().then(() => setIsAudioBlocked(false)).catch(console.error);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={muted}
        className={className}
      >
        <track kind="captions" />
      </video>
      {isAudioBlocked && !muted && (
        <button
          onClick={handleUnmute}
          style={{
            position: "absolute",
            top: 12,
            right: 12,
            background: "rgba(239, 68, 68, 0.9)",
            color: "white",
            border: "none",
            borderRadius: "20px",
            padding: "4px 10px",
            fontSize: "0.75rem",
            cursor: "pointer",
            fontWeight: "600",
            zIndex: 10,
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          🔇 Click to unmute
        </button>
      )}
    </div>
  );
};

export default function RoomPage({ params }: Readonly<{ params: Promise<{ roomId: string }> }>) {
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
    videoDevices,
    audioDevices,
    selectedVideoDeviceId,
    selectedAudioDeviceId,
    switchCamera,
    switchMicrophone,
    roomNotFound,
    roomFull,
    messages,
    sendMessage,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
    speakingMap,
    networkQuality,
  } = useRoom(roomId, user);

  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const isChatAtBottomRef = useRef(true);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  const handleLeave = () => {
    router.push("/dashboard");
  };

  const handleSendMessage = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendMessage(chatInput.trim());
    setChatInput("");
  };

  const handleToggleScreenShare = () => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare().catch((err) => console.error("Failed to start screen share:", err));
    }
  };

  // Derive valid spotlight ID: if spotlighted peer leaves, activeSpotlightId cleanly falls back to null without cascading renders
  const isSpotlightValid = spotlightId === "local" || peers.some((p) => p.socketId === spotlightId);
  const activeSpotlightId = isSpotlightValid ? spotlightId : null;

  // Track chat scroll position to know if user is reading previous messages
  const handleChatScroll = () => {
    if (!chatMessagesRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = chatMessagesRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 60;
    isChatAtBottomRef.current = atBottom;
    if (atBottom) {
      setUnreadCount(0);
    }
  };

  useEffect(() => {
    if (messages.length === 0) return;
    const lastMsg = messages[messages.length - 1];

    if (isChatAtBottomRef.current || lastMsg.isLocal) {
      chatMessagesRef.current?.scrollTo({ top: chatMessagesRef.current.scrollHeight, behavior: "smooth" });
      setUnreadCount(0);
    } else {
      setUnreadCount((prev) => prev + 1);
    }
  }, [messages]);

  useEffect(() => {
    if (roomNotFound) {
      router.replace("/dashboard");
    }
  }, [roomNotFound, router]);

  useEffect(() => {
    if (roomFull) {
      const timer = setTimeout(() => {
        router.replace("/dashboard");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [roomFull, router]);

  if (roomNotFound) {
    return (
      <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#94a3b8" }}>This room doesn&apos;t exist. Redirecting…</p>
      </div>
    );
  }

  if (roomFull) {
    return (
      <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "#f87171", fontSize: "1.1rem", fontWeight: 500 }}>
          This room has reached maximum capacity (8 participants). Redirecting to dashboard…
        </p>
      </div>
    );
  }

  const totalParticipants = peers.length + 1;
  const gridClass =
    totalParticipants === 1
      ? styles.count1
      : totalParticipants === 2
      ? styles.count2
      : totalParticipants <= 4
      ? styles.count3
      : styles.countMany;

  const renderLocalFeed = (isSpotlight = false, isFilmstrip = false) => {
    const isSpeaking = Boolean(speakingMap["local"]);
    const wrapperClass = isSpotlight
      ? `${styles.spotlightMain} ${isSpeaking ? styles.activeSpeaker : ""}`
      : isFilmstrip
      ? `${styles.filmstripItem} ${isSpeaking ? styles.activeSpeaker : ""}`
      : `${styles.videoWrapper} ${isSpeaking ? styles.activeSpeaker : ""}`;

    return (
      <div className={wrapperClass} key="local-feed">
        {!isSpotlight && !isFilmstrip && (
          <button
            type="button"
            className={styles.pinButton}
            onClick={() => setSpotlightId("local")}
            title="Spotlight You"
          >
            📌 Pin
          </button>
        )}
        {isVideoMuted ? (
          <div className={`${styles.avatarFallback} ${isSpeaking ? styles.speakingPulse : ""}`}>
            <div className={styles.avatarInitial}>{(user?.name || "Y")[0].toUpperCase()}</div>
            <span className={styles.avatarName}>{user?.name || "You"}</span>
          </div>
        ) : (
          <VideoFeed
            stream={localStream}
            muted={true}
            className={`${styles.video} ${styles.mirror}`}
          />
        )}
        <div className={styles.peerName}>
          <span>👤 {user?.name || "You"} (You)</span>
          {isSpeaking && <span className={styles.speakingWave}>🎙️ ılı</span>}
          {isAudioMuted && <span>🔇</span>}
          {isVideoMuted && <span>🚫 Video Off</span>}
        </div>
      </div>
    );
  };

  const renderPeerFeed = (peer: (typeof peers)[0], isSpotlight = false, isFilmstrip = false) => {
    const peerName =
      peer.name ||
      presenceList.find(
        (p) => p.socketId === peer.socketId || (peer.userId && p.userId === peer.userId)
      )?.name;
    const displayName =
      peerName || (peer.userId ? `Peer (${peer.userId.slice(0, 4)})` : "Participant");
    const isSpeaking = Boolean(speakingMap[peer.socketId]);
    const stats = networkQuality[peer.socketId];
    const hasVideoTrack =
      peer.stream &&
      peer.stream.getVideoTracks().some((t) => t.enabled && t.readyState === "live");

    const wrapperClass = isSpotlight
      ? `${styles.spotlightMain} ${isSpeaking ? styles.activeSpeaker : ""}`
      : isFilmstrip
      ? `${styles.filmstripItem} ${isSpeaking ? styles.activeSpeaker : ""}`
      : `${styles.videoWrapper} ${isSpeaking ? styles.activeSpeaker : ""}`;

    return (
      <div className={wrapperClass} key={peer.socketId}>
        {!isSpotlight && !isFilmstrip && (
          <button
            type="button"
            className={styles.pinButton}
            onClick={() => setSpotlightId(peer.socketId)}
            title={`Spotlight ${displayName}`}
          >
            📌 Pin
          </button>
        )}

        {stats?.isReconnecting && (
          <div className={styles.reconnectingBadge}>
            <span>🔄 Reconnecting...</span>
          </div>
        )}

        {stats && !isFilmstrip && (
          <div
            className={`${styles.networkBadge} ${styles[stats.quality]}`}
            title={`Latency: ${stats.rttMs}ms | Packet Loss: ${stats.packetLossPercent}% | Quality: ${stats.quality}`}
          >
            <span className={styles.signalDot}></span>
            <span>{stats.rttMs > 0 ? `${stats.rttMs}ms` : stats.quality}</span>
          </div>
        )}

        {!hasVideoTrack ? (
          <div className={`${styles.avatarFallback} ${isSpeaking ? styles.speakingPulse : ""}`}>
            <div className={styles.avatarInitial}>{(displayName || "P")[0].toUpperCase()}</div>
            <span className={styles.avatarName}>{displayName}</span>
          </div>
        ) : (
          <VideoFeed stream={peer.stream} muted={false} className={styles.video} />
        )}

        <div className={styles.peerName}>
          <span>👤 {displayName}</span>
          {isSpeaking && <span className={styles.speakingWave}>🎙️ ılı</span>}
        </div>
      </div>
    );
  };

  return (
    <div className={styles.roomContainer}>
      {/* Video feeds and floating controllers */}
      <div className={styles.videoSection}>
        {activeSpotlightId ? (
          <div className={styles.spotlightStage}>
            <button
              type="button"
              className={styles.unpinButton}
              onClick={() => setSpotlightId(null)}
              title="Return to Grid View"
            >
              ✖ Exit Spotlight
            </button>

            {/* Main Stage */}
            {activeSpotlightId === "local"
              ? renderLocalFeed(true)
              : (() => {
                  const target = peers.find((p) => p.socketId === activeSpotlightId);
                  return target ? renderPeerFeed(target, true) : renderLocalFeed(true);
                })()}

            {/* Filmstrip */}
            <div className={styles.filmstrip}>
              {activeSpotlightId !== "local" && (
                <div
                  tabIndex={0}
                  role="button"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSpotlightId("local");
                  }}
                  onClick={() => setSpotlightId("local")}
                  title="Switch Spotlight to You"
                >
                  {renderLocalFeed(false, true)}
                </div>
              )}
              {peers
                .filter((p) => p.socketId !== activeSpotlightId)
                .map((p) => (
                  <div
                    key={p.socketId}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") setSpotlightId(p.socketId);
                    }}
                    onClick={() => setSpotlightId(p.socketId)}
                    title="Switch Spotlight"
                  >
                    {renderPeerFeed(p, false, true)}
                  </div>
                ))}
            </div>
          </div>
        ) : (
          <div className={`${styles.videoGrid} ${gridClass}`}>
            {renderLocalFeed()}
            {peers.map((peer) => renderPeerFeed(peer))}
            {peers.length === 0 && (
              <div className="flex items-center justify-center col-span-full h-full text-zinc-400 p-8 text-center bg-zinc-950/20 rounded-2xl border border-dashed border-zinc-800">
                <p>⌛ Waiting for other participants to join...</p>
              </div>
            )}
          </div>
        )}

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
            onClick={handleToggleScreenShare}
            className={`${styles.controlButton} ${isScreenSharing ? styles.active : ""}`}
            title={isScreenSharing ? "Stop Sharing Screen" : "Share Screen"}
          >
            🖥️
          </button>
          <button
            onClick={handleLeave}
            className={`${styles.controlButton} ${styles.leave}`}
            title="Leave Room"
          >
            📞
          </button>
        </div>

        {/* Device selection */}
        <div className={styles.deviceSelectors}>
          <select
            className={styles.deviceSelect}
            value={selectedVideoDeviceId}
            onChange={(e) => switchCamera(e.target.value)}
            title="Choose camera"
          >
            {videoDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>

          <select
            className={styles.deviceSelect}
            value={selectedAudioDeviceId}
            onChange={(e) => switchMicrophone(e.target.value)}
            title="Choose microphone"
          >
            {audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </select>
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
          {presenceList.map((presenceUser) => {
            const matchedPeer = peers.find(
              (p) => p.socketId === presenceUser.socketId || (presenceUser.userId && p.userId === presenceUser.userId)
            );
            const displayName =
              presenceUser.name ||
              matchedPeer?.name ||
              (presenceUser.userId ? `Peer (${presenceUser.userId.slice(0, 4)})` : "Participant");

            return (
              <li key={presenceUser.socketId} className={styles.userItem}>
                <div className={styles.userAvatar}>
                  {(displayName || "P")[0].toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.name}>{displayName}</span>
                  <span className={styles.status}>🟢 Active</span>
                </div>
              </li>
            );
          })}
        </ul>

        {/* In-call chat */}
        <div className={styles.chatSection}>
          <div className={styles.chatHeader}>
            <h3>Chat</h3>
            {unreadCount > 0 && (
              <span className={styles.unreadBadge}>{unreadCount} new</span>
            )}
          </div>
          <div
            className={styles.chatMessages}
            ref={chatMessagesRef}
            onScroll={handleChatScroll}
          >
            {messages.map((msg, i) => {
              const authorName =
                msg.name ||
                presenceList.find((p) => msg.userId && p.userId === msg.userId)?.name ||
                peers.find((p) => msg.userId && p.userId === msg.userId)?.name ||
                "Participant";

              return (
                <div
                  key={`${msg.at}-${i}`}
                  className={`${styles.chatMessage} ${msg.isLocal ? styles.own : ""}`}
                >
                  {!msg.isLocal && (
                    <div className={styles.chatMessageAuthor}>{authorName}</div>
                  )}
                  {msg.message}
                </div>
              );
            })}
          </div>
          <form className={styles.chatInputRow} onSubmit={handleSendMessage}>
            <input
              type="text"
              className={styles.chatInput}
              placeholder="Type a message…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
            />
            <button type="submit" className={styles.chatSendButton} disabled={!chatInput.trim()}>
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
