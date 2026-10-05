import React, { useState, useEffect, useRef } from "react";
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
import { getSocketBaseUrl } from "../config/api";
import { ChatModal } from "../components/ChatModal";
import { ReactionOverlay } from "../components/ReactionOverlay";
import { ChatMessage, Participant, FloatingReaction } from "../types";
import { Ionicons } from "@expo/vector-icons";

interface RoomScreenProps {
  roomCode: string;
  onLeaveRoom: () => void;
}

const { width } = Dimensions.get("window");

export const RoomScreen = ({ roomCode, onLeaveRoom }: RoomScreenProps) => {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  // Participant & Room state
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
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

  // Connect to Socket.IO signaling server
  useEffect(() => {
    let isMounted = true;

    const connectSocket = async () => {
      const socketUrl = await getSocketBaseUrl();
      const socket = io(socketUrl, {
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
        });
      });

      socket.on("room-info", ({ isHost: hostFlag }: { isHost: boolean }) => {
        if (!isMounted) return;
        setIsHost(hostFlag);
      });

      socket.on("room-users", ({ users }: { users: { socketId: string; userId: string; name?: string; isHost?: boolean }[] }) => {
        if (!isMounted) return;
        setParticipants(
          users.map((u) => ({
            socketId: u.socketId,
            userId: u.userId,
            name: u.name || "Participant",
            isHost: u.isHost,
          }))
        );
      });

      socket.on("user-joined", (joinedUser: { socketId: string; userId: string; name?: string; isHost?: boolean }) => {
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
            },
          ];
        });
      });

      socket.on("user-left", ({ socketId }: { socketId: string }) => {
        if (!isMounted) return;
        setParticipants((prev) => prev.filter((p) => p.socketId !== socketId));
      });

      // Chat
      socket.on("chat-message", (msg: { userId?: string; name?: string; message: string; at: number }) => {
        if (!isMounted) return;
        const newMsg: ChatMessage = {
          ...msg,
          isLocal: false,
        };
        setMessages((prev) => [...prev, newMsg]);
        setUnreadCount((c) => (chatVisible ? 0 : c + 1));
      });

      // Reactions
      socket.on("reaction-received", (reaction: FloatingReaction) => {
        if (!isMounted) return;
        setReactions((prev) => [...prev.slice(-10), reaction]);
      });

      // Hand raise
      socket.on("hand-raised", ({ socketId, isRaised }: { socketId: string; isRaised: boolean }) => {
        if (!isMounted) return;
        setParticipants((prev) =>
          prev.map((p) => (p.socketId === socketId ? { ...p, isHandRaised: isRaised } : p))
        );
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
    };

    connectSocket();

    return () => {
      isMounted = false;
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [roomCode]);

  // Audio mute toggle
  const toggleAudio = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    if (socketRef.current) {
      socketRef.current.emit("media-toggle", {
        roomId: roomCode,
        type: "audio",
        enabled: !next,
      });
    }
  };

  // Video mute toggle
  const toggleVideo = () => {
    const next = !isVideoMuted;
    setIsVideoMuted(next);
    if (socketRef.current) {
      socketRef.current.emit("media-toggle", {
        roomId: roomCode,
        type: "video",
        enabled: !next,
      });
    }
  };

  // Raise hand toggle
  const toggleHandRaise = () => {
    const next = !isHandRaised;
    setIsHandRaised(next);
    if (socketRef.current) {
      socketRef.current.emit("raise-hand", {
        roomId: roomCode,
        name: user?.name || "Mobile User",
        userId: user?.id,
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
        roomId: roomCode,
        emoji,
        name: user?.name || "You",
        socketId: socketRef.current.id,
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
      socketRef.current.emit("send-chat", {
        roomId: roomCode,
        message: text,
        name: user?.name || "You",
        userId: user?.id,
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

        <View style={styles.participantCountPill}>
          <Ionicons name="people" size={14} color={Colors.accent} />
          <Text style={styles.participantCountText}>{participants.length + 1}</Text>
        </View>
      </View>

      {/* Participant Grid */}
      <ScrollView contentContainerStyle={styles.gridContent}>
        {/* Local Participant Card */}
        <View style={styles.peerCard}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarInitial}>
              {(user?.name || "Y")[0].toUpperCase()}
            </Text>
          </View>

          <View style={styles.peerFooter}>
            <Text style={styles.peerName}>
              {user?.name || "You"} (You) {isHost ? "👑" : ""}
            </Text>
            <View style={styles.statusIconsRow}>
              {isHandRaised ? (
                <View style={styles.handBadge}>
                  <Text style={styles.handIcon}>✋</Text>
                </View>
              ) : null}
              {isAudioMuted ? (
                <View style={styles.mutedBadge}>
                  <Ionicons name="mic-off" size={12} color="#ffffff" />
                </View>
              ) : null}
              {isVideoMuted ? (
                <View style={styles.mutedBadge}>
                  <Ionicons name="videocam-off" size={12} color="#ffffff" />
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {/* Remote Peers */}
        {participants.map((peer) => (
          <View key={peer.socketId} style={styles.peerCard}>
            <View style={[styles.avatarCircle, styles.remoteAvatarCircle]}>
              <Text style={styles.avatarInitial}>
                {(peer.name || "P")[0].toUpperCase()}
              </Text>
            </View>

            <View style={styles.peerFooter}>
              <Text style={styles.peerName}>
                {peer.name || "Participant"} {peer.isHost ? "👑" : ""}
              </Text>
              <View style={styles.statusIconsRow}>
                {peer.isHandRaised ? (
                  <View style={styles.handBadge}>
                    <Text style={styles.handIcon}>✋</Text>
                  </View>
                ) : null}
              </View>
            </View>
          </View>
        ))}
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
          <Ionicons name="call" size={24} color="#ffffff" style={{ transform: [{ rotate: "135deg" }] }} />
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
    backgroundColor: "rgba(11, 15, 25, 0.9)",
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  roomInfoCol: {
    flexDirection: "row",
    alignItems: "center",
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
    height: 190,
    backgroundColor: Colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    overflow: "hidden",
  },
  avatarCircle: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: Colors.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  remoteAvatarCircle: {
    backgroundColor: "#1e293b",
    borderColor: Colors.accent,
  },
  avatarInitial: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "800",
  },
  peerFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(11, 15, 25, 0.8)",
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  peerName: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "700",
    flex: 1,
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
