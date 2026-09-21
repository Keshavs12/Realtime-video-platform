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

interface Peer {
  socketId: string;
  userId: string;
  name?: string;
  stream: MediaStream;
}

interface PresenceUser {
  socketId: string;
  userId: string;
  name?: string;
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

const removePeerFromList = (list: PresenceUser[], socketId: string, userId?: string) =>
  list.filter((p) => p.socketId !== socketId && (!userId || p.userId !== userId));

const addPeerToList = (list: PresenceUser[], item: PresenceUser) => [
  ...list.filter((p) => p.userId !== item.userId && p.socketId !== item.socketId),
  item,
];

const updatePeerDetails = (list: Peer[], socketId: string, ansUserId?: string, ansName?: string) =>
  list.map((p) =>
    p.socketId === socketId
      ? { ...p, userId: ansUserId || p.userId, name: ansName || p.name }
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
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

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
          });
        });

        socket.on("connect_error", (err) => {
          console.error("[Socket] Handshake / authentication error:", err.message);
        });

        socket.on("room-not-found", () => {
          setRoomNotFound(true);
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

          setPresenceList((prev) => addPeerToList(prev, joinedUser));
        });

        socket.on("user-left", ({ socketId, userId }: { socketId: string; userId?: string }) => {
          // Remove from presence list
          setPresenceList((prev) => removePeerFromList(prev, socketId, userId));
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

              if (ansUserId || ansName) {
                setPeers((prev) => updatePeerDetails(prev, from, ansUserId, ansName));
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
    };
  }, [roomId, user]);

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

      setPeers((prev) => {
        const existingPeerIndex = prev.findIndex(
          (p) => p.socketId === peerSocketId || (peerUserId && p.userId === peerUserId)
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
            userId: peerUserId || existingPeer.userId,
            name: peerName || existingPeer.name,
            stream: existingPeer.stream,
          };
          return updatedPeers;
        }

        return [
          ...prev,
          {
            socketId: peerSocketId,
            userId: peerUserId || "",
            name: peerName,
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
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
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

    const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
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

    // Revert automatically if the user stops sharing via the browser's own
    // "Stop sharing" control instead of our in-app button.
    screenTrack.onended = () => stopScreenShare();

    setIsScreenSharing(true);
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

    setIsScreenSharing(false);
  };

  // Sends a chat message to everyone else in the room. Ephemeral (not
  // persisted) — the server just relays it. Added locally immediately
  // rather than round-tripped, since the sender doesn't need to wait for
  // their own message to echo back.
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
        setIsAudioMuted(!audioTrack.enabled);
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
    messages,
    sendMessage,
    isScreenSharing,
    startScreenShare,
    stopScreenShare,
  };
};
