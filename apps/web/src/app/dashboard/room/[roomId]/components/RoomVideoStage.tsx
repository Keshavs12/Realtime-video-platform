import React, { useEffect, useRef, useState } from "react";
import styles from "@/styles/room.module.scss";
import {
  Peer,
  PresenceUser,
  HandRaisedUser,
  FloatingReaction,
  NetworkQualityStats,
} from "@/hooks/useRoom";

interface VideoFeedProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}

/**
 * A helper component to assign a MediaStream to an HTML5 video tag.
 */
export const VideoFeed = ({ stream, muted = false, className }: Readonly<VideoFeedProps>) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

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

    void playVideo();

    const handleTrackEvent = () => void playVideo();
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

function getFeedWrapperClass(isSpotlight: boolean, isFilmstrip: boolean, isSpeaking: boolean): string {
  let base = styles.videoWrapper;
  if (isSpotlight) {
    base = styles.spotlightMain;
  } else if (isFilmstrip) {
    base = styles.filmstripItem;
  }
  return isSpeaking ? `${base} ${styles.activeSpeaker}` : base;
}

function getGridClass(count: number): string {
  if (count === 1) return styles.count1;
  if (count === 2) return styles.count2;
  if (count <= 4) return styles.count3;
  return styles.countMany;
}

function getPeerDisplayName(
  peer: { name?: string; userId?: string; socketId: string },
  presenceList: { socketId: string; userId?: string; name?: string }[]
): string {
  const match = presenceList.find(
    (p) => p.socketId === peer.socketId || (peer.userId && p.userId === peer.userId)
  );
  return peer.name || match?.name || (peer.userId ? `Peer (${peer.userId.slice(0, 4)})` : "Participant");
}

interface RoomVideoStageProps {
  localStream: MediaStream | null;
  localDisplayName: string;
  isHost: boolean;
  isLocalHandRaised: boolean;
  isScreenSharing: boolean;
  isVideoMuted: boolean;
  isAudioMuted: boolean;
  speakingMap: Record<string, boolean>;
  peers: Peer[];
  presenceList: PresenceUser[];
  networkQuality: Record<string, NetworkQualityStats>;
  raisedHands: HandRaisedUser[];
  screenSharingPeers: Set<string>;
  activeSpotlightId: string | null;
  onSetSpotlightId: (id: string | null) => void;
  hostNotification: string | null;
  isLowBandwidthMode: boolean;
  reactions: FloatingReaction[];
  onCopyMeetingLink: () => void;
  copiedLink: boolean;
}

