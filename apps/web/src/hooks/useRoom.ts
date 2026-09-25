import { useEffect, useRef, useState } from "react";
import { io, Socket } from "socket.io-client";

// STUN alone is usually enough on a shared LAN. Once peers are on separate
// networks (e.g. testing over the internet via ngrok), a symmetric NAT or
// restrictive firewall can block direct P2P entirely, so a TURN relay is
// needed as a fallback. The Open Relay Project's shared public TURN
// credentials used here previously are community-shared and go dead
// unpredictably (confirmed via chrome://webrtc-internals: "ICE failed, your
// TURN server appears to be broken"), so TURN credentials are now fetched
// from a dedicated Metered.ca account per-user at connect time instead of
// hardcoded — see fetchIceServers below. Sign up free at
// https://dashboard.metered.ca, create an app, and set
// NEXT_PUBLIC_METERED_DOMAIN / NEXT_PUBLIC_METERED_API_KEY.
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

// Fetches short-lived TURN credentials from Metered.ca. Falls back to
// STUN-only (no TURN) if the env vars aren't set or the request fails —
// direct P2P still works on permissive networks, but calls across strict
// NATs/firewalls will fail without a working TURN relay.
const fetchIceServers = async (): Promise<RTCIceServer[]> => {
  const domain = process.env.NEXT_PUBLIC_METERED_DOMAIN;
  const apiKey = process.env.NEXT_PUBLIC_METERED_API_KEY;

  if (!domain || !apiKey) {
    console.warn(
      "[WebRTC] NEXT_PUBLIC_METERED_DOMAIN/NEXT_PUBLIC_METERED_API_KEY not set — using STUN-only ICE config. Cross-network calls behind strict NATs will fail without TURN."
    );
    return FALLBACK_ICE_SERVERS;
  }

  try {
    const res = await fetch(`https://${domain}/api/v1/turn/credentials?apiKey=${apiKey}`);
    if (!res.ok) throw new Error(`Metered credentials request failed: ${res.status}`);
    const turnServers: RTCIceServer[] = await res.json();
    return [...FALLBACK_ICE_SERVERS, ...turnServers];
  } catch (err) {
    console.error("[WebRTC] Failed to fetch Metered TURN credentials, falling back to STUN-only:", err);
    return FALLBACK_ICE_SERVERS;
  }
};

export interface Peer {
  socketId: string;
  userId: string;
  name?: string;
  stream: MediaStream;
  isHost?: boolean;
}

export interface PresenceUser {
  socketId: string;
  userId: string;
  name?: string;
  isHost?: boolean;
}

export interface HandRaisedUser {
  socketId: string;
  userId: string;
  name: string;
}

export interface FloatingReaction {
  id: string;
  emoji: string;
  fromName: string;
  fromSocketId: string;
}

export interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

export interface ChatMessage {
  userId?: string;
  name?: string;
  message: string;
  at: number;
  isLocal: boolean;
}

export interface NetworkQualityStats {
  quality: "good" | "fair" | "poor";
  rttMs: number;
  packetLossPercent: number;
  connectionState: string;
  isReconnecting: boolean;
}

// Gentle synthetic chime played using Web Audio API when a remote chat message arrives
const playChatChime = () => {
  try {
    const AudioCtx =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.08); // A5

    gain.gain.setValueAtTime(0.06, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.25);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 400);
  } catch {
    // Audio autoplay restrictions on un-interacted windows
  }
};

// Playful pop sound when a reaction arrives
const playReactionPop = () => {
  try {
    const AudioCtx =
      typeof window !== "undefined"
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = "sine";
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(0.04, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 250);
  } catch {
    // ignore
  }
};

const removePeerFromList = (list: PresenceUser[], socketId: string, userId?: string) =>
  list.filter((p) => p.socketId !== socketId && (!userId || p.userId !== userId));

const addPeerToList = (list: PresenceUser[], item: PresenceUser) => [
  ...list.filter((p) => p.userId !== item.userId && p.socketId !== item.socketId),
  item,
];

const updatePeerDetails = (
  list: Peer[],
  socketId: string,
  ansUserId?: string,
  ansName?: string,
  isHost?: boolean
) =>
  list.map((p) =>
    p.socketId === socketId || (ansUserId && p.userId === ansUserId)
      ? {
          ...p,
          userId: ansUserId || p.userId,
          name: ansName || p.name,
          isHost: isHost !== undefined ? isHost : p.isHost,
        }
      : p
  );

/**
 * Custom React hook for WebRTC multi-peer video rooms and signaling.
 * Handles local media stream, Socket.IO connections, WebRTC peer connections, and presence list.
 */
