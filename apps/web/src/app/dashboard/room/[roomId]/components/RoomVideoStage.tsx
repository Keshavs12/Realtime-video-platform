import React, { useEffect, useRef, useState } from "react";
import {
  Crown,
  Hand,
  Monitor,
  Pin,
  PinOff,
  MicOff,
  VideoOff,
  VolumeX,
  Volume2,
  Copy,
  Check,
  Share2,
  Users,
  Clock,
  Wifi,
  Sparkles,
  RefreshCw,
} from "lucide-react";
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
  isBlurred?: boolean;
}

/**
 * A helper component to assign a MediaStream to an HTML5 video tag.
 */
export const VideoFeed = ({ stream, muted = false, className, isBlurred = false }: Readonly<VideoFeedProps>) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [isAudioBlocked, setIsAudioBlocked] = useState(false);
  const [effectiveMuted, setEffectiveMuted] = useState(muted);

  useEffect(() => {
    setEffectiveMuted(muted);
  }, [muted]);

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
        // Persist muted in React state so React reconciler doesn't revert to unmuted on render
        video.muted = true;
        setEffectiveMuted(true);
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

  const handleUnmute = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      videoRef.current.muted = false;
      setEffectiveMuted(false);
      videoRef.current.play().then(() => setIsAudioBlocked(false)).catch(console.error);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={effectiveMuted}
        className={className}
        style={isBlurred ? { filter: "contrast(1.06) saturate(1.15) brightness(1.02)" } : undefined}
      >
        <track kind="captions" />
      </video>
      {isAudioBlocked && !muted && (
        <button
          onClick={handleUnmute}
          onTouchEnd={handleUnmute}
          style={{
            position: "absolute",
            top: 14,
            right: 14,
            background: "rgba(239, 68, 68, 0.95)",
            backdropFilter: "blur(12px)",
            color: "white",
            border: "1px solid rgba(255, 255, 255, 0.2)",
            borderRadius: "9999px",
            padding: "5px 12px",
            fontSize: "0.75rem",
            cursor: "pointer",
            fontWeight: "600",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            boxShadow: "0 4px 15px rgba(239, 68, 68, 0.4)",
          }}
        >
          <VolumeX size={14} />
          <span>Click to Unmute</span>
        </button>
      )}
    </div>
  );
};