export function RoomVideoStage({
  localStream,
  localDisplayName,
  isHost,
  isLocalHandRaised,
  isScreenSharing,
  isVideoMuted,
  isAudioMuted,
  speakingMap,
  peers,
  presenceList,
  networkQuality,
  raisedHands,
  screenSharingPeers,
  activeSpotlightId,
  onSetSpotlightId,
  hostNotification,
  isLowBandwidthMode,
  reactions,
  onCopyMeetingLink,
  copiedLink,
}: Readonly<RoomVideoStageProps>) {
  const totalParticipants = peers.length + 1;
  const gridClass = getGridClass(totalParticipants);

  const renderLocalFeed = (isSpotlight = false, isFilmstrip = false) => {
    const isSpeaking = Boolean(speakingMap["local"]);
    const wrapperClass = getFeedWrapperClass(isSpotlight, isFilmstrip, isSpeaking);

    return (
      <div className={wrapperClass} key="local-feed">
        {!isSpotlight && !isFilmstrip && (
          <button
            type="button"
            className={styles.pinButton}
            onClick={() => onSetSpotlightId("local")}
            title="Spotlight You"
          >
            📌 Pin
          </button>
        )}
        {isHost && <span className={styles.hostBadge}>👑 Host</span>}
        {isLocalHandRaised && <span className={styles.handBadge}>✋ Hand Raised</span>}
        {isScreenSharing && <span className={styles.screenShareBadge}>🖥️ Presenting</span>}

        {isVideoMuted ? (
          <div className={`${styles.avatarFallback} ${isSpeaking ? styles.speakingPulse : ""}`}>
            <div className={styles.avatarInitial}>{(localDisplayName || "Y")[0].toUpperCase()}</div>
            <span className={styles.avatarName}>{localDisplayName}</span>
          </div>
        ) : (
          <VideoFeed
            stream={localStream}
            muted={true}
            className={`${styles.video} ${styles.mirror}`}
          />
        )}
        <div className={styles.peerName}>
          <span>👤 {localDisplayName} (You)</span>
          {isSpeaking && <span className={styles.speakingWave}>🎙️ ılı</span>}
          {isAudioMuted && <span>🔇</span>}
          {isVideoMuted && <span>🚫 Video Off</span>}
        </div>
      </div>
    );
  };

  const renderPeerFeed = (peer: Peer, isSpotlight = false, isFilmstrip = false) => {
    const displayName = getPeerDisplayName(peer, presenceList);
    const isSpeaking = Boolean(speakingMap[peer.socketId]);
    const stats = networkQuality[peer.socketId];
    const hasVideoTrack = Boolean(
      peer.stream?.getVideoTracks().some((t) => t.enabled && t.readyState === "live")
    );
    const wrapperClass = getFeedWrapperClass(isSpotlight, isFilmstrip, isSpeaking);
    const isHandRaised = raisedHands.some((h) => h.socketId === peer.socketId);
    const isPresenting = screenSharingPeers.has(peer.socketId);

    return (
      <div className={wrapperClass} key={peer.socketId}>
        {!isSpotlight && !isFilmstrip && (
          <button
            type="button"
            className={styles.pinButton}
            onClick={() => onSetSpotlightId(peer.socketId)}
            title={`Spotlight ${displayName}`}
          >
            📌 Pin
          </button>
        )}

        {peer.isHost && <span className={styles.hostBadge}>👑 Host</span>}
        {isHandRaised && <span className={styles.handBadge}>✋ Hand Raised</span>}
        {isPresenting && <span className={styles.screenShareBadge}>🖥️ Presenting</span>}

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

  const getSpotlightMain = () => {
    if (activeSpotlightId === "local") {
      return renderLocalFeed(true);
    }
    const target = peers.find((p) => p.socketId === activeSpotlightId);
    return target ? renderPeerFeed(target, true) : renderLocalFeed(true);
  };

  return (
    <div className={styles.videoSection}>
      {hostNotification && (
        <div className={styles.hostNotificationBanner}>
          <span>{hostNotification}</span>
        </div>
      )}

      {isLowBandwidthMode && (
        <div className={styles.lowBandwidthBanner}>
          <span>📶 Low Bandwidth Mode: Video paused to prioritize audio stability</span>
        </div>
      )}

      {/* Floating Emoji Reactions Overlay */}
      <div className={styles.reactionsOverlay}>
        {reactions.map((r, i) => (
          <div
            key={r.id}
            className={styles.floatingReaction}
            style={{ "--drift": `${((i % 7) - 3) * 45}px` } as React.CSSProperties}
          >
            <span className={styles.reactionEmoji}>{r.emoji}</span>
            <span className={styles.reactionSender}>{r.fromName}</span>
          </div>
        ))}
      </div>

      {/* Video Stage Area */}
      <div className={styles.videoStageArea}>
        {activeSpotlightId ? (
          <div className={styles.spotlightStage}>
            <button
              type="button"
              className={styles.unpinButton}
              onClick={() => onSetSpotlightId(null)}
              title="Return to Grid View"
            >
              ✖ Exit Spotlight
            </button>

            {/* Main Stage */}
            {getSpotlightMain()}

            {/* Filmstrip */}
            <div className={styles.filmstrip}>
              {activeSpotlightId !== "local" && (
                <button
                  type="button"
                  className={styles.filmstripButton}
                  onClick={() => onSetSpotlightId("local")}
                  title="Switch Spotlight to You"
                >
                  {renderLocalFeed(false, true)}
                </button>
              )}
              {peers
                .filter((p) => p.socketId !== activeSpotlightId)
                .map((p) => (
                  <button
                    type="button"
                    key={p.socketId}
                    className={styles.filmstripButton}
                    onClick={() => onSetSpotlightId(p.socketId)}
                    title="Switch Spotlight"
                  >
                    {renderPeerFeed(p, false, true)}
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <div className={`${styles.videoGrid} ${gridClass}`}>
            {renderLocalFeed()}
            {peers.map((peer) => renderPeerFeed(peer))}
            {peers.length === 0 && (
              <div
                style={{
                  gridColumn: "1 / -1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "0.85rem",
                  padding: "2.5rem 1.5rem",
                  background: "rgba(15, 23, 42, 0.4)",
                  border: "1px dashed rgba(255, 255, 255, 0.12)",
                  borderRadius: "20px",
                  color: "#94a3b8",
                  fontSize: "0.95rem",
                  margin: "auto",
                  maxWidth: "520px",
                }}
              >
                <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f1f5f9" }}>
                  ⌛ Waiting for other participants to join...
                </span>
                <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", textAlign: "center" }}>
                  Share this room link with your team or invitees so they can join right away.
                </p>
                <button
                  type="button"
                  onClick={onCopyMeetingLink}
                  style={{
                    background: "rgba(59, 130, 246, 0.2)",
                    border: "1px solid rgba(59, 130, 246, 0.4)",
                    color: "#93c5fd",
                    padding: "8px 16px",
                    borderRadius: "10px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                  }}
                >
                  <span>📋</span>
                  <span>{copiedLink ? "✓ Link Copied!" : "Copy Meeting Link"}</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
