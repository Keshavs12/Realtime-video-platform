import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  useWindowDimensions,
  StatusBar,
  Modal,
  Share,
  Vibration,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { io, Socket } from "socket.io-client";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { getSocketBaseUrl, getStoredToken, DEFAULT_API_URL } from "../config/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useKeepAwake } from "expo-keep-awake";
import { ChatModal } from "../components/ChatModal";
import { ReactionOverlay } from "../components/ReactionOverlay";
import { PollsModal } from "../components/PollsModal";
import { NotesModal } from "../components/NotesModal";
import { HostControlsModal } from "../components/HostControlsModal";
import { WhiteboardModal } from "../components/WhiteboardModal";
import { ParticipantsModal } from "../components/ParticipantsModal";
import { CallSettingsModal } from "../components/CallSettingsModal";
import { WebRTCStageWebView, WebRTCStageWebViewRef } from "../components/WebRTCStageWebView";
import { ChatMessage, Participant, FloatingReaction, PollItem } from "../types";
import { Ionicons } from "@expo/vector-icons";
import {
  RTCPeerConnection,
  RTCIceCandidate,
  RTCSessionDescription,
  RTCView,
  fetchIceServers,
  getLocalMediaStream,
  switchCameraFacing,
  isWebRTCSupported,
  isNativeWebRTC,
  FALLBACK_ICE_SERVERS,
  getDisplayMediaStream,
} from "../services/webrtc.service";

interface RoomScreenProps {
  roomCode: string;
  initialAudioMuted?: boolean;
  initialVideoMuted?: boolean;
  onLeaveRoom: () => void;
}

