"use client";

import React, { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useRoom } from "@/hooks/useRoom";
import { useMeetingRecorder } from "@/hooks/useMeetingRecorder";
import { formatDuration, formatBytes } from "@/lib/videoStorage";
import { GreenRoomLobby } from "@/components/GreenRoomLobby";
import { WhiteboardModal } from "@/components/WhiteboardModal";
import styles from "@/styles/room.module.scss";

interface VideoFeedProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}

/**
 * A helper component to assign a MediaStream to an HTML5 video tag.
 */
const VideoFeed = ({ stream, muted = false, className }: Readonly<VideoFeedProps>) => {
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

export default function RoomPage({ params }: Readonly<{ params: Promise<{ roomId: string }> }>) {
  const { roomId } = use(params);
  const router = useRouter();
  const { user } = useAuth();
  const [guestName, setGuestName] = useState("");
  const isGuest = !user;
  const localDisplayName = user?.name || guestName?.trim() || "You";
  
  const {
    socket,
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
    isLowBandwidthMode,
    toggleLowBandwidthMode,
    // Collaboration features
    isHost,
    isRoomLocked,
    roomLockedError,
    kickedFromRoom,
    hostNotification,
    raisedHands,
    isLocalHandRaised,
    toggleRaiseHand,
    reactions,
    sendReaction,
    screenSharingPeers,
    hostToggleLock,
    hostMutePeer,
    hostMuteAll,
    hostKickPeer,
  } = useRoom(roomId, user, guestName);

  const [chatInput, setChatInput] = useState("");
  const [unreadCount, setUnreadCount] = useState(0);
  const [spotlightId, setSpotlightId] = useState<string | null>(null);
  const [showReactionsPicker, setShowReactionsPicker] = useState(false);
  const isChatAtBottomRef = useRef(true);
  const chatMessagesRef = useRef<HTMLDivElement | null>(null);

  // In-Call Meeting Recording & Studio hook
  const [showRecordModal, setShowRecordModal] = useState(false);
  const [recordVideoUrl, setRecordVideoUrl] = useState<string | null>(null);

  // Pre-Join "Green Room" Lobby state
  const [hasJoinedLobby, setHasJoinedLobby] = useState(false);

  // Real-Time Collaborative Whiteboard state
  const [showWhiteboard, setShowWhiteboard] = useState(false);

  // Active call duration timer
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  useEffect(() => {
    if (!hasJoinedLobby) return;
    const interval = setInterval(() => {
      setCallDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [hasJoinedLobby]);

  // Collapsible sidebar & tabs
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<"people" | "chat" | "host">("chat");
  const [copiedLink, setCopiedLink] = useState(false);

  const handleCopyMeetingLink = () => {
    if (typeof navigator !== "undefined") {
      void navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const {
    isRecording,
    isPaused,
    recordingSeconds,
    lastSavedRecording,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    downloadRecording,
  } = useMeetingRecorder({
    roomCode: roomId,
    localStream,
    onRecordingComplete: () => {
      setShowRecordModal(true);
    },
  });

  useEffect(() => {
    let isMounted = true;
    if (lastSavedRecording?.blob) {
      const url = URL.createObjectURL(lastSavedRecording.blob);
      void Promise.resolve().then(() => {
        if (isMounted) {
          setRecordVideoUrl(url);
        }
      });
      return () => {
        isMounted = false;
        URL.revokeObjectURL(url);
      };
    } else {
      void Promise.resolve().then(() => {
        if (isMounted) {
          setRecordVideoUrl(null);
        }
      });
    }
    return () => {
      isMounted = false;
    };
  }, [lastSavedRecording]);

  const handleLeave = () => {
    if (isGuest) {
      router.push("/login");
    } else {
      router.push("/dashboard");
    }
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
    const lastMsg = messages.at(-1);

    if (isChatAtBottomRef.current || lastMsg?.isLocal) {
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

  useEffect(() => {
    if (!showRecordModal) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setShowRecordModal(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showRecordModal]);

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

  if (roomLockedError) {
    return (
      <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", background: "rgba(15, 23, 42, 0.8)", padding: "2.5rem", borderRadius: "16px", border: "1px solid #3b82f6" }}>
          <h2 style={{ color: "#ffffff", marginBottom: "0.75rem", fontSize: "1.4rem" }}>🔒 Room is Locked</h2>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
            The meeting host has locked this room. No new participants can join.
          </p>
          <button onClick={() => router.replace("/dashboard")} className={styles.returnButton}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  if (kickedFromRoom) {
    return (
      <div className={styles.roomContainer} style={{ alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", background: "rgba(15, 23, 42, 0.8)", padding: "2.5rem", borderRadius: "16px", border: "1px solid #ef4444" }}>
          <h2 style={{ color: "#ef4444", marginBottom: "0.75rem", fontSize: "1.4rem" }}>🚫 Removed from Meeting</h2>
          <p style={{ color: "#94a3b8", marginBottom: "1.5rem" }}>
            You have been removed from the meeting by the room host.
          </p>
          <button onClick={() => router.replace("/dashboard")} className={styles.returnButton}>
            Return to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Pre-Join "Green Room" Lobby Screen
  if (!hasJoinedLobby) {
    return (
      <GreenRoomLobby
        roomId={roomId}
        userName={localDisplayName}
        isGuest={isGuest}
        guestName={guestName}
        onGuestNameChange={setGuestName}
        localStream={localStream}
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        toggleAudio={toggleAudio}
        toggleVideo={toggleVideo}
        videoDevices={videoDevices}
        audioDevices={audioDevices}
        selectedVideoDeviceId={selectedVideoDeviceId}
        selectedAudioDeviceId={selectedAudioDeviceId}
        switchCamera={switchCamera}
        switchMicrophone={switchMicrophone}
        participantCount={presenceList.length}
        onJoinMeeting={() => {
          setHasJoinedLobby(true);
          const finalName = guestName?.trim() || user?.name || "Guest";
          if (socket) {
            socket.emit("update-name", { name: finalName });
            socket.emit("join-room", { roomId, name: finalName });
          }
        }}
        onCancel={() => (isGuest ? router.push("/login") : router.push("/dashboard"))}
      />
    );
  }

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
            onClick={() => setSpotlightId("local")}
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

  const renderPeerFeed = (peer: (typeof peers)[0], isSpotlight = false, isFilmstrip = false) => {
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
            onClick={() => setSpotlightId(peer.socketId)}
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

  return (
    <div className={styles.roomContainer}>
      {/* Top Header Bar */}
      <header className={styles.topHeaderBar}>
        <div className={styles.headerLeft}>
          <button
            type="button"
            className={styles.meetingBadge}
            onClick={handleCopyMeetingLink}
            title="Click to copy meeting link"
          >
            <span>{roomId}</span>
            <span>{copiedLink ? "✓ Copied" : "📋"}</span>
          </button>
          <span className={styles.securityBadge}>
            🔒 Mesh Encrypted
          </span>
        </div>

        <div className={styles.headerCenter}>
          <div className={styles.callTimer}>
            <span>⏱️</span>
            <span>{formatDuration(callDurationSeconds)}</span>
          </div>
          {isRecording && (
            <div className={styles.recordingBadge} style={{ position: "static" }}>
              <span className={`${styles.recDot} ${isPaused ? styles.pausedDot : ""}`}></span>
              <span className={styles.recText}>
                {isPaused ? "PAUSED" : "REC"} {formatDuration(recordingSeconds)}
              </span>
              <button
                type="button"
                className={styles.recMiniButton}
                onClick={isPaused ? resumeRecording : pauseRecording}
                title={isPaused ? "Resume Recording" : "Pause Recording"}
              >
                {isPaused ? "▶️" : "⏸️"}
              </button>
              <button
                type="button"
                className={styles.recStopButton}
                onClick={stopRecording}
                title="Stop and Save Recording"
              >
                ⏹️
              </button>
            </div>
          )}
        </div>

        <div className={styles.headerRight}>
          <button
            type="button"
            className={`${styles.headerIconBtn} ${isSidebarOpen && sidebarTab === "people" ? styles.active : ""}`}
            onClick={() => {
              if (isSidebarOpen && sidebarTab === "people") {
                setIsSidebarOpen(false);
              } else {
                setIsSidebarOpen(true);
                setSidebarTab("people");
              }
            }}
            title="Participants"
          >
            <span>👥</span>
            <span>{presenceList.length + 1}</span>
          </button>

          <button
            type="button"
            className={`${styles.headerIconBtn} ${isSidebarOpen && sidebarTab === "chat" ? styles.active : ""}`}
            onClick={() => {
              if (isSidebarOpen && sidebarTab === "chat") {
                setIsSidebarOpen(false);
              } else {
                setIsSidebarOpen(true);
                setSidebarTab("chat");
                setUnreadCount(0);
              }
            }}
            title="In-call Chat"
          >
            <span>💬</span>
            <span>Chat</span>
            {unreadCount > 0 && <span className={styles.unreadBadge}>{unreadCount}</span>}
          </button>

          {isHost && (
            <button
              type="button"
              className={`${styles.headerIconBtn} ${isSidebarOpen && sidebarTab === "host" ? styles.active : ""}`}
              onClick={() => {
                if (isSidebarOpen && sidebarTab === "host") {
                  setIsSidebarOpen(false);
                } else {
                  setIsSidebarOpen(true);
                  setSidebarTab("host");
                }
              }}
              title="Host Controls"
            >
              <span>👑</span>
              <span>Host</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Video Section */}
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
                  <button
                    type="button"
                    className={styles.filmstripButton}
                    onClick={() => setSpotlightId("local")}
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
                      onClick={() => setSpotlightId(p.socketId)}
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
                <div style={{
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
                  maxWidth: "520px"
                }}>
                  <span style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f1f5f9" }}>⌛ Waiting for other participants to join...</span>
                  <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", textAlign: "center" }}>
                    Share this room link with your team or invitees so they can join right away.
                  </p>
                  <button
                    type="button"
                    onClick={handleCopyMeetingLink}
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
                      gap: "0.4rem"
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

        {/* Reaction Emoji Picker Popup */}
        {showReactionsPicker && (
          <div className={styles.reactionsPickerBar}>
            {["❤️", "👍", "👏", "🎉", "😂", "🚀"].map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={styles.reactionPickerBtn}
                onClick={() => {
                  sendReaction(emoji);
                  setShowReactionsPicker(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        {/* Floating Bottom Control Dock */}
        <div className={styles.bottomDockContainer}>
          <div className={styles.controls}>
            <button
              onClick={toggleAudio}
              className={`${styles.controlButton} ${isAudioMuted ? styles.active : ""}`}
              title={isAudioMuted ? "Unmute Microphone" : "Mute Microphone"}
            >
              {isAudioMuted ? "🔇" : "🎤"}
            </button>
            <button
              onClick={toggleVideo}
              className={`${styles.controlButton} ${isVideoMuted ? styles.active : ""}`}
              title={isVideoMuted ? "Turn Camera On" : "Turn Camera Off"}
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
              type="button"
              onClick={isRecording ? stopRecording : startRecording}
              className={`${styles.controlButton} ${isRecording ? styles.recordingActive : ""}`}
              title={isRecording ? "Stop Recording" : "Record Meeting"}
            >
              {isRecording ? "⏹️" : "⏺️"}
            </button>
            <button
              type="button"
              onClick={() => setShowWhiteboard((prev) => !prev)}
              className={`${styles.controlButton} ${showWhiteboard ? styles.active : ""}`}
              title={showWhiteboard ? "Close Whiteboard" : "Open Collaborative Whiteboard"}
            >
              🎨
            </button>
            <button
              type="button"
              onClick={toggleRaiseHand}
              className={`${styles.controlButton} ${isLocalHandRaised ? styles.handRaised : ""}`}
              title={isLocalHandRaised ? "Lower Hand" : "Raise Hand"}
            >
              ✋
            </button>
            <button
              type="button"
              onClick={() => setShowReactionsPicker((prev) => !prev)}
              className={`${styles.controlButton} ${showReactionsPicker ? styles.active : ""}`}
              title="Reactions"
            >
              😊
            </button>
            <button
              type="button"
              onClick={toggleLowBandwidthMode}
              className={`${styles.controlButton} ${isLowBandwidthMode ? styles.active : ""}`}
              title={isLowBandwidthMode ? "Disable Low Data Mode" : "Enable Low Data Mode"}
            >
              📶
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSidebarOpen((prev) => !prev);
                setUnreadCount(0);
              }}
              className={`${styles.controlButton} ${isSidebarOpen ? styles.active : ""}`}
              style={isSidebarOpen ? { background: "rgba(59, 130, 246, 0.4)", borderColor: "#3b82f6" } : {}}
              title="Toggle Chat & Participants"
            >
              💬
            </button>
            <button
              onClick={handleLeave}
              className={`${styles.controlButton} ${styles.leave}`}
              title="Leave Call"
            >
              📞
            </button>
          </div>

          {/* Compact device selectors */}
          <div className={styles.deviceSelectors}>
            <select
              className={styles.deviceSelect}
              value={selectedVideoDeviceId}
              onChange={(e) => switchCamera(e.target.value)}
              title="Select Camera"
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
              title="Select Microphone"
            >
              {audioDevices.map((device) => (
                <option key={device.deviceId} value={device.deviceId}>
                  {device.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Right Sidebar: People, Chat, Host Controls */}
      {isSidebarOpen && (
        <aside className={styles.sidebar}>
          {/* Sidebar Tab Switcher */}
          <div style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            paddingBottom: "0.75rem",
          }}>
            <div style={{ display: "flex", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setSidebarTab("people")}
                style={{
                  background: sidebarTab === "people" ? "rgba(59, 130, 246, 0.2)" : "transparent",
                  color: sidebarTab === "people" ? "#60a5fa" : "#94a3b8",
                  border: sidebarTab === "people" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid transparent",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                👥 People ({presenceList.length + 1})
              </button>
              <button
                type="button"
                onClick={() => {
                  setSidebarTab("chat");
                  setUnreadCount(0);
                }}
                style={{
                  background: sidebarTab === "chat" ? "rgba(59, 130, 246, 0.2)" : "transparent",
                  color: sidebarTab === "chat" ? "#60a5fa" : "#94a3b8",
                  border: sidebarTab === "chat" ? "1px solid rgba(59, 130, 246, 0.4)" : "1px solid transparent",
                  padding: "4px 10px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                💬 Chat {unreadCount > 0 ? `(${unreadCount})` : ""}
              </button>
              {isHost && (
                <button
                  type="button"
                  onClick={() => setSidebarTab("host")}
                  style={{
                    background: sidebarTab === "host" ? "rgba(234, 179, 8, 0.2)" : "transparent",
                    color: sidebarTab === "host" ? "#facc15" : "#94a3b8",
                    border: sidebarTab === "host" ? "1px solid rgba(234, 179, 8, 0.4)" : "1px solid transparent",
                    padding: "4px 10px",
                    borderRadius: "8px",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  👑 Host
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => setIsSidebarOpen(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "#94a3b8",
                fontSize: "1.1rem",
                cursor: "pointer",
                padding: "2px 6px",
              }}
              title="Close Sidebar"
            >
              ✕
            </button>
          </div>

          {/* People Tab Content */}
          {sidebarTab === "people" && (
            <ul className={styles.userList} style={{ maxHeight: "none", flex: 1 }}>
              {/* Local User */}
              <li className={styles.userItem}>
                <div className={styles.userAvatar}>
                  {(localDisplayName || "U")[0].toUpperCase()}
                </div>
                <div className={styles.userInfo}>
                  <span className={styles.name}>{localDisplayName} (You)</span>
                  <span className={styles.status}>🟢 Active</span>
                </div>
                <div className={styles.userActions}>
                  {isHost && <span className={styles.hostBadgeSmall}>👑 Host</span>}
                  {isLocalHandRaised && <span className={styles.handBadgeSmall} title="Hand Raised">✋</span>}
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
                const isPeerHost = Boolean(presenceUser.isHost || matchedPeer?.isHost);
                const isHandRaised = raisedHands.some((h) => h.socketId === presenceUser.socketId);

                return (
                  <li key={presenceUser.socketId} className={styles.userItem}>
                    <div className={styles.userAvatar}>
                      {(displayName || "P")[0].toUpperCase()}
                    </div>
                    <div className={styles.userInfo}>
                      <span className={styles.name}>{displayName}</span>
                      <span className={styles.status}>🟢 Active</span>
                    </div>
                    <div className={styles.userActions}>
                      {isPeerHost && <span className={styles.hostBadgeSmall}>👑 Host</span>}
                      {isHandRaised && <span className={styles.handBadgeSmall} title="Hand Raised">✋</span>}
                      {isHost && (
                        <div className={styles.hostPeerButtons}>
                          <button
                            type="button"
                            onClick={() => hostMutePeer(presenceUser.socketId)}
                            className={styles.hostMuteBtn}
                            title={`Mute ${displayName}`}
                          >
                            🔇
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (window.confirm(`Remove ${displayName} from the meeting?`)) {
                                hostKickPeer(presenceUser.socketId);
                              }
                            }}
                            className={styles.hostKickBtn}
                            title={`Remove ${displayName} from meeting`}
                          >
                            ❌
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {/* Host Controls Tab Content */}
          {sidebarTab === "host" && isHost && (
            <div className={styles.hostControlsPanel} style={{ margin: 0 }}>
              <div className={styles.hostHeader}>
                <span>👑 Host Governance</span>
                <span className={styles.hostBadge}>{isRoomLocked ? "🔒 Locked" : "🔓 Open"}</span>
              </div>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#94a3b8" }}>
                Manage meeting security and participant permissions in real-time.
              </p>
              <div className={styles.hostActionsRow}>
                <button
                  type="button"
                  onClick={hostToggleLock}
                  className={`${styles.hostActionButton} ${isRoomLocked ? styles.locked : ""}`}
                  title={isRoomLocked ? "Unlock Meeting for New Participants" : "Lock Meeting to Current Participants"}
                >
                  {isRoomLocked ? "🔓 Unlock Room" : "🔒 Lock Room"}
                </button>
                <button
                  type="button"
                  onClick={hostMuteAll}
                  className={styles.hostActionButton}
                  title="Mute all other participants' microphones"
                >
                  🔇 Mute All
                </button>
              </div>
            </div>
          )}

          {/* Chat Tab Content */}
          {sidebarTab === "chat" && (
            <div className={styles.chatSection} style={{ borderTop: "none", paddingTop: 0 }}>
              <div
                className={styles.chatMessages}
                ref={chatMessagesRef}
                onScroll={handleChatScroll}
              >
                {messages.length === 0 && (
                  <div style={{ textAlign: "center", color: "#64748b", fontSize: "0.82rem", margin: "auto 0" }}>
                    No messages yet. Send a message to everyone in the room!
                  </div>
                )}
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
          )}
        </aside>
      )}

      {/* Post-Recording Completion Modal */}
      {showRecordModal && lastSavedRecording && (
        <div className={styles.recordingModalOverlay}>
          <button
            type="button"
            className={styles.modalBackdrop}
            onClick={() => setShowRecordModal(false)}
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
                onClick={() => setShowRecordModal(false)}
              >
                ✕
              </button>
            </div>

            {recordVideoUrl && (
              <div className={styles.recordingVideoContainer}>
                <video
                  src={recordVideoUrl}
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
                <span className={styles.metaValue}>{formatDuration(lastSavedRecording.durationSeconds)}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>File Size</span>
                <span className={styles.metaValue}>{formatBytes(lastSavedRecording.sizeBytes)}</span>
              </div>
              <div className={styles.metaCard}>
                <span className={styles.metaLabel}>Room</span>
                <span className={styles.metaValue}>{lastSavedRecording.roomCode}</span>
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
                onClick={() => downloadRecording(lastSavedRecording)}
              >
                ⬇️ Download .webm Video
              </button>
              <button
                type="button"
                className={styles.viewStudioBtn}
                onClick={() => {
                  setShowRecordModal(false);
                  router.push("/dashboard/videos");
                }}
              >
                🎬 View in My Videos Studio
              </button>
              <button
                type="button"
                className={styles.dismissRecBtn}
                onClick={() => setShowRecordModal(false)}
              >
                Dismiss
              </button>
            </div>
          </dialog>
        </div>
      )}

      {/* Real-Time Collaborative Whiteboard Modal */}
      <WhiteboardModal
        isOpen={showWhiteboard}
        onClose={() => setShowWhiteboard(false)}
        socket={socket}
        roomId={roomId}
      />
    </div>
  );
}