export const useRoom = (roomId: string, user: { id: string; name: string; email: string } | null) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [presenceList, setPresenceList] = useState<PresenceUser[]>([]);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([]);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceOption[]>([]);
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>("");
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>("");
  const [roomNotFound, setRoomNotFound] = useState(false);
  const [roomFull, setRoomFull] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [speakingMap, setSpeakingMap] = useState<{ [id: string]: boolean }>({});
  const [networkQuality, setNetworkQuality] = useState<{ [socketId: string]: NetworkQualityStats }>({});
  const [isLowBandwidthMode, setIsLowBandwidthMode] = useState(false);
  const isLowBandwidthModeRef = useRef(false);

  // Pillar 2 (Option 2) Collaboration states: Host controls, Hand raise, Reactions, Screen share
  const [isHost, setIsHost] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [roomLockedError, setRoomLockedError] = useState(false);
  const [kickedFromRoom, setKickedFromRoom] = useState(false);
  const [hostNotification, setHostNotification] = useState<string | null>(null);
  const [raisedHands, setRaisedHands] = useState<HandRaisedUser[]>([]);
  const [isLocalHandRaised, setIsLocalHandRaised] = useState(false);
  const [screenSharingPeers, setScreenSharingPeers] = useState<Set<string>>(new Set());
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const iceCandidatesQueueRef = useRef<{ [socketId: string]: RTCIceCandidateInit[] }>({});
  const iceServersRef = useRef<RTCIceServer[]>(FALLBACK_ICE_SERVERS);
  // The original camera video track, stashed while screen sharing is active
  // so it can be restored without re-requesting getUserMedia.
  const cameraTrackRef = useRef<MediaStreamTrack | null>(null);
  // Tracks which side originally sent the offer for each peer connection, so that
  // only the offerer attempts an ICE restart on failure (avoids both sides
  // racing to renegotiate at once).
  const peerRolesRef = useRef<{ [socketId: string]: "offerer" | "answerer" }>({});
  // Backoff state for ICE restarts — without this, a persistently broken
  // TURN path retries instantly forever, hammering the signaling server and
  // burning TURN quota instead of surfacing that the connection is unrecoverable.
  const iceRestartAttemptsRef = useRef<{ [socketId: string]: number }>({});
  const iceRestartTimeoutRef = useRef<{ [socketId: string]: ReturnType<typeof setTimeout> }>({});
  const peerDetailsRef = useRef<{ [socketId: string]: { userId?: string; name?: string; isHost?: boolean } }>({});
  const isAudioMutedRef = useRef(false);
  const audioAnalysersRef = useRef<{
    [key: string]: {
      context: AudioContext;
      analyser: AnalyserNode;
      source: MediaStreamAudioSourceNode;
    };
  }>({});

  // Helper to attach Web Audio Analyser to monitor microphone volume for Active Speaker Detection
  const attachAudioAnalyser = (key: string, stream: MediaStream) => {
    try {
      const audioTracks = stream.getAudioTracks();
      if (audioTracks.length === 0) return;

      detachAudioAnalyser(key);

      const AudioCtx =
        typeof window !== "undefined"
          ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
          : null;
      if (!AudioCtx) return;

      const context = new AudioCtx();
      const analyser = context.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.3;
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);

      audioAnalysersRef.current[key] = { context, analyser, source };
    } catch (err) {
      console.warn(`[WebAudio] Could not attach analyser for ${key}:`, err);
    }
  };

  const detachAudioAnalyser = (key: string) => {
    const item = audioAnalysersRef.current[key];
    if (item) {
      try {
        item.source.disconnect();
        item.analyser.disconnect();
        item.context.close().catch(() => {});
      } catch {
        // ignore
      }
      delete audioAnalysersRef.current[key];
    }
  };

  // Helper to process queued ICE candidates once remoteDescription is set
  const processQueuedCandidates = async (socketId: string) => {
    const peerConnection = peerConnectionsRef.current[socketId];
    const queue = iceCandidatesQueueRef.current[socketId];
    if (peerConnection && queue && queue.length > 0) {
      for (const cand of queue) {
        if (cand?.candidate) {
          try {
            await peerConnection.addIceCandidate(cand);
          } catch (e) {
            console.error("Error adding queued ICE candidate:", e);
          }
        }
      }
      delete iceCandidatesQueueRef.current[socketId];
    }
  };

  useEffect(() => {
    if (!user) return;

    let isCancelled = false;
    let acquiredStream: MediaStream | null = null;
    let activeSocket: Socket | null = null;

    // 1. Fetch Local Stream with fallback if camera is locked by another tab (NotReadableError)
    const acquireUserMedia = async (): Promise<MediaStream> => {
      try {
        return await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      } catch (err: any) {
        console.warn("Camera+mic access failed, attempting fallback:", err.name, err.message);

        let audioStream: MediaStream | null = null;
        try {
          audioStream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        } catch (audioErr) {
          console.warn("Audio-only access also unavailable:", audioErr);
        }

        // Create fallback canvas video stream (e.g. for second tab on Linux where /dev/video0 is locked)
        const canvas = document.createElement("canvas");
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#0f172a";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.fillStyle = "#6366f1";
          ctx.beginPath();
          ctx.arc(320, 140, 45, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 32px sans-serif";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText((user?.name || "U")[0].toUpperCase(), 320, 140);
          ctx.font = "16px sans-serif";
          ctx.fillStyle = "#94a3b8";
          ctx.fillText(user?.name || "User", 320, 210);
          ctx.font = "14px sans-serif";
          ctx.fillStyle = "#f59e0b";
          ctx.fillText("(Camera in use by another tab/app)", 320, 240);
        }
        const canvasStream = (canvas as any).captureStream ? (canvas as any).captureStream(15) : null;
        const videoTrack = canvasStream?.getVideoTracks()[0];
        const combinedTracks: MediaStreamTrack[] = videoTrack ? [videoTrack] : [];
        if (audioStream) {
          audioStream.getAudioTracks().forEach((t) => combinedTracks.push(t));
        }
        return new MediaStream(combinedTracks);
      }
    };

    Promise.all([acquireUserMedia(), fetchIceServers()])
      .then(([stream, iceServers]) => {
        if (isCancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        iceServersRef.current = iceServers;
        acquiredStream = stream;
        setLocalStream(stream);
        localStreamRef.current = stream;

        // Record which devices are active, then list all available ones
        setSelectedVideoDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId || "");
        setSelectedAudioDeviceId(stream.getAudioTracks()[0]?.getSettings().deviceId || "");
        refreshDeviceList();
        navigator.mediaDevices.addEventListener("devicechange", refreshDeviceList);

        // 2. Connect to Socket Server
        const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:5000";
        const token = typeof window !== "undefined" ? localStorage.getItem("accessToken") : null;
        const socket = io(socketUrl, {
          transports: ["websocket", "polling"],
          auth: { token },
          extraHeaders: { "ngrok-skip-browser-warning": "true" },
        });
        activeSocket = socket;
        socketRef.current = socket;

        // Join room once connected
        socket.on("connect", () => {
          socket.emit("join-room", {
            roomId,
            name: user.name,
          });
        });

        socket.on("connect_error", (err) => {
          console.error("[Socket] Handshake / authentication error:", err.message);
        });

        socket.on("rate-limit", ({ action, message }: { action: string; message: string }) => {
          console.warn(`[Socket Rate Limit] ${action}: ${message}`);
        });

        socket.on("room-not-found", () => {
          setRoomNotFound(true);
        });

        socket.on("room-full", () => {
          setRoomFull(true);
        });

        socket.on("room-info", ({ isHost: hostFlag, isLocked }: { isHost: boolean; isLocked: boolean }) => {
          setIsHost(hostFlag);
          setIsRoomLocked(isLocked);
        });

        socket.on("room-locked", () => {
          setRoomLockedError(true);
        });

        socket.on("room-lock-changed", ({ isLocked }: { isLocked: boolean }) => {
          setIsRoomLocked(isLocked);
        });

        socket.on("muted-by-host", ({ message }: { message: string }) => {
          if (localStreamRef.current) {
            const audioTrack = localStreamRef.current.getAudioTracks()[0];
            if (audioTrack) {
              audioTrack.enabled = false;
            }
          }
          setIsAudioMuted(true);
          isAudioMutedRef.current = true;
          setSpeakingMap((prev) => ({ ...prev, local: false }));
          setHostNotification(message || "You were muted by the meeting host");
          setTimeout(() => setHostNotification(null), 5000);
        });

        socket.on("kicked-by-host", ({ message }: { message: string }) => {
          setKickedFromRoom(true);
          setHostNotification(message || "You were removed from the meeting by the host");
          if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
          }
          socket.disconnect();
        });

        socket.on(
          "peer-hand-toggled",
          ({ socketId, userId: uId, name: uName, isRaised }: { socketId: string; userId: string; name: string; isRaised: boolean }) => {
            setRaisedHands((prev) => {
              if (isRaised) {
                if (prev.some((h) => h.socketId === socketId)) return prev;
                return [...prev, { socketId, userId: uId, name: uName }];
              } else {
                return prev.filter((h) => h.socketId !== socketId);
              }
            });
          }
        );

        socket.on("reaction-received", (reaction: FloatingReaction) => {
          playReactionPop();
          setReactions((prev) => [...prev, reaction]);
          setTimeout(() => {
            setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
          }, 3500);
        });

        socket.on("peer-screen-share", ({ socketId, isSharing }: { socketId: string; isSharing: boolean }) => {
          setScreenSharingPeers((prev) => {
            const next = new Set(prev);
            if (isSharing) {
              next.add(socketId);
            } else {
              next.delete(socketId);
            }
            return next;
          });
        });

        // Server replays persisted chat history right after join, so a
        // page refresh doesn't lose prior messages in this room.
        socket.on("chat-history", ({ messages: history }: { messages: { userId?: string; name?: string; message: string; at: number }[] }) => {
          setMessages(
            history.map((m) => ({ ...m, isLocal: m.userId === user.id }))
          );
        });

        // 3. Handle Room users & Presence
        socket.on("room-users", async ({ users }: { users: PresenceUser[] }) => {
          // Filter out self and deduplicate by userId
          const filteredUsers: PresenceUser[] = [];
          const seen = new Set<string>();
          for (const u of users) {
            if (u.socketId) {
              peerDetailsRef.current[u.socketId] = { userId: u.userId, name: u.name, isHost: u.isHost };
            }
            if (u.userId !== user.id && !seen.has(u.userId)) {
              seen.add(u.userId);
              filteredUsers.push(u);
            }
          }
          setPresenceList(filteredUsers);

          // The newly joined user initiates the peer connection with all existing peers
          for (const existingUser of filteredUsers) {
            await initiateCall(existingUser.socketId, existingUser.userId, existingUser.name, stream);
          }
        });

        socket.on("user-joined", (joinedUser: PresenceUser) => {
          // Never add self to presence list
          if (joinedUser.userId === user.id) return;

          if (joinedUser.socketId) {
            peerDetailsRef.current[joinedUser.socketId] = {
              userId: joinedUser.userId,
              name: joinedUser.name,
              isHost: joinedUser.isHost,
            };
          }
          setPresenceList((prev) => addPeerToList(prev, joinedUser));
          if (joinedUser.name) {
            setPeers((prev) => updatePeerDetails(prev, joinedUser.socketId, joinedUser.userId, joinedUser.name, joinedUser.isHost));
          }
        });

        socket.on("user-left", ({ socketId, userId }: { socketId: string; userId?: string }) => {
          // Remove from presence list
          setPresenceList((prev) => removePeerFromList(prev, socketId, userId));
          // Remove from hand raise queue and screen sharing set if present
          setRaisedHands((prev) => prev.filter((h) => h.socketId !== socketId));
          setScreenSharingPeers((prev) => {
            const next = new Set(prev);
            next.delete(socketId);
            return next;
          });
          // Remove peer connection and stream
          closePeerConnection(socketId);
        });

        // 4. WebRTC Signaling Listeners
        socket.on(
          "offer",
          async ({
            from,
            offer,
            userId: offerUserId,
            name: offerName,
          }: {
            from: string;
            offer: RTCSessionDescriptionInit;
            userId?: string;
            name?: string;
          }) => {
            if (!peerRolesRef.current[from]) {
              peerRolesRef.current[from] = "answerer";
            }
            if (from) {
              peerDetailsRef.current[from] = {
                userId: offerUserId || peerDetailsRef.current[from]?.userId,
                name: offerName || peerDetailsRef.current[from]?.name,
              };
            }
            if (offerUserId || offerName) {
              setPeers((prev) => updatePeerDetails(prev, from, offerUserId, offerName));
              setPresenceList((prev) =>
                prev.map((p) =>
                  p.socketId === from || (offerUserId && p.userId === offerUserId)
                    ? { ...p, name: offerName || p.name, userId: offerUserId || p.userId }
                    : p
                )
              );
            }
            const peerConnection = createPeerConnection(from, stream, offerUserId, offerName);
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);

            // Apply queued candidates after setting answer local description
            await processQueuedCandidates(from);

            socket.emit("answer", {
              to: from,
              answer,
              userId: user.id,
              name: user.name,
            });
          }
        );

        socket.on(
          "answer",
          async ({
            from,
            answer,
            userId: ansUserId,
            name: ansName,
          }: {
            from: string;
            answer: RTCSessionDescriptionInit;
            userId?: string;
            name?: string;
          }) => {
            const peerConnection = peerConnectionsRef.current[from];
            if (peerConnection) {
              await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
              await processQueuedCandidates(from);

              if (from) {
                peerDetailsRef.current[from] = {
                  userId: ansUserId || peerDetailsRef.current[from]?.userId,
                  name: ansName || peerDetailsRef.current[from]?.name,
                };
              }

              if (ansUserId || ansName) {
                setPeers((prev) => updatePeerDetails(prev, from, ansUserId, ansName));
                setPresenceList((prev) =>
                  prev.map((p) =>
                    p.socketId === from || (ansUserId && p.userId === ansUserId)
                      ? { ...p, name: ansName || p.name, userId: ansUserId || p.userId }
                      : p
                  )
                );
              }
            }
          }
        );

        socket.on(
          "ice-candidate",
          async ({ from, candidate }: { from: string; candidate: RTCIceCandidateInit }) => {
            const peerConnection = peerConnectionsRef.current[from];
            if (peerConnection?.remoteDescription?.type) {
              if (candidate?.candidate) {
                try {
                  await peerConnection.addIceCandidate(candidate);
                } catch (e) {
                  console.error("Error adding direct ICE candidate:", e);
                }
              }
            } else {
              if (!iceCandidatesQueueRef.current[from]) {
                iceCandidatesQueueRef.current[from] = [];
              }
              iceCandidatesQueueRef.current[from].push(candidate);
            }
          }
        );

        socket.on(
          "chat-message",
          ({ userId: fromUserId, name, message, at }: { userId?: string; name?: string; message: string; at: number }) => {
            playChatChime();
            setMessages((prev) => [
              ...prev,
              { userId: fromUserId, name, message, at, isLocal: false },
            ]);
          }
        );
      })
      .catch((err) => {
        console.error("Accessing media devices failed:", err);
      });

    // Cleanup on unmount
    return () => {
      isCancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", refreshDeviceList);

      if (acquiredStream) {
        acquiredStream.getTracks().forEach((track) => track.stop());
      }
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      Object.keys(peerConnectionsRef.current).forEach((socketId) => {
        closePeerConnection(socketId);
      });

      if (activeSocket) {
        activeSocket.emit("leave-room");
        activeSocket.disconnect();
      }
      if (socketRef.current && socketRef.current !== activeSocket) {
        socketRef.current.emit("leave-room");
        socketRef.current.disconnect();
      }
      iceCandidatesQueueRef.current = {};
      peerDetailsRef.current = {};
      Object.keys(audioAnalysersRef.current).forEach((key) => {
        detachAudioAnalyser(key);
      });
    };
  }, [roomId, user]);

  // Hook audio analyser to localStream
  useEffect(() => {
    if (localStream) {
      attachAudioAnalyser("local", localStream);
    }
    return () => {
      detachAudioAnalyser("local");
    };
  }, [localStream]);

  // Hook audio analysers to remote peer streams
  useEffect(() => {
    peers.forEach((peer) => {
      if (peer.stream && !audioAnalysersRef.current[peer.socketId]) {
        attachAudioAnalyser(peer.socketId, peer.stream);
      }
    });

    const currentSockets = new Set(peers.map((p) => p.socketId));
    Object.keys(audioAnalysersRef.current).forEach((key) => {
      if (key !== "local" && !currentSockets.has(key)) {
        detachAudioAnalyser(key);
      }
    });
  }, [peers]);

  // Periodic active speaker volume detection (every 120ms)
  useEffect(() => {
    const buffer = new Uint8Array(128);
    const interval = setInterval(() => {
      const activeAnalysers = audioAnalysersRef.current;
      const updates: { [id: string]: boolean } = {};

      for (const [key, item] of Object.entries(activeAnalysers)) {
        if (key === "local" && isAudioMutedRef.current) {
          updates[key] = false;
          continue;
        }
        try {
          if (item.context.state === "suspended") {
            item.context.resume().catch(() => {});
          }
          item.analyser.getByteFrequencyData(buffer);
          let sum = 0;
          for (let i = 0; i < buffer.length; i++) {
            sum += buffer[i];
          }
          const avg = sum / buffer.length;
          // Voice threshold
          updates[key] = avg > 14;
        } catch {
          updates[key] = false;
        }
      }

      setSpeakingMap((prev) => {
        let changed = false;
        for (const [k, v] of Object.entries(updates)) {
          if (prev[k] !== v) {
            changed = true;
            break;
          }
        }
        return changed ? { ...prev, ...updates } : prev;
      });
    }, 120);

    return () => clearInterval(interval);
  }, []);

  // Periodic WebRTC Network Quality stats poll (every 2.5s)
  useEffect(() => {
    const interval = setInterval(async () => {
      const pcs = peerConnectionsRef.current;
      const statsMap: { [socketId: string]: NetworkQualityStats } = {};

      for (const [socketId, pc] of Object.entries(pcs)) {
        if (!pc) continue;
        try {
          const stats = await pc.getStats();
          let rttMs = 0;
          let packetsLost = 0;
          let packetsReceived = 0;

          stats.forEach((report) => {
            if (report.type === "candidate-pair" && (report.nominated || report.state === "succeeded")) {
              if (typeof report.currentRoundTripTime === "number") {
                rttMs = Math.round(report.currentRoundTripTime * 1000);
              }
            }
            if (report.type === "inbound-rtp") {
              if (typeof report.packetsLost === "number") packetsLost += report.packetsLost;
              if (typeof report.packetsReceived === "number") packetsReceived += report.packetsReceived;
            }
          });

          const total = packetsLost + packetsReceived;
          const packetLossPercent = total > 0 ? Math.round((packetsLost / total) * 100) : 0;
          const connState = pc.connectionState || pc.iceConnectionState || "connected";
          const isReconnecting =
            connState === "connecting" ||
            pc.iceConnectionState === "checking" ||
            pc.iceConnectionState === "disconnected";

          let quality: "good" | "fair" | "poor" = "good";
          if (rttMs > 300 || packetLossPercent > 5) {
            quality = "poor";
          } else if (rttMs > 150 || packetLossPercent > 2) {
            quality = "fair";
          }

          statsMap[socketId] = {
            quality,
            rttMs,
            packetLossPercent,
            connectionState: connState,
            isReconnecting,
          };
        } catch {
          // ignore closed connection
        }
      }

      setNetworkQuality(statsMap);
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Initiate an RTC connection with an existing peer (from the room-users list)
  const initiateCall = async (
    targetSocketId: string,
    targetUserId: string,
    targetName: string | undefined,
    stream: MediaStream
  ) => {
    peerRolesRef.current[targetSocketId] = "offerer";
    const peerConnection = createPeerConnection(targetSocketId, stream, targetUserId, targetName);

    const offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    socketRef.current?.emit("offer", {
      to: targetSocketId,
      offer,
      userId: user?.id,
      name: user?.name,
    });
  };

  const MAX_ICE_RESTART_ATTEMPTS = 5;

  // Re-negotiates a stuck/failed connection by having the original offerer
  // generate a fresh offer with iceRestart, gathering new ICE candidates.
  // The answerer's existing "offer" handler already treats this like any
  // other offer, so no special handling is needed on that side. Retries use
  // exponential backoff and give up after MAX_ICE_RESTART_ATTEMPTS, since a
  // persistently broken TURN path (e.g. UDP blocked on the network, or the
  // TURN server itself being unreachable) will never succeed no matter how
  // many times we retry, and hammering it instantly forever just wastes
  // TURN quota and spams the signaling server.
  const restartIce = (peerSocketId: string, peerConnection: RTCPeerConnection) => {
    if (peerRolesRef.current[peerSocketId] !== "offerer") return;

    const attempts = iceRestartAttemptsRef.current[peerSocketId] || 0;
    if (attempts >= MAX_ICE_RESTART_ATTEMPTS) {
      console.error(
        `❌ [WebRTC] Giving up on ${peerSocketId} after ${attempts} failed ICE restarts — the TURN relay appears unreachable from this network. Check about:webrtc / chrome://webrtc-internals for the exact candidate-pair failure.`
      );
      return;
    }

    clearTimeout(iceRestartTimeoutRef.current[peerSocketId]);
    iceRestartAttemptsRef.current[peerSocketId] = attempts + 1;
    const delay = Math.min(1000 * 2 ** attempts, 15000);

    iceRestartTimeoutRef.current[peerSocketId] = setTimeout(async () => {
      // The connection may have recovered on its own during the backoff delay.
      if (peerConnection.iceConnectionState !== "failed") return;
      try {
        console.warn(
          `🔄 [WebRTC] Attempting ICE restart (${attempts + 1}/${MAX_ICE_RESTART_ATTEMPTS}) for ${peerSocketId}`
        );
        const offer = await peerConnection.createOffer({ iceRestart: true });
        await peerConnection.setLocalDescription(offer);
        socketRef.current?.emit("offer", {
          to: peerSocketId,
          offer,
          userId: user?.id,
          name: user?.name,
        });
      } catch (err) {
        console.error(`ICE restart failed for ${peerSocketId}:`, err);
      }
    }, delay);
  };

  // Helper to create and configure an RTCPeerConnection
  const createPeerConnection = (
    peerSocketId: string,
    stream: MediaStream,
    peerUserId?: string,
    peerName?: string
  ): RTCPeerConnection => {
    if (peerUserId || peerName) {
      peerDetailsRef.current[peerSocketId] = {
        userId: peerUserId || peerDetailsRef.current[peerSocketId]?.userId,
        name: peerName || peerDetailsRef.current[peerSocketId]?.name,
      };
    }

    // If connection already exists, return it
    if (peerConnectionsRef.current[peerSocketId]) {
      return peerConnectionsRef.current[peerSocketId];
    }

    const peerConnection = new RTCPeerConnection({ iceServers: iceServersRef.current });
    peerConnectionsRef.current[peerSocketId] = peerConnection;

    // Add local tracks to the connection
    stream.getTracks().forEach((track) => {
      peerConnection.addTrack(track, stream);
    });

    // Add connection state logging
    peerConnection.onconnectionstatechange = () => {
      console.log(`📡 [WebRTC] Connection state (${peerSocketId}): ${peerConnection.connectionState}`);
    };

    peerConnection.oniceconnectionstatechange = () => {
      console.log(`🧊 [WebRTC] ICE connection state (${peerSocketId}): ${peerConnection.iceConnectionState}`);
      if (peerConnection.iceConnectionState === "connected" || peerConnection.iceConnectionState === "completed") {
        iceRestartAttemptsRef.current[peerSocketId] = 0;
      }
      if (peerConnection.iceConnectionState === "failed") {
        restartIce(peerSocketId, peerConnection);
      }
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current?.emit("ice-candidate", {
          to: peerSocketId,
          candidate: event.candidate,
        });
      }
    };

    // When remote track is received
    peerConnection.ontrack = (event) => {
      console.log(`🎥 [WebRTC] Remote track received (${event.track.kind}) from ${peerSocketId}`);
      const remoteStream =
        event.streams?.[0] ?? new MediaStream([event.track]);

      const details = peerDetailsRef.current[peerSocketId];
      const effectiveUserId = peerUserId || details?.userId || "";
      const effectiveName = peerName || details?.name;

      if (event.track.kind === "video" && isLowBandwidthModeRef.current) {
        event.track.enabled = false;
      }

      setPeers((prev) => {
        const existingPeerIndex = prev.findIndex(
          (p) => p.socketId === peerSocketId || (effectiveUserId && p.userId === effectiveUserId)
        );

        if (existingPeerIndex !== -1) {
          const existingPeer = prev[existingPeerIndex];
          if (event.track && !existingPeer.stream.getTracks().some((t) => t.id === event.track.id)) {
            existingPeer.stream.addTrack(event.track);
          }
          const updatedPeers = [...prev];
          updatedPeers[existingPeerIndex] = {
            ...existingPeer,
            socketId: peerSocketId,
            userId: effectiveUserId || existingPeer.userId,
            name: effectiveName || existingPeer.name,
            stream: existingPeer.stream,
          };
          return updatedPeers;
        }

        return [
          ...prev,
          {
            socketId: peerSocketId,
            userId: effectiveUserId,
            name: effectiveName,
            stream: remoteStream,
          },
        ];
      });
    };

    return peerConnection;
  };

  // Helper to close a specific Peer Connection
  const closePeerConnection = (socketId: string) => {
    const peerConnection = peerConnectionsRef.current[socketId];
    if (peerConnection) {
      peerConnection.close();
      delete peerConnectionsRef.current[socketId];
    }
    delete peerRolesRef.current[socketId];
    delete iceRestartAttemptsRef.current[socketId];
    clearTimeout(iceRestartTimeoutRef.current[socketId]);
    delete iceRestartTimeoutRef.current[socketId];
    delete peerDetailsRef.current[socketId];
    detachAudioAnalyser(socketId);
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
    setSpeakingMap((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    setNetworkQuality((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
  };

  // List available cameras/microphones (labels only populate after permission is granted)
  const refreshDeviceList = async () => {
    const devices = await navigator.mediaDevices.enumerateDevices();

    const videoInputs = devices
      .filter((d) => d.kind === "videoinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Camera ${i + 1}` }));

    const audioInputs = devices
      .filter((d) => d.kind === "audioinput")
      .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Microphone ${i + 1}` }));

    setVideoDevices(videoInputs);
    setAudioDevices(audioInputs);
  };

  // Switch the active camera or microphone mid-call, swapping the track on
  // the local stream and on every existing peer connection via replaceTrack
  // (avoids renegotiating offer/answer for every peer).
  const switchDevice = async (kind: "video" | "audio", deviceId: string) => {
    if (!localStreamRef.current) return;

    const constraints: MediaStreamConstraints =
      kind === "video"
        ? { video: { deviceId: { exact: deviceId } } }
        : { audio: { deviceId: { exact: deviceId } } };

    const newStream = await navigator.mediaDevices.getUserMedia(constraints);
    const newTrack =
      kind === "video" ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];

    if (!newTrack) return;

    const oldTracks =
      kind === "video"
        ? localStreamRef.current.getVideoTracks()
        : localStreamRef.current.getAudioTracks();

    oldTracks.forEach((track) => {
      track.stop();
      localStreamRef.current?.removeTrack(track);
    });

    newTrack.enabled = kind === "video" ? !isVideoMuted : !isAudioMuted;
    localStreamRef.current.addTrack(newTrack);

    Object.values(peerConnectionsRef.current).forEach((peerConnection) => {
      const sender = peerConnection
        .getSenders()
        .find((s) => s.track?.kind === newTrack.kind);
      sender?.replaceTrack(newTrack);
    });

    if (kind === "video") {
      setSelectedVideoDeviceId(deviceId);
    } else {
      setSelectedAudioDeviceId(deviceId);
    }
  };

  const switchCamera = (deviceId: string) => switchDevice("video", deviceId);
  const switchMicrophone = (deviceId: string) => switchDevice("audio", deviceId);

  // Swap the outgoing video track for a screen-share capture, reusing the
  // same replaceTrack approach as switchDevice (no renegotiation needed).
  // The original camera track is kept (not stopped) so stopScreenShare can
  // restore it without another getUserMedia prompt.
  const startScreenShare = async () => {
    if (!localStreamRef.current || isScreenSharing) return;

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      const screenTrack = screenStream.getVideoTracks()[0];
      if (!screenTrack) return;

      const cameraTrack = localStreamRef.current.getVideoTracks()[0];
      cameraTrackRef.current = cameraTrack ?? null;

      if (cameraTrack) {
        localStreamRef.current.removeTrack(cameraTrack);
      }
      localStreamRef.current.addTrack(screenTrack);

      Object.values(peerConnectionsRef.current).forEach((peerConnection) => {
        const sender = peerConnection.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(screenTrack);
      });

      // Broadcast presenting state to all peers in the room
      socketRef.current?.emit("screen-share-status", { isSharing: true });

      // Revert automatically if the user stops sharing via the browser's own
      // "Stop sharing" control instead of our in-app button.
      screenTrack.onended = () => stopScreenShare();

      setIsScreenSharing(true);
    } catch (err) {
      console.warn("Screen share cancelled or failed:", err);
    }
  };

  const stopScreenShare = () => {
    if (!localStreamRef.current || !isScreenSharing) return;

    const screenTrack = localStreamRef.current.getVideoTracks()[0];
    if (screenTrack) {
      screenTrack.stop();
      localStreamRef.current.removeTrack(screenTrack);
    }

    const cameraTrack = cameraTrackRef.current;
    if (cameraTrack) {
      localStreamRef.current.addTrack(cameraTrack);
      Object.values(peerConnectionsRef.current).forEach((peerConnection) => {
        const sender = peerConnection.getSenders().find((s) => s.track?.kind === "video");
        sender?.replaceTrack(cameraTrack);
      });
    }
    cameraTrackRef.current = null;

    // Broadcast screen share stopped
    socketRef.current?.emit("screen-share-status", { isSharing: false });
    setIsScreenSharing(false);
  };

  // Hand Raise Toggle
  const toggleRaiseHand = () => {
    setIsLocalHandRaised((prev) => {
      const next = !prev;
      socketRef.current?.emit("toggle-raise-hand", { isRaised: next });
      return next;
    });
  };

  // Emoji Reactions Broadcast
  const sendReaction = (emoji: string) => {
    if (!emoji || !socketRef.current) return;
    playReactionPop();
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setReactions((prev) => [
      ...prev,
      { id, emoji, fromName: user?.name || "You", fromSocketId: socketRef.current?.id || "local" },
    ]);
    setTimeout(() => {
      setReactions((prev) => prev.filter((r) => r.id !== id));
    }, 3500);
    socketRef.current.emit("send-reaction", { emoji });
  };

  // Host Controls
  const hostToggleLock = () => {
    if (!isHost || !socketRef.current) return;
    socketRef.current.emit("toggle-room-lock");
  };

  const hostMutePeer = (targetSocketId: string) => {
    if (!isHost || !socketRef.current || !targetSocketId) return;
    socketRef.current.emit("host-mute-peer", { targetSocketId });
  };

  const hostMuteAll = () => {
    if (!isHost || !socketRef.current) return;
    socketRef.current.emit("host-mute-all");
  };

  const hostKickPeer = (targetSocketId: string) => {
    if (!isHost || !socketRef.current || !targetSocketId) return;
    socketRef.current.emit("host-kick-peer", { targetSocketId });
  };

  // Sends a chat message to everyone else in the room
  const sendMessage = (message: string) => {
    if (!message.trim() || !socketRef.current || !user) return;

    socketRef.current.emit("chat-message", { message });
    setMessages((prev) => [
      ...prev,
      { userId: user.id, name: user.name, message, at: Date.now(), isLocal: true },
    ]);
  };

  // Control Buttons logic
  const toggleAudio = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        const nextMuted = !audioTrack.enabled;
        setIsAudioMuted(nextMuted);
        isAudioMutedRef.current = nextMuted;
        if (nextMuted) {
          setSpeakingMap((prev) => ({ ...prev, local: false }));
        }
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoMuted(!videoTrack.enabled);
      }
    }
  };

  // Low-Bandwidth Mode: Pauses all video tracks to prioritize audio traffic during network congestion
  const toggleLowBandwidthMode = () => {
    setIsLowBandwidthMode((prev) => {
      const nextMode = !prev;
      isLowBandwidthModeRef.current = nextMode;

      // Disable outgoing video track
      if (localStreamRef.current) {
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
          videoTrack.enabled = !nextMode;
          setIsVideoMuted(nextMode);
        }
      }

      // Disable incoming video tracks from all remote peers to save bandwidth and CPU
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        pc.getReceivers().forEach((receiver) => {
          if (receiver.track && receiver.track.kind === "video") {
            receiver.track.enabled = !nextMode;
          }
        });
      });

      return nextMode;
    });
  };

  return {
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
    // Pillar 2 (Option 2) Collaboration features
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
  };
};