export const RoomScreen = ({
  roomCode,
  initialAudioMuted = false,
  initialVideoMuted = false,
  onLeaveRoom,
}: RoomScreenProps) => {
  useKeepAwake();
  const { user, serverUrl } = useAuth();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;

  const [summaryModalVisible, setSummaryModalVisible] = useState(false);
  const [finalCallStats, setFinalCallStats] = useState<{ duration: number; participantCount: number } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const webRTCStageRef = useRef<WebRTCStageWebViewRef | null>(null);
  const [tokenState, setTokenState] = useState<string | null>(null);
  const [webViewParticipantCount, setWebViewParticipantCount] = useState<number | null>(null);

  // WebRTC Refs
  const localStreamRef = useRef<any | null>(null);
  const [localStream, setLocalStream] = useState<any | null>(null);
  const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const iceServersRef = useRef<any[]>(FALLBACK_ICE_SERVERS);
  const [iceServers, setIceServers] = useState<any[]>(FALLBACK_ICE_SERVERS);
  const iceCandidatesQueueRef = useRef<{ [socketId: string]: RTCIceCandidate[] }>({});

  // Participant & Room state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const participantsRef = useRef<Participant[]>([]);
  participantsRef.current = participants;
  const [isHost, setIsHost] = useState(false);
  const [isRoomLocked, setIsRoomLocked] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(initialAudioMuted);
  const [isVideoMuted, setIsVideoMuted] = useState(initialVideoMuted);
  const [isBackCamera, setIsBackCamera] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // Modals & In-Call Interaction States
  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [moreMenuVisible, setMoreMenuVisible] = useState(false);
  const [participantsModalVisible, setParticipantsModalVisible] = useState(false);
  const [pinnedSocketId, setPinnedSocketId] = useState<string | null>(null);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [callSettingsVisible, setCallSettingsVisible] = useState(false);
  const [dataSaverMode, setDataSaverMode] = useState(false);
  const [mirrorVideo, setMirrorVideo] = useState(true);
  const [noiseSuppression, setNoiseSuppression] = useState(true);

  // Native screen share refs (used when isNativeWebRTC === true, e.g., compiled Android APK)
  const screenStreamRef = useRef<any | null>(null);
  const cameraTrackBeforeShareRef = useRef<any | null>(null);

  // Polls, Notes, Whiteboard, Host Controls
  const [polls, setPolls] = useState<PollItem[]>([]);
  const [pollsVisible, setPollsVisible] = useState(false);
  const [notes, setNotes] = useState<string>("");
  const [notesUpdatedBy, setNotesUpdatedBy] = useState<string | null>(null);
  const [notesVisible, setNotesVisible] = useState(false);
  const [whiteboardVisible, setWhiteboardVisible] = useState(false);
  const [hostControlsVisible, setHostControlsVisible] = useState(false);

  // Call timer & auth token load
  useEffect(() => {
    getStoredToken().then((t) => setTokenState(t));
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleShareRoomCode = async () => {
    const cleanCode = roomCode.trim().toLowerCase();
    try {
      await Share.share({
        message: `Join my SuperCall video meeting!\nRoom Code: ${cleanCode}\nLink: https://realtime-video-platform.onrender.com/room/${cleanCode}`,
        title: "SuperCall Meeting Code",
      });
    } catch {
      Alert.alert("Room Code", `Meeting code: ${cleanCode}`);
    }
  };

  // Helper to safely add ice candidate or queue if remote description isn't set yet
  const addIceCandidateSafe = async (socketId: string, candidate: any) => {
    const pc = peerConnectionsRef.current[socketId];
    if (!pc) return;

    try {
      if (pc.remoteDescription && pc.remoteDescription.type) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } else {
        if (!iceCandidatesQueueRef.current[socketId]) {
          iceCandidatesQueueRef.current[socketId] = [];
        }
        iceCandidatesQueueRef.current[socketId].push(new RTCIceCandidate(candidate));
      }
    } catch (err) {
      console.warn(`[WebRTC] Failed to add ICE candidate for ${socketId}:`, err);
    }
  };

  // Helper to process queued ice candidates after remote description is applied
  const flushIceCandidatesQueue = async (socketId: string) => {
    const pc = peerConnectionsRef.current[socketId];
    const queue = iceCandidatesQueueRef.current[socketId] || [];
    if (!pc || queue.length === 0) return;

    for (const cand of queue) {
      try {
        await pc.addIceCandidate(cand);
      } catch (err) {
        console.warn(`[WebRTC] Error flushing candidate:`, err);
      }
    }
    iceCandidatesQueueRef.current[socketId] = [];
  };

  // Create an RTCPeerConnection for a remote peer
  const createPeerConnection = useCallback(
    (peerSocketId: string, _peerUserId?: string, _peerName?: string): RTCPeerConnection | null => {
      if (!isWebRTCSupported) return null;

      if (peerConnectionsRef.current[peerSocketId]) {
        return peerConnectionsRef.current[peerSocketId];
      }

      try {
        const pc = new RTCPeerConnection({
          iceServers: iceServersRef.current.length > 0 ? iceServersRef.current : undefined,
        });

        peerConnectionsRef.current[peerSocketId] = pc;

        // Add local tracks to connection
        if (localStreamRef.current) {
          localStreamRef.current.getTracks().forEach((track: any) => {
            pc.addTrack(track, localStreamRef.current);
          });
        }

        // On ICE Candidate generated
        pc.onicecandidate = (event: any) => {
          if (event.candidate && socketRef.current) {
            socketRef.current.emit("ice-candidate", {
              to: peerSocketId,
              candidate: event.candidate,
            });
          }
        };

        // On remote stream / track received
        pc.ontrack = (event: any) => {
          let remoteStream = event.streams && event.streams[0] ? event.streams[0] : null;
          if (!remoteStream && event.track) {
            try {
              remoteStream = new MediaStream([event.track]);
            } catch (e) {
              remoteStream = null;
            }
          }
          if (remoteStream) {
            setParticipants((prev) =>
              prev.map((p) =>
                p.socketId === peerSocketId
                  ? { ...p, stream: remoteStream }
                  : p
              )
            );
          }
        };

        pc.onconnectionstatechange = () => {
          console.log(`[WebRTC] Peer ${peerSocketId} connectionState: ${pc.connectionState}`);
        };

        return pc;
      } catch (err) {
        console.error(`[WebRTC] Error creating peer connection for ${peerSocketId}:`, err);
        return null;
      }
    },
    []
  );

  // Initialize Media and Socket.IO Signaling Connection
  useEffect(() => {
    let isMounted = true;

    const setupCall = async () => {
      // 1. Fetch ICE Servers (STUN/TURN)
      const servers = await fetchIceServers();
      if (isMounted && servers && servers.length > 0) {
        iceServersRef.current = servers;
        setIceServers(servers);
      }

      // 2. Request local camera & mic (only if native WebRTC is active; WebView handles its own camera in Expo Go)
      if (isNativeWebRTC) {
        const stream = await getLocalMediaStream(true, true);
        if (isMounted && stream) {
          localStreamRef.current = stream;
          setLocalStream(stream);

          // Dynamically add tracks to any already-created peer connections
          Object.values(peerConnectionsRef.current).forEach((pc: any) => {
            try {
              const senders = typeof pc.getSenders === "function" ? pc.getSenders() : [];
              stream.getTracks().forEach((track: any) => {
                const alreadyAdded = senders.some((s: any) => s.track && s.track.id === track.id);
                if (!alreadyAdded) {
                  pc.addTrack(track, stream);
                }
              });
            } catch (e) {
              console.warn("[WebRTC] Error attaching track to PC:", e);
            }
          });
        }
      }

      // 3. Connect to Socket.IO signaling server
      const socketUrl = await getSocketBaseUrl();
      const token = await getStoredToken();
      const cleanRoomCode = roomCode.replace(/[^a-zA-Z0-9_-]/g, "").trim().toLowerCase();

      const socket = io(socketUrl, {
        auth: {
          token: token || undefined,
          guestName: user?.name || "Mobile User",
          userId: user?.id,
        },
        transports: ["polling", "websocket"],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        timeout: 20000,
      });

      socketRef.current = socket;

      const emitJoin = () => {
        const userId = user?.id || `mobile-${Date.now().toString(36)}`;
        const userName = user?.name || "Mobile User";

        socket.emit("join-room", {
          roomId: cleanRoomCode,
          userId,
          name: userName,
          isVideoMuted: initialVideoMuted,
          isAudioMuted: initialAudioMuted,
        });
      };

      socket.on("connect", () => {
        console.log("[Socket] Successfully connected to signaling server, socketId:", socket.id);
        emitJoin();
      });

      if (socket.connected) {
        emitJoin();
      }

      socket.on("connect_error", (err) => {
        console.warn("[Socket] Connect error:", err.message);
      });

      socket.on("error", (err: any) => {
        console.warn("[Socket] Error event:", err?.message || err);
      });

      socket.on("room-info", ({ isHost: hostFlag, isLocked: lockedFlag }: { isHost: boolean; isLocked?: boolean }) => {
        if (!isMounted) return;
        setIsHost(hostFlag);
        if (lockedFlag !== undefined) setIsRoomLocked(lockedFlag);
      });

      socket.on("room-lock-changed", ({ isLocked }: { isLocked: boolean }) => {
        if (!isMounted) return;
        setIsRoomLocked(isLocked);
      });

      // Existing peers in the room -> initiate WebRTC offer
      socket.on(
        "room-users",
        async ({
          users,
        }: {
          users: {
            socketId: string;
            userId: string;
            name?: string;
            isHost?: boolean;
            isVideoMuted?: boolean;
            isAudioMuted?: boolean;
          }[];
        }) => {
          if (!isMounted) return;

          setParticipants(
            users.map((u) => ({
              socketId: u.socketId,
              userId: u.userId,
              name: u.name || "Participant",
              isHost: u.isHost,
              isVideoMuted: u.isVideoMuted,
              isAudioMuted: u.isAudioMuted,
            }))
          );

          // For each existing participant, initiate peer connection
          if (!isNativeWebRTC) {
            for (const remoteUser of users) {
              if (!remoteUser.socketId) continue;
              webRTCStageRef.current?.sendSignalingEvent({
                type: "INITIATE_PEER",
                peerSocketId: remoteUser.socketId,
                peerName: remoteUser.name || "Participant",
                iceServers: iceServersRef.current,
              });
            }
          } else {
            for (const remoteUser of users) {
              const pc = createPeerConnection(remoteUser.socketId, remoteUser.userId, remoteUser.name);
              if (pc) {
                try {
                  const offer = await pc.createOffer({});
                  await pc.setLocalDescription(offer);
                  socket.emit("offer", {
                    to: remoteUser.socketId,
                    offer,
                    userId: user?.id,
                    name: user?.name || "Mobile User",
                  });
                } catch (err) {
                  console.error(`[WebRTC] Failed to create offer for ${remoteUser.socketId}:`, err);
                }
              }
            }
          }
        }
      );

      // New user joined
      socket.on(
        "user-joined",
        (joinedUser: {
          socketId: string;
          userId: string;
          name?: string;
          isHost?: boolean;
          isVideoMuted?: boolean;
          isAudioMuted?: boolean;
        }) => {
          if (!isMounted) return;

          setParticipants((prev) => {
            if (prev.some((p) => p.socketId === joinedUser.socketId)) return prev;
            return [
              ...prev,
              {
                socketId: joinedUser.socketId,
                userId: joinedUser.userId,
                name: joinedUser.name || "Participant",
                isHost: joinedUser.isHost,
                isVideoMuted: joinedUser.isVideoMuted,
                isAudioMuted: joinedUser.isAudioMuted,
              },
            ];
          });

          // Inform WebRTC stage of joined peer
          if (!isNativeWebRTC) {
            webRTCStageRef.current?.sendSignalingEvent({
              type: "PEER_JOINED",
              peerSocketId: joinedUser.socketId,
              peerName: joinedUser.name || "Participant",
            });
          } else {
            // Prepare peer connection to receive offer from joined user
            createPeerConnection(joinedUser.socketId, joinedUser.userId, joinedUser.name);
          }
        }
      );

      // Handle WebRTC Offer
      socket.on(
        "offer",
        async (payload: { from: string; offer: any; userId?: string; name?: string }) => {
          const { from, offer, userId: offerUserId, name } = payload;

          if (!isNativeWebRTC) {
            webRTCStageRef.current?.sendSignalingEvent({
              type: "HANDLE_OFFER",
              from,
              offer,
              name: name || "Participant",
              iceServers: iceServersRef.current,
            });
            return;
          }

          const pc = createPeerConnection(from, offerUserId, name);
          if (!pc) return;

          try {
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            await flushIceCandidatesQueue(from);

            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);

            socket.emit("answer", {
              to: from,
              answer,
              userId: user?.id,
              name: user?.name || "Mobile User",
            });
          } catch (err) {
            console.error(`[WebRTC] Error handling offer from ${from}:`, err);
          }
        }
      );

      // Handle WebRTC Answer
      socket.on("answer", async (payload: { from: string; answer: any }) => {
        const { from, answer } = payload;

        if (!isNativeWebRTC) {
          webRTCStageRef.current?.sendSignalingEvent({
            type: "HANDLE_ANSWER",
            from,
            answer,
          });
          return;
        }

        const pc = peerConnectionsRef.current[from];
        if (!pc) return;

        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
          await flushIceCandidatesQueue(from);
        } catch (err) {
          console.error(`[WebRTC] Error handling answer from ${from}:`, err);
        }
      });

      // Handle ICE Candidate
      socket.on("ice-candidate", (payload: { from: string; candidate: any }) => {
        const { from, candidate } = payload;

        if (!isNativeWebRTC) {
          webRTCStageRef.current?.sendSignalingEvent({
            type: "HANDLE_ICE_CANDIDATE",
            from,
            candidate,
          });
          return;
        }

        if (candidate) {
          addIceCandidateSafe(from, candidate);
        }
      });

      // Participant left
      socket.on("user-left", ({ socketId }: { socketId: string }) => {
        if (!isMounted) return;

        if (!isNativeWebRTC) {
          webRTCStageRef.current?.sendSignalingEvent({
            type: "USER_LEFT",
            socketId,
          });
        }

        if (peerConnectionsRef.current[socketId]) {
          try {
            peerConnectionsRef.current[socketId].close();
          } catch (e) {
            // ignore
          }
          delete peerConnectionsRef.current[socketId];
        }
        delete iceCandidatesQueueRef.current[socketId];

        setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      });

      // Remote Media Status Change (Camera/Mic)
      socket.on(
        "peer-media-status",
        (payload: { socketId: string; userId: string; isVideoMuted?: boolean; isAudioMuted?: boolean }) => {
          if (!isMounted) return;
          setParticipants((prev) =>
            prev.map((p) => {
              if (p.socketId === payload.socketId) {
                return {
                  ...p,
                  isVideoMuted:
                    payload.isVideoMuted !== undefined ? payload.isVideoMuted : p.isVideoMuted,
                  isAudioMuted:
                    payload.isAudioMuted !== undefined ? payload.isAudioMuted : p.isAudioMuted,
                };
              }
              return p;
            })
          );
        }
      );

      // Screen Share Status
      socket.on("peer-screen-share", (payload: { socketId: string; isSharing: boolean }) => {
        if (!isMounted) return;
        setParticipants((prev) =>
          prev.map((p) =>
            p.socketId === payload.socketId ? { ...p, isSharing: payload.isSharing } : p
          )
        );
      });

      // Chat Messages
      socket.on(
        "chat-message",
        (msg: { userId?: string; name?: string; message: string; at: number }) => {
          if (!isMounted) return;
          const newMsg: ChatMessage = {
            ...msg,
            isLocal: false,
          };
          setMessages((prev) => [...prev, newMsg]);
          setUnreadCount((c) => (chatVisible ? 0 : c + 1));
        }
      );

      // Chat History replay
      socket.on("chat-history", ({ messages: hist }: { messages: ChatMessage[] }) => {
        if (!isMounted) return;
        setMessages(hist.map((m) => ({ ...m, isLocal: m.userId === user?.id })));
      });

      // Floating Reactions
      socket.on("reaction-received", (reaction: FloatingReaction) => {
        if (!isMounted) return;
        setReactions((prev) => [...prev.slice(-10), reaction]);
      });

      // Hand raise
      socket.on(
        "peer-hand-toggled",
        ({ socketId, isRaised }: { socketId: string; isRaised: boolean }) => {
          if (!isMounted) return;
          setParticipants((prev) =>
            prev.map((p) => (p.socketId === socketId ? { ...p, isHandRaised: isRaised } : p))
          );
        }
      );

      // Polls Sync
      socket.on("room-polls-history", ({ polls: hist }: { polls: PollItem[] }) => {
        if (!isMounted) return;
        setPolls(hist || []);
      });

      socket.on("poll-created", (newPoll: PollItem) => {
        if (!isMounted) return;
        setPolls((prev) => [newPoll, ...prev]);
      });

      socket.on("poll-updated", (updated: PollItem) => {
        if (!isMounted) return;
        setPolls((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      });

      // Notes Sync
      socket.on("notes-history", ({ notes: histNotes }: { notes: string }) => {
        if (!isMounted) return;
        setNotes(histNotes || "");
      });

      socket.on("notes-updated", ({ notes: newNotes, updatedBy: by }: { notes: string; updatedBy?: string }) => {
        if (!isMounted) return;
        setNotes(newNotes);
        if (by) setNotesUpdatedBy(by);
      });

      // Muted / Kicked by Host
      socket.on("muted-by-host", ({ message }: { message: string }) => {
        setIsAudioMuted(true);
        if (localStreamRef.current) {
          localStreamRef.current.getAudioTracks().forEach((track: any) => {
            track.enabled = false;
          });
        }
        Alert.alert("Host Action", message || "You have been muted by the host.");
      });

      socket.on("kicked-by-host", ({ message }: { message: string }) => {
        Alert.alert("Meeting Notice", message || "You were removed from the meeting.", [
          { text: "OK", onPress: onLeaveRoom },
        ]);
      });

      // Room errors
      socket.on("room-not-found", () => {
        Alert.alert("Room Not Found", "This meeting room does not exist.", [
          { text: "Leave", onPress: onLeaveRoom },
        ]);
      });

      socket.on("room-full", () => {
        Alert.alert("Room Full", "This meeting room is at maximum capacity.", [
          { text: "Leave", onPress: onLeaveRoom },
        ]);
      });

      socket.on("room-locked", () => {
        Alert.alert("Room Locked", "This meeting room is locked by the host.", [
          { text: "Leave", onPress: onLeaveRoom },
        ]);
      });
    };

    setupCall();

    return () => {
      isMounted = false;

      // Close all peer connections
      Object.values(peerConnectionsRef.current).forEach((pc) => {
        try {
          pc.close();
        } catch (e) {
          // ignore
        }
      });
      peerConnectionsRef.current = {};

      // Stop screen share stream if active (native Android path)
      if (screenStreamRef.current) {
        try {
          screenStreamRef.current.getTracks().forEach((track: any) => track.stop());
        } catch (_) {}
        screenStreamRef.current = null;
      }
      cameraTrackBeforeShareRef.current = null;

      // Stop local tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track: any) => {
          try {
            track.stop();
          } catch (e) {
            // ignore
          }
        });
        localStreamRef.current = null;
      }

      // Disconnect socket
      if (socketRef.current) {
        socketRef.current.emit("leave-room");
        socketRef.current.disconnect();
      }
    };
  }, [roomCode, user?.id, user?.name, createPeerConnection, onLeaveRoom]);

  // Audio mute toggle
  const toggleAudio = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);

    if (webRTCStageRef.current) {
      webRTCStageRef.current.toggleAudio(next);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track: any) => {
        track.enabled = !next;
      });
    }

    if (socketRef.current) {
      socketRef.current.emit("media-status-change", {
        isAudioMuted: next,
      });
    }
  };

  // Video mute toggle
  const toggleVideo = () => {
    const next = !isVideoMuted;
    setIsVideoMuted(next);

    if (webRTCStageRef.current) {
      webRTCStageRef.current.toggleVideo(next);
    }

    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track: any) => {
        track.enabled = !next;
      });
    }

    if (socketRef.current) {
      socketRef.current.emit("media-status-change", {
        isVideoMuted: next,
      });
    }
  };

  // Flip Camera Front / Back
  const handleFlipCamera = () => {
    if (!isNativeWebRTC && webRTCStageRef.current) {
      webRTCStageRef.current.flipCamera();
      setIsBackCamera((prev) => !prev);
      return;
    }
    if (!localStreamRef.current) return;
    const switched = switchCameraFacing(localStreamRef.current);
    if (switched) {
      setIsBackCamera((prev) => !prev);
    }
  };

  // Native screen share stop — restores camera track across all peer connections
  const stopNativeScreenShare = () => {
    if (!isScreenSharing) return;

    // Stop the screen capture stream tracks
    if (screenStreamRef.current) {
      try {
        screenStreamRef.current.getTracks().forEach((t: any) => t.stop());
      } catch (_) {}
      screenStreamRef.current = null;
    }

    // Restore camera video track in all peer connections
    const camTrack = cameraTrackBeforeShareRef.current;
    if (camTrack && localStreamRef.current) {
      try {
        localStreamRef.current.addTrack(camTrack);
      } catch (_) {}
      Object.values(peerConnectionsRef.current).forEach((pc: any) => {
        try {
          const senders = typeof pc.getSenders === "function" ? pc.getSenders() : [];
          const videoSender = senders.find((s: any) => s.track && s.track.kind === "video");
          if (videoSender) {
            videoSender.replaceTrack(camTrack);
          }
        } catch (e) {
          console.warn("[ScreenShare] Error restoring camera track:", e);
        }
      });
    }
    cameraTrackBeforeShareRef.current = null;

    setIsScreenSharing(false);
    if (socketRef.current) {
      socketRef.current.emit("screen-share-status", { isSharing: false });
    }
  };

  // Toggle Screen Sharing
  const handleToggleScreenShare = async () => {
    try { Vibration.vibrate(25); } catch {}

    // --- Native path: compiled Android APK (react-native-webrtc supports getDisplayMedia) ---
    if (isNativeWebRTC) {
      if (isScreenSharing) {
        stopNativeScreenShare();
        return;
      }

      try {
        const screenStream = await getDisplayMediaStream();
        if (!screenStream) {
          Alert.alert(
            "Screen Share",
            "Screen sharing could not be started. Please grant the screen capture permission when prompted."
          );
          return;
        }

        const screenTrack = screenStream.getVideoTracks()[0];
        if (!screenTrack) {
          Alert.alert("Screen Share", "No screen video track was captured.");
          return;
        }

        screenStreamRef.current = screenStream;

        // Stash the current camera track so we can restore it later
        if (localStreamRef.current) {
          const camTracks = localStreamRef.current.getVideoTracks();
          if (camTracks.length > 0) {
            cameraTrackBeforeShareRef.current = camTracks[0];
            try {
              localStreamRef.current.removeTrack(camTracks[0]);
            } catch (_) {}
          }
          try {
            localStreamRef.current.addTrack(screenTrack);
          } catch (_) {}
        }

        // Replace video track in every active peer connection
        Object.values(peerConnectionsRef.current).forEach((pc: any) => {
          try {
            const senders = typeof pc.getSenders === "function" ? pc.getSenders() : [];
            const videoSender = senders.find((s: any) => s.track && s.track.kind === "video");
            if (videoSender) {
              videoSender.replaceTrack(screenTrack);
            } else {
              // No existing video sender — add a new track
              if (localStreamRef.current) {
                pc.addTrack(screenTrack, localStreamRef.current);
              }
            }
          } catch (e) {
            console.warn("[ScreenShare] Error replacing track for peer:", e);
          }
        });

        // Auto-stop when the user closes the system screen picker
        screenTrack.onended = () => {
          stopNativeScreenShare();
        };

        setIsScreenSharing(true);
        if (socketRef.current) {
          socketRef.current.emit("screen-share-status", { isSharing: true });
        }
      } catch (err: any) {
        console.warn("[ScreenShare] Native getDisplayMedia error:", err);
        // User cancelled (NotAllowedError) — no alert needed
        if (err?.name !== "NotAllowedError" && err?.code !== 0) {
          Alert.alert(
            "Screen Share",
            "Screen sharing failed: " + (err?.message || "Unknown error. Please try again.")
          );
        }
      }
      return;
    }

    // --- WebView path: Expo Go / iOS WKWebView (getDisplayMedia works on Safari/desktop) ---
    if (isScreenSharing) {
      webRTCStageRef.current?.stopScreenShare?.();
    } else {
      webRTCStageRef.current?.startScreenShare?.();
    }
  };

  // Raise hand toggle
  const toggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    if (socketRef.current) {
      socketRef.current.emit("toggle-raise-hand", {
        isRaised: next,
      });
    }
  };

  // Send reaction
  const handleSendReaction = (emoji: string) => {
    setShowReactionPicker(false);
    const newReaction: FloatingReaction = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      emoji,
      fromName: user?.name || "You",
      fromSocketId: socketRef.current?.id || "",
    };
    setReactions((prev) => [...prev.slice(-10), newReaction]);

    if (socketRef.current) {
      socketRef.current.emit("send-reaction", {
        emoji,
      });
    }
  };

  // Send chat message
  const handleSendMessage = (text: string) => {
    const myMsg: ChatMessage = {
      userId: user?.id,
      name: user?.name || "You",
      message: text,
      at: Date.now(),
      isLocal: true,
    };
    setMessages((prev) => [...prev, myMsg]);

    if (socketRef.current) {
      socketRef.current.emit("chat-message", {
        message: text,
      });
    }
  };

  // Polls Handlers
  const handleCreatePoll = (questionText: string, optionsList: string[]) => {
    if (socketRef.current) {
      socketRef.current.emit("poll-create", {
        question: questionText,
        options: optionsList,
      });
    }
  };

  const handleVotePoll = (pollId: string, optionId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("poll-vote", {
        pollId,
        optionId,
      });
    }
  };

  // Notes Handler
  const handleUpdateNotes = (newText: string) => {
    setNotes(newText);
    if (socketRef.current) {
      socketRef.current.emit("notes-update", {
        notes: newText,
      });
    }
  };

  // Host Controls Handlers
  const handleToggleRoomLock = () => {
    if (socketRef.current) {
      socketRef.current.emit("toggle-room-lock");
    }
  };

  const handleMuteAll = () => {
    if (socketRef.current) {
      socketRef.current.emit("host-mute-all");
    }
  };

  const handleMuteParticipant = (socketId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("host-mute-peer", { targetSocketId: socketId });
    }
  };

  const handleKickParticipant = (socketId: string) => {
    if (socketRef.current) {
      socketRef.current.emit("host-kick-peer", { targetSocketId: socketId });
    }
  };

  // Whiteboard Handlers
  const handleDrawSegment = (data: any) => {
    if (socketRef.current) {
      socketRef.current.emit("whiteboard-draw", data);
    }
  };

  const handleClearWhiteboard = () => {
    if (socketRef.current) {
      socketRef.current.emit("whiteboard-clear");
    }
  };

  const handleUndoWhiteboard = () => {
    if (socketRef.current) {
      socketRef.current.emit("whiteboard-undo");
    }
  };

  // End Call
  const handleEndCall = () => {
    Alert.alert("Leave Meeting", "Are you sure you want to leave this call?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Leave Call",
        style: "destructive",
        onPress: () => {
          if (socketRef.current) {
            socketRef.current.emit("leave-room");
            socketRef.current.disconnect();
          }

          // Record session to local history
          const durationMins = Math.max(1, Math.round(callDuration / 60));
          const sessionEntry = {
            roomCode,
            joinedAt: new Date(Date.now() - callDuration * 1000).toISOString(),
            isHost,
            durationMinutes: durationMins,
            otherParticipantsCount: participants.length,
          };
          AsyncStorage.getItem("@supercall_history")
            .then((raw) => {
              const list = raw ? JSON.parse(raw) : [];
              AsyncStorage.setItem(
                "@supercall_history",
                JSON.stringify([sessionEntry, ...list.slice(0, 40)])
              ).catch(() => {});
            })
            .catch(() => {});

          setFinalCallStats({ duration: callDuration, participantCount: participants.length + 1 });
          setSummaryModalVisible(true);
        },
      },
    ]);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  // Responsive Peer Card Dimensions
  const getCardStyle = () => {
    const count = participants.length;
    const isTablet = width >= 768;
    const maxContentWidth = isTablet ? Math.min(width - 48, 1140) : width - 24;

    if (count === 0) {
      return {
        width: maxContentWidth,
        height: isLandscape ? height * 0.72 : Math.min(height * 0.65, 520),
      };
    }
    if (count === 1) {
      if (isLandscape || isTablet) {
        return {
          width: (maxContentWidth - 14) / 2,
          height: isLandscape ? height * 0.68 : Math.min(height * 0.44, 380),
        };
      }
      return {
        width: maxContentWidth,
        height: Math.min((height - 230) / 2, 300),
      };
    }
    if (count <= 3) {
      return {
        width: (maxContentWidth - 14) / 2,
        height: isTablet ? 280 : isLandscape ? 200 : 210,
      };
    }
    const cols = isTablet ? 3 : 2;
    const gap = (cols - 1) * 12;
    return {
      width: (maxContentWidth - gap) / cols,
      height: isTablet ? 230 : 180,
    };
  };

  const cardDimensions = getCardStyle();
  const isTabletDevice = width >= 768;

  // Participant Card Renderer (matches web app avatar-off glowing aesthetic)
  const renderParticipantCard = (
    isLocal: boolean,
    participantName: string,
    stream: any,
    isCameraMuted: boolean,
    isMicMuted: boolean,
    hasHandRaised: boolean,
    hasScreenShare?: boolean,
    key?: string
  ) => {
    const initial = (participantName || "U")[0].toUpperCase();
    const canShowVideo = isWebRTCSupported && stream && !isCameraMuted;

    return (
      <View key={key} style={[styles.peerCard, cardDimensions]}>
        {canShowVideo ? (
          <RTCView
            streamURL={typeof stream?.toURL === "function" ? stream.toURL() : stream}
            stream={stream}
            style={styles.rtcVideo}
            objectFit="cover"
            mirror={isLocal && !isBackCamera}
            zOrder={0}
          />
        ) : (
          /* Camera-off Avatar View with glowing rings matching web app */
          <View style={styles.avatarCardBackground}>
            <View style={styles.avatarOuterRing}>
              <View style={styles.avatarMiddleRing}>
                <View style={[styles.avatarCircle, isLocal ? styles.localAvatar : styles.remoteAvatar]}>
                  <Text style={styles.avatarInitial}>{initial}</Text>
                </View>
              </View>
            </View>
            <View style={styles.cameraOffPill}>
              <Ionicons name="videocam-off" size={12} color="#94a3b8" />
              <Text style={styles.cameraOffPillText}>Camera Off</Text>
            </View>
          </View>
        )}

        {/* Screen sharing badge */}
        {hasScreenShare ? (
          <View style={styles.screenShareBadge}>
            <Ionicons name="tv-outline" size={12} color="#ffffff" />
            <Text style={styles.screenShareBadgeText}>Screen Share</Text>
          </View>
        ) : null}

        {/* Card Footer with participant details */}
        <View style={styles.peerFooter}>
          <Text style={styles.peerName} numberOfLines={1}>
            {participantName} {isLocal ? "(You)" : ""} {isHost && isLocal ? "👑" : ""}
          </Text>
          <View style={styles.statusIconsRow}>
            {hasHandRaised ? (
              <View style={styles.handBadge}>
                <Text style={styles.handIcon}>✋</Text>
              </View>
            ) : null}
            {isMicMuted ? (
              <View style={styles.mutedBadge}>
                <Ionicons name="mic-off" size={12} color="#ffffff" />
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#070b13" />

      {/* Floating Reaction Animation Overlay */}
      <ReactionOverlay reactions={reactions} />

      {/* Top Floating Header */}
      <View style={styles.topHeader}>
        <View style={[styles.topHeaderInner, isTabletDevice && styles.topHeaderInnerWide]}>
          <View style={styles.roomInfoCol}>
            <TouchableOpacity
              onPress={handleShareRoomCode}
              activeOpacity={0.7}
              style={styles.roomCodePill}
            >
              <View style={styles.liveIndicator} />
              <Text style={styles.roomCodeText}>Room {roomCode}</Text>
              <Ionicons name="share-outline" size={13} color="#94a3b8" style={{ marginLeft: 5 }} />
              {isRoomLocked ? <Text style={{ fontSize: 11, marginLeft: 4 }}>🔒</Text> : null}
            </TouchableOpacity>
            <View style={styles.e2eePill}>
              <Ionicons name="shield-checkmark" size={11} color={Colors.success} style={{ marginRight: 3 }} />
              <Text style={styles.e2eeText}>E2EE HD</Text>
            </View>
            <Text style={styles.timerText}>⏱️ {formatTimer(callDuration)}</Text>
          </View>

          <View style={styles.headerRightCol}>
            {/* Flip camera button */}
            <TouchableOpacity onPress={handleFlipCamera} activeOpacity={0.7} style={styles.headerIconBtn}>
              <Ionicons name="camera-reverse" size={18} color={Colors.text} />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                try { Vibration.vibrate(25); } catch {}
                setParticipantsModalVisible(true);
              }}
              activeOpacity={0.7}
              style={styles.participantCountPill}
            >
              <Ionicons name="people" size={13} color={Colors.accent} />
              <Text style={styles.participantCountText}>
                {Math.max(participants.length + 1, webViewParticipantCount || 1)}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Floating Screen Share Banner */}
      {isScreenSharing && (
        <View style={styles.screenShareBanner}>
          <View style={styles.screenShareDot} />
          <Ionicons name="tv" size={15} color="#10b981" style={{ marginRight: 6 }} />
          <Text style={styles.screenShareText}>You are sharing your screen</Text>
          <TouchableOpacity
            onPress={handleToggleScreenShare}
            style={styles.screenShareStopBtn}
            activeOpacity={0.7}
          >
            <Text style={styles.screenShareStopBtnText}>Stop</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Participant Video Grid - Uses hardware-accelerated WKWebView in Expo Go or native RTCView in compiled builds */}
      {!isNativeWebRTC ? (
        <WebRTCStageWebView
          ref={webRTCStageRef}
          roomCode={roomCode}
          user={user}
          isVideoMuted={isVideoMuted}
          isAudioMuted={isAudioMuted}
          iceServers={iceServers}
          onOfferCreated={(to, offer) => {
            socketRef.current?.emit("offer", {
              to,
              offer,
              userId: user?.id,
              name: user?.name || "Mobile User",
            });
          }}
          onAnswerCreated={(to, answer) => {
            socketRef.current?.emit("answer", {
              to,
              answer,
              userId: user?.id,
              name: user?.name || "Mobile User",
            });
          }}
          onIceCandidateGenerated={(to, candidate) => {
            socketRef.current?.emit("ice-candidate", {
              to,
              candidate,
            });
          }}
          onParticipantCountChange={(count) => {
            if (count > 0) {
              setWebViewParticipantCount(count);
            }
          }}
          onScreenShareStateChange={(sharing) => {
            setIsScreenSharing(sharing);
            socketRef.current?.emit("screen-share-status", { isSharing: sharing });
            socketRef.current?.emit("media-status-change", {
              isVideoMuted: isVideoMuted,
              isAudioMuted: isAudioMuted,
            });
          }}
          onScreenShareError={(msg) => {
            Alert.alert("Screen Share", msg || "Screen sharing is not supported by your current device engine.");
          }}
          onLocalStreamReady={() => {
            // Once local stream is active, ensure all known remote peers are initiated
            participantsRef.current.forEach((p) => {
              if (p.socketId) {
                webRTCStageRef.current?.sendSignalingEvent({
                  type: "INITIATE_PEER",
                  peerSocketId: p.socketId,
                  peerName: p.name || "Participant",
                  iceServers: iceServersRef.current,
                });
              }
            });
          }}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[
            styles.gridContent,
            isTabletDevice && styles.gridContentWide,
          ]}
        >
          {/* Local Participant Card */}
          {renderParticipantCard(
            true,
            user?.name || "You",
            localStream,
            isVideoMuted,
            isAudioMuted,
            isHandRaised,
            false,
            "local-user"
          )}

          {/* Remote Peers */}
          {participants.map((peer) =>
            renderParticipantCard(
              false,
              peer.name || "Participant",
              peer.stream,
              Boolean(peer.isVideoMuted),
              Boolean(peer.isAudioMuted),
              Boolean(peer.isHandRaised),
              Boolean(peer.isSharing),
              peer.socketId
            )
          )}
        </ScrollView>
      )}

      {/* Floating Emoji Picker Popover */}
      {showReactionPicker ? (
        <View style={styles.reactionPickerContainer}>
          {["👏", "👍", "❤️", "🎉", "🔥", "😂", "🚀", "💡"].map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleSendReaction(emoji)}
              style={styles.reactionPickerItem}
              activeOpacity={0.7}
            >
              <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Bottom Floating Call Control Bar */}
      <View style={[styles.controlBarWrapper, isTabletDevice && styles.controlBarWrapperWide]}>
        <View style={styles.controlBar}>
          {/* Mic Toggle */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={toggleAudio}
            style={[styles.controlBtn, isAudioMuted ? styles.controlBtnMuted : null]}
          >
            <Ionicons
              name={isAudioMuted ? "mic-off" : "mic"}
              size={20}
              color="#ffffff"
            />
          </TouchableOpacity>

          {/* Camera Toggle */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={toggleVideo}
            style={[styles.controlBtn, isVideoMuted ? styles.controlBtnMuted : null]}
          >
            <Ionicons
              name={isVideoMuted ? "videocam-off" : "videocam"}
              size={20}
              color="#ffffff"
            />
          </TouchableOpacity>

          {/* Hand Raise */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={toggleHandRaise}
            style={[styles.controlBtn, isHandRaised ? styles.controlBtnHand : null]}
          >
            <Text style={{ fontSize: 18 }}>✋</Text>
          </TouchableOpacity>

          {/* Chat Button with Unread Badge */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => {
              setChatVisible(true);
              setUnreadCount(0);
            }}
            style={styles.controlBtn}
          >
            <Ionicons name="chatbubbles-outline" size={20} color="#ffffff" />
            {unreadCount > 0 ? (
              <View style={styles.unreadBadge}>
                <Text style={styles.unreadText}>{unreadCount}</Text>
              </View>
            ) : null}
          </TouchableOpacity>

          {/* More Actions Drawer Trigger (⋯) */}
          <TouchableOpacity
            activeOpacity={0.75}
            onPress={() => setMoreMenuVisible(true)}
            style={[styles.controlBtn, styles.moreBtn]}
          >
            <Ionicons name="ellipsis-horizontal" size={20} color="#ffffff" />
          </TouchableOpacity>

          {/* End Call Button */}
          <TouchableOpacity activeOpacity={0.8} onPress={handleEndCall} style={styles.endCallBtn}>
            <Ionicons
              name="call"
              size={22}
              color="#ffffff"
              style={{ transform: [{ rotate: "135deg" }] }}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* More Actions Bottom Drawer / Modal */}
      <Modal
        visible={moreMenuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMoreMenuVisible(false)}
      >
        <TouchableOpacity
          style={styles.moreOverlay}
          activeOpacity={1}
          onPress={() => setMoreMenuVisible(false)}
        >
          <View style={[styles.moreSheet, isTabletDevice && styles.moreSheetTablet]}>
            <View style={styles.moreSheetHeader}>
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <Ionicons name="apps" size={18} color={Colors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.moreSheetTitle}>Meeting Tools &amp; Actions</Text>
              </View>
              <TouchableOpacity onPress={() => setMoreMenuVisible(false)} activeOpacity={0.7} style={styles.moreCloseBtn}>
                <Ionicons name="close" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            </View>

            <View style={styles.moreGrid}>
              {/* Participants Roster */}
              <TouchableOpacity
                onPress={() => {
                  setMoreMenuVisible(false);
                  setParticipantsModalVisible(true);
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View style={[styles.moreTileIcon, { backgroundColor: "rgba(99, 102, 241, 0.15)", borderColor: "rgba(99, 102, 241, 0.35)" }]}>
                  <Ionicons name="people" size={22} color="#818cf8" />
                </View>
                <Text style={styles.moreTileLabel}>Participants ({participants.length + 1})</Text>
              </TouchableOpacity>

              {/* Polls */}
              <TouchableOpacity
                onPress={() => {
                  setMoreMenuVisible(false);
                  setPollsVisible(true);
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View style={[styles.moreTileIcon, { backgroundColor: "rgba(99, 102, 241, 0.15)", borderColor: "rgba(99, 102, 241, 0.35)" }]}>
                  <Ionicons name="bar-chart" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.moreTileLabel}>Polls ({polls.length})</Text>
              </TouchableOpacity>

              {/* Shared Notes */}
              <TouchableOpacity
                onPress={() => {
                  setMoreMenuVisible(false);
                  setNotesVisible(true);
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View style={[styles.moreTileIcon, { backgroundColor: "rgba(16, 185, 129, 0.15)", borderColor: "rgba(16, 185, 129, 0.35)" }]}>
                  <Ionicons name="document-text" size={22} color={Colors.accent} />
                </View>
                <Text style={styles.moreTileLabel}>Meeting Notes</Text>
              </TouchableOpacity>

              {/* Live Whiteboard */}
              <TouchableOpacity
                onPress={() => {
                  setMoreMenuVisible(false);
                  setWhiteboardVisible(true);
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View style={[styles.moreTileIcon, { backgroundColor: "rgba(245, 158, 11, 0.15)", borderColor: "rgba(245, 158, 11, 0.35)" }]}>
                  <Ionicons name="color-palette" size={22} color={Colors.warning} />
                </View>
                <Text style={styles.moreTileLabel}>Whiteboard</Text>
              </TouchableOpacity>

              {/* Emoji Reactions */}
              <TouchableOpacity
                onPress={() => {
                  setMoreMenuVisible(false);
                  setShowReactionPicker(true);
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View style={[styles.moreTileIcon, { backgroundColor: "rgba(236, 72, 153, 0.15)", borderColor: "rgba(236, 72, 153, 0.35)" }]}>
                  <Ionicons name="happy" size={22} color="#ec4899" />
                </View>
                <Text style={styles.moreTileLabel}>Reactions</Text>
              </TouchableOpacity>

              {/* Share Screen */}
              <TouchableOpacity
                onPress={() => {
                  setMoreMenuVisible(false);
                  handleToggleScreenShare();
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View
                  style={[
                    styles.moreTileIcon,
                    isScreenSharing
                      ? { backgroundColor: "rgba(16, 185, 129, 0.2)", borderColor: "#10b981" }
                      : { backgroundColor: "rgba(59, 130, 246, 0.15)", borderColor: "rgba(59, 130, 246, 0.35)" },
                  ]}
                >
                  <Ionicons
                    name={isScreenSharing ? "stop-circle" : "tv-outline"}
                    size={22}
                    color={isScreenSharing ? "#10b981" : "#60a5fa"}
                  />
                </View>
                <Text style={[styles.moreTileLabel, isScreenSharing && { color: "#10b981", fontWeight: "700" }]}>
                  {isScreenSharing ? "Stop Sharing" : "Share Screen"}
                </Text>
              </TouchableOpacity>

              {/* Flip Camera */}
              <TouchableOpacity
                onPress={() => {
                  handleFlipCamera();
                  setMoreMenuVisible(false);
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View style={[styles.moreTileIcon, { backgroundColor: "rgba(148, 163, 184, 0.15)", borderColor: "rgba(148, 163, 184, 0.30)" }]}>
                  <Ionicons name="camera-reverse" size={22} color={Colors.text} />
                </View>
                <Text style={styles.moreTileLabel}>Flip Camera</Text>
              </TouchableOpacity>

              {/* Share Room */}
              <TouchableOpacity
                onPress={() => {
                  setMoreMenuVisible(false);
                  handleShareRoomCode();
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View style={[styles.moreTileIcon, { backgroundColor: "rgba(99, 102, 241, 0.15)", borderColor: "rgba(99, 102, 241, 0.35)" }]}>
                  <Ionicons name="share-social" size={22} color={Colors.primary} />
                </View>
                <Text style={styles.moreTileLabel}>Share Room</Text>
              </TouchableOpacity>

              {/* Call Settings & Data Saver */}
              <TouchableOpacity
                onPress={() => {
                  setMoreMenuVisible(false);
                  setCallSettingsVisible(true);
                }}
                activeOpacity={0.75}
                style={styles.moreTile}
              >
                <View style={[styles.moreTileIcon, { backgroundColor: "rgba(129, 140, 248, 0.15)", borderColor: "rgba(129, 140, 248, 0.35)" }]}>
                  <Ionicons name="options" size={22} color="#818cf8" />
                </View>
                <Text style={styles.moreTileLabel}>Call Settings</Text>
              </TouchableOpacity>

              {/* Host Controls (If Host) */}
              {isHost ? (
                <TouchableOpacity
                  onPress={() => {
                    setMoreMenuVisible(false);
                    setHostControlsVisible(true);
                  }}
                  activeOpacity={0.75}
                  style={styles.moreTile}
                >
                  <View style={[styles.moreTileIcon, { backgroundColor: "rgba(239, 68, 68, 0.15)", borderColor: "rgba(239, 68, 68, 0.35)" }]}>
                    <Ionicons name="shield-checkmark" size={22} color={Colors.danger} />
                  </View>
                  <Text style={styles.moreTileLabel}>Host Controls 👑</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
        </TouchableOpacity>
      </Modal>


      {/* In-Call Chat Modal */}
      <ChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
      />

      {/* Polls Modal */}
      <PollsModal
        visible={pollsVisible}
        onClose={() => setPollsVisible(false)}
        polls={polls}
        currentUserId={user?.id || ""}
        onCreatePoll={handleCreatePoll}
        onVotePoll={handleVotePoll}
      />

      {/* Collaborative Notes Modal */}
      <NotesModal
        visible={notesVisible}
        onClose={() => setNotesVisible(false)}
        notes={notes}
        updatedBy={notesUpdatedBy}
        onUpdateNotes={handleUpdateNotes}
      />

      {/* Interactive Whiteboard Modal */}
      <WhiteboardModal
        visible={whiteboardVisible}
        onClose={() => setWhiteboardVisible(false)}
        onDrawSegment={handleDrawSegment}
        onClearBoard={handleClearWhiteboard}
        onUndoBoard={handleUndoWhiteboard}
      />

      {/* Host Controls Modal */}
      {isHost ? (
        <HostControlsModal
          visible={hostControlsVisible}
          onClose={() => setHostControlsVisible(false)}
          isRoomLocked={isRoomLocked}
          participants={participants}
          onToggleLock={handleToggleRoomLock}
          onMuteAll={handleMuteAll}
          onMuteParticipant={handleMuteParticipant}
          onKickParticipant={handleKickParticipant}
        />
      ) : null}

      {/* Participants Roster & Management Modal */}
      <ParticipantsModal
        visible={participantsModalVisible}
        onClose={() => setParticipantsModalVisible(false)}
        participants={participants}
        currentUser={user}
        isHost={isHost}
        isAudioMuted={isAudioMuted}
        isVideoMuted={isVideoMuted}
        isHandRaised={isHandRaised}
        pinnedSocketId={pinnedSocketId}
        onPinParticipant={(socketId) => {
          setPinnedSocketId(socketId === pinnedSocketId ? null : socketId);
        }}
        onMuteParticipant={(socketId) => {
          socketRef.current?.emit("mute-participant", { targetSocketId: socketId });
        }}
        onKickParticipant={(socketId) => {
          socketRef.current?.emit("kick-participant", { targetSocketId: socketId });
        }}
        onMuteAll={() => {
          socketRef.current?.emit("mute-all");
        }}
      />

      {/* In-Call Settings Modal (Data Saver, Mirror, Audio/Video Preferences) */}
      <CallSettingsModal
        visible={callSettingsVisible}
        onClose={() => setCallSettingsVisible(false)}
        dataSaverMode={dataSaverMode}
        onToggleDataSaver={setDataSaverMode}
        mirrorVideo={mirrorVideo}
        onToggleMirrorVideo={setMirrorVideo}
        noiseSuppression={noiseSuppression}
        onToggleNoiseSuppression={setNoiseSuppression}
        roomCode={roomCode}
        participantCount={participants.length + 1}
      />

      {/* Meeting Ended Summary Modal */}
      <Modal
        visible={summaryModalVisible}
        transparent
        animationType="fade"
      >
        <View style={styles.summaryOverlay}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconCircle}>
              <Ionicons name="checkmark-done" size={30} color="#34d399" />
            </View>
            <Text style={styles.summaryTitle}>You left the meeting</Text>
            <Text style={styles.summarySubtitle}>Room: {roomCode}</Text>

            <View style={styles.summaryStatsRow}>
              <View style={styles.summaryStatItem}>
                <Ionicons name="time-outline" size={18} color="#818cf8" style={{ marginBottom: 4 }} />
                <Text style={styles.summaryStatValue}>
                  {formatTimer(finalCallStats?.duration || callDuration)}
                </Text>
                <Text style={styles.summaryStatLabel}>Duration</Text>
              </View>

              <View style={styles.summaryStatItem}>
                <Ionicons name="people-outline" size={18} color="#34d399" style={{ marginBottom: 4 }} />
                <Text style={styles.summaryStatValue}>
                  {finalCallStats?.participantCount || 1}
                </Text>
                <Text style={styles.summaryStatLabel}>Participants</Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={() => {
                try { Vibration.vibrate(25); } catch {}
                setSummaryModalVisible(false);
                onLeaveRoom();
              }}
              style={styles.summaryDoneBtn}
              activeOpacity={0.8}
            >
              <Text style={styles.summaryDoneText}>Return to Dashboard</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070b13",
  },
  topHeader: {
    backgroundColor: "rgba(11, 17, 32, 0.88)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  topHeaderInner: {
    width: "100%",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topHeaderInnerWide: {
    maxWidth: 1140,
  },
  roomInfoCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRightCol: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(18, 25, 45, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  roomCodePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 25, 45, 0.75)",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.3)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
  },
  liveIndicator: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.danger,
    marginRight: 6,
  },
  roomCodeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  e2eePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.3)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  e2eeText: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  timerText: {
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  participantCountPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(18, 25, 45, 0.75)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  participantCountText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 5,
  },
  gridContent: {
    padding: 12,
    paddingBottom: 96,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  gridContentWide: {
    maxWidth: 1140,
    alignSelf: "center",
    width: "100%",
    paddingHorizontal: 24,
    paddingVertical: 16,
    paddingBottom: 100,
  },
  peerCard: {
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  rtcVideo: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#000000",
  },
  avatarCardBackground: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#0b101d",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarOuterRing: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: "rgba(99, 102, 241, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(99, 102, 241, 0.15)",
  },
  avatarMiddleRing: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: "rgba(99, 102, 241, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarCircle: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.25)",
    shadowColor: "#6366f1",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
  localAvatar: {
    backgroundColor: "#4f46e5",
  },
  remoteAvatar: {
    backgroundColor: "#2563eb",
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 26,
    fontWeight: "800",
  },
  cameraOffPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.7)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginTop: 10,
  },
  cameraOffPillText: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: "600",
    marginLeft: 4,
  },
  screenShareBadge: {
    position: "absolute",
    top: 8,
    left: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(59, 130, 246, 0.85)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
  },
  screenShareBadgeText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "700",
    marginLeft: 3,
  },
  peerFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(11, 15, 25, 0.85)",
    paddingHorizontal: 10,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
  },
  peerName: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
    marginRight: 4,
  },
  statusIconsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mutedBadge: {
    backgroundColor: Colors.danger,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  handBadge: {
    backgroundColor: Colors.warning,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  handIcon: {
    fontSize: 11,
  },
  reactionPickerContainer: {
    position: "absolute",
    bottom: 84,
    alignSelf: "center",
    backgroundColor: "rgba(18, 25, 45, 0.92)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 28,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: "row",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 12,
  },
  reactionPickerItem: {
    padding: 6,
  },
  reactionPickerEmoji: {
    fontSize: 26,
  },
  controlBarWrapper: {
    position: "absolute",
    bottom: 16,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  controlBarWrapperWide: {
    maxWidth: 620,
    left: "auto",
    right: "auto",
    alignSelf: "center",
    width: "100%",
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.88)",
    borderRadius: 30,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    paddingVertical: 8,
    paddingHorizontal: 14,
    gap: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  controlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(30, 41, 59, 0.85)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreBtn: {
    backgroundColor: "rgba(30, 41, 59, 0.85)",
  },
  controlBtnMuted: {
    backgroundColor: Colors.danger,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  controlBtnHand: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderColor: Colors.warning,
  },
  unreadBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: Colors.primary,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: "#0f172a",
  },
  unreadText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  endCallBtn: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 8,
  },
  moreOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "flex-end",
  },
  moreSheet: {
    backgroundColor: "rgba(15, 23, 42, 0.95)",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 22,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.12)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 16,
  },
  moreSheetTablet: {
    maxWidth: 540,
    width: "100%",
    alignSelf: "center",
    borderRadius: 28,
    marginBottom: 40,
    paddingBottom: 24,
  },
  moreSheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  moreSheetTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "800",
    letterSpacing: -0.2,
  },
  moreCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  moreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 12,
  },
  moreTile: {
    width: "30%",
    backgroundColor: "rgba(30, 41, 59, 0.6)",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  moreTileIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
    borderWidth: 1,
  },
  moreTileLabel: {
    color: "#f8fafc",
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  summaryOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  summaryCard: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: "rgba(15, 23, 42, 0.98)",
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: "rgba(255, 255, 255, 0.14)",
    padding: 26,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.6,
    shadowRadius: 24,
    elevation: 20,
  },
  summaryIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "rgba(16, 185, 129, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(16, 185, 129, 0.35)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  summaryTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  summarySubtitle: {
    color: "#94a3b8",
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },
  summaryStatsRow: {
    flexDirection: "row",
    gap: 16,
    marginTop: 20,
    marginBottom: 24,
    width: "100%",
  },
  summaryStatItem: {
    flex: 1,
    backgroundColor: "rgba(30, 41, 59, 0.55)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 18,
    padding: 14,
    alignItems: "center",
  },
  summaryStatValue: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "800",
  },
  summaryStatLabel: {
    color: "#94a3b8",
    fontSize: 11,
    marginTop: 2,
    fontWeight: "600",
  },
  summaryDoneBtn: {
    width: "100%",
    backgroundColor: Colors.primary,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  summaryDoneText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "800",
  },
  screenShareBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(16, 185, 129, 0.14)",
    borderColor: "rgba(16, 185, 129, 0.4)",
    borderWidth: 1,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 14,
  },
  screenShareDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10b981",
    marginRight: 8,
  },
  screenShareText: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 12,
    fontWeight: "700",
  },
  screenShareStopBtn: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
  },
  screenShareStopBtnText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
});