const SignalBars = ({ quality }: { quality: string }) => {
  const bars = quality === "excellent" ? 4 : quality === "good" ? 3 : quality === "poor" ? 2 : 1;
  const color = quality === "poor" ? "#f43f5e" : quality === "good" ? "#f59e0b" : "#10b981";
  return (
    <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
      <rect x="0" y="9" width="2.5" height="3" rx="0.75" fill={bars >= 1 ? color : "rgba(255,255,255,0.2)"} />
      <rect x="3.5" y="6" width="2.5" height="6" rx="0.75" fill={bars >= 2 ? color : "rgba(255,255,255,0.2)"} />
      <rect x="7" y="3" width="2.5" height="9" rx="0.75" fill={bars >= 3 ? color : "rgba(255,255,255,0.2)"} />
      <rect x="10.5" y="0" width="2.5" height="12" rx="0.75" fill={bars >= 4 ? color : "rgba(255,255,255,0.2)"} />
    </svg>
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
  currentCaption?: string;
  isCaptionsEnabled?: boolean;
  isBackgroundBlur?: boolean;
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
  currentCaption,
  isCaptionsEnabled,
  isBackgroundBlur = false,
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
            <Pin size={12} />
            <span>Pin</span>
          </button>
        )}
        {isHost && (
          <span className={styles.hostBadge}>
            <Crown size={12} style={{ color: "#fbbf24" }} />
            <span>Host</span>
          </span>
        )}
        {isLocalHandRaised && (
          <span className={styles.handBadge}>
            <Hand size={12} />
            <span>Hand Raised</span>
          </span>
        )}
        {isScreenSharing && (
          <span className={styles.screenShareBadge}>
            <Monitor size={12} />
            <span>Presenting</span>
          </span>
        )}

        {isBackgroundBlur && !isVideoMuted && (
          <span
            style={{
              position: "absolute",
              top: 10,
              left: 10,
              background: "rgba(168, 85, 247, 0.25)",
              border: "1px solid rgba(168, 85, 247, 0.45)",
              color: "#e879f9",
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "0.7rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              backdropFilter: "blur(8px)",
              zIndex: 3,
            }}
          >
            <Sparkles size={11} />
            <span>Studio FX</span>
          </span>
        )}

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
            isBlurred={isBackgroundBlur}
          />
        )}
        <div className={styles.peerName}>
          <span>{localDisplayName} (You)</span>
          {isSpeaking && (
            <div style={{ display: "inline-flex", alignItems: "flex-end", gap: "2px", height: "10px", margin: "0 2px" }}>
              <span style={{ width: "2px", height: "100%", background: "#10b981", borderRadius: "1px" }} />
              <span style={{ width: "2px", height: "60%", background: "#10b981", borderRadius: "1px" }} />
              <span style={{ width: "2px", height: "80%", background: "#10b981", borderRadius: "1px" }} />
            </div>
          )}
          {isAudioMuted && <MicOff size={12} style={{ color: "#f87171" }} />}
          {isVideoMuted && <VideoOff size={12} style={{ color: "#f87171" }} />}
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
            <Pin size={12} />
            <span>Pin</span>
          </button>
        )}

        {peer.isHost && (
          <span className={styles.hostBadge}>
            <Crown size={12} style={{ color: "#fbbf24" }} />
            <span>Host</span>
          </span>
        )}
        {isHandRaised && (
          <span className={styles.handBadge}>
            <Hand size={12} />
            <span>Hand Raised</span>
          </span>
        )}
        {isPresenting && (
          <span className={styles.screenShareBadge}>
            <Monitor size={12} />
            <span>Presenting</span>
          </span>
        )}

        {stats?.isReconnecting && (
          <div className={styles.reconnectingBadge}>
            <RefreshCw size={12} className="animate-spin" />
            <span>Reconnecting…</span>
          </div>
        )}

        {stats && !isFilmstrip && (
          <div
            className={`${styles.networkBadge} ${styles[stats.quality]}`}
            title={`Latency: ${stats.rttMs}ms | Packet Loss: ${stats.packetLossPercent}% | Quality: ${stats.quality}`}
          >
            <SignalBars quality={stats.quality} />
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
          <span>{displayName}</span>
          {isSpeaking && (
            <div style={{ display: "inline-flex", alignItems: "flex-end", gap: "2px", height: "10px", margin: "0 2px" }}>
              <span style={{ width: "2px", height: "100%", background: "#10b981", borderRadius: "1px" }} />
              <span style={{ width: "2px", height: "60%", background: "#10b981", borderRadius: "1px" }} />
              <span style={{ width: "2px", height: "80%", background: "#10b981", borderRadius: "1px" }} />
            </div>
          )}
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
          <Wifi size={14} />
          <span>Low Bandwidth Mode: Video paused to prioritize crystal-clear audio</span>
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

      {/* Real-time AI Closed Captions Floating Overlay */}
      {isCaptionsEnabled && currentCaption && (
        <div
          style={{
            position: "absolute",
            bottom: "95px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "rgba(10, 15, 26, 0.92)",
            backdropFilter: "blur(24px)",
            border: "1px solid rgba(255, 255, 255, 0.16)",
            borderRadius: "16px",
            padding: "8px 20px",
            maxWidth: "min(720px, 90vw)",
            color: "#ffffff",
            fontSize: "1rem",
            fontWeight: 500,
            zIndex: 45,
            boxShadow: "0 12px 35px rgba(0, 0, 0, 0.7), 0 0 20px rgba(99, 102, 241, 0.25)",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            pointerEvents: "none",
            animation: "pulseGlow 2s infinite ease-in-out",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              background: "rgba(16, 185, 129, 0.2)",
              border: "1px solid rgba(16, 185, 129, 0.4)",
              color: "#34d399",
              padding: "2px 8px",
              borderRadius: "6px",
              fontSize: "0.7rem",
              fontWeight: 700,
            }}
          >
            <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
            <span>LIVE CC</span>
          </div>
          <span style={{ lineHeight: 1.4 }}>{currentCaption}</span>
        </div>
      )}

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
              <PinOff size={14} />
              <span>Exit Spotlight</span>
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
                  gap: "1rem",
                  padding: "3rem 2rem",
                  background: "rgba(15, 23, 42, 0.45)",
                  backdropFilter: "blur(20px)",
                  border: "1px dashed rgba(99, 102, 241, 0.3)",
                  borderRadius: "24px",
                  color: "#94a3b8",
                  margin: "auto",
                  maxWidth: "540px",
                  textAlign: "center",
                }}
              >
                <div
                  style={{
                    width: "52px",
                    height: "52px",
                    borderRadius: "16px",
                    background: "rgba(99, 102, 241, 0.15)",
                    color: "#818cf8",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Users size={26} />
                </div>
                <div>
                  <h4 style={{ margin: "0 0 0.4rem 0", color: "#f8fafc", fontSize: "1.1rem", fontWeight: 700 }}>
                    Waiting for participants to join
                  </h4>
                  <p style={{ margin: 0, fontSize: "0.875rem", color: "#94a3b8", maxWidth: "380px" }}>
                    Share your meeting invite link with colleagues or team members to start streaming together.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onCopyMeetingLink}
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                    border: "none",
                    color: "white",
                    padding: "10px 20px",
                    borderRadius: "12px",
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    boxShadow: "0 4px 15px rgba(99, 102, 241, 0.35)",
                    transition: "transform 0.2s ease",
                  }}
                  onMouseOver={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                  onMouseOut={(e) => (e.currentTarget.style.transform = "translateY(0)")}
                >
                  {copiedLink ? (
                    <>
                      <Check size={16} />
                      <span>Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>Copy Invite Link</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
