import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from "react-native";
import { io, Socket } from "socket.io-client";
import { Colors } from "../theme/colors";
import { useAuth } from "../context/AuthContext";
import { getSocketBaseUrl, getStoredToken } from "../config/api";
import { ChatModal } from "../components/ChatModal";
import { ReactionOverlay } from "../components/ReactionOverlay";
import { ChatMessage, Participant, FloatingReaction } from "../types";
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
} from "../services/webrtc.service";

interface RoomScreenProps {
  roomCode: string;
  onLeaveRoom: () => void;
}

const { width } = Dimensions.get("window");

export const RoomScreen = ({ roomCode, onLeaveRoom }: RoomScreenProps) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  // WebRTC Refs
  const localStreamRef = useRef<any | null>(null);
  const [localStream, setLocalStream] = useState<any | null>(null);
  const peerConnectionsRef = useRef<{ [socketId: string]: RTCPeerConnection }>({});
  const iceServersRef = useRef<any[]>([]);
  const iceCandidatesQueueRef = useRef<{ [socketId: string]: RTCIceCandidate[] }>({});

  // Participant & Room state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isBackCamera, setIsBackCamera] = useState(false);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [callDuration, setCallDuration] = useState(0);

  // In-call Chat & Reactions
  const [chatVisible, setChatVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  // Call timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

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
    (peerSocketId: string, peerUserId?: string, peerName?: string): RTCPeerConnection | null => {
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
          const remoteStream = event.streams && event.streams[0] ? event.streams[0] : null;
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
      if (isMounted) {
        iceServersRef.current = servers;
      }

      // 2. Request local camera & mic
      const stream = await getLocalMediaStream(true, true);
      if (isMounted && stream) {
        localStreamRef.current = stream;
        setLocalStream(stream);
      }

      // 3. Connect to Socket.IO signaling server
      const socketUrl = await getSocketBaseUrl();
      const token = await getStoredToken();

      const socket = io(socketUrl, {
        auth: token ? { token } : { guestName: user?.name || "Mobile User" },
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
      });

      socketRef.current = socket;

      socket.on("connect", () => {
        const userId = user?.id || `mobile-${Date.now().toString(36)}`;
        const userName = user?.name || "Mobile User";

        socket.emit("join-room", {
          roomId: roomCode,
          userId,
          name: userName,
          isVideoMuted: false,
          isAudioMuted: false,
        });
      });

      socket.on("room-info", ({ isHost: hostFlag }: { isHost: boolean }) => {
        if (!isMounted) return;
        setIsHost(hostFlag);
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

          // For each existing participant, create peer connection and create offer
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

          // Prepare peer connection to receive offer from joined user
          createPeerConnection(joinedUser.socketId, joinedUser.userId, joinedUser.name);
        }
      );

      // Handle WebRTC Offer
      socket.on(
        "offer",
        async (payload: { from: string; offer: any; userId?: string; name?: string }) => {
          const { from, offer, userId, name } = payload;
          const pc = createPeerConnection(from, userId, name);
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
        if (candidate) {
          addIceCandidateSafe(from, candidate);
        }
      });

      // Participant left
      socket.on("user-left", ({ socketId }: { socketId: string }) => {
        if (!isMounted) return;

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

      // Reactions
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
    if (!localStreamRef.current) return;
    const switched = switchCameraFacing(localStreamRef.current);
    if (switched) {
      setIsBackCamera((prev) => !prev);
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
          onLeaveRoom();
        },
      },
    ]);
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

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
      <View key={key} style={styles.peerCard}>
        {canShowVideo ? (
          <RTCView
            streamURL={stream.toURL()}
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
        <View style={styles.roomInfoCol}>
          <View style={styles.roomCodePill}>
            <View style={styles.liveIndicator} />
            <Text style={styles.roomCodeText}>{roomCode}</Text>
          </View>
          <Text style={styles.timerText}>⏱️ {formatTimer(callDuration)}</Text>
        </View>

        <View style={styles.headerRightCol}>
          {/* Flip camera button */}
          <TouchableOpacity onPress={handleFlipCamera} style={styles.headerIconBtn}>
            <Ionicons name="camera-reverse" size={20} color={Colors.text} />
          </TouchableOpacity>

          <View style={styles.participantCountPill}>
            <Ionicons name="people" size={14} color={Colors.accent} />
            <Text style={styles.participantCountText}>{participants.length + 1}</Text>
          </View>
        </View>
      </View>

      {/* Participant Video Grid */}
      <ScrollView contentContainerStyle={styles.gridContent}>
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

      {/* Floating Emoji Picker Popover */}
      {showReactionPicker ? (
        <View style={styles.reactionPickerContainer}>
          {["👏", "👍", "❤️", "🎉", "🔥", "😂", "🚀", "💡"].map((emoji) => (
            <TouchableOpacity
              key={emoji}
              onPress={() => handleSendReaction(emoji)}
              style={styles.reactionPickerItem}
            >
              <Text style={styles.reactionPickerEmoji}>{emoji}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}

      {/* Bottom Floating Call Control Bar */}
      <View style={styles.controlBar}>
        {/* Mic Toggle */}
        <TouchableOpacity
          onPress={toggleAudio}
          style={[styles.controlBtn, isAudioMuted ? styles.controlBtnMuted : null]}
        >
          <Ionicons
            name={isAudioMuted ? "mic-off" : "mic"}
            size={22}
            color={isAudioMuted ? "#ffffff" : Colors.text}
          />
        </TouchableOpacity>

        {/* Camera Toggle */}
        <TouchableOpacity
          onPress={toggleVideo}
          style={[styles.controlBtn, isVideoMuted ? styles.controlBtnMuted : null]}
        >
          <Ionicons
            name={isVideoMuted ? "videocam-off" : "videocam"}
            size={22}
            color={isVideoMuted ? "#ffffff" : Colors.text}
          />
        </TouchableOpacity>

        {/* Hand Raise */}
        <TouchableOpacity
          onPress={toggleHandRaise}
          style={[styles.controlBtn, isHandRaised ? styles.controlBtnHand : null]}
        >
          <Text style={{ fontSize: 20 }}>✋</Text>
        </TouchableOpacity>

        {/* Reactions */}
        <TouchableOpacity
          onPress={() => setShowReactionPicker(!showReactionPicker)}
          style={styles.controlBtn}
        >
          <Ionicons name="happy-outline" size={22} color={Colors.text} />
        </TouchableOpacity>

        {/* Chat Button with Unread Badge */}
        <TouchableOpacity
          onPress={() => {
            setChatVisible(true);
            setUnreadCount(0);
          }}
          style={styles.controlBtn}
        >
          <Ionicons name="chatbubbles-outline" size={22} color={Colors.text} />
          {unreadCount > 0 ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount}</Text>
            </View>
          ) : null}
        </TouchableOpacity>

        {/* End Call Button */}
        <TouchableOpacity onPress={handleEndCall} style={styles.endCallBtn}>
          <Ionicons
            name="call"
            size={24}
            color="#ffffff"
            style={{ transform: [{ rotate: "135deg" }] }}
          />
        </TouchableOpacity>
      </View>

      {/* In-Call Chat Modal */}
      <ChatModal
        visible={chatVisible}
        onClose={() => setChatVisible(false)}
        messages={messages}
        onSendMessage={handleSendMessage}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#070b13",
  },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "rgba(11, 15, 25, 0.95)",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  roomInfoCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerRightCol: {
    flexDirection: "row",
    alignItems: "center",
  },
  headerIconBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  roomCodePill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    marginRight: 10,
  },
  liveIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.danger,
    marginRight: 6,
  },
  roomCodeText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "700",
  },
  timerText: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
  },
  participantCountPill: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.cardSecondary,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  participantCountText: {
    color: Colors.text,
    fontSize: 12,
    fontWeight: "700",
    marginLeft: 4,
  },
  gridContent: {
    padding: 12,
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  peerCard: {
    width: (width - 36) / 2,
    height: 210,
    backgroundColor: "#0d1322",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
    position: "relative",
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
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.05)",
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
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 4,
  },
  handBadge: {
    backgroundColor: Colors.warning,
    width: 18,
    height: 18,
    borderRadius: 9,
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
    left: 20,
    right: 20,
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    justifyContent: "space-around",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 10,
  },
  reactionPickerItem: {
    padding: 6,
  },
  reactionPickerEmoji: {
    fontSize: 26,
  },
  controlBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    backgroundColor: Colors.card,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  controlBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.cardSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  controlBtnMuted: {
    backgroundColor: Colors.danger,
    borderColor: Colors.danger,
  },
  controlBtnHand: {
    backgroundColor: "rgba(245, 158, 11, 0.25)",
    borderColor: Colors.warning,
  },
  unreadBadge: {
    position: "absolute",
    top: -3,
    right: -3,
    backgroundColor: Colors.danger,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  unreadText: {
    color: "#ffffff",
    fontSize: 10,
    fontWeight: "800",
  },
  endCallBtn: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.danger,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.danger,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 6,
  },
});
